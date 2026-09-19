-- Pickolo Studio
-- Migration 0013: partner acceptance workflow
-- Date: 2026-09-19

create type public.partner_acceptance_status as enum (
  'not_required',
  'pending',
  'accepted',
  'declined',
  'expired'
);

alter table public.bookings
  add column if not exists partner_acceptance_status public.partner_acceptance_status not null default 'not_required',
  add column if not exists partner_acceptance_at timestamptz,
  add column if not exists partner_declined_at timestamptz;

create index bookings_partner_acceptance_idx
on public.bookings(assigned_partner_id, partner_acceptance_status, scheduled_start);

create table public.partner_assignment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  event_type text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index partner_assignment_events_booking_idx
on public.partner_assignment_events(booking_id, created_at desc);

alter table public.partner_assignment_events enable row level security;

create policy "partner_assignment_events_admin_all"
on public.partner_assignment_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "partner_assignment_events_partner_read"
on public.partner_assignment_events for select
to authenticated
using (partner_id = auth.uid());

create policy "partner_assignment_events_customer_read"
on public.partner_assignment_events for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = partner_assignment_events.booking_id
      and b.customer_id = auth.uid()
  )
);