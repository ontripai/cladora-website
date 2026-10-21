import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {CONTRACT,REVIEWED_EXECUTION_PLAN,validateGrant,validatePreflight,validateTarget,targetObservations,
  validatePrivateFile,coreReceipt,provision,cli} from './provision-building-setup-http-ci.mjs';

// No network/Docker/DB/Auth/HTTP/file provisioning. Every acquisition and
// teardown below is virtual in-memory I/O; no real lease or marker is created.
const now=Date.parse('2026-10-21T12:00:00Z'),secret='SENSITIVE_SQL_TOKEN_COOKIE_ROW';
const sha='a'.repeat(40),dbId='b'.repeat(64),authId='c'.repeat(64);
const plan={id:'reviewed-plan-fixture',sha,repository:CONTRACT.repository,ref:CONTRACT.ref,
  task:CONTRACT.task,worker:CONTRACT.worker,provisioner:CONTRACT.provisioner,lane:CONTRACT.lane,
  environmentId:22,reviewerId:33,appPort:3100,stackPorts:[54321,54322,54323],stagedOperator:true,
  authImage:'public.ecr.aws/supabase/gotrue:v2.180.0',
  services:[{name:'/supabase_db_cladora-local',image:'public.ecr.aws/supabase/postgres:17.6.1.095',healthRequired:true},
    {name:'/supabase_auth_cladora-local',image:'public.ecr.aws/supabase/gotrue:v2.180.0',healthRequired:true},
    {name:'/supabase_kong_cladora-local',image:'public.ecr.aws/supabase/kong:2.8.1',healthRequired:true}],
  capacity:{driver:'vfs',basis:'reviewed-full-stack-peak-with-driver-amplification',requiredBytes:1000,requiredInodes:20,hostQuotaAvailableBytes:2000,requiredMemoryBytes:1000,requiredCpus:2}};
const ctx={actions:true,job:CONTRACT.lane,repository:CONTRACT.repository,ref:CONTRACT.ref,sha,runId:'123',attempt:'2'};
const external={run:{id:'123',attempt:'2',sha,branch:CONTRACT.branch,workflowPath:'.github/workflows/database-tests.yml'},
  review:{state:'approved',reviewerId:33,environmentId:22,binding:{version:1,run_id:'123',attempt:'2',sha,
    ref:CONTRACT.ref,lane:CONTRACT.lane,task:CONTRACT.task,worker:CONTRACT.worker,provisioner:CONTRACT.provisioner,
    plan_id:plan.id,expires_at:new Date(now+3600000).toISOString(),network:{environment_id:'mock-runner',revision:'1',state:'enforced',current:true,run_id:'123',attempt:'2',snapshot_sha256:'d'.repeat(64)}}}};
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

function mockIO(options={}){
  const events=[],virtual={lease:null,marker:null,resources:false,removed:false};
  const action=async(name,fn=()=>{})=>{events.push(name);if(options.fail?.includes(name))throw Error(secret);return fn();};
  const io={
    now:()=>now,
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
  validatePreflight(plan,observation);
  for(const capacity of [null,{...plan.capacity,requiredBytes:null},{...plan.capacity,requiredInodes:0},
    {...plan.capacity,hostQuotaAvailableBytes:null},{...plan.capacity,hostQuotaAvailableBytes:999},
    {...plan.capacity,driver:'overlay2'},{...plan.capacity,basis:'df-alone'}])
    assert.throws(()=>validatePreflight({...plan,capacity},observation));
  for(const delta of [{availableBytes:999},{availableInodes:0},{memoryBytes:999},{cpus:1}])assert.throws(()=>validatePreflight(plan,{...observation,...delta}));
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

test('actual identity derivation checks full inventory, health, gateway ports and Auth database linkage',()=>{
  const objects=plan.services.map((service,index)=>({name:service.name,image:service.image,id:[dbId,authId,'e'.repeat(64)][index],
    running:true,health:{Status:'healthy'},labels:{'com.supabase.cli.project':'cladora-local'},
    ports:index===0?{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'54322'}]}:index===2?{'8000/tcp':[{HostIp:'127.0.0.1',HostPort:'54321'}]}:{}}));
  const observations={objects,networkIds:objects.map(x=>x.id),status:{DB_URL:'postgresql://postgres:'+secret+'@127.0.0.1:54322/postgres',
    API_URL:'http://127.0.0.1:54321',SERVICE_ROLE_KEY:secret},authDbUrl:'postgresql://auth:'+secret+'@supabase_db_cladora-local:5432/postgres',
    authRouteUrls:['http://supabase_auth_cladora-local:9999/']};
  const safe=targetObservations(plan,observations);validateTarget(plan,safe);assert.ok(!JSON.stringify(safe).includes(secret));
  const unhealthy=clone(objects);unhealthy[1].health.Status='unhealthy';
  const port=clone(objects);port[0].ports['5432/tcp'].push({HostIp:'127.0.0.1',HostPort:'9999'});
  const image=clone(objects);image[1].image='foreign/image:latest';
  for(const delta of [{objects:unhealthy},{objects:port},{objects:image},{networkIds:[dbId,authId]},
    {authRouteUrls:[]},{authRouteUrls:['http://remote.invalid:9999/']},
    {authDbUrl:'postgresql://auth:unused@remote.invalid:5432/postgres'},{objects:[...objects,{...objects[2],id:'f'.repeat(64),name:'/foreign'}]}])
    assert.throws(()=>validateTarget(plan,targetObservations(plan,{...observations,...delta})));
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
  for(const name of ['restoreStaged','settleCore','verifyPortsClosed','clearMarker','stopOwned','verifyDestroyed','removeLease','release'])assert.ok(events.includes(name));
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

test('workflow YAML parses; original filters/suites preserved and Core lane is disabled/ungranted',async()=>{
  const require=createRequire(import.meta.url);
  const yaml=require(process.env.CLADORA_YAML_PARSER_PATH??'js-yaml');
  const current=yaml.load(await readFile(new URL('../.github/workflows/database-tests.yml',import.meta.url),'utf8'));
  const baseline=yaml.load(execFileSync('git',['show','87ddb06877fb31f562ba66477d14f7bc453a17ee:.github/workflows/database-tests.yml'],{encoding:'utf8'}));
  for(const kind of ['pull_request','push'])for(const path of baseline.on[kind].paths)assert.ok(current.on[kind].paths.includes(path));
  assert.deepEqual(current.on.push.branches,baseline.on.push.branches);assert.deepEqual(current.permissions,baseline.permissions);
  const oldSteps=baseline.jobs['postgres-runtime'].steps,newSteps=current.jobs['postgres-runtime'].steps;
  assert.equal(newSteps.length,oldSteps.length);
  for(let i=0;i<oldSteps.length;i++){
    if(oldSteps[i].name==='Show service status on failure'){
      assert.equal(newSteps[i].run,'node scripts/provision-building-setup-http-ci.mjs --safe-status');
      assert.equal(newSteps[i].if,oldSteps[i].if);
    }else assert.deepEqual(newSteps[i],oldSteps[i]);
  }
  for(const step of baseline.jobs['static-contract'].steps){
    if(step.uses==='actions/checkout@v4')assert.equal(current.jobs['static-contract'].steps.find(x=>x.uses===step.uses).with['fetch-depth'],0);
    else assert.ok(current.jobs['static-contract'].steps.some(x=>JSON.stringify(x)===JSON.stringify(step)));
  }
  const job=current.jobs['building-setup-core-http'];assert.equal(job.if,'${{ false }}');
  assert.equal(job.environment,CONTRACT.lane);assert.equal(job.concurrency['cancel-in-progress'],false);
  const checkout=job.steps.find(x=>x.uses==='actions/checkout@v4');assert.equal(checkout.with.ref,CONTRACT.branch);assert.equal(checkout.with['fetch-depth'],0);
  assert.ok(job.steps.some(x=>x.run==='node scripts/provision-building-setup-http-ci.mjs --run'));
  assert.ok(job.steps.some(x=>x.if==='always()'&&x.run.endsWith('--release-evidence')));
  assert.ok(!job.steps.some(x=>x.uses?.startsWith('actions/upload-artifact')));
  assert.ok(!JSON.stringify(job).includes('git checkout -b'));assert.equal(REVIEWED_EXECUTION_PLAN,null);
});
