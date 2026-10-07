begin;

-- LC-C03 / T06: execute a reviewed deed transfer without copying software
-- authority, account links, private documents, conversations or payment rights.
insert into identity.permissions(code,resource,action,description) values
 ('core.relationships.transfer','core.relationships','transfer','Execute an independently verified canonical ownership transfer')
on conflict(code) do nothing;

insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active'
from platform.module_definitions m join identity.permissions p
 on p.code='core.relationships.transfer'
where m.code='core_unit_identity' and m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create table portfolio.ownership_transfers(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 relationship_proposal_id uuid not null unique references portfolio.relationship_proposals(id) on delete restrict,
 outgoing_ownership_id uuid not null unique references portfolio.ownerships(id) on delete restrict,
 incoming_ownership_id uuid not null unique references portfolio.ownerships(id) on delete restrict,
 source_party_id uuid not null references portfolio.parties(id) on delete restrict,
 target_party_id uuid not null references portfolio.parties(id) on delete restrict,
 evidence_version_id uuid not null references documents.document_versions(id) on delete restrict,
 effective_on date not null,
 share numeric(10,8) not null check(share>0 and share<=1),
 executed_by uuid not null references auth.users(id) on delete restrict,
 executed_at timestamptz not null default statement_timestamp(),
 idempotency_key text not null,
 request_hash text not null,
 unique(tenant_id,relationship_proposal_id,idempotency_key),
 check(source_party_id<>target_party_id)
);
create index ownership_transfers_tenant_idx on portfolio.ownership_transfers(tenant_id);
create index ownership_transfers_property_idx on portfolio.ownership_transfers(property_id);
create index ownership_transfers_unit_idx on portfolio.ownership_transfers(unit_id,effective_on desc);
create index ownership_transfers_source_party_idx on portfolio.ownership_transfers(source_party_id);
create index ownership_transfers_target_party_idx on portfolio.ownership_transfers(target_party_id);
create index ownership_transfers_evidence_idx on portfolio.ownership_transfers(evidence_version_id);
create index ownership_transfers_actor_idx on portfolio.ownership_transfers(executed_by);

create table portfolio.ownership_transfer_manifests(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 transfer_id uuid not null unique references portfolio.ownership_transfers(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 manifest_version integer not null default 1 check(manifest_version=1),
 transferable_facts jsonb not null,
 created_at timestamptz not null default statement_timestamp(),
 check(jsonb_typeof(transferable_facts)='object')
);
create index ownership_transfer_manifests_tenant_idx on portfolio.ownership_transfer_manifests(tenant_id);
create index ownership_transfer_manifests_property_idx on portfolio.ownership_transfer_manifests(property_id);
create index ownership_transfer_manifests_unit_idx on portfolio.ownership_transfer_manifests(unit_id);

create table portfolio.relationship_terminations(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 contractual_buyer_relationship_id uuid not null unique references portfolio.contractual_buyer_relationships(id) on delete restrict,
 ownership_transfer_id uuid not null unique references portfolio.ownership_transfers(id) on delete restrict,
 effective_on date not null,
 created_at timestamptz not null default statement_timestamp()
);
create index relationship_terminations_tenant_idx on portfolio.relationship_terminations(tenant_id);

alter table portfolio.ownership_transfers enable row level security;
alter table portfolio.ownership_transfer_manifests enable row level security;
alter table portfolio.relationship_terminations enable row level security;
revoke all on portfolio.ownership_transfers,portfolio.ownership_transfer_manifests,
 portfolio.relationship_terminations from public,anon,authenticated,service_role;

create function app_private.protect_ownership_transfer_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception 'ownership_transfer_history_immutable' using errcode='55000';
end;$$;
create trigger immutable_ownership_transfer before update or delete on portfolio.ownership_transfers
 for each row execute function app_private.protect_ownership_transfer_v1();
create trigger immutable_ownership_transfer_manifest before update or delete on portfolio.ownership_transfer_manifests
 for each row execute function app_private.protect_ownership_transfer_v1();
create trigger immutable_relationship_termination before update or delete on portfolio.relationship_terminations
 for each row execute function app_private.protect_ownership_transfer_v1();
revoke all on function app_private.protect_ownership_transfer_v1()
 from public,anon,authenticated,service_role;

create or replace function app_private.assert_relationship_workspace_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_permission text
) returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null
   or p_property_id is null or p_permission not in
    ('core.relationships.propose','core.relationships.review','core.relationships.read',
     'core.relationships.execute','core.relationships.transfer') then
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
 if not found then raise exception 'core_relationship_access_denied' using errcode='42501';end if;
 return v_tenant;
end;$$;
revoke all on function app_private.assert_relationship_workspace_v1(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;

create function customer_api.execute_verified_ownership_transfer_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_proposal_id uuid,
 p_document_context_id uuid,p_evidence_version_id uuid,p_expected_outgoing_ownership_id uuid,
 p_expected_outgoing_valid_from date,p_expected_share numeric,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_tenant uuid; v_proposal portfolio.relationship_proposals%rowtype;
 v_review portfolio.relationship_reviews%rowtype; v_out portfolio.ownerships%rowtype;
 v_in portfolio.ownerships%rowtype; v_evidence documents.document_versions%rowtype;
 v_document documents.documents%rowtype; v_existing portfolio.ownership_transfers%rowtype;
 v_transfer portfolio.ownership_transfers%rowtype; v_reference text; v_hash text;
 v_contractual uuid; v_manifest jsonb; v_actor record; v_response jsonb;
begin
 if p_context_id is null or p_workspace_id is null or p_property_id is null
  or p_proposal_id is null or p_document_context_id is null or p_evidence_version_id is null
  or p_expected_outgoing_ownership_id is null or p_expected_outgoing_valid_from is null
  or p_expected_share is null or p_expected_share<=0 or p_expected_share>1
  or p_idempotency_key is null
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'core_ownership_transfer_invalid' using errcode='22023';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
  raise exception 'mfa_required' using errcode='42501';
 end if;
 perform 1 from portfolio.properties where id=p_property_id for update;
 v_tenant=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,p_property_id,'core.relationships.transfer');
 select * into v_proposal from portfolio.relationship_proposals
  where id=p_proposal_id and tenant_id=v_tenant and customer_workspace_id=p_workspace_id
   and property_id=p_property_id for share;
 select * into v_review from portfolio.relationship_reviews
  where proposal_id=p_proposal_id and tenant_id=v_tenant for share;
 if v_proposal.id is null or v_proposal.kind<>'ownership_transfer'
  or v_proposal.source_party_id is null or v_review.id is null
  or v_review.decision<>'verified'
  or v_review.evidence_reference is distinct from v_proposal.evidence_reference
  or v_proposal.effective_from<>current_date or v_proposal.effective_to is not null then
  raise exception 'core_ownership_transfer_not_verified' using errcode='22023';
 end if;
 perform 1 from portfolio.units u join portfolio.buildings b
  on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_proposal.unit_id and u.tenant_id=v_tenant and b.property_id=p_property_id
  for update of u;
 if not found then raise exception 'core_ownership_transfer_subject_mismatch' using errcode='22023';end if;
 v_evidence=app_private.require_airprop_diligence_evidence_v1(
  p_document_context_id,p_workspace_id,p_evidence_version_id,true);
 select * into v_document from documents.documents where id=v_evidence.document_id for share;
 v_reference='urn:cladora:document-version:'||p_evidence_version_id::text;
 if v_document.property_id is distinct from p_property_id
  or v_document.evidence_type is distinct from 'signed_deed'
  or v_proposal.evidence_reference is distinct from v_reference then
  raise exception 'core_ownership_transfer_evidence_mismatch' using errcode='22023';
 end if;
 v_hash=encode(sha256(convert_to(jsonb_build_object(
  'actor',auth.uid(),'context',p_context_id,'workspace',p_workspace_id,
  'property',p_property_id,'proposal',p_proposal_id,'evidence',p_evidence_version_id,
  'outgoing',p_expected_outgoing_ownership_id,'valid_from',p_expected_outgoing_valid_from,
  'share',p_expected_share)::text,'UTF8')),'hex');
 select * into v_existing from portfolio.ownership_transfers
  where tenant_id=v_tenant and relationship_proposal_id=p_proposal_id
   and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.executed_by is distinct from auth.uid()
   or v_existing.request_hash is distinct from v_hash then
   raise exception 'core_ownership_transfer_idempotency_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('transfer_id',v_existing.id,
   'outgoing_ownership_id',v_existing.outgoing_ownership_id,
   'incoming_ownership_id',v_existing.incoming_ownership_id,
   'status','transferred','effective_on',v_existing.effective_on,'idempotent',true);
 end if;
 if exists(select 1 from portfolio.ownership_transfers where relationship_proposal_id=p_proposal_id) then
  raise exception 'core_ownership_transfer_already_executed' using errcode='23505';
 end if;
 select * into v_out from portfolio.ownerships where id=p_expected_outgoing_ownership_id for update;
 if v_out.id is null or v_out.tenant_id<>v_tenant or v_out.unit_id<>v_proposal.unit_id
  or v_out.party_id<>v_proposal.source_party_id or v_out.valid_from<>p_expected_outgoing_valid_from
  or v_out.valid_to is not null or v_out.share<>p_expected_share
  or v_out.finalized_at is not null then
  raise exception 'core_ownership_transfer_stale_baseline' using errcode='40001';
 end if;
 update portfolio.ownerships set valid_to=v_proposal.effective_from,
  finalized_at=statement_timestamp() where id=v_out.id;
 insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from,evidence_id,finalized_at)
 values(v_tenant,v_proposal.unit_id,v_proposal.target_party_id,v_out.share,
  v_proposal.effective_from,p_evidence_version_id,statement_timestamp()) returning * into v_in;
 insert into portfolio.ownership_transfers(
  tenant_id,property_id,unit_id,relationship_proposal_id,outgoing_ownership_id,
  incoming_ownership_id,source_party_id,target_party_id,evidence_version_id,
  effective_on,share,executed_by,idempotency_key,request_hash)
 values(v_tenant,p_property_id,v_proposal.unit_id,p_proposal_id,v_out.id,v_in.id,
  v_proposal.source_party_id,v_proposal.target_party_id,p_evidence_version_id,
  v_proposal.effective_from,v_out.share,auth.uid(),p_idempotency_key,v_hash)
 returning * into v_transfer;
 v_manifest=jsonb_build_object('version',1,'property_id',p_property_id,
  'unit_id',v_proposal.unit_id,'transfer_id',v_transfer.id,
  'outgoing_ownership_id',v_out.id,'incoming_ownership_id',v_in.id,
  'effective_on',v_proposal.effective_from,'share',v_out.share,
  'categories',jsonb_build_array('canonical_unit_identity','ownership_interval','transfer_receipt'),
  'excluded',jsonb_build_array('seller_private_documents','private_conversations',
   'credentials','workspace_roles','payment_authority'));
 insert into portfolio.ownership_transfer_manifests(
  tenant_id,transfer_id,property_id,unit_id,transferable_facts)
 values(v_tenant,v_transfer.id,p_property_id,v_proposal.unit_id,v_manifest);
 select r.id into v_contractual from portfolio.contractual_buyer_relationships r
  where r.tenant_id=v_tenant and r.unit_id=v_proposal.unit_id
   and r.buyer_party_id=v_proposal.target_party_id
   and r.valid_from<=v_proposal.effective_from
   and (r.valid_to is null or r.valid_to>v_proposal.effective_from)
  order by r.created_at desc limit 1;
 if v_contractual is not null then
  insert into portfolio.relationship_terminations(
   tenant_id,contractual_buyer_relationship_id,ownership_transfer_id,effective_on)
  values(v_tenant,v_contractual,v_transfer.id,v_proposal.effective_from);
 end if;
 insert into occupancy.lifecycle_events(
  tenant_id,entity_type,entity_id,event_type,status_from,status_to,reason)
 values(v_tenant,'ownership',v_out.id,'verified_ownership_transfer','current','historical',
  'Independently reviewed signed deed'),
 (v_tenant,'ownership',v_in.id,'verified_ownership_transfer',null,'current',
  'Independently reviewed signed deed');
 v_response=jsonb_build_object('version',1,'transfer_id',v_transfer.id,
  'outgoing_ownership_id',v_out.id,'incoming_ownership_id',v_in.id,
  'status','transferred','effective_on',v_proposal.effective_from,'idempotent',false);
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,
  before_snapshot,after_snapshot,reason)
 values(v_tenant,auth.uid(),v_actor.role_code,'CORE_OWNERSHIP_TRANSFER_EXECUTED',
  'portfolio.ownership_transfer',v_transfer.id,
  jsonb_build_object('ownership_id',v_out.id,'party_id',v_out.party_id,
   'valid_from',v_out.valid_from,'share',v_out.share),v_response-'idempotent',
  'Verified deed; no role, account link, private document or payment authority transfer');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,
  event_type,payload)
 values(v_tenant,'portfolio.ownership_transfer',v_transfer.id,1,
  'core.relationship.ownership_transferred.v1',v_response-'idempotent');
 return v_response;
end;$$;

revoke all on function customer_api.execute_verified_ownership_transfer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)
 from public,anon,service_role;
grant execute on function customer_api.execute_verified_ownership_transfer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text) to authenticated;

comment on table portfolio.ownership_transfers is
 'Immutable T06 receipt joining reviewed deed evidence to canonical dated ownership intervals.';
comment on table portfolio.ownership_transfer_manifests is
 'Allowlisted transferable property facts only; never an ACL, role, private-document or payment grant.';
comment on function customer_api.execute_verified_ownership_transfer_v1(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text) is
 'Atomically closes the exact current ownership and creates its verified successor without copying software authority.';

commit;
