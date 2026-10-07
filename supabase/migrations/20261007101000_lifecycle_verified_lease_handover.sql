begin;

-- LC-C03 / T07: a reviewed lease transition is distinct from title, software
-- authority, private-document access and financial settlement.
insert into identity.permissions(code,resource,action,description) values
 ('core.relationships.lease','core.relationships','lease','Execute and terminate an independently verified canonical lease')
on conflict(code) do nothing;

insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active'
from platform.module_definitions m join identity.permissions p
 on p.code='core.relationships.lease'
where m.code='core_unit_identity' and m.version=1
 and not exists(select 1 from platform.module_permission_bindings b
  where b.module_definition_id=m.id and b.permission_id=p.id
   and b.lifecycle_status='active' and b.valid_to is null);

create table occupancy.lease_handover_receipts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 lease_id uuid not null unique references occupancy.leases(id) on delete restrict,
 relationship_proposal_id uuid not null unique references portfolio.relationship_proposals(id) on delete restrict,
 evidence_version_id uuid not null references documents.document_versions(id) on delete restrict,
 handover_status text not null check(handover_status in('partial','accepted')),
 effective_on date not null,
 schedule_snapshot jsonb not null check(jsonb_typeof(schedule_snapshot)='object'),
 transferable_facts jsonb not null check(jsonb_typeof(transferable_facts)='object'),
 executed_by uuid not null references auth.users(id) on delete restrict,
 executed_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,relationship_proposal_id,idempotency_key)
);
create index lease_handover_receipts_tenant_idx on occupancy.lease_handover_receipts(tenant_id);
create index lease_handover_receipts_property_idx on occupancy.lease_handover_receipts(property_id);
create index lease_handover_receipts_unit_idx on occupancy.lease_handover_receipts(unit_id,effective_on desc);
create index lease_handover_receipts_evidence_idx on occupancy.lease_handover_receipts(evidence_version_id);
create index lease_handover_receipts_actor_idx on occupancy.lease_handover_receipts(executed_by);

create table occupancy.lease_termination_receipts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 lease_id uuid not null unique references occupancy.leases(id) on delete restrict,
 effective_on date not null,
 reason text not null,
 ended_access_assignment_ids uuid[] not null default '{}',
 ended_occupancy_ids uuid[] not null default '{}',
 settlement_status text not null default 'separate' check(settlement_status='separate'),
 executed_by uuid not null references auth.users(id) on delete restrict,
 executed_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,lease_id,idempotency_key)
);
create index lease_termination_receipts_tenant_idx on occupancy.lease_termination_receipts(tenant_id);
create index lease_termination_receipts_property_idx on occupancy.lease_termination_receipts(property_id);
create index lease_termination_receipts_unit_idx on occupancy.lease_termination_receipts(unit_id,effective_on desc);
create index lease_termination_receipts_actor_idx on occupancy.lease_termination_receipts(executed_by);

alter table occupancy.lease_handover_receipts enable row level security;
alter table occupancy.lease_termination_receipts enable row level security;
revoke all on occupancy.lease_handover_receipts,occupancy.lease_termination_receipts
 from public,anon,authenticated,service_role;

create function app_private.protect_lease_transition_receipt_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'lease_transition_history_immutable' using errcode='55000';end;$$;
create trigger immutable_lease_handover_receipt before update or delete on occupancy.lease_handover_receipts
 for each row execute function app_private.protect_lease_transition_receipt_v1();
create trigger immutable_lease_termination_receipt before update or delete on occupancy.lease_termination_receipts
 for each row execute function app_private.protect_lease_transition_receipt_v1();
revoke all on function app_private.protect_lease_transition_receipt_v1()
 from public,anon,authenticated,service_role;

create or replace function app_private.assert_relationship_workspace_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_permission text
) returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null
  or p_property_id is null or p_permission not in
   ('core.relationships.propose','core.relationships.review','core.relationships.read',
    'core.relationships.execute','core.relationships.transfer','core.relationships.lease') then
  raise exception 'core_relationship_access_denied' using errcode='42501';end if;
 select tenant_id into v_tenant from portfolio.properties where id=p_property_id for share;
 if v_tenant is null or app_private.current_workspace_property_mandate_v1(
   p_context_id,p_workspace_id,p_property_id,'property_operations') is null
  or app_private.check_workspace_native_permission_v2(
   p_context_id,p_workspace_id,p_permission,'core_unit_identity') is not true then
  raise exception 'core_relationship_access_denied' using errcode='42501';end if;
 perform 1 from platform.workspace_property_authorities
  where property_id=p_property_id and customer_workspace_id=p_workspace_id
   and tenant_id=v_tenant and purpose='property_operations' and status='active'
   and valid_from<=clock_timestamp() and(valid_to is null or valid_to>clock_timestamp()) for share;
 if not found then raise exception 'core_relationship_access_denied' using errcode='42501';end if;
 return v_tenant;
end;$$;
revoke all on function app_private.assert_relationship_workspace_v1(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;

create function customer_api.execute_verified_lease_handover_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_proposal_id uuid,
 p_document_context_id uuid,p_evidence_version_id uuid,p_handover_status text,
 p_schedule_snapshot jsonb,p_transferable_facts jsonb,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_p portfolio.relationship_proposals%rowtype;
 v_r portfolio.relationship_reviews%rowtype;v_e documents.document_versions%rowtype;
 v_d documents.documents%rowtype;v_existing occupancy.lease_handover_receipts%rowtype;
 v_lease occupancy.leases%rowtype;v_receipt occupancy.lease_handover_receipts%rowtype;
 v_occupancy uuid;v_reference text;v_hash text;v_response jsonb;v_actor record;
begin
 if p_proposal_id is null or p_document_context_id is null or p_evidence_version_id is null
  or p_handover_status not in('partial','accepted')
  or p_schedule_snapshot is null or p_transferable_facts is null
  or jsonb_typeof(p_schedule_snapshot)<>'object' or jsonb_typeof(p_transferable_facts)<>'object'
  or p_schedule_snapshot-'currency'-'rent_amount'-'deposit_amount'-'due_day'-'indexation'-'notes'<>'{}'::jsonb
  or p_transferable_facts-'meter_readings'-'keys_count'-'open_defects'-'accepted_items'<>'{}'::jsonb
  or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'core_lease_handover_invalid' using errcode='22023';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 perform 1 from portfolio.properties where id=p_property_id for update;
 v_tenant=app_private.assert_relationship_workspace_v1(p_context_id,p_workspace_id,p_property_id,'core.relationships.lease');
 select * into v_p from portfolio.relationship_proposals where id=p_proposal_id
  and tenant_id=v_tenant and customer_workspace_id=p_workspace_id and property_id=p_property_id for share;
 select * into v_r from portfolio.relationship_reviews where proposal_id=p_proposal_id and tenant_id=v_tenant for share;
 if v_p.id is null or v_p.kind<>'lease' or v_p.source_party_id is null or v_r.id is null
  or v_r.decision<>'verified' or v_r.evidence_reference is distinct from v_p.evidence_reference
  or v_p.effective_from<>current_date then
  raise exception 'core_lease_handover_not_verified' using errcode='22023';end if;
 perform 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_p.unit_id and u.tenant_id=v_tenant and b.property_id=p_property_id for update of u;
 if not found then raise exception 'core_lease_handover_subject_mismatch' using errcode='22023';end if;
 v_e=app_private.require_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,p_evidence_version_id,true);
 select * into v_d from documents.documents where id=v_e.document_id for share;
 v_reference='urn:cladora:document-version:'||p_evidence_version_id::text;
 if v_d.property_id is distinct from p_property_id or v_d.evidence_type is distinct from 'signed_lease'
  or v_p.evidence_reference is distinct from v_reference then
  raise exception 'core_lease_handover_evidence_mismatch' using errcode='22023';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'context',p_context_id,
  'workspace',p_workspace_id,'property',p_property_id,'proposal',p_proposal_id,
  'evidence',p_evidence_version_id,'handover_status',p_handover_status,
  'schedule',p_schedule_snapshot,'facts',p_transferable_facts)::text,'UTF8')),'hex');
 select * into v_existing from occupancy.lease_handover_receipts where tenant_id=v_tenant
  and relationship_proposal_id=p_proposal_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.executed_by is distinct from auth.uid() or v_existing.request_hash is distinct from v_hash then
   raise exception 'core_lease_handover_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'receipt_id',v_existing.id,'lease_id',v_existing.lease_id,
   'status','active','handover_status',v_existing.handover_status,'effective_on',v_existing.effective_on,'idempotent',true);
 end if;
 if exists(select 1 from occupancy.lease_handover_receipts where relationship_proposal_id=p_proposal_id)
  or exists(select 1 from occupancy.leases l where l.unit_id=v_p.unit_id and l.status='active'
   and daterange(l.starts_on,coalesce(l.ends_on,'infinity'::date),'[)')&&
    daterange(v_p.effective_from,coalesce(v_p.effective_to,'infinity'::date),'[)')) then
  raise exception 'core_lease_handover_conflict' using errcode='23505';end if;
 insert into occupancy.leases(tenant_id,unit_id,landlord_party_id,tenant_party_id,
  starts_on,ends_on,status,evidence_id)
 values(v_tenant,v_p.unit_id,v_p.source_party_id,v_p.target_party_id,
  v_p.effective_from,v_p.effective_to,'active',p_evidence_version_id) returning * into v_lease;
 insert into occupancy.occupancies(tenant_id,unit_id,kind,status,starts_at,ends_at)
 values(v_tenant,v_p.unit_id,'tenant','active',v_p.effective_from::timestamptz,
  case when v_p.effective_to is null then null else v_p.effective_to::timestamptz end) returning id into v_occupancy;
 insert into occupancy.occupants(occupancy_id,party_id,role) values(v_occupancy,v_p.target_party_id,'tenant');
 insert into occupancy.lease_handover_receipts(tenant_id,property_id,unit_id,lease_id,
  relationship_proposal_id,evidence_version_id,handover_status,effective_on,schedule_snapshot,
  transferable_facts,executed_by,idempotency_key,request_hash)
 values(v_tenant,p_property_id,v_p.unit_id,v_lease.id,p_proposal_id,p_evidence_version_id,
  p_handover_status,v_p.effective_from,p_schedule_snapshot,p_transferable_facts,auth.uid(),p_idempotency_key,v_hash)
 returning * into v_receipt;
 v_response=jsonb_build_object('version',1,'receipt_id',v_receipt.id,'lease_id',v_lease.id,
  'status','active','handover_status',p_handover_status,'effective_on',v_p.effective_from,'idempotent',false);
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_tenant,auth.uid(),v_actor.role_code,'CORE_LEASE_HANDOVER_EXECUTED','occupancy.lease_handover',v_receipt.id,
  v_response-'idempotent','Verified signed lease; no role, credential, private document or settlement transfer');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'occupancy.lease_handover',v_receipt.id,1,'core.relationship.lease_handover.v1',v_response-'idempotent');
 return v_response;
end;$$;
revoke all on function customer_api.execute_verified_lease_handover_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text)
 from public,anon,service_role;
grant execute on function customer_api.execute_verified_lease_handover_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text)
 to authenticated;

create function customer_api.terminate_verified_lease_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_lease_id uuid,
 p_expected_starts_on date,p_effective_on date,p_access_assignment_ids uuid[],
 p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_l occupancy.leases%rowtype;v_existing occupancy.lease_termination_receipts%rowtype;
 v_hash text;v_access uuid[];v_occupancies uuid[];v_receipt occupancy.lease_termination_receipts%rowtype;
 v_response jsonb;v_actor record;v_requested integer;
begin
 if p_lease_id is null or p_expected_starts_on is null or p_effective_on is null
  or p_effective_on<>current_date or length(btrim(coalesce(p_reason,''))) not between 8 and 500
  or p_access_assignment_ids is null or p_idempotency_key is null
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'core_lease_termination_invalid' using errcode='22023';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 perform 1 from portfolio.properties where id=p_property_id for update;
 v_tenant=app_private.assert_relationship_workspace_v1(p_context_id,p_workspace_id,p_property_id,'core.relationships.lease');
 select l.* into v_l from occupancy.leases l join portfolio.units u on u.id=l.unit_id
  join portfolio.buildings b on b.id=u.building_id
  where l.id=p_lease_id and l.tenant_id=v_tenant and b.property_id=p_property_id for update of l;
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'context',p_context_id,
  'workspace',p_workspace_id,'property',p_property_id,'lease',p_lease_id,'starts_on',p_expected_starts_on,
  'effective_on',p_effective_on,'access',p_access_assignment_ids,'reason',btrim(p_reason))::text,'UTF8')),'hex');
 select * into v_existing from occupancy.lease_termination_receipts where tenant_id=v_tenant
  and lease_id=p_lease_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.executed_by is distinct from auth.uid() or v_existing.request_hash is distinct from v_hash then
   raise exception 'core_lease_termination_idempotency_conflict' using errcode='23505';end if;
  return jsonb_build_object('version',1,'receipt_id',v_existing.id,'lease_id',v_existing.lease_id,
   'status','terminated','effective_on',v_existing.effective_on,
   'ended_access_count',cardinality(v_existing.ended_access_assignment_ids),
   'ended_occupancy_count',cardinality(v_existing.ended_occupancy_ids),'settlement_status','separate','idempotent',true);
 end if;
 if v_l.id is null or v_l.status<>'active' or v_l.starts_on<>p_expected_starts_on
  or p_effective_on<=v_l.starts_on or exists(select 1 from occupancy.lease_termination_receipts where lease_id=p_lease_id) then
  raise exception 'core_lease_termination_stale_baseline' using errcode='40001';end if;
 select count(distinct x) into v_requested from unnest(p_access_assignment_ids)x;
 if v_requested<>cardinality(p_access_assignment_ids) then raise exception 'core_lease_termination_access_mismatch' using errcode='22023';end if;
 select coalesce(array_agg(a.id order by a.id),'{}') into v_access
 from occupancy.access_assignments a join occupancy.access_assets s on s.id=a.asset_id and s.tenant_id=a.tenant_id
 join portfolio.units u on u.id=v_l.unit_id
 where a.id=any(p_access_assignment_ids) and a.tenant_id=v_tenant and a.party_id=v_l.tenant_party_id
  and(a.ends_at is null or a.ends_at>p_effective_on::timestamptz)
  and(s.unit_id=v_l.unit_id or(s.unit_id is null and s.building_id=u.building_id));
 if cardinality(v_access)<>v_requested then raise exception 'core_lease_termination_access_mismatch' using errcode='22023';end if;
 update occupancy.access_assignments set ends_at=statement_timestamp(),
  returned_at=coalesce(returned_at,statement_timestamp()) where id=any(v_access);
 select coalesce(array_agg(o.id order by o.id),'{}') into v_occupancies
 from occupancy.occupancies o where o.tenant_id=v_tenant and o.unit_id=v_l.unit_id and o.status='active'
  and o.starts_at<statement_timestamp()
  and exists(select 1 from occupancy.occupants x where x.occupancy_id=o.id and x.party_id=v_l.tenant_party_id);
 update occupancy.occupancies set status='ended',ends_at=statement_timestamp(),finalized_at=statement_timestamp()
  where id=any(v_occupancies);
 update occupancy.leases set status='archived',ends_on=p_effective_on,finalized_at=statement_timestamp(),updated_at=statement_timestamp()
  where id=v_l.id;
 insert into occupancy.lease_termination_receipts(tenant_id,property_id,unit_id,lease_id,effective_on,
  reason,ended_access_assignment_ids,ended_occupancy_ids,executed_by,idempotency_key,request_hash)
 values(v_tenant,p_property_id,v_l.unit_id,v_l.id,p_effective_on,btrim(p_reason),v_access,v_occupancies,
  auth.uid(),p_idempotency_key,v_hash) returning * into v_receipt;
 v_response=jsonb_build_object('version',1,'receipt_id',v_receipt.id,'lease_id',v_l.id,'status','terminated',
  'effective_on',p_effective_on,'ended_access_count',cardinality(v_access),
  'ended_occupancy_count',cardinality(v_occupancies),'settlement_status','separate','idempotent',false);
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_tenant,auth.uid(),v_actor.role_code,'CORE_LEASE_TERMINATED','occupancy.lease_termination',v_receipt.id,
  v_response-'idempotent',btrim(p_reason));
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'occupancy.lease_termination',v_receipt.id,1,'core.relationship.lease_terminated.v1',v_response-'idempotent');
 return v_response;
end;$$;
revoke all on function customer_api.terminate_verified_lease_v1(uuid,uuid,uuid,uuid,date,date,uuid[],text,text)
 from public,anon,service_role;
grant execute on function customer_api.terminate_verified_lease_v1(uuid,uuid,uuid,uuid,date,date,uuid[],text,text)
 to authenticated;

comment on table occupancy.lease_handover_receipts is 'Immutable T07 signed-lease and partial/accepted handover receipt; never a role, ACL, credential or settlement grant.';
comment on table occupancy.lease_termination_receipts is 'Immutable T07 lease/occupancy/access-end receipt; financial settlement remains separate.';

commit;
