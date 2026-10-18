begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D4: retain the legacy download signatures only as deterministic cutover
-- failures. The V2 selector is application-owned and remains inactive until
-- its fixed Core role-bound pool and signed-URL adapter are authorized.
create or replace function documents.authorize_download_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_version_id uuid default null,
  p_admin_inspection boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_download_required';
end;
$$;

create or replace function customer_api.authorize_document_download_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_version_id uuid default null,
  p_admin_inspection boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_download_required';
end;
$$;

alter function documents.authorize_download_internal(uuid,uuid,uuid,boolean)
  owner to postgres;
alter function customer_api.authorize_document_download_v1(uuid,uuid,uuid,boolean)
  owner to postgres;

revoke all on function documents.authorize_download_internal(uuid,uuid,uuid,boolean)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;
revoke all on function customer_api.authorize_document_download_v1(uuid,uuid,uuid,boolean)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

comment on function documents.authorize_download_internal(uuid,uuid,uuid,boolean) is
  'D4 legacy tombstone. Always raises canonical_document_download_required.';
comment on function customer_api.authorize_document_download_v1(uuid,uuid,uuid,boolean) is
  'D4 legacy tombstone. Always raises canonical_document_download_required.';

-- AIRPROP consumes verified evidence without issuing a download or signed URL.
-- Preserve that cross-domain validator by binding its existing explicit
-- Workspace input directly to the canonical document Workspace. It must never
-- reopen either legacy download signature above.
create or replace function app_private.require_airprop_diligence_evidence_v1(
  p_document_context_id uuid,
  p_workspace_id uuid,
  p_version_id uuid,
  p_require_current boolean default true
)
returns documents.document_versions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v documents.document_versions%rowtype;
  d documents.documents%rowtype;
  w platform.customer_workspaces%rowtype;
  actor record;
begin
  select * into actor
  from documents.resolve_vault_actor(
    p_document_context_id, 'documents.vault.read', true
  );
  if actor.scope_type not in ('property','building','unit') then
    raise exception 'airprop_evidence_unavailable' using errcode='42501';
  end if;

  select * into w
  from platform.customer_workspaces
  where id=p_workspace_id and archived_at is null and lifecycle_status='ACTIVE';
  select * into v
  from documents.document_versions
  where id=p_version_id
  for share;
  select * into d
  from documents.documents
  where id=v.document_id
  for share;

  if w.id is null or v.id is null or d.id is null
    or actor.tenant_id is distinct from w.tenant_id
    or v.tenant_id is distinct from w.tenant_id
    or d.tenant_id is distinct from w.tenant_id
    or d.workspace_id is distinct from w.id
    or p_require_current is null
    or d.deleted_at is not null or d.status<>'active'
    or (p_require_current and d.current_version<>v.version)
    or not d.is_evidence or d.evidence_status<>'verified'
    or d.verified_by is null or d.verified_by is not distinct from d.created_by
    or d.verified_at is null or d.verified_at<v.created_at
    or v.checksum_status<>'verified' or v.scanning_status<>'clean'
    or v.sha256 !~ '^[0-9a-f]{64}$'
    or not exists(
      select 1 from documents.document_scan_attestations a
      where a.version_id=v.id and a.tenant_id=w.tenant_id
        and a.provider='clamav' and a.verdict='clean'
        and a.content_sha256=v.sha256
    )
    or not exists(
      select 1 from platform.workspace_property_bindings b
      where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
        and b.property_id=d.property_id and b.status='active'
        and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp())
    )
    or not exists(
      select 1 from platform.workspace_entitlements e
      where e.customer_workspace_id=w.id
        and e.entitlement_key='module.documents' and e.boolean_value
        and e.valid_from<=statement_timestamp()
        and (e.valid_until is null or e.valid_until>statement_timestamp())
    )
    or not exists(
      select 1 from platform.workspace_modules m
      where m.customer_workspace_id=w.id and m.module_code='documents'
        and m.status='active' and m.valid_from<=statement_timestamp()
        and (m.valid_to is null or m.valid_to>statement_timestamp())
    )
  then
    raise exception 'airprop_evidence_unavailable' using errcode='42501';
  end if;

  return v;
end;
$$;

alter function app_private.require_airprop_diligence_evidence_v1(
  uuid,uuid,uuid,boolean
) owner to postgres;
revoke all on function app_private.require_airprop_diligence_evidence_v1(
  uuid,uuid,uuid,boolean
) from public,anon,authenticated,service_role,cladora_rpc_owner,
  cladora_ce_guide_runtime,cladora_ce_guide_executor;

commit;
