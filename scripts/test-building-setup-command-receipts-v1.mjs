/** Offline only: source invariants, strict ABI, and actual GET with fake RPC.
 * No SQL parser/client, server, provider session, credential or DB execution.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {buildSource,identity,root,extractFunction,MIGRATION,MODULE,MANIFEST} from './build-building-setup-command-receipts-source-v1.mjs';
import {checkDelivery,checkPackaging} from './check-building-setup-command-receipts-v1.mjs';
// PM175 packaging-only delta: do not repeat the closed 82-case ABI/handler suite.
if(process.argv.includes('--packaging-only')){
 const sql=readFileSync(resolve(root,MODULE),'utf8'),migration=readFileSync(resolve(root,MIGRATION),'utf8');
 const manifest=JSON.parse(readFileSync(resolve(root,MANIFEST),'utf8'));let tests=0;
 const run=(name,fn)=>{fn();tests++;console.log('PASS '+name)};
 run('complete migration differs from pinned prior SQL only by framing EOF blank line',()=>{
  assert.equal(identity(sql+'\n').sha256,'c963898c9782681bfc56b15eb15313f9d65b0a5cceb0cd049ec1fd2a233cf32c');
  checkPackaging(sql,manifest,migration);const b=buildSource();assert.equal(b.forward,migration);assert.equal(JSON.stringify(b.manifest),JSON.stringify(manifest));
 });
 for(const [code,mutate] of [
  ['OFFICIAL_NAMING_RECEIPT',m=>{m.naming.filename='20261026000000_building_setup_command_receipts_v1.sql'}],
  ['OFFICIAL_NAMING_RECEIPT',m=>{m.naming.receipt.sha256='0'.repeat(64)}],
  ['OFFICIAL_MIGRATION_TARGET',m=>{m.migration.path='supabase/migrations/other.sql'}],
  ['MIGRATION_FORWARD_IDENTITY',m=>{m.migration.sha256='0'.repeat(64)}],
  ['PACKAGING_STATUS_ONLY',m=>{m.installed=true}],
  ['INDEPENDENT_EXPECTED_NULL',m=>{m.proofs.compiled_expected={candidate:true}}],
 ])run('negative '+code,()=>{const m=structuredClone(manifest);mutate(m);assert.throws(()=>checkPackaging(sql,m,migration),e=>e.message===code)});
 run('coherently resealed migration divergence rejected by byte identity',()=>{
  const other=migration+'-- extra source\n',m=structuredClone(manifest);Object.assign(m.migration,identity(other));m.naming.forward_sql_sha256=identity(other).sha256;
  assert.throws(()=>checkPackaging(sql,m,other),e=>e.message==='MIGRATION_MODULE_BYTE_IDENTITY');
 });
 run('coherently resealed gate removal cannot pass packaging',()=>{
  const other=sql.replace("raise exception 'building_g2_inactive_source_only' using errcode='55000';",'null;'),m=structuredClone(manifest);
  Object.assign(m.output,identity(other));Object.assign(m.migration,identity(other));m.naming.forward_sql_sha256=identity(other).sha256;
  assert.throws(()=>checkPackaging(other,m,other),e=>e.message==='INACTIVE_PACKAGING_GATES');
 });
 console.log(JSON.stringify({suite:'building-g2-pm175-packaging-only',passed:tests,tests,prior_82_suite:'NOT_REPEATED',sql_parse_compile_execution:'NONE'}));
} else {
const matrixOnly=process.argv.includes('--response-matrix-only');
const beforeFlag=process.argv.indexOf('--schema-before');
const schemaBefore=beforeFlag<0?null:process.argv[beforeFlag+1];
assert.ok(beforeFlag<0||(matrixOnly&&schemaBefore),'before-fix source is only allowed for the focused matrix');
const require=createRequire(resolve(root,'package.json')),ts=require('typescript');
const {NextRequest}=require('next/server');
const compiled=new Map();
function load(path,mocks={}){
 const key=path+Object.keys(mocks).join(',');if(!Object.keys(mocks).length&&compiled.has(key))return compiled.get(key);
 const source=readFileSync(schemaBefore&&path==='src/lib/customer/building-setup-schema.ts'?resolve(schemaBefore):resolve(root,path),'utf8');
 if(schemaBefore&&path==='src/lib/customer/building-setup-schema.ts')assert.equal(identity(source).sha256,'439f4f7de16fe8d773b7243cbb9965ca1a0a7be88f7e6aa2a65359c07cd01686','exact official 14-path schema counterexample input');
 const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.deepEqual((result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
 const loaded={exports:{}};const localRequire=name=>{
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(name==='@/lib/customer/building-setup-schema')return load('src/lib/customer/building-setup-schema.ts');
  if(name==='@/lib/customer/building-workspace-onboarding-api')return load('src/lib/customer/building-workspace-onboarding-api.ts');
  if(name==='@/lib/customer/onboarding-import-helper'||name==='./onboarding-import-helper')return load('src/lib/customer/onboarding-import-helper.ts');
  return require(name);
 };
 new vm.Script(`(function(require,module,exports){${result.outputText}\n})`,{filename:path}).runInThisContext()(localRequire,loaded,loaded.exports);
 if(!Object.keys(mocks).length)compiled.set(key,loaded.exports);return loaded.exports;
}
const schema=load('src/lib/customer/building-setup-schema.ts');
const C='10000000-0000-0000-0000-000000000001',W='20000000-0000-0000-0000-000000000001',R='30000000-0000-0000-0000-000000000001',T='40000000-0000-0000-0000-000000000001',M='50000000-0000-0000-0000-000000000001',A='60000000-0000-0000-0000-000000000001',P='70000000-0000-0000-0000-000000000001';
const H='a'.repeat(64),N='b'.repeat(64),time='2026-10-25T22:00:00+03:30';
const key=op=>`setup-${R}-r3-${op}-unit`;
const units=[{code:'B',floor:1,area_m2:20},{code:'A',floor:null,area_m2:null}];
const clone=v=>structuredClone(v);
function reply(op='submit',outcome='complete'){
 const status={update:'draft',rehearse:'rehearsed',submit:'submitted',approve:'approved',provision:'provisioned'}[op];
 const before={update:'draft',rehearse:'draft',submit:'rehearsed',approve:'submitted',provision:'approved'}[op];
 const x={version:1,outcome,scope:{tenant_id:T,workspace_id:W,run_id:R,context_id:C,membership_id:M,actor_id:A},command:{command_key:key(op),operation:op,expected_revision:3},coverage:{status:'covered',epoch_id:'building-g2-pm169-v1',from_expected_revision:1,checked_at:time},retention:{status:'activation_hold',policy_id:null}};
 if(outcome==='complete')x.evidence={request_hash:H,input_descriptor:{units:op==='update'?clone(units):null,expected_payload_hash:op==='approve'?H:null},before_record:{revision:3,status:before,payload_hash:H},receipt:{version:2,run_id:R,workspace_id:W,revision:4,status,payload_hash:op==='update'?N:H,expected_revision:3,operation:op,command_key:key(op),property_id:op==='provision'?P:null},epoch_id:'building-g2-pm169-v1',recorded_at:time};
 if(outcome==='unknown')x.reason='coverage_gap';if(outcome==='conflict')x.reason='own_command_descriptor_mismatch';return x;
}
let rpcCalls=[],authError=null,authActor=A,rpcError=null,rpcResult=reply();
const {GET}=load('src/app/api/customer/v1/onboarding/building-setup/[id]/commands/[command_key]/route.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:authActor}},error:authError})},schema:name=>{assert.equal(name,'customer_api');return{rpc:async(name,parameters)=>{rpcCalls.push({name,parameters});return{data:clone(rpcResult),error:rpcError}}}}})}});
async function request(op='submit',query={}){
 const params=new URLSearchParams({context_id:C,workspace_id:W,operation:op,expected_revision:'3',...query});
 return GET(new NextRequest(`https://offline.invalid/api/customer/v1/onboarding/building-setup/${R}/commands/${key(op)}?${params}`),{params:Promise.resolve({id:R,command_key:key(op)})});
}
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name)}
async function checkAsync(name,fn){await fn();count++;console.log('PASS '+name)}
if(matrixOnly){
 let malformedAccepted=0,validCount=0,invalidCount=0;
 for(const operation of ['update','rehearse','submit','approve','provision'])
 for(const outcome of ['complete','absent','unknown','conflict'])
 for(const coverage of ['covered','uncovered'])
 for(const reason of [null,'legacy_uncovered','coverage_gap','own_command_descriptor_mismatch']){
  await checkAsync(`actual GET matrix ${operation}/${outcome}/${coverage}/${reason??'no-reason'}`,async()=>{
   rpcCalls=[];rpcResult=reply(operation,outcome);delete rpcResult.reason;
   if(reason!==null)rpcResult.reason=reason;
   if(coverage==='uncovered')rpcResult.coverage={status:'uncovered',epoch_id:null,from_expected_revision:null,checked_at:time};
   const valid=(outcome==='complete'&&reason===null)||(outcome==='conflict'&&reason==='own_command_descriptor_mismatch')
    ||(outcome==='unknown'&&reason===(coverage==='covered'?'coverage_gap':'legacy_uncovered'))
    ||(outcome==='absent'&&reason===null&&coverage==='covered'&&operation!=='approve');
   const oldAccepted=valid||(outcome==='unknown'&&['coverage_gap','legacy_uncovered'].includes(reason))
    ||(outcome==='absent'&&reason===null&&coverage==='covered');
   if(valid)validCount++;else invalidCount++;
   const expected=schemaBefore?oldAccepted:valid;
   assert.equal(schema.buildingSetupCommandLookupResponseSchema.safeParse(rpcResult).success,expected,'schema protocol invariant');
   const response=await request(operation);assert.equal(response.status,expected?200:502);
   assert.deepEqual(rpcCalls,[{name:'get_building_setup_command_receipt_v1',parameters:{p_context_id:C,p_workspace_id:W,p_run_id:R,p_command_key:key(operation),p_operation:operation,p_expected_revision:3}}]);
   const body=await response.json();
   if(expected)assert.deepEqual(body,rpcResult);else assert.deepEqual(body,{error:{code:'SETUP_INVALID_RESPONSE'}},'no receipt, evidence or payload on malformed response');
   assert.match(response.headers.get('Cache-Control'),/no-store/);assert.match(response.headers.get('Cache-Control'),/private/);assert.match(response.headers.get('Vary'),/Cookie/);
   if(!valid&&response.status===200)malformedAccepted++;
  });
 }
 assert.equal(validCount,34);assert.equal(invalidCount,126);assert.equal(malformedAccepted,schemaBefore?11:0);
 console.log(JSON.stringify({suite:'building-g2-pm176-actual-handler-response-matrix',phase:schemaBefore?'pinned-before-fix-counterexample':'after-fix',passed:count,tests:count,valid:validCount,invalid:invalidCount,malformed_accepted:malformedAccepted,RPC_per_case:1,prior_82_suite:'NOT_REPEATED',SQL:'NONE',HTTP:'actual handler in memory; fake RPC only'}));
}else{
const build=buildSource();check('source byte/provenance closure',()=>checkDelivery(build.sql,build.manifest));
check('official named migration retains complete composition, not an unresolved fragment',()=>{assert.equal(build.forward,build.sql);assert.equal(identity(build.forward).sha256,build.manifest.naming.forward_sql_sha256);assert.equal(build.manifest.naming.filename,MIGRATION.split('/').at(-1))});
function reseal(sql){
 const m=clone(build.manifest);m.output={path:m.output.path,...identity(sql)};
 Object.assign(m.migration,identity(sql));m.naming.forward_sql_sha256=m.output.sha256;
 const marks=[...sql.matchAll(/^-- COMPOSED EFFECT (.+)\n/gm)];
 for(let i=0;i<marks.length;i++){const e=m.composition.selected_effects.find(e=>e.id===marks[i][1]);if(!e)continue;const a=marks[i].index+marks[i][0].length,b=i+1<marks.length?marks[i+1].index:sql.length;const fragment=sql.slice(a,b);e.output_byte_start=Buffer.byteLength(sql.slice(0,a));e.output_byte_length=Buffer.byteLength(fragment);e.output_sha256=identity(fragment).sha256;}
 return m;
}
const mutateFunction=(name,fn)=>{const s=extractFunction(build.sql,name).text;return build.sql.replace(s.trimEnd(),()=>fn(s).trimEnd())};
const negatives=[
 ['ND0_DEFAULT_MUTATION',s=>s.replace('rollback;',"alter default privileges revoke execute on functions from public;\nrollback;")],
 ['INACTIVE_POSITIVE_GRANT',s=>s.replace('rollback;',"grant execute on function app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text) to authenticated;\nrollback;")],
 ['INACTIVE_UNCONDITIONAL_GATE',s=>s.replace("raise exception 'building_g2_inactive_source_only' using errcode='55000';",'null;')],
 ['SINGLE_ROLLBACK_FRAME',s=>s.replace(/rollback;\s*$/,'commit;')],
 ['EXTERNAL_EFFECT',s=>s.replace('rollback;',"select net.http_post('https://example.invalid');\nrollback;")],
 ['MANAGED_AUTH_MUTATION_OR_LOCK',s=>s.replace('rollback;',"update auth.sessions set not_after=clock_timestamp();\nrollback;")],
 ['TRUSTED_FRESH_CLOCK',()=>mutateFunction('app_private.require_building_setup_command_checkpoint_v1',s=>s.replace('checked_at:=clock_timestamp()','checked_at:=statement_timestamp()'))],
 ['SAME_SNAPSHOT_SESSION_AUTHORITY',()=>mutateFunction('app_private.require_building_setup_command_checkpoint_v1',s=>s.replace('app_private.require_request_session_current_at_v1(checked_at)','null::void'))],
 ['TIMED_NATIVE_BINDING',()=>mutateFunction('app_private.require_building_setup_authority_at_v1',s=>s.replace('resolve_workspace_native_context_v2_at_v1','resolve_workspace_native_context_v2'))],
 ['CANONICAL_REQUEST_HASH',()=>mutateFunction('app_private.command_building_setup_v2',s=>s.replace("'actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'run',r.id,","'payload',r.setup_payload,"))],
 ['EXACT_REPLAY_INTENT_SCOPE',()=>mutateFunction('app_private.command_building_setup_v2',s=>s.replace('e.context_id<>p_context_id or e.membership_id<>c.membership_id','false'))],
 ['FINAL_COMMAND_ADMISSION',()=>mutateFunction('app_private.command_building_setup_v2',s=>s.replace(/ perform app_private.assert_building_setup_command_checkpoint_v1\(p_context_id,p_workspace_id,p_action,initial\);\n return v_receipt;/,' return v_receipt;'))],
 ['FINAL_CREATE_ADMISSION',()=>mutateFunction('app_private.create_building_setup_v2',s=>s.replace(/ perform app_private.assert_building_setup_command_checkpoint_v1\(p_context_id,p_workspace_id,'create',initial\);\n return v_receipt;/,' return v_receipt;'))],
 ['LOOKUP_OWN_SCOPE',()=>mutateFunction('app_private.get_building_setup_command_receipt_v1',s=>s.replace("actor_id=(initial->>'actor_id')::uuid",'true'))],
 ['MINIMAL_RECEIPT_DISCLOSURE',()=>mutateFunction('app_private.get_building_setup_command_receipt_v1',s=>s.replace("'retention',jsonb_build_object", "'payload',r.setup_payload,'retention',jsonb_build_object"))],
 ['FINAL_LOOKUP_ADMISSION',()=>mutateFunction('app_private.get_building_setup_command_receipt_v1',s=>s.replace("perform app_private.assert_building_setup_command_checkpoint_v1(p_context_id,p_workspace_id,'recover',initial);\n if p_operation='approve' then perform", "null;\n if p_operation='approve' then perform"))],
 ['TRUSTED_TRIGGER_FRAME',()=>mutateFunction('app_private.bind_provisioned_building_workspace_v1',s=>s.replace('proof.writer_session_id',"current_setting('client.session')::uuid"))],
 ['BINDING_FOLLOWON_CHECKPOINT',()=>mutateFunction('app_private.bind_provisioned_building_workspace_v1',s=>s.replace("perform app_private.assert_building_setup_command_checkpoint_v1(proof.context_id,proof.workspace_id,'provision',initial);\n   insert into identity.context_grants",'null;\n   insert into identity.context_grants'))],
 ['EVIDENCE_ACL_RLS',s=>s.replace('alter table platform.building_setup_command_receipts enable row level security;','')],
 ['NEW_FUNCTION_OC1_CLOSURE',s=>s.replace('revoke all privileges on function app_private.require_building_setup_command_checkpoint_v1(uuid,uuid,text) from public,anon,authenticated,service_role;','')],
 ['UNKNOWN_FOLLOWON_STOP',s=>s.replaceAll('tgdeferrable or tginitdeferred','false')],
];
for(const [code,mutate] of negatives)check('coherently resealed negative '+code,()=>{const sql=mutate(build.sql);assert.notEqual(sql,build.sql);assert.throws(()=>checkDelivery(sql,reseal(sql),{provenance:false}),e=>e.message===code)});
check('re-sealed proof cannot become candidate oracle',()=>{const m=reseal(build.sql);m.proofs.compiled_expected={candidate:true};assert.throws(()=>checkDelivery(build.sql,m,{provenance:false}),/INDEPENDENT_EXPECTED_NULL/)});
check('wrong output hash rejected independently',()=>{const m=clone(build.manifest);m.output.sha256='0'.repeat(64);assert.throws(()=>checkDelivery(build.sql,m,{provenance:false}),e=>e.message==='OUTPUT_IDENTITY')});
check('coherently resealed extra source effect rejected',()=>{const sql=build.sql.replace(/rollback;\s*$/,'do $extra$ begin null; end; $extra$;\nrollback;\n');assert.throws(()=>checkDelivery(sql,reseal(sql)),e=>e.message==='MISSING_EXTRA_OR_CHANGED_EFFECT')});
check('coherently resealed missing structural effect rejected',()=>{
 const e=build.manifest.composition.selected_effects.find(x=>/^B\.E[0-9]+$/.test(x.id));assert.ok(e);
 const begin=build.sql.indexOf('-- COMPOSED EFFECT '+e.id+'\n'),end=build.sql.indexOf('-- COMPOSED EFFECT ',begin+22);
 assert.ok(begin>0&&end>begin);const sql=build.sql.slice(0,begin)+build.sql.slice(end),m=reseal(sql);
 m.composition.selected_effects=m.composition.selected_effects.filter(x=>x.id!==e.id);
 assert.throws(()=>checkDelivery(sql,m),e=>e.message==='MISSING_EXTRA_OR_CHANGED_EFFECT');
});
check('all source function byte ranges and hashes are exact',()=>{for(const f of build.manifest.source_inventory.functions){const b=Buffer.from(build.sql).subarray(f.byte_start,f.byte_start+f.byte_length);assert.equal(identity(b).sha256,f.sha256);assert.ok(f.signature&&f.owner&&f.security&&f.search_path)}});
await checkAsync('concurrency source import has no DB or auto-run',async()=>{
 const source=readFileSync(resolve(root,'supabase/hosted-building-slice/tests/command-receipts-concurrency.test.mjs'),'utf8');
 assert.doesNotMatch(source,/from ['"]pg['"]|\.connect\(|process\.env|new (?:pg\.)?Client|runCommandReceiptConcurrencySource\(\{authorization:/);
 assert.match(source,/pg_blocking_pids/);assert.match(source,/assert\.deepEqual\(await fingerprint\(b\),before/);
 const imported=await import('../supabase/hosted-building-slice/tests/command-receipts-concurrency.test.mjs');
 assert.equal(typeof imported.runCommandReceiptConcurrencySource,'function');
});
for(const op of ['update','rehearse','submit','approve','provision']){
 check('strict evidence positive '+op,()=>assert.equal(schema.buildingSetupCommandLookupResponseSchema.safeParse(reply(op)).success,true));
 await checkAsync('actual GET fake RPC exact '+op,async()=>{rpcCalls=[];rpcResult=reply(op);const r=await request(op);assert.equal(r.status,200);assert.deepEqual(await r.json(),rpcResult);assert.deepEqual(rpcCalls,[{name:'get_building_setup_command_receipt_v1',parameters:{p_context_id:C,p_workspace_id:W,p_run_id:R,p_command_key:key(op),p_operation:op,p_expected_revision:3}}]);assert.match(r.headers.get('Cache-Control'),/no-store/);assert.match(r.headers.get('Cache-Control'),/private/);assert.match(r.headers.get('Vary'),/Cookie/)});
}
for(const outcome of ['absent','unknown','conflict'])await checkAsync('typed '+outcome+' not a commit receipt',async()=>{rpcResult=reply('submit',outcome);const r=await request();assert.equal(r.status,200);const b=await r.json();assert.equal(b.outcome,outcome);assert.equal('evidence' in b,false)});
check('ordered units survive strict parsing without sorting/canonical hash imitation',()=>{const b=schema.buildingSetupCommandLookupResponseSchema.parse(reply('update'));assert.deepEqual(b.evidence.input_descriptor.units,units);assert.equal(b.evidence.request_hash,H);assert.equal(b.evidence.receipt.payload_hash,N)});
const invalidReplies=[
 ['wrong actor',b=>{b.scope.actor_id=P}],['wrong Context',b=>{b.scope.context_id=P}],['wrong Workspace',b=>{b.scope.workspace_id=P}],['wrong run',b=>{b.scope.run_id=P}],
 ['wrong key',b=>{b.command.command_key='setup-other-r3-key'}],['wrong operation',b=>{b.command.operation='approve'}],['wrong revision',b=>{b.command.expected_revision=4}],
 ['missing field',b=>{delete b.evidence.request_hash}],['malformed hash',b=>{b.evidence.request_hash='bad'}],['new payload disclosure',b=>{b.payload={name:'private'}}],
 ['history list',b=>{b.evidence.history=[]}],['actor history',b=>{b.evidence.actor_email='private@example.invalid'}],['invalid result revision',b=>{b.evidence.receipt.revision=9}],
 ['invalid before hash',b=>{b.evidence.before_record.payload_hash=N}],['invalid before status',b=>{b.evidence.before_record.status='approved'}],
 ['invalid result status',b=>{b.evidence.receipt.status='provisioned'}],['missing property',b=>{delete b.evidence.receipt.property_id}],
 ['extra command descriptor',b=>{b.evidence.input_descriptor.extra=true}],['units on submit',b=>{b.evidence.input_descriptor.units=units}],
 ['approval hash on submit',b=>{b.evidence.input_descriptor.expected_payload_hash=H}],['fake retention',b=>{b.retention.policy_id='forever'}],
 ['fake coverage',b=>{b.coverage.from_expected_revision=2}],['string numeric',b=>{b.evidence.receipt.revision='4'}],['extra receipt key',b=>{b.evidence.receipt.ok=true}],
];
for(const [name,mutate] of invalidReplies)await checkAsync('actual GET rejects '+name,async()=>{rpcResult=reply();mutate(rpcResult);rpcCalls=[];const r=await request();assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:{code:'SETUP_INVALID_RESPONSE'}});assert.equal(rpcCalls.length,1)});
for(const [name,patch] of [['missing context',{context_id:''}],['foreign key',{other:'x'}],['fraction',{expected_revision:'3.5'}],['exponent',{expected_revision:'3e0'}],['zero',{expected_revision:'0'}],['wrong op',{operation:'cancel'}]])await checkAsync('actual GET rejects request '+name,async()=>{rpcCalls=[];const r=await request('submit',patch);assert.equal(r.status,400);assert.equal(rpcCalls.length,0)});
await checkAsync('duplicate query rejected before client',async()=>{rpcCalls=[];const q=new URLSearchParams({context_id:C,workspace_id:W,operation:'submit',expected_revision:'3'});q.append('context_id',C);const r=await GET(new NextRequest(`https://offline.invalid/?${q}`),{params:Promise.resolve({id:R,command_key:key('submit')})});assert.equal(r.status,400);assert.equal(rpcCalls.length,0)});
for(const value of [null,'',undefined])await checkAsync('missing validated auth denies '+String(value),async()=>{rpcCalls=[];authActor=value;rpcResult=reply();const r=await request();assert.equal(r.status,401);assert.equal(rpcCalls.length,0)});
authActor=A;
for(const [error,status] of [[{code:'42501',message:'access_denied'},403],[{code:'40001',message:'setup_revision_conflict'},409],[{code:'55000',message:'setup_g2_unknown_trigger_followon'},503],[{code:'P0002',message:'setup_run_not_found'},404],[{code:'unexpected',message:'private raw details'},500]])await checkAsync('RPC failure is not absent '+error.code,async()=>{rpcError=error;const r=await request();assert.equal(r.status,status);const b=await r.json();assert.equal(b.outcome,undefined);assert.doesNotMatch(JSON.stringify(b),/private raw details/)});
rpcError=null;
console.log(JSON.stringify({suite:'building-g2-offline',passed:count,tests:count,sql_parse_compile_execution:'NONE',http:'actual handler in memory, fake RPC only',closed_suites_repeated:[]}));
}
}
