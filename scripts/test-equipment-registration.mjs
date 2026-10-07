import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const schemas=load('src/lib/customer/assets-schema.ts');
const pilot='80000000-0000-0000-0000-000000000004';
let authenticated=true,calls=[],rpcError=null;
const mocks={'@/lib/customer/assets-schema':schemas,'@/lib/customer/assets-api-helper':load('src/lib/customer/assets-api-helper.ts'),'@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),'@/lib/security/request-body':load('src/lib/security/request-body.ts'),'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:authenticated?{sub:pilot}:{}},error:null})},schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return {data:{success:true},error:rpcError};}};}})}};
const gateway=load('src/app/api/customer/v1/assets/registration/route.ts',mocks);const {NextRequest}=require('next/server');
const payload={context_id:pilot,property_id:pilot,building_id:pilot,category_code:'ventilation',asset_code:'PILOT-1',name:'Pilot ventilation'};
const get=id=>new NextRequest(`https://cladora.test/api/customer/v1/assets/registration?context_id=${encodeURIComponent(id)}`);
const post=(body=payload,origin='https://cladora.test',type='application/json')=>new NextRequest('https://cladora.test/api/customer/v1/assets/registration',{method:'POST',headers:{origin,'content-type':type},body:JSON.stringify(body)});
for(const id of [pilot,'a8936e74-9582-4517-8c4d-eced79a7c49b','A8936E74-9582-4517-8C4D-ECED79A7C49B']){assert.ok(schemas.assetUuidSchema.safeParse(id).success);assert.equal((await gateway.GET(get(id))).status,200);assert.equal(calls.at(-1).args.p_context_id,id);}
for(const id of ['invalid',pilot+'\n',' '+pilot,pilot.slice(1)]){calls=[];assert.equal((await gateway.GET(get(id))).status,400);assert.equal((await gateway.POST(post({...payload,property_id:id}))).status,400);assert.equal(calls.length,0);}
calls=[];const response=await gateway.POST(post());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.deepEqual(calls,[{name:'register_equipment_v1',args:{p_context_id:pilot,p_property_id:pilot,p_building_id:pilot,p_category_code:'ventilation',p_asset_code:'PILOT-1',p_name:'Pilot ventilation'}}]);
calls=[];assert.equal((await gateway.POST(post(payload,'https://evil.test'))).status,403);assert.equal((await gateway.POST(post(payload,'https://cladora.test','text/plain'))).status,415);assert.equal((await gateway.POST(post({...payload,tenant_id:pilot}))).status,400);assert.equal((await gateway.POST(post({...payload,category_code:'unknown'}))).status,400);assert.equal(calls.length,0);
authenticated=false;assert.equal((await gateway.GET(get(pilot))).status,401);assert.equal((await gateway.POST(post())).status,401);assert.equal(calls.length,0);authenticated=true;
for(const message of ['asset_context_scope_violation','asset_context_access_denied','INSUFFICIENT_PERMISSIONS']){rpcError={code:'42501',message};assert.equal((await gateway.GET(get(pilot))).status,403);assert.equal((await gateway.POST(post())).status,403);}
rpcError={code:'42501',message:'MFA_REQUIRED'};const denied=await gateway.POST(post());assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'MFA_REQUIRED');
console.log('PASS equipment registration: stored IDs, strict payload, exact RPC, origin, media type, auth, scope and MFA');
