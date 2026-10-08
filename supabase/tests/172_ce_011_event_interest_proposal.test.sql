\ir ../proposals/ce_011_event_interest_operational_v1.sql

begin;
select plan(34);

select has_schema('community', 'CE-011 community schema exists in the ephemeral database');
select has_table('community', 'events', 'Event aggregate exists');
select has_table('community', 'event_occurrences', 'Single-occurrence store exists');
select has_table('community', 'event_interests', 'Interest store exists');
select has_table('community', 'event_attendance', 'Attendance store exists');
select has_table('community', 'event_command_receipts', 'Immutable command receipt store exists');

select has_function('customer_api', 'command_ce_event_v1', array['jsonb'], 'CE command gateway exists');
select has_function('app_private', 'ce_event_authorize_v1', array['uuid','uuid','text'], 'Authority adapter exists');
select has_function('app_private', 'ce_event_audience_eligible_v1', array['uuid','uuid'], 'Audience evaluator exists');

select is(
  (select count(*) from identity.permissions where code in(
    'events.event.read',
    'events.event.publish',
    'events.event.cancel',
    'events.interest.manage_self',
    'events.attendance.record',
    'events.attendance.correct'
  )),
  6::bigint,
  'All six official C01 permissions are registered'
);
select ok(
  exists(select 1 from platform.module_definitions where code='community_events' and version=1 and entitlement_key='module.community_events'),
  'Independent community_events module mapping exists'
);
select is(
  (select count(*) from platform.module_dependencies d join platform.module_definitions m on m.id=d.module_definition_id where m.code='community_events' and m.version=1),
  0::bigint,
  'CE-011 has no dependency on Community, SERVICE, Booking, Finance or AIRPROP'
);

select is((select relrowsecurity from pg_class where oid='community.events'::regclass), true, 'Events enforce RLS');
select is((select relrowsecurity from pg_class where oid='community.event_occurrences'::regclass), true, 'Occurrences enforce RLS');
select is((select relrowsecurity from pg_class where oid='community.event_interests'::regclass), true, 'Interests enforce RLS');
select is((select relrowsecurity from pg_class where oid='community.event_attendance'::regclass), true, 'Attendance enforces RLS');
select is((select relrowsecurity from pg_class where oid='community.event_command_receipts'::regclass), true, 'Receipts enforce RLS');

select is(
  (select count(*) from information_schema.role_table_grants where table_schema='community' and grantee in('anon','authenticated')),
  0::bigint,
  'No direct CE table grants exist for anon or authenticated'
);
select ok(has_function_privilege('authenticated','customer_api.command_ce_event_v1(jsonb)','EXECUTE'), 'Authenticated users may call the bounded command gateway');
select ok(not has_function_privilege('anon','customer_api.command_ce_event_v1(jsonb)','EXECUTE'), 'Anonymous callers cannot execute the CE command gateway');
select ok(not has_function_privilege('authenticated','app_private.ce_event_authorize_v1(uuid,uuid,text)','EXECUTE'), 'Private authority adapter is not directly executable');
select ok(not has_function_privilege('authenticated','app_private.ce_event_audience_eligible_v1(uuid,uuid)','EXECUTE'), 'Private audience evaluator is not directly executable');

select ok(
  exists(select 1 from pg_constraint where conrelid='community.event_occurrences'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%event_id%'),
  'At most one occurrence is stored for each Event'
);
select ok(
  exists(select 1 from pg_constraint where conrelid='community.event_interests'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%event_id, membership_id%'),
  'Interest is unique per Event and membership'
);
select ok(
  exists(select 1 from pg_constraint where conrelid='community.event_attendance'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%event_id, membership_id%'),
  'Attendance is unique per Event and membership'
);
select ok(
  exists(select 1 from pg_constraint where conrelid='community.event_command_receipts'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%tenant_id, canonical_key%'),
  'Receipt canonical key is tenant-scoped and unique'
);
select ok(
  exists(select 1 from pg_trigger where tgrelid='community.event_command_receipts'::regclass and tgname='ce_event_receipt_immutable' and not tgisinternal),
  'Receipt immutability trigger exists'
);

select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%platform.idempotency_keys%',
  'Command reuses shared idempotency infrastructure'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%audit.events%',
  'Command writes the shared audit ledger'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%platform.outbox_events%',
  'Command writes the shared outbox'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%pg_timezone_names%',
  'Command validates IANA timezone names'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%ce_event_status_rejects_new_attendance%',
  'New attendance is rejected outside the published lifecycle'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%ce_event_cancelled_correction_reason_required%',
  'Post-cancellation attendance correction requires an explicit reason'
);
select ok(
  pg_get_functiondef('customer_api.command_ce_event_v1(jsonb)'::regprocedure) like '%record_expected_version%',
  'Interest and attendance mutations enforce record-level optimistic versions'
);

select * from finish();
rollback;
