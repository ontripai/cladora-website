/** EXECUTABLE TEST SOURCE — NOT RUN in this delivery.
 * Explicit future DB authorization + connected task-owned disposable clients only.
 * No driver import/connect/start/URL/environment read; importing executes no SQL.
 * SQL-session claims/native fixtures are NOT issued Auth/HTTP proof. No authority
 * stubs, provider session mutation, grant, install, or product helper replacement.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const stores=['platform.building_setup_runs','platform.building_setup_command_receipt_epochs',
 'platform.building_setup_command_coverage','platform.building_setup_command_receipts',
 'audit.events','platform.outbox_events','portfolio.properties','portfolio.buildings','portfolio.units',
 'finance.accounting_periods','platform.workspace_property_bindings','identity.context_grants',
 'app_private.canonical_authority_revision_v1'];
const rpcNames=new Set(['create_building_setup_v2','update_building_setup_units_v2','rehearse_building_setup_v2',
 'get_building_setup_command_receipt_v1','get_building_setup_attempt_v2']);
const uuid=s=>assert.match(s,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
export async function fingerprint(client){
 const result=[];
 for(const table of stores){
  const r=await client.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table} t`);
  result.push([table,r.rows[0].rows]);
 }
 return result;
}
async function transaction(client,claims,fn,{commit=true}={}){
 await client.query('begin isolation level read committed');
 let open=true;
 try{
  await client.query('set local statement_timeout=15000');
  await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
  await client.query('set local role authenticated');
  const value=await fn(client);
  await client.query(commit?'commit':'rollback');open=false;return value;
 }finally{if(open)await client.query('rollback');}
}
async function rpc(client,name,args){
 assert.ok(rpcNames.has(name),'fixed RPC allowlist, never caller-selected SQL');
 const p=args.map((_,i)=>`$${i+1}`).join(',');
 return (await client.query(`select customer_api.${name}(${p}) as result`,args)).rows[0].result;
}
async function waitForBlocking(controller,pid,blocker){
 const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  const r=await controller.query('select $2::integer=any(pg_blocking_pids($1::integer)) as blocked',[pid,blocker]);
  if(r.rows[0].blocked)return;
  // Bounded polling observes actual server blocking, never a guessed sleep oracle.
  await controller.query('select pg_sleep(0.01)');
 }
 assert.fail('A never demonstrably blocked on the controlled run lock');
}

export async function runCommandReceiptConcurrencySource({authorization,controller,a,b,fixture}){
 assert.equal(authorization,'FUTURE_SEPARATELY_AUTHORIZED_DISPOSABLE_PG17');
 for(const c of [controller,a,b])assert.equal(typeof c?.query,'function');
 assert.equal(fixture.owned_disposable,true,'no staging/production fallback');
 for(const k of ['context','workspace'])uuid(fixture[k]);
 uuid(fixture.claims.sub);uuid(fixture.claims.session_id);
 assert.equal(fixture.claims.aal,'aal2');assert.equal(fixture.claims.role,'authenticated');
 const query=a=>[fixture.context,fixture.workspace,...a];
 const call=(client,name,args,options)=>transaction(client,fixture.claims,c=>rpc(c,name,args),options);
 const create=async()=>call(a,'create_building_setup_v2',query([`g2-source-${randomUUID()}`,JSON.stringify(fixture.payload)]));
 const key=(run,rev,suffix)=>`setup-${run}-r${rev}-${suffix}`;
 let checks=0;
 // These runs originate under G2. Never adopt/backfill a pre-G2 fixture run.
 const made=await create(),run=made.run_id;
 const k=key(run,1,'same-key'),units=JSON.stringify(fixture.payload.units);
 const args=query([run,1,k,units]);
 const same=await Promise.all([call(a,'update_building_setup_units_v2',args),call(b,'update_building_setup_units_v2',args)]);
 assert.deepEqual(same[0],same[1]);checks++;
 assert.equal((await controller.query('select count(*)::integer n from platform.building_setup_command_receipts where run_id=$1 and command_key=$2',[run,k])).rows[0].n,1);checks++;
 const successor=await call(a,'rehearse_building_setup_v2',query([run,2,key(run,2,'successor')]));
 assert.equal(successor.revision,3);checks++;
 let before=await fingerprint(controller);
 assert.deepEqual(await call(a,'update_building_setup_units_v2',args),same[0]);checks++;
 assert.deepEqual(await fingerprint(controller),before,'exact old replay has zero writes in every guarded store');checks++;
 const proof=await call(a,'get_building_setup_command_receipt_v1',query([run,k,'update',1]));
 assert.equal(proof.outcome,'complete');assert.deepEqual(proof.evidence.receipt,same[0]);checks++;
 const changed=structuredClone(fixture.payload.units);changed[0].area_m2=(changed[0].area_m2??0)+1;
 await assert.rejects(call(a,'update_building_setup_units_v2',query([run,1,k,JSON.stringify(changed)])),e=>e.code==='40001');checks++;
 assert.deepEqual(await fingerprint(controller),before,'different intent cannot replace evidence');checks++;

 // Real controller/A/B schedule. B changes only the owned synthetic Context;
 // no managed Auth locks, no altered product function, no advisory fake barrier.
 const victim=(await create()).run_id;
 const pidA=(await a.query('select pg_backend_pid() pid')).rows[0].pid;
 const pidC=(await controller.query('select pg_backend_pid() pid')).rows[0].pid;
 const ends=(await b.query('select ends_at from identity.context_grants where id=$1',[fixture.context])).rows[0].ends_at;
 let lock=false,denied=null;
 try{
  await controller.query('begin');lock=true;
  await controller.query('select id from platform.building_setup_runs where id=$1 for update',[victim]);
  denied=call(a,'update_building_setup_units_v2',query([victim,1,key(victim,1,'revoke-wait'),units])).then(
   value=>({ok:true,value}),error=>({ok:false,code:error.code}));
  await waitForBlocking(controller,pidA,pidC);checks++;
  await b.query('begin');
  try{await b.query('update identity.context_grants set ends_at=clock_timestamp() where id=$1',[fixture.context]);await b.query('commit');}
  catch(e){await b.query('rollback');throw e;}
  before=await fingerprint(b); // includes the independent revoke/revision change.
  await controller.query('rollback');lock=false;
  const outcome=await denied;assert.equal(outcome.ok,false);assert.ok(['40001','42501'].includes(outcome.code));checks++;
  assert.deepEqual(await fingerprint(b),before,'post-wait denial rolls back run/audit/evidence/revision/portfolio/binding/outbox writes');checks++;
 }finally{
  if(lock)await controller.query('rollback');
  if(denied)await denied;
  // Restore the owned fixture through its normal revision triggers; do not reset
  // revision/audit history or managed sessions to hide this test's effects.
  await b.query('update identity.context_grants set ends_at=$2 where id=$1',[fixture.context,ends]);
 }

 // A successful call may make tentative writes. Outer rollback must remove ALL
 // application rows, not sequence/WAL effects. Force an actual FK failure after
 // RPC success, inside the same transaction; no trigger replacement is needed.
 const rolled=(await create()).run_id;before=await fingerprint(controller);
 await assert.rejects(transaction(a,fixture.claims,async c=>{
  await rpc(c,'update_building_setup_units_v2',query([rolled,1,key(rolled,1,'outer-fk'),units]));
  await c.query('reset role');
  const valid=(await c.query('select * from platform.building_setup_command_coverage where run_id=$1',[rolled])).rows[0];
  assert.ok(valid);
  // The cloned coverage has an impossible run FK but genuine epoch metadata.
  await c.query('insert into platform.building_setup_command_coverage select (jsonb_populate_record(null::platform.building_setup_command_coverage,$1::jsonb)).*',
   [JSON.stringify({...valid,run_id:'00000000-0000-4000-8000-000000000000'})]);
 }),e=>e.code==='23503');checks++;
 assert.deepEqual(await fingerprint(controller),before,'outer FK failure rolls back successful tentative command/evidence/audit');checks++;

 // Simulate lost acknowledgment only AFTER a real commit. No claim that a
 // transport error proves rollback; recovery and retry keep the original key.
 const unknown=(await create()).run_id,unknownKey=key(unknown,1,'unknown-commit');
 const committed=await call(a,'update_building_setup_units_v2',query([unknown,1,unknownKey,units]));
 before=await fingerprint(controller);
 const recovered=await call(b,'get_building_setup_command_receipt_v1',query([unknown,unknownKey,'update',1]));
 assert.equal(recovered.outcome,'complete');assert.deepEqual(recovered.evidence.receipt,committed);checks++;
 assert.deepEqual(await call(a,'update_building_setup_units_v2',query([unknown,1,unknownKey,units])),committed);checks++;
 assert.deepEqual(await fingerprint(controller),before,'lookup plus explicit exact retry do not rotate key or duplicate effects');checks++;

 // A genuine old run supplied from a pre-G2 phase, never fabricated by deleting
 // coverage, remains UNKNOWN; no old command is declared absent or reusable.
 uuid(fixture.legacy_run);assert.equal(fixture.legacy_pre_g2,true);
 assert.equal((await controller.query('select count(*)::integer n from platform.building_setup_command_coverage where run_id=$1',[fixture.legacy_run])).rows[0].n,0);
 const old=await call(a,'get_building_setup_command_receipt_v1',query([fixture.legacy_run,fixture.legacy_command_key,fixture.legacy_operation,fixture.legacy_expected_revision]));
 assert.equal(old.outcome,'unknown');assert.equal(old.reason,'legacy_uncovered');checks++;
 return {result:'PASS',checks,boundary:'PG_SQL_SESSION_NATIVE_FIXTURE_NOT_ISSUED_AUTH_HTTP',
  actual_blocking:true,outer_rollback:true,managed_auth_mutation:false,cleanup:'external owner destroys only owned disposable DB; history not rewritten'};
}

// Deliberately no main(), driver, connection, installation, fixture initialization
// or auto-run. This module is source for a separately authorized future harness.
