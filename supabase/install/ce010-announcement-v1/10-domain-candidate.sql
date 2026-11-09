-- REVIEW-ONLY; Platform must integrate with its exact accepted target/role lane.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
DO $review$ BEGIN RAISE EXCEPTION 'ce010_review_only_no_target_admission' USING ERRCODE='55000'; END $review$;
DO $pre$ DECLARE owner_name text:=current_setting('cladora.ce010.owner',true); executor_name text:=current_setting('cladora.ce010.executor',true); BEGIN
 IF owner_name IS NULL OR executor_name IS NULL OR owner_name=executor_name OR current_user<>owner_name
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN(owner_name,executor_name) AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolcanlogin))
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN(owner_name,executor_name))<>2
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['community.communities','community.announcements','community.content_reports']) t WHERE to_regclass(t) IS NOT NULL)
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['app_private.ce_community_authorize_v1(uuid,uuid,text)','app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid)','app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb)','customer_api.read_ce_community_v1(uuid,uuid)']) f WHERE to_regprocedure(f) IS NOT NULL)
 THEN RAISE EXCEPTION 'ce010_fresh_prestate_or_role_mismatch' USING ERRCODE='55000';END IF;
 -- Target, bounded role graph, temporary schema-CREATE lane and shared-helper
 -- ACL/owner seals are supplied by the existing admitted Core/Platform wrapper.
END $pre$;
create table community.communities (
 id uuid primary key,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 name text not null check (name=btrim(name) and length(name) between 2 and 120),
 audience jsonb not null,
 version bigint not null default 1 check (version between 1 and 9007199254740991),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique (tenant_id,workspace_id,id)
);

create table community.announcements (
 id uuid primary key,
 tenant_id uuid not null,
 workspace_id uuid not null,
 community_id uuid not null,
 body text not null check (body=btrim(body) and length(body) between 1 and 5000),
 audience jsonb not null,
 status text not null default 'draft' check (status in ('draft','published','cancelled')),
 version bigint not null default 1 check (version between 1 and 9007199254740991),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 unique (tenant_id,workspace_id,community_id,id),
 foreign key (tenant_id,workspace_id,community_id) references community.communities(tenant_id,workspace_id,id) on delete restrict
);

create table community.content_reports (
 id uuid primary key,
 tenant_id uuid not null,
 workspace_id uuid not null,
 community_id uuid not null,
 target_type text not null check (target_type='announcement'),
 target_id uuid not null,
 reporter_membership_id uuid not null references identity.memberships(id) on delete restrict,
 report_reason text not null check (report_reason=btrim(report_reason) and length(report_reason) between 5 and 1000),
 status text not null default 'open' check (status in ('open','dismissed','action_required')),
 decision_reason text,
 decided_by uuid references auth.users(id) on delete restrict,
 version bigint not null default 1 check (version between 1 and 9007199254740991),
 created_at timestamptz not null default statement_timestamp(),
 check ((status='open' and decision_reason is null and decided_by is null)
   or (status<>'open' and decision_reason is not null and decided_by is not null
     and decision_reason=btrim(decision_reason) and length(decision_reason) between 5 and 1000)),
 foreign key (tenant_id,workspace_id,community_id,target_id) references community.announcements(tenant_id,workspace_id,community_id,id) on delete restrict
);

create unique index ce_content_report_active_uq on community.content_reports(target_id,reporter_membership_id) where status='open';

create index ce_communities_workspace_idx on community.communities(tenant_id,workspace_id,created_at,id);

create index ce_announcements_workspace_idx on community.announcements(tenant_id,workspace_id,community_id,status,created_at,id);

create index ce_reports_workspace_idx on community.content_reports(tenant_id,workspace_id,community_id,status,created_at,id);

create index ce_reports_reporter_idx on community.content_reports(reporter_membership_id,target_id);

create function app_private.ce_community_authorize_v1(p_context uuid,p_workspace uuid,p_permission text)
returns table (tenant_id uuid,membership_id uuid,role_code text)
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'ce_community_access_denied' using errcode='42501'; end if;
 if p_permission not in ('community.community.read','community.community.manage','community.announcement.publish','community.report.create','community.report.decide')
  or not exists (
   select 1 from platform.module_definitions m
   join platform.module_permission_bindings b on b.module_definition_id=m.id
   join identity.permissions p on p.id=b.permission_id
   where m.code='community_basic' and m.version=1 and m.entitlement_key='module.community_basic'
     and m.is_active and m.lifecycle_status in ('active','published')
     and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp())
     and p.code=p_permission and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
  ) then raise exception 'ce_community_contract_not_ready' using errcode='55000'; end if;
 if app_private.check_workspace_native_permission_v2(p_context,p_workspace,p_permission,'community_basic') is not true
  then raise exception 'ce_community_access_denied' using errcode='42501'; end if;
 return query select c.tenant_id,c.membership_id,c.role_code
 from app_private.resolve_workspace_native_context_v2(p_context,p_workspace) c;
end $$;

create function app_private.ce_community_audience_valid_v1(p_audience jsonb,p_tenant uuid,p_workspace uuid)
returns boolean language plpgsql stable set search_path=pg_catalog as $$
declare k text; begin
 if jsonb_typeof(p_audience) is distinct from 'object' then return false; end if;
 k:=p_audience->>'kind';
 if k='workspace' then return p_audience='{"kind":"workspace"}'::jsonb;
 elsif k='members' then
  if (p_audience-array['kind','membership_ids'])<>'{}'::jsonb
   or jsonb_typeof(p_audience->'membership_ids') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_audience->'membership_ids') not between 1 and 500 then return false; end if;
  return not exists (
   select 1 from jsonb_array_elements(p_audience->'membership_ids') j(value)
   where jsonb_typeof(j.value)<>'string' or not exists (
    select 1 from identity.memberships m where m.id::text=lower(j.value#>>'{}') and m.tenant_id=p_tenant
    and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   )
  );
 elsif k='roles' then
  if (p_audience-array['kind','role_codes'])<>'{}'::jsonb
   or jsonb_typeof(p_audience->'role_codes') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_audience->'role_codes') not between 1 and 32 then return false; end if;
  return not exists (
   select 1 from jsonb_array_elements(p_audience->'role_codes') j(value)
   where jsonb_typeof(j.value)<>'string' or length(j.value#>>'{}') not between 2 and 64
    or not (exists (select 1 from identity.roles r where r.code=j.value#>>'{}' and (r.tenant_id is null or r.tenant_id=p_tenant))
     or exists (select 1 from platform.workspace_roles r where r.code=j.value#>>'{}' and r.tenant_id=p_tenant
      and r.customer_workspace_id=p_workspace and r.lifecycle_status='published'
      and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp())))
  );
 end if;
 return false;
end $$;

create function app_private.ce_community_audience_allows_v1(p_context uuid,p_workspace uuid,p_audience jsonb)
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

create function customer_api.read_ce_community_v1(p_context_id uuid,p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare s record; manager boolean; moderator boolean; reporter boolean; communities jsonb; announcements jsonb; reports jsonb; begin
 select * into strict s from app_private.ce_community_authorize_v1(p_context_id,p_workspace_id,'community.community.read');
 manager:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'community.announcement.publish','community_basic') is true;
 moderator:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'community.report.decide','community_basic') is true;
 reporter:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'community.report.create','community_basic') is true;
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]') into communities from (
  select x.id,x.created_at,jsonb_build_object('id',x.id,'workspace_id',x.workspace_id,'name',x.name,'version',x.version,
   'audience_kind',x.audience->>'kind','can_create_announcement',manager,'can_decide_reports',moderator) item
  from community.communities x where x.tenant_id=s.tenant_id and x.workspace_id=p_workspace_id
   and (manager or moderator or app_private.ce_community_audience_allows_v1(p_context_id,p_workspace_id,x.audience))
  order by x.created_at,x.id limit 100
 ) q;
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]') into announcements from (
  select a.id,a.created_at,jsonb_build_object('id',a.id,'community_id',a.community_id,
   'title',left(regexp_replace(a.body,E'\\s+',' ','g'),120),'body',a.body,'status',a.status,'version',a.version,
   'can_report',reporter and a.status='published'
    and app_private.ce_community_audience_allows_v1(p_context_id,p_workspace_id,c.audience)
    and app_private.ce_community_audience_allows_v1(p_context_id,p_workspace_id,a.audience)
    and not exists(select 1 from community.content_reports own where own.target_id=a.id and own.reporter_membership_id=s.membership_id and own.status='open'),
   'can_publish',manager and a.status='draft','can_cancel',manager and a.status='published') item
  from community.announcements a join community.communities c on c.id=a.community_id
  where a.tenant_id=s.tenant_id and a.workspace_id=p_workspace_id
   and (manager or (a.status='published' and app_private.ce_community_audience_allows_v1(p_context_id,p_workspace_id,c.audience)
     and app_private.ce_community_audience_allows_v1(p_context_id,p_workspace_id,a.audience)))
  order by a.created_at,a.id limit 100
 ) q;
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]') into reports from (
  select r.id,r.created_at,jsonb_build_object('id',r.id,'community_id',r.community_id,
   'target_title',left(regexp_replace(a.body,E'\\s+',' ','g'),120),
   'report_reason',r.report_reason,'status',r.status,'version',r.version) item
  from community.content_reports r join community.announcements a on a.id=r.target_id
  where r.tenant_id=s.tenant_id and r.workspace_id=p_workspace_id and moderator
  order by r.created_at,r.id limit 100
 ) q;
 return jsonb_build_object('workspace_id',p_workspace_id,'communities',communities,'announcements',announcements,'reports',reports,'limit',100);
end $$;
ALTER TABLE community.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.communities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON community.communities FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE community.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.announcements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON community.announcements FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE community.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.content_reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON community.content_reports FROM PUBLIC,anon,authenticated,service_role;
DO $rights$ DECLARE e text:=current_setting('cladora.ce010.executor',true); o text:=current_setting('cladora.ce010.owner',true); BEGIN
EXECUTE format('GRANT SELECT (id,tenant_id,workspace_id,version,audience) ON community.communities TO %I',e);
EXECUTE format('GRANT UPDATE (version) ON community.communities TO %I',e);
EXECUTE format('GRANT SELECT (id,tenant_id,workspace_id,community_id,version,audience,status,body) ON community.announcements TO %I',e);
EXECUTE format('GRANT INSERT (id,tenant_id,workspace_id,community_id,body,audience,status,version,created_by) ON community.announcements TO %I',e);
EXECUTE format('GRANT UPDATE (status,version,updated_at) ON community.announcements TO %I',e);
EXECUTE format($ce_policy$CREATE POLICY ce010_owner_read ON community.communities FOR SELECT TO %I USING (community.communities.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,clock_timestamp()) c where c.tenant_id=community.communities.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,'community.community.read','community_basic',clock_timestamp()))$ce_policy$,o);
EXECUTE format($ce_policy$CREATE POLICY ce010_executor_read ON community.communities FOR SELECT TO %I USING (community.communities.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,clock_timestamp()) c where c.tenant_id=community.communities.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,'community.announcement.publish','community_basic',clock_timestamp()))$ce_policy$,e);
EXECUTE format($ce_policy$CREATE POLICY ce010_executor_lock_only ON community.communities FOR UPDATE TO %I USING (community.communities.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,clock_timestamp()) c where c.tenant_id=community.communities.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.communities.workspace_id,'community.announcement.publish','community_basic',clock_timestamp())) WITH CHECK (false)$ce_policy$,e);
EXECUTE format($ce_policy$CREATE POLICY ce010_owner_read ON community.announcements FOR SELECT TO %I USING (community.announcements.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,clock_timestamp()) c where c.tenant_id=community.announcements.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.community.read','community_basic',clock_timestamp()))$ce_policy$,o);
EXECUTE format($ce_policy$CREATE POLICY ce010_executor_read ON community.announcements FOR SELECT TO %I USING (community.announcements.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,clock_timestamp()) c where c.tenant_id=community.announcements.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.announcement.publish','community_basic',clock_timestamp()))$ce_policy$,e);
EXECUTE format($ce_policy$CREATE POLICY ce010_executor_insert ON community.announcements FOR INSERT TO %I WITH CHECK (community.announcements.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,clock_timestamp()) c where c.tenant_id=community.announcements.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.announcement.publish','community_basic',clock_timestamp()))$ce_policy$,e);
EXECUTE format($ce_policy$CREATE POLICY ce010_executor_update ON community.announcements FOR UPDATE TO %I USING (community.announcements.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,clock_timestamp()) c where c.tenant_id=community.announcements.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.announcement.publish','community_basic',clock_timestamp())) WITH CHECK (community.announcements.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,clock_timestamp()) c where c.tenant_id=community.announcements.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.community.read','community_basic',clock_timestamp()) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.announcements.workspace_id,'community.announcement.publish','community_basic',clock_timestamp()))$ce_policy$,e);
EXECUTE format($ce_policy$CREATE POLICY ce010_owner_read ON community.content_reports FOR SELECT TO %I USING (community.content_reports.workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.content_reports.workspace_id,clock_timestamp()) c where c.tenant_id=community.content_reports.tenant_id) and app_private.check_workspace_native_permission_v2_at_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,community.content_reports.workspace_id,'community.community.read','community_basic',clock_timestamp()))$ce_policy$,o);
REVOKE ALL ON FUNCTION app_private.ce_community_authorize_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
EXECUTE format('GRANT EXECUTE ON FUNCTION app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid) TO %I',e);
REVOKE ALL ON FUNCTION app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION customer_api.read_ce_community_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
EXECUTE format('GRANT EXECUTE ON FUNCTION customer_api.read_ce_community_v1(uuid,uuid) TO %I',e);
END $rights$;
DO $post$ DECLARE e oid:=to_regrole(current_setting('cladora.ce010.executor',true)); o oid:=to_regrole(current_setting('cladora.ce010.owner',true)); BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY['community.communities','community.announcements','community.content_reports']) v) AND (c.relowner<>o OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity))
 OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY['community.communities','community.announcements','community.content_reports']) v) AND a.grantee<>o)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute col ON col.attrelid=c.oid,LATERAL aclexplode(col.attacl) a
  WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY['community.communities','community.announcements','community.content_reports']) v) AND a.grantee<>o AND (a.grantee<>e OR a.is_grantable OR NOT EXISTS(SELECT 1 FROM (VALUES ('community.communities','id','SELECT'),('community.communities','tenant_id','SELECT'),('community.communities','workspace_id','SELECT'),('community.communities','version','SELECT'),('community.communities','audience','SELECT'),('community.communities','version','UPDATE'),('community.announcements','id','SELECT'),('community.announcements','tenant_id','SELECT'),('community.announcements','workspace_id','SELECT'),('community.announcements','community_id','SELECT'),('community.announcements','version','SELECT'),('community.announcements','audience','SELECT'),('community.announcements','status','SELECT'),('community.announcements','body','SELECT'),('community.announcements','id','INSERT'),('community.announcements','tenant_id','INSERT'),('community.announcements','workspace_id','INSERT'),('community.announcements','community_id','INSERT'),('community.announcements','body','INSERT'),('community.announcements','audience','INSERT'),('community.announcements','status','INSERT'),('community.announcements','version','INSERT'),('community.announcements','created_by','INSERT'),('community.announcements','status','UPDATE'),('community.announcements','version','UPDATE'),('community.announcements','updated_at','UPDATE')) allowed(tbl,colname,priv) WHERE allowed.tbl=n.nspname||'.'||c.relname AND allowed.colname=col.attname AND allowed.priv=a.privilege_type)))
 OR (SELECT count(*) FROM pg_policy WHERE polrelid IN(SELECT to_regclass(v) FROM unnest(ARRAY['community.communities','community.announcements','community.content_reports']) v))<>8
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid IN(SELECT to_regprocedure(v) FROM unnest(ARRAY['app_private.ce_community_authorize_v1(uuid,uuid,text)','app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid)','app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb)','customer_api.read_ce_community_v1(uuid,uuid)']) v)
  AND (p.proowner<>o OR (a.grantee<>o AND (a.grantee<>e OR a.is_grantable OR a.privilege_type<>'EXECUTE' OR p.proname NOT IN('ce_community_audience_valid_v1','read_ce_community_v1')))))
 THEN RAISE EXCEPTION 'ce010_postimage_acl_rls_mismatch' USING ERRCODE='55000';END IF;
 -- Full function-body/ABI/column/default/constraint/index/policy expression and
 -- protected role/default-ACL postimages are captured for independent verify.
END $post$;
COMMIT;
