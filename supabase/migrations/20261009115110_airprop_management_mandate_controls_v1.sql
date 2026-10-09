begin;

-- AP06-MGT-01 records a bounded commercial request and an evidenced acceptance.
-- It deliberately does not create workspace authority, a role, a permission or an
-- execution link. Core remains the only owner of software command authority.
create table airprop.management_mandate_requests(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 owner_party_id uuid not null references portfolio.parties(id) on delete restrict,
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 valid_from date not null,
 valid_to date not null,
 proposal_evidence_reference text not null check(length(btrim(proposal_evidence_reference)) between 8 and 500),
 status text not null default 'requested' check(status in('requested','accepted')),
 requested_by uuid not null references auth.users(id) on delete restrict,
 requested_at timestamptz not null default statement_timestamp(),
 request_idempotency_key text not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
 accepted_by uuid references auth.users(id) on delete restrict,
 accepted_at timestamptz,
 acceptance_evidence_reference text,
 acceptance_idempotency_key text,
 acceptance_hash text,
 check(valid_to>valid_from),
 check(
  (status='requested' and accepted_by is null and accepted_at is null
   and acceptance_evidence_reference is null and acceptance_idempotency_key is null and acceptance_hash is null)
  or
  (status='accepted' and accepted_by is not null and accepted_at is not null
   and length(btrim(acceptance_evidence_reference)) between 8 and 500
   and acceptance_idempotency_key is not null and acceptance_hash~'^[0-9a-f]{64}$'
   and accepted_by<>requested_by)
 ),
 unique(tenant_id,workspace_id,request_idempotency_key),
 unique(tenant_id,workspace_id,acceptance_idempotency_key)
);
create index management_mandate_request_subject_idx
 on airprop.management_mandate_requests(tenant_id,workspace_id,property_id,status,valid_from,valid_to);
create index management_mandate_request_owner_idx
 on airprop.management_mandate_requests(owner_party_id,property_id);

alter table airprop.management_mandate_requests enable row level security;
revoke all on airprop.management_mandate_requests from public,anon,authenticated,service_role;

create function app_private.airprop_management_scope_valid_v1(p_scope jsonb)
returns boolean language plpgsql immutable security definer set search_path=pg_catalog as $$
begin
 if p_scope is null or jsonb_typeof(p_scope)<>'object' or not (p_scope ? 'capabilities')
  or jsonb_typeof(p_scope->'capabilities')<>'array' then return false;end if;
 return not exists(select 1 from jsonb_object_keys(p_scope) k where k not in('capabilities','notes'))
  and jsonb_array_length(p_scope->'capabilities') between 1 and 6
  and not exists(
   select 1 from jsonb_array_elements(p_scope->'capabilities') c
   where jsonb_typeof(c)<>'string' or c#>>'{}' not in(
    'listing','lease_administration','maintenance_coordination','owner_reporting','rent_collection','supplier_coordination'))
  and (select count(*)=count(distinct c#>>'{}') from jsonb_array_elements(p_scope->'capabilities') c)
  and (not (p_scope ? 'notes')
   or (jsonb_typeof(p_scope->'notes')='string' and length(btrim(p_scope->>'notes')) between 1 and 1000));
exception when others then return false;
end;
$$;
revoke all on function app_private.airprop_management_scope_valid_v1(jsonb)
 from public,anon,authenticated,service_role;

create function app_private.require_airprop_mandate_context_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if not app_private.check_workspace_native_permission_v2(
   p_context_id,p_workspace_id,'airprop.asset.manage','airprop_commercial') then
  raise exception 'airprop_mandate_access_denied' using errcode='42501';end if;
 if not exists(
  select 1 from portfolio.properties p
  join platform.workspace_property_bindings b on b.property_id=p.id and b.tenant_id=p.tenant_id
  where p.id=p_property_id and p.tenant_id=v_actor.tenant_id
   and b.customer_workspace_id=p_workspace_id and b.status='active'
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())) then
  raise exception 'airprop_mandate_access_denied' using errcode='42501';end if;
 return query select v_actor.workspace_id,v_actor.tenant_id,v_actor.membership_id,v_actor.role_code;
end;$$;
revoke all on function app_private.require_airprop_mandate_context_v1(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;

create function app_private.guard_airprop_management_mandate_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'airprop_management_mandate_immutable' using errcode='42501';end if;
 if old.status<>'requested' or new.status<>'accepted'
  or (new.id,new.tenant_id,new.workspace_id,new.property_id,new.owner_party_id,new.scope,
      new.valid_from,new.valid_to,new.proposal_evidence_reference,new.requested_by,new.requested_at,
      new.request_idempotency_key,new.request_hash)
     is distinct from
     (old.id,old.tenant_id,old.workspace_id,old.property_id,old.owner_party_id,old.scope,
      old.valid_from,old.valid_to,old.proposal_evidence_reference,old.requested_by,old.requested_at,
      old.request_idempotency_key,old.request_hash)
  or new.accepted_at is distinct from statement_timestamp() then
  raise exception 'airprop_management_mandate_immutable' using errcode='42501';end if;
 return new;
end;$$;
create trigger immutable_airprop_management_mandate
before update or delete on airprop.management_mandate_requests
for each row execute function app_private.guard_airprop_management_mandate_v1();
revoke all on function app_private.guard_airprop_management_mandate_v1()
 from public,anon,authenticated,service_role;

create function customer_api.request_airprop_management_mandate_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_owner_party_id uuid,p_scope jsonb,
 p_valid_from date,p_valid_to date,p_proposal_evidence_reference text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;v_existing airprop.management_mandate_requests%rowtype;
 v_row airprop.management_mandate_requests%rowtype;v_hash text;
begin
 if p_property_id is null or p_owner_party_id is null or p_valid_from is null or p_valid_to is null
  or p_valid_to<=p_valid_from or not app_private.airprop_management_scope_valid_v1(p_scope)
  or length(btrim(coalesce(p_proposal_evidence_reference,''))) not between 8 and 500
  or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_management_mandate_invalid' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_mandate_context_v1(
  p_context_id,p_workspace_id,p_property_id);
 if not exists(
  select 1 from portfolio.ownerships o
  join portfolio.units u on u.id=o.unit_id and u.tenant_id=o.tenant_id
  join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where o.party_id=p_owner_party_id and o.tenant_id=v_actor.tenant_id and b.property_id=p_property_id
   and o.valid_from<=p_valid_from and (o.valid_to is null or o.valid_to>p_valid_from)) then
  raise exception 'airprop_management_owner_mismatch' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('airprop:management-mandate:'||p_property_id::text,0));
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'workspace',p_workspace_id,
  'property',p_property_id,'owner',p_owner_party_id,'scope',p_scope,'from',p_valid_from,'to',p_valid_to,
  'evidence',btrim(p_proposal_evidence_reference))::text,'UTF8')),'hex');
 select * into v_existing from airprop.management_mandate_requests where tenant_id=v_actor.tenant_id
  and workspace_id=p_workspace_id and request_idempotency_key=p_idempotency_key;
 if found then
  if v_existing.requested_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_management_mandate_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'mandate_request_id',v_existing.id,'status',v_existing.status,'idempotent',true);
 end if;
 insert into airprop.management_mandate_requests(
  tenant_id,workspace_id,property_id,owner_party_id,scope,valid_from,valid_to,proposal_evidence_reference,
  requested_by,request_idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_property_id,p_owner_party_id,p_scope,p_valid_from,p_valid_to,
  btrim(p_proposal_evidence_reference),auth.uid(),p_idempotency_key,v_hash) returning * into v_row;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_MANAGEMENT_MANDATE_REQUESTED',
  'airprop.management_mandate_request',v_row.id,
  jsonb_build_object('status',v_row.status,'property_id',v_row.property_id,'owner_party_id',v_row.owner_party_id,
   'scope',v_row.scope,'valid_from',v_row.valid_from,'valid_to',v_row.valid_to),
  'Bounded management mandate request; no software authority granted');
 return jsonb_build_object('version',1,'mandate_request_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

create function customer_api.accept_airprop_management_mandate_v1(
 p_context_id uuid,p_workspace_id uuid,p_mandate_request_id uuid,
 p_acceptance_evidence_reference text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor record;v_row airprop.management_mandate_requests%rowtype;v_hash text;
begin
 if p_mandate_request_id is null
  or length(btrim(coalesce(p_acceptance_evidence_reference,''))) not between 8 and 500
  or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_management_mandate_invalid' using errcode='22023';end if;
 select * into v_row from airprop.management_mandate_requests where id=p_mandate_request_id;
 if v_row.id is null or v_row.workspace_id<>p_workspace_id then
  raise exception 'airprop_management_mandate_not_found' using errcode='22023';end if;
 select * into v_actor from app_private.require_airprop_mandate_context_v1(
  p_context_id,p_workspace_id,v_row.property_id);
 if v_row.tenant_id<>v_actor.tenant_id then
  raise exception 'airprop_mandate_access_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('airprop:management-mandate:'||v_row.property_id::text,0));
 select * into v_row from airprop.management_mandate_requests where id=p_mandate_request_id for update;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'request',p_mandate_request_id,
  'evidence',btrim(p_acceptance_evidence_reference))::text,'UTF8')),'hex');
 if v_row.status='accepted' then
  if v_row.accepted_by is distinct from auth.uid() or v_row.acceptance_idempotency_key<>p_idempotency_key
   or v_row.acceptance_hash<>v_hash then
   raise exception 'airprop_management_mandate_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'mandate_request_id',v_row.id,'status',v_row.status,'idempotent',true);
 end if;
 if v_row.requested_by=auth.uid() then
  raise exception 'airprop_management_mandate_self_acceptance_denied' using errcode='42501';end if;
 if exists(select 1 from airprop.management_mandate_requests m
  where m.id<>v_row.id and m.tenant_id=v_row.tenant_id and m.workspace_id=v_row.workspace_id
   and m.property_id=v_row.property_id and m.status='accepted'
   and daterange(m.valid_from,m.valid_to,'[)')&&daterange(v_row.valid_from,v_row.valid_to,'[)')) then
  raise exception 'airprop_management_mandate_conflict' using errcode='23505';end if;
 update airprop.management_mandate_requests set status='accepted',accepted_by=auth.uid(),
  accepted_at=statement_timestamp(),acceptance_evidence_reference=btrim(p_acceptance_evidence_reference),
  acceptance_idempotency_key=p_idempotency_key,acceptance_hash=v_hash where id=v_row.id returning * into v_row;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_MANAGEMENT_MANDATE_ACCEPTED',
  'airprop.management_mandate_request',v_row.id,jsonb_build_object('status','requested'),
  jsonb_build_object('status',v_row.status,'scope',v_row.scope,'valid_from',v_row.valid_from,'valid_to',v_row.valid_to),
  'Evidenced commercial acceptance only; no software authority granted');
 return jsonb_build_object('version',1,'mandate_request_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

revoke all on function customer_api.request_airprop_management_mandate_v1(uuid,uuid,uuid,uuid,jsonb,date,date,text,text),
 customer_api.accept_airprop_management_mandate_v1(uuid,uuid,uuid,text,text)
 from public,anon,service_role;
grant execute on function customer_api.request_airprop_management_mandate_v1(uuid,uuid,uuid,uuid,jsonb,date,date,text,text),
 customer_api.accept_airprop_management_mandate_v1(uuid,uuid,uuid,text,text)
 to authenticated;

commit;
