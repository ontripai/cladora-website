import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { ROOTS, METADATA, collectGraph, materialize, validateCache, inspectMaterialized } from './docs-ce012-platform-v1/runtime-collector.mjs';
import { runtimeFiles, lockModules } from './docs-ce012-platform-v1/worker.mjs';
import { canonical,sha } from './docs-ce012-platform-v1/contract.mjs';
import { DOCKER } from './docs-ce012-platform-v1/custody.mjs';
const cache=process.env.CLADORA_DOCS_PINS_TEST_CACHE;
assert.ok(cache,'explicit existing parser cache required; no install fallback');
validateCache(cache);
const ts=createRequire(path.join(cache,'package.json'))('typescript');
assert.equal(ts.version,'5.9.3');
function fresh(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ce012-pins-'));
  const source=path.join(dir,'cache');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'package.json'),'{}\n');fs.writeFileSync(path.join(source,'package-lock.json'),'{}\n');
  const lock={packages:{}};
  for(const name of [...METADATA,'fixture-a','fixture-b','fixture-extra']){
    const rel='node_modules/'+name,p=path.join(source,rel);fs.mkdirSync(p,{recursive:true});
    fs.writeFileSync(path.join(p,'package.json'),JSON.stringify({name,version:'1.0.0',main:'index.js'}));
    fs.writeFileSync(path.join(p,'index.js'),name==='fixture-a'?"module.exports=require('fixture-b')+1;\n":'module.exports=16;\n');
    lock.packages[rel]={version:'1.0.0'};
  }
  return {dir,source,lock,clean(){fs.rmSync(dir,{recursive:true,force:true});}};
}
function graph(f,options={}){return collectGraph(f.source,ts,f.lock,{roots:['fixture-a'],...options});}
function copyFixture(f,g){
  const root=path.join(f.dir,'materialized');fs.mkdirSync(root);
  fs.writeFileSync(path.join(root,'package.json'),'{}');
  for(const p of g.files){const target=path.join(root,p.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(path.join(f.source,p.path)),{mode:0o400});}
  return root;
}
function candidate(g){return {format:'docs-ce012-runtime-pins.v1',consumer_source:'c0caf3e70d97c3d09b16cbff91188367804cba6b',
 tools:{node_sha256:sha(fs.readFileSync(process.execPath)),docker_sha256:sha(fs.readFileSync(DOCKER))},
 files:g.files,graph:g.graph,graph_sha256:g.graph_sha256};}

test('fixed roots include actual Documents extra imports and five metadata identities',()=>{
  assert.deepEqual(ROOTS,['pg','typescript','zod','next/headers.js','@supabase/ssr','node:crypto']);
  assert.equal(METADATA.length,5);
});
test('real parser collects transitive literal dependency with deterministic bytes/hash/edge identities',()=>{
  const f=fresh();try{const g=graph(f),second=graph(f);
    assert.equal(g.graph_sha256,second.graph_sha256);
    assert.ok(g.files.some(p=>p.path==='node_modules/fixture-b/index.js'));
    assert.ok(g.graph.edges.some(e=>e.parent==='node_modules/fixture-a/index.js'&&e.specifier==='fixture-b'));
    assert.equal(g.graph.blocked.length,0);assert.equal(g.packages.length,2);
    for(const pin of g.files)assert.equal(sha(fs.readFileSync(path.join(f.source,pin.path))),pin.sha256);
  }finally{f.clean();}
});
test('unresolved dynamic, native and data paths retained as BLOCKED without executing modules',()=>{
  const f=fresh();try{
    fs.writeFileSync(path.join(f.source,'node_modules/fixture-a/index.js'),"const fs=require('node:fs'); function x(name){return require(name)}; import('./later.mjs'); fs.readFileSync('/not-read'); require('./addon.node');\n");
    fs.writeFileSync(path.join(f.source,'node_modules/fixture-a/addon.node'),'DO_NOT_LOAD');
    const g=graph(f),codes=new Set(g.graph.blocked.map(x=>x.code));
    for(const code of ['BLOCKED_DYNAMIC_REQUIRE','BLOCKED_DYNAMIC_IMPORT','BLOCKED_DYNAMIC_DATA_ACCESS','BLOCKED_NATIVE_OR_WASM'])assert.ok(codes.has(code));
    assert.ok(!g.files.some(p=>p.path.endsWith('.node')));
  }finally{f.clean();}
});
test('package/lock provenance mismatch rejects before collector imports installed modules',()=>{
  const f=fresh();try{assert.throws(()=>validateCache(f.source),{code:'PRODUCER_PACKAGE_LOCK_MISMATCH'});}finally{f.clean();}
});
test('transitive installed version differing from lock is rejected',()=>{
  const f=fresh();try{f.lock.packages['node_modules/fixture-b'].version='2.0.0';assert.throws(()=>graph(f),{code:'TRANSITIVE_VERSION_LOCK_MISMATCH'});}finally{f.clean();}
});
test('source symlink rejected rather than flattened; no alias resolution is silently lost',()=>{
  const f=fresh();try{
    fs.unlinkSync(path.join(f.source,'node_modules/fixture-b/index.js'));
    fs.symlinkSync(path.join(f.source,'node_modules/fixture-extra/index.js'),path.join(f.source,'node_modules/fixture-b/index.js'));
    assert.throws(()=>graph(f),{code:'SYMLINK_INPUT_FORBIDDEN'});
  }finally{f.clean();}
});
test('capacity/edge limits reject without silent truncation',()=>{
  const f=fresh();try{assert.throws(()=>graph(f,{limits:{files:1,total_bytes:1024,file_bytes:1024,edges:100}}),{code:'CLOSURE_CAPACITY'});
    assert.throws(()=>graph(f,{limits:{files:100,total_bytes:1024*1024,file_bytes:1024,edges:0}}),{code:'EDGE_CAPACITY'});
  }finally{f.clean();}
});
test('materializer refuses fresh-output collisions and source drift; safeRead sees byte-identical regular copies',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ce012-real-copy-'));
  try{
    const f=fresh();try{const g=graph(f),target=path.join(root,'new');
      assert.throws(()=>materialize(f.source,target,g),{code:'CACHE_SOURCE_DRIFT'});
      const existing=path.join(root,'existing');fs.mkdirSync(existing);assert.throws(()=>materialize(f.source,existing,g),{code:'FRESH_OUTPUT_REQUIRED'});
    }finally{f.clean();}
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('actual loader accepts reviewed transitive graph and rejects pinned-but-unreviewed edge',()=>{
  const f=fresh();try{const g=graph(f),root=copyFixture(f,g);
    const extra='node_modules/fixture-extra/index.js',b=fs.readFileSync(path.join(f.source,extra));
    fs.mkdirSync(path.dirname(path.join(root,extra)),{recursive:true});fs.writeFileSync(path.join(root,extra),b);
    fs.copyFileSync(path.join(f.source,'node_modules/fixture-extra/package.json'),path.join(root,'node_modules/fixture-extra/package.json'));
    g.files.push({path:extra,bytes:b.length,sha256:sha(b)});
    const pins=runtimeFiles(root,{runtime:candidate(g),artifacts:[]}),restore=lockModules(root,pins);
    try{const require=createRequire(path.join(root,'package.json'));assert.equal(require('fixture-a'),17);
      assert.throws(()=>require('fixture-extra'),{code:'BLOCKED_UNREVIEWED_RUNTIME_EDGE'});
    }finally{restore();}
  }finally{f.clean();}
});
test('runtime graph/file/tool tampering and native pin fail closed',()=>{
  const f=fresh();try{const g=graph(f),root=copyFixture(f,g),runtime=candidate(g);
    assert.throws(()=>runtimeFiles(root,{runtime:{...runtime,graph_sha256:'0'.repeat(64)}}),{code:'RUNTIME_GRAPH_SEAL'});
    assert.throws(()=>runtimeFiles(root,{runtime:{...runtime,tools:{...runtime.tools,node_sha256:'0'.repeat(64)}}}),{code:'RUNTIME_EXECUTABLE_DRIFT'});
    assert.throws(()=>runtimeFiles(root,{runtime:{...runtime,files:[{path:'node_modules/fixture-a/addon.node',bytes:0,sha256:sha(Buffer.alloc(0))}]}}),{code:'BLOCKED_NATIVE_RUNTIME_FILE'});
    fs.chmodSync(path.join(root,g.files[0].path),0o600);fs.writeFileSync(path.join(root,g.files[0].path),'changed');assert.throws(()=>runtimeFiles(root,{runtime}),{code:'PIN_MISMATCH'});
  }finally{f.clean();}
});
test('ESM dynamic path blocked even when a file exists; native loading never reaches dlopen',async()=>{
  const f=fresh();try{
    fs.writeFileSync(path.join(f.source,'node_modules/fixture-a/index.js'),"module.exports=()=>import('./dynamic.mjs');");
    const g=graph(f),root=copyFixture(f,g),p=path.join(root,'node_modules/fixture-a/dynamic.mjs');
    fs.writeFileSync(p,'export default 1;');
    const runtime=candidate(g),pins=runtimeFiles(root,{runtime}),restore=lockModules(root,pins);
    try{const require=createRequire(path.join(root,'package.json'));await assert.rejects(require('fixture-a')(),{code:'BLOCKED_UNREVIEWED_RUNTIME_EDGE'});
      assert.throws(()=>process.dlopen({},'/not-loaded.node'),{code:'BLOCKED_NATIVE_ADDON'});
    }finally{restore();}
  }finally{f.clean();}
});
test('smoke CLI refuses writable/unrestricted process and has no consumer --run path',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ce012-permission-'));
  const metadata=path.join(temp,'pins.json');fs.writeFileSync(metadata,'{}');
  const child=spawnSync(process.execPath,['scripts/docs-ce012-platform-v1/runtime-smoke.mjs','--root',temp,'--pins',metadata],{encoding:'utf8'});
  fs.rmSync(temp,{recursive:true});assert.equal(child.status,2);assert.match(child.stdout,/READ_ONLY_SMOKE_PERMISSION_REQUIRED/);
  const bad=spawnSync(process.execPath,['scripts/docs-ce012-platform-v1/runtime-collector.mjs','--exec','ignored'],{encoding:'utf8'});
  assert.equal(bad.status,2);assert.match(bad.stdout,/CLOSED_COLLECTOR_CLI/);
});

test('absolute module selectors and relative host fallback are BLOCKED without reading external bytes',()=>{
  const f=fresh();try{
    fs.writeFileSync(path.join(f.dir,'outside.js'),'module.exports=123;');
    fs.writeFileSync(path.join(f.source,'node_modules/fixture-a/index.js'),"require('../../../outside.js');require('/not-read-anywhere.js');");
    const g=graph(f),codes=new Set(g.graph.blocked.map(x=>x.code));
    assert.ok(codes.has('BLOCKED_HOST_FALLBACK'));assert.ok(codes.has('BLOCKED_ABSOLUTE_MODULE_SELECTOR'));
    assert.ok(!g.files.some(f=>f.path.includes('outside.js')));
  }finally{f.clean();}
});
test('collector keeps binding/registry inactive and retains unresolved routes in materialized metadata',()=>{
  const binding=JSON.parse(fs.readFileSync('supabase/local-profiles/docs-ce012-pgauth-binding-v1.json'));
  const registry=JSON.parse(fs.readFileSync('supabase/local-profiles/docs-ce012-pgauth-reviews-v1.json'));
  assert.equal(binding.accepted.head,'c0caf3e70d97c3d09b16cbff91188367804cba6b');
  assert.equal(binding.accepted.runtime,null);assert.deepEqual(registry.reviews,{});
  const f=fresh();try{
    fs.writeFileSync(path.join(f.source,'node_modules/fixture-a/index.js'),'module.exports=name=>require(name);');
    const g=graph(f);assert.ok(g.graph.blocked.length>0);
    const root=copyFixture(f,g);assert.equal(inspectMaterialized(root,{files:g.files}),true);
    const runtime=candidate(g);assert.equal(runtime.graph.blocked[0].status,'BLOCKED');
  }finally{f.clean();}
});
