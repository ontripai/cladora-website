-- Test 063: Official Communications, Notices, Acknowledgements & Delivery Evidence
-- Baseline: Migration 79 (CLADORA-P2-COMM-001)
-- Verifies canonical communications schema extension, immutability,
-- recipient freezing, AAL boundaries, dual-control evidence verification,
-- and provider-neutral outbox constraints.

begin;
select plan(48);

-- =============================================================================
-- 1. Table & Object Existence (8 assertions)
-- =============================================================================
select has_table('communications', 'templates', 'communications.templates table exists');
select has_table('communications', 'template_versions', 'communications.template_versions table exists');
select has_table('communications', 'official_notices', 'communications.official_notices table exists');
select has_table('communications', 'notice_recipients', 'communications.notice_recipients table exists');
select has_table('communications', 'delivery_attempts', 'communications.delivery_attempts table exists');
select has_table('communications', 'notice_acknowledgements', 'communications.notice_acknowledgements table exists');
select has_table('communications', 'statutory_evidence', 'communications.statutory_evidence table exists');
select has_table('communications', 'notice_suppressions', 'communications.notice_suppressions table exists');

-- =============================================================================
-- 2. Customer API Function Existence (10 assertions)
-- =============================================================================
select has_function('customer_api', 'get_official_notices_v1', ARRAY['uuid', 'text', 'text', 'integer', 'integer', 'uuid'], 'customer_api.get_official_notices_v1 exists');
select has_function('customer_api', 'get_notice_detail_v1', ARRAY['uuid', 'uuid'], 'customer_api.get_notice_detail_v1 exists');
select has_function('customer_api', 'create_notice_draft_v1', ARRAY['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid', 'uuid', 'jsonb', 'text'], 'customer_api.create_notice_draft_v1 exists');
select has_function('customer_api', 'approve_notice_v1', ARRAY['uuid', 'uuid'], 'customer_api.approve_notice_v1 exists');
select has_function('customer_api', 'publish_notice_v1', ARRAY['uuid', 'uuid'], 'customer_api.publish_notice_v1 exists');
select has_function('customer_api', 'acknowledge_notice_v1', ARRAY['uuid', 'uuid', 'text', 'text', 'text'], 'customer_api.acknowledge_notice_v1 exists');
select has_function('customer_api', 'record_statutory_evidence_v1', ARRAY['uuid', 'uuid', 'text', 'text', 'timestamp with time zone', 'text', 'uuid', 'text'], 'customer_api.record_statutory_evidence_v1 exists');
select has_function('customer_api', 'verify_statutory_evidence_v1', ARRAY['uuid', 'uuid', 'text', 'text'], 'customer_api.verify_statutory_evidence_v1 exists');
select has_function('customer_api', 'cancel_notice_v1', ARRAY['uuid', 'uuid', 'text'], 'customer_api.cancel_notice_v1 exists');
select has_function('customer_api', 'list_notice_deliveries_v1', ARRAY['uuid', 'uuid', 'integer', 'integer'], 'customer_api.list_notice_deliveries_v1 exists');

-- =============================================================================
-- 3. Security & Privilege Grants (9 assertions)
-- =============================================================================
select ok(
  not has_function_privilege('anon', 'customer_api.publish_notice_v1(uuid,uuid)', 'EXECUTE'),
  'anon is denied execute on customer_api.publish_notice_v1'
);

select ok(
  not has_function_privilege('public', 'customer_api.publish_notice_v1(uuid,uuid)', 'EXECUTE'),
  'public is denied execute on customer_api.publish_notice_v1'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.publish_notice_v1(uuid,uuid)', 'EXECUTE'),
  'authenticated is granted execute on customer_api.publish_notice_v1'
);

select ok(
  not has_function_privilege('anon', 'customer_api.approve_notice_v1(uuid,uuid)', 'EXECUTE'),
  'anon is denied execute on customer_api.approve_notice_v1'
);

select ok(
  not has_function_privilege('public', 'customer_api.approve_notice_v1(uuid,uuid)', 'EXECUTE'),
  'public is denied execute on customer_api.approve_notice_v1'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.approve_notice_v1(uuid,uuid)', 'EXECUTE'),
  'authenticated is granted execute on customer_api.approve_notice_v1'
);

select ok(
  not has_function_privilege('anon', 'customer_api.verify_statutory_evidence_v1(uuid,uuid,text,text)', 'EXECUTE'),
  'anon is denied execute on customer_api.verify_statutory_evidence_v1'
);

select ok(
  not has_function_privilege('public', 'customer_api.verify_statutory_evidence_v1(uuid,uuid,text,text)', 'EXECUTE'),
  'public is denied execute on customer_api.verify_statutory_evidence_v1'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.verify_statutory_evidence_v1(uuid,uuid,text,text)', 'EXECUTE'),
  'authenticated is granted execute on customer_api.verify_statutory_evidence_v1'
);

-- =============================================================================
-- 4. Identity Permissions Bootstrapped (6 assertions)
-- =============================================================================
select ok(
  exists(select 1 from identity.permissions where code = 'communications.notices.manage'),
  'permission communications.notices.manage bootstrapped'
);

select ok(
  exists(select 1 from identity.permissions where code = 'communications.notices.approve'),
  'permission communications.notices.approve bootstrapped'
);

select ok(
  exists(select 1 from identity.permissions where code = 'communications.notices.publish'),
  'permission communications.notices.publish bootstrapped'
);

select ok(
  exists(select 1 from identity.permissions where code = 'communications.notices.acknowledge'),
  'permission communications.notices.acknowledge bootstrapped'
);

select ok(
  exists(select 1 from identity.permissions where code = 'communications.evidence.manage'),
  'permission communications.evidence.manage bootstrapped'
);

select ok(
  exists(select 1 from identity.permissions where code = 'communications.evidence.verify'),
  'permission communications.evidence.verify bootstrapped'
);

-- =============================================================================
-- 5. Business Logic & Invariant Test Execution (15 assertions)
-- =============================================================================

create temp table test_results (name text primary key, passed boolean);

do $$
declare
  v_tid uuid := '99100000-0000-0000-0000-000000000001';
  v_uid uuid := '99200000-0000-0000-0000-000000000001';
  v_admin_role uuid;
  v_mem_id uuid := '99300000-0000-0000-0000-000000000001';
  v_ctx_id uuid := '99400000-0000-0000-0000-000000000001';
  v_ws_id uuid := '99500000-0000-0000-0000-000000000001';
  v_tmpl_id uuid;
  v_ver_id uuid;
  v_notice_id uuid;
  v_ev_id uuid;

  v_template_created boolean := false;
  v_placeholder_blocked boolean := false;
  v_draft_created boolean := false;
  v_template_frozen boolean := false;
  v_unapproved_publish_blocked boolean := false;
  v_approved boolean := false;
  v_published boolean := false;
  v_publish_idempotent boolean := false;
  v_recipient_frozen boolean := false;
  v_attempt_regression_blocked boolean := false;
  v_acknowledged boolean := false;
  v_ack_idempotent boolean := false;
  v_evidence_captured boolean := false;
  v_evidence_verified boolean := false;
  v_evidence_immutable boolean := false;
begin
  insert into auth.users (id, email) values (v_uid, 'test_comm_runner@example.invalid') on conflict (id) do nothing;
  insert into platform.tenants (id, legal_name, registration_number, status) values (v_tid, 'Test Comm Tenant', 'COMM-063', 'active') on conflict (id) do nothing;
  select id into v_admin_role from identity.roles where lower(code) = 'association_admin' limit 1;
  insert into identity.memberships (id, tenant_id, user_id, role_id, status) values (v_mem_id, v_tid, v_uid, v_admin_role, 'active') on conflict (id) do nothing;
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type) values (v_ctx_id, v_tid, v_mem_id, 'tenant') on conflict (id) do nothing;
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
  values (v_ws_id, v_tid, 'ASSOCIATION', 'ACTIVE', 'Test Owner', 'PILOT', 1) on conflict (id) do nothing;
  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
  values (v_ws_id, 'module.communications', 'boolean', true, statement_timestamp() - interval '1 day') on conflict do nothing;

  -- Authenticate as AAL2 user
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'aal', 'aal2')::text, true);

  -- 1. Template creation
  insert into communications.templates (tenant_id, template_key, name, template_type)
  values (v_tid, 'tmpl_convening_063', 'Convening Template', 'meeting_convening')
  returning id into v_tmpl_id;

  insert into communications.template_versions (
    template_id, version_number, subject_ro, body_ro, subject_en, body_en, subject_fa, body_fa, allowed_placeholders
  ) values (
    v_tmpl_id, 1,
    'Convocare {{association_name}}', 'Sedinta pe {{meeting_date}}',
    'Convening {{association_name}}', 'Meeting on {{meeting_date}}',
    'فراخوان {{association_name}}', 'جلسه در {{meeting_date}}',
    '["association_name", "meeting_date"]'::jsonb
  ) returning id into v_ver_id;

  v_template_created := (v_ver_id is not null);

  -- 2. Placeholder allowlist enforcement
  begin
    perform communications.create_notice_draft_internal(
      v_ctx_id,
      'Titlu', 'Corp', 'Title', 'Body', 'عنوان', 'متن',
      'meeting_convening', 'statutory_governance', 'governance',
      null, null, v_ver_id,
      '{"disallowed_script": "malicious"}'::jsonb
    );
  exception when others then
    if sqlerrm like '%placeholder_not_allowlisted%' then
      v_placeholder_blocked := true;
    end if;
  end;

  -- 3. Valid draft creation
  declare
    v_res jsonb;
  begin
    v_res := communications.create_notice_draft_internal(
      v_ctx_id,
      'Convocare AG', 'Detalii sedinta', 'Convening AGM', 'Meeting details', 'فراخوان مجمع', 'جزئیات جلسه',
      'meeting_convening', 'statutory_governance', 'governance',
      null, null, v_ver_id,
      '{"association_name": "Asociatia 063"}'::jsonb,
      'idemp-063-001'
    );
    v_notice_id := (v_res->>'notice_id')::uuid;
    v_draft_created := (v_notice_id is not null and v_res->>'status' = 'draft');
  end;

  -- 4. Template version becomes immutable once referenced
  begin
    update communications.template_versions set subject_ro = 'Modified' where id = v_ver_id;
  exception when others then
    if sqlerrm like '%template_version_is_immutable_once_referenced%' then
      v_template_frozen := true;
    end if;
  end;

  -- 5. Unapproved notice cannot be published
  begin
    perform communications.publish_notice_internal(v_ctx_id, v_notice_id);
  exception when others then
    if sqlerrm like '%notice_must_be_approved_to_publish%' then
      v_unapproved_publish_blocked := true;
    end if;
  end;

  -- 6. Approve notice
  declare
    v_app_res jsonb;
  begin
    v_app_res := communications.approve_notice_internal(v_ctx_id, v_notice_id);
    v_approved := (v_app_res->>'status' = 'approved');
  end;

  -- 7. Publish notice
  declare
    v_pub_res jsonb;
  begin
    v_pub_res := communications.publish_notice_internal(v_ctx_id, v_notice_id);
    v_published := (v_pub_res->>'status' = 'published' and (v_pub_res->>'recipient_count')::int >= 1);
  end;

  -- 8. Publish idempotent
  declare
    v_idem_res jsonb;
  begin
    v_idem_res := communications.publish_notice_internal(v_ctx_id, v_notice_id);
    v_publish_idempotent := (v_idem_res->>'status' = 'published');
  end;

  -- 9. Recipient population frozen after publish
  begin
    insert into communications.notice_recipients (
      tenant_id, notice_id, membership_id, preferred_locale, eligible_channels
    ) values (
      v_tid, v_notice_id, v_mem_id, 'ro', '["in_app"]'::jsonb
    );
  exception when others then
    if sqlerrm like '%recipient_population_frozen_after_publish%' then
      v_recipient_frozen := true;
    end if;
  end;

  -- 10. Delivery attempt cannot regress from delivered
  begin
    update communications.delivery_attempts
    set status = 'queued'
    where notice_id = v_notice_id and status = 'delivered';
  exception when others then
    if sqlerrm like '%delivery_attempt_cannot_regress_from_delivered%' then
      v_attempt_regression_blocked := true;
    end if;
  end;

  -- 11. Recipient can acknowledge notice
  declare
    v_ack_res jsonb;
  begin
    v_ack_res := communications.acknowledge_notice_internal(v_ctx_id, v_notice_id, 'in_app_click', 'chk-001', 'ok');
    v_acknowledged := (v_ack_res->>'success' = 'true' and v_ack_res->>'is_statutory_proof' = 'false');
  end;

  -- 12. Acknowledgement idempotent
  declare
    v_ack2_res jsonb;
  begin
    v_ack2_res := communications.acknowledge_notice_internal(v_ctx_id, v_notice_id, 'in_app_click', 'chk-001', 'ok');
    v_ack_idempotent := (v_ack2_res->>'success' = 'true');
  end;

  -- 13. Record statutory evidence
  declare
    v_ev_res jsonb;
  begin
    v_ev_res := communications.record_statutory_evidence_internal(
      v_ctx_id, v_notice_id, 'noticeboard_posting', 'AVIZIER-063-001', statement_timestamp(), 'chk-ev-001', null, 'Afisat'
    );
    v_ev_id := (v_ev_res->>'evidence_id')::uuid;
    v_evidence_captured := (v_ev_id is not null and v_ev_res->>'status' = 'pending_verification');
  end;

  -- 14. Verify statutory evidence
  declare
    v_v_res jsonb;
  begin
    v_v_res := communications.verify_statutory_evidence_internal(v_ctx_id, v_ev_id, 'verified');
    v_evidence_verified := (v_v_res->>'status' = 'verified');
  end;

  -- 15. Verified statutory evidence is immutable
  begin
    update communications.statutory_evidence
    set evidence_reference = 'TAMPERED-063'
    where id = v_ev_id;
  exception when others then
    if sqlerrm like '%verified_statutory_evidence_is_immutable%' then
      v_evidence_immutable := true;
    end if;
  end;

  insert into test_results values
    ('template_created', v_template_created),
    ('placeholder_blocked', v_placeholder_blocked),
    ('draft_created', v_draft_created),
    ('template_frozen', v_template_frozen),
    ('unapproved_publish_blocked', v_unapproved_publish_blocked),
    ('approved', v_approved),
    ('published', v_published),
    ('publish_idempotent', v_publish_idempotent),
    ('recipient_frozen', v_recipient_frozen),
    ('attempt_regression_blocked', v_attempt_regression_blocked),
    ('acknowledged', v_acknowledged),
    ('ack_idempotent', v_ack_idempotent),
    ('evidence_captured', v_evidence_captured),
    ('evidence_verified', v_evidence_verified),
    ('evidence_immutable', v_evidence_immutable);
end;
$$;

select ok((select passed from test_results where name = 'template_created'), 'template version creation succeeds');
select ok((select passed from test_results where name = 'placeholder_blocked'), 'disallowed placeholder strictly rejected');
select ok((select passed from test_results where name = 'draft_created'), 'valid notice draft created');
select ok((select passed from test_results where name = 'template_frozen'), 'template version frozen once referenced');
select ok((select passed from test_results where name = 'unapproved_publish_blocked'), 'unapproved notice publication blocked');
select ok((select passed from test_results where name = 'approved'), 'notice approved with AAL2');
select ok((select passed from test_results where name = 'published'), 'notice published and recipient population frozen');
select ok((select passed from test_results where name = 'publish_idempotent'), 'notice publication idempotent');
select ok((select passed from test_results where name = 'recipient_frozen'), 'recipient addition blocked after publication');
select ok((select passed from test_results where name = 'attempt_regression_blocked'), 'delivery attempt cannot regress from delivered');
select ok((select passed from test_results where name = 'acknowledged'), 'recipient acknowledges own notice record');
select ok((select passed from test_results where name = 'ack_idempotent'), 'recipient acknowledgement idempotent');
select ok((select passed from test_results where name = 'evidence_captured'), 'statutory delivery evidence captured');
select ok((select passed from test_results where name = 'evidence_verified'), 'statutory delivery evidence verified with dual control');
select ok((select passed from test_results where name = 'evidence_immutable'), 'verified statutory evidence strictly immutable');

select * from finish();
rollback;
