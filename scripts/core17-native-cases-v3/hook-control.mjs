/** Metadata-only preparation; never starts/stops App or connects to PG/Auth. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {validateRequest,APP,INSTALLED,digest} from './contract.mjs';
import {savePrivate,sourceGate} from './operator.mjs';
import {readOwnedInstallerFileV1,loadInstallerCredentialBindingV1,installerTargetV1} from '../lib/core-installer-credential-binding-v1.mjs';
export function prepareHook(request,root){
 const r=validateRequest(request);sourceGate(root,r);
 const runtime=JSON.parse(readOwnedInstallerFileV1(r.runtime_binding,r.private_root));
 loadInstallerCredentialBindingV1({privateRoot:r.private_root,generation:'v3',bindingPath:r.installer_binding,expectedTarget:installerTargetV1(runtime.target)});
 const parent=dirname(r.output_directory);if(!existsSync(parent))mkdirSync(parent,{mode:0o700});const s=lstatSync(parent);assert.ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0);
 mkdirSync(r.output_directory,{mode:0o700});savePrivate(join(r.output_directory,'request.private.json'),r,{exclusive:true});
 const scopes=r.authorized_cases.map(name=>{const f=r.plan.cases[name],b=name==='B-populated'?r.B_selection:null;const w=b?.workspace_id??f.workspace;return{case:name,context:b?.context_id??f.context,workspace:w,tenant:b?.tenant_id??f.tenant,membership:b?.membership_id??f.membership,keys:[`core-tx.v1:${w}:${f.key}`,...(name==='different-key'?[`core-tx.v1:${w}:${f.key}_second`]:[])],fault:name==='precommit-atomicity'?'precommit':name==='precommit-disconnect'?'precommit-disconnect':name==='core503'?'post-commit-ack':'observe'};});
 const req=createRequire(join(r.app_root,'package.json'));
 const config={contract:'core17.current-process-pg-probe.v3',App:APP,installed:INSTALLED,build:r.build_id,app_root:r.app_root,actor:r.actor_A,request_sha256:digest(JSON.stringify(r)),target:installerTargetV1(runtime.target),output:r.output_directory,pg_version:req('pg/package.json').version,scopes};
 const configFile=join(r.output_directory,'hook-config.private.json');savePrivate(configFile,config,{exclusive:true});
 const hook=join(root,'scripts/core17-native-cases-v3/current-process-hook.mjs'),pin=digest(readFileSync(hook)),configPin=digest(readFileSync(configFile));
 const next=req.resolve('next/dist/bin/next');
 const wrapper=`'use strict';\n// No-op in launcher/build/other programs; no credentials imported here.\nif(process.argv[1]===${JSON.stringify(next)}&&JSON.stringify(process.argv.slice(2))===JSON.stringify(['start','--hostname','127.0.0.1','--port','3008'])){\n const fs=await import('node:fs'),crypto=await import('node:crypto');\n if(crypto.createHash('sha256').update(fs.readFileSync(${JSON.stringify(hook)})).digest('hex')!==${JSON.stringify(pin)})throw Error('EXACT_PROBE_SOURCE_REQUIRED');\n (await import(${JSON.stringify(hook)})).install(${JSON.stringify({config_file:configFile,config_sha256:configPin,hook_sha256:pin})});\n}\n`;
 const wrapperPath=join(r.output_directory,'next-start-probe.mjs');
 // Data writer is intentionally separate: this is source code with exact paths,
 // not a JSON config renamed as executable code.
 const {openSync,writeSync,fsyncSync,closeSync,constants}=req('node:fs');const fd=openSync(wrapperPath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{assert.equal(writeSync(fd,wrapper),Buffer.byteLength(wrapper));fsyncSync(fd);}finally{closeSync(fd);}
 const prepared={requires_probe:r.authorized_cases.some(c=>['same-key','different-key','precommit-atomicity','precommit-disconnect','core503'].includes(c)),contract:'core17.native-probe-prepared.v3',request_sha256:digest(JSON.stringify(r)),config_sha256:configPin,hook_sha256:pin,wrapper_sha256:digest(Buffer.from(wrapper)),wrapper:wrapperPath,Next_build_id:r.build_id,installed_core:INSTALLED,effects:'LOCAL_FILES_ONLY; NO_NATIVE_NO_ACTIVATION',lifecycle:'Platform must independently admit SAME_FD7_BUILD next-start with existing NODE_OPTIONS guards plus this --import; do not replay consumed claims'};
 savePrivate(join(r.output_directory,'prepared.private.json'),prepared,{exclusive:true});return prepared;
}
export function loadCurrentProcessJournal(r,caseName){
 const cfg=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'prepared.private.json'),r.private_root));assert.equal(cfg.request_sha256,digest(JSON.stringify(r)));
 const ready=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'hook-ready.private.json'),r.private_root));assert.equal(ready.config_sha256,cfg.config_sha256);assert.equal(ready.hook_sha256,cfg.hook_sha256);assert.equal(ready.App,APP);assert.equal(ready.build,r.build_id);
 const proc='/proc/'+ready.node_pid;const ticks=readFileSync(proc+'/stat','utf8').split(') ')[1].split(' ')[19];assert.equal(ticks,ready.start_ticks,'EXACT_CURRENT_PROCESS_PID_REQUIRED');
 // Journal can grow while a query is blocked. Only complete fsynced JSON lines
 // are consumed; a partial tail is not invented or considered readiness.
 const path=join(r.output_directory,'app-journal.private.ndjson');const st=lstatSync(path);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.uid===process.getuid()&&(st.mode&0o077)===0&&st.size<=32*1024*1024);
 const bytes=readFileSync(path);assert.ok(bytes.length<=32*1024*1024);const raw=bytes.subarray(0,bytes.lastIndexOf(10)+1).toString('utf8'),lines=raw.split('\n').filter(Boolean).map(x=>JSON.parse(x));
 const traces=new Map();for(const e of lines.filter(x=>x.case===caseName)){
  assert.equal(e.node_pid,ready.node_pid);let t=traces.get(e.backend_pid);if(!t){t={pid:e.backend_pid,events:[],queries:[],codes:[],locks:[],pending_query:null,stages:new Set(),fault_fired:false,node_pid:ready.node_pid};traces.set(e.backend_pid,t);}
  const record=v=>{if(v.type==='CommandComplete'||v.type==='ReadyForQuery')t.events.push({...v,pid:e.backend_pid});if(v.type==='query'){t.queries.push(v.sql);t.pending_query=v.sql;if(v.label)t.locks.push(v.label);}if(v.type==='errorMessage')t.codes.push(v.code);};
  if(e.type==='admitted'){for(const old of e.history)record(old);t.scope=e.scope;}else record(e);
  if(e.type==='query-finished')t.pending_query=null;
  if(e.type==='ledger')t.ledger=e.value;if(e.type==='receipt')t.receipt=e.value;if(e.type==='database-transaction')t.database_transaction_id=e.value;
  if(e.type==='fault'){t.fault_fired=true;t.fault_kind=e.kind;t.stages=new Set(e.stages??[]);}
 }
 return{ready,traces:[...traces.values()],journal:{snapshot_bytes:bytes.length,sha256:digest(bytes),complete_lines:lines.length}};
}

/** Reuses Platform's existing listen-observation ABI and static nonce. No new
 * listener/controller, signal, port scan or business/Auth/SQL dispatch. */
export async function bindCurrentListener(r,{persist=true}={}){
 const bytes=readOwnedInstallerFileV1(r.listener_observation_file,dirname(r.listener_observation_file));
 const p=JSON.parse(bytes);assert.equal(p.contract,'platform17.listen-observation.v1');assert.equal(p.mode,'app');assert.equal(p.port,3008);assert.equal(p.address,'127.0.0.1');assert.equal(p.cwd,r.app_root);assert.equal(p.uid,process.getuid());assert.match(p.nonce,/^[a-f0-9]{64}$/);
 const requiresProbe=r.authorized_cases.some(c=>['same-key','different-key','precommit-atomicity','precommit-disconnect','core503'].includes(c));
 const prepared=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'prepared.private.json'),r.private_root));
 const ready=requiresProbe?JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'hook-ready.private.json'),r.private_root)):{node_pid:p.pid,start_ticks:p.start_ticks,App:APP,build:r.build_id,config_sha256:prepared.config_sha256};assert.equal(p.pid,ready.node_pid);assert.equal(p.start_ticks,ready.start_ticks);assert.equal(ready.App,APP);assert.equal(ready.build,r.build_id);
 const ticks=readFileSync('/proc/'+p.pid+'/stat','utf8').split(') ')[1].split(' ')[19];assert.equal(ticks,p.start_ticks,'LISTENER_PID_REUSED_OR_EXITED');
 const response=await fetch('http://localhost:3008/_next/static/'+r.build_id+'/_buildManifest.js',{headers:{'x-cladora-start-observation':p.nonce},redirect:'error',signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,200);assert.equal(response.headers.get('x-cladora-start-observation'),p.nonce,'ACTUAL_LISTENER_NONCE_REQUIRED');await response.arrayBuffer();
 const result={contract:'core17.current-App-probe-listener.v3',node_pid:p.pid,start_ticks:p.start_ticks,observation_sha256:digest(bytes),config_sha256:ready.config_sha256,App:APP,build:r.build_id};
 if(persist)savePrivate(join(r.output_directory,'listener-bound.private.json'),result,{exclusive:true});else{const old=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'listener-bound.private.json'),r.private_root));assert.deepEqual(result,old,'CURRENT_LISTENER_CHANGED');}
 return result;
}
