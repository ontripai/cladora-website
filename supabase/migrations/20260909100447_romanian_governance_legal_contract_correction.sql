begin;

-- ============================================================================
-- CLADORA-P2-GOV-002: Romanian Governance Legal Contract Correction
-- Authoritative Statutory Baseline: Legea nr. 196/2018
-- (Articles 21, 38, 39, 44, 47, 48, 49, 50, 51)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Exact Threshold Kind Enum & Versioned Legal Decision Rules
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'threshold_kind' and n.nspname = 'governance') then
    create type governance.threshold_kind as enum (
      'strict_majority_of_present',
      'absolute_majority_count',
      'fraction_of_denominator',
      'unanimity'
    );
  end if;
end;
$$;

create table if not exists governance.legal_decision_rules (
  id uuid primary key default gen_random_uuid(),
  decision_category text not null,
  version integer not null default 1 check (version > 0),
  legal_basis_article text not null,
  legal_basis_paragraph text not null,
  threshold_kind governance.threshold_kind not null,
  numerator_integer integer,
  denominator_integer integer,
  comparison_operator text not null check (comparison_operator in ('>', '>=', '=')),
  denominator_scope text not null check (
    denominator_scope in (
      'present_votes',
      'association_owner_members',
      'all_condominium_owners',
      'ownership_share'
    )
  ),
  statutory_written_form_express boolean not null default false,
  product_written_evidence_required boolean not null default true,
  directly_affected_owner_consent_required boolean not null default false,
  unanimity_required boolean not null default false,
  permit_or_external_approval_required boolean not null default false,
  voting_basis text not null check (voting_basis in ('unit', 'ownership_share')),
  dominant_owner_cap_applicable boolean not null default false,
  effective_from timestamptz not null default statement_timestamp(),
  effective_to timestamptz,
  legal_review_status text not null default 'CONFIRMED_STATUTORY',
  created_at timestamptz not null default statement_timestamp(),
  constraint uq_decision_category_version unique (decision_category, version),
  constraint chk_effective_range check (effective_to is null or effective_to > effective_from)
);

create index if not exists legal_decision_rules_category_idx on governance.legal_decision_rules(decision_category, effective_from desc);

-- Concurrency-safe rule version non-overlap validation trigger
create or replace function governance.check_rule_version_no_overlap()
returns trigger language plpgsql security definer set search_path=pg_catalog,governance as $$
begin
  if exists (
    select 1 from governance.legal_decision_rules r
    where r.decision_category = new.decision_category
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and tstzrange(r.effective_from, coalesce(r.effective_to, 'infinity'::timestamptz), '[)') &&
          tstzrange(new.effective_from, coalesce(new.effective_to, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'overlapping_legal_decision_rule_validity_window' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_rule_version_no_overlap on governance.legal_decision_rules;
create trigger trg_check_rule_version_no_overlap
before insert or update on governance.legal_decision_rules
for each row execute function governance.check_rule_version_no_overlap();

-- ----------------------------------------------------------------------------
-- 2. Seed Initial Statutory Legal Decision Rules (Version 1)
-- ----------------------------------------------------------------------------

insert into governance.legal_decision_rules (
  decision_category, version, legal_basis_article, legal_basis_paragraph,
  threshold_kind, numerator_integer, denominator_integer, comparison_operator,
  denominator_scope, statutory_written_form_express, product_written_evidence_required,
  directly_affected_owner_consent_required, unanimity_required, permit_or_external_approval_required,
  voting_basis, dominant_owner_cap_applicable, effective_from, effective_to, legal_review_status
) values
  (
    'ordinary_resolution', 1, 'Art. 49', 'alin. (1)-(4)',
    'strict_majority_of_present', 1, 2, '>',
    'present_votes', false, false,
    false, false, false,
    'unit', false, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  ),
  (
    'statute_or_association_agreement_change', 1, 'Art. 21', 'alin. (1)',
    'absolute_majority_count', 1, 2, '>=',
    'all_condominium_owners', false, true,
    false, false, false,
    'unit', false, '2026-09-09 00:00:00+00', null, 'LEGAL_REVIEW_REQUIRED'
  ),
  (
    'third_party_use_of_common_parts', 1, 'Art. 38', 'alin. (2)',
    'fraction_of_denominator', 2, 3, '>=',
    'all_condominium_owners', false, true,
    true, false, false,
    'unit', false, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  ),
  (
    'structural_or_special_common_part_change', 1, 'Art. 39', 'alin. (1)',
    'fraction_of_denominator', 2, 3, '>=',
    'association_owner_members', false, true,
    true, false, true,
    'unit', false, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  ),
  (
    'termination_of_common_use', 1, 'Art. 44', 'alin. (1)',
    'unanimity', 1, 1, '=',
    'all_condominium_owners', false, true,
    false, true, true,
    'unit', false, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  ),
  (
    'condominium_modernization', 1, 'Art. 51', 'alin. (1)',
    'fraction_of_denominator', 2, 3, '>=',
    'all_condominium_owners', false, true,
    false, false, false,
    'unit', false, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  ),
  (
    'consolidation_rehabilitation_modernization_fund', 1, 'Art. 49', 'alin. (3) lit. b, c',
    'strict_majority_of_present', 1, 2, '>',
    'ownership_share', false, false,
    false, false, false,
    'ownership_share', true, '2026-09-09 00:00:00+00', null, 'CONFIRMED_STATUTORY'
  )
on conflict (decision_category, version) do update set
  legal_basis_article = excluded.legal_basis_article,
  legal_basis_paragraph = excluded.legal_basis_paragraph,
  threshold_kind = excluded.threshold_kind,
  numerator_integer = excluded.numerator_integer,
  denominator_integer = excluded.denominator_integer,
  comparison_operator = excluded.comparison_operator,
  denominator_scope = excluded.denominator_scope,
  statutory_written_form_express = excluded.statutory_written_form_express,
  product_written_evidence_required = excluded.product_written_evidence_required,
  directly_affected_owner_consent_required = excluded.directly_affected_owner_consent_required,
  unanimity_required = excluded.unanimity_required,
  permit_or_external_approval_required = excluded.permit_or_external_approval_required,
  voting_basis = excluded.voting_basis,
  dominant_owner_cap_applicable = excluded.dominant_owner_cap_applicable,
  legal_review_status = excluded.legal_review_status;

-- ----------------------------------------------------------------------------
-- 3. Statutory Officers & Relationship Modeling (Decoupled from Application Roles)
-- ----------------------------------------------------------------------------

create table if not exists governance.statutory_officers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  office_type text not null check (office_type in ('legal_president', 'legal_committee_member', 'legal_administrator', 'legal_censor')),
  party_id uuid not null references portfolio.parties(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  term_start timestamptz not null default statement_timestamp(),
  term_end timestamptz,
  status text not null default 'active' check (status in ('active', 'resigned', 'revoked', 'expired')),
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists statutory_officers_lookup_idx on governance.statutory_officers(tenant_id, property_id, office_type, status);
create index if not exists statutory_officers_tenant_id_idx on governance.statutory_officers(tenant_id);
create index if not exists statutory_officers_property_id_idx on governance.statutory_officers(property_id);
create index if not exists statutory_officers_party_id_idx on governance.statutory_officers(party_id);
create index if not exists statutory_officers_user_id_idx on governance.statutory_officers(user_id);

create table if not exists governance.statutory_officer_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  officer_id uuid not null references governance.statutory_officers(id) on delete cascade,
  related_party_id uuid not null references portfolio.parties(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('spouse', 'child', 'parent', 'family_member')),
  evidence_reference text,
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  verification_status text not null default 'pending_verification' check (verification_status in ('pending_verification', 'verified', 'rejected')),
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists statutory_relationships_lookup_idx on governance.statutory_officer_relationships(tenant_id, officer_id, related_party_id);
create index if not exists statutory_relationships_tenant_id_idx on governance.statutory_officer_relationships(tenant_id);
create index if not exists statutory_relationships_officer_id_idx on governance.statutory_officer_relationships(officer_id);
create index if not exists statutory_relationships_related_party_id_idx on governance.statutory_officer_relationships(related_party_id);

-- Consistency trigger ensuring statutory officers match property & party tenant
create or replace function governance.check_statutory_officer_tenant_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog,portfolio as $$
declare
  v_prop_tenant uuid;
  v_party_tenant uuid;
begin
  select tenant_id into v_prop_tenant from portfolio.properties where id = new.property_id;
  select tenant_id into v_party_tenant from portfolio.parties where id = new.party_id;
  if v_prop_tenant <> new.tenant_id or v_party_tenant <> new.tenant_id then
    raise exception 'cross_tenant_officer_reference_rejected' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_statutory_officer_tenant_integrity on governance.statutory_officers;
create trigger trg_statutory_officer_tenant_integrity
before insert or update on governance.statutory_officers
for each row execute function governance.check_statutory_officer_tenant_integrity();

-- ----------------------------------------------------------------------------
-- 4. Immutable Motion Electorate Snapshots Table
-- ----------------------------------------------------------------------------

create table if not exists governance.motion_electorate_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  agenda_item_id uuid not null references governance.agenda_items(id) on delete restrict unique,
  meeting_id uuid not null references governance.meetings(id) on delete restrict,
  legal_decision_rule_id uuid not null references governance.legal_decision_rules(id) on delete restrict,
  legal_decision_rule_snapshot jsonb not null,
  all_condominium_owners_count integer not null,
  association_owner_members_count integer not null,
  present_eligible_members_count integer not null,
  total_condominium_units integer not null,
  total_ownership_shares numeric(20, 10) not null,
  all_condominium_owners jsonb not null,
  association_owner_members jsonb not null,
  present_eligible_members jsonb not null,
  property_units_per_owner jsonb not null,
  ownership_shares jsonb not null,
  directly_affected_owners jsonb not null default '[]'::jsonb,
  conflicted_excluded_voters jsonb not null default '[]'::jsonb,
  active_proxies jsonb not null default '{}'::jsonb,
  statutory_officers_snapshot jsonb not null default '[]'::jsonb,
  snapshot_checksum text not null,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists motion_snapshots_meeting_idx on governance.motion_electorate_snapshots(meeting_id);
create index if not exists motion_snapshots_agenda_idx on governance.motion_electorate_snapshots(agenda_item_id);
create index if not exists motion_snapshots_tenant_id_idx on governance.motion_electorate_snapshots(tenant_id);
create index if not exists motion_snapshots_rule_id_idx on governance.motion_electorate_snapshots(legal_decision_rule_id);

-- ----------------------------------------------------------------------------
-- 5. Minutes Attendee Signature Register Table (Art. 49(5))
-- ----------------------------------------------------------------------------

create table if not exists governance.minutes_attendee_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict,
  party_id uuid not null references portfolio.parties(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  signature_type text not null check (signature_type in ('present_member', 'censor')),
  signed_at timestamptz,
  signature_status text not null default 'pending' check (signature_status in ('pending', 'signed', 'refused')),
  signature_evidence_ref text,
  created_at timestamptz not null default statement_timestamp(),
  constraint uq_meeting_party_signature unique (meeting_id, party_id)
);

create index if not exists minutes_signatures_meeting_idx on governance.minutes_attendee_signatures(meeting_id, signature_status);
create index if not exists minutes_signatures_tenant_id_idx on governance.minutes_attendee_signatures(tenant_id);
create index if not exists minutes_signatures_party_id_idx on governance.minutes_attendee_signatures(party_id);
create index if not exists minutes_signatures_user_id_idx on governance.minutes_attendee_signatures(user_id);

-- ----------------------------------------------------------------------------
-- 6. Table Extensions (Meetings, Agenda, Votes, Ballots, Minutes)
-- ----------------------------------------------------------------------------

alter table governance.meetings
  add column if not exists reconvened_notice_at timestamptz,
  add column if not exists proof_of_complete_notice boolean not null default false,
  add column if not exists notice_proof_reference text,
  add column if not exists elected_secretary_party_id uuid references portfolio.parties(id) on delete restrict,
  add column if not exists elected_secretary_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists elected_secretary_name text,
  add column if not exists secretary_elected_at timestamptz,
  add column if not exists noticeboard_copy_dated_at timestamptz,
  add column if not exists publication_deadline_at timestamptz,
  add column if not exists conservative_notice_compliance_policy text not null default 'PRODUCT-CONSERVATIVE-COMPLIANCE-POLICY / LEGAL-REVIEW-REQUIRED';

create index if not exists meetings_elected_secretary_party_id_idx on governance.meetings(elected_secretary_party_id);
create index if not exists meetings_elected_secretary_user_id_idx on governance.meetings(elected_secretary_user_id);

alter table governance.agenda_items
  add column if not exists legal_decision_rule_id uuid references governance.legal_decision_rules(id) on delete restrict,
  add column if not exists decision_category text,
  add column if not exists affected_owner_consents_collected boolean not null default false,
  add column if not exists affected_owner_parties jsonb not null default '[]'::jsonb,
  add column if not exists required_permit_reference text,
  add column if not exists legal_decision_rule_snapshot jsonb,
  add column if not exists bylaw_custom_threshold jsonb;

create index if not exists agenda_items_legal_decision_rule_id_idx on governance.agenda_items(legal_decision_rule_id);

alter table governance.votes
  add column if not exists dominant_owner_capped boolean not null default false,
  add column if not exists dominant_owner_party_id uuid references portfolio.parties(id) on delete restrict,
  add column if not exists original_dominant_share numeric(20, 10),
  add column if not exists capped_dominant_weight numeric(20, 10),
  add column if not exists president_tie_breaker_applied boolean not null default false,
  add column if not exists president_vote_choice text,
  add column if not exists excluded_voter_parties jsonb not null default '[]'::jsonb;

create index if not exists votes_dominant_owner_party_id_idx on governance.votes(dominant_owner_party_id);

alter table governance.ballots
  add column if not exists effective_voting_weight numeric(20, 10),
  add column if not exists conflict_of_interest_excluded boolean not null default false;

alter table governance.minutes
  add column if not exists elected_secretary_party_id uuid references portfolio.parties(id) on delete restrict,
  add column if not exists elected_secretary_name text,
  add column if not exists censor_signed_at timestamptz,
  add column if not exists all_attendees_signed boolean not null default false,
  add column if not exists noticeboard_photocopy_displayed_at timestamptz,
  add column if not exists publication_deadline_at timestamptz,
  add column if not exists recorded_during_meeting boolean not null default true;

create index if not exists minutes_elected_secretary_party_id_idx on governance.minutes(elected_secretary_party_id);

-- Enable RLS on newly created tables
alter table governance.legal_decision_rules enable row level security;
alter table governance.statutory_officers enable row level security;
alter table governance.statutory_officer_relationships enable row level security;
alter table governance.motion_electorate_snapshots enable row level security;
alter table governance.minutes_attendee_signatures enable row level security;

-- Internal tables: Revoke direct table access from PUBLIC, anon and authenticated
revoke all on governance.legal_decision_rules from public, anon, authenticated;
revoke all on governance.statutory_officers from public, anon, authenticated;
revoke all on governance.statutory_officer_relationships from public, anon, authenticated;
revoke all on governance.motion_electorate_snapshots from public, anon, authenticated;
revoke all on governance.minutes_attendee_signatures from public, anon, authenticated;

grant select on governance.legal_decision_rules to authenticated;
grant all on governance.legal_decision_rules to service_role;
grant all on governance.statutory_officers to service_role;
grant all on governance.statutory_officer_relationships to service_role;
grant all on governance.motion_electorate_snapshots to service_role;
grant all on governance.minutes_attendee_signatures to service_role;

-- ----------------------------------------------------------------------------
-- 7. Hardened Domain Routines (Legal Notice, Quorum, Proxy, Votes, Minutes)
-- ----------------------------------------------------------------------------

-- A. publish_meeting with conservative statutory full-day check and reconvened rules
create or replace function governance.publish_meeting(
  p_context_id uuid,
  p_meeting_id uuid
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit,extensions as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_policy governance.governance_policies;
  v_parent governance.meetings;
  v_tz text;
  v_now_in_tz date;
  v_sched_in_tz date;
  v_full_days integer;
  v_own record;
  v_weight numeric;
  v_total_units numeric;
  v_electorate_count integer := 0;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id
  for update;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  if v_meeting.status <> 'draft' then
    raise exception 'meeting_must_be_draft_to_publish' using errcode = '42501';
  end if;

  if not exists (select 1 from governance.agenda_items where meeting_id = v_meeting.id) then
    raise exception 'meeting_requires_agenda_to_publish' using errcode = '22023';
  end if;

  select * into v_policy from governance.governance_policies where id = v_meeting.policy_id;
  v_tz := coalesce(v_meeting.timezone, v_policy.timezone, 'Europe/Bucharest');

  -- Conservative calendar day calculation under statutory timezone
  v_now_in_tz := (statement_timestamp() at time zone v_tz)::date;
  v_sched_in_tz := (v_meeting.scheduled_at at time zone v_tz)::date;
  v_full_days := v_sched_in_tz - v_now_in_tz;

  if coalesce(v_meeting.first_call, true) then
    if v_meeting.meeting_type = 'general_assembly' then
      -- Ordinary General Assembly: Art. 47 alin. (4) requires >= 10 full days
      if v_full_days < 10 then
        raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
      end if;
    elsif v_meeting.meeting_type = 'extraordinary_general_assembly' then
      -- Extraordinary General Assembly: Art. 47 alin. (4) requires >= 3 full days
      if v_full_days < 3 then
        raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
      end if;
    else
      if v_full_days < 3 then
        raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
      end if;
    end if;
  else
    -- Reconvened General Assembly: Art. 47(4) notice >= 3 full days; Art. 48(2) scheduled <= 15 days from Call 1
    if v_meeting.parent_meeting_id is null then
      raise exception 'reconvened_meeting_requires_parent_call' using errcode = '22023';
    end if;

    select * into v_parent from governance.meetings where id = v_meeting.parent_meeting_id;
    if v_parent.id is null then
      raise exception 'parent_call_meeting_not_found' using errcode = '42704';
    end if;

    -- Notice timestamp must not precede the Call 1 event/failure
    if statement_timestamp() < coalesce(v_parent.closed_at, v_parent.scheduled_at) then
      raise exception 'reconvened_notice_cannot_precede_call1' using errcode = '22023';
    end if;

    -- Maximum 15 calendar days from the date of the first call (Art. 48 alin. (2))
    if v_meeting.scheduled_at > v_parent.scheduled_at + interval '15 days' then
      raise exception 'reconvened_meeting_exceeds_statutory_limit' using errcode = '22023';
    end if;

    -- Independent notice >= 3 full days
    if v_full_days < 3 then
      raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
    end if;
  end if;

  -- Create eligibility snapshots
  select count(distinct u.id) into v_total_units
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where b.property_id = v_meeting.property_id and u.tenant_id = v_meeting.tenant_id;

  for v_own in
    select o.id as ownership_id, o.unit_id, o.party_id, o.share
    from portfolio.ownerships o
    join portfolio.units u on u.id = o.unit_id
    join portfolio.buildings b on b.id = u.building_id
    where b.property_id = v_meeting.property_id
      and o.tenant_id = v_meeting.tenant_id
      and o.valid_from <= current_date
      and (o.valid_to is null or o.valid_to > current_date)
  loop
    v_weight := case
      when v_policy.voting_basis = 'unit' then 1.00000000
      else v_own.share
    end;

    insert into governance.eligibility_snapshots(
      tenant_id, meeting_id, unit_id, party_id, ownership_share,
      voting_weight, eligible, snapshot_json, source_ownership_id, created_at
    ) values (
      v_meeting.tenant_id, v_meeting.id, v_own.unit_id, v_own.party_id,
      v_own.share, v_weight, true,
      jsonb_build_object(
        'ownership_id', v_own.ownership_id,
        'basis', v_policy.voting_basis,
        'frozen_at', statement_timestamp(),
        'statutory_policy', 'PRODUCT-CONSERVATIVE-COMPLIANCE-POLICY / LEGAL-REVIEW-REQUIRED'
      ),
      v_own.ownership_id, statement_timestamp()
    ) on conflict (meeting_id, unit_id, party_id) do nothing;

    v_electorate_count := v_electorate_count + 1;
  end loop;

  update governance.meetings
  set status = 'announced',
      announced_at = statement_timestamp(),
      published_by = v_actor.actor_id,
      published_at = statement_timestamp(),
      reconvened_notice_at = case when not coalesce(v_meeting.first_call, true) then statement_timestamp() else null end,
      publication_deadline_at = (v_meeting.scheduled_at at time zone v_tz)::date + integer '7',
      tenant_visible = true,
      updated_at = statement_timestamp()
  where id = v_meeting.id
  returning * into v_meeting;

  insert into governance.meeting_history(
    tenant_id, meeting_id, event_type, status_from, status_to, reason, rule_version, occurred_at
  ) values (
    v_actor.tenant_id, v_meeting.id, 'meeting_published', 'draft', 'announced',
    'Meeting published with ' || v_electorate_count || ' eligible voter units snapshotted', 1, statement_timestamp()
  );

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'publish_meeting', 'meeting',
    v_meeting.id, to_jsonb(v_meeting), statement_timestamp()
  );

  return v_meeting;
end;
$$;

-- B. calculate_quorum strictly by distinct member party count
create or replace function governance.calculate_quorum(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,governance,portfolio as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_total_members integer := 0;
  v_present_members integer := 0;
  v_required_quorum integer := 0;
  v_quorum_met boolean := false;
  v_is_reconvened boolean := false;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.read', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  v_is_reconvened := not coalesce(v_meeting.first_call, true);

  -- Count distinct registered owner members for this property
  select count(distinct e.party_id) into v_total_members
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  -- Count distinct members present either in person or via active verified proxy
  select count(distinct e.party_id) into v_present_members
  from governance.eligibility_snapshots e
  join governance.attendance a on a.meeting_id = v_meeting.id and a.eligibility_id = e.id
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  -- Statutory first-call quorum: floor(N / 2) + 1 (Legea 196/2018 Art. 48 alin. (1))
  v_required_quorum := floor(v_total_members / 2) + 1;

  if v_is_reconvened then
    -- Art. 48 alin. (3): Decisions valid with present members ONLY if complete statutory notice is proven
    if not v_meeting.proof_of_complete_notice then
      v_quorum_met := false;
    else
      v_quorum_met := (v_present_members > 0);
    end if;
  else
    v_quorum_met := (v_total_members > 0 and v_present_members >= v_required_quorum);
  end if;

  return jsonb_build_object(
    'meeting_id', v_meeting.id,
    'first_call', v_meeting.first_call,
    'total_members', v_total_members,
    'present_members', v_present_members,
    'required_quorum', v_required_quorum,
    'quorum_met', v_quorum_met,
    'proof_of_complete_notice', v_meeting.proof_of_complete_notice,
    'calculated_at', statement_timestamp()
  );
end;
$$;

-- C. register_proxy enforcing Art. 49(3)(f) prohibited statutory officers & family members
create or replace function governance.register_proxy(
  p_context_id uuid,
  p_meeting_id uuid,
  p_eligibility_id uuid,
  p_representative_party_id uuid,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns governance.proxies
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_eligibility governance.eligibility_snapshots;
  v_active_proxies integer;
  v_proxy governance.proxies;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.proxies.manage', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  select * into v_eligibility from governance.eligibility_snapshots
  where id = p_eligibility_id and meeting_id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_eligibility.id is null or not v_eligibility.eligible then
    raise exception 'ineligible_entitlement' using errcode = '42501';
  end if;

  if v_eligibility.party_id = p_representative_party_id then
    raise exception 'grantor_and_representative_must_differ' using errcode = '22023';
  end if;

  -- Statutory Prohibition Art. 49 alin. (3) lit. f:
  -- President, executive committee, administrator, censor cannot receive proxy
  if exists (
    select 1 from governance.statutory_officers o
    where o.tenant_id = v_actor.tenant_id
      and o.property_id = v_meeting.property_id
      and o.party_id = p_representative_party_id
      and o.status = 'active'
      and o.office_type in ('legal_president', 'legal_committee_member', 'legal_administrator', 'legal_censor')
      and (o.term_end is null or o.term_end > statement_timestamp())
  ) then
    raise exception 'proxy_representative_prohibited_actor' using errcode = '42501';
  end if;

  -- Family members of statutory officers prohibited:
  -- Fail-closed on both 'verified' and 'pending_verification' relationships
  if exists (
    select 1 from governance.statutory_officer_relationships r
    join governance.statutory_officers o on o.id = r.officer_id
    where r.tenant_id = v_actor.tenant_id
      and o.property_id = v_meeting.property_id
      and r.related_party_id = p_representative_party_id
      and o.status = 'active'
      and r.verification_status in ('verified', 'pending_verification')
      and (r.valid_until is null or r.valid_until > statement_timestamp())
  ) then
    raise exception 'proxy_representative_prohibited_actor' using errcode = '42501';
  end if;

  -- Statutory limit: Legea 196/2018 Art. 47 / Art. 49 alin. (3) lit. e: At most 1 absent member represented
  select count(*) into v_active_proxies
  from governance.proxies
  where meeting_id = p_meeting_id
    and representative_party_id = p_representative_party_id
    and status = 'active';

  if v_active_proxies >= 1 then
    raise exception 'proxy_representative_limit_exceeded' using errcode = '22023';
  end if;

  insert into governance.proxies(
    tenant_id, meeting_id, eligibility_id, grantor_party_id,
    representative_party_id, valid_from, valid_until, status,
    verification_status, verified_by, verified_at, created_at
  ) values (
    v_actor.tenant_id, p_meeting_id, p_eligibility_id, v_eligibility.party_id,
    p_representative_party_id, p_valid_from, p_valid_until, 'active',
    'verified', v_actor.actor_id, statement_timestamp(), statement_timestamp()
  ) returning * into v_proxy;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'register_proxy', 'proxy',
    v_proxy.id, to_jsonb(v_proxy), statement_timestamp()
  );

  return v_proxy;
end;
$$;

-- D. open_ballot capturing immutable motion electorate snapshot & dynamic dominant owner formula
create or replace function governance.open_ballot(
  p_context_id uuid,
  p_agenda_item_id uuid,
  p_question text,
  p_secret_ballot boolean default false
)
returns governance.votes
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit,extensions as $$
declare
  v_actor record;
  v_agenda governance.agenda_items;
  v_meeting governance.meetings;
  v_rule governance.legal_decision_rules;
  v_vote governance.votes;
  v_all_owners jsonb;
  v_assoc_members jsonb;
  v_present_members jsonb;
  v_units_per_owner jsonb;
  v_shares jsonb;
  v_conflicted jsonb := '[]'::jsonb;
  v_officers jsonb := '[]'::jsonb;
  v_proxies jsonb := '{}'::jsonb;
  v_total_units integer := 0;
  v_total_shares numeric(20, 10) := 0;
  v_dominant_owner uuid := null;
  v_dom_share numeric(20, 10) := 0;
  v_sum_other_shares numeric(20, 10) := 0;
  v_dominant_capped boolean := false;
  v_effective_dom_weight numeric(20, 10) := null;
  v_checksum text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.administer', true);

  select * into v_agenda from governance.agenda_items where id = p_agenda_item_id and tenant_id = v_actor.tenant_id;
  if v_agenda.id is null then raise exception 'agenda_item_not_found' using errcode = '42704'; end if;

  select * into v_meeting from governance.meetings where id = v_agenda.meeting_id and tenant_id = v_actor.tenant_id for update;
  if v_meeting.status <> 'open' then raise exception 'meeting_must_be_open_to_open_ballot' using errcode = '42501'; end if;

  -- Resolve active Legal Decision Rule
  if v_agenda.legal_decision_rule_id is not null then
    select * into v_rule from governance.legal_decision_rules where id = v_agenda.legal_decision_rule_id;
  elsif v_agenda.decision_category is not null then
    select * into v_rule from governance.legal_decision_rules
    where decision_category = v_agenda.decision_category
      and effective_from <= statement_timestamp()
      and (effective_to is null or effective_to > statement_timestamp())
    order by version desc limit 1;
  else
    select * into v_rule from governance.legal_decision_rules
    where decision_category = 'ordinary_resolution'
      and effective_from <= statement_timestamp()
      and (effective_to is null or effective_to > statement_timestamp())
    order by version desc limit 1;
  end if;

  if v_rule.id is null then
    raise exception 'legal_decision_rule_unconfigured' using errcode = 'P0001';
  end if;

  -- Build immutable snapshot elements
  select coalesce(jsonb_agg(distinct e.party_id), '[]'::jsonb) into v_all_owners
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  v_assoc_members := v_all_owners;

  select coalesce(jsonb_agg(distinct e.party_id), '[]'::jsonb) into v_present_members
  from governance.eligibility_snapshots e
  join governance.attendance a on a.meeting_id = v_meeting.id and a.eligibility_id = e.id
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  select coalesce(jsonb_object_agg(e.party_id, count(distinct e.unit_id)), '{}'::jsonb) into v_units_per_owner
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
  group by e.party_id;

  select coalesce(jsonb_object_agg(e.party_id, sum(e.ownership_share)), '{}'::jsonb) into v_shares
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
  group by e.party_id;

  select count(distinct e.unit_id), coalesce(sum(e.ownership_share), 0)
  into v_total_units, v_total_shares
  from governance.eligibility_snapshots e
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible;

  -- Active proxies mapping
  select coalesce(jsonb_object_agg(p.grantor_party_id, p.representative_party_id), '{}'::jsonb) into v_proxies
  from governance.proxies p
  where p.meeting_id = v_meeting.id and p.status = 'active';

  -- Statutory officers snapshot
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'office', o.office_type, 'party_id', o.party_id)), '[]'::jsonb) into v_officers
  from governance.statutory_officers o
  where o.property_id = v_meeting.property_id and o.status = 'active';

  -- Evaluate Administrator Conflict of Interest: Art. 49 alin. (3) lit. h
  -- Administrator & family have no voting right on administrator matters
  if v_agenda.decision_category in ('administrator_discharge', 'administrator_remuneration', 'administrator_contract', 'administrator_performance') then
    select coalesce(jsonb_agg(distinct p_id), '[]'::jsonb) into v_conflicted
    from (
      select o.party_id as p_id from governance.statutory_officers o
      where o.property_id = v_meeting.property_id and o.office_type = 'legal_administrator' and o.status = 'active'
      union
      select r.related_party_id as p_id from governance.statutory_officer_relationships r
      join governance.statutory_officers o on o.id = r.officer_id
      where o.property_id = v_meeting.property_id and o.office_type = 'legal_administrator'
        and r.verification_status in ('verified', 'pending_verification')
    ) sub;
  end if;

  -- Evaluate Dynamic Dominant Owner Formula: Art. 49 alin. (3) lit. c
  if v_rule.dominant_owner_cap_applicable and v_rule.voting_basis = 'ownership_share' then
    select e.party_id, sum(e.ownership_share) into v_dominant_owner, v_dom_share
    from governance.eligibility_snapshots e
    where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
    group by e.party_id
    having sum(e.ownership_share) > (v_total_shares / 2.0)
    limit 1;

    if v_dominant_owner is not null then
      v_sum_other_shares := v_total_shares - v_dom_share;
      v_dominant_capped := true;
      v_effective_dom_weight := v_sum_other_shares;
    end if;
  end if;

  v_checksum := encode(extensions.digest(
    p_agenda_item_id::text || ':' || v_total_units::text || ':' || v_total_shares::text || ':' || v_rule.id::text,
    'sha256'
  ), 'hex');

  -- Create immutable motion electorate snapshot
  insert into governance.motion_electorate_snapshots(
    tenant_id, agenda_item_id, meeting_id, legal_decision_rule_id,
    legal_decision_rule_snapshot, all_condominium_owners_count, association_owner_members_count,
    present_eligible_members_count, total_condominium_units, total_ownership_shares,
    all_condominium_owners, association_owner_members, present_eligible_members,
    property_units_per_owner, ownership_shares, directly_affected_owners,
    conflicted_excluded_voters, active_proxies, statutory_officers_snapshot,
    snapshot_checksum, created_at
  ) values (
    v_actor.tenant_id, p_agenda_item_id, v_meeting.id, v_rule.id,
    to_jsonb(v_rule), jsonb_array_length(v_all_owners), jsonb_array_length(v_assoc_members),
    jsonb_array_length(v_present_members), v_total_units, v_total_shares,
    v_all_owners, v_assoc_members, v_present_members,
    v_units_per_owner, v_shares, v_agenda.affected_owner_parties,
    v_conflicted, v_proxies, v_officers,
    v_checksum, statement_timestamp()
  ) on conflict (agenda_item_id) do nothing;

  -- Create vote
  insert into governance.votes(
    tenant_id, meeting_id, agenda_item_id, question,
    status, voting_method, opens_at, secret_ballot, rule_version,
    voting_basis, dominant_owner_capped, dominant_owner_party_id,
    original_dominant_share, capped_dominant_weight, excluded_voter_parties, created_at
  ) values (
    v_actor.tenant_id, v_meeting.id, v_agenda.id, p_question,
    'open', case when v_rule.voting_basis = 'unit' then 'simple' else 'weighted' end,
    statement_timestamp(), p_secret_ballot, v_rule.version,
    v_rule.voting_basis, v_dominant_capped, v_dominant_owner,
    case when v_dominant_capped then v_dom_share else null end,
    case when v_dominant_capped then v_effective_dom_weight else null end,
    v_conflicted, statement_timestamp()
  ) returning * into v_vote;

  -- Create vote options
  insert into governance.vote_options(tenant_id, vote_id, code, label, sequence_no)
  values
    (v_actor.tenant_id, v_vote.id, 'for', 'Pentru (For)', 1),
    (v_actor.tenant_id, v_vote.id, 'against', 'Împotrivă (Against)', 2),
    (v_actor.tenant_id, v_vote.id, 'abstain', 'Abținere (Abstain)', 3);

  return v_vote;
end;
$$;

-- E. cast_vote with conflict-of-interest enforcement & dynamic dominant weight
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
  v_effective_weight numeric(20, 10);
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

  -- Verify Administrator Conflict of Interest: Art. 49 alin. (3) lit. h
  if v_vote.excluded_voter_parties ? v_eligibility.party_id::text then
    raise exception 'administrator_conflict_of_interest_voting_denied' using errcode = '42501';
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

  -- Prevent duplicate vote
  if exists (select 1 from governance.ballots where vote_id = p_vote_id and eligibility_id = p_eligibility_id) then
    raise exception 'duplicate_vote_rejected' using errcode = '23505';
  end if;

  select * into v_opt from governance.vote_options
  where vote_id = p_vote_id and code = p_choice and tenant_id = v_actor.tenant_id;

  if v_opt.id is null then
    raise exception 'vote_option_not_found' using errcode = '42704';
  end if;

  -- Determine effective voting weight
  if v_vote.voting_basis = 'unit' then
    v_effective_weight := 1.00000000;
  elsif v_vote.dominant_owner_capped and v_vote.dominant_owner_party_id = v_eligibility.party_id then
    v_effective_weight := v_vote.capped_dominant_weight;
  else
    v_effective_weight := v_eligibility.ownership_share;
  end if;

  v_receipt := encode(extensions.digest(p_vote_id::text || ':' || p_eligibility_id::text || ':' || coalesce(p_idempotency_key, gen_random_uuid()::text), 'sha256'), 'hex');

  insert into governance.ballots(
    tenant_id, vote_id, eligibility_id, option_id,
    voting_weight, effective_voting_weight, cast_by, cast_at, receipt_hash,
    choice, source, idempotency_key, represented_party_id
  ) values (
    v_actor.tenant_id, p_vote_id, p_eligibility_id, v_opt.id,
    v_effective_weight, v_effective_weight, v_actor.actor_id, statement_timestamp(), v_receipt,
    p_choice, 'remote', p_idempotency_key, v_eligibility.party_id
  ) returning * into v_ballot;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'cast_vote', 'ballot',
    v_ballot.id,
    case when v_vote.secret_ballot then jsonb_build_object('vote_id', p_vote_id, 'receipt', v_receipt, 'secret_ballot', true)
         else jsonb_build_object('vote_id', p_vote_id, 'eligibility_id', p_eligibility_id, 'choice', p_choice, 'weight', v_effective_weight) end,
    statement_timestamp()
  );

  return v_ballot;
end;
$$;

-- F. adopt_resolution with exact integer arithmetic & tie breaking
create or replace function governance.adopt_resolution(
  p_context_id uuid,
  p_meeting_id uuid,
  p_agenda_item_id uuid,
  p_resolution_no text,
  p_title text,
  p_text_body text,
  p_responsible_actor text default null,
  p_due_date date default null,
  p_financial_impact numeric default null,
  p_maintenance_work_order_id uuid default null
)
returns governance.resolutions
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_vote governance.votes;
  v_snapshot governance.motion_electorate_snapshots;
  v_rule governance.legal_decision_rules;
  v_pres_officer governance.statutory_officers;
  v_pres_choice text := null;
  v_pres_tie_break boolean := false;
  v_for numeric := 0;
  v_against numeric := 0;
  v_abstain numeric := 0;
  v_cast numeric := 0;
  v_denominator_total numeric := 0;
  v_adopted boolean := false;
  v_res governance.resolutions;
  v_result jsonb;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.resolutions.manage', true);

  select * into v_meeting from governance.meetings where id = p_meeting_id and tenant_id = v_actor.tenant_id;
  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  select * into v_vote from governance.votes where agenda_item_id = p_agenda_item_id and tenant_id = v_actor.tenant_id;
  if v_vote.id is null or v_vote.status <> 'closed' then
    raise exception 'resolution_requires_closed_vote' using errcode = '42501';
  end if;

  select * into v_snapshot from governance.motion_electorate_snapshots where agenda_item_id = p_agenda_item_id;
  if v_snapshot.id is null then
    raise exception 'motion_snapshot_not_found' using errcode = '42704';
  end if;

  select * into v_rule from governance.legal_decision_rules where id = v_snapshot.legal_decision_rule_id;
  if v_rule.id is null then
    raise exception 'legal_decision_rule_unconfigured' using errcode = 'P0001';
  end if;

  -- Check directly affected owner consents if required
  if v_rule.directly_affected_owner_consent_required then
    if not exists (select 1 from governance.agenda_items where id = p_agenda_item_id and affected_owner_consents_collected) then
      raise exception 'missing_affected_owner_consent' using errcode = '42501';
    end if;
  end if;

  -- Check building/cadastral permit if required
  if v_rule.permit_or_external_approval_required then
    if not exists (select 1 from governance.agenda_items where id = p_agenda_item_id and required_permit_reference is not null) then
      raise exception 'missing_required_permit_approval' using errcode = '42501';
    end if;
  end if;

  v_for := coalesce(v_vote.for_weight, 0);
  v_against := coalesce(v_vote.against_weight, 0);
  v_abstain := coalesce(v_vote.abstain_weight, 0);
  v_cast := coalesce(v_vote.cast_weight, 0);

  -- Evaluate threshold using exact integer arithmetic based on threshold_kind
  if v_rule.threshold_kind = 'strict_majority_of_present' then
    if v_for > v_against then
      v_adopted := true;
    elsif v_for = v_against and v_for > 0 then
      -- Genuine tie: check President's vote per Art. 49 alin. (3) lit. g
      select o.* into v_pres_officer from governance.statutory_officers o
      where o.property_id = v_meeting.property_id and o.office_type = 'legal_president' and o.status = 'active'
      limit 1;

      if v_pres_officer.id is not null then
        select b.choice into v_pres_choice
        from governance.ballots b
        join governance.eligibility_snapshots e on e.id = b.eligibility_id
        where b.vote_id = v_vote.id and e.party_id = v_pres_officer.party_id
        limit 1;

        if v_pres_choice = 'for' then
          v_adopted := true;
          v_pres_tie_break := true;
        elsif v_pres_choice = 'against' then
          v_adopted := false;
          v_pres_tie_break := true;
        else
          v_adopted := false;
        end if;
      else
        v_adopted := false;
      end if;
    else
      v_adopted := false;
    end if;

  elsif v_rule.threshold_kind = 'absolute_majority_count' then
    -- floor(all_condominium_owners / 2) + 1 (Art. 21)
    v_denominator_total := v_snapshot.all_condominium_owners_count;
    v_adopted := (v_for >= floor(v_denominator_total / 2) + 1);

  elsif v_rule.threshold_kind = 'fraction_of_denominator' then
    -- Exact integer fraction: (votes * denominator_integer) >= (total * numerator_integer)
    v_denominator_total := case
      when v_rule.denominator_scope = 'all_condominium_owners' then v_snapshot.all_condominium_owners_count
      when v_rule.denominator_scope = 'association_owner_members' then v_snapshot.association_owner_members_count
      when v_rule.denominator_scope = 'present_votes' then v_snapshot.present_eligible_members_count
      else v_snapshot.total_ownership_shares
    end;

    v_adopted := ((v_for * v_rule.denominator_integer) >= (v_denominator_total * v_rule.numerator_integer));

  elsif v_rule.threshold_kind = 'unanimity' then
    -- Art. 44: Unanimity of all condominium owners
    v_denominator_total := v_snapshot.all_condominium_owners_count;
    v_adopted := (v_for = v_denominator_total and v_against = 0);
  end if;

  v_result := jsonb_build_object(
    'adopted', v_adopted,
    'for_weight', v_for,
    'against_weight', v_against,
    'abstain_weight', v_abstain,
    'cast_weight', v_cast,
    'denominator_total', v_denominator_total,
    'threshold_kind', v_rule.threshold_kind,
    'president_tie_breaker_applied', v_pres_tie_break,
    'president_choice', v_pres_choice
  );

  update governance.votes
  set president_tie_breaker_applied = v_pres_tie_break,
      president_vote_choice = v_pres_choice
  where id = v_vote.id;

  insert into governance.resolutions(
    tenant_id, meeting_id, agenda_item_id, resolution_no,
    title, text_body, adopted, result_snapshot,
    effective_on, responsible_actor, due_date, execution_status,
    financial_impact, currency, maintenance_work_order_id,
    vote_totals, created_at, tenant_visible
  ) values (
    v_actor.tenant_id, p_meeting_id, p_agenda_item_id, p_resolution_no,
    p_title, p_text_body, v_adopted, v_result,
    current_date, p_responsible_actor, p_due_date, 'pending',
    p_financial_impact, case when p_financial_impact is not null then 'RON' else null end,
    p_maintenance_work_order_id, v_result, statement_timestamp(), true
  ) returning * into v_res;

  if p_responsible_actor is not null or p_due_date is not null then
    insert into governance.resolution_actions(
      tenant_id, resolution_id, action_title, description,
      responsible_actor, due_date, execution_status
    ) values (
      v_actor.tenant_id, v_res.id, 'Implement: ' || p_title, p_text_body,
      p_responsible_actor, p_due_date, 'pending'
    );
  end if;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'adopt_resolution', 'resolution',
    v_res.id, to_jsonb(v_res), statement_timestamp()
  );

  return v_res;
end;
$$;

-- G. elect_meeting_secretary: Art. 49 alin. (7)
create or replace function governance.elect_meeting_secretary(
  p_context_id uuid,
  p_meeting_id uuid,
  p_secretary_party_id uuid,
  p_secretary_name text
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id for update;

  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;
  if v_meeting.status <> 'open' then raise exception 'secretary_election_requires_open_meeting' using errcode = '42501'; end if;

  -- Verify secretary is an attendee member
  if not exists (
    select 1 from governance.attendance a
    join governance.eligibility_snapshots e on e.id = a.eligibility_id
    where a.meeting_id = p_meeting_id and e.party_id = p_secretary_party_id
  ) then
    raise exception 'secretary_must_be_present_member' using errcode = '22023';
  end if;

  update governance.meetings
  set elected_secretary_party_id = p_secretary_party_id,
      elected_secretary_name = p_secretary_name,
      secretary_elected_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_meeting_id
  returning * into v_meeting;

  return v_meeting;
end;
$$;

-- H. record_minutes_signature: Art. 49 alin. (5)
create or replace function governance.record_minutes_signature(
  p_context_id uuid,
  p_meeting_id uuid,
  p_signature_type text,
  p_signature_evidence_ref text default null
)
returns governance.minutes_attendee_signatures
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_sig governance.minutes_attendee_signatures;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.read', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  if p_signature_type not in ('present_member', 'censor') then
    raise exception 'invalid_signature_type' using errcode = '22023';
  end if;

  insert into governance.minutes_attendee_signatures(
    tenant_id, meeting_id, party_id, user_id, signature_type,
    signed_at, signature_status, signature_evidence_ref
  ) values (
    v_actor.tenant_id, p_meeting_id, v_actor.party_id, v_actor.actor_id, p_signature_type,
    statement_timestamp(), 'signed', p_signature_evidence_ref
  ) on conflict (meeting_id, party_id) do update
    set signed_at = statement_timestamp(),
        signature_status = 'signed',
        signature_evidence_ref = excluded.signature_evidence_ref
  returning * into v_sig;

  return v_sig;
end;
$$;

-- I. finalize_minutes with full statutory attendees & censor signature verification
create or replace function governance.finalize_minutes(
  p_context_id uuid,
  p_meeting_id uuid,
  p_content_json jsonb
)
returns governance.minutes
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit,extensions as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_min governance.minutes;
  v_sha text;
  v_missing_signatures integer := 0;
  v_has_censor_sig boolean := false;
  v_tz text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.minutes.finalize', true);

  select * into v_meeting from governance.meetings where id = p_meeting_id and tenant_id = v_actor.tenant_id;
  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  -- 1. Elected secretary required per Art. 49 alin. (7)
  if v_meeting.elected_secretary_party_id is null then
    raise exception 'secretary_election_required_for_minutes' using errcode = '42501';
  end if;

  -- 2. Every present member must have a signed record in minutes_attendee_signatures (Art. 49 alin. (5))
  select count(distinct e.party_id) into v_missing_signatures
  from governance.attendance a
  join governance.eligibility_snapshots e on e.id = a.eligibility_id
  where a.meeting_id = p_meeting_id
    and not exists (
      select 1 from governance.minutes_attendee_signatures s
      where s.meeting_id = p_meeting_id
        and s.party_id = e.party_id
        and s.signature_status = 'signed'
    );

  if v_missing_signatures > 0 then
    raise exception 'missing_attendee_minutes_signatures' using errcode = '42501';
  end if;

  -- 3. Censor signature required per Art. 49 alin. (5)
  select exists (
    select 1 from governance.minutes_attendee_signatures s
    where s.meeting_id = p_meeting_id
      and s.signature_type = 'censor'
      and s.signature_status = 'signed'
  ) into v_has_censor_sig;

  if not v_has_censor_sig then
    raise exception 'missing_censor_minutes_signature' using errcode = '42501';
  end if;

  v_sha := encode(extensions.digest(p_content_json::text, 'sha256'), 'hex');
  v_tz := coalesce(v_meeting.timezone, 'Europe/Bucharest');

  insert into governance.minutes(
    tenant_id, meeting_id, version, content_json,
    sha256, approved_at, approved_by, finalized_at, finalized_by,
    elected_secretary_party_id, elected_secretary_name,
    censor_signed_at, all_attendees_signed,
    publication_deadline_at, recorded_during_meeting,
    created_at, tenant_visible
  ) values (
    v_actor.tenant_id, p_meeting_id, 1, p_content_json,
    v_sha, statement_timestamp(), v_actor.actor_id, statement_timestamp(), v_actor.actor_id,
    v_meeting.elected_secretary_party_id, v_meeting.elected_secretary_name,
    statement_timestamp(), true,
    (v_meeting.scheduled_at at time zone v_tz)::date + integer '7',
    true, statement_timestamp(), true
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

-- ----------------------------------------------------------------------------
-- 8. Customer API Gateway Wrappers (SECURITY INVOKER, authenticated only)
-- ----------------------------------------------------------------------------

create or replace function customer_api.elect_meeting_secretary_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_secretary_party_id uuid,
  p_secretary_name text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.elect_meeting_secretary(p_context_id, p_meeting_id, p_secretary_party_id, p_secretary_name));
end;
$$;

create or replace function customer_api.record_minutes_signature_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_signature_type text,
  p_signature_evidence_ref text default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.record_minutes_signature(p_context_id, p_meeting_id, p_signature_type, p_signature_evidence_ref));
end;
$$;

create or replace function customer_api.get_legal_decision_rules_v1(
  p_context_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    from governance.legal_decision_rules r
    where r.effective_from <= statement_timestamp()
      and (r.effective_to is null or r.effective_to > statement_timestamp())
  );
end;
$$;

-- Grant execution privileges on new customer_api wrappers to authenticated
grant execute on function customer_api.elect_meeting_secretary_v1(uuid, uuid, uuid, text) to authenticated;
grant execute on function customer_api.record_minutes_signature_v1(uuid, uuid, text, text) to authenticated;
grant execute on function customer_api.get_legal_decision_rules_v1(uuid) to authenticated;

revoke all on function customer_api.elect_meeting_secretary_v1(uuid, uuid, uuid, text) from public, anon;
revoke all on function customer_api.record_minutes_signature_v1(uuid, uuid, text, text) from public, anon;
revoke all on function customer_api.get_legal_decision_rules_v1(uuid) from public, anon;

-- Grant internal routine execution to authenticated so SECURITY INVOKER wrappers succeed
grant execute on function governance.elect_meeting_secretary(uuid, uuid, uuid, text) to authenticated;
grant execute on function governance.record_minutes_signature(uuid, uuid, text, text) to authenticated;

commit;
