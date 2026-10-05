begin;
-- Coordinator drafts only; no consent, order, payment, work order or user grants.
insert into identity.permissions(code,resource,action,description) values
 ('services.quotes.manage','services.quotes','manage','Review workspace requests and create non-binding quote drafts') on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2)
select m.id,p.id,'manage',false,true from platform.module_definitions m cross join identity.permissions p
where m.code='services_orders' and m.version=1 and p.code='services.quotes.manage'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

alter table service_catalog.requests add constraint service_request_quote_target_uq unique(tenant_id,workspace_id,id,published_revision_id,beneficiary_party_id);
create table service_catalog.quote_drafts(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, workspace_id uuid not null,
 request_id uuid not null, published_revision_id uuid not null, beneficiary_party_id uuid not null,
 version integer not null check(version between 1 and 1000000000), status text not null default 'draft' check(status='draft'),
 scope text not null check(scope=btrim(scope) and length(scope) between 5 and 5000),
 total_minor numeric(18,0) not null check(total_minor between 0 and 999999999999999999),
 currency text not null check(currency in('RON','EUR','GBP','USD')),
 valid_until timestamptz not null check(isfinite(valid_until)),
 created_by uuid not null references auth.users(id), membership_id uuid not null references identity.memberships(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,workspace_id,request_id,version),
 foreign key(tenant_id,workspace_id,request_id,published_revision_id,beneficiary_party_id)
 references service_catalog.requests(tenant_id,workspace_id,id,published_revision_id,beneficiary_party_id),
 check(valid_until>created_at)
);
create index service_quote_creator_idx on service_catalog.quote_drafts(created_by);
create index service_quote_member_idx on service_catalog.quote_drafts(membership_id);
create index service_request_coordinator_idx on service_catalog.requests(tenant_id,workspace_id,created_at desc,id) where status='submitted';
alter table service_catalog.quote_drafts enable row level security;
revoke all on service_catalog.quote_drafts from public,anon,authenticated,service_role;
create function app_private.service_quote_immutable_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'quote_versions_are_immutable' using errcode='23514'; end;$$;
create trigger service_quote_immutable before update or delete on service_catalog.quote_drafts for each row execute function app_private.service_quote_immutable_v1();
revoke all on function app_private.service_quote_immutable_v1() from public,anon,authenticated,service_role;

create function customer_api.create_service_quote_draft_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_scope record;v_row service_catalog.requests%rowtype;
v_key text;v_hash text;v_saved platform.idempotency_keys%rowtype;v_id uuid;v_version integer;v_result jsonb;v_until timestamptz;v_total numeric;v_share jsonb;
begin
 if jsonb_typeof(p_request) is distinct from 'object' or not(p_request ?& array['context_id','workspace_id','request_id','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key'])
 or p_request-array['context_id','workspace_id','request_id','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key']<>'{}' then raise exception 'invalid_request' using errcode='22023';end if;
 if jsonb_typeof(p_request->'scope') is distinct from 'string' or length(btrim(p_request->>'scope')) not between 5 and 5000
 or jsonb_typeof(p_request->'total_minor') is distinct from 'string' or (p_request->>'total_minor')!~'^(0|[1-9][0-9]{0,17})$'
 or jsonb_typeof(p_request->'currency') is distinct from 'string' or (p_request->>'currency') not in('RON','EUR','GBP','USD')
 or jsonb_typeof(p_request->'valid_until') is distinct from 'string'
 or (p_request->>'valid_until')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
 or jsonb_typeof(p_request->'context_id') is distinct from 'string' or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'request_id') is distinct from 'string' or jsonb_typeof(p_request->'published_revision_id') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string' or (p_request->>'idempotency_key')!~'^[A-Za-z0-9:_-]{8,128}$' then raise exception 'invalid_request' using errcode='22023';end if;
 if jsonb_typeof(p_request->'payer_shares') is distinct from 'array' then raise exception 'invalid_request' using errcode='22023';end if;
 if jsonb_array_length(p_request->'payer_shares')<>1 then raise exception 'additional_payer_requires_verified_relationship' using errcode='42501';end if;
 v_share:=p_request->'payer_shares'->0;
 if jsonb_typeof(v_share) is distinct from 'object' or not(v_share ?& array['party_id','amount_minor']) or v_share-array['party_id','amount_minor']<>'{}'
 or jsonb_typeof(v_share->'party_id') is distinct from 'string'
 or jsonb_typeof(v_share->'amount_minor') is distinct from 'string' or (v_share->>'amount_minor')!~'^(0|[1-9][0-9]{0,17})$'
 or (v_share->>'amount_minor')::numeric<>(p_request->>'total_minor')::numeric then raise exception 'invalid_request' using errcode='22023';end if;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 v_until:=(p_request->>'valid_until')::timestamptz;v_total:=(p_request->>'total_minor')::numeric;
 if v_context is null or v_workspace is null or not isfinite(v_until) then raise exception 'invalid_request' using errcode='22023';end if;
 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
 select * into v_row from service_catalog.requests where id=(p_request->>'request_id')::uuid and tenant_id=v_scope.tenant_id and workspace_id=v_workspace for update;
 if not found then raise exception 'request_unavailable' using errcode='P0002';end if;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
 if v_row.status<>'submitted' or v_row.published_revision_id is distinct from (p_request->>'published_revision_id')::uuid then raise exception 'request_changed' using errcode='40001';end if;
 if v_row.beneficiary_party_id is distinct from (v_share->>'party_id')::uuid then raise exception 'payer_unavailable' using errcode='42501';end if;
 perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
 where mp.membership_id=v_row.membership_id and mp.tenant_id=v_row.tenant_id and mp.party_id=v_row.beneficiary_party_id
 and mp.valid_from<=clock_timestamp() and (mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null for share of mp,p;
 if not found then raise exception 'beneficiary_unavailable' using errcode='42501';end if;
 perform 1 from service_catalog.offerings o join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=o.tenant_id
 where o.id=v_row.offering_id and o.workspace_id=v_workspace and o.tenant_id=v_row.tenant_id and p.archived_at is null for share of p;
 if not found then raise exception 'provider_unavailable' using errcode='42501';end if;
 v_key:='service_quote:sql_v1:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor_id',v_actor,'tenant_id',v_row.tenant_id,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at) values(v_row.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '24 hours') on conflict(tenant_id,key) do nothing;
 select * into strict v_saved from platform.idempotency_keys where tenant_id=v_row.tenant_id and key=v_key for update;
 if v_saved.actor_id is distinct from v_actor or v_saved.request_hash<>v_hash or v_saved.expires_at<=clock_timestamp() then raise exception 'idempotency_conflict' using errcode='23505';end if;
 -- Exact replay reconciles an already committed draft even after its quote expiry.
 if v_saved.response_ref is not null then return v_saved.response_ref;end if;
 if v_until<=clock_timestamp() then raise exception 'quote_expired' using errcode='22023';end if;
 select coalesce(max(version),0)+1 into v_version from service_catalog.quote_drafts where tenant_id=v_row.tenant_id and workspace_id=v_workspace and request_id=v_row.id;
 insert into service_catalog.quote_drafts(tenant_id,workspace_id,request_id,published_revision_id,beneficiary_party_id,version,scope,total_minor,currency,valid_until,created_by,membership_id)
 values(v_row.tenant_id,v_workspace,v_row.id,v_row.published_revision_id,v_row.beneficiary_party_id,v_version,btrim(p_request->>'scope'),v_total,p_request->>'currency',v_until,v_actor,v_scope.membership_id) returning id into v_id;
 v_result:=jsonb_build_object('quote_id',v_id,'version',v_version,'status','draft');
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason) values(v_row.tenant_id,v_actor,'services.quotes.draft','service_quote_draft',v_id,v_result,'Non-binding coordinator draft; no payer consent');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(v_row.tenant_id,'service_quote_draft',v_id,1,'services.quotes.drafted',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_row.tenant_id and key=v_key;
 return v_result;
end;$$;

create function customer_api.read_service_quote_drafts_v1(p_context_id uuid,p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;v_requests jsonb;begin
 select * into strict v from app_private.service_request_authorize_v1(p_context_id,p_workspace_id,'services.quotes.manage');
 select coalesce(jsonb_agg(jsonb_build_object('request_id',r.id,'published_revision_id',r.published_revision_id,'beneficiary_party_id',r.beneficiary_party_id,
 'beneficiary_label',b.legal_name,'provider_label',p.legal_name,'description',r.description,'quotes',coalesce(q.quotes,'[]')) order by r.created_at desc,r.id),'[]') into v_requests
 from (select * from service_catalog.requests where tenant_id=v.tenant_id and workspace_id=p_workspace_id and status='submitted' order by created_at desc,id limit 50) r
 join portfolio.parties b on b.id=r.beneficiary_party_id and b.tenant_id=r.tenant_id and b.archived_at is null
 join service_catalog.offerings o on o.id=r.offering_id and o.tenant_id=r.tenant_id and o.workspace_id=r.workspace_id
 join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=r.tenant_id and p.archived_at is null
 left join lateral (select jsonb_agg(jsonb_build_object('quote_id',d.id,'version',d.version,'status',d.status,'scope',d.scope,'total_minor',d.total_minor::text,'currency',d.currency,'valid_until',d.valid_until,'created_at',d.created_at) order by d.version desc) quotes
 from (select * from service_catalog.quote_drafts where request_id=r.id and tenant_id=r.tenant_id and workspace_id=r.workspace_id order by version desc limit 10) d) q on true;
 return jsonb_build_object('requests',v_requests);
end;$$;
revoke all on function customer_api.create_service_quote_draft_v1(jsonb),customer_api.read_service_quote_drafts_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_service_quote_draft_v1(jsonb),customer_api.read_service_quote_drafts_v1(uuid,uuid) to authenticated;
commit;
