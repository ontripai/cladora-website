import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url));const mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const {NextRequest}=require('next/server');
const context='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const opportunity='00000000-0000-0000-0000-000000000001';
const base={version:1,context_id:context,workspace_id:workspace,opportunity_id:opportunity,idempotency_key:'gateway-test-0001',expected_underwriting_version:1};
let auth={data:{claims:{sub:'principal'}},error:null},result={data:{version:2,idempotent:false,workspace_id:workspace,opportunity_id:context},error:null},calls=[],cases=0;
const {POST,GET}=load('src/app/api/customer/v2/airprop/diligence/route.ts',{
 '@/lib/airprop/diligence-draft-contract-v1':load('src/lib/airprop/diligence-draft-contract-v1.ts'),
 '@/lib/security/same-origin':load('src/lib/security/same-origin.ts'),
 '@/lib/security/request-body':load('src/lib/security/request-body.ts'),
 '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>auth},schema:name=>{assert.equal(name,'customer_api');return{rpc:async(name,args)=>{calls.push({name,args});return result;}};}})},
});
const post=(body=base,headers={})=>new NextRequest('https://cladora.test/api/customer/v2/airprop/diligence',{method:'POST',headers:{origin:'https://cladora.test','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const get=(query=`context_id=${context}&workspace_id=${workspace}&opportunity_id=${opportunity}`)=>new NextRequest(`https://cladora.test/api/customer/v2/airprop/diligence?${query}`);
async function check(name,fn){calls=[];await fn();cases++;console.log(`PASS ${name}`);}
await check('POST uses canonical payload and exact workspace with no client actor/hash',async()=>{const r=await POST(post());assert.equal(r.status,201);assert.deepEqual(calls,[{name:'create_airprop_diligence_draft_v1',args:{p_context_id:context,p_workspace_id:workspace,p_idempotency_key:base.idempotency_key,p_opportunity_id:opportunity,p_expected_underwriting_version:1}}]);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('vary'),'Cookie');});
await check('idempotent retry maps to 200',async()=>{result.data.idempotent=true;assert.equal((await POST(post())).status,200);result.data.idempotent=false;});
for(const [body,headers,status] of [[base,{origin:'https://evil.test'},403],[base,{'content-type':'text/plain'},415],['{',{},400],[{...base,tenant_id:workspace},{},400],[{...base,expected_underwriting_version:0},{},400],['x'.repeat(17000),{},413]])await check('invalid mutation never calls RPC',async()=>{const r=await POST(post(body,headers));assert.equal(r.status,status);assert.equal(calls.length,0);assert.match(r.headers.get('cache-control'),/no-store/);});
for(const claims of [{data:{claims:{}},error:null},{data:{claims:{sub:'actor'}},error:{message:'private'}}])await check('missing/failed principal cannot mutate or read',async()=>{auth=claims;assert.equal((await POST(post())).status,401);assert.equal((await GET(get())).status,401);assert.equal(calls.length,0);});
auth={data:{claims:{sub:'principal'}},error:null};
for(const [code,message,status,label] of [['42501','private scope detail',403,'AIRPROP_ACCESS_DENIED'],['42501','mfa_required',403,'MFA_REQUIRED'],['22023','airprop_idempotency_conflict',409,'IDEMPOTENCY_CONFLICT'],['22023','airprop_diligence_baseline_conflict',409,'BASELINE_CONFLICT'],['22023','airprop_diligence_already_exists',409,'DRAFT_ALREADY_EXISTS'],['P0002','private id',404,'OPPORTUNITY_NOT_FOUND'],['22023','private validation detail',400,'INVALID_REQUEST'],['XX000','private schema detail',500,'AIRPROP_REQUEST_FAILED']])await check('RPC error mapped without exposing internals',async()=>{result={data:null,error:{code,message}};const r=await POST(post());assert.equal(r.status,status);assert.deepEqual(await r.json(),{error:{code:label}});});
result={data:{version:2,workspace_id:workspace,opportunities:[]},error:null};
await check('GET forwards only explicit target and scoped opportunity',async()=>{const r=await GET(get(`context_id=${context}&workspace_id=${workspace}&opportunity_id=${opportunity}`));assert.equal(r.status,200);assert.deepEqual(calls,[{name:'list_airprop_diligence_drafts_v1',args:{p_context_id:context,p_workspace_id:workspace,p_opportunity_id:opportunity}}]);});
for(const query of ['',`context_id=${context}`,`context_id=${context}&workspace_id=${workspace}&opportunity_id=${opportunity}1`,`context_id=${context}&workspace_id=${workspace}&opportunity_id=${opportunity}&tenant_id=${workspace}`,`context_id=${context}&workspace_id=${workspace}&opportunity_id=${opportunity}&workspace_id=${context}`])await check('GET rejects missing, duplicate and injected query',async()=>{assert.equal((await GET(get(query))).status,400);assert.equal(calls.length,0);});
await check('empty successful create is a server failure',async()=>{result={data:null,error:null};assert.equal((await POST(post())).status,500);});
console.log(`${cases} actual compiled AIRPROP diligence gateway cases passed`);
