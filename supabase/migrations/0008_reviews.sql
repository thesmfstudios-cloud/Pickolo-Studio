-- Pickolo Studio
-- Migration 0008: review workflow
-- Date: 2026-09-19

create index if not exists reviews_partner_idx
on public.reviews(partner_id, created_at desc);

create policy "reviews_customer_insert"
on public.reviews for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from public.bookings b
    where b.id = reviews.booking_id
      and b.customer_id = auth.uid()
      and b.assigned_partner_id = reviews.partner_id
      and b.status = 'COMPLETED'
  )
);
