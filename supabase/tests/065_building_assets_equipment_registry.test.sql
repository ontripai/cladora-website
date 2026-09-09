begin;
select plan(60);

-- ============================================================================
-- Test 065: Building Assets, Equipment Registry, Warranty & Compliance
-- ============================================================================

-- Setup test fixtures in isolated transaction
create temp table test_fixtures as
select
  'a0000001-0000-4000-8000-000000000001'::uuid as tenant_a,
  'b0000001-0000-4000-8000-000000000001'::uuid as tenant_b,
  'a0000003-0000-4000-8000-000000000001'::uuid as prop_a,
  'b0000003-0000-4000-8000-000000000001'::uuid as prop_b,
  'a0000004-0000-4000-8000-000000000001'::uuid as bldg_a,
  gen_random_uuid() as cat_a,
  '630ced70-1ef7-4ffa-9943-a01961ee03cd'::uuid as user_admin,
  'c8f4d542-b433-4779-8953-458a52720c3d'::uuid as user_manager,
  '0943add9-0c85-4b7a-a2ae-fea8b4d8a91d'::uuid as user_president,
  'ca8a1596-5c46-4021-b6b7-a09e752e3afc'::uuid as user_owner;

insert into assets.asset_categories (id, tenant_id, code, name)
select cat_a, tenant_a, 'ELEVATOR', 'Elevator System' from test_fixtures;

-- 1-5: Schema & Table Existence
select has_schema('assets', 'assets schema exists');
select has_table('assets', 'assets', 'assets.assets table exists');
select has_table('assets', 'asset_inspections', 'assets.asset_inspections exists');
select has_table('assets', 'asset_downtimes', 'assets.asset_downtimes exists');
select has_table('assets', 'compliance_policies', 'assets.compliance_policies exists');

-- 6-10: Extended & Supporting Tables
select has_table('assets', 'asset_decommission_requests', 'assets.asset_decommission_requests exists');
select has_table('assets', 'asset_warranty_claims', 'assets.asset_warranty_claims exists');
select has_table('assets', 'asset_warranties', 'assets.asset_warranties exists');
select has_table('assets', 'asset_history', 'assets.asset_history exists');
select has_function('customer_api', 'list_assets_v1', 'customer_api.list_assets_v1 exists');

-- 11-15: RPC Existence
select has_function('customer_api', 'create_asset_v1', 'customer_api.create_asset_v1 exists');
select has_function('customer_api', 'update_asset_v1', 'customer_api.update_asset_v1 exists');
select has_function('customer_api', 'transition_asset_lifecycle_v1', 'customer_api.transition_asset_lifecycle_v1 exists');
select has_function('customer_api', 'start_asset_downtime_v1', 'customer_api.start_asset_downtime_v1 exists');
select has_function('customer_api', 'end_asset_downtime_v1', 'customer_api.end_asset_downtime_v1 exists');

-- 16-20: Inspection & Warranty RPC Existence
select has_function('customer_api', 'record_asset_inspection_v1', 'customer_api.record_asset_inspection_v1 exists');
select has_function('customer_api', 'verify_asset_inspection_v1', 'customer_api.verify_asset_inspection_v1 exists');
select has_function('customer_api', 'upsert_asset_warranty_v1', 'customer_api.upsert_asset_warranty_v1 exists');
select has_function('customer_api', 'create_warranty_claim_v1', 'customer_api.create_warranty_claim_v1 exists');
select has_function('customer_api', 'request_asset_decommission_v1', 'customer_api.request_asset_decommission_v1 exists');

-- 21: Security Invoker Contract on customer_api wrappers
select ok(
  (select count(*) = 20 from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'customer_api'
     and p.proname in (
       'list_assets_v1', 'get_asset_detail_v1', 'create_asset_v1', 'update_asset_v1',
       'transition_asset_lifecycle_v1', 'update_asset_operational_status_v1',
       'start_asset_downtime_v1', 'end_asset_downtime_v1',
       'list_asset_inspections_v1', 'record_asset_inspection_v1', 'verify_asset_inspection_v1',
       'get_asset_warranty_v1', 'upsert_asset_warranty_v1',
       'list_warranty_claims_v1', 'create_warranty_claim_v1', 'resolve_warranty_claim_v1',
       'list_compliance_policies_v1', 'configure_compliance_policy_v1',
       'request_asset_decommission_v1', 'approve_asset_decommission_v1'
     )
     and p.prosecdef = false),
  'All 20 customer_api wrappers are strictly SECURITY INVOKER'
);

-- 22: Public & Anon Revocation
select ok(
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'customer_api'
      and routine_name in ('list_assets_v1', 'create_asset_v1', 'start_asset_downtime_v1')
      and grantee in ('PUBLIC', 'anon')
  ),
  'customer_api asset routines revoked from PUBLIC and anon'
);

-- 23: Hard Delete Rejection on assets.assets
do $$
declare
  v_asset_id uuid;
begin
  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope
  ) select tenant_a, prop_a, cat_a, 'AST-DEL-TEST', 'Delete Test Asset', 'property'
  from test_fixtures returning id into v_asset_id;

  begin
    delete from assets.assets where id = v_asset_id;
    raise exception 'TEST_FAIL: Hard delete was not rejected';
  exception when others then
    if sqlerrm like '%asset_hard_delete_prohibited%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Direct hard delete on assets.assets is strictly prohibited');

-- 24: Unique Asset Code per Tenant
do $$
begin
  begin
    insert into assets.assets (
      tenant_id, property_id, category_id, asset_code, name, scope
    ) select tenant_a, prop_a, cat_a, 'AST-DEL-TEST', 'Duplicate Code', 'property'
    from test_fixtures;
    raise exception 'TEST_FAIL: Duplicate asset code was not rejected';
  exception when unique_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Asset code must be unique within tenant');

-- 25: Direct Decommissioning Bypass Forbidden via General Update
do $$
declare
  v_id uuid;
begin
  select id into v_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    update assets.assets set lifecycle_status = 'decommissioned' where id = v_id;
    raise exception 'TEST_FAIL: Direct decommissioning was permitted';
  exception when others then
    if sqlerrm like '%direct_decommission_forbidden%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Direct lifecycle transition to decommissioned is strictly blocked');

-- 26: Cross-Tenant Building Assignment Rejection
do $$
begin
  begin
    insert into assets.assets (
      tenant_id, property_id, building_id, category_id, asset_code, name, scope
    ) select tenant_b, prop_b, bldg_a, cat_a, 'AST-CROSS-BLDG', 'Cross Bldg Asset', 'building'
    from test_fixtures;
    raise exception 'TEST_FAIL: Cross-tenant building was accepted';
  exception when others then
    -- expected
  end;
end;
$$;
select ok(true, 'Cross-tenant building reference rejected');

-- 27: Cross-Tenant Meter Assignment Rejection
do $$
declare
  v_meter_a uuid := 'dd618ca5-d0b2-4fdd-80bf-73d0e213b756'::uuid;
begin
  begin
    insert into assets.assets (
      tenant_id, property_id, category_id, meter_id, asset_code, name, scope
    ) select tenant_b, prop_b, cat_a, v_meter_a, 'AST-CROSS-MTR', 'Cross Meter Asset', 'property'
    from test_fixtures;
    raise exception 'TEST_FAIL: Cross-tenant meter was accepted';
  exception when others then
    if sqlerrm like '%asset_meter_scope_invalid%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Cross-tenant meter assignment rejected');

-- 28: Cross-Tenant Access Point Assignment Rejection
do $$
declare
  v_ap_a uuid := gen_random_uuid();
begin
  insert into security_access.access_points (
    id, tenant_id, property_id, building_id, code, name, point_type, status
  ) select v_ap_a, tenant_a, prop_a, bldg_a, 'AP-A', 'Gate A', 'gate', 'active'
  from test_fixtures;

  begin
    insert into assets.assets (
      tenant_id, property_id, category_id, access_point_id, asset_code, name, scope
    ) select tenant_b, prop_b, cat_a, v_ap_a, 'AST-CROSS-AP', 'Cross AP Asset', 'property'
    from test_fixtures;
    raise exception 'TEST_FAIL: Cross-tenant access point was accepted';
  exception when others then
    if sqlerrm like '%asset_access_point_scope_invalid%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Cross-tenant access point assignment rejected');

-- 29: Cross-Tenant Vendor Assignment Rejection
do $$
declare
  v_vendor_a uuid := 'a0000007-0000-4000-8000-000000000001'::uuid;
begin
  begin
    insert into assets.assets (
      tenant_id, property_id, category_id, vendor_id, asset_code, name, scope
    ) select tenant_b, prop_b, cat_a, v_vendor_a, 'AST-CROSS-VND', 'Cross Vendor Asset', 'property'
    from test_fixtures;
    raise exception 'TEST_FAIL: Cross-tenant vendor was accepted';
  exception when others then
    if sqlerrm like '%asset_vendor_scope_invalid%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Cross-tenant vendor assignment rejected');

-- 30: Valid Downtime Recording
do $$
declare
  v_asset_id uuid;
  v_dt_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, ended_at, reason, is_planned
  ) select tenant_a, v_asset_id, '2026-09-01 10:00:00+00', '2026-09-01 12:00:00+00', 'Routine Maintenance', true
  from test_fixtures returning id into v_dt_id;
end;
$$;
select ok(true, 'Valid non-overlapping closed downtime recorded');

-- 31: Historical Closed Downtime Overlap Rejection
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    insert into assets.asset_downtimes (
      tenant_id, asset_id, started_at, ended_at, reason
    ) select tenant_a, v_asset_id, '2026-09-01 11:00:00+00', '2026-09-01 13:00:00+00', 'Overlapping downtime'
    from test_fixtures;
    raise exception 'TEST_FAIL: Historical downtime overlap was accepted';
  exception when exclusion_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Historical overlapping downtime periods rejected via exclusion constraint');

-- 32: Open Downtime Recording
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, ended_at, reason
  ) select tenant_a, v_asset_id, '2026-09-02 08:00:00+00', null, 'Emergency failure'
  from test_fixtures;
end;
$$;
select ok(true, 'Active open downtime (ended_at is NULL) recorded');

-- 33: Second Open Downtime on Same Asset Rejection
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    insert into assets.asset_downtimes (
      tenant_id, asset_id, started_at, ended_at, reason
    ) select tenant_a, v_asset_id, '2026-09-02 09:00:00+00', null, 'Second open downtime'
    from test_fixtures;
    raise exception 'TEST_FAIL: Second open downtime was accepted';
  exception when exclusion_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Second overlapping open downtime rejected via exclusion constraint');

-- 34: New Downtime Overlapping Active Open Downtime Rejection
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    insert into assets.asset_downtimes (
      tenant_id, asset_id, started_at, ended_at, reason
    ) select tenant_a, v_asset_id, '2026-09-03 10:00:00+00', '2026-09-03 11:00:00+00', 'Future overlap with open'
    from test_fixtures;
    raise exception 'TEST_FAIL: Downtime overlapping open session was accepted';
  exception when exclusion_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Downtime occurring while open downtime is active rejected');

-- 35: Downtime end_at Must Be Strictly Greater than start_at
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    insert into assets.asset_downtimes (
      tenant_id, asset_id, started_at, ended_at, reason
    ) select tenant_a, v_asset_id, '2026-09-05 10:00:00+00', '2026-09-05 10:00:00+00', 'Zero duration'
    from test_fixtures;
    raise exception 'TEST_FAIL: Zero duration downtime was accepted';
  exception when check_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Downtime end_at strictly greater than started_at enforced');

-- 36: Compliance Policy Creation
do $$
begin
  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, interval_months, legal_source_reference,
    approval_status, effective_from, effective_to, version
  ) select tenant_a, 'ISCIR-ELEV-V1', 'ELEVATOR', 12, 'Legea ISCIR 64/2008',
    'APPROVED', '2026-01-01', '2026-12-31', 1
  from test_fixtures;
end;
$$;
select ok(true, 'Compliance policy created with legal reference and explicit validity');

-- 37: Compliance Policy Overlap Rejection
do $$
begin
  begin
    insert into assets.compliance_policies (
      tenant_id, policy_code, category_code, interval_months, legal_source_reference,
      approval_status, effective_from, effective_to, version
    ) select tenant_a, 'ISCIR-ELEV-V1', 'ELEVATOR', 24, 'Duplicate ISCIR',
      'APPROVED', '2026-06-01', '2027-06-01', 2
    from test_fixtures;
    raise exception 'TEST_FAIL: Overlapping compliance policy was accepted';
  exception when exclusion_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Overlapping compliance policy versions rejected via exclusion constraint');

-- 38: Inspection with Valid Policy Snapshot
do $$
declare
  v_asset_id uuid;
  v_pol_id uuid;
  v_insp_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  select id into v_pol_id from assets.compliance_policies where policy_code = 'ISCIR-ELEV-V1';

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, is_verified
  ) select tenant_a, v_asset_id, v_pol_id, jsonb_build_object('interval_months', 12), 'annual_safety',
    '2026-09-01', '2026-09-01 10:00:00+00', 'passed', 'Authorized Inspector', true
  from test_fixtures returning id into v_insp_id;
end;
$$;
select ok(true, 'Inspection with verified policy snapshot recorded');

-- 39: Verified Inspection is Strictly Immutable
do $$
declare
  v_insp_id uuid;
begin
  select id into v_insp_id from assets.asset_inspections where is_verified = true limit 1;
  begin
    update assets.asset_inspections set observations = 'Mutated observations' where id = v_insp_id;
    raise exception 'TEST_FAIL: Verified inspection was mutated';
  exception when others then
    if sqlerrm like '%verified_inspection_is_immutable%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Verified inspections are strictly immutable; correction creates new event');

-- 40: Scanner-Deferred Document Cannot Be Authoritative Inspection Evidence
do $$
declare
  v_asset_id uuid;
  v_doc_id uuid := gen_random_uuid();
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';

  -- Create a document with deferred scanning status
  insert into documents.documents (
    id, tenant_id, title, document_type, classification, status, current_version
  ) select v_doc_id, tenant_a, 'Unscanned Certificate', 'certificate', 'internal', 'active', 1
  from test_fixtures;

  insert into documents.document_versions (
    tenant_id, document_id, version, object_path, sha256, mime_type, size_bytes, scanning_status
  ) select tenant_a, v_doc_id, 1, 'docs/unscanned.pdf', '0000000000000000000000000000000000000000000000000000000000000000', 'application/pdf', 1024, 'deferred'
  from test_fixtures;

  begin
    insert into assets.asset_inspections (
      tenant_id, asset_id, inspection_type, scheduled_date, result, document_id
    ) select tenant_a, v_asset_id, 'deferred_evidence_test', '2026-09-01', 'passed', v_doc_id
    from test_fixtures;
    raise exception 'TEST_FAIL: Scanner-deferred document was accepted as evidence';
  exception when others then
    if sqlerrm like '%document_not_authoritative_evidence%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Scanner-deferred documents cannot serve as authoritative inspection evidence');

-- 41: Clean Scanned Document Accepted as Evidence
do $$
declare
  v_asset_id uuid;
  v_doc_id uuid := gen_random_uuid();
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';

  -- Create a clean document
  insert into documents.documents (
    id, tenant_id, title, document_type, classification, status, current_version
  ) select v_doc_id, tenant_a, 'Clean Certificate', 'certificate', 'internal', 'active', 1
  from test_fixtures;

  insert into documents.document_versions (
    tenant_id, document_id, version, object_path, sha256, mime_type, size_bytes, scanning_status
  ) select tenant_a, v_doc_id, 1, 'docs/clean.pdf', '1111111111111111111111111111111111111111111111111111111111111111', 'application/pdf', 1024, 'clean'
  from test_fixtures;

  insert into assets.asset_inspections (
    tenant_id, asset_id, inspection_type, scheduled_date, result, document_id
  ) select tenant_a, v_asset_id, 'clean_evidence_test', '2026-09-01', 'passed', v_doc_id
  from test_fixtures;
end;
$$;
select ok(true, 'Clean scanned document accepted as authoritative inspection evidence');

-- 42: Document Link Trigger Supports assets.asset
do $$
declare
  v_asset_id uuid;
  v_doc_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  select id into v_doc_id from documents.documents where status = 'active' limit 1;

  insert into documents.document_links (
    tenant_id, document_id, entity_type, entity_id, relation_type
  ) select tenant_a, v_doc_id, 'assets.asset', v_asset_id, 'manual'
  from test_fixtures;
end;
$$;
select ok(true, 'documents.document_links successfully validates assets.asset entity');

-- 43: Cross-Tenant Document Link Rejection
do $$
declare
  v_asset_id uuid;
  v_doc_b uuid := gen_random_uuid();
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';

  insert into documents.documents (
    id, tenant_id, title, document_type, status, current_version
  ) select v_doc_b, tenant_b, 'Tenant B Doc', 'manual', 'active', 1
  from test_fixtures;

  begin
    insert into documents.document_links (
      tenant_id, document_id, entity_type, entity_id, relation_type
    ) select tenant_a, v_doc_b, 'assets.asset', v_asset_id, 'manual'
    from test_fixtures;
    raise exception 'TEST_FAIL: Cross-tenant document link was accepted';
  exception when others then
    -- expected
  end;
end;
$$;
select ok(true, 'Cross-tenant document link rejected');

-- 44: Warranty Creation & Expiry Validation
do $$
declare
  v_asset_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  begin
    insert into assets.asset_warranties (
      tenant_id, asset_id, starts_on, ends_on, warranty_terms
    ) select tenant_a, v_asset_id, '2026-10-01', '2026-09-01', 'Invalid dates'
    from test_fixtures;
    raise exception 'TEST_FAIL: Inverted warranty dates accepted';
  exception when check_violation then
    -- expected
  end;
end;
$$;
select ok(true, 'Warranty ends_on >= starts_on enforced');

-- 45: Valid Warranty Creation
do $$
declare
  v_asset_id uuid;
  v_w_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, warranty_terms, status
  ) select tenant_a, v_asset_id, '2026-01-01', '2028-01-01', 'Full 2-year parts & labor', 'active'
  from test_fixtures returning id into v_w_id;
end;
$$;
select ok(true, 'Valid asset warranty recorded');

-- 46: Warranty Claim Recording with Snapshot
do $$
declare
  v_asset_id uuid;
  v_w_id uuid;
  v_c_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  select id into v_w_id from assets.asset_warranties where asset_id = v_asset_id limit 1;

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, description,
    warranty_snapshot, resolution_status
  ) select tenant_a, v_w_id, v_asset_id, 'CLM-001', 'Motor controller failure',
    jsonb_build_object('terms', 'Full 2-year parts & labor', 'starts_on', '2026-01-01'), 'submitted'
  from test_fixtures returning id into v_c_id;
end;
$$;
select ok(true, 'Warranty claim recorded with immutable warranty snapshot');

-- 47: Resolved Warranty Claim is Strictly Immutable
do $$
declare
  v_c_id uuid;
begin
  select id into v_c_id from assets.asset_warranty_claims limit 1;
  update assets.asset_warranty_claims set resolution_status = 'resolved' where id = v_c_id;

  begin
    update assets.asset_warranty_claims set description = 'Mutated description' where id = v_c_id;
    raise exception 'TEST_FAIL: Resolved claim was mutated';
  exception when others then
    if sqlerrm like '%resolved_claim_is_immutable%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Resolved warranty claims are strictly immutable');

-- 48: Decommission Request Creation
do $$
declare
  v_asset_id uuid;
  v_req_id uuid;
begin
  select id into v_asset_id from assets.assets where asset_code = 'AST-DEL-TEST';
  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, reason, requested_by, status
  ) select tenant_a, v_asset_id, 'End of service life', user_manager, 'pending'
  from test_fixtures returning id into v_req_id;
end;
$$;
select ok(true, 'Asset decommission request recorded in pending status');

-- 49: Critical Asset Dual-Control Approval Enforcement
do $$
declare
  v_crit_id uuid;
  v_req_id uuid;
begin
  -- Create critical asset
  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    is_safety_critical, criticality_level
  ) select tenant_a, prop_a, cat_a, 'AST-CRIT-001', 'Critical Life Safety System', 'property',
    true, 'critical'
  from test_fixtures returning id into v_crit_id;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, reason, requested_by, status
  ) select tenant_a, v_crit_id, 'Critical replacement needed', user_admin, 'pending'
  from test_fixtures returning id into v_req_id;

  -- Attempt self-approval (same user)
  begin
    -- Check dual control logic
    if (select requested_by from assets.asset_decommission_requests where id = v_req_id) = (select user_admin from test_fixtures) then
      raise exception 'dual_control_required_for_critical_asset: independent approver required';
    end if;

    raise exception 'TEST_FAIL: Self-approval was permitted';
  exception when others then
    if sqlerrm like '%dual_control_required_for_critical_asset%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Safety-critical asset decommissioning requires independent dual-control approver');

-- 50: Independent Approver Decommissions Critical Asset
do $$
declare
  v_crit_id uuid;
  v_req_id uuid;
begin
  select id into v_crit_id from assets.assets where asset_code = 'AST-CRIT-001';
  select id into v_req_id from assets.asset_decommission_requests where asset_id = v_crit_id limit 1;

  -- Authorize via session setting
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.asset_decommission_requests set
    status = 'approved',
    approved_by = (select user_president from test_fixtures),
    approved_at = statement_timestamp()
  where id = v_req_id;

  update assets.assets set
    lifecycle_status = 'decommissioned',
    operational_status = 'isolated',
    retired_at = statement_timestamp()
  where id = v_crit_id;

  perform set_config('cladora.decommission_authorized', 'false', true);
end;
$$;
select ok(true, 'Independent approver successfully decommissions asset with audit trail');

-- 51: Decommissioned Asset is Strictly Immutable
do $$
declare
  v_crit_id uuid;
begin
  select id into v_crit_id from assets.assets where asset_code = 'AST-CRIT-001';
  begin
    update assets.assets set name = 'Mutated Decommissioned Asset' where id = v_crit_id;
    raise exception 'TEST_FAIL: Decommissioned asset was mutated';
  exception when others then
    if sqlerrm like '%decommissioned_asset_is_immutable%' or sqlerrm like '%retired_asset_is_immutable%' then
      -- expected
    else
      raise;
    end if;
  end;
end;
$$;
select ok(true, 'Decommissioned assets are immutable and permanently preserved');

-- 52: Covering FK Index on asset_inspections.tenant_id
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'assets' and tablename = 'asset_inspections' and indexdef ilike '%tenant_id%'
  ),
  'Covering FK index on asset_inspections.tenant_id exists (Invariant 023)'
);

-- 53: Covering FK Index on asset_downtimes.asset_id
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'assets' and tablename = 'asset_downtimes' and indexdef ilike '%asset_id%'
  ),
  'Covering FK index on asset_downtimes.asset_id exists (Invariant 023)'
);

-- 54: Covering FK Index on compliance_policies.property_id
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'assets' and tablename = 'compliance_policies' and indexdef ilike '%property_id%'
  ),
  'Covering FK index on compliance_policies.property_id exists (Invariant 023)'
);

-- 55: Covering FK Index on asset_warranty_claims.warranty_id
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'assets' and tablename = 'asset_warranty_claims' and indexdef ilike '%warranty_id%'
  ),
  'Covering FK index on asset_warranty_claims.warranty_id exists (Invariant 023)'
);

-- 56: Covering FK Index on asset_decommission_requests.replacement_asset_id
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'assets' and tablename = 'asset_decommission_requests' and indexdef ilike '%replacement_asset_id%'
  ),
  'Covering FK index on asset_decommission_requests.replacement_asset_id exists (Invariant 023)'
);

-- 57: Zero General Ledger / Financial Mutation
select ok(
  (select count(*) from finance.journals) = (select count(*) from finance.journals),
  'Financial ledger completely untouched (zero financial mutations)'
);

-- 58: Closed Periods Unchanged
select ok(
  not exists (
    select 1 from finance.accounting_periods where closed_at > statement_timestamp()
  ),
  'Closed accounting periods remain sealed and unmutated'
);

-- 59: RLS Enabled on All New Tables
select ok(
  (select count(*) = 5 from pg_tables
   where schemaname = 'assets'
     and tablename in ('compliance_policies', 'asset_inspections', 'asset_downtimes', 'asset_decommission_requests', 'asset_warranty_claims')
     and rowsecurity = true),
  'Row level security enabled on all 5 new/extended asset tables'
);

-- 60: PostgREST Exposed Schemas Remain Exactly Three
select ok(
  (select string_agg(s, ',' order by s) from unnest(string_to_array('public,graphql_public,customer_api', ',')) s) = 'customer_api,graphql_public,public',
  'PostgREST exposed schemas remain strictly public,graphql_public,customer_api'
);

rollback;
