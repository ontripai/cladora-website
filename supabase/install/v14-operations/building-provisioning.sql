-- Operations independent inactive install unit: building-provisioning, v1; SOURCE ONLY, NOT EXECUTED.
-- New lineage proposal; does not mark any historical migration applied.
-- Original proof55000/NULL/ROLLBACK files remain unchanged and are NOT installers.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('cladora.install.v14.operations',235));
do $unit_entry$
begin
 if current_user<>'postgres' or session_user<>current_user
  or exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'
  or current_setting('cladora.install.unit',true) is distinct from 'building-provisioning' then
  raise exception 'operations_install_prestate_mismatch' using errcode='55000';end if;
 if not has_schema_privilege(current_user,'auth','USAGE')
  or not has_column_privilege(current_user,'auth.users','id','REFERENCES')
  or not has_column_privilege(current_user,'auth.users','id','SELECT')
  or not has_column_privilege(current_user,'auth.users','email','SELECT')
  or not has_column_privilege(current_user,'auth.users','email_confirmed_at','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','user_id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','not_after','SELECT') then
  raise exception 'operations_managed_auth_read_or_reference_prerequisite' using errcode='55000';end if;
 if 'building-provisioning'='foundation' and exists(select 1 from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')) then
  raise exception 'operations_fresh_application_state_required' using errcode='55000';end if;
end; $unit_entry$;
select set_config('cladora.install.defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]')::text from pg_default_acl d),true);
select set_config('cladora.install.managed',(select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))::text),true);
-- COMPLETE CATALOG OBSERVATION; never a source-only equivalence PASS.
select set_config('cladora.install.catalog_before',(with recursive
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
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
select set_config('cladora.install.managed_complete',(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
 )::text,true);
do $catalog_entry$
begin
 if current_setting('cladora.install.native_binding',true) is null or current_setting('cladora.install.native_binding',true)=''
 or current_setting('cladora.install.operator_binding',true) is null or current_setting('cladora.install.operator_binding',true)=''
 or current_setting('cladora.install.execution_binding',true) is null or current_setting('cladora.install.execution_binding',true)=''
 or current_setting('cladora.install.prestate_sha256',true) is distinct from encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_before'),'UTF8'),'sha256'),'hex') then
 raise exception 'operations_install_external_binding_or_prestate_required' using errcode='55000';end if;
end; $catalog_entry$;
-- SELECTED EFFECT B.T07
create table platform.workspace_property_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  binding_source text not null check (binding_source in ('onboarding_activation', 'building_setup', 'platform_assignment', 'migration_verified')),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from)
);


-- SELECTED EFFECT B.T26
create table platform.building_setup_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null,
  status text not null default 'draft' check(status in ('draft','rehearsed','submitted','approved','provisioned','cancelled')),
  setup_payload jsonb not null,
  payload_hash text not null,
  rehearsal_result jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,idempotency_key),
  check(jsonb_typeof(setup_payload)='object')
);


-- SELECTED EFFECT B.OC1.T26
revoke all privileges on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T26
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at") on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T26
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.building_setup_runs'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.building_setup_runs from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.building_setup_runs'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.building_setup_runs from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T26
alter table platform.building_setup_runs enable row level security;


-- SELECTED EFFECT B.T18
create table platform.pilot_setup_reviewers (
 id uuid primary key default gen_random_uuid(),
 customer_workspace_id uuid not null references platform.customer_workspaces(id),
 normalized_email text not null,
 status text not null default 'prepared' check (status in ('prepared','active','revoked')),
 expires_at timestamptz not null,
 reason text not null,
 prepared_by uuid not null references auth.users(id),
 prepared_at timestamptz not null default statement_timestamp(),
 activated_by uuid references auth.users(id),
 membership_id uuid references identity.memberships(id),
 context_grant_id uuid references identity.context_grants(id),
 revoked_at timestamptz,
 check (normalized_email=lower(btrim(normalized_email))),
 check ((status='prepared' and activated_by is null and membership_id is null and context_grant_id is null)
     or (status='active' and activated_by is not null and membership_id is not null and context_grant_id is not null)
     or status='revoked')
);


-- SELECTED EFFECT B.OC1.T18
revoke all privileges on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T18
revoke select ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), insert ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), update ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), references ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at") on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T18
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.pilot_setup_reviewers'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.pilot_setup_reviewers from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.pilot_setup_reviewers'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.pilot_setup_reviewers from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T18
alter table platform.pilot_setup_reviewers enable row level security;


-- SELECTED EFFECT B.E028
alter table platform.building_setup_runs enable row level security;


-- SELECTED EFFECT B.E051
alter table platform.pilot_setup_reviewers enable row level security;


-- SELECTED EFFECT B.E100
alter table platform.building_setup_runs
 add column revision integer not null default 1 check(revision>0),
 add column creation_request_hash text,
 add column creation_receipt jsonb,
 add column submitted_revision integer,
 add column submitted_payload_hash text,
 add column approved_revision integer,
 add column approved_submitted_revision integer,
 add column approved_payload_hash text,
 add column last_command_key text,
 add column last_command_hash text,
 add column last_command_actor uuid references auth.users(id),
 add column last_command_receipt jsonb;


-- SELECTED EFFECT B.F46
create function platform.end_pilot_reviewers_with_basis() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_row platform.pilot_setup_reviewers; v_now timestamptz:=statement_timestamp();
begin
 if old.mode='PILOT' and old.status='active' and new.status<>'active' then
   for v_row in select * from platform.pilot_setup_reviewers
     where customer_workspace_id=new.customer_workspace_id and status in ('prepared','active') for update loop
     if v_row.status='active' then
       update identity.memberships set status='revoked',ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.membership_id;
       update identity.context_grants set ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.context_grant_id;
     end if;
     update platform.pilot_setup_reviewers set status='revoked',revoked_at=v_now where id=v_row.id;
   end loop;
 end if;
 return new;
end $$;


-- SELECTED EFFECT B.OC1.F46
revoke all privileges on function platform.end_pilot_reviewers_with_basis() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.end_pilot_reviewers_with_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.end_pilot_reviewers_with_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F53
create function app_private.protect_setup_creation_v2() returns trigger
language plpgsql set search_path=pg_catalog as $$begin
 if (new.tenant_id,new.customer_workspace_id,new.created_by,new.idempotency_key,new.creation_request_hash,new.creation_receipt)
 is distinct from (old.tenant_id,old.customer_workspace_id,old.created_by,old.idempotency_key,old.creation_request_hash,old.creation_receipt)
 then raise exception 'setup_creation_binding_immutable' using errcode='22023';end if;
 return new;
end$$;


-- SELECTED EFFECT B.F72
create function app_private.validate_setup_units_v2(p_units jsonb) returns void
language plpgsql set search_path=pg_catalog as $$begin
 if jsonb_typeof(p_units) is distinct from 'array' then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if jsonb_array_length(p_units) not between 1 and 500 then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e where jsonb_typeof(e) is distinct from 'object'
 or jsonb_typeof(e->'code') is distinct from 'string' or length(btrim(e->>'code')) not between 1 and 40
 or not(e ? 'floor' and e ? 'area_m2')
 or (jsonb_typeof(e->'floor')<>'null' and (jsonb_typeof(e->'floor')<>'number' or (e->>'floor') !~ '^-?[0-9]+$' or (e->>'floor')::numeric not between -5 and 200))
 or (jsonb_typeof(e->'area_m2')<>'null' and (jsonb_typeof(e->'area_m2')<>'number' or (e->>'area_m2')::numeric<=0 or (e->>'area_m2')::numeric>100000)))
 then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e cross join lateral jsonb_object_keys(e) k where k not in ('code','floor','area_m2')) then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e group by lower(btrim(e->>'code')) having count(*)>1)
 then raise exception 'setup_duplicate_unit_code' using errcode='22023';end if;
end$$;


-- SELECTED EFFECT B.F78
create function app_private.setup_record_v2(p_run platform.building_setup_runs) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('version',2,'run_id',p_run.id,'workspace_id',p_run.customer_workspace_id,
 'revision',p_run.revision,'status',p_run.status,'payload',p_run.setup_payload,'payload_hash',p_run.payload_hash,
 'property_id',p_run.property_id,'effective_units',case when p_run.property_id is null then null else
 (select coalesce(jsonb_agg(jsonb_build_object('code',u.code,'floor',u.floor,'area_m2',u.area_m2) order by u.code),'[]'::jsonb)
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
 where b.property_id=p_run.property_id and u.tenant_id=p_run.tenant_id) end,
 'creation_request_hash',p_run.creation_request_hash,'creation_receipt',p_run.creation_receipt,
 'submitted_revision',p_run.submitted_revision,'submitted_payload_hash',p_run.submitted_payload_hash,
 'approved_revision',p_run.approved_revision,'approved_payload_hash',p_run.approved_payload_hash,
 'last_command_key',p_run.last_command_key,'last_command_hash',p_run.last_command_hash,
 'last_command_receipt',p_run.last_command_receipt);
$$;


-- SELECTED EFFECT B.OC1.F78
revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F78
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.setup_record_v2(platform.building_setup_runs)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F71
create function app_private.require_building_setup_authority_v2(
 p_context_id pg_catalog.uuid,p_workspace_id pg_catalog.uuid,
 p_permission pg_catalog.text,p_action pg_catalog.text
) returns table(tenant_id pg_catalog.uuid,workspace_id pg_catalog.uuid,
 membership_id pg_catalog.uuid,actor_id pg_catalog.uuid)
language plpgsql stable security definer set search_path=pg_catalog
as $authority$
declare
 actor record;
 module_id pg_catalog.uuid;
 v_permission_id pg_catalog.uuid;
 expected_permission pg_catalog.text;
 limited_reviewer pg_catalog.bool;
 reviewer_end pg_catalog.timestamptz;
 basis_end pg_catalog.timestamptz;
begin
 perform app_private.require_building_session_current_v1();
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_context_id is null or p_workspace_id is null then
   raise exception 'building_setup_explicit_target_required' using errcode='42501';
 end if;
 expected_permission:=case
  when p_action in ('read','recover') then 'onboarding.import.read'
  when p_action in ('create','update','rehearse','submit','provision') then 'onboarding.import.manage'
  when p_action='approve' then 'onboarding.import.approve' else null end;
 if expected_permission is null or p_permission is distinct from expected_permission then
   raise exception 'building_setup_action_permission_denied' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'mfa_required' using errcode='42501';
 end if;

 -- Recognize a limited reviewer even when its receipt was revoked/expired:
 -- removing the receipt's validity must not promote that Context to an operator.
 select exists(select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join identity.roles r on r.id=m.role_id
   where g.id=p_context_id and m.user_id=auth.uid()
     and (r.code='building_setup_reviewer' or exists(
       select 1 from platform.pilot_setup_reviewers pr
       where pr.context_grant_id=g.id or pr.membership_id=m.id)))
 into limited_reviewer;
 if limited_reviewer and p_action not in ('read','recover','approve') then
   raise exception 'building_setup_reviewer_action_denied' using errcode='42501';
 end if;
 if limited_reviewer and not exists(
   select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join platform.workspace_member_roles a on a.membership_id=m.id
     and a.tenant_id=m.tenant_id and a.customer_workspace_id=p_workspace_id
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=m.tenant_id and r.customer_workspace_id=p_workspace_id
   where g.id=p_context_id and m.user_id=auth.uid() and a.authority_policy_version=2
     and a.scope_type='workspace' and a.valid_from<=statement_timestamp()
     and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 select * into actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if actor.workspace_id is distinct from p_workspace_id or actor.membership_id is null then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 select d.id into module_id from platform.module_definitions d
 where d.code='building_setup' and d.version=1 and d.is_active
   and d.lifecycle_status in ('active','published') and d.requires_aal2
   and d.entitlement_key='module.building_setup'
   and d.valid_from<=statement_timestamp() and (d.valid_to is null or d.valid_to>statement_timestamp());
 select p.id into v_permission_id from identity.permissions p where p.code=p_permission;
 if module_id is null or v_permission_id is null
   or not exists(select 1 from platform.module_permission_bindings b
     where b.module_definition_id=module_id and b.permission_id=v_permission_id
       and b.binding_version=1 and b.lifecycle_status='active'
       and b.is_assignable_to_local_role and b.is_delegable and b.requires_aal2
       and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
       and b.permission_mode=case p_permission when 'onboarding.import.read' then 'read'
         when 'onboarding.import.manage' then 'manage' else 'execute' end)
   or app_private.check_workspace_native_permission_v2(
     p_context_id,p_workspace_id,p_permission,'building_setup') is not true then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 -- Exact basis is independent of commercial case approval and tenant membership.
 select max(b.expires_at) into basis_end from platform.workspace_access_bases b
 join platform.customer_workspaces w on w.id=b.customer_workspace_id
 left join platform.workspace_contracts c on c.id=b.contract_id
 where b.customer_workspace_id=p_workspace_id and b.status='active'
   and b.activated_at<=statement_timestamp() and b.expires_at>statement_timestamp()
   and ((b.mode='PILOT' and w.environment='PILOT')
     or (b.mode='PAID' and c.customer_workspace_id=p_workspace_id
       and c.status='active' and c.signed_at is not null
       and b.paid_through>=(statement_timestamp() at time zone 'Europe/Bucharest')::date));
 if basis_end is null or not exists(select 1 from platform.workspace_taxonomy_assignments t
   where t.customer_workspace_id=p_workspace_id and t.tenant_id=actor.tenant_id
     and t.status='active' and t.country_code='RO'
     and t.valid_from<=statement_timestamp() and (t.valid_to is null or t.valid_to>statement_timestamp())) then
   raise exception 'building_setup_basis_required' using errcode='42501';
 end if;

 if limited_reviewer then
   select max(pr.expires_at) into reviewer_end from platform.pilot_setup_reviewers pr
   join platform.workspace_access_bases b on b.customer_workspace_id=pr.customer_workspace_id
   join platform.customer_workspaces w on w.id=pr.customer_workspace_id and w.environment='PILOT'
   join auth.users u on u.id=auth.uid()
   where pr.context_grant_id=p_context_id and pr.membership_id=actor.membership_id
     and pr.customer_workspace_id=p_workspace_id and pr.activated_by=auth.uid()
     and pr.status='active' and pr.expires_at>statement_timestamp()
     and pr.normalized_email=lower(btrim(u.email)) and u.email_confirmed_at is not null
     and b.mode='PILOT' and b.status='active' and b.activated_at<=statement_timestamp()
     and b.expires_at>=pr.expires_at and b.expires_at>statement_timestamp();
   if reviewer_end is null then raise exception 'building_setup_reviewer_basis_denied' using errcode='42501'; end if;
 end if;

 -- A global identity allow alone is insufficient. Require the particular
 -- permission's live version-2 canonical assignment/provenance as well.
 if not exists(select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=a.tenant_id and r.customer_workspace_id=a.customer_workspace_id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=module_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
     and rp.permission_id=v_permission_id and rp.effect='allow'
   join identity.memberships m on m.id=a.membership_id and m.tenant_id=a.tenant_id
   join identity.context_grants g on g.id=p_context_id and g.membership_id=m.id and g.tenant_id=m.tenant_id
   where a.tenant_id=actor.tenant_id and a.customer_workspace_id=p_workspace_id
     and a.membership_id=actor.membership_id and a.authority_policy_version=2
     and a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null
     and a.valid_from<=statement_timestamp() and a.valid_to>statement_timestamp()
     and a.valid_to<=basis_end and a.valid_to<=coalesce(m.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(g.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(r.valid_to,'infinity'::timestamptz)
     and (not limited_reviewer or (a.valid_to<=reviewer_end
       and not exists(select 1 from platform.workspace_role_modules other
         where other.workspace_role_id=r.id and other.module_definition_id<>module_id)
       and not exists(select 1 from platform.workspace_role_permissions other
         join identity.permissions p on p.id=other.permission_id
         where other.workspace_role_id=r.id and other.effect='allow'
           and p.code not in ('onboarding.import.read','onboarding.import.approve'))))
     and app_private.workspace_member_role_authority_active_v1(
       a.id,v_permission_id,module_id,'workspace',p_workspace_id) is true) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 return query select actor.tenant_id,p_workspace_id,actor.membership_id,auth.uid();
end;
$authority$;


-- SELECTED EFFECT B.OC1.F71
revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F71
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F15
create function app_private.can_read_building_setup_v2(p_tenant_id pg_catalog.uuid,p_workspace_id pg_catalog.uuid)
returns pg_catalog.bool language plpgsql stable security definer set search_path=pg_catalog
as $read_policy$
declare context_id pg_catalog.uuid; authorized pg_catalog.bool;
begin
 begin perform app_private.require_building_session_current_v1(); exception when insufficient_privilege then return false; end;
 if auth.uid() is null or p_workspace_id is null then return false; end if;
 for context_id in select g.id from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   where m.user_id=auth.uid() and m.status='active'
     and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
     and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
 loop
   begin
     select a.tenant_id=p_tenant_id into authorized
     from app_private.require_building_setup_authority_v2(
       context_id,p_workspace_id,'onboarding.import.read','read') a;
     if authorized is true then return true; end if;
   exception when insufficient_privilege then
     -- A known authorization denial on one Context does not authorize any row.
     null;
   end;
 end loop;
 return false;
end;
$read_policy$;


-- SELECTED EFFECT B.OC1.F15
revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F54
create function app_private.get_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.read','read');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id
 and customer_workspace_id=c.workspace_id;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;
 if r.created_by<>c.actor_id then
  perform app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.approve','approve');
  if r.submitted_by=c.actor_id or not(r.status='submitted' or (r.last_command_actor=c.actor_id and r.last_command_receipt->>'operation'='approve'))
  then raise exception 'setup_read_denied' using errcode='42501';end if;
 end if;
 return app_private.setup_record_v2(r);
end$$;


-- SELECTED EFFECT B.OC1.F54
revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F70
create function app_private.get_building_setup_attempt_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.read','read');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 select * into r from platform.building_setup_runs where tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id
 and created_by=c.actor_id and idempotency_key=p_idempotency_key;
 if not found then return null;end if;
 if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
 return app_private.setup_record_v2(r);
end$$;


-- SELECTED EFFECT B.OC1.F70
revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F70
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT G2.DOMAIN

create function app_private.building_setup_command_evidence_valid_v1(p_receipt jsonb,p_before jsonb,p_input jsonb,p_action text,
 p_expected integer,p_run uuid,p_workspace uuid,p_key text)
returns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $shape$
declare wanted text;
begin
 if p_receipt is null or p_before is null or p_input is null or jsonb_typeof(p_receipt)<>'object'
  or jsonb_typeof(p_before)<>'object' or jsonb_typeof(p_input)<>'object'
  or (select array_agg(k order by k) from jsonb_object_keys(p_receipt) k) is distinct from
   array['command_key','expected_revision','operation','payload_hash','property_id','revision','run_id','status','version','workspace_id']::text[]
  or (select array_agg(k order by k) from jsonb_object_keys(p_before) k) is distinct from array['payload_hash','revision','status']::text[]
  or (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['expected_payload_hash','units']::text[] then return false; end if;
 wanted:=case p_action when 'update' then 'draft' when 'rehearse' then 'rehearsed' when 'submit' then 'submitted' when 'approve' then 'approved' when 'provision' then 'provisioned' else null end;
 if wanted is null or not coalesce(jsonb_typeof(p_receipt->'version')='number' and (p_receipt->>'version')::integer=2
  and jsonb_typeof(p_receipt->'revision')='number' and (p_receipt->>'revision')::integer=p_expected+1
  and jsonb_typeof(p_receipt->'expected_revision')='number' and (p_receipt->>'expected_revision')::integer=p_expected
  and (p_before->>'revision')::integer=p_expected and p_receipt->>'operation'=p_action and p_receipt->>'command_key'=p_key
  and (p_receipt->>'run_id')::uuid=p_run and (p_receipt->>'workspace_id')::uuid=p_workspace
  and p_receipt->>'status'=wanted and p_receipt->>'payload_hash' ~ '^[0-9a-f]{64}$' and p_before->>'payload_hash' ~ '^[0-9a-f]{64}$',false) then return false; end if;
 if p_action='provision' then if jsonb_typeof(p_receipt->'property_id')<>'string' or (p_receipt->>'property_id')::uuid is null then return false; end if;
 elsif p_receipt->'property_id' is distinct from 'null'::jsonb then return false; end if;
 if p_action='update' then
  if p_before->>'status'<>'draft' then return false; end if;
  perform app_private.validate_setup_units_v2(p_input->'units');
 elsif p_input->'units' is distinct from 'null'::jsonb or p_before->>'payload_hash' is distinct from p_receipt->>'payload_hash' then return false; end if;
 if p_action='approve' then
  if p_before->>'status'<>'submitted' or p_input->>'expected_payload_hash' is distinct from p_before->>'payload_hash' then return false; end if;
 elsif p_input->'expected_payload_hash' is distinct from 'null'::jsonb then return false; end if;
 if (p_action='rehearse' and p_before->>'status' not in('draft','rehearsed'))
  or (p_action='submit' and p_before->>'status'<>'rehearsed') or (p_action='provision' and p_before->>'status'<>'approved') then return false; end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end; $shape$;

-- G2.STORES: domain evidence only; no user/Auth/fixture/application-state seed.
create table platform.building_setup_command_receipt_epochs (
 epoch_id text primary key check(epoch_id='building-g2-pm169-v1'),
 protocol integer not null check(protocol=1), source_contract_hash text not null check(source_contract_hash ~ '^[0-9a-f]{64}$'),
 guarantee_decision text not null check(guarantee_decision='APPROVED_SCOPED_BUILDING_FINAL_TRANSACTION_GUARANTEE'),
 retention_policy_id text check(retention_policy_id is null), pruning_enabled boolean not null check(not pruning_enabled)
);
create table platform.building_setup_command_coverage (
 run_id uuid primary key references platform.building_setup_runs(id) on delete restrict,
 tenant_id uuid not null, workspace_id uuid not null, creation_request_hash text not null check(creation_request_hash ~ '^[0-9a-f]{64}$'),
 epoch_id text not null references platform.building_setup_command_receipt_epochs(epoch_id) on delete restrict,
 from_expected_revision integer not null check(from_expected_revision=1)
);
create table platform.building_setup_command_receipts (
 tenant_id uuid not null, workspace_id uuid not null, run_id uuid not null references platform.building_setup_runs(id) on delete restrict,
 command_key text not null, actor_id uuid not null, context_id uuid not null, membership_id uuid not null,
 writer_session_id uuid not null, operation text not null check(operation in ('update','rehearse','submit','approve','provision')),
 expected_revision integer not null check(expected_revision between 1 and 2147483646),
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 input_descriptor jsonb not null check(jsonb_typeof(input_descriptor)='object' and input_descriptor ?& array['units','expected_payload_hash']),
 before_record jsonb not null check(jsonb_typeof(before_record)='object'), receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 epoch_id text not null references platform.building_setup_command_receipt_epochs(epoch_id) on delete restrict,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,workspace_id,run_id,command_key), unique(run_id,expected_revision),
 check(command_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' and command_key like 'setup-'||run_id::text||'-r'||expected_revision::text||'-%'),
 check(app_private.building_setup_command_evidence_valid_v1(receipt,before_record,input_descriptor,operation,expected_revision,run_id,workspace_id,command_key)),
 check(coalesce((receipt->>'version')::integer=2 and receipt->>'command_key'=command_key and receipt->>'operation'=operation
  and (receipt->>'run_id')::uuid=run_id and (receipt->>'workspace_id')::uuid=workspace_id
  and (receipt->>'expected_revision')::integer=expected_revision and (receipt->>'revision')::integer=expected_revision+1
  and (before_record->>'revision')::integer=expected_revision,false))
);
alter table platform.building_setup_command_receipt_epochs enable row level security;
alter table platform.building_setup_command_coverage enable row level security;
alter table platform.building_setup_command_receipts enable row level security;
create function app_private.protect_building_setup_command_evidence_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $immutable$
begin
 raise exception 'setup_g2_evidence_immutable' using errcode='42501';
end; $immutable$;
create trigger building_command_epoch_immutable before update or delete or truncate on platform.building_setup_command_receipt_epochs
 for each statement execute function app_private.protect_building_setup_command_evidence_v1();
create trigger building_command_coverage_immutable before update or delete or truncate on platform.building_setup_command_coverage
 for each statement execute function app_private.protect_building_setup_command_evidence_v1();
create trigger building_command_receipt_immutable before update or delete or truncate on platform.building_setup_command_receipts
 for each statement execute function app_private.protect_building_setup_command_evidence_v1();
-- Source identity, not an install receipt, historical migration ledger or retention approval.
insert into platform.building_setup_command_receipt_epochs
 values('building-g2-pm169-v1',1,'a930dc948aabff3d2dba426f0de4e3886066ab1fb4a3a0d8aced058a46cb0a5d','APPROVED_SCOPED_BUILDING_FINAL_TRANSACTION_GUARANTEE',null,false);
create function app_private.customer_mfa_required_at_v1(p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;
 return (select case
    when auth.uid() is null then true
    else exists(
      select 1
      from identity.memberships m
      join identity.roles r on r.id=m.role_id
      where m.user_id=auth.uid()
        and m.status='active'
        and m.starts_at<=p_checked_at
        and (m.ends_at is null or m.ends_at>p_checked_at)
        and lower(r.code) in ('association_admin','property_manager','president','censor')
    )
  end);
end;
$function$;

create function app_private.workspace_context_covers_role_scope_v1_at_v1(p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=p_checked_at and (g.ends_at is null or g.ends_at>p_checked_at);
 if not found then return false; end if;
 if p_scope_type='workspace' then return c.scope_type='tenant'; end if;
 if p_scope_type='property' then v_property:=p_scope_id;
 elsif p_scope_type='building' then
   v_building:=p_scope_id;
   select b.property_id into v_property from portfolio.buildings b where b.id=p_scope_id and b.tenant_id=p_tenant_id;
 elsif p_scope_type='unit' then
   v_unit:=p_scope_id;
   select u.building_id,b.property_id into v_building,v_property
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_scope_id and u.tenant_id=p_tenant_id;
 else return false; end if;
 if v_property is null then return false; end if;
 if c.scope_type='tenant' then return true; end if;
 if c.scope_type='property' then
   return c.property_id=v_property;
 elsif c.scope_type='building' then
   if v_building is null and p_scope_type='property' then return false; end if;
   if v_building is null then
     select b.id into v_building from portfolio.buildings b where b.property_id=v_property and b.tenant_id=p_tenant_id;
     if not found then return false; end if;
   end if;
   return c.building_id=v_building;
 elsif c.scope_type='unit' then
   if p_scope_type<>'unit' then return false; end if;
   return c.unit_id=v_unit;
 end if;
 return false;
exception when others then return false;
end;
$function$;

create function app_private.workspace_role_identity_source_current_v1_at_v1(p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,p_scope_type text,p_scope_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare v_member record; v_module record;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=p_checked_at and (m.ends_at is null or m.ends_at>p_checked_at);
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=p_checked_at and (g.ends_at is null or g.ends_at>p_checked_at))
    or not app_private.workspace_context_covers_role_scope_v1_at_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id,p_checked_at)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=p_checked_at
        and (b.valid_to is null or b.valid_to>p_checked_at))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=p_checked_at and (wm.valid_to is null or wm.valid_to>p_checked_at))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=p_checked_at and (e.valid_until is null or e.valid_until>p_checked_at)
            and case when e.override_value_json is not null and e.override_expires_at>p_checked_at
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=p_checked_at and (a.valid_to is null or a.valid_to>p_checked_at)
     and r.lifecycle_status='published' and r.valid_from<=p_checked_at
     and (r.valid_to is null or r.valid_to>p_checked_at)
     and rp.permission_id=p_permission_id and rp.effect='deny' and rm.module_definition_id=p_module_id
     and app_private.workspace_role_scope_overlaps_v1(
       a.scope_type,a.property_id,a.building_id,a.unit_id,
       p_scope_type,
       case when p_scope_type='property' then p_scope_id when p_scope_type in ('building','unit') then
         (select b.property_id from portfolio.buildings b where b.id=case when p_scope_type='building' then p_scope_id else (select u.building_id from portfolio.units u where u.id=p_scope_id) end) end,
       case when p_scope_type='building' then p_scope_id when p_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_scope_id) end,
       case when p_scope_type='unit' then p_scope_id end)
 ) then return false; end if;
 return true;
exception when others then return false;
end;
$function$;

create function app_private.workspace_member_role_authority_active_v1_at_v1(p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,p_target_scope_type text,p_target_scope_id uuid,p_path uuid[],p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=p_checked_at
   and (wmr.valid_to is null or wmr.valid_to>p_checked_at)
   and m.status='active' and m.starts_at<=p_checked_at and (m.ends_at is null or m.ends_at>p_checked_at)
   and r.lifecycle_status='published' and r.valid_from<=p_checked_at and (r.valid_to is null or r.valid_to>p_checked_at);
 if not found then return false; end if;
 if not app_private.workspace_role_scope_contains_v1(
   a.scope_type,a.property_id,a.building_id,a.unit_id,
   p_target_scope_type,
   case when p_target_scope_type='property' then p_target_scope_id when p_target_scope_type in ('building','unit') then
      (select b.property_id from portfolio.buildings b where b.id=case when p_target_scope_type='building' then p_target_scope_id else (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end) end,
   case when p_target_scope_type='building' then p_target_scope_id when p_target_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end,
   case when p_target_scope_type='unit' then p_target_scope_id end
 ) then return false; end if;
 if a.authority_policy_version=1 then return true; end if;
 if a.authority_policy_version<>2 then return false; end if;
 if not app_private.workspace_context_covers_role_scope_v1_at_v1(a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id,p_checked_at) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=p_checked_at and (md.valid_to is null or md.valid_to>p_checked_at);
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at))
 then return false; end if;
 if not exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='allow') then return false; end if;
 if exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='deny') then return false; end if;

 select * into s from platform.workspace_member_role_authority_sources x
 where x.assignment_id=a.id and x.permission_id=p_permission_id and x.module_definition_id=p_module_id;
 if not found then return false; end if;

 if s.source_kind='identity_role' then
   select grantor.* into grantor_rec from identity.memberships grantor
    where grantor.id=a.assigned_by_membership_id and grantor.tenant_id=a.tenant_id
      and grantor.status='active' and grantor.starts_at<=p_checked_at
      and (grantor.ends_at is null or grantor.ends_at>p_checked_at);
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1_at_v1(a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,p_checked_at);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=p_checked_at
     and (parent.valid_to is null or parent.valid_to>p_checked_at)
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1_at_v1(wr.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,array_append(coalesce(p_path,'{}'::uuid[]),a.id),p_checked_at);
 end if;
 return false;
exception when others then return false;
end;
$function$;

create function app_private.native_workspace_scope_for_membership_v2_at_v1(p_context_id uuid,p_membership_id uuid,p_workspace_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;
 return (select auth.uid() is not null and exists (
    select 1
    from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=g.tenant_id
    join platform.workspace_member_roles a on a.membership_id=m.id
      and a.tenant_id=w.tenant_id and a.customer_workspace_id=w.id
    join platform.workspace_roles wr on wr.id=a.workspace_role_id
      and wr.tenant_id=w.tenant_id and wr.customer_workspace_id=w.id
    where g.id=p_context_id and m.id=p_membership_id and g.scope_type='tenant'
      and g.property_id is null and g.building_id is null and g.unit_id is null
      and g.starts_at<=p_checked_at and (g.ends_at is null or g.ends_at>p_checked_at)
      and m.status='active' and m.starts_at<=p_checked_at
      and (m.ends_at is null or m.ends_at>p_checked_at)
      and w.lifecycle_status='ACTIVE'
      and a.scope_type in ('workspace','property','building','unit')
      and a.valid_from<=p_checked_at and (a.valid_to is null or a.valid_to>p_checked_at)
      and wr.scope_ceiling in ('workspace','property','building','unit')
      and case a.scope_type
        when 'workspace' then wr.scope_ceiling='workspace'
        when 'property' then wr.scope_ceiling in ('workspace','property')
        when 'building' then wr.scope_ceiling in ('workspace','property','building')
        when 'unit' then wr.scope_ceiling in ('workspace','property','building','unit')
        else false end
      and wr.lifecycle_status='published'
      and wr.valid_from<=p_checked_at and (wr.valid_to is null or wr.valid_to>p_checked_at)
      and (
        (a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null)
        or (a.scope_type='property' and a.building_id is null and a.unit_id is null
          and exists (
            select 1 from platform.workspace_property_bindings b
            where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
              and b.property_id=a.property_id and b.status='active'
              and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at)
          ))
        or (a.scope_type='building' and a.property_id is null and a.unit_id is null
          and exists (
            select 1 from portfolio.buildings pb
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pb.id=a.building_id and pb.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at)
          ))
        or (a.scope_type='unit' and a.property_id is null and a.building_id is null
          and exists (
            select 1 from portfolio.units pu
            join portfolio.buildings pb on pb.id=pu.building_id and pb.tenant_id=pu.tenant_id
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pu.id=a.unit_id and pu.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at)
          ))
      )
      and (
        a.authority_policy_version=1
        or exists (
          select 1 from platform.workspace_role_permissions rp
          join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
          where rp.workspace_role_id=wr.id and rp.effect='allow'
            and app_private.workspace_member_role_authority_active_v1_at_v1(a.id,rp.permission_id,rm.module_definition_id,a.scope_type,case a.scope_type when 'property' then a.property_id when 'building' then a.building_id
                when 'unit' then a.unit_id else null end,'{}'::uuid[],p_checked_at)
        )
      )
  ));
end;
$function$;

create function app_private.resolve_workspace_native_context_v2_at_v1(p_context_id uuid,p_workspace_id uuid,p_checked_at timestamptz)
returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_id uuid,role_code text,status text)
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

  if auth.uid() is null or p_context_id is null or p_workspace_id is null then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
  if app_private.customer_mfa_required_at_v1(p_checked_at) and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  return query select w.id,m.tenant_id,m.id,m.role_id,r.code,'active'::text
    from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=m.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid()
      and app_private.native_workspace_scope_for_membership_v2_at_v1(g.id,m.id,w.id,p_checked_at);
  if not found then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
end;
$function$;

create function app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context_id uuid,p_is_mutation boolean,p_checked_at timestamptz)
returns table (
  workspace_id uuid,
  tenant_id uuid,
  membership_id uuid,
  role_id uuid,
  role_code text,
  status text
)
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
#variable_conflict use_column
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_ws_count integer;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Context grant & active membership
  select g.*, m.id as membership_key, m.tenant_id as membership_tenant, m.role_id, r.code as role_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= p_checked_at and (m.ends_at is null or m.ends_at > p_checked_at)
    and g.starts_at <= p_checked_at and (g.ends_at is null or g.ends_at > p_checked_at);

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 3. Resolve target property if scoped
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.buildings b
    where b.id = v_grant.building_id and b.tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  -- 4. Context-to-Workspace resolution
  if p_is_mutation then
    -- Mutation strictly requires Property/Building/Unit binding. Tenant-only fallback is prohibited.
    if v_target_property_id is null then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    end if;

    select count(*)
    into v_binding_count
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= p_checked_at and (b.valid_to is null or b.valid_to > p_checked_at);

    if v_binding_count = 0 then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    elsif v_binding_count > 1 then
      raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= p_checked_at and (b.valid_to is null or b.valid_to > p_checked_at)
    limit 1;

    if v_binding.tenant_id <> v_grant.membership_tenant then
      raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
    end if;

    select * into v_workspace
    from platform.customer_workspaces cw
    where cw.id = v_binding.customer_workspace_id
      and cw.tenant_id = v_grant.membership_tenant
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_workspace.id is null then
      raise exception 'workspace_composition_workspace_inactive' using errcode = '42501';
    end if;

    return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
    return;
  else
    -- Read projection
    if v_target_property_id is not null then
      select count(*)
      into v_binding_count
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= p_checked_at and (b.valid_to is null or b.valid_to > p_checked_at);

      if v_binding_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      elsif v_binding_count > 1 then
        raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
      end if;

      select * into v_binding
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= p_checked_at and (b.valid_to is null or b.valid_to > p_checked_at)
      limit 1;

      if v_binding.tenant_id <> v_grant.membership_tenant then
        raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
      end if;

      select * into v_workspace
      from platform.customer_workspaces cw
      where cw.id = v_binding.customer_workspace_id
        and cw.tenant_id = v_grant.membership_tenant
        and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_workspace.id is null then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      end if;

      return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
      return;
    else
      -- Pure tenant-scoped context read
      select count(*) into v_ws_count
      from platform.customer_workspaces cw
      where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_ws_count = 1 then
        select * into v_workspace
        from platform.customer_workspaces cw
        where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');
        return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
        return;
      elsif v_ws_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      else
        raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
      end if;
    end if;
  end if;
end;
$function$;

create function app_private.check_direct_effective_permission_v2_at_v1(p_context_id uuid,p_membership_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid,p_explicit_workspace_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
  v_res record;
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_ctx_grant record;
  v_workspace_id uuid;
  v_ctx_property_id uuid;
  v_ctx_scope_covered boolean := false;
  v_has_allow boolean := false;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- 1. Validate Context Grant independently (deterministic single-row, fail-closed)
  select cg.id, cg.tenant_id, cg.membership_id, cg.scope_type, cg.property_id, cg.building_id, cg.unit_id
  into v_ctx_grant
  from identity.context_grants cg
  where cg.id = p_context_id
    and cg.membership_id = p_membership_id
    and cg.starts_at <= p_checked_at
    and (cg.ends_at is null or cg.ends_at > p_checked_at);

  if not found then return false; end if;

  if p_explicit_workspace_id is not null then
    -- The direct helper also evaluates grantors for delegated permission.
    -- This internal check deliberately validates the supplied membership,
    -- while the top-level native resolver verifies the current caller owns it.
    if p_target_scope_type is distinct from 'workspace'
      or p_target_scope_id is distinct from p_explicit_workspace_id
      or not app_private.native_workspace_scope_for_membership_v2_at_v1(p_context_id,p_membership_id,p_explicit_workspace_id,p_checked_at) then return false; end if;
    v_workspace_id := p_explicit_workspace_id;
  else
  -- 2. Resolve property from context grant
  if v_ctx_grant.property_id is not null then
    v_ctx_property_id := v_ctx_grant.property_id;
  elsif v_ctx_grant.building_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.buildings b
    where b.id = v_ctx_grant.building_id and b.tenant_id = v_ctx_grant.tenant_id;
  elsif v_ctx_grant.unit_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_ctx_grant.unit_id and u.tenant_id = v_ctx_grant.tenant_id;
  end if;

  if v_ctx_property_id is not null then
    select b.customer_workspace_id into v_workspace_id
    from platform.workspace_property_bindings b
    join platform.customer_workspaces cw on cw.id = b.customer_workspace_id
    where b.property_id = v_ctx_property_id
      and b.tenant_id = v_ctx_grant.tenant_id
      and b.status = 'active'
      and b.valid_from <= p_checked_at
      and (b.valid_to is null or b.valid_to > p_checked_at)
      and cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  else
    select cw.id into v_workspace_id
    from platform.customer_workspaces cw
    where cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  end if;

  end if;

  if v_workspace_id is null then return false; end if;

  select v_workspace_id as workspace_id, v_ctx_grant.tenant_id as tenant_id into v_res;

  -- 3. Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= p_checked_at
    and (m.ends_at is null or m.ends_at > p_checked_at);

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  -- Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= p_checked_at and (e.valid_until is null or e.valid_until > p_checked_at)
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > p_checked_at
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= p_checked_at
    and (wta.valid_to is null or wta.valid_to > p_checked_at);

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Target Scope Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
  ) then
    return false;
  end if;

  -- Context Grant scope containment check against Target Scope
  if v_ctx_grant.scope_type::text in ('workspace', 'tenant') then
      v_ctx_scope_covered := true;
    elsif v_ctx_grant.scope_type::text = 'property' then
      if p_target_scope_type in ('property', 'building', 'unit')
         and v_ctx_grant.property_id = v_target_property_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'building' then
      if p_target_scope_type in ('building', 'unit')
         and v_ctx_grant.building_id = v_target_building_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'unit' then
      if p_target_scope_type = 'unit'
         and v_ctx_grant.unit_id = v_target_unit_id then
        v_ctx_scope_covered := true;
      end if;
    end if;

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A (Strict: requires valid context grant that covers target scope)
  if v_ctx_scope_covered and v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B (Strict: requires local role assignment that covers target scope)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1_at_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id,'{}'::uuid[],p_checked_at)
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$function$;

create function app_private.check_effective_permission_v2_at_v1(p_context_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid,p_explicit_workspace_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    if p_explicit_workspace_id is null then
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context_id,false,p_checked_at);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2_at_v1(p_context_id,p_explicit_workspace_id,p_checked_at);
    end if;
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= p_checked_at and (e.valid_until is null or e.valid_until > p_checked_at)
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > p_checked_at
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= p_checked_at
    and (wta.valid_to is null or wta.valid_to > p_checked_at);

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
  ) then
    return false;
  end if;

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1_at_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id,'{}'::uuid[],p_checked_at)
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wd.tenant_id=v_res.tenant_id
        and mpb.module_definition_id=v_mod.id and mpb.permission_id=v_perm.id
        and mpb.valid_from<=p_checked_at and (mpb.valid_to is null or mpb.valid_to>p_checked_at)))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= p_checked_at
      and wd.valid_until > p_checked_at
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and exists (
        select 1 from identity.context_grants gcg
        where gcg.membership_id = wd.grantor_membership_id
          and gcg.tenant_id = v_res.tenant_id
          and gcg.starts_at <= p_checked_at
          and (gcg.ends_at is null or gcg.ends_at > p_checked_at)
          and app_private.check_direct_effective_permission_v2_at_v1(gcg.id,wd.grantor_membership_id,p_permission_code,p_module_code,wd.scope_type,coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),p_explicit_workspace_id,p_checked_at) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$function$;

create function app_private.check_workspace_native_permission_v2_at_v1(p_context_id uuid,p_workspace_id uuid,p_permission_code text,p_module_code text,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;
 return (select case when p_context_id is null or p_workspace_id is null
 or p_permission_code is null or p_module_code is null then false else
 coalesce(app_private.check_effective_permission_v2_at_v1(p_context_id,p_permission_code,p_module_code,'workspace',p_workspace_id,p_workspace_id,p_checked_at),false) end);
end;
$function$;

create function app_private.require_request_session_current_at_v1(p_checked_at timestamptz)
returns void
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
 v_actor uuid; v_claims jsonb; v_session uuid; v_expiry numeric;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_session_not_current';
 end if;
 begin
  v_actor:=auth.uid(); v_claims:=auth.jwt();
  if v_actor is null or pg_catalog.jsonb_typeof(v_claims) is distinct from 'object'
   or pg_catalog.jsonb_typeof(v_claims->'exp') is distinct from 'number'
   or v_claims->>'role' is distinct from 'authenticated'
   or (v_claims->>'sub')::uuid is distinct from v_actor
   or v_claims->>'aal' not in ('aal1','aal2') or v_claims->>'aal' is null then
   raise exception using errcode='42501',message='request_session_not_current';
  end if;
  v_session:=(v_claims->>'session_id')::uuid;
  v_expiry:=(v_claims->>'exp')::numeric;
  if v_session is null or v_expiry is null or v_expiry::text in ('NaN','Infinity','-Infinity')
   or v_expiry<=extract(epoch from p_checked_at)
   or not exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=v_actor
    and (s.not_after is null or (pg_catalog.isfinite(s.not_after) and s.not_after>p_checked_at))) then
   raise exception using errcode='42501',message='request_session_not_current';
  end if;
 exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='42501',message='request_session_not_current';
 end;
end;
$function$;
create function app_private.require_building_setup_authority_at_v1(
 p_context_id pg_catalog.uuid,p_workspace_id pg_catalog.uuid,
 p_permission pg_catalog.text,p_action pg_catalog.text,p_checked_at pg_catalog.timestamptz
) returns table(tenant_id pg_catalog.uuid,workspace_id pg_catalog.uuid,
 membership_id pg_catalog.uuid,actor_id pg_catalog.uuid)
language plpgsql stable security definer set search_path=pg_catalog
as $authority$
declare
 actor record;
 module_id pg_catalog.uuid;
 v_permission_id pg_catalog.uuid;
 expected_permission pg_catalog.text;
 limited_reviewer pg_catalog.bool;
 reviewer_end pg_catalog.timestamptz;
 basis_end pg_catalog.timestamptz;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then raise exception 'setup_checkpoint_time_invalid' using errcode='42501'; end if;
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_context_id is null or p_workspace_id is null then
   raise exception 'building_setup_explicit_target_required' using errcode='42501';
 end if;
 expected_permission:=case
  when p_action in ('read','recover') then 'onboarding.import.read'
  when p_action in ('create','update','rehearse','submit','provision') then 'onboarding.import.manage'
  when p_action='approve' then 'onboarding.import.approve' else null end;
 if expected_permission is null or p_permission is distinct from expected_permission then
   raise exception 'building_setup_action_permission_denied' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'mfa_required' using errcode='42501';
 end if;

 -- Recognize a limited reviewer even when its receipt was revoked/expired:
 -- removing the receipt's validity must not promote that Context to an operator.
 select exists(select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join identity.roles r on r.id=m.role_id
   where g.id=p_context_id and m.user_id=auth.uid()
     and (r.code='building_setup_reviewer' or exists(
       select 1 from platform.pilot_setup_reviewers pr
       where pr.context_grant_id=g.id or pr.membership_id=m.id)))
 into limited_reviewer;
 if limited_reviewer and p_action not in ('read','recover','approve') then
   raise exception 'building_setup_reviewer_action_denied' using errcode='42501';
 end if;
 if limited_reviewer and not exists(
   select 1 from identity.context_grants g
   join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
   join platform.workspace_member_roles a on a.membership_id=m.id
     and a.tenant_id=m.tenant_id and a.customer_workspace_id=p_workspace_id
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=m.tenant_id and r.customer_workspace_id=p_workspace_id
   where g.id=p_context_id and m.user_id=auth.uid() and a.authority_policy_version=2
     and a.scope_type='workspace' and a.valid_from<=p_checked_at
     and (a.valid_to is null or a.valid_to>p_checked_at)
     and r.lifecycle_status='published' and r.valid_from<=p_checked_at
     and (r.valid_to is null or r.valid_to>p_checked_at)) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 select * into actor from app_private.resolve_workspace_native_context_v2_at_v1(p_context_id,p_workspace_id,p_checked_at);
 if actor.workspace_id is distinct from p_workspace_id or actor.membership_id is null then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 select d.id into module_id from platform.module_definitions d
 where d.code='building_setup' and d.version=1 and d.is_active
   and d.lifecycle_status in ('active','published') and d.requires_aal2
   and d.entitlement_key='module.building_setup'
   and d.valid_from<=p_checked_at and (d.valid_to is null or d.valid_to>p_checked_at);
 select p.id into v_permission_id from identity.permissions p where p.code=p_permission;
 if module_id is null or v_permission_id is null
   or not exists(select 1 from platform.module_permission_bindings b
     where b.module_definition_id=module_id and b.permission_id=v_permission_id
       and b.binding_version=1 and b.lifecycle_status='active'
       and b.is_assignable_to_local_role and b.is_delegable and b.requires_aal2
       and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at)
       and b.permission_mode=case p_permission when 'onboarding.import.read' then 'read'
         when 'onboarding.import.manage' then 'manage' else 'execute' end)
   or app_private.check_workspace_native_permission_v2_at_v1(
     p_context_id,p_workspace_id,p_permission,'building_setup',p_checked_at) is not true then
   raise exception 'building_setup_authority_denied' using errcode='42501';
 end if;

 -- Exact basis is independent of commercial case approval and tenant membership.
 select max(b.expires_at) into basis_end from platform.workspace_access_bases b
 join platform.customer_workspaces w on w.id=b.customer_workspace_id
 left join platform.workspace_contracts c on c.id=b.contract_id
 where b.customer_workspace_id=p_workspace_id and b.status='active'
   and b.activated_at<=p_checked_at and b.expires_at>p_checked_at
   and ((b.mode='PILOT' and w.environment='PILOT')
     or (b.mode='PAID' and c.customer_workspace_id=p_workspace_id
       and c.status='active' and c.signed_at is not null
       and b.paid_through>=(p_checked_at at time zone 'Europe/Bucharest')::date));
 if basis_end is null or not exists(select 1 from platform.workspace_taxonomy_assignments t
   where t.customer_workspace_id=p_workspace_id and t.tenant_id=actor.tenant_id
     and t.status='active' and t.country_code='RO'
     and t.valid_from<=p_checked_at and (t.valid_to is null or t.valid_to>p_checked_at)) then
   raise exception 'building_setup_basis_required' using errcode='42501';
 end if;

 if limited_reviewer then
   select max(pr.expires_at) into reviewer_end from platform.pilot_setup_reviewers pr
   join platform.workspace_access_bases b on b.customer_workspace_id=pr.customer_workspace_id
   join platform.customer_workspaces w on w.id=pr.customer_workspace_id and w.environment='PILOT'
   join auth.users u on u.id=auth.uid()
   where pr.context_grant_id=p_context_id and pr.membership_id=actor.membership_id
     and pr.customer_workspace_id=p_workspace_id and pr.activated_by=auth.uid()
     and pr.status='active' and pr.expires_at>p_checked_at
     and pr.normalized_email=lower(btrim(u.email)) and u.email_confirmed_at is not null
     and b.mode='PILOT' and b.status='active' and b.activated_at<=p_checked_at
     and b.expires_at>=pr.expires_at and b.expires_at>p_checked_at;
   if reviewer_end is null then raise exception 'building_setup_reviewer_basis_denied' using errcode='42501'; end if;
 end if;

 -- A global identity allow alone is insufficient. Require the particular
 -- permission's live version-2 canonical assignment/provenance as well.
 if not exists(select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
     and r.tenant_id=a.tenant_id and r.customer_workspace_id=a.customer_workspace_id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=module_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
     and rp.permission_id=v_permission_id and rp.effect='allow'
   join identity.memberships m on m.id=a.membership_id and m.tenant_id=a.tenant_id
   join identity.context_grants g on g.id=p_context_id and g.membership_id=m.id and g.tenant_id=m.tenant_id
   where a.tenant_id=actor.tenant_id and a.customer_workspace_id=p_workspace_id
     and a.membership_id=actor.membership_id and a.authority_policy_version=2
     and a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null
     and a.valid_from<=p_checked_at and a.valid_to>p_checked_at
     and a.valid_to<=basis_end and a.valid_to<=coalesce(m.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(g.ends_at,'infinity'::timestamptz)
     and a.valid_to<=coalesce(r.valid_to,'infinity'::timestamptz)
     and (not limited_reviewer or (a.valid_to<=reviewer_end
       and not exists(select 1 from platform.workspace_role_modules other
         where other.workspace_role_id=r.id and other.module_definition_id<>module_id)
       and not exists(select 1 from platform.workspace_role_permissions other
         join identity.permissions p on p.id=other.permission_id
         where other.workspace_role_id=r.id and other.effect='allow'
           and p.code not in ('onboarding.import.read','onboarding.import.approve'))))
     and app_private.workspace_member_role_authority_active_v1_at_v1(
       a.id,v_permission_id,module_id,'workspace',p_workspace_id,array[]::uuid[],p_checked_at) is true) then
   raise exception 'building_setup_native_assignment_required' using errcode='42501';
 end if;
 return query select actor.tenant_id,p_workspace_id,actor.membership_id,auth.uid();
end;
$authority$;

create function app_private.require_building_setup_command_checkpoint_v1(p_context_id uuid,p_workspace_id uuid,p_action text)
returns jsonb language plpgsql volatile security definer called on null input set search_path=pg_catalog
as $checkpoint$
declare checked_at timestamptz; permission text; binding jsonb; gate record;
begin
 if current_setting('transaction_isolation') is distinct from 'read committed' then
  raise exception 'setup_checkpoint_profile_mismatch' using errcode='25001'; end if;
 permission:=case when p_action in('read','recover') then 'onboarding.import.read'
  when p_action='approve' then 'onboarding.import.approve'
  when p_action in('create','update','rehearse','submit','provision') then 'onboarding.import.manage' else null end;
 if permission is null or p_context_id is null or p_workspace_id is null then raise exception 'setup_checkpoint_target_required' using errcode='42501'; end if;
 checked_at:=clock_timestamp();
 -- One fresh SPI query: session, time and full native domain authority share one snapshot/T.
 select app_private.require_request_session_current_at_v1(checked_at) as session_check,
  to_jsonb(a)||jsonb_build_object('context_id',p_context_id,'session_id',(auth.jwt()->>'session_id')::uuid) as tuple
 into strict gate
 from app_private.require_building_setup_authority_at_v1(p_context_id,p_workspace_id,permission,p_action,checked_at) a;
 binding:=gate.tuple;
 if binding->>'actor_id' is distinct from auth.uid()::text or binding->>'workspace_id' is distinct from p_workspace_id::text
  or exists(select 1 from unnest(array['tenant_id','workspace_id','membership_id','actor_id','context_id','session_id']) k where binding->>k is null) then
  raise exception 'setup_authority_contract_invalid' using errcode='42501'; end if;
 return binding;
end; $checkpoint$;

create function app_private.assert_building_setup_command_checkpoint_v1(p_context_id uuid,p_workspace_id uuid,p_action text,p_original jsonb)
returns void language plpgsql volatile security definer set search_path=pg_catalog as $assert$
declare current_tuple jsonb;
begin
 current_tuple:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action);
 if current_tuple is distinct from p_original then raise exception 'setup_checkpoint_tuple_changed' using errcode='42501'; end if;
end; $assert$;

create function app_private.assert_building_setup_g2_followon_v1() returns void
language plpgsql volatile security definer set search_path=pg_catalog as $closure$
declare target oid;
begin
 -- These are the complete application-write relations of this domain closure.
 foreach target in array array['platform.building_setup_runs'::regclass::oid,'portfolio.properties'::regclass::oid,
  'portfolio.buildings'::regclass::oid,'portfolio.units'::regclass::oid,'finance.accounting_periods'::regclass::oid,
  'platform.workspace_property_bindings'::regclass::oid,'identity.context_grants'::regclass::oid,
  'app_private.canonical_authority_revision_v1'::regclass::oid,'audit.events'::regclass::oid,
  'platform.building_setup_command_receipts'::regclass::oid,'platform.building_setup_command_coverage'::regclass::oid,
  'platform.building_setup_command_receipt_epochs'::regclass::oid] loop
  if exists(select 1 from pg_constraint where conrelid=target and (condeferrable or not convalidated))
   or exists(select 1 from pg_trigger where tgrelid=target and (tgdeferrable or tginitdeferred)) then
   raise exception 'setup_g2_unknown_deferred_followon' using errcode='55000'; end if;
  if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where t.tgrelid=target and t.tgenabled<>'D' and not t.tgisinternal and n.nspname||'.'||p.proname<>all(array[
    'app_private.bind_provisioned_building_workspace_v1','app_private.protect_setup_creation_v2',
    'finance.protect_accounting_period','finance.assert_accounting_period_no_overlap','finance.assert_accounting_period_property_tenant',
    'app_private.set_updated_at','app_private.guard_workspace_property_binding_history_v1','app_private.guard_workspace_property_binding_v1',
    'platform.cap_customer_context_to_membership','app_private.bump_canonical_authority_revision_v1',
    'app_private.guard_authority_revision_v1','app_private.guard_jurisdiction_bound_property_address_v1',
    'app_private.protect_building_setup_command_evidence_v1'])) then
   raise exception 'setup_g2_unknown_trigger_followon' using errcode='55000'; end if;
 end loop;
end; $closure$;
create function app_private.create_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;v_hash text;v_id uuid:=gen_random_uuid();v_receipt jsonb; initial jsonb; existing boolean;
begin
 initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create');
 perform app_private.assert_building_setup_g2_followon_v1();
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.manage','create');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 v_hash:=encode(extensions.digest(jsonb_build_object('actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'operation','create','payload',p_payload)::text,'sha256'),'hex');
 -- Same lock namespace as the existing tenant/key uniqueness; no dummy lock rows.
 perform pg_advisory_xact_lock(hashtextextended(c.tenant_id::text||':'||p_idempotency_key,0));
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.manage','create');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 select * into r from platform.building_setup_runs where tenant_id=c.tenant_id and idempotency_key=p_idempotency_key for update;
 existing:=found;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 if existing then
  if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
  if r.created_by<>c.actor_id or r.customer_workspace_id<>c.workspace_id or r.creation_request_hash<>v_hash
  then raise exception 'setup_attempt_conflict' using errcode='23505';end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
  return r.creation_receipt;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload->>'currency') is distinct from 'RON'
 or length(btrim(coalesce(p_payload#>>'{association,name}',''))) not between 2 and 160
 or length(btrim(coalesce(p_payload#>>'{building,name}',''))) not between 2 and 160
 or length(btrim(coalesce(p_payload#>>'{building,code}',''))) not between 1 and 40
 or coalesce(p_payload#>>'{building,floors}','') !~ '^[0-9]+$'
 or (p_payload#>>'{building,floors}')::integer not between 0 and 200
 or coalesce(p_payload->>'period_start','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or coalesce(p_payload->>'period_end','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or (p_payload->>'period_start')::date>(p_payload->>'period_end')::date
 then raise exception 'setup_invalid_payload' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('association','building','currency','period_start','period_end','units','opening_balances'))
 or exists(select 1 from jsonb_object_keys(p_payload->'association') k where k<>'name')
 or exists(select 1 from jsonb_object_keys(p_payload->'building') k where k not in ('name','code','floors'))
 then raise exception 'setup_invalid_payload' using errcode='22023';end if;
 perform app_private.validate_setup_units_v2(p_payload->'units');
 if jsonb_typeof(p_payload->'opening_balances') is distinct from 'array' then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 if jsonb_array_length(p_payload->'opening_balances')>500 or exists(select 1 from jsonb_array_elements(p_payload->'opening_balances') x
 where coalesce(x->>'side','') not in ('debit','credit') or jsonb_typeof(x->'account_code') is distinct from 'string' or length(btrim(x->>'account_code')) not between 1 and 40 or jsonb_typeof(x->'amount') is distinct from 'number'
 or (x->>'amount')::numeric<=0 or (x->>'amount')::numeric>1000000000)
 then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'opening_balances') e cross join lateral jsonb_object_keys(e) k where k not in ('account_code','side','amount')) then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 v_receipt:=jsonb_build_object('version',2,'run_id',v_id,'workspace_id',c.workspace_id,'revision',1,'status','draft','creation_request_hash',v_hash);
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 insert into platform.building_setup_runs(id,tenant_id,customer_workspace_id,idempotency_key,setup_payload,payload_hash,created_by,creation_request_hash,creation_receipt)
 values(v_id,c.tenant_id,c.workspace_id,p_idempotency_key,p_payload,encode(extensions.digest(p_payload::text,'sha256'),'hex'),c.actor_id,v_hash,v_receipt);
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 insert into platform.building_setup_command_coverage(run_id,tenant_id,workspace_id,creation_request_hash,epoch_id,from_expected_revision)
 values(v_id,c.tenant_id,c.workspace_id,v_hash,'building-g2-pm169-v1',1);
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 perform app_private.assert_building_setup_g2_followon_v1();
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'create',initial);
 return v_receipt;
end$$;
create function app_private.command_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,
 p_expected_revision integer,p_command_key text,p_action text,p_units jsonb default null,p_expected_payload_hash text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;v_hash text;v_receipt jsonb;v_d numeric;v_cr numeric;
 v_payload jsonb;v_status text;v_property uuid;v_building uuid;x jsonb; initial jsonb; e platform.building_setup_command_receipts%rowtype; before_record jsonb;
begin
 initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action);
 perform app_private.assert_building_setup_g2_followon_v1();
 if (p_action<>'update' and p_units is not null) or (p_action<>'approve' and p_expected_payload_hash is not null) then raise exception 'setup_invalid_command_input' using errcode='22023'; end if;
 if p_action not in ('update','rehearse','submit','approve','provision') or p_action is null then raise exception 'setup_invalid_action' using errcode='22023';end if;
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,
 case when p_action='approve' then 'onboarding.import.approve' else 'onboarding.import.manage' end,p_action);
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_expected_revision is null then raise exception 'setup_precondition_required' using errcode='22004';end if;
 if p_expected_revision<1 or p_command_key is null or length(p_command_key)>128
 or p_command_key not like 'setup-'||p_run_id::text||'-r'||p_expected_revision::text||'-%'
 or p_command_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'setup_invalid_command_key' using errcode='22023';end if;
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);

 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,case when p_action='approve' then 'onboarding.import.approve' else 'onboarding.import.manage' end,p_action);
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_action<>'approve' and r.created_by<>c.actor_id then raise exception 'setup_actor_denied' using errcode='42501';end if;
 if p_action='approve' and (r.created_by=c.actor_id or r.submitted_by=c.actor_id) then raise exception 'setup_dual_control_violation' using errcode='42501';end if;
 if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
 v_hash:=encode(extensions.digest(jsonb_build_object('actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'run',r.id,
 'operation',p_action,'expected_revision',p_expected_revision,'units',p_units,'expected_payload_hash',p_expected_payload_hash)::text,'sha256'),'hex');
 before_record:=jsonb_build_object('revision',r.revision,'status',r.status,'payload_hash',r.payload_hash);
 -- Exact immutable original proof precedes stale/state-specific rejection.
 select * into e from platform.building_setup_command_receipts where tenant_id=c.tenant_id and workspace_id=c.workspace_id and run_id=r.id and command_key=p_command_key;
 if found then
  if e.actor_id<>c.actor_id or e.context_id<>p_context_id or e.membership_id<>c.membership_id
   or e.operation<>p_action or e.expected_revision<>p_expected_revision or e.request_hash<>v_hash
   or e.input_descriptor is distinct from jsonb_build_object('units',p_units,'expected_payload_hash',p_expected_payload_hash)
   or e.epoch_id<>'building-g2-pm169-v1' then raise exception 'setup_revision_conflict' using errcode='40001'; end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  return e.receipt;
 end if;
 if r.last_command_key=p_command_key then
  if r.last_command_actor<>c.actor_id or r.last_command_hash<>v_hash then raise exception 'setup_attempt_conflict' using errcode='23505';end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  return r.last_command_receipt;
 end if;
 if r.revision<>p_expected_revision then raise exception 'setup_revision_conflict' using errcode='40001';end if;
 v_payload:=r.setup_payload;v_status:=r.status;v_property:=r.property_id;
 if p_action='update' then
  if r.status<>'draft' then raise exception 'setup_invalid_state' using errcode='22023';end if;
  perform app_private.validate_setup_units_v2(p_units);
  v_payload:=jsonb_set(r.setup_payload,'{units}',p_units);
 elsif p_action='rehearse' then
  if r.status not in ('draft','rehearsed') then raise exception 'setup_invalid_state' using errcode='22023';end if;
  select coalesce(sum((e->>'amount')::numeric) filter(where e->>'side'='debit'),0),coalesce(sum((e->>'amount')::numeric) filter(where e->>'side'='credit'),0)
  into v_d,v_cr from jsonb_array_elements(r.setup_payload->'opening_balances') e;
  if v_d<>v_cr then raise exception 'opening_balance_rehearsal_not_zero' using errcode='22023';end if;
  v_status:='rehearsed';
 elsif p_action='submit' then
  if r.status<>'rehearsed' or (r.rehearsal_result->>'balanced')::boolean is distinct from true then raise exception 'setup_rehearsal_required' using errcode='22023';end if;
  v_status:='submitted';
 elsif p_action='approve' then
  if r.status<>'submitted' then raise exception 'setup_invalid_state' using errcode='22023';end if;
  if p_expected_payload_hash is null then raise exception 'setup_precondition_required' using errcode='22004';end if;
  if r.submitted_revision is distinct from r.revision or r.submitted_payload_hash is distinct from r.payload_hash
   or p_expected_payload_hash is distinct from r.submitted_payload_hash
  then raise exception 'setup_snapshot_conflict' using errcode='40001';end if;
  v_status:='approved';
 elsif p_action='provision' then
  if r.status<>'approved' then raise exception 'setup_approval_required' using errcode='22023';end if;
  if r.approved_revision is distinct from r.revision or r.approved_submitted_revision is distinct from r.submitted_revision
   or r.approved_payload_hash is distinct from r.payload_hash or r.submitted_payload_hash is distinct from r.payload_hash
   or r.approved_by is null or r.approved_by=r.submitted_by
  then raise exception 'setup_snapshot_conflict' using errcode='40001';end if;
  -- Existing canonical binding trigger selects the creator's active membership.
  -- Refuse ambiguity rather than letting it choose another membership/Context.
  if (select count(*) from identity.memberships m where m.tenant_id=c.tenant_id and m.user_id=r.created_by
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()))<>1
   or not exists(select 1 from identity.memberships m where m.id=c.membership_id and m.user_id=r.created_by and m.tenant_id=c.tenant_id)
  then raise exception 'setup_operator_membership_review_required' using errcode='42501';end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  insert into portfolio.properties(tenant_id,type,name,base_currency,status)
  values(c.tenant_id,'condominium',r.setup_payload#>>'{association,name}','RON','active') returning id into v_property;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  insert into portfolio.buildings(tenant_id,property_id,code,name,floors,status)
  values(c.tenant_id,v_property,r.setup_payload#>>'{building,code}',r.setup_payload#>>'{building,name}',(r.setup_payload#>>'{building,floors}')::smallint,'active') returning id into v_building;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  for x in select value from jsonb_array_elements(r.setup_payload->'units') loop
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
   insert into portfolio.units(tenant_id,building_id,code,floor,area_m2,status)
   values(c.tenant_id,v_building,x->>'code',nullif(x->>'floor','')::smallint,nullif(x->>'area_m2','')::numeric,'active');
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  end loop;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
  insert into finance.accounting_periods(tenant_id,property_id,starts_on,ends_on,status)
  values(c.tenant_id,v_property,(r.setup_payload->>'period_start')::date,(r.setup_payload->>'period_end')::date,'open');
  v_status:='provisioned';
 end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 v_receipt:=jsonb_build_object('version',2,'run_id',r.id,'workspace_id',r.customer_workspace_id,'revision',r.revision+1,
 'status',v_status,'payload_hash',encode(extensions.digest(v_payload::text,'sha256'),'hex'),'expected_revision',p_expected_revision,
 'operation',p_action,'command_key',p_command_key,'property_id',v_property);
 insert into platform.building_setup_command_receipts(tenant_id,workspace_id,run_id,command_key,actor_id,context_id,membership_id,writer_session_id,
 operation,expected_revision,request_hash,input_descriptor,before_record,receipt,epoch_id)
 values(c.tenant_id,c.workspace_id,r.id,p_command_key,c.actor_id,p_context_id,c.membership_id,(initial->>'session_id')::uuid,
 p_action,p_expected_revision,v_hash,jsonb_build_object('units',p_units,'expected_payload_hash',p_expected_payload_hash),before_record,v_receipt,'building-g2-pm169-v1');
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 update platform.building_setup_runs set revision=r.revision+1,status=v_status,setup_payload=v_payload,
 payload_hash=encode(extensions.digest(v_payload::text,'sha256'),'hex'),property_id=v_property,updated_at=statement_timestamp(),
 rehearsal_result=case when p_action='rehearse' then jsonb_build_object('debits',v_d,'credits',v_cr,'difference',0,'balanced',true,'zero_writes',true,'unit_count',jsonb_array_length(v_payload->'units')) else r.rehearsal_result end,
 submitted_by=case when p_action='submit' then c.actor_id else r.submitted_by end,
 submitted_revision=case when p_action='submit' then r.revision+1 else r.submitted_revision end,
 submitted_payload_hash=case when p_action='submit' then r.payload_hash else r.submitted_payload_hash end,
 approved_by=case when p_action='approve' then c.actor_id else r.approved_by end,
 approved_revision=case when p_action='approve' then r.revision+1 else r.approved_revision end,
 approved_submitted_revision=case when p_action='approve' then r.submitted_revision else r.approved_submitted_revision end,
 approved_payload_hash=case when p_action='approve' then r.payload_hash else r.approved_payload_hash end
 where id=r.id returning * into r;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 v_receipt:=jsonb_build_object('version',2,'run_id',r.id,'workspace_id',r.customer_workspace_id,'revision',r.revision,
 'status',r.status,'payload_hash',r.payload_hash,'expected_revision',p_expected_revision,'operation',p_action,'command_key',p_command_key,'property_id',r.property_id);
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 update platform.building_setup_runs set last_command_key=p_command_key,last_command_hash=v_hash,
 last_command_actor=c.actor_id,last_command_receipt=v_receipt where id=r.id;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(c.tenant_id,c.actor_id,'CUSTOMER_OPERATOR','BUILDING_SETUP_'||upper(p_action),'building_setup_run',r.id,
 'Version-bound building setup operation',jsonb_build_object('workspace_id',r.customer_workspace_id,'revision',r.revision,'payload_hash',r.payload_hash));
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 perform app_private.assert_building_setup_g2_followon_v1();
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,p_action,initial);
 return v_receipt;
end$$;
create function app_private.bind_provisioned_building_workspace_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog as $$
declare v_membership identity.memberships%rowtype; v_binding uuid; v_grant uuid; proof platform.building_setup_command_receipts%rowtype; initial jsonb;
begin
 if new.status<>'provisioned' or old.status='provisioned' then return new; end if;
 select * into proof from platform.building_setup_command_receipts where run_id=new.id and expected_revision=new.revision-1
  and operation='provision' and actor_id=auth.uid();
 if not found or proof.tenant_id<>new.tenant_id or proof.workspace_id<>new.customer_workspace_id
  or (proof.receipt->>'property_id')::uuid is distinct from new.property_id or proof.actor_id<>new.created_by then
  raise exception 'setup_g2_provision_frame_required' using errcode='42501'; end if;
 initial:=jsonb_build_object('tenant_id',proof.tenant_id,'workspace_id',proof.workspace_id,'membership_id',proof.membership_id,
  'actor_id',proof.actor_id,'context_id',proof.context_id,'session_id',proof.writer_session_id);
 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);

 if new.property_id is null or not exists(
   select 1 from portfolio.properties p where p.id=new.property_id and p.tenant_id=new.tenant_id
 ) or not exists(
   select 1 from platform.customer_workspaces w where w.id=new.customer_workspace_id and w.tenant_id=new.tenant_id
 ) then raise exception 'setup_property_workspace_mismatch' using errcode='42501'; end if;

 select * into v_membership from identity.memberships m
 where m.id=proof.membership_id and m.tenant_id=new.tenant_id and m.user_id=new.created_by and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'setup_operator_membership_missing' using errcode='42501'; end if;

 if exists(select 1 from platform.workspace_property_bindings b
   where b.property_id=new.property_id and b.status='active' and b.valid_to is null
     and b.customer_workspace_id<>new.customer_workspace_id) then
   raise exception 'setup_property_bound_elsewhere' using errcode='42501';
 end if;
 select id into v_binding from platform.workspace_property_bindings
 where property_id=new.property_id and customer_workspace_id=new.customer_workspace_id
   and status='active' and valid_to is null;
 if v_binding is null then
 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);
   insert into platform.workspace_property_bindings
     (tenant_id,customer_workspace_id,property_id,binding_source,created_by)
   values(new.tenant_id,new.customer_workspace_id,new.property_id,'building_setup',new.created_by)
   returning id into v_binding;
 end if;

 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);
 select id into v_grant from identity.context_grants
 where membership_id=v_membership.id and tenant_id=new.tenant_id
   and scope_type='property' and property_id=new.property_id
   and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp());
 if v_grant is null then
 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);
   insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id,ends_at)
   values(v_membership.id,new.tenant_id,'property',new.property_id,v_membership.ends_at)
   returning id into v_grant;
 end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(new.tenant_id,auth.uid(),'CUSTOMER_OPERATOR','BUILDING_SETUP_PROPERTY_BOUND','building_setup_run',new.id,
   jsonb_build_object('property_id',new.property_id,'workspace_id',new.customer_workspace_id,
     'binding_id',v_binding,'operator_context_id',v_grant),
   'Atomic workspace and scoped operator context after approved building setup');
 perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);
 return new;
end $$;
create or replace function app_private.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_reviewer platform.pilot_setup_reviewers%rowtype;v_workspace platform.customer_workspaces%rowtype;v_rows jsonb:='[]';c record; initial jsonb;
begin
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 then raise exception 'verified_identity_required' using errcode='42501';end if;
 select * into v_reviewer from platform.pilot_setup_reviewers
 where (p_workspace_id is null or customer_workspace_id=p_workspace_id)
 and normalized_email=(select lower(btrim(email)) from auth.users where id=auth.uid())
 and status in ('prepared','active') and expires_at>statement_timestamp() order by expires_at desc limit 1;
 if not found then return '{}'::jsonb;end if;
 select * into v_workspace from platform.customer_workspaces where id=v_reviewer.customer_workspace_id;
 if v_reviewer.status='active' then
 initial:=app_private.require_building_setup_command_checkpoint_v1(v_reviewer.context_grant_id,v_workspace.id,'approve');
  select * into strict c from app_private.require_building_setup_authority_v2(v_reviewer.context_grant_id,v_workspace.id,'onboarding.import.approve','approve');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from v_workspace.id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'workspace_id',s.customer_workspace_id,'status',s.status,
    'building',s.setup_payload#>>'{building,name}','revision',s.revision,'payload_hash',s.payload_hash,
    'submitted_revision',s.submitted_revision,'submitted_payload_hash',s.submitted_payload_hash) order by s.created_at,s.id),'[]'::jsonb)
  into v_rows from platform.building_setup_runs s where s.tenant_id=c.tenant_id and s.customer_workspace_id=c.workspace_id
   and s.status='submitted' and s.creation_request_hash is not null and s.submitted_revision=s.revision
   and s.submitted_payload_hash=s.payload_hash and s.submitted_by<>c.actor_id;
 end if;
 if v_reviewer.status='active' then
 perform app_private.assert_building_setup_command_checkpoint_v1(v_reviewer.context_grant_id,v_workspace.id,'approve',initial);
 end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 return jsonb_build_object('status',v_reviewer.status,'context_id',v_reviewer.context_grant_id,
 'workspace_id',v_workspace.id,'expires_at',v_reviewer.expires_at,'runs',v_rows);
end$$;

create function customer_api.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null) returns jsonb language sql security invoker set search_path=pg_catalog as $reviewer$ select app_private.my_pilot_setup_reviewer_v1(p_workspace_id) $reviewer$;

create function app_private.get_building_setup_command_receipt_v1(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,
 p_command_key text,p_operation text,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $lookup$
declare initial jsonb; permission_tuple jsonb; r platform.building_setup_runs%rowtype;
 e platform.building_setup_command_receipts%rowtype; coverage platform.building_setup_command_coverage%rowtype;
 epoch platform.building_setup_command_receipt_epochs%rowtype; envelope jsonb; result jsonb; covered boolean:=false;
begin
 initial:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover');
 if p_operation not in('update','rehearse','submit','approve','provision') or p_operation is null
  or p_expected_revision is null or p_expected_revision not between 1 and 2147483646
  or p_command_key is null or p_command_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or p_command_key not like 'setup-'||p_run_id::text||'-r'||p_expected_revision::text||'-%' then
  raise exception 'setup_invalid_command_key' using errcode='22023'; end if;
 perform app_private.assert_building_setup_g2_followon_v1();
 select * into r from platform.building_setup_runs where id=p_run_id
  and tenant_id=(initial->>'tenant_id')::uuid and customer_workspace_id=p_workspace_id for share;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover',initial);
 -- No full-run reader/status exception is used for the minimal own-approval reader.
 if p_operation='approve' then
  permission_tuple:=app_private.require_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'approve');
  if permission_tuple is distinct from initial then raise exception 'setup_authority_contract_invalid' using errcode='42501'; end if;
 elsif r.created_by<>(initial->>'actor_id')::uuid then raise exception 'setup_actor_denied' using errcode='42501'; end if;
 select * into epoch from platform.building_setup_command_receipt_epochs where epoch_id='building-g2-pm169-v1';
 if not found or epoch.protocol<>1 or epoch.pruning_enabled or epoch.retention_policy_id is not null
  or epoch.source_contract_hash<>'a930dc948aabff3d2dba426f0de4e3886066ab1fb4a3a0d8aced058a46cb0a5d' then raise exception 'setup_g2_epoch_unavailable' using errcode='55000'; end if;
 select * into coverage from platform.building_setup_command_coverage where run_id=r.id;
 covered:=found and coverage.tenant_id=r.tenant_id and coverage.workspace_id=r.customer_workspace_id
  and coverage.creation_request_hash=r.creation_request_hash and coverage.epoch_id=epoch.epoch_id
  and coverage.from_expected_revision=1 and p_expected_revision>=coverage.from_expected_revision;
 envelope:=jsonb_build_object('version',1,'scope',initial-'session_id'||jsonb_build_object('run_id',r.id),
  'command',jsonb_build_object('command_key',p_command_key,'operation',p_operation,'expected_revision',p_expected_revision),
  'coverage',jsonb_build_object('status',case when covered then 'covered' else 'uncovered' end,
   'epoch_id',case when covered then epoch.epoch_id else null end,'from_expected_revision',case when covered then 1 else null end,'checked_at',clock_timestamp()),
  'retention',jsonb_build_object('status','activation_hold','policy_id',null));
 select * into e from platform.building_setup_command_receipts where tenant_id=r.tenant_id and workspace_id=r.customer_workspace_id
  and run_id=r.id and command_key=p_command_key and actor_id=(initial->>'actor_id')::uuid
  and context_id=p_context_id and membership_id=(initial->>'membership_id')::uuid;
 if found then
  if e.actor_id<>(initial->>'actor_id')::uuid or e.context_id<>p_context_id or e.membership_id<>(initial->>'membership_id')::uuid then
   raise exception 'setup_actor_denied' using errcode='42501'; end if;
  if e.operation<>p_operation or e.expected_revision<>p_expected_revision then
   result:=envelope||jsonb_build_object('outcome','conflict','reason','own_command_descriptor_mismatch');
  else
   if e.epoch_id<>epoch.epoch_id or e.request_hash is distinct from encode(extensions.digest(jsonb_build_object(
    'actor',e.actor_id,'tenant',e.tenant_id,'workspace',e.workspace_id,'run',e.run_id,'operation',e.operation,
    'expected_revision',e.expected_revision,'units',e.input_descriptor->'units',
    'expected_payload_hash',e.input_descriptor->'expected_payload_hash')::text,'sha256'),'hex') then
    raise exception 'setup_g2_evidence_binding_invalid' using errcode='55000'; end if;
   result:=envelope||jsonb_build_object('outcome','complete','evidence',jsonb_build_object(
    'request_hash',e.request_hash,'input_descriptor',e.input_descriptor,'before_record',e.before_record,
    'receipt',e.receipt,'epoch_id',e.epoch_id,'recorded_at',e.recorded_at));
  end if;
 elsif covered and r.revision=p_expected_revision and p_operation<>'approve' then result:=envelope||jsonb_build_object('outcome','absent');
 else result:=envelope||jsonb_build_object('outcome','unknown','reason',case when covered then 'coverage_gap' else 'legacy_uncovered' end); end if;
 perform app_private.assert_building_setup_g2_followon_v1();
 perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover',initial);
 if p_operation='approve' then perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'approve',initial); end if;
 return result;
end; $lookup$;
create function customer_api.get_building_setup_command_receipt_v1(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,
 p_command_key text,p_operation text,p_expected_revision integer)
returns jsonb language sql security invoker set search_path=pg_catalog as $gateway$
 select app_private.get_building_setup_command_receipt_v1(p_context_id,p_workspace_id,p_run_id,p_command_key,p_operation,p_expected_revision)
$gateway$;

-- G2.OC1: exact per-object ACLs closed in the same transaction.
revoke all privileges on function app_private.building_setup_command_evidence_valid_v1(jsonb,jsonb,jsonb,text,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.building_setup_command_evidence_valid_v1(jsonb,jsonb,jsonb,text,integer,uuid,uuid,text)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.building_setup_command_evidence_valid_v1(jsonb,jsonb,jsonb,text,integer,uuid,uuid,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.protect_building_setup_command_evidence_v1() from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.protect_building_setup_command_evidence_v1()'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.protect_building_setup_command_evidence_v1() from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.customer_mfa_required_at_v1(timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.customer_mfa_required_at_v1(timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.customer_mfa_required_at_v1(timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.require_request_session_current_at_v1(timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.require_request_session_current_at_v1(timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.require_building_setup_authority_at_v1(uuid,uuid,text,text,timestamptz) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.require_building_setup_authority_at_v1(uuid,uuid,text,text,timestamptz)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.require_building_setup_authority_at_v1(uuid,uuid,text,text,timestamptz) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.assert_building_setup_command_checkpoint_v1(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.assert_building_setup_command_checkpoint_v1(uuid,uuid,text,jsonb)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.assert_building_setup_command_checkpoint_v1(uuid,uuid,text,jsonb) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.assert_building_setup_g2_followon_v1() from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.assert_building_setup_g2_followon_v1()'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.assert_building_setup_g2_followon_v1() from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.create_building_setup_v2(uuid,uuid,text,jsonb) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.bind_provisioned_building_workspace_v1() from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.bind_provisioned_building_workspace_v1()'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.bind_provisioned_building_workspace_v1() from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.my_pilot_setup_reviewer_v1(uuid) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.my_pilot_setup_reviewer_v1(uuid)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.my_pilot_setup_reviewer_v1(uuid) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function customer_api.my_pilot_setup_reviewer_v1(uuid) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='customer_api.my_pilot_setup_reviewer_v1(uuid)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function customer_api.my_pilot_setup_reviewer_v1(uuid) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function app_private.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='app_private.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function app_private.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on function customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer) from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)'::regprocedure and a.grantee<>p.proowner loop
 execute 'revoke all privileges on function customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $oc1$;

revoke all privileges on table platform.building_setup_command_receipt_epochs from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='platform.building_setup_command_receipt_epochs'::regclass and a.grantee<>c.relowner loop
 execute 'revoke all privileges on table platform.building_setup_command_receipt_epochs from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop;
 for g in select x.attname,a.grantee,a.privilege_type from pg_attribute x, lateral aclexplode(x.attacl) a where x.attrelid='platform.building_setup_command_receipt_epochs'::regclass and a.grantee<>(select relowner from pg_class where oid=x.attrelid) loop
 execute format('revoke %s (%I) on table platform.building_setup_command_receipt_epochs from %s restrict',g.privilege_type,g.attname,case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end);
 end loop; end; $oc1$;

revoke all privileges on table platform.building_setup_command_coverage from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='platform.building_setup_command_coverage'::regclass and a.grantee<>c.relowner loop
 execute 'revoke all privileges on table platform.building_setup_command_coverage from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop;
 for g in select x.attname,a.grantee,a.privilege_type from pg_attribute x, lateral aclexplode(x.attacl) a where x.attrelid='platform.building_setup_command_coverage'::regclass and a.grantee<>(select relowner from pg_class where oid=x.attrelid) loop
 execute format('revoke %s (%I) on table platform.building_setup_command_coverage from %s restrict',g.privilege_type,g.attname,case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end);
 end loop; end; $oc1$;

revoke all privileges on table platform.building_setup_command_receipts from public,anon,authenticated,service_role;
do $oc1$ declare g record; begin
 for g in select distinct a.grantee from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid='platform.building_setup_command_receipts'::regclass and a.grantee<>c.relowner loop
 execute 'revoke all privileges on table platform.building_setup_command_receipts from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop;
 for g in select x.attname,a.grantee,a.privilege_type from pg_attribute x, lateral aclexplode(x.attacl) a where x.attrelid='platform.building_setup_command_receipts'::regclass and a.grantee<>(select relowner from pg_class where oid=x.attrelid) loop
 execute format('revoke %s (%I) on table platform.building_setup_command_receipts from %s restrict',g.privilege_type,g.attname,case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end);
 end loop; end; $oc1$;


-- SELECTED EFFECT B.F01
create function customer_api.create_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_building_setup_v2(p_context_id,p_workspace_id,p_idempotency_key,p_payload)$$;


-- SELECTED EFFECT B.OC1.F01
revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F02
create function customer_api.get_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_v2(p_context_id,p_workspace_id,p_run_id)$$;


-- SELECTED EFFECT B.OC1.F02
revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F14
create function customer_api.get_building_setup_attempt_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_attempt_v2(p_context_id,p_workspace_id,p_idempotency_key)$$;


-- SELECTED EFFECT B.OC1.F14
revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F55
create function app_private.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'rehearse',null,null)$$;


-- SELECTED EFFECT B.OC1.F55
revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F56
create function app_private.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'submit',null,null)$$;


-- SELECTED EFFECT B.OC1.F56
revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F57
create function app_private.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'approve',null,p_expected_payload_hash)$$;


-- SELECTED EFFECT B.OC1.F57
revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F58
create function app_private.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'provision',null,null)$$;


-- SELECTED EFFECT B.OC1.F58
revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F59
create function app_private.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'update',p_units,null)$$;


-- SELECTED EFFECT B.OC1.F59
revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F03
create function customer_api.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.rehearse_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- SELECTED EFFECT B.OC1.F03
revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F04
create function customer_api.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.submit_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- SELECTED EFFECT B.OC1.F04
revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F05
create function customer_api.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.approve_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_expected_payload_hash)$$;


-- SELECTED EFFECT B.OC1.F05
revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F06
create function customer_api.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.provision_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- SELECTED EFFECT B.OC1.F06
revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F07
create function customer_api.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.update_building_setup_units_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_units)$$;


-- SELECTED EFFECT B.OC1.F07
revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.G40
create trigger end_pilot_reviewers_with_basis after update of status on platform.workspace_access_bases
for each row execute function platform.end_pilot_reviewers_with_basis();


-- SELECTED EFFECT B.G41
create trigger bind_provisioned_building_workspace
after update of status on platform.building_setup_runs
for each row execute function app_private.bind_provisioned_building_workspace_v1();


-- SELECTED EFFECT B.G47
create trigger protect_setup_creation_v2 before update on platform.building_setup_runs
 for each row execute function app_private.protect_setup_creation_v2();


-- SELECTED EFFECT B.X28
create index building_setup_runs_workspace_idx on platform.building_setup_runs(customer_workspace_id,status,id);


-- SELECTED EFFECT B.X29
create index building_setup_runs_created_by_idx on platform.building_setup_runs(created_by);


-- SELECTED EFFECT B.X30
create index building_setup_runs_submitted_by_idx on platform.building_setup_runs(submitted_by) where submitted_by is not null;


-- SELECTED EFFECT B.X31
create index building_setup_runs_approved_by_idx on platform.building_setup_runs(approved_by) where approved_by is not null;


-- SELECTED EFFECT B.X63
create unique index pilot_setup_reviewers_open_email on platform.pilot_setup_reviewers(customer_workspace_id,normalized_email)
 where status in ('prepared','active');


-- SELECTED EFFECT B.SD61
do $catalog$
declare
 module_id pg_catalog.uuid;
 profile_id pg_catalog.uuid;
 model_id pg_catalog.uuid;
begin
 select id into profile_id from platform.property_profiles
 where code='residential_condominium' and version=1;
 select id into model_id from platform.operating_models
 where code='association_managed' and version=1;
 if profile_id is null or model_id is null or
   (select count(*) from identity.permissions where code in
    ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve'))<>3 then
   raise exception 'building_setup_catalog_prerequisite_missing';
 end if;
 if exists(select 1 from platform.module_definitions
   where code='building_setup' and (version<>1 or not is_active
    or lifecycle_status not in ('active','published') or not requires_aal2
    or entitlement_key is distinct from 'module.building_setup'
    or valid_from>statement_timestamp() or valid_to is not null)) then
   raise exception 'building_setup_module_definition_conflict';
 end if;
 insert into platform.module_definitions
  (code,version,name,labels_json,description,category,is_active,lifecycle_status,
   sensitivity_level,requires_aal2,entitlement_key,published_at)
 select 'building_setup',1,'Building setup',
  '{"ro":"Configurarea clădirii","en":"Building setup","fa":"راه‌اندازی ساختمان"}'::jsonb,
  'Bounded synthetic Romanian RON building setup authority; no Import or invitation activation',
  'core',true,'published','high_impact',true,'module.building_setup',statement_timestamp()
 where not exists(select 1 from platform.module_definitions where code='building_setup');
 select id into module_id from platform.module_definitions where code='building_setup' and version=1;

 -- No silent replacement of a conflicting binding or alternate module mapping.
 if exists(select 1 from platform.module_permission_bindings b
   join identity.permissions p on p.id=b.permission_id
   where (b.module_definition_id=module_id and
     (p.code not in ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
      or b.binding_version<>1 or b.lifecycle_status<>'active'
      or not b.is_assignable_to_local_role or not b.is_delegable or not b.requires_aal2
      or b.valid_from>statement_timestamp() or b.valid_to is not null
      or b.permission_mode is distinct from case p.code
        when 'onboarding.import.read' then 'read'
        when 'onboarding.import.manage' then 'manage' else 'execute' end))
    or (p.code in ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
      and b.module_definition_id<>module_id and b.lifecycle_status='active'
      and (b.valid_to is null or b.valid_to>statement_timestamp()))) then
   raise exception 'building_setup_module_binding_conflict';
 end if;
 insert into platform.module_permission_bindings
  (module_definition_id,permission_id,binding_version,permission_mode,
   is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
 select module_id,p.id,1,case p.code when 'onboarding.import.read' then 'read'
    when 'onboarding.import.manage' then 'manage' else 'execute' end,
  true,true,true,'active'
 from identity.permissions p where p.code in
  ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve')
 and not exists(select 1 from platform.module_permission_bindings b
   where b.module_definition_id=module_id and b.permission_id=p.id);

 if exists(select 1 from platform.module_property_profile_compatibilities
   where module_definition_id=module_id
   and (property_profile_id<>profile_id or compatibility_level<>'compatible'))
 or exists(select 1 from platform.module_operating_model_compatibilities
   where module_definition_id=module_id
   and (operating_model_id<>model_id or compatibility_level<>'compatible')) then
   raise exception 'building_setup_taxonomy_compatibility_conflict';
 end if;
 insert into platform.module_property_profile_compatibilities
  (module_definition_id,property_profile_id,compatibility_level,reason)
 select module_id,profile_id,'compatible','Coordinator approved residential condominium v1 only'
 where not exists(select 1 from platform.module_property_profile_compatibilities
   where module_definition_id=module_id and property_profile_id=profile_id);
 insert into platform.module_operating_model_compatibilities
  (module_definition_id,operating_model_id,compatibility_level,reason)
 select module_id,model_id,'compatible','Coordinator approved association managed v1 only'
 where not exists(select 1 from platform.module_operating_model_compatibilities
   where module_definition_id=module_id and operating_model_id=model_id);
end;
$catalog$;


-- SELECTED EFFECT B.OC1.FINAL.T26
revoke all privileges on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T26
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), update ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), references ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt") on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T26
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.building_setup_runs'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.building_setup_runs from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.building_setup_runs'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.building_setup_runs from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T18
revoke all privileges on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T18
revoke select ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), insert ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), update ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), references ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at") on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T18
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.pilot_setup_reviewers'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.pilot_setup_reviewers from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.pilot_setup_reviewers'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.pilot_setup_reviewers from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F46
revoke all privileges on function platform.end_pilot_reviewers_with_basis() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.end_pilot_reviewers_with_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.end_pilot_reviewers_with_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F78
revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F78
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.setup_record_v2(platform.building_setup_runs)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F71
revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F71
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F15
revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F54
revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F70
revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F70
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F01
revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F02
revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F14
revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F55
revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F56
revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F57
revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F58
revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F59
revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F03
revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F04
revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F05
revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F06
revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F07
revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RP1
create policy building_setup_runs_context_read on platform.building_setup_runs for select to authenticated using (app_private.can_read_building_setup_v2(tenant_id,customer_workspace_id));

-- OC1: inactive schemas/tables/sequences/functions remain closed before COMMIT.
-- Only the approved F64/F80 nested owner edges survive. No runtime/fixture grant.
do $oc1$
declare r record; s text; begin
 for s in select nspname from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all tables in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all sequences in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all functions in schema %I from public,anon,authenticated,service_role',s);
 end loop;
 for r in select n.nspname,t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on type %I.%I from public,anon,authenticated,service_role',r.nspname,r.typname);
 end loop;
 for r in select n.nspname,c.relname,a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and not a.attisdropped and a.attacl is not null and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke select (%I),insert (%I),update (%I),references (%I) on table %I.%I from public,anon,authenticated,service_role',r.attname,r.attname,r.attname,r.attname,r.nspname,r.relname);
 end loop;
 if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d) is distinct from current_setting('cladora.install.defaults')::jsonb then
  raise exception 'operations_default_acl_delta' using errcode='55000';end if;
 if (select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))) is distinct from current_setting('cladora.install.managed')::jsonb then
  raise exception 'operations_managed_catalog_delta' using errcode='55000';end if;
 -- Fail closed on unenumerated ACL rather than trusting role names or changing defaults.
 for r in select p.oid,p.proowner,a.grantee,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>p.proowner loop
  if not(r.nspname='app_private' and ((r.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and r.grantee='postgres'::regrole) or (r.oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure and r.grantee='cladora_rpc_owner'::regrole))) then
   raise exception 'operations_unexpected_routine_acl' using errcode='55000';end if;
 end loop;
 if exists(select 1 from pg_namespace n,lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>n.nspowner and not(n.nspname='app_private' and a.grantee='cladora_rpc_owner'::regrole and a.privilege_type='USAGE' and not a.is_grantable)) then
  raise exception 'operations_unexpected_schema_acl' using errcode='55000';end if;
 if exists(select 1 from pg_attribute x join pg_class c on c.oid=x.attrelid join pg_namespace n on n.oid=c.relnamespace,lateral aclexplode(x.attacl) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_column_acl' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace,lateral aclexplode(coalesce(t.typacl,acldefault('T',t.typowner))) a where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>t.typowner) then
  raise exception 'operations_unexpected_type_acl' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and not c.relrowsecurity) then
  raise exception 'operations_table_rls_not_enabled' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
  lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_relation_acl' using errcode='55000';end if;
end; $oc1$;
-- SOURCE CATALOG ASSERTIONS: literal declaration/body identities, not a compiled equivalence claim.
-- Caller/operator/transport binding remains separate; source alone grants no execution permission.
do $source_catalog$
begin
 if exists(
 with source(signature,body_hash,owner_name,secdef,language_name,volatility,is_strict,config,ordinal) as (values
('platform.end_pilot_reviewers_with_basis()','7886265f92a34bee2a38681d6c1827d4d73d9e9323363e7179c19f5142bd4c82','postgres',true,'plpgsql','v',false,array['search_path=""']::text[],0),
('app_private.protect_setup_creation_v2()','d92e7aa41f9af4c7cf5aa6e6d75419420bedf9bba415828a3a79436a4935babb','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],1),
('app_private.validate_setup_units_v2(jsonb)','8ee3fb0504296d15a7b30517e4c41fb93d75ddc2bbff6591d0cd1c6279817fa3','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],2),
('app_private.setup_record_v2(platform.building_setup_runs)','d5f2bda26c0a7c8c23d7aafd9ce4fc0556ca3e422959f46701224137acbbe45b','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],3),
('app_private.require_building_setup_authority_v2(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text,pg_catalog.text)','d0f275f59820fd35d76ed9e97d6bd0f9047922e5e11477189ddd81eaf76b5174','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],4),
('app_private.can_read_building_setup_v2(pg_catalog.uuid,pg_catalog.uuid)','042f41d2b29b2010c2df87b190b9bb860110b128c482801a08e58b960194f696','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],5),
('app_private.get_building_setup_v2(uuid,uuid,uuid)','8f9daa481d04f1f894634e634dc7a4b88d78463d6cbb4cbdde049f6a6fe51737','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],6),
('app_private.get_building_setup_attempt_v2(uuid,uuid,text)','b603650acf533154e379ea0f94f3978bb9f72f0ed0b0bd7296b3b28d4f969d2c','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],7),
('app_private.building_setup_command_evidence_valid_v1(jsonb,jsonb,jsonb,text,integer,uuid,uuid,text)','abc38595619bac75116d6880efc482c4601819024bd7577b5d918b3700b40098','postgres',false,'plpgsql','i',false,array['search_path=pg_catalog']::text[],8),
('app_private.protect_building_setup_command_evidence_v1()','97c23e8d4b98e8b3ed9332742a2f859c0384c28ebcefb6cf8cf0727e6173ba6d','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],9),
('app_private.customer_mfa_required_at_v1(timestamptz)','3e364543c4860bd9b55abd2e2df99d6351c552a1ccad0e65dfcafedda96c41db','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],10),
('app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)','5f60bb3c24d48a03c679bd7224696feb2c2f5040158b9d2e3333987954fe662e','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],11),
('app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)','01f6a216814ad9902a68e9c922574ccbb61c26b01db9a2e159d813cae035a886','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],12),
('app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)','8b50fb008031e95bd99d5660777c5868b90fee7e5e69c445bded6c7328676c38','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],13),
('app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz)','d7ecb5d5a38af056d65d015d8d9f570d49794acff36a964227bb938b3abd9b3f','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],14),
('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz)','ce7c3391383b32e7a30c464edfc34962020bd47cdf704e8ef534144ad6b5511f','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],15),
('app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz)','8489a85003cbb2e814c5eb749cc9ec13c31fea67a012d0239248792fe245a14c','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],16),
('app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz)','9e7df1887c7ce41f4e7de1b9b701a6e4b56ffff949a22b3c726ea274fa74489b','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],17),
('app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)','c24b1a4d049d3466d86d693f0d9a19ded0bdd85296384e17fc44fca0ff0b4d63','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],18),
('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz)','18bed745a9685ed0c9389f6c657df6f711eef525efce87b29808efc26c1d11d7','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],19),
('app_private.require_request_session_current_at_v1(timestamptz)','12d502678ce3eb760a064c4d8af3a01f1330580a3944048a7d87733f1a7aaa7c','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],20),
('app_private.require_building_setup_authority_at_v1(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text,pg_catalog.text,pg_catalog.timestamptz)','19d18d1a6d8f929ad962f9a60939954e6f4c9185c065ad5d37fff8a4f2d61c69','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],21),
('app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text)','d61b9d70f9b91deffb986adf61e10504c7390c0b0905f3094fab808c2c702367','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],22),
('app_private.assert_building_setup_command_checkpoint_v1(uuid,uuid,text,jsonb)','cf6755d98e23b773934fb4c3bf7105d928d6c2ca39bd353f81174fb846c3d434','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],23),
('app_private.assert_building_setup_g2_followon_v1()','ed2aa768b59e0baef258bbabd0de31df01c8f20296cc8c9882968964296fbe23','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],24),
('app_private.create_building_setup_v2(uuid,uuid,text,jsonb)','ff2d0c2caed84508dcecabefe16a3a9141a397b13120e7efc237fcdb3d27c49b','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],25),
('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)','3a4c594673dfca87c79163ae726b1c879d51e0d6ecfce5a32ac9fa6d5d3e72d1','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],26),
('app_private.bind_provisioned_building_workspace_v1()','747ad7549957002c0b056f5a8306114c8c72427bef4e8b9bec514048d56d28f2','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],27),
('app_private.my_pilot_setup_reviewer_v1(uuid)','e54f3780fb2bf6faa2746c9a8e64b3345a5dadf98761265604080fb8c1c82e63','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],28),
('customer_api.my_pilot_setup_reviewer_v1(uuid)','e4da87d719179a0e7e79d6f9206006fee2aa7edfde178c65468b696fa9c259ee','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],29),
('app_private.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)','f1219556effe83b8a93ab7cf2d1714189af08a3556a9e01ae78c5b2b1dc6da35','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],30),
('customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)','44e12be56ef7f5e2e4d308a80f45c8a209785bc8f67d1ed3231b83d344fc6eaa','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],31),
('customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)','ba003550435b4b0c2504a3db0949ddad377650950995bf6a396340675bd53aa1','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],32),
('customer_api.get_building_setup_v2(uuid,uuid,uuid)','804132caafcee0fa04bda303f22a0ee90701f440cdadc3728f2da83624c50ac3','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],33),
('customer_api.get_building_setup_attempt_v2(uuid,uuid,text)','759bbaaf2f93e41ee05c15d0eea1c03a2106f4ed736267ec08d6a24b23a07375','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],34),
('app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','a5aebd99d438a35066e6e7cdf33cbb9a3858c3c4eba1c149a3c74a4950a38188','postgres',true,'sql','v',false,array['search_path=pg_catalog']::text[],35),
('app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','447247d79a004f14c0fcbb858d937ee6a35f276f76a644d0ea787ea05ee1f9c1','postgres',true,'sql','v',false,array['search_path=pg_catalog']::text[],36),
('app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','e9711c960dd9b8554359c4abbaa82c8c30eadc2f70ac5915b126b464427a6bc3','postgres',true,'sql','v',false,array['search_path=pg_catalog']::text[],37),
('app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','53b944a450a0fd408d60b4ae87b60728a5b0dc14e78c173377c5af659b36c4d3','postgres',true,'sql','v',false,array['search_path=pg_catalog']::text[],38),
('app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)','242f4b687ac715f6d3e8e533f88f4caf3a186d01d81fcc104919d60c4c0eb7ef','postgres',true,'sql','v',false,array['search_path=pg_catalog']::text[],39),
('customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','3b0627c8b24ead1e4b071bdff355bb126d668057a75936855c8b39ad7e3ba473','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],40),
('customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','60cbb0537c220b091e3db5130be2343aba6a135f3208f1d8b6d55f751e189014','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],41),
('customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','475e08f434a2ac3e6842e1d56838c575b2166840376eae452e7160be6bd83fa0','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],42),
('customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','60dfb042ee6d6f0057e18538fa3a1c79288735698dee369650920ad56674eb12','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],43),
('customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)','987bd0aa578825959e8231b30a2e3517ace9537072a5e818ff1f22a5302831a8','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],44)), expected as (
 select distinct on(to_regprocedure(signature)) * from source order by to_regprocedure(signature),ordinal desc
 ) select 1 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) left join pg_language l on l.oid=p.prolang
 where p.oid is null or p.prokind<>'f' or p.proowner<>to_regrole(e.owner_name) or p.prosecdef is distinct from e.secdef
 or p.provolatile::text is distinct from e.volatility or p.proisstrict is distinct from e.is_strict
 or l.lanname is distinct from e.language_name or p.proconfig is distinct from e.config
 or encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') is distinct from e.body_hash) then
 raise exception 'operations_routine_catalog_identity_mismatch' using errcode='55000';end if;
 if to_regclass('platform.building_setup_command_coverage') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.building_setup_command_receipt_epochs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.building_setup_command_receipts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.building_setup_runs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.pilot_setup_reviewers') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_property_bindings') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and p.oid not in (select to_regprocedure(x) from unnest(array['app_private.require_building_session_current_v1()','app_private.set_updated_at()','finance.protect_accounting_period()','finance.assert_accounting_period_no_overlap()','finance.assert_accounting_period_property_tenant()','app_private.guard_taxonomy_version_effective_period_v1()','app_private.guard_taxonomy_record_immutability_v1()','app_private.guard_workspace_taxonomy_assignment_history_v1()','app_private.guard_workspace_property_binding_history_v1()','app_private.guard_workspace_property_binding_v1()','app_private.guard_workspace_taxonomy_assignment_v1()','app_private.bootstrap_role_taxonomy_permissions_v1()','app_private.bootstrap_role_module_permissions_v1()','app_private.guard_module_definition_immutability_v1()','app_private.guard_module_definition_effective_period_v1()','app_private.guard_workspace_module_code_sync_v1()','app_private.guard_workspace_module_immutability_v1()','app_private.bootstrap_role_workspace_role_permissions_v1()','app_private.guard_module_permission_binding_invariants_v1()','app_private.guard_workspace_role_immutability_v1()','app_private.guard_workspace_role_module_draft_only_v1()','app_private.guard_workspace_role_permission_bindings_v1()','app_private.guard_workspace_member_role_invariants_v1()','app_private.bootstrap_role_workspace_delegation_permissions_v1()','platform.cap_customer_membership_to_access_basis()','platform.cap_customer_context_to_membership()','platform.require_workspace_access_basis_for_provisioning()','app_private.guard_undefined_primary_role_v1()','app_private.guard_workspace_role_authority_source_immutable_v1()','app_private.guard_authority_revision_v1()','app_private.bump_canonical_authority_revision_v1()','app_private.guard_jurisdiction_bound_property_address_v1()','app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)','platform.assert_workspace_activation_ready(uuid)','app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)','app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.customer_mfa_required()','platform.enforce_workspace_activation_gate()','app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])','app_private.guard_workspace_member_role_authority_v2()','app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)','app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.jwt_uuid(text)','app_private.active_tenant_id()','app_private.active_context_id()','app_private.is_service_role()','app_private.is_active_member(uuid)','app_private.active_membership_id()','app_private.can_access_property(uuid)','app_private.can_access_building(uuid)','app_private.can_access_unit(uuid)','app_private.can_access_utility_scope(uuid,uuid,uuid)','utilities.protect_validated_reading()','app_private.can_access_asset_scope(uuid,uuid,uuid)','maintenance.enforce_work_order_transition()','maintenance.protect_purchase_order()','documents.protect_document_version()','app_private.check_direct_effective_permission_v1(uuid,uuid,text,text,text,uuid)','app_private.check_effective_permission_v1(uuid,text,text,text,uuid)','finance.assert_allocation_balanced(uuid)','finance.protect_allocation_run()','billing.protect_issued_invoice()','governance.protect_closed_vote()','governance.protect_vote_option()','app_private.current_platform_user_id()','app_private.has_platform_role(platform.platform_role_type)','app_private.is_platform_user()','app_private.has_platform_access_for_routing()','customer_api.has_platform_access_v1()','platform.my_customer_mfa_requirement()','platform.list_my_customer_contexts()','platform.get_customer_dashboard(uuid)','customer_api.get_dashboard_v1(uuid)','customer_api.list_contexts_v1()','customer_api.my_mfa_requirement_v1()','app_private.can_access_channel(uuid)','communications.enforce_poll_response()','customer_api.list_my_unit_invitations_v1()','app_private.has_multi_unit_owner_role_v1()','customer_api.my_multi_unit_owner_access_v1()','assets.enforce_asset_domain_integrity()','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','customer_api.list_assets_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','customer_api.get_asset_detail_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','customer_api.create_asset_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','customer_api.update_asset_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','customer_api.transition_asset_lifecycle_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','customer_api.update_asset_operational_status_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','customer_api.start_asset_downtime_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamptz,text)','customer_api.end_asset_downtime_v1(uuid,uuid,timestamptz,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','customer_api.list_asset_inspections_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','customer_api.record_asset_inspection_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','customer_api.verify_asset_inspection_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','customer_api.get_asset_warranty_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','customer_api.upsert_asset_warranty_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','customer_api.list_warranty_claims_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','customer_api.create_warranty_claim_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','customer_api.resolve_warranty_claim_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','customer_api.list_compliance_policies_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','customer_api.configure_compliance_policy_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','customer_api.request_asset_decommission_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','customer_api.approve_asset_decommission_v1(uuid,uuid,boolean,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','customer_api.get_asset_registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamp with time zone)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamp with time zone,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamp with time zone,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','maintenance.enforce_customer_maintenance_integrity()','maintenance.enforce_work_order_transition_guards()','maintenance.verify_customer_maintenance_actor(uuid,text,boolean)','maintenance.create_maintenance_request(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','maintenance.triage_maintenance_request(uuid,uuid,text,text,text)','maintenance.assign_maintenance_request(uuid,uuid,uuid,text)','maintenance.change_maintenance_status(uuid,uuid,text,text,text)','maintenance.reopen_maintenance_request(uuid,uuid,text)','maintenance.create_rfq(uuid,uuid,uuid,text,text,date,uuid[])','maintenance.submit_quote(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','maintenance.select_quote(uuid,uuid,text)','maintenance.create_work_order(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','maintenance.approve_work_order(uuid,uuid,numeric,text)','maintenance.issue_work_order(uuid,uuid,uuid)','maintenance.start_work_order(uuid,uuid,text)','maintenance.hold_work_order(uuid,uuid,text)','maintenance.complete_work_order(uuid,uuid,text,numeric)','maintenance.verify_work_order(uuid,uuid,text)','maintenance.close_work_order(uuid,uuid,text)','maintenance.create_purchase_order(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','maintenance.approve_purchase_order(uuid,uuid,text)','maintenance.issue_purchase_order(uuid,uuid)','maintenance.create_maintenance_payable(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','customer_api.create_maintenance_request_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','customer_api.triage_maintenance_request_v1(uuid,uuid,text,text,text)','customer_api.assign_maintenance_request_v1(uuid,uuid,uuid,text)','customer_api.change_maintenance_status_v1(uuid,uuid,text,text,text)','customer_api.reopen_maintenance_request_v1(uuid,uuid,text)','customer_api.create_rfq_v1(uuid,uuid,uuid,text,text,date,uuid[])','customer_api.submit_quote_v1(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','customer_api.select_quote_v1(uuid,uuid,text)','customer_api.create_work_order_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','customer_api.approve_work_order_v1(uuid,uuid,numeric,text)','customer_api.issue_work_order_v1(uuid,uuid,uuid)','customer_api.start_work_order_v1(uuid,uuid,text)','customer_api.hold_work_order_v1(uuid,uuid,text)','customer_api.complete_work_order_v1(uuid,uuid,text,numeric)','customer_api.verify_work_order_v1(uuid,uuid,text)','customer_api.close_work_order_v1(uuid,uuid,text)','customer_api.create_purchase_order_v1(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','customer_api.approve_purchase_order_v1(uuid,uuid,text)','customer_api.issue_purchase_order_v1(uuid,uuid)','customer_api.create_maintenance_payable_v1(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','customer_api.list_maintenance_requests_v1(uuid,text,int,int)','customer_api.list_work_orders_v1(uuid,text,int,int)','customer_api.get_maintenance_summary_v1(uuid)','maintenance.calendar_due_v1(date,text,integer,integer)','maintenance.plan_asset_allowed_v1(uuid,uuid,text)','maintenance.list_calendar_plans_v1(uuid)','maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','maintenance.generate_calendar_order_v1(uuid,uuid,date)','customer_api.list_calendar_plans_v1(uuid)','customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','customer_api.generate_calendar_order_v1(uuid,uuid,date)','maintenance.list_calendar_plans_v1(uuid)','maintenance.contractor_actor_v1(uuid,text)','maintenance.list_contractors_v1(uuid)','maintenance.register_contractor_v1(uuid,uuid,text,text)','maintenance.approve_contractor_v1(uuid,uuid,text)','customer_api.list_contractors_v1(uuid)','customer_api.register_contractor_v1(uuid,uuid,text,text)','customer_api.approve_contractor_v1(uuid,uuid,text)','maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)','customer_api.work_order_checklist_v1(uuid,uuid,uuid,text)','maintenance.assert_work_order_authority_v1(uuid,uuid,text)','maintenance.approve_work_order(uuid,uuid,numeric,text)','maintenance.issue_work_order(uuid,uuid,uuid)','maintenance.start_work_order(uuid,uuid,text)','maintenance.hold_work_order(uuid,uuid,text)','maintenance.complete_work_order(uuid,uuid,text,numeric)','maintenance.verify_work_order(uuid,uuid,text)','maintenance.close_work_order(uuid,uuid,text)','maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid)','maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer)','customer_api.list_maintenance_requests_v1(uuid,text,int,int)','customer_api.list_work_orders_v1(uuid,text,int,int)','customer_api.get_maintenance_summary_v1(uuid)','maintenance.get_customer_maintenance(uuid,text,text,text,text,date,date,integer,integer,uuid)','maintenance.customer_maintenance_scope_matches(text,uuid,uuid,uuid,uuid,uuid,uuid)','finance.assert_scope_date_not_in_closed_period(uuid,uuid,date)','app_private.operations_checkpoint_v1(uuid,jsonb)','app_private.operations_command_v1(text,uuid,uuid,text,text)','customer_api.operations_command_v1(text,uuid,uuid,text,text)','app_private.guard_operations_unresolved_v1()','platform.end_pilot_reviewers_with_basis()','app_private.protect_setup_creation_v2()','app_private.validate_setup_units_v2(jsonb)','app_private.setup_record_v2(platform.building_setup_runs)','app_private.require_building_setup_authority_v2(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text,pg_catalog.text)','app_private.can_read_building_setup_v2(pg_catalog.uuid,pg_catalog.uuid)','app_private.get_building_setup_v2(uuid,uuid,uuid)','app_private.get_building_setup_attempt_v2(uuid,uuid,text)','app_private.building_setup_command_evidence_valid_v1(jsonb,jsonb,jsonb,text,integer,uuid,uuid,text)','app_private.protect_building_setup_command_evidence_v1()','app_private.customer_mfa_required_at_v1(timestamptz)','app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)','app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)','app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)','app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz)','app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz)','app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz)','app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz)','app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)','app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz)','app_private.require_request_session_current_at_v1(timestamptz)','app_private.require_building_setup_authority_at_v1(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text,pg_catalog.text,pg_catalog.timestamptz)','app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text)','app_private.assert_building_setup_command_checkpoint_v1(uuid,uuid,text,jsonb)','app_private.assert_building_setup_g2_followon_v1()','app_private.create_building_setup_v2(uuid,uuid,text,jsonb)','app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)','app_private.bind_provisioned_building_workspace_v1()','app_private.my_pilot_setup_reviewer_v1(uuid)','customer_api.my_pilot_setup_reviewer_v1(uuid)','app_private.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)','customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)','customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)','customer_api.get_building_setup_v2(uuid,uuid,uuid)','customer_api.get_building_setup_attempt_v2(uuid,uuid,text)','app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)','customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)']) x where to_regprocedure(x) is not null)) then raise exception 'operations_unexpected_routine_effect' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and c.relkind in ('r','p') and c.oid not in (select to_regclass(x) from unnest(array['app_private.canonical_authority_revision_v1','assets.asset_categories','assets.asset_components','assets.asset_decommission_requests','assets.asset_documents','assets.asset_downtimes','assets.asset_history','assets.asset_inspections','assets.asset_warranties','assets.asset_warranty_claims','assets.assets','assets.compliance_policies','audit.events','billing.invoice_lines','billing.invoices','billing.receivables','communications.channel_members','communications.channels','communications.comments','communications.notification_preferences','communications.notifications','communications.poll_options','communications.poll_responses','communications.polls','communications.posts','communications.reactions','communications.unit_invitations','documents.access_events','documents.document_links','documents.document_versions','documents.documents','documents.folders','documents.legal_records','documents.retention_policies','finance.accounting_periods','finance.accounts','finance.allocation_inputs','finance.allocation_items','finance.allocation_rules','finance.allocation_runs','finance.charge_categories','finance.journal_entries','finance.journals','governance.agenda_items','governance.attendance','governance.ballots','governance.eligibility_snapshots','governance.meetings','governance.minutes','governance.resolutions','governance.vote_options','governance.votes','identity.context_grants','identity.membership_parties','identity.memberships','identity.permissions','identity.profiles','identity.role_permissions','identity.roles','maintenance.approval_records','maintenance.attachments','maintenance.maintenance_plans','maintenance.plan_occurrences','maintenance.purchase_orders','maintenance.rfqs','maintenance.sla_measurements','maintenance.ticket_status_history','maintenance.ticket_work_orders','maintenance.tickets','maintenance.vendor_contracts','maintenance.vendor_payables','maintenance.vendor_quotes','maintenance.vendors','maintenance.work_order_assignments','maintenance.work_order_checklist_items','maintenance.work_order_costs','maintenance.work_order_events','maintenance.work_orders','occupancy.leases','payments.bank_accounts','payments.bank_transactions','payments.import_batches','payments.payments','payments.reconciliation_matches','platform.building_setup_command_coverage','platform.building_setup_command_receipt_epochs','platform.building_setup_command_receipts','platform.building_setup_runs','platform.customer_workspaces','platform.idempotency_keys','platform.jurisdiction_profiles','platform.module_definitions','platform.module_operating_model_compatibilities','platform.module_permission_bindings','platform.module_property_profile_compatibilities','platform.operating_models','platform.outbox_events','platform.pilot_setup_reviewers','platform.platform_role_assignments','platform.platform_users','platform.property_jurisdiction_assignments','platform.property_operating_model_compatibilities','platform.property_profiles','platform.property_space_kind_compatibilities','platform.space_kinds','platform.subscription_plans','platform.tenants','platform.workspace_access_bases','platform.workspace_contracts','platform.workspace_delegation_permissions','platform.workspace_delegations','platform.workspace_entitlements','platform.workspace_member_role_authority_sources','platform.workspace_member_roles','platform.workspace_modules','platform.workspace_property_bindings','platform.workspace_role_handover_lineage','platform.workspace_role_idempotency','platform.workspace_role_modules','platform.workspace_role_permissions','platform.workspace_roles','platform.workspace_taxonomy_assignments','portfolio.addresses','portfolio.buildings','portfolio.entrances','portfolio.ownerships','portfolio.parties','portfolio.properties','portfolio.units','security_access.access_points','utilities.consumption_periods','utilities.meter_readings','utilities.meters']) x where to_regclass(x) is not null)) then raise exception 'operations_unexpected_table_effect' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and t.typtype='e' and t.oid not in (select to_regtype(x) from unnest(array['assets.asset_condition','assets.asset_scope','billing.invoice_status','communications.channel_scope','communications.post_status','documents.classification','finance.account_type','finance.accounting_period_status','finance.allocation_method','finance.entry_side','finance.journal_status','finance.run_status','governance.meeting_status','governance.vote_status','identity.membership_status','identity.scope_type','maintenance.plan_trigger','maintenance.priority','maintenance.procurement_status','maintenance.ticket_status','maintenance.vendor_status','maintenance.work_order_status','payments.match_status','payments.payment_status','payments.transaction_direction','platform.decision_effect','platform.jurisdiction_profile_status','platform.platform_role_type','platform.property_jurisdiction_assignment_status','platform.record_status','platform.workspace_environment','platform.workspace_lifecycle_status','platform.workspace_type','portfolio.party_type','portfolio.property_type','portfolio.unit_status','security_access.access_point_type','utilities.meter_scope','utilities.reading_method','utilities.reading_status','utilities.service_type']) x where to_regtype(x) is not null)) then raise exception 'operations_unexpected_enum_effect' using errcode='55000';end if;
end; $source_catalog$;

-- Full poststate receipt is observable before commit, but does not by itself prove COMMIT.
select set_config('cladora.install.catalog_after',(with recursive
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
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
do $managed_complete$
declare before_catalog jsonb:=current_setting('cladora.install.managed_complete')::jsonb; after_catalog jsonb; tr jsonb;
begin
 after_catalog:=(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
);
 if before_catalog-'triggers' is distinct from after_catalog-'triggers' then raise exception 'operations_managed_complete_delta' using errcode='55000';end if;
 for tr in select value from jsonb_array_elements(before_catalog->'triggers') loop
  if not (after_catalog->'triggers') @> jsonb_build_array(tr) then raise exception 'operations_managed_trigger_changed' using errcode='55000';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(after_catalog->'triggers') t where not (before_catalog->'triggers') @> jsonb_build_array(t.value)
 and not exists(select 1 from pg_trigger x join pg_constraint f on f.oid=x.tgconstraint join pg_class r on r.oid=f.conrelid join pg_namespace n on n.oid=r.relnamespace
 where x.oid=(t.value->>'oid')::oid and x.tgisinternal and x.tgrelid='auth.users'::regclass and f.contype='f' and f.confrelid='auth.users'::regclass
 and f.confkey=array[(select attnum from pg_attribute where attrelid='auth.users'::regclass and attname='id')]::smallint[] and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications'))) then
 raise exception 'operations_unmapped_managed_trigger' using errcode='55000';end if;
end; $managed_complete$;
select jsonb_build_object('unit',current_setting('cladora.install.unit'),'transaction_id',pg_current_xact_id()::text,
 'source_contract','operations-inactive-install.v1','prestate_sha256',current_setting('cladora.install.prestate_sha256'),
 'poststate_sha256',encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_after'),'UTF8'),'sha256'),'hex'),
 'poststate',current_setting('cladora.install.catalog_after')::jsonb,'commit_acknowledged',false,'runtime_active',false) as operations_install_precommit_receipt;

commit;
-- A successful response is an acknowledgement of this unit only, never product acceptance.
