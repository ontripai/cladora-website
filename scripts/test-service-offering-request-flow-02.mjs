import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
function load(filename) {
  filename = extname(filename) ? filename : `${filename}.ts`;
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} }; cache.set(filename, mod);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, moduleResolution: ts.ModuleResolutionKind.NodeNext },
  }).outputText;
  const localRequire = specifier => {
    if (specifier.startsWith('@/')) return load(resolve(root, 'src', specifier.slice(2)));
    if (specifier.startsWith('.')) return load(resolve(dirname(filename), specifier));
    return require(specifier);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}

const {
  preflightServiceOfferingRequestV1,
  submitServiceOfferingRequestV1,
} = load(resolve(root, 'src/lib/customer/service-v14-execution/application-flow.ts'));
const { createServiceOfferingRequestFlowHandlers } = load(
  resolve(root, 'src/lib/customer/service-v14-execution/http.ts'));
const { NextRequest } = require('next/server');

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { context:id(1), workspace:id(2), otherWorkspace:id(3), offering:id(4), revision:id(5),
  provider:id(6), agreement:id(7), resource:id(8), beneficiary:id(9), actor:id(10) };
const now = '2026-11-02T12:00:00.000000Z';
const baseInput = { context_id:ids.context, workspace_id:ids.workspace, offering_id:ids.offering,
  published_revision_id:ids.revision };
const publicInput = { ...baseInput, beneficiary_party_id:ids.beneficiary, resource:null,
  description:'Repair the lobby entry lighting', idempotency_key:'service-flow-02-command' };
const baseSnapshot = {
  workspace_id:ids.workspace, offering_id:ids.offering, published_revision_id:ids.revision,
  offering_version:4, published_revision_version:2,
  provider_party_id:ids.provider, provider_agreement_id:ids.agreement, provider_agreement_version:3,
  status:'published', acquisition_mode:'direct', valid_from:'2026-10-01T00:00:00Z', valid_until:null,
  coverage:{kind:'workspace'}, eligibility:{policy_version:1, required_resource_types:[],
    required_capabilities:[], required_policy_codes:[]}, current_actor_can_request:true,
};
function agreement(input, overrides={}) {
  return { contract_version:'provider-agreement-verification.v1', agreement_status:'effective',
    tenant_id:id(90), workspace_id:input.workspace_id, provider_party_id:ids.provider,
    provider_agreement_id:input.provider_agreement_id,
    provider_agreement_version:input.provider_agreement_version, valid_from:'2026-01-01', valid_until:null,
    allowed_service_scope:input.requested_service_scope, evaluated_at:'2026-11-02T11:59:00Z',
    action_authorization:'not_evaluated', ...overrides };
}
function resource(input, overrides={}) {
  return { contract_version:'canonical-resource-reference.v1', reference_status:'verified',
    tenant_id:id(90), workspace_id:input.workspace_id, resource_type:input.resource_type,
    resource_id:input.resource_id, resource_version:input.resource_version, party_kind:null,
    display_name:'Lobby entrance', lifecycle_status:'active', evaluated_at:'2026-11-02T11:59:00Z',
    action_authorization:'not_evaluated', ...overrides };
}
function ports(overrides={}) {
  const state = { hostCalls:0, commands:[] };
  const value = {
    async loadOffering(){ return structuredClone(baseSnapshot); },
    async resolvePrincipal(){ return {actor_id:ids.actor, authority_version:5}; },
    async resolveProviderAgreement(input){ return agreement(input); },
    async resolveCanonicalResource(input){ return resource(input); },
    transactionalReaders:{
      async resolveProviderAgreement(_scope,input){ return agreement(input); },
      async resolveCanonicalResource(_scope,input){ return resource(input); },
    },
    host:{ async execute(command){ state.hostCalls += 1; state.commands.push(structuredClone(command));
      return {status:'unknown_commit', code:'READBACK_REQUIRED'}; } },
    now(){ return now; },
    ...overrides,
  };
  return { value, state };
}

const cases = [];
async function check(name, test) { try { await test(); cases.push({name,ok:true}); }
  catch (error) { cases.push({name,ok:false,error}); } }

await check('workspace offering is ready without S02 or S03', async()=>{
  const {value}=ports({async resolveCanonicalResource(){throw new Error('S02 absent');}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(baseInput,value),{
    status:'ready', contract:'service-offering-request-flow.v1', source_kind:'workspace', resources:[]});
});

await check('named resource is resolved by S02 and internal ids are not used as labels', async()=>{
  const snapshot={...baseSnapshot,coverage:{kind:'resources',resources:[{resource_id:ids.resource,
    resource_version:6,resource_type:'unit'}]},eligibility:{...baseSnapshot.eligibility,required_resource_types:['unit']}};
  const {value}=ports({async loadOffering(){return structuredClone(snapshot);}});
  const result=await preflightServiceOfferingRequestV1(baseInput,value);
  assert.equal(result.status,'ready'); assert.equal(result.source_kind,'resources');
  assert.equal(result.resources[0].label,'Lobby entrance'); assert.notEqual(result.resources[0].label,ids.resource);
});

await check('missing official ports only block the affected action', async()=>{
  const missingS01=ports({async resolveProviderAgreement(){throw new Error('absent');}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(baseInput,missingS01.value),
    {status:'not_ready',code:'SERVICE_S01_NOT_READY'});
  const geographic=ports({async loadOffering(){return {...baseSnapshot,
    coverage:{kind:'geographic',country_code:'RO',region_codes:['B']}};}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(baseInput,geographic.value),
    {status:'not_ready',code:'SERVICE_S03_NOT_READY'});
});

await check('expired, revoked, stale and cross-workspace sources fail closed with zero writes', async()=>{
  const variants=[
    ports({async loadOffering(){return {...baseSnapshot,valid_until:'2026-11-01T00:00:00Z'};}}),
    ports({async resolveProviderAgreement(input){return agreement(input,{agreement_status:'revoked'});}}),
    ports({async loadOffering(){return {...baseSnapshot,published_revision_id:id(71)};}}),
    ports({async loadOffering(){return {...baseSnapshot,workspace_id:ids.otherWorkspace};}}),
  ];
  for(const item of variants){ const result=await submitServiceOfferingRequestV1(publicInput,item.value);
    assert.notEqual(result.status,'submitted'); assert.equal(item.state.hostCalls,0); }
});

await check('withheld provider and resource create no write', async()=>{
  const withheld={contract_version:'provider-agreement-verification.v1',agreement_status:'withheld',
    tenant_id:null,workspace_id:null,provider_party_id:null,provider_agreement_id:null,
    provider_agreement_version:null,valid_from:null,valid_until:null,allowed_service_scope:[],
    evaluated_at:'2026-11-02T11:59:00Z',action_authorization:'not_evaluated'};
  const item=ports({async resolveProviderAgreement(){return withheld;}});
  assert.deepEqual(await submitServiceOfferingRequestV1(publicInput,item.value),
    {status:'denied',code:'SOURCE_ACCESS_DENIED'}); assert.equal(item.state.hostCalls,0);
});

await check('retry uses exactly the same server identity and command body', async()=>{
  const item=ports();
  assert.deepEqual(await submitServiceOfferingRequestV1(publicInput,item.value),
    {status:'unknown',code:'READBACK_REQUIRED'});
  assert.deepEqual(await submitServiceOfferingRequestV1(structuredClone(publicInput),item.value),
    {status:'unknown',code:'READBACK_REQUIRED'});
  assert.equal(item.state.hostCalls,2); assert.deepEqual(item.state.commands[1],item.state.commands[0]);
  const changed={...publicInput,description:'Repair different lobby lighting'};
  await submitServiceOfferingRequestV1(changed,item.value);
  assert.equal(item.state.commands[2].idempotency_key,item.state.commands[0].idempotency_key);
  assert.notEqual(item.state.commands[2].input_fingerprint,item.state.commands[0].input_fingerprint);
});

await check('a source change after preflight cannot dispatch a write', async()=>{
  let reads=0; const item=ports({async loadOffering(){reads+=1;return reads===1?structuredClone(baseSnapshot):
    {...baseSnapshot,published_revision_id:id(88)};}});
  assert.deepEqual(await submitServiceOfferingRequestV1(publicInput,item.value),
    {status:'conflict',code:'OFFERING_CHANGED'}); assert.equal(item.state.hostCalls,0);
});

await check('missing authenticated principal fails closed before host dispatch', async()=>{
  const item=ports({async resolvePrincipal(){throw new Error('principal source unavailable');}});
  assert.deepEqual(await submitServiceOfferingRequestV1(publicInput,item.value),
    {status:'not_ready',code:'RUNTIME_BINDING_INACTIVE'}); assert.equal(item.state.hostCalls,0);
});

await check('HTTP contract rejects cross-origin, malformed and oversized input before host',async()=>{
  const item=ports(); const handlers=createServiceOfferingRequestFlowHandlers(item.value);
  const cross=new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow',{
    method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},
    body:JSON.stringify(publicInput)});
  assert.equal((await handlers.POST(cross)).status,403);
  const malformed=new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow',{
    method:'POST',headers:{'content-type':'application/json'},body:'{"bad":'});
  assert.equal((await handlers.POST(malformed)).status,400);
  const oversized=new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow',{
    method:'POST',headers:{'content-type':'application/json','content-length':'40000'},body:'{}'});
  assert.equal((await handlers.POST(oversized)).status,413);
  assert.equal(item.state.hostCalls,0);
});

await check('inactive runtime returns NOT_READY and never falls back',async()=>{
  const handlers=createServiceOfferingRequestFlowHandlers(null);
  const query=new URLSearchParams(baseInput).toString();
  const response=await handlers.GET(new NextRequest(`http://localhost/api/customer/v1/services/offering-request-flow?${query}`));
  assert.equal(response.status,503); assert.deepEqual(await response.json(),{error:{code:'RUNTIME_BINDING_INACTIVE'}});
});

await check('persistence remains the existing request-to-nonbinding-quote path',async()=>{
  const sql=readFileSync(resolve(root,'supabase/hosted-service-v14-execution/forward.sql'),'utf8');
  const quoteRoute=readFileSync(resolve(root,'src/app/api/customer/v1/services/quotes/route.ts'),'utf8');
  const quoteUi=readFileSync(resolve(root,'src/components/customer/CustomerServiceQuotes.tsx'),'utf8');
  assert.match(sql,/insert into service_catalog\.requests\s*\(/);
  assert.doesNotMatch(sql,/insert into\s+service_catalog\.(?:orders|payments)/i);
  assert.match(quoteRoute,/read_service_quote_drafts_v2/);
  assert.match(quoteUi,/No consent, order or payment was created\./);
});

await check('default binding contains no service-role or legacy writer fallback',async()=>{
  const binding=readFileSync(resolve(root,'src/lib/customer/service-v14-execution/runtime-binding.ts'),'utf8');
  assert.doesNotMatch(binding,/from ['"][^'"]*supabase|createClient\(|process\.env|\.rpc\(/i);
  assert.match(binding,/return null/);
});

const failed=cases.filter(item=>!item.ok);
for(const item of cases) console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.ok?'':`\n${item.error?.stack??item.error}`}`);
if(failed.length) process.exitCode=1;
else console.log(`PASS ${cases.length}/${cases.length} SERVICE offering-request flow checks`);
