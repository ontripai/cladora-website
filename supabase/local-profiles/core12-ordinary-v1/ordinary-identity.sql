-- Metadata only, no pg_control_system privilege or privileged wrapper function.
SELECT json_build_object(
 'stage','CORE12_ORDINARY_IDENTITY_V1','database',current_database(),
 'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
 'pid',pg_backend_pid(),'user',current_user,'session_user',session_user,
 'version',current_setting('server_version_num')::integer,
 'rolsuper',r.rolsuper,'rolbypassrls',r.rolbypassrls,'rolcreatedb',r.rolcreatedb,
 'rolcreaterole',r.rolcreaterole,'rolreplication',r.rolreplication,
 'connect',has_database_privilege(current_user,current_database(),'CONNECT'),
 'temp',has_database_privilege(current_user,current_database(),'TEMP'),
 'plpgsql',has_language_privilege(current_user,'plpgsql','USAGE'),
 'memberships',(SELECT count(*) FROM pg_auth_members WHERE member=r.oid),
 'function_defaults',(SELECT count(*) FROM pg_default_acl WHERE defaclrole=r.oid AND defaclobjtype='f'),
 'forbidden_schemas',(SELECT count(*) FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform')),
 'read_only',current_setting('transaction_read_only')::boolean,
 'guard_latch',current_setting('core12.reviewed_pg_only_capsule',true)
) FROM pg_roles r WHERE r.rolname=current_user;
