begin;
select plan(17);

select ok(to_regprocedure('customer_api.has_platform_access_v1()') is not null, 'platform access routing gateway exists');
select ok(to_regprocedure('app_private.has_platform_access_for_routing()') is not null, 'internal Platform access predicate exists');
select ok(has_function_privilege('authenticated', 'customer_api.has_platform_access_v1()', 'EXECUTE'), 'authenticated callers may resolve their own routing destination');
select ok(not has_function_privilege('anon', 'customer_api.has_platform_access_v1()', 'EXECUTE'), 'anonymous callers cannot query Platform routing state');
select ok(not has_function_privilege('service_role', 'customer_api.has_platform_access_v1()', 'EXECUTE'), 'service role cannot use the end-user routing gateway');
select ok(not (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'has_platform_access_v1'), 'exposed routing gateway is security invoker');
select ok((select coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'has_platform_access_v1'), 'routing gateway has a fixed minimal search path');
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_private' and p.proname = 'has_platform_access_for_routing'), 'internal routing predicate is security definer');
select ok((select coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog, platform%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_private' and p.proname = 'has_platform_access_for_routing'), 'internal routing predicate has a fixed search path');
select ok(not has_function_privilege('public', 'app_private.has_platform_access_for_routing()', 'EXECUTE'), 'PUBLIC cannot invoke the internal routing predicate');
select ok(not has_function_privilege('anon', 'app_private.has_platform_access_for_routing()', 'EXECUTE'), 'anonymous callers cannot invoke the internal routing predicate');

do $$
begin
  insert into auth.users (id, email) values
    ('10100000-0000-0000-0000-000000000001', 'active-platform-101@cladora.test'),
    ('10100000-0000-0000-0000-000000000002', 'roleless-platform-101@cladora.test'),
    ('10100000-0000-0000-0000-000000000003', 'customer-only-101@cladora.test');

  insert into platform.platform_users (id, auth_user_id, employee_ref, display_name, status) values
    ('10110000-0000-0000-0000-000000000001', '10100000-0000-0000-0000-000000000001', 'ACTIVE-101', 'Active Platform User', 'active'),
    ('10110000-0000-0000-0000-000000000002', '10100000-0000-0000-0000-000000000002', 'ROLELESS-101', 'Roleless Platform User', 'active');

  insert into platform.platform_role_assignments
    (platform_user_id, role, status, valid_from, grant_reason)
  values
    ('10110000-0000-0000-0000-000000000001', 'PLATFORM_SUPER_ADMIN', 'active', statement_timestamp() - interval '1 day', 'Routing gateway test');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select ok(customer_api.has_platform_access_v1(), 'active Platform user is recognized at AAL1 for MFA routing');

select set_config('request.jwt.claims', '{"sub":"10100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select ok(not customer_api.has_platform_access_v1(), 'Platform user without an active role is not authorized for Platform routing');

select set_config('request.jwt.claims', '{"sub":"10100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);
select ok(not customer_api.has_platform_access_v1(), 'customer-only user is routed away from Platform');

select set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1"}', true);
select throws_like($$select customer_api.has_platform_access_v1()$$, '%authentication_required%', 'missing authenticated user fails closed');

reset role;
update platform.platform_role_assignments
set valid_until = statement_timestamp() - interval '1 minute'
where platform_user_id = '10110000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select ok(not customer_api.has_platform_access_v1(), 'expired Platform role is not accepted');

reset role;
update platform.platform_role_assignments
set valid_until = null, status = 'revoked'
where platform_user_id = '10110000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select ok(not customer_api.has_platform_access_v1(), 'revoked Platform role is not accepted even at AAL2');

select * from finish();
rollback;
