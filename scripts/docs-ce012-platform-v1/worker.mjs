/** Fixed source-pinned runner. Only --inspect is offline; live requires Platform custody. */
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { createRequire, builtinModules } from 'node:module';
import Module from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { ROOT, DIR, ENTRY, CASES, need, Hold, sha, canonical, seal, admit, pin, safeRead, verifyMaterials, keys } from './contract.mjs';
import { Custody, Ledger, readPrivate, DOCKER } from './custody.mjs';
import { bindPg, authFetch, verifyIssuedSession, fenceExternalNetwork } from './transport.mjs';

export function runtimeFiles(root,binding) {
  const runtime=binding.runtime;
  need(runtime && Array.isArray(runtime.files) && runtime.files.length>0 && runtime.tools,'NOT_READY_PLATFORM_RUNTIME_CLOSURE');
  need(sha(readFileSync(process.execPath))===runtime.tools.node_sha256
    && sha(readFileSync(DOCKER))===runtime.tools.docker_sha256,'RUNTIME_EXECUTABLE_DRIFT');
  const pins=new Map();
  for(const f of runtime.files){need(typeof f.path==='string' && f.path.startsWith('node_modules/') && !pins.has(f.path),'RUNTIME_PIN_PATH');
    pin(root,f.path,{bytes:f.bytes,sha256:f.sha256});pins.set(path.join(realpathSync(root),f.path),f);}
  return pins;
}
export function lockModules(root,pins) {
  const original=Module._resolveFilename;
  Module._resolveFilename=function(name,parent,...args){
    const resolved=original.call(this,name,parent,...args);
    if(builtinModules.includes(resolved)||resolved.startsWith('node:'))return resolved;
    need(pins.has(resolved),'EXTERNAL_OR_UNPINNED_RUNTIME_RESOLUTION');
    const pin=pins.get(resolved),b=readFileSync(resolved);need(b.length===pin.bytes && sha(b)===pin.sha256,'RUNTIME_MODULE_CHANGED');
    return resolved;
  };
}
export function admitProducer(module,materials,inputs,root) {
  need(typeof module.admit==='function','NOT_READY_CONSUMER_ADMISSION_ABI');
  return module.admit({requestBytes:materials.request,inventoryBytes:materials.inventory,
    closureBytes:materials.closure,planBytes:inputs.planBytes,envelope:inputs.review,
    trustedPublicKey:inputs.key,trustedKeySha256:inputs.keySha256,now:Date.now(),root});
}
export async function preflightProducer(measurement,observer,producer,guard) {
  need(producer.runtimeClosure && typeof measurement.preflight==='function','NOT_READY_V2_RUNTIME_CLOSURE_ABI');
  await guard.verified('minimum-native-preflight',()=>measurement.preflight(observer,producer.review,producer.runtimeClosure));
}
export function evaluateResult(result) {
  need(result?.contract==='documents-ce012-live-proof-result.v1' && Array.isArray(result.cases) && result.cases.length===9,'UNKNOWN_CONSUMER_RESULT');
  const first=result.cases.find(c=>c.status!=='PASS_LIVE_READ_PROBE');
  const validNames=canonical(result.cases.map(c=>c.case))===canonical(CASES);
  const passed=result.result==='PASS_LIVE_READ_PROBES' && !first && result.command_commit_or_activation==='NONE' && validNames;
  return {status:passed?'PASSED':'FAILED_OR_UNKNOWN',
    first_error:first?.code??(passed?null:'UNKNOWN_RESULT_CASE_OR_EFFECT'),result,
    zero_write:passed?'CONSUMER_INDEPENDENT_MEASUREMENT_PASSED':'UNKNOWN'};
}
export async function run(privateRoot,packet) {
  // Parent supplies this fixed private root, never a field in consumer JSON.
  const stat=lstatSync(privateRoot);need(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0,'PLATFORM_PRIVATE_ROOT');
  const input=JSON.parse(safeRead(privateRoot,'inputs/invocation.json',262144));
  const admitted=admit(input); // registry, expiry and final producer closure before runtime import
  need(sha(readFileSync(process.execPath))===admitted.binding.runtime?.tools?.node_sha256,'NOT_READY_NODE_BINDING');
  const root=path.join(privateRoot,'consumer-source');
  const materials=verifyMaterials(root,input,admitted.binding);
  const planBytes=pin(privateRoot,'inputs/plan.json',input.plan);
  const review=JSON.parse(safeRead(privateRoot,'inputs/coordinator-review.json',262144));
  const key=safeRead(privateRoot,'inputs/coordinator-public-key.pem',8192).toString();
  need(sha(key)===admitted.review.coordinator_key_sha256,'PLATFORM_TRUST_ANCHOR_MISMATCH');
  // Prerequisite receipts are independently approved and bound to this run by admit;
  // no installer, seed, role/session setup or receipt fabrication exists in this path.
  const runtime=runtimeFiles(root,admitted.binding);
  const ledger=new Ledger(path.join(privateRoot,'docs-ce012.platform.private.jsonl'));
  const materialCheck=()=>{
    pin(root,`${DIR}consumer-request.json`,input.request);
    pin(root,`${DIR}source-inventory.json`,input.inventory);
    pin(root,`${DIR}runtime-closure.json`,input.closure);
    pin(privateRoot,'inputs/plan.json',input.plan);
    need(canonical(JSON.parse(safeRead(privateRoot,'inputs/invocation.json')))===canonical(input),'INVOCATION_CHANGED');
    need(sha(safeRead(privateRoot,'inputs/coordinator-public-key.pem',8192))===admitted.review.coordinator_key_sha256,'TRUST_ANCHOR_CHANGED');
    need(canonical(JSON.parse(safeRead(privateRoot,'inputs/coordinator-review.json')))===canonical(review),'CONSUMER_REVIEW_CHANGED');
    for(const entry of admitted.binding.artifacts)pin(root,entry.path,{bytes:entry.bytes,sha256:entry.sha256});
  };
  const guard=new Custody(admitted,{ledger,materialCheck});let facade,prePool,preClient,closed=false;
  const outcome={status:'NOT_RUN',first_error:null,transport_cleanup:'NOT_RUN',session:'NOT_RUN',consumer:'NOT_RUN'};
  let originalLog=console.log;
  try {
    guard.effect('before-admission-import',()=>{});
    const consumerAdmission=await import(pathToFileURL(path.join(root,DIR,'admission.mjs')).href);
    guard.effect('after-admission-import',()=>{});
    const producer=admitProducer(consumerAdmission,materials,{planBytes,review,key,keySha256:admitted.review.coordinator_key_sha256},root);
    guard.bindProducerCeiling(producer.review.expires_at);
    need(producer.review.target.database===input.descriptor.database
      && producer.review.target.database_oid===input.descriptor.database_oid
      && producer.review.target.system_identifier===input.descriptor.system_identifier
      && producer.review.target.auth_origin===input.descriptor.auth_origin
      && producer.review.target.auth_issuer===input.descriptor.auth_issuer
      && producer.review.target.auth_user_path===input.descriptor.auth_user_path
      && producer.review.target.custody_nonce===input.descriptor.custody_nonce
      && producer.review.target.observer_role===input.descriptor.observer_role
      && producer.review.target.conflict_role===input.descriptor.conflict_role,'PRODUCER_PLATFORM_TARGET_DIVERGENCE');
    const require=createRequire(path.join(root,'package.json'));
    lockModules(root,runtime);
    const pg=require('pg');
    facade=bindPg(pg,guard);
    fenceExternalNetwork();
    globalThis.fetch=authFetch(guard);
    guard.effect('before-live-import',()=>{});
    const live=await import(pathToFileURL(path.join(root,DIR,'live.mjs')).href);
    const measurement=await import(pathToFileURL(path.join(root,DIR,'measure.mjs')).href);
    guard.effect('after-live-import',()=>{});
    need(typeof live.verifySession==='function'&&typeof live.executeLive==='function'
      &&typeof measurement.preflight==='function','NOT_READY_CONSUMER_LIVE_MEASUREMENT_ABI');
    const d=input.descriptor;
    const url=role=>`postgresql://${role}@127.0.0.1:5432/${d.database}`;
    prePool=new facade.Pool({connectionString:url(d.observer_role),max:1,connectionTimeoutMillis:3000,
      query_timeout:12000,options:'-c default_transaction_read_only=on -c statement_timeout=10000'});
    preClient=await guard.verified('pre-observer-connect',()=>prePool.connect());
    await preflightProducer(measurement,preClient,producer,guard);
    await verifyIssuedSession(d,packet,live.verifySession,preClient,guard);
    outcome.session='PROVIDER_VERIFIED_CURRENT_SYNTHETIC_AAL2';
    preClient.release();preClient=null;await prePool.end();prePool=null;
    // Existing fixed run.mjs performs its own admission, live/measure calls and
    // repeated current-session checks. No consumer source transformation occurs.
    const env={DOCS_CE012_REVIEW_ENVELOPE_FILE:path.join(privateRoot,'inputs/coordinator-review.json'),
      DOCS_CE012_FIXTURE_PLAN_FILE:path.join(privateRoot,'inputs/plan.json'),
      DOCS_CE012_COORDINATOR_PUBLIC_KEY_FILE:path.join(privateRoot,'inputs/coordinator-public-key.pem'),
      DOCS_CE012_COORDINATOR_KEY_SHA256:admitted.review.coordinator_key_sha256,
      DOCS_CE012_RUNTIME_DATABASE_URL:url('cladora_ce_guide_runtime'),
      DOCS_CE012_OBSERVER_DATABASE_URL:url(d.observer_role),DOCS_CE012_CONFLICT_DATABASE_URL:url(d.conflict_role),
      DOCS_CE012_ISSUED_AAL2_ACCESS_TOKEN:packet.token};
    // No host credentials or service_role fallback survive into the harness.
    for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,env);
    process.argv=[process.execPath,path.join(root,ENTRY),'--run'];
    let emitted;
    console.log=(text)=>{need(typeof text==='string'&&!emitted,'UNKNOWN_MULTIPLE_CONSUMER_RESULTS');emitted=JSON.parse(text);};
    guard.effect('before-fixed-run-import',()=>{});
    outcome.consumer='DISPATCHED';
    await import(pathToFileURL(path.join(root,ENTRY)).href);
    console.log=originalLog;
    guard.effect('after-fixed-run-import',()=>{});
    Object.assign(outcome,evaluateResult(emitted));outcome.consumer=outcome.status;
    if(outcome.first_error)guard.primary??=outcome.first_error;
  } catch(error) {
    console.log=originalLog;guard.fail(error);
    outcome.status='FAILED_OR_UNKNOWN';outcome.first_error=guard.primary;
    outcome.zero_write='UNKNOWN';
  } finally {
    console.log=originalLog;
    // Bounded, independent settlement. A failure cannot suppress later cleanup.
    try{preClient?.release(true);}catch(e){outcome.first_error??='UNKNOWN_OBSERVER_RELEASE';}
    try{if(prePool)await Promise.race([prePool.end(),new Promise((_,r)=>setTimeout(()=>r(new Hold('UNKNOWN_PRE_POOL_CLOSE')),3000))]);}
    catch(e){outcome.first_error??=e.code??'UNKNOWN_PRE_POOL_CLOSE';}
    try{if(facade)await facade.end();}catch(e){outcome.first_error??=e.code??'UNKNOWN_POOL_CLOSE';}
    try{await guard.closeRelays();outcome.transport_cleanup='ACKNOWLEDGED';closed=true;}
    catch(e){outcome.transport_cleanup='UNKNOWN';outcome.first_error??=e.code??'UNKNOWN_RELAY_CLOSE';}
    for(const key of Object.keys(process.env))if(key.startsWith('DOCS_CE012_'))delete process.env[key];
    packet.token='';
    if(outcome.first_error||!closed){outcome.status='FAILED_OR_UNKNOWN';outcome.zero_write='UNKNOWN';}
    try{guard.terminal({phase:'consumer-final',status:outcome.status,first_error:outcome.first_error,
      transport_cleanup:outcome.transport_cleanup});ledger.close();}
    catch(e){outcome.first_error??='UNKNOWN_TERMINAL_PERSISTENCE';outcome.status='FAILED_OR_UNKNOWN';}
    // No raw token, claims, catalog or descriptor in stdout/result; this stays private.
    writeFileSync(path.join(privateRoot,'docs-ce012.result.private.json'),JSON.stringify(outcome)+'\n',{mode:0o600,flag:'wx'});
  }
  return outcome;
}
export async function main(args=process.argv.slice(2)) {
  if(args.length===1&&args[0]==='--check-admission'){
    const raw=readFileSync(0);need(raw.length<=262144,'INPUT_BOUND');
    const admitted=admit(JSON.parse(raw));
    console.log(JSON.stringify({status:'ADMITTED',identity:admitted.identity}));return 0;
  }
  if(args.length===1&&args[0]==='--inspect'){
    console.log(JSON.stringify({format:'docs-ce012-platform-source.v1',seal:seal(),execution:'NOT_READY_FINAL_BINDING_AND_REVIEW_REQUIRED'}));return 0;
  }
  need(args.length===1&&args[0]==='--run-owned','NO_ARBITRARY_EXEC');
  // These descriptors are parent-opened private files, not filenames/URLs in the request.
  const contextFd=Number(process.env.DOCS_PLATFORM_CONTEXT_FD);
  const sessionFd=Number(process.env.DOCS_PLATFORM_SESSION_FD);
  need(Number.isSafeInteger(contextFd)&&contextFd>=3&&Number.isSafeInteger(sessionFd)&&sessionFd>=3&&contextFd!==sessionFd,'PARENT_PRIVATE_FD_REQUIRED');
  const context=JSON.parse(readPrivate(contextFd));keys(context,['private_root']);
  const packet=JSON.parse(readPrivate(sessionFd,32768));
  const result=await run(context.private_root,packet);
  console.log(JSON.stringify({status:result.status,session:result.session,consumer:result.consumer,
    transport_cleanup:result.transport_cleanup,first_error:result.first_error}));
  return result.status==='PASSED'?0:2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=await main();}catch(e){console.log(JSON.stringify({status:'HOLD',reason:e instanceof Hold?e.code:'NOT_READY_PRIVATE_INPUT',live:'NOT_RUN'}));process.exitCode=2;}
}
