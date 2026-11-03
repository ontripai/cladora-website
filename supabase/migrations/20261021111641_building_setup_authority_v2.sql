begin;

-- CORE-BUILDING-SETUP-AUTHORITY-01 / CATALOG-REVIEWER-DECISION-02.
-- Catalog metadata only: never activate a Workspace, grant an identity role,
-- manufacture an assignment or convert a pilot receipt into native authority.
do $catalog$
declare
 module_id pg_catalog.uuid;
 profile_id pg_catalog.uuid;
 model_id pg_catalog.uuid;
begin
 select id into profile_id from platform.property_profiles
 where code='residential_condominium' and version=1;
 select id into model_id from platform.operating_models
 where code='association_managed' and version=1;
 if profile_id is null or model_id is null or
   (select count(*) from identity.permissions where code in
    ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve'))<>3 then
   raise exception 'building_setup_catalog_prerequisite_missing';
 end if;
 if exists(select 1 from platform.module_definitions
   where code='building_setup' and (version<>1 or not is_active
    or lifecycle_status not in ('active','published') or not requires_aal2
    or entitlement_key is distinct from 'module.building_setup'
    or valid_from>statement_timestamp() or valid_to is not null)) then
   raise exception 'building_setup_module_definition_conflict';
 end if;
 insert into platform.module_definitions
  (code,version,name,labels_json,description,category,is_active,lifecycle_status,
   sensitivity_level,requires_aal2,entitlement_key,published_at)
 select 'building_setup',1,'Building setup',
  '{"ro":"Configurarea clădirii","en":"Building setup","fa":"راه‌اندازی ساختمان"}'::jsonb,
  'Bounded synthetic Romanian RON building setup authority; no Import or invitation activation',
  'core',true,'published','high_impact',true,'module.building_setup',statement_timestamp()
 where not exists(select 1 from platform.module_definitions where code='building_setup');
 select id into module_id from platform.module_definitions where code='building_setup' and version=1;

 -- No silent replacement of a conflicting binding or alternate module mapping.
 if exists(select 1 from platform.module_permission_bindings b
   join identity.permissions p on p.id=b.permission_id
   where (b.module_definition_id=module_id and
     (p.code not in ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
      or b.binding_version<>1 or b.lifecycle_status<>'active'
      or not b.is_assignable_to_local_role or not b.is_delegable or not b.requires_aal2
      or b.valid_from>statement_timestamp() or b.valid_to is not null
      or b.permission_mode is distinct from case p.code
        when 'onboarding.import.read' then 'read'
        when 'onboarding.import.manage' then 'manage' else 'execute' end))
    or (p.code in ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
      and b.module_definition_id<>module_id and b.lifecycle_status='active'
      and (b.valid_to is null or b.valid_to>statement_timestamp()))) then
   raise exception 'building_setup_module_binding_conflict';
 end if;
 insert into platform.module_permission_bindings
  (module_definition_id,permission_id,binding_version,permission_mode,
   is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
 select module_id,p.id,1,case p.code when 'onboarding.import.read' then 'read'
    when 'onboarding.import.manage' then 'manage' else 'execute' end,
  true,true,true,'active'
 from identity.permissions p where p.code in
  ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
 and not exists(select 1 from platform.module_permission_bindings b
   where b.module_definition_id=module_id and b.permission_id=p.id);

 if exists(select 1 from platform.module_property_profile_compatibilities
   where module_definition_id=module_id
   and (property_profile_id<>profile_id or compatibility_level<>'compatible'))
 or exists(select 1 from platform.module_operating_model_compatibilities
   where module_definition_id=module_id
   and (operating_model_id<>model_id or compatibility_level<>'compatible')) then
   raise exception 'building_setup_taxonomy_compatibility_conflict';
 end if;
 insert into platform.module_property_profile_compatibilities
  (module_definition_id,property_profile_id,compatibility_level,reason)
 select module_id,profile_id,'compatible','Coordinator approved residential condominium v1 only'
 where not exists(select 1 from platform.module_property_profile_compatibilities
   where module_definition_id=module_id and property_profile_id=profile_id);
 insert into platform.module_operating_model_compatibilities
  (module_definition_id,operating_model_id,compatibility_level,reason)
 select module_id,model_id,'compatible','Coordinator approved association managed v1 only'
 where not exists(select 1 from platform.module_operating_model_compatibilities
   where module_definition_id=module_id and operating_model_id=model_id);
end;
$catalog$;

create function app_private.require_building_setup_authority_v2(
 p_context_id pg_catalog.uuid,p_workspace_id pg_catalog.uuid,
 p_permission pg_catalog.text,p_action pg_catalog.text
) returns table(tenant_id pg_catalog.uuid,workspace_id pg_catalog.uuid,
 membership_id pg_catalog.uuid,actor_id pg_catalog.uuid)
language plpgsql stable security definer set search_path=pg_catalog
as $authority$
declare
 actor record;
 module_id pg_catalog.uuid;
 v_permission_id pg_catalog.uuid;
 expected_permission pg_catalog.text;
 limited_reviewer pg_catalog.bool;
 reviewer_end pg_catalog.timestamptz;
 basis_end pg_catalog.timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_context_id is null or p_workspace_id is null then
   raise exception 'building_setup_explicit_target_required' using errcode='42501';
 end if;
 expected_permission:=case
  when p_action in ('read','recover') then 'onboarding.import.read'
  when p_action in ('create','update','rehearse','submit','provision') then 'onboarding.import.manage'
  when p_action='approve' then 'onboarding.import.approve' else null end;
 if expected_permission is null or p_permission is distinct from expected_permission then
   raise exception 'building_setup_action_permission_denied' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'mfa_required' using errcode='42501';
 end if;

 -- Recognize a limited reviewer even when its receipt was revoked/expired:
 -- removing the receipt's validity must not promote that Context to an operator.
 select exists(select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join identity.roles r on r.id=m.role_id
   where g.id=p_context_id and m.user_id=auth.uid()
     and (r.code='building_setup_reviewer' or exists(
       select 1 from platform.pilot_setup_reviewers pr
       where pr.context_grant_id=g.id or pr.membership_id=m.id)))
 into limited_reviewer;
 if limited_reviewer and p_action not in ('read','recover','approve') then
   raise exception 'building_setup_reviewer_action_denied' using errcode='42501';
 end if;
 if limited_reviewer and not exists(
   select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join platform.workspace_member_roles a on a.membership_id=m.id
     and a.tenant_id=m.tenant_id and a.customer_workspace_id=p_workspace_id
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=m.tenant_id and r.customer_workspace_id=p_workspace_id
   where g.id=p_context_id and m.user_id=auth.uid() and a.authority_policy_version=2
     and a.scope_type='workspace' and a.valid_from<=statement_timestamp()
     and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 select * into actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if actor.workspace_id is distinct from p_workspace_id or actor.membership_id is null then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 select d.id into module_id from platform.module_definitions d
 where d.code='building_setup' and d.version=1 and d.is_active
   and d.lifecycle_status in ('active','published') and d.requires_aal2
   and d.entitlement_key='module.building_setup'
   and d.valid_from<=statement_timestamp() and (d.valid_to is null or d.valid_to>statement_timestamp());
 select p.id into v_permission_id from identity.permissions p where p.code=p_permission;
 if module_id is null or v_permission_id is null
   or not exists(select 1 from platform.module_permission_bindings b
     where b.module_definition_id=module_id and b.permission_id=v_permission_id
       and b.binding_version=1 and b.lifecycle_status='active'
       and b.is_assignable_to_local_role and b.is_delegable and b.requires_aal2
       and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
       and b.permission_mode=case p_permission when 'onboarding.import.read' then 'read'
         when 'onboarding.import.manage' then 'manage' else 'execute' end)
   or app_private.check_workspace_native_permission_v2(
     p_context_id,p_workspace_id,p_permission,'building_setup') is not true then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 -- Exact basis is independent of commercial case approval and tenant membership.
 select max(b.expires_at) into basis_end from platform.workspace_access_bases b
 join platform.customer_workspaces w on w.id=b.customer_workspace_id
 left join platform.workspace_contracts c on c.id=b.contract_id
 where b.customer_workspace_id=p_workspace_id and b.status='active'
   and b.activated_at<=statement_timestamp() and b.expires_at>statement_timestamp()
   and ((b.mode='PILOT' and w.environment='PILOT')
     or (b.mode='PAID' and c.customer_workspace_id=p_workspace_id
       and c.status='active' and c.signed_at is not null
       and b.paid_through>=(statement_timestamp() at time zone 'Europe/Bucharest')::date));
 if basis_end is null or not exists(select 1 from platform.workspace_taxonomy_assignments t
   where t.customer_workspace_id=p_workspace_id and t.tenant_id=actor.tenant_id
     and t.status='active' and t.country_code='RO'
     and t.valid_from<=statement_timestamp() and (t.valid_to is null or t.valid_to>statement_timestamp())) then
   raise exception 'building_setup_basis_required' using errcode='42501';
 end if;

 if limited_reviewer then
   select max(pr.expires_at) into reviewer_end from platform.pilot_setup_reviewers pr
   join platform.workspace_access_bases b on b.customer_workspace_id=pr.customer_workspace_id
   join platform.customer_workspaces w on w.id=pr.customer_workspace_id and w.environment='PILOT'
   join auth.users u on u.id=auth.uid()
   where pr.context_grant_id=p_context_id and pr.membership_id=actor.membership_id
     and pr.customer_workspace_id=p_workspace_id and pr.activated_by=auth.uid()
     and pr.status='active' and pr.expires_at>statement_timestamp()
     and pr.normalized_email=lower(btrim(u.email)) and u.email_confirmed_at is not null
     and b.mode='PILOT' and b.status='active' and b.activated_at<=statement_timestamp()
     and b.expires_at>=pr.expires_at and b.expires_at>statement_timestamp();
   if reviewer_end is null then raise exception 'building_setup_reviewer_basis_denied' using errcode='42501'; end if;
 end if;

 -- A global identity allow alone is insufficient. Require the particular
 -- permission's live version-2 canonical assignment/provenance as well.
 if not exists(select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=a.tenant_id and r.customer_workspace_id=a.customer_workspace_id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=module_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
     and rp.permission_id=v_permission_id and rp.effect='allow'
   join identity.memberships m on m.id=a.membership_id and m.tenant_id=a.tenant_id
   join identity.context_grants g on g.id=p_context_id and g.membership_id=m.id and g.tenant_id=m.tenant_id
   where a.tenant_id=actor.tenant_id and a.customer_workspace_id=p_workspace_id
     and a.membership_id=actor.membership_id and a.authority_policy_version=2
     and a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null
     and a.valid_from<=statement_timestamp() and a.valid_to>statement_timestamp()
     and a.valid_to<=basis_end and a.valid_to<=coalesce(m.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(g.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(r.valid_to,'infinity'::timestamptz)
     and (not limited_reviewer or (a.valid_to<=reviewer_end
       and not exists(select 1 from platform.workspace_role_modules other
         where other.workspace_role_id=r.id and other.module_definition_id<>module_id)
       and not exists(select 1 from platform.workspace_role_permissions other
         join identity.permissions p on p.id=other.permission_id
         where other.workspace_role_id=r.id and other.effect='allow'
           and p.code not in ('onboarding.import.read','onboarding.import.approve'))))
     and app_private.workspace_member_role_authority_active_v1(
       a.id,v_permission_id,module_id,'workspace',p_workspace_id) is true) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 return query select actor.tenant_id,p_workspace_id,actor.membership_id,auth.uid();
end;
$authority$;
revoke all on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text)
 from public,anon,authenticated,service_role;

-- Raw SELECT has no explicit Context argument. Enumerate only current actor-owned
-- Contexts and validate each against the row's explicit Workspace; never infer a
-- Workspace from the tenant or trust a selected-Context JWT field as authority.
create function app_private.can_read_building_setup_v2(p_tenant_id pg_catalog.uuid,p_workspace_id pg_catalog.uuid)
returns pg_catalog.bool language plpgsql stable security definer set search_path=pg_catalog
as $read_policy$
declare context_id pg_catalog.uuid; authorized pg_catalog.bool;
begin
 if auth.uid() is null or p_workspace_id is null then return false; end if;
 for context_id in select g.id from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   where m.user_id=auth.uid() and m.status='active'
     and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
     and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
 loop
   begin
     select a.tenant_id=p_tenant_id into authorized
     from app_private.require_building_setup_authority_v2(
       context_id,p_workspace_id,'onboarding.import.read','read') a;
     if authorized is true then return true; end if;
   exception when insufficient_privilege then
     -- A known authorization denial on one Context does not authorize any row.
     null;
   end;
 end loop;
 return false;
end;
$read_policy$;
revoke all on function app_private.can_read_building_setup_v2(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.can_read_building_setup_v2(uuid,uuid) to authenticated;

-- Default ACLs/owner mismatch must abort rather than create an elevated accessor.
do $private_boundary$
declare process_owner oid;
begin
 select proowner into process_owner from pg_catalog.pg_proc
 where oid='app_private.require_setup_context(uuid,text)'::regprocedure;
 if exists(select 1 from pg_catalog.pg_proc p where p.oid in
   ('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure,
    'app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure) and p.proowner<>process_owner)
 or exists(select 1 from pg_catalog.pg_proc p,
   lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
   where p.oid in ('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure,
    'app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure)
   and a.grantee<>p.proowner and not
    (p.proname='can_read_building_setup_v2' and a.grantee='authenticated'::regrole and not a.is_grantable))
 then raise exception 'building_setup_private_boundary_conflict'; end if;
end;
$private_boundary$;
do $read_boundary$
begin
 if not (select relrowsecurity from pg_catalog.pg_class
   where oid='platform.building_setup_runs'::regclass)
 or exists(select 1 from pg_catalog.pg_policy
   where polrelid='platform.building_setup_runs'::regclass
     and polname<>'building_setup_runs_context_read' and polpermissive and polcmd in ('r','*')) then
   raise exception 'building_setup_read_boundary_conflict';
 end if;
end;
$read_boundary$;
drop policy building_setup_runs_context_read on platform.building_setup_runs;
create policy building_setup_runs_context_read on platform.building_setup_runs
 for select to authenticated using(app_private.can_read_building_setup_v2(tenant_id,customer_workspace_id));

commit;
