begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, platform, app_private, pg_catalog;

select plan(59);

-- Catalog, ownership and execution boundary (001-027).
select has_function('app_private', 'can_read_retention_tenant_v1', array['uuid'], '100-001 helper exists');
select has_function('platform', 'get_retention_operations_v1', array['text','uuid','text','integer','integer'], '100-002 read model exists');
select has_function('platform', 'preview_retention_workers_v1', array['uuid','integer'], '100-003 dry-run exists');

select ok((select prosecdef from pg_proc where oid='app_private.can_read_retention_tenant_v1(uuid)'::regprocedure), '100-004 helper is security definer');
select ok((select prosecdef from pg_proc where oid='platform.get_retention_operations_v1(text,uuid,text,integer,integer)'::regprocedure), '100-005 read model is security definer');
select ok((select prosecdef from pg_proc where oid='platform.preview_retention_workers_v1(uuid,integer)'::regprocedure), '100-006 dry-run is security definer');
select is((select provolatile::text from pg_proc where oid='app_private.can_read_retention_tenant_v1(uuid)'::regprocedure), 's', '100-007 helper is stable');
select is((select provolatile::text from pg_proc where oid='platform.get_retention_operations_v1(text,uuid,text,integer,integer)'::regprocedure), 's', '100-008 read model is stable');
select is((select provolatile::text from pg_proc where oid='platform.preview_retention_workers_v1(uuid,integer)'::regprocedure), 's', '100-009 dry-run is stable');

select ok(not has_function_privilege('public','app_private.can_read_retention_tenant_v1(uuid)','EXECUTE'), '100-010 PUBLIC cannot execute helper');
select ok(not has_function_privilege('anon','app_private.can_read_retention_tenant_v1(uuid)','EXECUTE'), '100-011 anon cannot execute helper');
select ok(not has_function_privilege('authenticated','app_private.can_read_retention_tenant_v1(uuid)','EXECUTE'), '100-012 authenticated cannot execute helper directly');
select ok(not has_function_privilege('public','platform.get_retention_operations_v1(text,uuid,text,integer,integer)','EXECUTE'), '100-013 PUBLIC cannot execute read model');
select ok(not has_function_privilege('anon','platform.get_retention_operations_v1(text,uuid,text,integer,integer)','EXECUTE'), '100-014 anon cannot execute read model');
select ok(has_function_privilege('authenticated','platform.get_retention_operations_v1(text,uuid,text,integer,integer)','EXECUTE'), '100-015 authenticated can execute gated read model');
select ok(not has_function_privilege('public','platform.preview_retention_workers_v1(uuid,integer)','EXECUTE'), '100-016 PUBLIC cannot execute dry-run');
select ok(not has_function_privilege('anon','platform.preview_retention_workers_v1(uuid,integer)','EXECUTE'), '100-017 anon cannot execute dry-run');
select ok(has_function_privilege('authenticated','platform.preview_retention_workers_v1(uuid,integer)','EXECUTE'), '100-018 authenticated can execute gated dry-run');

select ok(obj_description('platform.get_retention_operations_v1(text,uuid,text,integer,integer)'::regprocedure) like 'Read-only%', '100-019 read-only contract is documented');
select ok(obj_description('platform.preview_retention_workers_v1(uuid,integer)'::regprocedure) like 'Side-effect-free%', '100-020 dry-run contract is documented');
select is((select count(*)::integer from app_private.feature_flags), 4, '100-021 exactly four production flags exist');
select is((select count(*)::integer from app_private.feature_flags where enabled), 0, '100-022 all production flags remain disabled');
select ok(not has_table_privilege('authenticated','app_private.disposal_purge_jobs','SELECT'), '100-023 authenticated has no direct purge-job read');
select ok(not has_table_privilege('authenticated','app_private.kms_key_requests','SELECT'), '100-024 authenticated has no direct KMS read');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='app_private.can_read_retention_tenant_v1(uuid)'::regprocedure), 'cladora_rpc_owner', '100-025 helper has restricted owner');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='platform.get_retention_operations_v1(text,uuid,text,integer,integer)'::regprocedure), 'cladora_rpc_owner', '100-026 read model has restricted owner');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='platform.preview_retention_workers_v1(uuid,integer)'::regprocedure), 'cladora_rpc_owner', '100-027 dry-run has restricted owner');
select ok((select 'search_path=pg_catalog'=any(proconfig) from pg_proc where oid='app_private.can_read_retention_tenant_v1(uuid)'::regprocedure), '100-028 helper search path is hardened');
select ok((select 'search_path=pg_catalog'=any(proconfig) from pg_proc where oid='platform.get_retention_operations_v1(text,uuid,text,integer,integer)'::regprocedure), '100-029 read model search path is hardened');
select ok((select 'search_path=pg_catalog'=any(proconfig) from pg_proc where oid='platform.preview_retention_workers_v1(uuid,integer)'::regprocedure), '100-030 dry-run search path is hardened');

-- Minimal platform identities for runtime authorization checks.
insert into platform.tenants(id,legal_name,status,default_locale,timezone) values
  ('f3000000-0000-4000-8000-000000000001','Phase 3B Tenant','active','ro','Europe/Bucharest');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment) values
  ('f4000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','ASSOCIATION','ACTIVE','Phase 3B','PILOT');
insert into auth.users(id,email,encrypted_password,aud,role) values
  ('f1000000-0000-4000-8000-000000000001','phase3b.super@cladora.test','x','authenticated','authenticated'),
  ('f1000000-0000-4000-8000-000000000002','phase3b.ops@cladora.test','x','authenticated','authenticated'),
  ('f1000000-0000-4000-8000-000000000003','phase3b.finance@cladora.test','x','authenticated','authenticated');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
  ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','PH3B-SUPER','Phase 3B Super','active'),
  ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','PH3B-OPS','Phase 3B Ops','active'),
  ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','PH3B-FIN','Phase 3B Finance','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
  ('f2000000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Phase 3B test'),
  ('f2000000-0000-4000-8000-000000000002','PLATFORM_OPERATIONS','Phase 3B test'),
  ('f2000000-0000-4000-8000-000000000003','PLATFORM_FINANCE','Phase 3B test');

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$select platform.get_retention_operations_v1()$$,'42501','mfa_required','100-031 AAL1 read model is rejected');
select throws_ok($$select platform.preview_retention_workers_v1()$$,'42501','mfa_required','100-032 AAL1 dry-run is rejected');

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$select platform.get_retention_operations_v1()$$,'100-033 super-admin can read summary');
select lives_ok($$select platform.preview_retention_workers_v1()$$,'100-034 super-admin can run safe preview');
select is(platform.get_retention_operations_v1()->>'mode','read_only','100-035 read model declares read_only');
select is(platform.get_retention_operations_v1()->>'section','summary','100-036 default section is summary');
select is(jsonb_typeof(platform.get_retention_operations_v1()->'feature_flags'),'object','100-037 flags are an object');
select is(jsonb_object_length(platform.get_retention_operations_v1()->'feature_flags'),4,'100-038 all four flags are projected');
select ok(not exists(select 1 from jsonb_each(platform.get_retention_operations_v1()->'feature_flags') f where (f.value->>'enabled')::boolean),'100-039 projected flags remain false');
select is(jsonb_typeof(platform.get_retention_operations_v1()->'summary'),'object','100-040 summary is an object');
select is(jsonb_typeof(platform.get_retention_operations_v1()->'items'),'array','100-041 items are an array');
select is((platform.get_retention_operations_v1()->'pagination'->>'total')::integer,0,'100-042 summary has zero paginated records');
select is(platform.preview_retention_workers_v1()->>'mode','dry_run','100-043 preview declares dry_run');
select is((platform.preview_retention_workers_v1()->'invariants'->>'database_mutated')::boolean,false,'100-044 preview reports no DB mutation');
select is((platform.preview_retention_workers_v1()->'invariants'->>'storage_delete_api_called')::boolean,false,'100-045 preview reports no Storage deletion');
select is((platform.preview_retention_workers_v1()->'invariants'->>'kms_provider_called')::boolean,false,'100-046 preview reports no KMS call');
select is((platform.preview_retention_workers_v1()->'invariants'->>'claims_acquired')::boolean,false,'100-047 preview reports no claims');
select is((platform.preview_retention_workers_v1()->'storage'->>'candidate_count')::integer,0,'100-048 no storage candidates are fabricated');
select is((platform.preview_retention_workers_v1()->'kms'->>'candidate_count')::integer,0,'100-049 no KMS candidates are fabricated');
select throws_ok($$select platform.get_retention_operations_v1('invalid')$$,'22023','invalid_retention_operations_section','100-050 invalid section is rejected');
select throws_ok($$select platform.get_retention_operations_v1('holds',null,'INVALID-STATUS')$$,'22023','invalid_retention_operations_status','100-051 invalid status is rejected');

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is((platform.get_retention_operations_v1()->'summary'->>'policy_versions')::integer,0,'100-052 unassigned ops sees no tenant policy data');
select throws_ok($$select platform.get_retention_operations_v1('summary','f3000000-0000-4000-8000-000000000001')$$,'42501','tenant_scope_denied','100-053 unassigned ops cannot target tenant');
select throws_ok($$select platform.preview_retention_workers_v1('f3000000-0000-4000-8000-000000000001')$$,'42501','tenant_scope_denied','100-054 unassigned ops cannot preview tenant workers');

insert into platform.platform_customer_assignments(
  platform_user_id,customer_workspace_id,scope_type,status,assignment_reason
) values (
  'f2000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000001','workspace','active','Phase 3B positive scope test'
);
select lives_ok($$select platform.get_retention_operations_v1('summary','f3000000-0000-4000-8000-000000000001')$$,'100-055 assigned ops can target tenant');
select lives_ok($$select platform.preview_retention_workers_v1('f3000000-0000-4000-8000-000000000001')$$,'100-056 assigned ops can preview tenant workers');
select is((platform.get_retention_operations_v1('summary','f3000000-0000-4000-8000-000000000001')->'summary'->>'policy_versions')::integer,0,'100-057 assigned tenant projection remains truthful');

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select throws_ok($$select platform.get_retention_operations_v1()$$,'42501','access_denied','100-058 finance role is not a retention operator');
select throws_ok($$select platform.preview_retention_workers_v1()$$,'42501','access_denied','100-059 finance role cannot run worker preview');

select * from finish();
rollback;
