-- Pickolo Studio
-- Migration 0020: harden security-definer function exposure and function search_path
-- Date: 2026-09-19

-- Trigger-only functions do not need to be callable through the public RPC surface.
revoke execute on function public.create_booking_status_notifications() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_unauthorized_role_change() from public, anon, authenticated;
revoke execute on function public.update_partner_performance_on_booking() from public, anon, authenticated;
revoke execute on function public.update_partner_performance_on_incident() from public, anon, authenticated;

-- is_admin() is referenced by RLS/admin authorization paths, so keep it callable
-- by signed-in users while removing anonymous RPC execution.
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Pin search_path for trigger functions so name resolution cannot be changed
-- by caller/session configuration.
alter function public.touch_updated_at()
  set search_path = public;

alter function public.set_booking_lifecycle_timestamps()
  set search_path = public;
