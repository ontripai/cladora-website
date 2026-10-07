begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(3);

select ok(has_function_privilege('authenticated',
  'customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated members may request a scoped status');
select ok(not has_function_privilege('anon',
  'customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'anonymous callers cannot request file status');

select set_config('request.jwt.claim.sub','12800000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select customer_api.my_private_file_scan_status_v1(
    '12800000-0000-4000-8000-000000000002',
    '12800000-0000-4000-8000-000000000003',
    '12800000-0000-4000-8000-000000000004',
    '12800000-0000-4000-8000-000000000005')$$,
  '42501', 'private_file_denied',
  'a user without conversation access cannot probe a document scan state');

select * from finish();
rollback;
