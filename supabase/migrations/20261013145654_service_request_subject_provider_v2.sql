begin;

-- Private transaction-scoped Request provider resolver. Canonical Request,
-- Workspace, authority and beneficiary truth stay in their existing stores.
-- Expected source denials are returned as bounded rows so the surrounding Core
-- transaction remains usable; genuine database errors, including 40001, are
-- deliberately not caught here.
create function app_private.resolve_service_request_subject_provider_v2(
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_expected_version bigint
)
returns table(
  decision text,
  denial_reason text,
  request_context jsonb,
  evaluated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_scope record;
  v_request service_catalog.requests%rowtype;
begin
  if p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_request_id is null or p_expected_version is null
      or p_expected_version not between 1 and 9007199254740991
      or auth.uid() is null or auth.uid() <> p_actor_id then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;

  if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'services.orders.read','services_orders'
    ) is not true then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;
  select * into strict v_scope
  from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);

  select r.* into v_request
  from service_catalog.requests r
  where r.id=p_request_id and r.workspace_id=p_workspace_id
    and r.tenant_id=v_scope.tenant_id and r.requester_id=p_actor_id
    and r.membership_id=v_scope.membership_id
  for share;
  if not found then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;

  -- Recheck the canonical evaluator and exact context after the Request lock.
  if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'services.orders.read','services_orders'
    ) is not true then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;
  select * into strict v_scope
  from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
  if v_scope.membership_id is distinct from v_request.membership_id
      or v_scope.tenant_id is distinct from v_request.tenant_id then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;
  if v_request.version <> p_expected_version then
    decision := 'denied'; denial_reason := 'STALE_SUBJECT';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;

  perform 1
  from identity.membership_parties mp
  join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
  where mp.tenant_id=v_request.tenant_id
    and mp.membership_id=v_request.membership_id
    and mp.party_id=v_request.beneficiary_party_id
    and mp.valid_from<=clock_timestamp()
    and (mp.valid_until is null or mp.valid_until>clock_timestamp())
    and p.archived_at is null
  for share of mp,p;
  if not found then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;

  -- A party-lock wait must not preserve a prior authority decision.
  if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'services.orders.read','services_orders'
    ) is not true then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;
  select * into strict v_scope
  from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
  if v_scope.membership_id is distinct from v_request.membership_id
      or v_scope.tenant_id is distinct from v_request.tenant_id then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    request_context := null; evaluated_at := clock_timestamp();
    return next; return;
  end if;

  decision := 'accepted'; denial_reason := null;
  request_context := jsonb_build_object(
    'request_id',v_request.id,
    'request_version',v_request.version,
    'workspace_id',v_request.workspace_id,
    'status',v_request.status,
    'actor_party_snapshot',jsonb_build_object(
      'party_id',v_request.beneficiary_party_id,'current_actor_is_party',true
    ),
    'audience_party_snapshot',jsonb_build_object(
      'party_ids',jsonb_build_array(v_request.beneficiary_party_id),
      'request_party_only',true
    )
  );
  evaluated_at := clock_timestamp();
  return next;
end;
$$;

revoke all on function app_private.resolve_service_request_subject_provider_v2(
  uuid,uuid,uuid,uuid,bigint
) from public,anon,authenticated,service_role;

comment on function app_private.resolve_service_request_subject_provider_v2(
  uuid,uuid,uuid,uuid,bigint
) is
  'Inactive CoreTransactionProvidersV2 Request resolver. Uses canonical current SERVICE authority and own-beneficiary truth in the caller transaction; exposes only the six-field subject context.';

commit;
