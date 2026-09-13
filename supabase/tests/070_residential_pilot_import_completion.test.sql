-- Test 070: Residential pilot import completion
begin;
select plan(40);

select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_rows' and column_name='dependency_key'),'dependency key exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_rows' and column_name='canonical_snapshot'),'canonical snapshot exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_rows' and column_name='expected_target_hash'),'expected target hash exists');
select ok(exists(select 1 from pg_indexes where schemaname='platform' and indexname='import_rows_run_natural_key_idx'),'natural-key index exists');
select ok(exists(select 1 from pg_trigger where tgname='import_template_versions_used_immutable'),'used template versions protected');
select has_function('app_private','onboarding_mapped_id_internal_v1',array['uuid','text','text'],'mapping resolver exists');
select has_function('app_private','onboarding_configure_template_internal_v1',array['uuid','text','text','text','integer','jsonb','integer'],'private template configuration exists');
select has_function('app_private','onboarding_commit_residential_internal_v1',array['uuid','uuid'],'residential commit engine exists');
select has_function('customer_api','configure_import_template_v1',array['uuid','text','text','text','integer','jsonb','integer'],'template API exists');
select ok(not (select prosecdef from pg_proc where oid='customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer)'::regprocedure),'template API is invoker');
select ok((select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid='customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer)'::regprocedure),'template API search path pinned');
select ok(not has_function_privilege('anon','customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer)','EXECUTE'),'anon denied template API');
select ok(has_function_privilege('authenticated','customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer)','EXECUTE'),'authenticated may invoke guarded API');

select ok(position($s$z.template_code='property'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'property handler exists');
select ok(position($s$z.template_code='building'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'building handler exists');
select ok(position($s$z.template_code='entrance'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'entrance handler exists');
select ok(position($s$z.template_code='unit'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'unit handler exists');
select ok(position($s$z.template_code='party'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'party handler exists');
select ok(position($s$z.template_code='ownership'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'ownership handler exists');
select ok(position($s$z.template_code='occupancy'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'occupancy handler exists');
select ok(position($s$z.template_code='account'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'account handler exists');
select ok(position($s$z.template_code='meter'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'meter handler exists');
select ok(position($s$z.template_code='meter_reading'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'meter reading handler exists');
select ok(position($s$template_code='opening_gl'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'opening GL handler exists');
select ok(position($s$template_code='open_receivable'$s$ in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'receivable handler exists');

select ok(position('pg_advisory_xact_lock' in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'scope advisory lock used');
select ok(position('for update' in lower(pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure)))>0,'row locks used');
select ok(position('dual_control_violation' in pg_get_functiondef('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)'::regprocedure))>0,'dual control retained');
select ok(position('accounting_period_not_open' in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'open period enforced');
select ok(position('finance.assert_balanced' in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'canonical balance assertion used');
select ok(position('opening_ar_parity_failed' in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'4111 parity enforced');
select ok(position('customer_advance_import_not_configured' in pg_get_functiondef('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure))>0,'419 unsupported case fails closed');
select ok(position('existing_record_update_requires_forward_correction' in pg_get_functiondef('app_private.onboarding_validate_import_internal_v1(uuid,uuid)'::regprocedure))>0,'existing updates fail closed');
select ok(position('ownership_share_total_exceeded' in pg_get_functiondef('app_private.onboarding_validate_import_internal_v1(uuid,uuid)'::regprocedure))>0,'ownership totals validated');
select ok(position('unsupported_residential_template' in pg_get_functiondef('app_private.onboarding_configure_template_internal_v1(uuid,text,text,text,integer,jsonb,integer)'::regprocedure))>0,'template allowlist enforced');
select ok(obj_description('customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer)'::regprocedure) like 'AAL2-controlled%','template boundary documented');
select ok(obj_description('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'::regprocedure) like 'Insert-only atomic%','commit boundary documented');
select ok(not exists(select 1 from platform.import_runs),'migration has no run fixtures');
select ok(not exists(select 1 from platform.import_sources),'migration has no source fixtures');
select ok(not exists(select 1 from platform.import_rows),'migration has no staged rows');

select * from finish();
rollback;
