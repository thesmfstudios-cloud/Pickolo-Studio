create or replace function public.create_customer_payment_order(
  p_booking_id uuid,
  p_provider_order_id text,
  p_amount_paise bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.bookings
    where id = p_booking_id and customer_id = auth.uid() and status = 'REQUESTED'
  ) then
    raise exception 'Booking is not awaiting payment.';
  end if;

  insert into public.payments (booking_id, provider, provider_order_id, amount_paise, status)
  values (p_booking_id, 'razorpay', p_provider_order_id, p_amount_paise, 'created')
  on conflict (booking_id) do update set
    provider = excluded.provider,
    provider_order_id = excluded.provider_order_id,
    amount_paise = excluded.amount_paise,
    status = 'created';
end;
$$;

revoke all on function public.create_customer_payment_order(uuid, text, bigint) from public, anon;
grant execute on function public.create_customer_payment_order(uuid, text, bigint) to authenticated;
