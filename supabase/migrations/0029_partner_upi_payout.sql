-- Pickolo Studio
-- Migration 0029: partner UPI payout details
-- Partner UPI IDs are collected during onboarding and carried into the approved profile.

alter table public.partner_applications
  add column if not exists payout_upi_id text,
  add column if not exists payout_upi_updated_at timestamptz;

alter table public.partners
  add column if not exists payout_upi_id text,
  add column if not exists payout_upi_updated_at timestamptz;

alter table public.partner_applications
  drop constraint if exists partner_application_payout_upi_valid;

alter table public.partner_applications
  add constraint partner_application_payout_upi_valid
  check (payout_upi_id is null or payout_upi_id ~* '^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$');

alter table public.partners
  drop constraint if exists partner_payout_upi_valid;

alter table public.partners
  add constraint partner_payout_upi_valid
  check (payout_upi_id is null or payout_upi_id ~* '^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$');
