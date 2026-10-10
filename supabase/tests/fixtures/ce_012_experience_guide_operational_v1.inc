-- CE012-OPS-01: REVIEW-ONLY proposal, not a migration.
-- Core owns permission/module registration and activation. This file seeds none.
begin;

create schema if not exists experience;

create table experience.guides (
 id uuid primary key,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 title text not null check (title=btrim(title) and length(title) between 2 and 160),
 audience jsonb not null,
 status text not null default 'draft' check (status in ('draft','published','cancelled')),
 version bigint not null default 1 check (version between 1 and 9007199254740991),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 unique (tenant_id,workspace_id,id)
);
create table experience.guide_steps (
 id uuid primary key,
 tenant_id uuid not null,
 workspace_id uuid not null,
 guide_id uuid not null,
 position smallint not null check (position between 1 and 100),
 title text not null check (title=btrim(title) and length(title) between 1 and 160),
 body text not null check (body=btrim(body) and length(body) between 1 and 5000),
 unique (tenant_id,workspace_id,guide_id,id),
 unique (guide_id,position),
 foreign key (tenant_id,workspace_id,guide_id) references experience.guides(tenant_id,workspace_id,id) on delete restrict
);
create table experience.guide_references (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 workspace_id uuid not null,
 guide_id uuid not null,
 step_id uuid not null,
 position smallint not null check (position between 1 and 20),
 target_type text not null check (target_type='document'),
 target_id uuid not null,
 label text not null check (label=btrim(label) and length(label) between 1 and 120),
 unique (step_id,position),
 foreign key (tenant_id,workspace_id,guide_id,step_id) references experience.guide_steps(tenant_id,workspace_id,guide_id,id) on delete restrict
);
create index ce_guides_workspace_idx on experience.guides(tenant_id,workspace_id,status,created_at,id);
create index ce_guide_steps_guide_idx on experience.guide_steps(tenant_id,workspace_id,guide_id,position);
create index ce_guide_references_target_idx on experience.guide_references(tenant_id,target_type,target_id);

-- Domain response projection only. Shared platform.idempotency_keys remains
-- the collision, fingerprint and expiry authority.
create table experience.guide_command_receipts (
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
create function app_private.ce_guide_receipt_immutable_v1() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'ce_guide_receipt_immutable' using errcode='42501'; end $$;
create trigger ce_guide_receipt_immutable before update or delete on experience.guide_command_receipts
for each row execute function app_private.ce_guide_receipt_immutable_v1();

do $$ declare t text; begin
 foreach t in array array['guides','guide_steps','guide_references','guide_command_receipts'] loop
  execute format('alter table experience.%I enable row level security',t);
  execute format('revoke all on experience.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

-- Proposed names require Core confirmation. No weaker permission or fallback
-- module is accepted, and this proposal never inserts registry records.
create function app_private.ce_guide_authorize_v1(p_context uuid,p_workspace uuid,p_permission text)
returns table (tenant_id uuid,membership_id uuid,role_code text)
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'ce_guide_access_denied' using errcode='42501'; end if;
 if p_permission not in ('experience.guide.read','experience.guide.manage')
  or not exists (
   select 1 from platform.module_definitions m
   join platform.module_permission_bindings b on b.module_definition_id=m.id
   join identity.permissions p on p.id=b.permission_id
   where m.code='experience_guides' and m.version=1 and m.entitlement_key='module.experience_guides'
    and m.is_active and m.lifecycle_status in ('active','published')
    and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp())
    and p.code=p_permission and b.lifecycle_status='active'
    and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
  ) then raise exception 'ce_guide_contract_not_ready' using errcode='55000'; end if;
 if app_private.check_workspace_native_permission_v2(p_context,p_workspace,p_permission,'experience_guides') is not true
  then raise exception 'ce_guide_access_denied' using errcode='42501'; end if;
 return query select c.tenant_id,c.membership_id,c.role_code
 from app_private.resolve_workspace_native_context_v2(p_context,p_workspace) c;
end $$;

create function app_private.ce_guide_audience_valid_v1(p_audience jsonb,p_tenant uuid,p_workspace uuid)
returns boolean language plpgsql stable set search_path=pg_catalog as $$
declare k text; begin
 if jsonb_typeof(p_audience) is distinct from 'object' then return false; end if;
 k:=p_audience->>'kind';
 if k='workspace' then return p_audience='{"kind":"workspace"}'::jsonb;
 elsif k='members' then
  if (p_audience-array['kind','membership_ids'])<>'{}'::jsonb
   or jsonb_typeof(p_audience->'membership_ids') is distinct from 'array'
   or jsonb_array_length(p_audience->'membership_ids') not between 1 and 500 then return false; end if;
  return not exists (
   select 1 from jsonb_array_elements(p_audience->'membership_ids') j(value)
   where jsonb_typeof(j.value)<>'string' or not exists (
    select 1 from identity.memberships m where m.id::text=lower(j.value#>>'{}') and m.tenant_id=p_tenant
     and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   )
  );
 elsif k='roles' then
  if (p_audience-array['kind','role_codes'])<>'{}'::jsonb
   or jsonb_typeof(p_audience->'role_codes') is distinct from 'array'
   or jsonb_array_length(p_audience->'role_codes') not between 1 and 32 then return false; end if;
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

create function app_private.ce_guide_steps_valid_v1(p_steps jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare s jsonb; r jsonb; begin
 if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) not between 1 and 100 then return false; end if;
 if (select count(distinct lower(value->>'id')) from jsonb_array_elements(p_steps))<>jsonb_array_length(p_steps) then return false; end if;
 for s in select value from jsonb_array_elements(p_steps) loop
  if (s-array['id','title','body','references'])<>'{}'::jsonb or not (s ?& array['id','title','body','references'])
   or jsonb_typeof(s->'id')<>'string' or (s->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(s->'title')<>'string' or length(btrim(s->>'title')) not between 1 and 160
   or jsonb_typeof(s->'body')<>'string' or length(btrim(s->>'body')) not between 1 and 5000
   or jsonb_typeof(s->'references')<>'array' or jsonb_array_length(s->'references')>20 then return false; end if;
  for r in select value from jsonb_array_elements(s->'references') loop
   if (r-array['target_type','target_id','label'])<>'{}'::jsonb or not (r ?& array['target_type','target_id','label'])
    or jsonb_typeof(r->'target_type')<>'string' or r->>'target_type'<>'document'
    or jsonb_typeof(r->'target_id')<>'string' or (r->>'target_id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(r->'label')<>'string' or length(btrim(r->>'label')) not between 1 and 120 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;

-- Documents remains the reference authority. This helper asks its existing,
-- read-only customer gateway for the exact document and exposes no metadata.
create function app_private.ce_guide_document_allowed_v1(p_context uuid,p_document uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; begin
 result:=customer_api.get_documents_v1(p_context,'documents',null,null,null,null,null,1,0,p_document);
 return result->'detail' is not null and result->'detail'<>'null'::jsonb
  and result->'detail'->>'status'='active';
exception when others then return false;
end $$;

create function app_private.ce_guide_request_references_allowed_v1(p_context uuid,p_steps jsonb)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare r jsonb; begin
 for r in select reference from jsonb_array_elements(p_steps) s(value)
  cross join lateral jsonb_array_elements(s.value->'references') x(reference)
 loop
  if app_private.ce_guide_document_allowed_v1(p_context,(r->>'target_id')::uuid) is not true then return false; end if;
 end loop;
 return true;
end $$;

create function app_private.ce_guide_current_references_allowed_v1(p_context uuid,p_guide uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare target uuid; begin
 for target in select r.target_id from experience.guide_references r where r.guide_id=p_guide loop
  if app_private.ce_guide_document_allowed_v1(p_context,target) is not true then return false; end if;
 end loop;
 return true;
end $$;

create function app_private.ce_guide_replace_steps_v1(p_tenant uuid,p_workspace uuid,p_guide uuid,p_steps jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 delete from experience.guide_references r where r.tenant_id=p_tenant and r.workspace_id=p_workspace and r.guide_id=p_guide;
 delete from experience.guide_steps s where s.tenant_id=p_tenant and s.workspace_id=p_workspace and s.guide_id=p_guide;
 insert into experience.guide_steps(id,tenant_id,workspace_id,guide_id,position,title,body)
 select (s.value->>'id')::uuid,p_tenant,p_workspace,p_guide,s.ordinality::smallint,btrim(s.value->>'title'),btrim(s.value->>'body')
 from jsonb_array_elements(p_steps) with ordinality s(value,ordinality);
 insert into experience.guide_references(tenant_id,workspace_id,guide_id,step_id,position,target_type,target_id,label)
 select p_tenant,p_workspace,p_guide,(s.value->>'id')::uuid,r.ordinality::smallint,'document',(r.value->>'target_id')::uuid,btrim(r.value->>'label')
 from jsonb_array_elements(p_steps) with ordinality s(value,ordinality)
 cross join lateral jsonb_array_elements(s.value->'references') with ordinality r(value,ordinality);
end $$;

create function customer_api.command_ce_guide_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
#variable_conflict use_variable
declare
 actor uuid:=auth.uid(); s record; checked record; cmd text; required text[]; k text;
 context_id uuid; workspace_id uuid; command_id uuid; guide_id uuid; expected bigint;
 canonical text; hash text; reason text; response jsonb;
 g experience.guides%rowtype; prior experience.guide_command_receipts%rowtype; idem platform.idempotency_keys%rowtype;
begin
 if actor is null or jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023'; end if;
 cmd:=p_request->>'type';
 required:=array['type','command_id','idempotency_key','context_id','workspace_id','guide_id','expected_version','reason'];
 case cmd
  when 'create_guide','revise_guide' then required:=required||array['title','audience','steps'];
  when 'publish_guide','cancel_guide' then null;
  else raise exception 'invalid_request' using errcode='22023';
 end case;
 if not(p_request ?& required) or (p_request-required)<>'{}'::jsonb then raise exception 'invalid_request' using errcode='22023'; end if;
 foreach k in array required loop
  if k not in ('audience','steps','expected_version') and jsonb_typeof(p_request->k) is distinct from 'string'
   then raise exception 'invalid_request' using errcode='22023'; end if;
  if k like '%_id' and (p_request->>k)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then raise exception 'invalid_request' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(p_request->'expected_version') is distinct from 'number' or (p_request->>'expected_version')!~'^[0-9]+$'
  or (p_request->>'expected_version')::numeric>9007199254740991
  or p_request->>'idempotency_key'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or length(btrim(p_request->>'reason')) not between 5 and 500 then raise exception 'invalid_request' using errcode='22023'; end if;
 if cmd in ('create_guide','revise_guide') and (
   jsonb_typeof(p_request->'title')<>'string' or length(btrim(p_request->>'title')) not between 2 and 160
   or app_private.ce_guide_steps_valid_v1(p_request->'steps') is not true
  ) then raise exception 'invalid_request' using errcode='22023'; end if;
 context_id:=(p_request->>'context_id')::uuid; workspace_id:=(p_request->>'workspace_id')::uuid;
 command_id:=(p_request->>'command_id')::uuid; guide_id:=(p_request->>'guide_id')::uuid;
 expected:=(p_request->>'expected_version')::bigint; reason:=btrim(p_request->>'reason');
 select * into strict s from app_private.ce_guide_authorize_v1(context_id,workspace_id,'experience.guide.manage');
 if p_request ? 'audience' and app_private.ce_guide_audience_valid_v1(p_request->'audience',s.tenant_id,workspace_id) is not true
  then raise exception 'invalid_audience' using errcode='22023'; end if;

 canonical:='ce.guide.'||cmd||'.v1/'||workspace_id||'/'||command_id||'/'||(p_request->>'idempotency_key');
 hash:=encode(sha256(convert_to(jsonb_build_object('schema_version',1,'actor_id',actor,'tenant_id',s.tenant_id,
  'membership_id',s.membership_id,'context_id',context_id,'command',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(s.tenant_id,actor,canonical,hash,statement_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict idem from platform.idempotency_keys where tenant_id=s.tenant_id and key=canonical for update;
 select * into strict checked from app_private.ce_guide_authorize_v1(context_id,workspace_id,'experience.guide.manage');
 if checked.tenant_id<>s.tenant_id or checked.membership_id<>s.membership_id
  or idem.actor_id is distinct from actor or idem.request_hash<>hash or idem.expires_at<=statement_timestamp()
  then raise exception 'ce_guide_idempotency_conflict' using errcode='23505'; end if;
 select * into g from experience.guides x where x.id=guide_id and x.tenant_id=s.tenant_id and x.workspace_id=workspace_id for update;
 if idem.response_ref is not null then
  select * into prior from experience.guide_command_receipts x where x.tenant_id=s.tenant_id and x.canonical_key=canonical;
  if prior.actor_id is distinct from actor or prior.membership_id is distinct from s.membership_id
   or prior.workspace_id is distinct from workspace_id or prior.context_id is distinct from context_id or prior.command is distinct from cmd
   then raise exception 'ce_guide_idempotency_conflict' using errcode='23505'; end if;
  return prior.response_json||jsonb_build_object('replayed',true);
 end if;

 if cmd in ('create_guide','revise_guide')
  and app_private.ce_guide_request_references_allowed_v1(context_id,p_request->'steps') is not true
  then raise exception 'ce_guide_reference_denied' using errcode='42501'; end if;
 if cmd='create_guide' then
  if g.id is not null or expected<>0 then raise exception 'ce_guide_version_conflict' using errcode='40001'; end if;
  insert into experience.guides(id,tenant_id,workspace_id,title,audience,created_by)
   values(guide_id,s.tenant_id,workspace_id,btrim(p_request->>'title'),p_request->'audience',actor) returning * into g;
  perform app_private.ce_guide_replace_steps_v1(s.tenant_id,workspace_id,g.id,p_request->'steps');
 elsif cmd='revise_guide' then
  if g.id is null then raise exception 'ce_guide_not_found' using errcode='P0002'; end if;
  if g.version<>expected or g.status<>'draft' then raise exception 'ce_guide_version_conflict' using errcode='40001'; end if;
  update experience.guides x set title=btrim(p_request->>'title'),audience=p_request->'audience',version=x.version+1,
   updated_at=statement_timestamp() where x.id=g.id returning * into g;
  perform app_private.ce_guide_replace_steps_v1(s.tenant_id,workspace_id,g.id,p_request->'steps');
 else
  if g.id is null then raise exception 'ce_guide_not_found' using errcode='P0002'; end if;
  if g.version<>expected or (cmd='publish_guide' and g.status<>'draft') or (cmd='cancel_guide' and g.status='cancelled')
   then raise exception 'ce_guide_version_conflict' using errcode='40001'; end if;
  if cmd='publish_guide' and app_private.ce_guide_current_references_allowed_v1(context_id,g.id) is not true
   then raise exception 'ce_guide_reference_denied' using errcode='42501'; end if;
  update experience.guides x set status=case when cmd='publish_guide' then 'published' else 'cancelled' end,
   version=x.version+1,updated_at=statement_timestamp() where x.id=g.id returning * into g;
 end if;
 response:=jsonb_build_object('entity_type','experience_guide','entity_id',g.id,'version',g.version,'command',cmd,'replayed',false);
 insert into experience.guide_command_receipts(tenant_id,canonical_key,workspace_id,context_id,actor_id,membership_id,command,response_json)
  values(s.tenant_id,canonical,workspace_id,context_id,actor,s.membership_id,cmd,response);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot,reason)
  values(s.tenant_id,actor,'ce.'||cmd,'experience_guide',g.id,command_id,response,reason);
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
  values(s.tenant_id,'experience_guide',g.id,g.version,'ce.'||cmd||'.v1',response,command_id);
 update platform.idempotency_keys x set response_ref=response,status_code=200 where x.tenant_id=s.tenant_id and x.key=canonical;
 return response;
end $$;

create function customer_api.read_ce_guides_v1(p_context_id uuid,p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare s record; manager boolean; guides jsonb; begin
 select * into strict s from app_private.ce_guide_authorize_v1(p_context_id,p_workspace_id,'experience.guide.read');
 manager:=coalesce(app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'experience.guide.manage','experience_guides'),false);
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]') into guides from (
  select g.id,g.created_at,jsonb_build_object(
   'guide_id',g.id,'workspace_id',g.workspace_id,'title',g.title,'audience',g.audience,'status',g.status,'version',g.version,
   'can_edit',(manager and g.status='draft'),
   'steps',coalesce((select jsonb_agg(jsonb_build_object(
     'id',st.id,'title',st.title,'body',st.body,
     'references',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'target_type',r.target_type,'label',r.label) order by r.position)
       from experience.guide_references r where r.guide_id=g.id and r.step_id=st.id),'[]'::jsonb)
    ) order by st.position) from experience.guide_steps st where st.guide_id=g.id),'[]'::jsonb)
  ) item
  from experience.guides g where g.tenant_id=s.tenant_id and g.workspace_id=p_workspace_id
   and (manager or (g.status='published' and app_private.ce_guide_audience_allows_v1(p_context_id,p_workspace_id,g.audience)))
  order by g.created_at,g.id limit 50
 ) q;
 return jsonb_build_object('guides',guides,'limit',50);
end $$;

create function customer_api.resolve_ce_guide_reference_v1(p_context_id uuid,p_workspace_id uuid,p_reference_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare s record; manager boolean; r experience.guide_references%rowtype; g experience.guides%rowtype; begin
 select * into strict s from app_private.ce_guide_authorize_v1(p_context_id,p_workspace_id,'experience.guide.read');
 manager:=coalesce(app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'experience.guide.manage','experience_guides'),false);
 select * into r from experience.guide_references x where x.id=p_reference_id and x.tenant_id=s.tenant_id and x.workspace_id=p_workspace_id;
 if r.id is null then raise exception 'ce_guide_reference_not_found' using errcode='P0002'; end if;
 select * into strict g from experience.guides x where x.id=r.guide_id and x.tenant_id=s.tenant_id and x.workspace_id=p_workspace_id;
 if not (manager or (g.status='published' and app_private.ce_guide_audience_allows_v1(p_context_id,p_workspace_id,g.audience)))
  or app_private.ce_guide_document_allowed_v1(p_context_id,r.target_id) is not true
  then raise exception 'ce_guide_reference_denied' using errcode='42501'; end if;
 return jsonb_build_object('reference_id',r.id,'target_type','document','target_id',r.target_id,'label',r.label);
end $$;

revoke all on function app_private.ce_guide_receipt_immutable_v1(),
 app_private.ce_guide_authorize_v1(uuid,uuid,text),app_private.ce_guide_audience_valid_v1(jsonb,uuid,uuid),
 app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb),app_private.ce_guide_steps_valid_v1(jsonb),
 app_private.ce_guide_document_allowed_v1(uuid,uuid),app_private.ce_guide_request_references_allowed_v1(uuid,jsonb),
 app_private.ce_guide_current_references_allowed_v1(uuid,uuid),app_private.ce_guide_replace_steps_v1(uuid,uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;
revoke all on function customer_api.command_ce_guide_v1(jsonb),customer_api.read_ce_guides_v1(uuid,uuid),
 customer_api.resolve_ce_guide_reference_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.command_ce_guide_v1(jsonb),customer_api.read_ce_guides_v1(uuid,uuid),
 customer_api.resolve_ce_guide_reference_v1(uuid,uuid,uuid) to authenticated;
commit;
