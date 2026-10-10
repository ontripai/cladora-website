begin;
set local search_path = public, extensions;

select plan(87);

select has_schema('pm_private','PM private schema exists');
select has_table('pm_private','programs','Programs table exists');
select has_table('pm_private','baselines','Baselines table exists');
select has_table('pm_private','workstreams','Workstreams table exists');
select has_table('pm_private','assignments','Assignments table exists');
select has_table('pm_private','work_packages','Work packages table exists');
select has_table('pm_private','execution_cycles','Execution cycles table exists');
select has_table('pm_private','dependencies','Dependencies table exists');
select has_table('pm_private','evidence_references','Evidence references table exists');
select has_table('pm_private','test_runs','Test runs table exists');
select has_table('pm_private','acceptance_decisions','Acceptance decisions table exists');
select has_table('pm_private','blockers','Blockers table exists');
select has_table('pm_private','change_requests','Change requests table exists');
select has_table('pm_private','transitions','Transitions table exists');
select has_table('pm_private','release_references','Release references table exists');
select has_table('pm_private','command_receipts','Command receipts table exists');
select has_table('pm_private','outbox_events','Internal outbox table exists');

select has_function('pm_private','list_packages_internal_v1',array['uuid','jsonb','integer','timestamp with time zone','uuid']);
select has_function('pm_private','get_package_internal_v1',array['uuid','uuid']);
select has_function('pm_private','register_package_internal_v1',array['jsonb']);
select has_function('pm_private','transition_cycle_internal_v1',array['jsonb']);
select has_function('pm_private','attach_evidence_internal_v1',array['jsonb']);
select has_function('pm_private','record_test_result_internal_v1',array['jsonb']);
select has_function('pm_private','record_acceptance_internal_v1',array['jsonb']);
select has_function('pm_private','request_change_internal_v1',array['jsonb']);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.programs'::regclass),'Programs force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.baselines'::regclass),'Baselines force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.workstreams'::regclass),'Workstreams force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.assignments'::regclass),'Assignments force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.work_packages'::regclass),'Work packages force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.execution_cycles'::regclass),'Cycles force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.dependencies'::regclass),'Dependencies force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.evidence_references'::regclass),'Evidence force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.test_runs'::regclass),'Test runs force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.acceptance_decisions'::regclass),'Acceptance force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.blockers'::regclass),'Blockers force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.change_requests'::regclass),'Change requests force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.transitions'::regclass),'Transitions force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.release_references'::regclass),'Release references force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.command_receipts'::regclass),'Receipts force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='pm_private.outbox_events'::regclass),'Outbox force RLS');

select is((select count(*) from information_schema.role_table_grants where table_schema='pm_private'
  and grantee in ('PUBLIC','anon','authenticated','service_role')),0::bigint,'No client or service-role table grants');
select ok(not has_schema_privilege('authenticated','pm_private','USAGE'),'Authenticated has no private schema usage');
select ok(not has_schema_privilege('service_role','pm_private','USAGE'),'Service role has no private schema usage');
select is((select count(*) from information_schema.routine_privileges where specific_schema='pm_private'
  and grantee in ('PUBLIC','anon','authenticated','service_role')),0::bigint,'No client or service-role function grants');
select is((select enum_range(null::pm_private.permission_code)::text),
  '{pm.package.read,pm.package.manage,pm.evidence.attach,pm.review.read,pm.review.decide,pm.release.read}',
  'Permission codes match the approved contract');
select is((select count(*) from pg_policies where schemaname='pm_private'),0::bigint,'No direct table policy creates a client read path');
select ok((select bool_and(p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=pg_catalog%')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='pm_private' and p.proname in ('register_package_internal_v1','transition_cycle_internal_v1',
    'attach_evidence_internal_v1','record_test_result_internal_v1','record_acceptance_internal_v1','request_change_internal_v1')),
  'Mutation functions are security definer with pinned search path');

select is(pm_private.redact_json_v1('{"token":"sensitive","safe":"ok"}'::jsonb)->>'token','[REDACTED]','Secret-key value is redacted');
select is(pm_private.redact_json_v1('{"nested":{"password":"sensitive"}}'::jsonb)#>>'{nested,password}','[REDACTED]','Nested secret is redacted');
select ok(pm_private.redact_json_v1(to_jsonb('Bearer abc.def.ghi'::text))#>>'{}' not like '%abc.def.ghi%','Bearer text is redacted');
select ok(pm_private.valid_transition_v1('planned','ready'),'Approved lifecycle edge is valid');
select ok(not pm_private.valid_transition_v1('planned','closed'),'Unapproved lifecycle edge is invalid');

insert into auth.users(id,email) values
  ('17200000-0000-4000-8000-000000000001','pm-creator-172@cladora.test'),
  ('17200000-0000-4000-8000-000000000002','pm-reviewer-172@cladora.test');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
  ('17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000001','PM-172-CREATOR','PM Creator','active'),
  ('17200000-0000-4000-8000-000000000102','17200000-0000-4000-8000-000000000002','PM-172-REVIEWER','PM Reviewer','active');
insert into platform.platform_role_assignments(platform_user_id,role,status,grant_reason) values
  ('17200000-0000-4000-8000-000000000101','PLATFORM_OPERATIONS','active','PM runtime test creator'),
  ('17200000-0000-4000-8000-000000000102','PLATFORM_AUDITOR','active','PM runtime test reviewer');
insert into pm_private.programs(id,code,repository_provider,repository_id,repository_owner,repository_name) values
  ('17200000-0000-4000-8000-000000000201','CLADORA172','github','repo-172','ontripai','cladora-website');
insert into pm_private.baselines(id,program_id,version_label,controlling_commit,status,effective_at) values
  ('17200000-0000-4000-8000-000000000202','17200000-0000-4000-8000-000000000201','1.4',repeat('a',40),'current',statement_timestamp());
insert into pm_private.workstreams(id,program_id,code,owner_label,scope) values
  ('17200000-0000-4000-8000-000000000203','17200000-0000-4000-8000-000000000201','CORE172','Core Platform','Private PM runtime test');
insert into pm_private.assignments(program_id,platform_user_id,workstream_id,permission,effect,reason) values
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000203','pm.package.manage','allow','Creator package authority'),
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000203','pm.package.read','allow','Creator read authority'),
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000203','pm.evidence.attach','allow','Creator evidence authority'),
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000203','pm.review.decide','allow','Self-review denial fixture'),
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000102','17200000-0000-4000-8000-000000000203','pm.review.decide','allow','Independent decision authority'),
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000102','17200000-0000-4000-8000-000000000203','pm.package.read','allow','Reviewer read authority');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','baseline_id','17200000-0000-4000-8000-000000000202',
  'workstream_id','17200000-0000-4000-8000-000000000203','package_key','PM01-RUNTIME-172',
  'title','PM runtime test','bounded_scope','Synthetic isolated scope','expected_version',0,
  'request_id','17200000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-172-register'))$$,
  '%pm_mfa_required%','AAL1 mutation is denied');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_register',pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','baseline_id','17200000-0000-4000-8000-000000000202',
  'workstream_id','17200000-0000-4000-8000-000000000203','package_key','PM01-RUNTIME-172',
  'title','PM runtime test','bounded_scope','Synthetic isolated scope','expected_version',0,
  'request_id','17200000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-172-register'))::text,true);
select is(current_setting('test.pm_register')::jsonb->>'state','planned','Registration creates a planned first cycle');
select set_config('test.pm_package_id',current_setting('test.pm_register')::jsonb->>'package_id',true);
select set_config('test.pm_cycle_id',current_setting('test.pm_register')::jsonb->>'cycle_id',true);
select ok((pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','baseline_id','17200000-0000-4000-8000-000000000202',
  'workstream_id','17200000-0000-4000-8000-000000000203','package_key','PM01-RUNTIME-172',
  'title','PM runtime test','bounded_scope','Synthetic isolated scope','expected_version',0,
  'request_id','17200000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-172-register'))->>'idempotent')::boolean,
  'Exact replay returns the stored response');
select is((select count(*) from pm_private.work_packages where package_key='PM01-RUNTIME-172'),1::bigint,'Replay creates one package');
select is((select count(*) from pm_private.command_receipts where namespace='pm.package.register'),1::bigint,'Replay creates one receipt');
select is((select count(*) from pm_private.outbox_events where event_type='pm.package.registered'),1::bigint,'Replay creates one outbox event');
select is((select count(*) from audit.events where action='PM_PACKAGE_REGISTERED'),1::bigint,'Registration creates one audit event');
select throws_like($$select pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','baseline_id','17200000-0000-4000-8000-000000000202',
  'workstream_id','17200000-0000-4000-8000-000000000203','package_key','PM01-RUNTIME-172',
  'title','Changed replay payload','bounded_scope','Synthetic isolated scope','expected_version',0,
  'request_id','17200000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-172-register'))$$,
  '%pm_idempotency_conflict%','Changed payload under the same key conflicts');

insert into pm_private.assignments(program_id,platform_user_id,workstream_id,permission,effect,reason) values
  ('17200000-0000-4000-8000-000000000201','17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000203','pm.package.manage','deny','Deny-first test');
select ok(not pm_private.has_permission_v1('17200000-0000-4000-8000-000000000101','17200000-0000-4000-8000-000000000201',
  'pm.package.manage','17200000-0000-4000-8000-000000000203',current_setting('test.pm_package_id')::uuid),'Explicit deny wins over allow');
delete from pm_private.assignments where effect='deny' and reason='Deny-first test';

set local role authenticated;
select throws_like($$select * from pm_private.programs$$,'%permission denied%','Authenticated cannot directly read the private schema');
reset role;
set local role service_role;
select throws_like($$select * from pm_private.programs$$,'%permission denied%','Service role cannot directly read the private schema');
reset role;

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_evidence',pm_private.attach_evidence_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'expected_version',1,'request_id','17200000-0000-4000-8000-000000000302','idempotency_key','pm-runtime-172-evidence',
  'commit_sha',repeat('b',40),'evidence_type','ci_run','provider','github','provider_reference','github:run:172',
  'result','passed','bounded_summary','token=secret-value passed'))::text,true);
select is((select result from pm_private.evidence_references where id=(current_setting('test.pm_evidence')::jsonb->>'evidence_id')::uuid),
  'passed','Evidence result is recorded');
select ok((select bounded_summary not like '%secret-value%' from pm_private.evidence_references
  where id=(current_setting('test.pm_evidence')::jsonb->>'evidence_id')::uuid),'Evidence summary is redacted');

select set_config('test.pm_test',pm_private.record_test_result_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'evidence_id',current_setting('test.pm_evidence')::jsonb->>'evidence_id','expected_version',1,
  'request_id','17200000-0000-4000-8000-000000000303','idempotency_key','pm-runtime-172-test-run',
  'commit_sha',repeat('b',40),'provider','github','check_name','isolated-db','provider_run_id','run:172','status','passed',
  'started_at','2026-10-09T09:00:00Z','completed_at','2026-10-09T09:01:00Z'))::text,true);
select is(current_setting('test.pm_test')::jsonb->>'status','passed','Exact-commit test result is recorded');
select is((select state::text from pm_private.execution_cycles where id=current_setting('test.pm_cycle_id')::uuid),
  'planned','A passing test does not transition the cycle');

select is((pm_private.transition_cycle_internal_v1(jsonb_build_object('program_id','17200000-0000-4000-8000-000000000201',
  'cycle_id',current_setting('test.pm_cycle_id'),'expected_version',1,'target_state','ready','reason','Ready for work',
  'request_id','17200000-0000-4000-8000-000000000304','idempotency_key','pm-runtime-172-ready'))->>'state'),'ready','Planned transitions to ready');
select is((pm_private.transition_cycle_internal_v1(jsonb_build_object('program_id','17200000-0000-4000-8000-000000000201',
  'cycle_id',current_setting('test.pm_cycle_id'),'expected_version',2,'target_state','in_progress','reason','Work started',
  'request_id','17200000-0000-4000-8000-000000000305','idempotency_key','pm-runtime-172-start'))->>'state'),'in_progress','Ready transitions to in progress');
select is((pm_private.transition_cycle_internal_v1(jsonb_build_object('program_id','17200000-0000-4000-8000-000000000201',
  'cycle_id',current_setting('test.pm_cycle_id'),'expected_version',3,'target_state','in_review','reason','Work delivered for review',
  'delivery_commit_sha',repeat('b',40),'required_checks',jsonb_build_array('isolated-db'),
  'request_id','17200000-0000-4000-8000-000000000306','idempotency_key','pm-runtime-172-review'))->>'state'),'in_review','In progress transitions to in review');
select throws_like($$select pm_private.transition_cycle_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'expected_version',3,'target_state','blocked','reason','Stale version',
  'request_id','17200000-0000-4000-8000-000000000307','idempotency_key','pm-runtime-172-stale'))$$,
  '%pm_concurrency_conflict%','Stale transition is rejected');

select throws_like($$select pm_private.transition_cycle_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'expected_version',4,'target_state','accepted','reason','Manager attempts acceptance bypass',
  'request_id','17200000-0000-4000-8000-000000000310','idempotency_key','pm-runtime-172-accepted'))$$,
  '%pm_acceptance_decision_required%','Package manager cannot bypass independent acceptance');

select throws_like($$select pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'expected_version',4,'request_id','17200000-0000-4000-8000-000000000308','idempotency_key','pm-runtime-172-self-review',
  'commit_sha',repeat('b',40),'decision','accepted','criteria_snapshot',jsonb_build_object('tests','passed'),
  'reason','Creator cannot accept own work'))$$,
  '%pm_self_acceptance_denied%','Package creator cannot record own acceptance');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_decision',pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17200000-0000-4000-8000-000000000201','cycle_id',current_setting('test.pm_cycle_id'),
  'expected_version',4,'request_id','17200000-0000-4000-8000-000000000309','idempotency_key','pm-runtime-172-accept',
  'commit_sha',repeat('b',40),'decision','accepted','criteria_snapshot',jsonb_build_object('tests','passed'),
  'reason','Independent acceptance'))::text,true);
select is(current_setting('test.pm_decision')::jsonb->>'decision','accepted','Independent reviewer records acceptance');
select is((select state::text from pm_private.execution_cycles where id=current_setting('test.pm_cycle_id')::uuid),
  'accepted','Independent acceptance atomically transitions the cycle');
select is((select count(*) from pm_private.acceptance_decisions where cycle_id=current_setting('test.pm_cycle_id')::uuid),
  1::bigint,'Acceptance ledger is append-only evidence');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_change',pm_private.request_change_internal_v1(jsonb_build_object(
  'action','request','program_id','17200000-0000-4000-8000-000000000201','package_id',current_setting('test.pm_package_id'),
  'source_cycle_id',current_setting('test.pm_cycle_id'),'expected_version',5,
  'request_id','17200000-0000-4000-8000-000000000311','idempotency_key','pm-runtime-172-change-request',
  'requested_scope','Add bounded review evidence','impact','Documentation and isolated tests only','priority','normal'))::text,true);
select is(current_setting('test.pm_change')::jsonb->>'decision','pending','Change request starts pending');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_change_decision',pm_private.request_change_internal_v1(jsonb_build_object(
  'action','decide','program_id','17200000-0000-4000-8000-000000000201',
  'change_request_id',current_setting('test.pm_change')::jsonb->>'change_request_id','decision','approved',
  'decision_reason','Independent change approval','expected_version',5,
  'request_id','17200000-0000-4000-8000-000000000312','idempotency_key','pm-runtime-172-change-decide'))::text,true);
select is(current_setting('test.pm_change_decision')::jsonb->>'decision','approved','Independent reviewer approves change');
select is((select state::text from pm_private.execution_cycles where id=current_setting('test.pm_cycle_id')::uuid),
  'superseded','Previous cycle is retained as superseded');
select is((select state::text from pm_private.execution_cycles where id=(current_setting('test.pm_change_decision')::jsonb->>'created_cycle_id')::uuid),
  'planned','Approved change creates a linked planned cycle');
select is((select count(*) from pm_private.acceptance_decisions where cycle_id=current_setting('test.pm_cycle_id')::uuid),
  1::bigint,'Previous acceptance remains retained after reopen');
select ok((select parent_cycle_id=current_setting('test.pm_cycle_id')::uuid from pm_private.execution_cycles
  where id=(current_setting('test.pm_change_decision')::jsonb->>'created_cycle_id')::uuid),'New cycle links to its accepted predecessor');
select ok((select current_cycle_id=(current_setting('test.pm_change_decision')::jsonb->>'created_cycle_id')::uuid
  from pm_private.work_packages where id=current_setting('test.pm_package_id')::uuid),'Package points to the linked successor cycle');
select is((select count(*) from pm_private.command_receipts),9::bigint,'Successful commands persist one receipt each');
select is((select count(*) from pm_private.outbox_events),9::bigint,'Successful commands persist one outbox event each');
select ok((select bool_and(after_snapshot::text not like '%secret-value%') from audit.events where action like 'PM_%'),
  'Audit snapshots contain no submitted secret fixture');

select * from finish();
rollback;
