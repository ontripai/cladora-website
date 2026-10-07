begin;

-- Renewal is a new assignment with a new term, never a rewrite of history.
create function customer_api.renew_workspace_role_assignment_v1(
  p_context_id uuid,p_authority_context_id uuid,p_assignment_id uuid,
  p_expected_lock_version integer,p_valid_until timestamptz,
  p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,platform,identity,audit,extensions,app_private
as $$
declare
  actor record;
  previous platform.workspace_member_roles%rowtype;
  retry platform.workspace_role_idempotency%rowtype;
  request_hash text;
  inner_key text;
  ended jsonb;
  replacement jsonb;
  result jsonb;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or p_reason is null or length(btrim(p_reason))<5 then
    raise exception 'workspace_role_renew_request_invalid' using errcode='22023';
  end if;
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'assignment_id',p_assignment_id,'expected_lock_version',p_expected_lock_version,
    'authority_context_id',p_authority_context_id,'valid_until',p_valid_until,
    'reason',btrim(p_reason))::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'workspace_role_command:'||actor.tenant_id::text||':'||p_idempotency_key,0));
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select * into retry from platform.workspace_role_idempotency
    where tenant_id=actor.tenant_id and idempotency_key=p_idempotency_key;
  if found then
    if retry.actor_id=auth.uid() and retry.customer_workspace_id=actor.workspace_id
      and retry.action='renew_role' and retry.request_hash=request_hash then
      return retry.response_snapshot;
    end if;
    raise exception 'workspace_role_idempotency_conflict' using errcode='22023';
  end if;
  select * into previous from platform.workspace_member_roles
    where id=p_assignment_id for update;
  if not found or previous.tenant_id<>actor.tenant_id
    or previous.customer_workspace_id<>actor.workspace_id
    or previous.membership_id=actor.membership_id then
    raise exception 'workspace_role_renew_subordinate_required' using errcode='42501';
  end if;
  if previous.valid_to is null or previous.valid_to<=statement_timestamp()
    or p_valid_until is null or not isfinite(p_valid_until)
    or p_valid_until<=previous.valid_to then
    raise exception 'workspace_role_renew_term_invalid' using errcode='42501';
  end if;
  if p_expected_lock_version is null or previous.lock_version<>p_expected_lock_version then
    raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode='40001';
  end if;
  inner_key:='renew:'||substr(request_hash,1,48);
  ended:=customer_api.revoke_workspace_role_assignment_v2(
    p_context_id,p_authority_context_id,previous.id,p_expected_lock_version,
    p_reason,inner_key||':revoke');
  replacement:=customer_api.assign_workspace_role_v2(
    p_context_id,p_authority_context_id,previous.membership_id,previous.workspace_role_id,
    previous.scope_type,previous.property_id,previous.building_id,previous.unit_id,
    p_valid_until,p_reason,inner_key||':assign');
  result:=jsonb_build_object('action','renew_role','previous',ended,
    'replacement',replacement,'effective_at',statement_timestamp());
  insert into platform.workspace_role_idempotency(tenant_id,customer_workspace_id,
    idempotency_key,action,request_hash,result_entity_id,response_snapshot,actor_id)
  values(actor.tenant_id,actor.workspace_id,p_idempotency_key,'renew_role',request_hash,
    (replacement->>'id')::uuid,result,auth.uid());
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,
    before_snapshot,after_snapshot,reason,occurred_at)
  values(actor.tenant_id,auth.uid(),actor.role_code,'WORKSPACE_ROLE_RENEWED',
    'workspace_member_role',(replacement->>'id')::uuid,
    jsonb_build_object('previous_assignment_id',previous.id,'previous_valid_to',previous.valid_to),
    jsonb_build_object('replacement_assignment_id',(replacement->>'id')::uuid,
      'valid_until',p_valid_until),btrim(p_reason),statement_timestamp());
  return result;
end;
$$;
revoke all on function customer_api.renew_workspace_role_assignment_v1(
  uuid,uuid,uuid,integer,timestamptz,text,text) from public,anon,service_role;
grant execute on function customer_api.renew_workspace_role_assignment_v1(
  uuid,uuid,uuid,integer,timestamptz,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
