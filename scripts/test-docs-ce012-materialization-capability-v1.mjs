/** New08 checks only; private exact-source fixture, never a native consumer run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import Module from 'node:module';
import {ROOT,DIR,sha,canonical,verifyMaterials,Hold} from './docs-ce012-platform-v1/contract.mjs';
import {RuntimeRoutes,readPolicy} from './docs-ce012-platform-v1/runtime-routes.mjs';
import {materializeComplete,materialPlan,verifyComplete,exactRead} from './docs-ce012-platform-v1/runtime-materialization.mjs';
import {PinnedTypeScriptOperation} from './docs-ce012-platform-v1/typescript-operation.mjs';
const scope=process.env.DOCS_CAPABILITY_TEST_SCOPE;assert.ok(scope&&path.isAbsolute(scope),'explicit private complete source-only scope required');
const root=path.join(scope,'consumer-source'),runtimeBytes=fs.readFileSync(path.join(scope,'runtime-inputs.json')),runtime=JSON.parse(runtimeBytes),policy=readPolicy();
const guard=()=>new RuntimeRoutes(root,runtime),options={compilerOptions:{module:1,target:9}},source=policy.required_source_pins[0].path;
const code=(fn,name)=>assert.throws(fn,e=>e.code===name,name);
function disposable(t){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ce012-capability-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));return tmp;}
function copy(t){const r=path.join(disposable(t),'copy');fs.cpSync(root,r,{recursive:true});return r;}

test('complete601 pins include322 entries,5 ESM,3 metadata,271 runtime; original verifyMaterials passes',()=>{
  const plan=materialPlan(root,runtime),result=verifyComplete(root,root,runtime);assert.equal(result.count,601);assert.equal(plan.inventory.files.length,322);
  assert.equal(result.bytes,18407664);assert.equal(result.sha256,'d3fb7a9c98c05e8701ae934d9934fee8769cb29be617b277b673b17b43086d33');
  const material=verifyMaterials(root,{request:plan.binding.request,inventory:plan.binding.inventory,closure:plan.binding.closure},plan.binding);
  assert.equal(sha(material.request),'3ca7a18b4789d262565dc3289cf029d633b36a0fa155c5f3a575dfeedc619873');
  assert.equal(plan.inventory.files.filter(f=>f.path.endsWith('.sql')).length,300);
});
test('material data,producer ESM and runtime byte drift each reject; no source repair',t=>{
  for(const relative of [materialPlan(root,runtime).inventory.files.find(p=>p.path.endsWith('.sql')).path,DIR+'run.mjs','node_modules/pg/lib/index.js']){
    const r=copy(t),p=path.join(r,relative),bytes=fs.readFileSync(p);bytes[0]^=1;fs.chmodSync(p,0o600);fs.writeFileSync(p,bytes);
    code(()=>verifyComplete(r,root,runtime),'MATERIAL_BYTES_DRIFT');}
});
test('symlink/hardlink and root/path aliases fail before readback',t=>{
  const r=copy(t),p=materialPlan(root,runtime).inventory.files[0],full=path.join(r,p.path);fs.unlinkSync(full);fs.symlinkSync(path.join(root,p.path),full);
  code(()=>exactRead(r,p),'MATERIAL_SYMLINK');fs.unlinkSync(full);const local=path.join(r,'owned-hardlink-source');fs.copyFileSync(path.join(root,p.path),local);fs.linkSync(local,full);
  code(()=>exactRead(r,p),'MATERIAL_FILE_ALIAS_TYPE_SIZE');code(()=>exactRead(r+'/.',p),'MATERIAL_ROOT_ALIAS');
  code(()=>exactRead(r,{...p,path:'../outside'}),'MATERIAL_RELATIVE_PIN');
});
test('extra/missing files and graph drift cannot be complete',t=>{
  const r=copy(t);fs.writeFileSync(path.join(r,'extra.data'),'unapproved');code(()=>verifyComplete(r,root,runtime),'MATERIAL_EXTRA_OR_MISSING_FILE');
  const missing=copy(t);fs.unlinkSync(path.join(missing,materialPlan(root,runtime).inventory.files[0].path));code(()=>verifyComplete(missing,root,runtime),'ENOENT');
  const changed=structuredClone(runtime);changed.graph.edges.pop();code(()=>materialPlan(root,changed),'ORIGINAL_GRAPH_CHANGED');
});
test('invalid graph/old output/alias stops materialization before new allocation',t=>{
  const tmp=disposable(t),output=path.join(tmp,'fresh'),args={sourceRoots:[root],producerRoot:root,runtimeRoot:root,runtimeBytes,output};
  const bad=structuredClone(runtime);bad.graph.blocked=[];code(()=>materializeComplete({...args,runtimeBytes:Buffer.from(JSON.stringify(bad))}),'ORIGINAL_GRAPH_CHANGED');assert.ok(!fs.existsSync(output));
  fs.mkdirSync(output);code(()=>materializeComplete(args),'FRESH_MATERIAL_DIRECTORY_REQUIRED');assert.deepEqual(fs.readdirSync(output),[]);
});
test('Module._load fallback receives original receiver, guarded branch uses lexical owner',()=>{
  const g=guard(),original=Module._load,receiver={marker:'caller'},calls=[];
  Module._load=function(...args){calls.push({receiver:this,args});return 'sentinel';};const restore=g.install();
  try{assert.equal(Module._load.call(receiver,'unknown',{filename:'/outside-test-only.mjs'},false),'sentinel');assert.equal(calls[0].receiver,receiver);
    assert.equal(Module._load.call(receiver,'typescript',{filename:path.join(root,'package.json')},false).version,'5.9.3');assert.equal(calls.length,1);}
  finally{restore();Module._load=original;}
  const text=fs.readFileSync(path.join(ROOT,'scripts/docs-ce012-platform-v1/runtime-routes.mjs'),'utf8');assert.ok(!/const\s+\w+\s*=\s*this\s*;/.test(text));assert.ok(text.includes('original.call(this,name,parent,isMain)'));
});
test('options getters/toJSON/proxies/foreign prototypes do not run or enter the compiler realm',()=>{
  const g=guard(),ts=g.require('typescript'),input=g.readSource(source);let called=0;const effect=()=>{called++;throw Error('caller callback executed');};
  const a=Object.defineProperty({},'compilerOptions',{get:effect}),b={compilerOptions:Object.defineProperty({target:9},'module',{get:effect})};
  const c=new Proxy({}, {get:effect,getPrototypeOf:effect,ownKeys:effect,getOwnPropertyDescriptor:effect});const revoked=Proxy.revocable({},{});revoked.revoke();
  for(const bad of [a,b,c,revoked.proxy,{...options,toJSON:effect},{compilerOptions:{module:1,target:9,readFile:effect}},{compilerOptions:{module:1,target:9},transformers:{before:[effect]}},Object.create(options),vm.runInNewContext('({compilerOptions:{module:1,target:9}})'),{...options,[Symbol('x')]:effect}])code(()=>ts.transpileModule(input,bad),'FIXED_TRANSPILE_OPTIONS');
  assert.equal(called,0);assert.ok(ts.transpileModule(input,options).outputText.length>0);
});
test('input must be primitive exact source, without valueOf/toString coercion or evaluation',()=>{
  const g=guard(),ts=g.require('typescript'),input=g.readSource(source);let called=0;const boxed=Object(input);boxed[Symbol.toPrimitive]=()=>{called++;return input;};
  code(()=>ts.transpileModule(boxed,options),'FIXED_TRANSPILE_INPUT_BOUND');code(()=>ts.transpileModule('throw new Error("not executed")',options),'UNPINNED_TRANSPILE_SOURCE');assert.equal(called,0);
});
test('realm evidence and output boundary contain no VM callback/object/prototype channel',()=>{
  const g=guard(),input=g.readSource(source),result=g.require('typescript').transpileModule(input,options),proof=g.capabilityEvidence();
  for(const key of ['sys_absent','ambient_absent','exports_in_local_realm','literal_options_in_local_realm','code_generation_denied'])assert.equal(proof[key],true,key);
  assert.equal(proof.caller_callbacks,'NO_CHANNEL');assert.equal(proof.dynamic_import,'NO_IMPORT_CALLBACK');assert.equal(proof.source_execution,'NONE');
  assert.equal(Object.getPrototypeOf(result),null);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.diagnostics));assert.equal(Object.getPrototypeOf(result.diagnostics),Array.prototype);
  assert.deepEqual(Reflect.ownKeys(result).sort(),['diagnostics','outputText']);assert.equal(typeof result.outputText,'string');assert.ok(!('constructor'in result));
});
test('external capability APIs remain latched denials, not alternate compiler operations',()=>{
  for(const key of ['sys','createProgram','createCompilerHost','createLanguageService','createWatchProgram','resolveModuleName','require','readFile']){
    const g=guard(),ts=g.require('typescript');code(()=>ts[key],'DENIED_TYPESCRIPT_API');code(()=>g.readSource(source),'ROUTE_GUARD_QUARANTINED');}
});
test('fixed output/count bounds reject without returning arbitrary VM data',()=>{
  const raw=fs.readFileSync(path.join(root,'node_modules/typescript/lib/typescript.js')),input=guard().readSource(source),limits={...policy.limits,transpile_output_bytes:1};
  const op=new PinnedTypeScriptOperation(raw,policy.required_source_pins,limits,c=>{throw new Hold(c);});code(()=>op.transpile(input,options),'TRANSPILE_OUTPUT_BOUND');
  const bounded=new PinnedTypeScriptOperation(raw,policy.required_source_pins,{...policy.limits,total_compilations:1},c=>{throw new Hold(c);});bounded.transpile(input,options);code(()=>bounded.transpile(input,options),'TRANSPILE_COUNT');
});
test('bounded compiler timeout becomes owner UNKNOWN denial and quarantine, not a VM error channel',()=>{
  const g=guard(),raw=fs.readFileSync(path.join(root,'node_modules/typescript/lib/typescript.js')),input=g.readSource(source);
  const op=new PinnedTypeScriptOperation(raw,policy.required_source_pins,{...policy.limits,transpile_timeout_ms:1},c=>g.deny(c));
  code(()=>op.transpile(input,options),'TYPESCRIPT_OPERATION_UNKNOWN');
  assert.deepEqual(g.firstDenial,{code:'TYPESCRIPT_OPERATION_UNKNOWN',detail:null});code(()=>g.readSource(source),'ROUTE_GUARD_QUARANTINED');
});
test('35 callback effect denials retain all original graph records; native/live stays HOLD',()=>{
  assert.equal(runtime.graph.blocked.length,43);assert.equal(policy.occurrences.length,43);assert.equal(policy.occurrences.filter(r=>r.previous_status==='STILL_UNRESOLVED').length,35);
  for(const row of policy.occurrences.filter(r=>r.previous_status)){assert.equal(row.status,'DENIED_AT_RUNTIME');assert.equal(row.enforcement,'NO_EXTERNAL_CALLBACK_CAPABILITY_IN_FIXED_TRANSPILE_REALM');assert.equal(row.proof_contract,'documents-ce012-typescript-capability.v1');}
  assert.equal(sha(Buffer.from(canonical(runtime.graph))),policy.original_graph_sha256);const g=guard();assert.deepEqual(g.status,{required:0,denied:43,unresolved:0});g.requireResolved();code(()=>g.requireLiveCapability(),'NOT_READY_NATIVE_CONSUMER_CAPABILITY');
});
