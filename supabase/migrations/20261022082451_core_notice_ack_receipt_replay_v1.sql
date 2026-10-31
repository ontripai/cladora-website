-- CORE-NOTICE-ACK-RECEIPT-REPLAY-01. Forward-only receipt correction.
-- SQL omitted/null method => in_app_click, as before. Checksum/notes retain
-- exact SQL values: NULL differs from ''. The unchanged HTTP schema trims strings
-- and defaults an omitted method; it does not accept explicit JSON null.
-- A different effective method/checksum/notes is 23505, never an evidence update.
-- CREATE OR REPLACE preserves the existing owner, signature/defaults and ACL.
create or replace function communications.acknowledge_notice_internal(
  p_context_id uuid,
  p_notice_id uuid,
  p_method text default 'in_app_click',
  p_checksum text default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, identity, platform as $$
declare
  v_actor record;
  v_recipient communications.notice_recipients%rowtype;
  v_ack communications.notice_acknowledgements%rowtype;
  v_method text := coalesce(p_method, 'in_app_click');
  v_now timestamptz;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.acknowledge', false);

  -- The frozen recipient is the existing unique logical-receipt serialization
  -- point, including before the first acknowledgement row exists. No upsert.
  select * into v_recipient
  from communications.notice_recipients
  where notice_id = p_notice_id
    and membership_id = v_actor.membership_id
    and tenant_id = v_actor.tenant_id
  for update;
  if not found then
    raise exception 'recipient_record_not_found_for_caller' using errcode = '42501';
  end if;

  -- A waiter must not reuse authority from before the lock wait. The canonical
  -- resolver remains authoritative for actor, permission, Context and entitlement.
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.acknowledge', false);
  if v_actor.membership_id is distinct from v_recipient.membership_id
     or v_actor.tenant_id is distinct from v_recipient.tenant_id then
    raise exception 'recipient_record_not_found_for_caller' using errcode = '42501';
  end if;

  -- The existing resolver uses statement_timestamp(). Recheck its same temporal
  -- boundaries at wall-clock time too, so expiry DURING the wait cannot replay.
  -- No role/permission source, scope or resolver contract is replaced here.
  v_now := clock_timestamp();
  if not exists (
    select 1 from identity.context_grants g
    join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
    where g.id = p_context_id and m.id = v_actor.membership_id
      and m.user_id = v_actor.actor_id and m.tenant_id = v_actor.tenant_id
      and m.status = 'active'
      and m.starts_at <= v_now and (m.ends_at is null or m.ends_at > v_now)
      and g.starts_at <= v_now and (g.ends_at is null or g.ends_at > v_now)
  ) then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from platform.workspace_entitlements we
    where we.customer_workspace_id = (
      select w.id from platform.customer_workspaces w
      where w.tenant_id = v_actor.tenant_id and w.lifecycle_status = 'ACTIVE'
      order by w.id limit 1
    ) and we.entitlement_key = 'module.communications'
      and we.valid_from <= v_now and (we.valid_until is null or we.valid_until > v_now)
      and (case when we.override_value_json is not null and we.override_expires_at > v_now
                then we.override_value_json = 'true'::jsonb else we.boolean_value is true end)
  ) then
    raise exception 'entitlement_module_communications_required' using errcode = '42501';
  end if;

  select * into v_ack from communications.notice_acknowledgements
  where notice_id = p_notice_id and membership_id = v_actor.membership_id;
  if found then
    if v_ack.tenant_id is distinct from v_actor.tenant_id
       or v_ack.recipient_id is distinct from v_recipient.id then
      raise exception 'recipient_record_not_found_for_caller' using errcode = '42501';
    end if;
    if v_ack.acknowledgement_method is distinct from v_method
       or v_ack.evidence_checksum is distinct from p_checksum
       or v_ack.notes is distinct from p_notes then
      raise exception 'notice_acknowledgement_conflict' using errcode = '23505';
    end if;
  else
    insert into communications.notice_acknowledgements (
      tenant_id, notice_id, recipient_id, membership_id,
      acknowledgement_method, evidence_checksum, notes, acknowledged_at
    ) values (
      v_actor.tenant_id, p_notice_id, v_recipient.id, v_actor.membership_id,
      v_method, p_checksum, p_notes, statement_timestamp()
    ) returning * into v_ack;

    -- Same transaction: audit failure rolls back the new acknowledgement too.
    -- Replay never enters this branch and never emits another completion event.
    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v_actor.tenant_id, v_actor.actor_id, v_actor.role_code,
      'communications.notice.acknowledged', 'communications.notice_acknowledgements', v_ack.id,
      jsonb_build_object('method', v_method, 'acknowledged_at', v_ack.acknowledged_at),
      v_ack.acknowledged_at
    );
  end if;
  return jsonb_build_object(
    'success', true, 'acknowledgement_id', v_ack.id,
    'acknowledged_at', v_ack.acknowledged_at, 'is_statutory_proof', false
  );
end;
$$;
