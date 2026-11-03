import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import {
  TASK,PARENT,ROOT,ROUTE,Cleanup,validateLease,assertContainer,nextEnvironment,browserKey,
  guardedFetch,nextRequest,fixtureSql,snapshot,deniedUnchanged,makeActor,closeOwnedProcess,portLive,createAndRecover,settledRequests,
} from './lib/core-building-setup-http-fixture.mjs';
import {help,buildSetupCommandBody} from './core-building-setup-http-proof.mjs';

// OFFLINE / mounted negative controls only. No product server, real Auth/RPC,
// Docker, PostgreSQL, supplied lease or remote endpoint is invoked by this suite.
const head='a'.repeat(40);
const run='11111111-1111-4111-8111-111111111111';
const valid=()=>({version:1,task:TASK,worker:'CLADORA-CORE-WORKER-01',sha:head,run_id:run,
  lease_id:'building-http-'+run+'-'+head,expires_at:new Date(Date.now()+3600_000).toISOString(),
  project_ref:'cladora-local',app_origin:'http://127.0.0.1:41791',api_origin:'http://127.0.0.1:54321',
  db_port:54322,db_container_id:'1'.repeat(64),auth_container_id:'2'.repeat(64),fixture_prefix:'e3817a32'});
const env=()=>({BUILDING_SETUP_HTTP_EPHEMERAL:'1'});
const gate=(lease=valid(),environment=env())=>validateLease({lease,env:environment,head,projectRef:'cladora-local'});

test('canonical command: actual builder binds every operation to Setup run/revision and stable retry body',()=>{
  const setupRun='22222222-2222-4222-8222-222222222222'; // Distinct from the lease run.
  const base={context_id:'context',workspace_id:'workspace'};
  const operations=['update','rehearse','submit','approve','provision'];
  for(const [i,operation] of operations.entries()) {
    const revision=i+1;
    const extra=operation==='update'?{units:[{code:'1',area_m2:55}]}:
      operation==='approve'?{expected_payload_hash:'a'.repeat(64)}:{};
    const body=buildSetupCommandBody(setupRun,revision,operation,base,extra);
    assert.equal(body.command_key,`setup-${setupRun}-r${revision}-${operation}`);
    assert.equal(body.expected_revision,revision);
    assert.deepEqual(body,{...base,...extra,expected_revision:revision,command_key:body.command_key});
    assert.deepEqual(buildSetupCommandBody(setupRun,revision,operation,base,extra),body);
    assert.ok(!body.command_key.includes(run),'must not bind the lease UUID');
  }
  assert.deepEqual(base,{context_id:'context',workspace_id:'workspace'});
});

test('canonical command: concurrent edits, winner collision, stale revision and revoked replay retain intent',()=>{
  const update=suffix=>buildSetupCommandBody(run,1,'update',{}, {units:[{code:'1',area_m2:55}]},suffix);
  const a=update('a'),b=update('b');
  assert.notEqual(a.command_key,b.command_key);
  for(const winner of [a,b]) {
    const retried=update(winner.command_key.endsWith('-a')?'a':'b');
    assert.deepEqual(retried,winner);
    const collision={...retried,units:[{code:'1',area_m2:50}]};
    assert.equal(collision.command_key,winner.command_key);
    assert.notDeepEqual(collision,winner);
  }
  const stale=update('stale');
  assert.ok(stale.command_key.startsWith(`setup-${run}-r1-`));
  assert.equal(stale.expected_revision,1,'stale request must not silently advance to current revision 2');
  const provision=()=>buildSetupCommandBody(run,5,'provision',{});
  assert.deepEqual(provision(),provision(),'exact replay after success/revoke must retain key/body');
});

test('canonical command: source guard rejects old bh format, wrong run and wrong revision',async()=>{
  const source=await readFile(new URL('supabase/migrations/20261021123054_building_setup_attempt_version_v2.sql',ROOT),'utf8');
  assert.ok(source.includes("p_command_key not like 'setup-'||p_run_id::text||'-r'||p_expected_revision::text||'-%'"));
  const lexical=new RegExp(source.match(/p_command_key !~ '([^']+)'/)[1]);
  const body=buildSetupCommandBody(run,4,'approve',{});
  assert.ok(lexical.test(body.command_key));
  assert.ok(body.command_key.startsWith(`setup-${run}-r4-`));
  for(const key of ['bh-'+run+'-approve-r4',
    buildSetupCommandBody('22222222-2222-4222-8222-222222222222',4,'approve',{}).command_key,
    buildSetupCommandBody(run,3,'approve',{}).command_key]) {
    assert.ok(lexical.test(key),'negative control is lexically valid but misbound');
    assert.ok(!key.startsWith(`setup-${run}-r4-`));
  }
});

test('canonical command: lexical/128-character bounds and invalid builder inputs',async()=>{
  const source=await readFile(new URL('supabase/migrations/20261021123054_building_setup_attempt_version_v2.sql',ROOT),'utf8');
  const lexical=new RegExp(source.match(/p_command_key !~ '([^']+)'/)[1]);
  const build=suffix=>buildSetupCommandBody(run,2147483647,'update',{}, {},suffix);
  const prefixLength=build('x').command_key.length-1;
  const maximum=build('x'.repeat(128-prefixLength));
  assert.equal(maximum.command_key.length,128);assert.ok(lexical.test(maximum.command_key));
  assert.ok(lexical.test(build('AZaz09._:-').command_key));
  assert.throws(()=>build('x'.repeat(129-prefixLength)),/BH_COMMAND_KEY_LENGTH/);
  for(const suffix of ['bad space','bad/slash','bad%','é','\n','bad\n',123])
    assert.throws(()=>build(suffix),/BH_COMMAND_SUFFIX/);
  assert.throws(()=>buildSetupCommandBody('not-a-uuid',1,'update',{}),/BH_COMMAND_RUN/);
  assert.throws(()=>buildSetupCommandBody(run+'\n',1,'update',{}),/BH_COMMAND_RUN/);
  for(const revision of [0,-1,1.5,'1',2147483648])
    assert.throws(()=>buildSetupCommandBody(run,revision,'update',{}),/BH_COMMAND_REVISION/);
  assert.throws(()=>buildSetupCommandBody(run,1,'invented',{}),/BH_COMMAND_OPERATION/);
});

test('valid exact task/SHA/loopback lease is copied and frozen',()=>{
  const lease=valid();const result=gate(lease);assert.ok(Object.isFrozen(result));
  lease.sha='b'.repeat(40);assert.equal(result.sha,head);
});
const mutations=[
  ['missing opt-in',(l,e)=>delete e.BUILDING_SETUP_HTTP_EPHEMERAL],
  ['wrong task',l=>l.task='OTHER'],
  ['wrong worker',l=>l.worker='OTHER'],
  ['wrong SHA',l=>l.sha='b'.repeat(40)],
  ['forged lease ID',l=>l.lease_id='unbound'],
  ['expired lease',l=>l.expires_at=new Date(Date.now()-1000).toISOString()],
  ['unbounded lease',l=>l.expires_at=new Date(Date.now()+5*3600_000).toISOString()],
  ['invalid expiry',l=>l.expires_at='never'],
  ['non-string lease field',l=>l.expires_at=[l.expires_at]],
  ['wrong project',l=>l.project_ref='production'],
  ['remote Auth',l=>l.api_origin='https://example.supabase.co'],
  ['remote Next',l=>l.app_origin='https://example.com'],
  ['credential-bearing Next',l=>l.app_origin='http://user:password@127.0.0.1:41791'],
  ['path-bearing origin',l=>l.app_origin+='/path'],
  ['trailing slash origin',l=>l.app_origin+='/'],
  ['privileged port',l=>l.app_origin='http://127.0.0.1:80'],
  ['wrong Auth port',l=>l.api_origin='http://127.0.0.1:54320'],
  ['database endpoint override',l=>l.db_port=64322],
  ['Next DB port collision',l=>l.app_origin='http://127.0.0.1:54322'],
  ['unknown lease field',l=>l.database_url='postgresql://remote/db'],
  ['unknown harness env',(l,e)=>e.BUILDING_SETUP_HTTP_RPC_URL='http://remote.invalid'],
  ['Production env',(l,e)=>e.NODE_ENV='production'],
  ['Vercel env',(l,e)=>e.VERCEL='1'],
  ['Docker override',(l,e)=>e.DOCKER_HOST='tcp://remote.invalid:2375'],
  ['Node loader override',(l,e)=>e.NODE_OPTIONS='--import untrusted'],
  ['TLS disable',(l,e)=>e.NODE_TLS_REJECT_UNAUTHORIZED='0'],
  ['short container ID',l=>l.db_container_id='1234'],
  ['same DB/Auth container',l=>l.auth_container_id=l.db_container_id],
  ['reserved shared fixture prefix',l=>l.fixture_prefix='c2200000'],
  ['SQL namespace injection',l=>l.fixture_prefix="x';drop"],
  ['unknown injection flag',(l,e)=>e.BUILDING_SETUP_HTTP_INJECT_FAILURE='arbitrary'],
];
for(const [name,change] of mutations)test('fail closed: '+name,()=>{
  const l=valid(),e=env();change(l,e);assert.throws(()=>gate(l,e),/^Error: BH_/);
});
test('official container identity: exact ID, project, image, running and port',()=>{
  const l=valid();
  const p={id:l.db_container_id,running:true,labels:{'com.supabase.cli.project':'cladora-local'},
    image:'public.ecr.aws/supabase/postgres:17.6.1.095',ports:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'54322'}]}};
  assertContainer(p,l.db_container_id,l.project_ref,'db');
  for(const bad of [{...p,id:l.auth_container_id},{...p,running:false},{...p,labels:{}},
    {...p,image:'mirror.invalid/postgres:17'},{...p,ports:{}}])
    assert.throws(()=>assertContainer(bad,l.db_container_id,l.project_ref,'db'),/^Error: BH_/);
});
test('browser-safe key gate refuses service-role JWT/secret key',()=>{
  const jwt=role=>'e30.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.fixture';
  assert.equal(browserKey(jwt('anon')),jwt('anon'));
  assert.throws(()=>browserKey(jwt('service_role')),/BH_PUBLIC_KEY/);
  assert.throws(()=>browserKey('sb_secret_fixture_never_publish'),/BH_PUBLIC_KEY/);
});
test('Next child gets only public local config and preserved proxy/CA controls',()=>{
  const ambient={PATH:'/bin',HOME:'/tmp',HTTP_PROXY:'http://proxy:8080',NO_PROXY:'127.0.0.1',
    NODE_EXTRA_CA_CERTS:'/trusted/ca.pem',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_SENTINEL',
    DATABASE_URL:'PRIVATE_SENTINEL',VERCEL_TOKEN:'PRIVATE_SENTINEL',NODE_OPTIONS:'PRIVATE_SENTINEL'};
  const child=nextEnvironment(ambient,valid(),'sb_publishable_fixture_key');
  assert.equal(child.HTTP_PROXY,ambient.HTTP_PROXY);assert.equal(child.NO_PROXY,ambient.NO_PROXY);
  assert.equal(child.NODE_EXTRA_CA_CERTS,ambient.NODE_EXTRA_CA_CERTS);
  assert.equal(child.NEXT_PUBLIC_SUPABASE_URL,valid().api_origin);
  assert.ok(!JSON.stringify(child).includes('PRIVATE_SENTINEL'));
  assert.throws(()=>nextEnvironment(ambient,valid(),'sb_secret_never_publish'),/BH_PUBLIC_KEY/);
});
test('cleanup is LIFO, continues after injected failure, and is idempotent',async()=>{
  const cleanup=new Cleanup();const events=[];
  cleanup.add('POOL',async()=>events.push('pool'));
  cleanup.add('AUTH',async()=>events.push('auth'));
  cleanup.add('AUTHORITY',async()=>{events.push('authority');throw Error('injected sensitive error');});
  cleanup.add('NEXT',async()=>events.push('next'));
  await assert.rejects(cleanup.close(),/BH_CLEANUP_FAILED/);
  assert.deepEqual(events,['next','authority','auth','pool']);
  await cleanup.close();assert.equal(events.length,4);
});
test('parallel request failure waits for the other owned request before cleanup',async()=>{
  let finish;let completed=false;let returned=false;
  const pending=new Promise(resolve=>{finish=()=>{completed=true;resolve('done');};});
  const result=settledRequests([Promise.reject(Error('injected')),
    pending]).catch(error=>{returned=true;assert.equal(completed,true);assert.equal(error.message,'BH_PARALLEL_HTTP');});
  await Promise.resolve();await Promise.resolve();assert.equal(returned,false);
  finish();await result;assert.equal(returned,true);
});
test('partial real-Auth setup registers owned user cleanup before MFA can fail (mock SDK control)',async()=>{
  const events=[];const cleanup=new Cleanup();const owned=[];
  const user='22222222-2222-4222-8222-222222222222';
  const fakeClient=()=>({auth:{
    admin:{createUser:async()=>({data:{user:{id:user}},error:null}),
      signOut:async()=>{events.push('signout');return {error:null};},
      deleteUser:async id=>{assert.equal(id,user);events.push('delete');return {data:{},error:null};}},
    signInWithPassword:async()=>({data:{session:{access_token:'MOCK_OFFLINE_ONLY'}},error:null}),
    mfa:{enroll:async()=>({error:{message:'private SDK error must not escape CLI'}})},
    signOut:async()=>{events.push('local');return {error:null};}
  }});
  await assert.rejects(makeActor({lease:valid(),status:{ANON_KEY:'offline',SERVICE_ROLE_KEY:'offline'},
    createClient:fakeClient,createServerClient:(url,key,options)=>({auth:{setSession:async()=>{
      options.cookies.setAll([{name:'offline-mocked-cookie',value:'opaque'}]);return {data:{},error:null};
    }}}),
    cleanup,label:'operator',onCreated:r=>owned.push(r)}),/BH_AUTH_ENROLL/);
  assert.deepEqual(owned,[{userId:user}]);
  await cleanup.close();assert.deepEqual(events,['signout','local','delete']);
});
test('canonical fixture adaptation keeps preconditions/triggers, excludes fake claims and legacy inserts',async()=>{
  const source=await readFile(new URL('supabase/tests/fixtures/building_setup_authority_v2.inc',ROOT),'utf8');
  const actors=['operator','manager','reviewer','outsider'].map((label,i)=>({
    userId:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),
    email:'bh-'+run+'-'+label+'@fixture.invalid'}));
  const sql=fixtureSql(source,valid(),actors);
  assert.match(sql,/building_setup_fixture_collision/);
  assert.match(sql,/building_setup_existing_independent_manager_permissions_missing/);
  assert.match(sql,/primary_admin_membership_id/);
  assert.match(sql,/e3817a32-0000-4000-8000-/);
  assert.match(sql,/as \$\$select case n[\s\S]*?end\$\$;/,'dollar quoting must survive JavaScript replacement');
  actors.forEach(actor=>assert.ok(sql.includes(actor.userId)));
  for(const index of [0,2]) assert.ok(sql.includes(actors[index].email));
  assert.doesNotMatch(sql,/insert into auth\.users|set_config\('request.jwt.claims|authority_policy_version\s*=\s*1|disable trigger|disable row level/i);
  assert.throws(()=>fixtureSql(source.replace("insert into bs_state select 'module'",'invalid'),valid(),actors),/BH_FIXTURE_BOUNDARY/);
});
function fakePool() {
  const state={digest:'before',released:0};
  return {state,connect:async()=>({query:async sql=>({
    rows:sql.startsWith('select count')?[{n:1,digest:state.digest}]:[]
  }),release:()=>state.released++})};
}
test('denied-write fingerprint catches same-count content mutation (negative control)',async()=>{
  const pool=fakePool();
  await deniedUnchanged(pool,async()=>({status:403}),403);
  await assert.rejects(deniedUnchanged(pool,async()=>{pool.state.digest='changed';return {status:403};},403));
  assert.equal(pool.state.released,4);
  const state=await snapshot(pool);assert.ok(Object.hasOwn(state,'audit.events'));
  assert.ok(Object.hasOwn(state,'finance.journals'));assert.ok(Object.hasOwn(state,'platform.outbox_events'));
});
async function mountedServer(fn,runTest) {
  const server=createServer((request,response)=>{
    response.setHeader('connection','close');
    fn(request,response);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try {await runTest('http://127.0.0.1:'+server.address().port);}
  finally {await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('real HTTP redirect and remote request rejection do not follow credentials (mounted safety only)',async()=>{
  let calls=0;
  await mountedServer((req,res)=>{calls++;res.writeHead(302,{location:'https://remote.invalid'});res.end();},async origin=>{
    await assert.rejects(guardedFetch(origin)(origin+'/'),/BH_REDIRECT/);
    await assert.rejects(guardedFetch(origin)('https://remote.invalid/'),/BH_FETCH_TARGET/);
  });
  assert.equal(calls,1);
});
test('discarded response is recovered by same-key read, with one effect (mounted algorithm, NOT connected)',async()=>{
  const attempts=new Map();let effects=0;
  await mountedServer((req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.method==='POST') {
      let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{
        const {idempotency_key:key}=JSON.parse(raw);
        if(!attempts.has(key)){effects++;attempts.set(key,{run_id:run});}
        res.writeHead(201);res.end(JSON.stringify(attempts.get(key)));
      });
    } else {
      const key=new URL(req.url,'http://127.0.0.1').searchParams.get('idempotency_key');
      res.end(JSON.stringify({attempt:attempts.get(key)??null}));
    }
  },async origin=>{
    const lease={...valid(),app_origin:origin};
    const query=ROUTE+'?idempotency_key=mounted-key';
    assert.equal((await nextRequest(lease,'',{path:query})).data.attempt,null);
    assert.deepEqual(await nextRequest(lease,'',{method:'POST',body:{idempotency_key:'mounted-key'},discard:true}),
      {outcome:'AMBIGUOUS'});
    assert.equal((await nextRequest(lease,'',{path:query})).data.attempt.run_id,run);
    assert.equal(effects,1);
    await assert.rejects(nextRequest(lease,'',{path:'https://remote.invalid'+ROUTE}),/BH_ROUTE_TARGET/);
  });
});

for(const committed of [true,false])test('transport loss '+(committed?'after commit':'before effect')+' recovers with bounded original key (mounted only)',async()=>{
  const attempts=new Map();let dropped=false;let effects=0;const calls=[];
  await mountedServer((req,res)=>{
    res.setHeader('content-type','application/json');
    calls.push(req.method);
    if(req.method==='POST') {
      let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{
        const {idempotency_key:key,workspace_id:workspace}=JSON.parse(raw);
        if(!dropped) {
          dropped=true;
          if(committed){attempts.set(key,{run_id:run,workspace_id:workspace});effects++;}
          req.socket.destroy(); // Actual local test transport interruption, no product server.
          return;
        }
        if(!attempts.has(key)){attempts.set(key,{run_id:run,workspace_id:workspace});effects++;}
        res.writeHead(201);res.end(JSON.stringify(attempts.get(key)));
      });
    } else {
      const key=new URL(req.url,'http://127.0.0.1').searchParams.get('idempotency_key');
      res.end(JSON.stringify({attempt:attempts.get(key)??null}));
    }
  },async origin=>{
    const input={context_id:run,workspace_id:run,idempotency_key:'original-mounted-key',payload:{synthetic:true}};
    const recovered=await createAndRecover({...valid(),app_origin:origin},'',input);
    assert.equal(recovered.run_id,run);assert.equal(effects,1);
    assert.deepEqual(calls,committed?['POST','GET']:['POST','GET','POST','GET']);
    assert.deepEqual([...attempts.keys()],['original-mounted-key']);
  });
});
test('CLI refuses ungated runtime before dependency import/stack/Auth and emits no ambient secrets',()=>{
  const result=spawnSync(process.execPath,[new URL('scripts/core-building-setup-http-proof.mjs',ROOT).pathname,'--run'],{
    encoding:'utf8',env:{PATH:process.env.PATH,BUILDING_SETUP_HTTP_EPHEMERAL:'0',
      SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_SENTINEL'},timeout:10000});
  assert.equal(result.status,1);
  const out=JSON.parse(result.stdout.trim());
  assert.equal(out.failure,'BH_EPHEMERAL_OPT_IN');assert.equal(out.connected,'NOT_RUN_NOT_PASS');
  assert.equal(out.cleanup,'NOT_REQUIRED_NO_RESOURCES_ACQUIRED');
  assert.ok(!(result.stdout+result.stderr).includes('PRIVATE_SENTINEL'));
});
test('injected consumer error gracefully closes only its owned process/port (mounted control)',async()=>{
  await mountedServer((req,res)=>{res.writeHead(200);res.end('unrelated');},async foreign=>{
    const child=spawn(process.execPath,['-e',
      "const s=require('node:http').createServer((q,r)=>r.end('fixture'));s.listen(0,'127.0.0.1',()=>console.log(s.address().port));process.once('SIGTERM',()=>s.close(()=>process.exit(0)));"],
      {detached:true,stdio:['ignore','pipe','pipe']});
    child.stderr.resume();
    const port=await new Promise((resolve,reject)=>{
      child.once('error',reject);child.stdout.once('data',data=>resolve(Number(String(data).trim())));
    });
    assert.ok(await portLive(port));
    const cleanup=new Cleanup();cleanup.add('OWNED_PROCESS',()=>closeOwnedProcess(child,port));
    try {throw Error('injected consumer error');}
    catch(error){assert.equal(error.message,'injected consumer error');}
    finally {await cleanup.close();}
    assert.equal(await portLive(port),false);
    assert.equal((await guardedFetch(foreign)(foreign)).status,200);
  });
});
test('source scope/flow controls: real shipped routes, no fake authorization or force cleanup',async()=>{
  const main=await readFile(new URL('scripts/core-building-setup-http-proof.mjs',ROOT),'utf8');
  const fixture=await readFile(new URL('scripts/lib/core-building-setup-http-fixture.mjs',ROOT),'utf8');
  assert.ok(help().includes(PARENT));
  for(const part of ['ambiguous-create-recovery','concurrent-creation-and-key-collision','concurrent-revision',
    'rehearse-submit-approval-snapshot','reviewer-revoke-replay','operator-revoke-recovery-replay'])
    assert.ok(main.includes(part));
  assert.match(main,/DATABASE_LEASE/);assert.match(main,/deniedUnchanged/);
  assert.match(fixture,/assign_workspace_role_v2/);assert.match(fixture,/getAuthenticatorAssuranceLevel/);
  assert.match(fixture,/challengeAndVerify/);assert.match(fixture,/createServerClient/);
  const executable=(main+fixture).replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(executable,/['"]SIGKILL['"]|pg_terminate_backend|drop database|disable trigger|disable row level|raw_user_meta_data/);
  assert.doesNotMatch(main+fixture,/\.query\([^)]*set_config\(['"]request\.jwt\.claims/);
  assert.match(main,/NOT_RUN_NOT_PASS/);
  for(const path of ['src/app/api/customer/v1/onboarding/building-setup/route.ts',
    'src/app/api/customer/v1/onboarding/building-setup/[id]/route.ts',
    'src/app/api/customer/v1/onboarding/building-setup/[id]/[action]/route.ts']) {
    const source=await readFile(new URL(path,ROOT),'utf8');
    assert.match(source,/supabase\.schema\(["']customer_api["']\)\.rpc/);
    assert.match(source,/_building_setup_(?:v2|attempt_v2|units_v2)/);
  }
});
