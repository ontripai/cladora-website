-- AIRPROP catalog projection ONLY, for Platform's separately authorized window.
-- NOT EXECUTED by AIRPROP. No business rows, helpers, RPCs or installation.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL search_path=pg_catalog,pg_temp;
WITH wanted_rel(name) AS (VALUES
 ('airprop.listing_selected_bindings_v1'),('airprop.market_listings'),
 ('portfolio.unit_specification_versions'),('portfolio.parties'),
 ('platform.idempotency_keys'),('audit.events'),('platform.outbox_events')),
 wanted_fn(signature) AS (VALUES
 ('airprop.guard_listing_selected_binding_v1()'),
 ('airprop.assert_listing_selected_binding_c03_v1()'),
 ('customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text)'),
 ('customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)'),
 ('app_private.active_context_id()'),('app_private.active_tenant_id()'),('auth.uid()')),
 roles AS (SELECT r.oid,r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,
   r.rolreplication,r.rolcanlogin,r.rolinherit FROM pg_catalog.pg_roles r ORDER BY r.rolname LIMIT 257),
 members AS (SELECT * FROM pg_catalog.pg_auth_members ORDER BY roleid,member,grantor LIMIT 1025),
 defaults AS (SELECT a.* FROM pg_catalog.pg_default_acl a WHERE a.defaclnamespace IN
   (SELECT n.oid FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('airprop','customer_api')) ORDER BY a.oid LIMIT 129),
 events AS (SELECT * FROM pg_catalog.pg_event_trigger ORDER BY oid LIMIT 129),
 overloads AS (SELECT p.oid::regprocedure::text AS signature FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE
   (n.nspname='airprop' AND p.proname IN ('guard_listing_selected_binding_v1','assert_listing_selected_binding_c03_v1')) OR
   (n.nspname='customer_api' AND p.proname IN ('publish_airprop_listing_v1','control_airprop_listing_v1')) ORDER BY signature LIMIT 33),
 relation_projection AS (
 SELECT w.name,c.oid IS NOT NULL AS present,
 CASE WHEN c.oid IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
  'oid',c.oid::text,'owner',pg_catalog.pg_get_userbyid(c.relowner),'kind',c.relkind,
  'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'schema',n.nspname,
  'columns',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
    'generated',a.attgenerated,'identity',a.attidentity,
    'expression',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
    'acl',a.attacl::text) ORDER BY a.attnum)
    FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
  'constraints',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',k.conname,'type',k.contype,'validated',k.convalidated,'deferrable',k.condeferrable,
    'initially_deferred',k.condeferred,'definition',pg_catalog.pg_get_constraintdef(k.oid,true),
    'source_columns',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY x.ord)
      FROM pg_catalog.unnest(k.conkey) WITH ORDINALITY x(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),
    'target',CASE WHEN k.confrelid=0 THEN NULL ELSE k.confrelid::regclass::text END,
    'target_columns',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY x.ord)
      FROM pg_catalog.unnest(k.confkey) WITH ORDINALITY x(num,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num),
    'delete_action',k.confdeltype,'update_action',k.confupdtype,'match_type',k.confmatchtype)
    ORDER BY k.conname) FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid),'[]'::jsonb),
  'indexes',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',ic.relname,'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,
    'primary',i.indisprimary,'definition',pg_catalog.pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname)
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
    WHERE i.indrelid=c.oid),'[]'::jsonb),
  'triggers',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',t.tgname,'internal',t.tgisinternal,'enabled',t.tgenabled,'type',t.tgtype,
    'function',t.tgfoid::regprocedure::text,'deferrable',t.tgdeferrable,
    'initially_deferred',t.tginitdeferred,'definition',pg_catalog.pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname)
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid),'[]'::jsonb),
  'policies',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles::text,
    'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
    'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)
    FROM pg_catalog.pg_policy p WHERE p.polrelid=c.oid),'[]'::jsonb),
  'rules',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.pg_get_ruledef(r.oid,true) ORDER BY r.rulename)
    FROM pg_catalog.pg_rewrite r WHERE r.ev_class=c.oid),'[]'::jsonb),
  'acl',c.relacl::text,
  'effective',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,
    'usage',pg_catalog.has_schema_privilege(r.oid,c.relnamespace,'USAGE'),
    'select',pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT'),
    'insert',pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT'),
    'update',pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE'),
    'delete',pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE'),
    'truncate',pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE'),
    'references',pg_catalog.has_table_privilege(r.oid,c.oid,'REFERENCES'),
    'trigger',pg_catalog.has_table_privilege(r.oid,c.oid,'TRIGGER')) ORDER BY r.rolname) FROM roles r),'[]'::jsonb)
 ) END AS catalog
 FROM wanted_rel w LEFT JOIN pg_catalog.pg_class c ON c.oid=pg_catalog.to_regclass(w.name)
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
), function_projection AS (
 SELECT w.signature,p.oid IS NOT NULL AS present,
 CASE WHEN p.oid IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
  'oid',p.oid::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'kind',p.prokind,
  'security_definer',p.prosecdef,'config',p.proconfig,'result',pg_catalog.pg_get_function_result(p.oid),
  'body_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex'),
  'catalog_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.to_jsonb(p)-'prosrc')::text,'UTF8')),'hex'),
  'acl',p.proacl::text,
  'effective',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,
    'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
    'usage',pg_catalog.has_schema_privilege(r.oid,p.pronamespace,'USAGE')) ORDER BY r.rolname) FROM roles r),'[]'::jsonb)
 ) END AS catalog
 FROM wanted_fn w LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(w.signature)
)
SELECT pg_catalog.jsonb_build_object(
 'contract','airprop-listing-binding-catalog.v1',
 'identity',pg_catalog.jsonb_build_object('database_name',pg_catalog.current_database(),
   'database_oid',(SELECT d.oid::text FROM pg_catalog.pg_database d WHERE d.datname=pg_catalog.current_database()),
   'server_version_num',pg_catalog.current_setting('server_version_num'),
   'executor',current_user,'session',session_user),
 'observation',pg_catalog.jsonb_build_object('pid',pg_catalog.pg_backend_pid(),'at',pg_catalog.clock_timestamp()),
 'overflow',((SELECT pg_catalog.count(*)>256 FROM roles) OR (SELECT pg_catalog.count(*)>1024 FROM members)
   OR (SELECT pg_catalog.count(*)>128 FROM defaults) OR (SELECT pg_catalog.count(*)>128 FROM events)
   OR (SELECT pg_catalog.count(*)>32 FROM overloads)),
 'overloads',(SELECT COALESCE(pg_catalog.jsonb_agg(o.signature ORDER BY o.signature),'[]'::jsonb) FROM overloads o),
 'relations',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.name) FROM relation_projection r),
 'functions',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY f.signature) FROM function_projection f),
 'roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.rolname) FROM roles r),
 'memberships',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor),'[]'::jsonb)
   FROM members m),
 'default_acl',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) ORDER BY a.oid),'[]'::jsonb)
   FROM defaults a),
 'event_triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) ORDER BY e.oid),'[]'::jsonb)
   FROM events e)
) AS projection;
ROLLBACK;
