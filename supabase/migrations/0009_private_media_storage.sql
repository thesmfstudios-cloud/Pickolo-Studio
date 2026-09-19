-- Pickolo Studio
-- Migration 0009: private media storage policies
-- Date: 2026-09-19

insert into storage.buckets (id, name, public)
values
  ('booking-deliveries', 'booking-deliveries', false),
  ('partner-portfolio', 'partner-portfolio', false)
on conflict (id) do update set public = excluded.public;

create policy "booking_delivery_customer_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'booking-deliveries'
  and exists (
    select 1
    from public.bookings b
    where b.id::text = split_part(name, '/', 1)
      and b.customer_id = auth.uid()
  )
);

create policy "booking_delivery_partner_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'booking-deliveries'
  and exists (
    select 1
    from public.bookings b
    where b.id::text = split_part(name, '/', 1)
      and b.assigned_partner_id = auth.uid()
  )
);

create policy "booking_delivery_partner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'booking-deliveries'
  and exists (
    select 1
    from public.bookings b
    where b.id::text = split_part(name, '/', 1)
      and b.assigned_partner_id = auth.uid()
  )
);

create policy "partner_portfolio_owner_all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'partner-portfolio'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'partner-portfolio'
  and owner_id = auth.uid()::text
);

create policy "booking_delivery_admin_all"
on storage.objects for all
to authenticated
using (bucket_id = 'booking-deliveries' and public.is_admin())
with check (bucket_id = 'booking-deliveries' and public.is_admin());
