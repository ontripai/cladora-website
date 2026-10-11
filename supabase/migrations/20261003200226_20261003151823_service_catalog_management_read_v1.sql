begin;
alter table service_catalog.definitions add lock_version bigint not null default 1 check(lock_version between 1 and 9007199254740991);

-- Serialize use of an active definition against concurrent deactivation. These
-- triggers run inside the existing audited mutation RPC, with no new bypass.
create function app_private.service_catalog_active_definition_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
declare v_definition uuid; v_active boolean;
begin
 if tg_table_name='offerings' then v_definition:=new.definition_id;
 else
  select definition_id into strict v_definition from service_catalog.offerings
  where (tenant_id,workspace_id,id)=(new.tenant_id,new.workspace_id,new.offering_id);
 end if;
 select active into v_active from service_catalog.definitions
 where (tenant_id,workspace_id,id)=(new.tenant_id,new.workspace_id,v_definition) for share;
 if v_active is not true then raise exception 'inactive_service_definition' using errcode='22023'; end if;
 return new;
end;
$$;
revoke all on function app_private.service_catalog_active_definition_guard_v1() from public,anon,authenticated,service_role;
create trigger service_catalog_create_definition_guard before insert on service_catalog.offerings
 for each row execute function app_private.service_catalog_active_definition_guard_v1();
create trigger service_catalog_publish_definition_guard before update of status on service_catalog.revisions
 for each row when(new.status='published' and old.status is distinct from new.status)
 execute function app_private.service_catalog_active_definition_guard_v1();

-- An explicit native target plus current management/publication permission is
-- required. The published-customer projection remains unchanged.
create function customer_api.read_service_catalog_management_v1(p_context_id uuid,p_workspace_id uuid,p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_manage boolean; v_publish boolean; v_offerings jsonb; v_definitions jsonb; v_providers jsonb; v_next uuid;
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
 select tenant_id into strict v_tenant from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 v_manage:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'services.catalog.manage','services_catalog') is true;
 v_publish:=app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'services.catalog.publish','services_catalog') is true;
 if not(v_manage or v_publish) then raise exception 'service_catalog_access_denied' using errcode='42501'; end if;
 with page as (
  select o.* from service_catalog.offerings o where o.tenant_id=v_tenant and o.workspace_id=p_workspace_id
   and (p_after is null or o.id>p_after) order by o.id limit 51
 ), visible as (select * from page order by id limit 50)
 select coalesce(jsonb_agg(jsonb_build_object('offering_id',o.id,'definition_id',o.definition_id,'provider_party_id',o.provider_party_id,
  'lock_version',o.lock_version,'current_revision_id',o.current_revision_id,'published_revision_id',o.published_revision_id,
  'revisions',(select coalesce(jsonb_agg(jsonb_build_object('revision_id',r.id,'status',r.status,'revision',r.commercial_terms,
   'can_publish',v_publish and r.status='submitted' and r.id=o.current_revision_id
    and auth.uid()<>r.created_by and auth.uid() is distinct from r.submitted_by) order by r.created_at,r.id),'[]'::jsonb)
   from service_catalog.revisions r where (r.tenant_id,r.workspace_id,r.offering_id)=(v_tenant,p_workspace_id,o.id))) order by o.id),'[]'::jsonb),
  (select case when count(*)>50 then (select id from visible order by id desc limit 1) end from page)
 into v_offerings,v_next from visible o;
 -- Do not return contact/tax data, actor IDs or another Workspace's definitions.
 select coalesce(jsonb_agg(jsonb_build_object('definition_id',id,'code',code,'labels',labels,'active',active,'lock_version',lock_version) order by code),'[]'::jsonb)
 into v_definitions from service_catalog.definitions where tenant_id=v_tenant and workspace_id=p_workspace_id;
 if v_manage then
  select coalesce(jsonb_agg(jsonb_build_object('provider_party_id',id,'label',legal_name) order by legal_name,id),'[]'::jsonb)
  into v_providers from portfolio.parties where tenant_id=v_tenant and archived_at is null;
 else v_providers:='[]'::jsonb; end if;
 return jsonb_build_object('can_manage',v_manage,'can_publish',v_publish,'offerings',v_offerings,
  'definitions',v_definitions,'providers',v_providers,'next_after',v_next);
end;
$$;
create function customer_api.update_service_definition_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_workspace uuid; v_actor uuid:=auth.uid(); v_key text; v_hash text;
 v_claim platform.idempotency_keys%rowtype; v_definition service_catalog.definitions%rowtype; v_result jsonb; v_before jsonb;
begin
 if v_actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023'; end if;
 if not(p_request ?& array['context_id','workspace_id','definition_id','expected_lock_version','labels','active','reason','idempotency_key'])
 or p_request-array['context_id','workspace_id','definition_id','expected_lock_version','labels','active','reason','idempotency_key']<>'{}'::jsonb
 or jsonb_typeof(p_request->'context_id') is distinct from 'string'
 or jsonb_typeof(p_request->'workspace_id') is distinct from 'string'
 or jsonb_typeof(p_request->'definition_id') is distinct from 'string'
 or jsonb_typeof(p_request->'expected_lock_version') is distinct from 'number'
 or coalesce(p_request->>'expected_lock_version','') !~ '^[1-9][0-9]*$'
 or jsonb_typeof(p_request->'active') is distinct from 'boolean'
 or jsonb_typeof(p_request->'reason') is distinct from 'string'
 or length(btrim(p_request->>'reason')) not between 5 and 500
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string'
 or coalesce(p_request->>'idempotency_key','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 or not app_private.service_catalog_labels_valid_v1(p_request->'labels',200) then raise exception 'invalid_request' using errcode='22023'; end if;
 v_workspace:=(p_request->>'workspace_id')::uuid;
 v_tenant:=app_private.service_catalog_authorize_v1((p_request->>'context_id')::uuid,v_workspace,'services.catalog.manage');
 v_key:='service_catalog_definition:sql_v1:'||v_workspace||':update:'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,v_actor,v_key,v_hash,statement_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_claim from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 if v_claim.actor_id is distinct from v_actor or v_claim.request_hash<>v_hash or v_claim.expires_at<=statement_timestamp() then raise exception 'idempotency_conflict' using errcode='23505'; end if;
 if v_claim.response_ref is not null then return v_claim.response_ref; end if;
 select * into v_definition from service_catalog.definitions where id=(p_request->>'definition_id')::uuid and tenant_id=v_tenant and workspace_id=v_workspace for update;
 if not found then raise exception 'definition_not_found' using errcode='P0002'; end if;
 if (p_request->>'expected_lock_version')::numeric<>v_definition.lock_version or v_definition.lock_version>=9007199254740991 then raise exception 'version_conflict' using errcode='40001'; end if;
 v_before:=jsonb_build_object('labels',v_definition.labels,'active',v_definition.active,'lock_version',v_definition.lock_version);
 update service_catalog.definitions set labels=p_request->'labels',active=(p_request->>'active')::boolean,lock_version=lock_version+1
 where id=v_definition.id returning * into v_definition;
 v_result:=jsonb_build_object('definition_id',v_definition.id,'labels',v_definition.labels,'active',v_definition.active,'lock_version',v_definition.lock_version);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(v_tenant,v_actor,'services.catalog.definition.update','service_definition',v_definition.id,v_before,v_result,p_request->>'reason');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_tenant,'service_definition',v_definition.id,v_definition.lock_version,'services.catalog.definition.update',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_tenant and key=v_key;
 return v_result;
end;
$$;
revoke all on function customer_api.update_service_definition_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.update_service_definition_v1(jsonb) to authenticated;
revoke all on function customer_api.read_service_catalog_management_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.read_service_catalog_management_v1(uuid,uuid,uuid) to authenticated;
commit;
