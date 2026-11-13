/** Actual new producer + existing C01 runtime, controlled SDK/PG. No native proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url),old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,env,target,id,auth,SQL}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,env,target,id,auth,SQL};')(assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
const api=env.load('src/lib/core/service-offering-read-binding-v1.ts'),{NextRequest}=createRequire(import.meta.url)('next/server');
const RPC='select customer_api.list_service_definitions_v1($1::uuid,$2::uuid) as value';
async function setup(){const x=await fixture(),connect=x.f.pool.connect.bind(x.f.pool);x.definitionRows=[{definition_id:id(71),code:'synthetic_service',labels:{en:'Service',fa:'خدمت',ro:'Serviciu'}}];x.manage=[];
 x.f.pool.connect=async()=>{const c=await connect(),q=c.query.bind(c);c.query=async(text,values=[])=>{
  if(text===SQL.checkpoint)x.manage.push(values);
  if(text===RPC){x.calls.push(text);if(x.error)throw x.error;assert.deepEqual(values,[id(4),id(3)]);return{rowCount:1,rows:[{value:x.definitionRows}]};}
  return q(text,values);
 };return c;};
 x.request=new NextRequest('http://localhost/api/customer/v1/services/catalog/definitions');x.binding=api.createCoreServiceOfferingReadBindingV1({pool:x.f.pool,target});return x;}
const selection={context_id:id(4),workspace_id:id(3)};let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('exact independent SERVICE readDefinitions shape from real Core C01/rollback; no write methods',async()=>{const x=await setup(),ports=await x.binding.bind(x.request),before=structuredClone(x.f.writes);assert.deepEqual(Object.keys(ports),['readDefinitions']);const result=await ports.readDefinitions(selection);assert.deepEqual(result,x.definitionRows);assert.notEqual(result,x.definitionRows);assert.ok(x.manage.every(v=>v[2]==='services.catalog.manage'&&v[3]==='services_catalog'));assert.ok(x.calls.includes('rollback'));assert.equal(x.calls.includes('commit'),false);assert.deepEqual(x.f.writes,before);});
await check('empty source is valid empty array, absence/failure is not fabricated empty',async()=>{const x=await setup(),p=await x.binding.bind(x.request);x.definitionRows=[];assert.deepEqual(await p.readDefinitions(selection),[]);x.definitionRows=null;await assert.rejects(p.readDefinitions(selection));});
await check('AAL1 or revoked native session cannot use the definitions RPC',async()=>{const x=await setup();auth.claims.aal='aal1';await assert.rejects(x.binding.bind(x.request));assert.equal(x.calls.includes(RPC),false);const y=await setup(),p=await y.binding.bind(y.request);y.sessionDenied=true;await assert.rejects(p.readDefinitions(selection));assert.equal(y.calls.includes(RPC),false);});
await check('current authority denial after wait stops read; same40001 object remains intact',async()=>{for(const code of ['42501','40001']){const x=await setup(),p=await x.binding.bind(x.request),error=Object.assign(Error('synthetic canonical failure'),{code});x.checkpointFault=error;await assert.rejects(p.readDefinitions(selection),e=>e===error);assert.equal(x.calls.includes(RPC),false);}});
await check('missing RPC/privilege keeps actual failure, never falls back to public SDK',async()=>{for(const code of ['42883','42501']){const x=await setup(),p=await x.binding.bind(x.request);x.error=Object.assign(Error('synthetic dependency failure'),{code});await assert.rejects(p.readDefinitions(selection),e=>e===x.error);assert.equal(x.calls.filter(q=>q===RPC).length,1);}});
await check('foreign Workspace and client actor/tenant/unknown fields never relabel scope',async()=>{const x=await setup(),p=await x.binding.bind(x.request);await assert.rejects(p.readDefinitions({...selection,workspace_id:id(99)}),e=>e.code==='42501');for(const s of [{...selection,actor_id:id(99)},{...selection,tenant_id:id(99)}])await assert.rejects(p.readDefinitions(s));assert.equal(x.calls.includes(RPC),false);});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Offering-read-R2',groups:n,native:'NOT_RUN_NOT_PASS',mutating_methods:'NOT_PROVIDED',previous_Request_suites:'NOT_REPEATED'}));
