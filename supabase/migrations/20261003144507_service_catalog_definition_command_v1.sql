begin;
create function customer_api.list_service_definitions_v1(p_context_id uuid,p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_result jsonb;
begin
 v_tenant:=app_private.service_catalog_authorize_v1(p_context_id,p_workspace_id,'services.catalog.manage');
 select coalesce(jsonb_agg(jsonb_build_object('definition_id',id,'code',code,'labels',labels) order by code),'[]'::jsonb)
 into v_result from service_catalog.definitions where tenant_id=v_tenant and workspace_id=p_workspace_id and active;
 return v_result;
end;
$$;

create function customer_api.create_service_definition_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_workspace uuid; v_actor uuid:=auth.uid(); v_key text; v_hash text;
 v_claim platform.idempotency_keys%rowtype; v_id uuid; v_result jsonb;
begin
 if v_actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023'; end if;
 if not(p_request ?& array['context_id','workspace_id','code','labels','idempotency_key'])
 or p_request-array['context_id','workspace_id','code','labels','idempotency_key']<>'{}'::jsonb
 or jsonb_typeof(p_request->'context_id') is distinct from 'string'
 or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'code') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string'
 or coalesce(p_request->>'code','') !~ '^[a-z][a-z0-9_]{1,63}$'
 or coalesce(p_request->>'idempotency_key','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 or not app_private.service_catalog_labels_valid_v1(p_request->'labels',200) then raise exception 'invalid_request' using errcode='22023'; end if;
 v_workspace:=(p_request->>'workspace_id')::uuid;
 v_tenant:=app_private.service_catalog_authorize_v1((p_request->>'context_id')::uuid,v_workspace,'services.catalog.manage');
 v_key:='service_catalog_definition:sql_v1:'||v_workspace||':create:'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,v_actor,v_key,v_hash,statement_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_claim from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 if v_claim.actor_id is distinct from v_actor or v_claim.request_hash<>v_hash or v_claim.expires_at<=statement_timestamp() then raise exception 'idempotency_conflict' using errcode='23505'; end if;
 if v_claim.response_ref is not null then return v_claim.response_ref; end if;
 insert into service_catalog.definitions(tenant_id,workspace_id,code,labels)
 values(v_tenant,v_workspace,p_request->>'code',p_request->'labels') returning id into v_id;
 v_result:=jsonb_build_object('definition_id',v_id,'code',p_request->>'code','labels',p_request->'labels');
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
 values(v_tenant,v_actor,'services.catalog.definition.create','service_definition',v_id,v_result);
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'service_definition',v_id,1,'services.catalog.definition.create',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_tenant and key=v_key;
 return v_result;
end;
$$;
revoke all on function customer_api.list_service_definitions_v1(uuid,uuid),customer_api.create_service_definition_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.list_service_definitions_v1(uuid,uuid),customer_api.create_service_definition_v1(jsonb) to authenticated;
commit;
