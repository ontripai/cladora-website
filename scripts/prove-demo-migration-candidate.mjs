import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Dedicated disposable CI daemon only. No target URL, remote credential, hosted
// query interface or production project is accepted by this proof.
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CI-only proof');
assert.equal(process.env.CLADORA_DEMO_CANDIDATE_LOCAL_PROOF, '1', 'explicit local proof gate');
assert.match(process.env.CANDIDATE_SOURCE_SHA ?? '', /^[a-f0-9]{40}$/);
assert.ok(process.env.RUNNER_TEMP, 'runner receipt directory required');
const checkout = spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});
assert.equal(checkout.status,0);
assert.equal(checkout.stdout.trim(),process.env.CANDIDATE_SOURCE_SHA,'exact candidate checkout required');
const container = 'supabase_db_cladora-demo-candidate';
const receipt = { kind:'DEMO_CANDIDATE_NATIVE_CATALOG_ONLY', commit:process.env.CANDIDATE_SOURCE_SHA,
  accepted:false, hosted_execution:false, result:'NOT_RUN_NOT_PASS', checks:[],
  application_journeys:'NOT_RUN_NOT_PASS', managed_auth:'NOT_RUN_NOT_PASS',
  operations:'NOT_INSTALLED', ce_pool:'UNFINALIZED', s3_s4_g2:'NOT_INSTALLED' };
const hash = s => createHash('sha256').update(s).digest('hex');
function docker(args, input) {
  const r = spawnSync('docker', args, {input, encoding:'utf8', maxBuffer:32*1024*1024, timeout:120000});
  if(r.error) throw Error('LOCAL_DOCKER_FAILURE');
  return r;
}
function sql(input, expectedError) {
  const r=docker(['exec','-i',container,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres',
    '-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'], input);
  if(expectedError) {
    assert.notEqual(r.status,0,'negative unexpectedly committed');
    assert.ok(r.stderr.includes('55000') && r.stderr.includes(expectedError), 'unexpected rejection (raw SQL withheld)');
    return;
  }
  assert.equal(r.status,0,'native SQL rejected (raw SQL withheld)');
  return r.stdout.trim();
}
function mark(name) {receipt.checks.push({name,result:'PASS'});}
function graph() {return sql(`select jsonb_build_object(
  'roles',(select jsonb_agg(to_jsonb(r) order by rolname) from pg_roles r),
  'edges',(select jsonb_agg(to_jsonb(m) order by roleid,member,grantor) from pg_auth_members m));`);}
function routines() {return sql(`select coalesce(jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid)) order by p.oid),'[]')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('app_private','communications') and p.prokind in ('f','p');`);}
try {
  const inspected=docker(['inspect',container]);
  assert.equal(inspected.status,0,'local container absent');
  const info=JSON.parse(inspected.stdout)[0];
  assert.equal(info.Name,'/'+container);
  assert.equal(info.Config.Labels['com.supabase.cli.project'],'cladora-demo-candidate');
  assert.ok(info.State.Running);
  assert.match(info.Config.Image,/^(?:ghcr\.io\/supabase\/|public\.ecr\.aws\/supabase\/|supabase\/)postgres:17\.6\.1\.095$/);
  receipt.image=info.Config.Image;receipt.image_id=info.Image;
  mark('exact disposable project and pinned database image');
  const actor=JSON.parse(sql(`select jsonb_build_object('user',current_user,'session',session_user,
    'superuser',rolsuper,'createrole',rolcreaterole,'version',current_setting('server_version_num'))
    from pg_roles where rolname=current_user;`));
  assert.equal(actor.user,'postgres');assert.equal(actor.session,'postgres');
  assert.equal(actor.superuser,false);assert.equal(actor.createrole,true);
  receipt.actor=actor; mark('non-superuser postgres installer');
  const applied=JSON.parse(sql(`select jsonb_agg(version order by version) from supabase_migrations.schema_migrations;`));
  const baseline=JSON.parse(readFileSync('supabase/local-profiles/baseline-v14.manifest.json'));
  const held=['20261018163000','20261018170000','20261025214155'];
  const expected=baseline.source_migrations.map(r=>r.name.slice(0,14)).filter(v=>!held.includes(v));
  assert.deepEqual(applied,expected);receipt.applied_count=applied.length;
  mark('exact 297 real migration history entries; S3 S4 G2 absent');
  const missingOperations=sql(`select to_regprocedure('customer_api.operations_command_v1(text,uuid,uuid,text,text)') is null
    and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('customer_api','app_private') and p.proname in ('operations_command_v1','operations_command_v2'));`);
  assert.equal(missingOperations,'t'); mark('missing Operations backend reported as held');
  const closure=readFileSync('supabase/demo-proposals/communications-deny-only-closure.proposal.sql','utf8');
  assert.equal((closure.match(/^begin;$/gm)||[]).length,1);
  assert.equal((closure.match(/^commit;$/gm)||[]).length,1);
  receipt.closure_sha256=hash(closure);
  const graphBefore=graph(), routinesBefore=routines();
  const negatives=[
    ['altered direct privilege prestate','revoke select on communications.private_messages from service_role;', 'communications_service_role_acl_shutdown_unexpected_prestate'],
    ['RLS disabled','alter table communications.private_messages disable row level security;', 'communications_service_role_acl_shutdown_rls_precondition_failed'],
    ['S2 became callable',`grant execute on function app_private.execute_service_request_message_link_v2(text,uuid,uuid,uuid,uuid,bigint,uuid,bigint) to authenticated;`, 'demo_candidate_s1_s2_private_boundary_invalid'],
    ['S3 role unexpectedly present','create role cladora_service_subject_link_runtime nologin;', 'demo_candidate_requires_s3_absent'],
    ['inherited PUBLIC column privilege','grant select (id) on communications.private_messages to public;', 'communications_service_role_effective_acl_remains'],
    ['PUBLIC policy path','create policy demo_candidate_forbidden_public on communications.private_messages for select to public using(true);', 'communications_service_role_policy_path_remains'],
  ];
  for(const [name,mutation,error] of negatives) {
    const query=closure.replace(/^begin;$/m,'begin;\n'+mutation).replace(/^commit;$/m,'rollback;');
    sql(query,error);assert.equal(graph(),graphBefore);assert.equal(routines(),routinesBefore);
    mark('rollback rejection: '+name);
  }
  sql(closure); mark('distinct deny-only closure native commit');
  assert.equal(graph(),graphBefore);assert.equal(routines(),routinesBefore);
  receipt.role_graph_sha256=hash(graphBefore);receipt.private_routines_sha256=hash(routinesBefore);
  mark('role graph and private function bodies unchanged');
  sql(closure,'communications_service_role_acl_shutdown_unexpected_prestate');
  mark('repeat application rejected');
  assert.equal(sql(`select count(*) from (values
    ('communications.private_conversations'),('communications.private_participants'),
    ('communications.private_messages'),('communications.private_message_documents')) t(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
    where has_table_privilege('service_role',t.name,p);`),'0');
  mark('independent effective service_role table denial');
  assert.equal(sql(`select count(*) from (values
    ('customer_api.get_my_platform_auth_context_v1()'),('customer_api.my_profile_v1()'),
    ('customer_api.create_customer_workspace_v1(uuid,text,text,text)'),
    ('customer_api.create_workspace_invitation_v1(uuid,text,uuid,text,interval,text)')) t(signature)
    where to_regprocedure(signature) is not null;`),'4');
  mark('baseline onboarding routine declarations present (not runtime authority proof)');
  receipt.result='PASS_NATIVE_CATALOG_ONLY';
  console.log(JSON.stringify(receipt));
} catch(e) {
  receipt.result='FAILED';receipt.failure=String(e.message).slice(0,300);
  console.error(JSON.stringify(receipt));process.exitCode=1;
} finally {
  writeFileSync(join(process.env.RUNNER_TEMP,'cladora-demo-native.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
}
