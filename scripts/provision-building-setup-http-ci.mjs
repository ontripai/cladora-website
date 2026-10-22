import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile, readdir, lstat, realpath, mkdtemp, open, unlink, rmdir, statfs} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve, relative, join, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {AsyncLocalStorage} from 'node:async_hooks';

export const CONTRACT=Object.freeze({
  repository:'ontripai/cladora-website', origin:'https://github.com/ontripai/cladora-website.git',
  ref:'refs/heads/codex/core-building-setup-connected-http', branch:'codex/core-building-setup-connected-http',
  task:'CORE-BUILDING-SETUP-CONNECTED-HTTP-01', worker:'CLADORA-CORE-WORKER-01',
  provisioner:'CLADORA-PLATFORM-WORKER-01', lane:'building-setup-core-http',
  parent:'87ddb06877fb31f562ba66477d14f7bc453a17ee', coreCorrection:'37115e2a77f4c7e24f2de884cc808706f361dcdb',
  jobTimeoutMs:45*60000,
});
// Reviewed POLICY only: no candidate SHA may be embedded in this source profile.
// No timing/capacity/target/reviewer profile or run grant has been assigned.
// Environment flags/files cannot grant execution. The workflow job is also off.
export const REVIEWED_EXECUTION_PLAN=null;
const hex40=/^[a-f0-9]{40}$/, id64=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const leaseFields=['version','task','worker','sha','run_id','lease_id','expires_at','project_ref','app_origin','api_origin','db_port','db_container_id','auth_container_id','fixture_prefix'];
function need(value,code){if(!value)throw new BindingError(code);}
export class BindingError extends Error{
  constructor(code){super('BUILDING_HTTP_'+code);this.code=code;}
}
function fixedFailure(stage){return {stage,result:'FAIL'};}
const within=(root,path)=>relative(root,path)===''||(!relative(root,path).startsWith('..')&&!isAbsolute(relative(root,path)));
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));

export function policyDigest(policy){
  need(policy&&typeof policy==='object'&&!Object.hasOwn(policy,'sha')
    &&typeof policy.id==='string'&&policy.id.length>0,'POLICY_IDENTITY');
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return createHash('sha256').update(JSON.stringify(canonical(policy))).digest('hex');
}

export function validateGrant(plan,ctx,external,now=Date.now()){
  need(plan!==null,'UNGRANTED');
  const digest=policyDigest(plan);
  need(plan.ref===CONTRACT.ref&&plan.repository===CONTRACT.repository,'PLAN_SOURCE');
  need(plan.task===CONTRACT.task&&plan.worker===CONTRACT.worker&&plan.provisioner===CONTRACT.provisioner&&plan.lane===CONTRACT.lane,'PLAN_IDENTITY');
  need(Number.isSafeInteger(plan.environmentId)&&plan.environmentId>0&&Number.isSafeInteger(plan.reviewerId)&&plan.reviewerId>0,'EXTERNAL_REVIEW_REQUIRED');
  need(ctx.actions===true&&ctx.event==='push'&&ctx.job===CONTRACT.lane&&ctx.repository===plan.repository
    &&ctx.ref===plan.ref&&hex40.test(ctx.sha)&&ctx.selectedSha===ctx.sha,'RUN_SOURCE');
  need(/^[1-9][0-9]*$/.test(ctx.runId)&&/^[1-9][0-9]*$/.test(ctx.attempt),'RUN_ID');
  need(external?.run?.id===ctx.runId&&external.run.attempt===ctx.attempt&&external.run.sha===ctx.sha&&external.run.branch===CONTRACT.branch
    &&external.run.event==='push'&&external.run.repository===CONTRACT.repository
    &&external.run.workflowPath==='.github/workflows/database-tests.yml','EXTERNAL_RUN');
  need(external.review?.state==='approved'&&external.review.reviewerId===plan.reviewerId&&external.review.environmentId===plan.environmentId,'EXTERNAL_APPROVAL');
  const grant=external.review.binding;
  const keys=['version','run_id','attempt','sha','ref','lane','task','worker','provisioner','plan_id','policy_sha256','expires_at','network'];
  need(exactKeys(grant,keys)&&grant.version===2,'GRANT_SHAPE');
  need(grant.run_id===ctx.runId&&grant.attempt===ctx.attempt&&grant.sha===ctx.sha&&grant.ref===plan.ref&&grant.plan_id===plan.id,'STALE_GRANT');
  need(grant.policy_sha256===digest,'POLICY_BINDING');
  need(grant.lane===plan.lane&&grant.task===plan.task&&grant.worker===plan.worker&&grant.provisioner===plan.provisioner,'GRANT_IDENTITY');
  // Current enforcement must be externally observed for THIS runner/run, not
  // inferred from a local startup-policy file or a workflow env flag.
  need(exactKeys(grant.network,['environment_id','revision','state','current','run_id','attempt','snapshot_sha256'])
    &&typeof grant.network.environment_id==='string'&&grant.network.environment_id.length>0
    &&typeof grant.network.revision==='string'&&grant.network.revision.length>0
    &&grant.network.state==='enforced'&&grant.network.current===true&&grant.network.run_id===ctx.runId
    &&grant.network.attempt===ctx.attempt&&/^[a-f0-9]{64}$/.test(grant.network.snapshot_sha256),'NETWORK_ATTESTATION');
  const expiry=Date.parse(grant.expires_at);
  need(Number.isFinite(expiry)&&expiry>now&&expiry-now<=4*3600_000,'GRANT_EXPIRED');
  need(Number.isInteger(plan.appPort)&&plan.appPort>=1024&&plan.appPort<=65535&&!plan.stackPorts.includes(plan.appPort),'APP_PORT');
  need(plan.stackPorts.includes(54321)&&plan.stackPorts.includes(54322)&&plan.stagedOperator===true,'STACK_PLAN');
  need(Array.isArray(plan.services)&&plan.services.length>=3&&plan.services.length<=32
    &&new Set(plan.services.map(service=>service.name)).size===plan.services.length
    &&plan.services.every(service=>/^\/supabase_[a-z0-9_]+_cladora-local$/.test(service.name)
      &&/^(?:public\.ecr\.aws\/supabase\/|supabase\/)[a-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(service.image)
      &&!service.image.endsWith(':latest')&&typeof service.healthRequired==='boolean')
    &&['db','auth','kong'].every(kind=>plan.services.some(service=>service.name==='/supabase_'+kind+'_cladora-local'
      &&service.healthRequired===true)),'SERVICE_PLAN');
  validateTiming(plan.timing,external.run.jobStartedAt,now,expiry);
  return {sha:external.run.sha,expiresAt:grant.expires_at,jobStartedAt:external.run.jobStartedAt};
}

export function validateTiming(timing,jobStartedAt,now,expiry){
  need(exactKeys(timing,['jobTimeoutMs','acquisitionMs','cleanupMs','reportingMs','settleMs'])
    &&Object.values(timing).every(value=>Number.isSafeInteger(value)&&value>0)
    &&timing.jobTimeoutMs===CONTRACT.jobTimeoutMs
    &&timing.settleMs<Math.min(timing.acquisitionMs,timing.cleanupMs,timing.reportingMs),'TIMING_PROFILE');
  const started=Date.parse(jobStartedAt),total=timing.acquisitionMs+timing.cleanupMs+timing.reportingMs;
  need(Number.isFinite(started)&&started<=now&&total<timing.jobTimeoutMs
    &&now+total<started+timing.jobTimeoutMs&&now+total<expiry,'TIMING_BUDGET');
  return Math.min(started+timing.jobTimeoutMs,expiry);
}

export function validatePreflight(plan,observed,sha){
  need(hex40.test(sha)&&observed.branch===CONTRACT.branch&&observed.head===sha&&observed.fullAncestry===true&&observed.coreCorrection===true,'CHECKOUT_BINDING');
  need(observed.origin===CONTRACT.origin&&observed.clean===true&&observed.noDotenv===true,'DIRTY_SOURCE');
  need(observed.nodeMajor===22&&observed.cliVersion==='2.84.2','PINNED_TOOLS');
  need(observed.daemon==='unix:///var/run/docker.sock'&&observed.healthy===true&&observed.noOverrides===true,'DAEMON');
  need(observed.containers===0&&observed.volumes===0&&observed.images===0&&observed.cache===0,'FOREIGN_TARGET');
  need(observed.freePorts===true,'PORT_BUSY');
  need(observed.networkEnforced===true&&observed.registryPolicy===true,'NETWORK_POLICY_UNKNOWN');
  const cap=plan.capacity;
  need(cap&&cap.driver===observed.driver&&cap.basis==='reviewed-full-stack-peak-with-driver-amplification'
    &&Number.isSafeInteger(cap.requiredBytes)&&cap.requiredBytes>0
    &&Number.isSafeInteger(cap.requiredInodes)&&cap.requiredInodes>0
    &&Number.isSafeInteger(cap.requiredMemoryBytes)&&cap.requiredMemoryBytes>0
    &&Number.isFinite(cap.requiredCpus)&&cap.requiredCpus>0
    &&Number.isSafeInteger(cap.hostQuotaAvailableBytes)&&cap.hostQuotaAvailableBytes>0,'CAPACITY_UNKNOWN');
  need(Number.isSafeInteger(observed.availableBytes)&&observed.availableBytes>=cap.requiredBytes
    &&observed.availableInodes>=cap.requiredInodes&&cap.hostQuotaAvailableBytes>=cap.requiredBytes
    &&observed.memoryBytes>=cap.requiredMemoryBytes&&observed.cpus>=cap.requiredCpus,'CAPACITY_INSUFFICIENT');
}

export function validateTarget(plan,target){
  need(target.project==='cladora-local'&&target.apiOrigin==='http://127.0.0.1:54321'&&target.dbPort===54322&&target.dbName==='postgres','TARGET');
  need(id64.test(target.dbId)&&id64.test(target.authId)&&target.dbId!==target.authId,'CONTAINER_ID');
  need(target.running===true&&target.fullStackHealthy===true&&target.sameStack===true,'STACK_IDENTITY');
  need(target.dbImage==='public.ecr.aws/supabase/postgres:17.6.1.095'||target.dbImage==='supabase/postgres:17.6.1.095','DB_IMAGE');
  need(typeof plan.authImage==='string'&&/^(public\.ecr\.aws\/supabase\/|supabase\/)gotrue:v[0-9.]+$/.test(plan.authImage)&&target.authImage===plan.authImage,'AUTH_IMAGE');
  need(target.projectLabels===true&&target.exactPorts===true&&target.noForeignResources===true,'TARGET_OWNERSHIP');
}

// Raw private status/container configuration stays in memory. These concrete
// observations, rather than caller-provided PASS flags, derive live identity.
export function targetObservations(plan,{objects,networkIds,status,authDbUrl,authRouteUrls}){
  const url=new URL(status.DB_URL);
  let authDb;try{authDb=new URL(authDbUrl);}catch{throw new BindingError('AUTH_DB');}
  // CLI v2.84.2 internal/start/start.go emits a PostgreSQL URL with no
  // parameters. Accept no query/fragment (including empty delimiters): pgx
  // connection options can override the authority/database being attested.
  // Keep the original configuration private; never strip options to validate
  // a different connection string or include its credentials in an error.
  need(['postgres:','postgresql:'].includes(authDb.protocol)
    &&!authDb.href.includes('?')&&!authDb.href.includes('#'),'AUTH_DB');
  need(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&url.port==='54322'
    &&url.pathname==='/postgres'&&url.username==='postgres'&&!url.search&&!url.hash,'STATUS_DB');
  const db=objects.find(x=>x.name==='/supabase_db_cladora-local'),auth=objects.find(x=>x.name==='/supabase_auth_cladora-local');
  const gateway=objects.find(x=>x.name==='/supabase_kong_cladora-local');
  const expected=objects.length===plan.services.length&&objects.every(x=>plan.services.some(service=>service.name===x.name&&service.image===x.image
    &&(service.healthRequired===false||x.health?.Status==='healthy')&&!['unhealthy','starting'].includes(x.health?.Status)));
  const ports=objects.every(x=>Object.values(x.ports??{}).every(bindings=>bindings===null||bindings.every(binding=>
    plan.stackPorts.includes(Number(binding.HostPort))&&['127.0.0.1','0.0.0.0','::','::1'].includes(binding.HostIp))));
  const labels=objects.every(x=>x.labels?.['com.supabase.cli.project']==='cladora-local');
  const authRoutes=Array.isArray(authRouteUrls)&&authRouteUrls.length>0&&authRouteUrls.every(value=>{
    const endpoint=new URL(value);return endpoint.protocol==='http:'&&endpoint.hostname==='supabase_auth_cladora-local'
      &&endpoint.port==='9999'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash;
  });
  return {project:'cladora-local',apiOrigin:status.API_URL,dbPort:Number(url.port),dbName:url.pathname.slice(1),
    dbId:db?.id,authId:auth?.id,dbImage:db?.image,authImage:auth?.image,
    running:objects.length>0&&objects.every(x=>x.running),fullStackHealthy:expected,
    sameStack:objects.every(x=>networkIds.includes(x.id))&&networkIds.every(id=>objects.some(x=>x.id===id))&&!!gateway
      &&authRoutes&&authDb.hostname==='supabase_db_cladora-local'&&authDb.port==='5432'&&authDb.pathname==='/postgres',
    projectLabels:labels,noForeignResources:labels&&objects.every(x=>plan.services.some(service=>service.name===x.name)),
    exactPorts:ports&&db?.ports?.['5432/tcp']?.some(p=>p.HostPort==='54322'&&['127.0.0.1','0.0.0.0'].includes(p.HostIp))===true
      &&gateway?.ports?.['8000/tcp']?.some(p=>p.HostPort==='54321'&&['127.0.0.1','0.0.0.0'].includes(p.HostIp))===true};
}

// Aligned with Core nextEnvironment's explicit network/trust selectors.
// Never inherit ambient credentials, app settings, TLS-disable or tool overrides.
export function coreEnvironment(ambient,leasePath){
  const env={};
  for(const key of ['PATH','HOME','USER','TMPDIR','TMP','TEMP','LANG','LC_ALL','RUNNER_TEMP',
    'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy',
    'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE',
    'CODEX_PROXY_CERT','CODEX_NETWORK_POLICY','CODEX_NETWORK_POLICY_PATH']){
    if(ambient[key]!==undefined)env[key]=ambient[key];
  }
  return {...env,BUILDING_SETUP_HTTP_EPHEMERAL:'1',BUILDING_SETUP_HTTP_LEASE_FILE:leasePath};
}

export function buildLease(plan,target,expiry,sha,{runId=randomUUID(),prefix=randomBytes(4).toString('hex')}={}){
  need(hex40.test(sha)&&uuid.test(runId)&&/^[a-f0-9]{8}$/.test(prefix)&&prefix!=='c2200000','NAMESPACE');
  return {version:1,task:CONTRACT.task,worker:CONTRACT.worker,sha,run_id:runId,
    lease_id:'building-http-'+runId+'-'+sha,expires_at:expiry,project_ref:'cladora-local',
    app_origin:'http://127.0.0.1:'+plan.appPort,api_origin:'http://127.0.0.1:54321',db_port:54322,
    db_container_id:target.dbId,auth_container_id:target.authId,fixture_prefix:prefix};
}
export function validatePrivateFile(meta,{root,checkout,uid}){
  need(isAbsolute(meta.path)&&within(root,meta.path)&&!within(checkout,meta.path)
    &&meta.regular===true&&meta.symlink===false&&meta.uid===uid&&(meta.mode&0o777)===0o600
    &&meta.size>0&&meta.size<=8192,'PRIVATE_FILE');
}
export function coreReceipt(raw,sha){
  need(typeof raw==='string'&&Buffer.byteLength(raw)<=4096,'CORE_OUTPUT');
  let record;try{record=JSON.parse(raw);}catch{throw new BindingError('CORE_OUTPUT');}
  need(record.task===CONTRACT.task&&record.sha===sha&&['PASS','FAIL'].includes(record.result),'CORE_RECEIPT');
  const clean=['LOGICAL_AUTHORITY_SESSION_AND_OWNED_PROCESS_CLEANED','NOT_REQUIRED_NO_RESOURCES_ACQUIRED'];
  need(clean.includes(record.cleanup),'CORE_LOGICAL_CLEANUP');
  // Rebuild a tiny safe receipt: no numeric assertion payloads, arbitrary JSON,
  // SDK/CLI/SQL output or user data can reach provisioner logs.
  return {result:record.result,logicalCleanup:true,
    connected:record.connected==='PASS'&&record.transport==='REAL_NEXT_AUTH_AAL2_RPC_POSTGRES'};
}

const systemClock={now:()=>Date.now(),setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id)};
// The deadline includes settling time. Abort only owned/cooperative work;
// return an explicit unsettled failure rather than await it beyond this budget.
export function boundedCall(operation,{clock=systemClock,deadline,settleMs,signal}){
  return new Promise((yes,no)=>{
    const control=new AbortController();let done=false,interruption=null,soft,hard;
    const failure=(code,settled)=>Object.assign(new BindingError(code),{settled});
    const finish=(error,value)=>{
      if(done)return;done=true;clock.clearTimer(soft);clock.clearTimer(hard);
      signal?.removeEventListener('abort',cancel);if(error)no(error);else yes(value);
    };
    const stop=code=>{
      if(done||interruption)return;interruption=code;control.abort();
      clock.clearTimer(soft);clock.clearTimer(hard);
      hard=clock.setTimer(()=>finish(failure(code,false)),Math.max(0,Math.min(deadline,clock.now()+settleMs)-clock.now()));
    };
    const cancel=()=>stop('CANCELLED');
    if(signal?.aborted||clock.now()>=deadline-settleMs){finish(failure(signal?.aborted?'CANCELLED':'DEADLINE',true));return;}
    soft=clock.setTimer(()=>stop('DEADLINE'),deadline-settleMs-clock.now());
    signal?.addEventListener('abort',cancel,{once:true});
    Promise.resolve().then(()=>{
      need(!control.signal.aborted,'CANCELLED');return operation(control.signal);
    }).then(value=>finish(interruption?failure(interruption,true):clock.now()>=deadline-settleMs?failure('DEADLINE',true):null,value),
      error=>finish(failure(interruption??'OPERATION_FAILED',error?.settled!==false)));
  });
}

export async function provision({plan=REVIEWED_EXECUTION_PLAN,ctx,external,io,signal}){
  let stage='grant',primary=null,lease=null,core=null,externalGrant,acquisition,cleanupWindow,jobDeadline;
  const clock=io.clock??systemClock;
  const cleanup=[],state={registered:false,started:false,leasePath:null,markerAttempted:false,coreStarted:false,coreSettled:true,acquisitionSettled:true};
  const window=(ms,limit)=>({deadline:Math.min(clock.now()+ms,limit),settleMs:plan.timing.settleMs});
  const call=async(name,args,period,externalSignal)=>{
    try{return await boundedCall(async ownedSignal=>{
      const invoke=()=>io[name](...args,ownedSignal);
      return io.withBudget?io.withBudget({...period,signal:ownedSignal},invoke):invoke();
    },{clock,...period,signal:externalSignal});}
    catch(error){if(error.settled===false){state.acquisitionSettled=false;state.coreSettled=false;}throw error;}
  };
  // Fixed teardown registry exists BEFORE any resource acquisition. Every step
  // is attempted; adapter checks exact ownership and never forces foreign work.
  const steps=[
    ['core-settle',async()=>{if(state.coreStarted){state.coreSettled=false;state.coreSettled=await io.settleCore(state);}need(state.coreSettled,'CORE_UNSETTLED');}],
    ['staged-restore',()=>{if(state.started){need(state.coreSettled,'CORE_UNSETTLED');return io.restoreStaged(state);}}],
    ['core-logical-check',()=>{if(state.coreStarted)need(core?.logicalCleanup===true,'CORE_LOGICAL_CLEANUP');}],
    ['process-port-check',()=>state.started?io.verifyPortsClosed(state):undefined],
    ['marker-clear',()=>{if(state.markerAttempted){need(state.coreSettled,'CORE_UNSETTLED');return io.clearMarker(lease,state);}}],
    ['stack-stop',async()=>{if(state.started){need(state.coreSettled,'CORE_UNSETTLED');await io.stopOwned(state);}}],
    ['destruction-check',()=>state.started?io.verifyDestroyed(state):undefined],
    ['lease-remove',()=>state.leasePath?io.removeLease(state):undefined],
  ];
  const live=()=>{need(!signal?.aborted,'CANCELLED');need(clock.now()<acquisition.deadline-plan.timing.settleMs,'DEADLINE');need(Date.parse(externalGrant.expiresAt)>clock.now(),'GRANT_EXPIRED');};
  const acquire=async(name,...args)=>{live();return call(name,args,acquisition,signal);};
  try{
    externalGrant=validateGrant(plan,ctx,external,clock.now());
    jobDeadline=Date.parse(externalGrant.jobStartedAt)+plan.timing.jobTimeoutMs;
    acquisition=window(plan.timing.acquisitionMs,jobDeadline-plan.timing.cleanupMs-plan.timing.reportingMs);
    stage='preflight';validatePreflight(plan,await acquire('preflight',plan,externalGrant.sha),externalGrant.sha);
    live();stage='register';state.registered=true;await acquire('register',state);
    // Start intent is recorded before acquisition to cover partial startup.
    live();stage='startup';state.started=true;await acquire('start',plan,state);
    stage='identity';const target=await acquire('target',plan,state);validateTarget(plan,target);
    stage='lease';lease=buildLease(plan,target,externalGrant.expiresAt,externalGrant.sha,await acquire('namespace'));
    need(exactKeys(lease,leaseFields),'LEASE_SHAPE');
    await acquire('writeLease',lease,state);
    validatePrivateFile(await acquire('leaseMeta',state),await acquire('privateContext'));
    live();stage='marker';state.markerAttempted=true;await acquire('setMarker',lease,state);
    need(await acquire('readFreshMarker',lease,state)===lease.lease_id,'MARKER_READBACK');
    live();stage='core-proof';state.coreStarted=true;state.coreSettled=false;
    const result=await acquire('runCore',state);state.coreSettled=result.settled===true;
    need(state.coreSettled,'CORE_UNSETTLED');core=coreReceipt(result.stdout,externalGrant.sha);
    need(result.exitCode===0&&core.result==='PASS'&&core.connected&&!result.cancelled&&!signal?.aborted,'CORE_FAILED');
  }catch{primary=fixedFailure(stage);}
  finally{
    if(state.registered){
      cleanupWindow=window(plan.timing.cleanupMs,Math.min(jobDeadline,Date.parse(externalGrant.expiresAt))-plan.timing.reportingMs);
      // Each registry entry uses the SAME aggregate tail. Never begin another
      // mutation while prior acquisition/cleanup work remains unsettled.
      for(const [name,run] of steps){
        try{
          need(state.acquisitionSettled,'ACQUISITION_UNSETTLED');
          await boundedCall(async ownedSignal=>{
            const invoke=()=>run();return io.withBudget?io.withBudget({...cleanupWindow,signal:ownedSignal},invoke):invoke();
          },{clock,...cleanupWindow});
        }catch(error){cleanup.push(fixedFailure(name));if(error.settled===false){state.acquisitionSettled=false;state.coreSettled=false;}}
      }
    }
  }
  if(signal?.aborted&&!primary)primary=fixedFailure('cancelled');
  const release=!state.registered?'NOT_ACQUIRED':!primary&&!cleanup.length?'CONFIRMED':!cleanup.length?'CLEANED_AFTER_FAILURE':'UNCONFIRMED';
  const evidence={task:'PLATFORM-BUILDING-SETUP-HTTP-CI-BINDING-03',sha:ctx?.sha??null,
    result:primary||cleanup.length?'FAIL':'PASS',primary,cleanup,release,core,
    runnerLoss:'UNCONFIRMED_IF_PROCESS_OR_RUNNER_IS_LOST'};
  // Final evidence is not an authorization token. Missing final evidence after
  // cancellation/timeout/runner loss can never be interpreted as clean release.
  if(state.registered){
    const report=window(plan.timing.reportingMs,Math.min(jobDeadline,Date.parse(externalGrant.expiresAt)));
    evidence.timing={cleanupCompletedAt:clock.now(),cleanupDeadline:cleanupWindow.deadline,reportDeadline:report.deadline,jobDeadline,grantExpiry:Date.parse(externalGrant.expiresAt)};
    try{await call('release',[evidence,state],report);}catch{evidence.result='FAIL';evidence.release='UNCONFIRMED';evidence.cleanup.push(fixedFailure('release-evidence'));}
  }
  if(signal?.aborted){evidence.result='FAIL';evidence.primary??=fixedFailure('cancelled');if(evidence.release==='CONFIRMED')evidence.release='CLEANED_AFTER_FAILURE';}
  return evidence;
}

// Capture commands in memory only, wait for close, keep cancellation distinct.
// No raw command stdout/stderr/error/cause is ever logged or put in artifacts.
async function capture(command,args,{cwd=process.cwd(),env=process.env,signal,timeout=120000,settleMs=45000}={}){
  return new Promise(resolvePromise=>{
    let stdout='',size=0,overflow=false,cancelled=false,resolved=false;
    const child=spawn(command,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
    let deadline;
    const finish=value=>{if(resolved)return;resolved=true;clearTimeout(timer);clearTimeout(deadline);signal?.removeEventListener('abort',stop);resolvePromise(value);};
    const stop=()=>{if(cancelled)return;cancelled=true;if(child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{ /* No force/foreign termination. */ }}
      deadline=setTimeout(()=>finish({exitCode:null,stdout:'',settled:false,cancelled:true,pid:child.pid}),settleMs);};
    const timer=setTimeout(stop,timeout);
    signal?.addEventListener('abort',stop,{once:true});
    if(signal?.aborted)stop();
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size<=1024*1024)stdout+=chunk.toString();else overflow=true;});
    child.stderr.resume();child.on('error',()=>{});
    child.once('close',code=>finish({exitCode:overflow?null:code,stdout:overflow?'':stdout,settled:true,cancelled,pid:child.pid}));
  });
}
function groupGone(pid){
  if(!Number.isInteger(pid))return true; // Spawn failure acquired no process.
  try{process.kill(-pid,0);return false;}catch(error){return error.code==='ESRCH';}
}
async function portFree(port){
  await new Promise((yes,no)=>{const server=createServer();server.once('error',no);server.listen(port,'127.0.0.1',()=>server.close(yes));});
}
export function commandContext(env){return {actions:env.GITHUB_ACTIONS==='true',event:env.GITHUB_EVENT_NAME,
  job:env.GITHUB_JOB,repository:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,sha:env.GITHUB_SHA,
  selectedSha:env.CLADORA_APPROVED_EXECUTION_SHA,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT};}

// Native observations only; the designated reviewer's JSON binds the policy
// digest and candidate independently, without embedding this commit's own SHA.
export function approvalObservations(plan,ctx,{run,reviews,jobs}){
  need(plan!==null,'UNGRANTED');
  const matches=jobs.filter(job=>job.name===CONTRACT.lane&&String(job.run_id)===ctx.runId&&String(job.run_attempt)===ctx.attempt
    &&job.head_sha===run.head_sha&&job.status==='in_progress');
  need(matches.length===1,'NATIVE_JOB');
  let selected;
  for(const review of reviews){
    if(review.state!=='approved'||review.user?.id!==plan.reviewerId||!review.environments?.some(e=>e.id===plan.environmentId))continue;
    let binding;try{binding=JSON.parse(review.comment);}catch{continue;}
    if(binding.run_id===ctx.runId&&binding.attempt===ctx.attempt&&binding.sha===run.head_sha
      &&binding.plan_id===plan.id&&binding.policy_sha256===policyDigest(plan)){
      need(!selected,'AMBIGUOUS_APPROVAL');selected={state:review.state,reviewerId:review.user.id,environmentId:plan.environmentId,binding};
    }
  }
  need(selected,'EXTERNAL_APPROVAL');
  return {run:{id:String(run.id),attempt:String(run.run_attempt),sha:run.head_sha,branch:run.head_branch,
    repository:run.repository?.full_name,event:run.event,workflowPath:run.path,jobStartedAt:matches[0].started_at},review:selected};
}

// Native GitHub protected-environment review is the external authority. A flag,
// arbitrary JSON file or self-written lease cannot replace this API readback.
// Future policy pins environment/reviewer/profile; candidate comes from the
// native run and review, and must equal the actual checked-out source.
async function externalApproval(plan,ctx){
  need(plan!==null,'UNGRANTED');
  const get=async path=>{
    const response=await fetch('https://api.github.com/repos/'+CONTRACT.repository+'/actions/runs/'+ctx.runId+path,{
      headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN},
      redirect:'error',signal:AbortSignal.timeout(15000)});
    need(response.ok,'APPROVAL_READBACK');return response.json();
  };
  need(/^[1-9][0-9]*$/.test(ctx.runId)&&/^[1-9][0-9]*$/.test(ctx.attempt),'RUN_ID');
  const run=await get(''),reviews=await get('/approvals');
  // Attempt-specific job time includes checkout/install elapsed time; a local
  // provisioner timer cannot restart the actual Actions job's hard timeout.
  const jobs=await get('/attempts/'+ctx.attempt+'/jobs?per_page=100');
  return approvalObservations(plan,ctx,{run,reviews,jobs:jobs.jobs});
}

export async function createLiveIO(plan,ctx,external){
  const root=await realpath(process.cwd()),temp=await realpath(process.env.RUNNER_TEMP??'/tmp');
  need(!within(root,temp),'PRIVATE_ROOT');
  let targetStatus=null,privateDir=null,leaseInode=null,stagedHash=null,stagedContent=null;
  let ownedIds=[],ownedVolumes=[],coreResult=null,leaseId=null,markerConflict=false,releaseFile=null;
  const staged=join(root,'supabase/migrations/20261018170000_communications_service_role_acl_shutdown_v1.sql');
  const budgets=new AsyncLocalStorage();
  const budget=()=>{const b=budgets.getStore();need(b&&!b.signal.aborted&&Date.now()<b.deadline-b.settleMs,'DEADLINE');return b;};
  const run=(command,args,options={})=>{const b=budget();return capture(command,args,{...options,signal:b.signal,
    timeout:Math.min(options.timeout??120000,b.deadline-b.settleMs-Date.now()),settleMs:b.settleMs});};
  const required=async(command,args,options)=>{
    const r=await run(command,args,options);
    if(!r.settled||!groupGone(r.pid))throw Object.assign(new BindingError('COMMAND_UNSETTLED'),{settled:false});
    need(r.exitCode===0&&!r.cancelled,'COMMAND_FAILED');return r.stdout.trim();
  };
  const dockerArgs=['--host=unix:///var/run/docker.sock'];
  const docker=(args)=>required('docker',[...dockerArgs,...args]);
  const cli=(args)=>required('supabase',args);
  const uid=process.getuid();
  const inspect=async id=>{
    const format='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"health":{{json .State.Health}},"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}';
    return JSON.parse(await docker(['inspect','--format',format,id]));
  };
  const inventory=async()=>({ids:(await docker(['ps','-aq','--no-trunc'])).split('\n').filter(Boolean),
    volumes:(await docker(['volume','ls','-q'])).split('\n').filter(Boolean)});
  const ownedInventory=async()=>{
    const inv=await inventory();
    for(const id of inv.ids){const item=await inspect(id);need(item.labels?.['com.supabase.cli.project']==='cladora-local'&&item.name.endsWith('_cladora-local'),'FOREIGN_RESOURCE');}
    for(const volume of inv.volumes)need(volume.endsWith('_cladora-local'),'FOREIGN_VOLUME');
    return inv;
  };
  const query=async text=>{
    const b=budget(),remaining=()=>Math.max(1,b.deadline-b.settleMs-Date.now());
    const {default:pg}=await import('pg');
    budget();
    const db=new pg.Client({connectionString:targetStatus.DB_URL,connectionTimeoutMillis:Math.min(5000,remaining()),query_timeout:Math.min(10000,remaining())});
    try{await db.connect();budget();return await db.query(text);}finally{await db.end();}
  };
  const marker=async()=>{const r=await query("select current_database() db,current_setting('cladora.synthetic_setup_lease',true) lease");need(r.rows[0].db==='postgres','MARKER_DB');return r.rows[0].lease;};
  return {
    clock:systemClock,
    withBudget:(b,fn)=>budgets.run(b,fn),
    namespace:async()=>({runId:randomUUID(),prefix:randomBytes(4).toString('hex')}),
    preflight:async(_plan,sha)=>{
      for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','VERCEL','VERCEL_ENV','NEXT_PUBLIC_VERCEL_ENV'])need(!process.env[key],'RUNTIME_OVERRIDE');
      need(process.env.NODE_ENV!=='production','PRODUCTION');
      const git=args=>required('git',args);
      const config=await readFile(join(root,'supabase/config.toml'),'utf8');
      need(/^project_id\s*=\s*"cladora-local"$/m.test(config),'PROJECT');
      const info=JSON.parse(await docker(['info','--format','{"driver":{{json .Driver}},"root":{{json .DockerRootDir}},"memory":{{.MemTotal}},"cpus":{{.NCPU}}}']));
      const inv=await inventory(),images=await docker(['image','ls','-q']);
      const df=await docker(['system','df','--format','{{json .}}']);
      const cache=df.split('\n').filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.Type==='Build Cache');
      const disk=await statfs(info.root);
      let memoryBytes=info.memory,cpus=info.cpus;
      try{const memory=(await readFile('/sys/fs/cgroup/memory.max','utf8')).trim();if(memory!=='max')memoryBytes=Math.min(memoryBytes,Number(memory));}catch{ /* Host daemon limits remain visible. */ }
      try{const [quota,period]=(await readFile('/sys/fs/cgroup/cpu.max','utf8')).trim().split(' ');if(quota!=='max')cpus=Math.min(cpus,Number(quota)/Number(period));}catch{ /* Host daemon limits remain visible. */ }
      let policy;try{policy=JSON.parse(await readFile('/etc/codex/network-policy.json','utf8'));}catch{policy=null;}
      const hosts=policy?.http_network_policy?.egress_rules?.map(item=>item.host)??[];
      for(const port of [...plan.stackPorts,plan.appPort]){budget();await portFree(port);}
      const status=await git(['status','--porcelain','--untracked-files=all']);
      const clean=status.split('\n').filter(Boolean).every(line=>line==='?? supabase/.temp/cli-latest');
      const files=await readdir(root);
      const ancestry=await run('git',['merge-base','--is-ancestor',CONTRACT.parent,sha]);
      const correction=await run('git',['merge-base','--is-ancestor',CONTRACT.coreCorrection,sha]);
      await cli(['start','--help']);await cli(['stop','--help']);await cli(['status','--help']);
      return {branch:await git(['branch','--show-current']),head:await git(['rev-parse','HEAD']),
        origin:await git(['remote','get-url','origin']),clean,noDotenv:!files.some(x=>x==='.env'||x.startsWith('.env.')&&x!=='.env.example'),
        fullAncestry:ancestry.exitCode===0,coreCorrection:correction.exitCode===0,
        nodeMajor:Number(process.versions.node.split('.')[0]),cliVersion:await cli(['--version']),
        daemon:'unix:///var/run/docker.sock',healthy:true,noOverrides:true,driver:info.driver,
        containers:inv.ids.length,volumes:inv.volumes.length,images:images?images.split('\n').length:0,cache:Number(cache?.TotalCount??NaN),
        availableBytes:Number(disk.bavail)*Number(disk.bsize),availableInodes:Number(disk.ffree),memoryBytes,cpus,
        freePorts:true,networkEnforced:external.review.binding.network.current===true&&external.review.binding.network.state==='enforced'
          &&createHash('sha256').update(await readFile('/etc/codex/network-policy.json')).digest('hex')===external.review.binding.network.snapshot_sha256,
        registryPolicy:['public.ecr.aws','d5l0dvt14r5h8.cloudfront.net','d2glxqk2uabbnd.cloudfront.net'].every(host=>hosts.includes(host))};
    },
    register:async state=>{
      stagedContent=await readFile(staged);stagedHash=createHash('sha256').update(stagedContent).digest('hex');
      budget();
      privateDir=await mkdtemp(join(temp,'cladora-building-http-'));state.privateDir=privateDir;
      const path=join(temp,'cladora-building-http-release-'+ctx.runId+'-'+ctx.attempt+'.json');
      budget();
      releaseFile=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      budget();
      await releaseFile.writeFile(JSON.stringify({sha:ctx.sha,runId:ctx.runId,attempt:ctx.attempt,release:'UNCONFIRMED'}));
      await releaseFile.sync();
    },
    start:async(_plan,state,signal)=>{
      const r=await run('bash',['scripts/start-local-supabase-staged-service-s4.sh','start'],{
        env:{...process.env,CLADORA_LOCAL_STEP_SU_02_AUTHORIZED:'1'},signal,timeout:12*60000});
      state.startSettled=r.settled&&groupGone(r.pid);
      if(!state.startSettled)throw Object.assign(new BindingError('START_UNSETTLED'),{settled:false});
      const inv=await ownedInventory();ownedIds=inv.ids;ownedVolumes=inv.volumes;
      need(r.exitCode===0&&state.startSettled&&!r.cancelled,'START_FAILED');
    },
    target:async()=>{
      targetStatus=JSON.parse(await cli(['status','--output','json']));
      const url=new URL(targetStatus.DB_URL);
      need(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&url.port==='54322'&&url.pathname==='/postgres'&&url.username==='postgres'&&!url.search&&!url.hash,'STATUS_DB');
      const inv=await ownedInventory();ownedIds=inv.ids;ownedVolumes=inv.volumes;
      const objects=await Promise.all(inv.ids.map(inspect));
      const auth=objects.find(x=>x.name==='/supabase_auth_cladora-local'),gateway=objects.find(x=>x.name==='/supabase_kong_cladora-local');
      // Exact gateway/Auth/DB network linkage must be supplied by independent
      // verified runtime identity; container names alone never count as proof.
      const network=JSON.parse(await docker(['network','inspect','supabase_network_cladora-local','--format','{{json .Containers}}']));
      const networkIds=Object.keys(network);
      const authEnv=JSON.parse(await docker(['inspect','--format','{{json .Config.Env}}',auth.id]));
      const gatewayEnv=JSON.parse(await docker(['inspect','--format','{{json .Config.Env}}',gateway.id]));
      const configPath=gatewayEnv.find(entry=>entry.startsWith('KONG_DECLARATIVE_CONFIG='))?.slice('KONG_DECLARATIVE_CONFIG='.length);
      need(['/home/kong/kong.yml','/etc/kong/kong.yml'].includes(configPath),'GATEWAY_CONFIG');
      const {default:yaml}=await import('js-yaml');
      const routes=yaml.load(await docker(['exec',gateway.id,'cat',configPath]));
      const authRouteUrls=routes.services.filter(service=>service.routes?.some(route=>route.paths?.some(path=>/^\/auth\/v1(?:\/|$)/.test(path)))).map(service=>service.url);
      return targetObservations(plan,{objects,networkIds,status:targetStatus,
        authDbUrl:authEnv.find(entry=>entry.startsWith('GOTRUE_DB_DATABASE_URL='))?.slice('GOTRUE_DB_DATABASE_URL='.length),authRouteUrls});
    },
    writeLease:async(lease,state)=>{
      budget();
      state.leasePath=join(privateDir,'lease.json');
      const fd=await open(state.leasePath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      try{leaseInode=(await fd.stat()).ino;budget();await fd.writeFile(JSON.stringify(lease));}finally{await fd.close();}
    },
    leaseMeta:async state=>{const s=await lstat(state.leasePath);return{path:state.leasePath,regular:s.isFile(),symlink:s.isSymbolicLink(),uid:s.uid,mode:s.mode,size:s.size};},
    privateContext:async()=>({root:temp,checkout:root,uid}),
    setMarker:async lease=>{
      leaseId=lease.lease_id;
      const before=await marker();markerConflict=before!==null&&before!=='';need(!markerConflict,'MARKER_OCCUPIED');
      need(/^building-http-[a-f0-9-]{36}-[a-f0-9]{40}$/.test(lease.lease_id),'MARKER_VALUE');
      await query("alter database postgres set cladora.synthetic_setup_lease to '"+lease.lease_id+"'");
    },
    readFreshMarker:async()=>marker(),
    runCore:async(state,signal)=>{
      const env=coreEnvironment(process.env,state.leasePath);
      coreResult=await run(process.execPath,['scripts/core-building-setup-http-proof.mjs','--run'],{env,signal,timeout:20*60000});return coreResult;
    },
    restoreStaged:async state=>{
      need(state.startSettled!==false,'START_UNSETTLED');
      let current;try{current=await readFile(staged);}catch{current=null;}
      if(current===null){budget();const fd=await open(staged,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o644);try{budget();await fd.writeFile(stagedContent);}finally{await fd.close();}}
      need(createHash('sha256').update(await readFile(staged)).digest('hex')===stagedHash,'STAGED_RESTORE');
    },
    settleCore:async()=>coreResult?.settled===true&&groupGone(coreResult.pid),
    verifyPortsClosed:async()=>{await portFree(plan.appPort);},
    clearMarker:async lease=>{const value=await marker();markerConflict=!!value&&value!==lease.lease_id;need(!markerConflict,'FOREIGN_MARKER');if(value){await query('alter database postgres reset cladora.synthetic_setup_lease');need(!await marker(),'MARKER_CLEAR');}},
    stopOwned:async state=>{
      need(state.startSettled!==false,'START_UNSETTLED');
      need(!markerConflict,'FOREIGN_MARKER');
      if(targetStatus&&leaseId){const value=await marker();need(!value||value===leaseId,'FOREIGN_MARKER');}
      const inv=await ownedInventory();
      need(inv.ids.every(id=>ownedIds.includes(id))&&inv.volumes.every(v=>ownedVolumes.includes(v)),'OWNERSHIP_CHANGED');
      await cli(['stop','--project-id','cladora-local','--no-backup']);
    },
    verifyDestroyed:async()=>{
      const inv=await inventory();need(inv.ids.length===0&&inv.volumes.length===0,'DESTRUCTION_UNCONFIRMED');
      for(const port of plan.stackPorts){budget();await portFree(port);}
    },
    removeLease:async state=>{
      const s=await lstat(state.leasePath);
      need(s.isFile()&&!s.isSymbolicLink()&&s.uid===uid&&s.ino===leaseInode,'FOREIGN_LEASE_FILE');
      budget();
      await unlink(state.leasePath);state.leasePath=null;
    },
    release:async evidence=>{
      budget();
      try{if(privateDir){await rmdir(privateDir);privateDir=null;}}
      catch{evidence.result='FAIL';evidence.release='UNCONFIRMED';evidence.cleanup.push(fixedFailure('private-directory'));}
      // This bounded receipt is teardown evidence, NEVER a grant/lease. Keep it
      // outside checkout/artifacts so an always step can detect missing release.
      if(releaseFile){try{
        budget();await releaseFile.truncate(0);budget();
        await releaseFile.write(JSON.stringify({sha:ctx.sha,runId:ctx.runId,attempt:ctx.attempt,release:evidence.release,
          timing:evidence.timing,completedAt:Date.now()}),0,'utf8');await releaseFile.sync();budget();
      }finally{await releaseFile.close();releaseFile=null;}}
      else throw new BindingError('RELEASE_EVIDENCE_MISSING');
    },
  };
}

export function validateReleaseReceipt(record,meta,ctx,observedAt){
  need(record.sha===ctx.sha&&record.runId===ctx.runId&&record.attempt===ctx.attempt,'RELEASE_BINDING');
  const t=record.timing;
  need(t&&Object.values(t).every(Number.isSafeInteger)&&Number.isSafeInteger(record.completedAt)
    &&record.completedAt<=t.reportDeadline&&meta.mtimeMs<=t.reportDeadline&&observedAt<=t.reportDeadline
    &&t.cleanupCompletedAt<=t.cleanupDeadline&&t.cleanupCompletedAt<t.reportDeadline
    &&t.reportDeadline<=t.jobDeadline&&t.reportDeadline<=t.grantExpiry,'LATE_RELEASE');
  return ['CONFIRMED','CLEANED_AFTER_FAILURE'].includes(record.release);
}

export async function cli(args=process.argv.slice(2)){
  if(args[0]==='--safe-status'){
    const r=await capture('supabase',['status','--output','json'],{timeout:15000});
    console.log(JSON.stringify({task:'database-tests',stage:'status',result:r.exitCode===0?'RESPONSIVE':'UNAVAILABLE',sensitiveOutput:'WITHHELD'}));return 0;
  }
  if(args[0]==='--release-evidence'){
    const ctx=commandContext(process.env);
    need(/^[1-9][0-9]*$/.test(ctx.runId)&&/^[1-9][0-9]*$/.test(ctx.attempt),'RUN_ID');
    const file=join(await realpath(process.env.RUNNER_TEMP),'cladora-building-http-release-'+ctx.runId+'-'+ctx.attempt+'.json');
    const stat=await lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o777)===0o600&&stat.size<4096,'RELEASE_FILE');
    const record=JSON.parse(await readFile(file,'utf8'));
    const confirmed=validateReleaseReceipt(record,stat,ctx,Date.now());
    console.log(JSON.stringify({task:'PLATFORM-BUILDING-SETUP-HTTP-CI-BINDING-03',release:confirmed?record.release:'UNCONFIRMED',runnerLoss:'MISSING_RECEIPT_IS_NOT_CLEANUP_PROOF'}));return confirmed?0:1;
  }
  need(args.length===1&&args[0]==='--run','EXPLICIT_RUN_REQUIRED');
  need(REVIEWED_EXECUTION_PLAN!==null,'UNGRANTED');
  const ctx=commandContext(process.env),external=await externalApproval(REVIEWED_EXECUTION_PLAN,ctx);
  const controller=new AbortController(),stop=()=>controller.abort();
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    const evidence=await provision({plan:REVIEWED_EXECUTION_PLAN,ctx,external,io:await createLiveIO(REVIEWED_EXECUTION_PLAN,ctx,external),signal:controller.signal});
    console.log(JSON.stringify(evidence));return evidence.result==='PASS'?0:1;
  }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  cli().then(code=>{process.exitCode=code;}).catch(()=>{console.error(JSON.stringify({task:'PLATFORM-BUILDING-SETUP-HTTP-CI-BINDING-03',result:'BLOCKED',failure:'UNGRANTED_OR_PREFLIGHT_FAILED',sensitiveOutput:'WITHHELD'}));process.exitCode=1;});
}
