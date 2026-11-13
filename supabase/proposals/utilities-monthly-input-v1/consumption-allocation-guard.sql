-- Inactive, additive guarded replacement of ONE existing function body.
-- No role/ACL changes, no automatic migration replay. Platform reviews target pins.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $install$
DECLARE p pg_catalog.pg_proc; old_body text := $old$
declare
  v record;
  v_cp utilities.consumption_periods;
  v_meter utilities.meters;
  v_tariff utilities.tariffs;
  v_liable_party_id uuid;
  v_subtotal numeric(20,4);
  v_tax numeric(20,4);
  v_total numeric(20,4);
  v_lines jsonb;
  v_draft_res jsonb;
  v_invoice_id uuid;
  v_issue_res jsonb;
  v_idemp text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_cp from utilities.consumption_periods where id = p_consumption_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'consumption_period_not_found' using errcode = '42501'; end if;

  if v_cp.status = 'billed' or v_cp.invoice_id is not null then
    raise exception 'consumption_already_billed' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = v_cp.meter_id and tenant_id = v.tenant_id;

  -- Closed-Period Protection: Verify period is open
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_meter.property_id, v_cp.period_end::date);

  -- Select active tariff
  if p_tariff_id is not null then
    select * into v_tariff from utilities.tariffs where id = p_tariff_id and tenant_id = v.tenant_id;
  else
    select * into v_tariff from utilities.tariffs
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_meter.property_id)
      and service_type = v_meter.service_type and valid_from <= v_cp.period_end::date
      and (valid_to is null or valid_to >= v_cp.period_end::date) and status = 'active'
    order by (case when property_id = v_meter.property_id then 0 else 1 end), valid_from desc limit 1;
  end if;

  if v_tariff.id is null then
    raise exception 'no_valid_tariff_found_for_utility' using errcode = '42501';
  end if;

  -- Calculate charges
  v_subtotal := round((v_cp.adjusted_consumption * v_tariff.unit_rate) + v_tariff.fixed_charge, 4);
  v_tax := round(v_subtotal * v_tariff.tax_rate, 4);
  v_total := v_subtotal + v_tax;

  -- Determine liable party: Owner of unit, or default property management party
  if v_meter.unit_id is not null then
    select party_id into v_liable_party_id from portfolio.ownerships
    where tenant_id = v.tenant_id and unit_id = v_meter.unit_id
    order by valid_from desc limit 1;
  end if;

  if v_liable_party_id is null then
    select id into v_liable_party_id from portfolio.parties where tenant_id = v.tenant_id limit 1;
  end if;

  v_idemp := coalesce(p_idempotency_key, 'UTIL-BILL-' || v_cp.id::text);

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'description', 'Utility consumption: ' || v_meter.service_type::text || ' (' || v_cp.adjusted_consumption || ' ' || v_meter.unit_code || ')',
      'quantity', v_cp.adjusted_consumption,
      'unit_price', v_tariff.unit_rate,
      'tax_rate', v_tariff.tax_rate
    )
  );

  -- 1. Create Draft Bill using authoritative Billing contract
  v_draft_res := billing.create_bill(
    p_context_id => p_context_id,
    p_property_id => v_meter.property_id,
    p_unit_id => v_meter.unit_id,
    p_liable_party_id => v_liable_party_id,
    p_period_start => v_cp.period_start::date,
    p_period_end => v_cp.period_end::date,
    p_due_on => p_due_on,
    p_currency => v_tariff.currency,
    p_lines => v_lines,
    p_idempotency_key => v_idemp
  );

  v_invoice_id := (v_draft_res->>'id')::uuid;

  -- 2. Issue Bill using authoritative Billing contract
  v_issue_res := billing.issue_bill(
    p_context_id => p_context_id,
    p_invoice_id => v_invoice_id
  );

  -- 3. Link consumption period to invoice
  update utilities.consumption_periods set
    status = 'billed',
    invoice_id = v_invoice_id,
    tariff_id = v_tariff.id,
    tariff_snapshot = jsonb_build_object(
      'tariff_id', v_tariff.id,
      'tariff_code', v_tariff.tariff_code,
      'unit_rate', v_tariff.unit_rate,
      'fixed_charge', v_tariff.fixed_charge,
      'tax_rate', v_tariff.tax_rate
    ),
    charged_subtotal = v_subtotal,
    charged_tax = v_tax,
    charged_total = v_total,
    billed_by = auth.uid(),
    billed_at = statement_timestamp()
  where id = v_cp.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'UTILITY_CHARGE_BILLED', 'consumption_period', v_cp.id,
    'Utility consumption converted to issued bill with GL journal',
    jsonb_build_object('invoice_id', v_invoice_id, 'charged_total', v_total, 'tariff_id', v_tariff.id),
    statement_timestamp()
  );

  return jsonb_build_object(
    'consumption_id', v_cp.id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_issue_res->>'invoice_no',
    'status', 'billed',
    'charged_subtotal', v_subtotal,
    'charged_tax', v_tax,
    'charged_total', v_total,
    'currency', v_tariff.currency
  );
end;
$old$;
 new_body text := $new$
declare
  v record;
  v_cp utilities.consumption_periods;
  v_meter utilities.meters;
  v_tariff utilities.tariffs;
  v_liable_party_id uuid;
  v_subtotal numeric(20,4);
  v_tax numeric(20,4);
  v_total numeric(20,4);
  v_lines jsonb;
  v_draft_res jsonb;
  v_invoice_id uuid;
  v_issue_res jsonb;
  v_idemp text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_cp from utilities.consumption_periods where id = p_consumption_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'consumption_period_not_found' using errcode = '42501'; end if;

  if v_cp.status = 'billed' or v_cp.invoice_id is not null then
    raise exception 'consumption_already_billed' using errcode = '42501';
  end if;

  -- BEGIN consumption-allocation guard v1: same locked row, no second ledger.
  -- REPEATABLE READ may retain a snapshot from before a blocking Finance claim.
  if current_setting('transaction_isolation') not in ('read committed','read uncommitted','serializable') then
    raise exception 'consumption_claim_isolation_unsupported' using errcode='55000';
  end if;
  -- A missing row hidden by RLS cannot prove absence of an allocation claim.
  if exists (
    select 1 from pg_catalog.pg_class c
    where c.oid in ('finance.statutory_allocation_bases'::regclass,
      'finance.statutory_allocation_batches'::regclass,'finance.allocation_runs'::regclass)
      and (not pg_catalog.has_table_privilege(current_user,c.oid,'SELECT')
       or (c.relrowsecurity and (c.relforcerowsecurity or c.relowner<>(select oid from pg_catalog.pg_roles where rolname=current_user))))
  ) then raise exception 'consumption_claim_visibility_unproven' using errcode='55000'; end if;
  perform finance.assert_consumption_not_allocated_v1(p_consumption_id);
  -- END consumption-allocation guard v1.

  select * into v_meter from utilities.meters where id = v_cp.meter_id and tenant_id = v.tenant_id;

  -- Closed-Period Protection: Verify period is open
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_meter.property_id, v_cp.period_end::date);

  -- Select active tariff
  if p_tariff_id is not null then
    select * into v_tariff from utilities.tariffs where id = p_tariff_id and tenant_id = v.tenant_id;
  else
    select * into v_tariff from utilities.tariffs
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_meter.property_id)
      and service_type = v_meter.service_type and valid_from <= v_cp.period_end::date
      and (valid_to is null or valid_to >= v_cp.period_end::date) and status = 'active'
    order by (case when property_id = v_meter.property_id then 0 else 1 end), valid_from desc limit 1;
  end if;

  if v_tariff.id is null then
    raise exception 'no_valid_tariff_found_for_utility' using errcode = '42501';
  end if;

  -- Calculate charges
  v_subtotal := round((v_cp.adjusted_consumption * v_tariff.unit_rate) + v_tariff.fixed_charge, 4);
  v_tax := round(v_subtotal * v_tariff.tax_rate, 4);
  v_total := v_subtotal + v_tax;

  -- Determine liable party: Owner of unit, or default property management party
  if v_meter.unit_id is not null then
    select party_id into v_liable_party_id from portfolio.ownerships
    where tenant_id = v.tenant_id and unit_id = v_meter.unit_id
    order by valid_from desc limit 1;
  end if;

  if v_liable_party_id is null then
    select id into v_liable_party_id from portfolio.parties where tenant_id = v.tenant_id limit 1;
  end if;

  v_idemp := coalesce(p_idempotency_key, 'UTIL-BILL-' || v_cp.id::text);

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'description', 'Utility consumption: ' || v_meter.service_type::text || ' (' || v_cp.adjusted_consumption || ' ' || v_meter.unit_code || ')',
      'quantity', v_cp.adjusted_consumption,
      'unit_price', v_tariff.unit_rate,
      'tax_rate', v_tariff.tax_rate
    )
  );

  -- 1. Create Draft Bill using authoritative Billing contract
  v_draft_res := billing.create_bill(
    p_context_id => p_context_id,
    p_property_id => v_meter.property_id,
    p_unit_id => v_meter.unit_id,
    p_liable_party_id => v_liable_party_id,
    p_period_start => v_cp.period_start::date,
    p_period_end => v_cp.period_end::date,
    p_due_on => p_due_on,
    p_currency => v_tariff.currency,
    p_lines => v_lines,
    p_idempotency_key => v_idemp
  );

  v_invoice_id := (v_draft_res->>'id')::uuid;

  -- 2. Issue Bill using authoritative Billing contract
  v_issue_res := billing.issue_bill(
    p_context_id => p_context_id,
    p_invoice_id => v_invoice_id
  );

  -- 3. Link consumption period to invoice
  update utilities.consumption_periods set
    status = 'billed',
    invoice_id = v_invoice_id,
    tariff_id = v_tariff.id,
    tariff_snapshot = jsonb_build_object(
      'tariff_id', v_tariff.id,
      'tariff_code', v_tariff.tariff_code,
      'unit_rate', v_tariff.unit_rate,
      'fixed_charge', v_tariff.fixed_charge,
      'tax_rate', v_tariff.tax_rate
    ),
    charged_subtotal = v_subtotal,
    charged_tax = v_tax,
    charged_total = v_total,
    billed_by = auth.uid(),
    billed_at = statement_timestamp()
  where id = v_cp.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'UTILITY_CHARGE_BILLED', 'consumption_period', v_cp.id,
    'Utility consumption converted to issued bill with GL journal',
    jsonb_build_object('invoice_id', v_invoice_id, 'charged_total', v_total, 'tariff_id', v_tariff.id),
    statement_timestamp()
  );

  return jsonb_build_object(
    'consumption_id', v_cp.id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_issue_res->>'invoice_no',
    'status', 'billed',
    'charged_subtotal', v_subtotal,
    'charged_tax', v_tax,
    'charged_total', v_total,
    'currency', v_tariff.currency
  );
end;
$new$;
 definition text; header text; old_meta jsonb; h pg_catalog.pg_proc;
BEGIN
 SELECT * INTO STRICT p FROM pg_catalog.pg_proc WHERE oid='utilities.bill_consumption(uuid,uuid,uuid,date,text)'::regprocedure;
 IF p.proowner<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user)
  OR NOT p.prosecdef OR p.prosrc IS DISTINCT FROM old_body
 THEN RAISE EXCEPTION 'consumption_bill_prestate_mismatch' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT h FROM pg_catalog.pg_proc WHERE oid='finance.assert_consumption_not_allocated_v1(uuid)'::regprocedure;
 IF h.prosecdef OR h.provolatile<>'v' OR h.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
  OR encode(sha256(convert_to(h.prosrc,'UTF8')),'hex')<>'fa14e233f9c2fa7c717fc4ba797f4fcc64af3169c0832b0eccb298e801999e13'
  OR NOT has_function_privilege(current_user,h.oid,'EXECUTE') OR NOT has_schema_privilege(current_user,'finance','USAGE')
 THEN RAISE EXCEPTION 'consumption_claim_helper_mismatch' USING ERRCODE='55000'; END IF;
 -- Sufficient complete-visibility predicate, NOT a policy guess or bypass grant.
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN ('finance.statutory_allocation_bases'::regclass,
  'finance.statutory_allocation_batches'::regclass,'finance.allocation_runs'::regclass)
  AND (NOT has_table_privilege(current_user,c.oid,'SELECT') OR (c.relrowsecurity AND
  (c.relforcerowsecurity OR c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)))))
 THEN RAISE EXCEPTION 'consumption_claim_visibility_unproven' USING ERRCODE='55000'; END IF;
 old_meta:=to_jsonb(p)-'prosrc'; definition:=pg_get_functiondef(p.oid);
 IF length(definition)-length(replace(definition,old_body,''))<>length(old_body)
 THEN RAISE EXCEPTION 'consumption_body_boundary_mismatch' USING ERRCODE='55000'; END IF;
 header:=replace(definition,old_body,'');
 EXECUTE replace(definition,old_body,new_body);
 SELECT * INTO STRICT p FROM pg_proc WHERE oid=p.oid;
 IF p.prosrc IS DISTINCT FROM new_body OR to_jsonb(p)-'prosrc' IS DISTINCT FROM old_meta
  OR replace(pg_get_functiondef(p.oid),new_body,'') IS DISTINCT FROM header
 THEN RAISE EXCEPTION 'consumption_poststate_mismatch' USING ERRCODE='55000'; END IF;
END $install$;
COMMIT;
