import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
// Authoring only until PM grants a disposable lease + Core supplies accepted positive fixture.
// Never start Docker, use a remote target, grant native authority or install an adapter stub.
const url=process.env.BUILDING_SETUP_TEST_DATABASE_URL,lease=process.env.BUILDING_SETUP_TEST_LEASE;
if(!url||!lease||process.env.BUILDING_SETUP_EPHEMERAL!=='1')throw Error('BLOCKED: explicit leased disposable target required; NOT_RUN_NOT_PASS');
const target=new URL(url);
if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||!/^\/cladora_setup_fixture_[a-z0-9_]+$/.test(target.pathname))throw Error('BLOCKED: dedicated local synthetic fixture DB required');
const fixture=JSON.parse(process.env.BUILDING_SETUP_ACCEPTED_FIXTURE??'null');
for(const key of ['actor','context','workspace'])assert.match(fixture?.[key]??'',/^[a-f0-9-]{36}$/i);
const owned=`cladora_setup_proof_${randomUUID().replaceAll('-','')}`,admin=new pg.Client({connectionString:url}),clients=[];
let created=false,checks=0,receipt;
const payload={association:{name:'Synthetic concurrent proof'},building:{name:'Synthetic block',code:'B223',floors:1},currency:'RON',period_start:'2026-01-01',period_end:'2026-01-31',units:[{code:'U1',floor:0,area_m2:50}],opening_balances:[]};
const creationKey=`proof-${randomUUID()}`;
async function call(name,args){const client=new pg.Client({connectionString:new URL(`/${owned}`,url).href});clients.push(client);await client.connect();try{await client.query('begin');await client.query('set local statement_timeout=15000');await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:fixture.actor,role:'authenticated',aal:'aal2'})]);const placeholders=args.map((_,i)=>`$${i+1}`).join(',');const r=await client.query(`select customer_api.${name}(${placeholders}) result`,args);await client.query('commit');return r.rows[0].result;}catch(e){await client.query('rollback');throw e;}finally{await client.end();clients.splice(clients.indexOf(client),1);}}
try{
 await admin.connect();
 assert.equal((await admin.query("select current_setting('cladora.synthetic_setup_lease',true) lease")).rows[0].lease,lease,'source fixture lease must match before clone');
 // Names derive only from validated source DB and task-owned random identifier.
 await admin.query(`create database "${owned}" template "${target.pathname.slice(1)}"`);created=true;
 const args=[fixture.context,fixture.workspace,creationKey,JSON.stringify(payload)];
 const both=await Promise.all([call('create_building_setup_v2',args),call('create_building_setup_v2',args)]);assert.deepEqual(both[0],both[1]);checks++;
 const run=both[0].run_id,key=(rev,suffix)=>`setup-${run}-r${rev}-${suffix}`;
 const changed={...payload,building:{...payload.building,name:'Different'}};
 await assert.rejects(call('create_building_setup_v2',[fixture.context,fixture.workspace,creationKey,JSON.stringify(changed)]),e=>e.code==='23505');checks++;
 const race=await Promise.allSettled([call('update_building_setup_units_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-update'),JSON.stringify([{code:'U1',floor:0,area_m2:70}])]),call('rehearse_building_setup_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-rehearse')])]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.code,'40001');checks++;
 const winner=race.find(r=>r.status==='fulfilled').value;
 const replay=winner.operation==='update'?()=>call('update_building_setup_units_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-update'),JSON.stringify([{code:'U1',floor:0,area_m2:70}])]):()=>call('rehearse_building_setup_v2',[fixture.context,fixture.workspace,run,1,key(1,'race-rehearse')]);
 assert.deepEqual(await replay(),winner);checks++;
 assert.deepEqual(await call('create_building_setup_v2',args),both[0]);checks++;
 const next=winner.operation==='update'?'rehearse_building_setup_v2':'submit_building_setup_v2';await call(next,[fixture.context,fixture.workspace,run,2,key(2,'next')]);
 await assert.rejects(replay(),e=>e.code==='40001');checks++;
 receipt={result:'PASS',checks,boundary:'ACTUAL_POSTGRES_ROLE_WITH_FIXTURE_JWT_CLAIMS_NOT_ISSUED_AUTH',concurrent_creation:true,concurrent_revision:true,real_auth_http:'NOT_RUN_NOT_PASS'};
}finally{
 await Promise.allSettled(clients.map(c=>c.end()));
 if(created){await admin.query(`drop database "${owned}"`);assert.equal((await admin.query('select count(*)::integer n from pg_database where datname=$1',[owned])).rows[0].n,0);}
 await admin.end();
}

console.log(JSON.stringify({...receipt,owned_database_cleanup:'PASS'}));
