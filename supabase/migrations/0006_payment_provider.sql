-- Pickolo Studio
-- Migration 0006: payment provider integration
-- Date: 2026-09-19

alter table public.payments
  add column if not exists provider_order_id text,
  add column if not exists provider_signature text,
  add column if not exists captured_at timestamptz,
  add column if not exists failed_at timestamptz;

create unique index if not exists payments_provider_order_id_uidx
on public.payments(provider_order_id)
where provider_order_id is not null;

create unique index if not exists payments_provider_payment_id_uidx
on public.payments(provider_payment_id)
where provider_payment_id is not null;

create index if not exists payments_status_idx
on public.payments(status, created_at desc);

create policy "payments_admin_all"
on public.payments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
