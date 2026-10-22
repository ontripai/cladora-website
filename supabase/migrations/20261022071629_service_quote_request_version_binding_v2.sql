begin;

-- Provenance is nullable for immutable historical drafts. New V2 drafts always
-- persist the exact Request version that was locked and revalidated.
alter table service_catalog.quote_drafts
  add column request_version bigint;
alter table service_catalog.quote_drafts
  add constraint service_quote_request_version_positive_safe
  check (request_version is null or request_version between 1 and 9007199254740991);

create function customer_api.create_service_quote_draft_v2(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
 v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_scope record;
 v_row service_catalog.requests%rowtype;v_expected_request_version bigint;
 v_key text;v_hash text;v_saved platform.idempotency_keys%rowtype;
 v_id uuid;v_version integer;v_result jsonb;v_until timestamptz;v_total numeric;v_share jsonb;
begin
 if jsonb_typeof(p_request) is distinct from 'object'
 or not(p_request ?& array['context_id','workspace_id','request_id','expected_request_version','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key'])
 or p_request-array['context_id','workspace_id','request_id','expected_request_version','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key']<>'{}' then
  raise exception 'invalid_request' using errcode='22023';
 end if;
 if jsonb_typeof(p_request->'expected_request_version') is distinct from 'number'
 or (p_request->>'expected_request_version')!~'^[1-9][0-9]{0,15}$'
 or (p_request->>'expected_request_version')::numeric>9007199254740991
 or jsonb_typeof(p_request->'scope') is distinct from 'string' or length(btrim(p_request->>'scope')) not between 5 and 5000
 or jsonb_typeof(p_request->'total_minor') is distinct from 'string' or (p_request->>'total_minor')!~'^(0|[1-9][0-9]{0,17})$'
 or jsonb_typeof(p_request->'currency') is distinct from 'string' or (p_request->>'currency') not in('RON','EUR','GBP','USD')
 or jsonb_typeof(p_request->'valid_until') is distinct from 'string'
 or (p_request->>'valid_until')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
 or jsonb_typeof(p_request->'context_id') is distinct from 'string' or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'request_id') is distinct from 'string' or jsonb_typeof(p_request->'published_revision_id') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string' or (p_request->>'idempotency_key')!~'^[A-Za-z0-9:_-]{8,128}$' then
  raise exception 'invalid_request' using errcode='22023';
 end if;
 if jsonb_typeof(p_request->'payer_shares') is distinct from 'array' then raise exception 'invalid_request' using errcode='22023';end if;
 if jsonb_array_length(p_request->'payer_shares')<>1 then raise exception 'additional_payer_requires_verified_relationship' using errcode='42501';end if;
 v_share:=p_request->'payer_shares'->0;
 if jsonb_typeof(v_share) is distinct from 'object' or not(v_share ?& array['party_id','amount_minor']) or v_share-array['party_id','amount_minor']<>'{}'
 or jsonb_typeof(v_share->'party_id') is distinct from 'string'
 or jsonb_typeof(v_share->'amount_minor') is distinct from 'string' or (v_share->>'amount_minor')!~'^(0|[1-9][0-9]{0,17})$'
 or (v_share->>'amount_minor')::numeric<>(p_request->>'total_minor')::numeric then raise exception 'invalid_request' using errcode='22023';end if;

 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 v_expected_request_version:=(p_request->>'expected_request_version')::bigint;
 v_until:=(p_request->>'valid_until')::timestamptz;v_total:=(p_request->>'total_minor')::numeric;
 if v_context is null or v_workspace is null or not isfinite(v_until) then raise exception 'invalid_request' using errcode='22023';end if;

 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
 select * into v_row from service_catalog.requests
  where id=(p_request->>'request_id')::uuid and tenant_id=v_scope.tenant_id and workspace_id=v_workspace for update;
 if not found then raise exception 'request_unavailable' using errcode='P0002';end if;
 -- Authority is deliberately rechecked after waiting for the Request lock.
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
 if v_row.beneficiary_party_id is distinct from (v_share->>'party_id')::uuid then raise exception 'payer_unavailable' using errcode='42501';end if;
 perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
  where mp.membership_id=v_row.membership_id and mp.tenant_id=v_row.tenant_id and mp.party_id=v_row.beneficiary_party_id
  and mp.valid_from<=clock_timestamp() and (mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null for share of mp,p;
 if not found then raise exception 'beneficiary_unavailable' using errcode='42501';end if;
 perform 1 from service_catalog.offerings o join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=o.tenant_id
  where o.id=v_row.offering_id and o.workspace_id=v_workspace and o.tenant_id=v_row.tenant_id and p.archived_at is null for share of p;
 if not found then raise exception 'provider_unavailable' using errcode='42501';end if;

 v_key:='service_quote:sql_v2:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor_id',v_actor,'tenant_id',v_row.tenant_id,'request',p_request)::text,'UTF8')),'hex');
 -- A known committed replay is recovery, not a new compare-and-set. Current
 -- authority and referenced parties were still revalidated above.
 select * into v_saved from platform.idempotency_keys where tenant_id=v_row.tenant_id and key=v_key for update;
 if found then
  if v_saved.actor_id is distinct from v_actor or v_saved.request_hash<>v_hash or v_saved.expires_at<=clock_timestamp() then
   raise exception 'idempotency_conflict' using errcode='23505';
  end if;
  if v_saved.response_ref is null then raise exception 'idempotency_result_unknown' using errcode='40001';end if;
  return v_saved.response_ref;
 end if;

 if v_row.version<>v_expected_request_version or v_row.status<>'submitted'
 or v_row.published_revision_id is distinct from (p_request->>'published_revision_id')::uuid then
  raise exception 'request_version_conflict' using errcode='40001';
 end if;
 if v_until<=clock_timestamp() then raise exception 'quote_expired' using errcode='22023';end if;

 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
  values(v_row.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '24 hours');
 select coalesce(max(version),0)+1 into v_version from service_catalog.quote_drafts
  where tenant_id=v_row.tenant_id and workspace_id=v_workspace and request_id=v_row.id;
 insert into service_catalog.quote_drafts(tenant_id,workspace_id,request_id,request_version,published_revision_id,beneficiary_party_id,version,scope,total_minor,currency,valid_until,created_by,membership_id)
  values(v_row.tenant_id,v_workspace,v_row.id,v_row.version,v_row.published_revision_id,v_row.beneficiary_party_id,v_version,btrim(p_request->>'scope'),v_total,p_request->>'currency',v_until,v_actor,v_scope.membership_id)
  returning id into v_id;
 v_result:=jsonb_build_object('quote_id',v_id,'version',v_version,'request_version',v_row.version,'status','draft');
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason)
  values(v_row.tenant_id,v_actor,'services.quotes.draft','service_quote_draft',v_id,v_result,'Non-binding coordinator draft; no payer consent');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
  values(v_row.tenant_id,'service_quote_draft',v_id,1,'services.quotes.drafted',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_row.tenant_id and key=v_key;
 return v_result;
end;$$;

create function customer_api.read_service_quote_drafts_v2(p_context_id uuid,p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;v_requests jsonb;begin
 select * into strict v from app_private.service_request_authorize_v1(p_context_id,p_workspace_id,'services.quotes.manage');
 select coalesce(jsonb_agg(jsonb_build_object('request_id',r.id,'request_version',r.version,'published_revision_id',r.published_revision_id,'beneficiary_party_id',r.beneficiary_party_id,
  'beneficiary_label',b.legal_name,'provider_label',p.legal_name,'description',r.description,'quotes',coalesce(q.quotes,'[]')) order by r.created_at desc,r.id),'[]') into v_requests
 from (select * from service_catalog.requests where tenant_id=v.tenant_id and workspace_id=p_workspace_id and status='submitted' order by created_at desc,id limit 50) r
 join portfolio.parties b on b.id=r.beneficiary_party_id and b.tenant_id=r.tenant_id and b.archived_at is null
 join service_catalog.offerings o on o.id=r.offering_id and o.tenant_id=r.tenant_id and o.workspace_id=r.workspace_id
 join portfolio.parties p on p.id=o.provider_party_id and p.tenant_id=r.tenant_id and p.archived_at is null
 left join lateral (select jsonb_agg(jsonb_build_object('quote_id',d.id,'version',d.version,'status',d.status,'scope',d.scope,'total_minor',d.total_minor::text,'currency',d.currency,'valid_until',d.valid_until,'created_at',d.created_at) order by d.version desc) quotes
  from (select * from service_catalog.quote_drafts where request_id=r.id and tenant_id=r.tenant_id and workspace_id=r.workspace_id order by version desc limit 10) d) q on true;
 return jsonb_build_object('requests',v_requests);
end;$$;

-- Preserve recovery of a committed V1 command, but close V1 as a path for any
-- new unversioned write. No idempotency claim or domain side effect is created.
create or replace function customer_api.create_service_quote_draft_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_scope record;v_row service_catalog.requests%rowtype;
v_key text;v_hash text;v_saved platform.idempotency_keys%rowtype;v_share jsonb;
begin
 if jsonb_typeof(p_request) is distinct from 'object' or not(p_request ?& array['context_id','workspace_id','request_id','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key'])
 or p_request-array['context_id','workspace_id','request_id','published_revision_id','scope','total_minor','currency','payer_shares','valid_until','idempotency_key']<>'{}'
 or jsonb_typeof(p_request->'context_id') is distinct from 'string' or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'request_id') is distinct from 'string' or jsonb_typeof(p_request->'published_revision_id') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string' or (p_request->>'idempotency_key')!~'^[A-Za-z0-9:_-]{8,128}$'
 or jsonb_typeof(p_request->'payer_shares') is distinct from 'array' or jsonb_array_length(p_request->'payer_shares')<>1 then
  raise exception 'invalid_request' using errcode='22023';
 end if;
 v_share:=p_request->'payer_shares'->0;
 if jsonb_typeof(v_share) is distinct from 'object' or jsonb_typeof(v_share->'party_id') is distinct from 'string' then raise exception 'invalid_request' using errcode='22023';end if;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
 select * into v_row from service_catalog.requests where id=(p_request->>'request_id')::uuid and tenant_id=v_scope.tenant_id and workspace_id=v_workspace for update;
 if not found then raise exception 'request_unavailable' using errcode='P0002';end if;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.quotes.manage');
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
 select * into v_saved from platform.idempotency_keys where tenant_id=v_row.tenant_id and key=v_key for update;
 if not found then raise exception 'request_version_required' using errcode='22023';end if;
 if v_saved.actor_id is distinct from v_actor or v_saved.request_hash<>v_hash or v_saved.expires_at<=clock_timestamp() then raise exception 'idempotency_conflict' using errcode='23505';end if;
 if v_saved.response_ref is null then raise exception 'idempotency_result_unknown' using errcode='40001';end if;
 return v_saved.response_ref;
end;$$;

revoke all on function customer_api.create_service_quote_draft_v2(jsonb),customer_api.read_service_quote_drafts_v2(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_service_quote_draft_v2(jsonb),customer_api.read_service_quote_drafts_v2(uuid,uuid) to authenticated;
revoke all on function customer_api.create_service_quote_draft_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_service_quote_draft_v1(jsonb) to authenticated;

comment on function customer_api.create_service_quote_draft_v1(jsonb)
 is 'Deprecated replay-only V1: recovers an already committed exact command; rejects every new unversioned write.';
comment on function customer_api.create_service_quote_draft_v2(jsonb)
 is 'Version-bound quote draft creation: locks and reauthorizes the exact Request; known committed replay is separate from new-write CAS.';

commit;
