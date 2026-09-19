-- Pickolo Studio
-- Migration 0002: admin authorization + assignment controls
-- Date: 2026-09-19

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "bookings_admin_all"
on public.bookings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "partners_admin_read"
on public.partners for select
to authenticated
using (public.is_admin());

create policy "partners_admin_update"
on public.partners for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "partner_performance_admin_read"
on public.partner_performance for select
to authenticated
using (public.is_admin());

create policy "booking_history_admin_read"
on public.booking_status_history for select
to authenticated
using (public.is_admin());

create policy "notifications_admin_write"
on public.notifications for insert
to authenticated
with check (public.is_admin());

create policy "notifications_admin_read"
on public.notifications for select
to authenticated
using (public.is_admin());

create index if not exists bookings_assignment_idx
on public.bookings(status, service_level_id, scheduled_start, assigned_partner_id);
