-- Pickolo Studio
-- Migration 0015: partner verification documents + disputes
-- Date: 2026-09-19

create type public.partner_document_status as enum ('pending','approved','rejected');
create type public.dispute_status as enum ('open','under_review','resolved','rejected');

create table public.partner_verification_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  document_type text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  status public.partner_document_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint partner_document_size_valid check (size_bytes is null or (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024))
);

create index partner_documents_partner_idx
on public.partner_verification_documents(partner_id, status, created_at desc);

create table public.booking_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  reason_code text not null,
  description text not null,
  status public.dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_disputes_status_idx
on public.booking_disputes(status, created_at desc);

alter table public.partner_verification_documents enable row level security;
alter table public.booking_disputes enable row level security;

create policy "partner_documents_owner_read"
on public.partner_verification_documents for select
to authenticated
using (partner_id = auth.uid());

create policy "partner_documents_admin_all"
on public.partner_verification_documents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "booking_disputes_owner_read"
on public.booking_disputes for select
to authenticated
using (
  opened_by = auth.uid()
  or exists (
    select 1 from public.bookings b
    where b.id = booking_disputes.booking_id
      and b.assigned_partner_id = auth.uid()
  )
);

create policy "booking_disputes_customer_insert"
on public.booking_disputes for insert
to authenticated
with check (
  opened_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_disputes.booking_id
      and b.customer_id = auth.uid()
  )
);

create policy "booking_disputes_admin_all"
on public.booking_disputes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists booking_disputes_touch on public.booking_disputes;
create trigger booking_disputes_touch
before update on public.booking_disputes
for each row execute procedure public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('partner-documents','partner-documents',false)
on conflict (id) do update set public = excluded.public;

create policy "partner_documents_storage_owner_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'partner-documents'
  and owner_id = auth.uid()::text
);

create policy "partner_documents_storage_owner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'partner-documents'
  and owner_id = auth.uid()::text
);

create policy "partner_documents_storage_admin_all"
on storage.objects for all
to authenticated
using (bucket_id = 'partner-documents' and public.is_admin())
with check (bucket_id = 'partner-documents' and public.is_admin());