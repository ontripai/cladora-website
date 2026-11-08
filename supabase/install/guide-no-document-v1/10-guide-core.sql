-- Source only. Platform must bind reviewed plan and obtain execution admission.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
SELECT pg_advisory_xact_lock(hashtextextended('core-guide-no-document-install.v1',0));
DO $entry$
DECLARE installer_role record; item text; marker text; expected record; actual record;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
 OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
 OR (SELECT oid::text FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM current_setting('cladora.guide.target_oid',true)
 OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true) OR current_user<>session_user
 OR current_setting('cladora.guide.plan_sha256',true) IS NULL
 OR current_setting('cladora.guide.plan_sha256',true)!~'^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'guide_target_plan_required' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT installer_role FROM pg_roles WHERE rolname=current_user;
 IF installer_role.rolsuper OR installer_role.rolbypassrls OR NOT installer_role.rolcreaterole OR NOT has_database_privilege(current_user,current_database(),'CREATE')
 THEN RAISE EXCEPTION 'guide_ordinary_installer_required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='experience')

 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private'
 AND (p.proname LIKE 'ce_guide_%' OR p.proname LIKE 'ce012_save_%' OR p.proname LIKE 'core_guide_no_document_%'
 OR p.proname IN ('assert_ce_guide_role_safety_v1','acquire_ce_guide_role_safety_lease_v1','core_platform_ce_guide_scope_allowed_v1')))
 THEN RAISE EXCEPTION 'guide_install_collision_stop' USING ERRCODE='55000'; END IF;
 IF NOT has_schema_privilege(current_user,'app_private','CREATE') THEN RAISE EXCEPTION 'guide_install_create_denied' USING ERRCODE='55000'; END IF;
 FOR item IN SELECT unnest(ARRAY['platform.tenants','platform.customer_workspaces','identity.memberships','identity.context_grants','identity.roles','platform.module_definitions','platform.idempotency_keys','platform.outbox_events','audit.events','documents.documents','documents.document_versions','platform.workspace_roles','platform.workspace_member_roles','app_private.canonical_authority_revision_v1']) LOOP
 IF to_regclass(item) IS NULL THEN RAISE EXCEPTION 'guide_install_dependency_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR expected IN SELECT * FROM (VALUES
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)','83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)','e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc')) AS e(sig,sha) LOOP
 SELECT p.*,r.rolname owner_name INTO actual FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure(expected.sig);
 IF NOT FOUND OR actual.owner_name<>current_user OR NOT actual.prosecdef
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR encode(sha256(convert_to(pg_get_functiondef(actual.oid),'UTF8')),'hex')<>expected.sha
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a WHERE a.grantee<>actual.proowner)
 THEN RAISE EXCEPTION 'guide_shared_helper_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR item IN SELECT unnest(ARRAY['auth.uid()','auth.jwt()','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.require_request_session_current_at_v1(timestamp with time zone)']) LOOP
 IF to_regprocedure(item) IS NULL OR NOT has_function_privilege('cladora_ce_guide_executor',item,'EXECUTE')
 THEN RAISE EXCEPTION 'guide_owner_delegation_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_runtime' AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor' AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 THEN RAISE EXCEPTION 'guide_roles_not_admitted' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])') IS NULL
 OR NOT has_function_privilege(current_user,'app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'guide_audience_dependency_missing' USING ERRCODE='55000'; END IF;
 -- FK permission and authority to issue precise column grants are distinct.
 IF NOT has_column_privilege(current_user,'auth.users','id','REFERENCES') THEN RAISE EXCEPTION 'guide_auth_references_required' USING ERRCODE='55000'; END IF;
END $entry$;
CREATE SCHEMA experience;

-- BEGIN_EXACT_CANONICAL_GUIDE_DEFINITIONS
create table experience.guides (
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null,
  title text not null check (title=btrim(title) and length(title) between 2 and 160),
  audience jsonb not null check (jsonb_typeof(audience)='object'),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  content_version bigint not null default 1 check (content_version between 1 and 9007199254740991),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,workspace_id,id),
  foreign key (workspace_id,tenant_id)
    references platform.customer_workspaces(id,tenant_id) on delete restrict,
  check (content_version<=version)
);

create table experience.guide_steps (
  id uuid primary key,
  tenant_id uuid not null,
  workspace_id uuid not null,
  guide_id uuid not null,
  guide_version bigint not null check (guide_version between 1 and 9007199254740991),
  position smallint not null check (position between 1 and 100),
  title text not null check (title=btrim(title) and length(title) between 1 and 160),
  body text not null check (body=btrim(body) and length(body) between 1 and 5000),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,workspace_id,guide_id,guide_version,id),
  unique (guide_id,guide_version,position),
  foreign key (tenant_id,workspace_id,guide_id)
    references experience.guides(tenant_id,workspace_id,id) on delete restrict
);

create table experience.guide_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  guide_id uuid not null,
  guide_version bigint not null check (guide_version between 1 and 9007199254740991),
  step_id uuid not null,
  position smallint not null check (position between 1 and 20),
  target_type text not null check (target_type='document'),
  target_id uuid not null,
  document_version_id uuid not null,
  document_version integer not null check (document_version>0),
  safe_label text not null check (safe_label=btrim(safe_label) and length(safe_label) between 1 and 120),
  created_at timestamptz not null default statement_timestamp(),
  unique (step_id,position),
  foreign key (tenant_id,workspace_id,guide_id,guide_version,step_id)
    references experience.guide_steps(tenant_id,workspace_id,guide_id,guide_version,id) on delete restrict,
  foreign key (target_id) references documents.documents(id) on delete restrict,
  foreign key (document_version_id) references documents.document_versions(id) on delete restrict
);

create index ce_guides_workspace_idx
  on experience.guides(tenant_id,workspace_id,status,updated_at desc,id);
create index ce_guide_steps_content_idx
  on experience.guide_steps(tenant_id,workspace_id,guide_id,guide_version,position);
create index ce_guide_references_content_idx
  on experience.guide_references(tenant_id,workspace_id,guide_id,guide_version,position);
create index ce_guide_references_document_idx
  on experience.guide_references(tenant_id,target_id,document_version_id);

create function app_private.ce_guide_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' then
    raise exception 'ce_guide_delete_prohibited' using errcode='42501';
  end if;
  if new.id<>old.id or new.tenant_id<>old.tenant_id
    or new.workspace_id<>old.workspace_id or new.created_by<>old.created_by
    or new.created_at<>old.created_at then
    raise exception 'ce_guide_identity_immutable' using errcode='42501';
  end if;
  if old.status='cancelled' then
    raise exception 'ce_guide_cancelled_immutable' using errcode='42501';
  end if;
  if old.version>=9007199254740991 or new.version<>old.version+1 then
    raise exception 'ce_guide_exact_version_required' using errcode='40001';
  end if;
  if new.content_version=old.content_version then
    if new.title<>old.title or new.audience<>old.audience
      or not ((old.status='draft' and new.status in ('published','cancelled'))
        or (old.status='published' and new.status in ('draft','cancelled'))) then
      raise exception 'ce_guide_lifecycle_transition_invalid' using errcode='42501';
    end if;
  elsif new.content_version=new.version then
    if old.status<>'draft' or new.status<>'draft' then
      raise exception 'ce_guide_content_change_requires_draft' using errcode='42501';
    end if;
  else
    raise exception 'ce_guide_content_version_invalid' using errcode='40001';
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end $$;

create function app_private.ce_guide_child_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare g experience.guides%rowtype; v_document_version integer; v_document_id uuid;
  v_aggregate_lock bigint; v_lock_immediate boolean;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'ce_guide_content_immutable' using errcode='42501';
  end if;
  -- Reuse Core's aggregate lock namespace. Shared child locks remain mutually
  -- compatible and conflict only with a lifecycle command's exclusive lock.
  v_aggregate_lock:=hashtextextended(
    'aggregate:'||new.workspace_id::text||':experience_guide:'||new.guide_id::text,0);
  v_lock_immediate:=pg_try_advisory_xact_lock_shared(v_aggregate_lock);
  if not v_lock_immediate then
    perform pg_advisory_xact_lock_shared(v_aggregate_lock);
    raise exception 'ce_guide_content_binding_invalid' using errcode='42501';
  end if;
  select * into g from experience.guides
   where id=new.guide_id and tenant_id=new.tenant_id and workspace_id=new.workspace_id
     and status='draft' and version=content_version and content_version=new.guide_version
   for key share;
  if g.id is null or g.status<>'draft' or g.version<>g.content_version
    or g.content_version<>new.guide_version then
    raise exception 'ce_guide_content_binding_invalid' using errcode='42501';
  end if;
  if tg_table_name='guide_references' then
    select v.document_id,v.version into v_document_id,v_document_version
      from documents.document_versions v join documents.documents d
        on d.id=v.document_id and d.tenant_id=v.tenant_id
     where v.id=new.document_version_id and v.document_id=new.target_id
       and v.tenant_id=new.tenant_id and d.workspace_id=new.workspace_id;
    if v_document_id is null or v_document_version<>new.document_version then
      raise exception 'ce_guide_document_version_binding_invalid' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create trigger ce_guides_guard
before update or delete on experience.guides
for each row execute function app_private.ce_guide_guard_v1();
create trigger ce_guide_steps_guard
before insert or update or delete on experience.guide_steps
for each row execute function app_private.ce_guide_child_guard_v1();
create trigger ce_guide_references_guard
before insert or update or delete on experience.guide_references
for each row execute function app_private.ce_guide_child_guard_v1();

alter table experience.guides enable row level security;
alter table experience.guide_steps enable row level security;
alter table experience.guide_references enable row level security;
revoke all on schema experience from public,anon,authenticated,service_role;
revoke all on experience.guides,experience.guide_steps,experience.guide_references
  from public,anon,authenticated,service_role;
revoke all on function app_private.ce_guide_guard_v1(),
  app_private.ce_guide_child_guard_v1() from public,anon,authenticated,service_role;

create function app_private.ce_guide_audience_allows_v1(p_context uuid,p_workspace uuid,p_audience jsonb)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare s record; begin
 select * into strict s from app_private.resolve_workspace_native_context_v2(p_context,p_workspace);
 return p_audience->>'kind'='workspace'
  or (p_audience->>'kind'='members' and exists (select 1 from jsonb_array_elements_text(p_audience->'membership_ids') j(value) where lower(j.value)=s.membership_id::text))
  or (p_audience->>'kind'='roles' and (
   (p_audience->'role_codes') @> jsonb_build_array(s.role_code)
   or exists (
    select 1 from platform.workspace_member_roles a join platform.workspace_roles r on r.id=a.workspace_role_id
    where a.tenant_id=s.tenant_id and a.customer_workspace_id=p_workspace and a.membership_id=s.membership_id
     and a.scope_type='workspace' and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.tenant_id=s.tenant_id and r.customer_workspace_id=p_workspace and r.lifecycle_status='published'
     and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp())
     and app_private.workspace_role_handover_lineage_valid_v1(a.id,null)
     and (p_audience->'role_codes') @> jsonb_build_array(r.code)
   )
  ));
end $$;


-- END_EXACT_CANONICAL_GUIDE_DEFINITIONS
-- New Guide-only helpers, not replacements for existing shared evaluators.
CREATE FUNCTION app_private.core_platform_ce_guide_scope_allowed_v1(p_tenant uuid,p_workspace uuid,p_permission text,p_module text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $scope$
DECLARE c uuid; w uuid;
BEGIN
 IF session_user<>'cladora_ce_guide_runtime' OR p_module<>'experience_guides'
 OR p_permission NOT IN ('experience.guide.read','experience.guide.manage') OR coalesce(auth.jwt()->>'aal','aal1')<>'aal2' THEN RETURN false; END IF;
 c:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
 w:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
 IF c IS NULL OR w IS DISTINCT FROM p_workspace THEN RETURN false; END IF;
 PERFORM app_private.require_request_session_current_at_v1(clock_timestamp());
 RETURN EXISTS(SELECT 1 FROM app_private.resolve_workspace_native_context_v2_at_v1(c,w,clock_timestamp()) r WHERE r.tenant_id=p_tenant)
 AND app_private.check_workspace_native_permission_v2_at_v1(c,w,p_permission,p_module,clock_timestamp()) IS TRUE;
EXCEPTION WHEN SQLSTATE '40001' THEN RAISE;
 WHEN SQLSTATE '42501' THEN RETURN false;
END $scope$;

-- Same physical role graph and ownership constraints as the fixed-role pool.
-- Guide without documents has an explicit smaller helper inventory. Shared
-- helper owner/definition is pinned; historical guard/migrations are untouched.
CREATE FUNCTION app_private.core_guide_no_document_role_safety_v1() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $safe$
WITH ids AS (SELECT
 (SELECT oid FROM pg_roles WHERE rolname='cladora_ce_guide_runtime') runtime,
 (SELECT oid FROM pg_roles WHERE rolname='cladora_ce_guide_executor') executor),
shared(sig,sha) AS (VALUES
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)'::text,'83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'::text),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)','e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc'))
SELECT current_user='cladora_ce_guide_executor' AND session_user='cladora_ce_guide_runtime'
 AND (SELECT count(*)=2 FROM pg_roles WHERE oid IN ((SELECT runtime FROM ids),(SELECT executor FROM ids))
 AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 AND (SELECT rolcanlogin FROM pg_roles WHERE oid=(SELECT runtime FROM ids))
 AND NOT (SELECT rolcanlogin FROM pg_roles WHERE oid=(SELECT executor FROM ids))
 AND (SELECT count(*)=1 FROM pg_auth_members m,ids i WHERE m.member IN(i.runtime,i.executor) OR m.roleid IN(i.runtime,i.executor))
 AND EXISTS(SELECT 1 FROM pg_auth_members m,ids i WHERE m.member=i.runtime AND m.roleid=i.executor
 AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n,ids i WHERE n.nspowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_database d,ids i WHERE d.datdba IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_class c,ids i WHERE c.relowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_proc p,ids i WHERE p.proowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM shared s LEFT JOIN pg_proc p ON p.oid=to_regprocedure(s.sig)
 WHERE p.oid IS NULL OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR p.proowner<>(SELECT proowner FROM pg_proc WHERE oid='app_private.core_guide_no_document_role_safety_v1()'::regprocedure)
 OR encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')<>s.sha
 OR NOT has_function_privilege(current_user,p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,(SELECT executor FROM ids)) OR (a.grantee<>p.proowner AND a.is_grantable)))
 AND NOT has_database_privilege(current_user,current_database(),'CREATE')
 AND NOT has_schema_privilege(current_user,'app_private','CREATE')
 AND NOT has_schema_privilege(current_user,'auth','CREATE')
 AND NOT has_schema_privilege(current_user,'experience','CREATE');
$safe$;
CREATE FUNCTION app_private.assert_ce_guide_role_safety_v1() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $assert$
BEGIN IF app_private.core_guide_no_document_role_safety_v1() IS NOT TRUE THEN
 RAISE EXCEPTION 'core_platform_role_safety_invalid' USING ERRCODE='42501'; END IF; RETURN true; END $assert$;
CREATE FUNCTION app_private.acquire_ce_guide_role_safety_lease_v1() RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $lease$
BEGIN PERFORM pg_advisory_xact_lock_shared(hashtextextended('core-platform-role-bound-pool.v1',0));
 RETURN app_private.assert_ce_guide_role_safety_v1(); END $lease$;

-- Document-free installation cannot be used to read or insert a document reference.
ALTER TABLE experience.guide_references ADD CONSTRAINT core_guide_no_document_references_v1 CHECK(false);
ALTER TABLE experience.guides FORCE ROW LEVEL SECURITY;
ALTER TABLE experience.guide_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE experience.guide_references FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA experience FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT USAGE ON SCHEMA experience,app_private,identity,platform,audit TO cladora_ce_guide_executor;
GRANT EXECUTE ON FUNCTION
 app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone),
 app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone),
 app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
 app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb),
 app_private.core_guide_no_document_role_safety_v1(),app_private.assert_ce_guide_role_safety_v1(),
 app_private.acquire_ce_guide_role_safety_lease_v1() TO cladora_ce_guide_executor;
REVOKE ALL ON FUNCTION app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb),
 app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
 app_private.core_guide_no_document_role_safety_v1(),app_private.assert_ce_guide_role_safety_v1(),
 app_private.acquire_ce_guide_role_safety_lease_v1() FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;

GRANT SELECT,INSERT ON experience.guides,experience.guide_steps TO cladora_ce_guide_executor;
GRANT UPDATE(title,audience,status,version,content_version,updated_at) ON experience.guides TO cladora_ce_guide_executor;
GRANT UPDATE(id) ON experience.guide_steps TO cladora_ce_guide_executor;
GRANT SELECT ON experience.guide_references TO cladora_ce_guide_executor;
GRANT UPDATE(id) ON experience.guide_references TO cladora_ce_guide_executor;
CREATE POLICY core_guide_read_v1 ON experience.guides FOR SELECT TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')
 OR (status='published' AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.read','experience_guides')
 AND app_private.ce_guide_audience_allows_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,workspace_id,audience)));
CREATE POLICY core_guide_read_lock_v1 ON experience.guides FOR UPDATE TO cladora_ce_guide_executor USING(
 status='published' AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.read','experience_guides')
 AND app_private.ce_guide_audience_allows_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,workspace_id,audience)) WITH CHECK(false);
-- FORCE RLS also applies to the ordinary installer-owned SECURITY DEFINER
-- ledger helper. Give that owner only scoped SELECT, not a bypass or DML policy.
DO $owner_read$
BEGIN EXECUTE format('CREATE POLICY core_guide_owner_helper_read_v1 ON experience.guides FOR SELECT TO %I USING (app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,''experience.guide.manage'',''experience_guides''))',current_user); END $owner_read$;
CREATE POLICY core_guide_insert_v1 ON experience.guides FOR INSERT TO cladora_ce_guide_executor WITH CHECK(
 created_by=auth.uid() AND status='draft' AND version=1 AND content_version=1
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_update_v1 ON experience.guides FOR UPDATE TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'))
 WITH CHECK(app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_steps_read_v1 ON experience.guide_steps FOR SELECT TO cladora_ce_guide_executor USING(
 EXISTS(SELECT 1 FROM experience.guides g WHERE g.id=guide_id AND g.tenant_id=guide_steps.tenant_id AND g.workspace_id=guide_steps.workspace_id));
CREATE POLICY core_guide_steps_insert_v1 ON experience.guide_steps FOR INSERT TO cladora_ce_guide_executor WITH CHECK(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_steps_lock_v1 ON experience.guide_steps FOR UPDATE TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')) WITH CHECK(false);
CREATE POLICY core_guide_references_read_v1 ON experience.guide_references FOR SELECT TO cladora_ce_guide_executor USING(false);
CREATE POLICY core_guide_references_lock_v1 ON experience.guide_references FOR UPDATE TO cladora_ce_guide_executor USING(false) WITH CHECK(false);

-- Discovery is structural own-actor data. It does not require manage and the
-- actual CE reader filters/rechecks each tuple using canonical read authority.
GRANT SELECT(id,membership_id,tenant_id,scope_type,property_id,building_id,unit_id,starts_at,ends_at),UPDATE(id) ON identity.context_grants TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,role_id,user_id,status,starts_at,ends_at),UPDATE(id) ON identity.memberships TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,archived_at,lifecycle_status),UPDATE(id) ON platform.customer_workspaces TO cladora_ce_guide_executor;
GRANT SELECT(id,legal_name) ON platform.tenants TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,code,name) ON identity.roles TO cladora_ce_guide_executor;
GRANT SELECT(singleton,revision),UPDATE(singleton) ON app_private.canonical_authority_revision_v1 TO cladora_ce_guide_executor;
GRANT SELECT(id,code,version,entitlement_key,is_active,lifecycle_status,valid_from,valid_to) ON platform.module_definitions TO cladora_ce_guide_executor;
CREATE POLICY core_guide_member_read_v1 ON identity.memberships FOR SELECT TO cladora_ce_guide_executor USING(user_id=auth.uid());
CREATE POLICY core_guide_member_lock_v1 ON identity.memberships FOR UPDATE TO cladora_ce_guide_executor USING(user_id=auth.uid()) WITH CHECK(false);
CREATE POLICY core_guide_context_read_v1 ON identity.context_grants FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.id=membership_id AND m.tenant_id=context_grants.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_context_lock_v1 ON identity.context_grants FOR UPDATE TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.id=membership_id AND m.tenant_id=context_grants.tenant_id AND m.user_id=auth.uid())) WITH CHECK(false);
CREATE POLICY core_guide_workspace_read_v1 ON platform.customer_workspaces FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=customer_workspaces.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_workspace_lock_v1 ON platform.customer_workspaces FOR UPDATE TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=customer_workspaces.tenant_id AND m.user_id=auth.uid())) WITH CHECK(false);
CREATE POLICY core_guide_tenant_read_v1 ON platform.tenants FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=tenants.id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_role_read_v1 ON identity.roles FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.role_id=roles.id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_epoch_read_v1 ON app_private.canonical_authority_revision_v1 FOR SELECT TO cladora_ce_guide_executor USING(singleton);
CREATE POLICY core_guide_epoch_lock_v1 ON app_private.canonical_authority_revision_v1 FOR UPDATE TO cladora_ce_guide_executor USING(singleton) WITH CHECK(false);
CREATE POLICY core_guide_module_read_v1 ON platform.module_definitions FOR SELECT TO cladora_ce_guide_executor USING(code='experience_guides');

-- Existing C03 is the sole key/receipt/audit/outbox engine.
GRANT SELECT(tenant_id,actor_id,key,request_hash,response_ref,expires_at),INSERT(tenant_id,actor_id,key,request_hash,expires_at),UPDATE(response_ref,status_code) ON platform.idempotency_keys TO cladora_ce_guide_executor;
GRANT SELECT(id),INSERT(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot) ON audit.events TO cladora_ce_guide_executor;
GRANT USAGE,SELECT ON SEQUENCE audit.events_id_seq TO cladora_ce_guide_executor;
GRANT SELECT(id),INSERT(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id) ON platform.outbox_events TO cladora_ce_guide_executor;
CREATE FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(t uuid,a uuid,k text,g uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $ledger$
DECLARE w uuid;
BEGIN w:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
 RETURN a=auth.uid() AND app_private.core_platform_ce_guide_scope_allowed_v1(t,w,'experience.guide.manage','experience_guides')
 AND (k IS NULL OR k LIKE 'core-tx.v1:'||w::text||':%')
 AND (g IS NULL OR EXISTS(SELECT 1 FROM experience.guides x WHERE x.id=g AND x.tenant_id=t AND x.workspace_id=w));
END $ledger$;
REVOKE ALL ON FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT EXECUTE ON FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(uuid,uuid,text,uuid) TO cladora_ce_guide_executor;
CREATE POLICY core_guide_c03_read_v1 ON platform.idempotency_keys FOR SELECT TO cladora_ce_guide_executor USING(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_c03_insert_v1 ON platform.idempotency_keys FOR INSERT TO cladora_ce_guide_executor WITH CHECK(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_c03_update_v1 ON platform.idempotency_keys FOR UPDATE TO cladora_ce_guide_executor USING(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null)) WITH CHECK(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_audit_read_v1 ON audit.events FOR SELECT TO cladora_ce_guide_executor USING(entity_type='experience_guide' AND action IN ('core.experience.guide.command','core.experience.guide.publish','core.experience.guide.unpublish') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,null,entity_id));
CREATE POLICY core_guide_audit_insert_v1 ON audit.events FOR INSERT TO cladora_ce_guide_executor WITH CHECK(entity_type='experience_guide' AND action IN ('core.experience.guide.command','core.experience.guide.publish','core.experience.guide.unpublish') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,null,entity_id));
CREATE POLICY core_guide_outbox_read_v1 ON platform.outbox_events FOR SELECT TO cladora_ce_guide_executor USING(aggregate_type='experience_guide' AND event_type IN ('core.experience.guide.command.v1','core.experience.guide.publish.v1','core.experience.guide.unpublish.v1') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,auth.uid(),null,aggregate_id));
CREATE POLICY core_guide_outbox_insert_v1 ON platform.outbox_events FOR INSERT TO cladora_ce_guide_executor WITH CHECK(aggregate_type='experience_guide' AND event_type IN ('core.experience.guide.command.v1','core.experience.guide.publish.v1','core.experience.guide.unpublish.v1') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,auth.uid(),null,aggregate_id));

-- Registry identities only. No role assignment, entitlement allocation,
-- Workspace activation, credential or runtime binding is created.
INSERT INTO identity.permissions(code,resource,action,description)
VALUES('experience.guide.read','experience.guide','read','Read an authorized Experience Guide projection in the current Workspace'),
('experience.guide.manage','experience.guide','manage','Manage a versioned Experience Guide in the current Workspace')
ON CONFLICT(code) DO NOTHING;
INSERT INTO platform.module_definitions(code,version,name,labels_json,description,category,is_active,lifecycle_status,sensitivity_level,requires_aal2,entitlement_key,published_at)
VALUES('experience_guides',1,'Experience Guides','{"ro":"Ghiduri","en":"Guides","fa":"راهنماها"}'::jsonb,
'Versioned Experience Guide authority profile','services',true,'published','sensitive',true,'module.experience_guides',statement_timestamp())
ON CONFLICT(code,version) DO NOTHING;
INSERT INTO platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
SELECT d.id,p.id,1,p.action,true,false,true,'active' FROM platform.module_definitions d JOIN identity.permissions p ON p.code IN('experience.guide.read','experience.guide.manage')
WHERE d.code='experience_guides' AND d.version=1
ON CONFLICT(module_definition_id,permission_id,binding_version) DO NOTHING;
DO $registry$
BEGIN
 IF (SELECT count(*) FROM platform.module_definitions WHERE code='experience_guides' AND version=1
 AND is_active AND lifecycle_status='published' AND sensitivity_level='sensitive' AND requires_aal2
 AND entitlement_key='module.experience_guides' AND valid_from<=clock_timestamp() AND valid_to IS NULL)<>1
 OR (SELECT count(*) FROM identity.permissions WHERE resource='experience.guide'
 AND ((code='experience.guide.read' AND action='read') OR (code='experience.guide.manage' AND action='manage')))<>2
 OR (SELECT count(*) FROM platform.module_permission_bindings b JOIN platform.module_definitions d ON d.id=b.module_definition_id JOIN identity.permissions p ON p.id=b.permission_id
 WHERE d.code='experience_guides' AND d.version=1 AND p.code IN('experience.guide.read','experience.guide.manage')
 AND b.permission_mode=p.action AND b.binding_version=1 AND b.is_assignable_to_local_role AND NOT b.is_delegable
 AND b.requires_aal2 AND b.lifecycle_status='active' AND b.valid_from<=clock_timestamp() AND b.valid_to IS NULL)<>2
 THEN RAISE EXCEPTION 'guide_registry_collision_stop' USING ERRCODE='55000'; END IF;
END $registry$;

COMMENT ON SCHEMA experience IS 'core-guide-no-document-install.v1; inactive; no operational activation';
COMMIT;
