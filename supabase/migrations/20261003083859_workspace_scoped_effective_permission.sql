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
commit;
