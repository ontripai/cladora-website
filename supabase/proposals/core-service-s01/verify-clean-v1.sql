-- Read-only observer on SAME admitted disposable baseline after acknowledged ROLLBACK.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog;
SELECT jsonb_build_object('stage','CORE_S01_RESIDUE','backend_pid',pg_backend_pid(),'database',current_database(),
 'new_relations_remaining',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='platform' AND c.relname IN('provider_agreement_heads_v1','provider_agreement_versions_v1',
   'core_s01_workspace_tenant_key_v1','core_s01_heads_pk_v1','core_s01_head_tuple_key_v1','core_s01_versions_pk_v1'))
   OR(n.nspname='portfolio' AND c.relname='core_s01_party_tenant_key_v1')),
 'new_functions_remaining',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname IN('core_s01_head_guard_v1','core_s01_version_guard_v1','core_s01_version_link_v1','write_core_provider_agreement_v1')),
 'parent_constraints_remaining',(SELECT count(*) FROM pg_constraint c WHERE
  (c.conrelid='portfolio.parties'::regclass AND c.conname='core_s01_party_tenant_key_v1') OR
  (c.conrelid='platform.customer_workspaces'::regclass AND c.conname='core_s01_workspace_tenant_key_v1')),
 'fixture_parent_rows_remaining',
  (SELECT count(*) FROM platform.tenants WHERE id IN('f0010000-0000-4000-8000-000000000001','f0010000-0000-4000-8000-000000000002'))+
  (SELECT count(*) FROM platform.customer_workspaces WHERE id IN('f0010000-0000-4000-8000-000000000003','f0010000-0000-4000-8000-000000000004'))+
  (SELECT count(*) FROM portfolio.parties WHERE id IN('f0010000-0000-4000-8000-000000000005','f0010000-0000-4000-8000-000000000006')));
ROLLBACK;
