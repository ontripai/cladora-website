-- Test 061: CLADORA-P2-GOV-001 Governance Routine Grants Hardening
-- Verifies:
-- 1. Authenticated role has execute privileges on underlying governance domain functions
-- 2. Anon and public roles remain strictly denied
-- 3. Complete transactional rollback

begin;
select plan(10);

-- 1. Authenticated grants
select ok(
  has_function_privilege('authenticated', 'governance.create_governance_policy(uuid,uuid,text,text,integer,numeric)', 'EXECUTE'),
  'authenticated granted on governance.create_governance_policy'
);

select ok(
  has_function_privilege('authenticated', 'governance.create_meeting(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz)', 'EXECUTE'),
  'authenticated granted on governance.create_meeting'
);

select ok(
  has_function_privilege('authenticated', 'governance.add_agenda_item(uuid,uuid,integer,text,text,text,boolean,numeric,text)', 'EXECUTE'),
  'authenticated granted on governance.add_agenda_item'
);

select ok(
  has_function_privilege('authenticated', 'governance.publish_meeting(uuid,uuid)', 'EXECUTE'),
  'authenticated granted on governance.publish_meeting'
);

select ok(
  has_function_privilege('authenticated', 'governance.cast_vote(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'authenticated granted on governance.cast_vote'
);

select ok(
  has_function_privilege('authenticated', 'governance.adopt_resolution(uuid,uuid,uuid,text,text,text,text,date,numeric,uuid)', 'EXECUTE'),
  'authenticated granted on governance.adopt_resolution'
);

select ok(
  has_function_privilege('authenticated', 'governance.finalize_minutes(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated granted on governance.finalize_minutes'
);

-- 2. Anon denials
select ok(
  not has_function_privilege('anon', 'governance.create_governance_policy(uuid,uuid,text,text,integer,numeric)', 'EXECUTE'),
  'anon denied on governance.create_governance_policy'
);

select ok(
  not has_function_privilege('anon', 'governance.create_meeting(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz)', 'EXECUTE'),
  'anon denied on governance.create_meeting'
);

select ok(
  not has_function_privilege('anon', 'governance.cast_vote(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'anon denied on governance.cast_vote'
);

rollback;
