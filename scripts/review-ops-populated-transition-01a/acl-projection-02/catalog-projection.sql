-- PROPOSAL ONLY. Reuse existing complete private snapshot before any new request.
-- Output is PRIVATE. No application table rows/Auth users/session/ledger payloads.
-- Not an executable part of the synthetic Platform request.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog;
WITH RECURSIVE
ns AS (SELECT oid,nspname,nspowner,nspacl FROM pg_namespace WHERE nspname = ANY(ARRAY[
 'app_private','platform','identity','portfolio','audit','finance','assets','maintenance',
 'customer_api','utilities','security_access','documents','occupancy','billing','payments',
 'governance','communications'])),
relseed AS (SELECT c.* FROM pg_class c WHERE c.relnamespace IN (SELECT oid FROM ns)
 OR c.oid IN (SELECT conrelid FROM pg_constraint WHERE confrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN (SELECT oid FROM ns)))),
rels AS (SELECT * FROM relseed UNION SELECT c.* FROM pg_class c WHERE c.oid IN
 (SELECT reltoastrelid FROM relseed WHERE reltoastrelid<>0) OR c.oid IN
 (SELECT indexrelid FROM pg_index WHERE indrelid IN (SELECT reltoastrelid FROM relseed WHERE reltoastrelid<>0))),
types AS (SELECT * FROM pg_type WHERE typnamespace IN (SELECT oid FROM ns)
 OR typrelid IN (SELECT oid FROM rels) OR typelem IN (SELECT reltype FROM rels WHERE reltype<>0)),
procs AS (SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.oid IN (SELECT oid FROM ns) OR
 (n.nspname='auth' AND p.proname IN ('uid','jwt')) OR
 (n.nspname='extensions' AND p.proname='digest')),
roles AS (SELECT r.oid,r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,
 r.rolcanlogin,r.rolreplication,r.rolbypassrls FROM pg_roles r),
callers AS (SELECT * FROM roles WHERE rolname IN
 (current_user,'anon','authenticated','service_role','cladora_rpc_owner') OR oid IN
 (SELECT proowner FROM procs UNION SELECT relowner FROM rels UNION SELECT nspowner FROM ns)),
roots(classid,objid,objsubid) AS (
 SELECT 'pg_class'::regclass::oid,oid,0 FROM rels UNION
 SELECT 'pg_proc'::regclass::oid,oid,0 FROM procs UNION
 SELECT 'pg_type'::regclass::oid,t.oid,0 FROM types t UNION
 SELECT 'pg_trigger'::regclass::oid,t.oid,0 FROM pg_trigger t WHERE tgrelid IN (SELECT oid FROM rels) UNION
 SELECT 'pg_constraint'::regclass::oid,c.oid,0 FROM pg_constraint c WHERE conrelid IN (SELECT oid FROM rels) OR confrelid IN (SELECT oid FROM rels) UNION
 SELECT 'pg_rewrite'::regclass::oid,r.oid,0 FROM pg_rewrite r WHERE ev_class IN (SELECT oid FROM rels) UNION
 SELECT 'pg_attrdef'::regclass::oid,a.oid,0 FROM pg_attrdef a WHERE adrelid IN (SELECT oid FROM rels) UNION
 SELECT 'pg_policy'::regclass::oid,p.oid,0 FROM pg_policy p WHERE polrelid IN (SELECT oid FROM rels)
),
walk(classid,objid,objsubid) AS (
 SELECT * FROM roots UNION
 SELECT d.refclassid,d.refobjid,d.refobjsubid FROM pg_depend d JOIN walk w
 ON d.classid=w.classid AND d.objid=w.objid
),
edges AS (SELECT DISTINCT d.* FROM pg_depend d JOIN walk w ON d.classid=w.classid AND d.objid=w.objid),
sections AS (
 SELECT 'namespaces' AS name,coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) AS rows,
 (SELECT count(*) FROM ns) AS total FROM (SELECT * FROM ns ORDER BY nspname LIMIT 5001) x UNION ALL
 SELECT 'routines',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM procs)
 FROM (SELECT p.oid,p.oid::regprocedure::text AS regprocedure,p.prorettype,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS identity_arguments,
 pg_get_function_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
 p.proargtypes::text,p.proallargtypes,p.proargmodes,p.proargnames,p.proowner,
 p.prokind,p.prosecdef,p.provolatile,p.proparallel,p.proleakproof,p.proisstrict,p.proretset,
 p.proconfig,p.prolang,p.proacl,
 CASE WHEN n.nspname='auth' OR p.prokind='a' THEN NULL ELSE pg_get_functiondef(p.oid) END AS definition
 FROM procs p JOIN pg_namespace n ON n.oid=p.pronamespace ORDER BY n.nspname,p.proname,p.oid LIMIT 5001) x UNION ALL
 SELECT 'routine_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM procs p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
 FROM (SELECT p.oid,a.* FROM procs p CROSS JOIN LATERAL
 aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a ORDER BY p.oid,a.grantee,a.privilege_type LIMIT 5001) x UNION ALL
 SELECT 'routine_effective_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM procs CROSS JOIN callers)
 FROM (SELECT p.oid,r.rolname,has_schema_privilege(r.oid,p.pronamespace,'USAGE') AS schema_usage,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS execute,
 has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION') AS execute_grant_option
 FROM procs p CROSS JOIN callers r ORDER BY p.oid,r.rolname LIMIT 5001) x UNION ALL
 SELECT 'relations',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM rels)
 FROM (SELECT c.oid,n.nspname,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,
 c.relforcerowsecurity,c.reloptions,c.reltoastrelid,c.relreplident,c.relpersistence
 FROM rels c JOIN pg_namespace n ON n.oid=c.relnamespace ORDER BY n.nspname,c.relname LIMIT 5001) x UNION ALL
 SELECT 'columns',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM rels) AND attnum>0)
 FROM (SELECT a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attcollation,a.attnotnull,
 a.attidentity,a.attgenerated,a.attisdropped,a.attacl,pg_get_expr(d.adbin,d.adrelid) AS default_expression
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid IN (SELECT oid FROM rels) AND a.attnum>0 ORDER BY a.attrelid,a.attnum LIMIT 5001) x UNION ALL
 SELECT 'column_effective_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_attribute a CROSS JOIN callers WHERE a.attrelid IN (SELECT oid FROM rels WHERE relkind IN ('r','p','v','m','f')) AND a.attnum>0 AND NOT a.attisdropped)
 FROM (SELECT a.attrelid,a.attnum,r.rolname,
 has_column_privilege(r.oid,a.attrelid,a.attnum,'SELECT') AS select_effective,
 has_column_privilege(r.oid,a.attrelid,a.attnum,'SELECT WITH GRANT OPTION') AS select_grant_option,
 has_column_privilege(r.oid,a.attrelid,a.attnum,'REFERENCES') AS references_effective,
 has_column_privilege(r.oid,a.attrelid,a.attnum,'REFERENCES WITH GRANT OPTION') AS references_grant_option
 FROM pg_attribute a CROSS JOIN callers r WHERE a.attrelid IN (SELECT oid FROM rels WHERE relkind IN ('r','p','v','m','f'))
 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attrelid,a.attnum,r.rolname LIMIT 5001) x UNION ALL
 SELECT 'constraints',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM rels) OR confrelid IN (SELECT oid FROM rels))
 FROM (SELECT c.*,pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c
 WHERE conrelid IN (SELECT oid FROM rels) OR confrelid IN (SELECT oid FROM rels) ORDER BY c.oid LIMIT 5001) x UNION ALL
 SELECT 'indexes',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_index WHERE indrelid IN (SELECT oid FROM rels))
 FROM (SELECT i.*,pg_get_indexdef(i.indexrelid) AS definition,
 pg_get_expr(i.indexprs,i.indrelid) AS expressions,pg_get_expr(i.indpred,i.indrelid) AS predicate
 FROM pg_index i WHERE indrelid IN (SELECT oid FROM rels) ORDER BY i.indexrelid LIMIT 5001) x UNION ALL
 SELECT 'triggers',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM rels))
 FROM (SELECT t.*,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t
 WHERE tgrelid IN (SELECT oid FROM rels) ORDER BY t.tgrelid,t.tgname LIMIT 5001) x UNION ALL
 SELECT 'policies',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM rels))
 FROM (SELECT p.*,pg_get_expr(p.polqual,p.polrelid) AS using_expression,
 pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression FROM pg_policy p
 WHERE polrelid IN (SELECT oid FROM rels) ORDER BY p.polrelid,p.polname LIMIT 5001) x UNION ALL
 SELECT 'rules',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_rewrite WHERE ev_class IN (SELECT oid FROM rels))
 FROM (SELECT r.oid,r.rulename,r.ev_class,r.ev_type,r.ev_enabled,r.is_instead,pg_get_ruledef(r.oid,true) AS definition
 FROM pg_rewrite r WHERE r.ev_class IN (SELECT oid FROM rels) ORDER BY r.oid LIMIT 5001) x UNION ALL
 SELECT 'views',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM rels WHERE relkind IN ('v','m'))
 FROM (SELECT oid,pg_get_viewdef(oid,true) AS definition FROM rels WHERE relkind IN ('v','m') ORDER BY oid LIMIT 5001) x UNION ALL
 SELECT 'types',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM types)
 FROM (SELECT t.oid,t.typnamespace,t.typname,t.typowner,t.typtype,t.typrelid,t.typelem,
 t.typarray,t.typbasetype,t.typnotnull,t.typdefault,t.typacl,
 (SELECT jsonb_agg(jsonb_build_object('order',e.enumsortorder,'label',e.enumlabel) ORDER BY e.enumsortorder)
 FROM pg_enum e WHERE e.enumtypid=t.oid) AS enum_order
 FROM types t ORDER BY t.oid LIMIT 5001) x UNION ALL
 SELECT 'dependency_nodes',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM walk)
 FROM (SELECT classid,objid,objsubid,pg_identify_object(classid,objid,objsubid) AS identity
 FROM walk ORDER BY classid,objid,objsubid LIMIT 5001) x UNION ALL
 SELECT 'dependency_edges',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM edges)
 FROM (SELECT * FROM edges ORDER BY classid,objid,objsubid,refclassid,refobjid,refobjsubid,deptype LIMIT 5001) x UNION ALL
 SELECT 'roles',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM roles)
 FROM (SELECT r.*,pg_has_role(current_user,r.oid,'MEMBER') AS current_member,
 pg_has_role(current_user,r.oid,'USAGE') AS current_usage,
 pg_has_role(current_user,r.oid,'SET') AS current_set FROM roles r ORDER BY r.rolname LIMIT 5001) x UNION ALL
 SELECT 'role_edges',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_auth_members)
 FROM (SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members
 ORDER BY roleid,member,grantor LIMIT 5001) x UNION ALL
 SELECT 'default_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_default_acl)
 FROM (SELECT * FROM pg_default_acl ORDER BY oid LIMIT 5001) x UNION ALL
 SELECT 'schema_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM ns n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a)
 FROM (SELECT n.oid,a.* FROM ns n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a ORDER BY n.oid,a.grantee,a.privilege_type LIMIT 5001) x UNION ALL
 SELECT 'schema_effective_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM ns CROSS JOIN callers)
 FROM (SELECT n.oid,r.rolname,has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
 has_schema_privilege(r.oid,n.oid,'CREATE') AS create_effective,
 has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION') AS usage_grant_option,
 has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION') AS create_grant_option
 FROM ns n CROSS JOIN callers r ORDER BY n.oid,r.rolname LIMIT 5001) x UNION ALL
 SELECT 'relation_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM rels c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a)
 FROM (SELECT c.oid,a.* FROM rels c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a ORDER BY c.oid,a.grantee,a.privilege_type LIMIT 5001) x UNION ALL
 SELECT 'column_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) v WHERE a.attrelid IN (SELECT oid FROM rels) AND a.attnum>0)
 FROM (SELECT a.attrelid,a.attnum,v.* FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) v
 WHERE a.attrelid IN (SELECT oid FROM rels) AND a.attnum>0 ORDER BY a.attrelid,a.attnum,v.grantee,v.privilege_type LIMIT 5001) x UNION ALL
 SELECT 'relation_effective_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),
 (SELECT count(*) FROM rels c CROSS JOIN callers r WHERE c.relkind IN ('r','p','v','m','f'))
 FROM (SELECT c.oid,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') AS select_effective,
 has_table_privilege(r.oid,c.oid,'INSERT') AS insert_effective,has_table_privilege(r.oid,c.oid,'UPDATE') AS update_effective,
 has_table_privilege(r.oid,c.oid,'DELETE') AS delete_effective,has_table_privilege(r.oid,c.oid,'REFERENCES') AS references_effective,
 has_table_privilege(r.oid,c.oid,'TRIGGER') AS trigger_effective,
 has_table_privilege(r.oid,c.oid,'SELECT WITH GRANT OPTION') AS select_grant_option,
 has_table_privilege(r.oid,c.oid,'INSERT WITH GRANT OPTION') AS insert_grant_option,
 has_table_privilege(r.oid,c.oid,'UPDATE WITH GRANT OPTION') AS update_grant_option,
 has_table_privilege(r.oid,c.oid,'DELETE WITH GRANT OPTION') AS delete_grant_option,
 has_table_privilege(r.oid,c.oid,'REFERENCES WITH GRANT OPTION') AS references_grant_option,
 has_table_privilege(r.oid,c.oid,'TRIGGER WITH GRANT OPTION') AS trigger_grant_option
 FROM rels c CROSS JOIN callers r WHERE c.relkind IN ('r','p','v','m','f') ORDER BY c.oid,r.rolname LIMIT 5001) x UNION ALL
 SELECT 'sequences',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_sequence WHERE seqrelid IN (SELECT oid FROM rels))
 FROM (SELECT * FROM pg_sequence WHERE seqrelid IN (SELECT oid FROM rels) ORDER BY seqrelid LIMIT 5001) x UNION ALL
 SELECT 'sequence_effective_acl',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM rels CROSS JOIN callers WHERE relkind='S')
 FROM (SELECT c.oid,r.rolname,has_sequence_privilege(r.oid,c.oid,'USAGE') AS usage,
 has_sequence_privilege(r.oid,c.oid,'SELECT') AS select_effective,
 has_sequence_privilege(r.oid,c.oid,'UPDATE') AS update_effective,
 has_sequence_privilege(r.oid,c.oid,'USAGE WITH GRANT OPTION') AS usage_grant_option,
 has_sequence_privilege(r.oid,c.oid,'SELECT WITH GRANT OPTION') AS select_grant_option,
 has_sequence_privilege(r.oid,c.oid,'UPDATE WITH GRANT OPTION') AS update_grant_option
 FROM rels c CROSS JOIN callers r WHERE c.relkind='S' ORDER BY c.oid,r.rolname LIMIT 5001) x UNION ALL
 SELECT 'extensions',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_extension)
 FROM (SELECT oid,extname,extowner,extnamespace,extversion,extrelocatable,extconfig,extcondition FROM pg_extension ORDER BY oid LIMIT 5001) x UNION ALL
 SELECT 'event_triggers',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),(SELECT count(*) FROM pg_event_trigger)
 FROM (SELECT oid,evtname,evtevent,evtowner,evtfoid,evtenabled,evttags FROM pg_event_trigger ORDER BY oid LIMIT 5001) x
)
SELECT jsonb_build_object('format','OPS_PRIVATE_CATALOG_RAW_02',
 'server_version_num',current_setting('server_version_num')::integer,
 'database',current_database(),'backend_pid',pg_backend_pid(),
 'captured_at',clock_timestamp(),'isolation',current_setting('transaction_isolation'),
 'read_only',current_setting('transaction_read_only'),
 'sections',jsonb_object_agg(name,jsonb_build_object('total',total,'rows',rows,
 'truncated',total>5000,'returned',jsonb_array_length(rows))),
 'lineage_evidence',NULL,'writer_analysis_complete',false,
 'mapper_ready',false,'project_binding','EXTERNAL_RECEIPT_REQUIRED') FROM sections;
ROLLBACK;
