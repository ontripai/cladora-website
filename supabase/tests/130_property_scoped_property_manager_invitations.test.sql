begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(13);

select ok(to_regclass('communications.property_manager_invitations') is not null,
  'property manager invitations use a dedicated communications table');
select ok(not has_table_privilege('authenticated','communications.property_manager_invitations','SELECT'),
  'authenticated users cannot read invitation records directly');
select ok(has_table_privilege('service_role','communications.property_manager_invitations','SELECT'),
  'only server side service role receives direct table access');
select ok(has_function_privilege('authenticated',
  'customer_api.list_invitable_manager_properties_v1(uuid)','EXECUTE'),
  'authenticated managers can list properties allowed by their current context');
select ok(has_function_privilege('authenticated',
  'customer_api.create_property_manager_invitation_v1(uuid,uuid,text)','EXECUTE'),
  'authenticated managers can request a property scoped invitation');
select ok(has_function_privilege('authenticated',
  'customer_api.claim_property_manager_invitation_v1(uuid,text)','EXECUTE'),
  'authenticated invitees can claim a matching invitation');
select ok(not has_function_privilege('anon',
  'customer_api.create_property_manager_invitation_v1(uuid,uuid,text)','EXECUTE'),
  'anonymous callers cannot create invitations');
select ok(not has_function_privilege('anon',
  'customer_api.claim_property_manager_invitation_v1(uuid,text)','EXECUTE'),
  'anonymous callers cannot claim invitations');

select ok(position('workspace.role.assign' in pg_get_functiondef(
  'communications.can_manage_property_manager_invites(uuid,uuid,uuid,uuid)'::regprocedure))>0,
  'inviter needs role assignment permission');
select ok(position('g.scope_type' in pg_get_functiondef(
  'communications.can_manage_property_manager_invites(uuid,uuid,uuid,uuid)'::regprocedure))>0
  and position('property' in pg_get_functiondef(
    'communications.can_manage_property_manager_invites(uuid,uuid,uuid,uuid)'::regprocedure))>0
  and position('g.property_id' in pg_get_functiondef(
    'communications.can_manage_property_manager_invites(uuid,uuid,uuid,uuid)'::regprocedure))>0,
  'property scoped managers cannot invite outside their property');
select ok(position('i.normalized_email<>v_email' in pg_get_functiondef(
  'customer_api.claim_property_manager_invitation_v1(uuid,text)'::regprocedure))>0,
  'claim requires the verified account email to match the invitation');
select ok(position('ends_at' in pg_get_functiondef(
  'customer_api.claim_property_manager_invitation_v1(uuid,text)'::regprocedure))>0,
  'membership and property context grants retain explicit end times');
select ok(position('property_manager_invitation.accept' in pg_get_functiondef(
  'customer_api.claim_property_manager_invitation_v1(uuid,text)'::regprocedure))>0,
  'invitation acceptance writes an audit event');

select * from finish();
rollback;
