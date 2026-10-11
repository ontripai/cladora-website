begin;
-- Non-binding presentation only. No acceptance, provider representation or financial effects.
insert into identity.permissions(code,resource,action,description) values
 ('services.quotes.publish','services.quotes','publish','Present a non-binding quote to its verified requester') on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2)
select m.id,p.id,'manage',false,true from platform.module_definitions m cross join identity.permissions p
where m.code='services_orders' and m.version=1 and p.code='services.quotes.publish'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create table service_catalog.quote_publications(
 quote_id uuid primary key references service_catalog.quote_drafts(id),
 published_by uuid not null references auth.users(id),
 membership_id uuid not null references identity.memberships(id),
 published_at timestamptz not null default clock_timestamp()
);
create index service_quote_publication_actor_idx on service_catalog.quote_publications(published_by);
create index service_quote_publication_member_idx on service_catalog.quote_publications(membership_id);
alter table service_catalog.quote_publications enable row level security;
revoke all on service_catalog.quote_publications from public,anon,authenticated,service_role;
create trigger service_quote_publication_immutable before update or delete on service_catalog.quote_publications
for each row execute function app_private.service_quote_immutable_v1();

create function customer_api.publish_service_quote_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_scope record;v_request service_catalog.requests%rowtype;
v_quote service_catalog.quote_drafts%rowtype;v_key text;v_hash text;v_saved platform.idempotency_keys%rowtype;v_result jsonb;v_field text;
begin
 if jsonb_typeof(p_request) is distinct from 'object' or not(p_request ?& array['context_id','workspace_id','quote_id','expected_version','idempotency_key'])
 or p_request-array['context_id','workspace_id','quote_id','expected_version','idempotency_key']<>'{}' then raise exception 'invalid_request' using errcode='22023';end if;
 foreach v_field in array array['context_id','workspace_id','quote_id','idempotency_key'] loop
 if jsonb_typeof(p_request->v_field) is distinct from 'string' then raise exception 'invalid_request' using errcode='22023';end if;end loop;
 if jsonb_typeof(p_request->'expected_version') is distinct from 'number' or (p_request->>'expected_version')!~'^[1-9][0-9]{0,9}$'
 or (p_request->>'expected_version')::numeric>1000000000 or (p_request->>'idempotency_key')!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_request' using errcode='22023';end if;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.publish');
 -- Same request lock as version creation. A concurrent new draft cannot race publication.
 select r.* into v_request from service_catalog.requests r join service_catalog.quote_drafts d on d.request_id=r.id
 where d.id=(p_request->>'quote_id')::uuid and r.tenant_id=v_scope.tenant_id and r.workspace_id=v_workspace for update of r;
 if not found then raise exception 'quote_unavailable' using errcode='P0002';end if;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.publish');
 select * into strict v_quote from service_catalog.quote_drafts where id=(p_request->>'quote_id')::uuid and tenant_id=v_scope.tenant_id and workspace_id=v_workspace;
 if v_request.status<>'submitted' or v_quote.version<>(p_request->>'expected_version')::integer then raise exception 'quote_changed' using errcode='40001';end if;
 perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
 where mp.membership_id=v_request.membership_id and mp.tenant_id=v_request.tenant_id and mp.party_id=v_request.beneficiary_party_id
 and mp.valid_from<=clock_timestamp() and (mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null for share of mp,p;
 if not found then raise exception 'beneficiary_unavailable' using errcode='42501';end if;
 perform 1 from service_catalog.offerings o join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=o.tenant_id
 where o.id=v_request.offering_id and o.tenant_id=v_request.tenant_id and o.workspace_id=v_workspace and p.archived_at is null for share of p;
 if not found then raise exception 'provider_unavailable' using errcode='42501';end if;
 v_key:='service_quote_publish:sql_v1:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor_id',v_actor,'tenant_id',v_scope.tenant_id,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at) values(v_scope.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '24 hours') on conflict(tenant_id,key) do nothing;
 select * into strict v_saved from platform.idempotency_keys where tenant_id=v_scope.tenant_id and key=v_key for update;
 if v_saved.actor_id is distinct from v_actor or v_saved.request_hash<>v_hash or v_saved.expires_at<=clock_timestamp() then raise exception 'idempotency_conflict' using errcode='23505';end if;
 if v_saved.response_ref is not null then return v_saved.response_ref;end if;
 if v_quote.valid_until<=clock_timestamp() or exists(select 1 from service_catalog.quote_drafts where request_id=v_request.id and version>v_quote.version) then raise exception 'quote_changed' using errcode='40001';end if;
 if exists(select 1 from service_catalog.quote_publications where quote_id=v_quote.id) then raise exception 'already_published' using errcode='23505';end if;
 insert into service_catalog.quote_publications(quote_id,published_by,membership_id) values(v_quote.id,v_actor,v_scope.membership_id);
 v_result:=jsonb_build_object('quote_id',v_quote.id,'version',v_quote.version,'status','presented');
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason) values(v_scope.tenant_id,v_actor,'services.quotes.publish','service_quote_publication',v_quote.id,v_result,'Non-binding presentation to verified requester; no acceptance');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(v_scope.tenant_id,'service_quote_publication',v_quote.id,1,'services.quotes.presented',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_scope.tenant_id and key=v_key;
 return v_result;
end;$$;

create function customer_api.read_service_quote_publications_v1(p_context_id uuid,p_workspace_id uuid,p_mode text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;v_quotes jsonb;v_can_publish boolean:=false;
begin
 if p_mode is null or p_mode not in('coordinator','recipient') then raise exception 'invalid_request' using errcode='22023';end if;
 select * into strict v from app_private.service_request_authorize_v1(p_context_id,p_workspace_id,case when p_mode='coordinator' then 'services.quotes.manage' else 'services.orders.read' end);
 if p_mode='coordinator' then v_can_publish:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'services.quotes.publish','services_orders') is true;end if;
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id),'[]') into v_quotes from (
 select d.id,d.created_at,jsonb_build_object('quote_id',d.id,'version',d.version,'description',r.description,'scope',d.scope,'total_minor',d.total_minor::text,'currency',d.currency,
 'valid_until',d.valid_until,'provider_label',p.legal_name,'beneficiary_label',b.legal_name,'published_at',pub.published_at,
 'state',case when exists(select 1 from service_catalog.quote_drafts newer where newer.request_id=r.id and newer.version>d.version) then 'superseded'
 when d.valid_until<=clock_timestamp() then 'expired' when pub.quote_id is not null then 'presented' else 'draft' end) item
 from service_catalog.quote_drafts d join service_catalog.requests r on r.id=d.request_id and r.tenant_id=d.tenant_id and r.workspace_id=d.workspace_id
 join portfolio.parties b on b.id=r.beneficiary_party_id and b.tenant_id=r.tenant_id and b.archived_at is null
 join service_catalog.offerings o on o.id=r.offering_id and o.tenant_id=r.tenant_id and o.workspace_id=r.workspace_id
 join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=r.tenant_id and p.archived_at is null
 left join service_catalog.quote_publications pub on pub.quote_id=d.id
 where r.tenant_id=v.tenant_id and r.workspace_id=p_workspace_id and r.status='submitted'
 and exists(select 1 from identity.membership_parties mp where mp.membership_id=r.membership_id and mp.tenant_id=r.tenant_id and mp.party_id=r.beneficiary_party_id
 and mp.valid_from<=clock_timestamp() and(mp.valid_until is null or mp.valid_until>clock_timestamp()))
 and(p_mode='coordinator' or(pub.quote_id is not null and r.requester_id=auth.uid() and r.membership_id=v.membership_id))
 order by d.created_at desc,d.id limit 50) x;
 return jsonb_build_object('quotes',v_quotes,'can_publish',v_can_publish);
end;$$;
revoke all on function customer_api.publish_service_quote_v1(jsonb),customer_api.read_service_quote_publications_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.publish_service_quote_v1(jsonb),customer_api.read_service_quote_publications_v1(uuid,uuid,text) to authenticated;
commit;
