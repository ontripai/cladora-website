begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D3: current_version may advance to a replacement candidate only through the
-- Core transaction provider after an exact, immutable clean attestation.
create function documents.guard_replacement_promotion_after_clean_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_marker jsonb;
begin
  if new.current_version is not distinct from old.current_version then
    return new;
  end if;

  begin
    v_marker := nullif(
      current_setting('documents.replacement_promotion_after_clean_v1', true), ''
    )::jsonb;
  exception when others then
    v_marker := null;
  end;

  if new.current_version <> old.current_version + 1
    or new.workspace_id is null
    or new.workspace_id is distinct from old.workspace_id
    or old.status <> 'active'::platform.record_status
    or old.archived_at is not null
    or old.deleted_at is not null
    or coalesce(to_jsonb(old)->>'disposition_status', 'retained')
      in ('disposition_approved', 'expired')
    or (to_jsonb(new) - 'current_version' - 'updated_at')
      is distinct from (to_jsonb(old) - 'current_version' - 'updated_at')
    or v_marker is null
    or v_marker->>'contract_version'
      <> 'documents-replacement-promotion-after-clean.v1'
    or v_marker->>'document_id' <> old.id::text
    or v_marker->>'workspace_id' <> old.workspace_id::text
    or v_marker->>'actor_id' <> auth.uid()::text
    or (v_marker->>'parent_version')::integer is distinct from old.current_version
    or (v_marker->>'candidate_version')::integer is distinct from new.current_version
    or not exists (
      select 1
      from documents.upload_intents ui
      join documents.document_versions parent
        on parent.id = ui.expected_parent_version_id
       and parent.tenant_id = ui.tenant_id
       and parent.document_id = ui.document_id
      join documents.document_versions candidate
        on candidate.id = ui.committed_version_id
       and candidate.tenant_id = ui.tenant_id
       and candidate.document_id = ui.document_id
      join documents.document_scan_attestations attestation
        on attestation.version_id = candidate.id
       and attestation.tenant_id = candidate.tenant_id
      where ui.id::text = v_marker->>'intent_id'
        and ui.tenant_id = old.tenant_id
        and ui.context_id::text = v_marker->>'context_id'
        and ui.user_id = auth.uid()
        and ui.workspace_id = old.workspace_id
        and ui.operation_kind = 'replacement_version'
        and ui.document_id = old.id
        and ui.prospective_document_id is null
        and ui.status = 'consumed'
        and ui.consumed_at is not null
        and ui.attempts = 1
        and ui.committed_document_id = old.id
        and ui.expected_parent_version_id::text = v_marker->>'parent_version_id'
        and ui.committed_version_id::text = v_marker->>'candidate_version_id'
        and ui.expected_version = old.current_version + 1
        and parent.version = old.current_version
        and candidate.version = new.current_version
        and candidate.replaces_version_id = parent.id
        and candidate.upload_intent_id = ui.id
        and candidate.bucket_id = ui.bucket_id
        and candidate.object_path = ui.object_path
        and candidate.storage_object_id = ui.verified_storage_object_id
        and candidate.storage_generation is not distinct from ui.verified_storage_generation
        and candidate.storage_etag is not distinct from ui.verified_storage_etag
        and candidate.sha256 = ui.verified_sha256
        and candidate.size_bytes = ui.verified_size_bytes
        and candidate.checksum_status = 'verified'
        and candidate.scanning_status = 'clean'
        and candidate.bucket_id = v_marker->>'bucket_id'
        and candidate.object_path = v_marker->>'object_path'
        and candidate.storage_object_id::text = v_marker->>'storage_object_id'
        and candidate.storage_generation is not distinct from v_marker->>'storage_generation'
        and candidate.storage_etag is not distinct from v_marker->>'storage_etag'
        and candidate.sha256 = v_marker->>'sha256'
        and candidate.size_bytes = (v_marker->>'size_bytes')::bigint
        and attestation.provider = 'clamav'
        and attestation.verdict = 'clean'
        and attestation.content_sha256 = candidate.sha256
        and attestation.id::text = v_marker->>'attestation_id'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'clean_replacement_promotion_required';
  end if;

  return new;
end;
$$;

alter function documents.guard_replacement_promotion_after_clean_v1() owner to postgres;
revoke all on function documents.guard_replacement_promotion_after_clean_v1()
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

create trigger documents_replacement_promotion_after_clean_v1
before update of current_version on documents.documents
for each row execute function documents.guard_replacement_promotion_after_clean_v1();

comment on function documents.guard_replacement_promotion_after_clean_v1() is
  'D3 fail-closed guard: exact clean attestation plus Core transaction marker is required for replacement CAS promotion.';

commit;
