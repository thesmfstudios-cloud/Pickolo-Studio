-- Pickolo Studio
-- Migration 0005: notification events + partner performance automation
-- Date: 2026-09-19

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz;

create index if not exists notifications_unsent_idx
on public.notifications(created_at)
where sent_at is null;

create or replace function public.create_booking_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (
      user_id,
      booking_id,
      channel,
      title,
      body,
      metadata
    )
    values (
      new.customer_id,
      new.id,
      'in_app',
      'Booking updated',
      'Your booking ' || new.booking_code || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      jsonb_build_object('status', new.status::text)
    );

    if new.assigned_partner_id is not null then
      insert into public.notifications (
        user_id,
        booking_id,
        channel,
        title,
        body,
        metadata
      )
      values (
        new.assigned_partner_id,
        new.id,
        'in_app',
        'Job updated',
        'Job ' || new.booking_code || ' is now ' || replace(new.status::text, '_', ' ') || '.',
        jsonb_build_object('status', new.status::text)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists booking_status_notification_trigger on public.bookings;
create trigger booking_status_notification_trigger
after update of status on public.bookings
for each row
execute procedure public.create_booking_status_notifications();

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
      delivered_jobs,
      xp,
      updated_at
    )
    values (
      new.assigned_partner_id,
      1,
      1,
      100,
      now()
    )
    on conflict (partner_id)
    do update set
      completed_jobs = public.partner_performance.completed_jobs + 1,
      delivered_jobs = public.partner_performance.delivered_jobs + 1,
      xp = public.partner_performance.xp + 100,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists booking_performance_trigger on public.bookings;
create trigger booking_performance_trigger
after update of status on public.bookings
for each row
execute procedure public.update_partner_performance_on_booking();

create or replace function public.update_partner_performance_on_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is null then
    return new;
  end if;

  insert into public.partner_performance (
    partner_id,
    cancellations,
    no_shows,
    updated_at
  )
  values (
    new.partner_id,
    case when new.incident_type in ('PARTNER_CANCELLATION','PARTNER_DECLINE') then 1 else 0 end,
    case when new.incident_type = 'PARTNER_NO_SHOW' then 1 else 0 end,
    now()
  )
  on conflict (partner_id)
  do update set
    cancellations = public.partner_performance.cancellations
      + case when new.incident_type in ('PARTNER_CANCELLATION','PARTNER_DECLINE') then 1 else 0 end,
    no_shows = public.partner_performance.no_shows
      + case when new.incident_type = 'PARTNER_NO_SHOW' then 1 else 0 end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists incident_performance_trigger on public.booking_incidents;
create trigger incident_performance_trigger
after insert on public.booking_incidents
for each row
execute procedure public.update_partner_performance_on_incident();
