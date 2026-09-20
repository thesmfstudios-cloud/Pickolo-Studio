-- Pickolo Studio
-- Migration 0025: partner online/accepting-jobs state
-- Date: 2026-09-20

alter table public.partners
  add column if not exists is_accepting_jobs boolean not null default false;

create index if not exists partners_matching_idx
  on public.partners(verification_status, is_accepting_jobs, service_level_id);

comment on column public.partners.is_accepting_jobs is
  'Partner-controlled online state. When true, verified partners may receive matching job offers.';
