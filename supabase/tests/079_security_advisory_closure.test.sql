begin;
select plan(39);

select ok(position('search_path=pg_catalog, extensions' in array_to_string(proconfig,','))>0,'IBAN helper search_path is pinned')
from pg_proc where oid='payments.validate_and_mask_iban(text)'::regprocedure;
select ok(position('search_path=pg_catalog' in array_to_string(proconfig,','))>0,'marketing trigger search_path is pinned')
from pg_proc where oid='public.set_marketing_leads_updated_at()'::regprocedure;
select ok(position('search_path=pg_catalog, documents' in array_to_string(proconfig,','))>0,'retention trigger search_path is pinned')
from pg_proc where oid='documents.check_retention_policy_overlap()'::regprocedure;
select ok(position('search_path=pg_catalog, maintenance' in array_to_string(proconfig,','))>0,'work-order trigger search_path is pinned')
from pg_proc where oid='maintenance.enforce_work_order_transition_guards()'::regprocedure;
select ok(position('search_path=pg_catalog, maintenance' in array_to_string(proconfig,','))>0,'SLA trigger search_path is pinned')
from pg_proc where oid='maintenance.protect_sla_policy_immutability()'::regprocedure;

select ok(not prosecdef,'public beneficiary approval gateway is security invoker') from pg_proc where oid='customer_api.approve_beneficiary_account_v1(uuid,uuid)'::regprocedure;
select ok(not prosecdef,'public allocation-policy gateway is security invoker') from pg_proc where oid='customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text)'::regprocedure;
select ok(not prosecdef,'public beneficiary draft gateway is security invoker') from pg_proc where oid='customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)'::regprocedure;
select ok(not prosecdef,'public SLA gateway is security invoker') from pg_proc where oid='customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)'::regprocedure;
select ok(not prosecdef,'public payment configuration gateway is security invoker') from pg_proc where oid='customer_api.list_payment_configuration_v1(uuid,uuid)'::regprocedure;
select ok(not prosecdef,'public beneficiary rejection gateway is security invoker') from pg_proc where oid='customer_api.reject_beneficiary_account_v1(uuid,uuid,text)'::regprocedure;
select ok(not prosecdef,'public beneficiary revocation gateway is security invoker') from pg_proc where oid='customer_api.revoke_beneficiary_account_v1(uuid,uuid,text)'::regprocedure;
select ok(not prosecdef,'public beneficiary submission gateway is security invoker') from pg_proc where oid='customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)'::regprocedure;

select ok(prosecdef,'private beneficiary approval implementation retains guarded privilege') from pg_proc where oid='app_private.approve_beneficiary_account_v1(uuid,uuid)'::regprocedure;
select ok(prosecdef,'private allocation-policy implementation retains guarded privilege') from pg_proc where oid='app_private.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text)'::regprocedure;
select ok(prosecdef,'private beneficiary draft implementation retains guarded privilege') from pg_proc where oid='app_private.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)'::regprocedure;
select ok(prosecdef,'private SLA implementation retains guarded privilege') from pg_proc where oid='app_private.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)'::regprocedure;
select ok(prosecdef,'private payment configuration implementation retains guarded privilege') from pg_proc where oid='app_private.list_payment_configuration_v1(uuid,uuid)'::regprocedure;
select ok(prosecdef,'private beneficiary rejection implementation retains guarded privilege') from pg_proc where oid='app_private.reject_beneficiary_account_v1(uuid,uuid,text)'::regprocedure;
select ok(prosecdef,'private beneficiary revocation implementation retains guarded privilege') from pg_proc where oid='app_private.revoke_beneficiary_account_v1(uuid,uuid,text)'::regprocedure;
select ok(prosecdef,'private beneficiary submission implementation retains guarded privilege') from pg_proc where oid='app_private.submit_beneficiary_account_for_approval_v1(uuid,uuid)'::regprocedure;

select ok(not has_function_privilege('anon','customer_api.approve_beneficiary_account_v1(uuid,uuid)','EXECUTE'),'anonymous beneficiary approval denied');
select ok(not has_function_privilege('anon','customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text)','EXECUTE'),'anonymous allocation policy denied');
select ok(not has_function_privilege('anon','customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)','EXECUTE'),'anonymous beneficiary draft denied');
select ok(not has_function_privilege('anon','customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)','EXECUTE'),'anonymous SLA creation denied');
select ok(not has_function_privilege('anon','customer_api.list_payment_configuration_v1(uuid,uuid)','EXECUTE'),'anonymous payment configuration denied');
select ok(not has_function_privilege('anon','customer_api.reject_beneficiary_account_v1(uuid,uuid,text)','EXECUTE'),'anonymous beneficiary rejection denied');
select ok(not has_function_privilege('anon','customer_api.revoke_beneficiary_account_v1(uuid,uuid,text)','EXECUTE'),'anonymous beneficiary revocation denied');
select ok(not has_function_privilege('anon','customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)','EXECUTE'),'anonymous beneficiary submission denied');

select ok(has_function_privilege('authenticated','customer_api.approve_beneficiary_account_v1(uuid,uuid)','EXECUTE'),'authenticated approval contract preserved');
select ok(has_function_privilege('authenticated','customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text)','EXECUTE'),'authenticated allocation contract preserved');
select ok(has_function_privilege('authenticated','customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)','EXECUTE'),'authenticated beneficiary draft contract preserved');
select ok(has_function_privilege('authenticated','customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)','EXECUTE'),'authenticated SLA contract preserved');
select ok(has_function_privilege('authenticated','customer_api.list_payment_configuration_v1(uuid,uuid)','EXECUTE'),'authenticated payment configuration contract preserved');
select ok(has_function_privilege('authenticated','customer_api.reject_beneficiary_account_v1(uuid,uuid,text)','EXECUTE'),'authenticated beneficiary rejection contract preserved');
select ok(has_function_privilege('authenticated','customer_api.revoke_beneficiary_account_v1(uuid,uuid,text)','EXECUTE'),'authenticated beneficiary revocation contract preserved');
select ok(has_function_privilege('authenticated','customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)','EXECUTE'),'authenticated beneficiary submission contract preserved');

select is((select count(*)::integer from pg_policies where policyname like '%_direct_deny'),25,'all 25 application private-table boundaries are explicit');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='customer_api' and p.prosecdef and p.proname in (
    'approve_beneficiary_account_v1','configure_payment_allocation_policy_v1',
    'create_beneficiary_account_draft_v1','create_sla_policy_v1',
    'list_payment_configuration_v1','reject_beneficiary_account_v1',
    'revoke_beneficiary_account_v1','submit_beneficiary_account_for_approval_v1'
  )),'targeted exposed SECURITY DEFINER surface is eliminated');

select * from finish();
rollback;
