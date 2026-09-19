-- Pickolo Studio
-- Migration 0016: allow pending applicants to submit verification documents
-- Date: 2026-09-19

alter table public.partner_verification_documents
  add column if not exists applicant_id uuid references public.profiles(id) on delete cascade;

alter table public.partner_verification_documents
  alter column partner_id drop not null;

update public.partner_verification_documents
set applicant_id = partner_id
where applicant_id is null;

create index if not exists partner_documents_applicant_idx
on public.partner_verification_documents(applicant_id, status, created_at desc);

drop policy if exists "partner_documents_owner_read" on public.partner_verification_documents;
create policy "partner_documents_owner_read"
on public.partner_verification_documents for select
to authenticated
using (applicant_id = auth.uid() or partner_id = auth.uid());

drop policy if exists "partner_documents_owner_insert" on public.partner_verification_documents;
create policy "partner_documents_owner_insert"
on public.partner_verification_documents for insert
to authenticated
with check (applicant_id = auth.uid() or partner_id = auth.uid());