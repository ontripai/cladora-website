-- Task15: fixed, read-only metadata gate. No Auth rows, business RPC or DDL.
SELECT jsonb_build_object(
 'schema_owner',pg_get_userbyid(n.nspowner),
 'authenticated_usage',has_schema_privilege('authenticated',n.oid,'USAGE'),
 'service_usage',has_schema_privilege('service_role',n.oid,'USAGE'),
 'anon_usage',has_schema_privilege('anon',n.oid,'USAGE'),
 'tables',(SELECT jsonb_agg(jsonb_build_object(
   'name',c.relname,'owner',pg_get_userbyid(c.relowner),
   'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
   'authenticated_insert',has_table_privilege('authenticated',c.oid,'INSERT'),
   'authenticated_update',has_table_privilege('authenticated',c.oid,'UPDATE')
  ) ORDER BY c.relname) FROM pg_class c
  WHERE c.relnamespace=n.oid AND c.relname IN ('buckets','objects')),
 'policy_count',(SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace=n.oid AND c.relname IN ('buckets','objects')),
 'bucket_count',(SELECT count(*) FROM storage.buckets),
 'object_count',(SELECT count(*) FROM storage.objects),
 'authenticated_restricted',(SELECT NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  FROM pg_roles WHERE rolname='authenticated'),
 'service_restricted',(SELECT NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  FROM pg_roles WHERE rolname='service_role')
) FROM pg_namespace n WHERE n.nspname='storage';
