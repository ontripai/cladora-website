import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {CONTRACT,REVIEWED_EXECUTION_PLAN,validateGrant,validatePreflight,validateTarget,targetObservations,
  validatePrivateFile,coreReceipt,coreEnvironment,policyDigest,commandContext,approvalObservations,
  validateTiming,validateReleaseReceipt,boundedCall,provision,cli} from './provision-building-setup-http-ci.mjs';

// No network/Docker/DB/Auth/HTTP/file provisioning. Every acquisition and
// teardown below is virtual in-memory I/O; no real lease or marker is created.
const now=Date.parse('2026-10-21T12:00:00Z'),secret='SENSITIVE_SQL_TOKEN_COOKIE_ROW';
const sha='a'.repeat(40),dbId='b'.repeat(64),authId='c'.repeat(64);
// These profiles/IDs are fictitious test data only, never live defaults.
const plan={id:'reviewed-plan-fixture',repository:CONTRACT.repository,ref:CONTRACT.ref,
  task:CONTRACT.task,worker:CONTRACT.worker,provisioner:CONTRACT.provisioner,lane:CONTRACT.lane,
  environmentId:22,reviewerId:33,appPort:3100,stackPorts:[54321,54322,54323],stagedOperator:true,
  authImage:'public.ecr.aws/supabase/gotrue:v2.180.0',
  timing:{jobTimeoutMs:CONTRACT.jobTimeoutMs,acquisitionMs:10000,cleanupMs:5000,reportingMs:1000,settleMs:100},
  services:[{name:'/supabase_db_cladora-local',image:'public.ecr.aws/supabase/postgres:17.6.1.095',healthRequired:true},
    {name:'/supabase_auth_cladora-local',image:'public.ecr.aws/supabase/gotrue:v2.180.0',healthRequired:true},
    {name:'/supabase_kong_cladora-local',image:'public.ecr.aws/supabase/kong:2.8.1',healthRequired:true}],
  capacity:{driver:'vfs',basis:'reviewed-full-stack-peak-with-driver-amplification',requiredBytes:1000,requiredInodes:20,hostQuotaAvailableBytes:2000,requiredMemoryBytes:1000,requiredCpus:2}};
const ctx={actions:true,event:'push',job:CONTRACT.lane,repository:CONTRACT.repository,ref:CONTRACT.ref,sha,selectedSha:sha,runId:'123',attempt:'2'};
const external={run:{id:'123',attempt:'2',sha,branch:CONTRACT.branch,repository:CONTRACT.repository,event:'push',
  jobStartedAt:new Date(now).toISOString(),workflowPath:'.github/workflows/database-tests.yml'},
  review:{state:'approved',reviewerId:33,environmentId:22,binding:{version:2,run_id:'123',attempt:'2',sha,
    ref:CONTRACT.ref,lane:CONTRACT.lane,task:CONTRACT.task,worker:CONTRACT.worker,provisioner:CONTRACT.provisioner,
    plan_id:plan.id,policy_sha256:policyDigest(plan),expires_at:new Date(now+3600000).toISOString(),network:{environment_id:'mock-runner',revision:'1',state:'enforced',current:true,run_id:'123',attempt:'2',snapshot_sha256:'d'.repeat(64)}}}};
const observation={branch:CONTRACT.branch,head:sha,origin:CONTRACT.origin,clean:true,noDotenv:true,
  fullAncestry:true,coreCorrection:true,nodeMajor:22,cliVersion:'2.84.2',daemon:'unix:///var/run/docker.sock',
  healthy:true,noOverrides:true,containers:0,volumes:0,images:0,cache:0,freePorts:true,
  driver:'vfs',availableBytes:2000,availableInodes:100,memoryBytes:2000,cpus:4,networkEnforced:true,registryPolicy:true};
const target={project:'cladora-local',apiOrigin:'http://127.0.0.1:54321',dbPort:54322,dbName:'postgres',
  dbId,authId,running:true,fullStackHealthy:true,sameStack:true,dbImage:'public.ecr.aws/supabase/postgres:17.6.1.095',
  authImage:plan.authImage,projectLabels:true,exactPorts:true,noForeignResources:true};
const goodCore={task:CONTRACT.task,sha,result:'PASS',cleanup:'LOGICAL_AUTHORITY_SESSION_AND_OWNED_PROCESS_CLEANED',
  connected:'PASS',transport:'REAL_NEXT_AUTH_AAL2_RPC_POSTGRES'};
const clone=value=>structuredClone(value);

function fakeClock(initial=now){
  let current=initial,id=0;const timers=new Map();
  return {now:()=>current,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:current+ms});return id;},clearTimer:key=>timers.delete(key),
    advance(ms){const end=current+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;timers.delete(next[0]);current=next[1].at;next[1].fn();}current=end;},pending:()=>timers.size};
}

function mockIO(options={}){
  const events=[],virtual={lease:null,marker:null,resources:false,removed:false};
  const action=async(name,fn=()=>{})=>{events.push(name);if(options.fail?.includes(name))throw Error(secret);return fn();};
  const io={
    clock:options.clock??fakeClock(),
    preflight:()=>action('preflight',()=>({...observation,...options.observation})),
    register:()=>action('register'),
    start:async(_plan,state)=>{virtual.resources=true;state.startSettled=true;return action('start');},
    target:()=>action('target',()=>({...target,...options.target})),
    namespace:()=>action('namespace',()=>({runId:'12345678-0000-4000-8000-000000000001',prefix:'aabbccdd'})),
    writeLease:async(lease,state)=>{state.leasePath='/runner-temp/private/lease.json';virtual.lease=clone(lease);return action('writeLease');},
    leaseMeta:()=>action('leaseMeta',()=>({path:'/runner-temp/private/lease.json',regular:true,symlink:false,uid:1000,mode:0o600,size:1000,...options.meta})),
    privateContext:async()=>({root:'/runner-temp',checkout:'/checkout',uid:1000}),
    setMarker:lease=>action('setMarker',()=>{virtual.marker=lease.lease_id;}),
    readFreshMarker:()=>action('readFreshMarker',()=>options.foreignMarker?'foreign-owner':virtual.marker),
    runCore:()=>action('runCore',()=>({exitCode:options.coreExit??0,settled:options.unsettled!==true,
      stdout:JSON.stringify(options.core??goodCore)})),
    restoreStaged:()=>action('restoreStaged'),
    settleCore:()=>action('settleCore',()=>options.unsettled!==true),
    verifyPortsClosed:()=>action('verifyPortsClosed'),
    clearMarker:()=>action('clearMarker',()=>{if(options.foreignMarker)throw Error(secret);virtual.marker=null;}),
    stopOwned:()=>action('stopOwned',()=>{if(options.foreignMarker)throw Error(secret);virtual.resources=false;}),
    verifyDestroyed:()=>action('verifyDestroyed',()=>{if(virtual.resources)throw Error(secret);}),
    removeLease:()=>action('removeLease',()=>{virtual.lease=null;virtual.removed=true;}),
    release:evidence=>action('release',()=>{virtual.evidence=clone(evidence);}),
  };
  return {io,events,virtual};
}
async function exercise(options={},overrides={}){
  const mocked=mockIO(options);
  const result=await provision({plan:clone(plan),ctx:clone(ctx),external:clone(external),io:mocked.io,...overrides});
  assert.ok(!JSON.stringify(result).includes(secret));
  return {...mocked,result};
}

test('strict default has no grant and performs no resource I/O',async()=>{
  assert.equal(REVIEWED_EXECUTION_PLAN,null);
  const {result,events}=await exercise({}, {plan:REVIEWED_EXECUTION_PLAN});
  assert.equal(result.result,'FAIL');assert.equal(result.primary.stage,'grant');
  assert.equal(result.release,'NOT_ACQUIRED');assert.deepEqual(events,[]);
  await assert.rejects(cli(['--run']),error=>error.code==='UNGRANTED');
});

test('external approval binds native run/attempt, exact source, plan and delegated identity',()=>{
  validateGrant(plan,ctx,external,now);
  for(const delta of [{attempt:'1'},{sha:'d'.repeat(40)},{ref:'refs/heads/main'},{job:'another-job'},{actions:false},{repository:'foreign/repo'}])
    assert.throws(()=>validateGrant(plan,{...ctx,...delta},external,now));
  for(const delta of [{worker:CONTRACT.provisioner},{task:'another-task'},{lane:'another-lane'},{provisioner:CONTRACT.worker},
    {run_id:'124'},{attempt:'1'},{expires_at:new Date(now-1).toISOString()},{expires_at:new Date(now+5*3600000).toISOString()},
    {token:secret}]){
    const changed=clone(external);Object.assign(changed.review.binding,delta);
    assert.throws(()=>validateGrant(plan,ctx,changed,now));
  }
  for(const delta of [{state:'pending'},{reviewerId:44},{environmentId:44}]){
    const changed=clone(external);Object.assign(changed.review,delta);assert.throws(()=>validateGrant(plan,ctx,changed,now));
  }
  const changed=clone(external);changed.run.attempt='1';assert.throws(()=>validateGrant(plan,ctx,changed,now));
  for(const network of [{...external.review.binding.network,current:false},{...external.review.binding.network,state:'unknown'},
    {...external.review.binding.network,attempt:'1'},{...external.review.binding.network,snapshot_sha256:'unknown'}]){
    const changed=clone(external);changed.review.binding.network=network;assert.throws(()=>validateGrant(plan,ctx,changed,now));
  }
});

test('missing external authority and incomplete reviewed service plan cannot mint a lease',async()=>{
  const missing=await exercise({}, {external:null});assert.deepEqual(missing.events,[]);
  for(const delta of [{services:undefined},{services:[]},{services:plan.services.map(x=>({...x,healthRequired:false}))},
    {services:[...plan.services,{...plan.services[0]}]}]){
    const result=await exercise({}, {plan:{...plan,...delta}});
    assert.equal(result.result.primary.stage,'grant');assert.deepEqual(result.events,[]);
  }
});

test('dirty/foreign/unknown policy, daemon, ports and tools fail before acquisition',async()=>{
  for(const delta of [{clean:false},{noDotenv:false},{fullAncestry:false},{coreCorrection:false},
    {branch:'spoof-core'},{origin:'https://foreign.invalid/repo'},{head:'d'.repeat(40)},
    {nodeMajor:24},{cliVersion:'latest'},{healthy:false},{noOverrides:false},{daemon:'tcp://remote:2375'},
    {containers:1},{volumes:1},{images:1},{cache:1},{freePorts:false},{networkEnforced:false},{registryPolicy:false}]){
    const {result,events}=await exercise({observation:delta});
    assert.equal(result.primary.stage,'preflight');assert.deepEqual(events,['preflight']);
  }
});

test('unknown or insufficient disk/driver/quota budget is never a capacity PASS',()=>{
  validatePreflight(plan,observation,sha);
  for(const capacity of [null,{...plan.capacity,requiredBytes:null},{...plan.capacity,requiredInodes:0},
    {...plan.capacity,hostQuotaAvailableBytes:null},{...plan.capacity,hostQuotaAvailableBytes:999},
    {...plan.capacity,driver:'overlay2'},{...plan.capacity,basis:'df-alone'}])
    assert.throws(()=>validatePreflight({...plan,capacity},observation,sha));
  for(const delta of [{availableBytes:999},{availableInodes:0},{memoryBytes:999},{cpus:1}])assert.throws(()=>validatePreflight(plan,{...observation,...delta},sha));
});

test('pure safe virtual path creates exactly fourteen private Core fields and independent marker',async()=>{
  let lease;
  const mocked=mockIO();
  const write=mocked.io.writeLease;mocked.io.writeLease=async(value,state)=>{lease=clone(value);await write(value,state);};
  const result=await provision({plan,ctx,external,io:mocked.io});
  assert.equal(result.result,'PASS');assert.equal(result.release,'CONFIRMED');
  assert.equal(Object.keys(lease).length,14);assert.equal(lease.worker,CONTRACT.worker);assert.equal(lease.task,CONTRACT.task);
  assert.equal(lease.sha,sha);assert.equal(lease.db_container_id,dbId);assert.equal(lease.auth_container_id,authId);
  assert.equal(lease.api_origin,'http://127.0.0.1:54321');assert.equal(lease.db_port,54322);
  assert.equal(lease.app_origin,'http://127.0.0.1:3100');assert.ok(lease.lease_id.startsWith('building-http-'));
  assert.notEqual(lease.run_id,ctx.runId);assert.notEqual(lease.fixture_prefix,'c2200000');
  assert.deepEqual(mocked.events.slice(0,4),['preflight','register','start','target']);
  assert.ok(mocked.events.indexOf('readFreshMarker')<mocked.events.indexOf('runCore'));
  assert.equal(mocked.virtual.resources,false);assert.equal(mocked.virtual.marker,null);assert.equal(mocked.virtual.lease,null);
});

test('unexpected container/image/stack/API port fails identity before private lease',async()=>{
  for(const delta of [{project:'foreign'},{dbId:'short'},{authId:dbId},{running:false},{fullStackHealthy:false},
    {sameStack:false},{dbImage:'foreign/postgres:17.6.1.095'},{authImage:'supabase/gotrue:latest'},
    {apiOrigin:'https://remote.invalid'},{dbPort:5432},{dbName:'concurrency_clone'},
    {projectLabels:false},{exactPorts:false},{noForeignResources:false}]){
    assert.throws(()=>validateTarget(plan,{...target,...delta}));
    const {result,events}=await exercise({target:delta});
    assert.equal(result.primary.stage,'identity');assert.ok(!events.includes('writeLease'));assert.ok(events.includes('stopOwned'));
  }
});

function identityObservations(){
  const objects=plan.services.map((service,index)=>({name:service.name,image:service.image,id:[dbId,authId,'e'.repeat(64)][index],
    running:true,health:{Status:'healthy'},labels:{'com.supabase.cli.project':'cladora-local'},
    ports:index===0?{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'54322'}]}:index===2?{'8000/tcp':[{HostIp:'127.0.0.1',HostPort:'54321'}]}:{}}));
  return {objects,networkIds:objects.map(x=>x.id),status:{DB_URL:'postgresql://postgres:'+secret+'@127.0.0.1:54322/postgres',
    API_URL:'http://127.0.0.1:54321',SERVICE_ROLE_KEY:secret},authDbUrl:'postgresql://auth:'+secret+'@supabase_db_cladora-local:5432/postgres',
    authRouteUrls:['http://supabase_auth_cladora-local:9999/']};
}

test('actual identity derivation checks full inventory, health, gateway ports and Auth database linkage',()=>{
  const observations=identityObservations(),{objects}=observations;
  const safe=targetObservations(plan,observations);validateTarget(plan,safe);assert.ok(!JSON.stringify(safe).includes(secret));
  const unhealthy=clone(objects);unhealthy[1].health.Status='unhealthy';
  const port=clone(objects);port[0].ports['5432/tcp'].push({HostIp:'127.0.0.1',HostPort:'9999'});
  const image=clone(objects);image[1].image='foreign/image:latest';
  for(const delta of [{objects:unhealthy},{objects:port},{objects:image},{networkIds:[dbId,authId]},
    {authRouteUrls:[]},{authRouteUrls:['http://remote.invalid:9999/']},
    {authDbUrl:'postgresql://auth:unused@remote.invalid:5432/postgres'},{objects:[...objects,{...objects[2],id:'f'.repeat(64),name:'/foreign'}]}])
    assert.throws(()=>validateTarget(plan,targetObservations(plan,{...observations,...delta})));
});

test('actual Auth URL derivation accepts the pinned official parameter-free PostgreSQL contract',()=>{
  for(const protocol of ['postgresql','postgres']){
    const observations=identityObservations();
    observations.authDbUrl=protocol+'://supabase_auth_admin:'+secret+'@supabase_db_cladora-local:5432/postgres';
    const target=targetObservations(plan,observations);validateTarget(plan,target);
    assert.equal(target.sameStack,true);assert.ok(!JSON.stringify(target).includes(secret));
  }
});

test('actual Auth URL derivation rejects wrong schemes, target options and fragments without disclosing configuration',()=>{
  const base='postgresql://supabase_auth_admin:'+secret+'@supabase_db_cladora-local:5432/postgres';
  const urls=[base.replace('postgresql:','https:'),base.replace('postgresql:','mysql:'),
    base.replace('postgresql:','file:'),secret,undefined,base+'?',base+'#',
    ...['host=remote.invalid','hostaddr=192.0.2.1','service=remote','port=9999','dbname=other',
      'host=%2Ftmp','options=-c%20dbname%3Dother','sslmode=disable','application_name=gotrue',
      '%68ost=remote.invalid','host=localhost&host=remote.invalid'].map(query=>base+'?'+query),
    base+'#host=remote.invalid',base+'#'+secret];
  for(const authDbUrl of urls){
    assert.throws(()=>targetObservations(plan,{...identityObservations(),authDbUrl}),error=>{
      assert.equal(error.code,'AUTH_DB');assert.ok(!String(error).includes(secret));return true;
    });
  }
  // The pinned official contract needs no non-target parameter exception.
  // Reject even benign-looking options rather than guessing a driver allowlist.
});

test('actual Auth URL graph rejects remote, socket, alternate database and port destinations',()=>{
  const base='postgresql://supabase_auth_admin:'+secret+'@supabase_db_cladora-local:5432/postgres';
  for(const authDbUrl of [base.replace('supabase_db_cladora-local','remote.invalid'),
    base.replace('supabase_db_cladora-local','127.0.0.1'),base.replace(':5432/',':9999/'),
    base.replace(':5432/', '/'),base.replace('/postgres','/other'),base.replace('/postgres','/postgres/other'),
    base.replace('supabase_db_cladora-local','%2Ftmp')]){
    assert.throws(()=>validateTarget(plan,targetObservations(plan,{...identityObservations(),authDbUrl})),error=>{
      assert.ok(!String(error).includes(secret));return true;
    });
  }
});

test('actual Core environment construction preserves network/trust selectors and excludes ambient authority',()=>{
  const networkKeys=['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy',
    'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE',
    'CODEX_PROXY_CERT','CODEX_NETWORK_POLICY','CODEX_NETWORK_POLICY_PATH'];
  const ambient=Object.fromEntries(networkKeys.map(key=>[key,'configured-selector-for-'+key]));
  const forbidden=['GITHUB_TOKEN','GH_TOKEN','ACTIONS_RUNTIME_TOKEN','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD',
    'DATABASE_URL','PGHOST','PGPASSWORD','GOTRUE_DB_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL','AWS_SECRET_ACCESS_KEY','GOOGLE_APPLICATION_CREDENTIALS',
    'NODE_TLS_REJECT_UNAUTHORIZED','NODE_OPTIONS','NODE_PATH','DOCKER_HOST','DOCKER_CONTEXT',
    'DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','CURL_INSECURE','CLADORA_LOCAL_STEP_SU_02_AUTHORIZED'];
  for(const key of forbidden)ambient[key]=secret;
  ambient.BUILDING_SETUP_HTTP_EPHEMERAL=secret;ambient.BUILDING_SETUP_HTTP_LEASE_FILE=secret;
  const env=coreEnvironment(ambient,'/private/owned-lease.json');
  for(const key of networkKeys)assert.equal(env[key],ambient[key]);
  for(const key of forbidden)assert.equal(Object.hasOwn(env,key),false);
  assert.equal(env.BUILDING_SETUP_HTTP_EPHEMERAL,'1');assert.equal(env.BUILDING_SETUP_HTTP_LEASE_FILE,'/private/owned-lease.json');
  assert.ok(!JSON.stringify(env).includes(secret));
  assert.deepEqual(ambient.GITHUB_TOKEN,secret); // Input was not mutated.
});

test('actual Core environment omits absent selectors and preserves explicitly configured empty values',()=>{
  assert.deepEqual(coreEnvironment({},'/private/lease'),{
    BUILDING_SETUP_HTTP_EPHEMERAL:'1',BUILDING_SETUP_HTTP_LEASE_FILE:'/private/lease'});
  const env=coreEnvironment({NO_PROXY:'',ALL_PROXY:undefined,LANG:'C.UTF-8',TMP:'/private/tmp'},'/private/lease');
  assert.equal(env.NO_PROXY,'');assert.equal(Object.hasOwn(env,'ALL_PROXY'),false);
  assert.equal(env.LANG,'C.UTF-8');assert.equal(env.TMP,'/private/tmp');
});

test('private lease metadata rejects symlink, group/other modes, foreign UID and checkout/artifact paths',async()=>{
  for(const meta of [{symlink:true},{regular:false},{uid:0},{mode:0o644},{mode:0o700},{size:8193},
    {path:'/checkout/artifacts/lease.json'},{path:'/elsewhere/lease.json'}]){
    const {result,events}=await exercise({meta});assert.equal(result.primary.stage,'lease');
    assert.ok(!events.includes('setMarker'));assert.ok(events.includes('removeLease'));
  }
  assert.throws(()=>validatePrivateFile({path:'/runner-temp/../checkout/lease.json',regular:true,symlink:false,uid:1000,mode:0o600,size:50},
    {root:'/runner-temp',checkout:'/checkout',uid:1000}));
});

test('marker mismatch never executes Core and foreign marker/resources remain unconfirmed',async()=>{
  const {result,events,virtual}=await exercise({foreignMarker:true});
  assert.equal(result.primary.stage,'marker');assert.ok(!events.includes('runCore'));
  assert.ok(result.cleanup.some(item=>item.stage==='marker-clear'));
  assert.equal(result.release,'UNCONFIRMED');assert.equal(virtual.resources,true);
});

for(const point of ['register','start','target','namespace','writeLease','leaseMeta','setMarker','readFreshMarker','runCore'])
test('partial acquisition '+point+' still attempts owned teardown/release',async()=>{
  const {result,events}=await exercise({fail:[point]});
  assert.equal(result.result,'FAIL');assert.ok(events.includes('release'));
  if(point!=='register'){
    assert.ok(events.includes('restoreStaged'));assert.ok(events.includes('stopOwned'));assert.ok(events.includes('verifyDestroyed'));
  }
  if(['writeLease','leaseMeta','setMarker','readFreshMarker','runCore'].includes(point))assert.ok(events.includes('removeLease'));
});

test('simultaneous primary and every cleanup failure survive independently without sensitive data',async()=>{
  const {result,events}=await exercise({core:{...goodCore,result:'FAIL'},fail:['restoreStaged','settleCore','verifyPortsClosed','clearMarker','stopOwned','verifyDestroyed','removeLease','release']});
  assert.equal(result.primary.stage,'core-proof');assert.equal(result.result,'FAIL');assert.equal(result.release,'UNCONFIRMED');
  for(const name of ['settleCore','verifyPortsClosed','verifyDestroyed','removeLease','release'])assert.ok(events.includes(name));
  for(const name of ['restoreStaged','clearMarker','stopOwned'])assert.ok(!events.includes(name));
  assert.equal(result.cleanup.length,8);assert.ok(!JSON.stringify(result).includes(secret));
});

test('cancelled grant cannot acquire; unsettled Core cannot authorize marker clear/stack stop',async()=>{
  const cancel=new AbortController();cancel.abort();
  const blocked=await exercise({}, {signal:cancel.signal});assert.deepEqual(blocked.events,[]);assert.equal(blocked.result.result,'FAIL');
  const {result,events}=await exercise({unsettled:true});
  assert.equal(result.result,'FAIL');assert.equal(result.release,'UNCONFIRMED');
  assert.ok(!events.includes('clearMarker'));assert.ok(!events.includes('stopOwned'));
  assert.equal(result.runnerLoss,'UNCONFIRMED_IF_PROCESS_OR_RUNNER_IS_LOST');
});

test('Core output must prove connected transport and logical cleanup; arbitrary payloads are not forwarded',async()=>{
  for(const core of [{...goodCore,cleanup:'FAILED'},{...goodCore,sha:'d'.repeat(40)},
    {...goodCore,connected:'NOT_RUN_NOT_PASS'},{...goodCore,transport:'MOCK'},{...goodCore,result:'FAIL'}]){
    const {result}=await exercise({core});assert.equal(result.result,'FAIL');
  }
  for(const raw of [secret,secret.repeat(200),JSON.stringify({task:'wrong',sha,result:'PASS'})])assert.throws(()=>coreReceipt(raw,sha));
  const safe=coreReceipt(JSON.stringify({...goodCore,token:secret,assertion_actual:secret}),sha);
  assert.deepEqual(safe,{result:'PASS',logicalCleanup:true,connected:true});assert.ok(!JSON.stringify(safe).includes(secret));
});

test('Core logical cleanup failure remains unconfirmed even if physical destruction succeeds',async()=>{
  const {result,events}=await exercise({core:{...goodCore,cleanup:'FAILED'}});
  assert.equal(result.result,'FAIL');assert.equal(result.release,'UNCONFIRMED');
  assert.ok(result.cleanup.some(x=>x.stage==='core-logical-check'));
  assert.ok(events.includes('stopOwned'));assert.ok(events.includes('verifyDestroyed'));
});

test('cancellation during Core execution cannot be returned as a connected PASS',async()=>{
  const cancel=new AbortController(),mocked=mockIO();
  const run=mocked.io.runCore;mocked.io.runCore=async()=>{const result=await run();cancel.abort();return result;};
  const result=await provision({plan,ctx,external,io:mocked.io,signal:cancel.signal});
  assert.equal(result.result,'FAIL');assert.equal(result.primary.stage,'core-proof');
  assert.ok(mocked.events.includes('settleCore'));assert.ok(mocked.events.includes('stopOwned'));
});

test('policy digest and actual native constructors bind dynamic candidate without a self-referencing SHA',async()=>{
  assert.equal(Object.hasOwn(plan,'sha'),false);
  assert.equal(policyDigest(plan),policyDigest(Object.fromEntries(Object.entries(plan).reverse())));
  assert.throws(()=>policyDigest({...plan,sha}));
  assert.notEqual(policyDigest({...plan,appPort:3200}),policyDigest(plan));
  const candidate='f'.repeat(40),changed=clone(external);changed.run.sha=candidate;changed.review.binding.sha=candidate;
  const result=await exercise({observation:{head:candidate},core:{...goodCore,sha:candidate}},
    {ctx:{...ctx,sha:candidate,selectedSha:candidate},external:changed});
  assert.equal(result.result.result,'PASS');assert.equal(result.result.sha,candidate);
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_JOB:CONTRACT.lane,GITHUB_REPOSITORY:CONTRACT.repository,
    GITHUB_REF:CONTRACT.ref,GITHUB_SHA:sha,CLADORA_APPROVED_EXECUTION_SHA:candidate,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'2'};
  const context=commandContext(env);assert.equal(context.sha,sha);assert.equal(context.selectedSha,candidate);
  assert.throws(()=>validateGrant(plan,context,external,now)); // Selector is not authority.
  for(const delta of [{event:'workflow_dispatch'},{event:'pull_request'},{selectedSha:undefined},{ref:undefined},{sha:undefined}])
    assert.throws(()=>validateGrant(plan,{...ctx,...delta},external,now));
});

function nativeInputs(){return {
  run:{id:123,run_attempt:2,head_sha:sha,head_branch:CONTRACT.branch,event:'push',repository:{full_name:CONTRACT.repository},path:'.github/workflows/database-tests.yml'},
  reviews:[{state:'approved',user:{id:33},environments:[{id:22}],comment:JSON.stringify(external.review.binding)}],
  jobs:[{name:CONTRACT.lane,run_id:123,run_attempt:2,head_sha:sha,status:'in_progress',started_at:new Date(now).toISOString()}]};}

test('actual approval observation builder selects exact run/attempt/policy, rejects stale and ambiguous native metadata',()=>{
  const input=nativeInputs();validateGrant(plan,ctx,approvalObservations(plan,ctx,input),now);
  for(const delta of [{user:{id:44}},{state:'pending'},{environments:[{id:44}]},{comment:secret},
    {comment:JSON.stringify({...external.review.binding,attempt:'1'})},{comment:JSON.stringify({...external.review.binding,sha:'e'.repeat(40)})},
    {comment:JSON.stringify({...external.review.binding,policy_sha256:'e'.repeat(64)})}]){
    assert.throws(()=>approvalObservations(plan,ctx,{...input,reviews:[{...input.reviews[0],...delta}]}),error=>!String(error).includes(secret));
  }
  for(const delta of [{head_sha:'e'.repeat(40)},{run_id:124},{run_attempt:1},{status:'completed'},{name:'other-lane'}])
    assert.throws(()=>approvalObservations(plan,ctx,{...input,jobs:[{...input.jobs[0],...delta}]}));
  assert.throws(()=>approvalObservations(plan,ctx,{...input,reviews:[...input.reviews,...input.reviews]}));
  assert.throws(()=>approvalObservations(plan,ctx,{...input,jobs:[]}));
  for(const delta of [{run_attempt:1},{head_branch:'main'},{head_sha:'e'.repeat(40)},{event:'pull_request'},
    {repository:{full_name:'foreign/repo'}},{path:'.github/workflows/another.yml'}])
    assert.throws(()=>validateGrant(plan,ctx,approvalObservations(plan,ctx,{...input,run:{...input.run,...delta}}),now));
  const stale={...input.reviews[0],comment:JSON.stringify({...external.review.binding,attempt:'1'})};
  validateGrant(plan,ctx,approvalObservations(plan,ctx,{...input,reviews:[stale,...input.reviews]}),now);
});

test('timing profile reserves cleanup/reporting within actual native job time and grant expiry; no live defaults',()=>{
  const started=new Date(now).toISOString(),expiry=now+3600000;
  validateTiming(plan.timing,started,now,expiry);
  for(const timing of [null,{}, {...plan.timing,settleMs:0},{...plan.timing,settleMs:plan.timing.reportingMs},
    {...plan.timing,acquisitionMs:-1},{...plan.timing,cleanupMs:NaN},{...plan.timing,extra:1},
    {...plan.timing,jobTimeoutMs:3600000},{...plan.timing,acquisitionMs:CONTRACT.jobTimeoutMs}])
    assert.throws(()=>validateTiming(timing,started,now,expiry));
  const total=plan.timing.acquisitionMs+plan.timing.cleanupMs+plan.timing.reportingMs;
  for(const jobStart of ['invalid',undefined,new Date(now+1).toISOString(),new Date(now-CONTRACT.jobTimeoutMs+total).toISOString()])
    assert.throws(()=>validateTiming(plan.timing,jobStart,now,expiry));
  assert.throws(()=>validateTiming(plan.timing,started,now,now+total));
  const bad=clone(external);bad.review.binding.policy_sha256='f'.repeat(64);
  assert.throws(()=>validateGrant(plan,ctx,bad,now));
});

const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
async function until(predicate){for(let i=0;i<400&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),'virtual operation reached');}

test('actual bounded call aborts before its deadline and never waits beyond settling for an uncooperative operation',async()=>{
  const clock=fakeClock();let aborted=false;
  const promise=boundedCall(signal=>{signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});},
    {clock,deadline:now+100,settleMs:10});
  const check=assert.rejects(promise,error=>error.code==='DEADLINE'&&error.settled===false);
  await flush();clock.advance(90);assert.equal(aborted,true);clock.advance(10);await check;assert.equal(clock.pending(),0);
});

test('acquisition deadline gracefully settles owned startup, performs independent teardown, and preserves primary failure',async()=>{
  const clock=fakeClock(),mocked=mockIO({clock});
  mocked.io.start=async(_plan,state,signal)=>{mocked.events.push('start');mocked.virtual.resources=true;state.startSettled=false;
    await new Promise(resolve=>signal.addEventListener('abort',()=>{state.startSettled=true;resolve();},{once:true}));};
  const pending=provision({plan,ctx,external,io:mocked.io});await until(()=>mocked.events.includes('start'));
  clock.advance(plan.timing.acquisitionMs-plan.timing.settleMs);await flush();const result=await pending;
  assert.equal(result.primary.stage,'startup');assert.equal(result.release,'CLEANED_AFTER_FAILURE');
  assert.ok(mocked.events.includes('verifyDestroyed'));assert.equal(mocked.virtual.resources,false);assert.equal(clock.pending(),0);
});

test('unsettled acquisition cannot start destructive cleanup or a later lease even after budget exhaustion',async()=>{
  const clock=fakeClock(),mocked=mockIO({clock});
  mocked.io.start=async()=>{mocked.events.push('start');mocked.virtual.resources=true;await new Promise(()=>{});};
  const pending=provision({plan,ctx,external,io:mocked.io});await until(()=>mocked.events.includes('start'));
  clock.advance(plan.timing.acquisitionMs);await flush();const result=await pending;
  assert.equal(result.release,'UNCONFIRMED');assert.equal(result.primary.stage,'startup');
  assert.ok(!mocked.events.includes('stopOwned'));assert.ok(!mocked.events.includes('writeLease'));assert.equal(clock.pending(),0);
});

test('manual cancellation during startup prevents later lease while allowing independently completed cleanup',async()=>{
  const control=new AbortController(),mocked=mockIO();const start=mocked.io.start;
  mocked.io.start=async(...args)=>{await start(...args);control.abort();};
  const result=await provision({plan,ctx,external,io:mocked.io,signal:control.signal});
  assert.equal(result.result,'FAIL');assert.equal(result.release,'CLEANED_AFTER_FAILURE');
  assert.ok(!mocked.events.includes('writeLease'));assert.ok(mocked.events.includes('verifyDestroyed'));
});

test('unsettled child outcome survives an adapter rejection and prevents destructive cleanup',async()=>{
  const mocked=mockIO();mocked.io.start=async()=>{throw Object.assign(Error(secret),{settled:false});};
  const result=await provision({plan,ctx,external,io:mocked.io});
  assert.equal(result.release,'UNCONFIRMED');assert.ok(!mocked.events.includes('stopOwned'));
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('cleanup has one aggregate tail; timeout preserves primary and skips subsequent mutations',async()=>{
  const clock=fakeClock(),mocked=mockIO({clock,core:{...goodCore,result:'FAIL'}});
  mocked.io.restoreStaged=async()=>{mocked.events.push('restoreStaged');await new Promise(()=>{});};
  const pending=provision({plan,ctx,external,io:mocked.io});await until(()=>mocked.events.includes('restoreStaged'));
  clock.advance(plan.timing.cleanupMs);await flush();const result=await pending;
  assert.equal(result.primary.stage,'core-proof');assert.equal(result.release,'UNCONFIRMED');
  assert.ok(result.cleanup.some(x=>x.stage==='staged-restore'));assert.ok(!mocked.events.includes('clearMarker'));
  assert.ok(!mocked.events.includes('stopOwned'));assert.equal(clock.pending(),0);
});

test('cleanup operations share cumulative time rather than restarting a fresh per-step tail',async()=>{
  const clock=fakeClock(),mocked=mockIO({clock});
  const restore=mocked.io.restoreStaged,ports=mocked.io.verifyPortsClosed;
  mocked.io.restoreStaged=async()=>{clock.advance(3000);return restore();};
  mocked.io.verifyPortsClosed=async()=>{clock.advance(3000);return ports();};
  const result=await provision({plan,ctx,external,io:mocked.io});
  assert.equal(result.release,'UNCONFIRMED');assert.ok(result.cleanup.some(x=>x.stage==='process-port-check'));
  assert.ok(!mocked.events.includes('clearMarker'));assert.ok(!mocked.events.includes('stopOwned'));
});

test('cancellation during cleanup preserves owned teardown evidence and can never return connected PASS',async()=>{
  const control=new AbortController(),mocked=mockIO();const restore=mocked.io.restoreStaged;
  mocked.io.restoreStaged=async()=>{control.abort();return restore();};
  const result=await provision({plan,ctx,external,io:mocked.io,signal:control.signal});
  assert.equal(result.result,'FAIL');assert.equal(result.primary.stage,'cancelled');
  assert.equal(result.release,'CLEANED_AFTER_FAILURE');assert.ok(mocked.events.includes('verifyDestroyed'));
});

test('report timeout/late receipt cannot promote cleanup to confirmed evidence',async()=>{
  const clock=fakeClock(),mocked=mockIO({clock});
  mocked.io.release=async()=>{mocked.events.push('release');await new Promise(()=>{});};
  const pending=provision({plan,ctx,external,io:mocked.io});await until(()=>mocked.events.includes('release'));
  clock.advance(plan.timing.reportingMs);await flush();const result=await pending;
  assert.equal(result.result,'FAIL');assert.equal(result.release,'UNCONFIRMED');assert.ok(result.cleanup.some(x=>x.stage==='release-evidence'));
  const record={sha,runId:'123',attempt:'2',release:'CONFIRMED',completedAt:now,
    timing:{cleanupCompletedAt:now,cleanupDeadline:now+500,reportDeadline:now+1000,jobDeadline:now+2000,grantExpiry:now+3000}};
  assert.equal(validateReleaseReceipt(record,{mtimeMs:now},ctx,now),true);
  for(const [value,meta,observed] of [[{...record,sha:'f'.repeat(40)},{mtimeMs:now},now],
    [{...record,completedAt:now+1001},{mtimeMs:now},now],[record,{mtimeMs:now+1001},now],[record,{mtimeMs:now},now+1001]])
    assert.throws(()=>validateReleaseReceipt(value,meta,ctx,observed));
  assert.equal(clock.pending(),0);
});

test('cancellation observed during final reporting still cannot return a proof PASS',async()=>{
  const control=new AbortController(),mocked=mockIO(),release=mocked.io.release;
  mocked.io.release=async(...args)=>{await release(...args);control.abort();};
  const result=await provision({plan,ctx,external,io:mocked.io,signal:control.signal});
  assert.equal(result.result,'FAIL');assert.equal(result.release,'CLEANED_AFTER_FAILURE');assert.equal(result.primary.stage,'cancelled');
});

async function workflow(){return createRequire(import.meta.url)(process.env.CLADORA_YAML_PARSER_PATH??'js-yaml')
  .load(await readFile(new URL('../.github/workflows/database-tests.yml',import.meta.url),'utf8'));}
const predicate=(expression,github)=>runInNewContext(expression.slice(3,-2).trim(),{github});

test('actual YAML predicates and trigger truth table preserve main/PR/manual and isolate only Core feature push',async()=>{
  const w=await workflow(),job=w.jobs[CONTRACT.lane];
  const cases=[['push','refs/heads/main',true,true,false],['push',CONTRACT.ref,true,false,true],
    ['push','refs/heads/other',false,false,false],['push',CONTRACT.ref+'-spoof',false,false,false],
    ['pull_request','refs/pull/1/merge',true,true,false],['workflow_dispatch','refs/heads/main',true,true,false],
    ['workflow_dispatch',CONTRACT.ref,true,true,false],['workflow_dispatch','refs/heads/other',true,true,false]];
  for(const [event_name,ref,triggered,oldRuns,futureProof] of cases){
    const github={event_name,ref,repository:CONTRACT.repository};
    const actualTrigger=Object.hasOwn(w.on,event_name)&&(event_name!=='push'||w.on.push.branches.includes(ref.slice('refs/heads/'.length)));
    assert.equal(actualTrigger,triggered);
    for(const id of ['static-contract','postgres-runtime'])assert.equal(actualTrigger&&predicate(w.jobs[id].if,github),oldRuns);
    assert.equal(predicate(job.if,github),false);
    assert.equal(actualTrigger&&predicate(job.if.replace('false && ',''),github),futureProof);
    assert.equal(predicate(w.concurrency['cancel-in-progress'],github),ref!==CONTRACT.ref);
  }
  assert.equal(job.concurrency['cancel-in-progress'],false);
  assert.ok(!job.concurrency.group.includes('run_id'));assert.ok(!job.concurrency.group.includes('run_attempt'));
  assert.ok(!job.concurrency.group.includes('github.ref')); // One stable repo lane serializes its daemon.
});

test('workflow YAML parses; original filters/suites preserved and Core lane is disabled/ungranted',async()=>{
  const require=createRequire(import.meta.url);
  const yaml=require(process.env.CLADORA_YAML_PARSER_PATH??'js-yaml');
  const current=yaml.load(await readFile(new URL('../.github/workflows/database-tests.yml',import.meta.url),'utf8'));
  const baseline=yaml.load(execFileSync('git',['show','87ddb06877fb31f562ba66477d14f7bc453a17ee:.github/workflows/database-tests.yml'],{encoding:'utf8'}));
  for(const kind of ['pull_request','push'])for(const path of baseline.on[kind].paths)assert.ok(current.on[kind].paths.includes(path));
  assert.deepEqual(current.on.push.branches,[...baseline.on.push.branches,CONTRACT.branch]);assert.deepEqual(current.permissions,baseline.permissions);
  assert.equal(Object.hasOwn(current.on,'workflow_dispatch'),Object.hasOwn(baseline.on,'workflow_dispatch'));
  const oldSteps=baseline.jobs['postgres-runtime'].steps,newSteps=current.jobs['postgres-runtime'].steps;
  assert.equal(newSteps.length,oldSteps.length);
  for(let i=0;i<oldSteps.length;i++){
    if(oldSteps[i].name==='Show service status on failure'){
      assert.equal(newSteps[i].run,'node scripts/provision-building-setup-http-ci.mjs --safe-status');
      assert.equal(newSteps[i].if,oldSteps[i].if);
    }else if(oldSteps[i].name==='Run pgTAP database tests'){
      assert.deepEqual(newSteps[i],{name:oldSteps[i].name,run:'node scripts/run-local-baseline-pgtap.mjs'});
      const {baselineTapFiles}=await import('./run-local-baseline-pgtap.mjs');
      const all=(await readdir('supabase/tests')).filter(name=>name.endsWith('.sql')).sort();
      assert.equal(all.length,219);
      assert.deepEqual(baselineTapFiles(),all.filter(name=>name!=='operations-checklist-command-v2.test.sql').map(name=>'supabase/tests/'+name));
      const runner=await readFile(new URL('./run-local-baseline-pgtap.mjs',import.meta.url),'utf8');
      assert.match(runner,/spawnSync\('supabase',\['test','db','--local','--workdir',project\]/);
      assert.match(runner,/prepareProfile/);
      assert.match(runner,/rmSync\(join\(project,'supabase\/tests\/operations-checklist-command-v2.test.sql'\)\)/);
      assert.match(runner,/status=result\.status\?\?1/);
      assert.match(runner,/process\.exit\(status\)/);
      assert.match(runner,/c4ef35deac1a847b958b72e2c4f411b296ce5d3824e19c80ec647d2092856bf7/);
    }else assert.deepEqual(newSteps[i],oldSteps[i]);
  }
  for(const step of baseline.jobs['static-contract'].steps){
    if(step.uses==='actions/checkout@v4')assert.equal(current.jobs['static-contract'].steps.find(x=>x.uses===step.uses).with['fetch-depth'],0);
    else assert.ok(current.jobs['static-contract'].steps.some(x=>JSON.stringify(x)===JSON.stringify(step)));
  }
  const job=current.jobs['building-setup-core-http'];assert.ok(job.if.startsWith('${{ false && '));
  assert.equal(job.environment,CONTRACT.lane);assert.equal(job.concurrency['cancel-in-progress'],false);
  const checkout=job.steps.find(x=>x.uses==='actions/checkout@v4');assert.equal(checkout.with.ref,CONTRACT.branch);assert.equal(checkout.with['fetch-depth'],0);
  assert.ok(job.steps.some(x=>x.run==='node scripts/provision-building-setup-http-ci.mjs --run'));
  assert.ok(job.steps.some(x=>x.if==='always()'&&x.run.endsWith('--release-evidence')));
  assert.ok(!job.steps.some(x=>x.uses?.startsWith('actions/upload-artifact')));
  assert.ok(!JSON.stringify(job).includes('git checkout -b'));assert.equal(REVIEWED_EXECUTION_PLAN,null);
  assert.equal(job['timeout-minutes']*60000,CONTRACT.jobTimeoutMs);
  assert.equal(job.concurrency.group,'building-setup-core-http-${{ github.repository }}');
});
