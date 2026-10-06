begin;

-- A review is an evidence decision only. Neither command changes title,
-- tenancy, invitations, workspace grants, or historical visibility.
insert into identity.permissions(code,resource,action,description) values
 ('core.relationships.propose','core.relationships','propose','Propose a dated relationship for independent review'),
 ('core.relationships.review','core.relationships','review','Review a dated relationship proposal independently'),
 ('core.relationships.read','core.relationships','read','Read review ledger for the originating workspace')
on conflict(code) do nothing;
insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,case when p.action='read' then 'read' else 'manage' end,
 true,false,true,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='core_unit_identity' and m.version=1
 and p.code in ('core.relationships.propose','core.relationships.review','core.relationships.read')
on conflict(module_definition_id,permission_id,binding_version) do nothing;

alter table portfolio.relationship_proposals
 add column request_id uuid,
 add column idempotency_key text,
 add column request_hash text;
create unique index relationship_proposals_idempotency_idx
 on portfolio.relationship_proposals(tenant_id,customer_workspace_id,proposed_by,idempotency_key)
 where idempotency_key is not null;
alter table portfolio.relationship_reviews
 add column request_id uuid,
 add column idempotency_key text,
 add column request_hash text;

create function app_private.assert_relationship_workspace_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_permission text
) returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null
   or p_property_id is null or p_permission not in
    ('core.relationships.propose','core.relationships.review','core.relationships.read') then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 -- The property lock serializes these commands with mandate revocation.
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

create function customer_api.propose_core_relationship_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_unit_id uuid,
 p_kind text,p_source_party_id uuid,p_target_party_id uuid,
 p_effective_from date,p_effective_to date,p_evidence_reference text,p_reason text,
 p_request_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_hash text;v_existing record;v_id uuid;
begin
 if p_request_id is null or p_idempotency_key is null
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or p_kind not in ('contractual_buyer','ownership_transfer','lease')
  or p_unit_id is null or p_target_party_id is null or p_effective_from is null
  or (p_effective_to is not null and p_effective_to<=p_effective_from)
  or (p_kind<>'contractual_buyer' and p_source_party_id is null)
  or p_evidence_reference is null or length(btrim(p_evidence_reference)) not between 15 and 500
  or p_reason is null or length(btrim(p_reason)) not between 8 and 500 then
  raise exception 'core_relationship_invalid' using errcode='22023';
 end if;
 -- Writers serialize on the property before checking live permission and
 -- replay state. Read-only list calls keep the lighter shared lock.
 perform 1 from portfolio.properties where id=p_property_id for update;
 v_tenant:=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,p_property_id,'core.relationships.propose');
 if not exists(select 1 from portfolio.units u join portfolio.buildings b
    on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_unit_id and u.tenant_id=v_tenant and b.property_id=p_property_id) then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 v_hash:=encode(sha256(convert_to(jsonb_build_object(
   'context',p_context_id,'property',p_property_id,'unit',p_unit_id,'kind',p_kind,
   'source',p_source_party_id,'target',p_target_party_id,'from',p_effective_from,
   'to',p_effective_to,'evidence',p_evidence_reference,'reason',p_reason,
   'request',p_request_id)::text,'UTF8')),'hex');
 select id,request_hash into v_existing from portfolio.relationship_proposals
  where tenant_id=v_tenant and customer_workspace_id=p_workspace_id
   and proposed_by=auth.uid() and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.request_hash is distinct from v_hash then
   raise exception 'core_relationship_idempotency_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('proposal_id',v_existing.id,'idempotent',true);
 end if;
 insert into portfolio.relationship_proposals
  (tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,
   target_party_id,effective_from,effective_to,evidence_reference,reason,proposed_by,
   request_id,idempotency_key,request_hash)
 values(v_tenant,p_property_id,p_unit_id,p_workspace_id,p_kind,p_source_party_id,
  p_target_party_id,p_effective_from,p_effective_to,p_evidence_reference,p_reason,
  auth.uid(),p_request_id,p_idempotency_key,v_hash)
 returning id into v_id;
 return jsonb_build_object('proposal_id',v_id,'idempotent',false);
end;$$;
revoke all on function customer_api.propose_core_relationship_v1
 (uuid,uuid,uuid,uuid,text,uuid,uuid,date,date,text,text,uuid,text)
 from public,anon,service_role;
grant execute on function customer_api.propose_core_relationship_v1
 (uuid,uuid,uuid,uuid,text,uuid,uuid,date,date,text,text,uuid,text) to authenticated;

create function customer_api.review_core_relationship_v1(
 p_context_id uuid,p_workspace_id uuid,p_proposal_id uuid,p_decision text,
 p_evidence_reference text,p_reason text,p_request_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_proposal record;v_tenant uuid;v_hash text;v_existing record;v_id uuid;
begin
 if p_proposal_id is null or p_request_id is null or p_idempotency_key is null
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or p_decision not in ('verified','rejected')
  or p_evidence_reference is null or length(btrim(p_evidence_reference)) not between 15 and 500
  or p_reason is null or length(btrim(p_reason)) not between 8 and 500 then
  raise exception 'core_relationship_invalid' using errcode='22023';
 end if;
 select tenant_id,property_id,customer_workspace_id,proposed_by into v_proposal
 from portfolio.relationship_proposals where id=p_proposal_id;
 if not found or v_proposal.customer_workspace_id is distinct from p_workspace_id
  or v_proposal.proposed_by=auth.uid() then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 perform 1 from portfolio.properties where id=v_proposal.property_id for update;
 v_tenant:=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,v_proposal.property_id,'core.relationships.review');
 if v_tenant is distinct from v_proposal.tenant_id then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 select id,request_hash,reviewed_by into v_existing from portfolio.relationship_reviews
  where proposal_id=p_proposal_id;
 v_hash:=encode(sha256(convert_to(jsonb_build_object(
  'proposal',p_proposal_id,'context',p_context_id,'decision',p_decision,
  'evidence',p_evidence_reference,'reason',p_reason,'request',p_request_id,
  'key',p_idempotency_key)::text,'UTF8')),'hex');
 if found then
  if v_existing.reviewed_by is distinct from auth.uid()
   or v_existing.request_hash is distinct from v_hash then
   raise exception 'core_relationship_review_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('review_id',v_existing.id,'idempotent',true);
 end if;
 insert into portfolio.relationship_reviews
  (proposal_id,tenant_id,decision,evidence_reference,reason,reviewed_by,
   request_id,idempotency_key,request_hash)
 values(p_proposal_id,v_tenant,p_decision,p_evidence_reference,p_reason,
  auth.uid(),p_request_id,p_idempotency_key,v_hash)
 returning id into v_id;
 return jsonb_build_object('review_id',v_id,'idempotent',false);
end;$$;
revoke all on function customer_api.review_core_relationship_v1
 (uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,service_role;
grant execute on function customer_api.review_core_relationship_v1
 (uuid,uuid,uuid,text,text,text,uuid,text) to authenticated;

create function customer_api.list_core_relationship_proposals_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_rows jsonb;
begin
 v_tenant:=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,p_property_id,'core.relationships.read');
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'unit_id',p.unit_id,'kind',p.kind,'source_party_id',p.source_party_id,
  'target_party_id',p.target_party_id,'effective_from',p.effective_from,
  'effective_to',p.effective_to,'evidence_reference',p.evidence_reference,
  'reason',p.reason,'proposed_at',p.proposed_at,'proposed_by',p.proposed_by,
  'review_id',r.id,'decision',r.decision,'reviewed_by',r.reviewed_by,
  'reviewed_at',r.reviewed_at) order by p.proposed_at desc,p.id desc),'[]'::jsonb)
 into v_rows from portfolio.relationship_proposals p
 left join portfolio.relationship_reviews r on r.proposal_id=p.id
 where p.tenant_id=v_tenant and p.customer_workspace_id=p_workspace_id
  and p.property_id=p_property_id;
 return jsonb_build_object('proposals',v_rows);
end;$$;
revoke all on function customer_api.list_core_relationship_proposals_v1(uuid,uuid,uuid)
 from public,anon,service_role;
grant execute on function customer_api.list_core_relationship_proposals_v1(uuid,uuid,uuid)
 to authenticated;

create function customer_api.list_core_relationship_subjects_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_units jsonb;v_parties jsonb;
begin
 v_tenant:=app_private.assert_relationship_workspace_v1(
  p_context_id,p_workspace_id,p_property_id,'core.relationships.read');
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'code',u.code,
  'building',b.name) order by b.name,u.code),'[]'::jsonb) into v_units
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
 where u.tenant_id=v_tenant and b.tenant_id=v_tenant and b.property_id=p_property_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.legal_name)
  order by p.legal_name,p.id),'[]'::jsonb) into v_parties
 from portfolio.parties p where p.tenant_id=v_tenant and p.archived_at is null;
 return jsonb_build_object('units',v_units,'parties',v_parties);
end;$$;
revoke all on function customer_api.list_core_relationship_subjects_v1(uuid,uuid,uuid)
 from public,anon,service_role;
grant execute on function customer_api.list_core_relationship_subjects_v1(uuid,uuid,uuid)
 to authenticated;

create function customer_api.list_core_relationship_properties_v1(
 p_context_id uuid,p_workspace_id uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null
  or app_private.check_workspace_native_permission_v2(
   p_context_id,p_workspace_id,'core.relationships.read','core_unit_identity') is not true then
  raise exception 'core_relationship_access_denied' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)
  order by p.name,p.id),'[]'::jsonb) into v_rows
 from portfolio.properties p
 join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=p.tenant_id
 where exists(select 1 from platform.workspace_property_authorities a
  where a.property_id=p.id and a.tenant_id=p.tenant_id and a.customer_workspace_id=w.id
   and a.purpose='property_operations' and a.status='active' and a.valid_from<=clock_timestamp()
   and (a.valid_to is null or a.valid_to>clock_timestamp()))
  and app_private.current_workspace_property_mandate_v1(
   p_context_id,p_workspace_id,p.id,'property_operations') is not null;
 return jsonb_build_object('properties',v_rows);
end;$$;
revoke all on function customer_api.list_core_relationship_properties_v1(uuid,uuid)
 from public,anon,service_role;
grant execute on function customer_api.list_core_relationship_properties_v1(uuid,uuid)
 to authenticated;
commit;
