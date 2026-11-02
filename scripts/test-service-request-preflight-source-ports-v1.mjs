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

const { createServiceOfferingRequestSourcePortsV1 } = load(resolve(root,
  'src/lib/customer/service-v14-execution/request-source-ports.ts'));
const { preflightServiceOfferingRequestV1 } = load(resolve(root,
  'src/lib/customer/service-v14-execution/application-flow.ts'));

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { context:id(1), workspace:id(2), otherWorkspace:id(3), offering:id(4), revision:id(5),
  definition:id(6), provider:id(7), agreement:id(8), actor:id(9), tenant:id(10), decision:id(11),
  command:id(12) };
const input = { context_id:ids.context, workspace_id:ids.workspace, offering_id:ids.offering,
  published_revision_id:ids.revision };
const acquiredAt = '2026-11-02T09:00:00.000Z';

function setup(overrides={}) {
  const state = {
    authorityAllowed:true, authorityVersion:7, clock:'2026-11-02T10:00:00.000000Z',
    offeringVersion:4, revisionVersion:2, revisionStatus:'published',
    publishedRevisionId:ids.revision, workspaceId:ids.workspace, providerId:ids.provider,
    agreementId:ids.agreement, agreementVersion:3, definitionCurrent:true, providerCurrent:true,
    validFrom:'2026-11-01T00:00:00.000000Z', validUntil:null, failAt:null,
    onS01:null, onAuthority:null, queries:[], events:[], s01Calls:0, authorityCalls:0, ...overrides,
  };
  const scope = {
    transaction_id:id(20), database_transaction_id:'900', workspace_id:ids.workspace,
    tenant_id:ids.tenant, actor_id:ids.actor, attempt:1,
    async query(text, values=[]) {
      state.queries.push({text,values});
      const fail = key => { if (state.failAt===key) throw state.failure ?? new Error(`${key}_failed`); };
      if (text.includes("current_setting('transaction_isolation')")) {
        fail('authority-execution'); return one({transaction_id:'900',actor_id:ids.actor,
          isolation:'serializable',evaluated_at:'2026-11-02T09:30:00.000Z'});
      }
      if (text.includes('canonical_authority_revision_v1')) {
        fail('authority-revision'); return one({revision:String(state.authorityVersion)});
      }
      if (text.includes('identity.context_grants')) {
        fail('authority-context'); return one({tenant_id:ids.tenant,actor_id:ids.actor,status:'active',current:true});
      }
      if (text.includes('platform.customer_workspaces')) {
        fail('authority-workspace'); return one({tenant_id:ids.tenant});
      }
      if (text.includes('check_workspace_native_permission_v2')) {
        fail('authority-evaluator'); state.authorityCalls+=1; state.events.push('authority');
        if(state.onAuthority)await state.onAuthority(state,scope);
        return one({allowed:state.authorityAllowed,
          evaluated_at:'2026-11-02T09:40:00.000Z',module_definition_id:id(30),entitlement_key:'module.services_orders'});
      }
      if (text.includes('from service_catalog.offerings o')) {
        fail('offering');
        if (state.missing) return none();
        return one({tenant_id:ids.tenant,workspace_id:state.workspaceId,offering_id:ids.offering,
          offering_version:String(state.offeringVersion),published_revision_id:state.publishedRevisionId,
          provider_party_id:state.providerId,definition_id:ids.definition});
      }
      if (text.includes('from service_catalog.revisions r')) {
        fail('revision');
        return one({tenant_id:ids.tenant,workspace_id:ids.workspace,offering_id:ids.offering,
          published_revision_id:state.publishedRevisionId,
          published_revision_version:String(state.revisionVersion),provider_agreement_id:state.agreementId,
          provider_agreement_version:String(state.agreementVersion),revision_status:state.revisionStatus,
          valid_from:state.validFrom,valid_until:state.validUntil,acquisition_mode:'direct',
          coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],
            required_capabilities:[],required_policy_codes:[]}});
      }
      if (text.includes('from service_catalog.definitions d')) {
        fail('definition'); return one({definition_id:ids.definition,tenant_id:ids.tenant,
          workspace_id:ids.workspace,definition_current:state.definitionCurrent});
      }
      if (text.includes('from portfolio.parties p')) {
        fail('provider'); return one({provider_party_id:state.providerId,tenant_id:ids.tenant,
          provider_current:state.providerCurrent});
      }
      if (text.includes('txid_current()::text as database_transaction_id')) {
        fail('clock'); state.events.push('clock');
        return one({database_transaction_id:'900',actor_id:ids.actor,evaluated_at:state.clock});
      }
      throw new Error(`unexpected_query:${text}`);
    },
  };
  const authorityRequestFor = (_scope, request) => ({
    contract_version:'core-current-authority-transaction-port-request.v1',decision_id:ids.decision,
    context_id:request.context_id,workspace_id:request.workspace_id,actor_id:ids.actor,
    authority_version:state.authorityVersion,permission_code:'services.orders.request',
    module_code:'services_orders',evaluation_purpose:request.purpose,
    transaction_context:{transaction_id:scope.transaction_id,command_id:ids.command,attempt:scope.attempt,
      isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:scope.workspace_id,
        aggregate_type:'service_request',aggregate_id:request.offering_id,acquired_at:acquiredAt}},
  });
  const resolveProviderAgreement = async (_scope, request) => {
    state.s01Calls += 1;
    if (state.onS01) await state.onS01(state, scope);
    if (state.s01Error) throw state.s01Error;
    return {contract_version:'provider-agreement-verification.v1',agreement_status:'effective',
      tenant_id:ids.tenant,workspace_id:request.workspace_id,provider_party_id:state.s01ProviderId??ids.provider,
      provider_agreement_id:state.s01AgreementId??request.provider_agreement_id,
      provider_agreement_version:state.s01AgreementVersion??request.provider_agreement_version,
      valid_from:'2026-01-01',valid_until:null,allowed_service_scope:request.requested_service_scope,
      evaluated_at:'2026-11-02T09:50:00.000Z',action_authorization:'not_evaluated'};
  };
  const partial=createServiceOfferingRequestSourcePortsV1(scope,{authorityRequestFor,
    ...(state.s01Absent?{}:{resolveProviderAgreement})});
  const ports={...partial,resolveCanonicalResource:async()=>{throw new Error('S02_not_in_scope');},
    transactionalReaders:{},host:{async execute(){throw new Error('write_not_allowed');}}};
  return {state,scope,ports,partial};
}
const one = row => ({rowCount:1,rows:[row]});
const none = () => ({rowCount:0,rows:[]});

const precisionOnly=process.argv.includes('--time-precision');
const cases=[];
async function check(name,fn,precision=false){if(precisionOnly&&!precision)return;
  if(!precisionOnly&&precision)return;
  try{await fn();cases.push({name,ok:true});}catch(error){cases.push({name,ok:false,error});}}

await check('allowed workspace source consumes S01 and is ready with SELECT-only queries',async()=>{
  const x=setup();
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),{
    status:'ready',contract:'service-offering-request-flow.v1',source_kind:'workspace',resources:[]});
  assert.equal(x.state.s01Calls,1);
  assert.ok(x.state.queries.every(query=>/^select\b/i.test(query.text.trim())));
  const principal=await x.partial.resolvePrincipal({...input});
  assert.deepEqual(principal,{actor_id:ids.actor,authority_version:7});
});

await check('missing unpublished expired foreign and revoked sources fail closed',async()=>{
  const values=[setup({missing:true}),setup({revisionStatus:'draft'}),
    setup({validUntil:'2026-11-02T09:59:59.000000Z'}),setup({workspaceId:ids.otherWorkspace}),
    setup({authorityAllowed:false})];
  for(const x of values) assert.notEqual((await preflightServiceOfferingRequestV1(input,x.ports)).status,'ready');
});

await check('agreement provider and revision mismatches cannot become ready',async()=>{
  const agreement=setup({s01AgreementId:id(40)});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,agreement.ports),
    {status:'denied',code:'SOURCE_ACCESS_DENIED'});
  const provider=setup({s01ProviderId:id(41)});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,provider.ports),
    {status:'denied',code:'SOURCE_ACCESS_DENIED'});
  const revision=setup({publishedRevisionId:id(42)});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,revision.ports),
    {status:'conflict',code:'OFFERING_CHANGED'});
});

await check('scope drift during a source wait is bounded and cannot become ready',async()=>{
  const x=setup(); let changed=false; const query=x.scope.query;
  x.scope.query=async(text,values)=>{const result=await query(text,values);
    if(!changed&&text.includes('from service_catalog.offerings o')){changed=true;x.scope.attempt=2;}return result;};
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),
    {status:'not_ready',code:'RUNTIME_BINDING_INACTIVE'});
});

await check('Offering version drift while S01 waits returns conflict',async()=>{
  const x=setup({onS01:state=>{state.offeringVersion=5;}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),
    {status:'conflict',code:'OFFERING_CHANGED'});
});

await check('expiry while S01 waits returns denial instead of stale ready',async()=>{
  const x=setup({validUntil:'2026-11-02T10:00:30.000000Z',
    onS01:state=>{state.clock='2026-11-02T10:01:00.000000Z';}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),
    {status:'denied',code:'OFFERING_UNAVAILABLE'});
});

await check('final authority wait is followed by a fresh same-scope clock on the ready path',async()=>{
  const x=setup();
  assert.equal((await preflightServiceOfferingRequestV1(input,x.ports)).status,'ready');
  assert.equal(x.state.events.at(-1),'clock');
  assert.ok(x.state.events.lastIndexOf('clock')>x.state.events.lastIndexOf('authority'));
  assert.equal(x.ports.now(),'2026-11-02T10:00:00.000000Z');
});

await check('expiry during the final authority wait cannot return stale ready',async()=>{
  const x=setup({validUntil:'2026-11-02T10:00:01.000000Z',
    onAuthority:state=>{if(state.authorityCalls===6)state.clock='2026-11-02T10:00:02.000000Z';}});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),
    {status:'denied',code:'OFFERING_UNAVAILABLE'});
  assert.equal(x.state.events.at(-1),'clock');
});

await check('resolvePrincipal publishes only its post-authority clock',async()=>{
  const x=setup({onAuthority:state=>{if(state.authorityCalls===2)
    state.clock='2026-11-02T10:00:02.000000Z';}});
  assert.deepEqual(await x.partial.resolvePrincipal({...input}),
    {actor_id:ids.actor,authority_version:7});
  assert.equal(x.partial.now(),'2026-11-02T10:00:02.000000Z');
  assert.equal(x.state.events.at(-1),'clock');
});

await check('missing accepted S01 blocks only this preflight',async()=>{
  const x=setup({s01Absent:true});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,x.ports),
    {status:'not_ready',code:'SERVICE_S01_NOT_READY'});
});

await check('exact SQLSTATE 40001 survives source and S01 boundaries',async()=>{
  for(const x of [setup({failAt:'offering'}),setup({failAt:'clock'}),
    setup({s01Error:Object.assign(new Error('retry'),{code:'40001'})})]){
    const failure=x.state.s01Error??Object.assign(new Error('retry'),{code:'40001'});
    if(x.state.failAt)x.state.failure=failure;
    await assert.rejects(()=>preflightServiceOfferingRequestV1(input,x.ports),error=>error===failure);
  }
});

await check('ordinary source and S01 failures remain bounded and redacted',async()=>{
  const source=setup({failAt:'offering',failure:new Error('private SQL detail')});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,source.ports),
    {status:'not_ready',code:'RUNTIME_BINDING_INACTIVE'});
  const s01=setup({s01Error:new Error('private provider detail')});
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,s01.ports),
    {status:'not_ready',code:'SERVICE_S01_NOT_READY'});
});

await check('source adapter contains no write, service-role, receipt or fallback path',async()=>{
  const source=readFileSync(resolve(root,'src/lib/customer/service-v14-execution/request-source-ports.ts'),'utf8');
  assert.doesNotMatch(source,/\b(?:insert|update|delete|commit|rollback|service_role|createClient|\.rpc)\b/i);
  assert.match(source,/resolveAuthority\(scope, request\)/);
  assert.match(source,/dependencies\.resolveProviderAgreement\(scope, input\)/);
});

for(const [name,clock,start,end,expected] of [
  ['preflight rejects before exact microsecond start','2026-11-02T10:00:00.000100Z',
    '2026-11-02T10:00:00.000900Z',null,'denied'],
  ['preflight permits exact microsecond start','2026-11-02T10:00:00.000900Z',
    '2026-11-02T10:00:00.000900Z',null,'ready'],
  ['preflight permits after exact start','2026-11-02T10:00:00.000901Z',
    '2026-11-02T10:00:00.000900Z',null,'ready'],
  ['sub-millisecond interval interior remains ready','2026-11-02T10:00:00.000500Z',
    '2026-11-02T10:00:00.000100Z','2026-11-02T10:00:00.000900Z','ready'],
  ['sub-millisecond end remains exclusive','2026-11-02T10:00:00.000900Z',
    '2026-11-02T10:00:00.000100Z','2026-11-02T10:00:00.000900Z','denied'],
  ['equivalent offset start is ready','2026-11-02T10:00:00.000100Z',
    '2026-11-02T13:30:00.000100+03:30',null,'ready'],
  ['invalid precision fails closed','2026-11-02T10:00:00.000100Z',
    '2026-11-02T10:00:00.0000001Z',null,'denied'],
])await check(name,async()=>{
  const x=setup({clock,validFrom:start,validUntil:end});
  assert.equal((await preflightServiceOfferingRequestV1(input,x.ports)).status,expected);
  if(expected==='ready')assert.equal(x.ports.now(),clock);
},true);

const failed=cases.filter(item=>!item.ok);
for(const item of cases) console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.ok?'':`\n${item.error?.stack??item.error}`}`);
if(failed.length) process.exitCode=1; else console.log(`PASS ${cases.length}/${cases.length} request source-port controls`);
