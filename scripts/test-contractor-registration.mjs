import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const schemas=load('src/lib/customer/contractor-schema.ts',{'./maintenance-schema':load('src/lib/customer/maintenance-schema.ts')});
const pilot='80000000-0000-0000-0000-000000000004';let authenticated=true,calls=[],rpcError=null;
const mocks={'@/lib/customer/contractor-schema':schemas,'@/lib/customer/maintenance-api-helper':load('src/lib/customer/maintenance-api-helper.ts'),'@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),'@/lib/security/request-body':load('src/lib/security/request-body.ts'),'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:authenticated?{sub:pilot}:{}},error:null})},schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return {data:{success:true},error:rpcError};}};}})}};
const gateway=load('src/app/api/customer/v1/procurement/contractors/route.ts',mocks);const {NextRequest}=require('next/server');
const payload={action:'register',context_id:pilot,id:pilot,name:'Pilot contractor',category:'ventilation'};
const get=id=>new NextRequest(`https://cladora.test/api/customer/v1/procurement/contractors?context_id=${encodeURIComponent(id)}`);
const post=(body=payload,origin='https://cladora.test',type='application/json')=>new NextRequest('https://cladora.test/api/customer/v1/procurement/contractors',{method:'POST',headers:{origin,'content-type':type},body:JSON.stringify(body)});
for(const id of [pilot,'a8936e74-9582-4517-8c4d-eced79a7c49b']){assert.equal((await gateway.GET(get(id))).status,200);assert.equal(calls.at(-1).args.p_context_id,id);}
calls=[];const response=await gateway.POST(post());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.deepEqual(calls,[{name:'register_contractor_v1',args:{p_context_id:pilot,p_id:pilot,p_name:'Pilot contractor',p_category:'ventilation'}}]);
calls=[];const approve={action:'approve',context_id:pilot,vendor_id:pilot,reason:'Synthetic pilot approval only'};assert.equal((await gateway.POST(post(approve))).status,200);assert.deepEqual(calls,[{name:'approve_contractor_v1',args:{p_context_id:pilot,p_vendor_id:pilot,p_reason:approve.reason}}]);
calls=[];for(const body of [{...payload,context_id:'invalid'},{...payload,tenant_id:pilot},{...payload,status:'approved'},{...payload,category:'unknown'},{...approve,reason:'short'}])assert.equal((await gateway.POST(post(body))).status,400);assert.equal(calls.length,0);
assert.equal((await gateway.POST(post(payload,'https://evil.test'))).status,403);assert.equal((await gateway.POST(post(payload,'https://cladora.test','text/plain'))).status,415);assert.equal(calls.length,0);
authenticated=false;assert.equal((await gateway.GET(get(pilot))).status,401);assert.equal((await gateway.POST(post())).status,401);authenticated=true;
rpcError={code:'42501',message:'mfa_required'};const denied=await gateway.POST(post());assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'MFA_REQUIRED');rpcError={code:'40001',message:'contractor_replay_conflict'};assert.equal((await gateway.POST(post())).status,409);
console.log('PASS contractor gateway: stored UUIDs, separate register/approve, strict payload, origin, auth, MFA and conflict');
