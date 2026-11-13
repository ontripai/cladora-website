// Only affected consumer adoption. Actual Core producer/host + owner API; fake PG/SDK.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createAirpropR2ReadFixture } from './lib/airprop-r2-test-fixture.mjs';
import { fixture as legacyFixture, id, scope, sourceRow, actionProjection } from './lib/airprop-listing-flow-test-fixture.mjs';
const require=createRequire(import.meta.url),{NextRequest}=require('next/server');
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:'';
let groups=0; const check=async(name,fn)=>{if(only&&!name.includes(only))return;await fn();console.log('PASS',++groups,name);};
const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('REAL_NETWORK_FORBIDDEN');};
const digest=s=>createHash('sha256').update(s).digest('hex');
function setup() {
  const f=createAirpropR2ReadFixture(),old=f.pool.connect;
  const qs=f.load('src/lib/core/listing-ownership-companion-queries-v1.ts'),adopt=f.load('src/lib/core/listing-ownership-adoption-query-v1.ts');
  const x={partyVersion:'6',ownershipVersion:'2',adopted:true,rows:null};
  f.pool.connect=async()=>{
    const c=await old(),query=c.query;
    c.query=async(text,args)=>{
      if(text===adopt.CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1){f.x.calls.push({text,args});return {rows:[{adopted:x.adopted}],rowCount:1};}
      if(text===qs.CORE_LISTING_OWNERSHIP_CANDIDATE_SQL_V1){f.x.calls.push({text,args});return {rows:x.rows??[{
        ownership_id:id(4),ownership_version:x.ownershipVersion,tenant_id:id(6),unit_id:id(9),party_id:id(7),party_version:x.partyVersion,party_kind:'person',
        resource_label:'Apartament sintetic Unirii',date_zone:'UTC',valid_from:'2026-01-01T00:00:00.000000Z',valid_until:null,
        party_link_from:'2026-01-01T00:00:00.000000Z',party_link_until:null}],rowCount:x.rows?.length??1};}
      return query(text,args);
    };return c;
  };
  const contract=f.load('src/lib/airprop/listing-flow-contract-v1.ts');
  const resolver=f.load('src/lib/airprop/listing-runtime-binding-v1.ts').createListingRequestRuntimeResolverV1(async()=>({pool:f.pool,principal:f.principal}));
  const api=f.load('src/lib/airprop/listing-flow-api-v1.ts').createListingFlowApi({session:async()=>({actor_id:id(3),aal:'aal2'}),read:null,control:null,resolveRuntime:resolver});
  const get=()=>api.GET(new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?'+new URLSearchParams(scope)));
  return {...f,x16:x,contract,api,get};
}
const versions={version:2,specification_id:id(55),resource_version:4,party_version:6,relationship_version:2};
const versionedSelection=async f=>({...((await legacyFixture().command()).selection),source_versions:{...versions}});
function rawRow() {
  const row=sourceRow();row.source_versions={specification_id:id(55),resource_version:4,party_version:6,relationship_version:2};return row;
}
function binding(selection) {return {binding_version:2,...scope,tenant_id:id(6),selection,spec_id:id(55),spec_version:4};}
await check('actual resolver defaults to official own-party read: GET200 exact source versions, no action/C03',async()=>{
  const f=setup(),r=await f.get(),body=await r.json();assert.equal(r.status,200);assert.deepEqual(body.listings[0].selection.source_versions,versions);
  assert.equal(body.can_edit,false);assert.equal(body.connection,'read_only');assert.ok(Object.values(body.listings[0].actions).every(v=>v==='unavailable'));
  assert.equal(f.x.calls.some(q=>/idempotency_keys|audit\.events|outbox_events|^\s*(insert|update|delete)\b/i.test(q.text)),false);
});
await check('Core missing revision/adoption closes only producer, never defaults Party/relationship1',async()=>{
  for(const change of [x=>x.partyVersion=null,x=>x.ownershipVersion=null,x=>x.adopted=false]){
    const f=setup();change(f.x16);assert.equal((await f.get()).status,503);
  }
});
await check('read-compatible source_versions do not make manage projections',async()=>{
  const f=setup(),row=rawRow(),selection=await versionedSelection(f);row.selected_binding={state:'record',value:binding(selection)};
  const read=f.load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow;
  let result=(await read(async()=>[row],id(3),scope))[0];assert.equal(result.binding_state,'bound');assert.ok(Object.values(result.actions).every(a=>a==='unavailable'));
  row.action_projections=[{actor_id:id(3),...scope,selection,action:'edit_listing',core:row.core}];
  result=(await read(async()=>[row],id(3),scope))[0];assert.equal(result.actions.edit_listing,'unavailable');
});
await check('historical binding lacks Party version: independent read200 and legacy/no actions, no backfill',async()=>{
  const f=setup(),row=rawRow();row.selected_binding={state:'record',value:{...scope,tenant_id:id(6),selection:(await legacyFixture().command()).selection,spec_version:4}};
  const before=JSON.stringify(row.selected_binding);const view=await f.load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow(async()=>[row],id(3),scope);
  assert.equal(view[0].binding_state,'legacy');assert.ok(Object.values(view[0].actions).every(v=>v==='unavailable'));assert.equal(JSON.stringify(row.selected_binding),before);
  const http=f.load('src/lib/airprop/listing-flow-api-v1.ts').createListingFlowApi({session:async()=>({actor_id:id(3),aal:'aal2'}),read:async()=>[row],control:null});
  const response=await http.GET(new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?'+new URLSearchParams(scope)));
  assert.equal(response.status,200);assert.equal((await response.json()).can_edit,false);assert.equal(JSON.stringify(row.selected_binding),before);
});
await check('v2 Party/spec/relationship drift is stale and missing v2 tuple is never bound',async()=>{
  const f=setup(),read=f.load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow;
  for(const mutate of [s=>s.source_versions.party_version++,s=>s.source_versions.specification_id=id(99),s=>delete s.source_versions]){
    const row=rawRow(),selection=await versionedSelection(f);mutate(selection);row.selected_binding={state:'record',value:binding(selection)};
    const r=(await read(async()=>[row],id(3),scope))[0];assert.notEqual(r.binding_state,'bound');assert.ok(Object.values(r.actions).every(v=>v==='unavailable'));
  }
});
await check('versioned and historical selections cannot compare equal in either direction or match wrong receipt',async()=>{
  const f=setup(),v2=await versionedSelection(f),v1={...v2};delete v1.source_versions;
  assert.equal(f.contract.sameSelection(v1,v2),false);assert.equal(f.contract.sameSelection(v2,v1),false);
  const changed=structuredClone(v2);changed.source_versions.party_version++;
  assert.equal(f.contract.sameSelection(v2,changed),false);
  const request=await legacyFixture().command();request.selection=v2;
  const response={version:1,...scope,command_key:request.command.idempotency_key,selection:v2,core_receipt_id:id(71),
    receipt:{version:1,idempotent:true,listing_id:request.command.listing_id,listing_version:request.command.expected_version+1,status:'published'}};
  assert.equal(f.contract.matchesListingReceipt(response,request),true);
  assert.equal(f.contract.matchesListingReceipt({...response,selection:changed},request),false);
  assert.equal(f.contract.matchesListingReceipt({...response,selection:v1},request),false);
});
await check('existing journal keeps exact historical wire/key/endpoint/hash; new source cannot upgrade UNKNOWN',async()=>{
  const f=setup(),command=await legacyFixture().command(),wire=JSON.stringify(command,null,1),owner={...scope,actor_id:id(3),membership_id:id(40)};
  const raw=f.contract.writeListingRecovery(wire,'uncertain',owner),before=digest(raw);
  await f.get();const recovered=f.contract.readListingRecovery(raw,scope,owner);
  assert.equal(recovered.state,'uncertain');assert.equal(recovered.wire,wire);assert.equal(digest(raw),before);
  assert.equal(JSON.parse(raw).endpoint,'/api/customer/v2/airprop/listings');assert.equal(JSON.parse(raw).wire,wire);
});
await check('new command source version mismatch rejected before dispatch, original JSON unchanged',async()=>{
  const f=setup(),command=await legacyFixture().command();command.selection=await versionedSelection(f);
  assert.equal(f.contract.listingCommandSchema.safeParse(command).success,true);
  command.selection.source_versions.relationship_version++;const wire=JSON.stringify(command);
  assert.equal(f.contract.listingCommandSchema.safeParse(command).success,false);assert.equal(JSON.stringify(command),wire);
});
await check('versioned binding writer requires independent manage canonical source, read projection rejected before SQL',async()=>{
  const f=setup(),command=await legacyFixture().command();command.selection=await versionedSelection(f);
  const p=f.load('src/lib/airprop/listing-control-plan-v1.ts').prepareListingControlV1(JSON.stringify(command),scope);
  const selected=f.load('src/lib/airprop/listing-selected-binding-v1.ts');let queries=0;
  const tx={actor_id:id(3),tenant_id:id(6),workspace_id:id(2),transaction_id:id(70),query:async()=>{queries++;throw Error('NO_SQL');}};
  const c={...scope,actor_id:id(3),workspace_id:id(2),transaction_id:id(70),command_id:id(71),idempotency_key:command.command.idempotency_key,
    permission_code:'airprop.opportunity.manage',module_code:'airprop_commercial',evaluation_purpose:'airprop.b2',aggregate_type:'portfolio.unit',aggregate_id:id(9),
    input_fingerprint:'sha256:'+digest(p.wire),provider_source_ids:[id(9),id(8),id(7),id(4),id(55)]};
  await assert.rejects(selected.mutateListingWithSelectedBindingV1(tx,c,p,async()=>({core:sourceRow().core,spec:{id:id(55),version:4},source_versions:versions})),/CANONICAL/);
  assert.equal(queries,0);
});
await check('current management version mismatch and historical retry cannot produce a new binding',async()=>{
  const f=setup(),selected=f.load('src/lib/airprop/listing-selected-binding-v1.ts'),command=await legacyFixture().command();
  const plan=f.load('src/lib/airprop/listing-control-plan-v1.ts').prepareListingControlV1(JSON.stringify(command),scope);
  await assert.rejects(selected.mutateListingWithSelectedBindingV1({}, {},plan,async()=>{assert.fail('NO_CANONICAL_LOOKUP');}),/VERSION_REQUIRED/);
  const raw=rawRow(),selection=await versionedSelection(f),manage=actionProjection(raw,id(3),selection,'edit_listing').core;
  // A source version is still mandatory even if old Core manage evidence otherwise maps.
  assert.equal(manage.request.resource.permission_code,'airprop.opportunity.manage');
});
function mutationFixture(f,drift=false) {
  const api=f.load('src/lib/airprop/listing-selected-binding-v1.ts');let stored=null,rechecks=0;const calls=[];
  const tx={actor_id:id(3),tenant_id:id(6),workspace_id:id(2),transaction_id:id(70),async query(sql,args){
    calls.push({sql,args,scope:tx});
    if(sql===api.LISTING_SELECTED_SPEC_SQL)return {rowCount:1,rows:[{id:id(55),version:4}]};
    if(sql===api.LISTING_SELECTED_BINDING_INSERT_SQL){stored=JSON.parse(args[5]);return {rowCount:1,rows:[{value:stored}]};}
    if(sql.includes('publish_airprop_listing'))return {rowCount:1,rows:[{result:{version:1,listing_id:id(30),status:'published',idempotent:false}}]};
    assert.fail('NO_OTHER_SQL');
  }};
  return {api,tx,calls,get stored(){return stored;},async recheck(_scope,_command){
    assert.equal(_scope,tx);rechecks++;const row=rawRow(),selection=await versionedSelection(f);
    const core=actionProjection(row,id(3),selection,'edit_listing').core;
    return {core,spec:{id:id(55),version:4},source_versions:{...versions,party_version:drift&&rechecks===2?7:6}};
  }};
}
async function publicationPlan(f) {
  const all=await versionedSelection(f),{listing_id:_id,listing_version:_version,...selection}=all;
  const wire=JSON.stringify({contract:'airprop-listing-publication.v1',selection,command:{version:1,...scope,action:'publish_listing',opportunity_id:id(50),property_id:id(8),unit_id:id(9),kind:'resale',available_from:'2026-11-09T12:00:00Z',available_until:null,idempotency_key:'original-versioned-publication-01'}});
  const p=f.load('src/lib/airprop/listing-publication-v1.ts').prepareListingPublicationV1(wire,scope);
  const c={...scope,actor_id:id(3),workspace_id:id(2),transaction_id:id(70),command_id:id(71),idempotency_key:p.request.command.idempotency_key,
    permission_code:'airprop.opportunity.manage',module_code:'airprop_commercial',evaluation_purpose:'airprop.b2',aggregate_type:'portfolio.unit',aggregate_id:id(9),
    input_fingerprint:'sha256:'+digest(wire),provider_source_ids:[id(9),id(8),id(7),id(4),id(55)]};
  return {p,c,wire};
}
await check('versioned mutation positive stores exact Party/source tuple in same supplied C03 scope, not receipt',async()=>{
  const f=setup(),m=mutationFixture(f),{p,c,wire}=await publicationPlan(f);
  const result=await m.api.mutateListingWithSelectedBindingV1(m.tx,c,p,m.recheck);assert.deepEqual(result,{mutation_id:id(30)});
  assert.equal(m.stored.binding_version,2);assert.deepEqual(m.stored.selection.source_versions,versions);
  assert.equal(m.stored.wire_sha256,digest(wire));assert.equal(m.stored.command_key,c.idempotency_key);
  assert.ok(m.calls.every(q=>q.scope===m.tx));assert.equal('core_receipt_id' in m.stored,false);
});
await check('versioned mutation post-wait Party drift rejects before native write or binding insert',async()=>{
  const f=setup(),m=mutationFixture(f,true),{p,c}=await publicationPlan(f);
  await assert.rejects(m.api.mutateListingWithSelectedBindingV1(m.tx,c,p,m.recheck),/SOURCE_VERSIONS/);
  assert.equal(m.stored,null);assert.equal(m.calls.some(q=>q.sql.includes('publish_airprop_listing')),false);
});
await check('publication source tuple mismatch is rejected without rewriting original intent',async()=>{
  const f=setup(),{p,wire}=await publicationPlan(f),value=JSON.parse(wire);value.selection.source_versions.resource_version++;
  const changed=JSON.stringify(value);
  assert.throws(()=>f.load('src/lib/airprop/listing-publication-v1.ts').prepareListingPublicationV1(changed,scope),/SOURCE_VERSIONS/);
  assert.equal(p.wire,wire);assert.equal(JSON.stringify(value),changed);
});
await check('guarded v2 is fresh candidate replacement; v1 remains pinned and no grants/backfill',async()=>{
  const s=readFileSync('supabase/proposals/airprop_listing_selected_bindings_v2.sql','utf8');
  assert.match(s,/ADOPTION_REQUIRED' using errcode='55000'/);assert.match(s,/binding_version'='2'::jsonb/);
  assert.match(s,/p.native_revision_v1=/);assert.doesNotMatch(s,/^\s*(?:grant\s|update portfolio|insert into airprop\.listing_selected_bindings)/im);
  assert.equal(digest(readFileSync('supabase/proposals/airprop_listing_selected_bindings_v1.sql')),'124fc20a2dfb63d7da13290a1e1aaefc49655287d0e490c82d3dda85ab1640c1');
});
globalThis.fetch=nativeFetch;
console.log(JSON.stringify({groups,layer:'ACTUAL_CORE_OWNER_MODULES_CONTROLLED_TRANSPORT',sql_native_auth:'NOT_RUN_NOT_PASS',prior_Core13_packet27:'NOT_REPEATED'}));
