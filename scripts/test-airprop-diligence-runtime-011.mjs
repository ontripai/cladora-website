import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export async function runAirpropDiligenceTests(f) {
 const {db,q,check,changed,setActor,id,user,workspace,secondWorkspace,context,physicalContext,localRole,member}=f;
 // Complete the existing isolated authority fixture's catalogue columns.
 await db.exec(`alter table identity.permissions add column resource text,add column action text,add column description text;
 alter table identity.permissions alter column id set default gen_random_uuid();alter table identity.permissions add unique(code);
 alter table platform.module_definitions add column version integer default 1;
 alter table platform.module_permission_bindings add column binding_version integer default 1,add column permission_mode text default 'manage';
 alter table platform.module_permission_bindings alter column id set default gen_random_uuid();
 alter table platform.module_permission_bindings add unique(module_definition_id,permission_id,binding_version);
 insert into identity.permissions(id,code) values('${id(401)}','airprop.asset.read'),('${id(402)}','airprop.asset.manage');
 insert into platform.module_permission_bindings(module_definition_id,permission_id) values('${id(203)}','${id(401)}'),('${id(203)}','${id(402)}');
 update platform.module_permission_bindings b set is_delegable=false,permission_mode=case when p.code like '%.read' then 'read' else 'manage' end
 from identity.permissions p where b.permission_id=p.id and b.module_definition_id='${id(203)}';`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261004112140_airprop_diligence_drafts_v1.sql',import.meta.url),'utf8'));
 await setActor();
 const permission=(await q("select id from identity.permissions where code='airprop.diligence.manage'"))[0].id;
 const opportunity=(await q('select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) r',[context,workspace,'diligence-opportunity-0001',JSON.stringify({name:'Synthetic diligence',country_code:'RO',city:'București',currency:'EUR',asking_price:'100000'})]))[0].r.opportunity_id;
 const assumptions={acquisition_cost:'100000',annual_rent:'8000',annual_opex:'1000',currency:'EUR'};
 const evaluate=async(key,version)=>(await q('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,$5,$6::jsonb) r',[context,workspace,opportunity,key,version,JSON.stringify(assumptions)]))[0].r;
 const create=async(key='diligence-draft-0001',version=1,ctx=context,ws=workspace)=>(await q('select customer_api.create_airprop_diligence_draft_v1($1,$2,$3,$4,$5) r',[ctx,ws,opportunity,version,key]))[0].r;
 const list=async(ws=workspace)=>(await q('select customer_api.list_airprop_diligence_drafts_v1($1,$2,$3) r',[context,ws,opportunity]))[0].r;
 const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
 const conflict=(fn,message)=>assert.rejects(fn,e=>e.code==='22023'&&e.message===message);
 const totals=async()=>Promise.all(['airprop.diligence_cases','audit.events','platform.outbox_events','platform.idempotency_keys'].map(async t=>Number((await q(`select count(*) n from ${t}`))[0].n)));
 await check('new action is not automatically assigned',async()=>{assert.equal(Number((await q('select count(*) n from identity.role_permissions where permission_id=$1',[permission]))[0].n),0);await denied(()=>create());});
 await db.exec(`insert into platform.workspace_role_permissions values('${localRole}','${permission}','allow');`);
 await check('unassessed opportunity cannot create draft',()=>conflict(()=>create(),'airprop_diligence_baseline_conflict'));
 await evaluate('diligence-evaluation-0001',0);
 await check('initial list is empty',async()=>assert.deepEqual((await list()).drafts,[]));
 let first;
 await check('draft pins evaluation and creates audit outbox retry atomically',async()=>{const before=await totals();first=await create();assert.equal(first.status,'draft');assert.equal(first.underwriting_version,1);assert.deepEqual(await totals(),before.map(n=>n+1));assert.ok((await list()).drafts[0].checklist.every(x=>x.status==='pending'&&x.evidence_version_ids.length===0));});
 await check('same-key retry has no side effects',async()=>{const before=await totals();assert.deepEqual(await create(),{...first,idempotent:true});assert.deepEqual(await totals(),before);});
 await check('new key cannot duplicate baseline',()=>conflict(()=>create('diligence-draft-0002'),'airprop_diligence_already_exists'));
 await check('changed baseline cannot reuse key',()=>conflict(()=>create('diligence-draft-0001',2),'airprop_idempotency_conflict'));
 for(const [name,sql] of [
  ['role deny',`update platform.workspace_role_permissions set effect='deny' where workspace_role_id='${localRole}' and permission_id='${permission}'`],
  ['expired assignment',`update platform.workspace_member_roles set valid_to=now()-interval '1 second' where membership_id='${member}'`],
  ['inactive module',`update platform.workspace_modules set status='inactive' where customer_workspace_id='${workspace}' and module_code='airprop_commercial'`],
 ]) await check(`${name} rejects replay`,()=>changed(sql,async()=>{await setActor();await denied(()=>create());}));
 await check('AAL1 rejects read and replay',async()=>{await setActor(user,'aal1');try{await denied(()=>create());await denied(()=>list());}finally{await setActor();}});
 await check('physical context cannot substitute native authority',()=>denied(()=>create('diligence-physical-0001',1,physicalContext)));
 await check('same-tenant other workspace cannot read or replay',async()=>{await assert.rejects(()=>list(secondWorkspace));await assert.rejects(()=>create('diligence-draft-0001',1,context,secondWorkspace));});
 await check('draft baseline is immutable',()=>conflict(()=>q('update airprop.diligence_cases set underwriting_version=2'),'airprop_diligence_draft_immutable'));
 assumptions.annual_rent='9000';await evaluate('diligence-evaluation-0002',1);
 await check('new key with stale evaluation rejected',()=>conflict(()=>create('diligence-stale-0001',1),'airprop_diligence_baseline_conflict'));
 await check('old response survives later evaluation',async()=>assert.deepEqual(await create(),{...first,idempotent:true}));
 await check('new evaluation starts distinct historical draft',async()=>{const next=await create('diligence-draft-0003',2);assert.notEqual(next.diligence_case_id,first.diligence_case_id);assert.deepEqual((await list()).drafts.map(x=>x.underwriting_version),[2,1]);});
 await check('direct table reads and writes denied',async()=>{await db.exec('set role authenticated');try{await denied(()=>q('select * from airprop.diligence_cases'));await denied(()=>q('delete from airprop.diligence_cases'));}finally{await db.exec('reset role');}});
 await check('private helper and noncustomer RPC ACLs closed',async()=>{for(const role of ['anon','authenticated','service_role'])assert.equal((await q('select has_function_privilege($1,$2,$3) ok',[role,'app_private.require_airprop_diligence_target_v1(uuid,uuid,uuid,boolean)','EXECUTE']))[0].ok,false);for(const role of ['anon','service_role'])assert.equal((await q('select has_function_privilege($1,$2,$3) ok',[role,'customer_api.create_airprop_diligence_draft_v1(uuid,uuid,uuid,integer,text)','EXECUTE']))[0].ok,false);});
 assert.equal((await q('select status from airprop.investment_opportunities where id=$1',[opportunity]))[0].status,'underwriting');
 if(db.openConnection) await check('waiting replay reauthorizes after concurrent revocation',async()=>{
  assumptions.annual_rent='10000';await evaluate('diligence-evaluation-0003',2);
  const original=await q('select id,valid_to from platform.workspace_member_roles where membership_id=$1',[member]);
  const firstConnection=await db.openConnection(),secondConnection=await db.openConnection();let running;
  const sql='select customer_api.create_airprop_diligence_draft_v1($1,$2,$3,3,$4) r',args=[context,workspace,opportunity,'diligence-concurrent-0001'];
  try{
   for(const c of [firstConnection,secondConnection]){await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);}
   const firstPid=Number((await firstConnection.query('select pg_backend_pid() pid')).rows[0].pid),secondPid=Number((await secondConnection.query('select pg_backend_pid() pid')).rows[0].pid);
   const committed=(await firstConnection.query(sql,args)).rows[0].r;
   running=secondConnection.query(sql,args).then(result=>({result}),error=>({error}));
   let blocked=false;
   for(let i=0;i<100;i++){if((await q('select pg_blocking_pids($1) blockers',[secondPid]))[0].blockers.includes(firstPid)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
   assert.equal(blocked,true);
   await q("update platform.workspace_member_roles set valid_to=now()-interval '1 second' where membership_id=$1",[member]);
   await firstConnection.query('commit');
   const waiting=await running;assert.equal(waiting.error?.code,'42501');
   assert.equal(Number((await q('select count(*) n from airprop.diligence_cases where opportunity_id=$1 and underwriting_version=3',[opportunity]))[0].n),1);
   assert.equal(committed.idempotent,false);
  }finally{
   await firstConnection.query('rollback');await secondConnection.query('rollback');
   if(running)await running;
   for(const row of original)await q('update platform.workspace_member_roles set valid_to=$2 where id=$1',[row.id,row.valid_to]);
   await firstConnection.end();await secondConnection.end();
  }
 });
 console.log('AIRPROP diligence draft runtime checks passed');
}
