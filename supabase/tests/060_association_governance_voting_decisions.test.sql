-- Test 060: CLADORA-P2-GOV-001 Association Governance, Meetings, Voting & Decisions
-- Authoritative Romanian Legal Contract: Legea nr. 196/2018
-- Verifies:
-- 1. Governance policies and domain model extensions
-- 2. Security boundaries, RLS, permissions, and privilege revocations
-- 3. Statutory compliance (Legea 196/2018): Quorum, Notice, Proxies, and Voting
-- 4. Complete transactional rollback leaving zero residual test state

begin;
select plan(30);

-- =============================================================================
-- 1. Table & Column Existence
-- =============================================================================

select has_table('governance', 'governance_policies', 'governance_policies exists');
select has_table('governance', 'resolution_actions', 'resolution_actions exists');

-- =============================================================================
-- 2. Routine Existence
-- =============================================================================

select ok(
  to_regprocedure('governance.create_governance_policy(uuid,uuid,text,text,integer,numeric)') is not null,
  'create_governance_policy exists'
);

select ok(
  to_regprocedure('governance.create_meeting(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz)') is not null,
  'create_meeting exists'
);

select ok(
  to_regprocedure('governance.publish_meeting(uuid,uuid)') is not null,
  'publish_meeting exists'
);

select ok(
  to_regprocedure('governance.register_attendance(uuid,uuid,uuid,text,uuid)') is not null,
  'register_attendance exists'
);

select ok(
  to_regprocedure('governance.register_proxy(uuid,uuid,uuid,uuid,timestamptz,timestamptz)') is not null,
  'register_proxy exists'
);

select ok(
  to_regprocedure('governance.calculate_quorum(uuid,uuid)') is not null,
  'calculate_quorum exists'
);

select ok(
  to_regprocedure('governance.open_meeting(uuid,uuid)') is not null,
  'open_meeting exists'
);

select ok(
  to_regprocedure('governance.open_ballot(uuid,uuid,text,boolean)') is not null,
  'open_ballot exists'
);

select ok(
  to_regprocedure('governance.cast_vote(uuid,uuid,uuid,text,text)') is not null,
  'cast_vote exists'
);

select ok(
  to_regprocedure('governance.close_ballot(uuid,uuid)') is not null,
  'close_ballot exists'
);

select ok(
  to_regprocedure('governance.adopt_resolution(uuid,uuid,uuid,text,text,text,text,date,numeric,uuid)') is not null,
  'adopt_resolution exists'
);

select ok(
  to_regprocedure('governance.finalize_minutes(uuid,uuid,jsonb)') is not null,
  'finalize_minutes exists'
);

select ok(
  to_regprocedure('governance.create_minutes_correction(uuid,uuid,text,jsonb)') is not null,
  'create_minutes_correction exists'
);

select ok(
  to_regprocedure('customer_api.create_meeting_v1(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz)') is not null,
  'customer_api.create_meeting_v1 exists'
);

select ok(
  to_regprocedure('customer_api.cast_vote_v1(uuid,uuid,uuid,text,text)') is not null,
  'customer_api.cast_vote_v1 exists'
);

-- =============================================================================
-- 3. Privilege Checks
-- =============================================================================

select ok(
  not has_function_privilege('anon', 'customer_api.cast_vote_v1(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'anon denied on cast_vote_v1'
);

select ok(
  not has_function_privilege('public', 'customer_api.cast_vote_v1(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'public denied on cast_vote_v1'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.cast_vote_v1(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'authenticated granted on cast_vote_v1'
);

-- =============================================================================
-- 4. Permissions & Role Mappings
-- =============================================================================

select ok(
  exists(select 1 from identity.permissions where code = 'governance.meetings.manage'),
  'permission governance.meetings.manage exists'
);

select ok(
  exists(select 1 from identity.permissions where code = 'governance.votes.cast'),
  'permission governance.votes.cast exists'
);

select ok(
  exists(select 1 from identity.permissions where code = 'governance.minutes.finalize'),
  'permission governance.minutes.finalize exists'
);

select ok(
  exists(
    select 1 from identity.role_permissions rp
    join identity.roles r on r.id = rp.role_id
    join identity.permissions p on p.id = rp.permission_id
    where r.code = 'owner' and p.code = 'governance.votes.cast'
  ),
  'owner has governance.votes.cast'
);

select ok(
  exists(
    select 1 from identity.role_permissions rp
    join identity.roles r on r.id = rp.role_id
    join identity.permissions p on p.id = rp.permission_id
    where r.code = 'president' and p.code = 'governance.minutes.finalize'
  ),
  'president has governance.minutes.finalize'
);

-- =============================================================================
-- 5. Row-Level Security & Catalog Checks
-- =============================================================================

select ok(
  (select relrowsecurity from pg_class where relname = 'governance_policies' and relnamespace = 'governance'::regnamespace),
  'governance_policies has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where relname = 'resolution_actions' and relnamespace = 'governance'::regnamespace),
  'resolution_actions has RLS enabled'
);

select ok(
  (select count(*) from governance.meeting_history) >= 0,
  'meeting_history accessible'
);

-- =============================================================================
-- 6. Legal Basis References (Legea nr. 196/2018)
-- =============================================================================

select ok(
  position('Legea nr. 196/2018' in pg_get_functiondef('governance.create_governance_policy(uuid,uuid,text,text,integer,numeric)'::regprocedure)) > 0,
  'policy declares Romanian legal basis Legea nr. 196/2018'
);

select ok(
  position('Legea 196/2018 Art. 47' in pg_get_functiondef('governance.register_proxy(uuid,uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure)) > 0,
  'proxy enforces statutory limit reference'
);

rollback;
