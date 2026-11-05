/** New pre-AAL2/service-boundary controls only. Real Core modules with controlled
 * SDK/pg dependencies; no real Auth, SQL, relay or prior successful suite run. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const original=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),raw=readFileSync(original,'utf8');
const prefix=raw.slice(raw.indexOf('const original='),raw.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',providedUrl)");
const {fixture,id,next,provider,SQL}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','providedUrl',prefix+'\nreturn{fixture,id,next,provider,SQL};')(assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,original.href);
let n=0;async function check(name,fn){await fn();console.log('PASS '+(++n)+' '+name);}
const selected={context_id:id(4),workspace_id:id(3)},selection={...selected,offering_id:id(70)};
async function call(x,kind){if(kind==='preflight')return x.runtime().withRequestScope(selection,()=>({unreachable:true}));if(kind==='command'){const c=next(x);return x.runtime().host.execute(c.cmd,provider(c.guide));}return x.runtime().readServiceApp(kind,kind==='selections'?undefined:selected);}
for(const kind of ['selections','catalog','requests','preflight','command'])for(const aal of ['aal1',undefined])await check(kind+' rejects '+String(aal)+' before checkout/effect despite user_metadata allow',async()=>{const x=await fixture(),auth=globalThis.__core15_test_auth_transport;auth.claims.aal=aal;auth.claims.user_metadata={allow:true,aal:'aal2',permission:'services.orders.request'};const before=structuredClone(x.f.writes);await assert.rejects(call(x,kind));assert.equal(x.calls.length,0);assert.deepEqual(x.f.writes,before);});
for(const kind of ['selections','catalog','requests','preflight','command'])await check(kind+' AAL2 still checks canonical session before data/effect',async()=>{const x=await fixture();x.sessionDenied=true;const before=structuredClone(x.f.writes);if(kind==='command'){const result=await call(x,kind);assert.equal(result.status,'denied');assert.equal(result.code,'TRANSACTION_FAILED');}else await assert.rejects(call(x,kind),e=>e.code==='42501');assert.ok(x.calls.includes(SQL.session));assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes(SQL.checkpoint),false);});
for(const kind of ['catalog','requests'])await check(kind+' AAL2 is insufficient when current authority denies',async()=>{const x=await fixture();x.checkpointFault=Object.assign(Error('controlled canonical denial'),{code:'42501'});const before=structuredClone(x.f.writes);await assert.rejects(call(x,kind),e=>e===x.checkpointFault);assert.ok(x.calls.includes(SQL.checkpoint));assert.deepEqual(x.f.writes,before);});
await check('AAL2 plus current canonical authority preserves existing command positive',async()=>{const x=await fixture(),c=next(x);const r=await x.runtime().host.execute(c.cmd,provider(c.guide));assert.equal(r.status,'committed');assert.ok(x.calls.includes(SQL.session));assert.ok(x.checkpoints>0);});
await check('AAL2 plus current authority preserves official SERVICE source-port preflight',async()=>{const x=await fixture();const r=await x.runtime().withRequestScope(selection,(_s,p)=>p.loadOffering({...selection,published_revision_id:id(71)}));assert.equal(r.value.offering_id,id(70));assert.equal(r.value.status,'published');});
console.log(JSON.stringify({checks:n,proof:'CONTROLLED_REAL_CORE_MODULES',native_Auth_SQL:'NOT_RUN_NOT_PASS',frontend_edited:false,ACL_changed:false}));
