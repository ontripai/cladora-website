begin;

-- Vendor and company contacts may upload new documents only in their currently
-- assigned property. Their active relationship is checked in resolve_vault_actor.
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r join identity.permissions p on p.code='documents.vault.upload'
where r.tenant_id is null and r.is_system and r.code in ('company_staff','vendor_contact')
on conflict(role_id,permission_id) do update set effect='allow';

create or replace function documents.create_upload_intent_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_filename text,
  p_declared_mime text,
  p_size_bytes bigint,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_intent_id uuid;
  v_object_path text;
  v_expected_version integer := 1;
  v_server_hash text;
  v_ext text;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.upload', false);

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'zero_byte_upload_rejected' using errcode = '22000';
  end if;
  if p_size_bytes > 20971520 then
    raise exception 'file_size_limit_exceeded' using errcode = '22000';
  end if;

  -- Check declared MIME allowlist
  if lower(p_declared_mime) not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception 'unsupported_document_mime_type' using errcode = '22023';
  end if;

  -- Rejection of script / active content extensions
  v_ext := lower(substring(p_filename from '\.([^\.]+)$'));
  if v_ext in ('exe', 'sh', 'bat', 'cmd', 'js', 'mjs', 'ts', 'html', 'htm', 'svg', 'php', 'py', 'zip', 'tar', 'gz', 'rar') then
    raise exception 'disallowed_file_extension' using errcode = '22023';
  end if;

  -- Check if existing document
  if p_document_id is not null then
    select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
    if not found then
      raise exception 'document_not_found' using errcode = '22000';
    end if;
    if v_doc.legal_hold then
      raise exception 'document_under_legal_hold' using errcode = '22000';
    end if;
    if lower(v_actor.role_code) in ('company_staff','vendor_contact') then
      raise exception 'restricted_roles_cannot_version_existing_documents' using errcode='42501';
    end if;
    v_expected_version := v_doc.current_version + 1;
  end if;

  -- Generate server-opaque object path
  v_intent_id := gen_random_uuid();
  v_object_path := v_actor.tenant_id::text || '/' || v_intent_id::text || '/v' || v_expected_version::text || '.' || coalesce(v_ext, 'bin');
  v_server_hash := encode(extensions.digest(v_intent_id::text || ':' || v_object_path || ':' || v_actor.user_id::text, 'sha256'), 'hex');

  insert into documents.upload_intents (
    id, tenant_id, context_id, user_id, document_id, bucket_id, object_path,
    expected_version, declared_mime_type, max_size_bytes, idempotency_key,
    status, server_auth_hash
  ) values (
    v_intent_id, v_actor.tenant_id, p_context_id, v_actor.user_id, p_document_id, 'document-vault', v_object_path,
    v_expected_version, lower(p_declared_mime), p_size_bytes, p_idempotency_key,
    'authorized', v_server_hash
  );

  return jsonb_build_object(
    'intent_id', v_intent_id,
    'object_path', v_object_path,
    'bucket_id', 'document-vault',
    'expected_version', v_expected_version,
    'max_size_bytes', p_size_bytes,
    'expires_at', (statement_timestamp() + interval '15 minutes')
  );
end;
$$;

create or replace function documents.finalize_upload_internal(
  p_context_id uuid,
  p_intent_id uuid,
  p_computed_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_title text default null,
  p_document_type text default 'general',
  p_classification text default 'internal',
  p_property_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform, portfolio as $$
declare
  v_actor record;
  v_intent documents.upload_intents%rowtype;
  v_doc_id uuid;
  v_version_id uuid;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.upload', false);

  -- Atomic row lock on upload intent
  select * into v_intent
  from documents.upload_intents
  where id = p_intent_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'upload_intent_not_found' using errcode = '22000';
  end if;

  if v_intent.user_id <> v_actor.user_id then
    raise exception 'upload_intent_user_mismatch' using errcode = '42501';
  end if;

  if v_intent.status = 'consumed' or v_intent.consumed_at is not null then
    raise exception 'upload_intent_already_consumed' using errcode = '22000';
  end if;

  if v_intent.expires_at <= statement_timestamp() then
    update documents.upload_intents set status = 'expired' where id = p_intent_id;
    raise exception 'expired_intent_cannot_finalize' using errcode = '22000';
  end if;

  if v_intent.attempts >= v_intent.max_attempts then
    update documents.upload_intents set status = 'failed' where id = p_intent_id;
    raise exception 'intent_attempt_limit_exceeded' using errcode = '22000';
  end if;

  -- Validate server computed SHA-256 (64 hex characters)
  if p_computed_sha256 is null or length(p_computed_sha256) <> 64 then
    raise exception 'invalid_server_checksum' using errcode = '22000';
  end if;

  if p_actual_size_bytes is null or p_actual_size_bytes <= 0 or p_actual_size_bytes > v_intent.max_size_bytes then
    raise exception 'invalid_uploaded_byte_size' using errcode = '22000';
  end if;

  if lower(v_actor.role_code) in ('company_staff','vendor_contact') and
    (v_actor.scope_type <> 'property' or v_actor.property_id is null
      or (p_property_id is not null and p_property_id<>v_actor.property_id)
      or v_intent.document_id is not null or v_intent.context_id<>p_context_id) then
    raise exception 'scoped_upload_denied' using errcode='42501';
  end if;

  -- Mark intent consumed atomically
  update documents.upload_intents
  set status = 'consumed', consumed_at = statement_timestamp(), attempts = attempts + 1
  where id = p_intent_id;

  -- Create or retrieve document
  if v_intent.document_id is not null then
    v_doc_id := v_intent.document_id;
    select * into v_doc from documents.documents where id = v_doc_id and tenant_id = v_actor.tenant_id;
    if v_doc.legal_hold then
      raise exception 'document_under_legal_hold' using errcode = '22000';
    end if;

    update documents.documents
    set current_version = v_intent.expected_version, updated_at = statement_timestamp()
    where id = v_doc_id;
  else
    v_doc_id := gen_random_uuid();
    insert into documents.documents (
      id, tenant_id, property_id, title, document_type, classification,
      current_version, status, created_by, category
    ) values (
      v_doc_id, v_actor.tenant_id, coalesce(p_property_id, v_actor.property_id),
      coalesce(p_title, 'Untitled Document'), p_document_type, p_classification::documents.classification,
      v_intent.expected_version, 'active'::platform.record_status, v_actor.user_id, p_document_type
    );
  end if;

  -- Insert finalized immutable document version
  v_version_id := gen_random_uuid();
  insert into documents.document_versions (
    id, tenant_id, document_id, version, object_path, sha256,
    mime_type, size_bytes, metadata_json, uploaded_by,
    checksum_status, scanning_status, detected_mime_type, created_at
  ) values (
    v_version_id, v_actor.tenant_id, v_doc_id, v_intent.expected_version, v_intent.object_path, p_computed_sha256,
    lower(p_detected_mime), p_actual_size_bytes,
    jsonb_build_object('upload_intent_id', v_intent.id, 'declared_mime', v_intent.declared_mime_type),
    v_actor.user_id, 'verified', 'deferred', lower(p_detected_mime), statement_timestamp()
  );

  -- Record access / audit event
  insert into documents.access_events (
    tenant_id, document_id, version_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, v_doc_id, v_version_id, v_actor.user_id, 'finalize_upload', 'Document uploaded and finalized'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_version_id,
    'version', v_intent.expected_version,
    'sha256', p_computed_sha256,
    'size_bytes', p_actual_size_bytes,
    'scanning_status', 'deferred',
    'status', 'finalized'
  );
end;
$$;

commit;
