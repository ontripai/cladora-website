begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(5);

select ok(has_function_privilege('authenticated',
  'customer_api.create_owner_portfolio_invitation_v1(uuid,uuid,uuid,uuid,text)','EXECUTE'),
  'authenticated manager can request the scoped owner invitation');
select ok(not has_function_privilege('anon',
  'customer_api.create_owner_portfolio_invitation_v1(uuid,uuid,uuid,uuid,text)','EXECUTE'),
  'anonymous users cannot create owner portfolio invitations');
select ok(not has_function_privilege('authenticated',
  'customer_api.claim_unit_invitation_core_v1(uuid,text)','EXECUTE'),
  'the underlying claim function is not exposed to authenticated callers');
select ok(not has_function_privilege('anon',
  'customer_api.claim_unit_invitation_v1(uuid,text)','EXECUTE'),
  'anonymous callers cannot accept invitations');
select set_config('request.jwt.claim.sub','12900000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select customer_api.create_owner_portfolio_invitation_v1(
    '12900000-0000-4000-8000-000000000002',
    '12900000-0000-4000-8000-000000000003',
    '12900000-0000-4000-8000-000000000004',
    '12900000-0000-4000-8000-000000000005','fake@example.invalid')$$,
  '42501','owner_invitation_denied',
  'a user outside the scoped workspace cannot invite an owner');

select * from finish();
rollback;
