begin;

-- Domain-backed retry evidence survives retention of the shared retry record.
-- No second retry table and no mutation/backfill of existing immutable versions.
alter table airprop.underwriting_versions
 add column native_request_key text,
 add column native_request_hash text,
 add column native_response jsonb,
 add constraint airprop_underwriting_native_evidence_check check (
  (native_request_key is null and native_request_hash is null and native_response is null)
  or (native_request_key is not null and native_request_hash is not null and native_request_hash ~ '^[0-9a-f]{64}$'
   and native_request_key like 'airprop.underwriting.create.v2/%'
   and native_response is not null and jsonb_typeof(native_response)='object'));
create unique index airprop_underwriting_native_request_key_idx
 on airprop.underwriting_versions(tenant_id,native_request_key) where native_request_key is not null;

create or replace function app_private.require_airprop_native_context_v2(p_context_id uuid,p_workspace_id uuid,p_permission text)
returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_code text)
language plpgsql security definer set search_path=pg_catalog
as $$
declare a record;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if p_permission not in ('airprop.opportunity.manage','airprop.opportunity.read','airprop.underwriting.manage') or p_permission is null
 or not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,p_permission,'airprop_commercial') then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';
 end if;
 return query select a.workspace_id,a.tenant_id,a.membership_id,a.role_code;
end;
$$;

create function app_private.require_airprop_underwriting_opportunity_v2(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_permission text)
returns airprop.investment_opportunities language plpgsql security definer set search_path=pg_catalog
as $$
declare a record; o airprop.investment_opportunities%rowtype;
begin
 if p_permission is null or p_permission not in ('airprop.opportunity.read','airprop.underwriting.manage') then
  raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 select * into a from app_private.require_airprop_native_context_v2(p_context_id,p_workspace_id,p_permission);
 select * into o from airprop.investment_opportunities where id=p_opportunity_id and tenant_id=a.tenant_id and workspace_id=a.workspace_id;
 if not found then raise exception 'airprop_opportunity_not_found' using errcode='P0002';end if;
 if o.property_id is not null and not exists(select 1 from portfolio.properties p join platform.workspace_property_bindings b
  on b.property_id=p.id and b.tenant_id=p.tenant_id where p.id=o.property_id and p.tenant_id=a.tenant_id
  and b.customer_workspace_id=a.workspace_id and b.status='active' and b.valid_from<=statement_timestamp()
  and (b.valid_to is null or b.valid_to>statement_timestamp())) then
  raise exception 'airprop_reference_access_denied' using errcode='42501';end if;
 return o;
end;
$$;

create function customer_api.create_airprop_underwriting_v2(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_idempotency_key text,p_expected_version integer,p_assumptions jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare o airprop.investment_opportunities%rowtype; c airprop.underwriting_cases%rowtype;
 v airprop.underwriting_versions%rowtype; retry platform.idempotency_keys%rowtype; a record;
 cost text; rent text; opex text; currency text; assumptions jsonb; results jsonb;
 canonical text; v_content_hash text; request_hash text; request_key text; response jsonb; next_version integer;
begin
 o=app_private.require_airprop_underwriting_opportunity_v2(p_context_id,p_workspace_id,p_opportunity_id,'airprop.underwriting.manage');
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 or p_expected_version is null or p_expected_version not between 0 and 2147483646
 or p_assumptions is null or jsonb_typeof(p_assumptions)<>'object' then
  raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_assumptions) k where k not in ('acquisition_cost','annual_rent','annual_opex','currency'))
 or jsonb_typeof(p_assumptions->'acquisition_cost') is distinct from 'string'
 or jsonb_typeof(p_assumptions->'annual_rent') is distinct from 'string'
 or jsonb_typeof(p_assumptions->'annual_opex') is distinct from 'string'
 or jsonb_typeof(p_assumptions->'currency') is distinct from 'string' then
  raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 cost=p_assumptions->>'acquisition_cost';rent=p_assumptions->>'annual_rent';opex=p_assumptions->>'annual_opex';currency=p_assumptions->>'currency';
 if cost !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$' or rent !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$'
 or opex !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$' or currency not in ('RON','EUR') then
  raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 if cost::numeric<=0 or opex::numeric>rent::numeric or currency<>o.currency then
  raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 cost=(cost::numeric(20,4))::text;rent=(rent::numeric(20,4))::text;opex=(opex::numeric(20,4))::text;
 canonical='{"acquisition_cost":'||to_json(cost)::text||',"annual_rent":'||to_json(rent)::text
  ||',"annual_opex":'||to_json(opex)::text||',"currency":'||to_json(currency)::text||'}';
 assumptions=canonical::jsonb;
 v_content_hash=encode(sha256(convert_to('{"version":2,"assumptions":'||canonical||'}','UTF8')),'hex');
 request_hash=encode(sha256(convert_to('{"version":2,"workspace_id":'||to_json(p_workspace_id::text)::text
  ||',"opportunity_id":'||to_json(p_opportunity_id::text)::text||',"actor_id":'||to_json(auth.uid()::text)::text
  ||',"expected_version":'||p_expected_version::text||',"assumptions":'||canonical||'}','UTF8')),'hex');
 request_key='airprop.underwriting.create.v2/'||p_workspace_id::text||'/'||p_opportunity_id::text||'/'||p_idempotency_key;

 -- Same order as v1: case row, case advisory lock, opportunity row. Different
 -- command keys and legacy writers serialize without a case/opportunity deadlock.
 insert into airprop.underwriting_cases(tenant_id,opportunity_id,created_by) values(o.tenant_id,o.id,auth.uid())
 on conflict(tenant_id,opportunity_id) do nothing;
 select * into c from airprop.underwriting_cases where tenant_id=o.tenant_id and opportunity_id=o.id for update;
 perform pg_advisory_xact_lock(hashtextextended(c.id::text,0));
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 o=app_private.require_airprop_underwriting_opportunity_v2(p_context_id,p_workspace_id,p_opportunity_id,'airprop.underwriting.manage');
 select * into a from app_private.require_airprop_native_context_v2(p_context_id,p_workspace_id,'airprop.underwriting.manage');
 -- Check authoritative immutable retry evidence BEFORE current-version/state.
 select * into v from airprop.underwriting_versions where tenant_id=a.tenant_id and native_request_key=request_key;
 if found then
  if v.created_by is distinct from auth.uid() or v.native_request_hash is distinct from request_hash or v.underwriting_case_id<>c.id then
   raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return v.native_response || jsonb_build_object('idempotent',true);
 end if;
 select * into retry from platform.idempotency_keys where tenant_id=a.tenant_id and key=request_key for update;
 if found then raise exception 'airprop_retry_incomplete' using errcode='55000';end if;
 if currency<>o.currency then raise exception 'airprop_invalid_underwriting' using errcode='22023';end if;
 if c.current_version<>p_expected_version then raise exception 'airprop_underwriting_version_conflict' using errcode='22023';end if;
 if c.status='cancelled' or o.status not in ('draft','qualified','underwriting') then
  raise exception 'airprop_underwriting_state_conflict' using errcode='22023';end if;
 -- New keys cannot resurrect older content or emit another version-created event.
 if exists(select 1 from airprop.underwriting_versions where underwriting_case_id=c.id and underwriting_versions.input_hash=v_content_hash) then
  raise exception 'airprop_underwriting_content_conflict' using errcode='22023';end if;
 select coalesce(max(version),0)+1 into next_version from airprop.underwriting_versions where underwriting_case_id=c.id;
 if next_version<>p_expected_version+1 then raise exception 'airprop_underwriting_version_conflict' using errcode='22023';end if;
 results=jsonb_build_object('annual_noi',((rent::numeric-opex::numeric)::numeric(20,4))::text,
  'gross_yield',round(rent::numeric/cost::numeric,8)::text,'net_yield',round((rent::numeric-opex::numeric)/cost::numeric,8)::text,'currency',currency);
 response=jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunity_id',o.id,
  'underwriting_case_id',c.id,'evaluation_version',next_version,'results',results,'status','underwriting','idempotent',false);
 insert into airprop.underwriting_versions(tenant_id,underwriting_case_id,version,assumptions,results,input_hash,created_by,native_request_key,native_request_hash,native_response)
 values(a.tenant_id,c.id,next_version,assumptions,results,v_content_hash,auth.uid(),request_key,request_hash,response);
 update airprop.underwriting_cases set current_version=next_version,status='published',updated_at=statement_timestamp() where id=c.id;
 update airprop.investment_opportunities set status='underwriting',updated_at=statement_timestamp() where id=o.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(a.tenant_id,auth.uid(),a.role_code,'AIRPROP_UNDERWRITING_VERSION_CREATED','airprop.underwriting_case',c.id,
  jsonb_build_object('version',2,'workspace_id',a.workspace_id,'opportunity_id',o.id,'evaluation_version',next_version,'input_hash',v_content_hash),'Workspace-native AIRPROP evaluation');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(a.tenant_id,'airprop.underwriting_case',c.id,next_version,'airprop.underwriting.created.v2',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at)
 values(a.tenant_id,auth.uid(),request_key,request_hash,response,201,statement_timestamp()+interval '30 days');
 return response;
end;
$$;

create function customer_api.list_airprop_underwriting_v2(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare o airprop.investment_opportunities%rowtype; c airprop.underwriting_cases%rowtype; versions jsonb;
begin
 o=app_private.require_airprop_underwriting_opportunity_v2(p_context_id,p_workspace_id,p_opportunity_id,'airprop.opportunity.read');
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'airprop_invalid_limit' using errcode='22023';end if;
 select * into c from airprop.underwriting_cases where tenant_id=o.tenant_id and opportunity_id=o.id;
 select coalesce(jsonb_agg(x.item order by x.version desc),'[]'::jsonb) into versions from (
  select v.version,jsonb_build_object('evaluation_version',v.version,
   'assumptions',jsonb_build_object('acquisition_cost',v.assumptions->>'acquisition_cost','annual_rent',v.assumptions->>'annual_rent','annual_opex',v.assumptions->>'annual_opex','currency',v.assumptions->>'currency'),
   'results',jsonb_build_object('annual_noi',v.results->>'annual_noi','gross_yield',v.results->>'gross_yield','net_yield',v.results->>'net_yield','currency',v.results->>'currency'),
   'created_at',v.created_at) item
  from airprop.underwriting_versions v where v.tenant_id=o.tenant_id and v.underwriting_case_id=c.id order by v.version desc limit p_limit
 ) x;
 return jsonb_build_object('version',2,'workspace_id',p_workspace_id,'opportunity_id',o.id,'currency',o.currency,
  'underwriting_case_id',c.id,'current_version',coalesce(c.current_version,0),'versions',versions);
end;
$$;
revoke all on function app_private.require_airprop_native_context_v2(uuid,uuid,text),app_private.require_airprop_underwriting_opportunity_v2(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function customer_api.create_airprop_underwriting_v2(uuid,uuid,uuid,text,integer,jsonb),customer_api.list_airprop_underwriting_v2(uuid,uuid,uuid,integer) from public,anon,service_role;
grant execute on function customer_api.create_airprop_underwriting_v2(uuid,uuid,uuid,text,integer,jsonb),customer_api.list_airprop_underwriting_v2(uuid,uuid,uuid,integer) to authenticated;
commit;
