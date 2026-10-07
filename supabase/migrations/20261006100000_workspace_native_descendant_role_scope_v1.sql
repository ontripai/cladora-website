
begin;

-- Tenant context may select a workspace when the member has an active local
-- role scoped to that workspace or to an active property inside it. The selected
-- workspace only narrows context; permission checks still enforce exact scope.
create or replace function app_private.native_workspace_scope_for_membership_v2(
  p_context_id uuid, p_membership_id uuid, p_workspace_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=g.tenant_id
    join platform.workspace_member_roles a on a.membership_id=m.id
      and a.tenant_id=w.tenant_id and a.customer_workspace_id=w.id
    join platform.workspace_roles wr on wr.id=a.workspace_role_id
      and wr.tenant_id=w.tenant_id and wr.customer_workspace_id=w.id
    where g.id=p_context_id and m.id=p_membership_id and g.scope_type='tenant'
      and g.property_id is null and g.building_id is null and g.unit_id is null
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and w.lifecycle_status='ACTIVE'
      and a.scope_type in ('workspace','property','building','unit')
      and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
      and wr.scope_ceiling in ('workspace','property','building','unit')
      and case a.scope_type
        when 'workspace' then wr.scope_ceiling='workspace'
        when 'property' then wr.scope_ceiling in ('workspace','property')
        when 'building' then wr.scope_ceiling in ('workspace','property','building')
        when 'unit' then wr.scope_ceiling in ('workspace','property','building','unit')
        else false end
      and wr.lifecycle_status='published'
      and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and (
        (a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null)
        or (a.scope_type='property' and a.building_id is null and a.unit_id is null
          and exists (
            select 1 from platform.workspace_property_bindings b
            where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
              and b.property_id=a.property_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='building' and a.property_id is null and a.unit_id is null
          and exists (
            select 1 from portfolio.buildings pb
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pb.id=a.building_id and pb.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='unit' and a.property_id is null and a.building_id is null
          and exists (
            select 1 from portfolio.units pu
            join portfolio.buildings pb on pb.id=pu.building_id and pb.tenant_id=pu.tenant_id
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pu.id=a.unit_id and pu.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
      )
      and (
        a.authority_policy_version=1
        or exists (
          select 1 from platform.workspace_role_permissions rp
          join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
          where rp.workspace_role_id=wr.id and rp.effect='allow'
            and app_private.workspace_member_role_authority_active_v1(
              a.id,rp.permission_id,rm.module_definition_id,
              a.scope_type,
              case a.scope_type when 'property' then a.property_id when 'building' then a.building_id
                when 'unit' then a.unit_id else null end,
              '{}'::uuid[])
        )
      )
  );
$$;

comment on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)
 is 'Resolves a tenant context to a workspace when the member has a current local role at workspace or a bound descendant scope. Permission evaluation continues to enforce the assignment scope and live authority lineage.';

commit;
