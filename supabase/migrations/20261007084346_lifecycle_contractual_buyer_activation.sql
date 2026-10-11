begin;

-- LC-C03 / AIRPROP T03. A signed presale creates a purpose-limited,
-- append-only contractual-buyer fact. It does not create title, tenancy,
-- an owner invitation, a workspace grant, or any payment authority.
insert into identity.permissions(code,resource,action,description) values
 ('core.relationships.execute','core.relationships','execute','Execute an independently verified relationship transition'),
 ('airprop.presale.execute','airprop.presale','execute','Record a signed presale and its contractual-buyer relationship')
on conflict(code) do nothing;

insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active'
from platform.module_definitions m join identity.permissions p
 on (m.code='core_unit_identity' and p.code='core.relationships.execute')
 or (m.code='airprop_commercial' and p.code='airprop.presale.execute')
where m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;

-- Keep the AIRPROP manifest fail-closed after adding the T03 permission.
create or replace function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 where m.code='airprop_commercial' and m.version=1;
 select count(*) into matched from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 join identity.permissions p on p.id=b.permission_id
 join(values
  ('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
  ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),
  ('airprop.asset.manage','manage'),('airprop.diligence.manage','manage'),
  ('airprop.diligence.submit','manage'),('airprop.acquisition.propose','manage'),
  ('airprop.acquisition.approve','manage'),('airprop.presale.execute','manage')
 ) x(code,mode) on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1
  and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2
  and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>10 or matched<>10 then
  raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002';
 end if;
end;$$;
revoke all on function app_private.validate_airprop_module_bindings_v1()
 from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();

create table airprop.presale_contracts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 opportunity_id uuid not null references airprop.investment_opportunities(id) on delete restrict,
 relationship_proposal_id uuid not null unique references portfolio.relationship_proposals(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 buyer_party_id uuid not null references portfolio.parties(id) on delete restrict,
 evidence_version_id uuid not null references documents.document_versions(id) on delete restrict,
 signed_on date not null,
 effective_from date not null,
 effective_to date,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 check(effective_to is null or effective_to>effective_from),
 unique(tenant_id,workspace_id,idempotency_key)
);
create index presale_contracts_workspace_idx on airprop.presale_contracts(workspace_id,recorded_at desc);
create index presale_contracts_tenant_idx on airprop.presale_contracts(tenant_id);
create index presale_contracts_opportunity_idx on airprop.presale_contracts(opportunity_id);
create index presale_contracts_unit_idx on airprop.presale_contracts(unit_id,effective_from,effective_to);
create index presale_contracts_buyer_idx on airprop.presale_contracts(buyer_party_id);
create index presale_contracts_evidence_idx on airprop.presale_contracts(evidence_version_id);
create index presale_contracts_actor_idx on airprop.presale_contracts(recorded_by);

create table portfolio.contractual_buyer_relationships(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 buyer_party_id uuid not null references portfolio.parties(id) on delete restrict,
 presale_contract_id uuid not null unique references airprop.presale_contracts(id) on delete restrict,
 valid_from date not null,
 valid_to date,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 check(valid_to is null or valid_to>valid_from)
);
create index contractual_buyer_subject_idx
 on portfolio.contractual_buyer_relationships(tenant_id,unit_id,valid_from,valid_to);
create index contractual_buyer_party_idx
 on portfolio.contractual_buyer_relationships(tenant_id,buyer_party_id,valid_from,valid_to);
create index contractual_buyer_property_idx on portfolio.contractual_buyer_relationships(property_id);
create index contractual_buyer_unit_idx on portfolio.contractual_buyer_relationships(unit_id);
create index contractual_buyer_buyer_party_idx on portfolio.contractual_buyer_relationships(buyer_party_id);
create index contractual_buyer_actor_idx on portfolio.contractual_buyer_relationships(created_by);

alter table airprop.presale_contracts enable row level security;
alter table portfolio.contractual_buyer_relationships enable row level security;
revoke all on airprop.presale_contracts,portfolio.contractual_buyer_relationships
 from public,anon,authenticated,service_role;

create function app_private.protect_contractual_buyer_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception 'contractual_buyer_history_immutable' using errcode='55000';
end;$$;
create trigger immutable_presale_contract before update or delete on airprop.presale_contracts
 for each row execute function app_private.protect_contractual_buyer_v1();
create trigger immutable_contractual_buyer before update or delete on portfolio.contractual_buyer_relationships
 for each row execute function app_private.protect_contractual_buyer_v1();
revoke all on function app_private.protect_contractual_buyer_v1()
 from public,anon,authenticated,service_role;

-- Extend the existing shared assertion rather than adding a second property
-- authority resolver. Every replay rechecks the current mandate and role.
create or replace function app_private.assert_relationship_workspace_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_permission text
) returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null
   or p_property_id is null or p_permission not in
    ('core.relationships.propose','core.relationships.review','core.relationships.read',
     'core.relationships.execute') then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 select tenant_id into v_tenant from portfolio.properties where id=p_property_id for share;
 if v_tenant is null or app_private.current_workspace_property_mandate_v1(
    p_context_id,p_workspace_id,p_property_id,'property_operations') is null
  or app_private.check_workspace_native_permission_v2(
    p_context_id,p_workspace_id,p_permission,'core_unit_identity') is not true then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 perform 1 from platform.workspace_property_authorities
  where property_id=p_property_id and customer_workspace_id=p_workspace_id
   and tenant_id=v_tenant and purpose='property_operations' and status='active'
   and valid_from<=clock_timestamp() and (valid_to is null or valid_to>clock_timestamp())
  for share;
 if not found then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 return v_tenant;
end;$$;
revoke all on function app_private.assert_relationship_workspace_v1(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;

create function customer_api.activate_airprop_contractual_buyer_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_opportunity_id uuid,
 p_proposal_id uuid,p_document_context_id uuid,p_evidence_version_id uuid,
 p_signed_on date,p_expected_effective_from date,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_tenant uuid; v_proposal portfolio.relationship_proposals%rowtype;
 v_review portfolio.relationship_reviews%rowtype; v_opportunity airprop.investment_opportunities%rowtype;
 v_evidence documents.document_versions%rowtype; v_document documents.documents%rowtype;
 v_acquisition airprop.acquisition_proposals%rowtype; v_state jsonb;
 v_existing airprop.presale_contracts%rowtype; v_contract airprop.presale_contracts%rowtype;
 v_relation_id uuid; v_hash text; v_reference text; v_actor record; v_response jsonb;
begin
 if p_context_id is null or p_workspace_id is null or p_property_id is null
  or p_opportunity_id is null or p_proposal_id is null or p_document_context_id is null
  or p_evidence_version_id is null or p_signed_on is null or p_expected_effective_from is null
  or p_idempotency_key is null
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_invalid_presale' using errcode='22023';
 end if;
 perform 1 from portfolio.properties where id=p_property_id for update;
 v_tenant=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,p_property_id,'core.relationships.execute');
 if app_private.check_workspace_native_permission_v2(
  p_context_id,p_workspace_id,'airprop.presale.execute','airprop_commercial') is not true then
  raise exception 'airprop_presale_access_denied' using errcode='42501';
 end if;
 select * into v_opportunity from airprop.investment_opportunities
  where id=p_opportunity_id and tenant_id=v_tenant and workspace_id=p_workspace_id
   and property_id=p_property_id for share;
 if v_opportunity.id is null then
  raise exception 'airprop_presale_baseline_mismatch' using errcode='22023';
 end if;
 select * into v_proposal from portfolio.relationship_proposals
  where id=p_proposal_id and tenant_id=v_tenant and customer_workspace_id=p_workspace_id
   and property_id=p_property_id for share;
 select * into v_review from portfolio.relationship_reviews
  where proposal_id=p_proposal_id and tenant_id=v_tenant for share;
 if v_proposal.id is null or v_proposal.kind<>'contractual_buyer'
  or v_proposal.source_party_id is not null or v_proposal.effective_from<>p_expected_effective_from
  or v_review.id is null or v_review.decision<>'verified' then
  raise exception 'airprop_presale_relationship_not_verified' using errcode='22023';
 end if;
 select * into v_acquisition from airprop.acquisition_proposals
  where tenant_id=v_tenant and workspace_id=p_workspace_id
   and opportunity_id=p_opportunity_id order by proposed_at desc limit 1 for share;
 v_state=app_private.airprop_acquisition_state_v1(v_acquisition.id);
 if v_acquisition.id is null or v_state->>'status'<>'internally_approved'
  or v_acquisition.expires_at<=clock_timestamp() then
  raise exception 'airprop_presale_acquisition_not_approved' using errcode='22023';
 end if;
 v_evidence=app_private.require_airprop_diligence_evidence_v1(
  p_document_context_id,p_workspace_id,p_evidence_version_id,true);
 select * into v_document from documents.documents where id=v_evidence.document_id for share;
 v_reference='urn:cladora:document-version:'||p_evidence_version_id::text;
 if v_document.property_id is distinct from p_property_id
  or v_document.evidence_type is distinct from 'signed_presale'
  or v_proposal.evidence_reference is distinct from v_reference
  or v_review.evidence_reference is distinct from v_reference
  or p_signed_on>current_date or p_signed_on>p_expected_effective_from then
  raise exception 'airprop_presale_evidence_mismatch' using errcode='22023';
 end if;
 perform 1 from portfolio.units u join portfolio.buildings b
  on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_proposal.unit_id and u.tenant_id=v_tenant and b.property_id=p_property_id
  for update of u;
 if not found then raise exception 'airprop_presale_baseline_mismatch' using errcode='22023';end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object(
  'actor',auth.uid(),'context',p_context_id,'workspace',p_workspace_id,
  'property',p_property_id,'opportunity',p_opportunity_id,'proposal',p_proposal_id,
  'evidence_version',p_evidence_version_id,'signed_on',p_signed_on,
  'effective_from',p_expected_effective_from)::text,'UTF8')),'hex');
 select * into v_existing from airprop.presale_contracts
  where tenant_id=v_tenant and workspace_id=p_workspace_id
   and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.recorded_by is distinct from auth.uid()
   or v_existing.request_hash is distinct from v_hash then
   raise exception 'airprop_presale_idempotency_conflict' using errcode='23505';
  end if;
  -- Replay is intentionally after every current-authority/evidence check above.
  return jsonb_build_object('presale_contract_id',v_existing.id,
   'contractual_buyer_relationship_id',(select id from portfolio.contractual_buyer_relationships
    where presale_contract_id=v_existing.id),'status','contractual_buyer','idempotent',true);
 end if;
 if exists(select 1 from portfolio.contractual_buyer_relationships r
  where r.tenant_id=v_tenant and r.unit_id=v_proposal.unit_id
   and r.buyer_party_id=v_proposal.target_party_id
   and daterange(r.valid_from,coalesce(r.valid_to,'infinity'::date),'[)') &&
       daterange(v_proposal.effective_from,coalesce(v_proposal.effective_to,'infinity'::date),'[)')) then
  raise exception 'airprop_contractual_buyer_overlap' using errcode='23P01';
 end if;
 insert into airprop.presale_contracts(
  tenant_id,workspace_id,opportunity_id,relationship_proposal_id,unit_id,buyer_party_id,
  evidence_version_id,signed_on,effective_from,effective_to,recorded_by,
  idempotency_key,request_hash)
 values(v_tenant,p_workspace_id,p_opportunity_id,p_proposal_id,v_proposal.unit_id,
  v_proposal.target_party_id,p_evidence_version_id,p_signed_on,v_proposal.effective_from,
  v_proposal.effective_to,auth.uid(),p_idempotency_key,v_hash) returning * into v_contract;
 insert into portfolio.contractual_buyer_relationships(
  tenant_id,property_id,unit_id,buyer_party_id,presale_contract_id,valid_from,valid_to,
  created_by)
 values(v_tenant,p_property_id,v_proposal.unit_id,v_proposal.target_party_id,v_contract.id,
  v_proposal.effective_from,v_proposal.effective_to,auth.uid()) returning id into v_relation_id;
 v_response=jsonb_build_object('version',1,'presale_contract_id',v_contract.id,
  'contractual_buyer_relationship_id',v_relation_id,'status','contractual_buyer',
  'effective_from',v_proposal.effective_from,'effective_to',v_proposal.effective_to,
  'idempotent',false);
 select * into v_actor from app_private.resolve_workspace_native_context_v2(
  p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,
  after_snapshot,reason)
 values(v_tenant,auth.uid(),v_actor.role_code,'AIRPROP_PRESALE_ACTIVATED',
  'portfolio.contractual_buyer_relationship',v_relation_id,v_response-'idempotent',
  'Signed presale; no title, tenancy, invitation or payment authority');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,
  event_type,payload)
 values(v_tenant,'portfolio.contractual_buyer_relationship',v_relation_id,1,
  'core.relationship.contractual_buyer_activated.v1',v_response-'idempotent');
 return v_response;
end;$$;

revoke all on function customer_api.activate_airprop_contractual_buyer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text)
 from public,anon,service_role;
grant execute on function customer_api.activate_airprop_contractual_buyer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text) to authenticated;

comment on table portfolio.contractual_buyer_relationships is
 'Purpose-limited T03 relationship. It is not ownership, tenancy, an invitation, a role grant or payment authority.';
comment on function customer_api.activate_airprop_contractual_buyer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text) is
 'Atomically records a signed AIRPROP presale and contractual-buyer fact after independent review; grants no owner or payer authority.';

commit;
