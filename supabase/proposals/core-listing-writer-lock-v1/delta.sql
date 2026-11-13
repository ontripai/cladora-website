-- Inactive versioned writer-order delta. NOT a migration/installer.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $not_admitted$ BEGIN
 RAISE EXCEPTION 'core_listing_writer_adoption_not_admitted' USING ERRCODE='55000';
END $not_admitted$;
-- Separate reviewed adoption must rebind private target/metadata/presence first.
-- Quiescent schema-change window is mandatory; no shared-catalog lock is added.
DO $check$
DECLARE e jsonb; r record; p pg_proc; owner_role pg_roles; epoch pg_class;
BEGIN
 e:=nullif(current_setting('cladora.listing_writer_target_v1',true),'')::jsonb;
 IF e IS NULL OR e->>'database_name' IS DISTINCT FROM current_database()
  OR e->>'database_oid' IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'listing_writer_target_unbound' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT epoch FROM pg_class WHERE oid='app_private.canonical_authority_revision_v1'::regclass;
 FOR r IN SELECT * FROM(VALUES
('customer_api.claim_unit_invitation_v1(uuid,text)','50ca5c4f3faf03cfac8306179f7eb43c2c7e8ac43872a70633038dd0ccabc437'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)','cd59f8cb0b982055876208c07ba67e2cb8ea3491ef890a3c0dc5921806fef094'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)','b59484b294f4db837f88a9d146e094e2196b39bd8604fe480795f4448bd06393'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)','767a3fc6993a843ab56973247bf8aa3544da57e2e5df53b12df2151c95210f98'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)','bbbe914c9e5a3709e7295392133de92cbaddf582fdee9737550812e0dd1885ac'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','33159166ecb28bb65adbaf292a08973fa5d6d32a7cb70b38c535d98fced3b6c4'),
('customer_api.register_service_self_person_v1(jsonb)','810c77770a9cf8e68d8fe144fd50a505e83a8904462afd3f8c56ac624718d7cf'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)','2e9e73ed771c163d25525508d877a77d25d3da5dba2eccf9d1a24abc17721136')
 )v(signature,body_sha256) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND THEN
   IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'absent' THEN
    RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
   CONTINUE;
  END IF;
  IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'present' THEN
   RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
  IF encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.body_sha256
   OR NOT p.prosecdef OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   OR NOT pg_has_role(current_user,p.proowner,'USAGE')
  THEN RAISE EXCEPTION 'listing_writer_source_or_owner_mismatch' USING ERRCODE='55000'; END IF;
  SELECT * INTO STRICT owner_role FROM pg_roles WHERE oid=p.proowner;
  IF NOT has_schema_privilege(owner_role.oid,'app_private','USAGE')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'singleton','SELECT')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'revision','UPDATE')
   OR (epoch.relrowsecurity AND NOT(owner_role.rolsuper OR owner_role.rolbypassrls
     OR(epoch.relowner=owner_role.oid AND NOT epoch.relforcerowsecurity)))
  THEN RAISE EXCEPTION 'listing_writer_epoch_privilege_or_rls_not_proven' USING ERRCODE='55000'; END IF;
  -- Private admitted snapshot of ALL non-body catalog attributes, not only ACL.
  IF e->'routine_metadata'->>r.signature IS DISTINCT FROM
   encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'listing_writer_metadata_unbound' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM app_private.canonical_authority_revision_v1 WHERE singleton) THEN
  RAISE EXCEPTION 'canonical_authority_revision_unavailable' USING ERRCODE='55000'; END IF;
END
$check$;

CREATE TEMP TABLE core_listing_writer_before_v1 ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p)-'prosrc' AS metadata FROM pg_proc p
 WHERE p.oid IN (to_regprocedure('customer_api.claim_unit_invitation_v1(uuid,text)'),to_regprocedure('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)'),to_regprocedure('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)'),to_regprocedure('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'),to_regprocedure('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)'),to_regprocedure('maintenance.register_contractor_v1(uuid,uuid,text,text)'),to_regprocedure('customer_api.register_service_self_person_v1(jsonb)'),to_regprocedure('customer_api.claim_unit_invitation_core_v1(uuid,text)'));
-- Exact source: supabase/migrations/20260929065846_owner_portfolio_manager_invite.sql:108
DO $replace_0$ BEGIN
 IF to_regprocedure('customer_api.claim_unit_invitation_v1(uuid,text)') IS NOT NULL THEN
  EXECUTE $definition_0$create or replace function customer_api.claim_unit_invitation_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_i communications.unit_invitations; v_result jsonb; v_portfolio platform.invited_owner_portfolios;
  v_tenant uuid; v_membership uuid; v_private uuid; v_unit portfolio.units; v_building portfolio.buildings;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if not found then raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  v_result:=customer_api.claim_unit_invitation_core_v1(p_invitation,p_display_name);
  if not v_i.owner_portfolio_requested then return v_result; end if;
  if v_i.role_code<>'owner' or not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,'owner') then
    raise exception 'owner_relationship_required' using errcode='42501'; end if;
  select * into v_portfolio from platform.invited_owner_portfolios where owner_user_id=auth.uid() for update;
  if v_portfolio.owner_user_id is null then
    insert into platform.tenants(legal_name,registration_number,status,default_locale)
      values(left('Owner portfolio · '||trim(p_display_name),255),
        'CLD-INVITED-'||replace(auth.uid()::text,'-',''),'active','ro') returning id into v_tenant;
    insert into identity.memberships(tenant_id,user_id,role_id,status)
      values(v_tenant,auth.uid(),(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),
        'active') returning id into v_membership;
    insert into platform.invited_owner_portfolios(owner_user_id,tenant_id,membership_id)
      values(auth.uid(),v_tenant,v_membership);
  else
    update identity.memberships set status='active' where id=v_portfolio.membership_id and status<>'active';
  end if;
  select * into v_unit from portfolio.units where id=v_i.unit_id;
  select * into v_building from portfolio.buildings where id=v_unit.building_id;
  select private_unit_id into v_private from platform.invited_owner_units
    where owner_user_id=auth.uid() and canonical_unit_id=v_i.unit_id;
  if v_private is null then
    insert into public.owner_private_units(owner_user_id,building_label,unit_label,address_text)
      values(auth.uid(),v_building.name,v_unit.code,
        left(coalesce(nullif(trim(v_building.name),''),'Building')||' · '||v_unit.code,500)) returning id into v_private;
    insert into platform.invited_owner_units(invitation_id,owner_user_id,private_unit_id,canonical_unit_id,ownership_party_id)
      values(v_i.id,auth.uid(),v_private,v_i.unit_id,v_i.party_id);
  else
    update platform.invited_owner_units set invitation_id=v_i.id,
      ownership_party_id=v_i.party_id,revoked_at=null
      where owner_user_id=auth.uid() and canonical_unit_id=v_i.unit_id;
    update public.owner_private_units set status='active' where id=v_private and owner_user_id=auth.uid();
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,auth.uid(),'owner_portfolio.invitation_accept','communications.unit_invitation',v_i.id);
  return v_result||jsonb_build_object('owner_portfolio',true,'private_unit_id',v_private);
end $$;$definition_0$;
 END IF;
END $replace_0$;

-- Exact source: supabase/migrations/20261007092932_lifecycle_verified_ownership_transfer.sql:120
DO $replace_1$ BEGIN
 IF to_regprocedure('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)') IS NOT NULL THEN
  EXECUTE $definition_1$create or replace function customer_api.execute_verified_ownership_transfer_v1(
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
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

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
end;$$;$definition_1$;
 END IF;
END $replace_1$;

-- Exact source: supabase/migrations/20260928130116_20260928113655_scoped_unit_invitations.sql:119
DO $replace_2$ BEGIN
 IF to_regprocedure('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)') IS NOT NULL THEN
  EXECUTE $definition_2$create or replace function customer_api.register_unit_invite_relationship_v1(
  p_context uuid,p_workspace uuid,p_unit uuid,p_role text,p_name text,p_evidence text,
  p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_tenant uuid; v_party uuid; v_landlord uuid;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(v_actor,p_context,p_workspace,p_unit)
    or p_role not in ('owner','tenant_resident')
    or length(trim(coalesce(p_name,''))) not between 2 and 120
    or length(trim(coalesce(p_evidence,''))) not between 15 and 500
    or p_starts_on is null or p_starts_on>current_date
    or (p_ends_on is not null and p_ends_on<=current_date) then
    raise exception 'unit_relationship_registration_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from portfolio.units where id=p_unit for update;
  if p_role='owner' then
    if exists(select 1 from portfolio.ownerships o where o.unit_id=p_unit
      and o.tenant_id=v_tenant and o.valid_from<coalesce(p_ends_on,'infinity'::date)
      and coalesce(o.valid_to,'infinity'::date)>p_starts_on) then
      raise exception 'existing_ownership_requires_review' using errcode='23505'; end if;
  else
    select o.party_id into v_landlord from portfolio.ownerships o
      where o.unit_id=p_unit and o.tenant_id=v_tenant and o.valid_from<=current_date
        and (o.valid_to is null or o.valid_to>current_date)
      order by o.id limit 1;
    if v_landlord is null or exists(select 1 from occupancy.leases l where l.unit_id=p_unit
      and l.tenant_id=v_tenant and l.status='active'
      and l.starts_on<coalesce(p_ends_on,'infinity'::date)
      and coalesce(l.ends_on,'infinity'::date)>p_starts_on) then
      raise exception 'existing_lease_requires_review' using errcode='23505'; end if;
  end if;
  insert into portfolio.parties(tenant_id,type,legal_name)
    values(v_tenant,'person',trim(p_name)) returning id into v_party;
  if p_role='owner' then
    insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from,valid_to)
      values(v_tenant,p_unit,v_party,1,p_starts_on,p_ends_on);
  else
    insert into occupancy.leases(tenant_id,unit_id,landlord_party_id,tenant_party_id,
      starts_on,ends_on,status) values(v_tenant,p_unit,v_landlord,v_party,p_starts_on,p_ends_on,'active');
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,v_actor,'unit_invitation.relationship_attested','portfolio.party',v_party,
      jsonb_build_object('unit_id',p_unit,'workspace_id',p_workspace,
        'role_code',p_role,'basis',trim(p_evidence),'starts_on',p_starts_on,'ends_on',p_ends_on));
  return jsonb_build_object('party_id',v_party,'role_code',p_role);
end $$;$definition_2$;
 END IF;
END $replace_2$;

-- Exact source: supabase/migrations/20260913063638_residential_pilot_import_completion.sql:168
DO $replace_3$ BEGIN
 IF to_regprocedure('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)') IS NOT NULL THEN
  EXECUTE $definition_3$create or replace function app_private.onboarding_commit_residential_internal_v1(p_run_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,portfolio,occupancy,finance,billing,utilities,extensions
as $$
declare r platform.import_runs;z record;p jsonb;cid uuid;pid uuid;bid uuid;eid uuid;uid uuid;party uuid;meter uuid;
  opening_journal uuid;opening_date date;debits numeric(20,4):=0;credits numeric(20,4):=0;
  ar_gl numeric(20,4):=0;ar_sub numeric(20,4):=0;advance_gl numeric(20,4):=0;rh text;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

  select * into r from platform.import_runs where id=p_run_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.tenant_id::text||':'||coalesce(r.property_id::text,r.id::text),0));
  if exists(select 1 from platform.import_row_issues where run_id=r.id and severity='blocking') then raise exception 'blocking_import_issues_exist' using errcode='23514'; end if;
  if exists(select 1 from platform.import_rows where run_id=r.id and classification<>'new') then raise exception 'non_new_row_requires_forward_correction' using errcode='22023'; end if;

  for z in select x.* from platform.import_rows x join platform.import_templates t on t.code=x.template_code
    where x.run_id=r.id and x.template_code not in ('opening_gl','open_receivable') order by t.dependency_order,x.source_row_no for update of x loop
    p:=z.normalized_payload; cid:=null;
    if z.template_code='property' then
      if r.property_id is not null then raise exception 'property_already_bound' using errcode='22023'; end if;
      insert into portfolio.properties(tenant_id,type,name,base_currency,status)
      values(r.tenant_id,coalesce((p->>'type')::portfolio.property_type,'condominium'),p->>'name',coalesce(p->>'currency','RON'),'draft') returning id into cid;
      update platform.import_runs set property_id=cid where id=r.id; r.property_id:=cid;
    elsif z.template_code='building' then
      insert into portfolio.buildings(tenant_id,property_id,code,name,year_built,floors,status)
      values(r.tenant_id,r.property_id,p->>'code',p->>'name',nullif(p->>'year_built','')::smallint,nullif(p->>'floors','')::smallint,'active') returning id into cid;
    elsif z.template_code='entrance' then
      bid:=app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key');
      if bid is null then raise exception 'building_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.entrances(tenant_id,building_id,code,name) values(r.tenant_id,bid,p->>'code',p->>'name') returning id into cid;
    elsif z.template_code='unit' then
      bid:=app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key');
      eid:=case when nullif(p->>'entrance_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'entrance',p->>'entrance_key') end;
      if bid is null then raise exception 'building_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.units(tenant_id,building_id,entrance_id,code,floor,area_m2,bedrooms,status)
      values(r.tenant_id,bid,eid,p->>'code',nullif(p->>'floor','')::smallint,nullif(p->>'area_m2','')::numeric,nullif(p->>'bedrooms','')::smallint,'active') returning id into cid;
    elsif z.template_code='party' then
      insert into portfolio.parties(tenant_id,type,legal_name) values(r.tenant_id,coalesce((p->>'type')::portfolio.party_type,'person'),p->>'legal_name') returning id into cid;
    elsif z.template_code='ownership' then
      uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',p->>'party_key');
      if uid is null or party is null then raise exception 'ownership_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from,valid_to)
      values(r.tenant_id,uid,party,(p->>'share')::numeric,(p->>'valid_from')::date,nullif(p->>'valid_to','')::date) returning id into cid;
    elsif z.template_code='occupancy' then
      uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',p->>'party_key');
      if uid is null or party is null then raise exception 'occupancy_dependency_missing' using errcode='23503'; end if;
      insert into occupancy.occupancies(tenant_id,unit_id,kind,status,starts_at,ends_at)
      values(r.tenant_id,uid,(p->>'kind')::occupancy.occupancy_kind,'active',(p->>'starts_at')::timestamptz,nullif(p->>'ends_at','')::timestamptz) returning id into cid;
      insert into occupancy.occupants(occupancy_id,party_id,role,resident_weight) values(cid,party,coalesce(p->>'role','resident'),coalesce(nullif(p->>'resident_weight','')::numeric,1));
    elsif z.template_code='account' then
      insert into finance.accounts(tenant_id,property_id,code,name,type,currency,is_control_account)
      values(r.tenant_id,r.property_id,p->>'code',p->>'name',(p->>'type')::finance.account_type,coalesce(p->>'currency','RON'),coalesce((p->>'is_control_account')::boolean,false)) returning id into cid;
    elsif z.template_code='meter' then
      bid:=case when nullif(p->>'building_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key') end;
      uid:=case when nullif(p->>'unit_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key') end;
      insert into utilities.meters(tenant_id,property_id,building_id,unit_id,service_type,scope,serial_fingerprint,unit_code,multiplier,installed_on,status)
      values(r.tenant_id,r.property_id,bid,uid,(p->>'service_type')::utilities.service_type,(p->>'scope')::utilities.meter_scope,lower(p->>'serial_fingerprint'),p->>'unit_code',coalesce(nullif(p->>'multiplier','')::numeric,1),nullif(p->>'installed_on','')::date,'active') returning id into cid;
    elsif z.template_code='meter_reading' then
      meter:=app_private.onboarding_mapped_id_internal_v1(r.id,'meter',p->>'meter_key');
      if meter is null then raise exception 'meter_dependency_missing' using errcode='23503'; end if;
      insert into utilities.meter_readings(tenant_id,meter_id,reading_at,reading_value,method,status,entered_by,note)
      values(r.tenant_id,meter,(p->>'reading_at')::timestamptz,(p->>'reading_value')::numeric,'bulk_import','captured',p_actor,p->>'note') returning id into cid;
    else raise exception 'template_commit_handler_unconfigured:%',z.template_code using errcode='0A000'; end if;
    insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,z.template_code,cid,'created');
  end loop;

  -- Avoid polymorphic date tricks: derive and validate the single accounting date explicitly.
  select min((normalized_payload->>'occurred_on')::date) into opening_date from platform.import_rows where run_id=r.id and template_code='opening_gl';
  if opening_date is not null then
    if exists(select 1 from platform.import_rows where run_id=r.id and template_code='opening_gl' and (normalized_payload->>'occurred_on')::date<>opening_date) then raise exception 'multiple_opening_dates_forbidden' using errcode='22023'; end if;
    if not exists(select 1 from finance.accounting_periods ap where ap.tenant_id=r.tenant_id and ap.property_id=r.property_id and ap.status='open' and opening_date between ap.starts_on and ap.ends_on) then raise exception 'accounting_period_not_open' using errcode='55000'; end if;
    insert into finance.journals(tenant_id,property_id,occurred_on,currency,description,source_type,source_id,status)
    values(r.tenant_id,r.property_id,opening_date,'RON','Residential pilot opening balances','onboarding_import',r.id,'draft') returning id into opening_journal;
    for z in select * from platform.import_rows where run_id=r.id and template_code='opening_gl' order by source_row_no for update loop
      pid:=app_private.onboarding_mapped_id_internal_v1(r.id,'account',z.normalized_payload->>'account_key');
      uid:=case when nullif(z.normalized_payload->>'unit_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'unit',z.normalized_payload->>'unit_key') end;
      party:=case when nullif(z.normalized_payload->>'party_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'party',z.normalized_payload->>'party_key') end;
      if pid is null then raise exception 'opening_account_dependency_missing' using errcode='23503'; end if;
      insert into finance.journal_entries(tenant_id,journal_id,account_id,unit_id,party_id,side,amount,memo)
      values(r.tenant_id,opening_journal,pid,uid,party,(z.normalized_payload->>'side')::finance.entry_side,(z.normalized_payload->>'amount')::numeric,z.normalized_payload->>'memo') returning id into cid;
      insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,'opening_gl_entry',cid,'created');
    end loop;
    perform finance.assert_balanced(opening_journal);
    update finance.journals set status='posted',posted_by=p_actor where id=opening_journal;
  end if;

  for z in select * from platform.import_rows where run_id=r.id and template_code='open_receivable' order by source_row_no for update loop
    uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',z.normalized_payload->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',z.normalized_payload->>'party_key');
    if uid is null or party is null or opening_journal is null then raise exception 'receivable_dependency_missing' using errcode='23503'; end if;
    insert into billing.invoices(tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,due_on,currency,subtotal,tax_total,status,journal_id)
    values(r.tenant_id,r.property_id,uid,party,(z.normalized_payload->>'period_start')::date,(z.normalized_payload->>'period_end')::date,(z.normalized_payload->>'due_on')::date,coalesce(z.normalized_payload->>'currency','RON'),(z.normalized_payload->>'amount')::numeric,0,'draft',opening_journal) returning id into cid;
    insert into billing.invoice_lines(tenant_id,invoice_id,description,quantity,unit_price,line_subtotal,line_tax)
    values(r.tenant_id,cid,coalesce(z.normalized_payload->>'description','Opening receivable'),1,(z.normalized_payload->>'amount')::numeric,(z.normalized_payload->>'amount')::numeric,0);
    update billing.invoices set status='issued',issued_on=opening_date where id=cid;
    insert into billing.receivables(tenant_id,invoice_id,original_amount) values(r.tenant_id,cid,(z.normalized_payload->>'amount')::numeric);
    insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,'open_receivable',cid,'created');
  end loop;

  select coalesce(sum(case when e.side='debit' then e.amount else -e.amount end),0) into ar_gl from finance.journal_entries e join finance.accounts a on a.id=e.account_id where e.journal_id=opening_journal and a.code='4111';
  select coalesce(sum(rv.outstanding_amount),0) into ar_sub from billing.receivables rv join billing.invoices i on i.id=rv.invoice_id where i.tenant_id=r.tenant_id and i.property_id=r.property_id and i.journal_id=opening_journal;
  select coalesce(sum(case when e.side='credit' then e.amount else -e.amount end),0) into advance_gl from finance.journal_entries e join finance.accounts a on a.id=e.account_id where e.journal_id=opening_journal and a.code='419';
  if ar_gl<>ar_sub then raise exception 'opening_ar_parity_failed' using errcode='23514'; end if;
  if advance_gl<>0 then raise exception 'customer_advance_import_not_configured' using errcode='0A000'; end if;
  select coalesce(sum(amount)filter(where side='debit'),0),coalesce(sum(amount)filter(where side='credit'),0) into debits,credits from finance.journal_entries where journal_id=opening_journal;
  rh:=encode(extensions.digest(convert_to(jsonb_build_object('debits',debits,'credits',credits,'ar',ar_sub,'mappings',(select count(*) from platform.import_entity_mappings where run_id=r.id))::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object('journal_id',opening_journal,'debits',debits,'credits',credits,'ar_delta',ar_gl-ar_sub,'clearing_delta',advance_gl,'result_hash',rh);
end $$;$definition_3$;
 END IF;
END $replace_3$;

-- Exact source: supabase/migrations/20260913063638_residential_pilot_import_completion.sql:275
DO $replace_4$ BEGIN
 IF to_regprocedure('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)') IS NOT NULL THEN
  EXECUTE $definition_4$create or replace function app_private.onboarding_approve_import_commit_internal_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,extensions
as $$
declare c record;r platform.import_runs;s jsonb;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

  select * into c from app_private.import_context(p_context_id,'onboarding.import.approve',true);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status<>'pending_approval' then raise exception 'import_not_pending_approval' using errcode='22023'; end if;
  if r.created_by=auth.uid() or r.submitted_by=auth.uid() then raise exception 'dual_control_violation' using errcode='42501'; end if;
  update platform.import_runs set status='committing',approved_by=auth.uid() where id=r.id;
  s:=app_private.onboarding_commit_residential_internal_v1(r.id,auth.uid());
  update platform.import_runs set status='committed',committed_at=statement_timestamp(),result_hash=s->>'result_hash' where id=r.id;
  insert into platform.import_reconciliation_results(run_id,total_debits,total_credits,ar_delta,clearing_delta,evidence_json,result_hash,certified_by)
  values(r.id,(s->>'debits')::numeric,(s->>'credits')::numeric,(s->>'ar_delta')::numeric,(s->>'clearing_delta')::numeric,s,s->>'result_hash',auth.uid());
  update platform.import_runs set status='reconciled',reconciled_at=statement_timestamp() where id=r.id;
  return s||jsonb_build_object('status','reconciled');
end $$;$definition_4$;
 END IF;
END $replace_4$;

-- Exact source: supabase/migrations/20261004093017_audited_contractor_registration.sql:32
DO $replace_5$ BEGIN
 IF to_regprocedure('maintenance.register_contractor_v1(uuid,uuid,text,text)') IS NOT NULL THEN
  EXECUTE $definition_5$create or replace function maintenance.register_contractor_v1(p_context_id uuid,p_id uuid,p_name text,p_category text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; existing record; party_id uuid;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.manage');
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 200 or p_category is null or p_category not in ('ventilation','pump','elevator','fire_safety','other') then
  raise exception 'invalid_contractor' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,144));
 select vd.*,pt.legal_name into existing from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id where vd.id=p_id;
 if found then
  if existing.tenant_id<>v.tenant_id then raise exception 'contractor_not_found' using errcode='P0002'; end if;
  if existing.legal_name<>trim(p_name) or existing.service_categories<>array[p_category] then raise exception 'contractor_replay_conflict' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id,'status',existing.status);
 end if;
 insert into portfolio.parties(tenant_id,type,legal_name) values(v.tenant_id,'company',trim(p_name)) returning id into party_id;
 insert into maintenance.vendors(id,tenant_id,party_id,status,service_categories) values(p_id,v.tenant_id,party_id,'candidate',array[p_category]);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'CONTRACTOR_REGISTERED','maintenance.vendor',p_id,'Candidate contractor registered',jsonb_build_object('name',trim(p_name),'status','candidate','service_categories',array[p_category]));
 return jsonb_build_object('id',p_id,'status','candidate');
end $$;$definition_5$;
 END IF;
END $replace_5$;

-- Exact source: supabase/migrations/20261004202244_20261004200732_service_request_self_person_v1.sql:5
DO $replace_6$ BEGIN
 IF to_regprocedure('customer_api.register_service_self_person_v1(jsonb)') IS NOT NULL THEN
  EXECUTE $definition_6$create or replace function customer_api.register_service_self_person_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$declare
 v_actor uuid:=auth.uid();v_scope record;v_context uuid;v_workspace uuid;
 v_name text;v_until timestamptz;v_key text;v_hash text;
 v_idem platform.idempotency_keys%rowtype;v_party uuid;v_result jsonb;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

 if v_actor is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from auth.users where id=v_actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false) then
  raise exception 'self_person_access_denied' using errcode='42501';end if;
 if jsonb_typeof(p_request) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_request))<>6
 or not(p_request ?& array['context_id','workspace_id','name','valid_until','confirm_self','idempotency_key'])
 or p_request->'confirm_self' is distinct from 'true'::jsonb
 or jsonb_typeof(p_request->'name') is distinct from 'string'
 or jsonb_typeof(p_request->'valid_until') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string' then
  raise exception 'invalid_self_person' using errcode='22023';end if;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 v_name:=trim(p_request->>'name');v_until:=(p_request->>'valid_until')::timestamptz;
 if length(v_name) not between 2 and 120 or not isfinite(v_until)
 or v_until<=clock_timestamp() or v_until>clock_timestamp()+interval '72 hours'
 or (p_request->>'idempotency_key') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'invalid_self_person' using errcode='22023';end if;
 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.read');
 perform 1 from platform.customer_workspaces where id=v_workspace and tenant_id=v_scope.tenant_id and environment='PILOT' and lifecycle_status='ACTIVE' for share;
 if not found then raise exception 'pilot_required' using errcode='42501';end if;
 -- One lock per membership serializes different keys too; no orphan duplicate person.
 perform 1 from identity.memberships where id=v_scope.membership_id and tenant_id=v_scope.tenant_id and user_id=v_actor and status='active' for update;
 if not found then raise exception 'self_person_access_denied' using errcode='42501';end if;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.read');
 v_key:='service_self_person:sql_v1:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',v_actor,'tenant',v_scope.tenant_id,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_scope.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_scope.tenant_id and key=v_key for update;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash or v_idem.expires_at<=clock_timestamp() then
  raise exception 'idempotency_conflict' using errcode='23505';end if;
 if v_idem.response_ref is not null then
  perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
  where mp.membership_id=v_scope.membership_id and mp.tenant_id=v_scope.tenant_id
   and mp.party_id=(v_idem.response_ref->>'party_id')::uuid and mp.valid_until=v_until
   and mp.valid_from<=clock_timestamp() and mp.valid_until>clock_timestamp() and p.archived_at is null;
  if not found then raise exception 'self_person_access_denied' using errcode='42501';end if;
  return v_idem.response_ref;
 end if;
 if exists(select 1 from identity.membership_parties where membership_id=v_scope.membership_id) then
  raise exception 'existing_mapping_requires_review' using errcode='23505';end if;
 insert into portfolio.parties(tenant_id,type,legal_name) values(v_scope.tenant_id,'person','PILOT TEST — '||v_name) returning id into v_party;
 insert into identity.membership_parties(membership_id,tenant_id,party_id,valid_from,valid_until)
 values(v_scope.membership_id,v_scope.tenant_id,v_party,clock_timestamp(),v_until);
 v_result:=jsonb_build_object('party_id',v_party,'valid_until',v_until);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason)
 values(v_scope.tenant_id,v_actor,'services.self_person.register','membership_party',v_scope.membership_id,v_result,
 'Pilot self-person; caller confirmed own account; no ownership or legal identity verification');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_scope.tenant_id,'service_self_person',v_party,1,'services.self_person.registered',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_scope.tenant_id and key=v_key;
 return v_result;
end;$$;$definition_6$;
 END IF;
END $replace_6$;

-- Exact source: supabase/migrations/20260929082301_prevent_duplicate_active_unit_grants.sql:3
DO $replace_7$ BEGIN
 IF to_regprocedure('customer_api.claim_unit_invitation_core_v1(uuid,text)') IS NOT NULL THEN
  EXECUTE $definition_7$create or replace function customer_api.claim_unit_invitation_core_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text; v_i communications.unit_invitations;
 v_role uuid; v_membership uuid;
begin
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_BEGIN
 -- Lock, do not UPDATE: canonical guard permits bumps only in trigger context.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then
  raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
 end if;
 -- CORE_LISTING_WRITER_EPOCH_BARRIER_V1_END

  select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
  if v_email is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or length(trim(coalesce(p_display_name,''))) not between 2 and 120 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if v_i.id is null or v_i.status<>'pending' or v_i.expires_at<=statement_timestamp()
    or v_i.normalized_email<>v_email
    or not communications.can_manage_unit_invites(v_i.invited_by,v_i.inviter_context_id,v_i.workspace_id,v_i.unit_id)
    or (v_i.role_code='vendor_contact' and not communications.unit_vendor_contract_valid(v_i.unit_id,v_i.vendor_id))
    or (v_i.role_code<>'vendor_contact' and not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,v_i.role_code))
    or not exists(select 1 from platform.customer_workspaces w where w.id=v_i.workspace_id
      and w.tenant_id=v_i.tenant_id and w.lifecycle_status='ACTIVE') then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select id into v_role from identity.roles where code=v_i.role_code
    and (tenant_id is null or tenant_id=v_i.tenant_id)
    order by (tenant_id=v_i.tenant_id) desc limit 1;
  if v_role is null then raise exception 'unit_role_unavailable' using errcode='55000'; end if;
  insert into identity.profiles(user_id,display_name) values(v_actor,trim(p_display_name))
    on conflict(user_id) do nothing;
  insert into identity.memberships(tenant_id,user_id,role_id,status)
    values(v_i.tenant_id,v_actor,v_role,'active')
    on conflict(tenant_id,user_id,role_id) where status in ('invited','active')
    do update set status='active' returning id into v_membership;
  if v_i.role_code='vendor_contact' then
    insert into maintenance.vendor_portal_memberships(tenant_id,vendor_id,membership_id,
      status,verified_by,accepted_at) values(v_i.tenant_id,v_i.vendor_id,v_membership,
      'active',v_i.invited_by,statement_timestamp())
      on conflict(tenant_id,membership_id,vendor_id) do update
        set status='active',verified_by=v_i.invited_by,accepted_at=statement_timestamp(),revoked_at=null;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id)
      select v_membership,v_i.tenant_id,'property',b.property_id
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v_i.unit_id
        and not exists(select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='property' and g.property_id=b.property_id and (g.ends_at is null or g.ends_at>statement_timestamp()));
  else
    if exists(select 1 from identity.membership_parties where membership_id=v_membership
      and party_id<>v_i.party_id) then raise exception 'unit_party_conflict' using errcode='23505'; end if;
    insert into identity.membership_parties(membership_id,tenant_id,party_id)
      values(v_membership,v_i.tenant_id,v_i.party_id)
      on conflict(membership_id) do nothing;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,unit_id)
      select v_membership,v_i.tenant_id,'unit',v_i.unit_id where not exists(
        select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='unit' and g.unit_id=v_i.unit_id and (g.ends_at is null or g.ends_at>statement_timestamp()));
  end if;
  update communications.unit_invitations set status='accepted',accepted_by=v_actor,
    accepted_at=statement_timestamp() where id=v_i.id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,v_actor,'unit_invitation.accept','communications.unit_invitation',v_i.id);
  return jsonb_build_object('membership_id',v_membership,'unit_id',v_i.unit_id);
end $$;$definition_7$;
 END IF;
END $replace_7$;
DO $preserve$ BEGIN
 IF EXISTS(SELECT 1 FROM core_listing_writer_before_v1 b LEFT JOIN pg_proc p ON p.oid=b.oid
  WHERE p.oid IS NULL OR b.metadata IS DISTINCT FROM(to_jsonb(p)-'prosrc')) THEN
  RAISE EXCEPTION 'listing_writer_metadata_changed' USING ERRCODE='55000'; END IF;
END $preserve$;
DO $check$
DECLARE e jsonb; r record; p pg_proc; owner_role pg_roles; epoch pg_class;
BEGIN
 e:=nullif(current_setting('cladora.listing_writer_target_v1',true),'')::jsonb;
 IF e IS NULL OR e->>'database_name' IS DISTINCT FROM current_database()
  OR e->>'database_oid' IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'listing_writer_target_unbound' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT epoch FROM pg_class WHERE oid='app_private.canonical_authority_revision_v1'::regclass;
 FOR r IN SELECT * FROM(VALUES
('customer_api.claim_unit_invitation_v1(uuid,text)','bffb832c8923e42276f12152dc623dc0f6dbcb291ca99199aac92d742bfa58cb'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)','5437a455c8cfa211ac27d51013ac84627b1e74dcd3df711ad606a2822a792235'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)','2548431b9d3c32b824866f94710ae9ec8965403fd4963737a427870ef1826ea4'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)','c44286bde2a7c3a1e2166e7915ddfe1a945fa013e3f2a245451db09cd3b55e48'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)','bd38dc429d45aa7a8f8e63c28c06669433856587bed629aac714fb64fee16d34'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','797ee8c505e91c21f0c56c57eb7e4fa0388e435a8f278c9899538f7480ace0b6'),
('customer_api.register_service_self_person_v1(jsonb)','21714085b2d584d20258131555a9c66a255cfa921691b155bc53c8585e97966a'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)','9a4449033c20761ab5c2db4e115218e5c6754afc9949ab1deaf4ffcc198209c0')
 )v(signature,body_sha256) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND THEN
   IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'absent' THEN
    RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
   CONTINUE;
  END IF;
  IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'present' THEN
   RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
  IF encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.body_sha256
   OR NOT p.prosecdef OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   OR NOT pg_has_role(current_user,p.proowner,'USAGE')
  THEN RAISE EXCEPTION 'listing_writer_source_or_owner_mismatch' USING ERRCODE='55000'; END IF;
  SELECT * INTO STRICT owner_role FROM pg_roles WHERE oid=p.proowner;
  IF NOT has_schema_privilege(owner_role.oid,'app_private','USAGE')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'singleton','SELECT')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'revision','UPDATE')
   OR (epoch.relrowsecurity AND NOT(owner_role.rolsuper OR owner_role.rolbypassrls
     OR(epoch.relowner=owner_role.oid AND NOT epoch.relforcerowsecurity)))
  THEN RAISE EXCEPTION 'listing_writer_epoch_privilege_or_rls_not_proven' USING ERRCODE='55000'; END IF;
  -- Private admitted snapshot of ALL non-body catalog attributes, not only ACL.
  IF e->'routine_metadata'->>r.signature IS DISTINCT FROM
   encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'listing_writer_metadata_unbound' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM app_private.canonical_authority_revision_v1 WHERE singleton) THEN
  RAISE EXCEPTION 'canonical_authority_revision_unavailable' USING ERRCODE='55000'; END IF;
END
$check$;

-- No publication or data mutation. Private verified adoption is still required.
ROLLBACK;
