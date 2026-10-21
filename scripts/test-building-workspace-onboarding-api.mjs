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
const record={run_id:run,status:'draft',payload,property_id:null,effective_units:null};
let calls=[],result={data:record,error:null},aal=true,platformRole=true;
const mocks={
 '@/lib/customer/building-setup-schema':schema,
 '@/lib/customer/onboarding-import-helper':load('src/lib/customer/onboarding-import-helper.ts'),
 '@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),
 '@/lib/security/request-body':load('src/lib/security/request-body.ts'),
 '@/lib/platform/auth':{getPlatformAuthContext:async()=>({}),hasPlatformAal2:()=>aal,hasPlatformRole:()=>platformRole},
 '@/lib/supabase/server':{createClient:async()=>({schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return result;}};}})},
};
const create=load('src/app/api/customer/v1/onboarding/building-setup/route.ts',mocks).POST;
const detail=load('src/app/api/customer/v1/onboarding/building-setup/[id]/route.ts',mocks);
const action=load('src/app/api/customer/v1/onboarding/building-setup/[id]/[action]/route.ts',mocks).POST;
const link=load('src/app/api/platform/v1/cases/link/route.ts',mocks).POST;
const req=(path,body,method='POST',origin='https://cladora.test',type='application/json')=>new NextRequest(`https://cladora.test${path}`,{method,headers:{origin,'content-type':type},...(method==='GET'?{}:{body:JSON.stringify(body)})});
const command={context_id:context,idempotency_key:'setup-synthetic-0001',payload};
const ctx=(id=run,which='rehearse')=>({params:Promise.resolve({id,action:which})});
let checks=0;
function equal(a,b,msg){checks++;assert.deepEqual(a,b,msg);}
for(const bad of [{...payload,currency:'EUR'},{...payload,period_start:'2026-02-30'},{...payload,units:[...payload.units,{...payload.units[0],code:'a-01'}]},{...payload,units:[{...payload.units[0],area_m2:0}]},{...payload,tenant_id:foreign}])equal(schema.buildingSetupPayloadSchema.safeParse(bad).success,false);
equal(schema.createBuildingSetupSchema.safeParse(command).success,true);
for(const [handler,body,args] of [[create,command,undefined],[detail.PATCH,{context_id:context,units:payload.units},ctx()],[action,{context_id:context},ctx()]]){
 calls=[];equal((await handler(req('/api/customer/v1/onboarding/building-setup',body,'POST','https://evil.test'),args)).status,403);equal(calls.length,0);
 equal((await handler(req('/api/customer/v1/onboarding/building-setup',body,'POST','https://cladora.test','text/plain'),args)).status,415);
 equal((await handler(req('/api/customer/v1/onboarding/building-setup',{...body,tenant_id:foreign}),args)).status,400);equal(calls.length,0);
}
calls=[];result={data:{run_id:run,status:'draft',payload_hash:'a'.repeat(64)},error:null};let response=await create(req('/setup',command));equal(response.status,201);equal(calls,[{name:'create_building_setup_v1',args:{p_context_id:context,p_idempotency_key:command.idempotency_key,p_payload:payload}}]);
result={data:record,error:null};response=await detail.GET(req(`/setup/${run}?context_id=${context}`,null,'GET'),ctx());equal(response.status,200);equal((await response.json()).run_id,run);assert.match(response.headers.get('cache-control'),/no-store/);checks++;
for(const bad of [null,{...record,run_id:foreign},{...record,payload:{...payload,currency:'EUR'}}]){result={data:bad,error:null};equal((await detail.GET(req(`/setup/${run}?context_id=${context}`,null,'GET'),ctx())).status,502);}
calls=[];equal((await action(req('/setup',{context_id:context}),ctx('bad'))).status,400);equal((await action(req('/setup',{context_id:context}),ctx(run,'__proto__'))).status,400);equal(calls.length,0);
for(const bad of [null,{run_id:foreign,status:'approved'},{run_id:run,status:'bogus'}]){result={data:bad,error:null};equal((await action(req('/setup',{context_id:context}),ctx(run,'approve'))).status,502);}
for(const bad of [null,{status:'draft'}]){result={data:bad,error:null};equal((await create(req('/setup',command))).status,502);}
// These are server-error propagation tests with mocked RPC, NOT executed authorization policies.
for(const [message,which] of [['mfa_required','approve'],['setup_dual_control_violation','approve'],['revoked_context','provision'],['cross_workspace_denied','submit'],['expired_membership','rehearse']]){result={data:null,error:{code:'42501',message}};response=await action(req('/setup',{context_id:context}),ctx(run,which));equal(response.status,403);equal(JSON.stringify(await response.json()).includes(message),false);}
result={data:{run_id:run,status:'draft',payload},error:null};calls=[];equal((await detail.PATCH(req('/setup',{context_id:context,units:[...payload.units,...payload.units]},'PATCH'),ctx())).status,400);equal(calls.length,0);
const linkBody={case_id:context,workspace_id:run,contract_id:null,reason:'Synthetic approved case'};
aal=false;calls=[];equal((await link(req('/case',linkBody))).status,403);equal(calls.length,0);aal=true;platformRole=false;equal((await link(req('/case',linkBody))).status,403);platformRole=true;
equal((await link(req('/case',{...linkBody,tenant_id:foreign}))).status,400);
equal((await link(req('/case',linkBody,'POST','https://cladora.test','text/plain'))).status,415);
calls=[];equal((await link(req('/case',{...linkBody,reason:'x'.repeat(9000)}))).status,413);equal(calls.length,0);
for(const message of ['approved_access_basis_required','case_workspace_tenant_mismatch','case_unavailable','expired_basis','revoked_basis']){result={data:null,error:{code:'42501',message}};response=await link(req('/case',linkBody));equal(response.status,403);equal(JSON.stringify(await response.json()).includes(message),false);}
result={data:{case_id:context,workspace_id:run,contract_id:null},error:null};calls=[];equal((await link(req('/case',linkBody))).status,200);equal(calls,[{name:'link_customer_case_workspace_v1',args:{p_case_id:context,p_workspace_id:run,p_contract_id:null,p_reason:linkBody.reason}}]);
const attempt={action:'rehearse',run_id:run,context_id:context,before:record};
equal(helpers.reconcileSetupAttempt(attempt,record),'retry');
equal(helpers.reconcileSetupAttempt(attempt,{...record,status:'approved'}),'done');
equal(helpers.reconcileSetupAttempt(attempt,{...record,status:'cancelled'}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,{...record,run_id:foreign}),'conflict');
equal(helpers.reconcileSetupAttempt(attempt,{...record,payload:{...payload,building:{...payload.building,name:'Changed'}}}),'conflict');
equal(helpers.reconcileSetupAttempt({action:'create',command},record),'done');
const desired=[{...payload.units[0],area_m2:70}],save={...attempt,action:'save',units:desired};
equal(helpers.reconcileSetupAttempt(save,record),'retry');equal(helpers.reconcileSetupAttempt(save,{...record,payload:{...payload,units:desired}}),'done');equal(helpers.reconcileSetupAttempt(save,{...record,payload:{...payload,units:[{...desired[0],area_m2:80}]}}),'conflict');
console.log(`PASS building Workspace API/reconciliation: ${checks} checks; actual compiled routes, validation and mapper; Auth/RPC MOCKED, no DB/network.`);
