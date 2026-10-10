begin;
set local search_path = public, extensions;

select plan(23);

insert into auth.users(id,email) values
  ('17500000-0000-4000-8000-000000000001','pm-manager-175@cladora.test'),
  ('17500000-0000-4000-8000-000000000002','pm-reviewer-175@cladora.test');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
  ('17500000-0000-4000-8000-000000000101','17500000-0000-4000-8000-000000000001','PM-175-MANAGER','PM Manager','active'),
  ('17500000-0000-4000-8000-000000000102','17500000-0000-4000-8000-000000000002','PM-175-REVIEWER','PM Reviewer','active');
insert into platform.platform_role_assignments(platform_user_id,role,status,grant_reason) values
  ('17500000-0000-4000-8000-000000000101','PLATFORM_OPERATIONS','active','Acceptance gate manager fixture'),
  ('17500000-0000-4000-8000-000000000102','PLATFORM_AUDITOR','active','Acceptance gate reviewer fixture');

insert into pm_private.programs(id,code,repository_provider,repository_id,repository_owner,repository_name) values
  ('17500000-0000-4000-8000-000000000201','CLADORA175','github','repo-175','ontripai','cladora-website');
insert into pm_private.baselines(id,program_id,version_label,controlling_commit,status,effective_at) values
  ('17500000-0000-4000-8000-000000000202','17500000-0000-4000-8000-000000000201','1.4',repeat('a',40),'current',statement_timestamp());
insert into pm_private.workstreams(id,program_id,code,owner_label,scope) values
  ('17500000-0000-4000-8000-000000000203','17500000-0000-4000-8000-000000000201','CORE175','Core Platform','Acceptance gate fixture');
insert into pm_private.assignments(program_id,platform_user_id,workstream_id,permission,effect,reason) values
  ('17500000-0000-4000-8000-000000000201','17500000-0000-4000-8000-000000000101','17500000-0000-4000-8000-000000000203','pm.package.manage','allow','Manager lifecycle authority'),
  ('17500000-0000-4000-8000-000000000201','17500000-0000-4000-8000-000000000101','17500000-0000-4000-8000-000000000203','pm.evidence.attach','allow','Manager test evidence authority'),
  ('17500000-0000-4000-8000-000000000201','17500000-0000-4000-8000-000000000102','17500000-0000-4000-8000-000000000203','pm.review.decide','allow','Independent acceptance authority');

insert into pm_private.work_packages(
  id,program_id,baseline_id,workstream_id,package_key,title,bounded_scope,status,version,created_by
) values (
  '17500000-0000-4000-8000-000000000211','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000202','17500000-0000-4000-8000-000000000203',
  'PM01-GATE-175','Acceptance gate fixture','Exact delivery authorization acceptance gate','in_review',4,
  '17500000-0000-4000-8000-000000000101'
);
insert into pm_private.execution_cycles(
  id,program_id,package_id,cycle_number,state,delivery_commit_sha,required_checks,version,created_by
) values (
  '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000211',1,'in_review',repeat('d',40),
  array['authorization','isolated-db'],4,'17500000-0000-4000-8000-000000000101'
);
update pm_private.work_packages set current_cycle_id='17500000-0000-4000-8000-000000000212'
  where id='17500000-0000-4000-8000-000000000211';

select ok(not pm_private.valid_transition_v1('in_review','accepted'),
  'Generic lifecycle graph has no in_review to accepted edge');

select set_config('request.jwt.claims','{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select pm_private.transition_cycle_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'target_state','accepted','reason','Manager acceptance bypass attempt',
  'request_id','17500000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-175-bypass'))$$,
  '%pm_acceptance_decision_required%','Package manager cannot accept through the generic transition command');
select throws_like($$select pm_private.record_test_result_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('d',40),'provider','github','check_name','isolated-db',
  'provider_run_id','run:175:no-evidence','status','passed','request_id','17500000-0000-4000-8000-000000000302',
  'idempotency_key','pm-runtime-175-no-evidence'))$$,
  '%pm_passed_test_evidence_required%','A passed observation requires passed evidence for the exact cycle and commit');

insert into pm_private.evidence_references(
  id,program_id,cycle_id,commit_sha,evidence_type,provider,provider_reference,result,attached_by
) values
  ('17500000-0000-4000-8000-000000000401','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212',repeat('c',40),'ci_run','github','github:run:175:stale','passed',
    '17500000-0000-4000-8000-000000000101'),
  ('17500000-0000-4000-8000-000000000402','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212',repeat('d',40),'ci_run','github','github:run:175:delivery','passed',
    '17500000-0000-4000-8000-000000000101');
insert into pm_private.test_runs(
  id,program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,recorded_by,created_at
) values
  ('17500000-0000-4000-8000-000000000411','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000401',repeat('c',40),
    'github','authorization','run:175:stale-auth','passed','17500000-0000-4000-8000-000000000101',statement_timestamp()-interval '4 minutes'),
  ('17500000-0000-4000-8000-000000000412','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000402',repeat('d',40),
    'github','isolated-db','run:175:delivery-db','passed','17500000-0000-4000-8000-000000000101',statement_timestamp()-interval '3 minutes');

select set_config('request.jwt.claims','{"sub":"17500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('c',40),'decision','accepted','criteria_snapshot',jsonb_build_object('checks','passed'),
  'reason','Stale commit must not be accepted','request_id','17500000-0000-4000-8000-000000000303',
  'idempotency_key','pm-runtime-175-stale-commit'))$$,
  '%pm_acceptance_commit_mismatch%','Reviewer cannot accept a commit other than the bound delivery');
select throws_like($$select pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('d',40),'decision','accepted','criteria_snapshot',jsonb_build_object('checks','passed'),
  'reason','Unrelated passing check must not count','request_id','17500000-0000-4000-8000-000000000304',
  'idempotency_key','pm-runtime-175-unrelated'))$$,
  '%pm_acceptance_required_checks_missing%','A passed check from an unrelated commit cannot satisfy acceptance');

insert into pm_private.test_runs(
  id,program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,recorded_by,created_at
) values
  ('17500000-0000-4000-8000-000000000413','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000402',repeat('d',40),
    'github','authorization','run:175:delivery-auth-pass','passed','17500000-0000-4000-8000-000000000101',statement_timestamp()-interval '2 minutes'),
  ('17500000-0000-4000-8000-000000000414','17500000-0000-4000-8000-000000000201',
    '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000402',repeat('d',40),
    'github','authorization','run:175:delivery-auth-fail','failed','17500000-0000-4000-8000-000000000101',statement_timestamp()-interval '1 minute');
select throws_like($$select pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('d',40),'decision','accepted','criteria_snapshot',jsonb_build_object('checks','passed'),
  'reason','Latest failed check blocks acceptance','request_id','17500000-0000-4000-8000-000000000305',
  'idempotency_key','pm-runtime-175-latest-failed'))$$,
  '%pm_acceptance_required_checks_missing%','Latest failed exact-commit observation overrides an older pass');

insert into pm_private.test_runs(
  id,program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,recorded_by,created_at
) values (
  '17500000-0000-4000-8000-000000000415','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000212','17500000-0000-4000-8000-000000000402',repeat('d',40),
  'github','authorization','run:175:delivery-auth-final','passed','17500000-0000-4000-8000-000000000101',statement_timestamp()
);
select set_config('test.pm_accept',pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('d',40),'decision','accepted',
  'criteria_snapshot',jsonb_build_object('checks','passed','token','secret-value'),
  'reason','Independent exact delivery acceptance','request_id','17500000-0000-4000-8000-000000000306',
  'idempotency_key','pm-runtime-175-accept'))::text,true);
select is(current_setting('test.pm_accept')::jsonb->>'state','accepted','Accepted decision returns the atomic lifecycle state');
select is((select state::text from pm_private.execution_cycles where id='17500000-0000-4000-8000-000000000212'),
  'accepted','Accepted decision atomically updates the cycle');
select is((select delivery_commit_sha from pm_private.acceptance_decisions where cycle_id='17500000-0000-4000-8000-000000000212'),
  repeat('d',40),'Acceptance ledger snapshots the exact delivery commit');
select is((select actor_id from pm_private.transitions where command_id='17500000-0000-4000-8000-000000000306'),
  '17500000-0000-4000-8000-000000000102'::uuid,'Acceptance transition is authored by the independent reviewer');
select is((select count(*) from pm_private.command_receipts where request_id='17500000-0000-4000-8000-000000000306'),
  1::bigint,'Atomic acceptance creates one receipt');
select is((select count(*) from pm_private.outbox_events where payload->>'request_id'='17500000-0000-4000-8000-000000000306'),
  1::bigint,'Atomic acceptance creates one outbox event');
select is((select count(*) from audit.events where request_id='17500000-0000-4000-8000-000000000306'),
  1::bigint,'Atomic acceptance creates one audit event');
select is((select criteria_snapshot->>'token' from pm_private.acceptance_decisions
  where cycle_id='17500000-0000-4000-8000-000000000212'),'[REDACTED]','Acceptance criteria are redacted');
select ok((pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000212',
  'expected_version',4,'commit_sha',repeat('d',40),'decision','accepted',
  'criteria_snapshot',jsonb_build_object('checks','passed','token','secret-value'),
  'reason','Independent exact delivery acceptance','request_id','17500000-0000-4000-8000-000000000306',
  'idempotency_key','pm-runtime-175-accept'))->>'idempotent')::boolean,
  'Exact acceptance replay returns the stored response');
select is((select count(*) from pm_private.acceptance_decisions where cycle_id='17500000-0000-4000-8000-000000000212'),
  1::bigint,'Acceptance replay does not duplicate the decision');
select is((select count(*) from pm_private.transitions where command_id='17500000-0000-4000-8000-000000000306'),
  1::bigint,'Acceptance replay does not duplicate the transition');

insert into pm_private.work_packages(
  id,program_id,baseline_id,workstream_id,package_key,title,bounded_scope,status,version,created_by
) values (
  '17500000-0000-4000-8000-000000000221','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000202','17500000-0000-4000-8000-000000000203',
  'PM01-ROLLBACK-175','Acceptance rollback fixture','Audit failure must roll back every acceptance write','in_review',4,
  '17500000-0000-4000-8000-000000000101'
);
insert into pm_private.execution_cycles(
  id,program_id,package_id,cycle_number,state,delivery_commit_sha,required_checks,version,created_by
) values (
  '17500000-0000-4000-8000-000000000222','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000221',1,'in_review',repeat('e',40),array['isolated-db'],4,
  '17500000-0000-4000-8000-000000000101'
);
update pm_private.work_packages set current_cycle_id='17500000-0000-4000-8000-000000000222'
  where id='17500000-0000-4000-8000-000000000221';
insert into pm_private.evidence_references(
  id,program_id,cycle_id,commit_sha,evidence_type,provider,provider_reference,result,attached_by
) values (
  '17500000-0000-4000-8000-000000000421','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000222',repeat('e',40),'ci_run','github','github:run:175:rollback','passed',
  '17500000-0000-4000-8000-000000000101'
);
insert into pm_private.test_runs(
  id,program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,recorded_by
) values (
  '17500000-0000-4000-8000-000000000422','17500000-0000-4000-8000-000000000201',
  '17500000-0000-4000-8000-000000000222','17500000-0000-4000-8000-000000000421',repeat('e',40),
  'github','isolated-db','run:175:rollback','passed','17500000-0000-4000-8000-000000000101'
);

create function pg_temp.pm_reject_acceptance_audit_v1() returns trigger language plpgsql as $$
begin
  if new.action='PM_ACCEPTANCE_RECORDED' then raise exception 'synthetic_acceptance_audit_failure'; end if;
  return new;
end;
$$;
create trigger pm_synthetic_acceptance_audit_failure before insert on audit.events
  for each row execute function pg_temp.pm_reject_acceptance_audit_v1();
select throws_like($$select pm_private.record_acceptance_internal_v1(jsonb_build_object(
  'program_id','17500000-0000-4000-8000-000000000201','cycle_id','17500000-0000-4000-8000-000000000222',
  'expected_version',4,'commit_sha',repeat('e',40),'decision','accepted','criteria_snapshot',jsonb_build_object('checks','passed'),
  'reason','Synthetic rollback acceptance','request_id','17500000-0000-4000-8000-000000000399',
  'idempotency_key','pm-runtime-175-rollback'))$$,
  '%synthetic_acceptance_audit_failure%','Audit failure aborts the complete acceptance transaction');
select is((select state::text from pm_private.execution_cycles where id='17500000-0000-4000-8000-000000000222'),
  'in_review','Failed acceptance leaves the cycle in review');
select is((select count(*) from pm_private.acceptance_decisions where cycle_id='17500000-0000-4000-8000-000000000222'),
  0::bigint,'Failed acceptance leaves no decision');
select is((select count(*) from pm_private.transitions where command_id='17500000-0000-4000-8000-000000000399'),
  0::bigint,'Failed acceptance leaves no transition');
select is((select count(*) from pm_private.command_receipts where request_id='17500000-0000-4000-8000-000000000399'),
  0::bigint,'Failed acceptance leaves no receipt');
select is((select count(*) from pm_private.outbox_events where payload->>'request_id'='17500000-0000-4000-8000-000000000399'),
  0::bigint,'Failed acceptance leaves no outbox event');

select * from finish();
rollback;
