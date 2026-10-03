import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const {NextRequest}=require('next/server'),uuid='11111111-1111-4111-8111-111111111111';
let authenticated=true,result={data:{action:'assign_role',id:uuid},error:null},calls=[];
const mocks={'@/lib/customer/workspace-roles-schema':load('src/lib/customer/workspace-roles-schema.ts'),'@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),'@/lib/security/request-body':load('src/lib/security/request-body.ts'),'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:authenticated?{sub:uuid}:{}},error:null})},schema:schema=>{assert.equal(schema,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return result;}};}})}};
const {GET}=load('src/app/api/customer/v1/workspace/roles/assignment-candidates/route.ts',mocks),{POST}=load('src/app/api/customer/v1/workspace/roles/assign/route.ts',mocks);
const get=query=>new NextRequest(`https://cladora.test/api/customer/v1/workspace/roles/assignment-candidates?${query}`);
const payload={context_id:uuid,target_membership_id:uuid,workspace_role_id:uuid,scope_type:'workspace',reason:'Synthetic assignment',idempotency_key:'assign-test-001'};
const post=(body=payload,origin='https://cladora.test')=>new NextRequest('https://cladora.test/api/customer/v1/workspace/roles/assign',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
for(const query of ['',`context_id=invalid`,`context_id=${uuid}&context_id=${uuid}`,`context_id=${uuid}&tenant_id=${uuid}`]){calls=[];assert.equal((await GET(get(query))).status,400);assert.equal(calls.length,0);}
authenticated=false;assert.equal((await GET(get(`context_id=${uuid}`))).status,401);assert.equal((await POST(post())).status,401);authenticated=true;
calls=[];let response=await GET(get(`context_id=${uuid}`));assert.equal(response.status,200);assert.deepEqual(calls,[{name:'list_workspace_role_assignment_candidates_v1',args:{p_context_id:uuid}}]);assert.match(response.headers.get('cache-control'),/no-store/);
calls=[];assert.equal((await POST(post(payload,'https://evil.test'))).status,403);assert.equal((await POST(post({...payload,tenant_id:uuid}))).status,400);assert.equal(calls.length,0);
response=await POST(post());assert.equal(response.status,200);assert.equal(calls.at(-1).args.p_scope_type,'workspace');assert.equal(calls.at(-1).args.p_property_id,null);
for(const [code,message,status] of [['42501','mfa_required',403],['42501','private customer scope detail',403],['22023','workspace_role_idempotency_conflict',409],['22023','private validation detail',400],['XX000','private database error',500]]){result={data:null,error:{code,message}};const response=await POST(post());assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes('private'),false);}
result={data:null,error:null};assert.equal((await POST(post())).status,500);
console.log('PASS compiled candidate and assignment gateways: strict queries/payload, user authentication, exact RPC, origin, MFA and sanitized failures');
