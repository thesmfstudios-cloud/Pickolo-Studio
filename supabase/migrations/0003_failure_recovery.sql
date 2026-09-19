-- Pickolo Studio
-- Migration 0003: failure recovery + delivery incidents
-- Date: 2026-09-19

create table public.booking_incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid references public.partners(id),
  incident_type text not null,
  reason text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.booking_reassignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_partner_id uuid references public.partners(id),
  to_partner_id uuid references public.partners(id),
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index booking_incidents_booking_idx on public.booking_incidents(booking_id, created_at desc);
create index booking_reassignments_booking_idx on public.booking_reassignments(booking_id, created_at desc);

alter table public.booking_incidents enable row level security;
alter table public.booking_reassignments enable row level security;

create policy "booking_incidents_admin_all"
on public.booking_incidents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "booking_reassignments_admin_all"
on public.booking_reassignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "delivery_partner_insert_assigned"
on public.delivery_records for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = delivery_records.booking_id
      and b.assigned_partner_id = auth.uid()
  )
);

create policy "delivery_partner_update_assigned"
on public.delivery_records for update
to authenticated
using (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = delivery_records.booking_id
      and b.assigned_partner_id = auth.uid()
  )
)
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = delivery_records.booking_id
      and b.assigned_partner_id = auth.uid()
  )
);
