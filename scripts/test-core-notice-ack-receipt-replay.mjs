// OFFLINE source/actual-route controls only. No SQL, issued Auth, server, socket
// or race is executed. The RPC is explicitly mocked; pgTAP226 is authored only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const migrationFiles=readdirSync(new URL('supabase/migrations/',root)).filter(p=>p.endsWith('.sql')).sort();
const matches=migrationFiles.filter(p=>/create\s+(?:or\s+replace\s+)?function\s+communications\.acknowledge_notice_internal\s*\(/i.test(read('supabase/migrations/'+p)));
const migration=matches.at(-1),sql=read('supabase/migrations/'+migration);
const executable=sql.replace(/^\s*--.*$/gm,'');
const signature='communications.acknowledge_notice_internal';

test('source: forward migration changes only the existing receipt function/security contract',()=>{
  assert.match(migration,/^\d{14}_core_notice_ack_receipt_replay_v1\.sql$/);
  assert.equal(matches.at(-2),'20260909115850_official_communications_delivery_evidence.sql');
  assert.equal((executable.match(/create\s+or\s+replace\s+function/gi)??[]).length,1);
  const before=read('supabase/migrations/'+matches.at(-2));
  const header=source=>source.slice(source.indexOf('create or replace function '+signature)).split('as $$')[0].replace(/\s+/g,' ').trim();
  assert.equal(header(sql),header(before),'same arguments/defaults/return/security/search_path');
  assert.doesNotMatch(executable,/\b(?:grant|revoke|alter|drop|create\s+(?:table|policy|trigger))\b/i);
  assert.doesNotMatch(executable,/\b(?:update|delete\s+from)\s+communications\./i);
});

test('source: existing recipient lock precedes a second canonical authority resolution and wall-clock expiry check',()=>{
  const calls=[...executable.matchAll(/from communications\.resolve_communications_actor\(p_context_id, 'communications\.notices\.acknowledge', false\)/g)];
  assert.equal(calls.length,2);
  const lock=executable.indexOf('for update;'),wall=executable.indexOf('v_now := clock_timestamp()');
  assert.ok(calls[0].index<lock&&lock<calls[1].index&&calls[1].index<wall);
  for(const guard of ['membership_id is distinct from v_recipient.membership_id','tenant_id is distinct from v_recipient.tenant_id',
    "m.status = 'active'",'m.ends_at > v_now','g.ends_at > v_now','we.valid_until > v_now','we.override_expires_at > v_now']) assert.ok(executable.includes(guard));
  assert.ok(wall<executable.indexOf('select * into v_ack'));
});

test('source: replay/conflict is zero-write; only first insert emits audit and returns persisted receipt',()=>{
  assert.match(executable,/v_method text := coalesce\(p_method, 'in_app_click'\)/);
  for(const pair of ['v_ack.acknowledgement_method is distinct from v_method','v_ack.evidence_checksum is distinct from p_checksum','v_ack.notes is distinct from p_notes'])assert.ok(executable.includes(pair));
  const replay=executable.slice(executable.indexOf('if found then'),executable.indexOf('\n  else\n    insert into communications.notice_acknowledgements'));
  assert.match(replay,/using errcode = '23505'/);assert.doesNotMatch(replay,/\b(?:insert|update|delete)\b/i);
  assert.doesNotMatch(executable,/on conflict|exception\s+when/i);
  assert.equal((executable.match(/insert into audit.events/g)??[]).length,1);
  assert.match(executable,/returning \* into v_ack/);
  assert.match(executable,/'acknowledged_at', v_ack.acknowledged_at/);
  const response=executable.slice(executable.lastIndexOf('return jsonb_build_object'));
  assert.match(response,/'acknowledgement_id', v_ack.id/);
  assert.match(response,/'is_statutory_proof', false/);assert.doesNotMatch(response,/statement_timestamp|clock_timestamp/);
});

test('authored pgTAP retains real role/native prerequisites, rollback, receipt-byte controls and honest concurrency boundary',()=>{
  const tap=read('supabase/tests/226_core_notice_ack_receipt_replay_v1.test.sql');
  for(const text of ['set local role authenticated','notice226_existing_native_permission_missing','revoked membership cannot replay',
    'expired Context cannot replay','same-tenant nonrecipient denied','foreign Context denied','zero-write','one completion audit after replay',
    'CONCURRENCY ACCEPTANCE NOT EXECUTED'])assert.ok(tap.includes(text));
  assert.match(tap,/select \* from finish\(\);\s*rollback;\s*$/);
  assert.doesNotMatch(tap,/disable (?:trigger|row level)|create or replace function communications\.|insert into identity\.role_permissions/i);
});

function load(path,mocks={}){
  const filename=fileURLToPath(new URL(path,root)),mod=new Module(filename);
  mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);
  mod._compile(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return mod.exports;
}
const {NextRequest}=require('next/server');
const schema=load('src/lib/customer/communications-schema.ts');
const helper=load('src/lib/customer/communications-api-helper.ts');
const origin=load('src/lib/security/same-origin.ts'),bodyHelper=load('src/lib/security/request-body.ts');
const context='c2260000-0000-4000-8000-000000000040',notice='c2260000-0000-4000-8000-000000000060';
const receipt={success:true,acknowledgement_id:'c2260000-0000-4000-8000-000000000160',acknowledged_at:'2026-10-22T00:00:00+00:00',is_statutory_proof:false};
function routeFixture(){
  const state={result:{data:receipt,error:null},signed:true,calls:[],authReads:0};
  const {POST}=load('src/app/api/customer/v1/communications/notices/[id]/acknowledge/route.ts',{
    '@/lib/customer/communications-api-helper':helper,'@/lib/customer/communications-schema':schema,
    '@/lib/security/same-origin':origin,'@/lib/security/request-body':bodyHelper,
    '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>{
      state.authReads++;return {data:state.signed?{claims:{sub:'fixture-user',aal:'aal1'}}:null,error:null};
    }},schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{
      state.calls.push({name,args});return state.result;
    }};}})},
  });
  return {state,send:(body,origin='https://cladora.test')=>POST(new NextRequest('https://cladora.test/api/customer/v1/communications/notices/'+notice+'/acknowledge',{
    method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),
  }),{params:Promise.resolve({id:notice})})};
}

test('actual route with mocked RPC: schema normalization preserves omitted/null/empty distinction',async()=>{
  const {state,send}=routeFixture();
  assert.equal((await send({context_id:context})).status,200);
  assert.deepEqual(state.calls[0],{name:'acknowledge_notice_v1',args:{p_context_id:context,p_notice_id:notice,p_method:'in_app_click',p_checksum:null,p_notes:null}});
  assert.equal((await send({context_id:context,checksum:'  ',notes:' notes '})).status,200);
  assert.equal(state.calls[1].args.p_checksum,'');assert.equal(state.calls[1].args.p_notes,'notes');
  for(const bad of [{method:null},{checksum:null},{notes:null},{method:'IN_APP_CLICK'}])assert.equal((await send({context_id:context,...bad})).status,400);
  assert.equal(state.calls.length,2,'invalid JSON inputs never reach RPC');
});

test('actual route with mocked RPC: same receipt forwarded after discarded response, without timestamp synthesis',async()=>{
  const {state,send}=routeFixture();const body={context_id:context};
  const first=await send(body);await first.body.cancel(); // Controlled response discard, no network fault claim.
  const replay=await send(body);assert.deepEqual(await replay.json(),receipt);
  assert.deepEqual(state.calls[1],state.calls[0]);assert.equal(state.authReads,2);
  assert.match(replay.headers.get('cache-control'),/no-store/);
});

test('actual route with mocked RPC: 23505 conflicts map to 409 with no sensitive detail',async()=>{
  const {state,send}=routeFixture();state.result={data:null,error:{code:'23505',message:'notice_acknowledgement_conflict PRIVATE_SENTINEL'}};
  const result=await send({context_id:context,notes:'changed'});
  assert.equal(result.status,409);const body=await result.json();assert.equal(body.error.code,'CONFLICT_OR_IMMUTABLE');
  assert.ok(!JSON.stringify(body).includes('PRIVATE_SENTINEL'));assert.equal(state.calls.length,1);
});

test('actual route with mocked RPC: current denial is not bypassed by a previous receipt',async()=>{
  const {state,send}=routeFixture();assert.equal((await send({context_id:context})).status,200);
  for(const message of ['customer_context_access_denied','recipient_record_not_found_for_caller','permission_denied','entitlement_module_communications_required']){
    state.result={data:null,error:{code:'42501',message}};
    const response=await send({context_id:context});assert.equal(response.status,403);
    assert.ok(!JSON.stringify(await response.json()).includes(receipt.acknowledgement_id));
  }
  state.signed=false;const before=state.calls.length;
  assert.equal((await send({context_id:context})).status,401);assert.equal(state.calls.length,before);
  assert.equal((await send({context_id:context},'https://foreign.invalid')).status,403);assert.equal(state.calls.length,before);
});
