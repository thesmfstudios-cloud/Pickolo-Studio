-- Pickolo Studio
-- Migration 0024: atomic customer booking creation RPC
-- Date: 2026-09-20

create or replace function public.create_customer_booking(
  p_service_id uuid,
  p_service_level_id uuid,
  p_scheduled_start timestamptz,
  p_duration_minutes integer,
  p_location_text text,
  p_location_lat numeric,
  p_location_long numeric,
  p_notes text default null
)
returns table (
  id uuid,
  booking_code text,
  status public.booking_status,
  scheduled_start timestamptz,
  duration_minutes integer,
  location_text text,
  customer_price_paise bigint,
  platform_fee_paise bigint,
  partner_payout_paise bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount_paise bigint;
  v_fee_bps integer;
  v_platform_fee bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_service_id is null
     or p_service_level_id is null
     or p_scheduled_start is null
     or p_duration_minutes not in (30, 60, 120)
     or nullif(trim(p_location_text), '') is null then
    raise exception 'Invalid booking request.';
  end if;

  if trim(p_location_text) not between repeat(' ', 3) and repeat(' ', 300) then
    if length(trim(p_location_text)) < 3 or length(trim(p_location_text)) > 300 then
      raise exception 'location_text must be between 3 and 300 characters.';
    end if;
  end if;

  if p_location_lat is null or p_location_lat < -90 or p_location_lat > 90 then
    raise exception 'location_lat must be a valid latitude.';
  end if;

  if p_location_long is null or p_location_long < -180 or p_location_long > 180 then
    raise exception 'location_long must be a valid longitude.';
  end if;

  if p_scheduled_start <= now() then
    raise exception 'scheduled_start must be a valid future timestamp.';
  end if;

  if not exists (
    select 1 from public.services s
    where s.id = p_service_id and s.active = true
  ) then
    raise exception 'Selected service is not active.';
  end if;

  if not exists (
    select 1 from public.service_levels l
    where l.id = p_service_level_id and l.active = true
  ) then
    raise exception 'Selected service level is not active.';
  end if;

  select p.amount_paise, p.platform_fee_bps
    into v_amount_paise, v_fee_bps
  from public.service_level_prices p
  where p.service_level_id = p_service_level_id
    and p.duration_minutes = p_duration_minutes
    and p.active = true
  limit 1;

  if v_amount_paise is null then
    raise exception 'Pricing is not configured for this booking option.';
  end if;

  v_platform_fee := round(v_amount_paise * (v_fee_bps / 10000.0))::bigint;

  return query
  insert into public.bookings (
    customer_id,
    service_id,
    service_level_id,
    scheduled_start,
    duration_minutes,
    location_text,
    location_lat,
    location_long,
    notes,
    customer_price_paise,
    platform_fee_paise,
    partner_payout_paise
  )
  values (
    v_user_id,
    p_service_id,
    p_service_level_id,
    p_scheduled_start,
    p_duration_minutes,
    trim(p_location_text),
    p_location_lat,
    p_location_long,
    nullif(trim(p_notes), ''),
    v_amount_paise,
    v_platform_fee,
    v_amount_paise - v_platform_fee
  )
  returning
    bookings.id,
    bookings.booking_code,
    bookings.status,
    bookings.scheduled_start,
    bookings.duration_minutes,
    bookings.location_text,
    bookings.customer_price_paise,
    bookings.platform_fee_paise,
    bookings.partner_payout_paise;
end;
$$;

revoke all on function public.create_customer_booking(
  uuid, uuid, timestamptz, integer, text, numeric, numeric, text
) from public, anon;

grant execute on function public.create_customer_booking(
  uuid, uuid, timestamptz, integer, text, numeric, numeric, text
) to authenticated;
