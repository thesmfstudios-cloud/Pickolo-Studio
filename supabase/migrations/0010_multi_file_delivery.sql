-- Pickolo Studio
-- Migration 0010: multi-file private delivery
-- Date: 2026-09-19

create table public.delivery_assets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (booking_id, storage_path),
  constraint delivery_asset_size_valid check (size_bytes is null or size_bytes >= 0)
);

create index delivery_assets_booking_idx
on public.delivery_assets(booking_id, created_at);

alter table public.delivery_assets enable row level security;

create policy "delivery_assets_customer_read"
on public.delivery_assets for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = delivery_assets.booking_id
      and b.customer_id = auth.uid()
  )
);

create policy "delivery_assets_partner_insert"
on public.delivery_assets for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.bookings b
    join public.partners p on p.id = b.assigned_partner_id
    where b.id = delivery_assets.booking_id
      and b.assigned_partner_id = auth.uid()
      and p.verification_status = 'approved'
  )
);

create policy "delivery_assets_admin_all"
on public.delivery_assets for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
