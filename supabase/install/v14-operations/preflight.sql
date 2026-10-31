-- READ-ONLY SOURCE. NOT EXECUTED. No secret data/session contents are selected.
-- Transport/project binding is external; GUC is consistency only. No database changes.
begin isolation level repeatable read read only;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
select jsonb_build_object('server_version_num',current_setting('server_version_num'),'database',current_database(),
 'session_user',session_user,'current_user',current_user,'catalog',(with recursive
 namespaces as (select * from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')),
 roots as (select c.* from pg_class c where c.relnamespace in (select oid from namespaces)),
 relids(oid) as (select oid from roots union select c.reltoastrelid from roots c where c.reltoastrelid<>0
  union select i.indexrelid from pg_index i where i.indrelid in (select reltoastrelid from roots where reltoastrelid<>0)),
 constraints as (select c.* from pg_constraint c where c.conrelid in (select oid from relids) or c.contypid in (select oid from pg_type where typnamespace in (select oid from namespaces))),
 triggers as (select t.* from pg_trigger t where t.tgrelid in (select oid from relids) or t.tgconstraint in (select oid from constraints)),
 types as (select t.* from pg_type t where t.typnamespace in (select oid from namespaces) or t.typrelid in (select oid from relids)),
 objects(classid,objid) as (
 select 'pg_namespace'::regclass,oid from namespaces union select 'pg_class'::regclass,oid from relids
 union select 'pg_type'::regclass,oid from types union select 'pg_constraint'::regclass,oid from constraints
 union select 'pg_trigger'::regclass,oid from triggers
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace in (select oid from namespaces)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in (select oid from relids)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in (select oid from relids)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in (select oid from relids))
select jsonb_build_object(
 'format','operations-install-catalog-observation.v1',
 'classification','same-database raw catalog; OIDs retained; NOT cross-database normalization/equivalence',
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from namespaces n),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c where c.oid in (select oid from relids)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'default_expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attrelid,a.attnum),'[]') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid in (select oid from relids) and a.attnum>0),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('definition',pg_get_constraintdef(c.oid,true)) order by c.oid),'[]') from constraints c),
 'indexes',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid),'[]') from pg_index i where i.indexrelid in (select oid from relids)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.oid),'[]') from pg_policy p where p.polrelid in (select oid from relids)),
 'triggers_both_FK_sides',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid,true)) order by t.oid),'[]') from triggers t),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from types t),
 'enum_order',(select coalesce(jsonb_agg(to_jsonb(e) order by e.enumtypid,e.enumsortorder),'[]') from pg_enum e where e.enumtypid in (select oid from types)),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('identity',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.oid),'[]') from pg_proc p where p.pronamespace in (select oid from namespaces)),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by s.seqrelid),'[]') from pg_sequence s where s.seqrelid in (select oid from relids)),
 'rewrite',(select coalesce(jsonb_agg(to_jsonb(r) order by r.oid),'[]') from pg_rewrite r where r.ev_class in (select oid from relids)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') from pg_depend d where exists(select 1 from objects o where (o.classid=d.classid and o.objid=d.objid) or (o.classid=d.refclassid and o.objid=d.refobjid))),
 'shared_dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype),'[]') from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database()) and exists(select 1 from objects o where o.classid=d.classid and o.objid=d.objid)),
 'role_graph',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m),
 'role_attributes',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid),'[]') from pg_roles r where r.rolname in ('postgres','cladora_rpc_owner','cladora_building_fixture_ops')),
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d))),'managed',(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
),
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'managed_prerequisites',jsonb_build_object('auth_usage',has_schema_privilege(current_user,'auth','USAGE'),
 'auth_users_id_references',has_column_privilege(current_user,'auth.users','id','REFERENCES'),
 'auth_users_id_select',has_column_privilege(current_user,'auth.users','id','SELECT'),
 'auth_users_email_select',has_column_privilege(current_user,'auth.users','email','SELECT'),
 'auth_users_email_confirmed_select',has_column_privilege(current_user,'auth.users','email_confirmed_at','SELECT'),
 'auth_session_id_select',has_column_privilege(current_user,'auth.sessions','id','SELECT'),
 'auth_session_user_select',has_column_privilege(current_user,'auth.sessions','user_id','SELECT'),
 'auth_session_expiry_select',has_column_privilege(current_user,'auth.sessions','not_after','SELECT')));
rollback;
