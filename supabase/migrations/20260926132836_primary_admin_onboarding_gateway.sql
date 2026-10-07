begin;

-- Expose only the existing actor-checked onboarding operations through the API gateway.
create or replace function customer_api.get_my_primary_admin_onboarding_v1(p_workspace_id uuid)
returns table(customer_workspace_id uuid, workspace_version integer, onboarding_completed boolean)
language sql security invoker stable set search_path = pg_catalog
as $$ select * from platform.get_my_primary_admin_onboarding(p_workspace_id); $$;

create or replace function customer_api.complete_primary_admin_onboarding_v1(
  p_workspace_id uuid, p_expected_version integer, p_reason text
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_workspace platform.customer_workspaces;
begin
  v_workspace := platform.complete_primary_admin_onboarding(p_workspace_id, p_expected_version, p_reason);
  return jsonb_build_object('customer_workspace_id', v_workspace.id,
    'workspace_version', v_workspace.version,
    'onboarding_completed', v_workspace.onboarding_completed_at is not null);
end;
$$;

revoke all on function customer_api.get_my_primary_admin_onboarding_v1(uuid) from public, anon, service_role;
revoke all on function customer_api.complete_primary_admin_onboarding_v1(uuid,integer,text) from public, anon, service_role;
grant execute on function customer_api.get_my_primary_admin_onboarding_v1(uuid) to authenticated;
grant execute on function customer_api.complete_primary_admin_onboarding_v1(uuid,integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
