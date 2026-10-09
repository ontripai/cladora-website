begin;
set local search_path = public, extensions;

select plan(25);

insert into auth.users(id,email) values
  ('17410000-0000-4000-8000-000000000001','pm-authz-eligible@cladora.test'),
  ('17410000-0000-4000-8000-000000000002','pm-authz-no-platform@cladora.test'),
  ('17410000-0000-4000-8000-000000000003','pm-authz-no-role@cladora.test'),
  ('17410000-0000-4000-8000-000000000004','pm-authz-hash-peer@cladora.test');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
  ('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000001','PM-174-ELIGIBLE','PM Eligible','active'),
  ('17410000-0000-4000-8000-000000000103','17410000-0000-4000-8000-000000000003','PM-174-NO-ROLE','PM No Role','active'),
  ('17410000-0000-4000-8000-000000000104','17410000-0000-4000-8000-000000000004','PM-174-HASH-PEER','PM Hash Peer','active');
insert into platform.platform_role_assignments(platform_user_id,role,status,grant_reason) values
  ('17410000-0000-4000-8000-000000000101','PLATFORM_OPERATIONS','active','PM authorization fixture'),
  ('17410000-0000-4000-8000-000000000104','PLATFORM_AUDITOR','active','PM hash peer fixture');

insert into pm_private.programs(id,code,repository_provider,repository_id,repository_owner,repository_name) values
  ('17410000-0000-4000-8000-000000000201','CLADORA174A','github','repo-174-a','ontripai','cladora-website'),
  ('17410000-0000-4000-8000-000000000202','CLADORA174B','github','repo-174-b','ontripai','other-private');
insert into pm_private.baselines(id,program_id,version_label,controlling_commit,status,effective_at) values
  ('17410000-0000-4000-8000-000000000211','17410000-0000-4000-8000-000000000201','1.4',repeat('d',40),'current',statement_timestamp());
insert into pm_private.workstreams(id,program_id,code,owner_label,scope) values
  ('17410000-0000-4000-8000-000000000221','17410000-0000-4000-8000-000000000201','CORE174A','Core Platform','Primary authorization scope'),
  ('17410000-0000-4000-8000-000000000222','17410000-0000-4000-8000-000000000201','DOCS174A','PM Documentation','Narrower authorization scope');
insert into pm_private.assignments(program_id,platform_user_id,workstream_id,permission,effect,status,valid_from,valid_until,reason) values
  ('17410000-0000-4000-8000-000000000201','17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000221','pm.package.manage','allow','active',statement_timestamp(),null,'Active package authority'),
  ('17410000-0000-4000-8000-000000000201','17410000-0000-4000-8000-000000000101',null,'pm.package.read','allow','active',statement_timestamp(),null,'Program read authority'),
  ('17410000-0000-4000-8000-000000000201','17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000221','pm.evidence.attach','allow','expired',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day','Expired evidence authority'),
  ('17410000-0000-4000-8000-000000000201','17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000221','pm.release.read','allow','revoked',statement_timestamp(),null,'Revoked release authority');

select set_config('request.jwt.claims','{}',true);
select throws_like($$select pm_private.current_actor_v1()$$,'%pm_authentication_required%','Missing authenticated subject is denied');
select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select pm_private.current_actor_v1()$$,'%pm_platform_actor_required%','Authenticated user without platform identity is denied');
select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select pm_private.current_actor_v1()$$,'%pm_platform_eligibility_required%','Platform user without active platform role is denied');

select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select pm_private.require_permission_v1('17410000-0000-4000-8000-000000000201','pm.package.manage','17410000-0000-4000-8000-000000000221',null,true)$$,
  '%pm_mfa_required%','AAL1 cannot mutate');
select ok(pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000201','pm.package.manage','17410000-0000-4000-8000-000000000221',null),'Exact workstream manage permission is allowed');
select ok(not pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000201','pm.review.decide','17410000-0000-4000-8000-000000000221',null),'Manage does not imply review decision');
select ok(not pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000202','pm.package.read',null,null),'Program A read does not cross into program B');
select ok(not pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000201','pm.evidence.attach','17410000-0000-4000-8000-000000000221',null),'Expired assignment grants nothing');
select ok(not pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000201','pm.release.read','17410000-0000-4000-8000-000000000221',null),'Revoked assignment grants nothing');
select ok(not pm_private.has_permission_v1('17410000-0000-4000-8000-000000000101','17410000-0000-4000-8000-000000000201','pm.package.manage','17410000-0000-4000-8000-000000000222',null),'Narrow workstream assignment does not widen scope');

select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.pm_hash_a',pm_private.command_hash_v1('{"version":1}'::jsonb),true);
select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select isnt(pm_private.command_hash_v1('{"version":1}'::jsonb),current_setting('test.pm_hash_a'),'Receipt hash is actor-bound');
select set_config('request.jwt.claims','{"sub":"17410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

select throws_like($$select pm_private.get_package_internal_v1('17410000-0000-4000-8000-000000000202','17410000-0000-4000-8000-000000000299')$$,
  '%pm_package_not_found%','Cross-program object lookup does not reveal authorization detail');

create function pg_temp.pm_reject_audit_v1() returns trigger language plpgsql as $$
begin
  if new.action='PM_PACKAGE_REGISTERED' then raise exception 'synthetic_audit_failure'; end if;
  return new;
end;
$$;
create trigger pm_synthetic_audit_failure before insert on audit.events
  for each row execute function pg_temp.pm_reject_audit_v1();
select throws_like($$select pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17410000-0000-4000-8000-000000000201','baseline_id','17410000-0000-4000-8000-000000000211',
  'workstream_id','17410000-0000-4000-8000-000000000221','package_key','PM01-ATOMIC-174',
  'title','Atomic failure fixture','bounded_scope','Synthetic audit failure must roll back every write','expected_version',0,
  'request_id','17410000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-174-atomic'))$$,
  '%synthetic_audit_failure%','Injected audit failure aborts the command');
select is((select count(*) from pm_private.work_packages where package_key='PM01-ATOMIC-174'),0::bigint,'Failed command leaves no package');
select is((select count(*) from pm_private.command_receipts where request_id='17410000-0000-4000-8000-000000000301'),0::bigint,'Failed command leaves no receipt');
select is((select count(*) from pm_private.outbox_events where payload->>'request_id'='17410000-0000-4000-8000-000000000301'),0::bigint,'Failed command leaves no outbox event');
drop trigger pm_synthetic_audit_failure on audit.events;

select set_config('test.pm_authz_register',pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17410000-0000-4000-8000-000000000201','baseline_id','17410000-0000-4000-8000-000000000211',
  'workstream_id','17410000-0000-4000-8000-000000000221','package_key','PM01-ATOMIC-174',
  'title','Atomic failure fixture','bounded_scope','Synthetic audit failure must roll back every write','expected_version',0,
  'request_id','17410000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-174-atomic'))::text,true);
select is(current_setting('test.pm_authz_register')::jsonb->>'state','planned','Command succeeds after failure injector is removed');
update pm_private.assignments set status='revoked',revoked_at=statement_timestamp()
  where platform_user_id='17410000-0000-4000-8000-000000000101' and permission='pm.package.manage' and status='active';
select throws_like($$select pm_private.register_package_internal_v1(jsonb_build_object(
  'program_id','17410000-0000-4000-8000-000000000201','baseline_id','17410000-0000-4000-8000-000000000211',
  'workstream_id','17410000-0000-4000-8000-000000000221','package_key','PM01-ATOMIC-174',
  'title','Atomic failure fixture','bounded_scope','Synthetic audit failure must roll back every write','expected_version',0,
  'request_id','17410000-0000-4000-8000-000000000301','idempotency_key','pm-runtime-174-atomic'))$$,
  '%pm_access_denied%','Revoked authority cannot replay an earlier receipt');
select is((select count(*) from pm_private.command_receipts where request_id='17410000-0000-4000-8000-000000000301'),1::bigint,'Revoked replay does not duplicate its receipt');
select is((select count(*) from pm_private.outbox_events where payload->>'request_id'='17410000-0000-4000-8000-000000000301'),1::bigint,'Revoked replay does not duplicate its outbox event');
select throws_like($$update pm_private.transitions set reason='Tampered history' where command_id='17410000-0000-4000-8000-000000000301'$$,
  '%pm_history_is_append_only%','Transition history cannot be updated');
select throws_like($$delete from pm_private.transitions where command_id='17410000-0000-4000-8000-000000000301'$$,
  '%pm_history_is_append_only%','Transition history cannot be deleted');
select throws_like($$delete from pm_private.command_receipts where request_id='17410000-0000-4000-8000-000000000301'$$,
  '%pm_history_is_append_only%','Receipt history cannot be deleted');
select is(pm_private.redact_json_v1('{"items":[{"authorization":"Bearer highly-sensitive"}]}'::jsonb)#>>'{items,0,authorization}',
  '[REDACTED]','Recursive array/object redaction removes authorization values');
select is(pm_private.redact_json_v1('{"private_url":"https://private.invalid/path"}'::jsonb)->>'private_url',
  '[REDACTED]','Private URL keys are redacted');

select * from finish();
rollback;
