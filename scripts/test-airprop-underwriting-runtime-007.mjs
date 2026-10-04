import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export async function runAirpropUnderwritingTests(f) {
 const {db,q,check,setActor,id,tenant,otherTenant,user,otherUser,workspace,secondWorkspace,foreignWorkspace,context,otherContext,physicalContext,localRole,member}=f;
 let inTransaction=false;
 const changed=(sql,fn)=>f.changed(sql,async()=>{inTransaction=true;try{await fn();}finally{inTransaction=false;}});
 const source=readFileSync(new URL('../supabase/migrations/20260914144417_airprop_core_foundation.sql',import.meta.url),'utf8');
 const manage=id(301),moduleId=id(203);
 await db.exec(`create table platform.tenants(id uuid primary key);create table auth.users(id uuid primary key);
 insert into platform.tenants values ('${tenant}'),('${otherTenant}');insert into auth.users values ('${user}'),('${otherUser}');
 alter table airprop.investment_opportunities add column updated_at timestamptz default statement_timestamp();`);
 // Actual canonical table definitions and immutable trigger, not substitutes.
 await db.exec(source.slice(source.indexOf('create table airprop.underwriting_cases('),source.indexOf('create table airprop.property_interests(')));
 await db.exec(source.slice(source.indexOf('create or replace function airprop.protect_underwriting_version_v1()'),source.indexOf('create trigger airprop_property_interests_integrity')));
 await db.exec(source.slice(source.indexOf('create trigger airprop_underwriting_versions_immutable'),source.indexOf('alter table airprop.investment_opportunities')));
 await db.exec(`alter table airprop.underwriting_cases enable row level security;alter table airprop.underwriting_versions enable row level security;
 insert into identity.permissions values ('${manage}','airprop.underwriting.manage');
 insert into identity.role_permissions select role_id,'${manage}','allow' from identity.memberships where id='${member}';
 insert into platform.module_permission_bindings(id,module_definition_id,permission_id) values ('${id(302)}','${moduleId}','${manage}');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261004090538_airprop_native_underwriting_v2.sql',import.meta.url),'utf8'));
 await setActor();
 const opps=await q('select id,property_id from airprop.investment_opportunities order by created_at,id');
 const opp=opps.find(o=>!o.property_id).id,bound=opps.find(o=>o.property_id).id;
 const assumptions={acquisition_cost:'200000',annual_rent:'12000',annual_opex:'2000',currency:'EUR'};
 const create=async (key='evaluation-key-0001',expected=0,a=assumptions,target=opp,ctx=context,ws=workspace)=>(await q('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,$5,$6::jsonb) result',[ctx,ws,target,key,expected,JSON.stringify(a)]))[0].result;
 const list=async (target=opp,ctx=context,ws=workspace,limit=50)=>(await q('select customer_api.list_airprop_underwriting_v2($1,$2,$3,$4) result',[ctx,ws,target,limit]))[0].result;
 const rejected=async(fn,predicate)=>{
  if(!inTransaction)return assert.rejects(fn,predicate);
  await db.exec('savepoint expected_rejection');
  try{await assert.rejects(fn,predicate);}finally{await db.exec('rollback to savepoint expected_rejection');}
 };
 const denied=fn=>rejected(fn,e=>e.code==='42501');
 const conflict=(fn,message)=>rejected(fn,e=>e.code==='22023'&&e.message===message);
 const invalid=fn=>rejected(fn,e=>['22023','22P02','22003'].includes(e.code));
 const totals=async()=>Promise.all(['airprop.underwriting_cases','airprop.underwriting_versions','audit.events','platform.outbox_events','platform.idempotency_keys'].map(async t=>Number((await q(`select count(*) n from ${t}`))[0].n)));
 const noWrite=async fn=>{
  const before=await totals(),ownTransaction=!inTransaction;
  if(ownTransaction)await db.exec('begin');
  if(ownTransaction)inTransaction=true;
  await db.exec('savepoint evaluate_no_write');
  try{
   await fn();let after;
   try{after=await totals();}catch(error){if(error.code!=='25P02')throw error;await db.exec('rollback to savepoint evaluate_no_write');after=await totals();}
   assert.deepEqual(after,before);
  }finally{if(ownTransaction){inTransaction=false;await db.exec('rollback');}else await db.exec('rollback to savepoint evaluate_no_write');}
 };
 let first;
 await check('empty native evaluation list returns version zero',async()=>{const r=await list();assert.equal(r.current_version,0);assert.deepEqual(r.versions,[]);});
 await check('native evaluation creates immutable version, current pointer and exact numeric evidence',async()=>{
  const before=await totals();first=await create();assert.equal(first.evaluation_version,1);assert.equal(first.status,'underwriting');
  assert.deepEqual(first.results,{annual_noi:'10000.0000',gross_yield:'0.06000000',net_yield:'0.05000000',currency:'EUR'});
  assert.deepEqual(await totals(),before.map(n=>n+1));
  const [v]=await q('select * from airprop.underwriting_versions');
  const a={acquisition_cost:'200000.0000',annual_rent:'12000.0000',annual_opex:'2000.0000',currency:'EUR'};
  const hash=x=>createHash('sha256').update(JSON.stringify(x),'utf8').digest('hex');
  assert.equal(v.input_hash,hash({version:2,assumptions:a}));
  assert.equal(v.native_request_hash,hash({version:2,workspace_id:workspace,opportunity_id:opp,actor_id:user,expected_version:0,assumptions:a}));
  assert.equal(v.native_request_key,`airprop.underwriting.create.v2/${workspace}/${opp}/evaluation-key-0001`);
 });
 await check('exact retry is reauthorized and creates no evidence or pointer changes',async()=>noWrite(async()=>{
  const retry=await create();assert.deepEqual(retry,{...first,idempotent:true});
  assert.equal((await create('evaluation-key-0001',0,{...assumptions,acquisition_cost:'200000.0000'})).idempotent,true);
 }));
 await check('same-key changed assumptions conflict without writes',async()=>noWrite(()=>conflict(()=>create('evaluation-key-0001',0,{...assumptions,annual_rent:'13000'}),'airprop_idempotency_conflict')));
 await check('same-key changed expected-version conflicts',async()=>noWrite(()=>conflict(()=>create('evaluation-key-0001',1),'airprop_idempotency_conflict')));
 await check('new stale-version command conflicts',async()=>noWrite(()=>conflict(()=>create('stale-evaluation1',0,{...assumptions,annual_rent:'13000'}),'airprop_underwriting_version_conflict')));
 await check('same-content new key cannot republish old content',async()=>noWrite(()=>conflict(()=>create('duplicate-content',1),'airprop_underwriting_content_conflict')));
 await check('new assumptions append version two and preserve original evidence',async()=>{const r=await create('evaluation-key-0002',1,{...assumptions,annual_rent:'13000'});assert.equal(r.evaluation_version,2);const l=await list();assert.equal(l.current_version,2);assert.deepEqual(l.versions.map(v=>v.evaluation_version),[2,1]);assert.equal(l.versions[1].results.annual_noi,'10000.0000');});
 await check('old authorized retry retains original version after advancement',async()=>noWrite(async()=>assert.deepEqual(await create(),{...first,idempotent:true})));
 await check('domain retry survives shared key retention',async()=>changed('delete from platform.idempotency_keys',async()=>noWrite(async()=>assert.deepEqual(await create(),{...first,idempotent:true}))));
 for(const sql of [
  `update identity.memberships set status='revoked' where id='${member}'`,
  `update platform.workspace_member_roles set valid_to=now() where membership_id='${member}'`,
  `update platform.workspace_roles set lifecycle_status='draft' where id='${localRole}'`,
  `insert into platform.workspace_role_permissions values ('${localRole}','${manage}','deny')`,
  `update platform.workspace_modules set status='inactive' where module_code='airprop_commercial'`,
  `update platform.workspace_entitlements set boolean_value=false where entitlement_key='module.airprop_commercial'`,
 ])await check('current authority rejects previous evaluation retry',async()=>changed(sql,()=>noWrite(()=>denied(()=>create()))));
 for(const [ctx,ws] of [[context,secondWorkspace],[context,foreignWorkspace],[physicalContext,workspace]])await check('workspace/physical context cannot substitute native evaluation authority',async()=>noWrite(()=>denied(()=>create('evaluation-key-0001',0,assumptions,opp,ctx,ws))));
 for(const [sub,aal] of [[null,'aal2'],[user,'aal1']])await check('anonymous or AAL1 cannot recover previous result',async()=>{await setActor(sub,aal);await noWrite(()=>denied(()=>create()));await setActor();});
 await check('different authorized actor cannot recover creator command',async()=>changed(`
 insert into platform.workspace_role_modules select workspace_role_id,'${moduleId}' from platform.workspace_member_roles where membership_id=(select id from identity.memberships where user_id='${otherUser}');
 insert into platform.workspace_role_permissions select workspace_role_id,'${manage}','allow' from platform.workspace_member_roles where membership_id=(select id from identity.memberships where user_id='${otherUser}');`,async()=>{await setActor(otherUser);await noWrite(()=>conflict(()=>create('evaluation-key-0001',0,assumptions,opp,otherContext),'airprop_idempotency_conflict'));}));
 await setActor();
 await check('unknown opportunity does not leak other scope',async()=>noWrite(()=>assert.rejects(()=>create('unknown-opp-key1',0,assumptions,id(999)),e=>e.code==='P0002')));
 await check('legacy unresolved workspace opportunity cannot be evaluated',async()=>changed(`update airprop.investment_opportunities set workspace_id=null where id='${opp}'`,()=>noWrite(()=>assert.rejects(()=>create(),e=>e.code==='P0002'))));
 await check('opportunity from foreign tenant is hidden',async()=>changed(`update airprop.investment_opportunities set tenant_id='${otherTenant}' where id='${opp}'`,()=>noWrite(()=>assert.rejects(()=>list(),e=>e.code==='P0002'))));
 await check('active optional subject is accepted',async()=>assert.equal((await create('bound-evaluation1',0,assumptions,bound)).evaluation_version,1));
 await check('native extreme decimal arithmetic matches exact compiled vectors',async()=>changed('',async()=>{
  const fresh=(await q("select id from airprop.investment_opportunities where id not in (select opportunity_id from airprop.underwriting_cases) limit 1"))[0].id;
  const r=await create('extreme-evaluation1',0,{acquisition_cost:'0.0001',annual_rent:'9999999999999999.9999',annual_opex:'9999999999999999.9998',currency:'EUR'},fresh);
  assert.deepEqual(r.results,{annual_noi:'0.0001',gross_yield:'99999999999999999999.00000000',net_yield:'1.00000000',currency:'EUR'});
 }));
 await check('expired subject binding denies retry and read',async()=>changed('update platform.workspace_property_bindings set valid_to=now()',async()=>{await noWrite(()=>denied(()=>create('bound-evaluation1',0,assumptions,bound)));await denied(()=>list(bound));}));
 await check('read permission checked independently of underwriting manage',async()=>changed(`insert into platform.workspace_role_permissions values ('${localRole}','${id(202)}','deny')`,async()=>{await denied(()=>list());assert.equal((await create()).idempotent,true);}));
 await check('opportunity manage alone cannot authorize underwriting',async()=>changed(`delete from identity.role_permissions where permission_id='${manage}'`,()=>denied(()=>create())));
 for(const a of [null,{...assumptions,annual_rent:12000},{...assumptions,acquisition_cost:'0'},{...assumptions,annual_opex:'12000.0001'},{...assumptions,annual_rent:'1e3'},{...assumptions,currency:'RON'},{...assumptions,results:{}},{...assumptions,acquisition_cost:'10000000000000000'}])await check('direct RPC rejects malformed assumptions and mismatched currency',async()=>noWrite(()=>invalid(()=>create('invalid-eval-001',2,a))));
 for(const expected of [null,-1,2147483647])await check('direct RPC rejects invalid expected version',async()=>noWrite(()=>invalid(()=>create('invalid-eval-001',expected))));
 await check('list rejects out-of-range limits',async()=>invalid(()=>list(opp,context,workspace,101)));
 await check('immutable evaluation version and command evidence cannot be updated/deleted',async()=>{
  await assert.rejects(()=>q('update airprop.underwriting_versions set native_request_hash=null'),e=>e.code==='55000');
  await assert.rejects(()=>q('delete from airprop.underwriting_versions'),e=>e.code==='55000');
 });
 for(const status of ['due_diligence','approved','rejected','cancelled','converted'])await check('terminal or later stage rejects new evaluation but permits authorized exact retry',async()=>changed(`update airprop.investment_opportunities set status='${status}' where id='${opp}'`,async()=>{
  await noWrite(()=>conflict(()=>create('state-evaluation1',2,{...assumptions,annual_rent:'14000'}),'airprop_underwriting_state_conflict'));assert.equal((await create()).evaluation_version,1);
 }));
 await check('outbox failure rolls back version, case pointer, opportunity, audit and retry',async()=>{
  await db.exec("create function platform.fail_eval_outbox() returns trigger language plpgsql as $$ begin raise exception 'test_eval_outbox_failure'; end $$;create trigger fail_eval_outbox before insert on platform.outbox_events for each row execute function platform.fail_eval_outbox();");
  try{await noWrite(()=>assert.rejects(()=>create('rollback-evaluation',2,{...assumptions,annual_rent:'14000'}),/test_eval_outbox_failure/));assert.equal((await list()).current_version,2);}finally{await db.exec('drop trigger fail_eval_outbox on platform.outbox_events;drop function platform.fail_eval_outbox();');}
 });
 await check('failed first evaluation leaves no empty case',async()=>{
  await db.exec("create function platform.fail_eval_outbox() returns trigger language plpgsql as $$ begin raise exception 'test_eval_outbox_failure'; end $$;create trigger fail_eval_outbox before insert on platform.outbox_events for each row execute function platform.fail_eval_outbox();");
  const fresh=(await q("select id from airprop.investment_opportunities where id not in (select opportunity_id from airprop.underwriting_cases) limit 1"))[0];
  try{assert.ok(fresh);await noWrite(()=>assert.rejects(()=>create('rollback-first-eval',0,assumptions,fresh.id),/test_eval_outbox_failure/));}finally{await db.exec('drop trigger fail_eval_outbox on platform.outbox_events;drop function platform.fail_eval_outbox();');}
 });
 await check('gateways expose authenticated execution only; internal helpers and direct writes denied',async()=>{
  for(const sig of ['customer_api.create_airprop_underwriting_v2(uuid,uuid,uuid,text,integer,jsonb)','customer_api.list_airprop_underwriting_v2(uuid,uuid,uuid,integer)']){
   for(const role of ['anon','service_role'])assert.equal((await q("select has_function_privilege($1,$2,'execute') allowed",[role,sig]))[0].allowed,false);
   assert.equal((await q("select has_function_privilege('authenticated',$1,'execute') allowed",[sig]))[0].allowed,true);
  }
  for(const role of ['anon','authenticated','service_role'])assert.equal((await q("select has_function_privilege($1,'app_private.require_airprop_underwriting_opportunity_v2(uuid,uuid,uuid,text)','execute') allowed",[role]))[0].allowed,false);
  await db.exec('set role authenticated');try{assert.equal((await create()).idempotent,true);await assert.rejects(()=>q('update airprop.underwriting_cases set current_version=0'),e=>e.code==='42501');}finally{await db.exec('reset role');}
 });
 if(db.openConnection){
  for(const sameKey of [true,false])await check('independent PostgreSQL sessions serialize evaluation retries or reject stale competing commands',async()=>{
   const fresh=(await q("select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) result",[context,workspace,`eval-concurrency-${sameKey}`,JSON.stringify({name:'Concurrent evaluation',country_code:'RO',city:'București',currency:'EUR',asking_price:'1'})]))[0].result.opportunity_id;
   const c1=await db.openConnection(),c2=await db.openConnection();let running;
   const sql='select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,$5,$6::jsonb) result';
   try{
    for(const c of [c1,c2]){await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);}
    const pid1=Number((await c1.query('select pg_backend_pid() pid')).rows[0].pid),pid2=Number((await c2.query('select pg_backend_pid() pid')).rows[0].pid);
    const args=[context,workspace,fresh,'concurrent-eval-01',0,JSON.stringify(assumptions)];
    const result=(await c1.query(sql,args)).rows[0].result;
    running=c2.query(sql,sameKey?args:[context,workspace,fresh,'concurrent-eval-02',0,JSON.stringify({...assumptions,annual_rent:'14000'})]);running.catch(()=>{});
    let blocked=false;for(let i=0;i<80;i++){if((await q('select pg_blocking_pids($1) blockers',[pid2]))[0].blockers.includes(pid1)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(blocked,true);await c1.query('commit');
    if(sameKey){const replay=(await running).rows[0].result;assert.deepEqual(replay,{...result,idempotent:true});await c2.query('commit');}
    else{await assert.rejects(()=>running,e=>e.message==='airprop_underwriting_version_conflict');await c2.query('rollback');}
    assert.equal(Number((await q('select count(*) n from airprop.underwriting_versions where underwriting_case_id=$1',[result.underwriting_case_id]))[0].n),1);
    assert.equal(Number((await q('select count(*) n from audit.events where entity_id=$1',[result.underwriting_case_id]))[0].n),1);
    assert.equal(Number((await q('select count(*) n from platform.outbox_events where aggregate_id=$1',[result.underwriting_case_id]))[0].n),1);
   }finally{await c1.query('rollback');await c2.query('rollback');if(running)await running.catch(()=>{});await c1.end();await c2.end();}
  });
  await check('revocation while waiting for case lock denies an existing retry after lock release',async()=>{
   const holder=await db.openConnection(),waiting=await db.openConnection();let running;
   try{
    await holder.query('begin');await holder.query('select 1 from airprop.underwriting_cases where id=$1 for update',[first.underwriting_case_id]);
    await waiting.query('begin');await waiting.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);
    const holderPid=Number((await holder.query('select pg_backend_pid() pid')).rows[0].pid),waitingPid=Number((await waiting.query('select pg_backend_pid() pid')).rows[0].pid);
    running=waiting.query('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,$5,$6::jsonb)',[context,workspace,opp,'evaluation-key-0001',0,JSON.stringify(assumptions)]);running.catch(()=>{});
    let blocked=false;for(let i=0;i<80;i++){if((await q('select pg_blocking_pids($1) blockers',[waitingPid]))[0].blockers.includes(holderPid)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(blocked,true);await q("update identity.memberships set status='revoked' where id=$1",[member]);await holder.query('commit');
    await assert.rejects(()=>running,e=>e.code==='42501');await waiting.query('rollback');
   }finally{await holder.query('rollback');await waiting.query('rollback');if(running)await running.catch(()=>{});await holder.end();await waiting.end();await q("update identity.memberships set status='active' where id=$1",[member]);}
  });
  await check('actual legacy v1 writer serializes with native case and cannot cause duplicate version numbers',async()=>{
   const legacySource=readFileSync(new URL('../supabase/migrations/20261003083859_workspace_scoped_effective_permission.sql',import.meta.url),'utf8');
   const helperStart=legacySource.indexOf('create function app_private.require_airprop_workspace_context_v1(');
   const helperEnd=legacySource.indexOf('revoke all on function app_private.require_airprop_workspace_context_v1',helperStart);
   const writerStart=legacySource.indexOf('create or replace function app_private.add_airprop_underwriting_version_internal_v1(');
   const writerEnd=legacySource.indexOf('create or replace function app_private.configure_airprop_property_internal_v1',writerStart);
   await db.exec('create schema extensions;create extension pgcrypto with schema extensions;');
   await db.exec(legacySource.slice(helperStart,helperEnd));await db.exec(legacySource.slice(writerStart,writerEnd));
   const legacy=await db.openConnection(),native=await db.openConnection();let running;
   try{
    for(const c of [legacy,native]){await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);}
    const pid1=Number((await legacy.query('select pg_backend_pid() pid')).rows[0].pid),pid2=Number((await native.query('select pg_backend_pid() pid')).rows[0].pid);
    const r=(await legacy.query('select app_private.add_airprop_underwriting_version_internal_v1($1,$2,$3::jsonb) result',[physicalContext,bound,JSON.stringify({...assumptions,annual_rent:'18000'})])).rows[0].result;assert.equal(r.version,2);
    running=native.query('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,$5,$6::jsonb)',[context,workspace,bound,'legacy-competing1',1,JSON.stringify({...assumptions,annual_rent:'19000'})]);running.catch(()=>{});
    let blocked=false;for(let i=0;i<80;i++){if((await q('select pg_blocking_pids($1) blockers',[pid2]))[0].blockers.includes(pid1)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
    assert.equal(blocked,true);await legacy.query('commit');await assert.rejects(()=>running,e=>e.message==='airprop_underwriting_version_conflict');await native.query('rollback');
    const versions=await list(bound);assert.equal(versions.current_version,2);assert.deepEqual(versions.versions.map(v=>v.evaluation_version),[2,1]);assert.equal(typeof versions.versions[0].results.annual_noi,'string');
   }finally{await legacy.query('rollback');await native.query('rollback');if(running)await running.catch(()=>{});await legacy.end();await native.end();}
  });
 }
 console.log('AIRPROP native underwriting runtime cases passed');
}
