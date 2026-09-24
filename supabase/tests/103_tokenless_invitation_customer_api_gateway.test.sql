begin;
set local search_path = public, extensions;

select plan(26);

select ok(
  to_regprocedure('customer_api.list_my_claimable_workspace_invitations_v1()') is not null,
  'claimable invitation list gateway exists'
);
select ok(
  to_regprocedure('customer_api.claim_workspace_invitation_v1(uuid,text,text,text)') is not null,
  'invitation claim gateway exists'
);

select ok(not has_function_privilege('public', 'customer_api.list_my_claimable_workspace_invitations_v1()', 'execute'), 'PUBLIC cannot list invitations through the gateway');
select ok(not has_function_privilege('anon', 'customer_api.list_my_claimable_workspace_invitations_v1()', 'execute'), 'anonymous callers cannot list invitations through the gateway');
select ok(not has_function_privilege('service_role', 'customer_api.list_my_claimable_workspace_invitations_v1()', 'execute'), 'service role cannot list end-user invitations through the gateway');
select ok(has_function_privilege('authenticated', 'customer_api.list_my_claimable_workspace_invitations_v1()', 'execute'), 'authenticated callers may list their claimable invitations');

select ok(not has_function_privilege('public', 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)', 'execute'), 'PUBLIC cannot claim invitations through the gateway');
select ok(not has_function_privilege('anon', 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)', 'execute'), 'anonymous callers cannot claim invitations through the gateway');
select ok(not has_function_privilege('service_role', 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)', 'execute'), 'service role cannot claim end-user invitations through the gateway');
select ok(has_function_privilege('authenticated', 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)', 'execute'), 'authenticated callers may claim their invitation');

select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'customer_api.list_my_claimable_workspace_invitations_v1()'::regprocedure),
  'list gateway is SECURITY INVOKER'
);
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)'::regprocedure),
  'claim gateway is SECURITY INVOKER'
);
select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog' from pg_proc p where p.oid = 'customer_api.list_my_claimable_workspace_invitations_v1()'::regprocedure),
  'list gateway fixes search_path to pg_catalog'
);
select ok(
  (select coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog' from pg_proc p where p.oid = 'customer_api.claim_workspace_invitation_v1(uuid,text,text,text)'::regprocedure),
  'claim gateway fixes search_path to pg_catalog'
);
select ok(
  position('association_admin' in pg_get_functiondef('platform.claim_workspace_invitation(uuid,text,text,text)'::regprocedure)) > 0
  and position('property_manager' in pg_get_functiondef('platform.claim_workspace_invitation(uuid,text,text,text)'::regprocedure)) > 0,
  'canonical manager roles are recognized as primary administrators'
);

do $$
declare
  v_role_id uuid;
begin
  select id into strict v_role_id
  from identity.roles
  where tenant_id is null
    and is_system = true
    and lower(code) = 'association_admin'
  order by id
  limit 1;

  insert into auth.users (id, email, email_confirmed_at) values
    ('10300000-0000-0000-0000-000000000001', 'gateway.invitee@cladora.test', statement_timestamp()),
    ('10300000-0000-0000-0000-000000000002', 'gateway.inviter@cladora.test', statement_timestamp());

  insert into platform.tenants (id, legal_name, registration_number)
  values ('10310000-0000-0000-0000-000000000001', 'Gateway Test Association', 'RO-GATEWAY-103');

  insert into platform.customer_workspaces (
    id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
  ) values (
    '10320000-0000-0000-0000-000000000001',
    '10310000-0000-0000-0000-000000000001',
    'ASSOCIATION',
    'PROVISIONING',
    'Gateway Test Workspace',
    'PILOT'
  );

  insert into platform.workspace_invitations (
    id, customer_workspace_id, normalized_email, role_id, scope_type,
    token_hash, status, expires_at, created_at, invited_by, invitation_reason
  ) values (
    '10330000-0000-0000-0000-000000000001',
    '10320000-0000-0000-0000-000000000001',
    'gateway.invitee@cladora.test',
    v_role_id,
    'tenant',
    digest('gateway-test-token', 'sha256'),
    'sent',
    statement_timestamp() + interval '2 hours',
    statement_timestamp(),
    '10300000-0000-0000-0000-000000000002',
    'Customer API gateway test'
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_like(
  $$select customer_api.list_my_claimable_workspace_invitations_v1()$$,
  '%authentication_required%',
  'missing Auth user cannot list invitations'
);
select throws_like(
  $$select customer_api.claim_workspace_invitation_v1('10330000-0000-0000-0000-000000000001','Invitee','fa','Europe/Bucharest')$$,
  '%authentication_required%',
  'missing Auth user cannot claim invitations'
);

select set_config('request.jwt.claims', '{"sub":"10300000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(customer_api.list_my_claimable_workspace_invitations_v1()),
  1,
  'verified invitee sees exactly one matching invitation through customer_api'
);
select is(
  customer_api.claim_workspace_invitation_v1(
    '10330000-0000-0000-0000-000000000001',
    'Gateway Invitee',
    'fa',
    'Europe/Bucharest'
  )->>'claim_status',
  'claimed',
  'verified invitee claims the invitation through customer_api'
);
select is(
  customer_api.claim_workspace_invitation_v1(
    '10330000-0000-0000-0000-000000000001',
    'Gateway Invitee',
    'fa',
    'Europe/Bucharest'
  )->>'claim_status',
  'already_claimed_by_you',
  'gateway claim retry is idempotent'
);
select is(
  (select count(*)::integer from platform.workspace_invitations),
  0,
  'RLS still prevents direct invitation enumeration'
);

reset role;

select ok(
  (select primary_admin_user_id = '10300000-0000-0000-0000-000000000001'
   from platform.customer_workspaces
   where id = '10320000-0000-0000-0000-000000000001'),
  'association administrator is bound as the Workspace primary administrator'
);
select ok(
  (select count(*) = 1
   from identity.memberships m
   join identity.roles r on r.id = m.role_id
   where m.tenant_id = '10310000-0000-0000-0000-000000000001'
     and m.user_id = '10300000-0000-0000-0000-000000000001'
     and m.status = 'active'
     and lower(r.code) = 'association_admin'),
  'claim creates the canonical active manager membership'
);
select ok(
  (select count(*) = 1
   from identity.context_grants cg
   join identity.memberships m on m.id = cg.membership_id
   where m.user_id = '10300000-0000-0000-0000-000000000001'
     and cg.tenant_id = '10310000-0000-0000-0000-000000000001'
     and cg.scope_type = 'tenant'
     and cg.ends_at is null),
  'claim creates one open tenant context'
);
select ok(
  (select count(*) = 1
   from audit.events
   where action = 'WORKSPACE_INVITATION_CLAIMED'
     and entity_id = '10330000-0000-0000-0000-000000000001'),
  'first gateway claim creates one audit event'
);
select ok(
  (select count(*) = 0
   from audit.events
   where action = 'WORKSPACE_INVITATION_CLAIMED'
     and (
       coalesce(reason, '') ilike '%gateway.invitee@cladora.test%'
       or coalesce(before_snapshot::text, '') ilike '%gateway.invitee@cladora.test%'
       or coalesce(after_snapshot::text, '') ilike '%gateway.invitee@cladora.test%'
     )),
  'gateway claim audit contains no invitation email PII'
);

select * from finish();
rollback;
