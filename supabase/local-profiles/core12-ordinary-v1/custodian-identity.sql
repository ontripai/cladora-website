-- Only the custodian reads system_identifier; no grant/SECURITY DEFINER bridge.
SELECT json_build_object(
 'stage','CORE12_CUSTODIAN_IDENTITY_V1','database',current_database(),'pid',pg_backend_pid(),
 'user',current_user,'session_user',session_user,'version',current_setting('server_version_num')::integer,
 'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),
 'target_database_oid',(SELECT oid::text FROM pg_database WHERE datname='core_sqlstate_boundary_proof'),
 'sessions',COALESCE((SELECT json_agg(json_build_object(
   'pid',a.pid,'database_oid',a.datid::text,'user',a.usename,'application_name',a.application_name,
   'backend_start',a.backend_start::text,'backend_type',a.backend_type,'client_addr',a.client_addr::text
 ) ORDER BY a.pid) FROM pg_stat_activity a
 WHERE a.datname='core_sqlstate_boundary_proof' AND a.backend_type='client backend'),'[]'::json)
);
