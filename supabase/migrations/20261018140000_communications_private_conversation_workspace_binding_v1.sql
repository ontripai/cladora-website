begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D5 owns only the physical conversation Workspace binding and its creation
-- guard. Historical rows remain NULL without inference or backfill. S1 owns
-- the V2 currentness/audience resolvers and S4 owns Communications table ACLs.
alter table communications.private_conversations
  add column workspace_id uuid;

alter table communications.private_conversations
  add constraint private_conversations_workspace_tenant_v1
    foreign key (workspace_id,tenant_id)
    references platform.customer_workspaces(id,tenant_id)
    on delete restrict;

create index private_conversations_workspace_tenant_v1_idx
  on communications.private_conversations(workspace_id,tenant_id)
  where workspace_id is not null;

comment on column communications.private_conversations.workspace_id is
  'Explicit canonical Workspace accepted by the trusted private-conversation writer; NULL is historical and ineligible for canonical operations.';

create function communications.guard_private_conversation_workspace_binding_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_marker jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id then
      raise exception using
        errcode = '55000',
        message = 'private_conversation_workspace_binding_is_immutable';
    end if;
    return new;
  end if;

  if new.workspace_id is null then
    raise exception using
      errcode = '23502',
      message = 'private_conversation_workspace_binding_required';
  end if;

  begin
    v_marker := nullif(current_setting(
      'communications.private_conversation_workspace_writer_v1', true
    ), '')::jsonb;
  exception when others then
    v_marker := null;
  end;

  if v_marker is null
    or v_marker->>'contract_version'
      <> 'communications-private-conversation-workspace.v1'
    or v_marker->>'workspace_id' <> new.workspace_id::text
    or v_marker->>'tenant_id' <> new.tenant_id::text
    or v_marker->>'unit_id' <> new.unit_id::text
    or v_marker->>'actor_membership_id' <> new.created_by::text
    or v_marker->>'client_request_id' <> new.client_request_id::text
  then
    raise exception using
      errcode = '42501',
      message = 'trusted_private_conversation_writer_required';
  end if;

  if not exists (
    select 1
    from platform.customer_workspaces w
    where w.id = new.workspace_id
      and w.tenant_id = new.tenant_id
      and w.archived_at is null
      and w.lifecycle_status = 'ACTIVE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'private_conversation_workspace_not_current';
  end if;

  return new;
end;
$$;

alter function communications.guard_private_conversation_workspace_binding_v1()
  owner to postgres;
revoke all on function communications.guard_private_conversation_workspace_binding_v1()
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

create trigger private_conversation_workspace_binding_v1
before insert or update of workspace_id
on communications.private_conversations
for each row execute function
  communications.guard_private_conversation_workspace_binding_v1();

commit;
