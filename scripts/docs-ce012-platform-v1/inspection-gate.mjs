/** Preload guard only. The inspector is the unchanged producer run.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import Module from 'node:module';
import {createHash} from 'node:crypto';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const POLICY_SHA='869d44098bb9f63971d2339f1cf581ba6f5c14e8e16b7330712eb4ffee4b1ad2';
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const fail=code=>{fs.writeSync(2,JSON.stringify({event:'INSPECTION_REJECT',code,pid:process.pid})+'\n');throw Object.assign(new Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const raw=fs.readFileSync(path.join(HERE,'inspection-policy.v1.json'));need(sha(raw)===POLICY_SHA,'INSPECTION_POLICY_DRIFT');
const policy=JSON.parse(raw),entry=process.argv[1];need(typeof entry==='string'&&entry.endsWith('/'+policy.entry),'INSPECTION_ENTRY_ONLY');
const root=entry.slice(0,-policy.entry.length-1),scope=path.dirname(root),receipt=path.join(scope,'materialization.private.json');
const sourceManifest=path.resolve(HERE,'../../docs/testing/docs-ce012-inspection-entry-09.manifest.json');
const reads=[root,receipt,fileURLToPath(import.meta.url),path.join(HERE,'inspection-policy.v1.json'),policy.tools.node.path,'/proc/self/status',sourceManifest];
const expectedFlags=['--permission','--no-addons',...reads.map(p=>'--allow-fs-read='+p),'--import',fileURLToPath(import.meta.url)];
function exactContext(){
  need(process.argv.length===3&&process.argv[0]===policy.tools.node.path&&process.argv[1]===entry&&process.argv[2]===policy.mode,'INSPECTION_ARGV_INJECTION');
  need(canonical(process.execArgv)===canonical(expectedFlags),'INSPECTION_NODE_FLAGS_INJECTION');
  need(canonical(process.env)===canonical(policy.environment),'INSPECTION_ENV_INJECTION');
  need(process.permission?.has('fs.read',root)&&!process.permission.has('fs.write',root)&&!process.permission.has('child')
    &&!process.permission.has('addons')&&!process.permission.has('worker'),'INSPECTION_READ_ONLY_PERMISSIONS');
  need(fs.realpathSync(root)===root&&!fs.lstatSync(root).isSymbolicLink(),'INSPECTION_ROOT_ALIAS');
}
exactContext();need(sha(fs.readFileSync(process.execPath))===policy.tools.node.sha256,'INSPECTION_NODE_DRIFT');
const sourceSeal=JSON.parse(fs.readFileSync(sourceManifest)).inspection_source_seal;
need(sha(Buffer.from(canonical(sourceSeal.files)))===sourceSeal.sha256
  &&sha(fs.readFileSync(fileURLToPath(import.meta.url)))===sourceSeal.files['inspection-gate.mjs']
  &&POLICY_SHA===sourceSeal.files['inspection-policy.v1.json'],'INSPECTION_WRAPPER_DRIFT');
const material=JSON.parse(fs.readFileSync(receipt));
need(material.material_files.length===601&&sha(Buffer.from(canonical(material.material_files)))===policy.materialization_seal,'INSPECTION_MATERIAL_IDENTITY');
const pinMap=new Map(material.material_files.map(p=>[path.join(root,p.path),p]));
function checkFile(file){
  const pin=pinMap.get(file);need(pin,'INSPECTION_UNPINNED_READ');let full=root;
  for(const name of pin.path.split('/')){full=path.join(full,name);need(!fs.lstatSync(full).isSymbolicLink(),'INSPECTION_SYMLINK');}
  const before=fs.lstatSync(full,{bigint:true});need(before.isFile()&&before.nlink===1n&&before.size===BigInt(pin.bytes),'INSPECTION_FILE_ALIAS_SIZE');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{const start=fs.fstatSync(fd,{bigint:true}),bytes=fs.readFileSync(fd),end=fs.fstatSync(fd,{bigint:true});
    need(start.dev===before.dev&&start.ino===before.ino&&end.nlink===1n&&start.ctimeNs===end.ctimeNs&&start.mtimeNs===end.mtimeNs,'INSPECTION_READ_DRIFT');
    need(bytes.length===pin.bytes&&sha(bytes)===pin.sha256,'INSPECTION_PIN_DRIFT');return bytes;
  }finally{fs.closeSync(fd);}
}
function checkMaterials(){exactContext();for(const file of pinMap.keys())checkFile(file);}
checkMaterials();
const allowed=new Map(Object.keys(policy.edges).map(n=>[path.join(root,'scripts/docs-ce012-live-connection-v1',n),n]));
const loaded=new Set();let first=null,entryResolved=false;
function refuse(code){first??=code;fail(code);}
function healthy(){if(first)fail(first);exactContext();}
Module.registerHooks({
  resolve(specifier,context,nextResolve){
    healthy();const parent=context.parentURL?.startsWith('file:')?fileURLToPath(context.parentURL):null;
    if(parent&&allowed.has(parent)){
      if(!policy.edges[allowed.get(parent)].includes(specifier))return refuse('INSPECTION_FORBIDDEN_IMPORT_EDGE');
      if(specifier.startsWith('node:'))return nextResolve(specifier,context);
      const file=path.resolve(path.dirname(parent),specifier);if(!allowed.has(file))return refuse('INSPECTION_FORBIDDEN_MODULE');
      checkFile(file);return {url:pathToFileURL(file).href,shortCircuit:true};
    }
    if(!parent&&!entryResolved&&[entry,pathToFileURL(entry).href].includes(specifier)){
      entryResolved=true;checkMaterials();return {url:pathToFileURL(entry).href,shortCircuit:true};
    }
    return refuse('INSPECTION_UNKNOWN_IMPORT_OR_REPLAY');
  },
  load(url,context,nextLoad){
    healthy();if(url.startsWith('node:'))return nextLoad(url,context);
    const file=url.startsWith('file:')?fileURLToPath(url):null;
    if(!allowed.has(file)||url!==pathToFileURL(file).href)return refuse('INSPECTION_FORBIDDEN_MODULE');
    const source=checkFile(file);loaded.add(allowed.get(file));return {format:'module',source,shortCircuit:true};
  },
});
const kernel=Object.fromEntries(fs.readFileSync('/proc/self/status','utf8').split('\n').filter(s=>/^(NoNewPrivs|Seccomp|Seccomp_filters):/.test(s)).map(s=>{const [k,v]=s.split(':');return [k,Number(v.trim())];}));
need(kernel.NoNewPrivs===1&&kernel.Seccomp===2,'INSPECTION_KERNEL_MISSING');
process.on('exit',()=>{
  try{healthy();checkMaterials();need(canonical([...loaded].sort())===canonical(['admission.mjs','closure.mjs','run.mjs']),'INSPECTION_IMPORT_CLOSURE');}
  catch(error){first??=error.code??'INSPECTION_EXIT_UNKNOWN';process.exitCode=2;}
  fs.writeSync(2,JSON.stringify({event:'INSPECTION_EXIT',result:first?'FAILED_OR_UNKNOWN':'PASS',first_error:first,pid:process.pid,loaded:[...loaded].sort(),kernel,
    child_permission:false,addon_permission:false,env_keys:Object.keys(process.env).sort()})+'\n');
});
