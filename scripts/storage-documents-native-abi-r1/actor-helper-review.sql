-- Policy dependency only; function metadata/definition, never Auth rows.
SELECT jsonb_build_object('signature',p.oid::regprocedure::text,
 'definition',pg_get_functiondef(p.oid),'security_definer',p.prosecdef,'config',p.proconfig,
 'owner',r.rolname,'owner_superuser',r.rolsuper,'owner_bypassrls',r.rolbypassrls,
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'authenticated_auth_schema_usage',has_schema_privilege('authenticated',n.oid,'USAGE'))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='auth' AND p.proname='uid' AND pg_get_function_identity_arguments(p.oid)='';
