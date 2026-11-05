/** Source/transport compatibility only; never Auth, SQL or activation authority.
 * A Coordinator-reviewed explicit admission is separate from the immutable relay
 * activation binding. Expected pins are never populated from observed HEAD.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readSync,readFileSync,lstatSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {coreServiceAssemblyChildEnvironmentV1} from './core-service-assembly-environment-v1.mjs';
import {CORE17_RELAY_ABI_V2,CORE17_RELAY_SEAL_V2,core17RelaySelectionV2,core17RelayPreflightV2} from './core-service-relay-cors-v2-preflight.mjs';
export const CORE17_CONSUMER_ABI_V1='core17.exact-app-consumer-admission.v1';
export const CORE17_CONSUMER_BASE='b696ff211daabd4be3989522c569f24ccccd0dce';
export const CORE17_INSTALLED_BASE='ee883b62cf4a318af3450c506931a969623b8987';
const transportTree='534ec94f21699a65686bade5539517dfd818ec1e';
const transportLauncher='5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092';
const launcher='scripts/run-core-service-app-assembly-17.mjs';
export const CORE17_CONSUMER_PROTECTED_SOURCES=Object.freeze([
 'package.json','package-lock.json',
 'src/lib/core/functional-command-runtime-v1.ts','src/lib/core/functional-request-auth-v1.ts',
 'src/lib/core/private-service-development-binding-v1.ts','src/lib/core/service-functional-binding-v1.ts',
 'src/lib/core/current-authority-postgres-provider-v1.ts','src/lib/core/postgres-transaction-host-v1.ts',
 'src/lib/core/service-app-read-v1.ts',
 'supabase/install/core-service-app-assembly-v1/catalog-compatibility.sql',
 'supabase/install/core-service-app-assembly-v1/read-access.sql',
 'supabase/install/core-service-app-assembly-v1/manifest.json',
]);
const sha=b=>createHash('sha256').update(b).digest('hex');
function fields(value,keys){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),'CORE17_ADMISSION_OBJECT');assert.deepEqual(Object.keys(value).sort(),keys.sort(),'CORE17_ADMISSION_EXACT_FIELDS');}
function app(value){fields(value,['root','sha','tree','launcher_sha256']);assert.ok(typeof value.root==='string'&&resolve(value.root)===value.root,'CORE17_ADMISSION_ROOT');for(const [key,n]of [['sha',40],['tree',40],['launcher_sha256',64]])assert.match(value[key]??'',new RegExp('^[a-f0-9]{'+n+'}$'),'CORE17_ADMISSION_EXACT_PIN');}
/** Pure comparison, not a public allow/verifier port or a settlement receipt. */
export function validateCore17ConsumerAdmissionV1(record,observed){
 fields(record,['contract','source_base','installed_Core_base','origin','transport','consumer']);
 assert.equal(record.contract,CORE17_CONSUMER_ABI_V1);assert.equal(record.source_base,CORE17_CONSUMER_BASE);
 assert.equal(record.installed_Core_base,CORE17_INSTALLED_BASE,'CORE17_INSTALLED_RELABEL_FORBIDDEN');
 assert.equal(record.origin,'http://localhost:3008');
 fields(record.transport,['abi','binding_sha256','relay_seal_sha256','app']);
 assert.equal(record.transport.abi,CORE17_RELAY_ABI_V2);assert.match(record.transport.binding_sha256??'',/^[a-f0-9]{64}$/);
 assert.equal(record.transport.relay_seal_sha256,CORE17_RELAY_SEAL_V2);
 app(record.transport.app);app(record.consumer);
 assert.equal(record.transport.app.sha,CORE17_CONSUMER_BASE,'CORE17_TRANSPORT_APP_PIN');
 assert.equal(record.transport.app.tree,transportTree);assert.equal(record.transport.app.launcher_sha256,transportLauncher);
 assert.notEqual(record.consumer.root,record.transport.app.root,'CORE17_TRANSPORT_ROOT_MUST_STAY_IMMUTABLE');
 assert.equal(observed.app_root,record.consumer.root);assert.equal(observed.binding_sha256,record.transport.binding_sha256,'CORE17_RELAY_BINDING_MISMATCH');
 assert.deepEqual(observed.transport,record.transport.app,'CORE17_TRANSPORT_IDENTITY_DRIFT');
 assert.deepEqual(observed.consumer,record.consumer,'CORE17_CONSUMER_IDENTITY_DRIFT');
 assert.equal(observed.consumer_descends_from_source_base,true,'CORE17_CONSUMER_LINEAGE');
 assert.equal(observed.sources_clean,true,'CORE17_CONSUMER_SOURCE_DRIFT');
 assert.equal(observed.protected_sources_match,true,'CORE17_INSTALL_OR_AUTHORITY_SOURCE_DRIFT');
 return true;
}
export function core17ConsumerSelectionV1(env){
 const values=[env.CLADORA_CORE17_CONSUMER_PROFILE,env.CLADORA_CORE17_CONSUMER_ADMISSION_FILE,env.CLADORA_CORE17_CONSUMER_ADMISSION_SHA256];
 if(values.every(x=>x===undefined))return null;
 assert.equal(values[0],CORE17_CONSUMER_ABI_V1,'CORE17_CONSUMER_PROFILE_REQUIRED');
 assert.ok(typeof values[1]==='string'&&resolve(values[1])===values[1],'CORE17_CONSUMER_ADMISSION_FILE_REQUIRED');
 assert.match(values[2]??'',/^[a-f0-9]{64}$/,'CORE17_CONSUMER_ADMISSION_DIGEST_REQUIRED');
 assert.ok(core17RelaySelectionV2(env),'CORE17_CONSUMER_REQUIRES_EXPLICIT_V2_TRANSPORT');
 return {path:values[1],digest:values[2]};
}
export function readCore17ConsumerAdmissionV1(path,expected){
 assert.equal(realpathSync(path),path,'CORE17_ADMISSION_FILE_ALIAS');
 const parent=dirname(path),directory=lstatSync(parent);
 assert.equal(realpathSync(parent),parent);assert.ok(directory.isDirectory()&&!directory.isSymbolicLink()&&directory.uid===process.getuid()&&(directory.mode&0o077)===0,'CORE17_ADMISSION_DIRECTORY_CUSTODY');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const s=fstatSync(fd);assert.ok(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o077)===0&&s.size>0&&s.size<=16384,'CORE17_ADMISSION_FILE_CUSTODY');
  const buffer=Buffer.alloc(s.size+1),count=readSync(fd,buffer,0,buffer.length,0),raw=buffer.subarray(0,count),after=fstatSync(fd);
  assert.equal(lstatSync(path).ino,s.ino,'CORE17_ADMISSION_FILE_REPLACED');
  assert.equal(raw.length,s.size);assert.equal(after.ino,s.ino);assert.equal(after.mtimeMs,s.mtimeMs);assert.equal(after.size,s.size);assert.equal(realpathSync(path),path);
  assert.equal(sha(raw),expected,'CORE17_ADMISSION_DIGEST_MISMATCH');return JSON.parse(raw.toString('utf8'));
 }finally{closeSync(fd);}
}
function observeApp(root,execute,env){
 assert.equal(realpathSync(root),root,'CORE17_APP_ROOT_ALIAS');
 const git=args=>execute('git',args,{cwd:root,env,encoding:'utf8',stdio:'pipe',timeout:10000,maxBuffer:2097152});
 const head=git(['rev-parse','HEAD']).trim(),tree=git(['rev-parse','HEAD^{tree}']).trim();
 git(['diff','--quiet','HEAD','--']);
 assert.equal(git(['ls-files','--others','--exclude-standard','-z']),'','CORE17_UNREVIEWED_APP_FILES');
 for(const n of ['.env','.env.local','.env.production','.env.production.local'])assert.equal(existsSync(join(root,n)),false,'CORE17_UNREVIEWED_DOTENV');
 const launchPath=join(root,launcher);assert.equal(realpathSync(launchPath),launchPath);
 return {identity:{root,sha:head,tree,launcher_sha256:sha(readFileSync(launchPath))},git};
}
export function core17ConsumerAdoptionPreflightV1(appRoot,environment,execute=execFileSync){
 const selection=core17ConsumerSelectionV1(environment);
 if(selection===null)return core17RelayPreflightV2(appRoot,environment,execute); // Historical ABI untouched.
 const root=resolve(appRoot);
 const record=readCore17ConsumerAdmissionV1(selection.path,selection.digest);
 // Validate schema/fixed pins before touching an operator-selected source root.
 const provisional={app_root:root,binding_sha256:environment.CLADORA_CORE17_TRANSPORT_BINDING_SHA256,transport:record.transport?.app,consumer:record.consumer,consumer_descends_from_source_base:true,sources_clean:true,protected_sources_match:true};
 validateCore17ConsumerAdmissionV1(record,provisional);
 const env=coreServiceAssemblyChildEnvironmentV1(environment,'start');
 const current=observeApp(root,execute,env),anchor=observeApp(record.transport.app.root,execute,env);
 current.git(['merge-base','--is-ancestor',CORE17_CONSUMER_BASE,current.identity.sha]);
 for(const path of CORE17_CONSUMER_PROTECTED_SOURCES){
  const installed=current.git(['show',CORE17_INSTALLED_BASE+':'+path]);
  assert.equal(sha(readFileSync(join(root,path))),sha(installed),'CORE17_INSTALL_OR_AUTHORITY_SOURCE_DRIFT '+path);
 }
 validateCore17ConsumerAdmissionV1(record,{...provisional,consumer:current.identity,transport:anchor.identity});
 // The original reviewed Python preflight executes at its ORIGINAL app root.
 // It still checks the actual relay PID/start ticks/argv, binding and backend.
 // No rewrite, relay restart, activation, continuation, SQL or public grant.
 assert.equal(core17RelayPreflightV2(record.transport.app.root,environment,execute),true,'CORE17_ORIGINAL_TRANSPORT_NOT_READY');
 // Recheck local source identities after the transport await as well.
 const final=observeApp(root,execute,env),finalAnchor=observeApp(record.transport.app.root,execute,env);
 validateCore17ConsumerAdmissionV1(record,{...provisional,consumer:final.identity,transport:finalAnchor.identity});
 return true;
}
