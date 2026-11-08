/** Actual Core binder, official Auth SDK seam controlled; never native Auth/DB. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const BASE='365d47b59d0cd0b5f7bb13604f1497c2104ed6e7';
const predecessor=process.argv.includes('--predecessor'),coupling=process.argv.includes('--coupling');
const SERVICE=process.env.CORE_QFW_SERVICE_REF??'fdfe3c6eb5f5f7dd586d21b5d8a8855fa912cb83';
const runtimeRef=predecessor?BASE:process.env.CORE_QFW_SOURCE_REF??'HEAD';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(file,encoding)=>{
 const path=String(file),rel=path.startsWith(root+'/')?path.slice(root.length+1):path;
 if(coupling&&rel.startsWith('src/lib/customer/'))return execFileSync('git',['show',`${SERVICE}:${rel}`],{cwd:root,encoding:'utf8'});
 if(rel.startsWith('src/lib/core/')){
  const ref=rel==='src/lib/core/functional-command-runtime-v1.ts'?runtimeRef:BASE;
  if(ref!=='WORKTREE')return execFileSync('git',['show',`${ref}:${rel}`],{cwd:root,encoding:'utf8'});
 }
 return readFileSync(file,encoding);
};
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,env,target,id,auth,runtimeModule}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,env,target,id,auth,runtimeModule};')(assert,read,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const bindingModule=env.load('src/lib/core/service-quote-command-binding-v1.ts');
async function setup(){const x=await fixture();x.checkouts=0;const connect=x.f.pool.connect.bind(x.f.pool);x.f.pool.connect=async()=>{x.checkouts++;return connect();};x.request=new Request('http://localhost/quotes');x.binder=bindingModule.createCoreServiceQuoteCommandBindingV1({pool:x.f.pool,target});return x;}
if(predecessor){const x=await setup();auth.claims.aal='aal1';await assert.rejects(x.binder.bind(x.request),e=>e.name==='ZodError'&&e.code===undefined);assert.equal(x.checkouts,0);assert.equal(x.calls.length,0);console.log(JSON.stringify({case:'QFW-R2-03',source:BASE,result:'COUNTEREXAMPLE_REPRODUCED_RAW_ZODERROR',checkouts:0,dispatch:0,native:'NOT_RUN'}));}
else if(coupling){
 const {NextRequest}=createRequire(import.meta.url)('next/server');
 const service=env.load('src/lib/customer/service-quote-runtime-composition-v1.ts');
 const http=env.load('src/lib/customer/service-quote-http-v1.ts');
 const inactive=env.load('src/lib/customer/service-quote-runtime-binding-v1.ts');
 async function composed(){const x=await setup();x.sourceCalls=0;x.dispatch=0;
  // This is an absent source binding, never a positive S01/preparation producer.
  const source={contract_version:'service-quote-source-preparation.v1',async bind(){x.sourceCalls++;return null;}};
  const resolver=service.createServiceQuoteRuntimeResolverV1({pool:x.f.pool,target,source});
  x.request=new NextRequest(`http://localhost/quotes?context_id=${id(4)}&workspace_id=${id(3)}`);
  return Object.assign(x,{resolver,handler:http.createServiceQuoteHttpHandlersV1(resolver),source});
 }
 const a=await composed();auth.claims.aal='aal1';await assert.rejects(a.resolver(a.request),e=>e.code==='MFA_REQUIRED');assert.equal(a.checkouts,0);assert.equal(a.sourceCalls,0);assert.equal(a.calls.length,0);
 console.log('PASS actual Core binder -> actual SERVICE factory propagates MFA_REQUIRED before source.bind/checkout/dispatch');
 const b=await composed();auth.claims.sub=id(99);auth.claims.aal='aal1';const denied=await b.handler.GET(b.request);assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:{code:'UNAUTHORIZED'}});assert.equal(b.sourceCalls,0);assert.equal(b.checkouts,0);
 console.log('PASS actual SERVICE HTTP keeps actor mismatch as401, not MFA');
 const malformed=await composed();auth.claims.aal='aal1';delete auth.claims.session_id;const invalid=await malformed.handler.GET(malformed.request);assert.equal(invalid.status,401);assert.deepEqual(await invalid.json(),{error:{code:'UNAUTHORIZED'}});assert.equal(malformed.checkouts,0);assert.equal(malformed.sourceCalls,0);assert.equal(malformed.calls.length,0);
 console.log('PASS actual Core binder -> SERVICE HTTP malformed claims stay401 without source/pool/dispatch');
 const c=await composed();assert.equal(await c.resolver(c.request),null);assert.equal(c.sourceCalls,1);assert.equal(c.checkouts,0);assert.equal(await inactive.resolveServiceQuoteRuntimeBindingV1(c.request),null);
 console.log('PASS AAL2 reaches missing-source boundary only; public binding stays NULL');
 const d=await composed();auth.claims.aal='aal1';const response=await d.handler.GET(d.request),body=await response.json();assert.equal(d.checkouts,0);assert.equal(d.sourceCalls,0);assert.equal(d.calls.length,0);
 console.log(JSON.stringify({case:'QFW-R2-03/actual-SERVICE-HTTP',SERVICE,source:runtimeRef,expected:{status:403,body:{error:{code:'MFA_REQUIRED'}}},actual:{status:response.status,body},pool_checkout:d.checkouts,source_bind:d.sourceCalls,dispatch:0,native:'NOT_RUN_NOT_PASS'}));
 // Preserve this403 contract assertion. Pinning the old SERVICE31b400
 // reproduces its failure; never mark that old503 as an acceptable outcome.
 assert.equal(response.status,403,'SERVICE resolverFailure must map the stable Core MFA error');
 assert.deepEqual(body,{error:{code:'MFA_REQUIRED'}});
 console.log(JSON.stringify({finding:'QFW-R2-03',SERVICE,core_source:runtimeRef,coupled_groups:5,result:'PASS_CONTROLLED_REAL_BINDER_RESOLVER_HTTP',source_bind_on_denial:0,pool_checkout_on_denial:0,business_dispatch_on_denial:0,native:'NOT_RUN_NOT_PASS'}));
}
else{
 let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
 await check('verified matching AAL1 produces stable MFA_REQUIRED before any pool checkout/dispatch',async()=>{const x=await setup();auth.claims.aal='aal1';await assert.rejects(x.binder.bind(x.request),e=>e instanceof runtimeModule.CoreFunctionalRuntimeUnavailableV1&&e.code==='MFA_REQUIRED');assert.equal(x.checkouts,0);assert.equal(x.calls.length,0);});
 await check('valid AAL2 produces the same restricted binder; no checkout or command during bind',async()=>{const x=await setup(),port=await x.binder.bind(x.request);assert.equal(typeof port.resolveIdentity,'function');assert.equal(typeof port.host.execute,'function');assert.equal(x.checkouts,0);assert.equal(x.calls.length,0);});
 for(const [name,change,expected] of [
  ['malformed sub',a=>{a.claims.sub='invalid';},'AUTHENTICATION_REQUIRED'],
  ['missing session',a=>{delete a.claims.session_id;},'AUTHENTICATION_REQUIRED'],
  ['malformed expiry',a=>{a.claims.exp='later';},'AUTHENTICATION_REQUIRED'],
  ['unknown assurance',a=>{a.claims.aal='aal3';},'AUTHENTICATION_REQUIRED'],
  ['missing assurance',a=>{delete a.claims.aal;},'AUTHENTICATION_REQUIRED'],
  ['unverified SDK result',a=>{a.error={message:'synthetic verification failure'};},'AUTHENTICATION_REQUIRED'],
  ['missing verified user',a=>{a.user=null;},'AUTHENTICATION_REQUIRED'],
  ['invalid verified actor',a=>{a.user={id:'invalid'};},'AUTHENTICATION_REQUIRED'],
  ['actor mismatch precedes MFA',a=>{a.user={id:id(99)};},'ACTOR_BINDING_MISMATCH'],
 ])await check(name+' remains Auth failure, not MFA',async()=>{const x=await setup();auth.claims.aal='aal1';change(auth);await assert.rejects(x.binder.bind(x.request),e=>e.code===expected);assert.equal(x.checkouts,0);assert.equal(x.calls.length,0);});
 await check('AAL drop after bind is rejected before identity checkout or dispatch',async()=>{const x=await setup(),port=await x.binder.bind(x.request);auth.claims.aal='aal1';await assert.rejects(port.resolveIdentity({context_id:id(4),workspace_id:id(3)}),e=>e.code==='MFA_REQUIRED');assert.equal(x.checkouts,0);assert.equal(x.calls.length,0);});
 await check('wrong issuer target fails before SDK and cannot be reported as MFA',async()=>{const x=await setup();auth.claims.aal='aal1';auth.origin='http://127.0.0.1:1';await assert.rejects(x.binder.bind(x.request),e=>e.code==='AUTH_TARGET_MISMATCH');assert.equal(x.checkouts,0);assert.equal(auth.calls,0);});
 console.log(JSON.stringify({finding:'QFW-R2-03',source:runtimeRef,core_binder_groups:n,transport:'CONTROLLED_REAL_CORE_MODULES',native:'NOT_RUN_NOT_PASS'}));
}
