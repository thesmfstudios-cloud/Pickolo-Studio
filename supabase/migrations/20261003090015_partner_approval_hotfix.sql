-- Isolated production approval repair. No approvals or RLS policy changes.
-- Called only by authenticated, DB-authorized admin server routes.
create function public.partner_review_application_v1(
  p_actor uuid, p_id uuid, p_action text, p_expected text, p_reason text default ''
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  a public.partner_applications;
  next_state public.partner_verification_status;
  level_id uuid;
  identity_id uuid;
  requested text[];
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'Admin access required.' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('approve','reject','suspend') then
    raise exception 'Invalid review action.' using errcode='22023';
  end if;
  select * into a from public.partner_applications where id=p_id for update;
  if a.id is null then raise exception 'Application not found.' using errcode='P0002'; end if;
  if a.status::text is distinct from p_expected then
    raise exception 'Application changed. Refresh before reviewing.' using errcode='40001';
  end if;
  next_state := case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'suspended' end;
  if a.status=next_state then raise exception 'This review is already recorded. Refresh the page.' using errcode='40001'; end if;
  -- Stable lock order; keep operator authorization and applicant role valid through commit.
  perform 1 from public.profiles where id in (p_actor,a.applicant_id) order by id for update;
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'Admin access required.' using errcode='42501';
  end if;
  if exists(select 1 from public.profiles where id=a.applicant_id and role='admin') then
    raise exception 'An admin account cannot be converted into a partner.' using errcode='42501';
  end if;
  if p_action in ('reject','suspend') and length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
    raise exception 'Provide a clear review reason of 5 to 500 characters.' using errcode='22023';
  end if;
  if p_action='approve' then
    select d.id into identity_id from public.partner_verification_documents d
      join storage.objects o on o.bucket_id='partner-documents' and o.name=d.storage_path
      where coalesce(d.applicant_id,d.partner_id)=a.applicant_id and d.document_type='identity' and d.status='approved'
      order by d.id limit 1 for update of d for key share of o;
    if identity_id is null then
      raise exception 'Review and approve one uploaded identity document before approving the application.' using errcode='22023';
    end if;
    select id into level_id from public.service_levels where name='Basic';
    if level_id is null then raise exception 'Default partner level is unavailable.' using errcode='22023'; end if;
    requested := case when cardinality(a.service_types)>0 then a.service_types else array['Photography'] end;
    if exists(select 1 from unnest(requested) r(name) where not exists(select 1 from public.services s where s.name=r.name and s.active)) then
      raise exception 'Requested service is unavailable. Update the application before approval.' using errcode='22023';
    end if;
    insert into public.partners(id,partner_code,verification_status,service_level_id,bio,base_lat,base_long,payout_upi_id,payout_upi_updated_at)
      values(a.applicant_id,'PKL-'||upper(left(replace(a.applicant_id::text,'-',''),8)),'approved',level_id,a.bio,a.base_lat,a.base_long,a.payout_upi_id,case when a.payout_upi_id is null then null else now() end)
      on conflict(id) do update set verification_status='approved',service_level_id=coalesce(public.partners.service_level_id,excluded.service_level_id),bio=excluded.bio,base_lat=excluded.base_lat,base_long=excluded.base_long,payout_upi_id=excluded.payout_upi_id,payout_upi_updated_at=excluded.payout_upi_updated_at;
    insert into public.partner_services(partner_id,service_id)
      select a.applicant_id,s.id from public.services s where s.name=any(requested) and s.active
      on conflict(partner_id,service_id) do nothing;
    update public.profiles set role='partner',full_name=a.display_name,phone=a.phone where id=a.applicant_id;
  else
    update public.partners set verification_status=next_state,is_accepting_jobs=false where id=a.applicant_id;
  end if;
  update public.partner_applications set status=next_state,reviewed_by=p_actor,reviewed_at=now(),rejection_reason=case when p_action='approve' then null else btrim(p_reason) end where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(p_actor,upper(p_action),'partner_application',p_id,jsonb_build_object('from_status',a.status,'to_status',next_state,'reason',left(p_reason,500)));
  insert into public.notifications(user_id,channel,title,body)
    values(a.applicant_id,'in_app','Partner application '||next_state::text,case when p_action='approve' then 'Your Pickolo Partner application was approved.' else btrim(p_reason) end);
  return jsonb_build_object('id',p_id,'status',next_state,'applicant_id',a.applicant_id);
end; $$;

create function public.partner_review_document_v1(
  p_actor uuid,p_id uuid,p_status text,p_expected text,p_reason text default ''
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.partner_verification_documents; object_id uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'Admin access required.' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('approved','rejected') then raise exception 'Invalid document status.' using errcode='22023'; end if;
  select * into d from public.partner_verification_documents where id=p_id for update;
  if d.id is null then raise exception 'Document not found.' using errcode='P0002'; end if;
  if d.status::text is distinct from p_expected or d.status::text=p_status then
    raise exception 'Document changed. Refresh before reviewing.' using errcode='40001';
  end if;
  if p_status='approved' then
    select id into object_id from storage.objects where bucket_id='partner-documents' and name=d.storage_path for key share;
    if object_id is null then raise exception 'Document file is missing. Ask the partner to upload again.' using errcode='22023'; end if;
  end if;
  if p_status='rejected' and length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
    raise exception 'Provide a clear correction reason of 5 to 500 characters.' using errcode='22023';
  end if;
  update public.partner_verification_documents set status=p_status::public.partner_document_status,rejection_reason=case when p_status='rejected' then btrim(p_reason) else null end,reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(p_actor,'DOCUMENT_'||upper(p_status),'partner_document',p_id,jsonb_build_object('from_status',d.status,'to_status',p_status,'reason',left(p_reason,500)));
  insert into public.notifications(user_id,channel,title,body)
    values(coalesce(d.applicant_id,d.partner_id),'in_app','Verification document updated',case when p_status='rejected' then btrim(p_reason) else 'Your verification document was approved.' end);
  return jsonb_build_object('id',p_id,'status',p_status);
end; $$;

revoke all on function public.partner_review_application_v1(uuid,uuid,text,text,text), public.partner_review_document_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.partner_review_application_v1(uuid,uuid,text,text,text), public.partner_review_document_v1(uuid,uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
