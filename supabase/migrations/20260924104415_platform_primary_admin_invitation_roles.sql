begin;

-- Expose only the two canonical primary-administrator roles required by the
-- control-plane invitation flow. The view remains an invoker view so the RLS
-- policy on identity.roles is still enforced for every caller.
create or replace view customer_api.workspace_primary_admin_roles_v1
with (security_invoker = true) as
select id, code, name
from identity.roles
where tenant_id is null
  and lower(code) in ('association_admin', 'property_manager');

revoke all on customer_api.workspace_primary_admin_roles_v1
  from public, anon, service_role;
grant select on customer_api.workspace_primary_admin_roles_v1
  to authenticated;

notify pgrst, 'reload schema';

commit;
