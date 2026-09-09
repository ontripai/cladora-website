begin;

-- ============================================================================
-- CLADORA-P2-GOV-001: Routine Grants & Extension Search Path Hardening
-- 1. Updates search_path to include extensions schema for digest() calls
-- 2. Permits authenticated callers invoking SECURITY INVOKER customer_api
--    wrappers to execute the underlying domain functions in governance schema.
-- Direct HTTP access remains blocked because governance schema is unexposed.
-- ============================================================================

-- 1. Hardened cast_vote with extensions in search_path
create or replace function governance.cast_vote(
  p_context_id uuid,
  p_vote_id uuid,
  p_eligibility_id uuid,
  p_choice text,
  p_idempotency_key text default null
)
returns governance.ballots
language plpgsql security definer set search_path=pg_catalog,governance,audit,extensions as $$
declare
  v_actor record;
  v_vote governance.votes;
  v_eligibility governance.eligibility_snapshots;
  v_opt governance.vote_options;
  v_ballot governance.ballots;
  v_receipt text;
  v_party_match boolean := false;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.cast', false);

  if p_choice not in ('for', 'against', 'abstain') then
    raise exception 'invalid_ballot_choice' using errcode = '22023';
  end if;

  select * into v_vote from governance.votes
  where id = p_vote_id and tenant_id = v_actor.tenant_id
  for update;

  if v_vote.id is null or v_vote.status <> 'open' then
    raise exception 'ballot_not_open' using errcode = '42501';
  end if;

  select * into v_eligibility from governance.eligibility_snapshots
  where id = p_eligibility_id and meeting_id = v_vote.meeting_id and tenant_id = v_actor.tenant_id;

  if v_eligibility.id is null or not v_eligibility.eligible then
    raise exception 'ineligible_voter' using errcode = '42501';
  end if;

  -- Verify voter entitlement: direct owner OR verified proxy
  if v_eligibility.party_id = v_actor.party_id then
    v_party_match := true;
  else
    if exists (
      select 1 from governance.proxies p
      where p.meeting_id = v_vote.meeting_id
        and p.eligibility_id = p_eligibility_id
        and p.representative_party_id = v_actor.party_id
        and p.status = 'active'
        and p.valid_from <= statement_timestamp()
        and p.valid_until > statement_timestamp()
    ) then
      v_party_match := true;
    end if;
  end if;

  if not v_party_match and lower(v_actor.role_code) not in ('association_admin') then
    raise exception 'voter_entitlement_mismatch' using errcode = '42501';
  end if;

  -- Check if already voted
  if exists (select 1 from governance.ballots where vote_id = p_vote_id and eligibility_id = p_eligibility_id) then
    raise exception 'duplicate_vote_rejected' using errcode = '23505';
  end if;

  select * into v_opt from governance.vote_options
  where vote_id = p_vote_id and code = p_choice and tenant_id = v_actor.tenant_id;

  if v_opt.id is null then
    raise exception 'vote_option_not_found' using errcode = '42704';
  end if;

  v_receipt := encode(extensions.digest(p_vote_id::text || ':' || p_eligibility_id::text || ':' || coalesce(p_idempotency_key, gen_random_uuid()::text), 'sha256'), 'hex');

  insert into governance.ballots(
    tenant_id, vote_id, eligibility_id, option_id,
    voting_weight, cast_by, cast_at, receipt_hash,
    choice, source, idempotency_key, represented_party_id
  ) values (
    v_actor.tenant_id, p_vote_id, p_eligibility_id, v_opt.id,
    v_eligibility.voting_weight, v_actor.actor_id, statement_timestamp(), v_receipt,
    p_choice, 'remote', p_idempotency_key, v_eligibility.party_id
  ) returning * into v_ballot;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'cast_vote', 'ballot',
    v_ballot.id,
    case when v_vote.secret_ballot then jsonb_build_object('vote_id', p_vote_id, 'receipt', v_receipt, 'secret_ballot', true)
         else jsonb_build_object('vote_id', p_vote_id, 'eligibility_id', p_eligibility_id, 'choice', p_choice) end,
    statement_timestamp()
  );

  return v_ballot;
end;
$$;

-- 2. Hardened finalize_minutes with extensions in search_path
create or replace function governance.finalize_minutes(
  p_context_id uuid,
  p_meeting_id uuid,
  p_content_json jsonb
)
returns governance.minutes
language plpgsql security definer set search_path=pg_catalog,governance,audit,extensions as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_min governance.minutes;
  v_sha text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.minutes.finalize', true);

  select * into v_meeting from governance.meetings where id = p_meeting_id and tenant_id = v_actor.tenant_id;
  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  v_sha := encode(extensions.digest(p_content_json::text, 'sha256'), 'hex');

  insert into governance.minutes(
    tenant_id, meeting_id, version, content_json,
    sha256, approved_at, approved_by, finalized_at, finalized_by,
    created_at, tenant_visible
  ) values (
    v_actor.tenant_id, p_meeting_id, 1, p_content_json,
    v_sha, statement_timestamp(), v_actor.actor_id, statement_timestamp(), v_actor.actor_id,
    statement_timestamp(), true
  ) returning * into v_min;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'finalize_minutes', 'minutes',
    v_min.id, to_jsonb(v_min), statement_timestamp()
  );

  return v_min;
end;
$$;

-- 3. Hardened create_minutes_correction with extensions in search_path
create or replace function governance.create_minutes_correction(
  p_context_id uuid,
  p_prior_minutes_id uuid,
  p_correction_reason text,
  p_content_json jsonb
)
returns governance.minutes
language plpgsql security definer set search_path=pg_catalog,governance,audit,extensions as $$
declare
  v_actor record;
  v_prior governance.minutes;
  v_new_min governance.minutes;
  v_next_version integer;
  v_sha text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.minutes.finalize', true);

  select * into v_prior from governance.minutes where id = p_prior_minutes_id and tenant_id = v_actor.tenant_id;
  if v_prior.id is null then raise exception 'prior_minutes_not_found' using errcode = '42704'; end if;

  if trim(p_correction_reason) = '' then
    raise exception 'correction_reason_required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from governance.minutes where meeting_id = v_prior.meeting_id and tenant_id = v_actor.tenant_id;

  v_sha := encode(extensions.digest(p_content_json::text, 'sha256'), 'hex');

  insert into governance.minutes(
    tenant_id, meeting_id, version, content_json,
    sha256, approved_at, approved_by, finalized_at, finalized_by,
    prior_version_id, correction_reason, created_at, tenant_visible
  ) values (
    v_actor.tenant_id, v_prior.meeting_id, v_next_version, p_content_json,
    v_sha, statement_timestamp(), v_actor.actor_id, statement_timestamp(), v_actor.actor_id,
    v_prior.id, p_correction_reason, statement_timestamp(), true
  ) returning * into v_new_min;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'create_minutes_correction', 'minutes',
    v_new_min.id, to_jsonb(v_new_min), statement_timestamp()
  );

  return v_new_min;
end;
$$;

-- 4. Routine Grants for authenticated role
grant execute on function governance.create_governance_policy(uuid, uuid, text, text, integer, numeric) to authenticated;
grant execute on function governance.create_meeting(uuid, uuid, text, text, timestamptz, text, text, text, text, timestamptz) to authenticated;
grant execute on function governance.add_agenda_item(uuid, uuid, integer, text, text, text, boolean, numeric, text) to authenticated;
grant execute on function governance.publish_meeting(uuid, uuid) to authenticated;
grant execute on function governance.register_attendance(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function governance.register_proxy(uuid, uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function governance.calculate_quorum(uuid, uuid) to authenticated;
grant execute on function governance.open_meeting(uuid, uuid) to authenticated;
grant execute on function governance.open_ballot(uuid, uuid, text, boolean) to authenticated;
grant execute on function governance.cast_vote(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function governance.close_ballot(uuid, uuid) to authenticated;
grant execute on function governance.adopt_resolution(uuid, uuid, uuid, text, text, text, text, date, numeric, uuid) to authenticated;
grant execute on function governance.complete_meeting(uuid, uuid) to authenticated;
grant execute on function governance.finalize_minutes(uuid, uuid, jsonb) to authenticated;
grant execute on function governance.create_minutes_correction(uuid, uuid, text, jsonb) to authenticated;
grant execute on function governance.resolve_governance_actor(uuid, text, boolean) to authenticated;

revoke all on function governance.create_governance_policy(uuid, uuid, text, text, integer, numeric) from public, anon;
revoke all on function governance.create_meeting(uuid, uuid, text, text, timestamptz, text, text, text, text, timestamptz) from public, anon;
revoke all on function governance.add_agenda_item(uuid, uuid, integer, text, text, text, boolean, numeric, text) from public, anon;
revoke all on function governance.publish_meeting(uuid, uuid) from public, anon;
revoke all on function governance.register_attendance(uuid, uuid, uuid, text, uuid) from public, anon;
revoke all on function governance.register_proxy(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function governance.calculate_quorum(uuid, uuid) from public, anon;
revoke all on function governance.open_meeting(uuid, uuid) from public, anon;
revoke all on function governance.open_ballot(uuid, uuid, text, boolean) from public, anon;
revoke all on function governance.cast_vote(uuid, uuid, uuid, text, text) from public, anon;
revoke all on function governance.close_ballot(uuid, uuid) from public, anon;
revoke all on function governance.adopt_resolution(uuid, uuid, uuid, text, text, text, text, date, numeric, uuid) from public, anon;
revoke all on function governance.complete_meeting(uuid, uuid) from public, anon;
revoke all on function governance.finalize_minutes(uuid, uuid, jsonb) from public, anon;
revoke all on function governance.create_minutes_correction(uuid, uuid, text, jsonb) from public, anon;
revoke all on function governance.resolve_governance_actor(uuid, text, boolean) from public, anon;

commit;
