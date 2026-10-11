begin;

-- One canonical authority and one commercial store. Internal persisted keys use
-- a slash, which legacy v1 client keys cannot contain, to isolate both versions.
create function app_private.require_airprop_native_context_v2(p_context_id uuid,p_workspace_id uuid,p_permission text)
returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql security definer set search_path=pg_catalog
as $$
declare a record;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if p_permission not in ('airprop.opportunity.manage','airprop.opportunity.read') or p_permission is null
 or not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,p_permission,'airprop_commercial') then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 return query select a.workspace_id,a.tenant_id,a.membership_id,a.role_code;
end;
$$;

create function customer_api.create_airprop_opportunity_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare a record; o airprop.investment_opportunities%rowtype; retry platform.idempotency_keys%rowtype;
 v_property uuid; v_name text; v_city text; v_source text; v_price text; v_currency text;
 v_key text; v_hash text; v_canonical text; v_response jsonb;
begin
 -- Always reauthorize before inspecting an existing key or result.
 select * into a from app_private.require_airprop_native_context_v2(p_context_id,p_workspace_id,'airprop.opportunity.manage');
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 or p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception 'airprop_invalid_opportunity' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('name','country_code','city','currency','asking_price','property_id','source_ref'))
 or jsonb_typeof(p_payload->'name') is distinct from 'string'
 or jsonb_typeof(p_payload->'city') is distinct from 'string'
 or jsonb_typeof(p_payload->'country_code') is distinct from 'string'
 or jsonb_typeof(p_payload->'currency') is distinct from 'string'
 or jsonb_typeof(p_payload->'asking_price') is distinct from 'string'
 or (p_payload ? 'property_id' and jsonb_typeof(p_payload->'property_id') not in ('string','null'))
 or (p_payload ? 'source_ref' and jsonb_typeof(p_payload->'source_ref') not in ('string','null')) then
  raise exception 'airprop_invalid_opportunity' using errcode='22023';
 end if;
 v_name=normalize(btrim(p_payload->>'name'),NFC);v_city=normalize(btrim(p_payload->>'city'),NFC);
 v_source=normalize(btrim(p_payload->>'source_ref'),NFC);v_currency=p_payload->>'currency';
 if length(v_name) not between 1 and 160 or length(v_city) not between 1 and 120
 or (v_source is not null and length(v_source) not between 1 and 500)
 or v_name ~ '[[:cntrl:]]' or v_city ~ '[[:cntrl:]]' or v_source ~ '[[:cntrl:]]'
 or p_payload->>'country_code'<>'RO' or v_currency not in ('RON','EUR')
 or (p_payload->>'asking_price') !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$'
 or (p_payload->>'asking_price')::numeric<=0 then
  raise exception 'airprop_invalid_opportunity' using errcode='22023';
 end if;
 if p_payload->>'property_id' is not null then
  if (p_payload->>'property_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'airprop_invalid_opportunity' using errcode='22023';end if;
  v_property=(p_payload->>'property_id')::uuid;
  -- Optional subject remains a core reference and must belong to this exact workspace.
  if not exists(select 1 from portfolio.properties p join platform.workspace_property_bindings b
   on b.property_id=p.id and b.tenant_id=p.tenant_id where p.id=v_property and p.tenant_id=a.tenant_id
   and b.customer_workspace_id=a.workspace_id and b.status='active'
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())) then
   raise exception 'airprop_reference_access_denied' using errcode='42501';end if;
 end if;
 v_price=((p_payload->>'asking_price')::numeric(20,4))::text;
 -- Exact JSON field order and UTF-8 bytes match the compiled TS descriptor.
 v_canonical='{"version":2,"workspace_id":'||to_json(p_workspace_id::text)::text||',"name":'||to_json(v_name)::text
  ||',"country_code":"RO","city":'||to_json(v_city)::text||',"currency":'||to_json(v_currency)::text
  ||',"asking_price":'||to_json(v_price)::text||',"property_id":'||coalesce(to_json(v_property::text)::text,'null')
  ||',"source_ref":'||coalesce(to_json(v_source)::text,'null')||'}';
 v_hash=encode(sha256(convert_to(v_canonical,'UTF8')),'hex');
 v_key='airprop.opportunity.create.v2/'||a.workspace_id::text||'/'||p_idempotency_key;
 -- Transaction lock serializes the first insert as well as retries. Hash
 -- collisions serialize unrelated commands but cannot mix their persisted keys.
 perform pg_advisory_xact_lock(hashtextextended(a.tenant_id::text||'/'||v_key,0));
 select * into a from app_private.require_airprop_native_context_v2(p_context_id,p_workspace_id,'airprop.opportunity.manage');
 select * into retry from platform.idempotency_keys where tenant_id=a.tenant_id and key=v_key for update;
 if found then
  if retry.actor_id is distinct from auth.uid() or retry.request_hash is distinct from v_hash then
   raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  if retry.response_ref is null then raise exception 'airprop_retry_incomplete' using errcode='55000';end if;
  return retry.response_ref || jsonb_build_object('idempotent',true);
 end if;
 -- Preserve deduplication after shared retry-record retention expires.
 select * into o from airprop.investment_opportunities where tenant_id=a.tenant_id and idempotency_key=v_key for update;
 if found then
  if o.workspace_id is distinct from a.workspace_id or o.created_by is distinct from auth.uid() or o.input_hash is distinct from v_hash then
   raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunity_id',o.id,'status','draft','idempotent',true);
 end if;
 insert into airprop.investment_opportunities(tenant_id,workspace_id,property_id,idempotency_key,name,country_code,city,asking_price,currency,source_ref,input_hash,created_by)
 values(a.tenant_id,a.workspace_id,v_property,v_key,v_name,'RO',v_city,v_price::numeric,v_currency,v_source,v_hash,auth.uid()) returning * into o;
 v_response=jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunity_id',o.id,'status',o.status,'idempotent',false);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(a.tenant_id,auth.uid(),a.role_code,'AIRPROP_OPPORTUNITY_CREATED','airprop.investment_opportunity',o.id,
  jsonb_build_object('version',2,'workspace_id',a.workspace_id,'status',o.status),'Workspace-native AIRPROP opportunity');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(a.tenant_id,'airprop.investment_opportunity',o.id,1,'airprop.opportunity.created.v2',
  jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunity_id',o.id,'status',o.status));
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at)
 values(a.tenant_id,auth.uid(),v_key,v_hash,v_response,201,statement_timestamp()+interval '30 days');
 return v_response;
end;
$$;

create function customer_api.list_airprop_opportunities_v2(p_context_id uuid,p_workspace_id uuid,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare a record; result jsonb;
begin
 select * into a from app_private.require_airprop_native_context_v2(p_context_id,p_workspace_id,'airprop.opportunity.read');
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'airprop_invalid_limit' using errcode='22023';end if;
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id desc),'[]'::jsonb) into result from (
  select o.id,o.created_at,jsonb_build_object('opportunity_id',o.id,'workspace_id',o.workspace_id,'name',o.name,
   'country_code',o.country_code,'city',o.city,'currency',o.currency,'asking_price',o.asking_price::text,
   'property_id',o.property_id,'source_ref',o.source_ref,'status',o.status,'created_at',o.created_at) item
  from airprop.investment_opportunities o where o.tenant_id=a.tenant_id and o.workspace_id=a.workspace_id
  and (o.property_id is null or exists(select 1 from portfolio.properties p join platform.workspace_property_bindings b
   on b.property_id=p.id and b.tenant_id=p.tenant_id where p.id=o.property_id and p.tenant_id=a.tenant_id
   and b.customer_workspace_id=a.workspace_id and b.status='active' and b.valid_from<=statement_timestamp()
   and (b.valid_to is null or b.valid_to>statement_timestamp())))
  order by o.created_at desc,o.id desc limit p_limit
 ) x;
 return jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunities',result);
end;
$$;
revoke all on function app_private.require_airprop_native_context_v2(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function customer_api.create_airprop_opportunity_v2(uuid,uuid,text,jsonb),customer_api.list_airprop_opportunities_v2(uuid,uuid,integer) from public,anon,service_role;
grant execute on function customer_api.create_airprop_opportunity_v2(uuid,uuid,text,jsonb),customer_api.list_airprop_opportunities_v2(uuid,uuid,integer) to authenticated;
commit;
