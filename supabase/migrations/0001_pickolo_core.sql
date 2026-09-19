-- Pickolo Studio
-- Migration: core marketplace schema
-- Phase: Foundation
-- Date: 2026-09-19

create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'partner', 'admin');
create type public.partner_verification_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.booking_status as enum (
  'REQUESTED',
  'PAYMENT_CONFIRMED',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
  'ON_THE_WAY',
  'SHOOT_STARTED',
  'SHOOT_COMPLETED',
  'DATA_PENDING',
  'DATA_SUBMITTED',
  'CUSTOMER_CONFIRMED',
  'PAYOUT_RELEASED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  sort_order integer not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key references public.profiles(id) on delete cascade,
  partner_code text not null unique,
  verification_status public.partner_verification_status not null default 'pending',
  service_level_id uuid references public.service_levels(id),
  bio text,
  base_lat numeric(9,6),
  base_long numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_availability (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint partner_availability_valid_window check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default ('PKL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),
  service_level_id uuid not null references public.service_levels(id),
  assigned_partner_id uuid references public.partners(id),
  status public.booking_status not null default 'REQUESTED',
  scheduled_start timestamptz not null,
  duration_minutes integer not null,
  location_text text not null,
  location_lat numeric(9,6),
  location_long numeric(9,6),
  notes text,
  customer_price_paise bigint not null default 0,
  platform_fee_paise bigint not null default 0,
  partner_payout_paise bigint not null default 0,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_duration_valid check (duration_minutes in (30, 60, 120)),
  constraint booking_price_valid check (
    customer_price_paise >= 0
    and platform_fee_paise >= 0
    and partner_payout_paise >= 0
  )
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  provider text,
  provider_payment_id text,
  amount_paise bigint not null,
  status text not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_amount_valid check (amount_paise >= 0)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  amount_paise bigint not null,
  status text not null default 'pending',
  provider_payout_id text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint payout_amount_valid check (amount_paise >= 0)
);

create table public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  storage_path text,
  delivery_url text,
  submitted_by uuid references public.partners(id),
  submitted_at timestamptz,
  customer_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  partner_id uuid not null references public.partners(id),
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint review_rating_valid check (rating between 1 and 5)
);

create table public.partner_performance (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  completed_jobs integer not null default 0,
  on_time_jobs integer not null default 0,
  cancellations integer not null default 0,
  no_shows integer not null default 0,
  delivered_jobs integer not null default 0,
  average_rating numeric(3,2),
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint performance_counters_valid check (
    completed_jobs >= 0
    and on_time_jobs >= 0
    and cancellations >= 0
    and no_shows >= 0
    and delivered_jobs >= 0
    and xp >= 0
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  channel text not null default 'in_app',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index bookings_customer_idx on public.bookings(customer_id, created_at desc);
create index bookings_partner_idx on public.bookings(assigned_partner_id, scheduled_start);
create index bookings_status_idx on public.bookings(status, scheduled_start);
create index partner_availability_window_idx on public.partner_availability(partner_id, starts_at, ends_at);
create index booking_history_booking_idx on public.booking_status_history(booking_id, created_at);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

insert into public.service_levels (name, description, sort_order)
values
  ('Basic', 'Simple requirement; cost-sensitive', 1),
  ('Standard', 'Reliable, professional coverage', 2),
  ('Professional', 'Higher quality; stronger track record', 3)
on conflict (name) do nothing;

insert into public.services (name, description)
values ('Photography', 'Short-duration photography assignments')
on conflict (name) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.service_levels enable row level security;
alter table public.services enable row level security;
alter table public.partners enable row level security;
alter table public.partner_availability enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.delivery_records enable row level security;
alter table public.reviews enable row level security;
alter table public.partner_performance enable row level security;
alter table public.notifications enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "service_levels_public_read"
on public.service_levels for select
to anon, authenticated
using (active = true);

create policy "services_public_read"
on public.services for select
to anon, authenticated
using (active = true);

create policy "partners_public_read_approved"
on public.partners for select
to anon, authenticated
using (verification_status = 'approved');

create policy "partner_availability_owner_read"
on public.partner_availability for select
to authenticated
using (partner_id = auth.uid());

create policy "partner_availability_owner_write"
on public.partner_availability for all
to authenticated
using (partner_id = auth.uid())
with check (partner_id = auth.uid());

create policy "bookings_customer_read"
on public.bookings for select
to authenticated
using (customer_id = auth.uid());

create policy "bookings_partner_read"
on public.bookings for select
to authenticated
using (assigned_partner_id = auth.uid());

create policy "booking_customer_insert"
on public.bookings for insert
to authenticated
with check (customer_id = auth.uid());

create policy "booking_history_participant_read"
on public.booking_status_history for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_status_history.booking_id
      and (b.customer_id = auth.uid() or b.assigned_partner_id = auth.uid())
  )
);

create policy "payments_customer_read"
on public.payments for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id and b.customer_id = auth.uid()
  )
);

create policy "payouts_partner_read"
on public.payouts for select
to authenticated
using (partner_id = auth.uid());

create policy "delivery_customer_read"
on public.delivery_records for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = delivery_records.booking_id and b.customer_id = auth.uid()
  )
);

create policy "delivery_partner_read"
on public.delivery_records for select
to authenticated
using (submitted_by = auth.uid());

create policy "reviews_customer_read"
on public.reviews for select
to authenticated
using (customer_id = auth.uid() or partner_id = auth.uid());

create policy "notifications_owner_read"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

-- Admin authorization will be centralized in backend/server actions
-- after the final admin role strategy is implemented.
