-- Pickolo Studio
-- Migration 0012: booking history service-write policy baseline
-- Date: 2026-09-19
--
-- History inserts are performed only by controlled server routes.
-- Do not grant general client insert access.

create policy "booking_history_admin_insert"
on public.booking_status_history for insert
to authenticated
with check (public.is_admin());
