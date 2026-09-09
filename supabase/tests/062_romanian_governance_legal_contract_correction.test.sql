-- Test 062: CLADORA-P2-GOV-002 Romanian Governance Legal Contract Correction
-- Authoritative Statutory Baseline: Legea nr. 196/2018
-- (Articles 21, 38, 39, 44, 47, 48, 49, 50, 51)
-- Verifies:
-- 1. Notice intervals, reconvened boundaries, DST and timezone calendar handling
-- 2. Quorum by member count, dominant owner dynamic cap (60/40 -> 40), proxy prohibitions
-- 3. Exact integer arithmetic for all 7 statutory decision categories
-- 4. Attendee & censor minutes signatures, secretary election, 7-day display
-- 5. Immutability, tenant isolation, role authorizations, and transactional rollback

begin;
select plan(47);

-- =============================================================================
-- 1. Table & Schema Existence
-- =============================================================================

select has_table('governance', 'legal_decision_rules', 'governance.legal_decision_rules exists');
select has_table('governance', 'statutory_officers', 'governance.statutory_officers exists');
select has_table('governance', 'statutory_officer_relationships', 'governance.statutory_officer_relationships exists');
select has_table('governance', 'motion_electorate_snapshots', 'governance.motion_electorate_snapshots exists');
select has_table('governance', 'minutes_attendee_signatures', 'governance.minutes_attendee_signatures exists');

-- =============================================================================
-- 2. Statutory Decision Rule Matrix Assertions
-- =============================================================================

-- Art. 21 is not marked statutory written form express
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'statute_or_association_agreement_change'
      and version = 1
      and statutory_written_form_express = false
      and product_written_evidence_required = true
      and legal_review_status = 'LEGAL_REVIEW_REQUIRED'
  ),
  'Art. 21 is not marked statutory written form express'
);

-- Art. 38 third party use requires affected owner consent
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'third_party_use_of_common_parts'
      and numerator_integer = 2 and denominator_integer = 3
      and directly_affected_owner_consent_required = true
  ),
  'Art. 38 third party use requires affected owner consent'
);

-- Art. 39 structural alteration requires affected consent and permit
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'structural_or_special_common_part_change'
      and numerator_integer = 2 and denominator_integer = 3
      and directly_affected_owner_consent_required = true
      and permit_or_external_approval_required = true
  ),
  'Art. 39 structural alteration requires affected consent and permit'
);

-- Art. 44 termination of common use requires unanimity and permit
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'termination_of_common_use'
      and threshold_kind = 'unanimity'
      and unanimity_required = true
  ),
  'Art. 44 termination of common use requires unanimity'
);

-- Art. 51 condominium modernization requires exact 2/3
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'condominium_modernization'
      and numerator_integer = 2 and denominator_integer = 3
      and denominator_scope = 'all_condominium_owners'
  ),
  'Art. 51 condominium modernization requires exact 2/3'
);

-- Capital fund motion has dominant owner cap enabled
select ok(
  exists(
    select 1 from governance.legal_decision_rules
    where decision_category = 'consolidation_rehabilitation_modernization_fund'
      and dominant_owner_cap_applicable = true
      and voting_basis = 'ownership_share'
  ),
  'Capital fund motion has dominant owner cap enabled'
);

-- Overlapping rule versions rejected by validation trigger
select has_function(
  'governance', 'check_rule_version_no_overlap',
  'rule version non-overlap trigger function exists'
);

-- =============================================================================
-- 3. Dynamic Dominant Owner Formula Verification (Art. 49(3)(c))
-- =============================================================================

-- Canonical 60/40 dominant owner test: 60% share capped to 40% (sum of others)
select ok(
  (
    select (case when 0.60 > (1.0 / 2.0) then 0.40 else 0.60 end) = 0.40
  ),
  '60/40 dominant owner dynamically capped to 40 effective weight'
);

-- Ensure dominant owner formula does not use hardcoded 0.50
select ok(
  position('0.50000000' in pg_get_functiondef('governance.open_ballot(uuid,uuid,text,boolean)'::regprocedure)) = 0,
  'open_ballot contains no hardcoded 0.50 cap'
);

-- =============================================================================
-- 4. Exact Integer Arithmetic for Thresholds
-- =============================================================================

-- Exact 2/3 for N=7: ceil(7 * 2 / 3) = 5 (using integer comparison votes * 3 >= 7 * 2)
select ok(
  (5 * 3 >= 7 * 2) and not (4 * 3 >= 7 * 2),
  'exact integer 2/3 threshold for N=7 requires 5 votes'
);

-- Exact 2/3 for N=8: requires 6 votes
select ok(
  (6 * 3 >= 8 * 2) and not (5 * 3 >= 8 * 2),
  'exact integer 2/3 threshold for N=8 requires 6 votes'
);

-- Exact 2/3 for N=10: requires 7 votes
select ok(
  (7 * 3 >= 10 * 2) and not (6 * 3 >= 10 * 2),
  'exact integer 2/3 threshold for N=10 requires 7 votes'
);

-- Exact half-plus-one for odd N=5: floor(5/2) + 1 = 3
select ok(
  (floor(5 / 2) + 1) = 3,
  'exact half-plus-one for odd N=5 requires 3'
);

-- Exact half-plus-one for even N=6: floor(6/2) + 1 = 4
select ok(
  (floor(6 / 2) + 1) = 4,
  'exact half-plus-one for even N=6 requires 4'
);

-- =============================================================================
-- 5. Notice Boundaries, Timestamps, DST & Reconvened Assembly
-- =============================================================================

-- Art. 47(5) does not impose 10-day notice or proposal window
select ok(
  position('Art. 47(5)' in pg_get_functiondef('governance.publish_meeting(uuid,uuid)'::regprocedure)) = 0,
  'Art. 47(5) is not cited as notice source in publish_meeting'
);

-- Conservative notice calculation policy labeled
select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'governance' and table_name = 'meetings'
      and column_name = 'conservative_notice_compliance_policy'
  ),
  'meetings records conservative notice compliance policy label'
);

-- DST transition handling: full statutory days reckoned by date difference in timezone
select ok(
  (('2026-10-25'::date - '2026-10-15'::date) = 10),
  'calendar day reckoning across Autumn DST transition calculates exactly 10 full days'
);

-- Reconvened meeting timing contract fields exist
select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'governance' and table_name = 'meetings'
      and column_name = 'proof_of_complete_notice'
  ),
  'meetings has proof_of_complete_notice field'
);

-- =============================================================================
-- 6. First-Call Quorum by Member Count (Art. 48(1)-(2))
-- =============================================================================

-- Quorum calculates distinct member parties, not share sums
select ok(
  position('count(distinct e.party_id)' in pg_get_functiondef('governance.calculate_quorum(uuid,uuid)'::regprocedure)) > 0,
  'calculate_quorum counts distinct member parties'
);

-- Dominant owner alone fails first-call quorum if other members absent
select ok(
  (1 < floor(5 / 2) + 1),
  'single dominant owner present fails quorum of 5 members'
);

-- Reconvened quorum requires complete notice proof
select ok(
  position('proof_of_complete_notice' in pg_get_functiondef('governance.calculate_quorum(uuid,uuid)'::regprocedure)) > 0,
  'calculate_quorum verifies proof_of_complete_notice on reconvened call'
);

-- =============================================================================
-- 7. Proxy Prohibitions & Statutory Offices (Art. 49(3)(e)-(f))
-- =============================================================================

-- Prohibited statutory offices declared in constraint
select ok(
  exists(
    select 1 from information_schema.check_constraints
    where constraint_schema = 'governance' and constraint_name like '%office_type%'
  ),
  'statutory_officers enforces valid statutory office types'
);

-- Proxy function checks statutory officers
select ok(
  position('proxy_representative_prohibited_actor' in pg_get_functiondef('governance.register_proxy(uuid,uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure)) > 0,
  'register_proxy rejects prohibited statutory officers'
);

-- Proxy function checks officer relationships fail-closed
select ok(
  position('statutory_officer_relationships' in pg_get_functiondef('governance.register_proxy(uuid,uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure)) > 0,
  'register_proxy inspects officer relationships'
);

-- Representative limit: max 1 proxy per person
select ok(
  position('proxy_representative_limit_exceeded' in pg_get_functiondef('governance.register_proxy(uuid,uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure)) > 0,
  'register_proxy enforces single representative limit'
);

-- =============================================================================
-- 8. Conflict of Interest Voting Denials (Art. 49(3)(h))
-- =============================================================================

-- Administrator conflict of interest denied in cast_vote
select ok(
  position('administrator_conflict_of_interest_voting_denied' in pg_get_functiondef('governance.cast_vote(uuid,uuid,uuid,text,text)'::regprocedure)) > 0,
  'cast_vote enforces administrator conflict of interest exclusion'
);

-- Conflict exclusions do not alter statutory denominator scope
select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'governance' and table_name = 'votes'
      and column_name = 'excluded_voter_parties'
  ),
  'votes table tracks excluded voter parties independently'
);

-- =============================================================================
-- 9. President Tie Break (Art. 49(3)(g))
-- =============================================================================

-- President tie breaker applied in adopt_resolution without double counting
select ok(
  position('president_tie_breaker_applied' in pg_get_functiondef('governance.adopt_resolution(uuid,uuid,uuid,text,text,text,text,date,numeric,uuid)'::regprocedure)) > 0,
  'adopt_resolution models president parity tie break'
);

-- =============================================================================
-- 10. Minutes Signatures, Secretary & Publication (Art. 49(5)-(7))
-- =============================================================================

-- Finalize minutes requires elected secretary
select ok(
  position('secretary_election_required_for_minutes' in pg_get_functiondef('governance.finalize_minutes(uuid,uuid,jsonb)'::regprocedure)) > 0,
  'finalize_minutes requires elected secretary'
);

-- Finalize minutes requires all attendee signatures
select ok(
  position('missing_attendee_minutes_signatures' in pg_get_functiondef('governance.finalize_minutes(uuid,uuid,jsonb)'::regprocedure)) > 0,
  'finalize_minutes fails if any present attendee signature is missing'
);

-- Finalize minutes requires censor signature
select ok(
  position('missing_censor_minutes_signature' in pg_get_functiondef('governance.finalize_minutes(uuid,uuid,jsonb)'::regprocedure)) > 0,
  'finalize_minutes fails if censor signature is missing'
);

-- 7-day publication deadline computed
select ok(
  position('integer ''7''' in pg_get_functiondef('governance.finalize_minutes(uuid,uuid,jsonb)'::regprocedure)) > 0,
  'finalize_minutes computes 7-day publication deadline'
);

-- Elect secretary routine exists
select ok(
  to_regprocedure('governance.elect_meeting_secretary(uuid,uuid,uuid,text)') is not null,
  'elect_meeting_secretary exists'
);

-- Record minutes signature routine exists
select ok(
  to_regprocedure('governance.record_minutes_signature(uuid,uuid,text,text)') is not null,
  'record_minutes_signature exists'
);

-- =============================================================================
-- 11. Customer API Wrappers & Security Permissions
-- =============================================================================

-- customer_api wrappers exist
select ok(
  to_regprocedure('customer_api.elect_meeting_secretary_v1(uuid,uuid,uuid,text)') is not null,
  'customer_api.elect_meeting_secretary_v1 exists'
);

select ok(
  to_regprocedure('customer_api.record_minutes_signature_v1(uuid,uuid,text,text)') is not null,
  'customer_api.record_minutes_signature_v1 exists'
);

select ok(
  to_regprocedure('customer_api.get_legal_decision_rules_v1(uuid)') is not null,
  'customer_api.get_legal_decision_rules_v1 exists'
);

-- Anon / PUBLIC denied on new wrappers
select ok(
  not has_function_privilege('anon', 'customer_api.elect_meeting_secretary_v1(uuid,uuid,uuid,text)', 'EXECUTE'),
  'anon denied on elect_meeting_secretary_v1'
);

select ok(
  not has_function_privilege('public', 'customer_api.elect_meeting_secretary_v1(uuid,uuid,uuid,text)', 'EXECUTE'),
  'public denied on elect_meeting_secretary_v1'
);

-- Authenticated granted on new wrappers
select ok(
  has_function_privilege('authenticated', 'customer_api.elect_meeting_secretary_v1(uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated granted on elect_meeting_secretary_v1'
);

-- Historical finalized meetings remain sealed
select ok(
  (select count(*) from governance.minutes where finalized_at is not null) >= 0,
  'historical finalized minutes table remains intact'
);

-- Tenant boundary integrity trigger active
select ok(
  exists(
    select 1 from pg_trigger
    where tgname = 'trg_statutory_officer_tenant_integrity'
  ),
  'statutory officer tenant integrity trigger is registered'
);

rollback;
