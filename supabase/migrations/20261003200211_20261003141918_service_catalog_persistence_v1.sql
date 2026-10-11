begin;

-- SERVICE owns only this schema and its registry entries. No role grants,
-- activation, entitlement or taxonomy assignment is inferred by this migration.
create schema service_catalog;
revoke all on schema service_catalog from public,anon,authenticated,service_role;

insert into identity.permissions(code,resource,action,description) values
 ('services.catalog.read','services.catalog','read','Read authorized workspace service catalogue'),
 ('services.catalog.manage','services.catalog','manage','Manage workspace catalogue drafts'),
 ('services.catalog.publish','services.catalog','publish','Approve catalogue publication as a separate actor')
on conflict(code) do nothing;
insert into platform.module_definitions(code,name,labels_json,description,category,lifecycle_status,entitlement_key,published_at)
values('services_catalog','Service catalogue','{"ro":"Catalog servicii","en":"Service catalogue","fa":"کاتالوگ خدمات"}',
 'Versioned workspace service offerings','services','published','module.services_catalog',statement_timestamp())
on conflict(code,version) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable)
select m.id,p.id,case when p.action='read' then 'read' else 'manage' end,false
from platform.module_definitions m cross join identity.permissions p
where m.code='services_catalog' and m.version=1 and p.resource='services.catalog'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create table service_catalog.definitions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id),
 workspace_id uuid not null references platform.customer_workspaces(id),
 code text not null check(code ~ '^[a-z][a-z0-9_]{1,63}$'),
 labels jsonb not null,
 active boolean not null default true,
 unique(tenant_id,workspace_id,code),unique(tenant_id,workspace_id,id)
);
create table service_catalog.offerings(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id),
 workspace_id uuid not null references platform.customer_workspaces(id),
 definition_id uuid not null,
 provider_party_id uuid not null references portfolio.parties(id),
 lock_version bigint not null default 1 check(lock_version between 1 and 9007199254740991),
 current_revision_id uuid not null,
 published_revision_id uuid,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default statement_timestamp(),
 unique(tenant_id,workspace_id,id),
 foreign key(tenant_id,workspace_id,definition_id) references service_catalog.definitions(tenant_id,workspace_id,id)
);
create table service_catalog.revisions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 workspace_id uuid not null,
 offering_id uuid not null,
 commercial_terms jsonb not null,
 valid_from timestamptz not null,
 valid_until timestamptz check(valid_until>valid_from),
 status text not null default 'draft' check(status in('draft','submitted','published','suspended','archived')),
 created_by uuid not null references auth.users(id),
 submitted_by uuid references auth.users(id),
 published_by uuid references auth.users(id),
 created_at timestamptz not null default statement_timestamp(),
 unique(tenant_id,workspace_id,offering_id,id),
 foreign key(tenant_id,workspace_id,offering_id) references service_catalog.offerings(tenant_id,workspace_id,id),
 check(published_by is null or (submitted_by is not null and published_by<>submitted_by and published_by<>created_by))
);
alter table service_catalog.offerings add foreign key(tenant_id,workspace_id,id,current_revision_id)
 references service_catalog.revisions(tenant_id,workspace_id,offering_id,id) deferrable initially deferred;
alter table service_catalog.offerings add foreign key(tenant_id,workspace_id,id,published_revision_id)
 references service_catalog.revisions(tenant_id,workspace_id,offering_id,id) deferrable initially deferred;
create index service_catalog_provider_idx on service_catalog.offerings(provider_party_id);
create index service_catalog_revision_lookup_idx on service_catalog.revisions(tenant_id,workspace_id,offering_id);
alter table service_catalog.definitions enable row level security;
alter table service_catalog.offerings enable row level security;
alter table service_catalog.revisions enable row level security;
revoke all on all tables in schema service_catalog from public,anon,authenticated,service_role;

create function app_private.service_catalog_labels_valid_v1(p_value jsonb,p_max integer)
returns boolean language plpgsql immutable set search_path=pg_catalog
as $$
declare v_locale text;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p_value))<>3 then return false; end if;
 foreach v_locale in array array['ro','en','fa'] loop
  if jsonb_typeof(p_value->v_locale) is distinct from 'string'
   or length(btrim(p_value->>v_locale)) not between 1 and p_max
   or btrim(p_value->>v_locale)<>p_value->>v_locale then return false; end if;
 end loop;
 return true;
end;
$$;
alter table service_catalog.definitions add check(app_private.service_catalog_labels_valid_v1(labels,200));

create function app_private.service_catalog_revision_valid_v1(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog
as $$
declare v_price jsonb; v_kind text; v_start timestamptz; v_end timestamptz; v_count integer;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p_value))<>9
 or not (p_value ?& array['labels','description','acquisition_mode','price','valid_from','valid_until','cancellation_terms','acceptance_criteria','document_version_ids']) then return false; end if;
 if not app_private.service_catalog_labels_valid_v1(p_value->'labels',200)
 or not app_private.service_catalog_labels_valid_v1(p_value->'description',5000)
 or not app_private.service_catalog_labels_valid_v1(p_value->'cancellation_terms',3000)
 or not app_private.service_catalog_labels_valid_v1(p_value->'acceptance_criteria',3000)
 or coalesce(p_value->>'acquisition_mode','') not in('direct','pre_quote','on_site','project','reservation') then return false; end if;
 -- Documents require a separate authorized Workspace document-link contract.
 -- Until it exists, reject attachment claims instead of trusting UUID ownership.
 if p_value->'document_version_ids' is distinct from '[]'::jsonb then return false; end if;
 if coalesce(p_value->>'valid_from','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
 v_start:=(p_value->>'valid_from')::timestamptz;
 if p_value->'valid_until'<>'null'::jsonb then
  if coalesce(p_value->>'valid_until','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
  v_end:=(p_value->>'valid_until')::timestamptz;
  if v_end<=v_start then return false; end if;
 end if;
 v_price:=p_value->'price'; v_kind:=v_price->>'kind';
 if jsonb_typeof(v_price) is distinct from 'object' then return false; end if;
 select count(*) into v_count from jsonb_object_keys(v_price);
 if v_kind='quote_required' then return v_count=1 and p_value->>'acquisition_mode'<>'direct'; end if;
 if coalesce(v_kind,'') not in('fixed','unit') or v_count<>(case when v_kind='fixed' then 4 else 5 end)
 or not(v_price ?& array['kind','amount','currency','tax_display'])
 or jsonb_typeof(v_price->'amount') is distinct from 'string'
 or coalesce(v_price->>'amount','') !~ '^(0|[1-9][0-9]{0,14})(\.[0-9]{1,6})?$'
 or coalesce(v_price->>'currency','') not in('RON','EUR','GBP','USD')
 or coalesce(v_price->>'tax_display','') not in('included','excluded','not_applicable') then return false; end if;
 if v_kind='fixed' and length(split_part(v_price->>'amount','.',2))>2 then return false; end if;
 if v_kind='unit' and (jsonb_typeof(v_price->'unit_code') is distinct from 'string'
 or length(btrim(v_price->>'unit_code')) not between 1 and 64
 or btrim(v_price->>'unit_code')<>v_price->>'unit_code') then return false; end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;
alter table service_catalog.revisions add check(app_private.service_catalog_revision_valid_v1(commercial_terms));
alter table service_catalog.revisions add check(valid_from=(commercial_terms->>'valid_from')::timestamptz
 and valid_until is not distinct from (commercial_terms->>'valid_until')::timestamptz);

create function app_private.service_catalog_revision_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
 if tg_op='DELETE' or (new.id,new.tenant_id,new.workspace_id,new.offering_id,new.commercial_terms,new.valid_from,new.valid_until,new.created_by,new.created_at)
 is distinct from (old.id,old.tenant_id,old.workspace_id,old.offering_id,old.commercial_terms,old.valid_from,old.valid_until,old.created_by,old.created_at) then
  raise exception 'service_revision_immutable' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger service_catalog_revision_immutable before update or delete on service_catalog.revisions
 for each row execute function app_private.service_catalog_revision_immutable_v1();

create function app_private.service_catalog_authorize_v1(p_context uuid,p_workspace uuid,p_permission text)
returns uuid language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_tenant uuid;
begin
 select tenant_id into strict v_tenant from app_private.resolve_workspace_native_context_v2(p_context,p_workspace);
 if app_private.check_workspace_native_permission_v2(p_context,p_workspace,p_permission,'services_catalog') is not true then
  raise exception 'service_catalog_access_denied' using errcode='42501';
 end if;
 return v_tenant;
end;
$$;

create function customer_api.list_service_catalog_v1(p_context_id uuid,p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_result jsonb;
begin
 v_tenant:=app_private.service_catalog_authorize_v1(p_context_id,p_workspace_id,'services.catalog.read');
 select coalesce(jsonb_agg(jsonb_build_object('offering_id',o.id,'revision_id',r.id,
 'labels',r.commercial_terms->'labels','description',r.commercial_terms->'description',
 'acquisition_mode',r.commercial_terms->'acquisition_mode','price',r.commercial_terms->'price',
 'valid_from',r.commercial_terms->'valid_from','valid_until',r.commercial_terms->'valid_until',
 'cancellation_terms',r.commercial_terms->'cancellation_terms','acceptance_criteria',r.commercial_terms->'acceptance_criteria') order by o.id),'[]'::jsonb)
 into v_result from service_catalog.offerings o
 join service_catalog.revisions r on (r.tenant_id,r.workspace_id,r.offering_id,r.id)=(o.tenant_id,o.workspace_id,o.id,o.published_revision_id)
 join service_catalog.definitions d on (d.tenant_id,d.workspace_id,d.id)=(o.tenant_id,o.workspace_id,o.definition_id)
 join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=o.tenant_id
 where o.tenant_id=v_tenant and o.workspace_id=p_workspace_id and d.active and p.archived_at is null
 and r.status='published' and r.valid_from<=statement_timestamp() and (r.valid_until is null or r.valid_until>statement_timestamp());
 return v_result;
end;
$$;

create function customer_api.mutate_service_catalog_v1(p_kind text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare
 v_context uuid; v_workspace uuid; v_tenant uuid; v_actor uuid:=auth.uid(); v_key text; v_hash text;
 v_idem platform.idempotency_keys%rowtype; v_offering service_catalog.offerings%rowtype;
 v_revision service_catalog.revisions%rowtype; v_id uuid; v_revision_id uuid; v_status text;
 v_action text; v_response jsonb; v_before jsonb; v_permission text; v_expected bigint;
begin
 if v_actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
 if p_kind is null or p_kind not in('create','revise','transition') or jsonb_typeof(p_request) is distinct from 'object' then
  raise exception 'invalid_request' using errcode='22023'; end if;
 if not(p_request ?& array['context_id','workspace_id','idempotency_key']) then raise exception 'invalid_request' using errcode='22023'; end if;
 if jsonb_typeof(p_request->'context_id') is distinct from 'string'
 or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string'
 or (p_kind='create' and (not(p_request ?& array['definition_id','provider_party_id','revision'])
  or p_request-array['context_id','workspace_id','idempotency_key','definition_id','provider_party_id','revision']<>'{}'::jsonb))
 or (p_kind='revise' and (not(p_request ?& array['offering_id','expected_lock_version','revision'])
  or p_request-array['context_id','workspace_id','idempotency_key','offering_id','expected_lock_version','revision']<>'{}'::jsonb))
 or (p_kind='transition' and (not(p_request ?& array['offering_id','expected_lock_version','revision_id','action','reason'])
  or p_request-array['context_id','workspace_id','idempotency_key','offering_id','expected_lock_version','revision_id','action','reason']<>'{}'::jsonb)) then
  raise exception 'invalid_request' using errcode='22023'; end if;
 v_context:=(p_request->>'context_id')::uuid; v_workspace:=(p_request->>'workspace_id')::uuid;
 v_action:=p_request->>'action';
 v_permission:=case when p_kind='transition' and v_action='publish' then 'services.catalog.publish' else 'services.catalog.manage' end;
 v_tenant:=app_private.service_catalog_authorize_v1(v_context,v_workspace,v_permission);
 if coalesce(p_request->>'idempotency_key','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
 -- Trusted SQL computes its own versioned fingerprint. No client hash is accepted.
 v_key:='service_catalog:sql_v1:'||v_workspace||':'||p_kind||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'kind',p_kind,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,v_actor,v_key,v_hash,statement_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash then raise exception 'idempotency_conflict' using errcode='23505'; end if;
 if v_idem.expires_at<=statement_timestamp() then raise exception 'idempotency_expired' using errcode='23505'; end if;
 if v_idem.response_ref is not null then return v_idem.response_ref; end if;

 if p_kind in('create','revise') then
  if not app_private.service_catalog_revision_valid_v1(p_request->'revision') then raise exception 'invalid_revision' using errcode='22023'; end if;
  v_revision_id:=gen_random_uuid();
 end if;
 if p_kind='create' then
  if (select count(*) from jsonb_object_keys(p_request))<>6 or not(p_request ?& array['definition_id','provider_party_id','revision']) then raise exception 'invalid_request' using errcode='22023'; end if;
  if not exists(select 1 from service_catalog.definitions d where d.id=(p_request->>'definition_id')::uuid and d.tenant_id=v_tenant and d.workspace_id=v_workspace and d.active)
  or not exists(select 1 from portfolio.parties p where p.id=(p_request->>'provider_party_id')::uuid and p.tenant_id=v_tenant and p.archived_at is null) then
   raise exception 'invalid_reference' using errcode='22023'; end if;
  v_id:=gen_random_uuid();
  insert into service_catalog.offerings(id,tenant_id,workspace_id,definition_id,provider_party_id,current_revision_id,created_by)
  values(v_id,v_tenant,v_workspace,(p_request->>'definition_id')::uuid,(p_request->>'provider_party_id')::uuid,v_revision_id,v_actor) returning * into v_offering;
 else
  if (select count(*) from jsonb_object_keys(p_request))<>(case when p_kind='revise' then 6 else 8 end) then raise exception 'invalid_request' using errcode='22023'; end if;
  v_id:=(p_request->>'offering_id')::uuid;
  select * into v_offering from service_catalog.offerings where id=v_id and tenant_id=v_tenant and workspace_id=v_workspace for update;
  if not found then raise exception 'offering_not_found' using errcode='P0002'; end if;
  v_before:=to_jsonb(v_offering);
  if jsonb_typeof(p_request->'expected_lock_version') is distinct from 'number'
  or (p_request->>'expected_lock_version') !~ '^[1-9][0-9]*$' then raise exception 'invalid_version' using errcode='22023'; end if;
  v_expected:=(p_request->>'expected_lock_version')::bigint;
  if v_expected<>v_offering.lock_version or v_expected>=9007199254740991 then raise exception 'version_conflict' using errcode='40001'; end if;
  if p_kind='revise' then
   if not(p_request ? 'revision') then raise exception 'invalid_request' using errcode='22023'; end if;
   select * into strict v_revision from service_catalog.revisions where id=v_offering.current_revision_id;
   if v_revision.status='archived' then raise exception 'invalid_transition' using errcode='22023'; end if;
   update service_catalog.offerings set current_revision_id=v_revision_id,lock_version=lock_version+1 where id=v_id returning * into v_offering;
  end if;
 end if;
 if p_kind in('create','revise') then
  insert into service_catalog.revisions(id,tenant_id,workspace_id,offering_id,commercial_terms,valid_from,valid_until,created_by)
  values(v_revision_id,v_tenant,v_workspace,v_id,p_request->'revision',(p_request->'revision'->>'valid_from')::timestamptz,(p_request->'revision'->>'valid_until')::timestamptz,v_actor);
  v_status:='draft';
 else
  if not(p_request ?& array['revision_id','action','reason']) or jsonb_typeof(p_request->'reason') is distinct from 'string'
  or length(btrim(p_request->>'reason')) not between 5 and 500 then raise exception 'invalid_request' using errcode='22023'; end if;
  v_revision_id:=(p_request->>'revision_id')::uuid;
  select * into v_revision from service_catalog.revisions where id=v_revision_id and offering_id=v_id and tenant_id=v_tenant and workspace_id=v_workspace for update;
  if not found then raise exception 'revision_not_found' using errcode='P0002'; end if;
  v_status:=case when v_action='submit' and v_revision.status='draft' and v_revision.id=v_offering.current_revision_id then 'submitted'
   when v_action='publish' and v_revision.status='submitted' and v_revision.id=v_offering.current_revision_id then 'published'
   when v_action='suspend' and v_revision.status='published' then 'suspended'
   when v_action='archive' and v_revision.status in('draft','submitted','suspended') then 'archived' end;
  if v_status is null then raise exception 'invalid_transition' using errcode='22023'; end if;
  if v_action in('submit','publish') and v_revision.valid_until<=statement_timestamp() then raise exception 'revision_expired' using errcode='22023'; end if;
  if v_action='publish' then
   if v_actor in(v_revision.created_by,v_revision.submitted_by) then raise exception 'separate_approver_required' using errcode='42501'; end if;
   if not exists(select 1 from portfolio.parties where id=v_offering.provider_party_id and tenant_id=v_tenant and archived_at is null)
   or not exists(select 1 from service_catalog.definitions where id=v_offering.definition_id and tenant_id=v_tenant and workspace_id=v_workspace and active) then raise exception 'invalid_reference' using errcode='22023'; end if;
  end if;
  update service_catalog.revisions set status=v_status,
   submitted_by=case when v_action='submit' then v_actor else submitted_by end,
   published_by=case when v_action='publish' then v_actor else published_by end where id=v_revision_id;
  update service_catalog.offerings set lock_version=lock_version+1,
   published_revision_id=case when v_action='publish' then v_revision_id when v_action='suspend' and published_revision_id=v_revision_id then null else published_revision_id end
   where id=v_id returning * into v_offering;
 end if;
 v_response:=jsonb_build_object('offering_id',v_id,'revision_id',v_revision_id,'status',v_status,'lock_version',v_offering.lock_version);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(v_tenant,v_actor,'services.catalog.'||coalesce(v_action,p_kind),'service_offering',v_id,v_before,v_response,p_request->>'reason');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'service_offering',v_id,v_offering.lock_version,'services.catalog.'||coalesce(v_action,p_kind),v_response);
 update platform.idempotency_keys set response_ref=v_response,status_code=200 where tenant_id=v_tenant and key=v_key;
 return v_response;
end;
$$;

revoke all on function app_private.service_catalog_labels_valid_v1(jsonb,integer),app_private.service_catalog_revision_valid_v1(jsonb),
 app_private.service_catalog_revision_immutable_v1(),app_private.service_catalog_authorize_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function customer_api.list_service_catalog_v1(uuid,uuid),customer_api.mutate_service_catalog_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.list_service_catalog_v1(uuid,uuid),customer_api.mutate_service_catalog_v1(text,jsonb) to authenticated;
commit;
