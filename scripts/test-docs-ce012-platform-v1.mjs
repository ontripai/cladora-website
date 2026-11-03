import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, PassThrough } from 'node:stream';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { admit, seal, canonical, sha, validateDescriptor, verifyMaterials, pin, HISTORICAL,
  CASES, EFFECTS, LIMITS, TABLES, SEQUENCES, DIR, ENTRY, prerequisite } from './docs-ce012-platform-v1/contract.mjs';
import { Custody, checkView, Ledger } from './docs-ce012-platform-v1/custody.mjs';
import { NamespaceStream, authFetch, verifyIssuedSession, bindPg } from './docs-ce012-platform-v1/transport.mjs';
import { evaluateResult, admitProducer, preflightProducer } from './docs-ce012-platform-v1/worker.mjs';

const H='a'.repeat(64),J='b'.repeat(64),COMMIT='c'.repeat(40),now=Date.now();
const pinOf=b=>({bytes:Buffer.byteLength(b),sha256:sha(b)});
function fixture(){
  const s=seal(),d={format:'platform-owned-pg-auth-fixture.v1',run_id:'cladora-lane-'+'a'.repeat(12),
    attempt_id:'b'.repeat(32),custody_nonce:'c'.repeat(32),profile_sha256:s.files['supabase/local-profiles/runtime-lane-v1.json'],
    platform_seal_sha256:s.sha256,pg_cid:'d'.repeat(64),auth_cid:'e'.repeat(64),
    pg_name:'cladora-lane-'+'a'.repeat(12)+'-pg',auth_name:'cladora-lane-'+'a'.repeat(12)+'-auth',
    pg_config_sha256:H,auth_config_sha256:H,database:'docs_ce012_'+'f'.repeat(16),database_oid:'123',system_identifier:'456',
    auth_origin:'http://127.0.0.1:9999',auth_issuer:'http://127.0.0.1:9999',auth_user_path:'/user',
    observer_role:'docs_observer',conflict_role:'docs_conflict',synthetic_subject:'11111111-1111-4111-8111-111111111111',
    exclusive_fixture:true,synthetic_only:true,owner_uid:process.getuid(),created_at:new Date(now-1000).toISOString(),
    expires_at:new Date(now+60000).toISOString()};
  const views={};for(const role of ['pg','auth']){
    const v={id:d[`${role}_cid`],name:'/'+d[`${role}_name`],image:role==='pg'?
      'sha256:99445113a4a19e82dd3713c65bd9f6fb5bf972065ab043df8d1e1c93e957da9a':
      'sha256:1181bff5ba4ce440013a63cef9f4cf13024c432d705c9b1fbc9e5b949e852f48',
      user:'999:999',labels:{'cladora.runtime.run':d.run_id},running:true,
      host:{ReadonlyRootfs:true,NetworkMode:role==='pg'?'none':`container:${d.pg_cid}`,Privileged:false,
        PortBindings:{},Binds:null,VolumesFrom:null,CapAdd:null,CapDrop:['ALL'],SecurityOpt:['no-new-privileges:true'],
        PidMode:'',Devices:[],DeviceRequests:[],ExtraHosts:null,Links:null,Memory:536870912,NanoCpus:500000000,PidsLimit:128,
        Tmpfs:Object.fromEntries((role==='pg'?['/tmp','/var/lib/postgresql/data','/var/run/postgresql']:['/tmp']).map(x=>[x,'pinned-options']))},
      mounts:[],ports:{'5432/tcp':null}};
    d[`${role}_config_sha256`]=sha(Buffer.from(canonical(v)));views[role]=v;
  }
  const pre={};for(const k of ['installation','fixture','committed_receipt'])pre[k]={kind:k,producer_head:COMMIT,
    payload_sha256:H,evidence_sha256:J,run_id:d.run_id,attempt_id:d.attempt_id,pg_cid:d.pg_cid,auth_cid:d.auth_cid,
    database_oid:d.database_oid,system_identifier:d.system_identifier,state:'ACKNOWLEDGED',commit_ack:true};
  const input={format:'docs-ce012-platform-invocation.v1',consumer:'Documents/CE012',source_head:COMMIT,
    request:{bytes:10,sha256:H},inventory:{bytes:11,sha256:J},closure:{bytes:12,sha256:'f'.repeat(64)},
    plan:{bytes:13,sha256:'1'.repeat(64)},descriptor:d,prerequisites:pre,platform_seal_sha256:s.sha256};
  const binding={format:'docs-ce012-pgauth-binding.v1',accepted:{head:COMMIT,request:input.request,inventory:input.inventory,
    closure:input.closure,artifacts:[]}};
  const digest=sha(Buffer.from(canonical(input))),record={invocation_sha256:digest,seal_sha256:s.sha256,source_head:COMMIT,
    descriptor_sha256:sha(Buffer.from(canonical(d))),plan_sha256:input.plan.sha256,expires_at:d.expires_at,
    review:'https://github.com/ontripai/cladora-website/issues/463#issuecomment-1',coordinator_key_sha256:H,
    prerequisites:Object.fromEntries(Object.entries(pre).map(([k,v])=>[k,sha(Buffer.from(canonical(v)))])),single_use:true};
  const reviews={[digest]:record},opts={binding,reviews,now,currentSeal:s};
  return {input,binding,reviews,record,opts,views,s};
}
function guardFixture(extra={}){
  const f=fixture(),admitted=admit(f.input,f.opts);let time=now;
  const ledger={events:[],append(e){this.events.push(e);}};
  const guard=new Custody(admitted,{clock:()=>time,inspector:cid=>cid===f.input.descriptor.pg_cid?f.views.pg:f.views.auth,
    reseal:()=>f.s,recheck:()=>admitted,ledger,...extra});
  return {...f,guard,ledger,setTime:v=>{time=v;}};
}
function fails(fn,code){assert.throws(fn,e=>e.code===code);}

test('positive exact Documents admission, closed production registry and no Core alias',()=>{
  const f=fixture();assert.ok(admit(f.input,f.opts).identity);
  fails(()=>admit({...f.input,consumer:'Core/ACL-PROJECTION-02'},f.opts),'DOCUMENTS_CONSUMER_ONLY');
  fails(()=>admit(f.input,{...f.opts,reviews:{}}),'PLATFORM_REVIEW_MISSING');
  fails(()=>admit({...f.input,source_head:HISTORICAL.head},f.opts),'HISTORICAL_REQUEST_NOT_EXECUTABLE');
  fails(()=>admit({...f.input,request:{bytes:2456,sha256:HISTORICAL.request_sha256}},f.opts),'HISTORICAL_REQUEST_NOT_EXECUTABLE');
  fails(()=>admit(f.input,{...f.opts,binding:{format:'docs-ce012-pgauth-binding.v1',accepted:null}}),
    'NOT_READY_DOCUMENTS_LIVE_SCOPE_04_ACCEPTED_SHA_REQUEST_CLOSURE');
});
test('review expiry including equal-now and no authority from approved/URL/self-signature',()=>{
  const f=fixture();fails(()=>admit(f.input,{...f.opts,now:Date.parse(f.record.expires_at)}),'PLATFORM_REVIEW_EXPIRED');
  for(const key of ['approved','signature','review','sql','path','shell','exec'])fails(()=>admit({...f.input,[key]:'anything'},f.opts),'SHAPE');
  const review={...f.record,review:'https://example.com/review'};
  fails(()=>admit(f.input,{...f.opts,reviews:{[f.record.invocation_sha256]:review}}),'PLATFORM_REVIEW_BINDING');
});
test('source/request/inventory/closure/plan/profile/envelope mismatch rejects',()=>{
  const f=fixture();
  for(const key of ['request','inventory','closure'])fails(()=>admit({...f.input,[key]:{bytes:1,sha256:J}},f.opts),'ACCEPTED_PRODUCER_BINDING');
  fails(()=>admit({...f.input,platform_seal_sha256:J},f.opts),'PLATFORM_SEAL_CHANGED');
  fails(()=>admit({...f.input,plan:{bytes:1,sha256:J}},f.opts),'PLATFORM_REVIEW_MISSING');
  fails(()=>admit({...f.input,descriptor:{...f.input.descriptor,profile_sha256:J}},f.opts),'PROFILE_OR_DESCRIPTOR_SEAL');
});
test('typed PG/Auth target, issuer, exclusive custody and unsafe roles reject',()=>{
  const d=fixture().input.descriptor;validateDescriptor(d);
  for(const [key,value,code] of [['auth_cid',d.pg_cid,'PG_AUTH_CUSTODY_REQUIRED'],['database','postgres','DATABASE_IDENTITY'],
    ['auth_origin','https://staging.example','AUTH_ORIGIN_ISSUER'],['auth_issuer','http://elsewhere','AUTH_ORIGIN_ISSUER'],
    ['observer_role','service_role','OBSERVER_ROLE'],['conflict_role','postgres','CONFLICT_ROLE'],['exclusive_fixture',false,'PLATFORM_OWNERSHIP']]){
    fails(()=>validateDescriptor({...d,[key]:value}),code);
  }
});
test('installer/fixture/committed-receipt missing, wrong-run and no commit ACK are NOT_READY',()=>{
  const f=fixture();
  for(const kind of ['installation','fixture','committed_receipt']){
    let input=structuredClone(f.input);input.prerequisites[kind].commit_ack=false;
    // Exact registry hash changes; producer acknowledgement is never inferred from a flag.
    fails(()=>admit(input,f.opts),'PLATFORM_REVIEW_MISSING');
    input=structuredClone(f.input);delete input.prerequisites[kind];
    const digest=sha(Buffer.from(canonical(input))),r={...f.record,invocation_sha256:digest};
    fails(()=>admit(input,{...f.opts,reviews:{[digest]:r}}),'SHAPE');
  }
});
test('effect currentness rechecked after await and fsync/inspection; equal expiry blocks operation',async()=>{
  const f=guardFixture();let effects=0;
  f.guard.effect('valid',()=>effects++);assert.equal(effects,1);
  await assert.rejects(f.guard.verified('await',async()=>{f.setTime(f.guard.admitted.ceiling);return 1;}),{code:'AUTHORIZATION_EXPIRED'});
  fails(()=>f.guard.effect('no-renew',()=>effects++),'HOST_QUARANTINED');assert.equal(effects,1);
  const g=guardFixture();g.ledger.append=()=>g.setTime(g.guard.admitted.ceiling);
  fails(()=>g.guard.effect('fsync',()=>assert.fail('must not dispatch')),'AUTHORIZATION_EXPIRED');
});
test('live custody lost: all lanes stop and first error is retained',()=>{
  const f=guardFixture();f.views.auth.running=false;
  fails(()=>f.guard.effect('connect',()=>assert.fail('no connect')),'LOST_CUSTODY');
  assert.equal(f.guard.primary,'LOST_CUSTODY');
  fails(()=>f.guard.effect('other-lane',()=>assert.fail('no dispatch')),'HOST_QUARANTINED');
  assert.equal(f.guard.primary,'LOST_CUSTODY');
});
test('config/ports/network/mount/security drift fail closed',()=>{
  for(const change of [v=>v.host.NetworkMode='bridge',v=>v.ports={'5432/tcp':[{HostPort:'5432'}]},
    v=>v.host.Binds=['/x:/x'],v=>v.host.CapAdd=['SYS_ADMIN'],v=>v.mounts=[{Type:'bind',Destination:'/x'}],
    v=>v.host.SecurityOpt.push('seccomp=unconfined')]){
    const f=fixture();change(f.views.pg);assert.throws(()=>checkView(f.views.pg,'pg',f.input.descriptor));
  }
});
test('material/review drift at point of effect prevents any dispatch',()=>{
  const f=guardFixture({materialCheck:()=>{throw Object.assign(new Error(),{code:'CHANGED'});}});
  assert.throws(()=>f.guard.effect('query',()=>assert.fail('no query')));
  const g=guardFixture();g.guard.recheck=()=>({...g.guard.admitted,identity:'changed'});
  fails(()=>g.guard.effect('connect',()=>assert.fail('no connect')),'REVIEW_CHANGED');
});
test('connection lifetime cap 5 and quarantine on exhausted cap',()=>{
  const f=guardFixture();for(let i=0;i<5;i++)f.guard.connection();
  fails(()=>f.guard.connection(),'CONNECTION_LIMIT');assert.equal(f.guard.connections,5);
});
test('private ledger ordered/hash-chained and bounded capacity before write',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'ce012-ledger-'));
  try{const file=path.join(dir,'ledger');const ledger=new Ledger(file);
    ledger.append({phase:'rollback-ack'});ledger.append({phase:'ready-I'});ledger.close();
    const rows=readFileSync(file,'utf8').trim().split('\n');
    assert.equal(JSON.parse(rows[1]).previous,sha(Buffer.from(rows[0])));
    const limit=new Ledger(path.join(dir,'limited'));limit.maximum=1;
    fails(()=>limit.append({phase:'write'}),'UNKNOWN_LEDGER_CAPACITY');
    assert.equal(readFileSync(path.join(dir,'limited')).length,0);limit.close();
  }finally{rmSync(dir,{recursive:true});}
});
test('ACK persistence failure quarantines before next effect; terminal evidence remains separate',()=>{
  const f=guardFixture();f.guard.ledger={append(){throw new Error('disk-full');}};
  assert.throws(()=>f.guard.terminal({phase:'native-ready'}));assert.equal(f.guard.quarantined,true);
  fails(()=>f.guard.effect('next',()=>assert.fail('no send')),'HOST_QUARANTINED');
  const g=guardFixture();g.setTime(g.guard.admitted.ceiling);
  fails(()=>g.guard.effect('expired',()=>{}),'AUTHORIZATION_EXPIRED');
  g.guard.terminal({phase:'already-received-error'});assert.equal(g.ledger.events.length,1);
});
test('private session channel cannot bind other actor/run, fake AAL or service-role fallback',async()=>{
  const f=guardFixture(),d=f.input.descriptor,p={format:'platform-issued-fixture-session.v1',run_id:d.run_id,
    attempt_id:d.attempt_id,synthetic_subject:d.synthetic_subject,token:'unit-fixture-opaque-token-only-no-live-signature'};
  const verify=async()=>({source:'supabase_verified_session',actor_id:d.synthetic_subject,assurance_level:'aal2',expires_at:Math.floor(now/1000)+60});
  assert.equal((await verifyIssuedSession(d,p,verify,{},f.guard)).assurance_level,'aal2');
  await assert.rejects(verifyIssuedSession(d,{...p,run_id:'other'},verify,{},f.guard),{code:'BOUND_PLATFORM_SESSION_REQUIRED'});
  for(const result of [{actor_id:'other'},{assurance_level:'aal1'},{source:'user_metadata'},{source:'service_role'}]){
    await assert.rejects(verifyIssuedSession(d,p,async()=>({...await verify(),...result}),{},f.guard),{code:'CURRENT_SYNTHETIC_AAL2_REQUIRED'});
  }
});
test('Auth verification failure/current session rejection is not swallowed',async()=>{
  const f=guardFixture(),d=f.input.descriptor,p={format:'platform-issued-fixture-session.v1',run_id:d.run_id,
    attempt_id:d.attempt_id,synthetic_subject:d.synthetic_subject,token:'unit-token-no-real-auth-or-jwt'};
  await assert.rejects(verifyIssuedSession(d,p,async()=>{throw new Error('AUTH_SESSION_NOT_CURRENT');},{},f.guard));
  assert.equal(f.guard.quarantined,true);
});
test('Auth fixed GET cannot redirect, signup, send email or reach another issuer',async()=>{
  const f=guardFixture();const fetch=authFetch(f.guard,{requester:()=>assert.fail('no transport')});
  for(const url of ['http://127.0.0.1:9999/signup','http://127.0.0.1:9999/token','http://other/user']){
    await assert.rejects(fetch(url,{redirect:'error',headers:{authorization:'Bearer unit'}}),{code:'FIXED_AUTH_USER_READ_ONLY'});
  }
});
test('real Node HTTP parser uses injected namespace stream without host socket',async()=>{
  const f=guardFixture();let wire='';
  class OfflineHTTP extends Duplex {
    _read(){}setTimeout(){return this;}setNoDelay(){return this;}setKeepAlive(){return this;}
    connect(port,host){assert.equal(port,9999);assert.equal(host,'127.0.0.1');queueMicrotask(()=>this.emit('connect'));return this;}
    _write(data,enc,cb){wire+=data.toString();cb();if(wire.includes('\r\n\r\n')){
      const body=JSON.stringify({id:f.input.descriptor.synthetic_subject});
      this.push(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`));this.push(null);}}
  }
  const fetch=authFetch(f.guard,{streamFactory:()=>new OfflineHTTP()});
  const response=await fetch('http://127.0.0.1:9999/user',{redirect:'error',headers:{authorization:'Bearer unit-test-only'}});
  assert.equal((await response.json()).id,f.input.descriptor.synthetic_subject);
  assert.match(wire,/GET \/user HTTP\/1.1/);
});
test('native pg facade binds exact role/database/options and records C/Z before client result',()=>{
  const f=guardFixture();
  class Client extends EventEmitter{constructor(){super();this.connection=new EventEmitter();this.processID=123;}query(){return Promise.resolve({});}}
  class Pool{constructor(options){this.options=options;}connect(){return Promise.resolve({});}end(){return Promise.resolve();}}
  const pg={Client,Pool};const facade=bindPg(pg,f.guard,{streamFactory:()=>assert.fail('no real stream')});
  const d=f.input.descriptor,config={connectionString:`postgresql://cladora_ce_guide_runtime@127.0.0.1:5432/${d.database}`,max:2,connectionTimeoutMillis:3000,query_timeout:12000};
  const pool=new facade.Pool(config),client=new pool.options.Client(config);
  client.connection.emit('commandComplete',{text:'ROLLBACK'});client.connection.emit('readyForQuery',{status:'I'});
  assert.deepEqual(f.ledger.events.slice(-2).map(x=>x.phase),['pg-command-complete','pg-ready']);
  for(const key of ['connectionString','max','stream']){
    const bad={...config,[key]:key==='connectionString'?`postgresql://service_role@127.0.0.1:5432/${d.database}`:99};
    assert.throws(()=>new facade.Pool(bad));
  }
});
test('fixed namespace relay argv/user/CID, no shell selected from request',async()=>{
  const f=guardFixture();let args;
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.killed=false;
  child.kill=()=>{child.killed=true;queueMicrotask(()=>child.emit('exit',0,null));};
  const stream=new NamespaceStream(f.guard,'pg',{spawner:(command,argv)=>{args={command,argv};return child;}});
  stream.connect(5432,'127.0.0.1');await new Promise(r=>setImmediate(r));
  assert.equal(args.command,'/usr/local/bin/docker');assert.deepEqual(args.argv.slice(0,6),['--host=unix:///var/run/docker.sock','exec','-i','--user','999:999',f.input.descriptor.pg_cid]);
  assert.ok(args.argv.at(-1).includes('/dev/tcp/127.0.0.1/5432'));
  stream.destroy();await f.guard.closeRelays();assert.equal(f.guard.relays.size,0);
});
test('first failed consumer case preserved; incomplete/unknown never becomes zero-write PASS',()=>{
  const good={contract:'documents-ce012-live-proof-result.v1',cases:CASES.map(c=>({case:c,status:'PASS_LIVE_READ_PROBE'})),result:'PASS_LIVE_READ_PROBES',command_commit_or_activation:'NONE'};
  assert.equal(evaluateResult(good).status,'PASSED');
  const bad=structuredClone(good);bad.cases[0]={case:CASES[0],status:'BLOCKED',code:'FIRST'};bad.cases[1]={case:CASES[1],status:'FAILED',code:'SECOND'};bad.result='INCOMPLETE';
  assert.equal(evaluateResult(bad).first_error,'FIRST');assert.equal(evaluateResult(bad).zero_write,'UNKNOWN');
});
test('actual CLI closed to arbitrary flags and historical invocation before runtime',()=>{
  const inspect=spawnSync(process.execPath,['scripts/docs-ce012-platform-v1/worker.mjs','--inspect'],{encoding:'utf8'});
  assert.equal(inspect.status,0);assert.match(inspect.stdout,/NOT_READY_FINAL_BINDING/);
  const bad=spawnSync(process.execPath,['scripts/docs-ce012-platform-v1/worker.mjs','--exec','anything'],{encoding:'utf8'});
  assert.equal(bad.status,2);assert.match(bad.stdout,/NO_ARBITRARY_EXEC/);
  const f=fixture(),old={...f.input,source_head:HISTORICAL.head};
  const child=spawnSync(process.execPath,['scripts/docs-ce012-platform-v1/worker.mjs','--check-admission'],{input:JSON.stringify(old),encoding:'utf8'});
  assert.equal(child.status,2);assert.match(child.stdout,/HISTORICAL_REQUEST_NOT_EXECUTABLE/);
});

test('prerequisite committed ACK, exact producer evidence and same run are mandatory even with registry authority',()=>{
  const f=fixture(),d=f.input.descriptor;
  for(const kind of ['installation','fixture','committed_receipt']){
    const value=f.input.prerequisites[kind],expected=f.record.prerequisites[kind];
    prerequisite(value,kind,d,expected);
    fails(()=>prerequisite({...value,commit_ack:false},kind,d,expected),`NOT_READY_${kind.toUpperCase()}_PRODUCER_ACK`);
    fails(()=>prerequisite({...value,attempt_id:'1'.repeat(32)},kind,d,expected),'PREREQUISITE_OTHER_RUN');
    fails(()=>prerequisite(value,kind,d,J),'PREREQUISITE_NOT_IN_PLATFORM_REVIEW');
  }
});
test('fixed producer materialization verifies five v2 artifacts, closure and no effect expansion',()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'ce012-material-'));
  try{
    const artifacts=['admission.mjs','run.mjs','live.mjs','measure.mjs','closure.mjs'].map(name=>{
      const relative=DIR+name,b=Buffer.from(`// offline input ${name}\n`);mkdirSync(path.dirname(path.join(root,relative)),{recursive:true});writeFileSync(path.join(root,relative),b);return {path:relative,...pinOf(b)};
    });
    const pkg=Buffer.from('{}\n');writeFileSync(path.join(root,'package.json'),pkg);
    const inventory=Buffer.from(JSON.stringify({files:[{path:'package.json',...pinOf(pkg)}]}));
    writeFileSync(path.join(root,DIR,'source-inventory.json'),inventory);
    const req={contract:'documents-ce012-live-connection-request.v2',entrypoint:ENTRY,live_default:'CLOSED',source_inventory:DIR+'source-inventory.json',source_inventory_sha256:sha(inventory),
      cases:CASES,effects:EFFECTS,limits:LIMITS,artifacts,measurement_tables:TABLES,measurement_sequences:SEQUENCES};
    let request=Buffer.from(JSON.stringify(req));writeFileSync(path.join(root,DIR,'consumer-request.json'),request);
    const closure=Buffer.from('{"offline_unit_fixture":true}');writeFileSync(path.join(root,DIR,'runtime-closure.json'),closure);req.runtime_closure=DIR+'runtime-closure.json';req.runtime_closure_sha256=sha(closure);request=Buffer.from(JSON.stringify(req));writeFileSync(path.join(root,DIR,'consumer-request.json'),request);
    const input={request:pinOf(request),inventory:pinOf(inventory),closure:pinOf(closure)};
    verifyMaterials(root,input,{artifacts});
    writeFileSync(path.join(root,DIR,'live.mjs'),'changed');fails(()=>verifyMaterials(root,input,{artifacts}),'PIN_MISMATCH');
    writeFileSync(path.join(root,DIR,'live.mjs'),'// offline input live.mjs\n');
    req.effects=[...EFFECTS,'install'];request=Buffer.from(JSON.stringify(req));writeFileSync(path.join(root,DIR,'consumer-request.json'),request);
    fails(()=>verifyMaterials(root,{...input,request:pinOf(request)},{artifacts}),'REQUEST_EFFECT_ENTRY_OR_LIMIT_EXPANSION');
    symlinkSync(path.join(root,'package.json'),path.join(root,'link.json'));
    fails(()=>pin(root,'link.json',pinOf(pkg)),'SYMLINK_INPUT_FORBIDDEN');
    fails(()=>pin(root,'../outside',pinOf(pkg)),'RELATIVE_INPUT_ONLY');
  }finally{rmSync(root,{recursive:true});}
});
test('external socket/process escape is rejected before actual socket/command in isolated child',()=>{
  const text=`import {fenceExternalNetwork} from './scripts/docs-ce012-platform-v1/transport.mjs';
import net from 'node:net';import cp from 'node:child_process';fenceExternalNetwork();
let count=0;for(const f of [()=>net.connect(1,'127.0.0.1'),()=>cp.spawn('/bin/echo',['not-executed'])]){try{f();}catch(e){if(e.code==='NON_FIXTURE_EGRESS_OR_EXEC_FORBIDDEN')count++;}}
if(count!==2)throw new Error('fence missing');console.log('CLOSED_BEFORE_EFFECT');`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',text],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/CLOSED_BEFORE_EFFECT/);
});
test('missing native terminals, duplicate case labels or wrong overall effect never becomes PASS',()=>{
  const base={contract:'documents-ce012-live-proof-result.v1',cases:CASES.map(c=>({case:c,status:'PASS_LIVE_READ_PROBE'})),result:'PASS_LIVE_READ_PROBES',command_commit_or_activation:'NONE'};
  for(const change of [v=>v.cases[1].case=v.cases[0].case,v=>v.command_commit_or_activation='UNKNOWN',v=>v.cases[0].status='UNKNOWN']){
    const v=structuredClone(base);change(v);const result=evaluateResult(v);assert.equal(result.status,'FAILED_OR_UNKNOWN');assert.equal(result.zero_write,'UNKNOWN');
  }
});
test('signed producer expiry narrows the original ceiling and cannot renew it',()=>{
  const f=guardFixture();const earlier=now+1000;
  f.guard.bindProducerCeiling(new Date(earlier).toISOString());
  f.guard.bindProducerCeiling(new Date(now+50000).toISOString());assert.equal(f.guard.ceiling,earlier);
  f.setTime(earlier);fails(()=>f.guard.effect('connect',()=>assert.fail('no expired connect')),'AUTHORIZATION_EXPIRED');
  assert.equal(f.guard.quarantined,true);
});
test('v2 closure bytes and admitted closure object cross both adapter ABI boundaries unchanged',async()=>{
  const f=guardFixture(),materials={request:Buffer.from('request'),inventory:Buffer.from('inventory'),closure:Buffer.from('closure')};
  const producer={review:{target:{}},runtimeClosure:{contract:'documents-ce012-runtime-closure.v1'}};
  let admissionArgs,preflightArgs;
  const actual=admitProducer({admit(args){admissionArgs=args;return producer;}},materials,
    {planBytes:Buffer.from('plan'),review:{payload:{}},key:'test-public-key',keySha256:H},'/unit-source');
  assert.equal(actual,producer);assert.equal(admissionArgs.closureBytes,materials.closure);
  assert.equal(admissionArgs.inventoryBytes,materials.inventory);assert.equal(admissionArgs.requestBytes,materials.request);
  const observer={unit_mock:true};await preflightProducer({async preflight(...args){preflightArgs=args;}},observer,producer,f.guard);
  assert.deepEqual(preflightArgs,[observer,producer.review,producer.runtimeClosure]);
  await assert.rejects(preflightProducer({preflight(){}},observer,{review:{}},f.guard),{code:'NOT_READY_V2_RUNTIME_CLOSURE_ABI'});
});
test('unexpected PG stream EOF quarantines all lanes and preserves scoped producer first error',async()=>{
  const f=guardFixture(),child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();
  child.kill=()=>queueMicrotask(()=>child.emit('exit',0,null));
  const stream=new NamespaceStream(f.guard,'pg',{spawner:()=>child});stream.resume();stream.connect(5432,'127.0.0.1');
  await new Promise(r=>setImmediate(r));child.stdout.end();await new Promise(r=>setImmediate(r));
  assert.equal(f.guard.quarantined,true);assert.equal(f.guard.primary,'UNKNOWN_PG_STREAM_ENDED');
  fails(()=>f.guard.effect('next',()=>assert.fail('no next effect')),'HOST_QUARANTINED');
  await f.guard.closeRelays();
  const g=guardFixture();g.guard.fail({code:'NATIVE_INSTALLATION_MISSING'});g.guard.fail({code:'CLEANUP_SECOND'});
  assert.equal(g.guard.primary,'NATIVE_INSTALLATION_MISSING');
});
