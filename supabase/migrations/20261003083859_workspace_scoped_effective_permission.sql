begin;

-- Shared context ceiling. Domain permissions continue to come from the core engine.
create function app_private.context_covers_workspace_target_v1(
 p_context_id uuid,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private
as $$
declare
 r record; g identity.context_grants%rowtype;
 target_property uuid; target_building uuid; source_property uuid;
 target_tenant uuid; binding_count integer;
begin
 if auth.uid() is null or p_context_id is null or p_target_scope_id is null
   or p_target_scope_type is null or p_target_scope_type not in ('workspace','property','building','unit') then
  return false;
 end if;
 begin
  select * into r from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
 exception when sqlstate '42501' then return false;
 end;
 if r.workspace_id is null or r.status is distinct from 'active' then return false; end if;
 select * into g from identity.context_grants where id=p_context_id
  and membership_id=r.membership_id and tenant_id=r.tenant_id;
 if not found then return false; end if;
 if p_target_scope_type='workspace' then
  return g.scope_type='tenant' and p_target_scope_id=r.workspace_id;
 elsif p_target_scope_type='property' then
  select id,tenant_id into target_property,target_tenant
   from portfolio.properties where id=p_target_scope_id;
 elsif p_target_scope_type='building' then
  select property_id,id,tenant_id into target_property,target_building,target_tenant
   from portfolio.buildings where id=p_target_scope_id;
 else
  select b.property_id,u.building_id,u.tenant_id into target_property,target_building,target_tenant
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_target_scope_id;
 end if;
 if target_property is null or target_tenant is distinct from r.tenant_id then return false; end if;
 if not exists(select 1 from portfolio.properties where id=target_property and tenant_id=r.tenant_id) then return false; end if;
 select count(*) into binding_count from platform.workspace_property_bindings
  where property_id=target_property and status='active'
   and valid_from<=statement_timestamp() and(valid_to is null or valid_to>statement_timestamp());
 if binding_count<>1 or not exists(
  select 1 from platform.workspace_property_bindings
  where property_id=target_property and customer_workspace_id=r.workspace_id and tenant_id=r.tenant_id
   and status='active' and valid_from<=statement_timestamp() and(valid_to is null or valid_to>statement_timestamp())
 ) then return false; end if;
 if g.scope_type='tenant' then return true;
 elsif g.scope_type='property' then return g.property_id=target_property;
 elsif g.scope_type='building' then
  select property_id into source_property from portfolio.buildings where id=g.building_id and tenant_id=r.tenant_id;
  return coalesce(p_target_scope_type in ('building','unit') and target_building=g.building_id
   and source_property=target_property and(g.property_id is null or g.property_id=source_property),false);
 elsif g.scope_type='unit' then
  return coalesce(p_target_scope_type='unit' and g.unit_id=p_target_scope_id
   and(g.building_id is null or g.building_id=target_building)
   and(g.property_id is null or g.property_id=target_property),false);
 end if;
 return false;
end;
$$;

create function app_private.check_scoped_effective_permission_v1(
 p_context_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,app_private
as $$
begin
 if not app_private.context_covers_workspace_target_v1(p_context_id,p_target_scope_type,p_target_scope_id) then return false; end if;
 return coalesce(app_private.check_effective_permission_v1(
  p_context_id,p_permission_code,p_module_code,p_target_scope_type,p_target_scope_id),false);
end;
$$;
revoke all on function app_private.context_covers_workspace_target_v1(uuid,text,uuid),
 app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)
 from public,anon,authenticated,service_role;
comment on function app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)
 is 'Internal additive adapter: context ceiling AND canonical effective permission; caller-specific AAL and mutation binding gates remain required. No domain caller cutover.';

-- AIRPROP is a runtime module in the existing catalogue; workspace activation is separate.
insert into platform.module_definitions(code,version,name,labels_json,description,category,is_active,lifecycle_status,
 sensitivity_level,requires_aal2,entitlement_key,published_at)
values('airprop_commercial',1,'AIRPROP Commercial Workspace',
 '{"ro":"AIRPROP Comercial","en":"AIRPROP Commercial","fa":"ایرپراپ تجاری"}',
 'Commercial opportunities, underwriting and interests referencing canonical workspace subjects',
 'investment',true,'published','high_impact',true,'module.airprop_commercial',statement_timestamp());

insert into platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,
 is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,x.mode,true,false,true,'active'
from (values
 ('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
 ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage')
) x(code,mode) join identity.permissions p on p.code=x.code
cross join platform.module_definitions m where m.code='airprop_commercial' and m.version=1;

-- AIRPROP applies to the full workspace taxonomy; this seed covers existing v1 taxonomy only.
insert into platform.module_property_profile_compatibilities(module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','AIRPROP workspace-wide commercial domain, initial taxonomy v1'
from platform.module_definitions m cross join platform.property_profiles p
where m.code='airprop_commercial' and m.version=1 and p.version=1;
insert into platform.module_operating_model_compatibilities(module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','AIRPROP commercial model remains distinct from workspace operating taxonomy'
from platform.module_definitions m cross join platform.operating_models o
where m.code='airprop_commercial' and m.version=1 and o.version=1;

create function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog,platform,identity
as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id
 where m.code='airprop_commercial' and m.version=1;
 select count(*) into matched from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 join identity.permissions p on p.id=b.permission_id
 join(values('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
 ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage')) x(code,mode)
 on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1
 and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2
 and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>5 or matched<>5 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002'; end if;
end;
$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();

-- Preserve the historic registry manifest within its module set as new domains are added.
create or replace function app_private.validate_module_permission_bindings_v2_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_total_count integer;
  v_active_count integer;
  v_delegable_active_count integer;
  v_non_delegable_active_count integer;
  v_v2_non_delegable_count integer;
begin
  select count(*) into v_total_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security'));
  if v_total_count <> 90 then
    raise exception 'module_permission_bindings_total_count_mismatch: expected 90, got %', v_total_count using errcode = 'P0002';
  end if;

  select count(*) into v_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active';
  if v_active_count <> 48 then
    raise exception 'module_permission_bindings_active_count_mismatch: expected 48, got %', v_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_delegable_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active' and is_delegable = true;
  if v_delegable_active_count <> 42 then
    raise exception 'delegable_active_count_mismatch: expected 42, got %', v_delegable_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_non_delegable_active_count from platform.module_permission_bindings where module_definition_id in (select id from platform.module_definitions where code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')) and lifecycle_status = 'active' and is_delegable = false;
  if v_non_delegable_active_count <> 6 then
    raise exception 'non_delegable_active_count_mismatch: expected 6, got %', v_non_delegable_active_count using errcode = 'P0002';
  end if;

  -- Ensure 6 non-delegable permissions have zero v2 records
  select count(*) into v_v2_non_delegable_count
  from platform.module_permission_bindings b
  join identity.permissions p on p.id = b.permission_id
  where p.code in ('billing.cancel', 'payments.reverse', 'payments.reconcile', 'utilities.tariffs.manage', 'governance.votes.administer', 'governance.minutes.finalize')
    and b.binding_version = 2;

  if v_v2_non_delegable_count <> 0 then
    raise exception 'non_delegable_permissions_must_not_have_v2_records' using errcode = 'P0002';
  end if;
end;
$$;
select app_private.validate_module_permission_bindings_v2_seeding_v1();

-- Additive gate for bound AIRPROP subjects. Existing public commands are not cut over here.
create function app_private.require_airprop_workspace_context_v1(
 p_context_id uuid,p_permission text,p_property_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql stable security definer set search_path=pg_catalog,app_private
as $$
declare r record; mutation boolean;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 if p_permission is null or p_permission not in('airprop.opportunity.read','airprop.opportunity.manage',
 'airprop.underwriting.manage','airprop.asset.read','airprop.asset.manage') or p_property_id is null then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 mutation:=p_permission not in('airprop.opportunity.read','airprop.asset.read');
 select * into r from app_private.resolve_workspace_from_customer_context_v1(p_context_id,mutation);
 if not app_private.check_scoped_effective_permission_v1(p_context_id,p_permission,'airprop_commercial','property',p_property_id) then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 return query select r.workspace_id,r.tenant_id,r.membership_id,r.role_code;
end;
$$;
revoke all on function app_private.require_airprop_workspace_context_v1(uuid,text,uuid)
 from public,anon,authenticated,service_role;

commit;
