/** Actual admission/launcher closure, controlled git/Python transport. No native
 * relay process, SQL, Auth, restart or successful continuation is executed. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,chmodSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CORE17_CONSUMER_ABI_V1,CORE17_CONSUMER_BASE,CORE17_INSTALLED_BASE,CORE17_CONSUMER_PROTECTED_SOURCES,
 validateCore17ConsumerAdmissionV1,core17ConsumerSelectionV1,readCore17ConsumerAdmissionV1,core17ConsumerAdoptionPreflightV1} from './lib/core17-exact-consumer-admission-v1.mjs';
import {CORE17_RELAY_ABI_V2,CORE17_RELAY_SEAL_V2} from './lib/core-service-relay-cors-v2-preflight.mjs';
import {coreServiceAssemblyChildEnvironmentV1} from './lib/core-service-assembly-environment-v1.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const temporary=mkdtempSync(join(tmpdir(),'core17-consumer-')),consumer=join(temporary,'consumer'),transport=join(temporary,'transport'),directory=join(temporary,'admissions');
for(const d of [consumer,transport,directory])mkdirSync(d,{mode:0o700});
const launch='scripts/run-core-service-app-assembly-17.mjs';
function copy(root,path,bytes=readFileSync(path)){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),bytes);}
copy(consumer,launch);
copy(transport,launch,execFileSync('git',['show',CORE17_CONSUMER_BASE+':'+launch]));
for(const path of CORE17_CONSUMER_PROTECTED_SOURCES)copy(consumer,path);
const seal=JSON.parse(readFileSync('scripts/functional-dev-relay-cors-v2/source-seal.json'));
for(const n of [...Object.keys(seal.files),'source-seal.json'])copy(transport,'scripts/functional-dev-relay-cors-v2/'+n);
const p=JSON.parse(readFileSync('scripts/functional-dev-relay-cors-v2/profile.json'));
for(const n of Object.keys(p.legacy_files))copy(transport,'scripts/functional-dev-stack-v1/'+n);
for(const path of Object.keys(p.environment_filter_files))copy(transport,path);
const record={contract:CORE17_CONSUMER_ABI_V1,source_base:CORE17_CONSUMER_BASE,installed_Core_base:CORE17_INSTALLED_BASE,origin:'http://localhost:3008',transport:{abi:CORE17_RELAY_ABI_V2,binding_sha256:'a'.repeat(64),relay_seal_sha256:CORE17_RELAY_SEAL_V2,app:{root:transport,sha:CORE17_CONSUMER_BASE,tree:'534ec94f21699a65686bade5539517dfd818ec1e',launcher_sha256:sha(readFileSync(join(transport,launch)))}},consumer:{root:consumer,sha:'b'.repeat(40),tree:'c'.repeat(40),launcher_sha256:sha(readFileSync(launch))}};
const facts={app_root:consumer,binding_sha256:record.transport.binding_sha256,transport:record.transport.app,consumer:record.consumer,consumer_descends_from_source_base:true,sources_clean:true,protected_sources_match:true};
let n=0;function check(name,fn){fn();n++;console.log('PASS '+n+' '+name);}
const path=join(directory,'exact-consumer.json');
function materialize(value=record){const raw=Buffer.from(JSON.stringify(value)+'\n');writeFileSync(path,raw,{mode:0o600});chmodSync(path,0o600);return{CLADORA_CORE17_CONSUMER_PROFILE:CORE17_CONSUMER_ABI_V1,CLADORA_CORE17_CONSUMER_ADMISSION_FILE:path,CLADORA_CORE17_CONSUMER_ADMISSION_SHA256:sha(raw),CLADORA_CORE17_TRANSPORT_PROFILE:CORE17_RELAY_ABI_V2,CLADORA_CORE17_TRANSPORT_BINDING_SHA256:record.transport.binding_sha256};}
function executor(hook=()=>{}){const calls=[];const run=(cmd,args,options)=>{calls.push({cmd,args,options});const injected=hook(cmd,args,options);if(injected!==undefined)return injected;
 if(cmd==='git'){
  if(args[0]==='show')return execFileSync('git',args,{encoding:'utf8'});
  if(args[0]==='rev-parse')return (options.cwd===consumer?record.consumer:record.transport.app)[args[1]==='HEAD'?'sha':'tree']+'\n';
  if(['diff','ls-files','merge-base'].includes(args[0]))return '';
  assert.fail('unexpected git command');
 }
 assert.equal(cmd,'python3');assert.deepEqual(args.slice(0,3),['-I','-B','-c']);
 assert.equal(args[4],transport);assert.equal(args[5],record.transport.binding_sha256);
 assert.match(args[3],/module\.preflight\(expected\)/);assert.match(args[3],/LAUNCHER_APP_ROOT_MISMATCH/);
 return JSON.stringify({contract:CORE17_RELAY_ABI_V2,ready:true,binding_sha256:record.transport.binding_sha256});
 };return{calls,run};}
try{
 check('exact consumer match is source compatibility, with installed identity fixed',()=>assert.equal(validateCore17ConsumerAdmissionV1(record,facts),true));
 for(const [name,edit]of [
  ['missing consumer sha',x=>{delete x.consumer.sha;}],['arbitrary consumer HEAD',x=>{x.consumer.sha='d'.repeat(40);}],
  ['different tree',x=>{x.consumer.tree='e'.repeat(40);}],['different launcher',x=>{x.consumer.launcher_sha256='f'.repeat(64);}],
  ['different root',x=>{x.consumer.root='/unadmitted/root';}],['same root as immutable relay',x=>{x.consumer.root=transport;}],
  ['relabeled installed Core',x=>{x.installed_Core_base=CORE17_CONSUMER_BASE;}],['different source base',x=>{x.source_base='d'.repeat(40);}],
  ['different binding',x=>{x.transport.binding_sha256='d'.repeat(64);}],['different transport app',x=>{x.transport.app.sha='d'.repeat(40);}],
  ['different transport tree',x=>{x.transport.app.tree='e'.repeat(40);}],['different transport launcher',x=>{x.transport.app.launcher_sha256='f'.repeat(64);}],
  ['unreviewed relay seal',x=>{x.transport.relay_seal_sha256='f'.repeat(64);}],['extra approval boolean',x=>{x.approved=true;}],
  ['foreign origin',x=>{x.origin='https://example.com';}],
 ])check('reject '+name,()=>{const r=structuredClone(record);edit(r);assert.throws(()=>validateCore17ConsumerAdmissionV1(r,facts));});
 for(const key of ['consumer_descends_from_source_base','sources_clean','protected_sources_match'])check('reject false '+key,()=>assert.throws(()=>validateCore17ConsumerAdmissionV1(record,{...facts,[key]:false})));
 check('absent admission preserves historical no-v2-selector lane without execution',()=>{const e=executor();assert.equal(core17ConsumerAdoptionPreflightV1('/unused',{},e.run),false);assert.equal(e.calls.length,0);});
 for(const change of [{CLADORA_CORE17_CONSUMER_PROFILE:undefined},{CLADORA_CORE17_CONSUMER_ADMISSION_SHA256:undefined},{CLADORA_CORE17_CONSUMER_ADMISSION_FILE:undefined},{CLADORA_CORE17_TRANSPORT_PROFILE:undefined},{VERCEL:'1'}])check('partial/deployed admission rejected before execution '+Object.keys(change)[0],()=>{const e=executor();assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,{...materialize(),...change},e.run));assert.equal(e.calls.length,0);});
 check('full wrapper checks original relay at anchor, then rechecks exact new source',()=>{const env={...materialize(),HTTPS_PROXY:'synthetic-proxy',NODE_EXTRA_CA_CERTS:'/synthetic/ca',NODE_OPTIONS:'--require=/synthetic/guard',CLADORA_STAGING_DATABASE_URL:'synthetic-secret'};const e=executor();assert.equal(core17ConsumerAdoptionPreflightV1(consumer+'/',env,e.run),true);const py=e.calls.filter(c=>c.cmd==='python3');assert.equal(py.length,1);assert.equal(py[0].args[4],transport);for(const k of ['HTTPS_PROXY','NODE_EXTRA_CA_CERTS','NODE_OPTIONS'])assert.equal(py[0].options.env[k],env[k]);assert.equal(py[0].options.env.CLADORA_STAGING_DATABASE_URL,undefined);assert.ok(e.calls.filter(c=>c.cmd==='git'&&c.args[0]==='rev-parse').length>=8);});
 check('admission selectors never enter application child environment',()=>{for(const phase of ['build','start']){const env=coreServiceAssemblyChildEnvironmentV1(materialize(),phase);for(const k of Object.keys(materialize()))assert.equal(Object.hasOwn(env,k),false);}});
 check('wrong admission digest fails before any process call',()=>{const e=executor();assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,{...materialize(),CLADORA_CORE17_CONSUMER_ADMISSION_SHA256:'0'.repeat(64)},e.run));assert.equal(e.calls.length,0);});
 check('original relay failure propagates once, no activation or legacy fallback',()=>{const failure=Object.assign(Error('controlled original preflight'),{code:'CONTROLLED'}),e=executor(cmd=>{if(cmd==='python3')throw failure;});assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,materialize(),e.run),e=>e===failure);assert.equal(e.calls.filter(c=>c.cmd==='python3').length,1);});
 for(const [name,hook]of [
  ['dirty successor',(cmd,args)=>{if(cmd==='git'&&args[0]==='diff')throw Error('dirty');}],
  ['untracked file',(cmd,args)=>cmd==='git'&&args[0]==='ls-files'?'unreviewed.mjs\0':undefined],
  ['non-descendant',(cmd,args)=>{if(cmd==='git'&&args[0]==='merge-base')throw Error('unrelated');}],
  ['different observed HEAD',(cmd,args,opts)=>cmd==='git'&&opts.cwd===consumer&&args[0]==='rev-parse'&&args[1]==='HEAD'?'d'.repeat(40):undefined],
 ])check(name+' stops before relay check',()=>{const e=executor(hook);assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,materialize(),e.run));assert.equal(e.calls.filter(c=>c.cmd==='python3').length,0);});
 check('source drift after transport wait cannot become success',()=>{let after=false;const e=executor((cmd,args,opts)=>{if(cmd==='python3')after=true;if(after&&cmd==='git'&&opts.cwd===consumer&&args[0]==='rev-parse'&&args[1]==='HEAD')return'd'.repeat(40);});assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,materialize(),e.run));});
 for(const kind of ['removed','bytes','permission','symlink','hardlink'])check('admission '+kind+' during transport wait stops readiness without fallback',()=>{
  const env=materialize(),alias=join(directory,'wait-replacement.json');
  const e=executor(cmd=>{if(cmd==='python3'){
   if(kind==='removed')rmSync(path);
   if(kind==='bytes')writeFileSync(path,JSON.stringify({...record,origin:'http://unadmitted.local'})+'\n');
   if(kind==='permission')chmodSync(path,0o644);
   if(kind==='symlink'){copyFileSync(path,alias);rmSync(path);symlinkSync(alias,path);}
   if(kind==='hardlink')linkSync(path,alias);
  }});
  try{assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,env,e.run));assert.equal(e.calls.filter(c=>c.cmd==='python3').length,1);}
  finally{rmSync(path,{force:true});rmSync(alias,{force:true});materialize();}
 });
 check('final admission check follows all final source checks',()=>{
  const env=materialize();let after=false;
  const e=executor((cmd,args,options)=>{if(cmd==='python3')after=true;if(after&&cmd==='git'&&options.cwd===transport&&args[0]==='ls-files')rmSync(path);});
  try{assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,env,e.run));assert.equal(e.calls.filter(c=>c.cmd==='python3').length,1);}
  finally{materialize();}
 });
 check('protected authority/source drift stops before relay dispatch',()=>{const p=join(consumer,CORE17_CONSUMER_PROTECTED_SOURCES[2]),old=readFileSync(p);writeFileSync(p,'synthetic wrong source');try{const e=executor();assert.throws(()=>core17ConsumerAdoptionPreflightV1(consumer,materialize(),e.run));assert.equal(e.calls.filter(c=>c.cmd==='python3').length,0);}finally{writeFileSync(p,old);}});
 check('custody requires private file mode',()=>{const env=materialize();chmodSync(path,0o644);assert.throws(()=>readCore17ConsumerAdmissionV1(path,env.CLADORA_CORE17_CONSUMER_ADMISSION_SHA256));});
 for(const kind of ['symlink','hardlink'])check('reject admission '+kind,()=>{const env=materialize(),alias=join(directory,kind+'.json');if(kind==='symlink')symlinkSync(path,alias);else linkSync(path,alias);try{assert.throws(()=>readCore17ConsumerAdmissionV1(alias,env.CLADORA_CORE17_CONSUMER_ADMISSION_SHA256));}finally{rmSync(alias);}});
 const actualLauncher=readFileSync(launch,'utf8');
 check('actual official launcher routes both phases through admission preflight',()=>{assert.match(actualLauncher,/\['build','start'\]/);assert.match(actualLauncher,/if\(!core17ConsumerAdoptionPreflightV1\(/);assert.ok(actualLauncher.indexOf('core17ConsumerAdoptionPreflightV1(fileURLToPath')<actualLauncher.indexOf('const child=spawn'));assert.equal(core17ConsumerSelectionV1({}),null);});
}finally{rmSync(temporary,{recursive:true});}
console.log(JSON.stringify({task:'Core17/post-auth-consumer-adoption',checks:n,native:'NOT_RUN_NOT_PASS',activation:'NOT_RUN',SQL_Auth_calls:0}));
