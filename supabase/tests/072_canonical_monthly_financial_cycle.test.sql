-- Test 072: Canonical monthly financial cycle contracts
begin;
select plan(45);

select has_table('finance','monthly_cycles','monthly cycles exist');
select has_table('finance','monthly_cycle_sources','monthly sources exist');
select has_table('finance','monthly_cycle_reviews','monthly reviews exist');
select has_table('finance','monthly_cycle_publications','monthly publications exist');
select has_table('finance','monthly_cycle_exceptions','monthly exceptions exist');

select ok((select relrowsecurity from pg_class where oid='finance.monthly_cycles'::regclass),'cycles RLS enabled');
select ok((select relrowsecurity from pg_class where oid='finance.monthly_cycle_sources'::regclass),'sources RLS enabled');
select ok((select relrowsecurity from pg_class where oid='finance.monthly_cycle_reviews'::regclass),'reviews RLS enabled');
select ok((select relrowsecurity from pg_class where oid='finance.monthly_cycle_publications'::regclass),'publications RLS enabled');
select ok((select relrowsecurity from pg_class where oid='finance.monthly_cycle_exceptions'::regclass),'exceptions RLS enabled');

select has_function('customer_api','create_monthly_cycle_v1',array['uuid','uuid','uuid','text'],'create RPC exists');
select has_function('customer_api','capture_monthly_cycle_source_v1',array['uuid','uuid','text','uuid'],'capture RPC exists');
select has_function('customer_api','submit_monthly_cycle_v1',array['uuid','uuid','uuid'],'submit RPC exists');
select has_function('customer_api','review_monthly_cycle_v1',array['uuid','uuid','text','text'],'review RPC exists');
select has_function('customer_api','publish_monthly_cycle_v1',array['uuid','uuid'],'publish RPC exists');
select has_function('customer_api','close_monthly_cycle_v1',array['uuid','uuid','text'],'close RPC exists');
select has_function('customer_api','list_monthly_cycles_v1',array['uuid','uuid'],'list RPC exists');

select ok(not (select prosecdef from pg_proc where oid='customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text)'::regprocedure),'create wrapper is invoker');
select ok(not (select prosecdef from pg_proc where oid='customer_api.publish_monthly_cycle_v1(uuid,uuid)'::regprocedure),'publish wrapper is invoker');
select ok((select proconfig@>array['search_path=pg_catalog'] from pg_proc where oid='customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text)'::regprocedure),'create search path pinned');
select ok((select proconfig@>array['search_path=pg_catalog'] from pg_proc where oid='customer_api.publish_monthly_cycle_v1(uuid,uuid)'::regprocedure),'publish search path pinned');
select ok(not has_function_privilege('anon','customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text)','EXECUTE'),'anon denied create');
select ok(not has_function_privilege('anon','customer_api.publish_monthly_cycle_v1(uuid,uuid)','EXECUTE'),'anon denied publish');
select ok(has_function_privilege('authenticated','customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text)','EXECUTE'),'authenticated reaches guarded create');
select ok(has_function_privilege('authenticated','customer_api.publish_monthly_cycle_v1(uuid,uuid)','EXECUTE'),'authenticated reaches guarded publish');
select ok(not has_function_privilege('anon','customer_api.list_monthly_cycles_v1(uuid,uuid)','EXECUTE'),'anon denied list');
select ok(has_function_privilege('authenticated','customer_api.list_monthly_cycles_v1(uuid,uuid)','EXECUTE'),'authenticated reaches guarded list');
select ok(not has_function_privilege('authenticated','customer_api.close_accounting_period_v1(uuid,uuid,text)','EXECUTE'),'legacy direct period close bypass disabled');
select ok(has_function_privilege('authenticated','app_private.create_monthly_cycle_internal_v1(uuid,uuid,uuid,text)','EXECUTE'),'invoker wrapper reaches guarded internal create');
select ok(has_function_privilege('authenticated','app_private.publish_monthly_cycle_internal_v1(uuid,uuid)','EXECUTE'),'invoker wrapper reaches guarded internal publish');

select ok(exists(select 1 from identity.permissions where code='finance.monthly.read'),'read permission exists');
select ok(exists(select 1 from identity.permissions where code='finance.monthly.manage'),'manage permission exists');
select ok(exists(select 1 from identity.permissions where code='finance.monthly.review'),'review permission exists');
select ok(position('mfa_required' in pg_get_functiondef('app_private.monthly_cycle_context_internal_v1(uuid,text,boolean)'::regprocedure))>0,'AAL2 fail closed exists');
select ok(position('property_scope_denied' in pg_get_functiondef('app_private.create_monthly_cycle_internal_v1(uuid,uuid,uuid,text)'::regprocedure))>0,'property scope enforced');
select ok(position('approved_monthly_source_not_found' in pg_get_functiondef('app_private.capture_monthly_cycle_source_internal_v1(uuid,uuid,text,uuid)'::regprocedure))>0,'source approval enforced');
select ok(position('approved_allocation_required' in pg_get_functiondef('app_private.submit_monthly_cycle_internal_v1(uuid,uuid,uuid)'::regprocedure))>0,'approved allocation enforced');
select ok(position('dual_control_violation' in pg_get_functiondef('app_private.review_monthly_cycle_internal_v1(uuid,uuid,text,text)'::regprocedure))>0,'preparer review denied');
select ok(exists(select 1 from pg_constraint where conrelid='finance.monthly_cycle_reviews'::regclass and conname='monthly_cycle_reviews_reviewer_unique'),'president and censor must be independent users');
select ok(position('president_and_censor_approval_required' in pg_get_functiondef('app_private.publish_monthly_cycle_internal_v1(uuid,uuid)'::regprocedure))>0,'two statutory reviews required');
select ok(position('get_ar_subledger_parity' in pg_get_functiondef('app_private.publish_monthly_cycle_internal_v1(uuid,uuid)'::regprocedure))>0,'canonical parity routine reused');
select ok(position('finance.close_accounting_period' in pg_get_functiondef('app_private.close_monthly_cycle_internal_v1(uuid,uuid,text)'::regprocedure))>0,'canonical close routine reused');
select ok(position('monthly_cycle_artifact_immutable' in pg_get_functiondef('app_private.protect_monthly_cycle_artifact_internal_v1()'::regprocedure))>0,'publication artifacts immutable');
select ok(obj_description('finance.monthly_cycles'::regclass) like 'Orchestration state only%','no parallel ledger boundary documented');
select ok(not exists(select 1 from finance.monthly_cycles),'migration contains no cycle fixtures');

select * from finish();
rollback;
