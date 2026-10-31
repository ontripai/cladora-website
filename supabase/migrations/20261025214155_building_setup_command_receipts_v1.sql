-- Building G2 inactive source; PM169/170. NOT an install/apply runner.

-- COMPOSED EFFECT G2.GUARD
-- PM169 source-only; no candidate can authorize its own compiled/role/custody proof.
begin;
set local search_path=pg_catalog,pg_temp;
do $g2_inactive$
declare compiled_expected jsonb:=null; role_reference jsonb:=null; custody_reference jsonb:=null; quiescence_reference jsonb:=null;
begin
 raise exception 'building_g2_inactive_source_only' using errcode='55000';
 if compiled_expected is null or role_reference is null or custody_reference is null or quiescence_reference is null then
  raise exception 'building_g2_independent_prestate_required' using errcode='55000'; end if;
end; $g2_inactive$;


-- COMPOSED EFFECT B.PRECONDITIONS
do $pre$
begin
 if current_user<>'postgres' or session_user<>'postgres' or current_setting('server_version_num')::integer not between 170000 and 179999
  or not exists(select 1 from pg_roles where rolname='postgres' and not rolsuper and rolcreaterole)
  or not has_database_privilege(current_database(),'CREATE') then
  raise exception 'building_slice_installer_or_pg17_mismatch'; end if;
 if exists(select 1 from pg_namespace where nspname=any(array['app_private','platform','identity','portfolio','audit','finance','customer_api'])) then
  raise exception 'building_slice_fresh_empty_required'; end if;
 if exists(select 1 from pg_roles where rolname in ('cladora_rpc_owner','cladora_building_fixture_ops')) then
  raise exception 'building_slice_fresh_role_graph_required'; end if;
 if not exists(select 1 from pg_extension where extname='pgcrypto' and extversion='1.3' and extnamespace='extensions'::regnamespace)
  or not exists(select 1 from pg_extension where extname='btree_gist' and extversion='1.7' and extnamespace='extensions'::regnamespace) then
  raise exception 'building_slice_reviewed_extension_prerequisite'; end if;
 if not has_schema_privilege('postgres','auth','USAGE') or not has_column_privilege('postgres','auth.users','id','REFERENCES') then
  raise exception 'building_slice_preserved_fk_prerequisite'; end if;
 if to_regclass('auth.sessions') is null then raise exception 'building_slice_session_schema_prerequisite'; end if;
 if not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='id' and atttypid='uuid'::regtype and not attisdropped)
  or not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='user_id' and atttypid='uuid'::regtype and not attisdropped)
  or not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='not_after' and atttypid='timestamptz'::regtype and not attisdropped)
  or not has_column_privilege('postgres','auth.sessions','id','SELECT')
  or not has_column_privilege('postgres','auth.sessions','user_id','SELECT')
  or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') then
  raise exception 'building_slice_session_read_prerequisite'; end if;
end;
$pre$;


-- COMPOSED EFFECT B.ND0.BEFORE
select set_config('cladora.slice.default_acl_before',
 coalesce((select jsonb_agg(to_jsonb(d) order by d.oid)::text from pg_default_acl d),'[]'),true);


-- COMPOSED EFFECT B.PROTECTED.BEFORE
select set_config('cladora.slice.protected_before',
 (select jsonb_build_object(
 'functions',(select coalesce(jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prosrc) order by p.oid),'[]') from pg_proc p),
 'relations',(select coalesce(jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid),'[]') from pg_class c where c.relnamespace in (select oid from pg_namespace where nspname in ('auth','extensions','public'))),
 'types',(select coalesce(jsonb_agg(jsonb_build_array(t.oid,t.typowner,t.typacl) order by t.oid),'[]') from pg_type t where t.typnamespace in (select oid from pg_namespace where nspname in ('auth','extensions','public'))),
 'namespaces',(select coalesce(jsonb_agg(jsonb_build_array(n.oid,n.nspowner,n.nspacl) order by n.oid),'[]') from pg_namespace n where n.nspname in ('auth','extensions','public'))
 )::text),true);


-- COMPOSED EFFECT B.UNIVERSE.BEFORE
select set_config('cladora.slice.universe_before',
 jsonb_build_object('relations',(select coalesce(jsonb_agg(oid order by oid),'[]') from pg_class),
 'functions',(select coalesce(jsonb_agg(oid order by oid),'[]') from pg_proc),
 'types',(select coalesce(jsonb_agg(oid order by oid),'[]') from pg_type),
 'namespaces',(select coalesce(jsonb_agg(oid order by oid),'[]') from pg_namespace))::text,true);


-- COMPOSED EFFECT B.SM1
create schema app_private authorization postgres;


-- COMPOSED EFFECT B.OC1.SM1
revoke all privileges on schema app_private from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='app_private') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema app_private from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM2
create schema platform authorization postgres;


-- COMPOSED EFFECT B.OC1.SM2
revoke all privileges on schema platform from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='platform') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema platform from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM3
create schema identity authorization postgres;


-- COMPOSED EFFECT B.OC1.SM3
revoke all privileges on schema identity from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM3
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='identity') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema identity from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM4
create schema portfolio authorization postgres;


-- COMPOSED EFFECT B.OC1.SM4
revoke all privileges on schema portfolio from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM4
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='portfolio') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema portfolio from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM5
create schema audit authorization postgres;


-- COMPOSED EFFECT B.OC1.SM5
revoke all privileges on schema audit from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM5
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='audit') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema audit from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM6
create schema finance authorization postgres;


-- COMPOSED EFFECT B.OC1.SM6
revoke all privileges on schema finance from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM6
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='finance') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema finance from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.SM7
create schema customer_api authorization postgres;


-- COMPOSED EFFECT B.OC1.SM7
revoke all privileges on schema customer_api from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SM7
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='customer_api') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema customer_api from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.ROLE1
create role cladora_rpc_owner nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;


-- COMPOSED EFFECT B.T04
create table identity.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  resource text not null,
  action text not null,
  description text,
  unique (resource, action)
);


-- COMPOSED EFFECT B.OC1.T04
revoke all privileges on table identity.permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T04
revoke select ("id","code","resource","action","description"), insert ("id","code","resource","action","description"), update ("id","code","resource","action","description"), references ("id","code","resource","action","description") on table identity.permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T04
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T04
alter table identity.permissions enable row level security;


-- COMPOSED EFFECT B.T13
create type identity.scope_type as enum ('tenant','property','building','unit');


-- COMPOSED EFFECT B.OC1.T13
revoke all privileges on type identity.scope_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T13
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.scope_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.scope_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T15
create table platform.module_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{2,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null check (labels_json ? 'ro' and labels_json ? 'en' and labels_json ? 'fa'),
  description text not null,
  category text not null check (category in ('core', 'financial', 'operations', 'governance', 'security', 'occupancy', 'services', 'investment')),
  is_active boolean not null default true,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('draft', 'active', 'published', 'deprecated', 'retired', 'catalog_only')),
  sensitivity_level text not null default 'standard' check (sensitivity_level in ('standard', 'sensitive', 'high_impact')),
  requires_aal2 boolean not null default false,
  entitlement_key text,
  config_schema jsonb not null default '{"type":"object","additionalProperties":false}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (lifecycle_status = 'catalog_only' and entitlement_key is null)
    or
    (lifecycle_status <> 'catalog_only' and entitlement_key is not null and entitlement_key ~ '^module\.[a-z0-9_]{2,64}$')
  ),
  unique (code, version)
);


-- COMPOSED EFFECT B.OC1.T15
revoke all privileges on table platform.module_definitions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T15
revoke select ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), update ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), references ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at") on table platform.module_definitions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T15
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_definitions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_definitions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_definitions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_definitions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T15
alter table platform.module_definitions enable row level security;


-- COMPOSED EFFECT B.T25
create table app_private.canonical_authority_revision_v1 (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision between 1 and 9007199254740991)
);


-- COMPOSED EFFECT B.OC1.T25
revoke all privileges on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T25
revoke select ("singleton","revision"), insert ("singleton","revision"), update ("singleton","revision"), references ("singleton","revision") on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T25
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='app_private.canonical_authority_revision_v1'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table app_private.canonical_authority_revision_v1 from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='app_private.canonical_authority_revision_v1'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table app_private.canonical_authority_revision_v1 from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T25
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- COMPOSED EFFECT B.T38
create table identity.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'ro' check (locale in ('ro','en','fa')),
  timezone text not null default 'Europe/Bucharest',
  phone_encrypted text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);


-- COMPOSED EFFECT B.OC1.T38
revoke all privileges on table identity.profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T38
revoke select ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), insert ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), update ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), references ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at") on table identity.profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T38
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T38
alter table identity.profiles enable row level security;


-- COMPOSED EFFECT B.T42
create type platform.decision_effect as enum ('allow','deny');


-- COMPOSED EFFECT B.OC1.T42
revoke all privileges on type platform.decision_effect from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.decision_effect'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.decision_effect from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T43
create type platform.record_status as enum ('draft','active','suspended','archived');


-- COMPOSED EFFECT B.OC1.T43
revoke all privileges on type platform.record_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.record_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.record_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T44
create type platform.workspace_type as enum ('ASSOCIATION', 'PROPERTY_MANAGER', 'OWNER_PORTFOLIO', 'HYBRID');


-- COMPOSED EFFECT B.OC1.T44
revoke all privileges on type platform.workspace_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T45
create type platform.workspace_lifecycle_status as enum (
  'LEAD',
  'UNDER_REVIEW',
  'APPROVED',
  'CONTRACT_PENDING',
  'PAYMENT_PENDING',
  'PROVISIONING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED'
);


-- COMPOSED EFFECT B.OC1.T45
revoke all privileges on type platform.workspace_lifecycle_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_lifecycle_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_lifecycle_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T46
create type platform.workspace_environment as enum ('PILOT', 'PRODUCTION');


-- COMPOSED EFFECT B.OC1.T46
revoke all privileges on type platform.workspace_environment from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_environment'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_environment from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T47
create type portfolio.property_type as enum ('condominium','residential_complex','villa','gated_community','mixed_residential');


-- COMPOSED EFFECT B.OC1.T47
revoke all privileges on type portfolio.property_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T47
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.property_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.property_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T49
create type identity.membership_status as enum ('invited','active','suspended','expired','revoked');


-- COMPOSED EFFECT B.OC1.T49
revoke all privileges on type identity.membership_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.membership_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.membership_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T52
create type portfolio.unit_status as enum ('active','inactive','combined','archived');


-- COMPOSED EFFECT B.OC1.T52
revoke all privileges on type portfolio.unit_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.unit_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.unit_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T53
create type finance.accounting_period_status as enum ('open','closed');


-- COMPOSED EFFECT B.OC1.T53
revoke all privileges on type finance.accounting_period_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.accounting_period_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.accounting_period_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T54
create type finance.journal_status as enum ('draft','posted','reversed');


-- COMPOSED EFFECT B.OC1.T54
revoke all privileges on type finance.journal_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.journal_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.journal_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T57
create type finance.entry_side as enum ('debit','credit');


-- COMPOSED EFFECT B.OC1.T57
revoke all privileges on type finance.entry_side from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.entry_side'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.entry_side from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T59
create table platform.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null,
  version integer not null default 1 check (version > 0),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'deprecated', 'retired')),
  feature_catalogue jsonb not null default '[]'::jsonb,
  limit_schema jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default statement_timestamp(),
  effective_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (plan_code, version)
);


-- COMPOSED EFFECT B.OC1.T59
revoke all privileges on table platform.subscription_plans from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T59
revoke select ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), insert ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), update ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), references ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at") on table platform.subscription_plans from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T59
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.subscription_plans'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.subscription_plans from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.subscription_plans'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.subscription_plans from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T59
alter table platform.subscription_plans enable row level security;


-- COMPOSED EFFECT B.T60
create type finance.account_type as enum ('asset','liability','equity','income','expense');


-- COMPOSED EFFECT B.OC1.T60
revoke all privileges on type finance.account_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.account_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.account_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T61
create type portfolio.party_type as enum ('person','company','association','public_body');


-- COMPOSED EFFECT B.OC1.T61
revoke all privileges on type portfolio.party_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T61
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.party_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.party_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T63
create type platform.property_jurisdiction_assignment_status as enum
  ('draft','active','superseded','archived');


-- COMPOSED EFFECT B.OC1.T63
revoke all privileges on type platform.property_jurisdiction_assignment_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T63
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.property_jurisdiction_assignment_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.property_jurisdiction_assignment_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T66
create type platform.jurisdiction_profile_status as enum
  ('draft','validated','active','suspended','retired');


-- COMPOSED EFFECT B.OC1.T66
revoke all privileges on type platform.jurisdiction_profile_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.T66
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.jurisdiction_profile_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.jurisdiction_profile_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.T01
create table platform.tenants (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  registration_number text,
  status platform.record_status not null default 'draft',
  default_locale text not null default 'ro' check (default_locale in ('ro','en','fa')),
  timezone text not null default 'Europe/Bucharest',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  unique (registration_number)
);


-- COMPOSED EFFECT B.OC1.T01
revoke all privileges on table platform.tenants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T01
revoke select ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), insert ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), update ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), references ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at") on table platform.tenants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T01
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.tenants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.tenants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.tenants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.tenants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T01
alter table platform.tenants enable row level security;


-- COMPOSED EFFECT B.T09
create table platform.property_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- COMPOSED EFFECT B.OC1.T09
revoke all privileges on table platform.property_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T09
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.property_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T09
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T09
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T09
alter table platform.property_profiles enable row level security;


-- COMPOSED EFFECT B.T10
create table platform.operating_models (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- COMPOSED EFFECT B.OC1.T10
revoke all privileges on table platform.operating_models from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T10
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.operating_models from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T10
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.operating_models'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.operating_models from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T10
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.operating_models'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.operating_models from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T10
alter table platform.operating_models enable row level security;


-- COMPOSED EFFECT B.T19
create table platform.space_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- COMPOSED EFFECT B.OC1.T19
revoke all privileges on table platform.space_kinds from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T19
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.space_kinds from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T19
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.space_kinds'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.space_kinds from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.space_kinds'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.space_kinds from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T19
alter table platform.space_kinds enable row level security;


-- COMPOSED EFFECT B.T22
create table platform.module_permission_bindings (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  binding_version integer not null default 1 check (binding_version >= 1),
  permission_mode text not null default 'read' check (permission_mode in ('read', 'manage', 'execute', 'admin')),
  is_assignable_to_local_role boolean not null default true,
  is_delegable boolean not null default false, -- Strictly false in 001B.1
  requires_aal2 boolean not null default false,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'deprecated', 'retired')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (module_definition_id, permission_id, binding_version)
);


-- COMPOSED EFFECT B.OC1.T22
revoke all privileges on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T22
revoke select ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), insert ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), update ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), references ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at") on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T22
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_permission_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_permission_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_permission_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_permission_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T22
alter table platform.module_permission_bindings enable row level security;


-- COMPOSED EFFECT B.T62
create table platform.jurisdiction_profiles(
  id uuid primary key default gen_random_uuid(),
  code text not null check(code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  version integer not null check(version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  name text not null check(nullif(btrim(name),'') is not null),
  default_currency_code char(3) not null
    check(default_currency_code::text ~ '^[A-Z]{3}$'),
  default_timezone text not null check(length(default_timezone) between 1 and 80),
  calendar_code text not null check(calendar_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.jurisdiction_profile_status not null default 'draft',
  valid_from date not null,
  valid_to date check(valid_to is null or valid_to>valid_from),
  legal_signoff_reference text,
  legal_signed_at timestamptz,
  accounting_signoff_reference text,
  accounting_signed_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(code,version),
  check((legal_signoff_reference is null)=(legal_signed_at is null)),
  check((accounting_signoff_reference is null)=(accounting_signed_at is null))
);


-- COMPOSED EFFECT B.OC1.T62
revoke all privileges on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T62
revoke select ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), insert ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), update ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), references ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at") on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T62
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.jurisdiction_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.jurisdiction_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.jurisdiction_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.jurisdiction_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T62
alter table platform.jurisdiction_profiles enable row level security;


-- COMPOSED EFFECT B.T02
create table identity.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references platform.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, code)
);


-- COMPOSED EFFECT B.OC1.T02
revoke all privileges on table identity.roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T02
revoke select ("id","tenant_id","code","name","is_system","created_at"), insert ("id","tenant_id","code","name","is_system","created_at"), update ("id","tenant_id","code","name","is_system","created_at"), references ("id","tenant_id","code","name","is_system","created_at") on table identity.roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T02
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T02
alter table identity.roles enable row level security;


-- COMPOSED EFFECT B.T05
create table platform.customer_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_type platform.workspace_type not null,
  lifecycle_status platform.workspace_lifecycle_status not null default 'LEAD',
  commercial_owner text not null,
  environment platform.workspace_environment not null default 'PILOT',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  archived_at timestamptz
);


-- COMPOSED EFFECT B.OC1.T05
revoke all privileges on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T05
revoke select ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), insert ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), update ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), references ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at") on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T05
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.customer_workspaces'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.customer_workspaces from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.customer_workspaces'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.customer_workspaces from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T05
alter table platform.customer_workspaces enable row level security;


-- COMPOSED EFFECT B.T20
create table platform.property_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, operating_model_id, rule_version)
);


-- COMPOSED EFFECT B.OC1.T20
revoke all privileges on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T20
revoke select ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T20
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T20
alter table platform.property_operating_model_compatibilities enable row level security;


-- COMPOSED EFFECT B.T21
create table platform.property_space_kind_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  space_kind_id uuid not null references platform.space_kinds(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, space_kind_id, rule_version)
);


-- COMPOSED EFFECT B.OC1.T21
revoke all privileges on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T21
revoke select ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T21
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_space_kind_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_space_kind_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_space_kind_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_space_kind_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T21
alter table platform.property_space_kind_compatibilities enable row level security;


-- COMPOSED EFFECT B.T23
create table platform.module_property_profile_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  property_profile_id uuid not null references platform.property_profiles(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module profile compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, property_profile_id)
);


-- COMPOSED EFFECT B.OC1.T23
revoke all privileges on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T23
revoke select ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at") on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T23
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_property_profile_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_property_profile_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_property_profile_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_property_profile_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T23
alter table platform.module_property_profile_compatibilities enable row level security;


-- COMPOSED EFFECT B.T24
create table platform.module_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  operating_model_id uuid not null references platform.operating_models(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module operating model compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, operating_model_id)
);


-- COMPOSED EFFECT B.OC1.T24
revoke all privileges on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T24
revoke select ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at") on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T24
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T24
alter table platform.module_operating_model_compatibilities enable row level security;


-- COMPOSED EFFECT B.T32
create table audit.events (
  id bigint generated always as identity primary key, tenant_id uuid references platform.tenants(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict, actor_role text, action text not null, entity_type text not null, entity_id uuid,
  request_id uuid, before_snapshot jsonb, after_snapshot jsonb, reason text, occurred_at timestamptz not null default statement_timestamp()
);


-- COMPOSED EFFECT B.OC1.T32
revoke all privileges on table audit.events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T32
revoke select ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), insert ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), update ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), references ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at") on table audit.events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T32
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='audit.events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table audit.events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table audit.events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T32
alter table audit.events enable row level security;


-- COMPOSED EFFECT B.T33
create table platform.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  event_type text not null,
  payload jsonb not null,
  trace_id uuid,
  occurred_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  publish_attempts integer not null default 0 check (publish_attempts >= 0),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type)
);


-- COMPOSED EFFECT B.OC1.T33
revoke all privileges on table platform.outbox_events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T33
revoke select ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), insert ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), update ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), references ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts") on table platform.outbox_events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T33
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.outbox_events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.outbox_events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.outbox_events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.outbox_events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T33
alter table platform.outbox_events enable row level security;


-- COMPOSED EFFECT B.T48
create table portfolio.addresses (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  country_code char(2) not null default 'RO', county text, city text not null, street text not null,
  building_no text, postal_code text, latitude numeric(9,6), longitude numeric(9,6), created_at timestamptz not null default statement_timestamp()
);


-- COMPOSED EFFECT B.OC1.T48
revoke all privileges on table portfolio.addresses from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T48
revoke select ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), insert ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), update ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), references ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at") on table portfolio.addresses from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T48
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.addresses'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.addresses from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.addresses'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.addresses from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T48
alter table portfolio.addresses enable row level security;


-- COMPOSED EFFECT B.T56
create table portfolio.parties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  type portfolio.party_type not null, legal_name text not null, tax_ref_encrypted text, email_encrypted text, phone_encrypted text,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), archived_at timestamptz
);


-- COMPOSED EFFECT B.OC1.T56
revoke all privileges on table portfolio.parties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T56
revoke select ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), insert ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), update ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), references ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at") on table portfolio.parties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T56
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.parties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.parties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.parties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.parties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T56
alter table portfolio.parties enable row level security;


-- COMPOSED EFFECT B.T03
create table identity.role_permissions (
  role_id uuid not null references identity.roles(id) on delete cascade,
  permission_id uuid not null references identity.permissions(id) on delete cascade,
  effect platform.decision_effect not null default 'allow',
  primary key (role_id, permission_id)
);


-- COMPOSED EFFECT B.OC1.T03
revoke all privileges on table identity.role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T03
revoke select ("role_id","permission_id","effect"), insert ("role_id","permission_id","effect"), update ("role_id","permission_id","effect"), references ("role_id","permission_id","effect") on table identity.role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T03
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T03
alter table identity.role_permissions enable row level security;


-- COMPOSED EFFECT B.T06
create table portfolio.properties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  type portfolio.property_type not null, name text not null, address_id uuid references portfolio.addresses(id) on delete restrict,
  base_currency char(3) not null default 'RON', status platform.record_status not null default 'draft', created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);


-- COMPOSED EFFECT B.OC1.T06
revoke all privileges on table portfolio.properties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T06
revoke select ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), insert ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), update ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), references ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at") on table portfolio.properties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T06
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.properties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.properties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.properties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.properties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T06
alter table portfolio.properties enable row level security;


-- COMPOSED EFFECT B.T08
create table platform.workspace_taxonomy_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from)
);


-- COMPOSED EFFECT B.OC1.T08
revoke all privileges on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T08
revoke select ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at") on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T08
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_taxonomy_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_taxonomy_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T08
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_taxonomy_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_taxonomy_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T08
alter table platform.workspace_taxonomy_assignments enable row level security;


-- COMPOSED EFFECT B.T11
create table identity.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references identity.roles(id) on delete restrict,
  status identity.membership_status not null default 'invited',
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or ends_at > starts_at)
);


-- COMPOSED EFFECT B.OC1.T11
revoke all privileges on table identity.memberships from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T11
revoke select ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), insert ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), update ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), references ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at") on table identity.memberships from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T11
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.memberships'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.memberships from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T11
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.memberships'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.memberships from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T11
alter table identity.memberships enable row level security;


-- COMPOSED EFFECT B.T14
create table platform.workspace_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  module_code text not null,
  status text not null check (status in ('active', 'deactivated', 'superseded')),
  config_json jsonb not null default '{}'::jsonb check (config_json = '{}'::jsonb and octet_length(config_json::text) <= 16384),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  activated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  deactivated_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  check ((valid_to is null and status = 'active') or (valid_to is not null and status in ('deactivated', 'superseded')))
);


-- COMPOSED EFFECT B.OC1.T14
revoke all privileges on table platform.workspace_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T14
revoke select ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at") on table platform.workspace_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T14
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T14
alter table platform.workspace_modules enable row level security;


-- COMPOSED EFFECT B.T37
create table platform.workspace_role_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  action text not null,
  request_hash text not null,
  request_hash_version integer not null default 1,
  result_entity_id uuid not null,
  response_snapshot jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);


-- COMPOSED EFFECT B.OC1.T37
revoke all privileges on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T37
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at") on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T37
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_idempotency'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_idempotency from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_idempotency'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_idempotency from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T37
alter table platform.workspace_role_idempotency enable row level security;


-- COMPOSED EFFECT B.T39
create table platform.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{3,50}$'),
  role_version integer not null default 1 check (role_version >= 1),
  lock_version integer not null default 1 check (lock_version >= 1),
  name text not null check (length(trim(name)) >= 2),
  description text check (description is null or length(trim(description)) >= 5),
  base_role_id uuid references identity.roles(id) on delete restrict,
  scope_ceiling text not null default 'workspace' check (scope_ceiling in ('workspace', 'property', 'building', 'unit')),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'published', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (customer_workspace_id, code, role_version)
);


-- COMPOSED EFFECT B.OC1.T39
revoke all privileges on table platform.workspace_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T39
revoke select ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), insert ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), update ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), references ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at") on table platform.workspace_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T39
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T39
alter table platform.workspace_roles enable row level security;


-- COMPOSED EFFECT B.T50
create table platform.workspace_contracts (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete cascade,
  plan_id uuid references platform.subscription_plans(id) on delete restrict,
  contract_ref text not null,
  version integer not null default 1 check (version > 0),
  currency text not null default 'EUR' check (currency in ('EUR', 'RON', 'USD')),
  status text not null default 'draft' check (status in ('draft', 'pending_signature', 'signed', 'active', 'suspended', 'expired', 'terminated', 'superseded')),
  start_date date not null,
  end_date date,
  signed_at timestamptz,
  activated_at timestamptz,
  commercial_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique (contract_ref, version)
);


-- COMPOSED EFFECT B.OC1.T50
revoke all privileges on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T50
revoke select ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), insert ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), update ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), references ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at") on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T50
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_contracts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_contracts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_contracts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_contracts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T50
alter table platform.workspace_contracts enable row level security;


-- COMPOSED EFFECT B.T07
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


-- COMPOSED EFFECT B.OC1.T07
revoke all privileges on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T07
revoke select ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at") on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T07
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_property_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_property_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_property_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_property_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T07
alter table platform.workspace_property_bindings enable row level security;


-- COMPOSED EFFECT B.T12
create table identity.context_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references identity.memberships(id) on delete cascade,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  scope_type identity.scope_type not null,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (scope_type='tenant' and property_id is null and building_id is null and unit_id is null) or
    (scope_type='property' and property_id is not null and building_id is null and unit_id is null) or
    (scope_type='building' and building_id is not null and unit_id is null) or
    (scope_type='unit' and unit_id is not null)
  )
);


-- COMPOSED EFFECT B.OC1.T12
revoke all privileges on table identity.context_grants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T12
revoke select ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), insert ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), update ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), references ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at") on table identity.context_grants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T12
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.context_grants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.context_grants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T12
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.context_grants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.context_grants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T12
alter table identity.context_grants enable row level security;


-- COMPOSED EFFECT B.T16
create table platform.workspace_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete cascade,
  contract_id uuid references platform.workspace_contracts(id) on delete set null,
  entitlement_key text not null,
  value_type text not null check (value_type in ('numeric', 'boolean', 'string', 'array', 'json')),
  numeric_value numeric,
  boolean_value boolean,
  text_value text,
  json_value jsonb,
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  override_value_json jsonb,
  override_reason text,
  override_expires_at timestamptz,
  override_approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (customer_workspace_id, entitlement_key)
);


-- COMPOSED EFFECT B.OC1.T16
revoke all privileges on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T16
revoke select ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), insert ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), update ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), references ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at") on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T16
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_entitlements'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_entitlements from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T16
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_entitlements'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_entitlements from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T16
alter table platform.workspace_entitlements enable row level security;


-- COMPOSED EFFECT B.T26
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


-- COMPOSED EFFECT B.OC1.T26
revoke all privileges on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T26
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at") on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T26
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.building_setup_runs'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.building_setup_runs from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.building_setup_runs'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.building_setup_runs from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T26
alter table platform.building_setup_runs enable row level security;


-- COMPOSED EFFECT B.T27
create table portfolio.buildings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, code text not null, name text not null,
  year_built smallint, floors smallint check (floors is null or floors>=0), status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), unique(property_id,code)
);


-- COMPOSED EFFECT B.OC1.T27
revoke all privileges on table portfolio.buildings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T27
revoke select ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), insert ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), update ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), references ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at") on table portfolio.buildings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T27
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.buildings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.buildings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.buildings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.buildings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T27
alter table portfolio.buildings enable row level security;


-- COMPOSED EFFECT B.T29
create table finance.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  status finance.accounting_period_status not null default 'open',
  closed_at timestamptz,
  snapshot_json jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id,property_id,starts_on,ends_on),
  check (ends_on>=starts_on),
  check ((status='open' and closed_at is null and snapshot_json is null) or
    (status='closed' and closed_at is not null and snapshot_json is not null))
);


-- COMPOSED EFFECT B.OC1.T29
revoke all privileges on table finance.accounting_periods from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T29
revoke select ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), insert ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), update ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), references ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at") on table finance.accounting_periods from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T29
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounting_periods'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounting_periods from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounting_periods'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounting_periods from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T29
alter table finance.accounting_periods enable row level security;


-- COMPOSED EFFECT B.T30
create table finance.journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  journal_no bigint generated always as identity,
  occurred_on date not null,
  currency char(3) not null,
  description text not null,
  source_type text not null,
  source_id uuid,
  status finance.journal_status not null default 'draft',
  reversal_of_id uuid references finance.journals(id) on delete restrict,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, journal_no),
  check ((status='draft' and posted_at is null) or (status<>'draft' and posted_at is not null)),
  check (reversal_of_id is null or status='reversed')
);


-- COMPOSED EFFECT B.OC1.T30
revoke all privileges on table finance.journals from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T30
revoke select ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), insert ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), update ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), references ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at") on table finance.journals from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T30
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journals'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journals from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journals from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T30
alter table finance.journals enable row level security;


-- COMPOSED EFFECT B.T40
create table platform.workspace_role_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, module_definition_id)
);


-- COMPOSED EFFECT B.OC1.T40
revoke all privileges on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T40
revoke select ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), insert ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), update ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), references ("id","tenant_id","workspace_role_id","module_definition_id","created_at") on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T40
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T40
alter table platform.workspace_role_modules enable row level security;


-- COMPOSED EFFECT B.T41
create table platform.workspace_role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  effect platform.decision_effect not null default 'allow',
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, permission_id)
);


-- COMPOSED EFFECT B.OC1.T41
revoke all privileges on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T41
revoke select ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), insert ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), update ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), references ("id","tenant_id","workspace_role_id","permission_id","effect","created_at") on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T41
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T41
alter table platform.workspace_role_permissions enable row level security;


-- COMPOSED EFFECT B.T55
create table finance.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  code text not null,
  name text not null,
  type finance.account_type not null,
  currency char(3) not null default 'RON',
  parent_account_id uuid references finance.accounts(id) on delete restrict,
  is_control_account boolean not null default false,
  status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, property_id, code)
);


-- COMPOSED EFFECT B.OC1.T55
revoke all privileges on table finance.accounts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T55
revoke select ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), insert ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), update ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), references ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at") on table finance.accounts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T55
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T55
alter table finance.accounts enable row level security;


-- COMPOSED EFFECT B.T58
create table platform.property_jurisdiction_assignments(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null
    references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  jurisdiction_profile_id uuid not null
    references platform.jurisdiction_profiles(id) on delete restrict,
  assignment_version integer not null check(assignment_version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  profile_manifest_sha256 text not null
    check(profile_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.property_jurisdiction_assignment_status not null default 'draft',
  binding_source text not null check(binding_source in
    ('onboarding_verified','platform_verified','migration_verified')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check(valid_to is null or valid_to>valid_from),
  reason text not null check(nullif(btrim(reason),'') is not null),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(property_id,assignment_version)
);


-- COMPOSED EFFECT B.OC1.T58
revoke all privileges on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T58
revoke select ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at") on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T58
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_jurisdiction_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_jurisdiction_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_jurisdiction_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_jurisdiction_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T58
alter table platform.property_jurisdiction_assignments enable row level security;


-- COMPOSED EFFECT B.T17
create table platform.workspace_access_bases (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  normalized_email text not null,
  role_id uuid not null references identity.roles(id) on delete restrict,
  mode text not null check (mode in ('PILOT','PAID')),
  status text not null default 'prepared' check (status in ('prepared','active','revoked')),
  duration_hours integer,
  contract_id uuid references platform.workspace_contracts(id) on delete restrict,
  payment_reference text,
  payment_amount numeric(20,4),
  payment_currency text,
  paid_on date,
  paid_through date,
  evidence_note text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  expires_at timestamptz,
  membership_id uuid references identity.memberships(id) on delete restrict,
  context_grant_id uuid references identity.context_grants(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoke_reason text,
  check (normalized_email = lower(btrim(normalized_email)) and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (
    (mode = 'PILOT' and duration_hours in (24,48,72) and contract_id is null
      and payment_reference is null and payment_amount is null and payment_currency is null
      and paid_on is null and paid_through is null)
    or
    (mode = 'PAID' and duration_hours is null and contract_id is not null
      and length(btrim(payment_reference)) >= 3 and payment_amount > 0
      and payment_currency in ('EUR','RON','USD') and paid_on is not null and paid_through is not null)
  ),
  check (
    (status = 'prepared' and activated_at is null and expires_at is null
      and membership_id is null and context_grant_id is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and expires_at > activated_at
      and membership_id is not null and context_grant_id is not null and revoked_at is null)
    or (status = 'revoked' and (revoked_by is not null or revoke_reason='Contract is no longer active') and revoked_at is not null
      and length(btrim(revoke_reason)) >= 3)
  )
);


-- COMPOSED EFFECT B.OC1.T17
revoke all privileges on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T17
revoke select ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), insert ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), update ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), references ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason") on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T17
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_access_bases'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_access_bases from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T17
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_access_bases'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_access_bases from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T17
alter table platform.workspace_access_bases enable row level security;


-- COMPOSED EFFECT B.T18
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


-- COMPOSED EFFECT B.OC1.T18
revoke all privileges on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T18
revoke select ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), insert ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), update ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), references ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at") on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T18
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.pilot_setup_reviewers'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.pilot_setup_reviewers from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.pilot_setup_reviewers'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.pilot_setup_reviewers from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T18
alter table platform.pilot_setup_reviewers enable row level security;


-- COMPOSED EFFECT B.T51
create table portfolio.entrances (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  building_id uuid not null references portfolio.buildings(id) on delete restrict, code text not null, name text, created_at timestamptz not null default statement_timestamp(), unique(building_id,code)
);


-- COMPOSED EFFECT B.OC1.T51
revoke all privileges on table portfolio.entrances from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T51
revoke select ("id","tenant_id","building_id","code","name","created_at"), insert ("id","tenant_id","building_id","code","name","created_at"), update ("id","tenant_id","building_id","code","name","created_at"), references ("id","tenant_id","building_id","code","name","created_at") on table portfolio.entrances from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T51
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.entrances'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.entrances from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.entrances'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.entrances from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T51
alter table portfolio.entrances enable row level security;


-- COMPOSED EFFECT B.T28
create table portfolio.units (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  building_id uuid not null references portfolio.buildings(id) on delete restrict, entrance_id uuid references portfolio.entrances(id) on delete restrict,
  code text not null, floor smallint, area_m2 numeric(12,3) check(area_m2 is null or area_m2>0), bedrooms smallint check(bedrooms is null or bedrooms>=0),
  status portfolio.unit_status not null default 'active', created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), unique(building_id,code)
);


-- COMPOSED EFFECT B.OC1.T28
revoke all privileges on table portfolio.units from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T28
revoke select ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), insert ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), update ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), references ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at") on table portfolio.units from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T28
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.units'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.units from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.units'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.units from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T28
alter table portfolio.units enable row level security;


-- COMPOSED EFFECT B.T31
create table finance.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  journal_id uuid not null references finance.journals(id) on delete restrict,
  account_id uuid not null references finance.accounts(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  party_id uuid references portfolio.parties(id) on delete restrict,
  side finance.entry_side not null,
  amount numeric(20,4) not null check (amount>0),
  memo text,
  created_at timestamptz not null default statement_timestamp()
);


-- COMPOSED EFFECT B.OC1.T31
revoke all privileges on table finance.journal_entries from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T31
revoke select ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), insert ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), update ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), references ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at") on table finance.journal_entries from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T31
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journal_entries'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journal_entries from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journal_entries'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journal_entries from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T31
alter table finance.journal_entries enable row level security;


-- COMPOSED EFFECT B.T34
create table platform.workspace_member_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by_membership_id uuid not null references identity.memberships(id) on delete restrict,
  lock_version integer not null default 1 check (lock_version >= 1),
  reason text not null check (length(trim(reason)) >= 5),
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  -- Exactly-one-scope constraint
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null)
    or (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null)
    or (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null)
    or (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  )
);


-- COMPOSED EFFECT B.OC1.T34
revoke all privileges on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T34
revoke select ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), insert ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), update ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), references ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at") on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T34
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T34
alter table platform.workspace_member_roles enable row level security;


-- COMPOSED EFFECT B.T64
create table platform.workspace_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  delegation_code text not null,
  grantor_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantee_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantor_user_id uuid not null references auth.users(id) on delete restrict,
  grantee_user_id uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'pending_acceptance', 'pending_approval', 'active', 'revoked', 'rejected')
  ),
  delegation_depth integer not null default 0 check (delegation_depth = 0),
  purpose text not null check (length(trim(purpose)) between 5 and 500),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  lock_version integer not null default 1 check (lock_version >= 1),
  approval_policy_code text check (approval_policy_code is null or approval_policy_code in ('single_manager', 'four_eyes_financial', 'four_eyes_sensitive')),
  required_approval_count integer not null default 1 check (required_approval_count = 1),
  payload_hash text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  rejected_by_user_id uuid references auth.users(id) on delete restrict,
  rejection_reason text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (grantor_membership_id <> grantee_membership_id),
  check (grantor_user_id <> grantee_user_id),
  check (valid_until > valid_from),
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null) or
    (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null) or
    (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null) or
    (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  ),
  unique (customer_workspace_id, delegation_code)
);


-- COMPOSED EFFECT B.OC1.T64
revoke all privileges on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T64
revoke select ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at") on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T64
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegations'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegations from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegations'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegations from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T64
alter table platform.workspace_delegations enable row level security;


-- COMPOSED EFFECT B.T35
create table platform.workspace_member_role_authority_sources (
  assignment_id uuid not null references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  source_kind text not null check(source_kind in ('identity_role','workspace_role_assignment')),
  source_identity_role_id uuid references identity.roles(id) on delete restrict,
  source_assignment_id uuid references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  authority_depth smallint not null check(authority_depth between 0 and 4),
  created_at timestamptz not null default statement_timestamp(),
  primary key(assignment_id,permission_id,module_definition_id),
  check (
    (source_kind='identity_role' and source_identity_role_id is not null and source_assignment_id is null and authority_depth=0)
    or (source_kind='workspace_role_assignment' and source_identity_role_id is null and source_assignment_id is not null and authority_depth between 1 and 4)
  )
);


-- COMPOSED EFFECT B.OC1.T35
revoke all privileges on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T35
revoke select ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), insert ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), update ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), references ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at") on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T35
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_role_authority_sources'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_role_authority_sources from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_role_authority_sources'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_role_authority_sources from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T35
alter table platform.workspace_member_role_authority_sources enable row level security;


-- COMPOSED EFFECT B.T36
create table platform.workspace_role_handover_lineage (
  successor_assignment_id uuid primary key references platform.workspace_member_roles(id),
  manager_membership_id uuid not null references identity.memberships(id),
  manager_context_id uuid not null references identity.context_grants(id),
  parent_assignment_id uuid references platform.workspace_member_roles(id),
  created_at timestamptz not null default statement_timestamp(),
  check (parent_assignment_id is distinct from successor_assignment_id)
);


-- COMPOSED EFFECT B.OC1.T36
revoke all privileges on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T36
revoke select ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), insert ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), update ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), references ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at") on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T36
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_handover_lineage'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_handover_lineage from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_handover_lineage'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_handover_lineage from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T36
alter table platform.workspace_role_handover_lineage enable row level security;


-- COMPOSED EFFECT B.T65
create table platform.workspace_delegation_permissions (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references platform.workspace_delegations(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_permission_binding_id uuid not null references platform.module_permission_bindings(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (delegation_id, module_definition_id, permission_id)
);


-- COMPOSED EFFECT B.OC1.T65
revoke all privileges on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.T65
revoke select ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), insert ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), update ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), references ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at") on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.T65
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegation_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegation_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.T65
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegation_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegation_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RLS.T65
alter table platform.workspace_delegation_permissions enable row level security;


-- COMPOSED EFFECT B.OC1.SQ1
revoke all privileges on sequence audit.events_id_seq from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SQ1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events_id_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence audit.events_id_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.SQ2
revoke all privileges on sequence finance.journals_journal_no_seq from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.SQ2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals_journal_no_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence finance.journals_journal_no_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.E001
alter table platform.tenants enable row level security;


-- COMPOSED EFFECT B.E002
alter table platform.outbox_events enable row level security;


-- COMPOSED EFFECT B.E003
alter table identity.profiles enable row level security;


-- COMPOSED EFFECT B.E004
alter table identity.roles enable row level security;


-- COMPOSED EFFECT B.E005
alter table identity.permissions enable row level security;


-- COMPOSED EFFECT B.E006
alter table identity.role_permissions enable row level security;


-- COMPOSED EFFECT B.E007
alter table identity.memberships enable row level security;


-- COMPOSED EFFECT B.E008
alter table identity.context_grants enable row level security;


-- COMPOSED EFFECT B.E009
alter table audit.events enable row level security;


-- COMPOSED EFFECT B.E010
alter table platform.customer_workspaces enable row level security;


-- COMPOSED EFFECT B.E011
alter table platform.subscription_plans enable row level security;


-- COMPOSED EFFECT B.E012
alter table platform.workspace_contracts enable row level security;


-- COMPOSED EFFECT B.E013
alter table platform.workspace_entitlements enable row level security;


-- COMPOSED EFFECT B.E014
alter table platform.customer_workspaces
  add column primary_admin_user_id uuid references auth.users(id) on delete restrict,
  add column primary_admin_membership_id uuid references identity.memberships(id) on delete restrict,
  add column primary_admin_accepted_at timestamptz,
  add column onboarding_completed_at timestamptz;


-- COMPOSED EFFECT B.E015
alter table platform.customer_workspaces
  add constraint customer_workspaces_primary_admin_consistency check (
    (
      primary_admin_user_id is null
      and primary_admin_membership_id is null
      and primary_admin_accepted_at is null
    )
    or (
      primary_admin_user_id is not null
      and primary_admin_membership_id is not null
      and primary_admin_accepted_at is not null
    )
  );


-- COMPOSED EFFECT B.E016
alter table platform.customer_workspaces
  add column onboarding_completed_by uuid references auth.users(id) on delete restrict;


-- COMPOSED EFFECT B.E017
alter table platform.customer_workspaces
  add constraint customer_workspaces_onboarding_completion_consistency check (
    (onboarding_completed_at is null and onboarding_completed_by is null)
    or (onboarding_completed_at is not null and onboarding_completed_by is not null)
  );


-- COMPOSED EFFECT B.E018
alter table platform.subscription_plans drop constraint if exists subscription_plans_status_check;


-- COMPOSED EFFECT B.E019
alter table platform.subscription_plans alter column status set default 'draft';


-- COMPOSED EFFECT B.E020
alter table platform.subscription_plans add constraint subscription_plans_status_check
  check (status in ('draft', 'active', 'deprecated', 'retired'));


-- COMPOSED EFFECT B.E021
alter table platform.subscription_plans add constraint subscription_plans_effective_window_check
  check (effective_until is null or effective_until > effective_from);


-- COMPOSED EFFECT B.E022
alter table finance.accounting_periods enable row level security;


-- COMPOSED EFFECT B.E023
alter table finance.accounting_periods
  add column if not exists closed_by uuid references auth.users(id) on delete restrict;


-- COMPOSED EFFECT B.E024
alter table finance.accounting_periods
drop constraint if exists accounting_periods_property_no_overlap;


-- COMPOSED EFFECT B.E025
alter table finance.accounting_periods
add constraint accounting_periods_property_no_overlap
exclude using gist (
  tenant_id with =,
  property_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is not null);


-- COMPOSED EFFECT B.E026
alter table finance.accounting_periods
drop constraint if exists accounting_periods_tenant_no_overlap;


-- COMPOSED EFFECT B.E027
alter table finance.accounting_periods
add constraint accounting_periods_tenant_no_overlap
exclude using gist (
  tenant_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is null);


-- COMPOSED EFFECT B.E028
alter table platform.building_setup_runs enable row level security;


-- COMPOSED EFFECT B.E029
alter table platform.property_profiles enable row level security;


-- COMPOSED EFFECT B.E030
alter table platform.operating_models enable row level security;


-- COMPOSED EFFECT B.E031
alter table platform.space_kinds enable row level security;


-- COMPOSED EFFECT B.E032
alter table platform.property_operating_model_compatibilities enable row level security;


-- COMPOSED EFFECT B.E033
alter table platform.property_space_kind_compatibilities enable row level security;


-- COMPOSED EFFECT B.E034
alter table platform.workspace_taxonomy_assignments enable row level security;


-- COMPOSED EFFECT B.E035
alter table platform.workspace_property_bindings enable row level security;


-- COMPOSED EFFECT B.E036
alter table platform.workspace_taxonomy_assignments
  add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');


-- COMPOSED EFFECT B.E037
alter table platform.module_definitions enable row level security;


-- COMPOSED EFFECT B.E038
alter table platform.module_property_profile_compatibilities enable row level security;


-- COMPOSED EFFECT B.E039
alter table platform.module_operating_model_compatibilities enable row level security;


-- COMPOSED EFFECT B.E040
alter table platform.workspace_modules enable row level security;


-- COMPOSED EFFECT B.E041
alter table platform.module_permission_bindings enable row level security;


-- COMPOSED EFFECT B.E042
alter table platform.workspace_roles enable row level security;


-- COMPOSED EFFECT B.E043
alter table platform.workspace_role_modules enable row level security;


-- COMPOSED EFFECT B.E044
alter table platform.workspace_role_permissions enable row level security;


-- COMPOSED EFFECT B.E045
alter table platform.workspace_member_roles enable row level security;


-- COMPOSED EFFECT B.E046
alter table platform.workspace_role_idempotency enable row level security;


-- COMPOSED EFFECT B.E047
alter table platform.workspace_delegations enable row level security;


-- COMPOSED EFFECT B.E048
alter table platform.workspace_delegation_permissions enable row level security;


-- COMPOSED EFFECT B.E049
alter table portfolio.properties
  add constraint properties_tenant_id_id_uq unique (tenant_id,id);


-- COMPOSED EFFECT B.E050
alter table platform.workspace_access_bases enable row level security;


-- COMPOSED EFFECT B.E051
alter table platform.pilot_setup_reviewers enable row level security;


-- COMPOSED EFFECT B.E052
alter table platform.customer_workspaces add constraint customer_workspaces_id_tenant_airprop_key unique(id,tenant_id);


-- COMPOSED EFFECT B.E053
alter table platform.workspace_member_roles
  add column assigned_by_context_grant_id uuid references identity.context_grants(id) on delete restrict,
  add column authority_policy_version smallint not null default 1 check(authority_policy_version in (1,2)),
  add column authority_depth smallint not null default 0 check(authority_depth between 0 and 4);


-- COMPOSED EFFECT B.E054
alter table platform.workspace_member_role_authority_sources enable row level security;


-- COMPOSED EFFECT B.E055
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- COMPOSED EFFECT B.E083
alter table portfolio.addresses alter column country_code drop default;


-- COMPOSED EFFECT B.E084
alter table portfolio.addresses
  add constraint addresses_country_code_explicit_v1
  check(country_code::text ~ '^[A-Z]{2}$') not valid;


-- COMPOSED EFFECT B.E085
alter table portfolio.addresses
  validate constraint addresses_country_code_explicit_v1;


-- COMPOSED EFFECT B.E086
alter table platform.jurisdiction_profiles enable row level security;


-- COMPOSED EFFECT B.E087
alter table platform.property_jurisdiction_assignments enable row level security;


-- COMPOSED EFFECT B.E088
alter table portfolio.parties enable row level security;


-- COMPOSED EFFECT B.E089
alter table portfolio.units enable row level security;


-- COMPOSED EFFECT B.E090
alter table portfolio.buildings enable row level security;


-- COMPOSED EFFECT B.E091
alter table platform.workspace_property_bindings enable row level security;


-- COMPOSED EFFECT B.E092
alter table platform.customer_workspaces enable row level security;


-- COMPOSED EFFECT B.E093
alter table platform.workspace_entitlements enable row level security;


-- COMPOSED EFFECT B.E094
alter table identity.context_grants enable row level security;


-- COMPOSED EFFECT B.E095
alter table identity.memberships enable row level security;


-- COMPOSED EFFECT B.E096
alter table platform.module_definitions enable row level security;


-- COMPOSED EFFECT B.E097
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- COMPOSED EFFECT B.E098
alter table audit.events enable row level security;


-- COMPOSED EFFECT B.E099
alter table platform.outbox_events enable row level security;


-- COMPOSED EFFECT B.E100
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


-- COMPOSED EFFECT B.SD67
insert into app_private.canonical_authority_revision_v1(singleton,revision) values(true,1);


-- COMPOSED EFFECT B.N01
create function app_private.require_building_session_current_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog
as $n01$
declare actor uuid; claims jsonb; sid uuid; expiry numeric; now_at timestamptz:=statement_timestamp();
begin
 begin
  actor:=auth.uid(); claims:=auth.jwt(); sid:=(claims->>'session_id')::uuid;
  expiry:=(claims->>'exp')::numeric;
  if actor is null or (claims->>'sub')::uuid is distinct from actor
   or claims->>'role' is distinct from 'authenticated' or claims->>'aal' is distinct from 'aal2'
   or sid is null or expiry is null or expiry::text in ('NaN','Infinity','-Infinity')
   or expiry<=extract(epoch from now_at)
   or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=actor
      and (s.not_after is null or s.not_after>now_at)) then
   raise exception using errcode='42501',message='setup_session_not_current';
  end if;
 exception when others then
  raise exception using errcode='42501',message='setup_session_not_current';
 end;
end;
$n01$;


-- COMPOSED EFFECT B.OC1.N01
revoke all privileges on function app_private.require_building_session_current_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.N01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_session_current_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_session_current_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F18
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F18
revoke all privileges on function app_private.set_updated_at() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.set_updated_at()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.set_updated_at() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F20
create or replace function finance.protect_accounting_period()
returns trigger language plpgsql security definer set search_path=pg_catalog,finance
as $$ begin
  if old.status='closed' then raise exception 'closed_accounting_period_is_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;


-- COMPOSED EFFECT B.OC1.F20
revoke all privileges on function finance.protect_accounting_period() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.protect_accounting_period()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.protect_accounting_period() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F21
create or replace function finance.assert_accounting_period_no_overlap()
returns trigger
language plpgsql
set search_path = finance, platform, extensions, public
as $$
declare
  v_overlap_count int;
begin
  -- Serialize concurrent period operations for the same tenant
  perform 1
  from platform.tenants
  where id = new.tenant_id
  for update;

  -- Rule A: Tenant-wide period must not overlap with ANY period of the same tenant
  if new.property_id is null then
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Tenant-wide accounting period cannot overlap with any tenant or property period'
        using errcode = '23P01';
    end if;
  else
    -- Rule B: Property-specific period must not overlap with any tenant-wide period of the same tenant
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.property_id is null
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Property accounting period cannot overlap with existing tenant-wide period'
        using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F21
revoke all privileges on function finance.assert_accounting_period_no_overlap() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_no_overlap()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_no_overlap() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F22
create or replace function finance.assert_accounting_period_property_tenant()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
declare
  v_prop_tenant uuid;
begin
  if new.property_id is not null then
    select tenant_id into v_prop_tenant
    from portfolio.properties
    where id = new.property_id;

    if not found then
      raise exception 'Property % does not exist', new.property_id
        using errcode = '23503';
    end if;

    if v_prop_tenant <> new.tenant_id then
      raise exception 'Accounting period property (%) belongs to tenant %, not period tenant %',
        new.property_id, v_prop_tenant, new.tenant_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F22
revoke all privileges on function finance.assert_accounting_period_property_tenant() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_property_tenant()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_property_tenant() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F23
create or replace function app_private.guard_taxonomy_version_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status = 'active' then
    -- Deterministic transactional lock per (table, code) to serialize concurrent version inserts
    perform pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA || ':' || TG_TABLE_NAME || ':' || new.code, 0));

    if TG_TABLE_NAME = 'property_profiles' then
      select exists (
        select 1 from platform.property_profiles p
        where p.code = new.code
          and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and p.is_active = true and p.lifecycle_status = 'active'
          and (
            (p.valid_to is null and (new.valid_to is null or new.valid_to > p.valid_from))
            or
            (p.valid_to is not null and new.valid_from < p.valid_to and (new.valid_to is null or new.valid_to > p.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'operating_models' then
      select exists (
        select 1 from platform.operating_models m
        where m.code = new.code
          and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and m.is_active = true and m.lifecycle_status = 'active'
          and (
            (m.valid_to is null and (new.valid_to is null or new.valid_to > m.valid_from))
            or
            (m.valid_to is not null and new.valid_from < m.valid_to and (new.valid_to is null or new.valid_to > m.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'space_kinds' then
      select exists (
        select 1 from platform.space_kinds s
        where s.code = new.code
          and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and s.is_active = true and s.lifecycle_status = 'active'
          and (
            (s.valid_to is null and (new.valid_to is null or new.valid_to > s.valid_from))
            or
            (s.valid_to is not null and new.valid_from < s.valid_to and (new.valid_to is null or new.valid_to > s.valid_from))
          )
      ) into v_overlap;
    end if;

    if coalesce(v_overlap, false) then
      raise exception 'workspace_taxonomy_version_effective_period_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F23
revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_version_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F24
create or replace function app_private.guard_taxonomy_record_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_TABLE_NAME = 'property_profiles' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where property_profile_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where property_profile_id = old.id)
       or exists (select 1 from platform.property_space_kind_compatibilities where property_profile_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'operating_models' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where operating_model_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where operating_model_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'space_kinds' then
    if exists (select 1 from platform.property_space_kind_compatibilities where space_kind_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  end if;
  return old;
end;
$$;


-- COMPOSED EFFECT B.OC1.F24
revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_record_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F25
create or replace function app_private.guard_workspace_taxonomy_assignment_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_profile_id <> new.property_profile_id
       or old.operating_model_id <> new.operating_model_id
       or (old.country_code is distinct from new.country_code)
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F25
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F26
create or replace function app_private.guard_workspace_property_binding_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_id <> new.property_id
       or old.binding_source <> new.binding_source
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F26
revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F27
create or replace function app_private.guard_workspace_property_binding_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio
as $$
declare
  v_workspace_tenant uuid;
  v_property_tenant uuid;
begin
  -- 1. Lock and validate Property tenant (serialize concurrent bindings targeting the same property)
  select tenant_id into v_property_tenant
  from portfolio.properties
  where id = new.property_id
  for update;

  if not found then
    raise exception 'workspace_property_binding_property_not_found' using errcode = 'P0002';
  end if;

  if v_property_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Validate Customer Workspace tenant
  select tenant_id into v_workspace_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id
  for update;

  if not found then
    raise exception 'workspace_property_binding_workspace_not_found' using errcode = 'P0002';
  end if;

  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 3. Non-overlapping active bindings for this property
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_property_bindings b
      where b.property_id = new.property_id
        and b.status = 'active'
        and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (b.valid_to is null and (new.valid_to is null or new.valid_to > b.valid_from))
          or
          (b.valid_to is not null and new.valid_from < b.valid_to and (new.valid_to is null or new.valid_to > b.valid_from))
        )
    ) then
      raise exception 'workspace_property_binding_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F27
revoke all privileges on function app_private.guard_workspace_property_binding_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F28
create or replace function app_private.guard_workspace_taxonomy_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, app_private
as $$
declare
  v_workspace_tenant uuid;
  v_compat_level text;
  v_profile_active boolean;
  v_model_active boolean;
begin
  -- 1. Tenant boundary check
  select tenant_id into v_workspace_tenant from platform.customer_workspaces where id = new.customer_workspace_id for update;
  if not found then
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;
  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Verify Profile and Operating Model active status
  select is_active into v_profile_active from platform.property_profiles
  where id = new.property_profile_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_profile_active, false) then
    raise exception 'workspace_taxonomy_profile_inactive' using errcode = '22023';
  end if;

  select is_active into v_model_active from platform.operating_models
  where id = new.operating_model_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_model_active, false) then
    raise exception 'workspace_taxonomy_operating_model_inactive' using errcode = '22023';
  end if;

  -- 3. Evaluate Compatibility Rule
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = new.property_profile_id
    and operating_model_id = new.operating_model_id
  order by rule_version desc limit 1;

  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  if v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible_assignment' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if new.status = 'active' and (new.notes is null or length(trim(new.notes)) = 0) then
      raise exception 'workspace_taxonomy_review_required' using errcode = 'P0001';
    end if;
  end if;

  -- 4. Check for overlapping active assignments for this workspace
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_taxonomy_assignments a
      where a.customer_workspace_id = new.customer_workspace_id
        and a.status = 'active'
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (a.valid_to is null and (new.valid_to is null or new.valid_to > a.valid_from))
          or
          (a.valid_to is not null and new.valid_from < a.valid_to and (new.valid_to is null or new.valid_to > a.valid_from))
        )
    ) then
      raise exception 'workspace_taxonomy_assignment_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F28
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F29
create or replace function app_private.bootstrap_role_taxonomy_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if lower(new.code) in ('association_admin', 'property_manager') then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.taxonomy.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F29
revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_taxonomy_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F30
create or replace function app_private.bootstrap_role_module_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  -- Only grant to canonical global system management roles (tenant_id is null, is_system = true)
  -- Rogue/spoof roles with prefix/suffix or non-canonical properties are strictly rejected
  if new.code in ('association_admin', 'property_manager')
     and new.tenant_id is null
     and new.is_system = true
     and new.name is not null and length(trim(new.name)) > 0 then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.module.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F30
revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_module_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F31
create or replace function app_private.guard_module_definition_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    if old.lifecycle_status in ('active', 'published') then
      raise exception 'platform_module_definition_immutable' using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.lifecycle_status in ('active', 'published') then
      if old.id <> new.id
         or old.code <> new.code
         or old.version <> new.version
         or old.name <> new.name
         or old.description <> new.description
         or old.entitlement_key <> new.entitlement_key
         or old.requires_aal2 <> new.requires_aal2
         or old.sensitivity_level <> new.sensitivity_level
         or old.category <> new.category
         or old.labels_json <> new.labels_json
         or old.config_schema <> new.config_schema
         or old.created_at <> new.created_at
         or old.valid_from <> new.valid_from then
        raise exception 'platform_module_definition_immutable' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F31
revoke all privileges on function app_private.guard_module_definition_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F32
create or replace function app_private.guard_module_definition_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status in ('active', 'published') then
    if new.valid_to is not null and new.valid_to <= new.valid_from then
      return new; -- Allow table check constraint (valid_to is null or valid_to > valid_from) to raise check_violation (23514)
    end if;

    perform pg_advisory_xact_lock(hashtextextended('module_definition:' || new.code, 0));

    select exists (
      select 1
      from platform.module_definitions d
      where d.code = new.code
        and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and d.is_active = true
        and d.lifecycle_status in ('active', 'published')
        and tstzrange(d.valid_from, coalesce(d.valid_to, 'infinity'), '[)') &&
            tstzrange(new.valid_from, coalesce(new.valid_to, 'infinity'), '[)')
    ) into v_overlap;

    if v_overlap then
      raise exception 'platform_module_definition_version_overlap' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F32
revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F33
create or replace function app_private.guard_workspace_module_code_sync_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_expected_code text;
  v_expected_tenant uuid;
begin
  select code into v_expected_code
  from platform.module_definitions
  where id = new.module_definition_id;

  if v_expected_code is null then
    raise exception 'workspace_module_definition_not_found' using errcode = 'P0002';
  end if;

  if new.module_code <> v_expected_code then
    raise exception 'workspace_module_code_mismatch' using errcode = '22023';
  end if;

  select tenant_id into v_expected_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id;

  if v_expected_tenant is null or new.tenant_id <> v_expected_tenant then
    raise exception 'workspace_module_tenant_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F33
revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_code_sync_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F34
create or replace function app_private.guard_workspace_module_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_module_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.valid_to is not null then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.module_definition_id <> new.module_definition_id
       or old.module_code <> new.module_code
       or old.valid_from <> new.valid_from
       or old.activated_at <> new.activated_at
       or old.activated_by is distinct from new.activated_by
       or old.config_json <> new.config_json
       or old.created_at <> new.created_at then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F34
revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F35
create or replace function app_private.bootstrap_role_workspace_role_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if new.tenant_id is null and new.is_system = true and new.name is not null and length(trim(new.name)) > 0 then
    if new.code in ('association_admin', 'property_manager') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')
      on conflict do nothing;
    elsif new.code in ('president', 'censor') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code = 'workspace.role.read'
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F35
revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_role_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F36
create or replace function app_private.guard_module_permission_binding_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_mod_status text;
  v_perm_code text;
begin
  if tg_op = 'UPDATE' then
    -- Allow controlled forward-close handoff: only lifecycle_status active -> deprecated and valid_to null -> timestamp
    if old.binding_version = new.binding_version
       and old.module_definition_id = new.module_definition_id
       and old.permission_id = new.permission_id
       and old.is_assignable_to_local_role = new.is_assignable_to_local_role
       and old.is_delegable = new.is_delegable
       and old.requires_aal2 = new.requires_aal2
       and old.valid_from = new.valid_from
       and old.lifecycle_status = 'active'
       and new.lifecycle_status = 'deprecated'
       and old.valid_to is null
       and new.valid_to is not null
    then
      return new;
    end if;
    raise exception 'module_permission_binding_historical_records_are_immutable' using errcode = '42501';
  end if;

  -- Validation for INSERT
  select code into v_perm_code from identity.permissions where id = new.permission_id;
  select lifecycle_status into v_mod_status from platform.module_definitions where id = new.module_definition_id;

  if v_mod_status = 'catalog_only' then
    raise exception 'catalog_only_modules_cannot_have_permission_bindings' using errcode = '42501';
  end if;

  -- Strict Non-Delegable Invariant
  if new.is_delegable is true then
    if v_perm_code in (
      'billing.cancel',
      'payments.reverse',
      'payments.reconcile',
      'utilities.tariffs.manage',
      'governance.votes.administer',
      'governance.minutes.finalize',
      'workspace.role.read',
      'workspace.role.manage',
      'workspace.role.publish',
      'workspace.role.assign',
      'workspace.delegation.read',
      'workspace.delegation.manage',
      'workspace.delegation.approve',
      'workspace.delegation.revoke'
    ) then
      raise exception 'permission_is_strictly_non_delegable: %', v_perm_code using errcode = '42501';
    end if;
  end if;

  -- Prevent temporal overlap among active records
  if new.lifecycle_status = 'active' and exists (
    select 1 from platform.module_permission_bindings b
    where b.module_definition_id = new.module_definition_id
      and b.permission_id = new.permission_id
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.lifecycle_status = 'active'
      and (
        (new.valid_to is null and b.valid_to is null) or
        (new.valid_to is null and b.valid_to > new.valid_from) or
        (b.valid_to is null and new.valid_to > b.valid_from) or
        (new.valid_from < b.valid_to and new.valid_to > b.valid_from)
      )
  ) then
    raise exception 'active_module_permission_binding_temporal_overlap' using errcode = '42501';
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F36
revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_permission_binding_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F37
create or replace function app_private.guard_workspace_role_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_role_delete_prohibited' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'archived' then
    raise exception 'workspace_role_archived_immutable' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'published' then
    -- Only permitted transition is published -> archived
    if new.lifecycle_status = 'archived' then
      if new.valid_to is null or new.valid_to < old.valid_from then
        raise exception 'archived_role_requires_valid_to' using errcode = '22023';
      end if;
      -- Immutable fields cannot be modified during supersession
      if new.id <> old.id
         or new.tenant_id <> old.tenant_id
         or new.customer_workspace_id <> old.customer_workspace_id
         or new.code <> old.code
         or new.role_version <> old.role_version
         or new.name <> old.name
         or new.description is distinct from old.description
         or new.base_role_id is distinct from old.base_role_id
         or new.scope_ceiling <> old.scope_ceiling
         or new.valid_from <> old.valid_from
         or new.created_by <> old.created_by
         or new.created_at <> old.created_at
         or new.lock_version <> old.lock_version + 1 then
        raise exception 'published_workspace_role_content_immutable' using errcode = '42501';
      end if;
    else
      raise exception 'published_workspace_role_immutable' using errcode = '42501';
    end if;
  end if;

  if old.lifecycle_status = 'draft' then
    if new.lifecycle_status not in ('draft', 'published') then
      raise exception 'draft_role_invalid_lifecycle_transition' using errcode = '42501';
    end if;
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.code <> old.code
       or new.role_version <> old.role_version
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'draft_role_identity_immutable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F37
revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F38
create or replace function app_private.guard_workspace_role_module_draft_only_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- COMPOSED EFFECT B.OC1.F38
revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_module_draft_only_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F39
create or replace function app_private.guard_workspace_role_permission_bindings_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    -- Guard: Permission must be registered and assignable for at least one module currently attached to this role
    if not exists (
      select 1
      from platform.workspace_role_modules wrm
      join platform.module_permission_bindings mpb
        on mpb.module_definition_id = wrm.module_definition_id
      where wrm.workspace_role_id = new.workspace_role_id
        and mpb.permission_id = new.permission_id
        and mpb.is_assignable_to_local_role = true
        and mpb.lifecycle_status = 'active'
        and mpb.valid_from <= statement_timestamp()
        and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
    ) then
      raise exception 'permission_not_assignable_to_role_modules' using errcode = '42501';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- COMPOSED EFFECT B.OC1.F39
revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_permission_bindings_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F40
create or replace function app_private.guard_workspace_member_role_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio, identity
as $$
declare
  v_role record;
  v_mem record;
  v_bld record;
  v_unit record;
  v_ceiling_rank integer;
  v_scope_rank integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Reopening prohibited: once revoked, no updates are allowed
    if old.valid_to is not null and old.valid_to <= statement_timestamp() then
      raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
    end if;

    -- All identity, scope, role, membership, timestamps, and creator provenance fields are strictly immutable
    if new.id <> old.id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.tenant_id <> old.tenant_id
       or new.membership_id <> old.membership_id
       or new.workspace_role_id <> old.workspace_role_id
       or new.scope_type <> old.scope_type
       or new.property_id is distinct from old.property_id
       or new.building_id is distinct from old.building_id
       or new.unit_id is distinct from old.unit_id
       or new.valid_from <> old.valid_from
       or new.created_at <> old.created_at
       or new.assigned_by_user_id <> old.assigned_by_user_id
       or new.assigned_by_membership_id <> old.assigned_by_membership_id then
      raise exception 'workspace_member_role_fields_immutable' using errcode = '42501';
    end if;

    -- Revocation transition only: valid_to must transition from NULL to a valid timestamp
    if new.valid_to is null or new.valid_to < old.valid_from
       or new.valid_to > statement_timestamp()
       or (old.valid_to is not null and new.valid_to >= old.valid_to) then
      raise exception 'workspace_member_role_update_must_be_revocation' using errcode = '42501';
    end if;

    -- lock_version must increment by exactly 1
    if new.lock_version <> old.lock_version + 1 then
      raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
    end if;

    -- Reason must be valid
    if new.reason is null or length(trim(new.reason)) < 5 then
      raise exception 'workspace_member_role_reason_invalid' using errcode = '22023';
    end if;

    return new;
  end if;

  -- INSERT Validations:
  -- 1. Tenant & Membership consistency and active validity
  select * into v_mem
  from identity.memberships
  where id = new.membership_id;

  if not found or v_mem.tenant_id <> new.tenant_id or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  -- 2. Role Status & Tenant/Workspace consistency
  select * into v_role
  from platform.workspace_roles
  where id = new.workspace_role_id;

  if not found or v_role.tenant_id <> new.tenant_id or v_role.customer_workspace_id <> new.customer_workspace_id then
    raise exception 'workspace_member_role_cross_workspace_prohibited' using errcode = '42501';
  end if;

  if v_role.lifecycle_status <> 'published' or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  -- 3. Scope Ceiling Enforcement: workspace(0) > property(1) > building(2) > unit(3)
  v_ceiling_rank := case v_role.scope_ceiling
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  v_scope_rank := case new.scope_type
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  if v_scope_rank < v_ceiling_rank then
    raise exception 'workspace_member_role_exceeds_scope_ceiling' using errcode = '42501';
  end if;

  -- 4. Scope Ancestry & Workspace Property Binding
  if new.property_id is not null then
    if not exists (
      select 1 from platform.workspace_property_bindings
      where customer_workspace_id = new.customer_workspace_id
        and property_id = new.property_id
        and status = 'active'
        and valid_from <= statement_timestamp()
        and (valid_to is null or valid_to > statement_timestamp())
    ) then
      raise exception 'property_not_bound_to_workspace' using errcode = '42501';
    end if;
  end if;

  if new.building_id is not null then
    select * into v_bld from portfolio.buildings where id = new.building_id;
    if not found or v_bld.property_id <> new.property_id or v_bld.tenant_id <> new.tenant_id then
      raise exception 'building_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  if new.unit_id is not null then
    select * into v_unit from portfolio.units where id = new.unit_id;
    if not found or v_unit.building_id <> new.building_id or v_unit.tenant_id <> new.tenant_id then
      raise exception 'unit_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  -- 5. Temporal Non-Overlap for identical assignment target
  if exists (
    select 1 from platform.workspace_member_roles r
    where r.customer_workspace_id = new.customer_workspace_id
      and r.membership_id = new.membership_id
      and r.workspace_role_id = new.workspace_role_id
      and r.scope_type = new.scope_type
      and r.property_id is not distinct from new.property_id
      and r.building_id is not distinct from new.building_id
      and r.unit_id is not distinct from new.unit_id
      and (r.valid_to is null or r.valid_to > new.valid_from)
  ) then
    raise exception 'workspace_member_role_overlapping_assignment' using errcode = '23505';
  end if;

  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F40
revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F41
create or replace function app_private.bootstrap_role_workspace_delegation_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if new.tenant_id is null and new.is_system = true and new.name is not null and length(trim(new.name)) > 0 then
    if new.code in ('association_admin', 'property_manager') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'president' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'censor' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve')
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F41
revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_delegation_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F42
create or replace function platform.cap_customer_membership_to_access_basis()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_now timestamptz:=pg_catalog.statement_timestamp(); v_prepared record; v_prepared_end timestamptz;
begin
  if new.status<>'active' or not exists(
    select 1 from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    where w.tenant_id=new.tenant_id
  ) then return new; end if;
  select max(b.expires_at) into v_end from platform.workspace_access_bases b
  join platform.customer_workspaces w on w.id=b.customer_workspace_id
  where w.tenant_id=new.tenant_id and b.status='active' and b.expires_at>v_now;
  if v_end is null then
    -- The initial primary-admin activation is the only permitted membership
    -- while the decision is prepared. It must already carry a bounded expiry.
    select b.* into v_prepared from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    join auth.users u on pg_catalog.lower(pg_catalog.btrim(u.email))=b.normalized_email
    where w.tenant_id=new.tenant_id and w.lifecycle_status='PROVISIONING'
      and b.status='prepared' and b.approved_at+interval '7 days'>v_now
      and u.id=new.user_id and new.user_id=auth.uid()
      and coalesce(auth.jwt()->>'aal','')='aal2'
      and (b.mode='PILOT' or exists(select 1 from platform.workspace_contracts c
        where c.id=b.contract_id and c.status='active' and c.signed_at is not null
          and b.paid_through>=(v_now at time zone 'Europe/Bucharest')::date))
      and b.role_id=new.role_id and u.email_confirmed_at is not null
    limit 1;
    if not found then raise exception 'commercial_access_basis_required' using errcode='42501'; end if;
    if v_prepared.mode='PILOT' then
      v_prepared_end:=v_now+pg_catalog.make_interval(hours=>v_prepared.duration_hours);
    else
      v_prepared_end:=(v_prepared.paid_through+1)::timestamp at time zone 'Europe/Bucharest';
    end if;
    if new.ends_at is null or new.ends_at > v_prepared_end
      or new.ends_at<=v_now then
      raise exception 'commercial_access_basis_required' using errcode='42501';
    end if;
    return new;
  end if;
  if new.ends_at is null or new.ends_at>v_end then new.ends_at:=v_end; end if;
  if new.ends_at<=v_now then raise exception 'commercial_access_expired' using errcode='42501'; end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F42
revoke all privileges on function platform.cap_customer_membership_to_access_basis() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_membership_to_access_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_membership_to_access_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F43
create or replace function platform.cap_customer_context_to_membership()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_tenant uuid;
begin
  select m.ends_at,m.tenant_id into v_end,v_tenant from identity.memberships m where m.id=new.membership_id;
  if v_tenant is null or v_tenant<>new.tenant_id then
    raise exception 'context_membership_tenant_mismatch' using errcode='42501';
  end if;
  if v_end is not null and (new.ends_at is null or new.ends_at>v_end) then new.ends_at:=v_end; end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F43
revoke all privileges on function platform.cap_customer_context_to_membership() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_context_to_membership()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_context_to_membership() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F44
create or replace function platform.require_workspace_access_basis_for_provisioning()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.lifecycle_status='PROVISIONING' and old.lifecycle_status<>'PROVISIONING'
    and not exists (
      select 1 from platform.workspace_access_bases b
      left join platform.workspace_contracts c on c.id=b.contract_id
      where b.customer_workspace_id=new.id
        and ((b.status='prepared' and b.approved_at+interval '7 days'>pg_catalog.statement_timestamp())
          or (b.status='active' and b.expires_at>pg_catalog.statement_timestamp()))
        and ((b.mode='PILOT' and new.environment='PILOT')
          or (b.mode='PAID' and c.status='active' and c.signed_at is not null
            and b.paid_through>=(pg_catalog.statement_timestamp() at time zone 'Europe/Bucharest')::date))
    ) then
    raise exception 'prepared_commercial_or_pilot_basis_required' using errcode='55000';
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F44
revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.require_workspace_access_basis_for_provisioning()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F45
create function app_private.guard_undefined_primary_role_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_type platform.workspace_type; v_role text;
begin
  select workspace_type into v_type from platform.customer_workspaces
  where id=new.customer_workspace_id;
  if not found then return new; end if;
  if v_type in ('OWNER_PORTFOLIO','HYBRID') then
    if tg_table_name='workspace_access_bases' then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
    select code into v_role from identity.roles where id=new.role_id;
    if v_role in ('association_admin','property_manager') then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
  end if;
  return new;
end $$;


-- COMPOSED EFFECT B.OC1.F45
revoke all privileges on function app_private.guard_undefined_primary_role_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_undefined_primary_role_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_undefined_primary_role_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F46
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


-- COMPOSED EFFECT B.OC1.F46
revoke all privileges on function platform.end_pilot_reviewers_with_basis() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.end_pilot_reviewers_with_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.end_pilot_reviewers_with_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F48
create or replace function app_private.guard_workspace_role_authority_source_immutable_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'workspace_role_authority_source_immutable' using errcode='42501';
end;
$$;


-- COMPOSED EFFECT B.OC1.F48
revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_authority_source_immutable_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F50
create function app_private.guard_authority_revision_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() < 2
    or new.singleton is distinct from old.singleton
    or new.revision <> old.revision + 1 then
    raise exception 'canonical_authority_revision_write_denied' using errcode='42501';
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F50
revoke all privileges on function app_private.guard_authority_revision_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F51
create function app_private.bump_canonical_authority_revision_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- The row update and source mutation share a commit/rollback boundary.
  -- Overflow or a missing singleton aborts the entire source mutation.
  update app_private.canonical_authority_revision_v1
    set revision=revision+1 where singleton;
  if not found then
    raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
  end if;
  return null;
end;
$$;


-- COMPOSED EFFECT B.OC1.F51
revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bump_canonical_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F52
create function app_private.guard_jurisdiction_bound_property_address_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target_country char(2); bound_country char(2);
begin
  if old.address_id is distinct from new.address_id and exists(
    select 1 from platform.property_jurisdiction_assignments a
    where a.property_id=old.id and a.status in ('active','superseded','archived')) then
    select country_code into target_country from portfolio.addresses where id=new.address_id;
    select country_code into bound_country from platform.property_jurisdiction_assignments
      where property_id=old.id and status in ('active','superseded','archived')
      order by assignment_version desc limit 1;
    if target_country is null or target_country<>bound_country then
      raise exception 'property_jurisdiction_property_country_immutable' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F52
revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_jurisdiction_bound_property_address_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F53
create function app_private.protect_setup_creation_v2() returns trigger
language plpgsql set search_path=pg_catalog as $$begin
 if (new.tenant_id,new.customer_workspace_id,new.created_by,new.idempotency_key,new.creation_request_hash,new.creation_receipt)
 is distinct from (old.tenant_id,old.customer_workspace_id,old.created_by,old.idempotency_key,old.creation_request_hash,old.creation_receipt)
 then raise exception 'setup_creation_binding_immutable' using errcode='22023';end if;
 return new;
end$$;


-- COMPOSED EFFECT B.OC1.F53
revoke all privileges on function app_private.protect_setup_creation_v2() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.protect_setup_creation_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.protect_setup_creation_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F60
create or replace function app_private.resolve_workspace_from_customer_context_v1(
  p_context_id uuid,
  p_is_mutation boolean
)
returns table (
  workspace_id uuid,
  tenant_id uuid,
  membership_id uuid,
  role_id uuid,
  role_code text,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
#variable_conflict use_column
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_ws_count integer;
begin
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
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

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
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

    if v_binding_count = 0 then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    elsif v_binding_count > 1 then
      raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
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
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

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
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
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
$$;


-- COMPOSED EFFECT B.OC1.F60
revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F72
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


-- COMPOSED EFFECT B.OC1.F72
revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F72
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.validate_setup_units_v2(jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F73
create or replace function platform.assert_workspace_activation_ready(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, platform, identity, auth
as $$
declare v_ws platform.customer_workspaces;
begin
  select * into v_ws from platform.customer_workspaces where id = p_workspace_id;
  if not found then return false; end if;
  return v_ws.onboarding_completed_at is not null
    and v_ws.onboarding_completed_by = v_ws.primary_admin_user_id
    and v_ws.primary_admin_accepted_at is not null
    and exists (
      select 1 from identity.memberships m
      where m.id = v_ws.primary_admin_membership_id and m.user_id = v_ws.primary_admin_user_id
        and m.tenant_id = v_ws.tenant_id and m.status = 'active'
        and m.starts_at <= statement_timestamp()
        and (m.ends_at is null or m.ends_at > statement_timestamp())
    )
    and exists (
      select 1 from auth.mfa_factors f
      where f.user_id = v_ws.primary_admin_user_id and f.status = 'verified'
    );
end;
$$;


-- COMPOSED EFFECT B.OC1.F73
revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F73
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.assert_workspace_activation_ready(uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F74
create or replace function app_private.workspace_context_covers_role_scope_v1(
 p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,identity,portfolio,app_private as $$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
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
$$;


-- COMPOSED EFFECT B.OC1.F74
revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F74
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F76
create or replace function app_private.workspace_role_scope_contains_v1(
 p_parent_type text,p_parent_property uuid,p_parent_building uuid,p_parent_unit uuid,
 p_child_type text,p_child_property uuid,p_child_building uuid,p_child_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case p_parent_type
  when 'workspace' then p_child_type in ('workspace','property','building','unit')
  when 'property' then p_child_type in ('property','building','unit') and p_parent_property is not distinct from p_child_property
  when 'building' then p_child_type in ('building','unit') and p_parent_building is not distinct from p_child_building
  when 'unit' then p_child_type='unit' and p_parent_unit is not distinct from p_child_unit
  else false end;
$$;


-- COMPOSED EFFECT B.OC1.F76
revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F76
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F78
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


-- COMPOSED EFFECT B.OC1.F78
revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F78
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.setup_record_v2(platform.building_setup_runs)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F84
create or replace function app_private.workspace_role_scope_overlaps_v1(
 p_left_type text,p_left_property uuid,p_left_building uuid,p_left_unit uuid,
 p_right_type text,p_right_property uuid,p_right_building uuid,p_right_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case
  when p_left_type='workspace' or p_right_type='workspace' then true
  when p_left_type='property' then p_left_property is not distinct from p_right_property
  when p_right_type='property' then p_right_property is not distinct from p_left_property
  when p_left_type='building' then p_left_building is not distinct from p_right_building
  when p_right_type='building' then p_right_building is not distinct from p_left_building
  when p_left_type='unit' then p_left_unit is not distinct from p_right_unit
  when p_right_type='unit' then p_right_unit is not distinct from p_left_unit
  else false end;
$$;


-- COMPOSED EFFECT B.OC1.F84
revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F84
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F87
create or replace function app_private.customer_mfa_required()
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,identity
as $$
  select case
    when auth.uid() is null then true
    else exists(
      select 1
      from identity.memberships m
      join identity.roles r on r.id=m.role_id
      where m.user_id=auth.uid()
        and m.status='active'
        and m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())
        and lower(r.code) in ('association_admin','property_manager','president','censor')
    )
  end;
$$;


-- COMPOSED EFFECT B.OC1.F87
revoke all privileges on function app_private.customer_mfa_required() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F87
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.customer_mfa_required()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.customer_mfa_required() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F19
create or replace function platform.enforce_workspace_activation_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if new.environment = 'PRODUCTION'
     and new.lifecycle_status = 'ACTIVE'
     and old.lifecycle_status is distinct from 'ACTIVE'
     and not platform.assert_workspace_activation_ready(new.id) then
    raise exception 'activation_blocked: primary admin acceptance, active membership, verified MFA, and completed onboarding are required'
      using errcode = '55000';
  end if;
  return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F19
revoke all privileges on function platform.enforce_workspace_activation_gate() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.enforce_workspace_activation_gate()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.enforce_workspace_activation_gate() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F75
create or replace function app_private.workspace_role_identity_source_current_v1(
 p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,
 p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,
 p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare v_member record; v_module record;
begin
 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp()))
    or not app_private.workspace_context_covers_role_scope_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp()))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=statement_timestamp() and (wm.valid_to is null or wm.valid_to>statement_timestamp()))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
            and case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())
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
$$;


-- COMPOSED EFFECT B.OC1.F75
revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F75
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F77
create or replace function app_private.workspace_member_role_authority_active_v1(
 p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,
 p_target_scope_type text,p_target_scope_id uuid,p_path uuid[] default '{}'::uuid[]
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=statement_timestamp()
   and (wmr.valid_to is null or wmr.valid_to>statement_timestamp())
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   and r.lifecycle_status='published' and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp());
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
 if not app_private.workspace_context_covers_role_scope_v1(
   a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp());
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
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
      and grantor.status='active' and grantor.starts_at<=statement_timestamp()
      and (grantor.ends_at is null or grantor.ends_at>statement_timestamp());
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1(
      a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,
      a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,
      p_target_scope_type,p_target_scope_id);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp()
     and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1(
     wr.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,
     array_append(coalesce(p_path,'{}'::uuid[]),a.id));
 end if;
 return false;
exception when others then return false;
end;
$$;


-- COMPOSED EFFECT B.OC1.F77
revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F77
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F49
create or replace function app_private.guard_workspace_member_role_authority_v2()
returns trigger language plpgsql security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 v_ctx record; v_actor record; v_role record; v_pair record; v_parent record;
 v_scope_id uuid; v_child_pairs integer:=0; v_parent_pairs integer:=0;
 v_depth integer:=0; v_pair_depth integer:=0; v_cap timestamptz; v_base_expiry timestamptz;
 v_workspace_id uuid; v_source_kind text; v_source_role uuid; v_source_assignment uuid;
 v_scope_property uuid; v_scope_building uuid; v_scope_unit uuid;
begin
 if tg_op='UPDATE' then
   if new.assigned_by_context_grant_id is distinct from old.assigned_by_context_grant_id
      or new.authority_policy_version is distinct from old.authority_policy_version
      or new.authority_depth is distinct from old.authority_depth then
     raise exception 'workspace_member_role_authority_immutable' using errcode='42501';
   end if;
   return new;
 end if;
 if new.authority_policy_version=1 and new.assigned_by_context_grant_id is null
    and session_user in ('postgres','supabase_admin') then
   -- Preserve historical fixtures and privileged migration backfills only.
   return new;
 end if;
 if new.authority_policy_version<>2 or new.assigned_by_context_grant_id is null then
   raise exception 'workspace_member_role_authority_required' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or new.assigned_by_user_id is distinct from auth.uid()
    or new.assigned_by_membership_id=new.membership_id then
   raise exception 'workspace_role_authority_context_invalid' using errcode='42501';
 end if;
 select cg.* into v_ctx from identity.context_grants cg
 where cg.id=new.assigned_by_context_grant_id and cg.membership_id=new.assigned_by_membership_id
   and cg.tenant_id=new.tenant_id and cg.starts_at<=statement_timestamp()
   and (cg.ends_at is null or cg.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 select m.* into v_actor from identity.memberships m where m.id=new.assigned_by_membership_id
   and m.tenant_id=new.tenant_id and m.user_id=auth.uid() and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
      new.assigned_by_context_grant_id,new.tenant_id,new.scope_type,
      case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else null end)
 then raise exception 'workspace_role_authority_scope_exceeded' using errcode='42501'; end if;
 select wr.* into v_role from platform.workspace_roles wr
 where wr.id=new.workspace_role_id and wr.customer_workspace_id=new.customer_workspace_id
  and wr.tenant_id=new.tenant_id and wr.lifecycle_status='published'
  and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp());
 if not found then raise exception 'workspace_role_not_published' using errcode='42501'; end if;
 v_workspace_id:=case when new.scope_type='workspace' then new.customer_workspace_id end;
 v_scope_id:=case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else new.customer_workspace_id end;

 for v_pair in
   select distinct rp.permission_id,rm.module_definition_id,p.code permission_code,md.code module_code
   from platform.workspace_role_permissions rp
   join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
   join identity.permissions p on p.id=rp.permission_id
   join platform.module_definitions md on md.id=rm.module_definition_id
   where rp.workspace_role_id=new.workspace_role_id and rp.effect='allow'
 loop
   v_child_pairs:=v_child_pairs+1; v_pair_depth:=0;
   if not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=v_pair.module_definition_id and b.permission_id=v_pair.permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
   then raise exception 'workspace_role_grant_binding_invalid' using errcode='42501'; end if;
   if exists(select 1 from identity.role_permissions rp
      where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='deny') then
     raise exception 'workspace_role_grant_denied_by_assigner' using errcode='42501'; end if;

   v_source_kind:=null;v_source_role:=null;v_source_assignment:=null;
   if exists(select 1 from identity.role_permissions rp
       where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='allow')
      and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,v_pair.permission_id,v_pair.module_definition_id,
       new.scope_type,v_scope_id)
   then
     v_source_kind:='identity_role';v_source_role:=v_actor.role_id;
   else
     select parent.id,parent.authority_depth,parent.valid_to into v_parent
     from platform.workspace_member_roles parent
     join platform.workspace_roles pr on pr.id=parent.workspace_role_id
     join platform.workspace_role_permissions prp on prp.workspace_role_id=pr.id
     join platform.workspace_role_modules prm on prm.workspace_role_id=pr.id
     where parent.customer_workspace_id=new.customer_workspace_id
       and parent.membership_id=new.assigned_by_membership_id
       and parent.tenant_id=new.tenant_id and parent.authority_policy_version=2
       and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
       and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
       and prp.permission_id=v_pair.permission_id and prp.effect='allow'
       and prm.module_definition_id=v_pair.module_definition_id
       and app_private.workspace_role_scope_contains_v1(
         parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
         new.scope_type,new.property_id,new.building_id,new.unit_id)
       and app_private.workspace_member_role_authority_active_v1(
         parent.id,v_pair.permission_id,v_pair.module_definition_id,
         new.scope_type,v_scope_id,'{}'::uuid[])
     order by coalesce(parent.valid_to,'infinity'::timestamptz) asc
     limit 1;
     if not found then raise exception 'workspace_role_grant_source_missing' using errcode='42501'; end if;
     v_source_kind:='workspace_role_assignment';v_source_assignment:=v_parent.id;
     v_pair_depth:=v_parent.authority_depth+1; v_depth:=greatest(v_depth,v_pair_depth);
     if v_parent.valid_to is not null then
       v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),v_parent.valid_to);
     end if;
     if exists(
       with recursive lineage(id,membership_id,depth) as (
        select v_parent.id,new.assigned_by_membership_id,0
        union all
        select x.source_assignment_id,parent.membership_id,l.depth+1
        from lineage l
        join platform.workspace_member_role_authority_sources x on x.assignment_id=l.id
        join platform.workspace_member_roles parent on parent.id=x.source_assignment_id
        where x.source_assignment_id is not null and l.depth<4
       )
       select 1 from lineage where membership_id=new.membership_id
     ) then raise exception 'workspace_role_authority_cycle_prohibited' using errcode='42501'; end if;
   end if;
   insert into platform.workspace_member_role_authority_sources(
      assignment_id,permission_id,module_definition_id,source_kind,
      source_identity_role_id,source_assignment_id,authority_depth)
   values(new.id,v_pair.permission_id,v_pair.module_definition_id,v_source_kind,
      v_source_role,v_source_assignment,
      v_pair_depth);
 end loop;
 -- A deny-only role is valid and carries no delegable allow pairs.

 -- Require a strict proper subset of the assigner's currently effective,
 -- delegable authority pairs at this exact scope.
 select count(*) into v_parent_pairs from (
   select distinct p.permission_id,b.module_definition_id
   from identity.role_permissions p
   join platform.module_permission_bindings b on b.permission_id=p.permission_id
   join platform.module_definitions md on md.id=b.module_definition_id
   where p.role_id=v_actor.role_id and p.effect='allow'
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and md.is_active and md.lifecycle_status in ('active','published')
     and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp())
     and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,p.permission_id,b.module_definition_id,
       new.scope_type,v_scope_id)
   union
   select distinct rp.permission_id,rm.module_definition_id
   from platform.workspace_member_roles parent
   join platform.workspace_roles pr on pr.id=parent.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=pr.id and rp.effect='allow'
   join platform.workspace_role_modules rm on rm.workspace_role_id=pr.id
   join platform.module_permission_bindings b on b.permission_id=rp.permission_id and b.module_definition_id=rm.module_definition_id
   where parent.customer_workspace_id=new.customer_workspace_id
     and parent.membership_id=new.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       new.scope_type,new.property_id,new.building_id,new.unit_id)
     and app_private.workspace_member_role_authority_active_v1(
       parent.id,rp.permission_id,rm.module_definition_id,new.scope_type,v_scope_id,'{}'::uuid[])
 ) authority;
 if v_child_pairs>0 and v_child_pairs>=v_parent_pairs then
   raise exception 'workspace_role_peer_or_superior_grant_prohibited' using errcode='42501';
 end if;

 -- Cap expiry to target/grantor membership, exact grant context, role, inherited
 -- parent assignment and active workspace access basis. No active open-ended
 -- access basis exists in this schema, so open-ended assignments are impossible.
 v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),
   coalesce(new.valid_to,'infinity'::timestamptz),
   coalesce(v_actor.ends_at,'infinity'::timestamptz),
   coalesce((select m.ends_at from identity.memberships m where m.id=new.membership_id),'infinity'::timestamptz),
   coalesce(v_ctx.ends_at,'infinity'::timestamptz),
   coalesce(v_role.valid_to,'infinity'::timestamptz));
 select max(b.expires_at) into v_base_expiry from platform.workspace_access_bases b
 where b.customer_workspace_id=new.customer_workspace_id and b.status='active'
   and b.expires_at>statement_timestamp();
 if v_base_expiry is not null then v_cap:=least(v_cap,v_base_expiry); end if;
 if v_cap='infinity'::timestamptz or v_cap<=statement_timestamp() then
   raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 if new.valid_to is null or new.valid_to>v_cap then new.valid_to:=v_cap; end if;
 if new.valid_to<=statement_timestamp() then raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 new.authority_depth:=v_depth;
 return new;
end;
$$;


-- COMPOSED EFFECT B.OC1.F49
revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_authority_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F62
create or replace function app_private.native_workspace_scope_for_membership_v2(
  p_context_id uuid, p_membership_id uuid, p_workspace_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog
as $$
  select auth.uid() is not null and exists (
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
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and w.lifecycle_status='ACTIVE'
      and a.scope_type in ('workspace','property','building','unit')
      and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
      and wr.scope_ceiling in ('workspace','property','building','unit')
      and case a.scope_type
        when 'workspace' then wr.scope_ceiling='workspace'
        when 'property' then wr.scope_ceiling in ('workspace','property')
        when 'building' then wr.scope_ceiling in ('workspace','property','building')
        when 'unit' then wr.scope_ceiling in ('workspace','property','building','unit')
        else false end
      and wr.lifecycle_status='published'
      and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and (
        (a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null)
        or (a.scope_type='property' and a.building_id is null and a.unit_id is null
          and exists (
            select 1 from platform.workspace_property_bindings b
            where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
              and b.property_id=a.property_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='building' and a.property_id is null and a.unit_id is null
          and exists (
            select 1 from portfolio.buildings pb
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pb.id=a.building_id and pb.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='unit' and a.property_id is null and a.building_id is null
          and exists (
            select 1 from portfolio.units pu
            join portfolio.buildings pb on pb.id=pu.building_id and pb.tenant_id=pu.tenant_id
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pu.id=a.unit_id and pu.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
      )
      and (
        a.authority_policy_version=1
        or exists (
          select 1 from platform.workspace_role_permissions rp
          join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
          where rp.workspace_role_id=wr.id and rp.effect='allow'
            and app_private.workspace_member_role_authority_active_v1(
              a.id,rp.permission_id,rm.module_definition_id,
              a.scope_type,
              case a.scope_type when 'property' then a.property_id when 'building' then a.building_id
                when 'unit' then a.unit_id else null end,
              '{}'::uuid[])
        )
      )
  );
$$;


-- COMPOSED EFFECT B.OC1.F62
revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F83
create function app_private.resolve_workspace_native_context_v2(
  p_context_id uuid, p_workspace_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_id uuid,role_code text,status text)
language plpgsql stable security definer set search_path=pg_catalog
as $$
begin
  if auth.uid() is null or p_context_id is null or p_workspace_id is null then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  return query select w.id,m.tenant_id,m.id,m.role_id,r.code,'active'::text
    from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=m.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid()
      and app_private.native_workspace_scope_for_membership_v2(g.id,m.id,w.id);
  if not found then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
end;
$$;


-- COMPOSED EFFECT B.OC1.F83
revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F83
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F85
create or replace function app_private.check_direct_effective_permission_v2(
  p_context_id uuid,
  p_membership_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
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
    and cg.starts_at <= statement_timestamp()
    and (cg.ends_at is null or cg.ends_at > statement_timestamp());

  if not found then return false; end if;

  if p_explicit_workspace_id is not null then
    -- The direct helper also evaluates grantors for delegated permission.
    -- This internal check deliberately validates the supplied membership,
    -- while the top-level native resolver verifies the current caller owns it.
    if p_target_scope_type is distinct from 'workspace'
      or p_target_scope_id is distinct from p_explicit_workspace_id
      or not app_private.native_workspace_scope_for_membership_v2(
        p_context_id,p_membership_id,p_explicit_workspace_id) then return false; end if;
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
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
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
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

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
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

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
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
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
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

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
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
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
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
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
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
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
$$;


-- COMPOSED EFFECT B.OC1.F85
revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F85
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F80
create or replace function app_private.check_effective_permission_v2(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path =pg_catalog
as $$
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
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2(p_context_id,p_explicit_workspace_id);
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
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

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
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
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
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

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
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
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
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
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
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
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
        and mpb.valid_from<=statement_timestamp() and (mpb.valid_to is null or mpb.valid_to>statement_timestamp())))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
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
          and gcg.starts_at <= statement_timestamp()
          and (gcg.ends_at is null or gcg.ends_at > statement_timestamp())
          and app_private.check_direct_effective_permission_v2(
            gcg.id,
            wd.grantor_membership_id,
            p_permission_code,
            p_module_code,
            wd.scope_type,
            coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),
            p_explicit_workspace_id
          ) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;


-- COMPOSED EFFECT B.OC1.F80
revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F80
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F64
create function app_private.check_workspace_native_permission_v2(
 p_context_id uuid,p_workspace_id uuid,p_permission_code text,p_module_code text
) returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select case when p_context_id is null or p_workspace_id is null
 or p_permission_code is null or p_module_code is null then false else
 coalesce(app_private.check_effective_permission_v2(
 p_context_id,p_permission_code,p_module_code,'workspace',p_workspace_id,p_workspace_id),false) end; $$;


-- COMPOSED EFFECT B.OC1.F64
revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F71
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


-- COMPOSED EFFECT B.OC1.F71
revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F71
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F15
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


-- COMPOSED EFFECT B.OC1.F15
revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F54
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


-- COMPOSED EFFECT B.OC1.F54
revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F70
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


-- COMPOSED EFFECT B.OC1.F70
revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F70
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT G2.DOMAIN

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


-- COMPOSED EFFECT B.F01
create function customer_api.create_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_building_setup_v2(p_context_id,p_workspace_id,p_idempotency_key,p_payload)$$;


-- COMPOSED EFFECT B.OC1.F01
revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F02
create function customer_api.get_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_v2(p_context_id,p_workspace_id,p_run_id)$$;


-- COMPOSED EFFECT B.OC1.F02
revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F14
create function customer_api.get_building_setup_attempt_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_attempt_v2(p_context_id,p_workspace_id,p_idempotency_key)$$;


-- COMPOSED EFFECT B.OC1.F14
revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F55
create function app_private.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'rehearse',null,null)$$;


-- COMPOSED EFFECT B.OC1.F55
revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F56
create function app_private.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'submit',null,null)$$;


-- COMPOSED EFFECT B.OC1.F56
revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F57
create function app_private.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'approve',null,p_expected_payload_hash)$$;


-- COMPOSED EFFECT B.OC1.F57
revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F58
create function app_private.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'provision',null,null)$$;


-- COMPOSED EFFECT B.OC1.F58
revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F59
create function app_private.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'update',p_units,null)$$;


-- COMPOSED EFFECT B.OC1.F59
revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F03
create function customer_api.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.rehearse_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- COMPOSED EFFECT B.OC1.F03
revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F04
create function customer_api.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.submit_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- COMPOSED EFFECT B.OC1.F04
revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F05
create function customer_api.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.approve_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_expected_payload_hash)$$;


-- COMPOSED EFFECT B.OC1.F05
revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F06
create function customer_api.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.provision_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;


-- COMPOSED EFFECT B.OC1.F06
revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.F07
create function customer_api.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.update_building_setup_units_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_units)$$;


-- COMPOSED EFFECT B.OC1.F07
revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.F07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.G01
create trigger tenants_updated_at before update on platform.tenants for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G02
create trigger profiles_updated_at before update on identity.profiles for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G03
create trigger memberships_updated_at before update on identity.memberships for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G04
create trigger customer_workspaces_activation_gate
before update of lifecycle_status on platform.customer_workspaces
for each row execute function platform.enforce_workspace_activation_gate();


-- COMPOSED EFFECT B.G05
create trigger accounting_periods_immutable before update or delete on finance.accounting_periods
for each row execute function finance.protect_accounting_period();


-- COMPOSED EFFECT B.G06
create trigger trg_assert_accounting_period_no_overlap
before insert or update on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_no_overlap();


-- COMPOSED EFFECT B.G07
create trigger a_assert_accounting_period_property_tenant
before insert or update of tenant_id, property_id on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_property_tenant();


-- COMPOSED EFFECT B.G08
create trigger property_profiles_updated_at before update on platform.property_profiles for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G09
create trigger operating_models_updated_at before update on platform.operating_models for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G10
create trigger space_kinds_updated_at before update on platform.space_kinds for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G11
create trigger ws_taxonomy_assignments_updated_at before update on platform.workspace_taxonomy_assignments for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G12
create trigger ws_property_bindings_updated_at before update on platform.workspace_property_bindings for each row execute function app_private.set_updated_at();


-- COMPOSED EFFECT B.G13
create trigger guard_property_profiles_version_overlap
before insert or update on platform.property_profiles
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- COMPOSED EFFECT B.G14
create trigger guard_operating_models_version_overlap
before insert or update on platform.operating_models
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- COMPOSED EFFECT B.G15
create trigger guard_space_kinds_version_overlap
before insert or update on platform.space_kinds
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- COMPOSED EFFECT B.G16
create trigger guard_property_profiles_immutability before delete on platform.property_profiles for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- COMPOSED EFFECT B.G17
create trigger guard_operating_models_immutability before delete on platform.operating_models for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- COMPOSED EFFECT B.G18
create trigger guard_space_kinds_immutability before delete on platform.space_kinds for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- COMPOSED EFFECT B.G19
create trigger a_guard_ws_taxonomy_assignments_history
before update or delete on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_history_v1();


-- COMPOSED EFFECT B.G20
create trigger a_guard_ws_property_bindings_history
before update or delete on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_history_v1();


-- COMPOSED EFFECT B.G21
create trigger guard_ws_property_binding_before_ins_upd
before insert or update on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_v1();


-- COMPOSED EFFECT B.G22
create trigger guard_ws_taxonomy_assignment_before_ins_upd
before insert or update on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_v1();


-- COMPOSED EFFECT B.G23
create trigger trg_bootstrap_role_taxonomy_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_taxonomy_permissions_v1();


-- COMPOSED EFFECT B.G24
create trigger trg_bootstrap_role_module_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_module_permissions_v1();


-- COMPOSED EFFECT B.G25
create trigger trg_guard_module_definition_immutability
before update or delete on platform.module_definitions
for each row
execute function app_private.guard_module_definition_immutability_v1();


-- COMPOSED EFFECT B.G26
create trigger trg_guard_module_definition_effective_period
before insert or update on platform.module_definitions
for each row
execute function app_private.guard_module_definition_effective_period_v1();


-- COMPOSED EFFECT B.G27
create trigger trg_guard_workspace_module_code_sync
before insert or update on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_code_sync_v1();


-- COMPOSED EFFECT B.G28
create trigger trg_guard_workspace_module_immutability
before update or delete on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_immutability_v1();


-- COMPOSED EFFECT B.G29
create trigger trg_bootstrap_role_workspace_role_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_role_permissions_v1();


-- COMPOSED EFFECT B.G30
create trigger trg_guard_module_permission_binding_invariants
before insert or update on platform.module_permission_bindings
for each row
execute function app_private.guard_module_permission_binding_invariants_v1();


-- COMPOSED EFFECT B.G31
create trigger trg_guard_workspace_role_immutability
before update or delete on platform.workspace_roles
for each row
execute function app_private.guard_workspace_role_immutability_v1();


-- COMPOSED EFFECT B.G32
create trigger trg_guard_workspace_role_module_draft_only
before insert or update or delete on platform.workspace_role_modules
for each row
execute function app_private.guard_workspace_role_module_draft_only_v1();


-- COMPOSED EFFECT B.G33
create trigger trg_guard_workspace_role_permission_bindings
before insert or update or delete on platform.workspace_role_permissions
for each row
execute function app_private.guard_workspace_role_permission_bindings_v1();


-- COMPOSED EFFECT B.G34
create trigger trg_guard_workspace_member_role_invariants
before insert or update or delete on platform.workspace_member_roles
for each row
execute function app_private.guard_workspace_member_role_invariants_v1();


-- COMPOSED EFFECT B.G35
create trigger trg_bootstrap_role_workspace_delegation_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_delegation_permissions_v1();


-- COMPOSED EFFECT B.G36
create trigger cap_customer_membership_to_access_basis
before insert or update on identity.memberships
for each row execute function platform.cap_customer_membership_to_access_basis();


-- COMPOSED EFFECT B.G37
create trigger cap_customer_context_to_membership
before insert or update on identity.context_grants
for each row execute function platform.cap_customer_context_to_membership();


-- COMPOSED EFFECT B.G38
create trigger require_workspace_access_basis_for_provisioning
before update of lifecycle_status on platform.customer_workspaces
for each row execute function platform.require_workspace_access_basis_for_provisioning();


-- COMPOSED EFFECT B.G39
create trigger guard_undefined_workspace_access_basis_role
before insert or update of role_id,customer_workspace_id on platform.workspace_access_bases
for each row execute function app_private.guard_undefined_primary_role_v1();


-- COMPOSED EFFECT B.G40
create trigger end_pilot_reviewers_with_basis after update of status on platform.workspace_access_bases
for each row execute function platform.end_pilot_reviewers_with_basis();


-- COMPOSED EFFECT B.G41
create trigger bind_provisioned_building_workspace
after update of status on platform.building_setup_runs
for each row execute function app_private.bind_provisioned_building_workspace_v1();


-- COMPOSED EFFECT B.G42
create trigger trg_workspace_role_authority_source_immutable
before update or delete on platform.workspace_member_role_authority_sources
for each row execute function app_private.guard_workspace_role_authority_source_immutable_v1();


-- COMPOSED EFFECT B.G43
create trigger trg_workspace_member_role_authority_v2
before insert or update on platform.workspace_member_roles
for each row execute function app_private.guard_workspace_member_role_authority_v2();


-- COMPOSED EFFECT B.G44
create trigger canonical_authority_revision_guard
before insert or update or delete on app_private.canonical_authority_revision_v1
for each row execute function app_private.guard_authority_revision_v1();


-- COMPOSED EFFECT B.G45
create trigger canonical_authority_revision_truncate_guard
before truncate on app_private.canonical_authority_revision_v1
for each statement execute function app_private.guard_authority_revision_v1();


-- COMPOSED EFFECT B.G46
create trigger jurisdiction_bound_property_address_guard
before update of address_id on portfolio.properties
for each row execute function app_private.guard_jurisdiction_bound_property_address_v1();


-- COMPOSED EFFECT B.G47
create trigger protect_setup_creation_v2 before update on platform.building_setup_runs
 for each row execute function app_private.protect_setup_creation_v2();


-- COMPOSED EFFECT B.G48
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.context_grants
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G49
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.memberships
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G50
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G51
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G52
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G53
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.customer_workspaces
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G54
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_definitions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G55
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_operating_model_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G56
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_permission_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G57
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_property_profile_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G58
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.operating_models
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G59
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.property_profiles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G60
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_entitlements
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G61
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_role_authority_sources
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G62
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G63
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G64
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_property_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G65
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G66
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G67
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G68
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_taxonomy_assignments
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G69
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.buildings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.G70
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.units
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- COMPOSED EFFECT B.X01
create index outbox_unpublished_idx on platform.outbox_events (occurred_at, id) where published_at is null;


-- COMPOSED EFFECT B.X02
create unique index memberships_active_unique on identity.memberships (tenant_id,user_id,role_id) where status in ('invited','active');


-- COMPOSED EFFECT B.X03
create index properties_tenant_status_idx on portfolio.properties(tenant_id,status,id);


-- COMPOSED EFFECT B.X04
create index buildings_tenant_property_idx on portfolio.buildings(tenant_id,property_id,id);


-- COMPOSED EFFECT B.X05
create index units_tenant_building_idx on portfolio.units(tenant_id,building_id,status,id);


-- COMPOSED EFFECT B.X06
create index audit_events_tenant_time_idx on audit.events(tenant_id,occurred_at desc,id desc);


-- COMPOSED EFFECT B.X07
create index customer_workspaces_tenant_idx on platform.customer_workspaces (tenant_id);


-- COMPOSED EFFECT B.X08
create index customer_workspaces_status_idx on platform.customer_workspaces (lifecycle_status);


-- COMPOSED EFFECT B.X09
create index customer_workspaces_env_idx on platform.customer_workspaces (environment);


-- COMPOSED EFFECT B.X10
create index workspace_contracts_workspace_idx on platform.workspace_contracts (customer_workspace_id, status);


-- COMPOSED EFFECT B.X11
create index workspace_entitlements_lookup_idx on platform.workspace_entitlements (customer_workspace_id, entitlement_key);


-- COMPOSED EFFECT B.X12
create index if not exists audit_events_actor_id_idx
  on audit.events (actor_id);


-- COMPOSED EFFECT B.X13
create index if not exists workspace_contracts_plan_id_idx
  on platform.workspace_contracts (plan_id);


-- COMPOSED EFFECT B.X14
create index if not exists workspace_entitlements_contract_id_idx
  on platform.workspace_entitlements (contract_id);


-- COMPOSED EFFECT B.X15
create index if not exists workspace_entitlements_override_approved_by_idx
  on platform.workspace_entitlements (override_approved_by);


-- COMPOSED EFFECT B.X16
create index customer_workspaces_primary_admin_user_idx
  on platform.customer_workspaces (primary_admin_user_id);


-- COMPOSED EFFECT B.X17
create index customer_workspaces_primary_admin_membership_idx
  on platform.customer_workspaces (primary_admin_membership_id);


-- COMPOSED EFFECT B.X18
create index customer_workspaces_onboarding_completed_by_idx
  on platform.customer_workspaces (onboarding_completed_by);


-- COMPOSED EFFECT B.X19
create index if not exists subscription_plans_browse_idx
  on platform.subscription_plans (status, plan_code, version desc);


-- COMPOSED EFFECT B.X20
create unique index if not exists subscription_plans_one_active_code_idx
  on platform.subscription_plans (plan_code) where status = 'active';


-- COMPOSED EFFECT B.X21
create index if not exists workspace_contracts_plan_workspace_idx
  on platform.workspace_contracts (plan_id, customer_workspace_id) where plan_id is not null;


-- COMPOSED EFFECT B.X22
create index if not exists audit_events_action_time_idx
  on audit.events(action, occurred_at desc, id desc);


-- COMPOSED EFFECT B.X23
create index if not exists audit_events_entity_time_idx
  on audit.events(entity_type, occurred_at desc, id desc);


-- COMPOSED EFFECT B.X24
create index accounting_periods_scope_date_idx on finance.accounting_periods(tenant_id,property_id,starts_on,ends_on);


-- COMPOSED EFFECT B.X25
create index accounting_periods_property_id_idx on finance.accounting_periods(property_id);


-- COMPOSED EFFECT B.X26
create unique index context_grants_open_tenant_unique
  on identity.context_grants (membership_id, tenant_id, scope_type)
  where scope_type = 'tenant'
    and property_id is null
    and building_id is null
    and unit_id is null
    and ends_at is null;


-- COMPOSED EFFECT B.X27
create index if not exists accounting_periods_closed_by_idx on finance.accounting_periods(closed_by);


-- COMPOSED EFFECT B.X28
create index building_setup_runs_workspace_idx on platform.building_setup_runs(customer_workspace_id,status,id);


-- COMPOSED EFFECT B.X29
create index building_setup_runs_created_by_idx on platform.building_setup_runs(created_by);


-- COMPOSED EFFECT B.X30
create index building_setup_runs_submitted_by_idx on platform.building_setup_runs(submitted_by) where submitted_by is not null;


-- COMPOSED EFFECT B.X31
create index building_setup_runs_approved_by_idx on platform.building_setup_runs(approved_by) where approved_by is not null;


-- COMPOSED EFFECT B.X32
create index property_profiles_code_ver_idx on platform.property_profiles (code, version);


-- COMPOSED EFFECT B.X33
create index operating_models_code_ver_idx on platform.operating_models (code, version);


-- COMPOSED EFFECT B.X34
create index space_kinds_code_ver_idx on platform.space_kinds (code, version);


-- COMPOSED EFFECT B.X35
create index prop_op_compat_lookup_idx on platform.property_operating_model_compatibilities (property_profile_id, operating_model_id);


-- COMPOSED EFFECT B.X36
create index prop_space_compat_lookup_idx on platform.property_space_kind_compatibilities (property_profile_id, space_kind_id);


-- COMPOSED EFFECT B.X37
create index ws_taxonomy_assignments_lookup_idx on platform.workspace_taxonomy_assignments (tenant_id, customer_workspace_id, status);


-- COMPOSED EFFECT B.X38
create index ws_prop_bindings_lookup_idx on platform.workspace_property_bindings (tenant_id, property_id, status);


-- COMPOSED EFFECT B.X39
create index ws_prop_bindings_ws_idx on platform.workspace_property_bindings (customer_workspace_id, status);


-- COMPOSED EFFECT B.X40
create index module_definitions_code_ver_idx on platform.module_definitions (code, version);


-- COMPOSED EFFECT B.X41
create index module_definitions_lifecycle_idx on platform.module_definitions (lifecycle_status, is_active);


-- COMPOSED EFFECT B.X42
create index mod_prop_compat_lookup_idx on platform.module_property_profile_compatibilities (module_definition_id, property_profile_id);


-- COMPOSED EFFECT B.X43
create index mod_op_compat_lookup_idx on platform.module_operating_model_compatibilities (module_definition_id, operating_model_id);


-- COMPOSED EFFECT B.X44
create index ws_modules_ws_code_idx on platform.workspace_modules (customer_workspace_id, module_code);


-- COMPOSED EFFECT B.X45
create index ws_modules_tenant_ws_idx on platform.workspace_modules (tenant_id, customer_workspace_id);


-- COMPOSED EFFECT B.X46
create unique index uq_workspace_modules_active_code on platform.workspace_modules (customer_workspace_id, module_code) where (valid_to is null);


-- COMPOSED EFFECT B.X47
create unique index module_permission_bindings_active_idx
  on platform.module_permission_bindings (module_definition_id, permission_id)
  where (lifecycle_status = 'active' and valid_to is null);


-- COMPOSED EFFECT B.X48
create index mod_perm_bindings_lookup_idx
  on platform.module_permission_bindings (module_definition_id, permission_id, lifecycle_status);


-- COMPOSED EFFECT B.X49
create unique index workspace_roles_active_published_idx
  on platform.workspace_roles (customer_workspace_id, code)
  where (lifecycle_status = 'published' and valid_to is null);


-- COMPOSED EFFECT B.X50
create index ws_roles_tenant_ws_idx
  on platform.workspace_roles (tenant_id, customer_workspace_id, lifecycle_status);


-- COMPOSED EFFECT B.X51
create index ws_role_modules_lookup_idx
  on platform.workspace_role_modules (workspace_role_id, module_definition_id);


-- COMPOSED EFFECT B.X52
create index ws_role_permissions_lookup_idx
  on platform.workspace_role_permissions (workspace_role_id, permission_id, effect);


-- COMPOSED EFFECT B.X53
create index ws_member_roles_active_lookup_idx
  on platform.workspace_member_roles (customer_workspace_id, membership_id, workspace_role_id)
  where (valid_to is null);


-- COMPOSED EFFECT B.X54
create index ws_member_roles_tenant_idx
  on platform.workspace_member_roles (tenant_id, customer_workspace_id);


-- COMPOSED EFFECT B.X55
create index ws_role_idempotency_lookup_idx
  on platform.workspace_role_idempotency (tenant_id, customer_workspace_id, action);


-- COMPOSED EFFECT B.X56
create index ws_delegations_lookup_idx
  on platform.workspace_delegations (customer_workspace_id, lifecycle_status, valid_from, valid_until);


-- COMPOSED EFFECT B.X57
create index ws_delegations_grantee_idx
  on platform.workspace_delegations (customer_workspace_id, grantee_membership_id, lifecycle_status);


-- COMPOSED EFFECT B.X58
create index ws_delegations_grantor_idx
  on platform.workspace_delegations (customer_workspace_id, grantor_membership_id, lifecycle_status);


-- COMPOSED EFFECT B.X59
create index ws_del_perms_delegation_idx
  on platform.workspace_delegation_permissions (delegation_id);


-- COMPOSED EFFECT B.X60
create unique index workspace_access_bases_open_email
  on platform.workspace_access_bases(customer_workspace_id, normalized_email)
  where status in ('prepared','active');


-- COMPOSED EFFECT B.X61
create unique index workspace_access_bases_payment_reference
  on platform.workspace_access_bases(payment_currency, payment_reference)
  where mode='PAID' and status in ('prepared','active');


-- COMPOSED EFFECT B.X62
create index workspace_access_bases_expiry on platform.workspace_access_bases(expires_at)
  where status = 'active';


-- COMPOSED EFFECT B.X63
create unique index pilot_setup_reviewers_open_email on platform.pilot_setup_reviewers(customer_workspace_id,normalized_email)
 where status in ('prepared','active');


-- COMPOSED EFFECT B.X64
create index workspace_role_authority_source_parent_idx
 on platform.workspace_member_role_authority_sources(source_assignment_id)
 where source_assignment_id is not null;


-- COMPOSED EFFECT B.X65
create index jurisdiction_profiles_country_status_idx
  on platform.jurisdiction_profiles(country_code,status,valid_from,valid_to);


-- COMPOSED EFFECT B.X66
create index property_jurisdiction_current_idx
  on platform.property_jurisdiction_assignments
  (tenant_id,property_id,status,valid_from,valid_to);


-- COMPOSED EFFECT B.X67
create index property_jurisdiction_workspace_idx
  on platform.property_jurisdiction_assignments
  (customer_workspace_id,property_id,status);


-- COMPOSED EFFECT B.X68
create unique index journals_source_unique on finance.journals(tenant_id,source_type,source_id) where source_id is not null;


-- COMPOSED EFFECT B.X69
create index journal_entries_journal_idx on finance.journal_entries(tenant_id,journal_id,id);


-- COMPOSED EFFECT B.X70
create index journal_entries_account_date_idx on finance.journal_entries(tenant_id,account_id,journal_id);


-- COMPOSED EFFECT B.E056
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_guard;


-- COMPOSED EFFECT B.E057
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_truncate_guard;


-- COMPOSED EFFECT B.E058
alter table identity.context_grants enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E059
alter table identity.memberships enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E060
alter table identity.permissions enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E061
alter table identity.role_permissions enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E062
alter table identity.roles enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E063
alter table platform.customer_workspaces enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E064
alter table platform.module_definitions enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E065
alter table platform.module_operating_model_compatibilities enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E066
alter table platform.module_permission_bindings enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E067
alter table platform.module_property_profile_compatibilities enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E068
alter table platform.operating_models enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E069
alter table platform.property_profiles enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E070
alter table platform.workspace_delegation_permissions enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E071
alter table platform.workspace_delegations enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E072
alter table platform.workspace_entitlements enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E073
alter table platform.workspace_member_role_authority_sources enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E074
alter table platform.workspace_member_roles enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E075
alter table platform.workspace_modules enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E076
alter table platform.workspace_property_bindings enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E077
alter table platform.workspace_role_modules enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E078
alter table platform.workspace_role_permissions enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E079
alter table platform.workspace_roles enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E080
alter table platform.workspace_taxonomy_assignments enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E081
alter table portfolio.buildings enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.E082
alter table portfolio.units enable always trigger canonical_authority_revision_changed;


-- COMPOSED EFFECT B.SD01
insert into identity.roles(tenant_id,code,name,is_system) values (null,'association_admin','Association Administrator',true);


-- COMPOSED EFFECT B.SD02
insert into identity.roles(tenant_id,code,name,is_system) values (null,'property_manager','Property Manager',true);


-- COMPOSED EFFECT B.SD03
insert into identity.roles(tenant_id,code,name,is_system) values (null,'president','Association President',true);


-- COMPOSED EFFECT B.SD04
insert into identity.roles(tenant_id,code,name,is_system) values (null,'censor','Censor / Financial Auditor',true);


-- COMPOSED EFFECT B.SD05
insert into identity.roles(tenant_id,code,name,is_system) values (null,'owner','Owner',true);


-- COMPOSED EFFECT B.SD06
insert into identity.roles(tenant_id,code,name,is_system) values (null,'tenant_resident','Tenant / Resident',true);


-- COMPOSED EFFECT B.SD07
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.read','onboarding.import','read','Read controlled onboarding imports');


-- COMPOSED EFFECT B.SD08
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.manage','onboarding.import','manage','Create, upload, validate and dry-run onboarding imports');


-- COMPOSED EFFECT B.SD09
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.approve','onboarding.import','approve','Independently approve, reconcile and activate onboarding imports');


-- COMPOSED EFFECT B.SD10
insert into identity.permissions(code,resource,action,description) values ('workspace.taxonomy.manage', 'workspace.taxonomy', 'manage', 'Assign and transition workspace universal taxonomy profiles and operating models');


-- COMPOSED EFFECT B.SD11
insert into identity.permissions(code,resource,action,description) values ('workspace.module.manage', 'workspace.module', 'manage', 'Activate, configure, and deactivate workspace dynamic composition modules');


-- COMPOSED EFFECT B.SD12
insert into identity.permissions(code,resource,action,description) values ('workspace.role.read', 'workspace.role', 'read', 'View workspace-local roles, module bindings, and member assignments');


-- COMPOSED EFFECT B.SD13
insert into identity.permissions(code,resource,action,description) values ('workspace.role.manage', 'workspace.role', 'manage', 'Create and modify draft workspace-local roles, module attachments, and permission attachments');


-- COMPOSED EFFECT B.SD14
insert into identity.permissions(code,resource,action,description) values ('workspace.role.publish', 'workspace.role', 'publish', 'Publish and supersede workspace-local roles with atomic version transition');


-- COMPOSED EFFECT B.SD15
insert into identity.permissions(code,resource,action,description) values ('workspace.role.assign', 'workspace.role', 'assign', 'Assign and revoke workspace-local roles to workspace members with scope boundaries');


-- COMPOSED EFFECT B.SD16
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.read', 'workspace.delegation', 'read', 'View workspace delegations, permission bindings, and audit trails');


-- COMPOSED EFFECT B.SD17
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.manage', 'workspace.delegation', 'manage', 'Create delegation drafts, attach/detach permissions, and submit for acceptance');


-- COMPOSED EFFECT B.SD18
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.approve', 'workspace.delegation', 'approve', 'Execute independent Four-Eyes approval or rejection decisions');


-- COMPOSED EFFECT B.SD19
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.revoke', 'workspace.delegation', 'revoke', 'Execute administrative or emergency revocation of active delegations');


-- COMPOSED EFFECT B.SD20
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.read';


-- COMPOSED EFFECT B.SD21
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.manage';


-- COMPOSED EFFECT B.SD22
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='onboarding.import.read';


-- COMPOSED EFFECT B.SD23
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='onboarding.import.manage';


-- COMPOSED EFFECT B.SD24
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.approve';


-- COMPOSED EFFECT B.SD25
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='onboarding.import.read';


-- COMPOSED EFFECT B.SD26
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='onboarding.import.approve';


-- COMPOSED EFFECT B.SD27
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='onboarding.import.read';


-- COMPOSED EFFECT B.SD28
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='onboarding.import.approve';


-- COMPOSED EFFECT B.SD29
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.taxonomy.manage';


-- COMPOSED EFFECT B.SD30
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.module.manage';


-- COMPOSED EFFECT B.SD31
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.read';


-- COMPOSED EFFECT B.SD32
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.manage';


-- COMPOSED EFFECT B.SD33
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.publish';


-- COMPOSED EFFECT B.SD34
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.assign';


-- COMPOSED EFFECT B.SD35
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.read';


-- COMPOSED EFFECT B.SD36
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.manage';


-- COMPOSED EFFECT B.SD37
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.approve';


-- COMPOSED EFFECT B.SD38
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.revoke';


-- COMPOSED EFFECT B.SD39
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.taxonomy.manage';


-- COMPOSED EFFECT B.SD40
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.module.manage';


-- COMPOSED EFFECT B.SD41
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.read';


-- COMPOSED EFFECT B.SD42
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.manage';


-- COMPOSED EFFECT B.SD43
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.publish';


-- COMPOSED EFFECT B.SD44
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.assign';


-- COMPOSED EFFECT B.SD45
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.read';


-- COMPOSED EFFECT B.SD46
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.manage';


-- COMPOSED EFFECT B.SD47
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.approve';


-- COMPOSED EFFECT B.SD48
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.revoke';


-- COMPOSED EFFECT B.SD49
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.role.read';


-- COMPOSED EFFECT B.SD50
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.role.read';


-- COMPOSED EFFECT B.SD51
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.read';


-- COMPOSED EFFECT B.SD52
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.approve';


-- COMPOSED EFFECT B.SD53
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.revoke';


-- COMPOSED EFFECT B.SD54
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.delegation.read';


-- COMPOSED EFFECT B.SD55
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.delegation.approve';


-- COMPOSED EFFECT B.SD56
insert into platform.property_profiles(code,version,name,labels_json,description) values ('residential_condominium', 1, 'Residential Condominium', jsonb_build_object('en','Residential Condominium','ro','Condominiu rezidențial','fa','مجتمع آپارتمانی مسکونی'), 'Apartment building or condominium block under co-ownership governance');


-- COMPOSED EFFECT B.SD57
insert into platform.operating_models(code,version,name,labels_json,description) values ('association_managed', 1, 'Owners Association Managed', jsonb_build_object('en','Owners Association Managed','ro','Administrare prin Asociație de Proprietari','fa','مدیریت هیئت مدیره / انجمن مالکان'), 'Statutory condominium or HOA association governance under co-ownership law');


-- COMPOSED EFFECT B.SD58
insert into platform.space_kinds(code,version,name,labels_json,description) values ('residential_unit', 1, 'Residential Unit', jsonb_build_object('en','Residential Unit','ro','Apartament / Unitate rezidențială','fa','واحد مسکونی / آپارتمان'), 'Private apartment or residential living space');


-- COMPOSED EFFECT B.SD59
insert into platform.property_operating_model_compatibilities (property_profile_id, operating_model_id, compatibility_level, reason)
select p.id, m.id,
  case
    -- Condominium
    when p.code = 'residential_condominium' and m.code in ('association_managed', 'third_party_managed') then 'compatible'
    when p.code = 'residential_condominium' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and m.code in ('association_managed', 'third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'residential_complex' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and m.code in ('association_managed', 'third_party_managed', 'multi_owner_contractual') then 'compatible'
    when p.code = 'gated_villa_community' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed-Use Estate
    when p.code = 'mixed_use_estate' and m.code in ('mixed_authority', 'third_party_managed', 'institutional_owner') then 'compatible'
    when p.code = 'mixed_use_estate' and m.code in ('association_managed', 'developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'retail_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'office_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse Logistics
    when p.code = 'warehouse_logistics' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' and m.code in ('mixed_authority', 'third_party_managed', 'developer_operated', 'institutional_owner') then 'compatible'
    when p.code = 'managed_township' then 'incompatible'

    -- Industrial Park
    when p.code = 'industrial_park' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'mixed_authority') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'institutional_owner') then 'compatible'
    when p.code = 'serviced_residence' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'mixed_authority') then 'compatible'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and m.code in ('third_party_managed', 'single_owner_operated', 'mixed_authority') then 'compatible'
    when p.code = 'shared_facility' and m.code = 'association_managed' then 'review_required'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' and m.code in ('developer_operated', 'third_party_managed') then 'compatible'
    when p.code = 'developer_portfolio' then 'incompatible'

    -- Third-Party Portfolio
    when p.code = 'third_party_management_portfolio' and m.code in ('third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'third_party_management_portfolio' then 'incompatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural compatibility matrix v1.0' as reason
from platform.property_profiles p
cross join platform.operating_models m;


-- COMPOSED EFFECT B.SD60
insert into platform.property_space_kind_compatibilities (property_profile_id, space_kind_id, compatibility_level, reason)
select p.id, s.id,
  case
    -- Condominium Allowed Spaces
    when p.code = 'residential_condominium' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'technical_room', 'service_point', 'roof_deck') then 'compatible'
    when p.code = 'residential_condominium' and s.code in ('retail_unit', 'amenity', 'shared_facility', 'courtyard_garden') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'roof_deck', 'infrastructure_node') then 'compatible'
    when p.code = 'residential_complex' and s.code in ('retail_unit', 'provider_location') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and s.code in ('villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'infrastructure_node', 'yard', 'land_parcel') then 'compatible'
    when p.code = 'gated_villa_community' and s.code in ('provider_location', 'retail_unit') then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and s.code in ('villa', 'parking_space', 'storage_space', 'courtyard_garden', 'amenity', 'technical_room', 'yard', 'land_parcel') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space') then 'compatible'
    when p.code = 'small_landlord_portfolio' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed Use Estate
    when p.code = 'mixed_use_estate' and s.code in ('residential_unit', 'retail_unit', 'office_suite', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'amenity', 'service_point', 'provider_location', 'technical_room', 'courtyard_garden', 'roof_deck', 'infrastructure_node', 'loading_zone') then 'compatible'
    when p.code = 'mixed_use_estate' and s.code in ('warehouse_bay', 'yard', 'land_parcel') then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and s.code in ('retail_unit', 'parking_space', 'storage_space', 'common_area', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node', 'amenity', 'loading_zone') then 'compatible'
    when p.code = 'retail_centre' and s.code in ('office_suite', 'warehouse_bay', 'yard') then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and s.code in ('office_suite', 'retail_unit', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node') then 'compatible'
    when p.code = 'office_centre' and s.code in ('warehouse_bay', 'loading_zone', 'yard') then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse & Logistics
    when p.code = 'warehouse_logistics' and s.code in ('warehouse_bay', 'industrial_lot', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point', 'yard', 'loading_zone') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' then 'compatible'

    -- Industrial Park
    when p.code = 'industrial_park' and s.code in ('industrial_lot', 'factory_hall', 'warehouse_bay', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point', 'yard', 'loading_zone', 'land_parcel') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'service_point', 'provider_location', 'technical_room') then 'compatible'
    when p.code = 'serviced_residence' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and s.code in ('parking_space', 'technical_room', 'service_point', 'infrastructure_node') then 'compatible'
    when p.code = 'standalone_parking' and s.code = 'storage_space' then 'review_required'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and s.code in ('shared_facility', 'amenity', 'service_point', 'common_area', 'technical_room', 'parking_space', 'provider_location') then 'compatible'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' then 'compatible'

    -- Third-Party Management Portfolio
    when p.code = 'third_party_management_portfolio' then 'compatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural space kind matrix v1.0' as reason
from platform.property_profiles p
cross join platform.space_kinds s;


-- COMPOSED EFFECT B.SD61
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


-- COMPOSED EFFECT B.OC1.FINAL.T04
revoke all privileges on table identity.permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T04
revoke select ("id","code","resource","action","description"), insert ("id","code","resource","action","description"), update ("id","code","resource","action","description"), references ("id","code","resource","action","description") on table identity.permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T04
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T13
revoke all privileges on type identity.scope_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T13
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.scope_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.scope_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T15
revoke all privileges on table platform.module_definitions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T15
revoke select ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), update ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), references ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at") on table platform.module_definitions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T15
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_definitions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_definitions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_definitions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_definitions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T25
revoke all privileges on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T25
revoke select ("singleton","revision"), insert ("singleton","revision"), update ("singleton","revision"), references ("singleton","revision") on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T25
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='app_private.canonical_authority_revision_v1'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table app_private.canonical_authority_revision_v1 from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='app_private.canonical_authority_revision_v1'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table app_private.canonical_authority_revision_v1 from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T38
revoke all privileges on table identity.profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T38
revoke select ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), insert ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), update ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), references ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at") on table identity.profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T38
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T42
revoke all privileges on type platform.decision_effect from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.decision_effect'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.decision_effect from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T43
revoke all privileges on type platform.record_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.record_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.record_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T44
revoke all privileges on type platform.workspace_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T45
revoke all privileges on type platform.workspace_lifecycle_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_lifecycle_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_lifecycle_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T46
revoke all privileges on type platform.workspace_environment from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_environment'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_environment from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T47
revoke all privileges on type portfolio.property_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T47
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.property_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.property_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T49
revoke all privileges on type identity.membership_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.membership_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.membership_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T52
revoke all privileges on type portfolio.unit_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.unit_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.unit_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T53
revoke all privileges on type finance.accounting_period_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.accounting_period_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.accounting_period_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T54
revoke all privileges on type finance.journal_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.journal_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.journal_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T57
revoke all privileges on type finance.entry_side from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.entry_side'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.entry_side from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T59
revoke all privileges on table platform.subscription_plans from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T59
revoke select ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), insert ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), update ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), references ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at") on table platform.subscription_plans from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T59
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.subscription_plans'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.subscription_plans from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.subscription_plans'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.subscription_plans from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T60
revoke all privileges on type finance.account_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.account_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.account_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T61
revoke all privileges on type portfolio.party_type from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T61
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.party_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.party_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T63
revoke all privileges on type platform.property_jurisdiction_assignment_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T63
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.property_jurisdiction_assignment_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.property_jurisdiction_assignment_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T66
revoke all privileges on type platform.jurisdiction_profile_status from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T66
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.jurisdiction_profile_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.jurisdiction_profile_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T01
revoke all privileges on table platform.tenants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T01
revoke select ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), insert ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), update ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), references ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at") on table platform.tenants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T01
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.tenants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.tenants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.tenants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.tenants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T09
revoke all privileges on table platform.property_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T09
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.property_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T09
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T09
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T10
revoke all privileges on table platform.operating_models from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T10
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.operating_models from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T10
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.operating_models'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.operating_models from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T10
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.operating_models'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.operating_models from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T19
revoke all privileges on table platform.space_kinds from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T19
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.space_kinds from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T19
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.space_kinds'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.space_kinds from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.space_kinds'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.space_kinds from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T22
revoke all privileges on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T22
revoke select ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), insert ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), update ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), references ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at") on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T22
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_permission_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_permission_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_permission_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_permission_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T62
revoke all privileges on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T62
revoke select ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), insert ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), update ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), references ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at") on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T62
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.jurisdiction_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.jurisdiction_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.jurisdiction_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.jurisdiction_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T02
revoke all privileges on table identity.roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T02
revoke select ("id","tenant_id","code","name","is_system","created_at"), insert ("id","tenant_id","code","name","is_system","created_at"), update ("id","tenant_id","code","name","is_system","created_at"), references ("id","tenant_id","code","name","is_system","created_at") on table identity.roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T02
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T05
revoke all privileges on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T05
revoke select ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), insert ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), update ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), references ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by") on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T05
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.customer_workspaces'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.customer_workspaces from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.customer_workspaces'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.customer_workspaces from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T20
revoke all privileges on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T20
revoke select ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T20
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T21
revoke all privileges on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T21
revoke select ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T21
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_space_kind_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_space_kind_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_space_kind_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_space_kind_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T23
revoke all privileges on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T23
revoke select ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at") on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T23
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_property_profile_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_property_profile_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_property_profile_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_property_profile_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T24
revoke all privileges on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T24
revoke select ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at") on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T24
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T32
revoke all privileges on table audit.events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T32
revoke select ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), insert ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), update ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), references ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at") on table audit.events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T32
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='audit.events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table audit.events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table audit.events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T33
revoke all privileges on table platform.outbox_events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T33
revoke select ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), insert ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), update ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), references ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts") on table platform.outbox_events from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T33
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.outbox_events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.outbox_events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.outbox_events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.outbox_events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T48
revoke all privileges on table portfolio.addresses from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T48
revoke select ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), insert ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), update ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), references ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at") on table portfolio.addresses from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T48
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.addresses'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.addresses from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.addresses'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.addresses from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T56
revoke all privileges on table portfolio.parties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T56
revoke select ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), insert ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), update ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), references ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at") on table portfolio.parties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T56
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.parties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.parties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.parties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.parties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T03
revoke all privileges on table identity.role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T03
revoke select ("role_id","permission_id","effect"), insert ("role_id","permission_id","effect"), update ("role_id","permission_id","effect"), references ("role_id","permission_id","effect") on table identity.role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T03
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T06
revoke all privileges on table portfolio.properties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T06
revoke select ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), insert ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), update ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), references ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at") on table portfolio.properties from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T06
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.properties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.properties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.properties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.properties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T08
revoke all privileges on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T08
revoke select ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), insert ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), update ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), references ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code") on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T08
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_taxonomy_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_taxonomy_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T08
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_taxonomy_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_taxonomy_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T11
revoke all privileges on table identity.memberships from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T11
revoke select ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), insert ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), update ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), references ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at") on table identity.memberships from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T11
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.memberships'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.memberships from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T11
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.memberships'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.memberships from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T14
revoke all privileges on table platform.workspace_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T14
revoke select ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at") on table platform.workspace_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T14
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T37
revoke all privileges on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T37
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at") on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T37
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_idempotency'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_idempotency from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_idempotency'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_idempotency from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T39
revoke all privileges on table platform.workspace_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T39
revoke select ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), insert ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), update ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), references ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at") on table platform.workspace_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T39
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T50
revoke all privileges on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T50
revoke select ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), insert ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), update ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), references ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at") on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T50
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_contracts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_contracts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_contracts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_contracts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T07
revoke all privileges on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T07
revoke select ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at") on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T07
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_property_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_property_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_property_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_property_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T12
revoke all privileges on table identity.context_grants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T12
revoke select ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), insert ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), update ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), references ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at") on table identity.context_grants from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T12
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.context_grants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.context_grants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T12
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.context_grants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.context_grants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T16
revoke all privileges on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T16
revoke select ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), insert ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), update ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), references ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at") on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T16
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_entitlements'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_entitlements from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T16
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_entitlements'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_entitlements from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T26
revoke all privileges on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T26
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), update ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt"), references ("id","tenant_id","customer_workspace_id","idempotency_key","status","setup_payload","payload_hash","rehearsal_result","created_by","submitted_by","approved_by","property_id","created_at","updated_at","revision","creation_request_hash","creation_receipt","submitted_revision","submitted_payload_hash","approved_revision","approved_submitted_revision","approved_payload_hash","last_command_key","last_command_hash","last_command_actor","last_command_receipt") on table platform.building_setup_runs from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T26
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.building_setup_runs'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.building_setup_runs from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.building_setup_runs'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.building_setup_runs from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T27
revoke all privileges on table portfolio.buildings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T27
revoke select ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), insert ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), update ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), references ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at") on table portfolio.buildings from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T27
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.buildings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.buildings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.buildings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.buildings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T29
revoke all privileges on table finance.accounting_periods from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T29
revoke select ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), insert ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), update ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), references ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by") on table finance.accounting_periods from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T29
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounting_periods'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounting_periods from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounting_periods'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounting_periods from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T30
revoke all privileges on table finance.journals from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T30
revoke select ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), insert ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), update ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), references ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at") on table finance.journals from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T30
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journals'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journals from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journals from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T40
revoke all privileges on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T40
revoke select ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), insert ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), update ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), references ("id","tenant_id","workspace_role_id","module_definition_id","created_at") on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T40
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T41
revoke all privileges on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T41
revoke select ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), insert ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), update ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), references ("id","tenant_id","workspace_role_id","permission_id","effect","created_at") on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T41
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T55
revoke all privileges on table finance.accounts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T55
revoke select ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), insert ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), update ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), references ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at") on table finance.accounts from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T55
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T58
revoke all privileges on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T58
revoke select ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at") on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T58
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_jurisdiction_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_jurisdiction_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_jurisdiction_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_jurisdiction_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T17
revoke all privileges on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T17
revoke select ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), insert ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), update ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), references ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason") on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T17
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_access_bases'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_access_bases from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T17
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_access_bases'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_access_bases from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T18
revoke all privileges on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T18
revoke select ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), insert ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), update ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at"), references ("id","customer_workspace_id","normalized_email","status","expires_at","reason","prepared_by","prepared_at","activated_by","membership_id","context_grant_id","revoked_at") on table platform.pilot_setup_reviewers from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T18
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.pilot_setup_reviewers'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.pilot_setup_reviewers from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.pilot_setup_reviewers'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.pilot_setup_reviewers from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T51
revoke all privileges on table portfolio.entrances from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T51
revoke select ("id","tenant_id","building_id","code","name","created_at"), insert ("id","tenant_id","building_id","code","name","created_at"), update ("id","tenant_id","building_id","code","name","created_at"), references ("id","tenant_id","building_id","code","name","created_at") on table portfolio.entrances from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T51
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.entrances'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.entrances from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.entrances'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.entrances from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T28
revoke all privileges on table portfolio.units from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T28
revoke select ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), insert ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), update ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), references ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at") on table portfolio.units from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T28
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.units'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.units from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.units'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.units from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T31
revoke all privileges on table finance.journal_entries from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T31
revoke select ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), insert ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), update ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), references ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at") on table finance.journal_entries from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T31
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journal_entries'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journal_entries from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journal_entries'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journal_entries from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T34
revoke all privileges on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T34
revoke select ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), insert ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), update ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), references ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth") on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T34
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T64
revoke all privileges on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T64
revoke select ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at") on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T64
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegations'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegations from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegations'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegations from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T35
revoke all privileges on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T35
revoke select ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), insert ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), update ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), references ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at") on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T35
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_role_authority_sources'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_role_authority_sources from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_role_authority_sources'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_role_authority_sources from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T36
revoke all privileges on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T36
revoke select ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), insert ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), update ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), references ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at") on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T36
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_handover_lineage'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_handover_lineage from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_handover_lineage'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_handover_lineage from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.T65
revoke all privileges on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.COLUMNS.FINAL.T65
revoke select ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), insert ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), update ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), references ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at") on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T65
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegation_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegation_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.T65
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegation_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegation_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.SQ1
revoke all privileges on sequence audit.events_id_seq from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.SQ1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events_id_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence audit.events_id_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.SQ2
revoke all privileges on sequence finance.journals_journal_no_seq from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.SQ2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals_journal_no_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence finance.journals_journal_no_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.N01
revoke all privileges on function app_private.require_building_session_current_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.N01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_session_current_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_session_current_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F18
revoke all privileges on function app_private.set_updated_at() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.set_updated_at()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.set_updated_at() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F20
revoke all privileges on function finance.protect_accounting_period() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.protect_accounting_period()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.protect_accounting_period() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F21
revoke all privileges on function finance.assert_accounting_period_no_overlap() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_no_overlap()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_no_overlap() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F22
revoke all privileges on function finance.assert_accounting_period_property_tenant() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_property_tenant()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_property_tenant() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F23
revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_version_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F24
revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_record_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F25
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F26
revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F27
revoke all privileges on function app_private.guard_workspace_property_binding_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F28
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F29
revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_taxonomy_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F30
revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_module_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F31
revoke all privileges on function app_private.guard_module_definition_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F32
revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F33
revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_code_sync_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F34
revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F35
revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_role_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F36
revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_permission_binding_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F37
revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F38
revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_module_draft_only_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F39
revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_permission_bindings_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F40
revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F41
revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_delegation_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F42
revoke all privileges on function platform.cap_customer_membership_to_access_basis() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_membership_to_access_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_membership_to_access_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F43
revoke all privileges on function platform.cap_customer_context_to_membership() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_context_to_membership()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_context_to_membership() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F44
revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.require_workspace_access_basis_for_provisioning()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F45
revoke all privileges on function app_private.guard_undefined_primary_role_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_undefined_primary_role_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_undefined_primary_role_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F46
revoke all privileges on function platform.end_pilot_reviewers_with_basis() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.end_pilot_reviewers_with_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.end_pilot_reviewers_with_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F48
revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_authority_source_immutable_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F50
revoke all privileges on function app_private.guard_authority_revision_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F51
revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bump_canonical_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F52
revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_jurisdiction_bound_property_address_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F53
revoke all privileges on function app_private.protect_setup_creation_v2() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.protect_setup_creation_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.protect_setup_creation_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F60
revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F72
revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F72
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.validate_setup_units_v2(jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F73
revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F73
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.assert_workspace_activation_ready(uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F74
revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F74
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F76
revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F76
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F78
revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F78
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.setup_record_v2(platform.building_setup_runs)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.setup_record_v2(platform.building_setup_runs) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F84
revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F84
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F87
revoke all privileges on function app_private.customer_mfa_required() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F87
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.customer_mfa_required()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.customer_mfa_required() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F19
revoke all privileges on function platform.enforce_workspace_activation_gate() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.enforce_workspace_activation_gate()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.enforce_workspace_activation_gate() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F75
revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F75
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F77
revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F77
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F49
revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_authority_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F62
revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F83
revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F83
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F85
revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F85
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F80
revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F80
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F64
revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F71
revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F71
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_setup_authority_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F15
revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.can_read_building_setup_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F54
revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F70
revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F70
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F01
revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F02
revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F14
revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F55
revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F56
revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F57
revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F58
revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F59
revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F03
revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F04
revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F05
revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F06
revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.OC1.FINAL.F07
revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;


-- COMPOSED EFFECT B.OC1.CUSTOM.FINAL.F07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- COMPOSED EFFECT B.RP1
create policy building_setup_runs_context_read on platform.building_setup_runs for select to authenticated using (app_private.can_read_building_setup_v2(tenant_id,customer_workspace_id));


-- COMPOSED EFFECT B.ND0.AFTER
do $nd0$
begin
 if coalesce((select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),'[]'::jsonb)
   is distinct from current_setting('cladora.slice.default_acl_before')::jsonb then
  raise exception 'building_slice_default_acl_delta'; end if;
end; $nd0$;


-- COMPOSED EFFECT B.PROTECTED.AFTER
do $protected$
declare before_state jsonb:=current_setting('cladora.slice.protected_before')::jsonb; f jsonb;
begin
 for f in select value from jsonb_array_elements(before_state->'functions') loop
  if not exists(select 1 from pg_proc p where p.oid=(f->>0)::oid
    and jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prosrc)=f) then
   raise exception 'building_slice_existing_function_changed'; end if;
 end loop;
 for f in select value from jsonb_array_elements(before_state->'relations') loop
  if not exists(select 1 from pg_class c where c.oid=(f->>0)::oid
   and jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity)=f) then
   raise exception 'building_slice_existing_relation_changed'; end if;
 end loop;
 for f in select value from jsonb_array_elements(before_state->'types') loop
  if not exists(select 1 from pg_type t where t.oid=(f->>0)::oid and jsonb_build_array(t.oid,t.typowner,t.typacl)=f) then
   raise exception 'building_slice_existing_type_changed'; end if;
 end loop;
 for f in select value from jsonb_array_elements(before_state->'namespaces') loop
  if not exists(select 1 from pg_namespace n where n.oid=(f->>0)::oid and jsonb_build_array(n.oid,n.nspowner,n.nspacl)=f) then
   raise exception 'building_slice_existing_namespace_changed'; end if;
 end loop;
end; $protected$;


-- COMPOSED EFFECT G2.ROLE
-- Exact F64/F80 nested owner edges; PM137 E_rpc retained, never product authority.
do $role_entry$ declare r oid; p oid; e record; begin
 select oid into strict r from pg_roles where rolname='cladora_rpc_owner' and not(rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreaterole or rolcreatedb or rolreplication);
 select oid into strict p from pg_roles where rolname='postgres';
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1 then raise exception 'setup_g2_role_entry_graph' using errcode='55000'; end if;
 select * into strict e from pg_auth_members where roleid=r and member=p and admin_option and not inherit_option and not set_option;
 perform set_config('cladora.g2.role_entry',to_jsonb(e)::text,true);
 if e.grantor=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set true granted by postgres;
 else
  grant cladora_rpc_owner to postgres with admin false,inherit false,set true granted by postgres;
 end if;
end; $role_entry$;
grant usage,create on schema app_private to cladora_rpc_owner;
grant execute on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) to cladora_rpc_owner;
alter function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) owner to cladora_rpc_owner;
set local role cladora_rpc_owner;
revoke all on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;
do $owner_close$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and a.grantee<>p.proowner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $owner_close$;
grant execute on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) to postgres;
reset role;
revoke create on schema app_private from cladora_rpc_owner restrict;
do $role_exit$ declare e jsonb:=current_setting('cladora.g2.role_entry')::jsonb; r oid:='cladora_rpc_owner'::regrole::oid; p oid:='postgres'::regrole::oid; begin
 if (e->>'grantor')::oid=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set false granted by postgres;
 else revoke cladora_rpc_owner from postgres granted by postgres restrict; end if;
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1
  or not exists(select 1 from pg_auth_members m where to_jsonb(m)=e) then raise exception 'setup_g2_role_exit_graph' using errcode='55000'; end if;
 if has_schema_privilege(r,'app_private','CREATE') then raise exception 'setup_g2_temporary_schema_right_remains' using errcode='55000'; end if;
end; $role_exit$;


-- COMPOSED EFFECT G2.CATALOG
do $equivalence$
declare
 -- No observed PG17 baseline exists. This literal is intentionally unpopulated.
 -- Only an independently authorized, reviewed source successor may replace it.
 expected jsonb:=null;
 actual jsonb; ns oid[];
begin
 select array_agg(oid order by oid) into ns from pg_namespace where nspname in
 ('app_private','platform','identity','portfolio','audit','finance','customer_api');
 with app_rels as (select c.* from pg_class c where c.relnamespace=any(ns)),
 rels as (select c.* from pg_class c where c.relnamespace=any(ns)
 or c.oid in(select reltoastrelid from app_rels)
 or c.oid in(select i.indexrelid from pg_index i where i.indrelid in(select reltoastrelid from app_rels))),
 types as (select t.* from pg_type t where t.typnamespace=any(ns)),
 addresses as (
 select 'pg_namespace'::regclass::oid classid,unnest(ns) objid
 union select 'pg_class'::regclass,oid from rels
 union select 'pg_type'::regclass,oid from types
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace=any(ns)
 union select 'pg_constraint'::regclass,oid from pg_constraint where connamespace=any(ns)
 union select 'pg_trigger'::regclass,oid from pg_trigger where tgrelid in(select oid from rels)
 union select 'pg_enum'::regclass,oid from pg_enum where enumtypid in(select oid from types)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in(select oid from rels)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in(select oid from rels)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in(select oid from rels)
 ), sections as (
 select 'columns' section,jsonb_build_object('relation',a.attrelid::regclass::text,'ordinal',a.attnum,
 'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'typmod',a.atttypmod,
 'nullable',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid,false),
 'identity',a.attidentity,'generated',a.attgenerated,'collation',a.attcollation::regcollation::text,
 'storage',a.attstorage,'compression',a.attcompression,'dropped',a.attisdropped) value
 from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where a.attrelid in(select oid from rels) and a.attnum>0
 union all select 'constraints',jsonb_build_object('relation',c.conrelid::regclass::text,'name',c.conname,
 'type',c.contype,'definition',pg_get_constraintdef(c.oid,false),'keys',to_jsonb(c.conkey),
 'foreign_relation',c.confrelid::regclass::text,'foreign_keys',to_jsonb(c.confkey),
 'update',c.confupdtype,'delete',c.confdeltype,'match',c.confmatchtype,
 'deferrable',c.condeferrable,'deferred',c.condeferred,'validated',c.convalidated,
 'inherited',c.coninhcount,'local',c.conislocal,'no_inherit',c.connoinherit)
 from pg_constraint c where c.connamespace=any(ns)
 union all select 'indexes',jsonb_build_object('relation',i.indrelid::regclass::text,
 'name',i.indexrelid::regclass::text,'definition',pg_get_indexdef(i.indexrelid,0,false),
 'unique',i.indisunique,'nulls_not_distinct',i.indnullsnotdistinct,'primary',i.indisprimary,
 'valid',i.indisvalid,'ready',i.indisready,'immediate',i.indimmediate,
 'keys',to_jsonb(i.indkey),'classes',to_jsonb(array(select n.nspname||'.'||o.opcname from unnest(i.indclass) with ordinality x(id,ord) join pg_opclass o on o.oid=x.id join pg_namespace n on n.oid=o.opcnamespace order by x.ord)),
 'options',to_jsonb(i.indoption),'expression',pg_get_expr(i.indexprs,i.indrelid,false),
 'predicate',pg_get_expr(i.indpred,i.indrelid,false))
 from pg_index i where i.indrelid in(select oid from rels)
 union all select 'triggers',jsonb_build_object('relation',t.tgrelid::regclass::text,'name',t.tgname,
 'definition',pg_get_triggerdef(t.oid,false),'function',t.tgfoid::regprocedure::text,
 'event',t.tgtype,'enabled',t.tgenabled,'internal',t.tgisinternal,
 'arguments',encode(t.tgargs,'hex'),'argument_count',t.tgnargs,'columns',to_jsonb(t.tgattr),
 'constraint',c.conname,'deferrable',t.tgdeferrable,'deferred',t.tginitdeferred,
 'old_table',t.tgoldtable,'new_table',t.tgnewtable)
 from pg_trigger t left join pg_constraint c on c.oid=t.tgconstraint
 where t.tgrelid in(select oid from rels)
 union all select 'policies',jsonb_build_object('relation',p.polrelid::regclass::text,'name',p.polname,
 'command',p.polcmd,'permissive',p.polpermissive,
 'roles',to_jsonb(array(select case when x=0 then 'PUBLIC' else pg_get_userbyid(x)::text end from unnest(p.polroles) x order by x)),
 'qual',pg_get_expr(p.polqual,p.polrelid,false),'check',pg_get_expr(p.polwithcheck,p.polrelid,false))
 from pg_policy p where p.polrelid in(select oid from rels)
 union all select 'enums',jsonb_build_object('type',e.enumtypid::regtype::text,'label',e.enumlabel,'order',e.enumsortorder)
 from pg_enum e where e.enumtypid in(select oid from types)
 union all select 'sequences',jsonb_build_object('name',s.seqrelid::regclass::text,'type',s.seqtypid::regtype::text,
 'start',s.seqstart,'increment',s.seqincrement,'max',s.seqmax,'min',s.seqmin,'cache',s.seqcache,'cycle',s.seqcycle)
 from pg_sequence s where s.seqrelid in(select oid from rels)
 union all select 'dependencies',jsonb_build_object('from',to_jsonb(pg_identify_object(d.classid,d.objid,d.objsubid)),
 'to',to_jsonb(pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid)),'kind',d.deptype)
 from pg_depend d where exists(select 1 from addresses a where (a.classid=d.classid and a.objid=d.objid)
 or (a.classid=d.refclassid and a.objid=d.refobjid))
 union all select 'shared_dependencies',jsonb_build_object('from',to_jsonb(pg_identify_object(d.classid,d.objid,d.objsubid)),
 'to',to_jsonb(pg_identify_object(d.refclassid,d.refobjid,0)),'kind',d.deptype)
 from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database())
 and exists(select 1 from addresses a where a.classid=d.classid and a.objid=d.objid)
 ), grouped as (select section,jsonb_agg(value order by value::text) entries from sections group by section)
 select jsonb_object_agg(s.name,coalesce(g.entries,'[]'::jsonb)) into actual
 from unnest(array['columns','constraints','indexes','triggers','policies','enums','sequences','dependencies','shared_dependencies']) s(name)
 left join grouped g on g.section=s.name;
 -- Counts/set assertions are insufficient. Missing expected proof always aborts.
 actual:=actual||jsonb_build_object(
 'schemas',(select jsonb_agg(jsonb_build_array(n.oid,n.nspname,n.nspowner,n.nspacl) order by n.oid) from pg_namespace n where n.oid=any(ns)),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c where c.relnamespace=any(ns)),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t where t.typnamespace=any(ns)),
 'routines',(select jsonb_agg((to_jsonb(p)-'prosrc'-'probin')||jsonb_build_object('body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'binary_sha256',encode(sha256(convert_to(coalesce(p.probin,''),'UTF8')),'hex')) order by p.oid) from pg_proc p where p.pronamespace=any(ns)),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d),
 'management_edges',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]') from pg_auth_members m));
 if expected is null then raise exception 'building_slice_catalog_equivalence_unproven' using errcode='55000'; end if;
 if actual is distinct from expected then raise exception 'building_slice_catalog_equivalence_mismatch' using errcode='55000'; end if;
end; $equivalence$;

-- COMPOSED EFFECT G2.ROLLBACK

rollback;
