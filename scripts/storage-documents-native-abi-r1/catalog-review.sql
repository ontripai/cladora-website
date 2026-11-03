-- Fixed task15/R1 catalog inspection. Function definitions stay in private custody.
-- No Auth rows, application functions, DDL, SET ROLE, or data access.
WITH ns AS (SELECT * FROM pg_namespace WHERE nspname='storage'),
rels AS (SELECT c.* FROM pg_class c JOIN ns ON ns.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f','S')),
funcs AS (SELECT p.* FROM pg_proc p JOIN ns ON ns.oid=p.pronamespace),
principals AS (SELECT oid,rolname FROM pg_roles WHERE rolname IN
 ('anon','authenticated','service_role','supabase_storage_admin'))
SELECT jsonb_build_object(
 'namespace',(SELECT jsonb_build_object('oid',oid,'owner',nspowner,'acl',nspacl,
  'effective_acl',(SELECT jsonb_agg(to_jsonb(a)) FROM aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a)) FROM ns),
 'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,
  'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'acl_expanded',(SELECT jsonb_agg(to_jsonb(a)) FROM aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a),
  'effective',(SELECT jsonb_agg(jsonb_build_object('role',p.rolname,
   'select',CASE WHEN c.relkind='S' THEN has_sequence_privilege(p.oid,c.oid,'SELECT') ELSE has_table_privilege(p.oid,c.oid,'SELECT') END,
   'insert',CASE WHEN c.relkind='S' THEN false ELSE has_table_privilege(p.oid,c.oid,'INSERT') END,
   'update',CASE WHEN c.relkind='S' THEN has_sequence_privilege(p.oid,c.oid,'UPDATE') ELSE has_table_privilege(p.oid,c.oid,'UPDATE') END,
   'delete',CASE WHEN c.relkind='S' THEN false ELSE has_table_privilege(p.oid,c.oid,'DELETE') END,
   'usage',CASE WHEN c.relkind='S' THEN has_sequence_privilege(p.oid,c.oid,'USAGE') ELSE has_schema_privilege(p.oid,c.relnamespace,'USAGE') END)) FROM principals p),
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'acl',a.attacl,'not_null',a.attnotnull,
   'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=c.oid AND d.adnum=a.attnum)) ORDER BY a.attnum)
   FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,
   'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) FROM pg_policy p WHERE p.polrelid=c.oid),
  'view_definition',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) ELSE NULL END
 ) ORDER BY c.relname) FROM rels c),
 'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,
  'signature',p.oid::regprocedure::text,'identity_arguments',pg_get_function_identity_arguments(p.oid),
  'result',pg_get_function_result(p.oid),'owner',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,
  'config',p.proconfig,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),
  'volatility',p.provolatile,'strict',p.proisstrict,'definition',pg_get_functiondef(p.oid),
  'acl_expanded',(SELECT jsonb_agg(to_jsonb(a)) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),
  'effective',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE'))) FROM principals r)
 ) ORDER BY p.oid::regprocedure::text) FROM funcs p),
 'roles',(SELECT jsonb_agg(jsonb_build_object('oid',r.oid,'name',r.rolname,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,
  'inherit',r.rolinherit,'login',r.rolcanlogin,'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,'replication',r.rolreplication))
  FROM pg_roles r WHERE r.oid IN (SELECT oid FROM principals UNION SELECT relowner FROM rels UNION SELECT proowner FROM funcs
   UNION SELECT nspowner FROM ns UNION SELECT defaclrole FROM pg_default_acl WHERE defaclnamespace IN (0,(SELECT oid FROM ns)))),
 'membership',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,
   'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option))
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor
  WHERE a.member IN (SELECT oid FROM principals) OR a.roleid IN (SELECT oid FROM principals)),
 'role_reachability',(SELECT jsonb_agg(jsonb_build_object('principal',p.rolname,'role',r.rolname,
  'member',pg_has_role(p.oid,r.oid,'MEMBER'),'usage',pg_has_role(p.oid,r.oid,'USAGE'),'set',pg_has_role(p.oid,r.oid,'SET')))
  FROM principals p CROSS JOIN pg_roles r WHERE pg_has_role(p.oid,r.oid,'MEMBER') OR p.oid=r.oid),
 'default_acl',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'namespace',d.defaclnamespace,
   'type',d.defaclobjtype,'acl',d.defaclacl,'expanded',(SELECT jsonb_agg(to_jsonb(a)) FROM aclexplode(d.defaclacl) a)))
  FROM pg_default_acl d WHERE d.defaclnamespace IN (0,(SELECT oid FROM ns))),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'internal',t.tgisinternal,
   'function',t.tgfoid::regprocedure::text,'definition',pg_get_triggerdef(t.oid,true))) FROM pg_trigger t JOIN rels c ON c.oid=t.tgrelid)
);
