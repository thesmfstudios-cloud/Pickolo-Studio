-- Apply the same launch rules to direct database inserts as the booking RPC.
begin;
create function public.enforce_customer_booking_rules() returns trigger language plpgsql security definer set search_path=public as $$
declare a public.service_area_settings%rowtype; amount bigint; fee integer; multiplier numeric;
begin
 if new.status <> 'REQUESTED' or new.assigned_partner_id is not null then raise exception 'New bookings must await payment.'; end if;
 if new.raw_policy_version is distinct from 'raw-v1' or new.raw_policy_accepted_at is null then raise exception 'Please acknowledge the raw-data policy.'; end if;
 if new.scheduled_start <= now() then raise exception 'Choose a future start time.'; end if;
 if new.location_lat is null or new.location_long is null then raise exception 'A shoot location pin is required.'; end if;
 select * into a from public.service_area_settings where id=1;
 if not found or not a.enabled then raise exception 'Service area is not configured yet.'; end if;
 if 6371*2*asin(sqrt(least(1.0,power(sin(radians((new.location_lat-a.latitude)::double precision)/2),2)+cos(radians(a.latitude::double precision))*cos(radians(new.location_lat::double precision))*power(sin(radians((new.location_long-a.longitude)::double precision)/2),2))))>a.radius_km then raise exception 'Shoot location is outside the 15 km service area.'; end if;
 select s.price_multiplier into multiplier from public.services s where s.id=new.service_id and s.active;
 select p.amount_paise,p.platform_fee_bps into amount,fee from public.service_level_prices p join public.service_levels l on l.id=p.service_level_id where p.service_level_id=new.service_level_id and p.duration_minutes=new.duration_minutes and p.active and l.active;
 if amount is null or multiplier is null then raise exception 'Pricing is not configured for this option.'; end if;
 new.customer_price_paise:=round(amount*multiplier);
 new.platform_fee_paise:=round(new.customer_price_paise*(fee/10000.0));
 new.partner_payout_paise:=new.customer_price_paise-new.platform_fee_paise;
 new.raw_policy_accepted_at:=now();
 return new;
end;$$;
create trigger enforce_customer_booking_rules before insert on public.bookings for each row execute function public.enforce_customer_booking_rules();
revoke all on function public.enforce_customer_booking_rules() from public,anon,authenticated;
revoke all on function public.generate_booking_start_code() from public,anon,authenticated;
revoke all on function public.require_verified_shoot_start() from public,anon,authenticated;
commit;
