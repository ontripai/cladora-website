/** Exact private metadata + controlled Pool/GUC models; no Auth/PG/network calls. */
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{resolve}from'node:path';
import ts from'typescript';
import{candidate,patch,sha,ROOT,PATH,BEFORE}from'./prepare-core-guide-auth-alias-proposal-v1.mjs';
const arg=process.argv.find(x=>x.startsWith('--evidence='));
if(!arg)throw Error('PRIVATE_PLATFORM_EVIDENCE_REQUIRED_NO_ASSUMED_DEFINITION');
const bytes=readFileSync(arg.slice('--evidence='.length));
assert.equal(bytes.length,7112);assert.equal(sha(bytes),'bc5b4e4a189c95b0051e21d9ae62d311b00daff747b88647e99e293a46922946');
const witness=JSON.parse(bytes);let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
const blank=x=>x===null||x===undefined||x===''?null:x;
// Synthetic literal-path semantic models. These never call installed functions.
const jwt=g=>{const s=blank(g['request.jwt.claim'])??blank(g['request.jwt.claims']);return s===null?null:JSON.parse(s);};
const email=g=>{const legacy=blank(g['request.jwt.claim.email']);if(legacy!==null)return legacy;const s=blank(g['request.jwt.claims']);const v=s===null?null:JSON.parse(s)?.email;return v===undefined||v===null?null:typeof v==='string'?v:JSON.stringify(v);};
await check('both exact installed definitions match metadata identity; INVOKER is not issuer verification',()=>{
 for(const f of witness.functions){assert.equal(Buffer.byteLength(f.definition),f.definition_utf8_bytes);assert.equal(sha(f.definition),f.definition_sha256);assert.equal(f.security,'INVOKER');assert.equal(f.proconfig,null);assert.deepEqual(f.explicit_relation_reads_in_body,[]);}
 assert.deepEqual(witness.functions[0].current_setting_paths,['request.jwt.claim.email','request.jwt.claims']);
 assert.deepEqual(witness.functions[1].current_setting_paths,['request.jwt.claim','request.jwt.claims']);
});
await check('shared plural fallback with empty aliases matches; no email absent means NULL',()=>{
 for(const g of [{},{'request.jwt.claims':'{}'},{'request.jwt.claim':'','request.jwt.claim.email':'','request.jwt.claims':'{"email":"SYNTHETIC_CURRENT"}'}])assert.equal(email(g),jwt(g)?.email??null);
});
await check('scalar alias can differ from plural JWT email: absolute equivalence rejected',()=>{
 const g={'request.jwt.claim.email':'SYNTHETIC_LEGACY','request.jwt.claims':'{"email":"SYNTHETIC_CURRENT"}'};assert.notEqual(email(g),jwt(g).email);
});
await check('singular JWT alias can differ from email plural path and cannot verify actor',()=>{
 const g={'request.jwt.claim':'{"sub":"SYNTHETIC_OTHER","email":"SYNTHETIC_OTHER"}','request.jwt.claims':'{"sub":"SYNTHETIC_CURRENT","email":"SYNTHETIC_CURRENT"}'};assert.notEqual(email(g),jwt(g).email);assert.equal(jwt(g).sub,'SYNTHETIC_OTHER');
});
await check('real pinned CE carrier is minimal, transaction-local and does not transport email',()=>{
 const s=execFileSync('git',['show','6259b70268a851113c8f981e2d346da5428e343f:src/lib/community/experience-guide-lifecycle-http-v1.ts'],{cwd:ROOT,encoding:'utf8'});
 const carrier=s.slice(s.indexOf('function claimsFor('),s.indexOf('\n/**',s.indexOf('function claimsFor(')));
 assert.match(carrier,/sub: session.actor_id/);assert.match(carrier,/session_id/);assert.match(carrier,/exp:/);assert.doesNotMatch(carrier,/email|user_metadata/);
 assert.match(s,/set_config\('request.jwt.claims',\$1,true\)/);
});
function load(source){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText)(name=>{if(name==='server-only')return{};throw Error('UNEXPECTED_IMPORT:'+name);},mod,mod.exports);return mod.exports;}
const original=readFileSync(resolve(ROOT,PATH),'utf8');assert.equal(sha(original),BEFORE);
const defaults={'request.jwt.claim':'{"sub":"SYNTHETIC_DEFAULT"}','request.jwt.claim.email':'SYNTHETIC_DEFAULT'};
function physical(){
 const f={role:'',session:{...defaults},local:{},inTx:false,released:[],trace:[],fault:null};
 f.client={async query(sql){f.trace.push(sql);if(f.fault&&f.fault.when(sql))throw f.fault.error;
  if(sql==='reset all'){f.session={...defaults};return{rows:[],rowCount:0};}
  if(sql==='reset role'){f.role=f.runtime;return{rows:[],rowCount:0};}
  if(sql.startsWith('set role ')){f.role=sql.slice(9);return{rows:[],rowCount:0};}
  if(sql==='select current_user::text as current_user,session_user::text as session_user')return{rows:[{current_user:f.role,session_user:f.runtime}],rowCount:1};
  if(sql.includes('role_safety'))return{rows:[{safe:true}],rowCount:1};
  if(sql.startsWith('begin')){f.inTx=true;f.local={};return{command:'BEGIN',rows:[],rowCount:0};}
  if(sql==='commit'||sql==='rollback'){f.inTx=false;f.local={};return{command:sql.toUpperCase(),rows:[],rowCount:0};}
  if(sql.includes('set_config(')){let found=false;for(const m of sql.matchAll(/set_config\('([^']+)','',\s*(true|false)\)/g)){found=true;(m[2]==='true'?f.local:f.session)[m[1]]='';}if(!found)throw Error('UNMODELED_SET_CONFIG');return{rows:[],rowCount:1};}
  throw Error('UNMODELED_QUERY');
 },release(flag){f.released.push(flag);}};
 f.pool={async connect(){f.role=f.runtime;return f.client;}};return f;
}
async function lease(module,service=false){const f=physical();f.runtime=service?module.corePlatformServiceSubjectLinkRuntimeRoleV1:module.corePlatformCeGuideRuntimeRoleV1;const factory=service?module.createCorePlatformServiceSubjectLinkRoleBoundPoolV1:module.createCorePlatformRoleBoundPoolV1;const p=factory({runtime_pool:f.pool,connection_model:'direct'});f.lease=await p.connect();return f;}
const old=load(original),proposed=load(candidate());
await check('actual current Core pool + controlled role defaults: RESET ALL alone does not neutralize aliases',async()=>{
 const f=await lease(old);assert.deepEqual(f.session['request.jwt.claim'],defaults['request.jwt.claim']);assert.equal(f.session['request.jwt.claim.email'],'SYNTHETIC_DEFAULT');f.lease.release(true);
});
await check('proposed Guide-only checkout blanks aliases after RESET ALL; transaction reblanks locally',async()=>{
 const f=await lease(proposed);assert.equal(f.session['request.jwt.claim'],'');assert.equal(f.session['request.jwt.claim.email'],'');
 f.session={...defaults};await f.lease.query('begin isolation level serializable');assert.equal(f.local['request.jwt.claim'],'');assert.equal(f.local['request.jwt.claim.email'],'');
 f.local['request.jwt.claims']='{"sub":"SYNTHETIC_CURRENT","aal":"aal2","session_id":"SYNTHETIC_SID"}';assert.equal(jwt({...f.session,...f.local}).sub,'SYNTHETIC_CURRENT');assert.equal(email({...f.session,...f.local}),null);await f.lease.query('rollback');f.lease.release(true);
});
await check('proposed cleanup restores Guide blank aliases after role defaults; SERVICE profile unchanged',async()=>{
 const f=await lease(proposed);f.session={...defaults};f.lease.release();await new Promise(setImmediate);assert.equal(f.session['request.jwt.claim'],'');assert.equal(f.session['request.jwt.claim.email'],'');assert.equal(f.released.length,1);
 const a=await lease(old,true),b=await lease(proposed,true);assert.deepEqual(a.trace,b.trace);assert.deepEqual(a.session,b.session);a.lease.release(true);b.lease.release(true);
});
await check('candidate alias failure preserves same40001 and destroys the controlled lease; no retries',async()=>{
 const f=await lease(proposed),error=Object.assign(Error('SYNTHETIC_FAULT'),{code:'40001'});f.fault={when:s=>s.includes("set_config('request.jwt.claim','',true)"),error};await assert.rejects(f.lease.query('begin'),e=>e===error);f.lease.release();assert.deepEqual(f.released,[true]);
});
await check('proposal is NOT APPLIED; exact product preimage, Auth SQL and owner source remain unchanged',()=>{
 assert.equal(sha(readFileSync(resolve(ROOT,PATH))),BEFORE);assert.equal(readFileSync(resolve(ROOT,'docs/core/domain-ports-01/unit05-auth-scope-11/successor-proposal.patch'),'utf8'),patch());assert.throws(()=>candidate(original+'\n'),/PREIMAGE_MISMATCH/);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/UNIT05_AUTH_SCOPE',new_controls:n,evidence:'EXACT_PRIVATE_METADATA_PLUS_CONTROLLED_GUC_POOL_MODEL',installed_functions_invoked:0,real_claims_read:0,SQL_or_target_calls:0,candidate:'PROPOSED_NOT_APPLIED',native:'NOT_RUN_NOT_PASS'}));
