begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(3);

select ok(not has_function_privilege('authenticated',
  'customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated callers cannot use the pre-D6 status path');
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
  '55000', 'canonical_private_attachment_required',
  'legacy scan-status lookup fails closed after D6');

select * from finish();
rollback;
