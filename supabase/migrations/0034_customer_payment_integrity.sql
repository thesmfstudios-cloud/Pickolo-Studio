-- Separate booking fulfilment from payment. Only trusted server code may write provider orders.
revoke all on function public.create_customer_payment_order(uuid,text,bigint) from authenticated,anon,public;

create or replace function public.request_pay_after_shoot(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=p_booking_id and customer_id=auth.uid() for update;
  if not found then raise exception 'Booking not found.'; end if;
  if b.payment_timing='after_shoot' and b.status not in ('REQUESTED','CANCELLED','REFUNDED') then return; end if;
  if b.status <> 'REQUESTED' then raise exception 'Booking is not awaiting payment selection.'; end if;
  if exists(select 1 from public.payments where booking_id=b.id and status in ('captured','refunded')) then raise exception 'Payment has already been recorded.'; end if;
  update public.bookings set payment_timing='after_shoot',status='SEARCHING_PARTNER' where id=b.id;
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,metadata)
  values(b.id,'REQUESTED','SEARCHING_PARTNER',auth.uid(),'{"payment_timing":"after_shoot","payment_status":"due"}');
end; $$;
revoke all on function public.request_pay_after_shoot(uuid) from public,anon;
grant execute on function public.request_pay_after_shoot(uuid) to authenticated;

create or replace function public.store_server_payment_order(p_booking_id uuid,p_order_id text)
returns public.payments language plpgsql security definer set search_path=public as $$
declare b public.bookings; p public.payments;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Booking not found.'; end if;
 select * into p from public.payments where booking_id=b.id for update;
 if p.status='captured' then raise exception 'Payment already received.'; end if;
 if b.status<>'REQUESTED' and not (b.payment_timing='after_shoot' and b.status in ('SEARCHING_PARTNER','PARTNER_ASSIGNED','ON_THE_WAY','SHOOT_STARTED','SHOOT_COMPLETED','DATA_PENDING','DATA_SUBMITTED','CUSTOMER_CONFIRMED','COMPLETED')) then raise exception 'Booking is not awaiting payment.'; end if;
 if p.provider_order_id is not null and p.status in ('created','pending','failed') then return p; end if;
 if p_order_id !~ '^order_[A-Za-z0-9]+$' then raise exception 'Invalid provider order.'; end if;
 insert into public.payments(booking_id,provider,provider_order_id,amount_paise,status)
 values(b.id,'razorpay',p_order_id,b.customer_price_paise,'created')
 on conflict(booking_id) do update set provider='razorpay',provider_order_id=excluded.provider_order_id,amount_paise=excluded.amount_paise,status='created',provider_payment_id=null,failed_at=null
 returning * into p;
 return p;
end; $$;
revoke all on function public.store_server_payment_order(uuid,text) from public,anon,authenticated;
grant execute on function public.store_server_payment_order(uuid,text) to service_role;

-- Caller has already verified the provider signature and fetched the captured payment.
-- Both checkout callbacks and signed webhooks use this transaction; retries are idempotent.
create or replace function public.record_verified_payment(p_booking_id uuid,p_order_id text,p_payment_id text,p_amount bigint,p_signature text default null)
returns text language plpgsql security definer set search_path=public as $$
declare b public.bookings; p public.payments;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 select * into p from public.payments where booking_id=p_booking_id for update;
 if b.id is null or p.id is null or p.provider_order_id is distinct from p_order_id or p.amount_paise<>p_amount or b.customer_price_paise<>p_amount then raise exception 'Verified payment does not match this booking.'; end if;
 if p.status='captured' then
   if p.provider_payment_id is distinct from p_payment_id then raise exception 'A different payment is already recorded.'; end if;
   return b.status::text;
 end if;
 if p.status in ('refunded','refund_pending') then raise exception 'Payment is under refund processing.'; end if;
 update public.payments set status='captured',provider_payment_id=p_payment_id,provider_signature=p_signature,captured_at=now() where id=p.id;
 if b.status='REQUESTED' then
   update public.bookings set status='PAYMENT_CONFIRMED' where id=b.id;
   insert into public.booking_status_history(booking_id,from_status,to_status,metadata) values(b.id,b.status,'PAYMENT_CONFIRMED',jsonb_build_object('provider','razorpay','provider_payment_id',p_payment_id));
   return 'PAYMENT_CONFIRMED';
 end if;
 -- Capture after cancellation is recorded for reconciliation/refund without reopening the booking.
 insert into public.booking_status_history(booking_id,from_status,to_status,metadata) values(b.id,b.status,b.status,jsonb_build_object('provider','razorpay','provider_payment_id',p_payment_id,'payment_status','captured'));
 return b.status::text;
end; $$;
revoke all on function public.record_verified_payment(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_verified_payment(uuid,text,text,bigint,text) to service_role;

-- Enforce the money gate regardless of which API performs delivery/payout transitions.
create or replace function public.guard_paid_booking_completion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from old.status and new.status in ('CUSTOMER_CONFIRMED','PAYOUT_RELEASED','COMPLETED') and
 not exists(select 1 from public.payments where booking_id=new.id and status='captured' and amount_paise=new.customer_price_paise) then
   raise exception 'Payment must be received before confirming delivery or releasing payout.';
 end if;
 return new;
end; $$;
create trigger booking_paid_completion before update of status on public.bookings for each row execute function public.guard_paid_booking_completion();
-- Repair deferred bookings that the old flow incorrectly labelled payment-confirmed.
update public.bookings b set status='SEARCHING_PARTNER' where b.payment_timing='after_shoot' and b.status='PAYMENT_CONFIRMED' and not exists(select 1 from public.payments p where p.booking_id=b.id and p.status='captured');
