begin;

-- ClamAV runs outside Supabase on a trusted worker. A result is append-only;
-- the immutable version may change only its scanner verdict after this record.
create table documents.document_scan_attestations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  version_id uuid not null unique references documents.document_versions(id) on delete restrict,
  provider text not null check (provider = 'clamav'),
  scan_id uuid not null unique,
  verdict text not null check (verdict in ('clean', 'quarantined')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  engine_version text not null check (length(trim(engine_version)) between 3 and 160),
  scanned_at timestamptz not null,
  recorded_at timestamptz not null default statement_timestamp()
);
alter table documents.document_scan_attestations enable row level security;
create index document_scan_attestations_tenant_id_idx on documents.document_scan_attestations(tenant_id);
revoke all on documents.document_scan_attestations from public, anon, authenticated;
grant select, insert on documents.document_scan_attestations to service_role;
-- The immutable-version trigger runs under the dedicated RPC owner on
-- retention-enabled installations; it must be able to inspect the attestation.
grant select on documents.document_scan_attestations to cladora_rpc_owner;
create policy document_scan_attestations_rpc_owner_read on documents.document_scan_attestations
for select to cladora_rpc_owner using (true);

create function documents.protect_scan_attestation() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'document_scan_attestation_is_immutable' using errcode='55000';
end $$;
create trigger document_scan_attestation_immutable
before update or delete on documents.document_scan_attestations
for each row execute function documents.protect_scan_attestation();
revoke all on function documents.protect_scan_attestation() from public, anon, authenticated;

-- Preserve the retention purge exception and all other immutable-version rules.
create or replace function documents.protect_document_version()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_job uuid; v_tenant uuid; v_document uuid;
begin
  if tg_op='INSERT' then
    if exists (
      select 1 from app_private.document_tombstones t
      where t.tenant_id=new.tenant_id and t.document_id=new.document_id
    ) or exists (
      select 1 from app_private.disposal_purge_jobs j
      where j.tenant_id=new.tenant_id and j.document_id=new.document_id
        and j.status not in ('purge_pending')
    ) then
      raise exception using errcode='55000',message='document_purged_or_in_flight';
    end if;
    return new;
  end if;
  if tg_op='UPDATE' and old.scanning_status in ('deferred','scanning_pending')
    and new.scanning_status in ('clean','quarantined')
    and to_jsonb(new)-'scanning_status'=to_jsonb(old)-'scanning_status'
    and current_setting('app.document_scan_attestation_id',true) is not null
    and exists (select 1 from documents.document_scan_attestations a
      where a.id::text=current_setting('app.document_scan_attestation_id',true)
        and a.version_id=old.id and a.tenant_id=old.tenant_id
        and a.verdict=new.scanning_status and a.content_sha256=old.sha256)
  then return new; end if;
  if tg_op='DELETE' and current_user='cladora_rpc_owner'
    and current_setting('app.allow_document_version_purge',true)='on' then
    begin
      v_job:=current_setting('app.purge_job_id',true)::uuid;
      v_tenant:=current_setting('app.purge_tenant_id',true)::uuid;
      v_document:=current_setting('app.purge_document_id',true)::uuid;
    exception when others then
      raise exception using errcode='55000',message='document_versions_are_immutable';
    end;
    if old.tenant_id=v_tenant and old.document_id=v_document and exists(
      select 1 from app_private.disposal_purge_jobs j join app_private.storage_deletion_evidence e on e.tenant_id=j.tenant_id and e.job_id=j.id
      where j.id=v_job and j.tenant_id=v_tenant and j.document_id=v_document and j.document_version_id=old.id
        and j.status in ('absence_verified','tombstoned')
    ) then return old; end if;
  end if;
  raise exception using errcode='55000',message='document_versions_are_immutable';
end $$;

-- The two exposed RPCs accept only the service role. The worker checks bytes,
-- size, SHA-256, and the ClamAV exit status before recording any verdict.
create function public.get_document_scan_target_v1(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v documents.document_versions; d documents.documents;
begin
  select * into v from documents.document_versions where id=p_version_id;
  if not found or v.scanning_status not in ('deferred','scanning_pending') then
    raise exception 'document_scan_target_unavailable' using errcode='22000';
  end if;
  select * into d from documents.documents where id=v.document_id and tenant_id=v.tenant_id;
  if d.id is null or d.deleted_at is not null or d.status<>'active'
    or not exists(select 1 from storage.objects o where o.bucket_id='document-vault' and o.name=v.object_path)
  then raise exception 'document_scan_target_unavailable' using errcode='22000'; end if;
  if v.sha256 !~ '^[0-9a-f]{64}$' or v.size_bytes is null or v.size_bytes > 20971520 then
    raise exception 'document_scan_metadata_invalid' using errcode='22000';
  end if;
  return jsonb_build_object('version_id',v.id,'bucket_id','document-vault',
    'object_path',v.object_path,'sha256',v.sha256,'size_bytes',v.size_bytes);
end $$;

create function public.record_document_scan_v1(
  p_version_id uuid,p_scan_id uuid,p_verdict text,p_content_sha256 text,
  p_engine_version text,p_scanned_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v documents.document_versions; d documents.documents; a documents.document_scan_attestations;
begin
  if p_scan_id is null or p_verdict not in ('clean','quarantined')
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or length(trim(coalesce(p_engine_version,''))) not between 3 and 160
    or p_scanned_at is null or p_scanned_at>statement_timestamp()
    or p_scanned_at<statement_timestamp()-interval '15 minutes'
  then raise exception 'document_scan_attestation_invalid' using errcode='22023'; end if;
  select * into v from documents.document_versions where id=p_version_id for update;
  if not found or v.sha256<>p_content_sha256 then
    raise exception 'document_scan_content_mismatch' using errcode='22023'; end if;
  select * into a from documents.document_scan_attestations where version_id=v.id;
  if found then
    if a.scan_id=p_scan_id and a.verdict=p_verdict
      and a.content_sha256=p_content_sha256 and a.engine_version=p_engine_version
      and a.scanned_at=p_scanned_at and v.scanning_status=p_verdict
    then return jsonb_build_object('version_id',v.id,'verdict',a.verdict,'replayed',true); end if;
    raise exception 'document_scan_result_conflict' using errcode='23505';
  end if;
  select * into d from documents.documents where id=v.document_id and tenant_id=v.tenant_id;
  if v.scanning_status not in ('deferred','scanning_pending') or d.id is null
    or d.deleted_at is not null or d.status<>'active'
    or not exists(select 1 from storage.objects o where o.bucket_id='document-vault' and o.name=v.object_path)
  then raise exception 'document_scan_target_unavailable' using errcode='22000'; end if;
  insert into documents.document_scan_attestations
    (tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
  values(v.tenant_id,v.id,'clamav',p_scan_id,p_verdict,p_content_sha256,trim(p_engine_version),p_scanned_at)
  returning * into a;
  perform set_config('app.document_scan_attestation_id',a.id::text,true);
  update documents.document_versions set scanning_status=p_verdict where id=v.id;
  perform set_config('app.document_scan_attestation_id','',true);
  return jsonb_build_object('version_id',v.id,'verdict',p_verdict,'replayed',false);
end $$;

revoke all on function public.get_document_scan_target_v1(uuid) from public, anon, authenticated;
revoke all on function public.record_document_scan_v1(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.get_document_scan_target_v1(uuid) to service_role;
grant execute on function public.record_document_scan_v1(uuid,uuid,text,text,text,timestamptz) to service_role;

commit;
