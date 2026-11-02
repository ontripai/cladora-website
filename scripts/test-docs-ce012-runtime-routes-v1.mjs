/** Task07 delta only. Requires a private clone of the accepted Task06 materialization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {RuntimeRoutes,readPolicy,validatePolicy,POLICY_SHA256} from './docs-ce012-platform-v1/runtime-routes.mjs';
import {runtimeFiles,lockModules} from './docs-ce012-platform-v1/worker.mjs';
import {ROOT,sha,canonical} from './docs-ce012-platform-v1/contract.mjs';
import {SOURCES} from './docs-ce012-platform-v1/runtime-routes-smoke.mjs';
const scope=process.env.DOCS_ROUTES_TEST_SCOPE;
assert.ok(scope&&path.isAbsolute(scope),'explicit private, materialized source-only test scope required');
const root=path.join(scope,'consumer-source'),runtime=JSON.parse(fs.readFileSync(path.join(scope,'runtime-inputs.json')));
const policy=readPolicy(),parent=p=>path.join(root,p),options={compilerOptions:{module:1,target:9}};
const guard=()=>new RuntimeRoutes(root,runtime);
function code(fn,expected){assert.throws(fn,e=>e.code===expected,expected);}
function copy(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ce012-routes-'));fs.cpSync(root,path.join(dir,'root'),{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'root');}
function parser(g){return g.require('pg-connection-string',parent('node_modules/pg/lib/connection-parameters.js'));}
const uri='postgresql://cladora_ce_guide_runtime@127.0.0.1:5432/docs_ce012_0000000000000000';

test('43 occurrence bijection, exact source bytes and AST offsets (including trivia)',()=>{
  assert.deepEqual(validatePolicy(policy,runtime),{required:0,denied:8,unresolved:35});
  assert.equal(sha(fs.readFileSync(path.join(ROOT,'scripts/docs-ce012-platform-v1/runtime-route-policy.v1.json'))),POLICY_SHA256);
  const ts=createRequire(path.join(root,'package.json'))('typescript');const nodes=new Map();
  for(const file of new Set(policy.occurrences.map(r=>r.parent))){const b=fs.readFileSync(parent(file));
    assert.equal(sha(b),policy.occurrences.find(r=>r.parent===file).source_sha256);
    const source=ts.createSourceFile(file,b.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const calls=[];
    const walk=n=>{if(ts.isCallExpression(n))calls.push(n);ts.forEachChild(n,walk);};walk(source);nodes.set(file,{source,calls});}
  for(const row of policy.occurrences){const {source,calls}=nodes.get(row.parent);const found=calls.some(n=>n.pos===row.offset_utf16&&
    (n.getText(source)===row.specifier||n.expression.getText(source)==='require'&&n.arguments[0]?.text===row.specifier));
    assert.ok(found,`occurrence ${row.ordinal} source/AST identity`);}
});
test('missing/extra/duplicate/reordered rows cannot close the original graph',()=>{
  for(const change of [p=>p.occurrences.pop(),p=>p.occurrences.push(p.occurrences[0]),p=>p.occurrences[1]=p.occurrences[0],p=>p.occurrences.reverse()]){
    const p=structuredClone(policy);change(p);assert.throws(()=>validatePolicy(p,runtime));}
});
test('source/hash/offset/specifier mismatch and new graph edge rejected',()=>{
  for(const key of ['source_sha256','parent','specifier','offset_utf16']){const p=structuredClone(policy);p.occurrences[0][key]=key==='offset_utf16'?1:'changed';assert.throws(()=>validatePolicy(p,runtime));}
  const r=structuredClone(runtime);r.graph.edges.push({parent:'package.json',specifier:'unexpected',target:'node:fs'});r.graph_sha256=sha(Buffer.from(canonical(r.graph)));
  code(()=>new RuntimeRoutes(root,r),'ORIGINAL_GRAPH_CHANGED');
});
test('35 unresolved callbacks remain HOLD, immutable and independent of a trace',()=>{
  const g=guard();code(()=>g.requireResolved(),'STILL_UNRESOLVED_RUNTIME_OCCURRENCES');
  assert.throws(()=>{g.status.unresolved=0;},TypeError);assert.throws(()=>{g.status={unresolved:0};},TypeError);
  const r=structuredClone(runtime),other=new RuntimeRoutes(root,r);r.graph.blocked=[];r.files[0].sha256='0'.repeat(64);
  code(()=>other.requireResolved(),'STILL_UNRESOLVED_RUNTIME_OCCURRENCES');
  assert.equal(other.policy.occurrences.filter(v=>v.status==='STILL_UNRESOLVED').length,35);
});
test('real TypeScript accepts only pinned source + fixed in-memory options',()=>{
  const g=guard(),ts=g.require('typescript'),input=g.readSource(SOURCES[0]);
  assert.equal(ts.version,'5.9.3');assert.equal(ts.ModuleKind.CommonJS,1);
  assert.ok(ts.transpileModule(input,options).outputText.includes('exports.'));
  code(()=>ts.transpileModule('const arbitrary: number = 1;',options),'UNPINNED_TRANSPILE_SOURCE');
  for(const bad of [{},{compilerOptions:{module:1,target:9},fileName:'outside.ts'},{compilerOptions:{module:1,target:9,sourceMap:true}}])code(()=>ts.transpileModule(input,bad),'FIXED_TRANSPILE_OPTIONS');
});
test('TypeScript effect/plugin/dynamic APIs denied; swallowed denial quarantines',()=>{
  for(const api of ['sys','createProgram','createCompilerHost','createLanguageService','executeCommandLine','resolveModuleName','enableSourceMaps']){
    const g=guard(),ts=g.require('typescript');code(()=>ts[api],'DENIED_TYPESCRIPT_API');code(()=>ts.transpileModule(g.readSource(SOURCES[0]),options),'ROUTE_GUARD_QUARANTINED');}
});
test('arbitrary source was allowed by raw library; membrane rejects it',()=>{
  const ts=createRequire(path.join(root,'package.json'))('typescript');assert.ok(ts.transpileModule('const notPinned: number=1;',options).outputText.includes('notPinned'));
  code(()=>guard().require('typescript').transpileModule('const notPinned: number=1;',options),'UNPINNED_TRANSPILE_SOURCE');
});
test('pinned source hash changed, source symlink, undeclared data and external path rejected',t=>{
  const r=copy(t),file=path.join(r,SOURCES[0]),b=fs.readFileSync(file);fs.chmodSync(file,0o600);fs.writeFileSync(file,Buffer.from(b.toString().replace('import','Import')));
  code(()=>new RuntimeRoutes(r,runtime).readSource(SOURCES[0]),'ROUTE_FILE_HASH_CHANGED');
  fs.unlinkSync(file);fs.symlinkSync(path.join(root,SOURCES[0]),file);code(()=>new RuntimeRoutes(r,runtime).readSource(SOURCES[0]),'ROUTE_SYMLINK_DENIED');
  for(const p of ['../../outside','/etc/passwd','src/test-inputs.json'])code(()=>guard().readSource(p),'UNDECLARED_SOURCE_DATA');
});
test('pinned dependency source tamper and symlink rejected before load',t=>{
  const r=copy(t),file=path.join(r,'node_modules/pg-connection-string/index.js');const b=fs.readFileSync(file);fs.chmodSync(file,0o600);b[0]^=1;fs.writeFileSync(file,b);
  code(()=>new RuntimeRoutes(r,runtime),'ROUTE_FILE_HASH_CHANGED');fs.unlinkSync(file);fs.symlinkSync(path.join(root,'node_modules/pg-connection-string/index.js'),file);
  code(()=>new RuntimeRoutes(r,runtime),'ROUTE_SYMLINK_DENIED');
});
test('current file pin rechecked after guard construction, including cached modules',t=>{
  const r=copy(t),g=new RuntimeRoutes(r,runtime);g.require('zod');const p=runtime.graph.edges.find(e=>e.parent==='package.json'&&e.specifier==='zod').target;
  const file=path.join(r,p),b=fs.readFileSync(file);fs.chmodSync(file,0o600);b[0]^=1;fs.writeFileSync(file,b);code(()=>g.require('zod'),'ROUTE_FILE_HASH_CHANGED');
});
test('each SSL selector and encoded selector rejected before the actual parser reads',()=>{
  for(const field of ['sslcert','sslkey','sslrootcert']){const g=guard(),p=parser(g);code(()=>p.parse(uri+'?'+field+'=%2Fnonexistent'),'DENIED_SSL_OR_CONNECTION_SELECTOR');assert.equal(g.firstDenial.code,'DENIED_SSL_OR_CONNECTION_SELECTOR');}
});
test('only fixed loopback parser shape accepted, no connection',()=>{
  const g=guard(),p=parser(g);const result=p.parse(uri);assert.equal(result.host,'127.0.0.1');assert.equal(result.port,'5432');assert.ok(!result.ssl);g.healthy();
  for(const bad of [uri.replace('127.0.0.1','example.com'),uri.replace('5432','5433'),uri.replace('cladora_ce_guide_runtime','service_role'),uri.replace('@',':password@'),uri+'?sslmode=disable',uri+'#x',uri.replace('postgresql:','postgres:')])code(()=>parser(guard()).parse(bad),'DENIED_SSL_OR_CONNECTION_SELECTOR');
});
test('consumer parser is bound to the exact descriptor database and roles',()=>{
  const d={database:'docs_ce012_1111111111111111',observer_role:'obs_role',conflict_role:'conflict_role'};
  const g=new RuntimeRoutes(root,runtime,{mode:'consumer-candidate',descriptor:d});d.database='docs_ce012_0000000000000000';
  code(()=>parser(g).parse(uri),'DENIED_SSL_OR_CONNECTION_SELECTOR');
  const other=new RuntimeRoutes(root,runtime,{mode:'consumer-candidate',descriptor:{database:'docs_ce012_1111111111111111',observer_role:'obs_role',conflict_role:'conflict_role'}});
  assert.equal(parser(other).parse(uri.replace('cladora_ce_guide_runtime','obs_role').replaceAll('0000000000000000','1111111111111111')).user,'obs_role');
});
test('pg-native/libpq, source-map-support, absolute/dynamic selectors and new edges denied',()=>{
  for(const name of ['pg-native','source-map-support','/etc/passwd','file:///etc/passwd','..\\outside','libpq','not-reviewed']){
    const g=guard();assert.throws(()=>g.require(name));assert.ok(g.firstDenial);code(()=>g.require('pg'),'ROUTE_GUARD_QUARANTINED');}
  code(()=>guard().require('./native',parent('node_modules/pg/lib/index.js')),'DENIED_NATIVE_MODULE_PATH');
});
test('runtime fs promises/read/readdir/data writes denied, never forwarded',()=>{
  for(const call of [fs=>fs.readFileSync('/etc/passwd'),fs=>fs.readdirSync('/'),fs=>fs.promises.readFile('/etc/passwd'),fs=>fs.writeFileSync('/tmp/not-created','x')]){
    const g=guard(),facade=g.require('fs',parent('node_modules/pg-connection-string/index.js'));code(()=>call(facade),'DENIED_RUNTIME_DATA_ACCESS');code(()=>g.healthy(),'ROUTE_GUARD_QUARANTINED');}
});
test('source smoke denies Client/Pool construction and lazy native getter',()=>{
  for(const operation of [pg=>new pg.Client(),pg=>new pg.Pool(),pg=>pg.native]){const g=guard(),pg=g.require('pg');assert.throws(()=>operation(pg));assert.ok(g.firstDenial);}
});
test('installed guards deny builtin fs and dynamic import then restore correctly',async()=>{
  const g=guard(),pins=runtimeFiles(root,{runtime,artifacts:[]});const original=Module._load,restore=g.install(),restoreLoader=lockModules(root,pins,{routes:g});
  try{const own=createRequire(parent('node_modules/pg-connection-string/index.js'));const facade=own('fs');code(()=>facade.readFileSync('/etc/passwd'),'DENIED_RUNTIME_DATA_ACCESS');}
  finally{restoreLoader();restore();}assert.equal(Module._load,original);
  const next=guard(),r1=next.install(),r2=lockModules(root,pins,{routes:next});
  try{
    // Test-only synthetic callsite, never substituted for pinned library bytes.
    const filename=parent('node_modules/pg/lib/index.js'),m=new Module(filename);m.filename=filename;
    m._compile("module.exports=()=>import('node:fs');",filename);
    await assert.rejects(()=>m.exports(),e=>e.code==='DENIED_RUNTIME_DYNAMIC_IMPORT');
  }
  finally{r2();r1();}
});
test('expanded read-only fixed-source/library smoke: real effects fenced, no consumer run',()=>{
  const dir=path.join(ROOT,'scripts/docs-ce012-platform-v1'),cmd=['--permission','--no-addons','--allow-fs-read='+scope,'--allow-fs-read='+dir,'--allow-fs-read=/usr/local/bin/docker','--allow-fs-read='+process.execPath,path.join(dir,'runtime-routes-smoke.mjs'),'--root',root,'--pins',path.join(scope,'runtime-inputs.json')];
  const result=spawnSync(process.execPath,cmd,{env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',NODE_ENV:'production',NO_COLOR:'1'},encoding:'utf8',timeout:30000,maxBuffer:128*1024});
  assert.equal(result.status,0,result.stdout+result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.result,'PASS_EXPANDED_SOURCE_SMOKE');assert.equal(output.operations.length,8);assert.equal(output.policy_sha256,POLICY_SHA256);assert.equal(output.policy_status.unresolved,35);
  for(const key of ['consumer_run','connection','auth'])assert.equal(output[key],'NOT_RUN');assert.equal(output.runtime_ready,false);
});
test('registry remains empty, accepted runtime NULL, c0 harness exact and no test-input fixture',()=>{
  const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'supabase/local-profiles/docs-ce012-pgauth-reviews-v1.json'))),binding=JSON.parse(fs.readFileSync(path.join(ROOT,'supabase/local-profiles/docs-ce012-pgauth-binding-v1.json')));
  assert.deepEqual(registry.reviews,{});assert.equal(binding.accepted.runtime,null);assert.equal(binding.accepted.head,'c0caf3e70d97c3d09b16cbff91188367804cba6b');
  assert.ok(policy.required_source_pins.every(v=>v.path.startsWith('src/')&&!v.path.includes('test-inputs')));
});
