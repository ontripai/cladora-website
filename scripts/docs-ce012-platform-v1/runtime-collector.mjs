/** Offline exact-source runtime collector/materializer. Never installs or invokes the consumer. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import { execFileSync as versionCommand, spawnSync as smokeSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, DIR, sha, canonical, need, Hold, sourceBinding, safeRead, seal } from './contract.mjs';
import { cleanEnvironment, DOCKER } from './custody.mjs';
import { fenceExternalNetwork } from './transport.mjs';
const execVersion=versionCommand,spawnSmoke=smokeSpawn;
export const SOURCE='c0caf3e70d97c3d09b16cbff91188367804cba6b';
export const ROOTS=Object.freeze(['pg','typescript','zod','next/headers.js','@supabase/ssr','node:crypto']);
export const METADATA=Object.freeze(['pg','typescript','zod','next','@supabase/ssr']);
export const SOURCE_PINS=Object.freeze({
  'package.json':{bytes:20058,sha256:'fd82e8763837cbf7af3a0b55dd3e17c9d51f916deab6f5551ecf1a74bce083ce'},
  'package-lock.json':{bytes:285183,sha256:'c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc'},
});
export const LIMITS=Object.freeze({files:10000,total_bytes:134217728,file_bytes:16777216,edges:50000});
const cleanName=p=>p.split(path.sep).join('/');
function regular(root,relative,maximum=LIMITS.file_bytes){return safeRead(root,relative,maximum);}
function freshPrivate(p){
  need(!fs.existsSync(p),'FRESH_OUTPUT_REQUIRED');
  const parent=path.dirname(path.resolve(p));need(fs.realpathSync(parent)===parent,'OUTPUT_PARENT_SYMLINK');
  fs.mkdirSync(p,{mode:0o700});
}
function writeNew(p,b){
  fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});const fd=fs.openSync(p,'wx',0o400);
  try{need(fs.writeSync(fd,b)===b.length,'MATERIALIZATION_SHORT_WRITE');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function tool(file,args){
  const actual=fs.realpathSync(file),b=fs.readFileSync(actual);
  const version=execVersion(actual,args,{env:cleanEnvironment(),timeout:10000,maxBuffer:8192,stdio:['ignore','pipe','pipe']}).toString().trim();
  need(version.length>0,'TOOL_VERSION_MISSING');return {bytes:b.length,sha256:sha(b),version};
}
export function tools(python){
  const node=tool(process.execPath,['--version']),py=tool(python,['--version']),docker=tool(DOCKER,['--version']);
  need(/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(node.version)&&/^Python [0-9]+\.[0-9]+\.[0-9]+$/.test(py.version)&&/^Docker version [0-9]+\./.test(docker.version),'TOOL_VERSION_IDENTITY');
  return {public:{node_sha256:node.sha256,python_sha256:py.sha256,docker_sha256:docker.sha256,node,python:py,docker,
      platform:process.platform,arch:process.arch,node_abi:process.versions.modules,versions:{...process.versions}},
    private:{node:fs.realpathSync(process.execPath),python:fs.realpathSync(python),docker:fs.realpathSync(DOCKER)}};
}
export function validateCache(cache){
  need(fs.realpathSync(cache)===path.resolve(cache),'CANONICAL_CACHE_REQUIRED');
  for(const [name,pin] of Object.entries(SOURCE_PINS)){
    const b=regular(cache,name);need(b.length===pin.bytes&&sha(b)===pin.sha256,'PRODUCER_PACKAGE_LOCK_MISMATCH');
  }
  const lock=JSON.parse(regular(cache,'package-lock.json'));
  for(const name of METADATA){
    const p=`node_modules/${name}/package.json`,value=JSON.parse(regular(cache,p));
    need(value.name===name&&value.version===lock.packages[p.slice(0,-13)]?.version,'INSTALLED_VERSION_LOCK_MISMATCH');
  }
  return lock;
}
/** Conservative literal CJS graph; unresolved dynamic/native routes are retained as BLOCKED.
 * Parser injection is an offline test seam only, never a CLI/request-selected module.
 */
export function collectGraph(cache,ts,lock,{roots=ROOTS,limits=LIMITS}={}){
  const requireRoot=createRequire(path.join(cache,'package.json'));
  const files=new Map(),queue=[],seen=new Set(),edges=[],blocked=[],packages=new Map();let total=0;const deadline=Date.now()+60000;
  const relative=absolute=>cleanName(path.relative(cache,absolute));
  function issue(code,parent,specifier,offset){blocked.push({status:'BLOCKED',code,parent,specifier:String(specifier).slice(0,200),offset:offset??null});}
  function include(rel){
    need(Date.now()<deadline,'COLLECTION_DEADLINE');
    need(rel.startsWith('node_modules/')&&!path.isAbsolute(rel)&&!rel.split('/').includes('..'),'CACHE_ONLY_RUNTIME_FILE');
    if(files.has(rel))return;
    const b=regular(cache,rel,limits.file_bytes);
    need(files.size<limits.files&&total+b.length<=limits.total_bytes,'CLOSURE_CAPACITY');
    files.set(rel,{path:rel,bytes:b.length,sha256:sha(b)});total+=b.length;
    if(/\.(?:cjs|mjs|js)$/.test(rel))queue.push(rel);
  }
  function packageNoLinks(directory){
    const pending=[directory];let count=0;
    while(pending.length){const current=pending.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      if(entry.name==='node_modules')continue;const name=path.join(current,entry.name);
      need(++count<=20000,'PACKAGE_METADATA_CAPACITY');need(!fs.lstatSync(name).isSymbolicLink(),'SYMLINK_INPUT_FORBIDDEN');
      if(entry.isDirectory())pending.push(name);
    }}
  }
  function metadata(rel){
    let dir=path.dirname(path.join(cache,rel));
    while(relative(dir).startsWith('node_modules/')){
      const p=path.join(dir,'package.json');
      if(fs.existsSync(p)){
        const r=relative(p);include(r);const value=JSON.parse(regular(cache,r));
        const packagePath=relative(dir),locked=lock.packages[packagePath];
        if(value.name&&value.version&&locked){
          need(locked.version===value.version,'TRANSITIVE_VERSION_LOCK_MISMATCH');
          if(!packages.has(packagePath))packageNoLinks(dir);
          packages.set(packagePath,{path:packagePath,name:value.name,version:value.version,
            package_json_sha256:files.get(r).sha256,lock_integrity:locked.integrity??null,
            optional_dependencies:value.optionalDependencies??{},peer_dependencies:value.peerDependencies??{}});
        }
      }
      dir=path.dirname(dir);
    }
  }
  function noLinks(logical){
    const rel=relative(logical);need(!rel.split('/').includes('..'),'CACHE_PATH_REQUIRED');
    let p=cache;for(const part of rel.split('/')){p=path.join(p,part);if(!fs.existsSync(p))break;need(!fs.lstatSync(p).isSymbolicLink(),'SYMLINK_INPUT_FORBIDDEN');}
  }
  function resolve(parent,specifier,kind='require',offset=null){
    need(edges.length<limits.edges,'EDGE_CAPACITY');
    if(isBuiltin(specifier)){edges.push({parent,specifier,target:specifier.startsWith('node:')?specifier:`node:${specifier}`,kind:'builtin'});return;}
    if(specifier.startsWith('node:')){issue('BLOCKED_UNKNOWN_BUILTIN',parent,specifier,offset);return;}
    if(path.isAbsolute(specifier)){issue('BLOCKED_ABSOLUTE_MODULE_SELECTOR',parent,specifier,offset);return;}
    if(specifier.startsWith('.')){
      const logical=path.resolve(path.dirname(path.join(cache,parent)),specifier);
      if(!logical.startsWith(cache+path.sep)){issue('BLOCKED_HOST_FALLBACK',parent,specifier,offset);return;}
      noLinks(logical);
    }
    else if(!path.isAbsolute(specifier)){
      const parts=specifier.split('/'),name=specifier.startsWith('@')?parts.slice(0,2).join('/'):parts[0];
      for(const lookup of createRequire(path.join(cache,parent)).resolve.paths(specifier)??[]){
        if(!lookup.startsWith(cache+'/'))continue;
        const pkg=path.join(lookup,name);if(fs.existsSync(pkg)){noLinks(pkg);if(fs.existsSync(path.join(pkg,'package.json')))metadata(relative(path.join(pkg,'package.json')));break;}
      }
    }
    let target;
    try{target=createRequire(path.join(cache,parent)).resolve(specifier);}catch(error){issue(specifier==='pg-native'?'BLOCKED_NATIVE_DEPENDENCY':'BLOCKED_UNRESOLVED_LITERAL',parent,specifier,offset);return;}
    noLinks(target);const rel=relative(target);
    if(!rel.startsWith('node_modules/')||rel.split('/').includes('..')){issue('BLOCKED_HOST_FALLBACK',parent,specifier,offset);return;}
    if(/\.(?:node|wasm)$/.test(rel)){issue('BLOCKED_NATIVE_OR_WASM',parent,rel,offset);return;}
    // safeRead also rejects symlinked path components; never flatten a physical layout.
    include(rel);metadata(rel);edges.push({parent,specifier,target:rel,kind});
  }
  for(const name of METADATA)include(`node_modules/${name}/package.json`);
  for(const name of roots)resolve('package.json',name,'root');
  while(queue.length){
    const name=queue.shift();if(seen.has(name))continue;seen.add(name);
    const raw=regular(cache,name),source=ts.createSourceFile(name,raw.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    if(source.parseDiagnostics.length)issue('BLOCKED_PARSER_DIAGNOSTIC',name,source.parseDiagnostics.map(d=>d.code).join(','));
    function walk(n){
      if(ts.isCallExpression(n)){
        const e=n.expression,identifier=ts.isIdentifier(e)?e.text:null;
        const property=ts.isPropertyAccessExpression(e)?e.name.text:null;
        const receiver=ts.isPropertyAccessExpression(e)?e.expression.getText(source):null;
        const isRequire=identifier==='require'||(property==='require'&&receiver==='module');
        const isResolve=property==='resolve'&&receiver==='require';
        const literal=n.arguments.length===1&&(ts.isStringLiteral(n.arguments[0])||ts.isNoSubstitutionTemplateLiteral(n.arguments[0]));
        if(isRequire||isResolve){if(literal)resolve(name,n.arguments[0].text,isResolve?'resolve':'require',n.pos);
          else issue('BLOCKED_DYNAMIC_REQUIRE',name,n.getText(source),n.pos);}
        if(e.kind===ts.SyntaxKind.ImportKeyword)issue('BLOCKED_DYNAMIC_IMPORT',name,n.getText(source),n.pos);
        if(identifier==='eval'||property==='dlopen'||identifier==='createRequire')issue('BLOCKED_DYNAMIC_LOADER',name,n.getText(source),n.pos);
        if(['readFile','readFileSync','readdir','readdirSync'].includes(property))issue('BLOCKED_DYNAMIC_DATA_ACCESS',name,n.getText(source),n.pos);
      }
      if(ts.isNewExpression(n)&&n.expression.getText(source)==='Function')issue('BLOCKED_DYNAMIC_CODE_GENERATION',name,n.getText(source),n.pos);
      if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)){
        resolve(name,n.moduleSpecifier.text,'esm-static',n.pos);
        // require.resolve conditions are not proof of ESM export resolution.
        issue('BLOCKED_ESM_CONDITION_REQUIRES_REVIEW',name,n.moduleSpecifier.text,n.pos);
      }
      ts.forEachChild(n,walk);
    }
    walk(source);
  }
  const stable=arr=>arr.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const graph={roots:[...roots],edges:stable(edges),blocked:stable(blocked)};
  return {files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),packages:stable([...packages.values()]),
    graph,graph_sha256:sha(Buffer.from(canonical(graph))),total_bytes:total};
}
export function materialize(cache,output,collected){
  freshPrivate(output);const root=path.join(output,'consumer-source');fs.mkdirSync(root,{mode:0o700});
  // Re-read and rehash before each copy. Only collected bytes, never symlinks/credentials.
  for(const [name,expected] of Object.entries(SOURCE_PINS)){const b=regular(cache,name);need(b.length===expected.bytes&&sha(b)===expected.sha256,'CACHE_SOURCE_DRIFT');writeNew(path.join(root,name),b);}
  for(const pin of collected.files){const b=regular(cache,pin.path);need(b.length===pin.bytes&&sha(b)===pin.sha256,'CACHE_DRIFT_BEFORE_COPY');writeNew(path.join(root,pin.path),b);}
  return root;
}
export function inspectMaterialized(root,runtime){
  for(const item of runtime.files){const b=regular(root,item.path);need(b.length===item.bytes&&sha(b)===item.sha256,'MATERIALIZED_READBACK_MISMATCH');}
  return true;
}
export function runCollection(cache,output,python,{withSmoke=false}={}){
  const binding=sourceBinding();need(binding.accepted?.head===SOURCE&&binding.accepted?.contract==='documents-ce012-live-connection-request.v2','EXACT_DOCS_V2_REQUIRED');
  const lock=validateCache(cache),toolPins=tools(python);
  // No install scripts or dependency bin scripts. Import parser only from this verified cache.
  // Fixed smoke subprocess is invoked through this retained operator primitive only.
  fenceExternalNetwork();
  const ts=createRequire(path.join(cache,'package.json'))('typescript');
  need(ts.version==='5.9.3','EXACT_TYPESCRIPT_REQUIRED');
  const collected=collectGraph(cache,ts,lock);
  const root=materialize(cache,output,collected);
  const source=seal();
  const runtime={collector_source_seal:source,format:'docs-ce012-runtime-pins.v1',consumer_source:SOURCE,tools:toolPins.public,
    files:collected.files,packages:collected.packages,graph:collected.graph,graph_sha256:collected.graph_sha256,
    total_bytes:collected.total_bytes,source_pins:SOURCE_PINS,limits:LIMITS,
    execution_admissible:collected.graph.blocked.length===0,execution_authorized:false,
    status:collected.graph.blocked.length?'BLOCKED_UNRESOLVED_ROUTES':'STATIC_CLOSURE_COMPLETE',smoke:null};
  let runtimePath=path.join(output,withSmoke?'runtime-inputs.pre-smoke.json':'runtime-inputs.json');
  writeNew(runtimePath,Buffer.from(JSON.stringify(runtime,null,2)+'\n'));
  writeNew(path.join(output,'provenance.private.json'),Buffer.from(JSON.stringify({cache_root:cache,output_root:output,
    tools:toolPins.private,source_only:true,dependency_installation:'NOT_RUN'},null,2)+'\n'));
  inspectMaterialized(root,runtime);
  if(withSmoke){
    const command=smokeCommand(root,runtimePath);
    const child=spawnSmoke(command[0],command.slice(1),{env:cleanEnvironment(),timeout:30000,maxBuffer:1048576,encoding:'utf8'});
    writeNew(path.join(output,'smoke.stdout.private.log'),Buffer.from(child.stdout??''));
    writeNew(path.join(output,'smoke.stderr.private.log'),Buffer.from(child.stderr??''));
    let observation;try{observation=JSON.parse(child.stdout);}catch{observation={result:'BLOCKED',code:child.error?.code??'UNKNOWN_SMOKE_RESULT'};}
    runtime.smoke={...observation,exit_code:child.status,inputs_sha256:sha(fs.readFileSync(runtimePath))};
    runtimePath=path.join(output,'runtime-inputs.json');writeNew(runtimePath,Buffer.from(JSON.stringify(runtime,null,2)+'\n'));
    inspectMaterialized(root,runtime);
  }
  return {runtimePath,root,runtime};
}
export function smokeCommand(root,runtimePath){
  const source=path.join(ROOT,'scripts/docs-ce012-platform-v1');
  return [process.execPath,'--permission','--no-addons','--allow-fs-read='+path.dirname(root),
    '--allow-fs-read='+source,'--allow-fs-read='+DOCKER,'--allow-fs-read='+fs.realpathSync(process.execPath),
    path.join(source,'runtime-smoke.mjs'),'--root',root,'--pins',runtimePath];
}
export function main(args=process.argv.slice(2)){
  need((args.length===6||args.length===7&&args[6]==='--smoke')&&args[0]==='--cache-root'&&args[2]==='--output'&&args[4]==='--python','CLOSED_COLLECTOR_CLI');
  const cache=path.resolve(args[1]),output=path.resolve(args[3]),python=path.resolve(args[5]);
  const result=runCollection(cache,output,python,{withSmoke:args.length===7});
  console.log(JSON.stringify({status:result.runtime.status,files:result.runtime.files.length,bytes:result.runtime.total_bytes,
    packages:result.runtime.packages.length,edges:result.runtime.graph.edges.length,blocked_routes:result.runtime.graph.blocked.length,
    graph_sha256:result.runtime.graph_sha256,smoke:result.runtime.smoke?.result??'NOT_RUN',execution_authorized:false}));
  return 0; // collection success is NOT execution readiness
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=main();}catch(e){console.log(JSON.stringify({status:'BLOCKED',reason:e instanceof Hold?e.code:'COLLECTION_FAILED',execution_authorized:false}));process.exitCode=2;}
}
