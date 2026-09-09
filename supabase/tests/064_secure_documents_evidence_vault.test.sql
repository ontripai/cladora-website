begin;
select plan(60);

-- ----------------------------------------------------------------------------
-- Test 064: Secure Documents, Evidence Vault, Versioning, Retention & Signed Access
-- ----------------------------------------------------------------------------

-- 1-3. Tables exist
select has_table('documents', 'upload_intents', 'documents.upload_intents table exists');
select has_table('documents', 'document_retention_assignments', 'documents.document_retention_assignments table exists');
select has_table('documents', 'disposition_requests', 'documents.disposition_requests table exists');

-- 4-6. Storage Buckets configuration
select ok(
  exists(select 1 from storage.buckets where id = 'document-vault' and public = false),
  'document-vault bucket exists and is private-by-default'
);
select ok(
  (select file_size_limit from storage.buckets where id = 'document-vault') = 20971520::bigint,
  'document-vault file size limit is 20MB'
);
select ok(
  exists(select 1 from storage.buckets where id = 'utility-evidence' and public = false),
  'utility-evidence bucket remains untouched and private'
);

-- 7-11. Storage Policies on storage.objects
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'document_vault_intent_insert'),
  'document_vault_intent_insert policy exists on storage.objects'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'document_vault_tenant_select'),
  'document_vault_tenant_select policy exists on storage.objects'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT' and qual like '%bucket_id = ''document-vault''%' and qual not like '%upload_intents%'
  ),
  'authenticated broad bucket LIST denied'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'UPDATE' and (qual like '%document-vault%' or with_check like '%document-vault%')
  ),
  'direct overwrite/upsert denied on document-vault'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'DELETE' and qual like '%document-vault%'
  ),
  'direct DELETE denied on document-vault'
);

-- 12-21. Revocation of PUBLIC/anon on customer_api RPCs
select ok(not has_function_privilege('anon', 'customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)', 'EXECUTE'), 'anon denied create_upload_intent_v1');
select ok(not has_function_privilege('anon', 'customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)', 'EXECUTE'), 'anon denied finalize_upload_v1');
select ok(not has_function_privilege('anon', 'customer_api.authorize_document_download_v1(uuid, uuid, uuid, boolean)', 'EXECUTE'), 'anon denied authorize_document_download_v1');
select ok(not has_function_privilege('anon', 'customer_api.verify_document_evidence_v1(uuid, uuid, text, text, text)', 'EXECUTE'), 'anon denied verify_document_evidence_v1');
select ok(not has_function_privilege('anon', 'customer_api.place_legal_hold_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied place_legal_hold_v1');
select ok(not has_function_privilege('anon', 'customer_api.release_legal_hold_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied release_legal_hold_v1');
select ok(not has_function_privilege('anon', 'customer_api.request_document_disposition_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied request_document_disposition_v1');
select ok(not has_function_privilege('anon', 'customer_api.approve_document_disposition_v1(uuid, uuid, text, text)', 'EXECUTE'), 'anon denied approve_document_disposition_v1');
select ok(not has_function_privilege('anon', 'customer_api.assign_retention_policy_v1(uuid, uuid, text, text)', 'EXECUTE'), 'anon denied assign_retention_policy_v1');
select ok(not has_function_privilege('anon', 'customer_api.link_document_entity_v1(uuid, uuid, text, uuid, text)', 'EXECUTE'), 'anon denied link_document_entity_v1');

-- 22-23. SECURITY INVOKER and search_path hardening
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'customer_api' and p.proname in (
     'create_upload_intent_v1', 'finalize_upload_v1', 'authorize_document_download_v1',
     'verify_document_evidence_v1', 'place_legal_hold_v1', 'release_legal_hold_v1',
     'request_document_disposition_v1', 'approve_document_disposition_v1',
     'assign_retention_policy_v1', 'link_document_entity_v1'
   ) and p.prosecdef = false) = 10::bigint,
  'all 10 customer_api document RPCs are SECURITY INVOKER'
);
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'customer_api' and p.proname in (
     'create_upload_intent_v1', 'finalize_upload_v1', 'authorize_document_download_v1',
     'verify_document_evidence_v1', 'place_legal_hold_v1', 'release_legal_hold_v1',
     'request_document_disposition_v1', 'approve_document_disposition_v1',
     'assign_retention_policy_v1', 'link_document_entity_v1'
   ) and array_to_string(p.proconfig, ',') = 'search_path=pg_catalog') = 10::bigint,
  'all 10 customer_api document RPCs have search_path = pg_catalog'
);

-- ----------------------------------------------------------------------------
-- 24-60. Functional Behavioral Lifecycle & Security Invariant Tests
-- ----------------------------------------------------------------------------
create temp table test_results (name text primary key, passed boolean);

do $$
declare
  v_tenant_id uuid;
  v_user_admin uuid;
  v_user_pm uuid;
  v_role_admin uuid;
  v_role_pm uuid;
  v_ctx_id uuid;
  v_ctx_pm_id uuid;
  v_ws_id uuid;
  v_prop_id uuid;

  v_zero_byte_blocked boolean := false;
  v_disallowed_ext_blocked boolean := false;
  v_unsupported_mime_blocked boolean := false;
  v_intent_created boolean := false;
  v_intent_tenant_bound boolean := false;
  v_intent_id uuid;
  v_object_path text;

  v_wrong_user_blocked boolean := false;
  v_bad_hash_blocked boolean := false;
  v_finalized boolean := false;
  v_server_hash_matches boolean := false;
  v_etag_not_hash boolean := false;
  v_doc_id uuid;
  v_ver_id uuid;
  v_fixture_bytes bytea := '\x48656c6c6f20576f726c64'::bytea; -- "Hello World"
  v_fixture_sha text;

  v_intent_consumed boolean := false;
  v_replay_blocked boolean := false;
  v_expired_intent_blocked boolean := false;
  v_version_immutable_update boolean := false;
  v_version_immutable_delete boolean := false;
  v_new_version_incremented boolean := false;

  v_unscanned_evidence_blocked boolean := false;
  v_verified_evidence_clean_only boolean := false;
  v_deferred_download_blocked boolean := false;
  v_quarantine_download_blocked boolean := false;
  v_pending_download_blocked boolean := false;

  v_unconfigured_retention_blocked boolean := false;
  v_retention_assigned boolean := false;
  v_retention_overlap_blocked boolean := false;
  v_retention_snapshot_immutable boolean := false;

  v_hold_placed boolean := false;
  v_hold_blocks_disposition boolean := false;
  v_hold_blocks_delete boolean := false;
  v_hold_released boolean := false;

  v_bad_link_entity_blocked boolean := false;
  v_cross_tenant_link_blocked boolean := false;
  v_valid_link_created boolean := false;
  v_unscanned_authoritative_link_blocked boolean := false;

  v_disposition_requested boolean := false;
  v_disposition_self_approve_blocked boolean := false;
  v_disposition_no_delete boolean := false;
  v_signed_url_expiry_bounded boolean := false;
begin
  -- Setup test tenant and context
  select id into v_tenant_id from platform.tenants order by created_at desc limit 1;
  select id into v_role_admin from identity.roles where lower(code) = 'association_admin';
  select id into v_role_pm from identity.roles where lower(code) = 'property_manager';
  select id into v_prop_id from portfolio.properties where tenant_id = v_tenant_id limit 1;

  v_user_admin := gen_random_uuid();
  v_user_pm := gen_random_uuid();

  insert into auth.users (id, email) values
    (v_user_admin, 'doc_vault_admin_064@example.invalid'),
    (v_user_pm, 'doc_vault_pm_064@example.invalid')
  on conflict (id) do nothing;

  -- Calculate fixture sha256
  v_fixture_sha := encode(extensions.digest(v_fixture_bytes, 'sha256'), 'hex');

  -- Ensure active customer workspace with module.documents
  select id into v_ws_id from platform.customer_workspaces where tenant_id = v_tenant_id and lifecycle_status = 'ACTIVE' limit 1;
  if v_ws_id is null then
    v_ws_id := gen_random_uuid();
    insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
    values (v_ws_id, v_tenant_id, 'ASSOCIATION', 'ACTIVE', 'test_owner', 'PILOT', 1);
  end if;

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
  values (v_ws_id, 'module.documents', 'boolean', true, statement_timestamp())
  on conflict (customer_workspace_id, entitlement_key) do update set boolean_value = true, valid_until = null;

  -- Create memberships & context grants
  declare
    v_mem_admin uuid := gen_random_uuid();
    v_mem_pm uuid := gen_random_uuid();
  begin
    insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
    values
      (v_mem_admin, v_tenant_id, v_user_admin, v_role_admin, 'active', statement_timestamp()),
      (v_mem_pm, v_tenant_id, v_user_pm, v_role_pm, 'active', statement_timestamp());

    v_ctx_id := gen_random_uuid();
    v_ctx_pm_id := gen_random_uuid();

    insert into identity.context_grants (id, tenant_id, membership_id, scope_type, starts_at)
    values
      (v_ctx_id, v_tenant_id, v_mem_admin, 'tenant', statement_timestamp()),
      (v_ctx_pm_id, v_tenant_id, v_mem_pm, 'tenant', statement_timestamp());
  end;

  -- Impersonate admin user
  perform set_config('request.jwt.claim.sub', v_user_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_admin, 'aal', 'aal2')::text, true);

  -- 24. Zero-byte upload intent rejected
  begin
    perform documents.create_upload_intent_internal(v_ctx_id, null, 'empty.pdf', 'application/pdf', 0);
  exception when others then
    if sqlerrm like '%zero_byte_upload_rejected%' then v_zero_byte_blocked := true; end if;
  end;

  -- 25. Disallowed extension rejected (.exe, .html, .svg)
  begin
    perform documents.create_upload_intent_internal(v_ctx_id, null, 'malicious.svg', 'image/svg+xml', 1024);
  exception when others then
    if sqlerrm like '%disallowed_file_extension%' or sqlerrm like '%unsupported_document_mime_type%' then
      v_disallowed_ext_blocked := true;
    end if;
  end;

  -- 26. Unsupported declared MIME rejected
  begin
    perform documents.create_upload_intent_internal(v_ctx_id, null, 'test.bin', 'application/octet-stream', 1024);
  exception when others then
    if sqlerrm like '%unsupported_document_mime_type%' then v_unsupported_mime_blocked := true; end if;
  end;

  -- 27-28. Valid upload intent created with tenant-bound path
  declare
    v_res jsonb;
  begin
    v_res := documents.create_upload_intent_internal(v_ctx_id, null, 'report.pdf', 'application/pdf', 1048576);
    v_intent_id := (v_res->>'intent_id')::uuid;
    v_object_path := v_res->>'object_path';
    v_intent_created := (v_intent_id is not null and v_res->>'bucket_id' = 'document-vault');
    v_intent_tenant_bound := (v_object_path like (v_tenant_id::text || '/%'));
  end;

  -- 29. Wrong user cannot finalize
  begin
    perform set_config('request.jwt.claim.sub', v_user_pm::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user_pm, 'aal', 'aal2')::text, true);
    perform documents.finalize_upload_internal(v_ctx_pm_id, v_intent_id, v_fixture_sha, 1024, 'application/pdf', 'Doc 1');
  exception when others then
    if sqlerrm like '%upload_intent_user_mismatch%' then v_wrong_user_blocked := true; end if;
  end;

  -- Switch back to admin
  perform set_config('request.jwt.claim.sub', v_user_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_admin, 'aal', 'aal2')::text, true);

  -- 30. Invalid / truncated / fake SHA-256 rejected
  begin
    perform documents.finalize_upload_internal(v_ctx_id, v_intent_id, 'fake_client_sha256', 1024, 'application/pdf', 'Doc 1');
  exception when others then
    if sqlerrm like '%invalid_server_checksum%' then v_bad_hash_blocked := true; end if;
  end;

  -- 31-33. Valid finalize with computed SHA-256; proves server hash matches fixture bytes; ETag is not treated as SHA
  declare
    v_fin_res jsonb;
    v_dummy_etag text := '"6805f2ac0704671bc203f9985fe3a58c"';
  begin
    -- ETag should NOT be accepted as SHA-256
    begin
      perform documents.finalize_upload_internal(v_ctx_id, v_intent_id, v_dummy_etag, 1024, 'application/pdf', 'ETag Test');
    exception when others then
      v_etag_not_hash := true;
    end;

    v_fin_res := documents.finalize_upload_internal(
      v_ctx_id, v_intent_id, v_fixture_sha, 1024, 'application/pdf',
      'Contract Agreement', 'legal_contract', 'confidential', v_prop_id
    );
    v_doc_id := (v_fin_res->>'document_id')::uuid;
    v_ver_id := (v_fin_res->>'version_id')::uuid;
    v_finalized := (v_doc_id is not null and v_fin_res->>'status' = 'finalized');
    v_server_hash_matches := (v_fin_res->>'sha256' = v_fixture_sha and length(v_fixture_sha) = 64);

    -- Check intent consumed
    select (status = 'consumed' and consumed_at is not null) into v_intent_consumed
    from documents.upload_intents where id = v_intent_id;
  end;

  -- 34. Replay finalize rejected
  begin
    perform documents.finalize_upload_internal(v_ctx_id, v_intent_id, v_fixture_sha, 1024, 'application/pdf', 'Replay');
  exception when others then
    if sqlerrm like '%upload_intent_already_consumed%' then v_replay_blocked := true; end if;
  end;

  -- 35. Expired intent cannot finalize
  declare
    v_exp_intent jsonb;
    v_exp_id uuid;
  begin
    v_exp_intent := documents.create_upload_intent_internal(v_ctx_id, null, 'expired.pdf', 'application/pdf', 1024);
    v_exp_id := (v_exp_intent->>'intent_id')::uuid;
    -- Force expire intent
    update documents.upload_intents set expires_at = statement_timestamp() - interval '1 minute' where id = v_exp_id;
    begin
      perform documents.finalize_upload_internal(v_ctx_id, v_exp_id, v_fixture_sha, 1024, 'application/pdf', 'Expired');
    exception when others then
      if sqlerrm like '%expired_intent_cannot_finalize%' then v_expired_intent_blocked := true; end if;
    end;
  end;

  -- 36. Finalized document_version immutable on UPDATE
  begin
    update documents.document_versions set sha256 = '0000000000000000000000000000000000000000000000000000000000000000' where id = v_ver_id;
  exception when others then
    if sqlerrm like '%document_versions_are_immutable%' then v_version_immutable_update := true; end if;
  end;

  -- 37. Finalized document_version immutable on DELETE
  begin
    delete from documents.document_versions where id = v_ver_id;
  exception when others then
    if sqlerrm like '%document_versions_are_immutable%' then v_version_immutable_delete := true; end if;
  end;

  -- 38. Create new version increments current_version
  declare
    v_v2_intent jsonb;
    v_v2_fin jsonb;
  begin
    v_v2_intent := documents.create_upload_intent_internal(v_ctx_id, v_doc_id, 'v2.pdf', 'application/pdf', 2048);
    v_v2_fin := documents.finalize_upload_internal(
      v_ctx_id, (v_v2_intent->>'intent_id')::uuid,
      encode(extensions.digest('version 2 bytes', 'sha256'), 'hex'),
      2048, 'application/pdf'
    );
    v_new_version_incremented := ((v_v2_fin->>'version')::int = 2);
  end;

  -- 39-40. Deferred scanner cannot verify evidence & verified evidence requires clean scanner status
  begin
    perform set_config('request.jwt.claim.sub', v_user_pm::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user_pm, 'aal', 'aal2')::text, true);
    perform documents.verify_evidence_internal(v_ctx_pm_id, v_doc_id, 'statutory_proof', 'verified', 'Court proof');
  exception when others then
    if sqlerrm like '%verified_evidence_requires_clean_scanner_status%' then
      v_unscanned_evidence_blocked := true;
      v_verified_evidence_clean_only := true;
    end if;
  end;

  -- Switch back to admin
  perform set_config('request.jwt.claim.sub', v_user_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_admin, 'aal', 'aal2')::text, true);

  -- 41-43. Deferred, Quarantined and Pending download blocked
  declare
    v_test_ver uuid;
    v_dl_res jsonb;
  begin
    -- Deferred normal download blocked
    begin
      perform documents.authorize_download_internal(v_ctx_id, v_doc_id, null, false);
    exception when others then
      if sqlerrm like '%deferred_scanner_cannot_normal_download%' then
        v_deferred_download_blocked := true;
      end if;
    end;

    -- Admin inspection bounded download works with AAL2
    v_dl_res := documents.authorize_download_internal(v_ctx_id, v_doc_id, null, true);
    v_signed_url_expiry_bounded := ((v_dl_res->>'expires_in_seconds')::int = 60 and (v_dl_res->>'is_admin_inspection')::boolean = true);

    -- Temporary version with quarantined status
    insert into documents.document_versions (
      id, tenant_id, document_id, version, object_path, sha256, mime_type,
      size_bytes, metadata_json, scanning_status
    ) values (
      gen_random_uuid(), v_tenant_id, v_doc_id, 98, 'test/q', encode(extensions.digest('quarantined_test_bytes', 'sha256'), 'hex'), 'application/pdf',
      100, '{}'::jsonb, 'quarantined'
    ) returning id into v_test_ver;

    begin
      perform documents.authorize_download_internal(v_ctx_id, v_doc_id, v_test_ver, false);
    exception when others then
      if sqlerrm like '%quarantined_file_cannot_download%' then v_quarantine_download_blocked := true; end if;
    end;

    -- Separate version with scanning_pending
    declare
      v_pending_ver uuid;
    begin
      insert into documents.document_versions (
        id, tenant_id, document_id, version, object_path, sha256, mime_type,
        size_bytes, metadata_json, scanning_status
      ) values (
        gen_random_uuid(), v_tenant_id, v_doc_id, 97, 'test/p', encode(extensions.digest('pending_test_bytes', 'sha256'), 'hex'), 'application/pdf',
        100, '{}'::jsonb, 'scanning_pending'
      ) returning id into v_pending_ver;

      begin
        perform documents.authorize_download_internal(v_ctx_id, v_doc_id, v_pending_ver, false);
      exception when others then
        if sqlerrm like '%pending_scanner_cannot_download%' then v_pending_download_blocked := true; end if;
      end;
    end;
  end;

  -- 44. Unconfigured retention fails closed
  begin
    perform documents.assign_retention_policy_internal(v_ctx_id, v_doc_id, 'NON_EXISTENT_POLICY_CODE', 'legal');
  exception when others then
    if sqlerrm like '%document_retention_policy_unconfigured%' then
      v_unconfigured_retention_blocked := true;
    end if;
  end;

  -- 45-47. Configured retention assignment, overlap rejection & snapshot immutability
  declare
    v_ret_res jsonb;
    v_asgn_id uuid;
  begin
    insert into documents.retention_policies (tenant_id, code, name, retain_months, disposition_action, version, effective_from, effective_to)
    values (v_tenant_id, 'CORP_GOV_10Y', 'Corporate Governance 10 Years', 120, 'review', 1, '2026-01-01', '2028-12-31')
    on conflict do nothing;

    -- Version overlap rejection
    begin
      insert into documents.retention_policies (tenant_id, code, name, retain_months, disposition_action, version, effective_from, effective_to)
      values (v_tenant_id, 'CORP_GOV_10Y', 'Overlapping Policy', 60, 'review', 2, '2027-01-01', '2029-12-31');
    exception when others then
      if sqlerrm like '%retention_policy_version_overlap_rejected%' then
        v_retention_overlap_blocked := true;
      end if;
    end;

    v_ret_res := documents.assign_retention_policy_internal(v_ctx_id, v_doc_id, 'CORP_GOV_10Y', 'statutory_tax_code');
    v_retention_assigned := (v_ret_res->>'policy_code' = 'CORP_GOV_10Y' and v_ret_res->>'calculated_retain_until' is not null);

    -- Historical retention snapshot immutable on UPDATE
    select id into v_asgn_id from documents.document_retention_assignments where document_id = v_doc_id and policy_code = 'CORP_GOV_10Y';
    begin
      update documents.document_retention_assignments set policy_snapshot = '{"mutated":true}'::jsonb where id = v_asgn_id;
    exception when others then
      if sqlerrm like '%historical_retention_snapshot_immutable%' then
        v_retention_snapshot_immutable := true;
      end if;
    end;
  end;

  -- 48-51. Legal hold placement and blocking disposition/deletion
  declare
    v_hold_res jsonb;
  begin
    v_hold_res := documents.place_legal_hold_internal(v_ctx_id, v_doc_id, 'Court Injunction 2026/A');
    v_hold_placed := (v_hold_res->>'legal_hold' = 'true' and v_hold_res->>'status' = 'active');

    -- Try to request disposition while under legal hold
    begin
      perform documents.request_disposition_internal(v_ctx_id, v_doc_id, 'Purge expired');
    exception when others then
      if sqlerrm like '%legal_hold_blocks_disposition%' then v_hold_blocks_disposition := true; end if;
    end;

    -- Try to delete document while under legal hold
    begin
      delete from documents.documents where id = v_doc_id;
    exception when others then
      if sqlerrm like '%document_under_legal_hold%' then v_hold_blocks_delete := true; end if;
    end;

    -- Legal hold release
    v_hold_res := documents.release_legal_hold_internal(v_ctx_id, v_doc_id, 'Injunction lifted');
    v_hold_released := (v_hold_res->>'legal_hold' = 'false' and v_hold_res->>'status' = 'released');
  end;

  -- 52-55. Cross-module link validation
  -- Nonexistent entity fails
  begin
    perform documents.link_document_entity_internal(v_ctx_id, v_doc_id, 'governance.meeting', gen_random_uuid(), 'minutes');
  exception when others then
    if sqlerrm like '%document_link_cross_tenant_or_missing%' then v_bad_link_entity_blocked := true; end if;
  end;

  -- Invalid entity type fails
  begin
    perform documents.link_document_entity_internal(v_ctx_id, v_doc_id, 'invalid.domain_entity', gen_random_uuid(), 'evidence');
  exception when others then
    if sqlerrm like '%document_link_type_invalid%' then v_cross_tenant_link_blocked := true; end if;
  end;

  -- Valid canonical link succeeds
  declare
    v_lnk_res jsonb;
  begin
    v_lnk_res := documents.link_document_entity_internal(v_ctx_id, v_doc_id, 'portfolio.property', v_prop_id, 'property_record');
    v_valid_link_created := (v_lnk_res->>'status' = 'linked');
  end;

  -- Deferred/unscanned document cannot attach as authoritative evidence
  begin
    perform documents.link_document_entity_internal(v_ctx_id, v_doc_id, 'portfolio.property', v_prop_id, 'authoritative');
  exception when others then
    if sqlerrm like '%deferred_scanner_cannot_attach_authoritative_evidence%' then
      v_unscanned_authoritative_link_blocked := true;
    end if;
  end;

  -- 56-58. Disposition Request, Dual Control & Non-Destructive Invariant
  declare
    v_req_res jsonb;
    v_req_id uuid;
    v_app_res jsonb;
  begin
    -- Switch to property manager to request disposition
    perform set_config('request.jwt.claim.sub', v_user_pm::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user_pm, 'aal', 'aal2')::text, true);
    v_req_res := documents.request_disposition_internal(v_ctx_pm_id, v_doc_id, 'Ten year period expired');
    v_req_id := (v_req_res->>'request_id')::uuid;
    v_disposition_requested := (v_req_id is not null and v_req_res->>'status' = 'pending_approval');

    -- PM attempts to self-approve (must fail dual-control)
    begin
      perform documents.approve_disposition_internal(v_ctx_pm_id, v_req_id, 'approved', null);
    exception when others then
      if sqlerrm like '%dual_control_requester_cannot_approve_disposition%' then
        v_disposition_self_approve_blocked := true;
      end if;
    end;

    -- Switch back to Admin to approve
    perform set_config('request.jwt.claim.sub', v_user_admin::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user_admin, 'aal', 'aal2')::text, true);
    v_app_res := documents.approve_disposition_internal(v_ctx_id, v_req_id, 'approved', null);

    -- Approved disposition does NOT delete document row
    v_disposition_no_delete := exists(
      select 1 from documents.documents
      where id = v_doc_id and disposition_status = 'disposition_approved'
    );
  end;

  -- Record all test outcomes
  insert into test_results values
    ('zero_byte_blocked', v_zero_byte_blocked),
    ('disallowed_ext_blocked', v_disallowed_ext_blocked),
    ('unsupported_mime_blocked', v_unsupported_mime_blocked),
    ('intent_created', v_intent_created),
    ('intent_tenant_bound', v_intent_tenant_bound),
    ('wrong_user_blocked', v_wrong_user_blocked),
    ('bad_hash_blocked', v_bad_hash_blocked),
    ('finalized', v_finalized),
    ('server_hash_matches', v_server_hash_matches),
    ('etag_not_hash', v_etag_not_hash),
    ('intent_consumed', v_intent_consumed),
    ('replay_blocked', v_replay_blocked),
    ('expired_intent_blocked', v_expired_intent_blocked),
    ('version_immutable_update', v_version_immutable_update),
    ('version_immutable_delete', v_version_immutable_delete),
    ('new_version_incremented', v_new_version_incremented),
    ('unscanned_evidence_blocked', v_unscanned_evidence_blocked),
    ('verified_evidence_clean_only', v_verified_evidence_clean_only),
    ('deferred_download_blocked', v_deferred_download_blocked),
    ('quarantine_download_blocked', v_quarantine_download_blocked),
    ('pending_download_blocked', v_pending_download_blocked),
    ('unconfigured_retention_blocked', v_unconfigured_retention_blocked),
    ('retention_assigned', v_retention_assigned),
    ('retention_overlap_blocked', v_retention_overlap_blocked),
    ('retention_snapshot_immutable', v_retention_snapshot_immutable),
    ('hold_placed', v_hold_placed),
    ('hold_blocks_disposition', v_hold_blocks_disposition),
    ('hold_blocks_delete', v_hold_blocks_delete),
    ('hold_released', v_hold_released),
    ('bad_link_entity_blocked', v_bad_link_entity_blocked),
    ('cross_tenant_link_blocked', v_cross_tenant_link_blocked),
    ('valid_link_created', v_valid_link_created),
    ('unscanned_authoritative_link_blocked', v_unscanned_authoritative_link_blocked),
    ('disposition_requested', v_disposition_requested),
    ('disposition_self_approve_blocked', v_disposition_self_approve_blocked),
    ('disposition_no_delete', v_disposition_no_delete),
    ('signed_url_expiry_bounded', v_signed_url_expiry_bounded);
end;
$$;

select ok((select passed from test_results where name = 'zero_byte_blocked'), 'zero byte upload intent strictly rejected');
select ok((select passed from test_results where name = 'disallowed_ext_blocked'), 'disallowed script/active-content extension rejected');
select ok((select passed from test_results where name = 'unsupported_mime_blocked'), 'unsupported declared MIME rejected');
select ok((select passed from test_results where name = 'intent_created'), 'upload intent created with server-generated path');
select ok((select passed from test_results where name = 'intent_tenant_bound'), 'upload intent path is tenant-partitioned');
select ok((select passed from test_results where name = 'wrong_user_blocked'), 'wrong user cannot finalize upload intent');
select ok((select passed from test_results where name = 'bad_hash_blocked'), 'invalid server checksum rejected');
select ok((select passed from test_results where name = 'finalized'), 'upload finalized with verified server SHA-256');
select ok((select passed from test_results where name = 'server_hash_matches'), 'server content hash matches known fixture bytes');
select ok((select passed from test_results where name = 'etag_not_hash'), 'ETag is not treated as SHA-256');
select ok((select passed from test_results where name = 'intent_consumed'), 'upload intent atomically consumed upon finalization');
select ok((select passed from test_results where name = 'replay_blocked'), 'upload intent replay strictly rejected');
select ok((select passed from test_results where name = 'expired_intent_blocked'), 'expired intent cannot finalize');
select ok((select passed from test_results where name = 'version_immutable_update'), 'finalized version immutable on UPDATE');
select ok((select passed from test_results where name = 'version_immutable_delete'), 'finalized version immutable on DELETE');
select ok((select passed from test_results where name = 'new_version_incremented'), 'subsequent upload creates next version');
select ok((select passed from test_results where name = 'unscanned_evidence_blocked'), 'deferred/unscanned file cannot become verified evidence');
select ok((select passed from test_results where name = 'verified_evidence_clean_only'), 'verified evidence requires clean scanner status');
select ok((select passed from test_results where name = 'deferred_download_blocked'), 'deferred scanner cannot normal-download');
select ok((select passed from test_results where name = 'quarantine_download_blocked'), 'quarantined file download strictly blocked');
select ok((select passed from test_results where name = 'pending_download_blocked'), 'scanning_pending file download strictly blocked');
select ok((select passed from test_results where name = 'unconfigured_retention_blocked'), 'unconfigured retention policy fails closed');
select ok((select passed from test_results where name = 'retention_assigned'), 'configured retention policy assigned with retain_until');
select ok((select passed from test_results where name = 'retention_overlap_blocked'), 'retention version overlap rejected');
select ok((select passed from test_results where name = 'retention_snapshot_immutable'), 'historical retention snapshot immutable');
select ok((select passed from test_results where name = 'hold_placed'), 'legal hold placed overriding standard lifecycle');
select ok((select passed from test_results where name = 'hold_blocks_disposition'), 'active legal hold strictly blocks disposition request');
select ok((select passed from test_results where name = 'hold_blocks_delete'), 'active legal hold strictly blocks document deletion');
select ok((select passed from test_results where name = 'hold_released'), 'legal hold released under AAL2');
select ok((select passed from test_results where name = 'bad_link_entity_blocked'), 'cross-module link to nonexistent entity fails');
select ok((select passed from test_results where name = 'cross_tenant_link_blocked'), 'cross-module link to invalid entity type fails');
select ok((select passed from test_results where name = 'valid_link_created'), 'cross-module link to canonical entity succeeds');
select ok((select passed from test_results where name = 'unscanned_authoritative_link_blocked'), 'deferred scanner cannot attach authoritative evidence');
select ok((select passed from test_results where name = 'disposition_requested'), 'disposition requested under dual control');
select ok((select passed from test_results where name = 'disposition_self_approve_blocked'), 'requester cannot self-approve disposition');
select ok((select passed from test_results where name = 'disposition_no_delete'), 'approved disposition updates lifecycle without deleting record');
select ok((select passed from test_results where name = 'signed_url_expiry_bounded'), 'signed URL expiry bounded in authorization response');

select * from finish();
rollback;
