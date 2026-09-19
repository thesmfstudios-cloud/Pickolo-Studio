-- Pickolo Studio
-- Migration 0004: partner onboarding + notifications
-- Date: 2026-09-19

create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  bio text,
  phone text,
  skills text[] not null default '{}',
  base_lat numeric(9,6),
  base_long numeric(9,6),
  status public.partner_verification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  app_role public.user_role not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index partner_applications_status_idx
on public.partner_applications(status, created_at desc);

create index device_push_tokens_user_idx
on public.device_push_tokens(user_id, active);

alter table public.partner_applications enable row level security;
alter table public.device_push_tokens enable row level security;

create policy "partner_application_owner_read"
on public.partner_applications for select
to authenticated
using (applicant_id = auth.uid());

create policy "partner_application_owner_insert"
on public.partner_applications for insert
to authenticated
with check (applicant_id = auth.uid());

create policy "partner_application_owner_update"
on public.partner_applications for update
to authenticated
using (applicant_id = auth.uid() and status = 'pending')
with check (applicant_id = auth.uid() and status = 'pending');

create policy "partner_application_admin_all"
on public.partner_applications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "device_token_owner_all"
on public.device_push_tokens for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "profiles_admin_all"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "payouts_admin_all"
on public.payouts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists partner_applications_touch on public.partner_applications;
create trigger partner_applications_touch
before update on public.partner_applications
for each row execute procedure public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
before update on public.profiles
for each row execute procedure public.touch_updated_at();
