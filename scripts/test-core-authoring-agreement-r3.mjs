/** Exact successor modules + actual Core transports. Synthetic PG/Auth only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const SERVICE='fdfe3c6eb5f5f7dd586d21b5d8a8855fa912cb83',AIRPROP='dc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const predecessor=process.argv.includes('--predecessor'),isolatedCapture=process.argv.includes('--isolated-capture');
const baselineCore=new Set(['src/lib/core/functional-command-runtime-v1.ts','src/lib/core/functional-producers-v1.ts','src/lib/core/service-s01/provider-agreement-reader-v1.ts']);
const read=(file,encoding)=>{const path=String(file),rel=path.startsWith(root+'/')?path.slice(root.length+1):path;
 const ref=isolatedCapture&&rel==='src/lib/core/service-quote-command-binding-v1.ts'?'fc179df92f26d63de9cfe03c5644719f0428913d':predecessor&&baselineCore.has(rel)?'fc179df92f26d63de9cfe03c5644719f0428913d':rel.startsWith('src/lib/customer/')?SERVICE:rel.startsWith('src/lib/airprop/')?AIRPROP:null;
 return ref?execFileSync('git',['show',`${ref}:${rel}`],{cwd:root,encoding:'utf8'}):readFileSync(file,encoding);};
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,env,target,id,auth,runtimeModule}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,env,target,id,auth,runtimeModule};')(assert,read,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const quote=env.load('src/lib/customer/service-quote-command-v1.ts');
const offering=env.load('src/lib/customer/service-v14-execution/offering-authoring-composition-v1.ts');
const quoteBinding=env.load('src/lib/core/service-quote-command-binding-v1.ts');
const identityPort=env.load('src/lib/core/service-authoring-identity-port-v1.ts');
const selected={context_id:id(4),workspace_id:id(3)};
const input={...selected,request_id:id(60),expected_request_version:3,published_revision_id:id(61),scope:'Synthetic non-binding quote',total_minor:'12000',currency:'RON',payer_shares:[{party_id:id(62),amount_minor:'12000'}],valid_until:'2026-12-01T00:00:00.000000Z',idempotency_key:'successor-quote-test-001'};
const source_binding={quote_version:1,provider_party_id:id(72),provider_agreement_id:id(73),provider_agreement_version:1,beneficiary_party_id:id(62)};
const source={workspace_id:id(3),request_id:id(60),request_version:3,published_revision_id:id(61),request_status:'submitted',provider_party_id:id(72),provider_agreement_id:id(73),provider_agreement_version:1,beneficiary_party_id:id(62),membership_id:id(6),next_quote_version:1,allowed_payer_party_ids:[id(62)]};
const revision={labels:{en:'Service',fa:'خدمت',ro:'Serviciu'},description:{en:'Synthetic',fa:'مصنوعی',ro:'Sintetic'},acquisition_mode:'pre_quote',price:{kind:'quote_required'},valid_from:'2026-01-01T00:00:00.000000Z',valid_until:null,cancellation_terms:{en:'Terms',fa:'شرایط',ro:'Termeni'},acceptance_criteria:{en:'Acceptance',fa:'تأیید',ro:'Acceptare'},document_version_ids:[]};
async function baseSetup(){const x=await fixture();x.request=new Request('http://localhost/service');x.binding=await quoteBinding.createCoreServiceQuoteCommandBindingV1({pool:x.f.pool,target}).bind(x.request);x.readers=runtimeModule.createCoreFunctionalCommandRuntimeV1({pool:x.f.pool,target,offering:null,request:x.request}).readers;return x;}
async function plan(x){return{transaction_id:id(80),command_id:id(81),quote_id:id(82),identity:await x.binding.resolveIdentity(selected),source_binding,input};}
const S01=env.load('src/lib/core/service-s01/provider-agreement-reader-v1.ts').CORE_S01_SQL;
const adapter=env.load('src/lib/customer/service-quote-postgres-adapter-v1.ts');
const clockSql=readFileSync(resolve(root,'src/lib/core/scoped-server-clock-v1.ts'),'utf8').match(/scope.query\(`([\s\S]*?)`\)/)[1];
const authoring=env.load('src/lib/core/service-authoring-agreement-runtime-v2.ts');
async function setup(){
 const x=await baseSetup(),connect=x.f.pool.connect.bind(x.f.pool);
 x.versionScopes=['service.quote.create'];x.until=null;x.headStatus='effective';x.denied=false;x.scanCount=0;x.inserts=0;x.s01Finals=0;
 x.f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);
  client.query=async(text,values=[])=>{
   if(x.wait)await x.wait(text,values);
   if(text===clockSql)return{rowCount:1,rows:[{database_transaction_id:String(100+x.f.attempts),actor_id:id(1),workspace_id:id(3),evaluated_at:x.f.now}]};
   if(text===adapter.SERVICE_QUOTE_POSTGRES_SQL_V1.source)return{rowCount:1,rows:[{
    ...source,request_version:'3',provider_agreement_version:'1',next_quote_version:'1',
    beneficiary_current:true,provider_current:true,allowed_payer_party_ids:undefined,
   }].map(({allowed_payer_party_ids,...r})=>r)};
   if(text===adapter.SERVICE_QUOTE_POSTGRES_SQL_V1.insert){x.inserts++;x.f.writes.push(['quote',values[0]]);return{rowCount:1,rows:[{id:values[0],version:'1',request_version:'3'}]};}
   const result=await query(text,values);
   if(text===S01.version)result.rows[0]={...result.rows[0],allowed_service_scope:x.versionScopes,valid_until:x.until};
   if(text===S01.discover||text===S01.head){x.scanCount++;result.rows[0].status=x.headStatus;if(x.foreign)result.rows[0].workspace_id=id(99);}
   if(text===S01.final){x.s01Finals++;result.rows[0].allowed=!x.denied;if(x.sessionGone)throw Object.assign(Error('private-session-denied'),{code:'42501'});}
   return result;
  };return client;};
 x.app=authoring.createCoreServiceAuthoringAgreementRuntimeV2({pool:x.f.pool,target,request:x.request});
 x.agreements=[];x.sourceErrors=[];
 x.ports=adapter.createServiceQuotePostgresAdapterV1({async resolveProviderAgreement(...args){try{const answer=await x.app.readers.resolveProviderAgreement(...args);x.agreements.push(answer);return answer;}catch(error){x.sourceErrors.push(error);throw error;}}});
 x.prepare=async()=>quote.prepareServiceQuoteCommandV1(await plan(x),x.ports);
 return x;
}
let n=0;async function check(name,fn){if(isolatedCapture&&!name.startsWith('actual SERVICE resolver factory'))return;await fn();console.log(`PASS ${++n} ${name}`);}
async function execute(x){const p=await x.prepare();return x.app.host.execute(p.command,p.providers);}
if(predecessor){const x=await setup(),before=structuredClone(x.f.writes),r=await execute(x);assert.equal(r.status,'denied');assert.equal(x.inserts,0);assert.deepEqual(x.f.writes,before);console.log('COUNTEREXAMPLE_CONFIRMED: actual fdfe Quote + predecessor Core Request-only producer denies authoring; zero effects');process.exit(0);}
await check('actual fdfe Quote adapter/provider + canonical authoring S01 + existing C03 commits controlled transaction',async()=>{
 const x=await setup(),r=await execute(x);assert.equal(r.status,'committed',JSON.stringify(r));assert.equal(x.inserts,1);assert.ok(x.s01Finals>=2);assert.ok(x.scanCount>=4);
 assert.ok(x.f.writes.some(row=>row[0]==='quote'));assert.ok(x.calls.includes('commit'));
});
await check('same original C03 key/body replays without duplicate quote/audit/outbox; authority renewed',async()=>{
 const x=await setup(),p=await x.prepare();assert.equal((await x.app.host.execute(p.command,p.providers)).status,'committed');const before=structuredClone(x.f.writes),checks=x.checkpoints;
 const r=await x.app.host.execute(p.command,p.providers);assert.equal(r.status,'exact_replay',JSON.stringify(r));assert.deepEqual(x.f.writes,before);assert.equal(x.inserts,1);assert.ok(x.checkpoints>checks);
});
for(const [name,patch] of [
 ['wrong service scope',x=>{x.versionScopes=['service.request.create'];}],
 ['expired agreement',x=>{x.until='2026-11-02';}],
 ['revoked head',x=>{x.headStatus='revoked';}],
 ['foreign Workspace source',x=>{x.foreign=true;}],
])await check(name+' never inserts or commits',async()=>{const x=await setup();patch(x);const before=structuredClone(x.f.writes),r=await execute(x);assert.equal(r.status,'denied');assert.equal(x.inserts,0);assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes('commit'),false);});
for(const [name,change] of [
 ['authority revoked at last source wait',x=>{x.denied=true;}],
 ['session revoked at last source wait',x=>{x.sessionGone=true;}],
 ['expiry crossed at last source wait',x=>{x.f.now='2026-12-01T00:00:00.000000Z';}],
])await check(name+' is checked after wait, not cached allow',async()=>{
 const x=await setup();x.until='2026-12-01';let changed=false;x.wait=async sql=>{if(sql===S01.head&&x.scanCount>=3&&!changed){changed=true;await Promise.resolve();change(x);}};
 const before=structuredClone(x.f.writes),r=await execute(x);assert.equal(changed,true);assert.equal(r.status,'denied',JSON.stringify(r));assert.equal(x.inserts,0);assert.deepEqual(x.f.writes,before);if(name!=='expiry crossed at last source wait'&&x.agreements.length){const a=x.agreements.at(-1);assert.equal(a.agreement_status,'withheld');for(const key of ['tenant_id','workspace_id','provider_party_id','provider_agreement_id','provider_agreement_version'])assert.equal(a[key],null);assert.equal(a.action_authorization,'not_evaluated');}
});
await check('original40001 from source wait reaches existing three-attempt host; zero model mutation',async()=>{
 const x=await setup(),err=Object.assign(Error('serialization'),{code:'40001'});let hits=0;x.wait=async sql=>{if(sql===S01.version){hits++;throw err;}};
 const before=structuredClone(x.f.writes),r=await execute(x);assert.equal(r.status,'denied');assert.equal(hits,3);assert.deepEqual(x.f.writes,before);assert.equal(x.inserts,0);assert.equal(x.sourceErrors.length,3);assert.ok(x.sourceErrors.every(e=>e===err));
});
await check('lost COMMIT remains UNKNOWN; exact same command recovery creates no second effect',async()=>{
 const x=await setup(),p=await x.prepare();x.f.lostCommit=true;const r=await x.app.host.execute(p.command,p.providers);assert.equal(r.status,'unknown_commit');
 const before=structuredClone(x.f.writes);x.f.lostCommit=false;const recovered=await x.app.host.execute(p.command,p.providers);assert.equal(recovered.status,'exact_replay');assert.deepEqual(x.f.writes,before);assert.equal(x.inserts,1);
});
await check('changed-body conflict and foreign Context never become fresh authoring mutation',async()=>{
 const x=await setup(),p=await x.prepare();assert.equal((await x.app.host.execute(p.command,p.providers)).status,'committed');const before=structuredClone(x.f.writes);
 const conflict=await x.app.host.execute({...p.command,input_fingerprint:'sha256:'+'a'.repeat(64)},p.providers);assert.equal(conflict.status,'denied');
 await assert.rejects(x.app.host.execute({...p.command,context_id:id(99)},p.providers),/scope_mismatch/);assert.deepEqual(x.f.writes,before);
});
await check('default Request reader remains separate; authoring access does not bypass published Offering policy',async()=>{
 const x=await setup(),p=await x.prepare();const bad=quote.prepareServiceQuoteCommandV1(await plan(x),adapter.createServiceQuotePostgresAdapterV1({resolveProviderAgreement:x.readers.resolveProviderAgreement}));
 const r=await x.binding.host.execute(bad.command,bad.providers);assert.equal(r.status,'denied');assert.equal(x.inserts,0);
 for(const patch of [{permission_code:'services.orders.request'},{module_code:'airprop_commercial'},{evaluation_purpose:'experience.guide.command'}])await assert.rejects(x.app.host.execute({...p.command,...patch},p.providers),/profile_mismatch/);
});
await check('actual Offering composer obtains its distinct authoring profile and canonical agreement',async()=>{
 const x=await setup();x.versionScopes=['service.offering.create'];const identity=identityPort.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:x.request});
 const p=await offering.createServiceOfferingAuthoringCompositionV1({identity,readers:x.app.readers}).prepareCreate({transaction_id:id(83),command_id:id(84),offering_id:id(70),revision_id:id(71),input:{...selected,definition_id:id(74),provider_party_id:id(72),provider_agreement:{agreement_id:id(73),agreement_version:1},coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},revision,idempotency_key:'authoring-r3-offering'}});
 let evidence;const result=await x.app.host.execute(p.command,{...p.providers,async validateProviders(...args){evidence=await p.providers.validateProviders(...args);return evidence;},async mutate(){throw Error('CONTROLLED_DOMAIN_WRITE_NOT_IMPLEMENTED');}});
 assert.equal(evidence?.decision,'accepted');assert.equal(result.status,'denied');assert.ok(x.s01Finals>0,'actual composer reached canonical authoring agreement');assert.equal(x.calls.includes('commit'),false);
});

await check('actual SERVICE resolver factory shares request-local Core authoring capture with its source port',async()=>{
 const x=await setup(),owner=env.load('src/lib/customer/service-quote-runtime-composition-v1.ts');let preparation=0;
 // CONTROLLED source-preparation reservation fixture only. No durable preparation
 // producer/install/native claim: IDs are fixed once; never re-minted on retry.
 const sourcePort={contract_version:'service-quote-source-preparation.v1',async bind(request){
  assert.equal(request,x.request);const shared=authoring.createCoreServiceAuthoringAgreementRuntimeV2({pool:x.f.pool,target,request});assert.equal(shared,x.app);
  return{contract_version:'service-quote-source-preparation.v1',async read(){assert.fail('unrelated history read');},
   async prepareOrRecover({command,command_sha256,current_identity}){preparation++;return{contract_version:'service-quote-source-preparation.v1',transaction_id:id(80),command_id:id(81),quote_id:id(82),idempotency_key:command.idempotency_key,command_sha256,identity:current_identity,source_binding};},
   resolveProviderAgreement:shared.readers.resolveProviderAgreement};
 }};
 const resolver=owner.createServiceQuoteRuntimeResolverV1({pool:x.f.pool,target,source:sourcePort});
 const port=await resolver(x.request);assert.ok(port);if(isolatedCapture){await assert.rejects(port.create(input),e=>e.code==='PROVIDER_UNAVAILABLE');assert.equal(x.inserts,0);console.log('COUNTEREXAMPLE_CONFIRMED: predecessor command host cannot use separate canonical capture');return;}const result=await port.create(input);assert.ok(result);assert.equal(preparation,1);assert.equal(x.inserts,1);assert.ok(x.s01Finals>=2);
});
await check('request-local authoring composition rejects foreign Pool or target; cannot reuse across Request',async()=>{
 const x=await setup();assert.throws(()=>authoring.createCoreServiceAuthoringAgreementRuntimeV2({pool:{...x.f.pool},target,request:x.request}),/target_mismatch/);
 assert.throws(()=>authoring.createCoreServiceAuthoringAgreementRuntimeV2({pool:x.f.pool,target:{...target,database_oid:999},request:x.request}),/target_mismatch/);
 assert.notEqual(authoring.createCoreServiceAuthoringAgreementRuntimeV2({pool:x.f.pool,target,request:new Request('http://localhost/service')}),x.app);
 const before=x.calls.length;auth.claims.aal='aal1';await assert.rejects(quoteBinding.createCoreServiceQuoteCommandBindingV1({pool:x.f.pool,target}).bind(new Request('http://localhost/quotes')),e=>e.code==='MFA_REQUIRED');assert.equal(x.calls.length,before);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/R3/S01',SERVICE,new_groups:n,proof:'CONTROLLED_REAL_MODULE_COUPLING',native:'NOT_RUN_NOT_PASS',binding:null}));
