-- Pickolo Studio
-- Migration 0014: booking lifecycle timestamps and on-time metrics
-- Date: 2026-09-19

alter table public.bookings
  add column if not exists partner_arrived_at timestamptz,
  add column if not exists shoot_started_at timestamptz,
  add column if not exists shoot_completed_at timestamptz,
  add column if not exists data_submitted_at timestamptz,
  add column if not exists payout_released_at timestamptz,
  add column if not exists completed_at timestamptz;

create or replace function public.set_booking_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'ON_THE_WAY' and new.partner_arrived_at is null then
      new.partner_arrived_at = now();
    end if;
    if new.status = 'SHOOT_STARTED' and new.shoot_started_at is null then
      new.shoot_started_at = now();
    end if;
    if new.status = 'SHOOT_COMPLETED' and new.shoot_completed_at is null then
      new.shoot_completed_at = now();
    end if;
    if new.status = 'DATA_SUBMITTED' and new.data_submitted_at is null then
      new.data_submitted_at = now();
    end if;
    if new.status = 'PAYOUT_RELEASED' and new.payout_released_at is null then
      new.payout_released_at = now();
    end if;
    if new.status = 'COMPLETED' and new.completed_at is null then
      new.completed_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_lifecycle_timestamps on public.bookings;
create trigger booking_lifecycle_timestamps
before update of status on public.bookings
for each row execute procedure public.set_booking_lifecycle_timestamps();

create or replace function public.update_partner_performance_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'COMPLETED'
     and old.status is distinct from new.status
     and new.assigned_partner_id is not null then
    insert into public.partner_performance (
      partner_id,
      completed_jobs,
      on_time_jobs,
      delivered_jobs,
      xp,
      updated_at
    )
    values (
      new.assigned_partner_id,
      1,
      case
        when new.partner_arrived_at is not null
         and new.partner_arrived_at <= new.scheduled_start + interval '10 minutes'
        then 1 else 0
      end,
      1,
      100,
      now()
    )
    on conflict (partner_id)
    do update set
      completed_jobs = public.partner_performance.completed_jobs + 1,
      on_time_jobs = public.partner_performance.on_time_jobs + excluded.on_time_jobs,
      delivered_jobs = public.partner_performance.delivered_jobs + 1,
      xp = public.partner_performance.xp + 100,
      updated_at = now();
  end if;
  return new;
end;
$$;