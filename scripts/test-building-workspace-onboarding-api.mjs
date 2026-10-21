import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const {NextRequest}=require('next/server');
const schema=load('src/lib/customer/building-setup-schema.ts');
const helpers=load('src/lib/customer/building-workspace-onboarding.ts',{'./building-setup-schema':schema});
const context='80000000-0000-0000-0000-000000000004',run='80000000-0000-0000-0000-000000000005',foreign='80000000-0000-0000-0000-000000000006';
const payload={association:{name:'CLADORA Synthetic Association'},building:{name:'Synthetic Building A',code:'BLD-A',floors:4},currency:'RON',period_start:'2026-01-01',period_end:'2026-12-31',units:[{code:'A-01',floor:0,area_m2:62}],opening_balances:[]};
const record={version:2,workspace_id:foreign,revision:1,run_id:run,status:'draft',payload,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:{run_id:run},submitted_revision:null,submitted_payload_hash:null,last_command_key:null,last_command_receipt:null,property_id:null,effective_units:null};
const actionBody={context_id:context,workspace_id:foreign,expected_revision:1,command_key:`setup-${run}-r1-synthetic-key`,expected_payload_hash:'a'.repeat(64)};
let calls=[],result={data:record,error:null},aal=true,platformRole=true;
const mocks={
 '@/lib/customer/building-setup-schema':schema,
 '@/lib/customer/building-workspace-onboarding-api':load('src/lib/customer/building-workspace-onboarding-api.ts',{'./onboarding-import-helper':load('src/lib/customer/onboarding-import-helper.ts')}),
 '@/lib/customer/onboarding-import-helper':load('src/lib/customer/onboarding-import-helper.ts'),
 '@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),
 '@/lib/security/request-body':load('src/lib/security/request-body.ts'),
 '@/lib/platform/auth':{getPlatformAuthContext:async()=>({}),hasPlatformAal2:()=>aal,hasPlatformRole:()=>platformRole},
 '@/lib/supabase/server':{createClient:async()=>({schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return result;}};}})},
};
const baseRoute=load('src/app/api/customer/v1/onboarding/building-setup/route.ts',mocks),create=baseRoute.POST;
const detail=load('src/app/api/customer/v1/onboarding/building-setup/[id]/route.ts',mocks);
const action=load('src/app/api/customer/v1/onboarding/building-setup/[id]/[action]/route.ts',mocks).POST;
const link=load('src/app/api/platform/v1/cases/link/route.ts',mocks).POST;
const req=(path,body,method='POST',origin='https://cladora.test',type='application/json')=>new NextRequest(`https://cladora.test${path}`,{method,headers:{origin,'content-type':type},...(method==='GET'?{}:{body:JSON.stringify(body)})});
const command={context_id:context,workspace_id:foreign,idempotency_key:'setup-synthetic-0001',payload};
const ctx=(id=run,which='rehearse')=>({params:Promise.resolve({id,action:which})});
let checks=0;
function equal(a,b,msg){checks++;assert.deepEqual(a,b,msg);}
for(const bad of [{...payload,currency:'EUR'},{...payload,period_start:'2026-02-30'},{...payload,units:[...payload.units,{...payload.units[0],code:'a-01'}]},{...payload,units:[{...payload.units[0],area_m2:0}]},{...payload,tenant_id:foreign}])equal(schema.buildingSetupPayloadSchema.safeParse(bad).success,false);
equal(schema.createBuildingSetupSchema.safeParse(command).success,true);
for(const [handler,body,args] of [[create,command,undefined],[detail.PATCH,{...actionBody,units:payload.units},ctx()],[action,{...actionBody},ctx(run,'approve')]]){
 calls=[];equal((await handler(req('/api/customer/v1/onboarding/building-setup',body,'POST','https://evil.test'),args)).status,403);equal(calls.length,0);
 equal((await handler(req('/api/customer/v1/onboarding/building-setup',body,'POST','https://cladora.test','text/plain'),args)).status,415);
 equal((await handler(req('/api/customer/v1/onboarding/building-setup',{...body,tenant_id:foreign}),args)).status,400);equal(calls.length,0);
}
calls=[];result={data:{version:2,workspace_id:foreign,revision:1,run_id:run,status:'draft',creation_request_hash:'b'.repeat(64)},error:null};let response=await create(req('/setup',command));equal(response.status,201);equal(calls,[{name:'create_building_setup_v2',args:{p_context_id:context,p_workspace_id:foreign,p_idempotency_key:command.idempotency_key,p_payload:payload}}]);
result={data:record,error:null};response=await detail.GET(req(`/setup/${run}?context_id=${context}&workspace_id=${foreign}`,null,'GET'),ctx());equal(response.status,200);equal((await response.json()).run_id,run);assert.match(response.headers.get('cache-control'),/no-store/);checks++;
for(const bad of [null,{...record,run_id:foreign},{...record,payload:{...payload,currency:'EUR'}}]){result={data:bad,error:null};equal((await detail.GET(req(`/setup/${run}?context_id=${context}&workspace_id=${foreign}`,null,'GET'),ctx())).status,502);}
calls=[];equal((await action(req('/setup',actionBody),ctx('bad'))).status,400);equal((await action(req('/setup',actionBody),ctx(run,'__proto__'))).status,400);equal(calls.length,0);
for(const bad of [null,{...record,run_id:foreign,status:'approved'},{...record,status:'bogus'}]){result={data:bad,error:null};equal((await action(req('/setup',actionBody),ctx(run,'approve'))).status,502);}
for(const bad of [null,{status:'draft'}]){result={data:bad,error:null};equal((await create(req('/setup',command))).status,502);}
// These are server-error propagation tests with mocked RPC, NOT executed authorization policies.
for(const [message,which] of [['mfa_required','approve'],['setup_dual_control_violation','approve'],['revoked_context','provision'],['cross_workspace_denied','submit'],['expired_membership','rehearse']]){result={data:null,error:{code:'42501',message}};response=await action(req('/setup',which==='approve'?actionBody:(({expected_payload_hash,...rest})=>rest)(actionBody)),ctx(run,which));equal(response.status,403);equal(JSON.stringify(await response.json()).includes(message),false);}
result={data:{run_id:run,status:'draft',payload},error:null};calls=[];equal((await detail.PATCH(req('/setup',{...(({expected_payload_hash,...rest})=>rest)(actionBody),units:[...payload.units,...payload.units]},'PATCH'),ctx())).status,400);equal(calls.length,0);
const linkBody={case_id:context,workspace_id:run,contract_id:null,reason:'Synthetic approved case'};
aal=false;calls=[];equal((await link(req('/case',linkBody))).status,403);equal(calls.length,0);aal=true;platformRole=false;equal((await link(req('/case',linkBody))).status,403);platformRole=true;
equal((await link(req('/case',{...linkBody,tenant_id:foreign}))).status,400);
equal((await link(req('/case',linkBody,'POST','https://cladora.test','text/plain'))).status,415);
calls=[];equal((await link(req('/case',{...linkBody,reason:'x'.repeat(9000)}))).status,413);equal(calls.length,0);
for(const message of ['approved_access_basis_required','case_workspace_tenant_mismatch','case_unavailable','expired_basis','revoked_basis']){result={data:null,error:{code:'42501',message}};response=await link(req('/case',linkBody));equal(response.status,403);equal(JSON.stringify(await response.json()).includes(message),false);}
result={data:{case_id:context,workspace_id:run,contract_id:null},error:null};calls=[];equal((await link(req('/case',linkBody))).status,200);equal(calls,[{name:'link_customer_case_workspace_v1',args:{p_case_id:context,p_workspace_id:run,p_contract_id:null,p_reason:linkBody.reason}}]);
const attempt={action:'rehearse',run_id:run,context_id:context,workspace_id:foreign,command_key:actionBody.command_key,before:record};
const done=(operation='rehearse')=>({...record,revision:2,status:operation==='rehearse'?'rehearsed':'draft',last_command_key:attempt.command_key,last_command_receipt:{run_id:run,workspace_id:foreign,revision:2,expected_revision:1,operation,command_key:attempt.command_key}});
equal(helpers.reconcileSetupAttempt(attempt,record),'retry');
equal(helpers.reconcileSetupAttempt(attempt,{...record,status:'approved'}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,{...record,status:'cancelled'}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,{...record,run_id:foreign}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,{...record,payload:{...payload,building:{...payload.building,name:'Changed'}}}),'conflict');
equal(helpers.reconcileSetupAttempt({action:'create',command},record),'retry');
const desired=[{...payload.units[0],area_m2:70}],save={...attempt,action:'save',units:desired};
equal(helpers.reconcileSetupAttempt(save,record),'retry');equal(helpers.reconcileSetupAttempt(save,{...done('update'),payload:{...payload,units:desired}}),'done');equal(helpers.reconcileSetupAttempt(save,{...record,revision:2,payload:{...payload,units:[{...desired[0],area_m2:80}]}}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,done()),'done');
equal(helpers.reconcileSetupAttempt({action:'create',command,receipt_hash:'b'.repeat(64)},record),'done');
result={data:null,error:null};equal((await baseRoute.GET(req(`/setup?context_id=${context}&workspace_id=${foreign}&idempotency_key=setup-test-key`,null,'GET'))).status,200);
result={data:null,error:{code:'42501',message:'recovery_denied'}};equal((await baseRoute.GET(req(`/setup?context_id=${context}&workspace_id=${foreign}&idempotency_key=setup-test-key`,null,'GET'))).status,403);
equal((await action(req('/setup',{context_id:context,workspace_id:foreign}),ctx())).status,428);
for(const code of ['40001','22004']){result={data:null,error:{code,message:'private detail'}};equal((await action(req('/setup',actionBody),ctx(run,'approve'))).status,code==='40001'?409:428);}

const caseSchemas=load('src/lib/customer/building-workspace-onboarding-case.ts',{'./building-setup-schema':schema});
mocks['@/lib/customer/building-workspace-onboarding-case']=caseSchemas;
const caseRoutes=load('src/app/api/platform/v1/cases/workspaces/route.ts',mocks);
const caseCommand={case_id:context,workspace_type:'ASSOCIATION',profile_code:'residential',model_code:'association_managed',commercial_owner:'Synthetic manager',reason:'Synthetic preparation',idempotency_key:'case-synthetic-001'};
result={data:{workspace_id:foreign,tenant_id:context,status:'LEAD'},error:null};calls=[];equal((await caseRoutes.POST(req('/case',caseCommand))).status,201);equal(calls[0].name,'create_case_workspace_v2');equal(calls[0].args.p_idempotency_key,caseCommand.idempotency_key);
result={data:null,error:null};calls=[];equal((await caseRoutes.GET(req(`/case?case_id=${context}&idempotency_key=case-synthetic-001`,null,'GET'))).status,200);equal(calls[0].name,'get_case_workspace_attempt_v1');
result={data:null,error:{code:'42501',message:'expired_basis'}};equal((await caseRoutes.GET(req(`/case?case_id=${context}&idempotency_key=case-synthetic-001`,null,'GET'))).status,403);
result={data:null,error:{code:'23505',message:'collision'}};equal((await caseRoutes.POST(req('/case',caseCommand))).status,409);
const reviewerRoute=load('src/app/api/customer/v1/pilot-reviewer/route.ts',mocks);
result={data:{status:'active',workspace_id:foreign,context_id:context,runs:[{id:run,workspace_id:foreign,status:'submitted',building:'Synthetic',revision:3,payload_hash:'a'.repeat(64),submitted_revision:2,submitted_payload_hash:'a'.repeat(64)}]},error:null};equal((await reviewerRoute.GET()).status,502,'stale review projection rejected');
result.data.runs[0].submitted_revision=3;equal((await reviewerRoute.GET()).status,200);
console.log(`PASS building Workspace API/reconciliation: ${checks} checks; actual compiled routes, validation and mapper; Auth/RPC MOCKED, no DB/network.`);
