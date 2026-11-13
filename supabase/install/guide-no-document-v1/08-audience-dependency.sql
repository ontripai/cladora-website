-- Exact canonical audience dependency only; no role assignments or writer activation.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
DO $adopt$
DECLARE marker text; f record;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
 OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
 OR current_setting('cladora.guide.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
 OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true) OR current_user<>session_user
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'guide_audience_dependency_admission' USING ERRCODE='55000'; END IF;
 IF to_regclass('platform.workspace_role_handover_lineage') IS NULL
 THEN RAISE EXCEPTION 'guide_canonical_lineage_table_required' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])') IS NULL THEN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private' AND p.proname='workspace_role_handover_lineage_valid_v1')
  THEN RAISE EXCEPTION 'guide_audience_overload_collision' USING ERRCODE='55000'; END IF;
  EXECUTE $canonical_definition$create function app_private.workspace_role_handover_lineage_valid_v1(
  p_assignment_id uuid,p_permission_id uuid,p_seen uuid[] default '{}'::uuid[]
) returns boolean language plpgsql stable security definer set search_path=pg_catalog
as $$
declare
  link platform.workspace_role_handover_lineage%rowtype;
  child platform.workspace_member_roles%rowtype;
  parent platform.workspace_member_roles%rowtype;
begin
  if p_assignment_id is null or p_assignment_id=any(p_seen)
    or cardinality(p_seen)>=16 then return false; end if;
  select * into child from platform.workspace_member_roles where id=p_assignment_id;
  if not found or child.valid_from>statement_timestamp()
    or (child.valid_to is not null and child.valid_to<=statement_timestamp()) then return false; end if;
  select * into link from platform.workspace_role_handover_lineage
    where successor_assignment_id=p_assignment_id;
  if not found then return true; end if;
  if not exists(select 1 from identity.memberships m
    join identity.context_grants g on g.id=link.manager_context_id
      and g.membership_id=m.id and g.tenant_id=m.tenant_id
    where m.id=link.manager_membership_id and m.tenant_id=child.tenant_id
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.scope_type='tenant'
        or (child.scope_type<>'workspace' and g.scope_type='property'
          and g.property_id=child.property_id)
        or (child.scope_type in ('building','unit') and g.scope_type='building'
          and g.building_id=child.building_id)
        or (child.scope_type='unit' and g.scope_type='unit'
          and g.unit_id=child.unit_id))) then return false; end if;
  if p_permission_id is not null and (
    exists(select 1 from identity.memberships m
      join identity.role_permissions rp on rp.role_id=m.role_id
      where m.id=link.manager_membership_id and rp.permission_id=p_permission_id
        and rp.effect='deny')
    or exists(select 1 from platform.workspace_member_roles d
      join platform.workspace_role_permissions rp on rp.workspace_role_id=d.workspace_role_id
      join platform.workspace_roles wr on wr.id=d.workspace_role_id
      where d.membership_id=link.manager_membership_id
        and d.customer_workspace_id=child.customer_workspace_id
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp())
        and wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp()
        and (wr.valid_to is null or wr.valid_to>statement_timestamp())
        and rp.permission_id=p_permission_id and rp.effect='deny'
        and (d.scope_type='workspace'
          or (child.scope_type<>'workspace' and d.scope_type='property'
            and d.property_id=child.property_id)
          or (child.scope_type in ('building','unit') and d.scope_type='building'
            and d.building_id=child.building_id)
          or (child.scope_type='unit' and d.scope_type='unit'
            and d.unit_id=child.unit_id)))
  ) then return false; end if;
  if link.parent_assignment_id is not null then
    select * into parent from platform.workspace_member_roles where id=link.parent_assignment_id;
    if not found or parent.tenant_id<>child.tenant_id
      or parent.customer_workspace_id<>child.customer_workspace_id
      or parent.membership_id<>link.manager_membership_id
      or parent.workspace_role_id<>child.workspace_role_id
      or parent.scope_type<>child.scope_type
      or parent.property_id is distinct from child.property_id
      or parent.building_id is distinct from child.building_id
      or parent.unit_id is distinct from child.unit_id
      or (parent.valid_to is not null and child.valid_to is not null and parent.valid_to<child.valid_to)
      or (parent.valid_to is not null and child.valid_to is null) then return false; end if;
    return app_private.workspace_role_handover_lineage_valid_v1(
      parent.id,p_permission_id,p_seen||p_assignment_id);
  end if;
  if p_permission_id is null and child.scope_type='workspace' then
    return exists(select 1 from platform.workspace_member_roles source
      join platform.workspace_roles wr on wr.id=source.workspace_role_id
      where source.membership_id=link.manager_membership_id
        and source.tenant_id=child.tenant_id
        and source.customer_workspace_id=child.customer_workspace_id
        and source.scope_type='workspace'
        and source.valid_from<=statement_timestamp()
        and (source.valid_to is null or source.valid_to>statement_timestamp())
        and wr.lifecycle_status='published'
        and wr.valid_from<=statement_timestamp()
        and (wr.valid_to is null or wr.valid_to>statement_timestamp())
        and app_private.workspace_role_handover_lineage_valid_v1(
          source.id,null,p_seen||p_assignment_id));
  end if;
  -- A base-role authority remains live only while its current role grants the
  -- permission. A changed membership role, expiry, or explicit deny cuts access.
  if exists(select 1 from identity.memberships m
    join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
    join identity.permissions p on p.id=rp.permission_id
    where m.id=link.manager_membership_id
      and (p.id=p_permission_id or (p_permission_id is null and p.code='workspace.role.assign')))
    and not exists(select 1 from identity.memberships m
      join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='deny'
      join identity.permissions p on p.id=rp.permission_id
      where m.id=link.manager_membership_id
        and (p.id=p_permission_id or (p_permission_id is null and p.code='workspace.role.assign'))) then
    return true;
  end if;
  if p_permission_id is null then return false; end if;
  return exists(select 1 from platform.workspace_member_roles source
    join platform.workspace_roles wr on wr.id=source.workspace_role_id
    join platform.workspace_role_permissions rp on rp.workspace_role_id=wr.id
    where source.membership_id=link.manager_membership_id
      and source.tenant_id=child.tenant_id
      and source.customer_workspace_id=child.customer_workspace_id
      and source.valid_from<=statement_timestamp()
      and (source.valid_to is null or source.valid_to>statement_timestamp())
      and wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp()
      and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and rp.permission_id=p_permission_id and rp.effect='allow'
      and (source.scope_type='workspace'
        or (child.scope_type<>'workspace' and source.scope_type='property'
          and source.property_id=child.property_id)
        or (child.scope_type in ('building','unit') and source.scope_type='building'
          and source.building_id=child.building_id)
        or (child.scope_type='unit' and source.scope_type='unit'
          and source.unit_id=child.unit_id))
      and app_private.workspace_role_handover_lineage_valid_v1(
        source.id,p_permission_id,p_seen||p_assignment_id));
end;
$$;$canonical_definition$;
  REVOKE ALL ON FUNCTION app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 SELECT p.*,r.rolname owner_name INTO STRICT f FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])'::regprocedure;
 IF f.prosrc IS DISTINCT FROM $canonical_body$
declare
  link platform.workspace_role_handover_lineage%rowtype;
  child platform.workspace_member_roles%rowtype;
  parent platform.workspace_member_roles%rowtype;
begin
  if p_assignment_id is null or p_assignment_id=any(p_seen)
    or cardinality(p_seen)>=16 then return false; end if;
  select * into child from platform.workspace_member_roles where id=p_assignment_id;
  if not found or child.valid_from>statement_timestamp()
    or (child.valid_to is not null and child.valid_to<=statement_timestamp()) then return false; end if;
  select * into link from platform.workspace_role_handover_lineage
    where successor_assignment_id=p_assignment_id;
  if not found then return true; end if;
  if not exists(select 1 from identity.memberships m
    join identity.context_grants g on g.id=link.manager_context_id
      and g.membership_id=m.id and g.tenant_id=m.tenant_id
    where m.id=link.manager_membership_id and m.tenant_id=child.tenant_id
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.scope_type='tenant'
        or (child.scope_type<>'workspace' and g.scope_type='property'
          and g.property_id=child.property_id)
        or (child.scope_type in ('building','unit') and g.scope_type='building'
          and g.building_id=child.building_id)
        or (child.scope_type='unit' and g.scope_type='unit'
          and g.unit_id=child.unit_id))) then return false; end if;
  if p_permission_id is not null and (
    exists(select 1 from identity.memberships m
      join identity.role_permissions rp on rp.role_id=m.role_id
      where m.id=link.manager_membership_id and rp.permission_id=p_permission_id
        and rp.effect='deny')
    or exists(select 1 from platform.workspace_member_roles d
      join platform.workspace_role_permissions rp on rp.workspace_role_id=d.workspace_role_id
      join platform.workspace_roles wr on wr.id=d.workspace_role_id
      where d.membership_id=link.manager_membership_id
        and d.customer_workspace_id=child.customer_workspace_id
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp())
        and wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp()
        and (wr.valid_to is null or wr.valid_to>statement_timestamp())
        and rp.permission_id=p_permission_id and rp.effect='deny'
        and (d.scope_type='workspace'
          or (child.scope_type<>'workspace' and d.scope_type='property'
            and d.property_id=child.property_id)
          or (child.scope_type in ('building','unit') and d.scope_type='building'
            and d.building_id=child.building_id)
          or (child.scope_type='unit' and d.scope_type='unit'
            and d.unit_id=child.unit_id)))
  ) then return false; end if;
  if link.parent_assignment_id is not null then
    select * into parent from platform.workspace_member_roles where id=link.parent_assignment_id;
    if not found or parent.tenant_id<>child.tenant_id
      or parent.customer_workspace_id<>child.customer_workspace_id
      or parent.membership_id<>link.manager_membership_id
      or parent.workspace_role_id<>child.workspace_role_id
      or parent.scope_type<>child.scope_type
      or parent.property_id is distinct from child.property_id
      or parent.building_id is distinct from child.building_id
      or parent.unit_id is distinct from child.unit_id
      or (parent.valid_to is not null and child.valid_to is not null and parent.valid_to<child.valid_to)
      or (parent.valid_to is not null and child.valid_to is null) then return false; end if;
    return app_private.workspace_role_handover_lineage_valid_v1(
      parent.id,p_permission_id,p_seen||p_assignment_id);
  end if;
  if p_permission_id is null and child.scope_type='workspace' then
    return exists(select 1 from platform.workspace_member_roles source
      join platform.workspace_roles wr on wr.id=source.workspace_role_id
      where source.membership_id=link.manager_membership_id
        and source.tenant_id=child.tenant_id
        and source.customer_workspace_id=child.customer_workspace_id
        and source.scope_type='workspace'
        and source.valid_from<=statement_timestamp()
        and (source.valid_to is null or source.valid_to>statement_timestamp())
        and wr.lifecycle_status='published'
        and wr.valid_from<=statement_timestamp()
        and (wr.valid_to is null or wr.valid_to>statement_timestamp())
        and app_private.workspace_role_handover_lineage_valid_v1(
          source.id,null,p_seen||p_assignment_id));
  end if;
  -- A base-role authority remains live only while its current role grants the
  -- permission. A changed membership role, expiry, or explicit deny cuts access.
  if exists(select 1 from identity.memberships m
    join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
    join identity.permissions p on p.id=rp.permission_id
    where m.id=link.manager_membership_id
      and (p.id=p_permission_id or (p_permission_id is null and p.code='workspace.role.assign')))
    and not exists(select 1 from identity.memberships m
      join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='deny'
      join identity.permissions p on p.id=rp.permission_id
      where m.id=link.manager_membership_id
        and (p.id=p_permission_id or (p_permission_id is null and p.code='workspace.role.assign'))) then
    return true;
  end if;
  if p_permission_id is null then return false; end if;
  return exists(select 1 from platform.workspace_member_roles source
    join platform.workspace_roles wr on wr.id=source.workspace_role_id
    join platform.workspace_role_permissions rp on rp.workspace_role_id=wr.id
    where source.membership_id=link.manager_membership_id
      and source.tenant_id=child.tenant_id
      and source.customer_workspace_id=child.customer_workspace_id
      and source.valid_from<=statement_timestamp()
      and (source.valid_to is null or source.valid_to>statement_timestamp())
      and wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp()
      and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and rp.permission_id=p_permission_id and rp.effect='allow'
      and (source.scope_type='workspace'
        or (child.scope_type<>'workspace' and source.scope_type='property'
          and source.property_id=child.property_id)
        or (child.scope_type in ('building','unit') and source.scope_type='building'
          and source.building_id=child.building_id)
        or (child.scope_type='unit' and source.scope_type='unit'
          and source.unit_id=child.unit_id))
      and app_private.workspace_role_handover_lineage_valid_v1(
        source.id,p_permission_id,p_seen||p_assignment_id));
end;
$canonical_body$
 OR NOT f.prosecdef OR f.provolatile<>'s' OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR NOT has_function_privilege(current_user,f.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'guide_audience_canonical_mismatch' USING ERRCODE='55000'; END IF;
END $adopt$;
COMMIT;
