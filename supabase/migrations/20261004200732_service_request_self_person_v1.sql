begin;
-- Pilot-only account enrollment creates a NEW synthetic person for the caller.
-- It cannot claim an existing person, change mappings, or establish ownership,
-- residency, vendor affiliation, delegation or identity-document verification.
create function customer_api.register_service_self_person_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$declare
 v_actor uuid:=auth.uid();v_scope record;v_context uuid;v_workspace uuid;
 v_name text;v_until timestamptz;v_key text;v_hash text;
 v_idem platform.idempotency_keys%rowtype;v_party uuid;v_result jsonb;
begin
 if v_actor is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from auth.users where id=v_actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false) then
  raise exception 'self_person_access_denied' using errcode='42501';end if;
 if jsonb_typeof(p_request) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_request))<>6
 or not(p_request ?& array['context_id','workspace_id','name','valid_until','confirm_self','idempotency_key'])
 or p_request->'confirm_self' is distinct from 'true'::jsonb
 or jsonb_typeof(p_request->'name') is distinct from 'string'
 or jsonb_typeof(p_request->'valid_until') is distinct from 'string'
 or jsonb_typeof(p_request->'idempotency_key') is distinct from 'string' then
  raise exception 'invalid_self_person' using errcode='22023';end if;
 v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
 v_name:=trim(p_request->>'name');v_until:=(p_request->>'valid_until')::timestamptz;
 if length(v_name) not between 2 and 120 or not isfinite(v_until)
 or v_until<=clock_timestamp() or v_until>clock_timestamp()+interval '72 hours'
 or (p_request->>'idempotency_key') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'invalid_self_person' using errcode='22023';end if;
 select * into strict v_scope from app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.read');
 perform 1 from platform.customer_workspaces where id=v_workspace and tenant_id=v_scope.tenant_id and environment='PILOT' and lifecycle_status='ACTIVE' for share;
 if not found then raise exception 'pilot_required' using errcode='42501';end if;
 -- One lock per membership serializes different keys too; no orphan duplicate person.
 perform 1 from identity.memberships where id=v_scope.membership_id and tenant_id=v_scope.tenant_id and user_id=v_actor and status='active' for update;
 if not found then raise exception 'self_person_access_denied' using errcode='42501';end if;
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.request');
 perform app_private.service_request_authorize_v1(v_context,v_workspace,'services.orders.read');
 v_key:='service_self_person:sql_v1:'||v_workspace||':'||v_actor||':'||(p_request->>'idempotency_key');
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',v_actor,'tenant',v_scope.tenant_id,'request',p_request)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_scope.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_scope.tenant_id and key=v_key for update;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash or v_idem.expires_at<=clock_timestamp() then
  raise exception 'idempotency_conflict' using errcode='23505';end if;
 if v_idem.response_ref is not null then
  perform 1 from identity.membership_parties mp join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
  where mp.membership_id=v_scope.membership_id and mp.tenant_id=v_scope.tenant_id
   and mp.party_id=(v_idem.response_ref->>'party_id')::uuid and mp.valid_until=v_until
   and mp.valid_from<=clock_timestamp() and mp.valid_until>clock_timestamp() and p.archived_at is null;
  if not found then raise exception 'self_person_access_denied' using errcode='42501';end if;
  return v_idem.response_ref;
 end if;
 if exists(select 1 from identity.membership_parties where membership_id=v_scope.membership_id) then
  raise exception 'existing_mapping_requires_review' using errcode='23505';end if;
 insert into portfolio.parties(tenant_id,type,legal_name) values(v_scope.tenant_id,'person','PILOT TEST — '||v_name) returning id into v_party;
 insert into identity.membership_parties(membership_id,tenant_id,party_id,valid_from,valid_until)
 values(v_scope.membership_id,v_scope.tenant_id,v_party,clock_timestamp(),v_until);
 v_result:=jsonb_build_object('party_id',v_party,'valid_until',v_until);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot,reason)
 values(v_scope.tenant_id,v_actor,'services.self_person.register','membership_party',v_scope.membership_id,v_result,
 'Pilot self-person; caller confirmed own account; no ownership or legal identity verification');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
 values(v_scope.tenant_id,'service_self_person',v_party,1,'services.self_person.registered',v_result);
 update platform.idempotency_keys set response_ref=v_result,status_code=200 where tenant_id=v_scope.tenant_id and key=v_key;
 return v_result;
end;$$;
revoke all on function customer_api.register_service_self_person_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.register_service_self_person_v1(jsonb) to authenticated;
commit;
