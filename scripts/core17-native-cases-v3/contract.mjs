import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
export const SOURCE_BASE='2d19e0669e10fdddf2b8ee2d1309d6e4d3b2f084';
export const APP='fd7bc8799ce8aba970bb74e2a9035d4ee41e5119';
export const INSTALLED='ee883b62cf4a318af3450c506931a969623b8987';
export const CASES=Object.freeze(['stale','revoke','expiry-wait','current-authority-wait','same-key','different-key','precommit-atomicity','precommit-disconnect','core503','B-populated']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=/^[a-f0-9]{64}$/,ref=/^[a-f0-9]{40}$/;
export const digest=b=>createHash('sha256').update(b).digest('hex');
const exact=(x,keys)=>{assert.ok(x&&typeof x==='object'&&!Array.isArray(x));assert.deepEqual(Object.keys(x).sort(),[...keys].sort());};
export function newPlan(run=randomUUID().replaceAll('-','')){
 assert.match(run,/^[a-f0-9]{32}$/);
 return {contract:'core17.native-case-plan.v3',run,cases:Object.fromEntries(CASES.map(name=>[name,{tenant:randomUUID(),workspace:randomUUID(),role:randomUUID(),membership:randomUUID(),context:randomUUID(),workspace_role:randomUUID(),beneficiary:randomUUID(),provider:randomUUID(),agreement:randomUUID(),offering:randomUUID(),revision:randomUUID(),definition:randomUUID(),key:'core17v3_'+run+'_'+name.replaceAll('-','_')}]))};
}
export function validatePlan(p){
 exact(p,['contract','run','cases']);assert.equal(p.contract,'core17.native-case-plan.v3');assert.match(p.run,/^[a-f0-9]{32}$/);exact(p.cases,CASES);
 const ids=[];for(const [name,x]of Object.entries(p.cases)){
 exact(x,['tenant','workspace','role','membership','context','workspace_role','beneficiary','provider','agreement','offering','revision','definition','key']);
 for(const [k,v]of Object.entries(x))if(k!=='key'){assert.match(v,uuid);ids.push(v);}
 assert.equal(x.key,'core17v3_'+p.run+'_'+name.replaceAll('-','_'));
 }assert.equal(new Set(ids).size,ids.length,'FIXTURE_ID_COLLISION');return p;
}
export function validateRequest(r){
 exact(r,['contract','operator_sha','app_sha','app_root','installed_core','private_root','generation','installer_binding','runtime_binding','session_file','session_sha256','actor_A','publisher_actor','A_selection','B_selection','B_beneficiary_id','app_tree','build_id','profile','read_abi','plan','plan_sha256','authorized_cases','output_directory','listener_observation_file','limits']);
 assert.equal(r.contract,'core17.native-case-execution-request.v3');assert.match(r.operator_sha,ref);assert.equal(r.app_sha,APP);assert.equal(r.installed_core,INSTALLED);assert.equal(r.generation,'v3');
 for(const k of ['app_root','private_root','installer_binding','runtime_binding','session_file','output_directory','listener_observation_file'])assert.ok(typeof r[k]==='string'&&r[k].startsWith('/')&&!r[k].includes('..')&&!r[k].includes('\0'));
 assert.equal(r.runtime_binding,r.private_root+'/core15/service-runtime-binding.json');assert.equal(r.installer_binding,r.private_root+'/core15/service-native-v3/installer-binding.json');
 assert.ok(r.session_file.startsWith(r.private_root+'/'));assert.match(r.session_sha256,sha);
 assert.match(r.actor_A,uuid);assert.match(r.publisher_actor,uuid);assert.notEqual(r.publisher_actor,r.actor_A,'PUBLISHER_MUST_BE_DISTINCT');
 for(const s of [r.A_selection,r.B_selection]){exact(s,['context_id','workspace_id','membership_id','tenant_id']);for(const v of Object.values(s))assert.match(v,uuid);}
 assert.notEqual(r.A_selection.context_id,r.B_selection.context_id);assert.notEqual(r.A_selection.workspace_id,r.B_selection.workspace_id);assert.match(r.B_beneficiary_id,uuid);
 assert.equal(r.app_tree,'6a660dc056e73dc547d9fd6b12fc0d83eca66ea2');assert.equal(r.build_id,'AupRkr1rvWViv-w3ffC4f');assert.equal(r.profile,'core-service-real-app-assembly.v1');assert.equal(r.read_abi,'core-service-app-read.v1');
 validatePlan(r.plan);assert.equal(r.plan_sha256,digest(JSON.stringify(r.plan)));
 assert.ok(Array.isArray(r.authorized_cases)&&r.authorized_cases.length>0&&new Set(r.authorized_cases).size===r.authorized_cases.length);
 assert.ok(r.authorized_cases.every(c=>CASES.includes(c)));assert.equal(r.output_directory,r.private_root+'/core17-native-cases-v3/'+r.plan.run);
 const required=executionLimits(r.authorized_cases);exact(r.limits,['business_POSTs','new_Requests']);assert.deepEqual(r.limits,required,'EXACT_REVIEWED_EFFECT_BUDGET_REQUIRED');
 return r;
}
export function casesContract(){return CASES.map(id=>({id,source_ready:true,executes_by_default:false,
 applicability:id==='different-key'?'two independent Requests for a non-reservation Offering; NO exclusive-capacity conflict oracle':id==='B-populated'?'same-actor authorized B tuple from actual assembly bootstrap; Offering/S01 only, NO Request/command/receipt seed; draft without dispatch':'applicable to dedicated synthetic fixture',
 target:'same owned v3 backend; App FD7 unchanged',settlement:'same-PID CommandComplete + ReadyForQuery I; uncertain => UNKNOWN_STOP',
 recovery:'read-only exact run IDs/keys; no blind resend or global restore',expected:id==='precommit-atomicity'?'real22012 before COMMIT; denied + ROLLBACK; zero scoped four-family delta':id==='same-key'?'real blocking graph; one canonical effect; valid rollback/replay or explicit recovery required':id==='core503'?'actual current-App COMMIT/I then controlled driver ACK fault; SERVICE503/READBACK_REQUIRED and one canonical effect, no fabricated response':'see operator and README'}));}
export function dryRun(r){validateRequest(r);return{contract:'core17.native-cases.dry-run.v3',run:r.plan.run,target_contacted:false,credentials_read:false,SQL_executed:false,limits:r.limits,cases:casesContract().filter(x=>r.authorized_cases.includes(x.id)),order:['exact source/custody/v3 binding','actual target/principal/prestate','dedicated case fixture COMMIT + readback','real Core/PG case','scoped receipt/effect oracle','restore transient fields with exact preimage and known ACK','retain test fixture/evidence; STOP on UNKNOWN'],not_automatic:['fixture purge','TTL/cancel','Auth refresh/enroll','App/relay restart','global ACL mutation','retry after UNKNOWN']};}

export function matchSelection(selections,expected){const rows=selections.filter(s=>Object.keys(expected).every(k=>s[k]===expected[k]));assert.equal(rows.length,1,'EXACT_UNAMBIGUOUS_AUTHORIZED_BOOTSTRAP_TUPLE_REQUIRED');return rows[0];}

export function executionLimits(cases){const posts={stale:1,revoke:2,'expiry-wait':2,'current-authority-wait':2,'same-key':2,'different-key':2,'precommit-atomicity':1,'precommit-disconnect':1,core503:1,'B-populated':0};const effects={stale:0,revoke:1,'expiry-wait':1,'current-authority-wait':1,'same-key':1,'different-key':2,'precommit-atomicity':0,'precommit-disconnect':0,core503:1,'B-populated':0};return{business_POSTs:cases.reduce((s,k)=>s+posts[k],0),new_Requests:cases.reduce((s,k)=>s+effects[k],0)};}
export function exampleRequest(){
 const plan=newPlan(),tuple=()=>Object.fromEntries(['context_id','workspace_id','membership_id','tenant_id'].map(k=>[k,randomUUID()]));
 return{contract:'core17.native-case-execution-request.v3',operator_sha:'a'.repeat(40),app_sha:APP,app_root:'/synthetic/app',installed_core:INSTALLED,private_root:'/synthetic/private',generation:'v3',installer_binding:'/synthetic/private/core15/service-native-v3/installer-binding.json',runtime_binding:'/synthetic/private/core15/service-runtime-binding.json',session_file:'/synthetic/private/current-session.json',session_sha256:'b'.repeat(64),actor_A:randomUUID(),publisher_actor:randomUUID(),A_selection:tuple(),B_selection:tuple(),B_beneficiary_id:randomUUID(),app_tree:'6a660dc056e73dc547d9fd6b12fc0d83eca66ea2',build_id:'AupRkr1rvWViv-w3ffC4f',profile:'core-service-real-app-assembly.v1',read_abi:'core-service-app-read.v1',plan,plan_sha256:digest(JSON.stringify(plan)),authorized_cases:[...CASES],output_directory:'/synthetic/private/core17-native-cases-v3/'+plan.run,listener_observation_file:'/synthetic/platform/listen-observation.json',limits:executionLimits(CASES)};
}
