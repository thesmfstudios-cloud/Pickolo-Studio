-- Atomic private delivery submission. Deploy before the updated finalization API.
-- This migration does not change assignment, payouts or XP promotion policies.
create or replace function public.finalize_partner_delivery(
  p_booking_id uuid, p_partner_id uuid, p_customer_handoff_confirmed boolean, p_assets jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_booking public.bookings;
  v_delivery public.delivery_records;
  v_asset jsonb;
  v_path text;
  v_paths text[] := '{}';
  v_saved jsonb;
begin
  if p_customer_handoff_confirmed is distinct from true then
    raise exception 'Confirm customer handoff before submitting the backup.' using errcode = '22023';
  end if;
  if p_assets is null or jsonb_typeof(p_assets) <> 'array' then
    raise exception 'Provide an array of delivery assets.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_assets) not between 1 and 100 then
    raise exception 'Provide between 1 and 100 uploaded assets.' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.assigned_partner_id is distinct from p_partner_id
     or not exists (select 1 from public.partners where id = p_partner_id and verification_status = 'approved') then
    raise exception 'Approved assigned partner access required.' using errcode = '42501';
  end if;
  if v_booking.status <> 'DATA_PENDING' then
    raise exception 'Booking changed. Refresh before submitting delivery.' using errcode = '40001';
  end if;
  for v_asset in select value from jsonb_array_elements(p_assets) loop
    v_path := v_asset->>'storage_path';
    if v_path is null or v_path !~ ('^' || p_booking_id::text || '/[a-zA-Z0-9._-]{1,200}$')
       or split_part(v_path, '/', 2) in ('.', '..') or v_path = any(v_paths) then
      raise exception 'Invalid or duplicate delivery asset path.' using errcode = '22023';
    end if;
    v_paths := array_append(v_paths, v_path);
    if coalesce(length(btrim(v_asset->>'file_name')), 0) not between 1 and 120
       or coalesce(v_asset->>'mime_type', '') !~ '^(image|video)/[a-zA-Z0-9.+-]+$' then
      raise exception 'Invalid delivery file metadata.' using errcode = '22023';
    end if;
    if v_asset->>'size_bytes' is not null and (
      (v_asset->>'size_bytes') !~ '^[0-9]+$' or (v_asset->>'size_bytes')::numeric not between 1 and 524288000
    ) then
      raise exception 'Each file must be between 1 byte and 500 MB.' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'booking-deliveries' and name = v_path) then
      raise exception 'One or more delivery files are not present in private storage.' using errcode = '40001';
    end if;
    insert into public.delivery_assets(booking_id, storage_path, file_name, mime_type, size_bytes, created_by)
    values (p_booking_id, v_path, btrim(v_asset->>'file_name'), v_asset->>'mime_type', (v_asset->>'size_bytes')::bigint, p_partner_id)
    on conflict (booking_id, storage_path) do update set
      file_name = excluded.file_name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, created_by = excluded.created_by;
  end loop;
  insert into public.delivery_records(booking_id, storage_path, submitted_by, submitted_at)
  values (p_booking_id, v_paths[1], p_partner_id, now())
  on conflict (booking_id) do update set storage_path = excluded.storage_path, submitted_by = excluded.submitted_by, submitted_at = excluded.submitted_at
  returning * into v_delivery;
  perform set_config('pickolo.delivery_booking', p_booking_id::text, true);
  update public.bookings set status = 'DATA_SUBMITTED' where id = p_booking_id;
  perform set_config('pickolo.delivery_booking', '', true);
  insert into public.booking_status_history(booking_id, from_status, to_status, changed_by, metadata)
  values (p_booking_id, 'DATA_PENDING', 'DATA_SUBMITTED', p_partner_id,
    jsonb_build_object('actor_role', 'partner', 'asset_count', jsonb_array_length(p_assets), 'customer_handoff', 'on_site'));
  select jsonb_agg(to_jsonb(a) order by a.created_at, a.id) into v_saved
  from public.delivery_assets a where booking_id = p_booking_id and storage_path = any(v_paths);
  return jsonb_build_object('delivery', to_jsonb(v_delivery), 'assets', v_saved);
end;
$$;
revoke all on function public.finalize_partner_delivery(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_partner_delivery(uuid, uuid, boolean, jsonb) to service_role;

create or replace function public.guard_delivery_submission() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'DATA_SUBMITTED' and old.status is distinct from new.status
     and (old.status <> 'DATA_PENDING' or current_setting('pickolo.delivery_booking', true) is distinct from new.id::text) then
    raise exception 'Use the verified delivery finalization flow.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_delivery_submission() from public, anon, authenticated;
create trigger booking_delivery_submission_guard before update of status on public.bookings
for each row execute function public.guard_delivery_submission();
