begin;
-- Only non-binding requests. No user grants, activation, entitlement or orders.
insert into identity.permissions(code,resource,action,description) values
 ('services.orders.read','services.orders','read','Read own workspace service requests'),
 ('services.orders.request','services.orders','request','Submit a non-binding request for own verified person')
on conflict(code) do nothing;
insert into platform.module_definitions(code,name,labels_json,description,category,lifecycle_status,entitlement_key,published_at)
values('services_orders','Service requests','{"ro":"Cereri de servicii","en":"Service requests","fa":"درخواست خدمات"}',
 'Non-binding service request intake; no order, payment or reservation','services','published','module.services_orders',statement_timestamp())
on conflict(code,version) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable)
select m.id,p.id,case when p.action='read' then 'read' else 'manage' end,false
from platform.module_definitions m cross join identity.permissions p
where m.code='services_orders' and m.version=1 and p.code in('services.orders.read','services.orders.request')
on conflict(module_definition_id,permission_id,binding_version) do nothing;
insert into platform.module_dependencies(module_definition_id,required_module_definition_id)
select m.id,c.id from platform.module_definitions m cross join platform.module_definitions c
where m.code='services_orders' and m.version=1 and c.code='services_catalog' and c.version=1
on conflict(module_definition_id,required_module_definition_id) do nothing;
insert into platform.module_property_profile_compatibilities(module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','SERVICE requests standard profile mapping v1' from platform.module_definitions m cross join platform.property_profiles p
where m.code='services_orders' and m.version=1 on conflict(module_definition_id,property_profile_id) do nothing;
insert into platform.module_operating_model_compatibilities(module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','SERVICE requests standard operating model mapping v1' from platform.module_definitions m cross join platform.operating_models o
where m.code='services_orders' and m.version=1 on conflict(module_definition_id,operating_model_id) do nothing;

create table service_catalog.requests(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id),
 workspace_id uuid not null references platform.customer_workspaces(id),
 offering_id uuid not null, published_revision_id uuid not null,
 requester_id uuid not null references auth.users(id),
 membership_id uuid not null references identity.memberships(id),
 beneficiary_party_id uuid not null references portfolio.parties(id),
 description text not null check(description=btrim(description) and length(description) between 5 and 5000),
 status text not null default 'submitted' check(status='submitted'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(tenant_id,workspace_id,offering_id,published_revision_id)
 references service_catalog.revisions(tenant_id,workspace_id,offering_id,id)
);
create index service_request_own_history_idx on service_catalog.requests(tenant_id,workspace_id,requester_id,membership_id,created_at desc,id);
alter table service_catalog.requests enable row level security;
revoke all on service_catalog.requests from public,anon,authenticated,service_role;

create function app_private.service_request_authorize_v1(p_context uuid,p_workspace uuid,p_permission text)
returns table(tenant_id uuid,membership_id uuid) language plpgsql stable security definer set search_path=pg_catalog
as $$begin
 if auth.uid() is null or app_private.check_workspace_native_permission_v2(p_context,p_workspace,p_permission,'services_orders') is not true then
  raise exception 'service_request_access_denied' using errcode='42501';
 end if;
 return query select c.tenant_id,c.membership_id from app_private.resolve_workspace_native_context_v2(p_context,p_workspace) c;
end;$$;

create function customer_api.read_service_requests_v1(p_context_id uuid,p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$declare v record;v_parties jsonb;v_requests jsonb;begin
 select * into strict v from app_private.service_request_authorize_v1(p_context_id,p_workspace_id,'services.orders.read');
 select coalesce(jsonb_agg(jsonb_build_object('party_id',p.id,'label',p.legal_name) order by p.id),'[]') into v_parties
 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
 where mp.membership_id=v.membership_id and mp.tenant_id=v.tenant_id and mp.valid_from<=clock_timestamp()
 and(mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('request_id',r.id,'offering_id',r.offering_id,'revision_id',r.published_revision_id,
 'description',r.description,'status',r.status,'created_at',r.created_at) order by r.created_at desc,r.id),'[]') into v_requests
 from(select * from service_catalog.requests where tenant_id=v.tenant_id and workspace_id=p_workspace_id
 and requester_id=auth.uid() and membership_id=v.membership_id order by created_at desc,id limit 50) r;
 return jsonb_build_object('can_request',app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'services.orders.request','services_orders') is true,
 'beneficiaries',v_parties,'requests',v_requests);
end;$$;

create function customer_api.create_service_request_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$declare
 v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_tenant uuid;v_member uuid;v_party uuid;
 v_key text;v_hash text;v_idem platform.idempotency_keys%rowtype;
 v_offering service_catalog.offerings%rowtype;v_revision service_catalog.revisions%rowtype;
 v_description text;v_id uuid;v_response jsonb;v_field text;
begin
 if v_actor is null then raise exception 'unauthorized' using errcode='42501';end if;
 if jsonb_typeof(p_request) is distinct from 'object' or not(p_request ?& array['context_id','workspace_id','offering_id','published_revision_id','beneficiary_party_id','description','idempotency_key'])
 or p_request-array['context_id','workspace_id','offering_id','published_revision_id','beneficiary_party_id','description','idempotency_key']<>'{}' then
  raise exception 'invalid_request' using errcode='22023';end if;
 for v_field in select jsonb_object_keys(p_request) loop
  if jsonb_typeof(p_request->v_field) is distinct from 'string' then raise exception 'invalid_request' using errcode='22023';end if;
 end loop;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;v_party:=(p_request->>'beneficiary_party_id')::uuid;
 v_description:=btrim(p_request->>'description');
 if length(v_description) not between 5 and 5000 or (p_request->>'idempotency_key') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'invalid_request' using errcode='22023';end if;
 select tenant_id,membership_id into strict v_tenant,v_member from app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_catalog_authorize_v1(v_context,v_workspace,'services.catalog.read');
 -- Serialize the key before resolving replay. Live guards and person mapping are
 -- rechecked after waiting, so a saved result never bypasses current access.
 v_key:='service_request:sql_v1:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_catalog_authorize_v1(v_context,v_workspace,'services.catalog.read');
 perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
 where mp.membership_id=v_member and mp.tenant_id=v_tenant and mp.party_id=v_party and mp.valid_from<=clock_timestamp()
 and(mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null for share of mp,p;
 if not found then raise exception 'beneficiary_not_authorized' using errcode='42501';end if;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash or v_idem.expires_at<=clock_timestamp() then
  raise exception 'idempotency_conflict' using errcode='23505';end if;
 if v_idem.response_ref is not null then return v_idem.response_ref;end if;
 select * into v_offering from service_catalog.offerings where id=(p_request->>'offering_id')::uuid and tenant_id=v_tenant and workspace_id=v_workspace for share;
 if not found or v_offering.published_revision_id is distinct from (p_request->>'published_revision_id')::uuid then
  raise exception 'offering_changed' using errcode='40001';end if;
 select * into strict v_revision from service_catalog.revisions where tenant_id=v_tenant and workspace_id=v_workspace and offering_id=v_offering.id and id=v_offering.published_revision_id for share;
 if v_revision.status<>'published' or v_revision.valid_from>clock_timestamp() or v_revision.valid_until<=clock_timestamp()
 or v_revision.commercial_terms->>'acquisition_mode'='reservation' then raise exception 'offering_unavailable' using errcode='40001';end if;
 perform 1 from service_catalog.definitions where id=v_offering.definition_id and tenant_id=v_tenant and workspace_id=v_workspace and active for share;
 if not found then raise exception 'offering_unavailable' using errcode='40001';end if;
 perform 1 from portfolio.parties where id=v_offering.provider_party_id and tenant_id=v_tenant and archived_at is null for share;
 if not found then raise exception 'offering_unavailable' using errcode='40001';end if;
 v_id:=gen_random_uuid();
 insert into service_catalog.requests(id,tenant_id,workspace_id,offering_id,published_revision_id,requester_id,membership_id,beneficiary_party_id,description)
 values(v_id,v_tenant,v_workspace,v_offering.id,v_revision.id,v_actor,v_member,v_party,v_description);
 v_response:=jsonb_build_object('request_id',v_id,'status','submitted');
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason)
 values(v_tenant,v_actor,'services.orders.request','service_request',v_id,v_response,'Non-binding service request');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'service_request',v_id,1,'services.orders.requested',v_response);
 update platform.idempotency_keys set response_ref=v_response,status_code=200 where tenant_id=v_tenant and key=v_key;
 return v_response;
end;$$;
revoke all on function app_private.service_request_authorize_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function customer_api.read_service_requests_v1(uuid,uuid),customer_api.create_service_request_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.read_service_requests_v1(uuid,uuid),customer_api.create_service_request_v1(jsonb) to authenticated;
commit;
