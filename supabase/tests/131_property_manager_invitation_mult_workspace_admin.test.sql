begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(6);

select ok(has_function_privilege('authenticated',
  'customer_api.list_invitable_manager_properties_v1(uuid)','EXECUTE'),
  'authenticated admins can list each eligible property across their active workspace scope');
select ok(has_function_privilege('authenticated',
  'customer_api.create_property_manager_invitation_v1(uuid,uuid,text)','EXECUTE'),
  'authenticated admins can create an invitation for one eligible property');
select ok(position('workspace_property_bindings' in pg_get_functiondef(
  'customer_api.list_invitable_manager_properties_v1(uuid)'::regprocedure))>0
  and position('can_manage_property_manager_invites' in pg_get_functiondef(
  'customer_api.list_invitable_manager_properties_v1(uuid)'::regprocedure))>0,
  'property choices are checked individually against the caller context');
select ok(position('identity.context_grants' in pg_get_functiondef(
  'customer_api.create_property_manager_invitation_v1(uuid,uuid,text)'::regprocedure))>0
  and position('can_manage_property_manager_invites' in pg_get_functiondef(
  'customer_api.create_property_manager_invitation_v1(uuid,uuid,text)'::regprocedure))>0,
  'creating a property invitation rechecks the caller membership and property scope');
select ok(position('resolve_workspace_from_customer_context_v1' in pg_get_functiondef(
  'customer_api.list_invitable_manager_properties_v1(uuid)'::regprocedure))=0,
  'listing is not blocked when a tenant admin has more than one workspace');
select ok(position('workspace_property_bindings' in pg_get_functiondef(
  'customer_api.list_managed_property_manager_invitations_v1(uuid,uuid)'::regprocedure))>0,
  'pending invitations are listed only through a currently active property binding');

select * from finish();
rollback;
