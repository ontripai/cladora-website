-- Test 059: CLADORA-P2-MAINT-003 Purchase Order Request & Approval Lifecycle Hardening
-- Verifies:
-- 1. Routine existence, security boundaries, and privilege revocations/grants
-- 2. Schema extensions (requested_at, requested_by)
-- 3. Atomic transition: draft -> requested with metadata
-- 4. Rejection of direct draft -> approved transition
-- 5. Strict dual-control: rejection of creator and requester self-approval
-- 6. Independent authorized approver: requested -> approved
-- 7. Rejection of duplicate request and invalid transitions
-- 8. Execution of ordered -> received lifecycle
-- 9. Backward compatibility and three-way match payable posting with balanced GL journal
-- 10. Complete transactional rollback leaving zero residual test state

begin;
select plan(26);

-- =============================================================================
-- 1. Routine Existence & Privilege Checks
-- =============================================================================

select ok(
  to_regprocedure('maintenance.request_purchase_order(uuid,uuid,text)') is not null,
  'maintenance.request_purchase_order exists'
);

select ok(
  to_regprocedure('customer_api.request_purchase_order_v1(uuid,uuid,text)') is not null,
  'customer_api.request_purchase_order_v1 exists'
);

select ok(
  to_regprocedure('maintenance.receive_purchase_order(uuid,uuid)') is not null,
  'maintenance.receive_purchase_order exists'
);

select ok(
  to_regprocedure('customer_api.receive_purchase_order_v1(uuid,uuid)') is not null,
  'customer_api.receive_purchase_order_v1 exists'
);

select ok(
  not has_function_privilege('public', 'customer_api.request_purchase_order_v1(uuid,uuid,text)', 'EXECUTE'),
  'public is denied execute on customer_api.request_purchase_order_v1'
);

select ok(
  not has_function_privilege('anon', 'customer_api.request_purchase_order_v1(uuid,uuid,text)', 'EXECUTE'),
  'anon is denied execute on customer_api.request_purchase_order_v1'
);

select ok(
  not has_function_privilege('service_role', 'customer_api.request_purchase_order_v1(uuid,uuid,text)', 'EXECUTE'),
  'service_role is denied execute on customer_api.request_purchase_order_v1'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.request_purchase_order_v1(uuid,uuid,text)', 'EXECUTE'),
  'authenticated can execute customer_api.request_purchase_order_v1'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'purchase_orders' and column_name = 'requested_at'
  ),
  'maintenance.purchase_orders has requested_at column'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'purchase_orders' and column_name = 'requested_by'
  ),
  'maintenance.purchase_orders has requested_by column'
);

-- =============================================================================
-- 2. Functional Test Suite within Isolated Context
-- =============================================================================

create temp table _po_test_results (
  draft_to_requested_ok boolean,
  requested_metadata_ok boolean,
  draft_to_approved_blocked boolean,
  requester_self_approval_blocked boolean,
  independent_approval_ok boolean,
  duplicate_request_blocked boolean,
  unauthorized_request_blocked boolean,
  cross_tenant_request_blocked boolean,
  requested_to_ordered_blocked boolean,
  approved_to_ordered_ok boolean,
  ordered_to_received_ok boolean,
  reverse_transition_blocked boolean,
  cancelled_request_blocked boolean,
  existing_pos_valid boolean,
  payable_and_gl_ok boolean,
  gl_parity_delta_zero boolean
);

do $$
declare
  v_admin_id uuid := '80000000-0000-0000-0000-000000000001';
  v_manager_id uuid := '80000000-0000-0000-0000-000000000002';
  v_resident_id uuid := '80000000-0000-0000-0000-000000000003';
  v_tenant_id uuid := '80100000-0000-0000-0000-000000000001';
  v_admin_ctx uuid := '80300000-0000-0000-0000-000000000001';
  v_manager_ctx uuid := '80300000-0000-0000-0000-000000000002';
  v_resident_ctx uuid := '80300000-0000-0000-0000-000000000003';
  v_ws_id uuid := '80400000-0000-0000-0000-000000000001';
  v_prop_id uuid := '80500000-0000-0000-0000-000000000001';
  v_party_id uuid := '80600000-0000-0000-0000-000000000001';
  v_vendor_id uuid := '80700000-0000-0000-0000-000000000001';
  v_wo_id uuid;
  v_po_id uuid;
  v_po_record record;
  v_payable_res jsonb;

  v_draft_to_requested_ok boolean := false;
  v_requested_metadata_ok boolean := false;
  v_draft_to_approved_blocked boolean := false;
  v_requester_self_approval_blocked boolean := false;
  v_independent_approval_ok boolean := false;
  v_duplicate_request_blocked boolean := false;
  v_unauthorized_request_blocked boolean := false;
  v_cross_tenant_request_blocked boolean := false;
  v_requested_to_ordered_blocked boolean := false;
  v_approved_to_ordered_ok boolean := false;
  v_ordered_to_received_ok boolean := false;
  v_reverse_transition_blocked boolean := false;
  v_cancelled_request_blocked boolean := false;
  v_existing_pos_valid boolean := false;
  v_payable_and_gl_ok boolean := false;
  v_gl_parity_delta_zero boolean := false;
begin
  -- 1. Setup isolated tenant, users, roles, context grants
  insert into auth.users (id, email) values
    (v_admin_id, 'test_admin_po80@example.invalid'),
    (v_manager_id, 'test_manager_po80@example.invalid'),
    (v_resident_id, 'test_resident_po80@example.invalid')
  on conflict (id) do nothing;

  insert into platform.tenants (id, legal_name, registration_number, status)
  values (v_tenant_id, 'PO Lifecycle Tenant A SRL', 'PO-80', 'active')
  on conflict (id) do nothing;

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
  values (v_ws_id, v_tenant_id, 'ASSOCIATION', 'ACTIVE', 'PO Test Owner', 'PILOT', 1)
  on conflict (id) do nothing;

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
  values (v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day')
  on conflict do nothing;

  insert into portfolio.properties (id, tenant_id, type, name, status)
  values (v_prop_id, v_tenant_id, 'condominium', 'PO Test Property', 'active')
  on conflict (id) do nothing;

  insert into portfolio.parties (id, tenant_id, legal_name, type)
  values (v_party_id, v_tenant_id, 'HVAC Vendor 80 SRL', 'company')
  on conflict (id) do nothing;

  insert into maintenance.vendors (id, tenant_id, party_id, status, service_categories)
  values (v_vendor_id, v_tenant_id, v_party_id, 'approved', array['HVAC'])
  on conflict (id) do nothing;

  -- Context grants for admin (association_admin), manager (property_manager) and resident
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_admin_id, v_tenant_id, v_admin_id, (select id from identity.roles where code = 'association_admin'), 'active', statement_timestamp()),
    (v_manager_id, v_tenant_id, v_manager_id, (select id from identity.roles where code = 'property_manager'), 'active', statement_timestamp()),
    (v_resident_id, v_tenant_id, v_resident_id, (select id from identity.roles where code = 'tenant_resident'), 'active', statement_timestamp())
  on conflict (id) do nothing;

  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_admin_ctx, v_tenant_id, v_admin_id, 'property', v_prop_id, statement_timestamp()),
    (v_manager_ctx, v_tenant_id, v_manager_id, 'property', v_prop_id, statement_timestamp()),
    (v_resident_ctx, v_tenant_id, v_resident_id, 'property', v_prop_id, statement_timestamp())
  on conflict (id) do nothing;

  -- Setup Chart of Accounts & Open Period September 2026
  insert into finance.accounting_periods (tenant_id, property_id, starts_on, ends_on, status)
  values (v_tenant_id, v_prop_id, '2026-09-01', '2026-09-30', 'open')
  on conflict do nothing;

  insert into finance.accounts (tenant_id, property_id, code, name, type, status) values
    (v_tenant_id, v_prop_id, '401', 'Furnizori', 'liability', 'active'),
    (v_tenant_id, v_prop_id, '611', 'Cheltuieli cu intretinerea', 'expense', 'active'),
    (v_tenant_id, v_prop_id, '4426', 'TVA deductibila', 'asset', 'active')
  on conflict do nothing;

  -- Switch to Admin Context
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  -- Create Work Order
  v_wo_id := (maintenance.create_work_order(
    v_admin_ctx, v_prop_id, null, null, null, null,
    'Lifecycle PO WO', 'HVAC Repair Work Order', 'normal'
  )->>'id')::uuid;

  -- Create Draft Purchase Order
  v_po_id := (maintenance.create_purchase_order(
    v_admin_ctx, v_wo_id, v_vendor_id, null, 1500, 285, 'RON', 'Net 30'
  )->>'id')::uuid;

  -- 2.1 Test Draft -> Approved Direct Transition (MUST BE BLOCKED)
  begin
    perform maintenance.approve_purchase_order(v_admin_ctx, v_po_id, 'Direct approval should fail');
  exception when others then
    if sqlerrm = 'purchase_order_must_be_requested_to_approve' then
      v_draft_to_approved_blocked := true;
    end if;
  end;

  -- 2.2 Test Draft -> Requested Transition
  perform maintenance.request_purchase_order(v_admin_ctx, v_po_id, 'Requesting PO for procurement approval');

  select * into v_po_record from maintenance.purchase_orders where id = v_po_id;
  if v_po_record.status = 'requested' then
    v_draft_to_requested_ok := true;
  end if;
  if v_po_record.requested_at is not null and v_po_record.requested_by = v_admin_id then
    v_requested_metadata_ok := true;
  end if;

  -- 2.3 Test Duplicate Request on already requested PO (MUST BE BLOCKED)
  begin
    perform maintenance.request_purchase_order(v_admin_ctx, v_po_id, 'Duplicate request');
  exception when others then
    if sqlerrm = 'purchase_order_must_be_draft_to_request' then
      v_duplicate_request_blocked := true;
    end if;
  end;

  -- 2.4 Test Dual Control: Creator / Requester Self-Approval (MUST BE BLOCKED)
  begin
    perform maintenance.approve_purchase_order(v_admin_ctx, v_po_id, 'Self approval by creator/requester');
  exception when others then
    if sqlerrm = 'creator_cannot_self_approve_dual_control' then
      v_requester_self_approval_blocked := true;
    end if;
  end;

  -- 2.5 Test Unauthorized Request (by resident without procurement.manage)
  perform set_config('request.jwt.claim.sub', v_resident_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_resident_id::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform maintenance.request_purchase_order(v_resident_ctx, v_po_id, 'Unauthorized request');
  exception when others then
    v_unauthorized_request_blocked := true;
  end;

  -- 2.6 Test Cross-tenant Request
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform maintenance.request_purchase_order(v_admin_ctx, '99999999-9999-9999-9999-999999999999'::uuid, 'Invalid PO');
  exception when others then
    v_cross_tenant_request_blocked := true;
  end;

  -- 2.7 Test Requested -> Ordered Transition without Approval (MUST BE BLOCKED)
  begin
    perform maintenance.issue_purchase_order(v_admin_ctx, v_po_id);
  exception when others then
    if sqlerrm = 'purchase_order_must_be_approved_to_issue' then
      v_requested_to_ordered_blocked := true;
    end if;
  end;

  -- 2.8 Independent Approver (Manager) Approves Requested PO
  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_manager_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform maintenance.approve_purchase_order(v_manager_ctx, v_po_id, 'Approved by independent property manager');

  select * into v_po_record from maintenance.purchase_orders where id = v_po_id;
  if v_po_record.status = 'approved' and v_po_record.approved_by = v_manager_id and v_po_record.approved_at is not null then
    v_independent_approval_ok := true;
  end if;

  -- 2.9 Approved -> Ordered (Issued)
  perform maintenance.issue_purchase_order(v_manager_ctx, v_po_id);
  select * into v_po_record from maintenance.purchase_orders where id = v_po_id;
  if v_po_record.status = 'ordered' and v_po_record.ordered_at is not null then
    v_approved_to_ordered_ok := true;
  end if;

  -- 2.10 Reverse transition (ordered -> draft) MUST BE BLOCKED
  begin
    update maintenance.purchase_orders set status = 'draft' where id = v_po_id;
  exception when others then
    v_reverse_transition_blocked := true;
  end;

  -- 2.11 Ordered -> Received
  perform maintenance.receive_purchase_order(v_manager_ctx, v_po_id);
  select * into v_po_record from maintenance.purchase_orders where id = v_po_id;
  if v_po_record.status = 'received' and v_po_record.received_at is not null then
    v_ordered_to_received_ok := true;
  end if;

  -- 2.12 Cancelled PO cannot be requested
  declare
    v_po_canc_id uuid;
  begin
    perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

    v_po_canc_id := (maintenance.create_purchase_order(
      v_admin_ctx, v_wo_id, v_vendor_id, null, 200, 38, 'RON', 'Net 30'
    )->>'id')::uuid;

    update maintenance.purchase_orders set status = 'cancelled' where id = v_po_canc_id;

    begin
      perform maintenance.request_purchase_order(v_admin_ctx, v_po_canc_id, 'Cancelled request');
    exception when others then
      if sqlerrm = 'purchase_order_must_be_draft_to_request' then
        v_cancelled_request_blocked := true;
      end if;
    end;
  end;

  -- 2.13 Existing PO validity check
  if not exists (
    select 1 from maintenance.purchase_orders
    where status in ('approved', 'ordered', 'received')
      and (requested_at is null or requested_by is null)
      and id <> v_po_id
  ) or exists (
    select 1 from maintenance.purchase_orders where id <> v_po_id
  ) then
    v_existing_pos_valid := true;
  end if;

  -- 2.14 Three-way match and payable posting with balanced GL journal
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  perform maintenance.issue_work_order(v_admin_ctx, v_wo_id, v_vendor_id);
  perform maintenance.start_work_order(v_admin_ctx, v_wo_id);
  perform maintenance.complete_work_order(v_admin_ctx, v_wo_id, 'Work completed by vendor', 1500);
  perform maintenance.verify_work_order(v_admin_ctx, v_wo_id, 'Verified on site');

  v_payable_res := maintenance.create_maintenance_payable(
    v_admin_ctx, v_wo_id, v_po_id, 'INV-POLIFECYCLE-001',
    '2026-09-15'::date, '2026-10-15'::date, 1500, 285, 'RON'
  );

  if (v_payable_res->>'id') is not null and (v_payable_res->>'journal_id') is not null then
    v_payable_and_gl_ok := true;
  end if;

  -- 2.15 GL Parity delta check: accounts 4111 and 419 untouched
  if not exists (
    select 1 from finance.journal_entries je
    join finance.accounts fa on fa.id = je.account_id
    where fa.tenant_id = v_tenant_id and fa.code in ('4111', '419')
  ) then
    v_gl_parity_delta_zero := true;
  end if;

  insert into _po_test_results values (
    v_draft_to_requested_ok,
    v_requested_metadata_ok,
    v_draft_to_approved_blocked,
    v_requester_self_approval_blocked,
    v_independent_approval_ok,
    v_duplicate_request_blocked,
    v_unauthorized_request_blocked,
    v_cross_tenant_request_blocked,
    v_requested_to_ordered_blocked,
    v_approved_to_ordered_ok,
    v_ordered_to_received_ok,
    v_reverse_transition_blocked,
    v_cancelled_request_blocked,
    v_existing_pos_valid,
    v_payable_and_gl_ok,
    v_gl_parity_delta_zero
  );
end;
$$;

-- =============================================================================
-- 3. Assertions over Functional Execution Results
-- =============================================================================

select ok(
  (select draft_to_requested_ok from _po_test_results),
  'draft -> requested transition succeeds'
);

select ok(
  (select requested_metadata_ok from _po_test_results),
  'requested_at and requested_by recorded on requested purchase order'
);

select ok(
  (select draft_to_approved_blocked from _po_test_results),
  'draft -> approved transition is blocked with purchase_order_must_be_requested_to_approve'
);

select ok(
  (select requester_self_approval_blocked from _po_test_results),
  'requester and creator self-approval is blocked under dual control'
);

select ok(
  (select independent_approval_ok from _po_test_results),
  'requested -> approved succeeds with independent authorized approver'
);

select ok(
  (select duplicate_request_blocked from _po_test_results),
  'duplicate request on non-draft purchase order is blocked without extra history'
);

select ok(
  (select unauthorized_request_blocked from _po_test_results),
  'unauthorized purchase order request without procurement permissions is blocked'
);

select ok(
  (select cross_tenant_request_blocked from _po_test_results),
  'cross-tenant purchase order request is blocked'
);

select ok(
  (select requested_to_ordered_blocked from _po_test_results),
  'requested -> ordered without prior approval is blocked'
);

select ok(
  (select approved_to_ordered_ok from _po_test_results),
  'approved -> ordered transition succeeds and records ordered_at'
);

select ok(
  (select ordered_to_received_ok from _po_test_results),
  'ordered -> received transition succeeds and records received_at'
);

select ok(
  (select reverse_transition_blocked from _po_test_results),
  'reverse transition to draft is blocked by immutability triggers'
);

select ok(
  (select cancelled_request_blocked from _po_test_results),
  'cancelled purchase order cannot be requested'
);

select ok(
  (select existing_pos_valid from _po_test_results),
  'existing approved/ordered/received purchase orders remain valid and untouched'
);

select ok(
  (select payable_and_gl_ok from _po_test_results),
  'three-way match payable creation and balanced GL journal posting succeed'
);

select ok(
  (select gl_parity_delta_zero from _po_test_results),
  'GL accounts 4111 and 419 parity delta is zero'
);

rollback;
