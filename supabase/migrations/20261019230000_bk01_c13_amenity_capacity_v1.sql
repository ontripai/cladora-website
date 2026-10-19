begin;

create schema if not exists booking;
revoke all on schema booking from public, anon, authenticated, service_role;

insert into identity.permissions(code,resource,action,description) values
 ('booking.capacity.read','booking.capacity','read','Read authorized shared-capacity policies and own holds'),
 ('booking.capacity.request','booking.capacity','request','Request, confirm, reschedule, or release an authorized shared-capacity hold')
on conflict(code) do nothing;

insert into platform.module_definitions
 (code,version,name,labels_json,description,category,is_active,lifecycle_status,
  sensitivity_level,requires_aal2,entitlement_key,published_at)
values('booking',1,'Shared amenities booking',
 '{"ro":"Rezervări facilități","en":"Amenity reservations","fa":"رزرو مشاعات"}',
 'BK-01 shared capacity/time with C13 as its first bounded consumer',
 'operations',true,'published','standard',false,'module.booking',statement_timestamp())
on conflict(code,version) do nothing;

insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,case when p.action='read' then 'read' else 'execute' end,
 true,false,false,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='booking' and m.version=1 and p.code in('booking.capacity.read','booking.capacity.request')
on conflict(module_definition_id,permission_id,binding_version) do nothing;

insert into platform.module_property_profile_compatibilities
 (module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,
 case when p.code in('standalone_parking','shared_facility','residential_complex',
   'gated_villa_community','retail_centre','managed_township') then 'compatible' else 'review_required' end,
 'C13 shared-space reservation requires an explicitly configured canonical Unit policy'
from platform.module_definitions m cross join platform.property_profiles p
where m.code='booking' and m.version=1 and p.version=1
on conflict(module_definition_id,property_profile_id) do nothing;

insert into platform.module_operating_model_compatibilities
 (module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','BK01 remains authority-gated for every operating model'
from platform.module_definitions m cross join platform.operating_models o
where m.code='booking' and m.version=1 and o.version=1
on conflict(module_definition_id,operating_model_id) do nothing;

create table booking.capacity_policies(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 version integer not null default 1 check(version>0),
 labels jsonb not null check(jsonb_typeof(labels)='object' and labels ?& array['ro','en','fa']),
 timezone text not null check(timezone ~ '^[A-Za-z_+-]+(/[A-Za-z0-9_.+-]+)+$'),
 capacity_unit text not null check(capacity_unit ~ '^[a-z0-9_.:-]{3,160}$'),
 total_capacity integer not null check(total_capacity between 1 and 1000000),
 hold_ttl_seconds integer not null check(hold_ttl_seconds between 30 and 86400),
 conflict_mode text not null check(conflict_mode in('exclusive','counted_capacity')),
 resource_type text not null default 'unit' check(resource_type='unit'),
 resource_id uuid not null references portfolio.units(id) on delete restrict,
 resource_version integer not null check(resource_version>0),
 status text not null default 'active' check(status in('active','suspended','retired')),
 valid_from timestamptz not null,
 valid_until timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 check(valid_until is null or valid_until>valid_from),
 unique(tenant_id,workspace_id,id),
 unique(workspace_id,resource_type,resource_id,version)
);
create index booking_capacity_policy_workspace_idx
 on booking.capacity_policies(tenant_id,workspace_id,status,valid_from,valid_until);
create index booking_capacity_policy_resource_idx on booking.capacity_policies(resource_id);

create table booking.capacity_holds(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 policy_id uuid not null,
 policy_version integer not null check(policy_version>0),
 source_domain text not null check(source_domain='community'),
 source_entity_type text not null check(source_entity_type='amenity_reservation'),
 source_entity_id uuid not null,
 source_version integer not null check(source_version=1),
 resource_type text not null check(resource_type='unit'),
 resource_id uuid not null references portfolio.units(id) on delete restrict,
 resource_version integer not null check(resource_version>0),
 effective_start timestamptz not null,
 effective_end timestamptz not null,
 allocated_capacity integer not null check(allocated_capacity>0),
 state text not null check(state in('held','confirmed','released','expired')),
 version integer not null default 1 check(version>0),
 expires_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 check(effective_end>effective_start),
 check((state='held')=(expires_at is not null)),
 foreign key(tenant_id,workspace_id,policy_id)
   references booking.capacity_policies(tenant_id,workspace_id,id) on delete restrict
);
create index booking_capacity_hold_conflict_idx
 on booking.capacity_holds(policy_id,effective_start,effective_end,state,expires_at);
create index booking_capacity_hold_actor_idx
 on booking.capacity_holds(tenant_id,workspace_id,created_by,updated_at desc);
create unique index booking_capacity_hold_source_idx
 on booking.capacity_holds(tenant_id,workspace_id,source_domain,source_entity_type,source_entity_id,source_version);

create table booking.request_receipts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 context_id uuid not null references identity.context_grants(id) on delete restrict,
 request_id uuid not null,
 idempotency_key text not null check(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 action text not null check(action in('request_hold','confirm_hold','reschedule','release')),
 hold_id uuid references booking.capacity_holds(id) on delete restrict,
 requested_by uuid not null references auth.users(id) on delete restrict,
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 recorded_at timestamptz not null default statement_timestamp(),
 unique(tenant_id,request_id),
 unique(tenant_id,requested_by,idempotency_key)
);
create index booking_request_receipt_workspace_idx
 on booking.request_receipts(tenant_id,workspace_id,recorded_at desc,id);
create index booking_request_receipt_context_idx on booking.request_receipts(context_id);
create index booking_request_receipt_hold_idx on booking.request_receipts(hold_id);

alter table booking.capacity_policies enable row level security;
alter table booking.capacity_holds enable row level security;
alter table booking.request_receipts enable row level security;
revoke all on all tables in schema booking from public,anon,authenticated,service_role;

create function booking.guard_request_receipt_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception 'booking_request_receipt_immutable' using errcode='42501';
end;
$$;
create trigger booking_request_receipt_immutable before update or delete
 on booking.request_receipts for each row execute function booking.guard_request_receipt_v1();
revoke all on function booking.guard_request_receipt_v1() from public,anon,authenticated,service_role;

create function customer_api.command_amenity_capacity_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare
 v_actor uuid:=auth.uid(); v_context uuid; v_workspace uuid; v_request_id uuid;
 v_action text; v_key_input text; v_policy_id uuid; v_expected_policy integer;
 v_hold_id uuid; v_expected_hold integer;
 v_start timestamptz; v_end timestamptz; v_capacity integer; v_reason text;
 v_source_id uuid; v_source_version integer; v_resource_id uuid; v_resource_version integer;
 v_tenant uuid; v_key text; v_hash text; v_idem platform.idempotency_keys%rowtype;
 v_policy booking.capacity_policies%rowtype; v_hold booking.capacity_holds%rowtype;
 v_reference jsonb; v_receipt_id uuid:=gen_random_uuid(); v_receipt jsonb;
 v_state text; v_conflicts jsonb:='[]'::jsonb; v_allocated integer;
 v_expires timestamptz;
begin
 if v_actor is null then raise exception 'booking_capacity_access_denied' using errcode='42501'; end if;
 if jsonb_typeof(p_request) is distinct from 'object'
    or not(p_request ?& array['contract_version','request_id','idempotency_key','context_id',
      'workspace_id','source','policy_id','expected_policy_version','requested_at','action']) then
  raise exception 'booking_capacity_input_invalid' using errcode='22023';
 end if;
 begin
  v_context:=(p_request->>'context_id')::uuid;
  v_workspace:=(p_request->>'workspace_id')::uuid;
  v_request_id:=(p_request->>'request_id')::uuid;
  v_policy_id:=(p_request->>'policy_id')::uuid;
  v_expected_policy:=(p_request->>'expected_policy_version')::integer;
  perform (p_request->>'requested_at')::timestamptz;
  v_source_id:=(p_request->'source'->>'consumer_entity_id')::uuid;
  v_source_version:=(p_request->'source'->>'consumer_version')::integer;
 exception when others then
  raise exception 'booking_capacity_input_invalid' using errcode='22023';
 end;
 v_action:=p_request->>'action'; v_key_input:=p_request->>'idempotency_key';
 if p_request->>'contract_version'<>'shared-capacity-allocation-receipt.v1'
    or v_action not in('request_hold','confirm_hold','reschedule','release')
    or v_context is null or v_workspace is null or v_request_id is null or v_policy_id is null
    or v_expected_policy is null or v_expected_policy<=0
    or v_key_input!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or jsonb_typeof(p_request->'source') is distinct from 'object'
    or (p_request->'source')-array['consumer_domain','consumer_entity_type','consumer_entity_id','consumer_version']<>'{}'::jsonb
    or p_request->'source'->>'consumer_domain'<>'community'
    or p_request->'source'->>'consumer_entity_type'<>'amenity_reservation'
    or v_source_id is null or v_source_version<>1 then
  raise exception 'booking_capacity_input_invalid' using errcode='22023';
 end if;
 if (v_action='request_hold' and p_request-array['contract_version','request_id','idempotency_key',
      'context_id','workspace_id','source','policy_id','expected_policy_version','requested_at','action','window']<>'{}'::jsonb)
    or (v_action='confirm_hold' and p_request-array['contract_version','request_id','idempotency_key',
      'context_id','workspace_id','source','policy_id','expected_policy_version','requested_at','action','hold_id','expected_hold_version']<>'{}'::jsonb)
    or (v_action='reschedule' and p_request-array['contract_version','request_id','idempotency_key',
      'context_id','workspace_id','source','policy_id','expected_policy_version','requested_at','action','hold_id','expected_hold_version','window']<>'{}'::jsonb)
    or (v_action='release' and p_request-array['contract_version','request_id','idempotency_key',
      'context_id','workspace_id','source','policy_id','expected_policy_version','requested_at','action','hold_id','expected_hold_version','reason_code']<>'{}'::jsonb) then
  raise exception 'booking_capacity_input_invalid' using errcode='22023';
 end if;
 if v_action in('request_hold','reschedule') then
  if jsonb_typeof(p_request->'window') is distinct from 'object'
     or (p_request->'window')-array['requested_start','requested_end','requested_capacity','resources']<>'{}'::jsonb
     or jsonb_typeof(p_request->'window'->'resources') is distinct from 'array'
     or jsonb_array_length(p_request->'window'->'resources')<>1
     or jsonb_typeof(p_request->'window'->'resources'->0) is distinct from 'object'
     or (p_request->'window'->'resources'->0)-array['contract_version','context_id','workspace_id',
       'resource_type','resource_id','resource_version','permission_code','purpose']<>'{}'::jsonb then
   raise exception 'booking_capacity_input_invalid' using errcode='22023';
  end if;
  begin
   v_start:=(p_request->'window'->>'requested_start')::timestamptz;
   v_end:=(p_request->'window'->>'requested_end')::timestamptz;
   v_capacity:=(p_request->'window'->>'requested_capacity')::integer;
   v_resource_id:=(p_request->'window'->'resources'->0->>'resource_id')::uuid;
   v_resource_version:=(p_request->'window'->'resources'->0->>'resource_version')::integer;
  exception when others then
   raise exception 'booking_capacity_input_invalid' using errcode='22023';
  end;
  if v_start is null or v_end<=v_start or v_capacity<=0
     or p_request->'window'->'resources'->0->>'contract_version'<>'canonical-resource-reference.v1'
     or (p_request->'window'->'resources'->0->>'context_id')::uuid is distinct from v_context
     or (p_request->'window'->'resources'->0->>'workspace_id')::uuid is distinct from v_workspace
     or p_request->'window'->'resources'->0->>'resource_type'<>'unit'
     or p_request->'window'->'resources'->0->>'permission_code'<>'core.units.identity.read'
     or p_request->'window'->'resources'->0->>'purpose'<>'core.unit_identity.history' then
   raise exception 'booking_capacity_input_invalid' using errcode='22023';
  end if;
 end if;
 if v_action<>'request_hold' then
  begin v_hold_id:=(p_request->>'hold_id')::uuid; v_expected_hold:=(p_request->>'expected_hold_version')::integer;
  exception when others then raise exception 'booking_capacity_input_invalid' using errcode='22023'; end;
  if v_hold_id is null or v_expected_hold<=0 then raise exception 'booking_capacity_input_invalid' using errcode='22023'; end if;
 end if;
 if v_action='release' then
  v_reason:=p_request->>'reason_code';
  if v_reason is null or v_reason!~'^[a-z0-9_.:-]{3,160}$' then
   raise exception 'booking_capacity_input_invalid' using errcode='22023';
  end if;
 end if;

 select tenant_id into strict v_tenant
 from app_private.resolve_workspace_native_context_v2(v_context,v_workspace);
 if app_private.check_workspace_native_permission_v2(
      v_context,v_workspace,'booking.capacity.request','booking') is not true then
  raise exception 'booking_capacity_access_denied' using errcode='42501';
 end if;
 select * into v_policy from booking.capacity_policies
 where id=v_policy_id and tenant_id=v_tenant and workspace_id=v_workspace for update;
 if not found then raise exception 'booking_capacity_access_denied' using errcode='42501'; end if;

 -- A reached expiry is effective before conflict evaluation even without a worker.
 update booking.capacity_holds set state='expired',version=version+1,expires_at=null,
   updated_at=statement_timestamp()
 where policy_id=v_policy.id and tenant_id=v_tenant and workspace_id=v_workspace
   and state='held' and expires_at<=statement_timestamp();

 if v_action<>'request_hold' then
  select * into v_hold from booking.capacity_holds where id=v_hold_id and policy_id=v_policy.id
    and tenant_id=v_tenant and workspace_id=v_workspace for update;
  if not found or v_hold.created_by is distinct from v_actor
     or v_hold.source_entity_id is distinct from v_source_id
     or v_hold.source_version is distinct from v_source_version then
   raise exception 'booking_capacity_access_denied' using errcode='42501';
  end if;
  v_resource_id:=v_hold.resource_id; v_resource_version:=v_hold.resource_version;
 end if;
 v_reference:=customer_api.resolve_canonical_resource_reference_v1(
   v_context,v_workspace,'unit',v_resource_id,v_resource_version,
   'core.units.identity.read','core.unit_identity.history');
 if v_reference->>'reference_status' is distinct from 'verified'
    or v_policy.resource_id is distinct from v_resource_id
    or v_policy.resource_version is distinct from v_resource_version then
  raise exception 'booking_capacity_resource_unavailable' using errcode='40001';
 end if;

 v_key:='bk01:c13:v1:'||v_workspace::text||':'||v_actor::text||':'||v_key_input;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys
 where tenant_id=v_tenant and key=v_key for update;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash is distinct from v_hash
    or v_idem.expires_at<=clock_timestamp() then
  raise exception 'booking_capacity_idempotency_conflict' using errcode='23505';
 end if;
 -- A saved outcome cannot bypass current AUTH01, policy, or canonical-resource state.
 if v_idem.response_ref is not null then return v_idem.response_ref||jsonb_build_object('replayed',true); end if;

 if v_policy.version<>v_expected_policy or v_policy.status<>'active'
    or v_policy.valid_from>statement_timestamp()
    or (v_policy.valid_until is not null and v_policy.valid_until<=statement_timestamp()) then
  v_state:='stale';
 elsif v_action<>'request_hold' and v_hold.version<>v_expected_hold then
  v_state:='stale';
 elsif v_action='confirm_hold' and v_hold.state<>'held' then
  v_state:='denied';
 elsif v_action='release' and v_hold.state not in('held','confirmed') then
  v_state:='denied';
 elsif v_action='reschedule' and v_hold.state not in('held','confirmed') then
  v_state:='denied';
 else
  v_state:='verified';
 end if;

 if v_state='verified' and v_action in('request_hold','reschedule') then
  select coalesce(sum(h.allocated_capacity),0)::integer,
    coalesce(jsonb_agg(jsonb_build_object('resource_type','unit','resource_id',h.resource_id,
      'conflict_start',h.effective_start,'conflict_end',h.effective_end,
      'conflict_disclosure','interval_only') order by h.effective_start,h.id),'[]'::jsonb)
  into v_allocated,v_conflicts
  from booking.capacity_holds h where h.policy_id=v_policy.id
    and h.id is distinct from v_hold_id and h.state in('held','confirmed')
    and (h.state='confirmed' or h.expires_at>statement_timestamp())
    and h.effective_start<v_end and h.effective_end>v_start;
  if (v_policy.conflict_mode='exclusive' and v_allocated>0)
     or (v_policy.conflict_mode='counted_capacity' and v_allocated+v_capacity>v_policy.total_capacity)
     or v_capacity>v_policy.total_capacity then v_state:='denied'; end if;
 end if;

 if v_state='verified' then
  if v_action='request_hold' then
   v_hold_id:=gen_random_uuid(); v_expires:=statement_timestamp()+make_interval(secs=>v_policy.hold_ttl_seconds);
   insert into booking.capacity_holds(id,tenant_id,workspace_id,policy_id,policy_version,
    source_domain,source_entity_type,source_entity_id,source_version,resource_type,resource_id,
    resource_version,effective_start,effective_end,allocated_capacity,state,version,expires_at,created_by)
   values(v_hold_id,v_tenant,v_workspace,v_policy.id,v_policy.version,'community','amenity_reservation',
    v_source_id,1,'unit',v_resource_id,v_resource_version,v_start,v_end,v_capacity,'held',1,v_expires,v_actor)
   returning * into v_hold;
  elsif v_action='confirm_hold' then
   update booking.capacity_holds set state='confirmed',version=version+1,expires_at=null,
    updated_at=statement_timestamp() where id=v_hold.id returning * into v_hold;
  elsif v_action='release' then
   update booking.capacity_holds set state='released',version=version+1,expires_at=null,
    updated_at=statement_timestamp() where id=v_hold.id returning * into v_hold;
  else
   update booking.capacity_holds set effective_start=v_start,effective_end=v_end,
    allocated_capacity=v_capacity,version=version+1,
    expires_at=case when state='held' then statement_timestamp()+make_interval(secs=>v_policy.hold_ttl_seconds) else null end,
    updated_at=statement_timestamp() where id=v_hold.id returning * into v_hold;
  end if;
  v_receipt:=jsonb_build_object('contract_version','shared-capacity-allocation-receipt.v1',
   'receipt_id',v_receipt_id,'receipt_version',1,'request_id',v_request_id,'action',v_action,
   'workspace_id',v_workspace,'source',p_request->'source','policy_id',v_policy.id,
   'policy_version',v_policy.version,'evaluated_at',statement_timestamp(),
   'current_authority_recheck_required',true,'replayed',false,'decision_status','verified',
   'hold_id',v_hold.id,'hold_version',v_hold.version,'hold_state',v_hold.state,
   'effective_start',v_hold.effective_start,'effective_end',v_hold.effective_end,
   'allocated_capacity',v_hold.allocated_capacity,
   'resources',jsonb_build_array(jsonb_build_object('resource_type','unit','resource_id',v_hold.resource_id,
     'resource_version',v_hold.resource_version)),
   'expires_at',v_hold.expires_at,'conflicts','[]'::jsonb,
   'reason_codes',jsonb_build_array('capacity_allocation_verified'));
 else
  v_receipt:=jsonb_build_object('contract_version','shared-capacity-allocation-receipt.v1',
   'receipt_id',v_receipt_id,'receipt_version',1,'request_id',v_request_id,'action',v_action,
   'workspace_id',v_workspace,'source',p_request->'source','policy_id',v_policy.id,
   'policy_version',v_policy.version,'evaluated_at',statement_timestamp(),
   'current_authority_recheck_required',true,'replayed',false,'decision_status',v_state,
   'hold_id',null,'hold_version',null,'hold_state',null,'effective_start',null,'effective_end',null,
   'allocated_capacity',null,
   'resources',case when v_state='denied' then jsonb_build_array(jsonb_build_object(
     'resource_type','unit','resource_id',v_resource_id,'resource_version',v_resource_version)) else '[]'::jsonb end,
   'expires_at',null,'conflicts',case when v_state='denied' then v_conflicts else '[]'::jsonb end,
   'reason_codes',jsonb_build_array(case when v_state='stale' then 'capacity_state_stale' else 'capacity_unavailable' end));
 end if;
 insert into booking.request_receipts(id,tenant_id,workspace_id,context_id,request_id,
  idempotency_key,request_hash,action,hold_id,requested_by,receipt)
 values(v_receipt_id,v_tenant,v_workspace,v_context,v_request_id,v_key_input,v_hash,v_action,
  case when v_state='verified' then v_hold.id else null end,v_actor,v_receipt);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot,reason)
 values(v_tenant,v_actor,'booking.capacity.'||v_state,'booking.request_receipt',v_receipt_id,
  v_request_id,v_receipt,'BK01/C13 shared amenity capacity');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'booking_capacity_request',v_receipt_id,1,'booking.capacity.'||v_state,v_receipt);
 update platform.idempotency_keys set response_ref=v_receipt,status_code=200
 where tenant_id=v_tenant and key=v_key;
 return v_receipt;
end;
$$;

create function customer_api.read_amenity_capacity_v1(p_context_id uuid,p_workspace_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$
declare v_actor uuid:=auth.uid(); v_tenant uuid; v_policies jsonb; v_holds jsonb;
begin
 if v_actor is null then raise exception 'booking_capacity_access_denied' using errcode='42501'; end if;
 select tenant_id into strict v_tenant
 from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'booking.capacity.read','booking') is not true then
  raise exception 'booking_capacity_access_denied' using errcode='42501';
 end if;
 update booking.capacity_holds h set state='expired',version=h.version+1,expires_at=null,
  updated_at=statement_timestamp()
 where h.tenant_id=v_tenant and h.workspace_id=p_workspace_id and h.state='held'
  and h.expires_at<=statement_timestamp();
 select coalesce(jsonb_agg(x.item order by x.label,x.id),'[]'::jsonb) into v_policies
 from(
  select p.id,coalesce(p.labels->>'en',p.id::text) label,jsonb_build_object(
   'policy_id',p.id,'policy_version',p.version,'labels',p.labels,'timezone',p.timezone,
   'capacity_unit',p.capacity_unit,'total_capacity',p.total_capacity,
   'hold_ttl_seconds',p.hold_ttl_seconds,'conflict_mode',p.conflict_mode,
   'resource',r.reference) item
  from booking.capacity_policies p
  cross join lateral (select customer_api.resolve_canonical_resource_reference_v1(
    p_context_id,p_workspace_id,'unit',p.resource_id,p.resource_version,
    'core.units.identity.read','core.unit_identity.history') reference) r
  where p.tenant_id=v_tenant and p.workspace_id=p_workspace_id and p.status='active'
    and p.valid_from<=statement_timestamp() and(p.valid_until is null or p.valid_until>statement_timestamp())
    and r.reference->>'reference_status'='verified'
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('hold_id',h.id,'hold_version',h.version,
  'policy_id',h.policy_id,'source_entity_id',h.source_entity_id,'effective_start',h.effective_start,
  'effective_end',h.effective_end,'allocated_capacity',h.allocated_capacity,'state',h.state,
  'expires_at',h.expires_at) order by h.updated_at desc,h.id),'[]'::jsonb) into v_holds
 from booking.capacity_holds h where h.tenant_id=v_tenant and h.workspace_id=p_workspace_id
  and h.created_by=v_actor;
 return jsonb_build_object('contract_version','c13-amenity-capacity.v1','workspace_id',p_workspace_id,
  'policies',v_policies,'my_holds',v_holds,'read_only_projection',true);
end;
$$;

revoke all on function customer_api.command_amenity_capacity_v1(jsonb),
 customer_api.read_amenity_capacity_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.command_amenity_capacity_v1(jsonb),
 customer_api.read_amenity_capacity_v1(uuid,uuid) to authenticated;

comment on function customer_api.command_amenity_capacity_v1(jsonb) is
 'BK01 atomic hold lifecycle with C13 amenity reservation as the first consumer; AUTH01 and DW02 are rechecked before replay.';
comment on function customer_api.read_amenity_capacity_v1(uuid,uuid) is
 'C13 projection of current BK01 policies and caller-owned holds; no competing party/source disclosure.';

commit;
