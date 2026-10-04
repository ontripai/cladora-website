import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){
 const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);
 mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
 return mod.exports;
}
const schemas=load('src/lib/customer/maintenance-schema.ts');
const pilot='80000000-0000-0000-0000-000000000004',normal='a8936e74-9582-4517-8c4d-eced79a7c49b';
const invalid=['','invalid',pilot.slice(1),`${pilot}0`,pilot.replace(/4$/,'g'),` ${pilot}`,`${pilot}\n`,pilot.replaceAll('-',''),`{${pilot}}`];
for(const id of [pilot,normal,normal.toUpperCase()])assert.ok(schemas.maintenanceUuidSchema.safeParse(id).success);
for(const id of invalid)assert.equal(schemas.maintenanceUuidSchema.safeParse(id).success,false);
assert.ok(schemas.createMaintenanceRequestSchema.safeParse({context_id:pilot,property_id:pilot,building_id:pilot,unit_id:pilot,title:'Pilot request'}).success);
assert.ok(schemas.createWorkOrderSchema.safeParse({context_id:pilot,property_id:pilot,building_id:pilot,asset_id:pilot,vendor_id:pilot,title:'Pilot work order'}).success);
let authenticated=true,calls=[],rpcError=null;
const mocks={
 '@/lib/customer/maintenance-schema':schemas,
 '@/lib/customer/maintenance-api-helper':load('src/lib/customer/maintenance-api-helper.ts'),
 '@/lib/customer/maintenance-defaults':load('src/lib/customer/maintenance-defaults.ts'),
 '@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),
 '@/lib/security/request-body':load('src/lib/security/request-body.ts'),
 '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:authenticated?{sub:normal}:{}},error:null})},schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return {data:rpcError?null:{plans:[],rows:[]},error:rpcError};}};}})},
};
const {NextRequest}=require('next/server');
const evidence=load('src/app/api/customer/v1/maintenance/route.ts',mocks);
const calendar=load('src/app/api/customer/v1/maintenance-plans/route.ts',mocks);
const get=(path,id)=>new NextRequest(`https://cladora.test/api/customer/v1/${path}?context_id=${encodeURIComponent(id)}`);
const payload={action:'save',context_id:pilot,id:pilot,revision:0,asset_id:pilot,vendor_id:pilot,name:'Pilot plan',anchor:'2026-10-04',unit:'months',every:1,enabled:true,checklist:['Inspect equipment']};
const post=(body=payload,origin='https://cladora.test')=>new NextRequest('https://cladora.test/api/customer/v1/maintenance-plans',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
for(const id of invalid){
 calls=[];
 assert.equal((await evidence.GET(get('maintenance',id))).status,400);
 assert.equal((await calendar.GET(get('maintenance-plans',id))).status,400);
 assert.equal((await calendar.POST(post({...payload,asset_id:id}))).status,400);
 assert.equal(calls.length,0,'malformed identifiers never reach RPC');
}
for(const id of [pilot,normal,normal.toUpperCase()]){
 calls=[];let response=await evidence.GET(get('maintenance',id));assert.equal(response.status,200);assert.equal(calls.at(-1).args.p_context_id,id);assert.equal(calls.at(-1).name,'get_maintenance_v1');assert.match(response.headers.get('cache-control'),/no-store/);
 response=await calendar.GET(get('maintenance-plans',id));assert.equal(response.status,200);assert.deepEqual(calls.at(-1),{name:'list_calendar_plans_v1',args:{p_context_id:id}});
}
calls=[];assert.equal((await calendar.POST(post())).status,200);assert.equal(calls.at(-1).name,'save_calendar_plan_v1');assert.equal(calls.at(-1).args.p_asset_id,pilot);assert.equal(calls.at(-1).args.p_vendor_id,pilot);
assert.equal((await calendar.POST(post({action:'generate',context_id:pilot,plan_id:pilot,due_on:'2026-10-04'}))).status,200);assert.equal(calls.at(-1).name,'generate_calendar_order_v1');
calls=[];assert.equal((await calendar.POST(post(payload,'https://evil.test'))).status,403);assert.equal((await calendar.POST(post({...payload,tenant_id:pilot}))).status,400);assert.equal(calls.length,0);
authenticated=false;calls=[];assert.equal((await evidence.GET(get('maintenance',pilot))).status,401);assert.equal((await calendar.GET(get('maintenance-plans',pilot))).status,401);assert.equal((await calendar.POST(post())).status,401);assert.equal(calls.length,0);authenticated=true;
for(const message of ['customer_context_access_denied','mfa_required','maintenance_permission_required']){
 rpcError={code:'42501',message};assert.equal((await evidence.GET(get('maintenance',pilot))).status,403);assert.equal((await calendar.GET(get('maintenance-plans',pilot))).status,403);assert.equal((await calendar.POST(post())).status,403);
}
rpcError={code:'40001',message:'private revision detail'};assert.equal((await calendar.POST(post())).status,409);
console.log('PASS maintenance PostgreSQL identifiers: real schemas and gateways, pilot/RFC IDs, malformed IDs, origin, strict payload, authentication, authorization, MFA and conflict');
