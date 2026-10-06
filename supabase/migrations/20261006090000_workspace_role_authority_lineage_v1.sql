begin;

-- Bounded, auditable authority lineage for workspace-local role assignments.
alter table platform.workspace_member_roles
  add column assigned_by_context_grant_id uuid references identity.context_grants(id) on delete restrict,
  add column authority_policy_version smallint not null default 1 check(authority_policy_version in (1,2)),
  add column authority_depth smallint not null default 0 check(authority_depth between 0 and 4);

create table platform.workspace_member_role_authority_sources (
  assignment_id uuid not null references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  source_kind text not null check(source_kind in ('identity_role','workspace_role_assignment')),
  source_identity_role_id uuid references identity.roles(id) on delete restrict,
  source_assignment_id uuid references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  authority_depth smallint not null check(authority_depth between 0 and 4),
  created_at timestamptz not null default statement_timestamp(),
  primary key(assignment_id,permission_id,module_definition_id),
  check (
    (source_kind='identity_role' and source_identity_role_id is not null and source_assignment_id is null and authority_depth=0)
    or (source_kind='workspace_role_assignment' and source_identity_role_id is null and source_assignment_id is not null and authority_depth between 1 and 4)
  )
);
create index workspace_role_authority_source_parent_idx
 on platform.workspace_member_role_authority_sources(source_assignment_id)
 where source_assignment_id is not null;
alter table platform.workspace_member_role_authority_sources enable row level security;
revoke all on platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;

create or replace function app_private.guard_workspace_role_authority_source_immutable_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'workspace_role_authority_source_immutable' using errcode='42501';
end;
$$;
revoke all on function app_private.guard_workspace_role_authority_source_immutable_v1() from public,anon,authenticated,service_role;
create trigger trg_workspace_role_authority_source_immutable
before update or delete on platform.workspace_member_role_authority_sources
for each row execute function app_private.guard_workspace_role_authority_source_immutable_v1();

create or replace function app_private.workspace_role_scope_contains_v1(
 p_parent_type text,p_parent_property uuid,p_parent_building uuid,p_parent_unit uuid,
 p_child_type text,p_child_property uuid,p_child_building uuid,p_child_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case p_parent_type
  when 'workspace' then p_child_type in ('workspace','property','building','unit')
  when 'property' then p_child_type in ('property','building','unit') and p_parent_property is not distinct from p_child_property
  when 'building' then p_child_type in ('building','unit') and p_parent_building is not distinct from p_child_building
  when 'unit' then p_child_type='unit' and p_parent_unit is not distinct from p_child_unit
  else false end;
$$;
revoke all on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.workspace_context_covers_role_scope_v1(
 p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,identity,portfolio,app_private as $$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
 if not found then return false; end if;
 if p_scope_type='workspace' then return c.scope_type='tenant'; end if;
 if p_scope_type='property' then v_property:=p_scope_id;
 elsif p_scope_type='building' then
   v_building:=p_scope_id;
   select b.property_id into v_property from portfolio.buildings b where b.id=p_scope_id and b.tenant_id=p_tenant_id;
 elsif p_scope_type='unit' then
   v_unit:=p_scope_id;
   select u.building_id,b.property_id into v_building,v_property
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_scope_id and u.tenant_id=p_tenant_id;
 else return false; end if;
 if v_property is null then return false; end if;
 if c.scope_type='tenant' then return true; end if;
 if c.scope_type='property' then
   return c.property_id=v_property;
 elsif c.scope_type='building' then
   if v_building is null and p_scope_type='property' then return false; end if;
   if v_building is null then
     select b.id into v_building from portfolio.buildings b where b.property_id=v_property and b.tenant_id=p_tenant_id;
     if not found then return false; end if;
   end if;
   return c.building_id=v_building;
 elsif c.scope_type='unit' then
   if p_scope_type<>'unit' then return false; end if;
   return c.unit_id=v_unit;
 end if;
 return false;
exception when others then return false;
end;
$$;
revoke all on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


create or replace function app_private.workspace_role_scope_overlaps_v1(
 p_left_type text,p_left_property uuid,p_left_building uuid,p_left_unit uuid,
 p_right_type text,p_right_property uuid,p_right_building uuid,p_right_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case
  when p_left_type='workspace' or p_right_type='workspace' then true
  when p_left_type='property' then p_left_property is not distinct from p_right_property
  when p_right_type='property' then p_right_property is not distinct from p_left_property
  when p_left_type='building' then p_left_building is not distinct from p_right_building
  when p_right_type='building' then p_right_building is not distinct from p_left_building
  when p_left_type='unit' then p_left_unit is not distinct from p_right_unit
  when p_right_type='unit' then p_right_unit is not distinct from p_left_unit
  else false end;
$$;
revoke all on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.workspace_role_identity_source_current_v1(
 p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,
 p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,
 p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare v_member record; v_module record;
begin
 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp()))
    or not app_private.workspace_context_covers_role_scope_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp()))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=statement_timestamp() and (wm.valid_to is null or wm.valid_to>statement_timestamp()))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
            and case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())
     and rp.permission_id=p_permission_id and rp.effect='deny' and rm.module_definition_id=p_module_id
     and app_private.workspace_role_scope_overlaps_v1(
       a.scope_type,a.property_id,a.building_id,a.unit_id,
       p_scope_type,
       case when p_scope_type='property' then p_scope_id when p_scope_type in ('building','unit') then
         (select b.property_id from portfolio.buildings b where b.id=case when p_scope_type='building' then p_scope_id else (select u.building_id from portfolio.units u where u.id=p_scope_id) end) end,
       case when p_scope_type='building' then p_scope_id when p_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_scope_id) end,
       case when p_scope_type='unit' then p_scope_id end)
 ) then return false; end if;
 return true;
exception when others then return false;
end;
$$;
revoke all on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.workspace_member_role_authority_active_v1(
 p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,
 p_target_scope_type text,p_target_scope_id uuid,p_path uuid[] default '{}'::uuid[]
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=statement_timestamp()
   and (wmr.valid_to is null or wmr.valid_to>statement_timestamp())
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   and r.lifecycle_status='published' and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp());
 if not found then return false; end if;
 if not app_private.workspace_role_scope_contains_v1(
   a.scope_type,a.property_id,a.building_id,a.unit_id,
   p_target_scope_type,
   case when p_target_scope_type='property' then p_target_scope_id when p_target_scope_type in ('building','unit') then
      (select b.property_id from portfolio.buildings b where b.id=case when p_target_scope_type='building' then p_target_scope_id else (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end) end,
   case when p_target_scope_type='building' then p_target_scope_id when p_target_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end,
   case when p_target_scope_type='unit' then p_target_scope_id end
 ) then return false; end if;
 if a.authority_policy_version=1 then return true; end if;
 if a.authority_policy_version<>2 then return false; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
   a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp());
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
 then return false; end if;
 if not exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='allow') then return false; end if;
 if exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='deny') then return false; end if;

 select * into s from platform.workspace_member_role_authority_sources x
 where x.assignment_id=a.id and x.permission_id=p_permission_id and x.module_definition_id=p_module_id;
 if not found then return false; end if;

 if s.source_kind='identity_role' then
   select grantor.* into grantor_rec from identity.memberships grantor
    where grantor.id=a.assigned_by_membership_id and grantor.tenant_id=a.tenant_id
      and grantor.status='active' and grantor.starts_at<=statement_timestamp()
      and (grantor.ends_at is null or grantor.ends_at>statement_timestamp());
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1(
      a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,
      a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,
      p_target_scope_type,p_target_scope_id);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp()
     and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1(
     parent.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,
     array_append(coalesce(p_path,'{}'::uuid[]),a.id));
 end if;
 return false;
exception when others then return false;
end;
$$;
revoke all on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated,service_role;


create or replace function app_private.resolve_workspace_role_assignment_context_v2(
 p_context_id uuid,p_workspace_role_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_id uuid,role_code text,status text)
language plpgsql stable security definer set search_path=pg_catalog,platform,identity,app_private as $$
declare v_role platform.workspace_roles%rowtype; v_actor record;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 select m.id,m.tenant_id,m.role_id,r.code as role_code
 into v_actor
 from identity.context_grants g
 join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join identity.roles r on r.id=m.role_id
 where g.id=p_context_id and m.user_id=auth.uid()
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
   and m.status='active' and m.starts_at<=statement_timestamp()
   and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
 if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_actor.role_id and p.code='workspace.role.assign' and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_actor.role_id and p.code='workspace.role.assign' and rp.effect='deny') then
   raise exception 'workspace_role_assign_permission_required' using errcode='42501'; end if;
 select * into v_role from platform.workspace_roles where id=p_workspace_role_id;
 if not found or v_role.tenant_id<>v_actor.tenant_id then
   raise exception 'workspace_role_not_found' using errcode='P0002'; end if;
 return query select v_role.customer_workspace_id,v_actor.tenant_id,v_actor.id,v_actor.role_id,v_actor.role_code,'active'::text;
end;
$$;
revoke all on function app_private.resolve_workspace_role_assignment_context_v2(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.guard_workspace_member_role_authority_v2()
returns trigger language plpgsql security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 v_ctx record; v_actor record; v_role record; v_pair record; v_parent record;
 v_scope_id uuid; v_child_pairs integer:=0; v_parent_pairs integer:=0;
 v_depth integer:=0; v_pair_depth integer:=0; v_cap timestamptz; v_base_expiry timestamptz;
 v_workspace_id uuid; v_source_kind text; v_source_role uuid; v_source_assignment uuid;
 v_scope_property uuid; v_scope_building uuid; v_scope_unit uuid;
begin
 if tg_op='UPDATE' then
   if new.assigned_by_context_grant_id is distinct from old.assigned_by_context_grant_id
      or new.authority_policy_version is distinct from old.authority_policy_version
      or new.authority_depth is distinct from old.authority_depth then
     raise exception 'workspace_member_role_authority_immutable' using errcode='42501';
   end if;
   return new;
 end if;
 if new.authority_policy_version=1 and new.assigned_by_context_grant_id is null
    and session_user in ('postgres','supabase_admin') then
   -- Preserve historical fixtures and privileged migration backfills only.
   return new;
 end if;
 if new.authority_policy_version<>2 or new.assigned_by_context_grant_id is null then
   raise exception 'workspace_member_role_authority_required' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or new.assigned_by_user_id is distinct from auth.uid()
    or new.assigned_by_membership_id=new.membership_id then
   raise exception 'workspace_role_authority_context_invalid' using errcode='42501';
 end if;
 select cg.* into v_ctx from identity.context_grants cg
 where cg.id=new.assigned_by_context_grant_id and cg.membership_id=new.assigned_by_membership_id
   and cg.tenant_id=new.tenant_id and cg.starts_at<=statement_timestamp()
   and (cg.ends_at is null or cg.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 select m.* into v_actor from identity.memberships m where m.id=new.assigned_by_membership_id
   and m.tenant_id=new.tenant_id and m.user_id=auth.uid() and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
      new.assigned_by_context_grant_id,new.tenant_id,new.scope_type,
      case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else null end)
 then raise exception 'workspace_role_authority_scope_exceeded' using errcode='42501'; end if;
 select wr.* into v_role from platform.workspace_roles wr
 where wr.id=new.workspace_role_id and wr.customer_workspace_id=new.customer_workspace_id
  and wr.tenant_id=new.tenant_id and wr.lifecycle_status='published'
  and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp());
 if not found then raise exception 'workspace_role_not_published' using errcode='42501'; end if;
 v_workspace_id:=case when new.scope_type='workspace' then new.customer_workspace_id end;
 v_scope_id:=case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else new.customer_workspace_id end;

 for v_pair in
   select distinct rp.permission_id,rm.module_definition_id,p.code permission_code,md.code module_code
   from platform.workspace_role_permissions rp
   join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
   join identity.permissions p on p.id=rp.permission_id
   join platform.module_definitions md on md.id=rm.module_definition_id
   where rp.workspace_role_id=new.workspace_role_id and rp.effect='allow'
 loop
   v_child_pairs:=v_child_pairs+1; v_pair_depth:=0;
   if not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=v_pair.module_definition_id and b.permission_id=v_pair.permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
   then raise exception 'workspace_role_grant_binding_invalid' using errcode='42501'; end if;
   if exists(select 1 from identity.role_permissions rp
      where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='deny') then
     raise exception 'workspace_role_grant_denied_by_assigner' using errcode='42501'; end if;

   v_source_kind:=null;v_source_role:=null;v_source_assignment:=null;
   if exists(select 1 from identity.role_permissions rp
       where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='allow')
      and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,v_pair.permission_id,v_pair.module_definition_id,
       new.scope_type,v_scope_id)
   then
     v_source_kind:='identity_role';v_source_role:=v_actor.role_id;
   else
     select parent.id,parent.authority_depth,parent.valid_to into v_parent
     from platform.workspace_member_roles parent
     join platform.workspace_roles pr on pr.id=parent.workspace_role_id
     join platform.workspace_role_permissions prp on prp.workspace_role_id=pr.id
     join platform.workspace_role_modules prm on prm.workspace_role_id=pr.id
     where parent.customer_workspace_id=new.customer_workspace_id
       and parent.membership_id=new.assigned_by_membership_id
       and parent.tenant_id=new.tenant_id and parent.authority_policy_version=2
       and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
       and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
       and prp.permission_id=v_pair.permission_id and prp.effect='allow'
       and prm.module_definition_id=v_pair.module_definition_id
       and app_private.workspace_role_scope_contains_v1(
         parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
         new.scope_type,new.property_id,new.building_id,new.unit_id)
       and app_private.workspace_member_role_authority_active_v1(
         parent.id,v_pair.permission_id,v_pair.module_definition_id,
         new.scope_type,v_scope_id,'{}'::uuid[])
     order by coalesce(parent.valid_to,'infinity'::timestamptz) asc
     limit 1;
     if not found then raise exception 'workspace_role_grant_source_missing' using errcode='42501'; end if;
     v_source_kind:='workspace_role_assignment';v_source_assignment:=v_parent.id;
     v_pair_depth:=v_parent.authority_depth+1; v_depth:=greatest(v_depth,v_pair_depth);
     if v_parent.valid_to is not null then
       v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),v_parent.valid_to);
     end if;
     if exists(
       with recursive lineage(id,membership_id,depth) as (
        select v_parent.id,new.assigned_by_membership_id,0
        union all
        select x.source_assignment_id,parent.membership_id,l.depth+1
        from lineage l
        join platform.workspace_member_role_authority_sources x on x.assignment_id=l.id
        join platform.workspace_member_roles parent on parent.id=x.source_assignment_id
        where x.source_assignment_id is not null and l.depth<4
       )
       select 1 from lineage where membership_id=new.membership_id
     ) then raise exception 'workspace_role_authority_cycle_prohibited' using errcode='42501'; end if;
   end if;
   insert into platform.workspace_member_role_authority_sources(
      assignment_id,permission_id,module_definition_id,source_kind,
      source_identity_role_id,source_assignment_id,authority_depth)
   values(new.id,v_pair.permission_id,v_pair.module_definition_id,v_source_kind,
      v_source_role,v_source_assignment,
      v_pair_depth);
 end loop;
 -- A deny-only role is valid and carries no delegable allow pairs.

 -- Require a strict proper subset of the assigner's currently effective,
 -- delegable authority pairs at this exact scope.
 select count(*) into v_parent_pairs from (
   select distinct p.permission_id,b.module_definition_id
   from identity.role_permissions p
   join platform.module_permission_bindings b on b.permission_id=p.permission_id
   join platform.module_definitions md on md.id=b.module_definition_id
   where p.role_id=v_actor.role_id and p.effect='allow'
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and md.is_active and md.lifecycle_status in ('active','published')
     and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp())
     and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,p.permission_id,b.module_definition_id,
       new.scope_type,v_scope_id)
   union
   select distinct rp.permission_id,rm.module_definition_id
   from platform.workspace_member_roles parent
   join platform.workspace_roles pr on pr.id=parent.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=pr.id and rp.effect='allow'
   join platform.workspace_role_modules rm on rm.workspace_role_id=pr.id
   join platform.module_permission_bindings b on b.permission_id=rp.permission_id and b.module_definition_id=rm.module_definition_id
   where parent.customer_workspace_id=new.customer_workspace_id
     and parent.membership_id=new.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       new.scope_type,new.property_id,new.building_id,new.unit_id)
     and app_private.workspace_member_role_authority_active_v1(
       parent.id,rp.permission_id,rm.module_definition_id,new.scope_type,v_scope_id,'{}'::uuid[])
 ) authority;
 if v_child_pairs>0 and v_child_pairs>=v_parent_pairs then
   raise exception 'workspace_role_peer_or_superior_grant_prohibited' using errcode='42501';
 end if;

 -- Cap expiry to target/grantor membership, exact grant context, role, inherited
 -- parent assignment and active workspace access basis. No active open-ended
 -- access basis exists in this schema, so open-ended assignments are impossible.
 v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),
   coalesce(new.valid_to,'infinity'::timestamptz),
   coalesce(v_actor.ends_at,'infinity'::timestamptz),
   coalesce((select m.ends_at from identity.memberships m where m.id=new.membership_id),'infinity'::timestamptz),
   coalesce(v_ctx.ends_at,'infinity'::timestamptz),
   coalesce(v_role.valid_to,'infinity'::timestamptz));
 select max(b.expires_at) into v_base_expiry from platform.workspace_access_bases b
 where b.customer_workspace_id=new.customer_workspace_id and b.status='active'
   and b.expires_at>statement_timestamp();
 if v_base_expiry is not null then v_cap:=least(v_cap,v_base_expiry); end if;
 if v_cap='infinity'::timestamptz or v_cap<=statement_timestamp() then
   raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 if new.valid_to is null or new.valid_to>v_cap then new.valid_to:=v_cap; end if;
 if new.valid_to<=statement_timestamp() then raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 new.authority_depth:=v_depth;
 return new;
end;
$$;
revoke all on function app_private.guard_workspace_member_role_authority_v2() from public,anon,authenticated,service_role;
create trigger trg_workspace_member_role_authority_v2
before insert or update on platform.workspace_member_roles
for each row execute function app_private.guard_workspace_member_role_authority_v2();


-- Effective permission checks consult stored authority lineage in both API paths.
create or replace function app_private.check_direct_effective_permission_v2(
  p_context_id uuid,
  p_membership_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_ctx_grant record;
  v_workspace_id uuid;
  v_ctx_property_id uuid;
  v_ctx_scope_covered boolean := false;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- 1. Validate Context Grant independently (deterministic single-row, fail-closed)
  select cg.id, cg.tenant_id, cg.membership_id, cg.scope_type, cg.property_id, cg.building_id, cg.unit_id
  into v_ctx_grant
  from identity.context_grants cg
  where cg.id = p_context_id
    and cg.membership_id = p_membership_id
    and cg.starts_at <= statement_timestamp()
    and (cg.ends_at is null or cg.ends_at > statement_timestamp());

  if not found then return false; end if;

  if p_explicit_workspace_id is not null then
    -- The direct helper also evaluates grantors for delegated permission.
    -- This internal check deliberately validates the supplied membership,
    -- while the top-level native resolver verifies the current caller owns it.
    if p_target_scope_type is distinct from 'workspace'
      or p_target_scope_id is distinct from p_explicit_workspace_id
      or not app_private.native_workspace_scope_for_membership_v2(
        p_context_id,p_membership_id,p_explicit_workspace_id) then return false; end if;
    v_workspace_id := p_explicit_workspace_id;
  else
  -- 2. Resolve property from context grant
  if v_ctx_grant.property_id is not null then
    v_ctx_property_id := v_ctx_grant.property_id;
  elsif v_ctx_grant.building_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.buildings b
    where b.id = v_ctx_grant.building_id and b.tenant_id = v_ctx_grant.tenant_id;
  elsif v_ctx_grant.unit_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_ctx_grant.unit_id and u.tenant_id = v_ctx_grant.tenant_id;
  end if;

  if v_ctx_property_id is not null then
    select b.customer_workspace_id into v_workspace_id
    from platform.workspace_property_bindings b
    join platform.customer_workspaces cw on cw.id = b.customer_workspace_id
    where b.property_id = v_ctx_property_id
      and b.tenant_id = v_ctx_grant.tenant_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
      and cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  else
    select cw.id into v_workspace_id
    from platform.customer_workspaces cw
    where cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  end if;

  end if;

  if v_workspace_id is null then return false; end if;

  select v_workspace_id as workspace_id, v_ctx_grant.tenant_id as tenant_id into v_res;

  -- 3. Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  -- Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Target Scope Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Context Grant scope containment check against Target Scope
  if v_ctx_grant.scope_type::text in ('workspace', 'tenant') then
      v_ctx_scope_covered := true;
    elsif v_ctx_grant.scope_type::text = 'property' then
      if p_target_scope_type in ('property', 'building', 'unit')
         and v_ctx_grant.property_id = v_target_property_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'building' then
      if p_target_scope_type in ('building', 'unit')
         and v_ctx_grant.building_id = v_target_building_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'unit' then
      if p_target_scope_type = 'unit'
         and v_ctx_grant.unit_id = v_target_unit_id then
        v_ctx_scope_covered := true;
      end if;
    end if;

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A (Strict: requires valid context grant that covers target scope)
  if v_ctx_scope_covered and v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B (Strict: requires local role assignment that covers target scope)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

create or replace function app_private.check_effective_permission_v2(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    if p_explicit_workspace_id is null then
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2(p_context_id,p_explicit_workspace_id);
    end if;
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wd.tenant_id=v_res.tenant_id
        and mpb.module_definition_id=v_mod.id and mpb.permission_id=v_perm.id
        and mpb.valid_from<=statement_timestamp() and (mpb.valid_to is null or mpb.valid_to>statement_timestamp())))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and exists (
        select 1 from identity.context_grants gcg
        where gcg.membership_id = wd.grantor_membership_id
          and gcg.tenant_id = v_res.tenant_id
          and gcg.starts_at <= statement_timestamp()
          and (gcg.ends_at is null or gcg.ends_at > statement_timestamp())
          and app_private.check_direct_effective_permission_v2(
            gcg.id,
            wd.grantor_membership_id,
            p_permission_code,
            p_module_code,
            wd.scope_type,
            coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),
            p_explicit_workspace_id
          ) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

create or replace function app_private.check_direct_effective_permission_v1(
  p_context_id uuid,
  p_membership_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_ctx_grant record;
  v_workspace_id uuid;
  v_ctx_property_id uuid;
  v_ctx_scope_covered boolean := false;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- 1. Validate Context Grant independently (deterministic single-row, fail-closed)
  select cg.id, cg.tenant_id, cg.membership_id, cg.scope_type, cg.property_id, cg.building_id, cg.unit_id
  into v_ctx_grant
  from identity.context_grants cg
  where cg.id = p_context_id
    and cg.membership_id = p_membership_id
    and cg.starts_at <= statement_timestamp()
    and (cg.ends_at is null or cg.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- 2. Resolve property from context grant
  if v_ctx_grant.property_id is not null then
    v_ctx_property_id := v_ctx_grant.property_id;
  elsif v_ctx_grant.building_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.buildings b
    where b.id = v_ctx_grant.building_id and b.tenant_id = v_ctx_grant.tenant_id;
  elsif v_ctx_grant.unit_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_ctx_grant.unit_id and u.tenant_id = v_ctx_grant.tenant_id;
  end if;

  if v_ctx_property_id is not null then
    select b.customer_workspace_id into v_workspace_id
    from platform.workspace_property_bindings b
    join platform.customer_workspaces cw on cw.id = b.customer_workspace_id
    where b.property_id = v_ctx_property_id
      and b.tenant_id = v_ctx_grant.tenant_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
      and cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  else
    select cw.id into v_workspace_id
    from platform.customer_workspaces cw
    where cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  end if;

  if v_workspace_id is null then return false; end if;

  select v_workspace_id as workspace_id, v_ctx_grant.tenant_id as tenant_id into v_res;

  -- 3. Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  -- Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Target Scope Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Context Grant scope containment check against Target Scope
  if v_ctx_grant.scope_type::text in ('workspace', 'tenant') then
      v_ctx_scope_covered := true;
    elsif v_ctx_grant.scope_type::text = 'property' then
      if p_target_scope_type in ('property', 'building', 'unit')
         and v_ctx_grant.property_id = v_target_property_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'building' then
      if p_target_scope_type in ('building', 'unit')
         and v_ctx_grant.building_id = v_target_building_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'unit' then
      if p_target_scope_type = 'unit'
         and v_ctx_grant.unit_id = v_target_unit_id then
        v_ctx_scope_covered := true;
      end if;
    end if;

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A (Strict: requires valid context grant that covers target scope)
  if v_ctx_scope_covered and v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B (Strict: requires local role assignment that covers target scope)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

create or replace function app_private.check_effective_permission_v1(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    select * into v_res
    from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and exists (
        select 1 from identity.context_grants gcg
        where gcg.membership_id = wd.grantor_membership_id
          and gcg.tenant_id = v_res.tenant_id
          and gcg.starts_at <= statement_timestamp()
          and (gcg.ends_at is null or gcg.ends_at > statement_timestamp())
          and app_private.check_direct_effective_permission_v1(
            gcg.id,
            wd.grantor_membership_id,
            p_permission_code,
            p_module_code,
            wd.scope_type,
            coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id)
          ) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;


-- Pin the exact grantor context and authority version on canonical assignment.
create or replace function customer_api.assign_workspace_role_v1(
  p_context_id uuid,
  p_target_membership_id uuid,
  p_workspace_role_id uuid,
  p_scope_type text,
  p_property_id uuid,
  p_building_id uuid,
  p_unit_id uuid,
  p_valid_until timestamptz,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_mem identity.memberships%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_assignment platform.workspace_member_roles%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res from app_private.resolve_workspace_role_assignment_context_v2(p_context_id,p_workspace_role_id);

  v_canonical_payload := jsonb_build_object(
    'action', 'assign_role',
    'grantor_context_id', p_context_id,
    'building_id', p_building_id,
    'membership_id', p_target_membership_id,
    'property_id', p_property_id,
    'reason', v_normalized_reason,
    'scope_type', p_scope_type,
    'unit_id', p_unit_id,
    'valid_until', p_valid_until,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  -- Serialize the tenant-wide retry key before lookup, including different actions.
  perform pg_advisory_xact_lock(hashtextextended('workspace_role_command:' || v_res.tenant_id::text || ':' || p_idempotency_key,0));
  -- Authority may have changed while the command waited.
  select * into v_res from app_private.resolve_workspace_role_assignment_context_v2(p_context_id,p_workspace_role_id);

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.actor_id = auth.uid()
       and v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'assign_role'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  if p_valid_until is not null and p_valid_until<=statement_timestamp() then
    raise exception 'workspace_member_role_expiry_invalid' using errcode='22023';
  end if;
  if p_scope_type='workspace' and not exists(select 1 from identity.context_grants g
    where g.membership_id=p_target_membership_id and g.tenant_id=v_res.tenant_id and g.scope_type='tenant'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())) then
    raise exception 'workspace_member_role_tenant_context_required' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_member_role:' || v_res.workspace_id::text || ':' || p_target_membership_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'published' or v_role.valid_from > statement_timestamp() or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  select * into v_mem from identity.memberships where id = p_target_membership_id;
  if not found
     or v_mem.tenant_id <> v_res.tenant_id
     or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  insert into platform.workspace_member_roles (
    tenant_id,
    customer_workspace_id,
    membership_id,
    workspace_role_id,
    scope_type,
    property_id,
    building_id,
    unit_id,
    valid_from,
    valid_to,
    assigned_by_user_id,
    assigned_by_membership_id,
    assigned_by_context_grant_id,
    authority_policy_version,
    lock_version,
    reason
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    p_target_membership_id,
    v_role.id,
    p_scope_type,
    p_property_id,
    p_building_id,
    p_unit_id,
    statement_timestamp(),
    p_valid_until,
    auth.uid(),
    v_res.membership_id,
    p_context_id,
    2,
    1,
    v_normalized_reason
  ) returning * into v_assignment;

  v_response := jsonb_build_object(
    'action', 'assign_role',
    'id', v_assignment.id,
    'membership_id', v_assignment.membership_id,
    'workspace_role_id', v_assignment.workspace_role_id,
    'scope_type', v_assignment.scope_type,
    'valid_from', v_assignment.valid_from,
    'valid_to', v_assignment.valid_to,
    'lock_version', v_assignment.lock_version,
    'authority_depth', v_assignment.authority_depth
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'assign_role',
    v_request_hash, 1, v_assignment.id, v_response, auth.uid()
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    v_res.tenant_id, auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_ASSIGNED', 'workspace_member_role',
    v_assignment.id, null, jsonb_build_object('assignment',to_jsonb(v_assignment),'authority_sources',coalesce((select jsonb_agg(to_jsonb(s)) from platform.workspace_member_role_authority_sources s where s.assignment_id=v_assignment.id),'[]'::jsonb)), v_normalized_reason, statement_timestamp()
  );

  insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
  values(v_res.tenant_id,'workspace_member_role',v_assignment.id,v_assignment.lock_version,'workspace.role.assigned.v1',jsonb_build_object('workspace_id',v_res.workspace_id,'assignment_id',v_assignment.id,'membership_id',v_assignment.membership_id,'workspace_role_id',v_assignment.workspace_role_id,'scope_type',v_assignment.scope_type));

  return v_response;
end;
$$;


commit;
