-- INACTIVE AIRPROP V2 SOURCE. NOT an installer/admission. Never strip guard.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $inactive$ BEGIN RAISE EXCEPTION 'AIRPROP_BINDING_V2_SOURCE_ONLY' USING ERRCODE='55000'; END $inactive$;
SELECT jsonb_build_object(
 'table',(select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,'options',c.reloptions)
   from pg_catalog.pg_class c where c.oid=to_regclass('airprop.listing_selected_bindings_v1')),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'ordinal',a.attnum,
   'not_null',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,'dropped',a.attisdropped,
   'acl',a.attacl::text,'expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid=to_regclass('airprop.listing_selected_bindings_v1') and a.attnum>0),
 'constraints',(select jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'validated',c.convalidated,
   'deferrable',c.condeferrable,'initially_deferred',c.condeferred,'definition',pg_get_constraintdef(c.oid)) order by c.conname)
   from pg_catalog.pg_constraint c where c.conrelid=to_regclass('airprop.listing_selected_bindings_v1')),
 'indexes',(select jsonb_agg(jsonb_build_object('name',x.relname,'definition',pg_get_indexdef(i.indexrelid),
   'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready) order by x.relname)
   from pg_catalog.pg_index i join pg_catalog.pg_class x on x.oid=i.indexrelid where i.indrelid=to_regclass('airprop.listing_selected_bindings_v1')),
 'triggers',(select jsonb_agg(jsonb_build_object('name',case when t.tgisinternal then null else t.tgname end,
   'internal',t.tgisinternal,'type',t.tgtype,'function',t.tgfoid::regprocedure::text,'enabled',t.tgenabled,
   'deferrable',t.tgdeferrable,'initially_deferred',t.tginitdeferred,'args',encode(t.tgargs,'hex'),
   'when',pg_get_expr(t.tgqual,t.tgrelid),'columns',t.tgattr::text)
   order by t.tgisinternal,t.tgtype,t.tgfoid::regprocedure::text,case when t.tgisinternal then '' else t.tgname end)
   from pg_catalog.pg_trigger t where t.tgrelid=to_regclass('airprop.listing_selected_bindings_v1')),
 'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
   'roles',p.polroles::text,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
   from pg_catalog.pg_policy p where p.polrelid=to_regclass('airprop.listing_selected_bindings_v1')),
 'rules',(select jsonb_agg(pg_get_ruledef(r.oid) order by r.rulename) from pg_catalog.pg_rewrite r where r.ev_class=to_regclass('airprop.listing_selected_bindings_v1')),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
   'kind',p.prokind,'result',pg_get_function_result(p.oid),'args',pg_get_function_arguments(p.oid),'language',l.lanname,
   'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'volatility',p.provolatile,'strict',p.proisstrict,
   'leakproof',p.proleakproof,'parallel',p.proparallel,'cost',p.procost,'rows',p.prorows,
   'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by p.oid::regprocedure::text)
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang
   where n.nspname='airprop' and p.proname in ('guard_listing_selected_binding_v1','assert_listing_selected_binding_c03_v1')),
 'schemas',(select jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text) order by n.nspname)
   from pg_catalog.pg_namespace n where n.nspname in ('airprop','portfolio','platform','audit','app_private','customer_api','auth')),
 'dependencies',(select jsonb_agg(jsonb_build_object('name',w.name,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text) order by a.attnum)
     from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_catalog.pg_constraint k where k.conrelid=c.oid)) order by w.name)
   from(values('airprop.market_listings'),('portfolio.unit_specification_versions'),('portfolio.parties'),('platform.idempotency_keys'),('audit.events'),('platform.outbox_events'))w(name)
   left join pg_catalog.pg_class c on c.oid=to_regclass(w.name)),
 'helpers',(select jsonb_agg(jsonb_build_object('signature',w.signature,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,
   'config',p.proconfig,'security_definer',p.prosecdef,'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by w.signature)
   from(values('auth.uid()'),('app_private.active_context_id()'),('app_private.active_tenant_id()'))w(signature)
   left join pg_catalog.pg_proc p on p.oid=to_regprocedure(w.signature)),
 'roles',(select jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid) from pg_catalog.pg_roles r),
 'memberships',(select jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor) from pg_catalog.pg_auth_members m),
 'default_acl',(select jsonb_agg(to_jsonb(a) order by a.oid) from pg_catalog.pg_default_acl a),
 'events',(select jsonb_agg(to_jsonb(e) order by e.oid) from pg_catalog.pg_event_trigger e)) AS catalog_image;
ROLLBACK;
