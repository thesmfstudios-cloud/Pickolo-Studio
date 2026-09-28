-- Pickolo Studio
-- Migration 0030: partner pool marketplace, portfolio and XP progression
-- Date: 2026-09-28

begin;

alter table public.partner_applications
  add column if not exists service_types text[] not null default array['Photography']::text[];

create table if not exists public.partner_services (
  partner_id uuid not null references public.partners(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, service_id)
);

create index if not exists partner_services_service_idx
  on public.partner_services(service_id, partner_id);

alter table public.partner_services enable row level security;

drop policy if exists "partner_services_owner_read" on public.partner_services;
create policy "partner_services_owner_read"
on public.partner_services for select
to authenticated
using (partner_id = auth.uid() or public.is_admin());

create table if not exists public.partner_job_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','lost','expired')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, partner_id)
);

create index if not exists partner_job_offers_partner_idx
  on public.partner_job_offers(partner_id, status, expires_at, created_at desc);
create index if not exists partner_job_offers_booking_idx
  on public.partner_job_offers(booking_id, status);

alter table public.partner_job_offers enable row level security;

drop policy if exists "partner_job_offers_owner_read" on public.partner_job_offers;
create policy "partner_job_offers_owner_read"
on public.partner_job_offers for select
to authenticated
using (partner_id = auth.uid());

create table if not exists public.partner_level_rules (
  level_id uuid primary key references public.service_levels(id) on delete cascade,
  next_level_id uuid references public.service_levels(id),
  min_xp integer not null check (min_xp >= 0),
  min_average_rating numeric(3,2) not null check (min_average_rating between 0 and 5),
  min_completed_jobs integer not null check (min_completed_jobs >= 0),
  updated_at timestamptz not null default now()
);

insert into public.partner_level_rules(level_id,next_level_id,min_xp,min_average_rating,min_completed_jobs)
select current_level.id, next_level.id, rules.min_xp, rules.min_rating, rules.min_jobs
from (values
  ('Basic','Standard',1000,4.20::numeric,10),
  ('Standard','Professional',3000,4.60::numeric,30)
) rules(current_name,next_name,min_xp,min_rating,min_jobs)
join public.service_levels current_level on current_level.name = rules.current_name
join public.service_levels next_level on next_level.name = rules.next_name
on conflict(level_id) do update set
  next_level_id = excluded.next_level_id,
  min_xp = excluded.min_xp,
  min_average_rating = excluded.min_average_rating,
  min_completed_jobs = excluded.min_completed_jobs,
  updated_at = now();

alter table public.partner_level_rules enable row level security;

drop policy if exists "partner_level_rules_read" on public.partner_level_rules;
create policy "partner_level_rules_read"
on public.partner_level_rules for select
to authenticated
using (true);

alter table public.partner_performance
  add column if not exists review_count integer not null default 0
  check (review_count >= 0);

create table if not exists public.partner_xp_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  review_id uuid unique references public.reviews(id) on delete set null,
  xp_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_xp_events_partner_idx
  on public.partner_xp_events(partner_id, created_at desc);

alter table public.partner_xp_events enable row level security;

drop policy if exists "partner_xp_events_owner_read" on public.partner_xp_events;
create policy "partner_xp_events_owner_read"
on public.partner_xp_events for select
to authenticated
using (partner_id = auth.uid());

create table if not exists public.partner_portfolio_media (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists partner_portfolio_media_partner_idx
  on public.partner_portfolio_media(partner_id, active, sort_order, created_at);

alter table public.partner_portfolio_media enable row level security;

drop policy if exists "partner_portfolio_public_read" on public.partner_portfolio_media;
create policy "partner_portfolio_public_read"
on public.partner_portfolio_media for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1 from public.partners p
    where p.id = partner_portfolio_media.partner_id
      and p.verification_status = 'approved'
  )
);

drop policy if exists "partner_portfolio_owner_insert" on public.partner_portfolio_media;
create policy "partner_portfolio_owner_insert"
on public.partner_portfolio_media for insert
to authenticated
with check (partner_id = auth.uid());

drop policy if exists "partner_portfolio_owner_update" on public.partner_portfolio_media;
create policy "partner_portfolio_owner_update"
on public.partner_portfolio_media for update
to authenticated
using (partner_id = auth.uid())
with check (partner_id = auth.uid());

drop policy if exists "partner_portfolio_owner_delete" on public.partner_portfolio_media;
create policy "partner_portfolio_owner_delete"
on public.partner_portfolio_media for delete
to authenticated
using (partner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-portfolio',
  'partner-portfolio',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partner_portfolio_storage_insert" on storage.objects;
create policy "partner_portfolio_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'partner-portfolio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "partner_portfolio_storage_update" on storage.objects;
create policy "partner_portfolio_storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'partner-portfolio'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'partner-portfolio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "partner_portfolio_storage_delete" on storage.objects;
create policy "partner_portfolio_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'partner-portfolio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.claim_partner_job(p_booking_id uuid)
returns table (
  booking_id uuid,
  booking_code text,
  assigned_partner_id uuid,
  status public.booking_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_offer public.partner_job_offers%rowtype;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  if v_partner_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.partners p
    where p.id = v_partner_id
      and p.verification_status = 'approved'
      and p.is_accepting_jobs = true
  ) then
    raise exception 'Verified online partner access required.';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then raise exception 'Booking not found.'; end if;

  if v_booking.status <> 'SEARCHING_PARTNER' or v_booking.assigned_partner_id is not null then
    raise exception 'This job has already been taken.';
  end if;

  select * into v_offer
  from public.partner_job_offers
  where booking_id = p_booking_id
    and partner_id = v_partner_id
    and status = 'pending'
  for update;

  if not found then raise exception 'Active job offer not found.'; end if;
  if v_offer.expires_at <= now() then
    update public.partner_job_offers
      set status = 'expired', responded_at = now()
    where id = v_offer.id;
    raise exception 'This job offer has expired.';
  end if;

  if not exists (
    select 1 from public.partners p
    where p.id = v_partner_id
      and p.service_level_id = v_booking.service_level_id
  ) then
    raise exception 'Your current Pickolo level is not eligible for this job.';
  end if;

  v_starts_at := v_booking.scheduled_start;
  v_ends_at := v_booking.scheduled_start + make_interval(mins => v_booking.duration_minutes);

  if exists (
    select 1 from public.bookings b
    where b.assigned_partner_id = v_partner_id
      and b.id <> p_booking_id
      and b.status not in ('CANCELLED','REFUNDED','COMPLETED','DISPUTED')
      and v_starts_at < (b.scheduled_start + make_interval(mins => b.duration_minutes))
      and v_ends_at > b.scheduled_start
  ) then
    raise exception 'You already have another Pickolo job during this time.';
  end if;

  update public.bookings
  set
    assigned_partner_id = v_partner_id,
    status = 'PARTNER_ASSIGNED',
    partner_acceptance_status = 'accepted',
    partner_acceptance_at = now(),
    partner_declined_at = null,
    partner_offer_expires_at = null,
    updated_at = now()
  where id = p_booking_id;

  update public.partner_job_offers
  set
    status = case when partner_id = v_partner_id then 'accepted' else 'lost' end,
    responded_at = now()
  where booking_id = p_booking_id
    and status = 'pending';

  insert into public.partner_assignment_events(booking_id, partner_id, event_type, reason)
  values (p_booking_id, v_partner_id, 'ACCEPTED', 'First partner to accept pool broadcast');

  insert into public.booking_status_history(
    booking_id, from_status, to_status, changed_by, metadata
  ) values (
    p_booking_id,
    'SEARCHING_PARTNER',
    'PARTNER_ASSIGNED',
    v_partner_id,
    jsonb_build_object('assignment_mode','pool_first_accept')
  );

  insert into public.notifications(user_id, booking_id, channel, title, body)
  values (
    v_booking.customer_id,
    p_booking_id,
    'in_app',
    'Your Pickolo professional is confirmed',
    'A verified Pickolo professional accepted booking ' || v_booking.booking_code || '.'
  );

  return query
  select v_booking.id, v_booking.booking_code, v_partner_id, 'PARTNER_ASSIGNED'::public.booking_status;
end;
$$;

revoke all on function public.claim_partner_job(uuid) from public, anon;
grant execute on function public.claim_partner_job(uuid) to authenticated;

create or replace function public.log_completed_job_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $
begin
  if new.status = 'COMPLETED'
     and old.status is distinct from new.status
     and new.assigned_partner_id is not null then
    insert into public.partner_xp_events(partner_id, booking_id, xp_delta, reason)
    select new.assigned_partner_id, new.id, 100, 'Completed Pickolo job'
    where not exists (
      select 1 from public.partner_xp_events
      where partner_id = new.assigned_partner_id
        and booking_id = new.id
        and review_id is null
        and reason = 'Completed Pickolo job'
    );
  end if;
  return new;
end;
$;

drop trigger if exists bookings_log_completed_job_xp on public.bookings;
create trigger bookings_log_completed_job_xp
after update of status on public.bookings
for each row execute procedure public.log_completed_job_xp();

create or replace function public.award_review_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer := 0;
  v_inserted uuid;
  v_average numeric(3,2);
  v_perf public.partner_performance%rowtype;
  v_partner public.partners%rowtype;
  v_rule public.partner_level_rules%rowtype;
  v_next_name text;
begin
  v_xp := case new.rating
    when 5 then 100
    when 4 then 70
    when 3 then 40
    when 2 then 15
    else 0
  end;

  if length(trim(coalesce(new.comment,''))) >= 20 then v_xp := v_xp + 15; end if;
  if length(trim(coalesce(new.comment,''))) >= 80 then v_xp := v_xp + 10; end if;

  insert into public.partner_xp_events(partner_id, booking_id, review_id, xp_delta, reason)
  values (new.partner_id, new.booking_id, new.id, v_xp, 'Customer review')
  on conflict(review_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then return new; end if;

  select round(avg(r.rating)::numeric, 2)
    into v_average
  from public.reviews r
  where r.partner_id = new.partner_id;

  insert into public.partner_performance(
    partner_id, average_rating, review_count, xp, updated_at
  )
  values (new.partner_id, v_average, 1, v_xp, now())
  on conflict(partner_id) do update set
    average_rating = excluded.average_rating,
    review_count = public.partner_performance.review_count + 1,
    xp = public.partner_performance.xp + excluded.xp,
    updated_at = now();

  select * into v_perf
  from public.partner_performance
  where partner_id = new.partner_id;

  select * into v_partner
  from public.partners
  where id = new.partner_id;

  select * into v_rule
  from public.partner_level_rules
  where level_id = v_partner.service_level_id;

  if found
     and v_rule.next_level_id is not null
     and v_perf.xp >= v_rule.min_xp
     and coalesce(v_perf.average_rating,0) >= v_rule.min_average_rating
     and v_perf.completed_jobs >= v_rule.min_completed_jobs then

    update public.partners
      set service_level_id = v_rule.next_level_id, updated_at = now()
    where id = new.partner_id
      and service_level_id = v_rule.level_id;

    select name into v_next_name
    from public.service_levels
    where id = v_rule.next_level_id;

    insert into public.notifications(user_id, channel, title, body)
    values (
      new.partner_id,
      'in_app',
      'Level up unlocked',
      'Great work! You are now eligible for ' || coalesce(v_next_name,'next-level') || ' Pickolo jobs.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_award_partner_xp on public.reviews;
create trigger reviews_award_partner_xp
after insert on public.reviews
for each row execute procedure public.award_review_xp();

commit;
