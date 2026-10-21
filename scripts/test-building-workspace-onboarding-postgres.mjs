import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
// Authoring only until PM grants a disposable lease + Core supplies accepted positive fixture.
// Never start Docker, use a remote target, grant native authority or install an adapter stub.
const url=process.env.BUILDING_SETUP_TEST_DATABASE_URL,lease=process.env.BUILDING_SETUP_TEST_LEASE;
if(!url||!lease||process.env.BUILDING_SETUP_EPHEMERAL!=='1')throw Error('BLOCKED: explicit leased disposable target required; NOT_RUN_NOT_PASS');
const target=new URL(url);
if(!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.search||!/^\/cladora_setup_fixture_[a-z0-9_]+$/.test(target.pathname))throw Error('BLOCKED: dedicated local synthetic fixture DB required; no query-string host override');
const fixture=JSON.parse(process.env.BUILDING_SETUP_ACCEPTED_FIXTURE??'null');
for(const key of ['actor','context','workspace'])assert.match(fixture?.[key]??'',/^[a-f0-9-]{36}$/i);
// A TEMPLATE source must have NO connected clients, including this runner.
// Read its lease on a short-lived connection; create/drop from maintenance DB.
const owned=`cladora_setup_proof_${randomUUID().replaceAll('-','')}`,admin=new pg.Client({connectionString:new URL('/postgres',url).href}),clients=[];
let created=false,checks=0,receipt,inspector;
const payload={association:{name:'Synthetic concurrent proof'},building:{name:'Synthetic block',code:'B223',floors:1},currency:'RON',period_start:'2026-01-01',period_end:'2026-01-31',units:[{code:'U1',floor:0,area_m2:50}],opening_balances:[]};
const creationKey=`proof-${randomUUID()}`;
async function call(name,args,actor=fixture.actor){const client=new pg.Client({connectionString:new URL(`/${owned}`,url).href});clients.push(client);await client.connect();try{await client.query('begin');await client.query('set local statement_timeout=15000');await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'})]);const placeholders=args.map((_,i)=>`$${i+1}`).join(',');const r=await client.query(`select customer_api.${name}(${placeholders}) result`,args);await client.query('commit');return r.rows[0].result;}catch(e){await client.query('rollback');throw e;}finally{await client.end();clients.splice(clients.indexOf(client),1);}}
const tables=['platform.building_setup_runs','audit.events','platform.outbox_events','portfolio.properties','portfolio.buildings','portfolio.units','finance.accounting_periods','finance.journals','billing.invoices','identity.memberships','identity.context_grants','platform.workspace_property_bindings','platform.workspace_member_roles','platform.workspace_member_role_authority_sources','platform.workspace_role_handover_lineage'];
async function fingerprint(){const parts=[];for(const table of tables){const r=await inspector.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) digest from ${table} t`);parts.push([table,r.rows[0].digest]);}return parts;}
try{
 await admin.connect();
 const source=new pg.Client({connectionString:url});
 try{await source.connect();assert.equal((await source.query("select current_setting('cladora.synthetic_setup_lease',true) lease")).rows[0].lease,lease,'source fixture lease must match before clone');}
 finally{await source.end();}
 assert.equal((await admin.query('select count(*)::integer n from pg_stat_activity where datname=$1',[target.pathname.slice(1)])).rows[0].n,0,'source fixture has no active sessions; never terminate another connection');
 // Names derive only from validated source DB and task-owned random identifier.
 await admin.query(`create database "${owned}" template "${target.pathname.slice(1)}"`);created=true;
 inspector=new pg.Client({connectionString:new URL(`/${owned}`,url).href});await inspector.connect();
 const args=[fixture.context,fixture.workspace,creationKey,JSON.stringify(payload)];
 const creation=await Promise.allSettled([call('create_building_setup_v2',args),call('create_building_setup_v2',args)]);
 assert.equal(creation.filter(r=>r.status==='fulfilled').length,2,'both creation sessions complete');
 const both=creation.map(r=>r.value);assert.deepEqual(both[0],both[1]);checks++;
 assert.equal((await inspector.query('select count(*)::integer n from platform.building_setup_runs where idempotency_key=$1',[creationKey])).rows[0].n,1);checks++;
 const run=both[0].run_id,key=(rev,suffix)=>`setup-${run}-r${rev}-${suffix}`;
 const changed={...payload,building:{...payload.building,name:'Different'}};
 let before=await fingerprint();
 await assert.rejects(call('create_building_setup_v2',[fixture.context,fixture.workspace,creationKey,JSON.stringify(changed)]),e=>e.code==='23505');checks++;
 assert.deepEqual(await fingerprint(),before,'payload collision is zero-write across all guarded stores');checks++;
 const race=await Promise.allSettled([call('update_building_setup_units_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-update'),JSON.stringify([{code:'U1',floor:0,area_m2:70}])]),call('rehearse_building_setup_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-rehearse')])]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.code,'40001');checks++;
 assert.equal((await inspector.query('select revision from platform.building_setup_runs where id=$1',[run])).rows[0].revision,2);checks++;
 assert.equal((await inspector.query("select count(*)::integer n from audit.events where entity_type='building_setup_run' and entity_id=$1",[run])).rows[0].n,1);checks++;
 const winner=race.find(r=>r.status==='fulfilled').value;
 const replay=winner.operation==='update'?()=>call('update_building_setup_units_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-update'),JSON.stringify([{code:'U1',floor:0,area_m2:70}])]):()=>call('rehearse_building_setup_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-rehearse')]);
 before=await fingerprint();assert.deepEqual(await replay(),winner);checks++;
 assert.deepEqual(await call('create_building_setup_v2',args),both[0]);checks++;
 assert.deepEqual(await fingerprint(),before,'exact receipts return without another data/audit write');checks++;
 const next=winner.operation==='update'?'rehearse_building_setup_v2':'submit_building_setup_v2';await call(next,[fixture.context,fixture.workspace,run,2,key(2,'next')]);
 before=await fingerprint();await assert.rejects(replay(),e=>e.code==='40001');checks++;
 await assert.rejects(call('get_building_setup_attempt_v2',[fixture.context,fixture.workspace,creationKey],'c2200000-0000-4000-8000-000000000004'),e=>e.code==='42501');checks++;
 assert.deepEqual(await fingerprint(),before,'superseded receipt and borrowed Context denial are zero-write');checks++;
 // Fixture-only revoke outside the measured denied-call window; never change
 // roles or rewrite an evaluator to manufacture an authorized positive.
 await inspector.query('update identity.context_grants set ends_at=clock_timestamp() where id=$1',[fixture.context]);
 before=await fingerprint();await assert.rejects(call('create_building_setup_v2',args),e=>e.code==='42501');checks++;
 assert.deepEqual(await fingerprint(),before,'a prior creation receipt cannot bypass Context revoke');checks++;
 receipt={result:'PASS',checks,boundary:'ACTUAL_POSTGRES_ROLE_WITH_FIXTURE_JWT_CLAIMS_NOT_ISSUED_AUTH',concurrent_creation:true,concurrent_revision:true,fingerprinted_tables:tables.length,real_auth_http:'NOT_RUN_NOT_PASS'};
}finally{
 await Promise.allSettled(clients.map(c=>c.end()));
 try{if(inspector)await inspector.end();if(created){await admin.query(`drop database "${owned}"`);assert.equal((await admin.query('select count(*)::integer n from pg_database where datname=$1',[owned])).rows[0].n,0);}}
 finally{await admin.end();}
}

console.log(JSON.stringify({...receipt,owned_database_cleanup:'PASS'}));
