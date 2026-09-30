alter table public.bookings
  add column if not exists payment_timing text not null default 'upfront'
  check (payment_timing in ('upfront', 'after_shoot'));

create or replace function public.request_pay_after_shoot(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.bookings set payment_timing = 'after_shoot', status = 'PAYMENT_CONFIRMED'
  where id = p_booking_id and customer_id = auth.uid() and status = 'REQUESTED';
  if not found then raise exception 'Booking is not awaiting payment.'; end if;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, metadata)
  values (p_booking_id, 'REQUESTED', 'PAYMENT_CONFIRMED', auth.uid(), '{"payment_timing":"after_shoot"}'::jsonb);
end;
$$;
revoke all on function public.request_pay_after_shoot(uuid) from public, anon;
grant execute on function public.request_pay_after_shoot(uuid) to authenticated;
