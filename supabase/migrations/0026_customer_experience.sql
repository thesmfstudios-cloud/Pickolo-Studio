-- Customer booking: configure the verified studio pin before enabling service.
begin;
alter table public.bookings drop constraint booking_duration_valid;
alter table public.bookings add constraint booking_duration_valid check(duration_minutes in (30,60,120,180,240,300));
alter table public.service_level_prices drop constraint service_level_price_duration_valid;
alter table public.service_level_prices add constraint service_level_price_duration_valid check(duration_minutes in (30,60,120,180,240,300));
alter table public.services add column price_multiplier numeric not null default 1 check(price_multiplier > 0);
insert into public.services(name,description,price_multiplier) values ('Videography','Original video footage',1.5),('Both','Photography and videography coverage',2.5) on conflict(name) do nothing;
insert into public.service_level_prices(service_level_id,duration_minutes,amount_paise,platform_fee_bps)
select l.id,v.minutes,v.amount,2000 from public.service_levels l join (values ('Basic',60,60000),
('Basic',120,100000),
('Basic',180,140000),
('Basic',240,180000),
('Basic',300,220000),
('Standard',60,100000),
('Standard',120,150000),
('Standard',180,200000),
('Standard',240,250000),
('Standard',300,300000),
('Professional',60,150000),
('Professional',120,250000),
('Professional',180,350000),
('Professional',240,450000),
('Professional',300,550000)) v(name,minutes,amount) on l.name=v.name
on conflict(service_level_id,duration_minutes) do update set amount_paise=excluded.amount_paise;
create table public.service_area_settings(id integer primary key check(id=1),latitude numeric not null check(latitude between -90 and 90),longitude numeric not null check(longitude between -180 and 180),radius_km numeric not null default 15 check(radius_km>0),enabled boolean not null default false);
-- Verified Pickolo Studio launch pin in Rohit Nagar, Bhopal.
insert into public.service_area_settings values(1,23.184690686312052,77.43527393974985,15,true);
alter table public.service_area_settings enable row level security;
create policy area_read on public.service_area_settings for select to anon,authenticated using(true);
create policy area_admin on public.service_area_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.bookings add column raw_policy_version text, add column raw_policy_accepted_at timestamptz;
drop function public.create_customer_booking(uuid,uuid,timestamptz,integer,text,numeric,numeric,text);
create or replace function public.create_customer_booking(
  p_service_id uuid,
  p_service_level_id uuid,
  p_scheduled_start timestamptz,
  p_duration_minutes integer,
  p_location_text text,
  p_location_lat numeric,
  p_location_long numeric,
  p_notes text default null,
  p_raw_data_acknowledged boolean default false
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
  v_multiplier numeric;
  v_area public.service_area_settings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_service_id is null
     or p_service_level_id is null
     or p_scheduled_start is null
     or p_duration_minutes not in (30, 60, 120, 180, 240, 300)
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

  if p_raw_data_acknowledged is not true then raise exception 'Please acknowledge the raw-data policy.'; end if;
  select * into v_area from public.service_area_settings a where a.id = 1;
  if not found or not v_area.enabled then raise exception 'Service area is not configured yet.'; end if;
  if 6371 * 2 * asin(sqrt(least(1.0, power(sin(radians((p_location_lat - v_area.latitude)::double precision)/2),2) + cos(radians(v_area.latitude::double precision))*cos(radians(p_location_lat::double precision))*power(sin(radians((p_location_long-v_area.longitude)::double precision)/2),2)))) > v_area.radius_km then
    raise exception 'Pickolo is currently available within 15 km of Rohit Nagar, Bhopal. Choose a location inside our service area.';
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

  select price_multiplier into v_multiplier from public.services where services.id = p_service_id;
  v_amount_paise := round(v_amount_paise * v_multiplier);
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
    raw_policy_version,
    raw_policy_accepted_at,
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
    'raw-v1',
    now(),
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
  uuid, uuid, timestamptz, integer, text, numeric, numeric, text, boolean
) from public, anon;

grant execute on function public.create_customer_booking(
  uuid, uuid, timestamptz, integer, text, numeric, numeric, text, boolean
) to authenticated;

commit;
