-- ACL grant-option recipient / pool-login metadata omitted from the first slice.
SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'superuser',rolsuper,
 'bypassrls',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin,'createdb',rolcreatedb,
 'createrole',rolcreaterole,'replication',rolreplication) ORDER BY rolname)
FROM pg_roles WHERE rolname IN ('postgres','authenticator');
