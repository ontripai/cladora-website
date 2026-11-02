import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  path = extname(path) ? path : `${path}.ts`;
  path = resolve(root, path);
  if (cache.has(path)) return cache.get(path).exports;
  const mod = { exports: {} }; cache.set(path, mod);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true },
  }).outputText;
  const localRequire = specifier => specifier.startsWith('@/')
    ? load(resolve(root, 'src', specifier.slice(2)))
    : specifier.startsWith('.') ? load(resolve(dirname(path), specifier)) : require(specifier);
  new Function('require', 'module', 'exports', output)(localRequire, mod, mod.exports);
  return mod.exports;
}

const {
  SERVICE_OFFERING_DISCLOSURE_SQL,
  createServiceOfferingDisclosureCanDiscloseV1,
  projectServiceOfferingDisclosureSourceV1,
} = load('src/lib/customer/service-offering-disclosure-source-v1.ts');
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { actor:id(1), tenant:id(2), workspace:id(3), context:id(4), offering:id(5),
  revision:id(6), provider:id(7), agreement:id(8), transaction:id(9), command:id(10),
  decision:id(11), request:id(12), module:id(13), definition:id(14) };
const now = '2026-11-02T12:00:00.000Z';
const binding = {
  contract_version:'service-offering-disclosure-source.v1', context_id:ids.context,
  workspace_id:ids.workspace, offering_id:ids.offering, offering_version:4,
  published_revision_id:ids.revision, published_revision_version:2,
  provider_party_id:ids.provider, provider_agreement_id:ids.agreement,
  provider_agreement_version:3, requested_service_scope:'service.request.create',
  permission_code:'services.orders.request',
};
const input = {
  contract_version:'provider-agreement-verification.v1', context_id:ids.context,
  workspace_id:ids.workspace, provider_agreement_id:ids.agreement,
  provider_agreement_version:3, requested_service_scope:['service.request.create'],
  permission_code:'services.orders.request',
};

function setup() {
  const state = {
    allowed:true, sourceCalls:0, afterSource:()=>{}, calls:[], failAt:null, failure:null,
    clock:now,
    row:{ tenant_id:ids.tenant, workspace_id:ids.workspace, offering_id:ids.offering,
      offering_version:'4', published_revision_id:ids.revision,
      published_revision_version:'2', provider_party_id:ids.provider,
      provider_agreement_id:ids.agreement, provider_agreement_version:'3',
      revision_status:'published', valid_from:'2026-01-01T00:00:00.000Z', valid_until:null,
      acquisition_mode:'pre_quote', coverage:{kind:'workspace'},
      eligibility:{policy_version:1, required_resource_types:[], required_capabilities:[],
        required_policy_codes:[]}, definition_current:true, provider_current:true },
  };
  const rows = value => ({ rows: structuredClone(value), rowCount:value.length });
  const scope = { transaction_id:ids.transaction, database_transaction_id:'55',
    workspace_id:ids.workspace, tenant_id:ids.tenant, actor_id:ids.actor, attempt:1,
    async query(sql, params=[]) {
      state.calls.push({ sql, params:structuredClone(params) });
      const point=sql===SERVICE_OFFERING_DISCLOSURE_SQL.offering?'offering'
        :sql===SERVICE_OFFERING_DISCLOSURE_SQL.revision?'revision'
          :sql===SERVICE_OFFERING_DISCLOSURE_SQL.clock?'clock'
            :sql.includes('canonical_authority_revision_v1')?'authority':null;
      if(point!==null&&state.failAt===point)throw state.failure;
      if (sql === SERVICE_OFFERING_DISCLOSURE_SQL.offering) {
        assert.deepEqual(params, [ids.tenant, ids.workspace, ids.offering]);
        state.sourceCalls += 1;
        if (state.row === null) return rows([]);
        const row=state.row;return rows([{tenant_id:row.tenant_id,workspace_id:row.workspace_id,
          offering_id:row.offering_id,offering_version:row.offering_version,
          published_revision_id:row.published_revision_id,provider_party_id:row.provider_party_id,
          definition_id:ids.definition}]);
      }
      if (sql === SERVICE_OFFERING_DISCLOSURE_SQL.revision) {
        assert.deepEqual(params,[ids.tenant,ids.workspace,ids.offering,ids.revision]);
        const row=state.row;return rows([{tenant_id:row.tenant_id,workspace_id:row.workspace_id,
          offering_id:row.offering_id,published_revision_id:row.published_revision_id,
          published_revision_version:row.published_revision_version,
          provider_agreement_id:row.provider_agreement_id,
          provider_agreement_version:row.provider_agreement_version,
          revision_status:row.revision_status,valid_from:row.valid_from,valid_until:row.valid_until,
          acquisition_mode:row.acquisition_mode,coverage:row.coverage,eligibility:row.eligibility}]);
      }
      if (sql === SERVICE_OFFERING_DISCLOSURE_SQL.definition) {
        assert.deepEqual(params,[ids.tenant,ids.workspace,ids.definition]);
        return rows([{definition_id:ids.definition,tenant_id:state.row.tenant_id,
          workspace_id:state.row.workspace_id,definition_current:state.row.definition_current}]);
      }
      if (sql === SERVICE_OFFERING_DISCLOSURE_SQL.provider) {
        assert.deepEqual(params,[ids.tenant,ids.provider]);
        const result=rows([{provider_party_id:state.row.provider_party_id,
          tenant_id:state.row.tenant_id,provider_current:state.row.provider_current}]);
        state.afterSource(state.sourceCalls);return result;
      }
      if (sql === SERVICE_OFFERING_DISCLOSURE_SQL.clock) {
        return rows([{ database_transaction_id:'55', actor_id:ids.actor, evaluated_at:state.clock }]);
      }
      if (sql.includes('select txid_current()')) return rows([{ transaction_id:'55',
        actor_id:ids.actor, isolation:'serializable', evaluated_at:now }]);
      if (sql.includes('canonical_authority_revision_v1')) return rows([{ revision:'9' }]);
      if (sql.includes('identity.context_grants')) return rows([{ tenant_id:ids.tenant,
        actor_id:ids.actor, status:'active', current:true }]);
      if (sql.includes('platform.customer_workspaces')) return rows([{ tenant_id:ids.tenant }]);
      if (sql.includes('app_private.check_workspace_native_permission_v2')) return rows([{
        allowed:state.allowed, evaluated_at:now, module_definition_id:ids.module,
        entitlement_key:null,
      }]);
      throw new Error('UNEXPECTED_SQL');
    },
  };
  const authorityRequest = {
    contract_version:'core-current-authority-transaction-port-request.v1', decision_id:ids.decision,
    context_id:ids.context, workspace_id:ids.workspace, actor_id:ids.actor,
    authority_version:9, permission_code:'services.orders.request', module_code:'services_orders',
    evaluation_purpose:'service.create_request',
    transaction_context:{ transaction_id:ids.transaction, command_id:ids.command, attempt:1,
      isolation_level:'serializable', lock:{ kind:'command_aggregate', workspace_id:ids.workspace,
        aggregate_type:'service_request', aggregate_id:ids.request,
        acquired_at:'2026-11-02T11:59:00.000Z' } },
  };
  const ports = { authorityRequestFor:() => structuredClone(authorityRequest) };
  return { state, scope, ports, authorityRequest };
}

const sqlstateOnly=process.argv.includes('--sqlstate');
const timePrecisionOnly=process.argv.includes('--time-precision');
let passed = 0;
const check = async (name, fn, mode='default') => {
  if(mode===true)mode='sqlstate';
  if(sqlstateOnly&&mode!=='sqlstate')return;
  if(timePrecisionOnly&&mode!=='time')return;
  if(!sqlstateOnly&&!timePrecisionOnly&&mode!=='default')return;
  await fn();passed += 1;console.log(`PASS ${name}`);
};

await check('actual source binds exact Offering tuple and exposes no agreement validity', async () => {
  const x=setup(); const result=await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports);
  assert.deepEqual(result, { status:'disclosed', contract_version:'service-offering-disclosure-source.v1',
    tenant_id:ids.tenant, workspace_id:ids.workspace, offering_id:ids.offering, offering_version:4,
    published_revision_id:ids.revision, published_revision_version:2,
    provider_party_id:ids.provider, provider_agreement_id:ids.agreement,
    provider_agreement_version:3, requested_service_scope:'service.request.create',
    acquisition_mode:'pre_quote', coverage_kind:'workspace', availability:'available',
    revision_status:'published', valid_from:'2026-01-01T00:00:00.000Z', valid_until:null,
    evaluated_at:now, agreement_verification:'not_evaluated', action_authorization:'not_evaluated' });
  assert.equal(x.state.sourceCalls,2);
});

await check('adapter is the exact controlled Core canDisclose shape', async () => {
  const x=setup(); const canDisclose=createServiceOfferingDisclosureCanDiscloseV1(binding,x.ports);
  assert.equal(await canDisclose(x.scope,input),'disclose');
  assert.equal(await canDisclose(x.scope,{...input,requested_service_scope:['service.other']}),'withhold');
});

for (const [name, mutate, status] of [
  ['reservation is outside the source policy', x=>{x.state.row.acquisition_mode='reservation';},'withheld'],
  ['resource coverage does not import S02', x=>{x.state.row.coverage={kind:'resources',resources:[{
    resource_id:id(80),resource_version:1,resource_type:'unit'}]};},'withheld'],
  ['expired Offering is unavailable', x=>{x.state.row.valid_until='2026-11-02T00:00:00.000Z';},'withheld'],
  ['unpublished revision is unavailable', x=>{x.state.row.revision_status='suspended';},'withheld'],
  ['revoked provider is unavailable', x=>{x.state.row.provider_current=false;},'withheld'],
  ['foreign returned row is never disclosed', x=>{x.state.row.workspace_id=id(90);},'withheld'],
  ['stale Offering version conflicts', x=>{x.state.row.offering_version='5';},'conflict'],
  ['missing V14 metadata is NOT_READY', x=>{x.state.row.provider_agreement_id=null;},'not_ready'],
  ['another-domain eligibility stays NOT_READY', x=>{x.state.row.eligibility.required_capabilities=['other'];},'not_ready'],
]) await check(name, async () => {
  const x=setup(); mutate(x); const result=await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports);
  assert.equal(result.status,status);
});

await check('initial canonical authority denial scans no Offering rows', async () => {
  const x=setup(); x.state.allowed=false;
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'withheld',code:'AUTHORITY_DENIED'});
  assert.equal(x.state.sourceCalls,0);
});

await check('alternate authority purpose cannot widen disclosure', async () => {
  const x=setup(); x.authorityRequest.evaluation_purpose='service.other';
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'withheld',code:'AUTHORITY_DENIED'});
  assert.equal(x.state.sourceCalls,0);
});

await check('authority revoked after lock wait is denied before second source read', async () => {
  const x=setup(); x.state.afterSource=count=>{if(count===1)x.state.allowed=false;};
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'withheld',code:'AUTHORITY_DENIED'});
  assert.equal(x.state.sourceCalls,1);
});

await check('authority revoked after the second source read is also denied', async () => {
  const x=setup(); x.state.afterSource=count=>{if(count===2)x.state.allowed=false;};
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'withheld',code:'AUTHORITY_DENIED'});
});

await check('source drift between locked observations conflicts', async () => {
  const x=setup(); x.state.afterSource=count=>{if(count===1)x.state.row.published_revision_version='3';};
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'conflict',code:'SOURCE_CHANGED'});
});

await check('source absence is withheld and ambiguous cardinality is NOT_READY', async () => {
  const absent=setup(); absent.state.row=null;
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(absent.scope,input,binding,absent.ports),
    {status:'withheld',code:'SOURCE_DENIED'});
  const ambiguous=setup(); const query=ambiguous.scope.query.bind(ambiguous.scope);
  ambiguous.scope.query=async(sql,params)=>sql===SERVICE_OFFERING_DISCLOSURE_SQL.offering
    ? {rows:[ambiguous.state.row,ambiguous.state.row],rowCount:2}:query(sql,params);
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(ambiguous.scope,input,binding,ambiguous.ports),
    {status:'not_ready',code:'SOURCE_UNAVAILABLE'});
});

await check('all projection operations are SELECT-only and S01 is never invoked', async () => {
  const x=setup(); await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports);
  assert.ok(x.state.calls.every(call=>/^\s*select\b/i.test(call.sql)));
  const source=readFileSync(resolve(root,'src/lib/customer/service-offering-disclosure-source-v1.ts'),'utf8');
  assert.doesNotMatch(source,/createCoreS01ProviderAgreementReader|resolveProviderAgreement\s*\(/);
  const sourceOrder=x.state.calls.map(call=>call.sql).filter(sql=>Object.values(
    SERVICE_OFFERING_DISCLOSURE_SQL).slice(0,4).includes(sql));
  assert.deepEqual(sourceOrder,[
    SERVICE_OFFERING_DISCLOSURE_SQL.offering,SERVICE_OFFERING_DISCLOSURE_SQL.revision,
    SERVICE_OFFERING_DISCLOSURE_SQL.definition,SERVICE_OFFERING_DISCLOSURE_SQL.provider,
    SERVICE_OFFERING_DISCLOSURE_SQL.offering,SERVICE_OFFERING_DISCLOSURE_SQL.revision,
    SERVICE_OFFERING_DISCLOSURE_SQL.definition,SERVICE_OFFERING_DISCLOSURE_SQL.provider,
  ]);
  assert.match(SERVICE_OFFERING_DISCLOSURE_SQL.offering,/for key share of o/);
  assert.match(SERVICE_OFFERING_DISCLOSURE_SQL.revision,/for share of r/);
  assert.match(SERVICE_OFFERING_DISCLOSURE_SQL.provider,/for share of p/);
});

await check('positive control still discloses through projection and adapter',async()=>{
  const x=setup();
  assert.equal((await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports)).status,
    'disclosed');
  assert.equal(await createServiceOfferingDisclosureCanDiscloseV1(binding,x.ports)(x.scope,input),
    'disclose');
},true);

for(const point of ['authority','offering','revision','clock'])await check(
  `SQLSTATE 40001 from ${point} reaches the trusted caller unchanged`,async()=>{
    const x=setup();const failure=Object.assign(new Error(`PRIVATE_${point.toUpperCase()}_DETAIL`),
      {code:'40001'});x.state.failAt=point;x.state.failure=failure;
    await assert.rejects(
      ()=>projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
      error=>error===failure&&error.code==='40001');
    await assert.rejects(
      ()=>createServiceOfferingDisclosureCanDiscloseV1(binding,x.ports)(x.scope,input),
      error=>error===failure&&error.code==='40001');
  },true);

await check('ordinary source failure stays bounded and redacted',async()=>{
  const x=setup();x.state.failAt='offering';
  x.state.failure=Object.assign(new Error('PRIVATE_TABLE_AND_SQL_DETAIL'),{code:'57014'});
  assert.deepEqual(await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports),
    {status:'not_ready',code:'SOURCE_UNAVAILABLE'});
  assert.equal(await createServiceOfferingDisclosureCanDiscloseV1(binding,x.ports)(x.scope,input),
    'withhold');
},true);

for(const [name,clock,start,end,expected] of [
  ['before microsecond start is unavailable','2026-11-02T10:00:00.000100Z',
    '2026-11-02T10:00:00.000900Z',null,'withheld'],
  ['exact microsecond start is available','2026-11-02T10:00:00.000900Z',
    '2026-11-02T10:00:00.000900Z',null,'disclosed'],
  ['after microsecond start remains available','2026-11-02T10:00:00.000901Z',
    '2026-11-02T10:00:00.000900Z',null,'disclosed'],
  ['sub-millisecond interval interior is available','2026-11-02T10:00:00.000500Z',
    '2026-11-02T10:00:00.000100Z','2026-11-02T10:00:00.000900Z','disclosed'],
  ['end boundary is exclusive','2026-11-02T10:00:00.000900Z',
    '2026-11-02T10:00:00.000100Z','2026-11-02T10:00:00.000900Z','withheld'],
  ['equivalent offset preserves the instant','2026-11-02T10:00:00.000100Z',
    '2026-11-02T13:30:00.000100+03:30',null,'disclosed'],
  ['invalid over-precision fails closed','2026-11-02T10:00:00.000100Z',
    '2026-11-02T10:00:00.0000001Z',null,'withheld'],
])await check(name,async()=>{
  const x=setup();x.state.clock=clock;x.state.row.valid_from=start;x.state.row.valid_until=end;
  const result=await projectServiceOfferingDisclosureSourceV1(x.scope,input,binding,x.ports);
  assert.equal(result.status,expected);
},'time');

console.log(`PASS ${passed}/${passed} SERVICE Offering disclosure source checks`);
