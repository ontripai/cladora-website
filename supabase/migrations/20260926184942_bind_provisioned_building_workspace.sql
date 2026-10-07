-- Complete the workspace relationship atomically with building provision.
-- The reviewer approves the run, but only its original operator receives a
-- property-scoped context. Membership expiry still caps that context.
create function app_private.bind_provisioned_building_workspace_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,platform,identity,portfolio,audit as $$
declare v_membership identity.memberships%rowtype; v_binding uuid; v_grant uuid;
begin
 if new.status<>'provisioned' or old.status='provisioned' then return new; end if;
 if new.property_id is null or not exists(
   select 1 from portfolio.properties p where p.id=new.property_id and p.tenant_id=new.tenant_id
 ) or not exists(
   select 1 from platform.customer_workspaces w where w.id=new.customer_workspace_id and w.tenant_id=new.tenant_id
 ) then raise exception 'setup_property_workspace_mismatch' using errcode='42501'; end if;

 select * into v_membership from identity.memberships m
 where m.tenant_id=new.tenant_id and m.user_id=new.created_by and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'setup_operator_membership_missing' using errcode='42501'; end if;

 if exists(select 1 from platform.workspace_property_bindings b
   where b.property_id=new.property_id and b.status='active' and b.valid_to is null
     and b.customer_workspace_id<>new.customer_workspace_id) then
   raise exception 'setup_property_bound_elsewhere' using errcode='42501';
 end if;
 select id into v_binding from platform.workspace_property_bindings
 where property_id=new.property_id and customer_workspace_id=new.customer_workspace_id
   and status='active' and valid_to is null;
 if v_binding is null then
   insert into platform.workspace_property_bindings
     (tenant_id,customer_workspace_id,property_id,binding_source,created_by)
   values(new.tenant_id,new.customer_workspace_id,new.property_id,'building_setup',new.created_by)
   returning id into v_binding;
 end if;

 select id into v_grant from identity.context_grants
 where membership_id=v_membership.id and tenant_id=new.tenant_id
   and scope_type='property' and property_id=new.property_id
   and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp());
 if v_grant is null then
   insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id,ends_at)
   values(v_membership.id,new.tenant_id,'property',new.property_id,v_membership.ends_at)
   returning id into v_grant;
 end if;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(new.tenant_id,auth.uid(),'CUSTOMER_OPERATOR','BUILDING_SETUP_PROPERTY_BOUND','building_setup_run',new.id,
   jsonb_build_object('property_id',new.property_id,'workspace_id',new.customer_workspace_id,
     'binding_id',v_binding,'operator_context_id',v_grant),
   'Atomic workspace and scoped operator context after approved building setup');
 return new;
end $$;
revoke all on function app_private.bind_provisioned_building_workspace_v1() from public,anon,authenticated,service_role;
create trigger bind_provisioned_building_workspace
after update of status on platform.building_setup_runs
for each row execute function app_private.bind_provisioned_building_workspace_v1();
