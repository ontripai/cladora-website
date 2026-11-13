-- INACTIVE AIRPROP V2 SOURCE. NOT an installer/admission. Never strip guard.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $inactive$ BEGIN RAISE EXCEPTION 'AIRPROP_BINDING_V2_SOURCE_ONLY' USING ERRCODE='55000'; END $inactive$;
DO $gate$ DECLARE p jsonb; image jsonb; actual text; BEGIN
 p:=nullif(current_setting('cladora.airprop_binding_adoption_v2',true),'')::jsonb;
 IF p IS NULL OR p->>'mode' IS DISTINCT FROM 'adapt'
  OR p->>'database_name' IS DISTINCT FROM current_database()
  OR p->>'database_oid' IS DISTINCT FROM (select oid::text from pg_catalog.pg_database where datname=current_database())
  OR p->>'executor' IS DISTINCT FROM current_user OR p->>'session' IS DISTINCT FROM session_user
  OR p->>'v1_before' IS NULL OR p->>'v1_before' !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'AIRPROP_V2_PLAN_TARGET_OR_COMPILED_IMAGE_REQUIRED' USING ERRCODE='55000'; END IF;
 image:=jsonb_build_object(
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
 'events',(select jsonb_agg(to_jsonb(e) order by e.oid) from pg_catalog.pg_event_trigger e)); actual:=encode(sha256(convert_to(image::text,'UTF8')),'hex');
 IF actual IS DISTINCT FROM p->>'v1_before' THEN RAISE EXCEPTION 'AIRPROP_V2_CATALOG_BEFORE_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(select 1 from pg_catalog.pg_event_trigger where evtenabled<>'D')
 THEN RAISE EXCEPTION 'AIRPROP_V2_EVENT_TRIGGER_CLOSURE_REQUIRED' USING ERRCODE='55000'; END IF;

 IF to_regclass('airprop.listing_selected_bindings_v1') IS NULL OR NOT EXISTS(select 1 from pg_catalog.pg_class c
 where c.oid=to_regclass('airprop.listing_selected_bindings_v1') and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'AIRPROP_V2_ADAPT_REQUIRES_EXACT_V1' USING ERRCODE='55000'; END IF;
 IF p->>'v1_table_oid' IS DISTINCT FROM to_regclass('airprop.listing_selected_bindings_v1')::oid::text
 OR p->>'v1_guard_oid' IS DISTINCT FROM to_regprocedure('airprop.guard_listing_selected_binding_v1()')::oid::text
 OR p->>'v1_receipt_guard_oid' IS DISTINCT FROM to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()')::oid::text
 THEN RAISE EXCEPTION 'AIRPROP_V2_EXISTING_OBJECT_IDENTITY_DRIFT' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()')
   and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='eae0d246d8160332fac1a73271ad3b74b291c3288a79473c15ab21efe3e74ede' and not prosecdef)
 OR NOT EXISTS(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('airprop.guard_listing_selected_binding_v1()')
   and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='035b2764615273ba065a4dfca32e6889ce32081f4ab32a0067dae8b4f2092efd' and not prosecdef)
 THEN RAISE EXCEPTION 'AIRPROP_V2_V1_FUNCTION_SOURCE_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(select 1 from(values('airprop.market_listings'),('portfolio.unit_specification_versions'),('portfolio.parties'),
 ('platform.idempotency_keys'),('audit.events'),('platform.outbox_events'))w(name) where to_regclass(w.name) IS NULL)
 OR EXISTS(select 1 from(values('auth.uid()'),('app_private.active_context_id()'),('app_private.active_tenant_id()'))w(signature)
 where to_regprocedure(w.signature) IS NULL)
 THEN RAISE EXCEPTION 'AIRPROP_V2_STORAGE_DEPENDENCY_ABSENT' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(select 1 from pg_catalog.pg_attribute where attrelid=to_regclass('portfolio.parties')
 and attname='native_revision_v1' and atttypid='bigint'::regtype and not attisdropped)
 THEN RAISE EXCEPTION 'AIRPROP_V2_CORE_PARTY_REVISION_REQUIRED' USING ERRCODE='55000'; END IF;
 END $gate$;
ROLLBACK;
