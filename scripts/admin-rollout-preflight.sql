-- READ-ONLY inspection, not a migration. Run with the owner's database access.
-- Requires the historical 0001–0029 schema; missing base tables must stop rollout.
-- No IDs, names, contact details, UPI values, object paths or tokens are returned.
-- A clean report is NOT permission to migrate/deploy or enable live payouts.
begin transaction read only;
set local statement_timeout = '10s';

with required_rpc(signature) as (values
  ('public.admin_review_application(uuid,uuid,text,text,text)'),
  ('public.admin_review_document(uuid,uuid,text,text,text)'),
  ('public.admin_reserve_payout(uuid,uuid)'),
  ('public.admin_record_payout(uuid,uuid,text,text,bigint)'),
  ('public.admin_operations_metrics()'),
  ('public.admin_operations_readiness()'),
  ('public.admin_update_price(uuid,uuid,bigint,integer,timestamptz)'),
  ('public.admin_review_dispute(uuid,uuid,text,text,text)'),
  ('public.admin_complete_booking(uuid,uuid)'),
  ('public.admin_assign_partner(uuid,uuid,uuid,boolean,text)'),
  ('public.admin_record_no_show(uuid,uuid,text,text)'),
  ('public.admin_update_partner_eligibility(uuid,uuid,uuid,uuid[],uuid,uuid[])'),
  ('public.finalize_partner_delivery(uuid,uuid,boolean,jsonb)')
), required_table(name) as (values
  ('profiles'), ('partners'), ('partner_applications'),
  ('partner_verification_documents'), ('bookings'), ('payments'), ('payouts'),
  ('delivery_records'), ('delivery_assets'), ('admin_audit_log'), ('booking_disputes')
), checks(check_name, severity, failures) as (
  select 'basic_level_unavailable', 'blocker',
    (not exists(select 1 from public.service_levels where name='Basic' and active))::integer::bigint
  union all
  select 'private_buckets_unavailable', 'blocker', count(*)
    from (values ('partner-documents'), ('partner-portfolio'), ('booking-deliveries')) b(id)
    where not exists(select 1 from storage.buckets s where s.id=b.id and s.public=false)
  union all
  select 'rls_not_enabled', 'blocker', count(*) from required_table t
    left join pg_class c on c.oid=to_regclass('public.'||t.name)
    where c.oid is null or not c.relrowsecurity
  union all
  select 'required_rpc_missing', 'blocker', count(*) from required_rpc
    where to_regprocedure(signature) is null
  union all
  select 'unsafe_rpc_permissions', 'blocker', count(*) from required_rpc
    where to_regprocedure(signature) is not null and (
      has_function_privilege('anon',to_regprocedure(signature),'execute') or
      has_function_privilege('authenticated',to_regprocedure(signature),'execute') or
      not has_function_privilege('service_role',to_regprocedure(signature),'execute'))
  union all
  select 'duplicate_provider_payout_refs', 'blocker', count(*) from (
    select provider_payout_id from public.payouts where provider_payout_id is not null
    group by provider_payout_id having count(*)>1
  ) duplicates
  union all
  select 'unapproved_partner_still_online', 'blocker', count(*) from public.partners
    where verification_status<>'approved' and is_accepting_jobs
  union all
  select 'approved_partner_missing_level', 'review', count(*) from public.partners
    where verification_status='approved' and service_level_id is null
  union all
  select 'approved_identity_missing_file', 'review', count(*)
    from public.partner_verification_documents d
    where d.status='approved' and d.document_type='identity' and not exists(
      select 1 from storage.objects o where o.bucket_id='partner-documents' and o.name=d.storage_path)
  union all
  select 'approved_partner_missing_identity', 'review', count(*) from public.partners p
    where p.verification_status='approved' and not exists(
      select 1 from public.partner_verification_documents d join storage.objects o
        on o.bucket_id='partner-documents' and o.name=d.storage_path
      where (d.applicant_id=p.id or d.partner_id=p.id) and d.document_type='identity' and d.status='approved')
  union all
  select 'approved_partner_application_mismatch', 'review', count(*) from public.partners p
    where p.verification_status='approved' and not exists(
      select 1 from public.partner_applications a where a.applicant_id=p.id and a.status='approved')
  union all
  select 'legacy_released_payout_needs_reconciliation', 'review', count(*) from public.payouts
    where status='released' or (status='processed' and provider_payout_id is null)
)
select check_name, severity, failures,
  case when failures=0 then 'pass' else severity end as result
from checks order by severity, check_name;

rollback;
