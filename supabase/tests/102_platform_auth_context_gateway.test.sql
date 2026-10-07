begin;
select plan(17);

select ok(to_regprocedure('customer_api.get_my_platform_auth_context_v1()') is not null, 'Platform context gateway exists');
select ok(to_regprocedure('app_private.get_my_platform_auth_context_v1()') is not null, 'internal Platform context projection exists');
select ok(has_function_privilege('authenticated', 'customer_api.get_my_platform_auth_context_v1()', 'EXECUTE'), 'authenticated callers may load their own Platform context');
select ok(not has_function_privilege('anon', 'customer_api.get_my_platform_auth_context_v1()', 'EXECUTE'), 'anonymous callers cannot load Platform context');
select ok(not has_function_privilege('service_role', 'customer_api.get_my_platform_auth_context_v1()', 'EXECUTE'), 'service role cannot use the end-user context gateway');
select ok(not (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='customer_api' and p.proname='get_my_platform_auth_context_v1'), 'exposed gateway is security invoker');
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname='get_my_platform_auth_context_v1'), 'internal projection is security definer');
select ok((select coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog, platform%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname='get_my_platform_auth_context_v1'), 'internal projection fixes its search path');

insert into auth.users (id, email) values
  ('10200000-0000-0000-0000-000000000001', 'active-platform-102@cladora.test'),
  ('10200000-0000-0000-0000-000000000002', 'customer-only-102@cladora.test');

insert into platform.platform_users (id, auth_user_id, employee_ref, display_name, status)
values ('10210000-0000-0000-0000-000000000001', '10200000-0000-0000-0000-000000000001', 'ACTIVE-102', 'Active Platform User', 'active');

insert into platform.platform_role_assignments
  (id, platform_user_id, role, status, valid_from, grant_reason)
values
  ('10220000-0000-0000-0000-000000000001', '10210000-0000-0000-0000-000000000001', 'PLATFORM_SUPER_ADMIN', 'active', statement_timestamp() - interval '1 day', 'Context gateway test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10200000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_like($$select customer_api.get_my_platform_auth_context_v1()$$, '%mfa_required%', 'AAL1 callers fail closed');

select set_config('request.jwt.claims', '{"sub":"10200000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is((customer_api.get_my_platform_auth_context_v1()->>'is_authorized')::boolean, true, 'active AAL2 Platform caller is authorized');
select is(customer_api.get_my_platform_auth_context_v1()->'platform_user'->>'auth_user_id', '10200000-0000-0000-0000-000000000001', 'context contains only the caller Platform record');
select is(jsonb_array_length(customer_api.get_my_platform_auth_context_v1()->'roles'), 1, 'context contains the active caller role');
select is(customer_api.get_my_platform_auth_context_v1()->'roles'->0->>'role', 'PLATFORM_SUPER_ADMIN', 'context preserves the assigned Platform role');
select is(jsonb_array_length(customer_api.get_my_platform_auth_context_v1()->'assignments'), 0, 'context returns an empty assignment array when none exist');

select set_config('request.jwt.claims', '{"sub":"10200000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select is((customer_api.get_my_platform_auth_context_v1()->>'is_authorized')::boolean, false, 'non-Platform AAL2 caller is not authorized');
select is(customer_api.get_my_platform_auth_context_v1()->'platform_user', 'null'::jsonb, 'non-Platform caller receives no Platform record');

select set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal2"}', true);
select throws_like($$select customer_api.get_my_platform_auth_context_v1()$$, '%authentication_required%', 'missing authenticated user fails closed');

select * from finish();
rollback;
