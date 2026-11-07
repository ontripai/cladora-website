/** Native lane implementation; this module does not execute at import time. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,constants,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {APP,INSTALLED,validateRequest,digest,matchSelection} from './contract.mjs';
import {SQL} from './queries.mjs';
import {seedFixture,seedOffering} from './fixture.mjs';
import {traceClient,terminal,transaction,normalizeEvidence,operatorFailure} from './wire.mjs';
import {runCase,input,snapshot,key,requireCurrentAppRead} from './cases.mjs';
import {createCore15NativeLoader} from '../lib/core15-native-ts-loader.mjs';
import {readOwnedInstallerFileV1,loadInstallerCredentialBindingV1,installerTargetV1} from '../lib/core-installer-credential-binding-v1.mjs';
import {coreServiceAssemblyChildEnvironmentV1} from '../lib/core-service-assembly-environment-v1.mjs';
const one=r=>{assert.equal(r.rowCount,1);return r.rows[0];};
const safeCode=e=>typeof e?.code==='string'&&/^[A-Z0-9_]{2,80}$/.test(e.code)?e.code:'LOCAL_FAILURE';
export function sourceGate(root,r){
 const env=coreServiceAssemblyChildEnvironmentV1(process.env,'start');
 const git=(at,...args)=>execFileSync('git',args,{cwd:at,env,encoding:'utf8',stdio:'pipe',timeout:10000,maxBuffer:2097152}).trim();
 assert.equal(git(root,'rev-parse','HEAD'),r.operator_sha,'EXACT_OPERATOR_SHA_REQUIRED');execFileSync('git',['diff','--quiet','HEAD','--'],{cwd:root,env,stdio:'pipe'});
 assert.equal(git(r.app_root,'rev-parse','HEAD^{tree}'),r.app_tree,'EXACT_FD7_TREE');assert.equal(readFileSync(join(r.app_root,'.next/BUILD_ID'),'utf8').trim(),r.build_id,'EXACT_REPORTED_BUILD_REQUIRED');
 assert.equal(git(r.app_root,'rev-parse','HEAD'),APP,'FD7_APP_MUST_STAY_FIXED');execFileSync('git',['diff','--quiet','HEAD','--'],{cwd:r.app_root,env,stdio:'pipe'});
 assert.equal(git(root,'ls-files','--others','--exclude-standard'),'','UNREVIEWED_OPERATOR_SOURCE');assert.equal(git(r.app_root,'ls-files','--others','--exclude-standard'),'','UNREVIEWED_APP_SOURCE');
 const seal=JSON.parse(readFileSync(join(root,'scripts/core17-native-cases-v3/manifest.json')));
 for(const p of [...seal.operator_sources,...seal.product_sources])assert.equal(digest(readFileSync(join(root,p.path))),p.sha256,'CASE_SOURCE_PIN '+p.path);
 for(const p of seal.product_sources){const actual=execFileSync('git',['show',APP+':'+p.path],{cwd:root,env,stdio:['ignore','pipe','ignore'],maxBuffer:2097152});assert.equal(digest(actual),p.sha256,'FD7_RUNTIME_COMPATIBILITY '+p.path);}
 assert.equal(seal.installed_core,INSTALLED);return seal;
}
export function savePrivate(path,value,{exclusive=false}={}){
 const dir=lstatSync(dirname(path));assert.ok(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===process.getuid()&&(dir.mode&0o077)===0);
 if(existsSync(path)){const s=lstatSync(path);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o077)===0);}
 const b=Buffer.from(JSON.stringify(value,null,2)+'\n');const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_NOFOLLOW|(exclusive?constants.O_EXCL:constants.O_TRUNC),0o600);
 try{assert.equal(writeSync(fd,b),b.length);fsyncSync(fd);}finally{closeSync(fd);}const d=openSync(dirname(path),constants.O_RDONLY);try{fsyncSync(d);}finally{closeSync(d);}
}
async function identity(c,target,principal){const r=one(await c.query(SQL.identity));assert.equal(r.principal,principal);assert.equal(r.database_oid,target.database_oid);assert.equal(r.database_name,target.database_name);assert.equal(r.backend_id,target.backend_id);assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);assert.ok(r.pg_version>=170000&&r.pg_version<180000);return r;}
export async function executeCases(request,{root,recovery=false}={}){
 const r=validateRequest(request);root=resolve(root);sourceGate(root,r);
 // No secret is printed or serialized. Exact v3 provenance before PG construction.
 const binding=JSON.parse(readOwnedInstallerFileV1(r.runtime_binding,r.private_root));
 assert.equal(binding.contract,'core15-owned-service-private-binding.v1');assert.equal(binding.platform,'794f5a12c3928ae0a3585ab679a3cbe60aab49a3');assert.match(binding.password,/^[a-f0-9]{64}$/);
 const owner=loadInstallerCredentialBindingV1({privateRoot:r.private_root,generation:'v3',bindingPath:r.installer_binding,expectedTarget:installerTargetV1(binding.target)});
 const target=binding.target;
 assert.equal(target.host,'127.0.0.1');assert.equal(target.port,55422);assert.equal(target.auth_origin,'http://127.0.0.1:55421');assert.equal(target.runtime_role,'cladora_core_runtime');
 let a,publicKey;
 if(!recovery){
 const sessionRaw=readOwnedInstallerFileV1(r.session_file,r.private_root);assert.equal(digest(sessionRaw),r.session_sha256);const sessions=JSON.parse(sessionRaw);
 a=sessions.users.find(u=>u.actor_id===r.actor_A);assert.ok(a&&a.cookie);assert.equal(sessions.users.filter(u=>u.actor_id===r.actor_A).length,1);
 // Named owned profile only; never turn NODE_ENV into test/development to bypass.
 assert.equal(process.env.NODE_ENV,'production','USE_EXPLICIT_PRODUCTION_OWNED_PROFILE');assert.equal(process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE,'core-service-real-app-assembly.v1');assert.equal(process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY,'v1');assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.NEXT_PUBLIC_VERCEL_ENV);
 publicKey=JSON.parse(readOwnedInstallerFileV1(r.private_root+'/secrets.json',r.private_root)).anon_key;
 for(const [name,value]of Object.entries({NEXT_PUBLIC_SUPABASE_URL:target.auth_origin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publicKey,NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE:'1'})){assert.ok(process.env[name]===undefined||process.env[name]===value,'FOREIGN_ENV_SELECTOR');process.env[name]=value;}
 }
 const pg=(await import('pg')).default,loader=createCore15NativeLoader(root),core=loader.load('src/lib/core/functional-command-runtime-v1.ts');
 const readSchema=loader.load('src/lib/customer/service-request-read-schema.ts').serviceRequestReadSchema;
 const config={host:target.host,port:target.port,database:target.database_name,connectionTimeoutMillis:5000,query_timeout:15000};
 const clients=[],runtimePools=[];const traces=[];
 function ownerClient(){const c=new pg.Client({...config,user:owner.principal,password:owner.password,application_name:'core17-v3:'+r.plan.run+':operator'}),trace=traceClient(c,traces);c.on('error',e=>{trace.operator_socket_error=safeCode(e);});clients.push(c);return{c,trace};}
 const first=ownerClient();let primary,proof;
 try{
  // All preparation is immutable/local; no automatic App/relay lifecycle.
  const prepared=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'prepared.private.json'),r.private_root));assert.equal(prepared.request_sha256,digest(JSON.stringify(r)));
  const originalRequest=JSON.parse(readOwnedInstallerFileV1(join(r.output_directory,'request.private.json'),r.private_root));assert.deepEqual(originalRequest,r,'EXACT_PREPARED_REQUEST_REQUIRED');
  const {loadCurrentProcessJournal,bindCurrentListener}=await import('./hook-control.mjs');
  if(!recovery){savePrivate(join(r.output_directory,'claim.private.json'),{contract:r.contract,operator_sha:r.operator_sha,run:r.plan.run,state:'ONE_DISPATCH_CLAIMED'},{exclusive:true});await bindCurrentListener(r,{persist:false});}
  proof={contract:'core17.native-case-evidence.v3',operator:r.operator_sha,App:APP,installed:INSTALLED,generation:'v3',state:'DISPATCHED_NOT_PASS',cases:[],wire:[],first_error:null,actual_business_POSTs:0,limits:r.limits};

  const filename=join(r.output_directory,recovery?'recovery-'+process.pid+'.private.json':'evidence.private.json');const save=()=>{proof.wire=normalizeEvidence(traces);savePrivate(filename,proof);};save();
  await first.c.connect();proof.identity=await identity(first.c,target,owner.principal);
  const visibility=(await first.c.query(SQL.observerPrivilege)).rows;assert.equal(visibility.length,4);for(const p of visibility)assert.ok(p.owner===owner.principal&&p.can_select&&(!p.relrowsecurity||!p.relforcerowsecurity),'OBSERVER_VISIBILITY_NOT_PROVEN_NO_GRANT');proof.observer_visibility=visibility;
  if(r.authorized_cases.includes('precommit-disconnect'))assert.equal(one(await first.c.query(SQL.xidPrivilege)).allowed,true,'PG_XACT_STATUS_EXECUTE_NOT_PRESENT_NO_GRANT');save();
  if(recovery){
   await transaction(first.c,first.trace,async()=>{for(const name of r.authorized_cases){const f=name==='B-populated'?{...r.plan.cases[name],tenant:r.B_selection.tenant_id,workspace:r.B_selection.workspace_id,membership:r.B_selection.membership_id,context:r.B_selection.context_id}:r.plan.cases[name];proof.cases.push({case:name,snapshot:await snapshot(first.c,f,name==='different-key'?[f.key,f.key+'_second']:[f.key]),context:(await first.c.query(SQL.context,[f.context,f.membership,f.tenant])).rows,member:(await first.c.query(SQL.member,[f.membership,r.actor_A,f.tenant])).rows,receipts:(await first.c.query(SQL.receipt,[f.tenant,key(f)])).rows});}}, {rollback:true,readOnly:true});
   proof.state='READ_ONLY_RECOVERY_OBSERVED_NOT_AUTHORIZATION_TO_RESEND';save();return proof;
  }
  // Canonical real Auth verifies the selected existing synthetic identities before fixture writes.
  for(const session of [a]){const request=new Request('http://localhost:3008/',{headers:{cookie:session.cookie}});const auth=loader.load('src/lib/core/functional-request-auth-v1.ts').createCoreFunctionalRequestAuthV1(request,target.auth_origin,publicKey);const client=await auth;const [u,c]=await Promise.all([client.auth.getUser(),client.auth.getClaims()]);assert.equal(u.error,null);assert.equal(c.error,null);assert.equal(u.data.user?.id,session.actor_id);assert.equal(c.data.claims.sub,session.actor_id);assert.equal(c.data.claims.aal,'aal2');}
  const bootstrapResponse=await fetch('http://localhost:3008/api/customer/v1/services/assembly-bootstrap',{headers:{cookie:a.cookie},redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(bootstrapResponse.status,200,'CURRENT_CANONICAL_SESSION_REQUIRED_BEFORE_FIXTURE');
  const bootstrap=await bootstrapResponse.json();assert.equal(bootstrap.contract_version,r.read_abi);assert.ok(Array.isArray(bootstrap.selections));proof.canonical_prestate_selection=matchSelection(bootstrap.selections,r.A_selection);save();
  one(await first.c.query('select id from auth.users where id=$1',[r.publisher_actor]));
  for(const name of r.authorized_cases){
   let f=r.plan.cases[name];const session=a;let B_selection=null;
   let B_prestate=null;
   if(name==='B-populated'){
    const headers={cookie:a.cookie};
    const bootResponse=await fetch('http://localhost:3008/api/customer/v1/services/assembly-bootstrap',{headers,redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(bootResponse.status,200);const bootstrap=await bootResponse.json();assert.equal(bootstrap.contract_version,r.read_abi);assert.ok(Array.isArray(bootstrap.selections));
    matchSelection(bootstrap.selections,r.A_selection);B_selection=matchSelection(bootstrap.selections,r.B_selection);
    f={...f,tenant:B_selection.tenant_id,workspace:B_selection.workspace_id,membership:B_selection.membership_id,context:B_selection.context_id,beneficiary:r.B_beneficiary_id};
    const query=new URLSearchParams({context_id:f.context,workspace_id:f.workspace});
    const rr=await fetch('http://localhost:3008/api/customer/v1/services/requests?'+query,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(rr.status,200);const requests=readSchema.parse(await rr.json());
    const cr=await fetch('http://localhost:3008/api/customer/v1/services/catalog?'+query,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(cr.status,200);const catalog=(await cr.json()).offerings;
    assert.equal(requests.can_request,true,'B_ACTION_AUTHORITY_NOT_PRESENT_NO_PERMISSION_COPY');assert.ok(requests.beneficiaries.some(p=>p.party_id===f.beneficiary),'B_BENEFICIARY_NOT_CANONICAL');assert.ok(Array.isArray(catalog)&&catalog.length===0,'B_EMPTY_CATALOG_PRESTATE_CHANGED_STOP');
    B_prestate=await snapshot(first.c,f);
   }
   const stage={case:name,state:'FIXTURE_PRESTATE_REQUIRED'};proof.cases.push(stage);save();
   stage.fixture=await transaction(first.c,first.trace,()=>name==='B-populated'?seedOffering(first.c,f,session.actor_id,r.publisher_actor):seedFixture(first.c,f,session.actor_id,r.publisher_actor),{beforeCommit:pending=>{stage.fixture_pending=pending;stage.resolved_fixture=f;stage.fixture_state='COMMIT_NOT_YET_ATTEMPTED';save();}});
   stage.resolved_fixture=f;stage.B_selection=B_selection;stage.B_prestate=B_prestate;
   if(B_prestate)assert.deepEqual(await snapshot(first.c,f),B_prestate,'B_FIXTURE_MUST_NOT_SEED_REQUEST_OR_RECEIPT');stage.fixture_terminal=terminal(first.trace,'COMMIT');stage.state='FIXTURE_COMMITTED_RETAIN_ON_UNKNOWN';save();
   const control=ownerClient();await control.c.connect();await identity(control.c,target,owner.principal);
   const rt=[],localTraces=[];const pool=new pg.Pool({...config,user:target.runtime_role,password:binding.password,max:4,application_name:'core17-v3:'+r.plan.run+':'+name});runtimePools.push(pool);pool.on('error',()=>{stage.idle_pool_error=true;});
   pool.on('connect',c=>{const t=traceClient(c,traces,{fault:name==='precommit-atomicity'});localTraces.push(t);rt.push(t);});
   const observations=[];const results=[];
   const requiresProbe=r.authorized_cases.some(c=>['same-key','different-key','precommit-atomicity','precommit-disconnect','core503'].includes(c));
   const refresh=()=>{if(!requiresProbe)return;const observed=loadCurrentProcessJournal(r,name);stage.journal_identity=observed.journal;const remote=observed.traces;rt.splice(0,rt.length,...localTraces,...remote);stage.current_App_wire=normalizeEvidence(remote);observations.splice(0,observations.length,...remote.filter(t=>t.ledger).map(t=>({...t.ledger,...(t.receipt??{}),idempotency_key:t.ledger.canonical_key.split(':').slice(2).join(':')})));};
   rt.refresh=refresh;
   const makeReq=(f,s)=>new Request('http://localhost:3008/',{headers:{cookie:s.cookie}});
   const runtime=(s=session)=>core.createCoreFunctionalCommandRuntimeV1({pool,target,offering:{contract_version:'service-offering-disclosure-source.v1',...input(f),offering_version:1,published_revision_version:1,provider_party_id:f.provider,provider_agreement_id:f.agreement,provider_agreement_version:1,requested_service_scope:'service.request.create',permission_code:'services.orders.request'},request:makeReq(f,s)});
   const x={B_selection,haltGroup:async()=>savePrivate(join(r.output_directory,'halt-'+name+'.json'),{case:name,request_sha256:digest(JSON.stringify(r)),reason:'GROUP_PREWRITE_BARRIER_FAILED_STOP_NO_RETRY'},{exclusive:true}),notePending:out=>{stage.pending_outcomes=out;save();},owner:first.c,blocker:control.c,blockerTrace:control.trace,runtimeTraces:rt,commands:observations,hostResults:results,actor:session.actor_id,
    write:async fn=>{const v=await transaction(first.c,first.trace,fn,{beforeCommit:pending=>{stage.operator_write_pending=JSON.parse(JSON.stringify(pending));save();}});stage.last_operator_commit=terminal(first.trace,'COMMIT');save();return v;},
    readAgreement:fixture=>runtime().withRequestScope({context_id:fixture.context,workspace_id:fixture.workspace,offering_id:fixture.offering},(_scope,ports)=>ports.resolveProviderAgreement({contract_version:'provider-agreement-verification.v1',context_id:fixture.context,workspace_id:fixture.workspace,provider_agreement_id:fixture.agreement,provider_agreement_version:1,requested_service_scope:['service.request.create'],permission_code:'services.orders.request'})),
    readRequests:async fixture=>{const q=new URLSearchParams({context_id:fixture.context,workspace_id:fixture.workspace});const response=await fetch('http://localhost:3008/api/customer/v1/services/requests?'+q,{headers:{cookie:session.cookie},redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);return{value:readSchema.parse(await response.json())};},
    preflight:async fixture=>{const u=new URL('http://localhost:3008/api/customer/v1/services/offering-request-flow');for(const[k,v]of Object.entries(input(fixture)))u.searchParams.set(k,v);const response=await fetch(u,{headers:{cookie:session.cookie},redirect:'error',signal:AbortSignal.timeout(15000)});refresh();return{status:response.status,value:await response.json()};},
    submit:async value=>{assert.notEqual(name,'B-populated','NO_BUSINESS_POST_IN_A09_FIXTURE');if(requiresProbe){assert.equal(stage.probe_readiness?.contract,'core17.current-App-read-ready.v3','CURRENT_APP_PROBE_READINESS_REQUIRED');assert.equal(stage.probe_readiness.case,name,'CURRENT_CASE_PROBE_READINESS_REQUIRED');}assert.ok(proof.actual_business_POSTs<r.limits.business_POSTs,'BUSINESS_POST_BUDGET_EXHAUSTED');proof.actual_business_POSTs++;const wire=JSON.stringify(value);stage.last_wire_sha256=digest(wire);save();const response=await fetch('http://localhost:3008/api/customer/v1/services/offering-request-flow',{method:'POST',headers:{cookie:session.cookie,origin:'http://localhost:3008','content-type':'application/json'},body:wire,redirect:'error',signal:AbortSignal.timeout(30000)});const result={status:response.status,value:await response.json()};refresh();return result;},
   };
   // Valid baseline required for every case, including private failure/Core503.
   const positive=await x.preflight(f);assert.equal(positive.status,200,'BASELINE_INVALID_NO_FAULT_DISPATCH');
   if(requiresProbe)stage.probe_readiness=requireCurrentAppRead(r,name,f,loadCurrentProcessJournal(r,name));
   stage.baseline='REAL_SERVICE_PREFLIGHT_READY';save();
   stage.result=await runCase(name,x,f);refresh();stage.host_observations=observations;stage.host_statuses=results.map(v=>v.status);
   for(const t of rt.filter(t=>t.queries.includes('begin isolation level serializable'))){if(name==='precommit-disconnect'&&t.fault_kind==='precommit-disconnect'){assert.equal(stage.result.terminal.database_transaction_id,t.database_transaction_id);continue;}try{terminal(t,'COMMIT');}catch{terminal(t,'ROLLBACK');}}
   stage.state=stage.result.state;await pool.end();runtimePools.splice(runtimePools.indexOf(pool),1);save();
  }
  if(!recovery)await bindCurrentListener(r,{persist:false});
  proof.state=proof.cases.some(c=>c.state?.includes('RECOVERY_REQUIRED'))?'INCOMPLETE_EXACT_RECOVERY_REQUIRED':'PASS_OPERATOR_CASES_BROWSER_A09_PENDING';save();return proof;
 }catch(error){primary=error;if(proof){proof.state='FAILED_OR_UNKNOWN_STOP';proof.first_error={code:safeCode(error),operator:operatorFailure(error)};proof.wire=normalizeEvidence(traces);try{savePrivate(join(r.output_directory,'failure.private.json'),proof);}catch(evidenceError){proof.evidence_error_code=safeCode(evidenceError);}}throw error;
 }finally{
  const cleanupErrors=[];for(const p of runtimePools)try{await p.end();}catch(e){cleanupErrors.push(safeCode(e));}
  for(const c of clients)try{await c.end();}catch(e){cleanupErrors.push(safeCode(e));}
  if(cleanupErrors.length){if(proof){proof.cleanup_errors=cleanupErrors;proof.state='UNKNOWN_CLEANUP_STOP';try{savePrivate(join(r.output_directory,'cleanup-unknown.private.json'),proof);}catch{}}if(!primary)throw Error('UNKNOWN_CLEANUP_STOP');}
 }
}
