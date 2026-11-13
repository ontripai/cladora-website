-- INACTIVE AIRPROP V2 SOURCE. NOT an installer/admission. Never strip guard.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $inactive$ BEGIN RAISE EXCEPTION 'AIRPROP_BINDING_V2_SOURCE_ONLY' USING ERRCODE='55000'; END $inactive$;
DO $gate$ DECLARE p jsonb; image jsonb; actual text; BEGIN
 p:=nullif(current_setting('cladora.airprop_binding_adoption_v2',true),'')::jsonb;
 IF p IS NULL OR p->>'mode' IS DISTINCT FROM 'fresh'
  OR p->>'database_name' IS DISTINCT FROM current_database()
  OR p->>'database_oid' IS DISTINCT FROM (select oid::text from pg_catalog.pg_database where datname=current_database())
  OR p->>'executor' IS DISTINCT FROM current_user OR p->>'session' IS DISTINCT FROM session_user
  OR p->>'fresh_before' IS NULL OR p->>'fresh_before' !~ '^[a-f0-9]{64}$'
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
 IF actual IS DISTINCT FROM p->>'fresh_before' THEN RAISE EXCEPTION 'AIRPROP_V2_CATALOG_BEFORE_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(select 1 from pg_catalog.pg_event_trigger where evtenabled<>'D')
 THEN RAISE EXCEPTION 'AIRPROP_V2_EVENT_TRIGGER_CLOSURE_REQUIRED' USING ERRCODE='55000'; END IF;
 IF to_regclass('airprop.listing_selected_bindings_v1') IS NOT NULL OR to_regprocedure('airprop.guard_listing_selected_binding_v1()') IS NOT NULL
 OR to_regprocedure('airprop.assert_listing_selected_binding_c03_v1()') IS NOT NULL
 OR EXISTS(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='airprop' and p.proname in ('guard_listing_selected_binding_v1','assert_listing_selected_binding_c03_v1'))
 THEN RAISE EXCEPTION 'AIRPROP_V2_FRESH_REQUIRES_ABSENT' USING ERRCODE='55000'; END IF;



 IF EXISTS(select 1 from(values('airprop.market_listings'),('portfolio.unit_specification_versions'),('portfolio.parties'),
 ('platform.idempotency_keys'),('audit.events'),('platform.outbox_events'))w(name) where to_regclass(w.name) IS NULL)
 OR EXISTS(select 1 from(values('auth.uid()'),('app_private.active_context_id()'),('app_private.active_tenant_id()'))w(signature)
 where to_regprocedure(w.signature) IS NULL)
 THEN RAISE EXCEPTION 'AIRPROP_V2_STORAGE_DEPENDENCY_ABSENT' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(select 1 from pg_catalog.pg_attribute where attrelid=to_regclass('portfolio.parties')
 and attname='native_revision_v1' and atttypid='bigint'::regtype and not attisdropped)
 THEN RAISE EXCEPTION 'AIRPROP_V2_CORE_PARTY_REVISION_REQUIRED' USING ERRCODE='55000'; END IF;
 END $gate$;
create table airprop.listing_selected_bindings_v1 (
 tenant_id uuid not null,
 workspace_id uuid not null,
 -- Context is a canonical server-resolved selection, not a platform.contexts table.
 context_id uuid not null,
 listing_id uuid not null,
 listing_version integer not null check(listing_version>0),
 binding jsonb not null check(pg_catalog.jsonb_typeof(binding)='object'),
 unit_id uuid generated always as ((binding#>>'{selection,unit_id}')::uuid) stored not null,
 party_id uuid generated always as ((binding#>>'{selection,party_id}')::uuid) stored not null,
 spec_id uuid generated always as ((binding->>'spec_id')::uuid) stored not null,
 spec_version integer generated always as ((binding->>'spec_version')::integer) stored not null,
 primary key(listing_id,listing_version),
 foreign key(listing_id,tenant_id,workspace_id)
   references airprop.market_listings(id,tenant_id,workspace_id) on delete restrict,
 foreign key(spec_id) references portfolio.unit_specification_versions(id) on delete restrict,
 foreign key(party_id) references portfolio.parties(id) on delete restrict,
 foreign key(unit_id,spec_version) references portfolio.unit_specification_versions(unit_id,version) on delete restrict,
 check(((binding->>'tenant_id')::uuid=tenant_id and (binding->>'workspace_id')::uuid=workspace_id
   and (binding->>'context_id')::uuid=context_id
   and (binding#>>'{selection,listing_id}')::uuid=listing_id
   and (binding#>>'{selection,listing_version}')::integer=listing_version
   and (binding#>>'{selection,resource_id}')::uuid=unit_id
   and binding#>>'{selection,resource_type}'='unit'
   and (binding#>>'{selection,resource_version}')::integer=spec_version) is true),
 check((binding ?& array['actor_id','command_id','transaction_id','command_key','wire_sha256','selection'])
   and (binding->'selection') ?& array['party_id','party_kind','relationship_id','relationship_version','relationship_kind']),
 check(((binding#>>'{selection,party_kind}') in ('person','company')
   and (binding#>>'{selection,relationship_kind}') in ('ownership','management','representation')
   and (binding#>>'{selection,relationship_id}')::uuid is not null
   and (binding#>>'{selection,relationship_version}')::bigint>0
   and (binding->>'actor_id')::uuid is not null and (binding->>'command_id')::uuid is not null
   and (binding->>'transaction_id')::uuid is not null
   and (binding->>'wire_sha256') ~ '^[a-f0-9]{64}$'
   and (binding->>'command_key') ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$') is true),
 constraint listing_selected_binding_v2_versions check((NOT (binding ? 'binding_version') AND NOT ((binding->'selection') ? 'source_versions')) OR ((binding->'binding_version'='2'::jsonb
   and binding#>'{selection,source_versions,version}'='2'::jsonb
   and (binding#>>'{selection,source_versions,specification_id}')::uuid=spec_id
   and (binding#>>'{selection,source_versions,resource_version}')::integer=spec_version
   and pg_catalog.jsonb_typeof(binding#>'{selection,source_versions,party_version}')='number'
   and (binding#>>'{selection,source_versions,party_version}')::bigint between 1 and 9007199254740991
   and (binding#>>'{selection,source_versions,relationship_version}')::bigint=(binding#>>'{selection,relationship_version}')::bigint
   and (binding#>'{selection,source_versions}')-array['version','specification_id','resource_version','party_version','relationship_version']='{}'::jsonb) is true)),
 constraint listing_selected_binding_v2_root_keys check((NOT (binding ? 'binding_version') AND NOT ((binding->'selection') ? 'source_versions') AND (binding-array['tenant_id','workspace_id','context_id','actor_id','selection','spec_id','spec_version',
   'command_id','transaction_id','command_key','wire_sha256']='{}'::jsonb)) OR (binding-array['binding_version','tenant_id','workspace_id','context_id','actor_id','selection','spec_id','spec_version',
   'command_id','transaction_id','command_key','wire_sha256']='{}'::jsonb)),
 constraint listing_selected_binding_v2_selection_keys check((NOT (binding ? 'binding_version') AND NOT ((binding->'selection') ? 'source_versions') AND ((binding->'selection')-array['listing_id','listing_version','property_id','unit_id','resource_id','resource_version',
   'resource_type','party_id','party_kind','relationship_id','relationship_version','relationship_kind']='{}'::jsonb)) OR ((binding->'selection')-array['listing_id','listing_version','property_id','unit_id','resource_id','resource_version',
   'resource_type','party_id','party_kind','relationship_id','relationship_version','relationship_kind','source_versions']='{}'::jsonb))
);
create unique index listing_selected_binding_command_v1
 on airprop.listing_selected_bindings_v1(tenant_id,workspace_id,
   ((binding->>'actor_id')::uuid),(binding->>'command_key'));
create unique index listing_selected_binding_command_id_v1
 on airprop.listing_selected_bindings_v1(((binding->>'command_id')::uuid));
-- This is immutable reference history, not an ownership/mandate registry or allow.
-- No backfill: a historical row without a binding is NOT a current Party selection.
create function airprop.guard_listing_selected_binding_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $
begin
 if tg_op<>'INSERT' then
   raise exception 'listing_selected_binding_immutable' using errcode='42501';
 end if;
 if new.binding->'binding_version' IS DISTINCT FROM '2'::jsonb THEN
   raise exception 'listing_selected_binding_v2_new_insert_required' using errcode='23514';
 end if;
 if auth.uid() is null or (new.binding->>'actor_id')::uuid is distinct from auth.uid()
   or new.context_id is distinct from app_private.active_context_id()
   or new.tenant_id is distinct from app_private.active_tenant_id() then
   raise exception 'listing_selected_binding_scope' using errcode='42501';
 end if;
 perform 1 from airprop.market_listings l
   join portfolio.unit_specification_versions s on s.id=new.spec_id and s.tenant_id=l.tenant_id
   join portfolio.parties p on p.id=new.party_id and p.tenant_id=l.tenant_id
   where l.id=new.listing_id and l.tenant_id=new.tenant_id and l.workspace_id=new.workspace_id
     and l.version=new.listing_version and l.unit_id=new.unit_id
     and l.property_id=(new.binding#>>'{selection,property_id}')::uuid
     and s.unit_id=new.unit_id and s.version=new.spec_version
     and p.native_revision_v1=(new.binding#>>'{selection,source_versions,party_version}')::bigint;
 if not found then
   raise exception 'listing_selected_binding_subject' using errcode='23514';
 end if;
 return new;
end $;
create trigger listing_selected_binding_immutable_v1
 after insert or update or delete on airprop.listing_selected_bindings_v1
 for each row execute function airprop.guard_listing_selected_binding_v1();
create trigger listing_selected_binding_no_truncate_v1
 before truncate on airprop.listing_selected_bindings_v1
 for each statement execute function airprop.guard_listing_selected_binding_v1();
-- The host writes its REAL receipt only after mutate returns. Verify at settlement,
-- without generating a receipt or changing the canonical Core ledger/schema.
create function airprop.assert_listing_selected_binding_c03_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 perform 1 from platform.idempotency_keys k
   join audit.events a on a.id=(k.response_ref->>'audit_event_id')::bigint
   join platform.outbox_events o on o.id=(k.response_ref->>'outbox_event_id')::uuid
   where k.tenant_id=new.tenant_id and k.actor_id=(new.binding->>'actor_id')::uuid
     and k.key='core-tx.v1:'||new.workspace_id::text||':'||(new.binding->>'command_key')
     and k.status_code=200
     -- xmin is xid32; txid_current includes the epoch. Require this transaction's
     -- ledger write, not an old receipt offered to backfill a historical binding.
     and k.xmin::text=(pg_catalog.txid_current()%4294967296)::text
     and k.response_ref->>'contract_version' in ('core-transaction-receipt.v1','core-transaction-receipt.v2')
     and (k.response_ref->>'receipt_id')::uuid is not null
     and (k.response_ref->>'command_id')::uuid=(new.binding->>'command_id')::uuid
     and (k.response_ref->>'transaction_id')::uuid=(new.binding->>'transaction_id')::uuid
     and (k.response_ref->>'workspace_id')::uuid=new.workspace_id
     and (k.response_ref->>'actor_id')::uuid=(new.binding->>'actor_id')::uuid
     and (k.response_ref->>'mutation_id')::uuid=new.listing_id
     and k.response_ref->>'aggregate_type'='portfolio.unit'
     and (k.response_ref->>'aggregate_id')::uuid=new.unit_id
     and k.response_ref->>'input_fingerprint'='sha256:'||(new.binding->>'wire_sha256')
     and k.response_ref->>'idempotency_key'=new.binding->>'command_key'
     and k.response_ref#>>'{authority,decision}'='allowed'
     and (k.response_ref#>>'{authority,context_id}')::uuid=new.context_id
     and k.response_ref#>>'{authority,permission_code}'='airprop.opportunity.manage'
     and k.response_ref#>>'{authority,module_code}'='airprop_commercial'
     and a.tenant_id=new.tenant_id and a.actor_id=k.actor_id
     and a.request_id=(new.binding->>'command_id')::uuid
     and (a.after_snapshot->>'receipt_id')::uuid=(k.response_ref->>'receipt_id')::uuid
     and (a.after_snapshot->>'mutation_id')::uuid=new.listing_id
     and o.tenant_id=new.tenant_id and o.aggregate_type='portfolio.unit' and o.aggregate_id=new.unit_id
     and o.trace_id=(new.binding->>'command_id')::uuid
     and (o.payload->>'receipt_id')::uuid=(k.response_ref->>'receipt_id')::uuid
     and (o.payload->>'mutation_id')::uuid=new.listing_id;
 if not found then
   raise exception 'listing_selected_binding_core_receipt_required' using errcode='23514';
 end if;
 return null;
end $$;
create constraint trigger listing_selected_binding_c03_v1
 after insert on airprop.listing_selected_bindings_v1
 deferrable initially deferred for each row
 execute function airprop.assert_listing_selected_binding_c03_v1();
alter table airprop.listing_selected_bindings_v1 enable row level security;
alter table airprop.listing_selected_bindings_v1 force row level security;
revoke all on airprop.listing_selected_bindings_v1 from public,anon,authenticated,service_role;
revoke all on function airprop.guard_listing_selected_binding_v1() from public,anon,authenticated,service_role;
revoke all on function airprop.assert_listing_selected_binding_c03_v1() from public,anon,authenticated,service_role;
-- No policy, owner change, activation grant or default-ACL mutation. Adoption OPEN.
DO $gate$ DECLARE p jsonb; image jsonb; actual text; BEGIN
 p:=nullif(current_setting('cladora.airprop_binding_adoption_v2',true),'')::jsonb;
 IF p IS NULL OR p->>'mode' IS DISTINCT FROM 'fresh'
  OR p->>'database_name' IS DISTINCT FROM current_database()
  OR p->>'database_oid' IS DISTINCT FROM (select oid::text from pg_catalog.pg_database where datname=current_database())
  OR p->>'executor' IS DISTINCT FROM current_user OR p->>'session' IS DISTINCT FROM session_user
  OR p->>'fresh_after' IS NULL OR p->>'fresh_after' !~ '^[a-f0-9]{64}$'
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
 IF actual IS DISTINCT FROM p->>'fresh_after' THEN RAISE EXCEPTION 'AIRPROP_V2_CATALOG_AFTER_DRIFT' USING ERRCODE='55000'; END IF;
 IF EXISTS(select 1 from pg_catalog.pg_event_trigger where evtenabled<>'D')
 THEN RAISE EXCEPTION 'AIRPROP_V2_EVENT_TRIGGER_CLOSURE_REQUIRED' USING ERRCODE='55000'; END IF;




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
