import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url),cache=new Map();
function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }});
  const mod={exports:{}};cache.set(url.href,mod.exports);
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  return mod.exports;
}

const selector=load(new URL('../src/lib/core/jurisdiction-profile-selector-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const ids={transaction:randomUUID(),command:randomUUID(),context:randomUUID(),workspace:randomUUID(),
  actor:randomUUID(),tenant:randomUUID(),property:randomUUID(),aggregate:randomUUID(),
  decision:randomUUID(),module:randomUUID(),assignment:randomUUID(),profile:randomUUID(),
  binding:randomUUID()};
const acquiredAt=new Date(Date.now()-1000).toISOString(),evaluatedAt=new Date().toISOString();
const command={contract_version:'core-transaction-command.v1',transaction_id:ids.transaction,
  command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:'payments.obligations.read',module_code:'payments',
  evaluation_purpose:'payments.country-pack.select',aggregate_type:'payment.obligation',
  aggregate_id:ids.aggregate,aggregate_version:3,provider_source_ids:[ids.property],
  idempotency_key:'jurisdiction-selector-contract-01',
  input_fingerprint:`sha256:${'1'.repeat(64)}`};
const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
  decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:command.permission_code,module_code:command.module_code,
  evaluation_purpose:command.evaluation_purpose,transaction_context:{transaction_id:ids.transaction,
    command_id:ids.command,attempt:1,isolation_level:'serializable',lock:{kind:'command_aggregate',
      workspace_id:ids.workspace,aggregate_type:command.aggregate_type,
      aggregate_id:ids.aggregate,acquired_at:acquiredAt}}};
const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,{
  contract_version:'core-current-authority-observation.v1',
  source_contract:'workspace-native-effective-authority.v2',decision_id:ids.decision,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  permission_code:command.permission_code,module_code:command.module_code,
  transaction_context:authorityRequest.transaction_context,
  evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',
  source_reference:null,actor_status:'current',decision:'allowed',evaluated_at:evaluatedAt,
  entitlement:{contract_version:'core-authority-entitlement-binding.v1',workspace_id:ids.workspace,
    module_definition_id:ids.module,module_code:command.module_code,
    entitlement_key:'module.payments',authority_revision:7},
});
const request={contract_version:selector.CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1,
  property_id:ids.property,expected_country_code:'DE',
  required_domain_codes:['accounting.invoice','payments.local_rails','tax.vat']};
const scope={transaction_id:ids.transaction,database_transaction_id:'51',workspace_id:ids.workspace,
  tenant_id:ids.tenant,actor_id:ids.actor,attempt:1};
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

function fakeScope(overrides={}){
  const calls=[];
  return {...scope,calls,async query(text){
    calls.push(text);
    if(overrides.throwOn?.test(text))throw overrides.error;
    if(text.includes('txid_current()'))return{rowCount:1,rows:[{transaction_id:'51',actor_id:ids.actor,
      isolation:'serializable',evaluated_at:evaluatedAt}]};
    if(text.includes('canonical_authority_revision_v1'))return{rowCount:1,rows:[{revision:'7'}]};
    if(text.includes('from platform.customer_workspaces w'))return{rowCount:1,rows:[{
      tenant_id:ids.tenant,workspace_status:'ACTIVE',actor_id:ids.actor,membership_status:'active',
      membership_current:true,context_current:true,scope_type:'tenant',property_id:null,
      building_id:null,unit_id:null}]};
    if(text.includes('check_workspace_native_permission_v2'))return{rowCount:1,rows:[{allowed:true}]};
    if(text.includes('workspace_property_bindings'))return{rowCount:1,rows:[{id:ids.binding}]};
    if(text.includes('from portfolio.properties p join portfolio.addresses'))return{rowCount:1,
      rows:[{status:'active',country_code:overrides.country??'DE'}]};
    if(text.includes('from platform.property_jurisdiction_assignments'))return{rowCount:1,rows:[{
      assignment_id:ids.assignment,assignment_version:'4',assignment_country_code:'DE',
      assignment_manifest_sha256:'a'.repeat(64),profile_id:ids.profile,
      profile_code:'de.property.2026',profile_version:'2',profile_country_code:'DE',
      default_currency_code:'EUR',default_timezone:'Europe/Berlin',calendar_code:'gregorian',
      profile_manifest_sha256:'a'.repeat(64),legal_signed:true,accounting_signed:true}]};
    if(text.includes('from platform.jurisdiction_profile_domains')){
      const rows=[
        {domain_code:'accounting.invoice',contract_version:'de.invoice.v1',artifact_sha256:'b'.repeat(64)},
        {domain_code:'payments.local_rails',contract_version:'sepa.credit.v1',artifact_sha256:'c'.repeat(64)},
        {domain_code:'tax.vat',contract_version:'de.vat.v1',artifact_sha256:'d'.repeat(64)},
      ];
      return{rowCount:overrides.missingDomain?2:3,rows:overrides.missingDomain?rows.slice(0,2):rows};
    }
    throw new Error(`unexpected selector query: ${text}`);
  }};
}

await check('current signed profile and exact requested domains are returned as bounded metadata',async()=>{
  const scoped=fakeScope();
  const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
    scoped,command,authority,request);
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.equal(selector.jurisdictionProfileSelectorDecisionV1Schema.safeParse(result).success,true);
  assert.equal(result.binding.country_code,'DE');assert.equal(result.binding.default_currency_code,'EUR');
  assert.deepEqual(result.binding.domains.map(value=>value.domain_code),request.required_domain_codes);
  assert.equal(result.source_disclosure,'status_only');
  assert.equal(result.reusable_as_command_authority,false);
  assert.ok(scoped.calls.every(sql=>/^select\b/i.test(sql.trim())));
});

await check('property source lock, command, authority and entitlement mismatches are zero-query denials',async()=>{
  const noQuery={...scope,query(){throw new Error('must not query');}};
  const cases=[
    [{...command,provider_source_ids:[]},authority],
    [{...command,transaction_id:randomUUID()},authority],
    [command,{...authority,permission_code:'airprop.asset.read'}],
    [command,{...authority,transaction_context:{...authority.transaction_context,
      command_id:randomUUID()}}],
    [command,{...authority,entitlement:{...authority.entitlement,module_code:'airprop_commercial'}}],
  ];
  for(const [changedCommand,changedAuthority] of cases){
    const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
      noQuery,changedCommand,changedAuthority,request);
    assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
  }
});

await check('country is explicit and domain requests are canonical, unique and bounded',async()=>{
  const wrongCountry=await selector.selectCurrentPropertyJurisdictionProfileV1(
    fakeScope({country:'IR'}),command,authority,request);
  assert.equal(wrongCountry.decision,'denied');
  assert.equal(wrongCountry.denial_reason,'CURRENT_PROPERTY_DENIED');
  for(const required_domain_codes of [
    ['tax.vat','accounting.invoice'],['tax.vat','tax.vat'],[],Array(33).fill('tax.vat'),
  ]){
    const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
      {...scope,query(){throw new Error('must not query');}},command,authority,
      {...request,required_domain_codes});
    assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
  }
});

await check('a missing country-specific payment or compliance domain fails closed',async()=>{
  const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
    fakeScope({missingDomain:true}),command,authority,request);
  assert.equal(result.decision,'denied');
  assert.equal(result.denial_reason,'REQUIRED_DOMAIN_UNAVAILABLE');
  assert.equal(result.binding,null);
});

await check('denied authority is bounded and does not disclose profile metadata',async()=>{
  const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
    {...scope,query(){throw new Error('must not query');}},command,
    {...authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},request);
  assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'AUTHORITY_DENIED');
  assert.equal(result.binding,null);assert.ok(!('authority' in result));
});

await check('real serialization failures propagate and source has no write or country hardcode',async()=>{
  const serialization=Object.assign(new Error('retry'),{code:'40001'});
  await assert.rejects(()=>selector.selectCurrentPropertyJurisdictionProfileV1(
    fakeScope({throwOn:/txid_current/,error:serialization}),command,authority,request),
  error=>error===serialization);
  const source=readFileSync(new URL(
    '../src/lib/core/jurisdiction-profile-selector-v1.ts',import.meta.url),'utf8');
  assert.match(source,/CoreTransactionScopeV1/);
  assert.doesNotMatch(source,/\b(?:insert|update|delete)\b[\s\S]{0,20}\b(?:portfolio|platform|identity|audit)\b/i);
  assert.doesNotMatch(source,/idempotency_keys|outbox_events|audit\.events/);
  assert.doesNotMatch(source,/country_code\s*=\s*['"](?:RO|IR|DE|US)['"]/);
});

console.log(`Core jurisdiction profile selector contract: ${checks}/${checks} PASS`);
