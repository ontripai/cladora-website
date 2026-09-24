begin;

-- Reveal a tenant's name only when the platform actor can access one of its
-- workspaces. This allows a security-invoker read model to show the legal name.
create policy tenants_platform_workspace_read on platform.tenants
for select to authenticated using (
  exists (
    select 1 from platform.customer_workspaces w
    where w.tenant_id = id and app_private.can_access_platform_workspace(w.id)
  )
);

create or replace view customer_api.customer_workspaces_v1
with (security_invoker = true) as
select w.*, t.legal_name as tenant_legal_name
from platform.customer_workspaces w
join platform.tenants t on t.id = w.tenant_id;

-- CREATE OR REPLACE VIEW retains the existing SELECT grant. Explicitly keep
-- the API read model restricted to authenticated sessions.
revoke all on customer_api.customer_workspaces_v1 from public, anon, service_role;
grant select on customer_api.customer_workspaces_v1 to authenticated;

commit;
