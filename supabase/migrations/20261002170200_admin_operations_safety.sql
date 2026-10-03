-- Local, reviewed rollout only. Deploy after 0030 and before the new admin APIs.
-- No automatic approvals, role promotions or money transfers are performed here.
alter table public.payouts add column if not exists destination_upi_id text;
create unique index if not exists payouts_provider_unique on public.payouts(provider_payout_id) where provider_payout_id is not null;

create or replace function private.require_operator(p_actor uuid) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then
    raise exception 'Authorized operator required.' using errcode='42501';
  end if;
end; $$;
revoke all on function private.require_operator(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.require_operator(uuid) to service_role;

create or replace function public.admin_review_application(p_actor uuid,p_id uuid,p_action text,p_expected text,p_reason text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.partner_applications; next_state public.partner_verification_status; level_id uuid; identity_id uuid;
begin
  perform private.require_operator(p_actor);
  if p_action is null or p_action not in ('approve','reject','suspend') then raise exception 'Invalid review action.' using errcode='22023'; end if;
  select * into a from public.partner_applications where id=p_id for update;
  if a.id is null then raise exception 'Application not found.' using errcode='P0002'; end if;
  if a.status::text is distinct from p_expected then raise exception 'Application changed. Refresh before reviewing.' using errcode='40001'; end if;
  next_state:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'suspended' end;
  if a.status=next_state then raise exception 'This review is already recorded.' using errcode='40001'; end if;
  perform 1 from public.profiles where id=a.applicant_id for update;
  if exists(select 1 from public.profiles where id=a.applicant_id and role='admin') then
    raise exception 'An owner account cannot be converted into a partner.' using errcode='42501';
  end if;
  if p_action in ('reject','suspend') and length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
    raise exception 'Provide a clear reason of 5 to 500 characters.' using errcode='22023';
  end if;
  if p_action='approve' then
    select d.id into identity_id from public.partner_verification_documents d join storage.objects o on o.bucket_id='partner-documents' and o.name=d.storage_path
      where (d.applicant_id=a.applicant_id or d.partner_id=a.applicant_id) and d.document_type='identity' and d.status='approved' limit 1 for update of d for key share of o;
    if identity_id is null then
      raise exception 'Review and approve one uploaded identity document before approving the application.' using errcode='22023';
    end if;
    -- Preserve the deployed approval policy: new creators start at Basic.
    -- Higher eligibility remains an explicit operator decision, not a signup reward.
    select id into level_id from public.service_levels where name='Basic' and active;
    if level_id is null then raise exception 'Default partner level is unavailable.' using errcode='22023'; end if;
    insert into public.partners(id,partner_code,verification_status,service_level_id,bio,base_lat,base_long,payout_upi_id,payout_upi_updated_at)
      values(a.applicant_id,'PKL-'||upper(left(replace(a.applicant_id::text,'-',''),8)),'approved',level_id,a.bio,a.base_lat,a.base_long,a.payout_upi_id,case when a.payout_upi_id is null then null else now() end)
      on conflict(id) do update set verification_status='approved',service_level_id=coalesce(public.partners.service_level_id,excluded.service_level_id),bio=excluded.bio,base_lat=excluded.base_lat,base_long=excluded.base_long,payout_upi_id=excluded.payout_upi_id,payout_upi_updated_at=excluded.payout_upi_updated_at;
    update public.profiles set role='partner',full_name=a.display_name,phone=a.phone where id=a.applicant_id;
  else
    update public.partners set verification_status=next_state,is_accepting_jobs=false where id=a.applicant_id;
  end if;
  update public.partner_applications set status=next_state,reviewed_by=p_actor,reviewed_at=now(),rejection_reason=case when p_action='approve' then null else btrim(p_reason) end where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,upper(p_action),'partner_application',p_id,jsonb_build_object('from_status',a.status,'to_status',next_state,'reason',left(p_reason,500)));
  insert into public.notifications(user_id,channel,title,body) values(a.applicant_id,'in_app','Partner application '||next_state::text,case when p_action='approve' then 'Your Pickolo Partner application was approved.' else left(p_reason,500) end);
  return jsonb_build_object('id',p_id,'status',next_state,'applicant_id',a.applicant_id);
end; $$;

create or replace function public.admin_review_document(p_actor uuid,p_id uuid,p_status text,p_expected text,p_reason text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.partner_verification_documents; object_id uuid;
begin
  perform private.require_operator(p_actor);
  if p_status is null or p_status not in ('approved','rejected') then raise exception 'Invalid document status.' using errcode='22023'; end if;
  select * into d from public.partner_verification_documents where id=p_id for update;
  if d.id is null then raise exception 'Document not found.' using errcode='P0002'; end if;
  if d.status::text is distinct from p_expected or d.status::text=p_status then raise exception 'Document changed. Refresh before reviewing.' using errcode='40001'; end if;
  if p_status='approved' then
    select id into object_id from storage.objects where bucket_id='partner-documents' and name=d.storage_path for key share;
    if object_id is null then raise exception 'Document file is missing. Ask the partner to upload again.' using errcode='22023'; end if;
  end if;
  if p_status='rejected' and length(btrim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Provide a clear correction reason of 5 to 500 characters.' using errcode='22023'; end if;
  update public.partner_verification_documents set status=p_status::public.partner_document_status,rejection_reason=case when p_status='rejected' then btrim(p_reason) else null end,reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'DOCUMENT_'||upper(p_status),'partner_document',p_id,jsonb_build_object('from_status',d.status,'to_status',p_status,'reason',left(p_reason,500)));
  insert into public.notifications(user_id,channel,title,body) values(coalesce(d.applicant_id,d.partner_id),'in_app','Verification document updated',case when p_status='rejected' then btrim(p_reason) else 'Your identity document was approved.' end);
  return jsonb_build_object('id',p_id,'status',p_status);
end; $$;

create or replace function public.admin_reserve_payout(p_actor uuid,p_booking uuid) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings; p public.payouts; upi text;
begin
  perform private.require_operator(p_actor);
  select * into b from public.bookings where id=p_booking for update;
  if b.id is null or b.status not in ('DATA_SUBMITTED','CUSTOMER_CONFIRMED') or b.assigned_partner_id is null then raise exception 'Booking is not payout-ready.' using errcode='40001'; end if;
  if b.partner_payout_paise<=0 then raise exception 'Payout amount must be positive.' using errcode='22023'; end if;
  if exists(select 1 from public.booking_disputes where booking_id=p_booking and status in ('open','under_review')) then raise exception 'Resolve the active dispute before payout.' using errcode='40001'; end if;
  if not exists(select 1 from public.delivery_records where booking_id=p_booking and submitted_at is not null)
    or not exists(select 1 from public.delivery_assets where booking_id=p_booking) then raise exception 'Studio backup is required before payout.' using errcode='22023'; end if;
  if b.status='DATA_SUBMITTED' and not exists(select 1 from public.booking_status_history where booking_id=p_booking and to_status='DATA_SUBMITTED' and metadata->>'customer_handoff'='on_site') then raise exception 'Customer handoff must be recorded before payout.' using errcode='22023'; end if;
  select * into p from public.payouts where booking_id=p_booking;
  if p.id is not null then
    if p.provider_payout_id is null then raise exception 'An earlier payout request has no confirmed provider reference. Owner reconciliation is required; do not retry the transfer.' using errcode='40001'; end if;
    if p.destination_upi_id is null or p.status in ('released','processed','failed','rejected','reversed','cancelled') then raise exception 'Existing payout needs reconciliation. Do not create another transfer.' using errcode='40001'; end if;
    if p.partner_id is distinct from b.assigned_partner_id or p.amount_paise is distinct from b.partner_payout_paise then raise exception 'Payout details changed. Reconcile with the owner.' using errcode='40001'; end if;
  else
    select payout_upi_id into upi from public.partners where id=b.assigned_partner_id;
    if upi is null then raise exception 'Partner must save a payout UPI ID first.' using errcode='22023'; end if;
    insert into public.payouts(booking_id,partner_id,amount_paise,status,destination_upi_id) values(p_booking,b.assigned_partner_id,b.partner_payout_paise,'requesting',upi) returning * into p;
    insert into public.admin_audit_log(actor_id,action,entity_type,entity_id) values(p_actor,'REQUEST_PAYOUT','booking',p_booking);
  end if;
  return to_jsonb(p)||jsonb_build_object('booking_code',b.booking_code);
end; $$;

create or replace function public.admin_record_payout(p_actor uuid,p_booking uuid,p_provider text,p_status text,p_amount bigint) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings; p public.payouts;
begin
  perform private.require_operator(p_actor);
  select * into b from public.bookings where id=p_booking for update;
  select * into p from public.payouts where booking_id=p_booking for update;
  if p.id is null or p.destination_upi_id is null or p_amount is distinct from p.amount_paise or p.partner_id is distinct from b.assigned_partner_id or p_provider !~ '^pout_[a-zA-Z0-9]+$' then raise exception 'Provider payout details do not match the saved request.' using errcode='22023'; end if;
  if p.provider_payout_id is not null and p.provider_payout_id<>p_provider then raise exception 'Provider reference changed. Reconciliation required.' using errcode='40001'; end if;
  if p_status not in ('pending','queued','processing','processed','failed','rejected','reversed','cancelled') then raise exception 'Unrecognized provider payout status.' using errcode='22023'; end if;
  if b.status in ('PAYOUT_RELEASED','COMPLETED') and p.status='processed' and p_status='processed' then return jsonb_build_object('paid',true,'status',p.status); end if;
  if b.status not in ('DATA_SUBMITTED','CUSTOMER_CONFIRMED') then raise exception 'Booking changed after payout request. Owner reconciliation required.' using errcode='40001'; end if;
  update public.payouts set provider_payout_id=p_provider,status=p_status,released_at=case when p_status='processed' then now() else null end where id=p.id;
  if p_status='processed' then
    update public.bookings set status='PAYOUT_RELEASED' where id=p_booking;
    insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,metadata) values(p_booking,b.status,'PAYOUT_RELEASED',p_actor,jsonb_build_object('actor_role','admin','provider','razorpayx','provider_payout_id',p_provider,'provider_status','processed'));
    insert into public.notifications(user_id,booking_id,channel,title,body) values(p.partner_id,p_booking,'in_app','Payout processed','The payout provider confirmed your Pickolo payout was processed.');
  end if;
  if p.status is distinct from p_status or p.provider_payout_id is distinct from p_provider then
    insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'PAYOUT_'||upper(p_status),'booking',p_booking,jsonb_build_object('provider_payout_id',p_provider,'amount_paise',p_amount));
  end if;
  return jsonb_build_object('paid',p_status='processed','status',p_status,'provider_payout_id',p_provider);
end; $$;

create or replace function public.admin_operations_metrics() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('bookings',jsonb_build_object('total',count(*),'paid',count(*) filter(where status not in ('REQUESTED','CANCELLED','REFUNDED')),'active',count(*) filter(where status not in ('REQUESTED','CANCELLED','REFUNDED','COMPLETED','DISPUTED')),'completed',count(*) filter(where status='COMPLETED'),'cancelled',count(*) filter(where status in ('CANCELLED','REFUNDED')),'completionRate',case when count(*)=0 then 0 else (count(*) filter(where status='COMPLETED'))::numeric/count(*) end),
 'money',jsonb_build_object('gmvPaise',coalesce(sum(customer_price_paise) filter(where status not in ('REQUESTED','CANCELLED','REFUNDED')),0),'platformRevenuePaise',coalesce(sum(platform_fee_paise) filter(where status='COMPLETED'),0),'partnerPayoutsPaise',coalesce(sum(partner_payout_paise) filter(where status not in ('REQUESTED','CANCELLED','REFUNDED')),0),'payoutsReleasedPaise',(select coalesce(sum(amount_paise) filter(where status='processed' and provider_payout_id is not null),0) from public.payouts)),
 'queues',jsonb_build_object('applications',(select count(*) from public.partner_applications where status='pending'),'documents',(select count(*) from public.partner_verification_documents where status='pending'),'support',(select count(*) from public.booking_disputes where status in ('open','under_review')),'searching',count(*) filter(where status in ('PAYMENT_CONFIRMED','SEARCHING_PARTNER')),'payoutReady',count(*) filter(where status in ('DATA_SUBMITTED','CUSTOMER_CONFIRMED'))),'generatedAt',now()) from public.bookings;
$$;
create or replace function public.admin_operations_readiness() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('deliveryReady',to_regprocedure('public.finalize_partner_delivery(uuid,uuid,boolean,jsonb)') is not null,'approvalDocumentGate',true,'providerConfirmedPayouts',true,'adminReady',not exists(select 1 from unnest(array['public.admin_review_application(uuid,uuid,text,text,text)','public.admin_review_document(uuid,uuid,text,text,text)','public.admin_reserve_payout(uuid,uuid)','public.admin_record_payout(uuid,uuid,text,text,bigint)','public.admin_operations_metrics()','public.admin_update_price(uuid,uuid,bigint,integer,timestamptz)','public.admin_review_dispute(uuid,uuid,text,text,text)','public.admin_complete_booking(uuid,uuid)','public.admin_assign_partner(uuid,uuid,uuid,boolean,text)','public.admin_record_no_show(uuid,uuid,text,text)','public.admin_update_partner_eligibility(uuid,uuid,uuid,uuid[],uuid,uuid[])']) required(signature) where to_regprocedure(signature) is null));
$$;
revoke all on function public.admin_review_application(uuid,uuid,text,text,text),public.admin_review_document(uuid,uuid,text,text,text),public.admin_reserve_payout(uuid,uuid),public.admin_record_payout(uuid,uuid,text,text,bigint),public.admin_operations_metrics(),public.admin_operations_readiness() from public,anon,authenticated;
grant execute on function public.admin_review_application(uuid,uuid,text,text,text),public.admin_review_document(uuid,uuid,text,text,text),public.admin_reserve_payout(uuid,uuid),public.admin_record_payout(uuid,uuid,text,text,bigint),public.admin_operations_metrics(),public.admin_operations_readiness() to service_role;
notify pgrst,'reload schema';

create or replace function public.admin_update_price(p_actor uuid,p_id uuid,p_amount bigint,p_fee integer,p_expected timestamptz)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare price public.service_level_prices;
begin
  perform private.require_operator(p_actor);
  if p_amount<100 or p_amount>100000000 or p_fee not between 0 and 10000 then raise exception 'Invalid price or fee.' using errcode='22023'; end if;
  select * into price from public.service_level_prices where id=p_id for update;
  if price.id is null or price.updated_at is distinct from p_expected then raise exception 'Pricing changed. Refresh before saving.' using errcode='40001'; end if;
  update public.service_level_prices set amount_paise=p_amount,platform_fee_bps=p_fee,updated_at=clock_timestamp() where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'UPDATE_PRICING','service_level_price',p_id,jsonb_build_object('old_amount_paise',price.amount_paise,'amount_paise',p_amount,'old_fee_bps',price.platform_fee_bps,'fee_bps',p_fee));
  return jsonb_build_object('id',p_id,'amount_paise',p_amount,'platform_fee_bps',p_fee);
end; $$;

create or replace function public.admin_review_dispute(p_actor uuid,p_id uuid,p_status text,p_expected text,p_resolution text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.booking_disputes;
begin
  perform private.require_operator(p_actor);
  if p_status not in ('under_review','resolved','rejected') then raise exception 'Invalid support status.' using errcode='22023'; end if;
  select * into d from public.booking_disputes where id=p_id for update;
  if d.id is null or d.status::text is distinct from p_expected or d.status not in ('open','under_review') or d.status::text=p_status then raise exception 'Support case changed. Refresh before saving.' using errcode='40001'; end if;
  if p_status in ('resolved','rejected') and length(btrim(coalesce(p_resolution,''))) not between 5 and 2000 then raise exception 'Provide a useful resolution of 5 to 2000 characters.' using errcode='22023'; end if;
  update public.booking_disputes set status=p_status::public.dispute_status,resolution=nullif(btrim(p_resolution),''),resolved_by=case when p_status='under_review' then null else p_actor end,resolved_at=case when p_status='under_review' then null else now() end where id=p_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'DISPUTE_'||upper(p_status),'booking_dispute',p_id,jsonb_build_object('from_status',d.status,'resolution',p_resolution));
  insert into public.notifications(user_id,booking_id,channel,title,body) values(d.opened_by,d.booking_id,'in_app','Support case updated',case when p_status='under_review' then 'Your case is under review.' else p_resolution end);
  return jsonb_build_object('id',p_id,'status',p_status);
end; $$;

create or replace function public.admin_complete_booking(p_actor uuid,p_booking uuid) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings;
begin
  perform private.require_operator(p_actor);
  select * into b from public.bookings where id=p_booking for update;
  if b.id is null or b.status<>'PAYOUT_RELEASED' then raise exception 'Booking must have a confirmed payout before completion.' using errcode='40001'; end if;
  if not exists(select 1 from public.payouts where booking_id=p_booking and status='processed' and provider_payout_id is not null and amount_paise=b.partner_payout_paise and partner_id=b.assigned_partner_id) then raise exception 'Reconcile the real payout before completing this booking.' using errcode='22023'; end if;
  if exists(select 1 from public.booking_disputes where booking_id=p_booking and status in ('open','under_review')) then raise exception 'Resolve the dispute before completing.' using errcode='40001'; end if;
  update public.bookings set status='COMPLETED' where id=p_booking;
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,metadata) values(p_booking,b.status,'COMPLETED',p_actor,jsonb_build_object('actor_role','admin'));
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id) values(p_actor,'COMPLETE_BOOKING','booking',p_booking);
  return jsonb_build_object('id',p_booking,'status','COMPLETED');
end; $$;
revoke all on function public.admin_update_price(uuid,uuid,bigint,integer,timestamptz),public.admin_review_dispute(uuid,uuid,text,text,text),public.admin_complete_booking(uuid,uuid) from public,anon,authenticated;

-- Keep assignment history, notification and audit in the same transaction.
-- Serialize manual assignments on the partner row; preserve the repo's 15 KM
-- pilot radius and overlapping-availability policy.
create or replace function public.admin_assign_partner(p_actor uuid,p_booking uuid,p_partner uuid,p_emergency boolean default false,p_reason text default 'Manual admin assignment')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings; p public.partners; requested_rank integer; partner_rank integer; km double precision;
begin
  perform private.require_operator(p_actor);
  select * into b from public.bookings where id=p_booking for update;
  if b.id is null or b.status not in ('PAYMENT_CONFIRMED','SEARCHING_PARTNER') or (p_emergency and b.status<>'SEARCHING_PARTNER') then raise exception 'Booking changed or is not ready for assignment.' using errcode='40001'; end if;
  select * into p from public.partners where id=p_partner for update;
  if p.id is null or p.verification_status<>'approved' then raise exception 'Partner must be approved.' using errcode='22023'; end if;
  select sort_order into requested_rank from public.service_levels where id=b.service_level_id;
  select sort_order into partner_rank from public.service_levels where id=p.service_level_id;
  if requested_rank is null or partner_rank is null or partner_rank<requested_rank then raise exception 'Partner service level is not eligible.' using errcode='22023'; end if;
  -- Photography remains the legacy default; videography needs explicit capability.
  if exists(select 1 from public.services where id=b.service_id and name<>'Photography')
     and not exists(select 1 from public.partner_services where partner_id=p_partner and service_id=b.service_id) then
    raise exception 'Partner is not approved for this service.' using errcode='22023';
  end if;
  if exists(select 1 from public.bookings where assigned_partner_id=p_partner and id<>p_booking and status not in ('CANCELLED','REFUNDED','COMPLETED','DISPUTED')
    and scheduled_start<b.scheduled_start+make_interval(mins=>b.duration_minutes) and scheduled_start+make_interval(mins=>duration_minutes)>b.scheduled_start) then
    raise exception 'Partner already has an overlapping booking.' using errcode='40001';
  end if;
  if not exists(select 1 from public.partner_availability where partner_id=p_partner and available and starts_at<b.scheduled_start+make_interval(mins=>b.duration_minutes) and ends_at>b.scheduled_start) then
    raise exception 'Partner has no matching availability window.' using errcode='22023';
  end if;
  if b.location_lat is null or b.location_long is null or p.base_lat is null or p.base_long is null then raise exception 'Customer and partner locations are required.' using errcode='22023'; end if;
  km:=2*6371*asin(sqrt(least(1.0,power(sin(radians(p.base_lat-b.location_lat)/2),2)+cos(radians(b.location_lat))*cos(radians(p.base_lat))*power(sin(radians(p.base_long-b.location_long)/2),2))));
  if km>15 then raise exception 'Partner is outside the Pickolo 15 KM pilot radius.' using errcode='22023'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Provide a reason of 5 to 500 characters.' using errcode='22023'; end if;
  update public.bookings set assigned_partner_id=p_partner,status='PARTNER_ASSIGNED',partner_acceptance_status='pending',partner_acceptance_at=null,partner_declined_at=null,partner_offer_expires_at=now()+interval '5 minutes' where id=p_booking;
  insert into public.partner_assignment_events(booking_id,partner_id,event_type,reason) values(p_booking,p_partner,'ASSIGNED',p_reason);
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,metadata) values(p_booking,b.status,'PARTNER_ASSIGNED',p_actor,jsonb_build_object('actor_role','admin','assigned_partner_id',p_partner,'distance_km',km,'reason',p_reason));
  if p_emergency then insert into public.booking_reassignments(booking_id,from_partner_id,to_partner_id,reason,created_by) values(p_booking,b.assigned_partner_id,p_partner,p_reason,p_actor); end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,case when p_emergency then 'REASSIGN_PARTNER' else 'ASSIGN_PARTNER' end,'booking',p_booking,jsonb_build_object('partner_id',p_partner,'reason',p_reason));
  insert into public.notifications(user_id,booking_id,channel,title,body) values(p_partner,p_booking,'in_app','New Pickolo job request','Booking '||b.booking_code||' is waiting for your accept or pass.');
  return jsonb_build_object('id',p_booking,'booking_code',b.booking_code,'status','PARTNER_ASSIGNED','assigned_partner_id',p_partner);
end; $$;

create or replace function public.admin_record_no_show(p_actor uuid,p_booking uuid,p_expected text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings;
begin
  perform private.require_operator(p_actor);
  select * into b from public.bookings where id=p_booking for update;
  if b.id is null or b.status not in ('PARTNER_ASSIGNED','ON_THE_WAY') or b.assigned_partner_id is null or b.status::text is distinct from p_expected then raise exception 'Assignment changed. Refresh before recording no-show.' using errcode='40001'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Provide a useful attendance reason of 5 to 500 characters.' using errcode='22023'; end if;
  update public.bookings set assigned_partner_id=null,status='SEARCHING_PARTNER',cancellation_reason=p_reason,partner_acceptance_status='not_required',partner_acceptance_at=null,partner_declined_at=null,partner_offer_expires_at=null where id=p_booking;
  insert into public.partner_assignment_events(booking_id,partner_id,event_type,reason) values(p_booking,b.assigned_partner_id,'NO_SHOW',p_reason);
  insert into public.booking_incidents(booking_id,partner_id,incident_type,reason,recorded_by) values(p_booking,b.assigned_partner_id,'PARTNER_NO_SHOW',p_reason,p_actor);
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,metadata) values(p_booking,b.status,'SEARCHING_PARTNER',p_actor,jsonb_build_object('actor_role','admin','old_partner_id',b.assigned_partner_id,'reason',p_reason));
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'NO_SHOW_RECOVERY','booking',p_booking,jsonb_build_object('old_partner_id',b.assigned_partner_id,'reason',p_reason));
  return jsonb_build_object('id',p_booking,'booking_code',b.booking_code,'status','SEARCHING_PARTNER','assigned_partner_id',null);
end; $$;
revoke all on function public.admin_assign_partner(uuid,uuid,uuid,boolean,text),public.admin_record_no_show(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_assign_partner(uuid,uuid,uuid,boolean,text),public.admin_record_no_show(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
grant execute on function public.admin_update_price(uuid,uuid,bigint,integer,timestamptz),public.admin_review_dispute(uuid,uuid,text,text,text),public.admin_complete_booking(uuid,uuid) to service_role;

create or replace function public.admin_update_partner_eligibility(p_actor uuid,p_partner uuid,p_level uuid,p_services uuid[],p_expected_level uuid,p_expected_services uuid[])
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare partner public.partners; existing uuid[]; proposed uuid[]; photo uuid;
begin
  perform private.require_operator(p_actor);
  select * into partner from public.partners where id=p_partner for update;
  if partner.id is null or partner.verification_status<>'approved' then raise exception 'Only approved partners can receive job eligibility.' using errcode='40001'; end if;
  select coalesce(array_agg(service_id order by service_id),'{}'::uuid[]) into existing from public.partner_services where partner_id=p_partner;
  select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into proposed from unnest(p_services) x;
  if partner.service_level_id is distinct from p_expected_level or existing is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(p_expected_services) x) then raise exception 'Partner eligibility changed. Reopen the review before saving.' using errcode='40001'; end if;
  if not exists(select 1 from public.service_levels where id=p_level) then raise exception 'Choose a valid service level.' using errcode='22023'; end if;
  select id into photo from public.services where name='Photography';
  if photo is null or not(photo=any(proposed)) or cardinality(proposed)>10 or exists(select 1 from unnest(proposed) x where not exists(select 1 from public.services s where s.id=x)) then raise exception 'Select valid services including the legacy Photography default.' using errcode='22023'; end if;
  update public.partners set service_level_id=p_level where id=p_partner;
  delete from public.partner_services where partner_id=p_partner;
  insert into public.partner_services(partner_id,service_id) select p_partner,x from unnest(proposed) x;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'UPDATE_JOB_ELIGIBILITY','partner',p_partner,jsonb_build_object('old_level',partner.service_level_id,'new_level',p_level,'old_services',existing,'new_services',proposed));
  return jsonb_build_object('id',p_partner,'service_level_id',p_level,'service_ids',proposed);
end; $$;
revoke all on function public.admin_update_partner_eligibility(uuid,uuid,uuid,uuid[],uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.admin_update_partner_eligibility(uuid,uuid,uuid,uuid[],uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
