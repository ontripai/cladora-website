begin;

-- Qualify the outer tenant ID. The unqualified id previously resolved to
-- customer_workspaces.id, hiding every tenant from platform operators.
drop policy if exists tenants_platform_workspace_read on platform.tenants;
create policy tenants_platform_workspace_read on platform.tenants
for select to authenticated using (
  exists (
    select 1 from platform.customer_workspaces w
    where w.tenant_id = tenants.id
      and app_private.can_access_platform_workspace(w.id)
  )
);

commit;
