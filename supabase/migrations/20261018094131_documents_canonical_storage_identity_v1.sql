begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D2: Additive canonical intent, commit and exact Storage identity fields.
-- Historical rows remain NULL. No default or backfill is introduced.
alter table documents.upload_intents
  add column operation_kind text,
  add column expected_parent_version_id uuid,
  add column committed_document_id uuid,
  add column committed_version_id uuid,
  add column verified_storage_object_id uuid,
  add column verified_storage_generation text,
  add column verified_storage_etag text,
  add column verified_sha256 text,
  add column verified_size_bytes bigint;

alter table documents.document_versions
  add column upload_intent_id uuid,
  add column replaces_version_id uuid,
  add column bucket_id text,
  add column storage_object_id uuid,
  add column storage_generation text,
  add column storage_etag text;

alter table documents.upload_intents
  drop constraint upload_intents_workspace_prospective_pair_v1,
  drop constraint upload_intents_bound_new_document_v1;

alter table documents.upload_intents
  add constraint upload_intents_operation_kind_v1
    check (operation_kind is null or operation_kind in ('new_document', 'replacement_version')),
  add constraint upload_intents_verified_sha256_v1
    check (verified_sha256 is null or verified_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint upload_intents_verified_size_v1
    check (verified_size_bytes is null or verified_size_bytes > 0),
  add constraint upload_intents_canonical_shape_v1 check (
    operation_kind is null
    or (operation_kind = 'new_document'
      and workspace_id is not null
      and document_id is null
      and prospective_document_id is not null
      and expected_parent_version_id is null
      and expected_version = 1)
    or (operation_kind = 'replacement_version'
      and workspace_id is not null
      and document_id is not null
      and prospective_document_id is null
      and expected_parent_version_id is not null
      and expected_version > 1)
  ),
  add constraint upload_intents_canonical_commit_v1 check (
    operation_kind is null
    or (status = 'consumed'
      and consumed_at is not null
      and committed_document_id is not null
      and committed_version_id is not null
      and verified_storage_object_id is not null
      and verified_sha256 is not null
      and verified_size_bytes is not null)
    or (status <> 'consumed'
      and committed_document_id is null
      and committed_version_id is null
      and verified_storage_object_id is null
      and verified_storage_generation is null
      and verified_storage_etag is null
      and verified_sha256 is null
      and verified_size_bytes is null)
  );

alter table documents.document_versions
  add constraint document_versions_canonical_storage_v1 check (
    upload_intent_id is null
    or (bucket_id = 'document-vault'
      and storage_object_id is not null
      and sha256 ~ '^[0-9a-f]{64}$'
      and size_bytes > 0)
  );

alter table documents.upload_intents
  add constraint upload_intents_tenant_id_id_uq unique (tenant_id, id);
alter table documents.document_versions
  add constraint document_versions_tenant_document_id_uq unique (tenant_id, document_id, id);

alter table documents.upload_intents
  add constraint upload_intents_expected_parent_v1_fk
    foreign key (tenant_id, document_id, expected_parent_version_id)
    references documents.document_versions(tenant_id, document_id, id)
    on delete restrict deferrable initially deferred,
  add constraint upload_intents_committed_version_v1_fk
    foreign key (tenant_id, committed_document_id, committed_version_id)
    references documents.document_versions(tenant_id, document_id, id)
    on delete restrict deferrable initially deferred;

alter table documents.document_versions
  add constraint document_versions_upload_intent_v1_fk
    foreign key (tenant_id, upload_intent_id)
    references documents.upload_intents(tenant_id, id)
    on delete restrict deferrable initially deferred,
  add constraint document_versions_replaces_version_v1_fk
    foreign key (tenant_id, document_id, replaces_version_id)
    references documents.document_versions(tenant_id, document_id, id)
    on delete restrict deferrable initially deferred;

create unique index document_versions_upload_intent_v1_idx
  on documents.document_versions(upload_intent_id)
  where upload_intent_id is not null;
create index document_versions_upload_intent_fk_v1_idx
  on documents.document_versions(tenant_id, upload_intent_id)
  where upload_intent_id is not null;
create index document_versions_replaces_version_v1_idx
  on documents.document_versions(tenant_id, document_id, replaces_version_id)
  where replaces_version_id is not null;
create index upload_intents_expected_parent_v1_idx
  on documents.upload_intents(tenant_id, document_id, expected_parent_version_id)
  where expected_parent_version_id is not null;
create index upload_intents_committed_version_v1_idx
  on documents.upload_intents(tenant_id, committed_document_id, committed_version_id)
  where committed_version_id is not null;

comment on column documents.upload_intents.operation_kind is
  'Canonical D2 intent kind. NULL is historical only and cannot be inserted after this cutover.';
comment on column documents.upload_intents.verified_storage_object_id is
  'Exact trusted storage.objects identity; path alone is never canonical object identity.';
comment on column documents.document_versions.upload_intent_id is
  'Single canonical intent that atomically committed this immutable version; NULL is historical.';

create function documents.protect_canonical_upload_intent_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_marker jsonb;
begin
  if tg_op = 'INSERT' then
    if new.operation_kind is null then
      raise exception using
        errcode = '23502',
        message = 'document_operation_kind_required';
    end if;
    return new;
  end if;

  if row(
    new.tenant_id, new.context_id, new.user_id, new.workspace_id,
    new.operation_kind, new.document_id, new.prospective_document_id,
    new.expected_parent_version_id, new.expected_version, new.bucket_id,
    new.object_path, new.declared_mime_type, new.max_size_bytes,
    new.idempotency_key, new.server_auth_hash, new.expires_at
  ) is distinct from row(
    old.tenant_id, old.context_id, old.user_id, old.workspace_id,
    old.operation_kind, old.document_id, old.prospective_document_id,
    old.expected_parent_version_id, old.expected_version, old.bucket_id,
    old.object_path, old.declared_mime_type, old.max_size_bytes,
    old.idempotency_key, old.server_auth_hash, old.expires_at
  ) then
    raise exception using
      errcode = '55000',
      message = 'document_upload_intent_binding_is_immutable';
  end if;

  if old.operation_kind is null then
    if row(
      new.committed_document_id, new.committed_version_id,
      new.verified_storage_object_id, new.verified_storage_generation,
      new.verified_storage_etag, new.verified_sha256, new.verified_size_bytes
    ) is distinct from row(
      old.committed_document_id, old.committed_version_id,
      old.verified_storage_object_id, old.verified_storage_generation,
      old.verified_storage_etag, old.verified_sha256, old.verified_size_bytes
    ) then
      raise exception using
        errcode = '55000',
        message = 'historical_upload_intent_cannot_be_rebound';
    end if;
    return new;
  end if;

  if old.status = 'consumed' and row(
    new.committed_document_id, new.committed_version_id,
    new.verified_storage_object_id, new.verified_storage_generation,
    new.verified_storage_etag, new.verified_sha256, new.verified_size_bytes
  ) is distinct from row(
    old.committed_document_id, old.committed_version_id,
    old.verified_storage_object_id, old.verified_storage_generation,
    old.verified_storage_etag, old.verified_sha256, old.verified_size_bytes
  ) then
    raise exception using
      errcode = '55000',
      message = 'document_upload_intent_commit_is_immutable';
  end if;

  if old.status <> 'consumed' and new.status = 'consumed' then
    begin
      v_marker := nullif(
        current_setting('documents.canonical_storage_identity_v1', true), ''
      )::jsonb;
    exception when others then
      v_marker := null;
    end;

    if v_marker is null
      or v_marker->>'contract_version' <> 'documents-canonical-storage-identity.v1'
      or v_marker->>'intent_id' <> new.id::text
      or v_marker->>'document_id' <> new.committed_document_id::text
      or v_marker->>'version_id' <> new.committed_version_id::text
      or v_marker->>'workspace_id' <> new.workspace_id::text
      or v_marker->>'actor_id' <> new.user_id::text
      or v_marker->>'bucket_id' <> new.bucket_id
      or v_marker->>'object_path' <> new.object_path
      or v_marker->>'storage_object_id' <> new.verified_storage_object_id::text
      or v_marker->>'sha256' <> new.verified_sha256
      or (v_marker->>'size_bytes')::bigint is distinct from new.verified_size_bytes
      or v_marker->>'detected_mime_type' <> new.declared_mime_type
      or v_marker->>'non_overwritable' <> 'true'
      or v_marker->>'generation_capability' not in ('exposed', 'not_exposed')
      or v_marker->>'etag_capability' not in ('exposed', 'not_exposed')
      or (v_marker->>'generation_capability' = 'exposed'
        and (new.verified_storage_generation is null
          or v_marker->>'storage_generation' <> new.verified_storage_generation))
      or (v_marker->>'generation_capability' = 'not_exposed'
        and (new.verified_storage_generation is not null
          or v_marker->>'storage_generation' is not null))
      or (v_marker->>'etag_capability' = 'exposed'
        and (new.verified_storage_etag is null
          or v_marker->>'storage_etag' <> new.verified_storage_etag))
      or (v_marker->>'etag_capability' = 'not_exposed'
        and (new.verified_storage_etag is not null
          or v_marker->>'storage_etag' is not null))
    then
      raise exception using
        errcode = '42501',
        message = 'trusted_storage_identity_required';
    end if;
  end if;

  return new;
end;
$$;

alter function documents.protect_canonical_upload_intent_v1() owner to postgres;
revoke all on function documents.protect_canonical_upload_intent_v1()
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

create trigger upload_intent_canonical_identity_v1
before insert or update on documents.upload_intents
for each row execute function documents.protect_canonical_upload_intent_v1();

-- Reconcile the existing new-document guard with D2's exact Storage identity.
create or replace function documents.require_workspace_bound_document_insert_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_intent documents.upload_intents%rowtype;
  v_marker jsonb;
begin
  if new.workspace_id is null then
    raise exception using
      errcode = '23502',
      message = 'document_workspace_binding_required_on_insert';
  end if;

  select ui.* into v_intent
  from documents.upload_intents ui
  where ui.tenant_id = new.tenant_id
    and ui.workspace_id = new.workspace_id
    and ui.operation_kind = 'new_document'
    and ui.prospective_document_id = new.id
    and ui.document_id is null
    and ui.expected_parent_version_id is null
    and ui.expected_version = 1
    and ui.user_id = new.created_by
    and ui.status = 'consumed'
    and ui.consumed_at is not null
    and ui.attempts = 1
    and ui.committed_document_id = new.id
  for share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'canonical_document_writer_intent_required';
  end if;

  begin
    v_marker := nullif(
      current_setting('documents.canonical_storage_identity_v1', true), ''
    )::jsonb;
  exception when others then
    v_marker := null;
  end;

  if v_marker is null
    or v_marker->>'contract_version' <> 'documents-canonical-storage-identity.v1'
    or v_marker->>'intent_id' <> v_intent.id::text
    or v_marker->>'document_id' <> new.id::text
    or v_marker->>'version_id' <> v_intent.committed_version_id::text
    or v_marker->>'workspace_id' <> new.workspace_id::text
    or v_marker->>'actor_id' <> new.created_by::text
    or v_marker->>'bucket_id' <> v_intent.bucket_id
    or v_marker->>'object_path' <> v_intent.object_path
    or v_marker->>'storage_object_id' <> v_intent.verified_storage_object_id::text
    or v_marker->>'sha256' <> v_intent.verified_sha256
    or (v_marker->>'size_bytes')::bigint is distinct from v_intent.verified_size_bytes
    or v_marker->>'non_overwritable' <> 'true'
  then
    raise exception using
      errcode = '42501',
      message = 'trusted_document_object_verification_required';
  end if;

  return new;
end;
$$;

alter function documents.require_workspace_bound_document_insert_v1() owner to postgres;
revoke all on function documents.require_workspace_bound_document_insert_v1()
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

commit;
