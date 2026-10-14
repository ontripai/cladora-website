begin;

-- Canonical Core authority profile for the mutation. This defines the
-- permission/module relationship only: no role assignment, entitlement,
-- client EXECUTE grant or runtime activation is added.
insert into identity.permissions(code,resource,action,description) values
  ('services.orders.subject_link','services.orders','subject_link',
   'Link an authorized canonical subject to an existing Service Request')
on conflict(code) do nothing;
insert into platform.module_permission_bindings(
  module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2
)
select m.id,p.id,'manage',false,true
from platform.module_definitions m
join identity.permissions p on p.code='services.orders.subject_link'
where m.code='services_orders' and m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;

-- SERVICE owns only the Request-to-message domain relationship. Communications
-- remains the canonical message/audience owner and Core remains the transaction,
-- authority, idempotency, audit, outbox and receipt owner.
create table service_catalog.request_subject_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  request_id uuid not null references service_catalog.requests(id) on delete restrict,
  request_version bigint not null
    check (request_version between 2 and 9007199254740991),
  message_id uuid not null references communications.private_messages(id) on delete restrict,
  message_version bigint not null
    check (message_version between 1 and 9007199254740991),
  relation text not null check (relation = 'conversation'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (request_id, message_id)
);

create index request_subject_links_scope_idx
  on service_catalog.request_subject_links(tenant_id, workspace_id, request_id, id);
alter table service_catalog.request_subject_links enable row level security;
revoke all on service_catalog.request_subject_links from public,anon,authenticated,service_role;

-- Called only through CoreTransactionProvidersV2.mutate in the Core-owned SQL
-- transaction. The CE-owned Communications gate is repeated after the Request
-- lock. Core writes shared idempotency, audit, outbox and receipt effects after
-- this returns; any later failure rolls every effect back.
create function app_private.insert_service_request_message_link_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_expected_request_version bigint,
  p_message_id uuid,
  p_expected_message_version bigint
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_gate record;
  v_request service_catalog.requests%rowtype;
  v_link_id uuid := gen_random_uuid();
begin
  if p_expected_request_version not between 1 and 9007199254740990
      or p_expected_message_version not between 1 and 9007199254740991 then
    raise exception 'service_request_link_invalid' using errcode='22023';
  end if;
  if auth.uid() is null or auth.uid()<>p_actor_id
      or app_private.check_workspace_native_permission_v2(
        p_context_id,p_workspace_id,'services.orders.subject_link','services_orders'
      ) is not true then
    raise exception 'service_request_link_denied' using errcode='42501';
  end if;

  perform app_private.lock_service_request_version_v1(
    p_workspace_id,p_request_id,p_expected_request_version
  );

  -- Consume the CE/Communications canonical gate. It rechecks current message
  -- read authority, exact message and Request versions, Workspace, beneficiary
  -- and provider audience. SERVICE does not reproduce that audience policy.
  select * into strict v_gate
  from communications.resolve_private_message_request_audience_v1(
    p_context_id,p_workspace_id,p_actor_id,p_message_id,
    p_expected_message_version,p_request_id,p_expected_request_version
  );
  if v_gate.decision<>'accepted'
      or v_gate.current_actor_can_read is distinct from true
      or v_gate.request_party_audience_only is distinct from true then
    if v_gate.denial_reason in ('STALE_REQUEST','STALE_SUBJECT') then
      raise exception 'service_request_link_stale' using errcode='40001';
    end if;
    raise exception 'service_request_link_denied' using errcode='42501';
  end if;

  -- Recheck the dedicated mutation permission after all provider/row-lock waits.
  if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'services.orders.subject_link','services_orders'
    ) is not true then
    raise exception 'service_request_link_denied' using errcode='42501';
  end if;

  select r.* into strict v_request
  from service_catalog.requests r
  where r.id=p_request_id and r.workspace_id=p_workspace_id
    and r.requester_id=p_actor_id and r.version=p_expected_request_version;

  insert into service_catalog.request_subject_links(
    id,tenant_id,workspace_id,request_id,request_version,
    message_id,message_version,relation,created_by
  ) values(
    v_link_id,v_request.tenant_id,v_request.workspace_id,v_request.id,
    p_expected_request_version+1,p_message_id,p_expected_message_version,
    'conversation',p_actor_id
  );
  update service_catalog.requests
  set version=version+1
  where id=p_request_id and workspace_id=p_workspace_id
    and version=p_expected_request_version;
  if not found then
    raise exception 'service_request_link_stale' using errcode='40001';
  end if;
  return v_link_id;
end;
$$;

revoke all on function app_private.insert_service_request_message_link_v1(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint
) from public,anon,authenticated,service_role;

comment on table service_catalog.request_subject_links is
  'SERVICE-owned canonical Request-to-private-message relation only; Core owns receipt, idempotency, audit and outbox.';
comment on function app_private.insert_service_request_message_link_v1(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint
) is
  'Inactive Core TX host mutation callback; consumes the CE audience gate, inserts one SERVICE link and advances Request version in the caller transaction.';

commit;
