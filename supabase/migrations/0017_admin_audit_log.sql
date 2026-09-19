-- Pickolo Studio
-- Migration 0017: admin audit trail
-- Date: 2026-09-19

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index admin_audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_admin_read"
on public.admin_audit_log for select
to authenticated
using (public.is_admin());

create policy "admin_audit_admin_insert"
on public.admin_audit_log for insert
to authenticated
with check (public.is_admin() and actor_id = auth.uid());