// Controlled SQL transport only. No PostgreSQL/driver/Auth/install or historical fixture proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url), cache=new Map();
const CORE='ef69fa82e19ab269701d6df9abd7bdfd67e3e50e';
const DOCS='c0caf3e70d97c3d09b16cbff91188367804cba6b';
const source=p=>p.startsWith('src/lib/core/')?execFileSync('git',['show',`${CORE}:${p}`],{cwd:root,encoding:'utf8'})
 :p.startsWith('src/lib/customer/documents-')?execFileSync('git',['show',`${DOCS}:${p}`],{cwd:root,encoding:'utf8'}):readFileSync(path.join(root,p),'utf8');
function load(p){if(cache.has(p))return cache.get(p);const m={exports:{}};cache.set(p,m.exports);
 const js=ts.transpileModule(source(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(n=>n.startsWith('.')?load(path.posix.normalize(path.posix.join(path.posix.dirname(p),n.endsWith('.ts')?n:`${n}.ts`))):require(n),m,m.exports);cache.set(p,m.exports);return m.exports;}
const writer=load('src/lib/community/experience-guide-save-writer-v1.ts');
const core=load('src/lib/core/postgres-transaction-host-v1.ts');
const docs=load('src/lib/customer/documents-ce012-reference-provider-v1.ts');
const ce=load('src/lib/community/experience-guide-command-contract.ts');
const editor=load('src/lib/community/experience-guide-editor-adapter.ts');
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),tenant=id(2),workspace=id(3),context=id(4),guideId=id(5),member=id(6);
const now='2026-11-02T17:00:00.000Z';
function command(){const guide={contract:'ce012-guide-command.v1',version:1,command_id:id(7),action:'save_draft',context_id:context,workspace_id:workspace,guide_id:guideId,expected_guide_version:1,
 payload:{title:'Arrival',step_id:id(8),step_title:'Read',instructions:'Read the instructions',document_target:{document_id:id(9),document_version_id:id(10),document_version:3,label:'Untrusted label'}},payload_fingerprint:'',idempotency_key:'ce012-key-0001'};
 guide.payload_fingerprint=ce.fingerprintCe012GuideSavePayload(guide);
 const cmd=core.coreTransactionCommandV2Schema.parse({contract_version:'core-transaction-command.v2',transaction_id:id(11),command_id:guide.command_id,context_id:context,workspace_id:workspace,actor_id:actor,authority_version:1,
 permission_code:'experience.guide.manage',module_code:'experience_guides',evaluation_purpose:'experience.guide.command',aggregate_type:'experience_guide',aggregate_id:guideId,aggregate_version:2,
 provider_source_ids:[guideId,id(9),id(10)],idempotency_key:guide.idempotency_key,input_fingerprint:guide.payload_fingerprint,subject_reference:{kind:'experience.guide',id:guideId,version:1,relation:'save_draft',request_version:1}});
 return {guide,cmd};}
function fixture(opts={}){
 const f={version:1,ledger:null,ce:null,writes:[],trace:[],attempts:0,commits:0,rollbacks:0,allowed:true,options:opts};
 const row=rows=>({rows,rowCount:rows.length});
 const pool={async connect(){let saved;const client={release(){},async query(sql,v=[]){const q=sql.replace(/\s+/g,' ').trim();f.trace.push({q,v:structuredClone(v)});
 if(q.startsWith('begin ')){f.attempts++;saved=structuredClone({version:f.version,ledger:f.ledger,ce:f.ce,writes:f.writes});return row([]);}
 if(q==='rollback'){f.rollbacks++;Object.assign(f,saved);return row([]);}
 if(q==='commit'){if(opts.deferredFail)throw Error('modeled deferred constraint failure');f.commits++;if(opts.lostReply){opts.lostReply=false;throw Error('lost commit acknowledgement');}return row([]);}
 if(q.startsWith('set ')||q.startsWith('select pg_advisory'))return row([]);
 if(q.includes('from platform.customer_workspaces'))return row([{tenant_id:tenant}]);
 if(q.startsWith('select txid_current()::text as id,'))return row([{id:String(100+f.attempts),now}]);
 if(q.startsWith('select txid_current()::text as transaction_id, auth.uid()'))return row([{transaction_id:String(100+f.attempts),actor_id:actor,isolation:'serializable',evaluated_at:now}]);
 if(q==='select auth.uid()::text as actor_id')return row([{actor_id:actor}]);
 if(q.includes('canonical_authority_revision_v1'))return row([{revision:'1'}]);
 if(q.includes('m.user_id::text as actor_id'))return row([{tenant_id:tenant,actor_id:actor,status:'active',current:!opts.revoked}]);
 if(q.includes('from platform.module_definitions'))return row([{allowed:f.allowed,evaluated_at:now,module_definition_id:id(12),entitlement_key:v[3]==='documents'?'module.documents':'module.experience_guides'}]);
 if(q.startsWith('select auth.uid()=$1'))return row([{actor_bound:true,allowed:f.allowed}]);
 if(q.includes('select m.id::text'))return row(opts.missingMembership?[]:[{id:member}]);
 if(q.startsWith('select version,status::text from experience.guides'))return row([{version:f.version,status:'draft'}]);
 if(q.includes('from platform.idempotency_keys')&&q.includes('for update'))return row(f.ledger?[f.ledger]:[]);
 if(q===writer.CE012_SAVE_STORED_SQL.replace(/\s+/g,' ').trim())return row(f.ce?[f.ce]:[]);
 if(q===writer.CE012_SAVE_LEDGER_SQL.replace(/\s+/g,' ').trim())return row(f.ledger?[f.ledger]:[]);
 if(q.includes("auth.jwt()->>'aal'"))return row([{transaction_id:String(100+f.attempts),isolation:'serializable',actor_bound:true,aal2:true}]);
 if(q.includes('from documents.documents d where d.id='))return row([{current_version:opts.staleTarget?4:3,active:true}]);
 if(q.includes('select v.version,v.scanning_status'))return row([{version:3,scanning_status:'clean',checksum_status:'verified'}]);
 if(q.includes('select p.id from documents.document_permissions'))return row([]);
 if(q.includes('as allowed')&&q.includes('from documents.documents'))return row([{allowed:!opts.docsDenied}]);
 if(q.includes('as clean'))return row([{clean:true}]);
 if(q==='select clock_timestamp()::text as now')return row([{now}]);
 if(q.startsWith('insert into platform.idempotency_keys')){f.ledger={actor_id:v[1],key:v[2],request_hash:v[3],response_ref:null,expires_at:new Date('2999-01-01')};f.writes.push('ledger');return row([]);}
 if(q.startsWith('update experience.guides')){if(opts.fail40001){opts.fail40001--;throw Object.assign(Error('serialization'),{code:'40001'});}if(opts.failMutation)throw Error('mutation failure');if(f.version!==v[5])return row([]);f.version=v[4];f.writes.push('guide');return row([{id:guideId}]);}
 if(q.startsWith('insert into experience.guide_steps')){f.writes.push('step');return row([]);}
 if(q.startsWith('insert into experience.guide_references')){f.writes.push('target');return row([]);}
 if(q.startsWith('insert into experience.guide_save_receipts_v1')){f.ce={actor_id:v[2],membership_id:v[3],canonical_key:v[4],command_hash:v[5],command_json:JSON.parse(v[6]),guide_command:JSON.parse(v[7]),ce_receipt:JSON.parse(v[8]),mutation_id:v[9],database_transaction_id:v[10]};f.writes.push('ce');return row([{ce_receipt:f.ce.ce_receipt}]);}
 if(q.startsWith('insert into audit.events')){f.writes.push('audit');return row([{id:'1'}]);}
 if(q.startsWith('insert into platform.outbox_events')){f.writes.push('outbox');return row([{id:id(13)}]);}
 if(q.startsWith('update platform.idempotency_keys')){f.ledger.response_ref=JSON.parse(v[2]);return row([]);}
 throw Error(`UNMODELED SQL: ${q}`);
 }};return client;}};
 f.pool=pool;f.host=core.createCorePostgresTransactionHostV1(pool);return f;
}
const relationOnly=process.argv.includes('--relation-only');
let phase='base';
let count=0;async function check(name,fn){if(relationOnly&&phase==='base')return;await fn();console.log(`ok ${++count} - ${name}`);}
await check('actual Core host + CE executor + official Docs factory stage one atomic save; three distinct IDs',async()=>{
 const f=fixture(),{guide,cmd}=command();const p=writer.createCe012SaveWriterProviderV1(guide,docs);const r=await f.host.execute(cmd,p);
 assert.equal(r.status,'committed');assert.equal(f.commits,1);assert.equal(f.version,2);
 assert.equal(new Set([r.receipt.receipt_id,r.receipt.mutation_id,f.ce.ce_receipt.receipt_id]).size,3);
 assert.equal(f.ce.ce_receipt.document_target.label,'Document reference');assert.equal(f.ce.canonical_key,`core-tx.v1:${workspace}:${guide.idempotency_key}`);
 assert.deepEqual(f.writes,['ledger','guide','step','target','ce','audit','outbox']);
 assert.ok(f.trace.findIndex(x=>x.q.startsWith('insert into experience.guide_save'))<f.trace.findIndex(x=>x.q.startsWith('update platform.idempotency_keys')));
});
await check('same-wire replay revalidates official historical Documents and CE receipt without writes',async()=>{
 const f=fixture(),{guide,cmd}=command();assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'committed');
 const before=structuredClone(f.writes),receipt=f.ledger.response_ref;const r=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));
 assert.equal(r.status,'exact_replay');assert.deepEqual(r.receipt,receipt);assert.deepEqual(f.writes,before);assert.equal(f.commits,1);
});
await check('rollback drops CE domain/projection and C03/audit/outbox after failure',async()=>{
 const f=fixture({failMutation:true}),{guide,cmd}=command();assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');assert.equal(f.version,1);assert.equal(f.ce,null);assert.equal(f.ledger,null);assert.deepEqual(f.writes,[]);
});
await check('Core alone owns bounded 40001 fresh attempts; exact command unchanged',async()=>{
 const f=fixture({fail40001:1}),{guide,cmd}=command(),wire=JSON.stringify(cmd);assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'committed');assert.equal(f.attempts,2);assert.equal(JSON.stringify(cmd),wire);assert.equal(f.commits,1);
});
for(const [name,opts] of [['revoked',{revoked:true}],['Docs denial',{docsDenied:true}],['stale immutable target',{staleTarget:true}],['missing membership',{missingMembership:true}]])await check(`${name}: zero durable effects`,async()=>{
 const f=fixture(opts),{guide,cmd}=command();assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');assert.deepEqual(f.writes,[]);assert.equal(f.ce,null);
});
await check('missing official Documents capability is NOT_READY without write',async()=>{
 const f=fixture(),{guide,cmd}=command();assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide))).status,'denied');assert.deepEqual(f.writes,[]);
});
for(const field of ['payload_fingerprint','command_id','context_id','workspace_id','guide_id','expected_guide_version'])await check(`${field} mismatch cannot stage effects`,async()=>{
 const f=fixture(),{guide,cmd}=command();guide[field]=field==='expected_guide_version'?2:field==='payload_fingerprint'?`sha256:${'0'.repeat(64)}`:id(99);
 assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');assert.deepEqual(f.writes,[]);
});
await check('lost commit reply is UNKNOWN; existing editor retains original command and explicit retry replays',async()=>{
 const f=fixture({lostReply:true}),{guide,cmd}=command();let builds=0;
 // A lost network reply follows durable modeled COMMIT; rollback cannot undo settlement.
 const connection=f.pool.connect.bind(f.pool);f.pool.connect=async()=>{const c=await connection(),query=c.query.bind(c);let committed=false;
 c.query=async(q,v)=>{if(q==='rollback'&&committed)return {rows:[],rowCount:0};try{return await query(q,v);}catch(e){if(q==='commit'&&f.commits)committed=true;throw e;}};return c;};
 const executor=writer.createCe012SaveWriterExecutorV1(f.host,cmd,docs);
 const adapter=editor.createCe012GuideEditorAdapter({executor,buildCommand(){builds++;return guide;},getActiveIdentity(){return {context_id:context,workspace_id:workspace,guide_id:guideId};}});
 const input={guide_id:guideId,title:'Arrival',step_title:'Read',step_body:'Read the instructions',target_id:'x'};
 await assert.rejects(adapter.saveDraft(input),e=>e.code==='CE012_SAVE_UNKNOWN');assert.equal(f.commits,1);assert.equal(builds,1);
 await adapter.saveDraft(input);assert.equal(builds,1);assert.equal(f.commits,1);assert.equal(f.version,2);
});
phase='relation';
await check('stored relationship independently reads C03; expected JSON is not proof',async()=>{
 const f=fixture(),{guide,cmd}=command();const r=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));
 const c=await f.pool.connect(),scope={transaction_id:cmd.transaction_id,database_transaction_id:'777',tenant_id:tenant,workspace_id:workspace,actor_id:actor,attempt:1,query:c.query.bind(c)};
 const relation=await writer.readCe012SaveWriterRelationV1(scope,cmd,guide,r.receipt);
 assert.equal(relation.ce_receipt.receipt_id,f.ce.ce_receipt.receipt_id);assert.equal(relation.core_receipt_id,r.receipt.receipt_id);
 assert.equal(relation.runtime_binding,null);assert.equal(relation.action_authorization,'not_evaluated');
 const forged=structuredClone(r.receipt);forged.receipt_id=id(95);
 await assert.rejects(writer.readCe012SaveWriterRelationV1(scope,cmd,guide,forged));
 f.ledger=null;await assert.rejects(writer.readCe012SaveWriterRelationV1(scope,cmd,guide,r.receipt));
});
for(const field of ['mutation_id','command_hash','guide_command','ce_receipt','membership_id'])await check(`persisted ${field} corruption denies replay without effects`,async()=>{
 const f=fixture(),{guide,cmd}=command();await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));
 const before=structuredClone(f.writes);
 if(field==='guide_command')f.ce.guide_command.payload.document_target.document_version++;
 else if(field==='ce_receipt')f.ce.ce_receipt.document_target.document_version++;
 else f.ce[field]=field==='command_hash'?'0'.repeat(64):id(95);
 assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');assert.deepEqual(f.writes,before);
});
await check('denial after UNKNOWN retains key/wire, no automatic resubmission or success',async()=>{
 const {guide,cmd}=command();let n=0;
 const host={async execute(received){assert.deepEqual(received,cmd);n++;return n===1?{status:'unknown_commit',code:'READBACK_REQUIRED'}:{status:'denied',code:'AUTHORITY_DENIED'};}};
 const e=writer.createCe012SaveWriterExecutorV1(host,cmd,docs);
 await assert.rejects(e.execute(guide),x=>x.code==='CE012_SAVE_UNKNOWN');
 await assert.rejects(e.execute(guide),x=>x.code==='CE012_SAVE_UNKNOWN');assert.equal(n,2);
 await assert.rejects(async()=>e.execute({...guide,payload:{...guide.payload,title:'Different'}}));assert.equal(n,2);
});
await check('executor coalesces simultaneous dispatch, caller mutation cannot rebind retained snapshots',async()=>{
 const f=fixture(),{guide,cmd}=command();const e=writer.createCe012SaveWriterExecutorV1(f.host,cmd,docs);
 const a=e.execute(guide),b=e.execute(guide);assert.equal(a,b);guide.payload.title='caller mutation';cmd.actor_id=id(95);
 assert.equal((await a).result_code,'OK');assert.equal(f.commits,1);assert.equal(f.ce.guide_command.payload.title,'Arrival');
});
await check('provider propagates original40001 object; only Core retries',async()=>{
 const f=fixture(),{guide,cmd}=command();const p=writer.createCe012SaveWriterProviderV1(guide,docs);let scope,authority;
 await f.host.execute(cmd,{...p,async validateProviders(s,c,a){scope=s;authority=a;return p.validateProviders(s,c,a);}});
 const error=Object.assign(Error('serialization'),{code:'40001'});
 const s={...scope,query:async()=>{throw error;}};
 await assert.rejects(p.validateProviders(s,cmd,authority),x=>x===error);
});
await check('deferred failure model rolls back all units; not PG trigger execution',async()=>{
 const f=fixture({deferredFail:true}),{guide,cmd}=command();const r=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));
 assert.equal(r.status,'unknown_commit');assert.equal(f.ce,null);assert.equal(f.ledger,null);assert.deepEqual(f.writes,[]);assert.equal(f.version,1);
});
await check('review-only proposal has deferred invoker binding, closed ACL and no runtime installer',async()=>{
 const s=readFileSync(path.join(root,'supabase/proposals/ce012_save_writer_relation_v1.sql'),'utf8');
 assert.match(s,/raise exception 'ce012_save_writer_review_only' using errcode='55000'/);
 assert.match(s,/create constraint trigger[\s\S]*deferrable initially deferred/);
 assert.match(s,/language plpgsql security invoker/);assert.match(s,/force row level security/);
 assert.doesNotMatch(s,/\bgrant\s+(select|insert|update|delete|all|execute)\b/i);
 assert.match(s,/txid_current\(\)::text/);assert.match(s,/response_ref/);
 assert.match(s,/p->>'mutation_id' is distinct from new.mutation_id::text/);
 assert.equal(writer.CE012_SAVE_WRITER_RUNTIME_BINDING,null);
});
console.log(JSON.stringify({result:'PASS_CONTROLLED_TRANSPORT_ONLY',cases:count,core:CORE,docs:DOCS,runtime_binding:null,native_pg:'NOT_RUN_NOT_PASS',historical_slots:'BLOCKED'}));
