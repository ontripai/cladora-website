-- CE-011 operational connection proposal. REVIEW ONLY: not a migration and not executed.
-- Convert with `supabase migration new` only after approval.
begin;

create schema if not exists community;

insert into identity.permissions(code,resource,action,description) values
 ('events.event.read','events.event','read','Read events allowed by the current audience policy'),
 ('events.event.publish','events.event','publish','Create and publish a free single-occurrence event'),
 ('events.event.cancel','events.event','cancel','Cancel an event while preserving history'),
 ('events.interest.manage_self','events.interest','manage_self','Register or withdraw own represented participant interest'),
 ('events.attendance.record','events.attendance','record','Record observed attendance for an assigned occurrence'),
 ('events.attendance.correct','events.attendance','correct','Correct versioned attendance with a reason')
on conflict(code) do nothing;

insert into platform.module_definitions(code,version,name,labels_json,description,category,lifecycle_status,entitlement_key,published_at)
values('community_events',1,'Community Events','{"ro":"Evenimente","en":"Events","fa":"رویدادها"}',
 'Free single-occurrence events; no Booking capacity, resource allocation, payment or order','services','published','module.community_events',statement_timestamp())
on conflict(code,version) do nothing;

insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2)
select m.id,p.id,case when p.action='read' then 'read' else 'manage' end,false,false
from platform.module_definitions m cross join identity.permissions p
where m.code='community_events' and m.version=1 and p.code in(
 'events.event.read','events.event.publish','events.event.cancel','events.interest.manage_self','events.attendance.record','events.attendance.correct')
on conflict(module_definition_id,permission_id,binding_version) do nothing;

insert into platform.module_property_profile_compatibilities(module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','CE-011 is independently available for every property profile'
from platform.module_definitions m cross join platform.property_profiles p
where m.code='community_events' and m.version=1
on conflict(module_definition_id,property_profile_id) do nothing;

insert into platform.module_operating_model_compatibilities(module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','CE-011 is independently available for every operating model'
from platform.module_definitions m cross join platform.operating_models o
where m.code='community_events' and m.version=1
on conflict(module_definition_id,operating_model_id) do nothing;

do $$begin
 if not exists(select 1 from platform.module_definitions where code='community_events' and version=1 and entitlement_key='module.community_events' and lifecycle_status='published')
  or(select count(*) from identity.permissions where code in('events.event.read','events.event.publish','events.event.cancel','events.interest.manage_self','events.attendance.record','events.attendance.correct'))<>6
 then raise exception 'ce_011_registry_contract_mismatch' using errcode='22023';end if;
end$$;

-- No role template assignment, entitlement grant or module activation is created here.
create table community.events(
 id uuid primary key,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 community_ref uuid,
 title text not null check(title=btrim(title) and length(title) between 2 and 160),
 audience_policy_id uuid not null default gen_random_uuid(),
 audience_policy_version integer not null default 1 check(audience_policy_version>0),
 audience_kind text not null check(audience_kind in('workspace','roles','members')),
 status text not null default 'draft' check(status in('draft','published','cancelled')),
 version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,workspace_id,id)
);

create table community.event_occurrences(
 id uuid primary key,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 event_id uuid not null unique references community.events(id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 timezone text not null check(length(timezone) between 1 and 64),
 check(ends_at>starts_at),
 unique(tenant_id,workspace_id,id),
 unique(tenant_id,workspace_id,event_id,id),
 foreign key(tenant_id,workspace_id,event_id) references community.events(tenant_id,workspace_id,id) on delete restrict
);

create table community.event_audience_roles(
 event_id uuid not null references community.events(id) on delete cascade,
 role_code text not null check(role_code~'^[A-Za-z0-9_.:-]{2,64}$'),
 primary key(event_id,role_code)
);

create table community.event_audience_members(
 event_id uuid not null references community.events(id) on delete cascade,
 membership_id uuid not null references identity.memberships(id) on delete restrict,
 primary key(event_id,membership_id)
);

create table community.event_interests(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 event_id uuid not null references community.events(id) on delete restrict,
 occurrence_id uuid not null references community.event_occurrences(id) on delete restrict,
 membership_id uuid not null references identity.memberships(id) on delete restrict,
 status text not null check(status in('interested','withdrawn')),
 version integer not null check(version>0),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default clock_timestamp(),
 unique(event_id,membership_id),
  unique(tenant_id,workspace_id,id),
  foreign key(tenant_id,workspace_id,event_id) references community.events(tenant_id,workspace_id,id) on delete restrict,
  foreign key(tenant_id,workspace_id,event_id,occurrence_id) references community.event_occurrences(tenant_id,workspace_id,event_id,id) on delete restrict
);

create table community.event_attendance(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 event_id uuid not null references community.events(id) on delete restrict,
 occurrence_id uuid not null references community.event_occurrences(id) on delete restrict,
 membership_id uuid not null references identity.memberships(id) on delete restrict,
 attended boolean not null,
 observed_local timestamp without time zone not null,
 timezone text not null check(length(timezone) between 1 and 64),
 version integer not null check(version>0),
 corrected_after_cancellation boolean not null default false,
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default clock_timestamp(),
 unique(event_id,membership_id),
  unique(tenant_id,workspace_id,id),
  foreign key(tenant_id,workspace_id,event_id) references community.events(tenant_id,workspace_id,id) on delete restrict,
  foreign key(tenant_id,workspace_id,event_id,occurrence_id) references community.event_occurrences(tenant_id,workspace_id,event_id,id) on delete restrict
);

create table community.event_command_receipts(
 request_id uuid primary key,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 context_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 membership_id uuid not null references identity.memberships(id) on delete restrict,
 represented_party_id uuid references portfolio.parties(id) on delete restrict,
 command text not null check(command in('create_event','publish_event','cancel_event','register_interest','withdraw_interest','record_attendance','correct_attendance')),
 canonical_key text not null,
 entity_type text not null,
 entity_id uuid not null,
 result_version integer not null check(result_version>0),
 response_json jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,canonical_key)
);

create index ce_events_workspace_idx on community.events(tenant_id,workspace_id,status,created_at desc,id);
create index ce_interest_member_idx on community.event_interests(tenant_id,workspace_id,membership_id,event_id);
create index ce_attendance_event_idx on community.event_attendance(tenant_id,workspace_id,event_id,membership_id);

create function app_private.ce_receipt_immutable_v1() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'ce_event_receipt_immutable' using errcode='42501';end$$;
create trigger ce_event_receipt_immutable before update or delete on community.event_command_receipts
for each row execute function app_private.ce_receipt_immutable_v1();

do $$declare t text;begin foreach t in array array['events','event_occurrences','event_audience_roles','event_audience_members','event_interests','event_attendance','event_command_receipts'] loop
 execute format('alter table community.%I enable row level security',t);
 execute format('revoke all on community.%I from public,anon,authenticated,service_role',t);
 execute format('create policy %I on community.%I for all to service_role using(true) with check(true)','ce_service_'||t,t);
end loop;end$$;

create function app_private.ce_event_authorize_v1(p_context_id uuid,p_workspace_id uuid,p_permission text)
returns table(tenant_id uuid,membership_id uuid,represented_party_id uuid,role_code text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,p_permission,'community_events') is not true then
  raise exception 'ce_event_access_denied' using errcode='42501';
 end if;
 return query select c.tenant_id,c.membership_id,mp.party_id,c.role_code
 from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id)c
 left join identity.membership_parties mp on mp.membership_id=c.membership_id and mp.tenant_id=c.tenant_id;
end$$;

create function app_private.ce_event_audience_eligible_v1(p_event_id uuid,p_membership_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(
  select 1 from community.events e join identity.memberships m on m.id=p_membership_id and m.tenant_id=e.tenant_id
  where e.id=p_event_id and m.status='active' and m.starts_at<=statement_timestamp() and(m.ends_at is null or m.ends_at>statement_timestamp())
  and exists(select 1 from platform.workspace_member_roles a join platform.workspace_roles wr on wr.id=a.workspace_role_id
   where a.membership_id=m.id and a.customer_workspace_id=e.workspace_id and a.tenant_id=e.tenant_id
   and a.valid_from<=statement_timestamp() and(a.valid_to is null or a.valid_to>statement_timestamp())
   and wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp() and(wr.valid_to is null or wr.valid_to>statement_timestamp()))
  and(e.audience_kind='workspace'
   or(e.audience_kind='members' and exists(select 1 from community.event_audience_members am where am.event_id=e.id and am.membership_id=m.id))
   or(e.audience_kind='roles' and exists(
     select 1 from identity.roles r where r.id=m.role_id and exists(select 1 from community.event_audience_roles ar where ar.event_id=e.id and ar.role_code=r.code)
     union all
     select 1 from platform.workspace_member_roles a join platform.workspace_roles wr on wr.id=a.workspace_role_id
      where a.membership_id=m.id and a.customer_workspace_id=e.workspace_id and a.tenant_id=e.tenant_id
      and a.valid_from<=statement_timestamp() and(a.valid_to is null or a.valid_to>statement_timestamp())
      and wr.lifecycle_status='published' and exists(select 1 from community.event_audience_roles ar where ar.event_id=e.id and ar.role_code=wr.code)
   )))
 )
$$;

create function customer_api.command_ce_event_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
 v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_request_id uuid;v_event_id uuid;v_occurrence_id uuid;v_member_id uuid;
 v_command text;v_permission text;v_client_key text;v_key text;v_hash text;v_reason text;v_scope record;v_event community.events%rowtype;
 v_interest community.event_interests%rowtype;v_attendance community.event_attendance%rowtype;v_receipt community.event_command_receipts%rowtype;v_idem platform.idempotency_keys%rowtype;
 v_expected integer;v_record_expected integer;v_result_version integer;v_entity_type text;v_entity_id uuid;v_before jsonb;v_after jsonb;v_response jsonb;
begin
 if v_actor is null or jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023';end if;
 begin
  v_command:=p_request->>'type';v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
  v_request_id:=(p_request->>'command_id')::uuid;v_event_id:=(p_request->>'event_id')::uuid;v_expected:=(p_request->>'expected_version')::integer;
 exception when others then raise exception 'invalid_request' using errcode='22023';end;
 v_client_key:=p_request->>'idempotency_key';v_reason:=btrim(coalesce(p_request->>'reason',''));
 if v_command not in('create_event','publish_event','cancel_event','register_interest','withdraw_interest','record_attendance','correct_attendance')
  or v_client_key is null or v_client_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or length(v_reason) not between 5 and 500 then raise exception 'invalid_request' using errcode='22023';end if;
 v_permission:=case when v_command in('create_event','publish_event') then 'events.event.publish' when v_command='cancel_event' then 'events.event.cancel'
  when v_command in('register_interest','withdraw_interest') then 'events.interest.manage_self' when v_command='record_attendance' then 'events.attendance.record' else 'events.attendance.correct' end;
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_command<>'create_event' then
  select * into v_event from community.events where id=v_event_id and tenant_id=v_scope.tenant_id and workspace_id=v_workspace for update;
  if not found then raise exception 'ce_event_not_found' using errcode='P0002';end if;
 end if;
 v_member_id:=case when v_command in('register_interest','withdraw_interest') then v_scope.membership_id
  when v_command='record_attendance' then (p_request->>'target_membership_id')::uuid
  when v_command='correct_attendance' then (select membership_id from community.event_attendance where id=(p_request->>'attendance_id')::uuid and event_id=v_event_id)
  else null end;
 if v_member_id is not null and app_private.ce_event_audience_eligible_v1(v_event_id,v_member_id) is not true then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
 v_key:='ce.event.'||v_command||'.v1/'||v_workspace||'/'||v_request_id||'/'||v_client_key;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('schema_version',1,'actor_user_id',v_actor,'context_id',v_context,'workspace_id',v_workspace,'command',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at) values(v_scope.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_scope.tenant_id and key=v_key for update;
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce_event_audience_eligible_v1(v_event_id,v_member_id) is not true then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash or v_idem.expires_at<=clock_timestamp() then raise exception 'ce_event_idempotency_conflict' using errcode='23505';end if;
 if v_idem.response_ref is not null then
  select * into v_receipt from community.event_command_receipts where tenant_id=v_scope.tenant_id and canonical_key=v_key;
  if not found or v_receipt.request_id<>v_request_id or v_receipt.workspace_id<>v_workspace or v_receipt.context_id<>v_context
   or v_receipt.actor_id<>v_actor or v_receipt.membership_id<>v_scope.membership_id
   or v_receipt.represented_party_id is distinct from v_scope.represented_party_id or v_receipt.command<>v_command
  then raise exception 'ce_event_idempotency_conflict' using errcode='23505';end if;
  return v_receipt.response_json||jsonb_build_object('replayed',true);
 end if;

 if v_command='create_event' then
  if v_expected<>0 or exists(select 1 from community.events where id=v_event_id) then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  if not exists(select 1 from pg_timezone_names where name=p_request->>'timezone') then raise exception 'invalid_timezone' using errcode='22023';end if;
  v_occurrence_id:=(p_request->>'occurrence_id')::uuid;
  insert into community.events(id,tenant_id,workspace_id,community_ref,title,audience_kind,created_by)
  values(v_event_id,v_scope.tenant_id,v_workspace,nullif(p_request->>'community_ref','')::uuid,btrim(p_request->>'title'),p_request->'audience'->>'kind',v_actor);
  insert into community.event_occurrences(id,tenant_id,workspace_id,event_id,starts_at,ends_at,timezone)
  values(v_occurrence_id,v_scope.tenant_id,v_workspace,v_event_id,(p_request->>'starts_at')::timestamptz,(p_request->>'ends_at')::timestamptz,p_request->>'timezone');
  insert into community.event_audience_roles(event_id,role_code) select v_event_id,jsonb_array_elements_text(p_request->'audience'->'role_codes') where p_request->'audience'->>'kind'='roles';
  insert into community.event_audience_members(event_id,membership_id) select v_event_id,(jsonb_array_elements_text(p_request->'audience'->'membership_ids'))::uuid where p_request->'audience'->>'kind'='members';
  if (p_request->'audience'->>'kind'='roles' and not exists(select 1 from community.event_audience_roles where event_id=v_event_id))
   or (p_request->'audience'->>'kind'='members' and (not exists(select 1 from community.event_audience_members where event_id=v_event_id)
    or exists(select 1 from community.event_audience_members am where am.event_id=v_event_id and app_private.ce_event_audience_eligible_v1(v_event_id,am.membership_id) is not true)))
   or p_request->'audience'->>'kind' not in('workspace','roles','members')
  then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
  v_result_version:=1;v_entity_type:='event';v_entity_id:=v_event_id;
 elsif v_command in('publish_event','cancel_event') then
  if v_event.version<>v_expected or(v_command='publish_event' and v_event.status<>'draft')or(v_command='cancel_event' and v_event.status<>'published') then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  v_before:=to_jsonb(v_event);update community.events set status=case when v_command='publish_event' then 'published' else 'cancelled' end,version=version+1,updated_at=clock_timestamp() where id=v_event_id returning * into v_event;
  v_result_version:=v_event.version;v_entity_type:='event';v_entity_id:=v_event_id;
 elsif v_command in('register_interest','withdraw_interest') then
  if v_event.status<>'published' or v_event.version<>v_expected then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  v_record_expected:=(p_request->>'expected_interest_version')::integer;select * into v_interest from community.event_interests where event_id=v_event_id and membership_id=v_scope.membership_id for update;
  if coalesce(v_interest.version,0)<>v_record_expected or(v_command='register_interest' and v_interest.status='interested')or(v_command='withdraw_interest' and(v_interest.id is null or v_interest.status<>'interested')) then raise exception 'ce_interest_version_conflict' using errcode='40001';end if;
  select id into v_occurrence_id from community.event_occurrences where event_id=v_event_id;
  if v_interest.id is null then insert into community.event_interests(tenant_id,workspace_id,event_id,occurrence_id,membership_id,status,version,updated_by) values(v_scope.tenant_id,v_workspace,v_event_id,v_occurrence_id,v_scope.membership_id,'interested',1,v_actor) returning * into v_interest;
  else update community.event_interests set status=case when v_command='register_interest' then 'interested' else 'withdrawn' end,version=version+1,updated_by=v_actor,updated_at=clock_timestamp() where id=v_interest.id returning * into v_interest;end if;
  v_result_version:=v_interest.version;v_entity_type:='event_interest';v_entity_id:=v_interest.id;
 elsif v_command='record_attendance' then
  if v_event.status<>'published' or v_event.version<>v_expected then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  if exists(select 1 from community.event_attendance where event_id=v_event_id and membership_id=v_member_id) then raise exception 'ce_attendance_exists' using errcode='23505';end if;
  select id into strict v_occurrence_id from community.event_occurrences where event_id=v_event_id and timezone=p_request->>'timezone';
  insert into community.event_attendance(tenant_id,workspace_id,event_id,occurrence_id,membership_id,attended,observed_local,timezone,version,updated_by)
  values(v_scope.tenant_id,v_workspace,v_event_id,v_occurrence_id,v_member_id,true,(p_request->>'observed_local')::timestamp,p_request->>'timezone',1,v_actor) returning * into v_attendance;
  v_result_version:=1;v_entity_type:='event_attendance';v_entity_id:=v_attendance.id;
 elsif v_command='correct_attendance' then
  if v_event.status='draft' or v_event.version<>v_expected or(v_event.status='cancelled' and length(v_reason)<12) then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  select * into v_attendance from community.event_attendance where id=(p_request->>'attendance_id')::uuid and event_id=v_event_id for update;
  v_record_expected:=(p_request->>'expected_attendance_version')::integer;
  if not found or v_attendance.version<>v_record_expected or v_attendance.timezone<>p_request->>'timezone' then raise exception 'ce_attendance_version_conflict' using errcode='40001';end if;
  v_before:=to_jsonb(v_attendance);update community.event_attendance set attended=(p_request->>'attended')::boolean,observed_local=(p_request->>'observed_local')::timestamp,
   version=version+1,corrected_after_cancellation=(v_event.status='cancelled'),updated_by=v_actor,updated_at=clock_timestamp() where id=v_attendance.id returning * into v_attendance;
  v_result_version:=v_attendance.version;v_entity_type:='event_attendance';v_entity_id:=v_attendance.id;
 end if;
 v_after:=jsonb_build_object('entity_type',v_entity_type,'entity_id',v_entity_id,'version',v_result_version,'command',v_command);
 v_response:=v_after||jsonb_build_object('replayed',false);
 insert into community.event_command_receipts(request_id,tenant_id,workspace_id,context_id,actor_id,membership_id,represented_party_id,command,canonical_key,entity_type,entity_id,result_version,response_json)
 values(v_request_id,v_scope.tenant_id,v_workspace,v_context,v_actor,v_scope.membership_id,v_scope.represented_party_id,v_command,v_key,v_entity_type,v_entity_id,v_result_version,v_response);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,before_snapshot,after_snapshot,reason)
 values(v_scope.tenant_id,v_actor,'ce.'||v_command,v_entity_type,v_entity_id,v_request_id,v_before,v_after,v_reason);
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
 values(v_scope.tenant_id,v_entity_type,v_entity_id,v_result_version,'ce.'||v_command||'.v1',v_after,v_request_id);
 update platform.idempotency_keys set response_ref=v_response,status_code=200 where tenant_id=v_scope.tenant_id and key=v_key;
 return v_response;
end$$;

create function customer_api.read_ce_events_v1(p_context_id uuid,p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_scope record;v_items jsonb;begin
 select * into strict v_scope from app_private.ce_event_authorize_v1(p_context_id,p_workspace_id,'events.event.read');
 select coalesce(jsonb_agg(x.item order by x.starts_at,x.event_id),'[]') into v_items from(
  select e.id event_id,o.starts_at,jsonb_build_object('event_id',e.id,'occurrence_id',o.id,'title',e.title,'starts_at',o.starts_at,'ends_at',o.ends_at,'timezone',o.timezone,
   'status',e.status,'version',e.version,'audience_policy_id',e.audience_policy_id,'audience_policy_version',e.audience_policy_version,
   'interest_status',i.status,'interest_version',coalesce(i.version,0))item
  from community.events e join community.event_occurrences o on o.event_id=e.id
  left join community.event_interests i on i.event_id=e.id and i.membership_id=v_scope.membership_id
  where e.tenant_id=v_scope.tenant_id and e.workspace_id=p_workspace_id and app_private.ce_event_audience_eligible_v1(e.id,v_scope.membership_id)
  order by o.starts_at,e.id limit 100)x;
 return jsonb_build_object('events',v_items);
end$$;

revoke all on function app_private.ce_event_authorize_v1(uuid,uuid,text),app_private.ce_event_audience_eligible_v1(uuid,uuid),app_private.ce_receipt_immutable_v1() from public,anon,authenticated,service_role;
revoke all on function customer_api.command_ce_event_v1(jsonb),customer_api.read_ce_events_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.command_ce_event_v1(jsonb),customer_api.read_ce_events_v1(uuid,uuid) to authenticated;

commit;
