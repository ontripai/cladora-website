/** Exact occurrence policy + closed library capabilities. Not an execution grant. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import Module, {isBuiltin} from 'node:module';
import {fileURLToPath} from 'node:url';
import {ROOT,canonical,sha,need,Hold} from './contract.mjs';
const POLICY='scripts/docs-ce012-platform-v1/runtime-route-policy.v1.json';
export const POLICY_SHA256='fd0ef9f882452887a6abedd7ba75acf3cbdd021efb11813ec0409a6d0ae77400';
const read=fs.readFileSync,open=fs.openSync,close=fs.closeSync,lstat=fs.lstatSync,fstat=fs.fstatSync,realpath=fs.realpathSync;
const ACTIVE=Symbol.for('cladora.docs-ce012.route-guard');
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export function readPolicy(){const raw=read(path.join(ROOT,POLICY));need(sha(raw)===POLICY_SHA256,'ROUTE_POLICY_BYTES_CHANGED');return freeze(JSON.parse(raw));}
export function validatePolicy(policy,runtime){
  need(policy.format==='documents-ce012-runtime-route-policy.v1'&&runtime.consumer_source===policy.consumer_source,'ROUTE_POLICY_VERSION');
  need(runtime.graph_sha256===policy.original_graph_sha256&&sha(Buffer.from(canonical(runtime.graph)))===runtime.graph_sha256,'ORIGINAL_GRAPH_CHANGED');
  need(sha(Buffer.from(canonical(runtime.files)))===policy.original_file_pins_sha256,'ORIGINAL_FILE_PINS_CHANGED');
  need(runtime.graph.blocked.length===43&&policy.occurrence_count===43&&policy.occurrences.length===43,'OCCURRENCE_COMPLETENESS');
  const ids=new Set();const files=new Map(runtime.files.map(f=>[f.path,f]));
  for(let i=0;i<43;i++){
    const row=policy.occurrences[i],original=runtime.graph.blocked[i];
    need(row.ordinal===i+1&&!ids.has(row.id)&&row.original_entry_sha256===sha(Buffer.from(canonical(original))),'OCCURRENCE_BIJECTION');ids.add(row.id);
    need(row.parent===original.parent&&row.specifier===original.specifier&&row.offset_utf16===original.offset
      &&row.original_code===original.code&&files.get(row.parent)?.sha256===row.source_sha256,'OCCURRENCE_SOURCE_BINDING');
    need(row.id===sha(Buffer.from(canonical({parent:row.parent,source_sha256:row.source_sha256,specifier:row.specifier,offset_utf16:row.offset_utf16})))
      &&policy.allowed_statuses.includes(row.status),'OCCURRENCE_STATUS_IDENTITY');
  }
  return {required:policy.occurrences.filter(r=>r.status==='REQUIRED_PINNED_DATA').length,
    denied:policy.occurrences.filter(r=>r.status==='DENIED_AT_RUNTIME').length,
    unresolved:policy.occurrences.filter(r=>r.status==='STILL_UNRESOLVED').length};
}
export class RuntimeRoutes {
  #root;#runtime;#policy;#pins;#edges;#sources;#modules=new Map();#facades=new Map();#context;#first=null;#compiled=0;#restore;#mode;#descriptor;#status;
  constructor(root,runtime,{mode='source-smoke',descriptor=null}={}){
    need(['source-smoke','consumer-candidate'].includes(mode),'ROUTE_MODE');
    const stat=lstat(root);need(stat.isDirectory()&&!stat.isSymbolicLink()&&realpath(root)===path.resolve(root),'CANONICAL_ROUTE_ROOT');
    runtime=freeze(JSON.parse(JSON.stringify(runtime)));
    this.#root=path.resolve(root);this.#runtime=runtime;this.#policy=readPolicy();this.#status=freeze(validatePolicy(this.#policy,runtime));
    this.#mode=mode;this.#descriptor=descriptor===null?null:freeze(JSON.parse(JSON.stringify(descriptor)));
    this.#pins=new Map(runtime.files.map(f=>[f.path,f]));
    this.#sources=new Map(this.#policy.required_source_pins.map(f=>[f.path,f]));
    this.#edges=new Map(runtime.graph.edges.map(e=>[canonical([e.parent,e.specifier]),e.target]));
    for(const file of new Set(this.#policy.occurrences.map(r=>r.parent)))this.#bytes(file,this.#pins.get(file));
  }
  get status(){return this.#status;}
  get firstDenial(){return this.#first?{...this.#first}:null;}
  get policy(){return this.#policy;}
  unresolved(){return this.status.unresolved;}
  requireResolved(){need(this.status.unresolved===0,'STILL_UNRESOLVED_RUNTIME_OCCURRENCES');}
  healthy(){need(!this.#first,'ROUTE_GUARD_QUARANTINED');}
  deny(code,detail){this.#first??={code,detail:detail??null};throw new Hold(code);}
  #bytes(relative,pin){
    need(pin&&relative===pin.path&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>!p||p==='.'||p==='..'),'PINNED_ROUTE_FILE_REQUIRED');
    let p=this.#root;
    for(const part of relative.split('/')){p=path.join(p,part);need(!lstat(p).isSymbolicLink(),'ROUTE_SYMLINK_DENIED');}
    const before=lstat(p);need(before.isFile()&&before.nlink===1&&before.size===pin.bytes,'ROUTE_FILE_TYPE_SIZE');
    const fd=open(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    try{const actual=fstat(fd);need(actual.isFile()&&actual.dev===before.dev&&actual.ino===before.ino,'ROUTE_FILE_CHANGED');
      const b=read(fd);need(b.length===pin.bytes&&sha(b)===pin.sha256,'ROUTE_FILE_HASH_CHANGED');return b;
    }finally{close(fd);}
  }
  assertCurrent(){
    this.healthy();need(sha(read(path.join(ROOT,POLICY)))===POLICY_SHA256,'ROUTE_POLICY_BYTES_CHANGED');
    for(const parent of new Set(this.#policy.occurrences.map(r=>r.parent)))this.#bytes(parent,this.#pins.get(parent));
  }
  readSource(relative){this.assertCurrent();const pin=this.#sources.get(relative);need(pin,'UNDECLARED_SOURCE_DATA');return this.#bytes(relative,pin).toString('utf8');}
  #parent(filename){return typeof filename==='string'&&filename.startsWith(this.#root+'/')?filename.slice(this.#root.length+1):null;}
  owns(filename){const parent=this.#parent(filename);return parent==='package.json'||this.#pins.has(parent);}
  resolve(specifier,parentFilename){
    this.healthy();const parent=this.#parent(parentFilename);need(parent,'OUTSIDE_RUNTIME_PARENT');
    if(specifier==='pg-native'||specifier==='source-map-support'||specifier.includes('/pg/lib/native'))return this.deny('DENIED_NATIVE_OR_DYNAMIC_REQUIRE');
    if(path.isAbsolute(specifier)||specifier.startsWith('file:')||specifier.includes('\\'))return this.deny('DENIED_DYNAMIC_MODULE_SELECTOR');
    const expected=this.#edges.get(canonical([parent,specifier]));
    if(!expected)return this.deny('DENIED_NEW_RUNTIME_EDGE');
    if(expected.startsWith('node:'))return expected;
    if(/\.(?:node|wasm)$/.test(expected)||expected.startsWith('node_modules/pg/lib/native/'))return this.deny('DENIED_NATIVE_MODULE_PATH');
    this.#bytes(expected,this.#pins.get(expected));return path.join(this.#root,expected);
  }
  #denyFacade(code){
    const deny=()=>this.deny(code);const target=Object.create(null);
    return new Proxy(target,{get:(_,name)=>name===Symbol.toStringTag?'DeniedCapability':name==='then'?undefined:name==='constants'?Object.freeze({...fs.constants}):name==='promises'?this.#denyFacade(code):deny});
  }
  #builtin(name){
    const bare=name.replace(/^node:/,'');
    if(['fs','fs/promises'].includes(bare))return this.#denyFacade('DENIED_RUNTIME_DATA_ACCESS');
    if(['vm','module','process','child_process','worker_threads','wasi','inspector','cluster'].includes(bare))return this.#denyFacade('DENIED_DYNAMIC_RUNTIME_CAPABILITY');
    // Network/process fencing is installed by the owner before library operations.
    return Module.createRequire(import.meta.url)(name);
  }
  require(specifier,parentFilename=path.join(this.#root,'package.json')){
    const resolved=this.resolve(specifier,parentFilename);
    if(resolved.startsWith('node:'))return this.#builtin(resolved);
    const relative=this.#parent(resolved);
    if(this.#modules.has(relative))return this.#modules.get(relative).exports;
    const raw=this.#bytes(relative,this.#pins.get(relative));const mod=new Module(resolved);
    mod.filename=resolved;mod.paths=[];this.#modules.set(relative,mod);
    try{
      if(relative==='node_modules/typescript/lib/typescript.js')mod.exports=this.#typescript(raw);
      else if(relative.endsWith('.json'))mod.exports=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
      else{
        need(!relative.endsWith('.mjs'),'UNREVIEWED_RUNTIME_ESM');
        mod.require=name=>this.require(name,resolved);
        mod._compile(raw.toString('utf8'),resolved);
        if(relative==='node_modules/pg-connection-string/index.js')mod.exports=this.#connectionString(mod.exports);
        if(relative==='node_modules/pg/lib/index.js')mod.exports=this.#postgres(mod.exports);
      }
      mod.loaded=true;this.healthy();return mod.exports;
    }catch(error){this.#modules.delete(relative);throw error;}
  }
  #typescript(raw){
    if(this.#facades.has('typescript'))return this.#facades.get('typescript');
    const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
    new vm.Script('var module={exports:{}};var exports=module.exports;').runInContext(context,{timeout:2000});
    new vm.Script(raw.toString('utf8'),{filename:'pinned-typescript-5.9.3.js'}).runInContext(context,{timeout:2000});
    need(context.module.exports.version==='5.9.3','PINNED_TYPESCRIPT_VERSION');this.#context=context;
    const base=Object.assign(Object.create(null),{version:'5.9.3',ModuleKind:Object.freeze({CommonJS:1}),ScriptTarget:Object.freeze({ES2022:9}),
      transpileModule:(input,options)=>this.transpile(input,options)});
    Object.freeze(base);
    const facade=new Proxy(base,{get:(target,key)=>{
      if(key in target)return target[key];if(key==='then'||key==='__esModule')return undefined;
      return this.deny('DENIED_TYPESCRIPT_API');
    }});this.#facades.set('typescript',facade);return facade;
  }
  transpile(input,options){
    this.assertCurrent();need(typeof input==='string'&&Buffer.byteLength(input)<=this.#policy.limits.transpile_source_bytes,'FIXED_TRANSPILE_INPUT_BOUND');
    need([...this.#sources.values()].some(p=>p.bytes===Buffer.byteLength(input)&&p.sha256===sha(Buffer.from(input))),'UNPINNED_TRANSPILE_SOURCE');
    need(canonical(options)===canonical(this.#policy.typescript.options),'FIXED_TRANSPILE_OPTIONS');
    need(++this.#compiled<=this.#policy.limits.total_compilations,'TRANSPILE_COUNT');
    if(!this.#context)this.require('typescript');
    const context=this.#context;context.__input=input;
    try{
      const result=new vm.Script('module.exports.transpileModule(__input,{compilerOptions:{module:1,target:9}})').runInContext(context,{timeout:this.#policy.limits.transpile_timeout_ms});
      this.healthy();this.assertCurrent();need(typeof result.outputText==='string','TRANSPILE_OUTPUT');
      return {outputText:result.outputText,diagnostics:Array.from(result.diagnostics??[],d=>({code:d.code,category:d.category}))};
    }finally{delete context.__input;}
  }
  #connectionString(original){
    const validate=(str,options)=>{
      this.assertCurrent();need(typeof str==='string'&&(!options||Object.keys(options).length===0),'FIXED_CONNECTION_PARSE');
      let url;try{url=new URL(str);}catch{return this.deny('DENIED_CONNECTION_SELECTOR');}
      const d=this.#descriptor,roles=d?['cladora_ce_guide_runtime',d.observer_role,d.conflict_role]:['cladora_ce_guide_runtime'];
      if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='5432'||url.password||url.search||url.hash
        ||!roles.includes(url.username)||!/^\/docs_ce012_[a-f0-9]{16}$/.test(url.pathname)
        ||d&&url.pathname!==`/${d.database}`)return this.deny('DENIED_SSL_OR_CONNECTION_SELECTOR');
    };
    const parse=(str,options)=>{validate(str,options);const result=original.parse(str,options);this.healthy();return result;};
    const api=Object.assign((str,options)=>parse(str,options),{parse,parseIntoClientConfig:str=>{validate(str);return original.parseIntoClientConfig(str);}});
    return new Proxy(api,{get:(target,key)=>key in target?target[key]:key==='then'?undefined:this.deny('DENIED_CONNECTION_PARSE_API')});
  }
  #postgres(pg){
    Object.defineProperty(pg,'native',{configurable:true,get:()=>this.deny('DENIED_PG_NATIVE')});
    if(this.#mode==='source-smoke')for(const name of ['Client','Pool'])pg[name]=new Proxy(pg[name],{construct:()=>this.deny('DENIED_SMOKE_CONNECTION_CONSTRUCTION')});
    return pg;
  }
  install(){
    need(!globalThis[ACTIVE],'ROUTE_GUARD_ALREADY_INSTALLED');this.assertCurrent();
    const original=Module._load,dlopen=process.dlopen,binding=process.binding,getBuiltin=process.getBuiltinModule;
    const self=this;globalThis[ACTIVE]=this;
    Module._load=function(name,parent,isMain){return self.owns(parent?.filename)?self.require(name,parent.filename):original.call(this,name,parent,isMain);};
    process.dlopen=()=>this.deny('DENIED_NATIVE_ADDON');
    process.binding=name=>['fs','spawn_sync','tcp_wrap','pipe_wrap'].includes(name)?this.deny('DENIED_RAW_RUNTIME_BINDING'):binding.call(process,name);
    if(getBuiltin)process.getBuiltinModule=name=>['fs','fs/promises','module','vm'].includes(name.replace(/^node:/,''))?this.#builtin(name):getBuiltin.call(process,name);
    this.#restore=()=>{Module._load=original;process.dlopen=dlopen;process.binding=binding;if(getBuiltin)process.getBuiltinModule=getBuiltin;delete globalThis[ACTIVE];};
    return this.#restore;
  }
  restore(){this.#restore?.();this.#restore=null;}
}
