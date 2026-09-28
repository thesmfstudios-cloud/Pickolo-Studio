-- Minimal partner capability and private shoot-start verification support.
begin;
create table public.partner_services(partner_id uuid references public.partners(id) on delete cascade,service_id uuid references public.services(id) on delete cascade,primary key(partner_id,service_id));
alter table public.partner_services enable row level security;
create policy partner_services_admin on public.partner_services for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.booking_start_codes(booking_id uuid primary key references public.bookings(id) on delete cascade,code text not null,verified_at timestamptz,failed_attempts integer not null default 0,last_attempt_at timestamptz);
alter table public.booking_start_codes enable row level security;
revoke all on public.booking_start_codes from anon, authenticated;
create function public.generate_booking_start_code() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.booking_start_codes(booking_id,code) values(new.id,lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,6))::bit(24)::int % 900000)+100000)::text,6,'0'));
 return new;
end;$$;
create trigger booking_start_code after insert on public.bookings for each row execute function public.generate_booking_start_code();
create function public.require_verified_shoot_start() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='SHOOT_STARTED' and old.status is distinct from new.status and exists(select 1 from public.booking_start_codes where booking_id=new.id and verified_at is null) then raise exception 'Verify the customer booking OTP before starting.'; end if;
 return new;
end;$$;
create trigger verify_shoot_start before update of status on public.bookings for each row execute function public.require_verified_shoot_start();
create function public.verify_and_start_shoot(p_booking_id uuid,p_partner_id uuid,p_code text) returns boolean language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype; c public.booking_start_codes%rowtype;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or b.assigned_partner_id is distinct from p_partner_id or b.status<>'ON_THE_WAY' or b.partner_acceptance_status<>'accepted' then raise exception 'Booking is not ready to start.'; end if;
 select * into c from public.booking_start_codes where booking_id=p_booking_id for update;
 if found then
  if c.failed_attempts>=5 and c.last_attempt_at>now()-interval '15 minutes' then raise exception 'Too many attempts. Try again in 15 minutes.'; end if;
  if c.code is distinct from p_code then
   update public.booking_start_codes set failed_attempts=case when last_attempt_at<now()-interval '15 minutes' then 1 else failed_attempts+1 end,last_attempt_at=now() where booking_id=p_booking_id;
   return false;
  end if;
  update public.booking_start_codes set verified_at=now() where booking_id=p_booking_id;
 end if;
 update public.bookings set status='SHOOT_STARTED' where id=p_booking_id;
 return true;
end;$$;
revoke all on function public.verify_and_start_shoot(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.verify_and_start_shoot(uuid,uuid,text) to service_role;
commit;
