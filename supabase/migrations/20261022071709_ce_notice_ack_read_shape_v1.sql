-- CE-NOTICE-ACK-READ-SHAPE-01: preserve the existing invoker/authority contract.
-- SELECT INTO a jsonb scalar gives SQL NULL when no row exists, without a record wrapper.
begin;

create or replace function customer_api.get_notice_detail_v1(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_actor record;
  v_notice record;
  v_evidence jsonb;
  v_my_ack jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.read', false);

  select
    n.*,
    (select count(*) from communications.notice_recipients nr where nr.notice_id = n.id) as recipient_count,
    (select count(*) from communications.notice_acknowledgements na where na.notice_id = n.id) as ack_count
  into v_notice
  from communications.official_notices n
  where n.id = p_notice_id and n.tenant_id = v_actor.tenant_id;

  if not found then
    raise exception 'notice_not_found' using errcode = '22000';
  end if;

  -- Check access for resident/owner
  if v_actor.role_code in ('owner', 'tenant_resident') and v_notice.status <> 'published' then
    raise exception 'notice_not_accessible' using errcode = '42501';
  end if;

  select to_jsonb(na) into v_my_ack
  from communications.notice_acknowledgements na
  where na.notice_id = p_notice_id and na.membership_id = v_actor.membership_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'evidence_type', se.evidence_type,
      'evidence_reference', se.evidence_reference,
      'occurred_at', se.occurred_at,
      'verification_status', se.verification_status,
      'verified_at', se.verified_at,
      'notes', se.notes
    )
  ), '[]'::jsonb)
  into v_evidence
  from communications.statutory_evidence se
  where se.notice_id = p_notice_id;

  return jsonb_build_object(
    'notice', to_jsonb(v_notice),
    'my_acknowledgement', v_my_ack,
    'statutory_evidence', v_evidence
  );
end;
$$;

commit;
