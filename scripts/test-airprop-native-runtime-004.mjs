import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export async function runAirpropNativeRuntimeTests(f) {
 const { db,q,check,changed,setActor,id,tenant,otherTenant,user,otherUser,workspace,secondWorkspace,foreignWorkspace,context,otherContext,physicalContext,localRole,member,property }=f;
 const manage=id(201),read=id(202),moduleId=id(203);
 await db.exec(`
 create schema airprop; create schema audit;
 create table airprop.investment_opportunities(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,workspace_id uuid,property_id uuid,
 idempotency_key text not null,name text not null,country_code char(2) not null,city text not null,
 asking_price numeric(20,4) not null check(asking_price>0),currency char(3) not null,status text not null default 'draft',
 source_ref text,input_hash text not null,created_by uuid not null,created_at timestamptz not null default statement_timestamp(),
 unique(tenant_id,idempotency_key));
 create table audit.events(tenant_id uuid,actor_id uuid,actor_role text,action text,entity_type text,entity_id uuid,after_snapshot jsonb,reason text);
 create table platform.idempotency_keys(tenant_id uuid,actor_id uuid,key text,request_hash text,response_ref jsonb,status_code integer,
 created_at timestamptz default statement_timestamp(),expires_at timestamptz,primary key(tenant_id,key),check(expires_at>created_at));
 create table platform.outbox_events(id uuid default gen_random_uuid(),tenant_id uuid,aggregate_type text,aggregate_id uuid,
 aggregate_version bigint check(aggregate_version>0),event_type text,payload jsonb,
 unique(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type));
 alter table airprop.investment_opportunities enable row level security;
 insert into identity.permissions values ('${manage}','airprop.opportunity.manage'),('${read}','airprop.opportunity.read');
 insert into identity.role_permissions select role_id,'${manage}','allow' from identity.memberships where id='${member}';
 insert into identity.role_permissions select role_id,'${read}','allow' from identity.memberships where id='${member}';
 insert into platform.module_definitions(id,code,entitlement_key) values ('${moduleId}','airprop_commercial','module.airprop_commercial');
 insert into platform.module_permission_bindings(id,module_definition_id,permission_id) values ('${id(204)}','${moduleId}','${manage}'),('${id(205)}','${moduleId}','${read}');
 insert into platform.workspace_modules(customer_workspace_id,module_code) values ('${workspace}','airprop_commercial');
 insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,boolean_value) values ('${workspace}','module.airprop_commercial',true);
 insert into platform.module_property_profile_compatibilities values ('${moduleId}','${id(101)}','compatible');
 insert into platform.module_operating_model_compatibilities values ('${moduleId}','${id(102)}','compatible');
 insert into platform.workspace_role_modules values ('${localRole}','${moduleId}');
 `);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261003142455_airprop_workspace_native_opportunities_v2.sql',import.meta.url),'utf8'));
 const payload={name:'فرصت آزمایشی',country_code:'RO',city:'București',currency:'EUR',asking_price:'1234567890123456.1234',property_id:null,source_ref:null};
 const create=async (p=payload,key='native-test-0001',ctx=context,ws=workspace)=>(await q('select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) result',[ctx,ws,key,JSON.stringify(p)]))[0].result;
 const list=async (ctx=context,ws=workspace,limit=50)=>(await q('select customer_api.list_airprop_opportunities_v2($1,$2,$3) result',[ctx,ws,limit]))[0].result;
 const count=async table=>Number((await q(`select count(*) n from ${table}`))[0].n);
 const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
 const invalid=fn=>assert.rejects(fn,e=>['22023','22P02','22003'].includes(e.code));
 await setActor(); let first;
 await check('native create without any physical subject persists exact price and atomic evidence',async()=>{
  first=await create(); assert.equal(first.version,2);assert.equal(first.workspace_id,workspace);assert.equal(first.idempotent,false);
  const rows=await q('select asking_price::text price,input_hash,idempotency_key from airprop.investment_opportunities');
  assert.equal(rows[0].price,payload.asking_price);
  const canonical=JSON.stringify({version:2,workspace_id:workspace,...payload});
  assert.equal(rows[0].input_hash,createHash('sha256').update(canonical).digest('hex'));
  assert.equal(rows[0].idempotency_key,`airprop.opportunity.create.v2/${workspace}/native-test-0001`);
  for(const t of ['airprop.investment_opportunities','audit.events','platform.outbox_events','platform.idempotency_keys'])assert.equal(await count(t),1);
 });
 await check('retry returns same identity with no repeated evidence',async()=>{const retry=await create();assert.equal(retry.opportunity_id,first.opportunity_id);assert.equal(retry.idempotent,true);assert.equal(await count('audit.events'),1);assert.equal(await count('platform.outbox_events'),1);});
 await check('canonical key order and decimal spelling are stable',async()=>{await create({...payload,asking_price:'2'},'normalization-01');assert.equal((await create({...payload,asking_price:'2.0000'},'normalization-01')).idempotent,true);});
 await check('changed payload conflicts',async()=>invalid(()=>create({...payload,city:'Cluj'})));
 for(const p of [{...payload,asking_price:100},{...payload,asking_price:'1.00001'},{...payload,asking_price:'0'},{...payload,asking_price:'10000000000000000'},{...payload,tenant_id:tenant},{...payload,city:''},{...payload,source_ref:''},{...payload,name:'bad\nname'},{...payload,property_id:'not-uuid'},null])await check('direct RPC rejects invalid/injected payload',async()=>invalid(()=>create(p,'invalid-test-01')));
 await check('null key rejected',async()=>invalid(()=>create(payload,null)));
 await check('null workspace rejected without fallback',async()=>denied(()=>create(payload,'invalid-work-01',context,null)));
 await check('same tenant different workspace cannot reuse retry',async()=>denied(()=>create(payload,'native-test-0001',context,secondWorkspace)));
 await check('foreign workspace denied',async()=>denied(()=>create(payload,'native-test-0001',context,foreignWorkspace)));
 await check('physical context cannot address native retry',async()=>denied(()=>create(payload,'native-test-0001',physicalContext)));
 await check('unauthenticated retry denied',async()=>{await setActor(null);await denied(()=>create());await setActor();});
 await check('AAL1 retry denied',async()=>{await setActor(user,'aal1');await denied(()=>create());await setActor();});
 for(const sql of [
  `update identity.memberships set status='revoked' where id='${member}'`,
  `update platform.workspace_member_roles set valid_to=now() where membership_id='${member}'`,
  `update platform.workspace_roles set lifecycle_status='draft' where id='${localRole}'`,
  `insert into platform.workspace_role_permissions values ('${localRole}','${manage}','deny')`,
  `update platform.workspace_modules set status='inactive' where module_code='airprop_commercial'`,
  `update platform.workspace_entitlements set boolean_value=false where entitlement_key='module.airprop_commercial'`,
 ])await check('current canonical authorization denies existing retry',async()=>changed(sql,()=>denied(()=>create())));
 await check('different authorized actor cannot recover creator retry',async()=>changed(`
 insert into platform.workspace_role_modules select workspace_role_id,'${moduleId}' from platform.workspace_member_roles where membership_id=(select id from identity.memberships where user_id='${otherUser}');
 insert into platform.workspace_role_permissions select workspace_role_id,'${manage}','allow' from platform.workspace_member_roles where membership_id=(select id from identity.memberships where user_id='${otherUser}');`,async()=>{await setActor(otherUser);await invalid(()=>create(payload,'native-test-0001',otherContext));}));
 await check('active canonical subject binding accepted',async()=>{assert.equal((await create({...payload,property_id:property},'bound-subject-01')).idempotent,false);});
 await check('unbound subject rejected',async()=>changed('delete from platform.workspace_property_bindings',()=>denied(()=>create({...payload,property_id:property},'unbound-subject1'))));
 await check('foreign subject rejected',async()=>changed(`insert into portfolio.properties values ('${id(250)}','${otherTenant}')`,()=>denied(()=>create({...payload,property_id:id(250)},'foreign-subject1'))));
 await check('list is native workspace scoped and keeps money as text',async()=>{const result=await list();assert.equal(result.version,2);assert.equal(result.opportunities.length,3);assert.equal(result.opportunities.find(x=>x.opportunity_id===first.opportunity_id).asking_price,payload.asking_price);});
 await check('expired subject binding hides subject record without hiding native subjectless record',async()=>changed('update platform.workspace_property_bindings set valid_to=now()',async()=>{const result=await list();assert.equal(result.opportunities.length,2);await denied(()=>create({...payload,property_id:property},'bound-subject-01'));}));
 await check('list rejects invalid limit',async()=>invalid(()=>list(context,workspace,101)));
 await check('read permission is checked independently of manage',async()=>changed(`insert into platform.workspace_role_permissions values ('${localRole}','${read}','deny')`,()=>denied(()=>list())));
 await check('expired/deleted shared retry record cannot create duplicate',async()=>changed('delete from platform.idempotency_keys',async()=>{assert.equal((await create()).opportunity_id,first.opportunity_id);assert.equal(await count('audit.events'),3);}));
 await check('retry retains original creation response after lifecycle advances',async()=>changed(`update airprop.investment_opportunities set status='underwriting' where id='${first.opportunity_id}'; delete from platform.idempotency_keys`,async()=>assert.equal((await create()).status,'draft')));
 await check('outbox failure rolls back commercial row, audit and key',async()=>{
  await db.exec("create function platform.fail_outbox_test() returns trigger language plpgsql as $$ begin raise exception 'test_outbox_failure'; end $$; create trigger fail_outbox_test before insert on platform.outbox_events for each row execute function platform.fail_outbox_test();");
  const before=await count('airprop.investment_opportunities');await assert.rejects(()=>create(payload,'rollback-test-01'),/test_outbox_failure/);
  assert.equal(await count('airprop.investment_opportunities'),before);assert.equal(await count('audit.events'),before);assert.equal(await count('platform.idempotency_keys'),before);
  await db.exec('drop trigger fail_outbox_test on platform.outbox_events;drop function platform.fail_outbox_test();');
 });
 await check('API privileges deny anon/service and internal resolver access',async()=>{
  for(const signature of ['customer_api.create_airprop_opportunity_v2(uuid,uuid,text,jsonb)','customer_api.list_airprop_opportunities_v2(uuid,uuid,integer)']){
   for(const role of ['anon','service_role'])assert.equal((await q('select has_function_privilege($1,$2,\'execute\') allowed',[role,signature]))[0].allowed,false);
   assert.equal((await q('select has_function_privilege(\'authenticated\',$1,\'execute\') allowed',[signature]))[0].allowed,true);
  }
  assert.equal((await q("select has_function_privilege('authenticated','app_private.require_airprop_native_context_v2(uuid,uuid,text)','execute') allowed"))[0].allowed,false);
 });
 await check('authenticated calls gateway through definer without direct commercial write privileges',async()=>{await db.exec('set role authenticated');try{assert.equal((await create()).idempotent,true);}finally{await db.exec('reset role');}});
 if(db.openConnection)await check('real independent connections serialize first insert and recover exactly one result',async()=>{
  const c1=await db.openConnection(),c2=await db.openConnection();let running;
  try{
   for(const c of [c1,c2]){await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);}
   const pid1=Number((await c1.query('select pg_backend_pid() pid')).rows[0].pid),pid2=Number((await c2.query('select pg_backend_pid() pid')).rows[0].pid);
   const args=[context,workspace,'real-concurrency1',JSON.stringify(payload)];
   const sql='select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) result';
   const firstResult=(await c1.query(sql,args)).rows[0].result;
   running=c2.query(sql,args);running.catch(()=>{});
   let blocked=false;
   for(let attempt=0;attempt<80;attempt++){const blockers=(await q('select pg_blocking_pids($1) blockers',[pid2]))[0].blockers;if(blockers.includes(pid1)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
   assert.equal(blocked,true,'second real backend waits on first transaction');
   await c1.query('commit');const retryResult=(await running).rows[0].result;await c2.query('commit');
   assert.equal(firstResult.idempotent,false);assert.equal(retryResult.idempotent,true);assert.equal(firstResult.opportunity_id,retryResult.opportunity_id);
   assert.equal(Number((await q('select count(*) n from audit.events where entity_id=$1',[firstResult.opportunity_id]))[0].n),1);
   assert.equal(Number((await q('select count(*) n from platform.outbox_events where aggregate_id=$1',[firstResult.opportunity_id]))[0].n),1);
  }finally{await c1.query('rollback');await c2.query('rollback');if(running)await running.catch(()=>{});await c1.end();await c2.end();}
 });
 console.log('AIRPROP native PostgreSQL runtime cases passed');
}
