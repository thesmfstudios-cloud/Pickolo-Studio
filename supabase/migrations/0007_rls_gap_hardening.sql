-- Pickolo Studio
-- Migration 0007: missing owner policies for operational reads/updates
-- Date: 2026-09-19

create policy "partner_performance_owner_read"
on public.partner_performance for select
to authenticated
using (partner_id = auth.uid());

create policy "notifications_owner_update"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "booking_history_actor_read"
on public.booking_status_history for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_status_history.booking_id
      and (b.customer_id = auth.uid() or b.assigned_partner_id = auth.uid())
  )
);
