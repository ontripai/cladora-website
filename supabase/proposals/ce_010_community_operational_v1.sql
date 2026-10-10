-- CE010-OPS-01: REVIEW-ONLY proposal, not a migration.
-- Core owns permission/module registration and activation. This file seeds none.
begin;

create schema if not exists community;

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

-- A domain response projection, not another idempotency engine or audit ledger.
-- Shared platform.idempotency_keys remains the collision and expiry authority.
create table community.community_command_receipts (
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 canonical_key text not null,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 context_id uuid not null references identity.context_grants(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 membership_id uuid not null references identity.memberships(id) on delete restrict,
 command text not null,
 response_json jsonb not null,
 created_at timestamptz not null default statement_timestamp(),
 primary key (tenant_id,canonical_key)
);
create function app_private.ce_community_receipt_immutable_v1() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'ce_community_receipt_immutable' using errcode='42501'; end $$;
create trigger ce_community_receipt_immutable before update or delete on community.community_command_receipts
for each row execute function app_private.ce_community_receipt_immutable_v1();

do $$ declare t text; begin
 foreach t in array array['communities','announcements','content_reports','community_command_receipts'] loop
  execute format('alter table community.%I enable row level security',t);
  execute format('revoke all on community.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

-- Proposed module and permission names require Core confirmation before activation.
-- No fallback to another module or a weaker permission is permitted.
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

-- Membership and Workspace are resolved by C01; audience is CE content policy.
-- Only Workspace-wide, live, lineage-valid local roles are accepted here.
-- A role scoped to a different property/building/unit cannot widen CE audience.
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

create function customer_api.command_ce_community_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
#variable_conflict use_variable
declare
 actor uuid:=auth.uid(); s record; checked record; cmd text; permission text; required text[]; k text;
 context_id uuid; workspace_id uuid; command_id uuid; community_id uuid; subject_id uuid;
 expected bigint; canonical text; hash text; reason text; response jsonb; entity text;
 c community.communities%rowtype; a community.announcements%rowtype; r community.content_reports%rowtype;
 prior community.community_command_receipts%rowtype; idem platform.idempotency_keys%rowtype;
begin
 if actor is null then raise exception 'ce_community_access_denied' using errcode='42501'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023'; end if;
 cmd:=p_request->>'type';
 required:=array['type','command_id','idempotency_key','context_id','workspace_id','community_id','expected_version','reason'];
 case cmd
  when 'create_community' then required:=required||array['name','audience']; permission:='community.community.manage';
  when 'create_announcement' then required:=required||array['announcement_id','body','audience']; permission:='community.announcement.publish';
  when 'publish_announcement','cancel_announcement' then required:=required||array['announcement_id']; permission:='community.announcement.publish';
  when 'report_content' then required:=required||array['report_id','target_type','target_id','report_reason']; permission:='community.report.create';
  when 'decide_content_report' then required:=required||array['report_id','decision','decision_reason']; permission:='community.report.decide';
  else raise exception 'invalid_request' using errcode='22023';
 end case;
 if not(p_request ?& required) or (p_request-required)<>'{}'::jsonb then raise exception 'invalid_request' using errcode='22023'; end if;
 foreach k in array required loop
  if k not in ('audience','expected_version') and jsonb_typeof(p_request->k) is distinct from 'string'
   then raise exception 'invalid_request' using errcode='22023'; end if;
  if k like '%_id' and (p_request->>k)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then raise exception 'invalid_request' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(p_request->'expected_version') is distinct from 'number'
  or (p_request->>'expected_version')!~'^[0-9]+$' then raise exception 'invalid_request' using errcode='22023'; end if;
 if (p_request->>'expected_version')::numeric>9007199254740991
  or p_request->>'idempotency_key'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or length(btrim(p_request->>'reason')) not between 5 and 500 then raise exception 'invalid_request' using errcode='22023'; end if;
 context_id:=(p_request->>'context_id')::uuid; workspace_id:=(p_request->>'workspace_id')::uuid;
 command_id:=(p_request->>'command_id')::uuid; community_id:=(p_request->>'community_id')::uuid;
 expected:=(p_request->>'expected_version')::bigint; reason:=btrim(p_request->>'reason');
 select * into strict s from app_private.ce_community_authorize_v1(context_id,workspace_id,permission);
 if p_request ? 'audience' and app_private.ce_community_audience_valid_v1(p_request->'audience',s.tenant_id,workspace_id) is not true
  then raise exception 'invalid_audience' using errcode='22023'; end if;

 canonical:='ce.community.'||cmd||'.v1/'||workspace_id||'/'||command_id||'/'||(p_request->>'idempotency_key');
 hash:=encode(sha256(convert_to(jsonb_build_object('schema_version',1,'actor_id',actor,'tenant_id',s.tenant_id,
  'membership_id',s.membership_id,'context_id',context_id,'command',p_request)::text,'UTF8')),'hex');
 -- The shared key is locked before the aggregate; all CE010 commands use this order.
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(s.tenant_id,actor,canonical,hash,statement_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict idem from platform.idempotency_keys where tenant_id=s.tenant_id and key=canonical for update;
 select * into strict checked from app_private.ce_community_authorize_v1(context_id,workspace_id,permission);
 if checked.tenant_id<>s.tenant_id or checked.membership_id<>s.membership_id
  or idem.actor_id is distinct from actor or idem.request_hash<>hash or idem.expires_at<=statement_timestamp()
  then raise exception 'ce_community_idempotency_conflict' using errcode='23505'; end if;

 select * into c from community.communities x where x.id=community_id and x.tenant_id=s.tenant_id and x.workspace_id=workspace_id for update;
 if cmd<>'create_community' and c.id is null then raise exception 'ce_community_not_found' using errcode='P0002'; end if;
 -- Reporting, including replay, must still see both Community and target audiences.
 if cmd='report_content' then
  select * into a from community.announcements x where x.id=(p_request->>'target_id')::uuid and x.tenant_id=s.tenant_id
    and x.workspace_id=workspace_id and x.community_id=community_id for update;
  if p_request->>'target_type'<>'announcement' or a.id is null or a.status<>'published'
   or app_private.ce_community_audience_allows_v1(context_id,workspace_id,c.audience) is not true
   or app_private.ce_community_audience_allows_v1(context_id,workspace_id,a.audience) is not true
   then raise exception 'ce_community_audience_denied' using errcode='42501'; end if;
 end if;
 if idem.response_ref is not null then
  select * into prior from community.community_command_receipts x where x.tenant_id=s.tenant_id and x.canonical_key=canonical;
  if prior.actor_id is distinct from actor or prior.membership_id is distinct from s.membership_id
   or prior.workspace_id is distinct from workspace_id or prior.context_id is distinct from context_id or prior.command is distinct from cmd
   then raise exception 'ce_community_idempotency_conflict' using errcode='23505'; end if;
  return prior.response_json||jsonb_build_object('replayed',true);
 end if;

 if cmd='create_community' then
  if c.id is not null or expected<>0 then raise exception 'ce_community_version_conflict' using errcode='40001'; end if;
  insert into community.communities(id,tenant_id,workspace_id,name,audience,created_by)
   values(community_id,s.tenant_id,workspace_id,btrim(p_request->>'name'),p_request->'audience',actor) returning * into c;
  entity:='community'; subject_id:=c.id; expected:=c.version;
 elsif cmd='create_announcement' then
  if c.version<>expected then raise exception 'ce_community_version_conflict' using errcode='40001'; end if;
  insert into community.announcements(id,tenant_id,workspace_id,community_id,body,audience,created_by)
   values((p_request->>'announcement_id')::uuid,s.tenant_id,workspace_id,community_id,btrim(p_request->>'body'),p_request->'audience',actor) returning * into a;
  entity:='community_announcement'; subject_id:=a.id; expected:=a.version;
 elsif cmd in ('publish_announcement','cancel_announcement') then
  select * into a from community.announcements x where x.id=(p_request->>'announcement_id')::uuid and x.tenant_id=s.tenant_id
    and x.workspace_id=workspace_id and x.community_id=community_id for update;
  if a.id is null then raise exception 'ce_community_not_found' using errcode='P0002'; end if;
  if a.version<>expected or (cmd='publish_announcement' and a.status<>'draft') or (cmd='cancel_announcement' and a.status='cancelled')
   then raise exception 'ce_community_version_conflict' using errcode='40001'; end if;
  update community.announcements x set status=case when cmd='publish_announcement' then 'published' else 'cancelled' end,
   version=x.version+1,updated_at=statement_timestamp() where x.id=a.id returning * into a;
  entity:='community_announcement'; subject_id:=a.id; expected:=a.version;
 elsif cmd='report_content' then
  if expected<>0 then raise exception 'ce_community_version_conflict' using errcode='40001'; end if;
  insert into community.content_reports(id,tenant_id,workspace_id,community_id,target_type,target_id,reporter_membership_id,report_reason)
   values((p_request->>'report_id')::uuid,s.tenant_id,workspace_id,community_id,'announcement',a.id,s.membership_id,btrim(p_request->>'report_reason')) returning * into r;
  entity:='community_content_report'; subject_id:=r.id; expected:=r.version;
 else
  select * into r from community.content_reports x where x.id=(p_request->>'report_id')::uuid and x.tenant_id=s.tenant_id
    and x.workspace_id=workspace_id and x.community_id=community_id for update;
  if r.id is null then raise exception 'ce_community_not_found' using errcode='P0002'; end if;
  if r.version<>expected or r.status<>'open' then raise exception 'ce_community_version_conflict' using errcode='40001'; end if;
  if p_request->>'decision' not in ('dismissed','action_required') then raise exception 'invalid_request' using errcode='22023'; end if;
  update community.content_reports x set status=p_request->>'decision',decision_reason=btrim(p_request->>'decision_reason'),decided_by=actor,
   version=x.version+1 where x.id=r.id returning * into r;
  entity:='community_content_report'; subject_id:=r.id; expected:=r.version;
 end if;
 response:=jsonb_build_object('entity_type',entity,'entity_id',subject_id,'version',expected,'command',cmd,'replayed',false);
 insert into community.community_command_receipts(tenant_id,canonical_key,workspace_id,context_id,actor_id,membership_id,command,response_json)
  values(s.tenant_id,canonical,workspace_id,context_id,actor,s.membership_id,cmd,response);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot,reason)
  values(s.tenant_id,actor,'ce.'||cmd,entity,subject_id,command_id,
    response||case when cmd='decide_content_report' then jsonb_build_object('decision',r.status,'decision_reason',r.decision_reason) else '{}'::jsonb end,reason);
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
  values(s.tenant_id,entity,subject_id,expected,'ce.'||cmd||'.v1',response,command_id);
 update platform.idempotency_keys x set response_ref=response,status_code=200 where x.tenant_id=s.tenant_id and x.key=canonical;
 return response;
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

revoke all on function app_private.ce_community_receipt_immutable_v1(),
 app_private.ce_community_authorize_v1(uuid,uuid,text),app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid),
 app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function customer_api.command_ce_community_v1(jsonb),customer_api.read_ce_community_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.command_ce_community_v1(jsonb),customer_api.read_ce_community_v1(uuid,uuid) to authenticated;
commit;
