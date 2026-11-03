begin;
select plan(21);

select has_function('app_private', 'fin01_service_quote_proposal_v1',
  array['uuid','uuid','uuid','bigint','numeric','text','uuid','timestamp with time zone','boolean'],
  'FIN01 exposes one private SERVICE quote projection adapter');
select has_function('customer_api', 'read_service_quote_publications_v1',
  array['uuid','uuid','text'], 'existing SERVICE read gateway remains the bounded API');
select ok((select provolatile = 's' from pg_proc where oid =
  'app_private.fin01_service_quote_proposal_v1(uuid,uuid,uuid,bigint,numeric,text,uuid,timestamp with time zone,boolean)'::regprocedure),
  'FIN01 projection helper is stable and zero-write');
select ok((select prosecdef from pg_proc where oid =
  'customer_api.read_service_quote_publications_v1(uuid,uuid,text)'::regprocedure),
  'SERVICE consumer remains a security-definer gateway');
select ok(not has_function_privilege('authenticated',
  'app_private.fin01_service_quote_proposal_v1(uuid,uuid,uuid,bigint,numeric,text,uuid,timestamp with time zone,boolean)', 'EXECUTE'),
  'authenticated cannot call the private FIN01 adapter directly');
select ok(not has_function_privilege('service_role',
  'app_private.fin01_service_quote_proposal_v1(uuid,uuid,uuid,bigint,numeric,text,uuid,timestamp with time zone,boolean)', 'EXECUTE'),
  'service_role cannot bypass the actor-bound SERVICE gateway');
select ok(has_function_privilege('authenticated',
  'customer_api.read_service_quote_publications_v1(uuid,uuid,text)', 'EXECUTE'),
  'authenticated SERVICE users may call the existing read gateway');

create temporary table fin01_result(value jsonb) on commit drop;
insert into fin01_result values(app_private.fin01_service_quote_proposal_v1(
  'f1010000-0000-4000-8000-000000000001',
  'f1010000-0000-4000-8000-000000000002',
  'f1010000-0000-4000-8000-000000000003',
  7, 12500, 'EUR',
  'f1010000-0000-4000-8000-000000000004',
  '2026-10-19T21:05:00Z', true
));

select is((select value->>'contract_version' from fin01_result),
  'financial-proposal-posting-receipt.v1', 'projection uses the accepted FIN01 contract');
select is((select value->>'proposal_version' from fin01_result), '7',
  'proposal pins the exact quote version');
select is((select value#>>'{source,source_entity_type}' from fin01_result), 'service_quote',
  'proposal pins the real SERVICE quote source');
select is((select value#>>'{amounts,net_amount}' from fin01_result), '125.00',
  'minor units are converted without binary floating point');
select is((select value#>>'{amounts,gross_amount}' from fin01_result), '125.00',
  'gross snapshot matches the published quote total');
select is((select value#>>'{payers,0,party_id}' from fin01_result),
  'f1010000-0000-4000-8000-000000000004', 'beneficiary is the only proposed payer');
select is((select value->>'approval_state' from fin01_result), 'pending',
  'a current non-binding quote remains pending');
select is((select value->>'posting_authorization' from fin01_result), 'not_evaluated',
  'projection never grants posting authority');
select is(app_private.fin01_service_quote_proposal_v1(
  'f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002',
  'f1010000-0000-4000-8000-000000000003',7,12500,'EUR',
  'f1010000-0000-4000-8000-000000000004','2026-10-19T21:05:00Z',false)->>'approval_state',
  'expired', 'stale or expired quote cannot retain pending approval');
select throws_ok($$select app_private.fin01_service_quote_proposal_v1(
  'f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002',
  'f1010000-0000-4000-8000-000000000003',7,1.5,'EUR',
  'f1010000-0000-4000-8000-000000000004',clock_timestamp(),true)$$,
  '22023','fin01_service_quote_invalid','fractional minor units fail closed');
select throws_ok($$select app_private.fin01_service_quote_proposal_v1(
  'f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002',
  'f1010000-0000-4000-8000-000000000003',7,100,'BAD',
  'f1010000-0000-4000-8000-000000000004',clock_timestamp(),true)$$,
  '22023','fin01_service_quote_invalid','unsupported currency fails closed');
select alike(pg_get_functiondef('customer_api.read_service_quote_publications_v1(uuid,uuid,text)'::regprocedure),
  '%service_request_authorize_v1%', 'real consumer rechecks current AUTH01 authority');
select alike(pg_get_functiondef('customer_api.read_service_quote_publications_v1(uuid,uuid,text)'::regprocedure),
  '%fin01_service_quote_proposal_v1%', 'SERVICE publication API consumes FIN01 projection');
select unalike(pg_get_functiondef(
  'app_private.fin01_service_quote_proposal_v1(uuid,uuid,uuid,bigint,numeric,text,uuid,timestamp with time zone,boolean)'::regprocedure),
  '%finance.journals%', 'FIN01 projection contains no ledger write or ledger access');

select * from finish();
rollback;
