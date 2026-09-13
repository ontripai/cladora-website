begin;

-- CLADORA-P2-EXPORT-002: private export-artifact quarantine and fail-closed scanner gate.
-- Scanner integration remains provider-neutral. Only service_role may record a signed verdict.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('export-artifact-vault','export-artifact-vault',false,5242880,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'
])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table finance.export_artifacts
  add column object_path text,
  add column scan_status text not null default 'not_materialized'
    check(scan_status in ('not_materialized','scanning_pending','clean','quarantined','scan_failed')),
  add column scan_completed_at timestamptz;
create unique index export_artifacts_object_path_uidx on finance.export_artifacts(object_path) where object_path is not null;

create table finance.export_artifact_scan_attestations(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  artifact_id uuid not null references finance.export_artifacts(id) on delete restrict,
  provider text not null check(length(trim(provider)) between 2 and 80),
  provider_scan_id text not null check(length(trim(provider_scan_id)) between 4 and 200),
  verdict text not null check(verdict in ('clean','malicious','error')),
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  key_id text not null check(length(trim(key_id)) between 2 and 200),
  signature text not null check(length(trim(signature)) between 16 and 4096),
  scanned_at timestamptz not null,
  recorded_at timestamptz not null default statement_timestamp(),
  unique(provider,provider_scan_id),
  unique(artifact_id)
);
alter table finance.export_artifact_scan_attestations enable row level security;
revoke all on finance.export_artifact_scan_attestations from public,anon,authenticated;
grant all on finance.export_artifact_scan_attestations to service_role;

create or replace function finance.protect_export_scan_attestation_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$begin raise exception 'export_scan_attestation_is_immutable' using errcode='55000'; end$$;
revoke all on function finance.protect_export_scan_attestation_v1() from public,anon,authenticated;
create trigger export_scan_attestations_immutable before update or delete on finance.export_artifact_scan_attestations
for each row execute function finance.protect_export_scan_attestation_v1();

create or replace function app_private.prepare_export_artifact_internal_v2(
  p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text,p_content_sha256 text,p_byte_size bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance,audit
as $$
declare a record;art finance.export_artifacts;v_path text;v_replay boolean;
begin
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.generate');
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_export_artifact_hash' using errcode='22023'; end if;
  if p_byte_size<1 or p_byte_size>5242880 then raise exception 'export_artifact_size_out_of_bounds' using errcode='22023'; end if;
  select ea.* into art from finance.export_artifacts ea join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
  where ea.export_pack_id=p_export_pack_id and ea.tenant_id=a.tenant_id and ea.report_code=p_report_code and ea.format=p_format
    and (a.property_id is null or ep.property_id=a.property_id) for update of ea;
  if not found then raise exception 'export_artifact_not_found' using errcode='22023'; end if;
  if art.content_sha256 is not null and (art.content_sha256,art.byte_size) is distinct from (p_content_sha256,p_byte_size) then
    raise exception 'export_artifact_materialization_mismatch' using errcode='23505';
  end if;
  if art.scan_status in ('clean','quarantined','scan_failed') then
    return jsonb_build_object('artifact_id',art.id,'bucket_id','export-artifact-vault','object_path',art.object_path,
      'scan_status',art.scan_status,'sha256',art.content_sha256,'byte_size',art.byte_size,'idempotent_replay',true);
  end if;
  v_replay:=art.content_sha256 is not null;
  v_path:=a.tenant_id::text||'/'||art.id::text||'/'||p_content_sha256||'.'||p_format;
  update finance.export_artifacts set content_sha256=p_content_sha256,byte_size=p_byte_size,
    materialized_at=coalesce(materialized_at,statement_timestamp()),object_path=v_path,scan_status='scanning_pending',scan_completed_at=null
  where id=art.id returning * into art;
  if not exists(select 1 from audit.events where tenant_id=a.tenant_id and entity_type='finance.export_artifact'
    and entity_id=art.id and action='EXPORT_ARTIFACT_QUARANTINED') then
    insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
    values(a.tenant_id,auth.uid(),a.role_code,'EXPORT_ARTIFACT_QUARANTINED','finance.export_artifact',art.id,
      jsonb_build_object('export_pack_id',p_export_pack_id,'report_code',p_report_code,'format',p_format,'sha256',p_content_sha256,
        'byte_size',p_byte_size,'bucket_id','export-artifact-vault','object_path',v_path,'scan_status','scanning_pending'),statement_timestamp());
  end if;
  return jsonb_build_object('artifact_id',art.id,'bucket_id','export-artifact-vault','object_path',v_path,
    'scan_status','scanning_pending','sha256',p_content_sha256,'byte_size',p_byte_size,'idempotent_replay',v_replay);
end $$;
revoke all on function app_private.prepare_export_artifact_internal_v2(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;

create or replace function app_private.record_export_artifact_scan_v1(
  p_artifact_id uuid,p_provider text,p_provider_scan_id text,p_verdict text,p_content_sha256 text,
  p_key_id text,p_signature text,p_scanned_at timestamptz
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance,storage,audit
as $$
declare art finance.export_artifacts;att finance.export_artifact_scan_attestations;
begin
  if p_verdict not in ('clean','malicious','error') then raise exception 'invalid_export_scan_verdict' using errcode='22023'; end if;
  if length(trim(coalesce(p_provider,'')))<2 or length(trim(coalesce(p_provider_scan_id,'')))<4
    or length(trim(coalesce(p_key_id,'')))<2 or length(trim(coalesce(p_signature,'')))<16 then
    raise exception 'invalid_export_scan_attestation' using errcode='22023';
  end if;
  select * into art from finance.export_artifacts where id=p_artifact_id for update;
  if not found then raise exception 'export_artifact_not_found' using errcode='22023'; end if;
  if art.scan_status<>'scanning_pending' then
    select * into att from finance.export_artifact_scan_attestations where artifact_id=art.id;
    if found and (att.provider,att.provider_scan_id,att.verdict,att.content_sha256,att.key_id,att.signature,att.scanned_at)
      is not distinct from (p_provider,p_provider_scan_id,p_verdict,p_content_sha256,p_key_id,p_signature,p_scanned_at) then
      return jsonb_build_object('artifact_id',art.id,'scan_status',art.scan_status,'idempotent_replay',true);
    end if;
    raise exception 'export_scan_already_finalized' using errcode='23505';
  end if;
  if p_content_sha256 is distinct from art.content_sha256 then raise exception 'export_scan_content_mismatch' using errcode='23505'; end if;
  if p_scanned_at is null or p_scanned_at>statement_timestamp()+interval '5 minutes' then raise exception 'invalid_export_scan_timestamp' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='export-artifact-vault' and name=art.object_path) then
    raise exception 'export_artifact_object_missing' using errcode='55000';
  end if;
  insert into finance.export_artifact_scan_attestations(tenant_id,artifact_id,provider,provider_scan_id,verdict,content_sha256,key_id,signature,scanned_at)
  values(art.tenant_id,art.id,trim(p_provider),trim(p_provider_scan_id),p_verdict,p_content_sha256,trim(p_key_id),p_signature,p_scanned_at)
  returning * into att;
  update finance.export_artifacts set scan_status=case p_verdict when 'clean' then 'clean' when 'malicious' then 'quarantined' else 'scan_failed' end,
    scan_completed_at=statement_timestamp() where id=art.id returning * into art;
  insert into audit.events(tenant_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(art.tenant_id,'service_role','EXPORT_ARTIFACT_SCAN_ATTESTED','finance.export_artifact',art.id,
    jsonb_build_object('attestation_id',att.id,'provider',att.provider,'provider_scan_id',att.provider_scan_id,
      'verdict',att.verdict,'sha256',att.content_sha256,'key_id',att.key_id,'scanned_at',att.scanned_at),statement_timestamp());
  return jsonb_build_object('artifact_id',art.id,'scan_status',art.scan_status,'attestation_id',att.id,'idempotent_replay',false);
end $$;
revoke all on function app_private.record_export_artifact_scan_v1(uuid,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function app_private.record_export_artifact_scan_v1(uuid,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function app_private.authorize_export_artifact_download_internal_v1(
  p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance,audit
as $$
declare a record;art finance.export_artifacts;
begin
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.read');
  select ea.* into art from finance.export_artifacts ea join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
  where ea.export_pack_id=p_export_pack_id and ea.tenant_id=a.tenant_id and ea.report_code=p_report_code and ea.format=p_format
    and (a.property_id is null or ep.property_id=a.property_id);
  if not found then raise exception 'export_artifact_not_found' using errcode='22023'; end if;
  if art.scan_status='scanning_pending' then raise exception 'export_artifact_scan_pending' using errcode='42501'; end if;
  if art.scan_status='quarantined' then raise exception 'export_artifact_quarantined' using errcode='42501'; end if;
  if art.scan_status='scan_failed' then raise exception 'export_artifact_scan_failed' using errcode='42501'; end if;
  if art.scan_status<>'clean' then raise exception 'export_artifact_not_materialized' using errcode='42501'; end if;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(a.tenant_id,auth.uid(),a.role_code,'EXPORT_ARTIFACT_DOWNLOAD_AUTHORIZED','finance.export_artifact',art.id,
    jsonb_build_object('export_pack_id',p_export_pack_id,'sha256',art.content_sha256,'object_path',art.object_path),statement_timestamp());
  return jsonb_build_object('artifact_id',art.id,'bucket_id','export-artifact-vault','object_path',art.object_path,
    'filename',art.canonical_filename,'media_type',art.media_type,'sha256',art.content_sha256,'byte_size',art.byte_size,'expires_in_seconds',60);
end $$;
revoke all on function app_private.authorize_export_artifact_download_internal_v1(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function customer_api.prepare_export_artifact_v2(p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text,p_content_sha256 text,p_byte_size bigint)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.prepare_export_artifact_internal_v2(p_context_id,p_export_pack_id,p_report_code,p_format,p_content_sha256,p_byte_size)$$;
create or replace function customer_api.authorize_export_artifact_download_v1(p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.authorize_export_artifact_download_internal_v1(p_context_id,p_export_pack_id,p_report_code,p_format)$$;
revoke all on function customer_api.prepare_export_artifact_v2(uuid,uuid,text,text,text,bigint),customer_api.authorize_export_artifact_download_v1(uuid,uuid,text,text) from public,anon;
grant execute on function customer_api.prepare_export_artifact_v2(uuid,uuid,text,text,text,bigint),customer_api.authorize_export_artifact_download_v1(uuid,uuid,text,text) to authenticated,service_role;

create or replace function app_private.export_artifact_storage_allowed_v1(p_object_path text,p_operation text)
returns boolean language sql stable security definer set search_path=pg_catalog,finance
as $$select exists(
  select 1 from finance.export_artifacts ea join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
  where ea.object_path=p_object_path and ep.generated_by=auth.uid()
    and ((p_operation='insert' and ea.scan_status='scanning_pending') or (p_operation='select' and ea.scan_status='clean'))
)$$;
revoke all on function app_private.export_artifact_storage_allowed_v1(text,text) from public,anon;
grant execute on function app_private.export_artifact_storage_allowed_v1(text,text) to authenticated,service_role;

drop policy if exists export_artifact_vault_insert on storage.objects;
create policy export_artifact_vault_insert on storage.objects for insert to authenticated with check(
  bucket_id='export-artifact-vault' and auth.uid() is not null
  and app_private.export_artifact_storage_allowed_v1(storage.objects.name,'insert')
);
drop policy if exists export_artifact_vault_clean_select on storage.objects;
create policy export_artifact_vault_clean_select on storage.objects for select to authenticated using(
  bucket_id='export-artifact-vault' and auth.uid() is not null
  and app_private.export_artifact_storage_allowed_v1(storage.objects.name,'select')
);
-- No UPDATE or DELETE policy: artifact objects cannot be replaced or removed by customer sessions.

commit;
