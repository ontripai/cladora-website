begin;
-- Scope and canonical authority supplement, never replace, existing MFA, role,
-- lifecycle, checklist and independent procurement-approval gates.
create function maintenance.assert_work_order_authority_v1(p_context_id uuid,p_work_order_id uuid,p_permission text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v record; w record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,p_permission,false);
 select * into w from maintenance.work_orders where id=p_work_order_id and tenant_id=v.tenant_id;
 if not found then raise exception 'work_order_not_found' using errcode='P0002';end if;
 if not coalesce(maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id),false) then
  raise exception 'work_order_context_scope_violation' using errcode='42501';end if;
 if not coalesce(app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance',
 case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false) then
  raise exception 'work_order_effective_authority_required' using errcode='42501';end if;
end $$;
revoke all on function maintenance.assert_work_order_authority_v1(uuid,uuid,text) from public,anon,authenticated;

create or replace function maintenance.approve_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_approved_budget numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_prior_approver uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.approve', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.procurement.approve');

  if w.status not in ('draft', 'scheduled') then
    raise exception 'invalid_work_order_transition: % -> scheduled', w.status using errcode = '22023';
  end if;

  -- Dual control check: Creator CANNOT self-approve
  if w.created_by = v.user_id then
    raise exception 'creator_cannot_self_approve_dual_control' using errcode = '42501';
  end if;

  -- Check prior approval in chain
  select approver_id into v_prior_approver
  from maintenance.approval_records
  where tenant_id = v.tenant_id and entity_type = 'work_order' and entity_id = p_work_order_id and decision = 'approved'
  order by step desc limit 1;

  if v_prior_approver is not null and v_prior_approver = v.user_id then
    raise exception 'same_user_cannot_perform_dual_approval_step' using errcode = '42501';
  end if;

  -- Record approval record
  insert into maintenance.approval_records (
    tenant_id, entity_type, entity_id, step, decision, approver_id, approver_role, reason
  ) values (
    v.tenant_id, 'work_order', p_work_order_id, case when v_prior_approver is null then 1 else 2 end,
    'approved', v.user_id, v.role_code, coalesce(p_reason, 'Work order approved')
  );

  update maintenance.work_orders
  set status = 'scheduled',
      approved_budget = coalesce(p_approved_budget, approved_budget),
      metadata = metadata || jsonb_build_object('approval_reason', p_reason, 'approved_by', v.user_id, 'approved_at', statement_timestamp())
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_APPROVED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_reason, 'Work order approved'),
    jsonb_build_object('work_order_no', w.work_order_no, 'approved_budget', coalesce(p_approved_budget, w.approved_budget))
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'scheduled', 'approved_budget', coalesce(p_approved_budget, w.approved_budget));
end $$;

create or replace function maintenance.issue_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_assigned_vendor uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

  v_assigned_vendor := coalesce(p_vendor_id, w.vendor_id);
  if v_assigned_vendor is null then
    raise exception 'vendor_required_to_issue_work_order' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'assigned',
      vendor_id = v_assigned_vendor,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_ISSUED', 'maintenance.work_order', p_work_order_id,
    'Work order issued to vendor',
    jsonb_build_object('work_order_no', w.work_order_no, 'vendor_id', v_assigned_vendor)
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'assigned', 'vendor_id', v_assigned_vendor);
end $$;

create or replace function maintenance.start_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_pause_diff interval;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

  if w.status not in ('assigned', 'scheduled', 'blocked', 'draft') then
    raise exception 'invalid_work_order_transition: % -> in_progress', w.status using errcode = '22023';
  end if;

  -- Resume logic if coming from blocked (hold)
  v_pause_diff := interval '0';
  if w.status = 'blocked' and w.paused_at is not null then
    v_pause_diff := statement_timestamp() - w.paused_at;
  end if;

  update maintenance.work_orders
  set status = 'in_progress',
      started_at = coalesce(started_at, statement_timestamp()),
      paused_at = null,
      total_paused_duration = total_paused_duration + v_pause_diff,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_STARTED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_notes, 'Work order started/resumed'),
    jsonb_build_object('work_order_no', w.work_order_no, 'status', 'in_progress')
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'in_progress', 'started_at', coalesce(w.started_at, statement_timestamp()));
end $$;

create or replace function maintenance.hold_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_hold_reason text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if trim(coalesce(p_hold_reason, '')) = '' then
    raise exception 'hold_reason_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

  if w.status <> 'in_progress' then
    raise exception 'only_in_progress_can_be_held' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'blocked',
      paused_at = statement_timestamp(),
      metadata = metadata || jsonb_build_object('hold_reason', p_hold_reason),
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_HELD', 'maintenance.work_order', p_work_order_id,
    p_hold_reason,
    jsonb_build_object('work_order_no', w.work_order_no, 'status', 'blocked')
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'blocked', 'hold_reason', p_hold_reason);
end $$;

create or replace function maintenance.complete_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_completion_notes text,
  p_actual_cost numeric default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if trim(coalesce(p_completion_notes, '')) = '' then
    raise exception 'completion_notes_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

  if w.status <> 'in_progress' then
    raise exception 'invalid_work_order_transition: % -> completed', w.status using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'completed',
      completion_summary = p_completion_notes,
      actual_cost = coalesce(p_actual_cost, approved_budget, estimated_cost),
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_COMPLETED', 'maintenance.work_order', p_work_order_id,
    'Work order completed',
    jsonb_build_object('work_order_no', w.work_order_no, 'actual_cost', coalesce(p_actual_cost, w.approved_budget))
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'completed', 'completed_at', statement_timestamp());
end $$;

create or replace function maintenance.verify_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_verification_notes text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.verify', false);

  if trim(coalesce(p_verification_notes, '')) = '' then
    raise exception 'verification_notes_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.verify');

  if w.status <> 'completed' then
    raise exception 'work_order_must_be_completed_to_verify' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'verified',
      verified_at = statement_timestamp(),
      verified_by = v.user_id,
      verification_notes = p_verification_notes,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_VERIFIED', 'maintenance.work_order', p_work_order_id,
    p_verification_notes,
    jsonb_build_object('work_order_no', w.work_order_no, 'verified_at', statement_timestamp())
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'verified', 'verified_at', statement_timestamp());
end $$;

create or replace function maintenance.close_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  two record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

  if w.status <> 'verified' then
    raise exception 'work_order_must_be_verified_before_close' using errcode = '22023';
  end if;

  -- Close all linked tickets
  for two in select ticket_id from maintenance.ticket_work_orders where work_order_id = p_work_order_id and tenant_id = v.tenant_id loop
    update maintenance.tickets
    set status = 'closed',
        resolution_summary = coalesce(resolution_summary, w.completion_summary),
        updated_at = statement_timestamp()
    where id = two.ticket_id and status <> 'closed';

    insert into maintenance.ticket_status_history (
      tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
    ) values (
      v.tenant_id, two.ticket_id, 'in_progress', 'closed', v.user_id, v.role_code, 'Closed via work order verification'
    );
  end loop;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_CLOSED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_notes, 'Work order closed'),
    jsonb_build_object('work_order_no', w.work_order_no)
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'verified', 'closed', true);
end $$;

commit;
