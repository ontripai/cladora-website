import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  TASK, PARENT, ROUTE, Cleanup, check, readExecutionLease, inspectTarget, makeActor,
  createDatabaseFixture, canonicalAssignments, startNext, nextRequest, snapshot,
  deniedUnchanged, revokeOwned, assertSessionsGone, leaseLive,createAndRecover,settledRequests,assertFreePort,
} from './lib/core-building-setup-http-fixture.mjs';

export function help() {
  return [
    TASK + ' (no Docker/startup/remote target fallback)',
    'Offline: node scripts/test-core-building-setup-http-safety.mjs',
    'Runtime only after a separately assigned official disposable lease:',
    'BUILDING_SETUP_HTTP_EPHEMERAL=1 BUILDING_SETUP_HTTP_LEASE_FILE=/absolute/private/lease.json node scripts/core-building-setup-http-proof.mjs --run',
    'Lease file: regular, current-UID owned, mode 0600, <=8192 bytes. Exact fields:',
    'version=1; task='+TASK+'; worker=CLADORA-CORE-WORKER-01; sha=clean checked-out HEAD descending from '+PARENT+';',
    'run_id=UUID; lease_id=building-http-<run_id>-<sha>; expires_at=ISO timestamp within 4 hours;',
    'project_ref=cladora-local; app_origin=http://127.0.0.1:<assigned free port>;',
    'api_origin=http://127.0.0.1:54321; db_port=54322; db_container_id/auth_container_id=exact live full Docker IDs;',
    'fixture_prefix=reserved random 8 lowercase hex characters, excluding c2200000.',
    'Provisioner must separately set the same lease_id in current_setting(cladora.synthetic_setup_lease) on the official postgres DB.',
    'Required installed dependencies: locked repository packages, official Supabase CLI on PATH and the assigned already-running official local stack.',
    'Official CLI must be the approved 2.84.2; version/status-help are checked before reading status.',
    'No endpoint/key/DB URL overrides: endpoints/keys come only from verified official CLI status.',
    'Optional owned-cleanup fault: BUILDING_SETUP_HTTP_INJECT_FAILURE=after-auth|after-fixture|after-next|after-recovery.',
    'Only real Next HTTP + Auth-issued TOTP AAL2 + existing public v2 RPCs count as connected proof.',
    'Discarded committed response is controlled application-level response loss; no wire-loss claim.',
    'Cleanup revokes own authority/sessions, soft-deletes own Auth users and gracefully closes owned Next/port.',
    'Immutable synthetic domain/audit history is retained; provisioner must tear down the leased disposable stack. No FORCE/foreign termination.',
  ].join('\n');
}

export async function runConnected() {
  let phase = 'preflight';
  const cleanup = new Cleanup();
  const users = [];
  const ownedUsers = [];
  let pool;
  let lease;
  let primary;
  let cleaned = false;
  let resourcesAcquired = false;
  let connectedStarted = false;
  const cancel = new AbortController();
  const stop = () => cancel.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const setPhase = name => {phase=name;check(!cancel.signal.aborted,'CANCELLED');if(lease)leaseLive(lease);};
  const inject = point => {
    if(process.env.BUILDING_SETUP_HTTP_INJECT_FAILURE===point) throw Error('BH_INJECTED');
  };
  try {
    lease = await readExecutionLease();
    const status = await inspectTarget(lease);
    await assertFreePort(Number(new URL(lease.app_origin).port));
    // Imports/clients happen only after static lease and official container gates.
    const [{createClient},{createServerClient},{default:pg}] = await Promise.all([
      import('@supabase/supabase-js'),import('@supabase/ssr'),import('pg')
    ]);
    pool = new pg.Pool({connectionString:status.DB_URL,max:4,connectionTimeoutMillis:5000,
      query_timeout:15_000,statement_timeout:15_000,application_name:TASK});
    pool.on('error',()=>cancel.abort());
    cleanup.add('POOL',()=>pool.end());
    const identity=(await pool.query("select current_database() db,current_setting('cladora.synthetic_setup_lease',true) lease")).rows[0];
    check(identity.db==='postgres' && identity.lease===lease.lease_id,'DATABASE_LEASE');
    cleanup.add('SESSIONS',()=>assertSessionsGone(pool,ownedUsers));
    setPhase('real-auth-aal2');
    for(const label of ['operator','manager','reviewer','outsider']) {
      // makeActor registers cleanup immediately upon creation, including partial failure.
      const actor=await makeActor({lease,status,createClient,createServerClient,cleanup,label,
        onCreated:record=>{ownedUsers.push(record);resourcesAcquired=true;}});
      users.push(actor);
    }
    cleanup.add('AUTHORITY',()=>revokeOwned(pool,lease,ownedUsers));
    inject('after-auth');
    check((await pool.query("select count(*)::integer n from auth.users where id=any($1::uuid[]) and email_confirmed_at is not null",
      [users.map(a=>a.userId)])).rows[0].n===4,'AUTH_DATABASE_MATCH');
    setPhase('canonical-native-fixture');
    const fixture=await createDatabaseFixture(pool,lease,users);
    const {ids}=fixture;
    const native=await canonicalAssignments(lease,fixture);
    const reviewerMembership=(await pool.query("select membership_id id from platform.pilot_setup_reviewers where id=$1",[ids[210]])).rows[0]?.id;
    check(reviewerMembership,'REVIEWER_MEMBERSHIP');
    await native.assignReviewer(reviewerMembership);
    check((await pool.query("select count(*)::integer n,bool_and(authority_policy_version=2) canonical from platform.workspace_member_roles where tenant_id=$1",[ids[10]])).rows[0].n===5,'CANONICAL_ASSIGNMENT_COUNT');
    check((await pool.query("select bool_and(authority_policy_version=2) valid from platform.workspace_member_roles where tenant_id=$1",[ids[10]])).rows[0].valid,'CANONICAL_ASSIGNMENTS');
    await pool.query("insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values($1,$2,'ASSOCIATION','Synthetic sibling','PILOT','ACTIVE'),($3,$4,'ASSOCIATION','Synthetic foreign','PILOT','ACTIVE')",
      [ids[51],ids[10],ids[60],ids[20]]);
    inject('after-fixture');
    setPhase('next-start');
    await startNext(lease,status.ANON_KEY,cleanup,cancel.signal);
    inject('after-next');
    const [operator,,reviewer,outsider]=users;
    const base={context_id:ids[100],workspace_id:ids[50]};
    const reviewBase={context_id:native.reviewerContext,workspace_id:ids[50]};
    const payload={association:{name:'Synthetic HTTP RO Association'},building:{name:'Synthetic Building',code:'HTTP',floors:2},
      currency:'RON',period_start:'2026-01-01',period_end:'2026-01-31',
      units:[{code:'1',floor:0,area_m2:50},{code:'2',floor:1,area_m2:60}],opening_balances:[]};
    const key='bh-'+lease.run_id+'-create';
    const create={...base,idempotency_key:key,payload};
    const request=(actor,options)=>nextRequest(lease,actor?.cookie,options);
    const attemptPath=(b,k=key)=>ROUTE+'?'+new URLSearchParams({...b,idempotency_key:k});
    const readRun=(actor,id,b=base)=>request(actor,{path:ROUTE+'/'+id+'?'+new URLSearchParams(b)});
    const expect = (r,status) => {assert.equal(r.status,status);return r.data;};
    const before=await snapshot(pool);
    setPhase('request-safety');
    connectedStarted=true;
    await deniedUnchanged(pool,()=>request(operator,{method:'POST',body:create,badOrigin:true}),403);
    await deniedUnchanged(pool,()=>request(null,{path:attemptPath(base)}),403);
    await deniedUnchanged(pool,()=>request(outsider,{path:attemptPath(base)}),403);
    const aal1=await deniedUnchanged(pool,()=>nextRequest(lease,operator.aal1Cookie,{path:attemptPath(base)}),403);
    assert.equal(aal1.data.error.code,'MFA_REQUIRED');
    const missing=expect(await request(operator,{path:attemptPath(base)}),200);
    assert.equal(missing.attempt,null);
    assert.deepEqual(await snapshot(pool),before);
    setPhase('ambiguous-create-recovery');
    const recovered=await createAndRecover(lease,operator.cookie,create);
    check(recovered?.run_id && recovered.revision===1 && recovered.workspace_id===ids[50],'RECOVERY');
    const run=recovered.run_id;
    const replay=expect(await request(operator,{method:'POST',body:create}),201);
    assert.equal(replay.run_id,run);
    assert.equal((await pool.query("select count(*)::integer n from platform.building_setup_runs where tenant_id=$1 and idempotency_key=$2",[ids[10],key])).rows[0].n,1);
    inject('after-recovery');
    setPhase('concurrent-creation-and-key-collision');
    const key2=key+'-parallel';
    const results=await settledRequests([1,2].map(()=>request(operator,{method:'POST',body:{...create,idempotency_key:key2}})));
    results.forEach(r=>expect(r,201));
    assert.equal(results[0].data.run_id,results[1].data.run_id);
    assert.notEqual(results[0].data.run_id,run);
    assert.equal((await pool.query("select count(*)::integer n from platform.building_setup_runs where tenant_id=$1 and idempotency_key=$2",[ids[10],key2])).rows[0].n,1);
    await deniedUnchanged(pool,()=>request(operator,{method:'POST',body:{...create,payload:{...payload,building:{...payload.building,name:'Changed intent'}}}}),409);
    await deniedUnchanged(pool,()=>request(operator,{path:attemptPath({...base,workspace_id:ids[51]})}),403);
    await deniedUnchanged(pool,()=>request(operator,{path:attemptPath({...base,workspace_id:ids[60]})}),403);
    await deniedUnchanged(pool,()=>readRun(outsider,run),403);
    setPhase('concurrent-revision');
    const update=(suffix,revision=1)=>({...base,expected_revision:revision,command_key:'bh-'+lease.run_id+'-edit-'+suffix,
      units:[{code:'1',floor:0,area_m2:55},{code:'2',floor:1,area_m2:60}]});
    const edits=await settledRequests(['a','b'].map(suffix=>request(operator,{path:ROUTE+'/'+run,method:'PATCH',body:update(suffix)})));
    assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
    const current=expect(await readRun(operator,run),200);
    assert.equal(current.revision,2);
    assert.deepEqual(current.payload.units,update('a').units);
    await deniedUnchanged(pool,()=>request(operator,{path:ROUTE+'/'+run,method:'PATCH',body:update('stale')}),409);
    const winner=edits.find(r=>r.status===200).data;
    await deniedUnchanged(pool,()=>request(operator,{path:ROUTE+'/'+run,method:'PATCH',
      body:{...update(winner.command_key.endsWith('-a')?'a':'b'),units:payload.units}}),409);
    const command=(actor,action,revision,b=base,extra={})=>request(actor,{
      path:ROUTE+'/'+run+'/'+action,method:'POST',
      body:{...b,expected_revision:revision,command_key:'bh-'+lease.run_id+'-'+action+'-r'+revision,...extra}});
    setPhase('rehearse-submit-approval-snapshot');
    const rehearsed=expect(await command(operator,'rehearse',2),200);
    assert.equal(rehearsed.revision,3);assert.equal(rehearsed.status,'rehearsed');
    const submitted=expect(await command(operator,'submit',3),200);
    assert.equal(submitted.revision,4);assert.equal(submitted.status,'submitted');
    const review=expect(await readRun(reviewer,run,reviewBase),200);
    assert.equal(review.submitted_revision,review.revision);
    assert.equal(review.submitted_payload_hash,review.payload_hash);
    // First prove operator has approval authority, so self-denial is not a missing permission false positive.
    const selfRead=expect(await readRun(operator,run),200);
    assert.equal(selfRead.run_id,run);
    await deniedUnchanged(pool,()=>command(operator,'approve',4,base,{expected_payload_hash:review.payload_hash}),403);
    await deniedUnchanged(pool,()=>command(reviewer,'approve',4,reviewBase,{expected_payload_hash:'0'.repeat(64)}),409);
    await deniedUnchanged(pool,()=>command(reviewer,'provision',4,reviewBase),403);
    await deniedUnchanged(pool,()=>request(reviewer,{path:ROUTE+'/'+run,method:'PATCH',
      body:{...update('reviewer',4),...reviewBase}}),403);
    const approved=expect(await command(reviewer,'approve',4,reviewBase,{expected_payload_hash:review.payload_hash}),200);
    assert.equal(approved.revision,5);assert.equal(approved.status,'approved');
    setPhase('provision-and-exact-replay');
    const provisioned=expect(await command(operator,'provision',5),200);
    assert.equal(provisioned.revision,6);assert.equal(provisioned.status,'provisioned');
    const stable=await snapshot(pool);
    assert.deepEqual(expect(await command(operator,'provision',5),200),provisioned);
    assert.deepEqual(await snapshot(pool),stable);
    const row=(await pool.query("select * from platform.building_setup_runs where id=$1",[run])).rows[0];
    check(row.approved_by===reviewer.userId && row.submitted_by===operator.userId && row.approved_submitted_revision===4
      && row.approved_payload_hash===review.payload_hash,'APPROVAL_BINDING');
    assert.equal((await pool.query("select count(*)::integer n from portfolio.units u join portfolio.buildings b on b.id=u.building_id where b.property_id=$1",[row.property_id])).rows[0].n,2);
    const after=await snapshot(pool);
    assert.deepEqual(after['finance.journals'],before['finance.journals']);
    assert.deepEqual(after['finance.journal_entries'],before['finance.journal_entries']);
    assert.equal((await pool.query("select count(*)::integer n from platform.building_setup_runs where customer_workspace_id=any($1::uuid[])",[[ids[51],ids[60]]])).rows[0].n,0);
    assert.equal((await pool.query("select count(*)::integer n from portfolio.properties where tenant_id=$1",[ids[20]])).rows[0].n,0);
    setPhase('reviewer-revoke-replay');
    // Controlled own fixture revocation; snapshot is AFTER revocation, before denied replay.
    await pool.query("update platform.pilot_setup_reviewers set status='revoked',revoked_at=statement_timestamp() where id=$1 and activated_by=$2",[ids[210],reviewer.userId]);
    await deniedUnchanged(pool,()=>readRun(reviewer,run,reviewBase),403);
    await deniedUnchanged(pool,()=>command(reviewer,'approve',4,reviewBase,{expected_payload_hash:review.payload_hash}),403);
    setPhase('operator-revoke-recovery-replay');
    await revokeOwned(pool,lease,[operator]);
    await deniedUnchanged(pool,()=>request(operator,{path:attemptPath(base)}),403);
    await deniedUnchanged(pool,()=>request(operator,{method:'POST',body:create}),403);
    await deniedUnchanged(pool,()=>command(operator,'provision',5),403);
    await deniedUnchanged(pool,()=>readRun(operator,run),403);
    setPhase('cleanup');
  } catch(error) {primary=error;}
  finally {
    try {await cleanup.close();cleaned=true;}
    catch {primary=Error('BH_CLEANUP_FAILED');}
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  }
  // Do not emit SDK/SQL/HTTP bodies, keys, tokens, cookies, command stderr or error causes.
  const result={task:TASK,sha:lease?.sha??null,result:primary?'FAIL':'PASS',phase,
    failure:primary ? (/^BH_[A-Z0-9_]{1,180}$/.test(primary.message)?primary.message:'BH_ASSERTION_OR_DEPENDENCY') : null,
    assertion_actual:typeof primary?.actual==='number'||typeof primary?.actual==='boolean'?primary.actual:undefined,
    assertion_expected:typeof primary?.expected==='number'||typeof primary?.expected==='boolean'?primary.expected:undefined,
    cleanup:!cleaned?'FAILED':resourcesAcquired?'LOGICAL_AUTHORITY_SESSION_AND_OWNED_PROCESS_CLEANED':'NOT_REQUIRED_NO_RESOURCES_ACQUIRED',
    retained_history:resourcesAcquired?'OWN_SYNTHETIC_IMMUTABLE_HISTORY_REQUIRES_LEASED_STACK_TEARDOWN':'NONE_CREATED',
    connected:connectedStarted?(primary?'FAIL':'PASS'):'NOT_RUN_NOT_PASS',
    transport:connectedStarted?'REAL_NEXT_AUTH_AAL2_RPC_POSTGRES':'NOT_RUN_NOT_PASS',
    browser:'NOT_RUN_NOT_PASS',production:'NOT_RUN_NOT_PASS'};
  console.log(JSON.stringify(result));
  return primary?1:0;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--help') console.log(help());
  else if(args.length===1 && args[0]==='--run') process.exitCode=await runConnected();
  else {console.error(JSON.stringify({task:TASK,result:'BLOCKED',failure:'BH_EXPLICIT_RUN_OR_HELP_REQUIRED'}));process.exitCode=1;}
}
