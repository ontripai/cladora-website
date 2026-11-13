/** Listing Core profile/transport wiring; controlled domain provider, NOT Listing native proof. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,env,target,id,auth,next,SQL}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,env,target,id,auth,next,SQL};')(assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
const api=env.load('src/lib/core/listing-command-binding-v1.ts');
async function setup(){const x=await fixture();x.binding=api.createCoreListingCommandBindingV1({pool:x.f.pool,target});x.request=new Request('http://localhost/airprop');return x;}
function command(x){const c=next(x).cmd;return{...c,permission_code:'airprop.opportunity.manage',module_code:'airprop_commercial',evaluation_purpose:'airprop.b2',aggregate_type:'controlled_listing_transport_test',provider_source_ids:[c.aggregate_id],subject_reference:{kind:'controlled.listing',id:c.aggregate_id,version:1,relation:'controlled_readback',request_version:1}};}
const providers={provider_code:'controlled-listing-transport-test.v1',async resolveAuthority(){assert.fail('canonical Core must replace caller authority');},async validateProviders(s,c,a){return{contract_version:'core-transaction-provider-evidence.v1',evidence_id:randomUUID(),provider_code:this.provider_code,transaction_id:s.transaction_id,command_id:c.command_id,workspace_id:s.workspace_id,actor_id:s.actor_id,context_id:c.context_id,authority_decision_id:a.decision_id,authority_version:a.authority_version,attempt:s.attempt,subject_reference:c.subject_reference,evaluated_at:a.evaluated_at,source_disclosure:'status_only',source_reference:null,decision:'accepted',denial_reason:null,reference_state:'available',current_actor_can_read:true};},async mutate(){return{mutation_id:randomUUID()};}};
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('Listing identity uses exact manage/module pair and server actor; read is not command authority',async()=>{const x=await setup(),p=await x.binding.bind(x.request),r=await p.resolveIdentity({context_id:id(4),workspace_id:id(3)});assert.equal(r.actor_id,id(1));assert.equal(r.permission_code,'airprop.opportunity.manage');assert.equal(r.module_code,'airprop_commercial');assert.equal(r.reusable_as_authority,false);assert.equal(r.action_authorization,'not_evaluated');});
await check('SERVICE/Guide/read purpose cannot be relabelled as Listing command',async()=>{const x=await setup(),p=await x.binding.bind(x.request),c=command(x);for(const patch of [{permission_code:'services.catalog.manage'},{permission_code:'airprop.asset.read'},{module_code:'services_catalog'},{evaluation_purpose:'airprop.portfolio.read'}])await assert.rejects(p.host.execute({...c,...patch},providers));assert.equal(x.calls.length,0);});
await check('C03 original command commits/replays through existing host only, no replacement identity',async()=>{const x=await setup(),p=await x.binding.bind(x.request),c=command(x),before=JSON.stringify(c);assert.equal((await p.host.execute(c,providers)).status,'committed');const writes=structuredClone(x.f.writes);assert.equal((await p.host.execute(c,providers)).status,'exact_replay');assert.deepEqual(x.f.writes,writes);assert.equal(JSON.stringify(c),before);});
await check('AAL1 or original actor mismatch cannot execute command',async()=>{const x=await setup();auth.claims.aal='aal1';await assert.rejects(x.binding.bind(x.request));const y=await setup(),p=await y.binding.bind(y.request);await assert.rejects(p.host.execute({...command(y),actor_id:id(99)},providers));assert.equal(y.calls.length,0);});
await check('request scope drift denied and canonical current-authority failure never becomes success',async()=>{const x=await setup(),p=await x.binding.bind(x.request);await p.resolveIdentity({context_id:id(4),workspace_id:id(3)});await assert.rejects(p.resolveIdentity({context_id:id(99),workspace_id:id(3)}));x.checkpointFault=Object.assign(Error('synthetic revoke'),{code:'42501'});const before=structuredClone(x.f.writes);const r=await p.host.execute(command(x),providers);assert.equal(r.status,'denied');assert.deepEqual(x.f.writes,before);});
await check('shared identity schema rejects cross-domain module pairs and preserves Offering pair',async()=>{
 const schema=env.load('src/lib/core/domain-command-identity-v1.ts').coreDomainCommandIdentitySelectionV1Schema,base={context_id:id(4),workspace_id:id(3)};
 assert.equal(schema.safeParse({...base,permission_code:'services.catalog.manage',module_code:'airprop_commercial'}).success,false);
 assert.equal(schema.safeParse({...base,permission_code:'airprop.opportunity.manage',module_code:'services_catalog'}).success,false);
 assert.equal(schema.safeParse({...base,permission_code:'services.catalog.publish',module_code:'services_catalog'}).success,true);
});
await check('same key with changed fingerprint stays replay conflict, original command is not rekeyed',async()=>{
 const x=await setup(),p=await x.binding.bind(x.request),c=command(x);assert.equal((await p.host.execute(c,providers)).status,'committed');const before=structuredClone(x.f.writes);
 const conflict=await p.host.execute({...c,input_fingerprint:'sha256:'+'f'.repeat(64)},providers);assert.equal(conflict.status,'denied');assert.equal(conflict.code,'REPLAY_CONFLICT');assert.deepEqual(x.f.writes,before);
});
await check('uncertain COMMIT stays UNKNOWN without wrapper resend or replacement command',async()=>{
 const x=await setup(),p=await x.binding.bind(x.request),c=command(x),original=JSON.stringify(c),before=x.f.attempts;x.faultSql='commit';x.fault=Object.assign(Error('controlled lost ACK'),{code:'08006'});
 const r=await p.host.execute(c,providers);assert.equal(r.status,'unknown_commit');assert.equal(JSON.stringify(c),original);assert.equal(x.f.attempts,before+1);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Listing-command-R2',groups:n,proof:'ACTUAL_CORE_C01_C03_CONTROLLED_TRANSPORT',domain_provider:'TEST_ONLY_NOT_AIRPROP_PROVIDER',native:'NOT_RUN_NOT_PASS'}));
