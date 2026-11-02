import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  new Function('require','module','exports',compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url))
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name),
  loaded,loaded.exports);
  cache.set(url.href,loaded.exports); return loaded.exports;
}

const { preflightServiceOfferingRequestV1 } = load(
  new URL('../src/lib/customer/service-v14-execution/application-flow.ts',import.meta.url));
const { prepareCreateVersionedServiceRequestV1 } = load(
  new URL('../src/lib/customer/service-v14-execution/request-command.ts',import.meta.url));
const { createCorePostgresTransactionHostV1 } = load(
  new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));

const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={context:id(1),workspace:id(2),actor:id(3),transaction:id(4),command:id(5),request:id(6),
  offering:id(7),revision:id(8),provider:id(9),agreement:id(10),beneficiary:id(11),decision:id(12),tenant:id(13)};
const serialization=Object.assign(new Error('controlled serialization retry'),{code:'40001'});
const ordinary=new Error('private provider failure');
const input={context_id:ids.context,workspace_id:ids.workspace,offering_id:ids.offering,
  published_revision_id:ids.revision};
const snapshot={workspace_id:ids.workspace,offering_id:ids.offering,offering_version:4,
  published_revision_id:ids.revision,published_revision_version:2,provider_party_id:ids.provider,
  provider_agreement_id:ids.agreement,provider_agreement_version:3,status:'published',
  acquisition_mode:'direct',valid_from:'2026-01-01T00:00:00Z',valid_until:null,
  coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],
    required_capabilities:[],required_policy_codes:[]},current_actor_can_request:true};
const one=row=>({rowCount:1,rows:[row]});const none=()=>({rowCount:0,rows:[]});

function publicPorts(error){return{async loadOffering(){return structuredClone(snapshot);},
  async resolvePrincipal(){return{actor_id:ids.actor,authority_version:7};},
  async resolveProviderAgreement(){throw error;},async resolveCanonicalResource(){throw ordinary;},
  transactionalReaders:{},host:{async execute(){throw new Error('not called');}},
  now(){return Date.parse('2026-11-02T10:00:00Z');}};}
function request(){return{actor_id:ids.actor,authority_version:7,transaction_id:ids.transaction,
  command_id:ids.command,request_id:ids.request,expected_offering_version:4,published_revision_version:2,
  provider_party_id:ids.provider,input:{...input,provider_agreement:{agreement_id:ids.agreement,
    agreement_version:3},resource:null,beneficiary_party_id:ids.beneficiary,
    description:'Controlled non-financial service request',idempotency_key:'service-s01-sqlstate'}};}
function authority(command,attempt=1){return{contract_version:'core-current-authority-decision-receipt.v1',
  receipt_version:1,decision_id:ids.decision,context_id:command.context_id,workspace_id:command.workspace_id,
  actor_id:command.actor_id,authority_version:command.authority_version,permission_code:command.permission_code,
  module_code:command.module_code,evaluation_purpose:command.evaluation_purpose,
  transaction_context:{transaction_id:command.transaction_id,command_id:command.command_id,attempt,
    isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:command.workspace_id,
      aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id,
      acquired_at:'2026-11-02T09:00:00.000Z'}},evaluator:'app_private.check_workspace_native_permission_v2',
  source_disclosure:'status_only',source_reference:null,evaluated_at:'2026-11-02T09:30:00.000Z',
  rechecked_after_lock:true,transaction_bound:true,reusable_as_command_authority:false,
  current_authority_recheck_required_on_retry:true,decision:'allowed',denial_reason:null};}
function scope(){return{transaction_id:ids.transaction,database_transaction_id:'901',workspace_id:ids.workspace,
  tenant_id:ids.tenant,actor_id:ids.actor,attempt:1,async query(){throw new Error('must not query after S01 failure');}};}
const cases=[];async function check(name,fn){try{await fn();cases.push({name,ok:true});}catch(error){cases.push({name,ok:false,error});}}

await check('preflight passes the exact S01 serialization object to its trusted caller',async()=>{
  await assert.rejects(()=>preflightServiceOfferingRequestV1(input,publicPorts(serialization)),error=>error===serialization);
});

await check('validateProviders and validateReplay pass the exact serialization object',async()=>{
  const readers={async resolveProviderAgreement(){throw serialization;},async resolveCanonicalResource(){throw ordinary;}};
  const dispatch=prepareCreateVersionedServiceRequestV1(request(),readers);
  const receipt={receipt_id:id(30),contract_version:'core-transaction-receipt.v2'};
  await assert.rejects(()=>dispatch.providers.validateProviders(scope(),dispatch.command,authority(dispatch.command)),
    error=>error===serialization);
  await assert.rejects(()=>dispatch.providers.validateReplay(scope(),dispatch.command,authority(dispatch.command),receipt),
    error=>error===serialization);
});

await check('ordinary S01 failures remain bounded for preflight, providers and replay',async()=>{
  assert.deepEqual(await preflightServiceOfferingRequestV1(input,publicPorts(ordinary)),
    {status:'not_ready',code:'SERVICE_S01_NOT_READY'});
  const readers={async resolveProviderAgreement(){throw ordinary;},async resolveCanonicalResource(){throw ordinary;}};
  const dispatch=prepareCreateVersionedServiceRequestV1(request(),readers);
  const evidence=await dispatch.providers.validateProviders(scope(),dispatch.command,authority(dispatch.command));
  assert.equal(evidence.decision,'denied');assert.equal(evidence.denial_reason,'PROVIDER_UNAVAILABLE');
  const replay=await dispatch.providers.validateReplay(scope(),dispatch.command,authority(dispatch.command),
    {receipt_id:id(30),contract_version:'core-transaction-receipt.v2'});
  assert.equal(replay.decision,'denied');assert.equal(replay.denial_reason,'PROVIDER_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify({evidence,replay}),/private provider failure/);
});

await check('existing Core host performs exactly three bounded fresh attempts and rolls each back',async()=>{
  const calls=[];let connects=0,providerCalls=0,mutations=0;
  const pool={async connect(){connects+=1;const attempt=connects;return{
    async query(text){calls.push({attempt,text});
      if(text.includes('from platform.customer_workspaces')&&text.includes('for update'))return one({tenant_id:ids.tenant});
      if(text.includes('txid_current()::text as id'))return one({id:String(900+attempt),now:'2026-11-02T09:00:00.000Z'});
      if(text.includes("current_setting('transaction_isolation')"))return one({transaction_id:String(900+attempt),
        actor_id:ids.actor,isolation:'serializable',evaluated_at:'2026-11-02T09:10:00.000Z'});
      if(text.includes('canonical_authority_revision_v1'))return one({revision:'7'});
      if(text.includes('identity.context_grants'))return one({tenant_id:ids.tenant,actor_id:ids.actor,status:'active',current:true});
      if(text.includes('from platform.customer_workspaces')&&!text.includes('for update'))return one({tenant_id:ids.tenant});
      if(text.includes('from platform.module_definitions'))return one({allowed:true,evaluated_at:'2026-11-02T09:20:00.000Z',
        module_definition_id:id(40),entitlement_key:'module.services_orders'});
      if(text.includes('auth.uid()=$1::uuid'))return one({actor_bound:true,allowed:true});
      if(text.includes('from platform.idempotency_keys'))return none();
      return none();
    },release(){calls.push({attempt,text:'release'});}};}};
  const readers={async resolveProviderAgreement(){providerCalls+=1;throw serialization;},
    async resolveCanonicalResource(){throw ordinary;}};
  const dispatch=prepareCreateVersionedServiceRequestV1(request(),readers);
  const wrapped={...dispatch.providers,async mutate(...args){mutations+=1;return dispatch.providers.mutate(...args);}};
  const result=await createCorePostgresTransactionHostV1(pool).execute(dispatch.command,wrapped);
  assert.deepEqual(result,{status:'denied',code:'TRANSACTION_FAILED'});
  assert.equal(connects,3);assert.equal(providerCalls,3);assert.equal(mutations,0);
  assert.equal(calls.filter(x=>x.text==='rollback').length,3);
  assert.equal(calls.some(x=>x.text==='commit'),false);
  assert.equal(calls.some(x=>/^\s*(insert|update|delete)\b/i.test(x.text)),false);
});

const failed=cases.filter(x=>!x.ok);for(const x of cases)console.log(`${x.ok?'PASS':'FAIL'} ${x.name}${x.ok?'':`\n${x.error?.stack??x.error}`}`);
if(failed.length)process.exitCode=1;else console.log(`PASS ${cases.length}/${cases.length} S01 consumer SQLSTATE controls`);
