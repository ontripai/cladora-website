begin;

-- OPS-01 is an additive source-to-Work-Order adapter. The receipt table stores
-- only linkage and replay evidence; the existing maintenance.work_orders table
-- remains the sole execution system of record.
create table maintenance.execution_request_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  context_id uuid not null references identity.context_grants(id) on delete restrict,
  request_id uuid not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  source_domain text not null check (source_domain = 'service'),
  source_entity_type text not null check (source_entity_type = 'service_request'),
  source_entity_id uuid not null,
  source_version bigint not null check (source_version between 1 and 9007199254740991),
  source_reference text not null check (length(source_reference) between 1 and 240),
  resource_type text not null check (resource_type = 'unit'),
  resource_id uuid not null,
  resource_version integer not null check (resource_version > 0),
  request_kind text not null check (request_kind in ('inspect','maintain','repair','install','remove','other')),
  title text not null check (title = btrim(title) and length(title) between 3 and 200),
  scope_reference text not null check (length(scope_reference) between 1 and 240),
  priority maintenance.priority not null,
  desired_start timestamptz,
  desired_end timestamptz,
  financial_proposal_id uuid,
  financial_proposal_version integer,
  request_status text not null check (request_status in ('accepted','rejected')),
  reason_codes jsonb not null check (jsonb_typeof(reason_codes) = 'array' and jsonb_array_length(reason_codes) between 1 and 32),
  work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null,
  recorded_at timestamptz not null default statement_timestamp(),
  receipt_version integer not null default 1 check (receipt_version = 1),
  check (desired_end is null or (desired_start is not null and desired_end > desired_start)),
  check ((financial_proposal_id is null) = (financial_proposal_version is null)),
  check (financial_proposal_version is null or financial_proposal_version > 0),
  check (
    (request_status = 'accepted' and work_order_id is not null)
    or (request_status = 'rejected' and work_order_id is null)
  ),
  unique (tenant_id, request_id),
  unique (tenant_id, requested_by, idempotency_key)
);

create unique index execution_request_accepted_source_version_idx
  on maintenance.execution_request_receipts(
    tenant_id, source_domain, source_entity_type, source_entity_id, source_version
  ) where request_status = 'accepted';
create index execution_request_workspace_time_idx
  on maintenance.execution_request_receipts(tenant_id, workspace_id, recorded_at desc, id);
create index execution_request_workspace_id_idx
  on maintenance.execution_request_receipts(workspace_id);
create index execution_request_context_id_idx
  on maintenance.execution_request_receipts(context_id);
create index execution_request_work_order_idx
  on maintenance.execution_request_receipts(work_order_id);
create index execution_request_requested_by_idx
  on maintenance.execution_request_receipts(requested_by);

alter table maintenance.execution_request_receipts enable row level security;
revoke all on maintenance.execution_request_receipts from public, anon, authenticated, service_role;

create function app_private.guard_execution_request_receipt_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'operations_execution_receipt_immutable' using errcode = '42501';
end;
$$;

create trigger execution_request_receipt_immutable
  before update or delete on maintenance.execution_request_receipts
  for each row execute function app_private.guard_execution_request_receipt_v1();

revoke all on function app_private.guard_execution_request_receipt_v1()
  from public, anon, authenticated, service_role;

create function customer_api.request_service_execution_v1(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_context_id uuid;
  v_workspace_id uuid;
  v_request_id uuid;
  v_idempotency_key text;
  v_source_id uuid;
  v_source_version bigint;
  v_source_current_version bigint;
  v_source_reference text;
  v_resource_context_id uuid;
  v_resource_workspace_id uuid;
  v_resource_id uuid;
  v_resource_version integer;
  v_request_kind text;
  v_title text;
  v_scope_reference text;
  v_priority text;
  v_desired_start timestamptz;
  v_desired_end timestamptz;
  v_financial_proposal_id uuid;
  v_financial_proposal_version integer;
  v_requested_at timestamptz;
  v_service_scope record;
  v_maintenance_scope record;
  v_source service_catalog.requests%rowtype;
  v_reference jsonb;
  v_tenant_id uuid;
  v_resource_tenant_id uuid;
  v_property_id uuid;
  v_building_id uuid;
  v_key text;
  v_hash text;
  v_idem platform.idempotency_keys%rowtype;
  v_receipt_id uuid := gen_random_uuid();
  v_work_order jsonb;
  v_work_order_id uuid;
  v_response jsonb;
  v_rejection_reason text;
begin
  if v_actor is null then
    raise exception 'operations_execution_access_denied' using errcode = '42501';
  end if;

  if jsonb_typeof(p_request) is distinct from 'object'
     or not (p_request ?& array[
       'contract_version','request_id','idempotency_key','context_id','workspace_id',
       'source','resource','request_kind','title','scope_reference','priority',
       'desired_start','desired_end','financial_proposal_id','financial_proposal_version',
       'requested_at','current_authority_recheck_required'
     ])
     or p_request - array[
       'contract_version','request_id','idempotency_key','context_id','workspace_id',
       'source','resource','request_kind','title','scope_reference','priority',
       'desired_start','desired_end','financial_proposal_id','financial_proposal_version',
       'requested_at','current_authority_recheck_required'
     ] <> '{}'::jsonb
     or jsonb_typeof(p_request->'source') is distinct from 'object'
     or jsonb_typeof(p_request->'resource') is distinct from 'object'
     or not (p_request->'source' ?& array[
       'source_domain','source_entity_type','source_entity_id','source_version','source_reference'
     ])
     or (p_request->'source') - array[
       'source_domain','source_entity_type','source_entity_id','source_version','source_reference'
     ] <> '{}'::jsonb
     or not (p_request->'resource' ?& array[
       'contract_version','context_id','workspace_id','resource_type','resource_id',
       'resource_version','permission_code','purpose'
     ])
     or (p_request->'resource') - array[
       'contract_version','context_id','workspace_id','resource_type','resource_id',
       'resource_version','permission_code','purpose'
     ] <> '{}'::jsonb
     or jsonb_typeof(p_request->'request_id') is distinct from 'string'
     or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string'
     or jsonb_typeof(p_request->'context_id') is distinct from 'string'
     or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
     or jsonb_typeof(p_request->'request_kind') is distinct from 'string'
     or jsonb_typeof(p_request->'title') is distinct from 'string'
     or jsonb_typeof(p_request->'scope_reference') is distinct from 'string'
     or jsonb_typeof(p_request->'priority') is distinct from 'string'
     or jsonb_typeof(p_request->'requested_at') is distinct from 'string'
     or p_request->'current_authority_recheck_required' is distinct from 'true'::jsonb
     or jsonb_typeof(p_request->'source'->'source_domain') is distinct from 'string'
     or jsonb_typeof(p_request->'source'->'source_entity_type') is distinct from 'string'
     or jsonb_typeof(p_request->'source'->'source_entity_id') is distinct from 'string'
     or jsonb_typeof(p_request->'source'->'source_version') is distinct from 'number'
     or jsonb_typeof(p_request->'source'->'source_reference') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'contract_version') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'context_id') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'workspace_id') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'resource_type') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'resource_id') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'resource_version') is distinct from 'number'
     or jsonb_typeof(p_request->'resource'->'permission_code') is distinct from 'string'
     or jsonb_typeof(p_request->'resource'->'purpose') is distinct from 'string'
     or jsonb_typeof(p_request->'desired_start') not in ('string','null')
     or jsonb_typeof(p_request->'desired_end') not in ('string','null')
     or jsonb_typeof(p_request->'financial_proposal_id') not in ('string','null')
     or jsonb_typeof(p_request->'financial_proposal_version') not in ('number','null') then
    raise exception 'operations_execution_input_invalid' using errcode = '22023';
  end if;

  begin
    v_context_id := (p_request->>'context_id')::uuid;
    v_workspace_id := (p_request->>'workspace_id')::uuid;
    v_request_id := (p_request->>'request_id')::uuid;
    v_source_id := (p_request->'source'->>'source_entity_id')::uuid;
    v_source_version := (p_request->'source'->>'source_version')::bigint;
    v_resource_context_id := (p_request->'resource'->>'context_id')::uuid;
    v_resource_workspace_id := (p_request->'resource'->>'workspace_id')::uuid;
    v_resource_id := (p_request->'resource'->>'resource_id')::uuid;
    v_resource_version := (p_request->'resource'->>'resource_version')::integer;
    v_desired_start := case when p_request->'desired_start' = 'null'::jsonb then null
      else (p_request->>'desired_start')::timestamptz end;
    v_desired_end := case when p_request->'desired_end' = 'null'::jsonb then null
      else (p_request->>'desired_end')::timestamptz end;
    v_financial_proposal_id := case when p_request->'financial_proposal_id' = 'null'::jsonb then null
      else (p_request->>'financial_proposal_id')::uuid end;
    v_financial_proposal_version := case when p_request->'financial_proposal_version' = 'null'::jsonb then null
      else (p_request->>'financial_proposal_version')::integer end;
    v_requested_at := (p_request->>'requested_at')::timestamptz;
  exception
    when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'operations_execution_input_invalid' using errcode = '22023';
  end;

  v_idempotency_key := p_request->>'idempotency_key';
  v_source_reference := p_request->'source'->>'source_reference';
  v_request_kind := p_request->>'request_kind';
  v_title := p_request->>'title';
  v_scope_reference := p_request->>'scope_reference';
  v_priority := p_request->>'priority';

  if p_request->>'contract_version' <> 'operations-execution-request-receipt.v1'
     or v_request_id is null
     or v_context_id is null
     or v_workspace_id is null
     or v_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or p_request->'source'->>'source_domain' <> 'service'
     or p_request->'source'->>'source_entity_type' <> 'service_request'
     or v_source_id is null
     or v_source_version not between 1 and 9007199254740991
     or v_source_reference <> 'service_catalog.requests:' || v_source_id::text || ':v' || v_source_version::text
     or length(v_source_reference) not between 1 and 240
     or p_request->'resource'->>'contract_version' <> 'canonical-resource-reference.v1'
     or v_resource_context_id is distinct from v_context_id
     or v_resource_workspace_id is distinct from v_workspace_id
     or p_request->'resource'->>'resource_type' <> 'unit'
     or v_resource_id is null
     or v_resource_version <= 0
     or (p_request->'resource'->>'resource_version')::numeric <> v_resource_version
     or (p_request->'source'->>'source_version')::numeric <> v_source_version
     or p_request->'resource'->>'permission_code' <> 'core.units.identity.read'
     or p_request->'resource'->>'purpose' <> 'core.unit_identity.history'
     or v_request_kind not in ('inspect','maintain','repair','install','remove','other')
     or v_title <> btrim(v_title)
     or length(v_title) not between 3 and 200
     or length(v_scope_reference) not between 1 and 240
     or v_priority not in ('low','normal','high','urgent','emergency')
     or (v_desired_end is not null and (v_desired_start is null or v_desired_end <= v_desired_start))
     or ((v_financial_proposal_id is null) <> (v_financial_proposal_version is null))
     or (v_financial_proposal_version is not null and v_financial_proposal_version <= 0) then
    raise exception 'operations_execution_input_invalid' using errcode = '22023';
  end if;

  select * into strict v_service_scope
  from app_private.service_request_authorize_v1(
    v_context_id, v_workspace_id, 'services.orders.read'
  );
  v_tenant_id := v_service_scope.tenant_id;

  if app_private.check_workspace_native_permission_v2(
       v_context_id, v_workspace_id, 'maintenance.work_orders.manage', 'maintenance'
     ) is not true then
    raise exception 'operations_execution_access_denied' using errcode = '42501';
  end if;
  select * into strict v_maintenance_scope
  from maintenance.verify_customer_maintenance_actor(
    v_context_id, 'maintenance.work_orders.manage', false
  );
  if v_maintenance_scope.tenant_id is distinct from v_tenant_id then
    raise exception 'operations_execution_access_denied' using errcode = '42501';
  end if;

  select r.* into v_source
  from service_catalog.requests r
  where r.id = v_source_id
    and r.tenant_id = v_tenant_id
    and r.workspace_id = v_workspace_id
    and r.requester_id = v_actor
    and r.membership_id = v_service_scope.membership_id
  for share;
  if not found then
    raise exception 'operations_execution_source_unavailable' using errcode = '42501';
  end if;
  v_source_current_version := v_source.version;

  perform 1
  from identity.membership_parties mp
  join portfolio.parties p
    on p.id = mp.party_id and p.tenant_id = mp.tenant_id
  where mp.tenant_id = v_source.tenant_id
    and mp.membership_id = v_source.membership_id
    and mp.party_id = v_source.beneficiary_party_id
    and mp.valid_from <= clock_timestamp()
    and (mp.valid_until is null or mp.valid_until > clock_timestamp())
    and p.archived_at is null
  for share of mp, p;
  if not found then
    raise exception 'operations_execution_source_unavailable' using errcode = '42501';
  end if;

  -- Serialize retries only after every current AUTH-01 and source disclosure
  -- gate above has passed. A saved receipt never bypasses a later revoke.
  v_key := 'ops01:service_execution:v1:' || v_workspace_id::text || ':'
    || v_actor::text || ':' || v_idempotency_key;
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'tenant', v_tenant_id, 'actor', v_actor, 'request', p_request
  )::text, 'UTF8')), 'hex');
  insert into platform.idempotency_keys(tenant_id, actor_id, key, request_hash, expires_at)
  values(v_tenant_id, v_actor, v_key, v_hash, clock_timestamp() + interval '7 days')
  on conflict(tenant_id, key) do nothing;
  select * into strict v_idem
  from platform.idempotency_keys
  where tenant_id = v_tenant_id and key = v_key
  for update;
  if v_idem.actor_id is distinct from v_actor
     or v_idem.request_hash is distinct from v_hash
     or v_idem.expires_at <= clock_timestamp() then
    raise exception 'operations_execution_idempotency_conflict' using errcode = '23505';
  end if;

  if v_source_current_version = v_source_version then
    perform app_private.service_request_subject_context_v1(
      v_context_id, v_workspace_id, v_source_id, v_source_version
    );
  else
    v_rejection_reason := 'source_version_stale';
  end if;

  if v_rejection_reason is null then
    v_reference := customer_api.resolve_canonical_resource_reference_v1(
      v_context_id,
      v_workspace_id,
      'unit',
      v_resource_id,
      v_resource_version,
      'core.units.identity.read',
      'core.unit_identity.history'
    );
    if v_reference->>'reference_status' = 'stale' then
      v_rejection_reason := 'canonical_unit_version_stale';
    elsif v_reference->>'reference_status' is distinct from 'verified' then
      v_rejection_reason := 'canonical_unit_unavailable';
    end if;
  end if;

  if v_rejection_reason is null and v_financial_proposal_id is not null then
    v_rejection_reason := 'fin01_proposal_adapter_unavailable';
  end if;

  if v_rejection_reason is null then
    select u.tenant_id, b.property_id, b.id
    into v_resource_tenant_id, v_property_id, v_building_id
    from portfolio.units u
    join portfolio.buildings b
      on b.id = u.building_id and b.tenant_id = u.tenant_id
    where u.id = v_resource_id
      and u.tenant_id = v_tenant_id
    for share of u, b;
    if not found
       or v_resource_tenant_id is distinct from v_tenant_id
       or not coalesce(maintenance.customer_maintenance_scope_matches(
         v_maintenance_scope.scope_type::text,
         v_maintenance_scope.property_id,
         v_maintenance_scope.building_id,
         v_maintenance_scope.unit_id,
         v_property_id,
         v_building_id,
         v_resource_id
       ), false)
       or app_private.check_workspace_native_permission_v2(
         v_context_id, v_workspace_id, 'maintenance.work_orders.manage', 'maintenance'
       ) is not true then
      raise exception 'operations_execution_access_denied' using errcode = '42501';
    end if;
  end if;

  if v_idem.response_ref is not null then
    -- All current source, beneficiary, AUTH-01, resource and Operations gates
    -- were repeated before this replay is returned. An earlier acceptance is
    -- never replayed after its source version becomes stale.
    if v_idem.response_ref->>'request_status' = 'accepted'
       and v_rejection_reason is not null then
      raise exception 'operations_execution_source_or_resource_stale'
        using errcode = '40001';
    end if;
    return v_idem.response_ref;
  end if;

  if v_rejection_reason is not null then
    insert into maintenance.execution_request_receipts(
      id, tenant_id, workspace_id, context_id, request_id, idempotency_key,
      request_hash, source_domain, source_entity_type, source_entity_id,
      source_version, source_reference, resource_type, resource_id,
      resource_version, request_kind, title, scope_reference, priority,
      desired_start, desired_end, financial_proposal_id,
      financial_proposal_version, request_status, reason_codes, work_order_id,
      requested_by, requested_at
    ) values (
      v_receipt_id, v_tenant_id, v_workspace_id, v_context_id, v_request_id,
      v_idempotency_key, v_hash, 'service', 'service_request', v_source_id,
      v_source_version, v_source_reference, 'unit', v_resource_id,
      v_resource_version, v_request_kind, v_title, v_scope_reference,
      v_priority::maintenance.priority, v_desired_start, v_desired_end,
      v_financial_proposal_id, v_financial_proposal_version, 'rejected',
      jsonb_build_array(v_rejection_reason), null, v_actor, v_requested_at
    );
    v_response := jsonb_build_object(
      'contract_version', 'operations-execution-request-receipt.v1',
      'request_id', v_request_id,
      'idempotency_key', v_idempotency_key,
      'workspace_id', v_workspace_id,
      'source', p_request->'source',
      'receipt_id', v_receipt_id,
      'receipt_version', 1,
      'recorded_at', statement_timestamp(),
      'action_authorization', 'not_evaluated',
      'request_status', 'rejected',
      'work_order_id', null,
      'work_order_version', null,
      'work_order_status', null,
      'status_reference', null,
      'financial_receipt_ids', '[]'::jsonb,
      'reason_codes', jsonb_build_array(v_rejection_reason)
    );
  else
    v_work_order := maintenance.create_work_order(
      v_context_id,
      v_property_id,
      v_building_id,
      v_resource_id,
      null,
      null,
      v_title,
      'OPS-01 ' || v_request_kind || ' from ' || v_source_reference
        || '; scope=' || v_scope_reference,
      v_priority,
      v_desired_start,
      v_desired_end,
      null,
      null,
      'RON',
      null
    );
    v_work_order_id := (v_work_order->>'id')::uuid;
    update maintenance.work_orders
    set metadata = metadata || jsonb_build_object(
      'ops01_receipt_id', v_receipt_id,
      'source_domain', 'service',
      'source_entity_type', 'service_request',
      'source_entity_id', v_source_id,
      'source_version', v_source_version
    )
    where id = v_work_order_id and tenant_id = v_tenant_id;

    insert into maintenance.execution_request_receipts(
      id, tenant_id, workspace_id, context_id, request_id, idempotency_key,
      request_hash, source_domain, source_entity_type, source_entity_id,
      source_version, source_reference, resource_type, resource_id,
      resource_version, request_kind, title, scope_reference, priority,
      desired_start, desired_end, financial_proposal_id,
      financial_proposal_version, request_status, reason_codes, work_order_id,
      requested_by, requested_at
    ) values (
      v_receipt_id, v_tenant_id, v_workspace_id, v_context_id, v_request_id,
      v_idempotency_key, v_hash, 'service', 'service_request', v_source_id,
      v_source_version, v_source_reference, 'unit', v_resource_id,
      v_resource_version, v_request_kind, v_title, v_scope_reference,
      v_priority::maintenance.priority, v_desired_start, v_desired_end,
      null, null, 'accepted',
      jsonb_build_array('operations_execution_request_accepted'),
      v_work_order_id, v_actor, v_requested_at
    );
    v_response := jsonb_build_object(
      'contract_version', 'operations-execution-request-receipt.v1',
      'request_id', v_request_id,
      'idempotency_key', v_idempotency_key,
      'workspace_id', v_workspace_id,
      'source', p_request->'source',
      'receipt_id', v_receipt_id,
      'receipt_version', 1,
      'recorded_at', statement_timestamp(),
      'action_authorization', 'not_evaluated',
      'request_status', 'accepted',
      'work_order_id', v_work_order_id,
      'work_order_version', 1,
      'work_order_status', 'draft',
      'status_reference', 'maintenance.work_orders:' || v_work_order_id::text || ':v1:draft',
      'financial_receipt_ids', '[]'::jsonb,
      'reason_codes', jsonb_build_array('operations_execution_request_accepted')
    );
  end if;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    request_id, after_snapshot, reason
  ) values (
    v_tenant_id,
    v_actor,
    v_maintenance_scope.role_code,
    'operations.execution_request.' || (v_response->>'request_status'),
    'maintenance.execution_request_receipt',
    v_receipt_id,
    v_request_id,
    v_response,
    'OPS-01 service request execution adapter'
  );
  insert into platform.outbox_events(
    tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload
  ) values (
    v_tenant_id,
    'operations_execution_request',
    v_receipt_id,
    1,
    'operations.execution_request.' || (v_response->>'request_status'),
    v_response
  );
  update platform.idempotency_keys
  set response_ref = v_response,
      status_code = case when v_response->>'request_status' = 'accepted' then 201 else 200 end
  where tenant_id = v_tenant_id and key = v_key;
  return v_response;
end;
$$;

revoke all on function customer_api.request_service_execution_v1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function customer_api.request_service_execution_v1(jsonb)
  to authenticated;

comment on function customer_api.request_service_execution_v1(jsonb) is
  'OPS-01 minimal SERVICE consumer: current AUTH-01 + DW-02 Unit + existing Work Order. Replays recheck current authority; Finance references remain rejected until FIN-01 is connected.';

commit;
