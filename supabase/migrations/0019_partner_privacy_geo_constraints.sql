-- Pickolo Studio
-- Migration 0019: partner privacy and coordinate validation
-- Date: 2026-09-19

-- Approved partner base coordinates are operational data used by server-side
-- matching. Customers and anonymous users do not need to read them directly.
drop policy if exists "partners_public_read_approved" on public.partners;

create policy "partners_owner_read"
on public.partners for select
to authenticated
using (id = auth.uid());

-- Prevent malformed geographic input from entering the matching engine.
alter table public.bookings
  drop constraint if exists bookings_location_lat_valid,
  drop constraint if exists bookings_location_long_valid;

alter table public.bookings
  add constraint bookings_location_lat_valid
    check (location_lat is null or location_lat between -90 and 90),
  add constraint bookings_location_long_valid
    check (location_long is null or location_long between -180 and 180);

alter table public.partners
  drop constraint if exists partners_base_lat_valid,
  drop constraint if exists partners_base_long_valid;

alter table public.partners
  add constraint partners_base_lat_valid
    check (base_lat is null or base_lat between -90 and 90),
  add constraint partners_base_long_valid
    check (base_long is null or base_long between -180 and 180);
