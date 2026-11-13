/** Actual CE module, modeled SDK/pool only. No PG/Auth/socket or installation. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
assert.equal(require('next/package.json').version,'16.4.1');assert.equal(require('zod/package.json').version,'4.6.6');
const modules=new Map();let sdk;
// Compile the actual application. Only the SDK boundary is replaced; Core/CE
// providers, schemas and request-pool implementation remain the real source.
function load(url){if(!existsSync(url)&&url.pathname.endsWith('.ts'))url=new URL(url.href.replace(/\.ts$/,'.tsx'));
 if(url.pathname.endsWith('/src/lib/supabase/server.ts'))return {createClient:async()=>sdk};
 if(modules.has(url.href))return modules.get(url.href).exports;
 const mod=new Module(fileURLToPath(url));modules.set(url.href,mod);
 mod.require=name=>name==='server-only'?{}:name.startsWith('@/')?load(new URL(`../../src/${name.slice(2)}.ts`,import.meta.url))
 :name.startsWith('.')?load(new URL(/\.(?:tsx?|m?js)$/.test(name)?name:`${name}.ts`,url)):require(name);
 mod._compile(ts.transpileModule(readFileSync(url,'utf8'),{fileName:fileURLToPath(url),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,fileURLToPath(url));return mod.exports;}
const ce=load(new URL('../src/lib/community/experience-guide-lifecycle-http-v1.ts',import.meta.url));
const runtime=load(new URL('../src/lib/community/experience-guide-functional-http-v1.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const claims=()=>({sub:id(1),session_id:id(2),exp:4070908800,role:'authenticated',aal:'aal2',user_metadata:{session_id:id(99)}});
function backend(overrides={}){const state={claims:claims(),user:id(1),sessionUser:id(1),expires:4070908800,aal:'aal2',claimsError:null,...overrides};
 sdk={auth:{getUser:async()=>({data:{user:{id:state.user}},error:null}),getSession:async()=>({data:{session:{user:{id:state.sessionUser},expires_at:state.expires}},error:null}),
 getClaims:async()=>({data:{claims:state.claims},error:state.claimsError}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:state.aal},error:null})}}};return state;}
let captured=null,queries=[],connections=0;
const lease={contract_version:'core-platform-role-bound-pool.v1',connection_model:'direct',async connect(){connections++;return {
 async query(text,values=[]){queries.push({text,values});
 if(text.startsWith('select current_user::text'))return {rows:[{current_user:'cladora_ce_guide_executor',session_user:'cladora_ce_guide_runtime'}],rowCount:1};
 if(text.includes('as claims,'))captured=JSON.parse(values[0]);return {rows:[],rowCount:0};},release(){},};}};
const request=new Request('https://ce.test/api/customer/v1/experience/guides/draft');let count=0;
const selected=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
async function check(name,fn){if(selected&&selected!==name)return;await fn();console.log(`ok ${++count} - ${name}`);}
await check('verified issuer SID/exp survive the real CE authenticator and request-pool BEGIN',async()=>{backend();const session=await ce.authenticateExperienceGuideLifecycleServerSessionV1(request);
 assert.equal(session.session_id,id(2));assert.equal(session.expires_at,4070908800);
 const client=await ce.createExperienceGuideLifecycleRequestPoolV1(lease,session,{context_id:id(3),workspace_id:id(4)}).connect();
 await client.query('begin isolation level serializable');assert.deepEqual(captured,{sub:id(1),role:'authenticated',aal:'aal2',session_id:id(2),exp:4070908800});
 const write=queries.find(q=>q.text.includes('as claims,'));assert.equal(write.values[4],id(4));assert.equal(write.values[5],id(3));
 await client.query('rollback');client.release();assert.equal(queries.some(q=>/insert|update|grant|create /i.test(q.text)),false);
});
await check('missing/malformed SID or expiry never becomes a native session',async()=>{for(const patch of [{session_id:undefined},{session_id:'not-a-uuid'},{exp:undefined},{exp:0}]){backend({claims:{...claims(),...patch}});assert.equal(await ce.authenticateExperienceGuideLifecycleServerSessionV1(request),null);}});
await check('actor, local-session, expiry, role and assurance mismatches deny',async()=>{for(const changes of [{claims:{...claims(),sub:id(8)}},{sessionUser:id(8)},{expires:4070908799},{claims:{...claims(),role:'service_role'}},{aal:'aal1'},{claimsError:{code:'verified_claims_failed'}}]){backend(changes);assert.equal(await ce.authenticateExperienceGuideLifecycleServerSessionV1(request),null);}});
await check('user metadata cannot supply or replace a missing issuer SID',async()=>{backend({claims:{...claims(),session_id:undefined,user_metadata:{session_id:id(2),exp:4070908800}}});assert.equal(await ce.authenticateExperienceGuideLifecycleServerSessionV1(request),null);});
await check('expiry crossing the SDK await is denied before any pool checkout',async()=>{backend();const before=connections,realNow=Date.now;let release,clock=4070908799000;Date.now=()=>clock;
 try{const original=sdk.auth.getClaims;sdk.auth.getClaims=()=>new Promise(r=>{release=()=>{void original().then(r);};});
 const pending=ce.authenticateExperienceGuideLifecycleServerSessionV1(request);await Promise.resolve();assert.equal(typeof release,'function');clock=4070908801000;release();assert.equal(await pending,null);assert.equal(connections,before);
 }finally{Date.now=realNow;}});
await check('additive legacy modeled carrier stays non-native; malformed new SID is rejected',async()=>{const legacy={source:'supabase_verified_session',actor_id:id(1),assurance_level:'aal2',expires_at:4070908800};
 const client=await ce.createExperienceGuideLifecycleRequestPoolV1(lease,legacy).connect();await client.query('begin');assert.deepEqual(Object.keys(captured).sort(),['aal','role','sub']);await client.query('rollback');client.release();
 assert.throws(()=>ce.createExperienceGuideLifecycleRequestPoolV1(lease,{...legacy,session_id:'invalid'}),e=>e.name==='ZodError');
 assert.equal(runtime.ce012FunctionalDependenciesV1.role_bound_pool,null);
});
await check('invalid role-bound lease stops before BEGIN or request-claim injection',async()=>{backend();const session=await ce.authenticateExperienceGuideLifecycleServerSessionV1(request),calls=[];
 const bad={...lease,async connect(){return {async query(text){calls.push(text);return {rows:[{current_user:'unexpected_owner',session_user:'unexpected_owner'}],rowCount:1};},release(){}};}};
 await assert.rejects(ce.createExperienceGuideLifecycleRequestPoolV1(bad,session).connect());assert.equal(calls.some(q=>q.startsWith('begin')||q.includes('as claims,')),false);
});
const guard=readFileSync(new URL('../supabase/install/core-functional-runtime-v1/04-session-bootstrap.sql',import.meta.url),'utf8');
assert.ok(guard.includes("v_session:=(v_claims->>'session_id')::uuid"));assert.ok(guard.includes("v_expiry:=(v_claims->>'exp')::numeric"));
console.log(JSON.stringify({task:'CE-GUIDE-NATIVE-01',checkpoint:'R0',groups:count,result:'PASS_SCOPED_CONTROLLED_CARRIER',
 existing_runtime_binding:'NULL',guard_source_checked:true,guard_executed:false,native_auth_pg_restart:'NOT_RUN_NOT_PASS',prior_successful_suites:'NOT_RERUN'}));
