/** Offline exact-byte materialization. No admission, interpreter, connection or installer. */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,DIR,sha,canonical,need,seal,verifyMaterials} from './contract.mjs';
import {readPolicy,validatePolicy,POLICY_SHA256} from './runtime-routes.mjs';
const SOURCE='c0caf3e70d97c3d09b16cbff91188367804cba6b';
const canonicalRoot=root=>{need(typeof root==='string'&&path.isAbsolute(root)&&fs.realpathSync(root)===root&&!fs.lstatSync(root).isSymbolicLink(),'MATERIAL_ROOT_ALIAS');return root;};
export function exactRead(root,pin){
  canonicalRoot(root);need(pin&&typeof pin.path==='string'&&!path.isAbsolute(pin.path)&&!pin.path.includes('\\')
    &&pin.path.split('/').every(p=>p&&p!=='.'&&p!=='..'),'MATERIAL_RELATIVE_PIN');
  let full=root;for(const part of pin.path.split('/')){full=path.join(full,part);need(!fs.lstatSync(full).isSymbolicLink(),'MATERIAL_SYMLINK');}
  const before=fs.lstatSync(full,{bigint:true});need(before.isFile()&&before.nlink===1n&&before.size===BigInt(pin.bytes),'MATERIAL_FILE_ALIAS_TYPE_SIZE');
  const fd=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{const stat=fs.fstatSync(fd,{bigint:true});need(stat.dev===before.dev&&stat.ino===before.ino&&stat.nlink===1n,'MATERIAL_OPEN_DRIFT');
    const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true});
    need(after.size===stat.size&&after.nlink===1n&&after.mtimeNs===stat.mtimeNs&&after.ctimeNs===stat.ctimeNs,'MATERIAL_READ_DRIFT');
    need(bytes.length===pin.bytes&&sha(bytes)===pin.sha256,'MATERIAL_BYTES_DRIFT');return bytes;
  }finally{fs.closeSync(fd);}
}
function acceptedInputs(producerRoot){
  // Exact fixed metadata reads avoid granting directory-wide repo read merely
  // to canonicalize ROOT in a permission-restricted offline child.
  const raw=fs.readFileSync(path.join(ROOT,'supabase/local-profiles/docs-ce012-pgauth-binding-v1.json'));
  need(sha(raw)==='8fa3b78ffc5a78732d9494a6533ae5d134433da9a107d58265f15562e64ec5bd','UNCHANGED_BINDING_METADATA');
  const b=JSON.parse(raw).accepted,r=JSON.parse(fs.readFileSync(path.join(ROOT,'supabase/local-profiles/docs-ce012-pgauth-reviews-v1.json')));
  need(b.head===SOURCE&&b.runtime===null&&b.contract==='documents-ce012-live-connection-request.v2'&&r.format==='docs-ce012-platform-reviews.v1'&&Object.keys(r.reviews).length===0,'EXACT_INACTIVE_V2');
  const pins=[...b.artifacts,...[['consumer-request.json',b.request],['source-inventory.json',b.inventory],['runtime-closure.json',b.closure]].map(([name,pin])=>({path:DIR+name,...pin}))];
  const bytes=new Map(pins.map(p=>[p.path,exactRead(producerRoot,p)]));
  const inventory=JSON.parse(bytes.get(DIR+'source-inventory.json'));
  need(inventory.files.length===322,'COMPLETE_322_REQUIRED');
  return {binding:b,pins,bytes,inventory};
}
function uniquePins(entries){const m=new Map();for(const f of entries){const pin={path:f.path,bytes:f.bytes,sha256:f.sha256};
  need(!m.has(pin.path),'MATERIAL_DUPLICATE_PATH');need(Number.isSafeInteger(pin.bytes)&&pin.bytes>=0&&/^[a-f0-9]{64}$/.test(pin.sha256),'MATERIAL_PIN_SHAPE');m.set(pin.path,pin);}
  return [...m.values()].sort((a,b)=>a.path.localeCompare(b.path));}
export function materialPlan(producerRoot,runtime){
  const input=acceptedInputs(producerRoot);validatePolicy(readPolicy(),runtime);
  const pins=uniquePins([...input.inventory.files,...input.pins,...runtime.files]);need(pins.length===601,'COMPLETE_601_REQUIRED');
  const sources=input.inventory.files.filter(f=>f.path.endsWith('.ts'));need(sources.length===20,'TWENTY_SOURCES_REQUIRED');
  need(canonical(sources)===canonical(readPolicy().required_source_pins),'SOURCE_POLICY_INVENTORY_MISMATCH');
  return {...input,pins};
}
export function verifyComplete(root,producerRoot,runtime){
  const input=materialPlan(producerRoot,runtime);const identities=new Set();
  for(const pin of input.pins){exactRead(root,pin);const stat=fs.lstatSync(path.join(root,pin.path));const key=stat.dev+':'+stat.ino;need(!identities.has(key),'MATERIAL_INODE_ALIAS');identities.add(key);}
  const actual=[];const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);need(!fs.lstatSync(p).isSymbolicLink(),'MATERIAL_SYMLINK');if(entry.isDirectory())walk(p);else actual.push(path.relative(root,p).split(path.sep).join('/'));}};walk(root);
  need(canonical(actual.sort())===canonical(input.pins.map(p=>p.path).sort()),'MATERIAL_EXTRA_OR_MISSING_FILE');
  // Original function, unchanged. This does not call admit or any producer module.
  const materials=verifyMaterials(root,{request:input.binding.request,inventory:input.binding.inventory,closure:input.binding.closure},input.binding);
  need(materials.request.equals(input.bytes.get(DIR+'consumer-request.json'))&&materials.inventory.equals(input.bytes.get(DIR+'source-inventory.json'))
    &&materials.closure.equals(input.bytes.get(DIR+'runtime-closure.json')),'MATERIAL_READBACK');
  return {files:input.pins,sha256:sha(Buffer.from(canonical(input.pins))),count:input.pins.length,bytes:input.pins.reduce((a,p)=>a+p.bytes,0),verifyMaterials:'PASS_UNCHANGED_NO_ADMISSION'};
}
function writeNew(root,pin,bytes){
  const full=path.join(root,pin.path);fs.mkdirSync(path.dirname(full),{recursive:true,mode:0o700});
  const fd=fs.openSync(full,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|fs.constants.O_NOFOLLOW,0o400);
  try{need(fs.writeSync(fd,bytes)===bytes.length,'MATERIAL_SHORT_WRITE');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  exactRead(root,pin);
}
export function materializeComplete({sourceRoots,producerRoot,runtimeRoot,runtimeBytes,output}){
  need(Buffer.isBuffer(runtimeBytes),'EXACT_RUNTIME_INPUT_BYTES');const runtime=JSON.parse(runtimeBytes);
  need(Array.isArray(sourceRoots)&&sourceRoots.length>0,'MATERIAL_SOURCE_ROOTS');sourceRoots.forEach(canonicalRoot);canonicalRoot(producerRoot);canonicalRoot(runtimeRoot);
  need(path.isAbsolute(output)&&!fs.existsSync(output)&&fs.realpathSync(path.dirname(output))===path.dirname(output),'FRESH_MATERIAL_DIRECTORY_REQUIRED');
  const plan=materialPlan(producerRoot,runtime),selected=new Map(),inventoryPaths=new Set(plan.inventory.files.map(f=>f.path));
  // Select only declared, hash-matching cached bytes before allocation. Recheck
  // every selection before copy AND after all copies; no stale-source repair.
  for(const pin of plan.pins){
    const candidates=inventoryPaths.has(pin.path)?sourceRoots:pin.path.startsWith('node_modules/')?[runtimeRoot]:[producerRoot];
    let found;for(const root of candidates){try{exactRead(root,pin);found=root;break;}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}}
    need(found,'MATERIAL_EXACT_SOURCE_MISSING');selected.set(pin.path,found);
  }
  fs.mkdirSync(output,{mode:0o700});const root=path.join(output,'consumer-source');fs.mkdirSync(root,{mode:0o700});
  for(const pin of plan.pins)writeNew(root,pin,exactRead(selected.get(pin.path),pin));
  for(const pin of plan.pins)exactRead(selected.get(pin.path),pin);
  const checked=verifyComplete(root,producerRoot,runtime);
  writeNew(output,{path:'runtime-inputs.json',bytes:runtimeBytes.length,sha256:sha(runtimeBytes)},runtimeBytes);
  const result={format:'documents-ce012-complete-materialization.v1',consumer_source:SOURCE,inventory_entries:322,producer_esm:5,metadata_files:3,runtime_files:271,
    materialization_seal:checked.sha256,material_files:checked.files,material_bytes:checked.bytes,source_seal:seal(),policy_sha256:POLICY_SHA256,
    before_after_source_drift:'MATCH',destination_readback:'MATCH',verifyMaterials:checked.verifyMaterials,runtime_binding:null,registry:'EMPTY',execution:'NOT_RUN'};
  const receipt=Buffer.from(JSON.stringify(result,null,2)+'\n');writeNew(output,{path:'materialization.private.json',bytes:receipt.length,sha256:sha(receipt)},receipt);
  return {root,result};
}
