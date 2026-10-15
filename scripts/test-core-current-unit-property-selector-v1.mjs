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

const selector=load(new URL('../src/lib/core/current-unit-property-selector-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const ids={transaction:randomUUID(),command:randomUUID(),context:randomUUID(),workspace:randomUUID(),
  actor:randomUUID(),tenant:randomUUID(),property:randomUUID(),building:randomUUID(),unit:randomUUID(),
  decision:randomUUID(),module:randomUUID(),binding:randomUUID()};
const acquiredAt=new Date(Date.now()-1000).toISOString(),evaluatedAt=new Date().toISOString();
const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
  decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:'airprop.asset.read',module_code:'airprop_commercial',
  evaluation_purpose:'airprop.current-unit-property.select',transaction_context:{
    transaction_id:ids.transaction,command_id:ids.command,attempt:1,isolation_level:'serializable',
    lock:{kind:'command_aggregate',workspace_id:ids.workspace,aggregate_type:'portfolio.unit',
      aggregate_id:ids.unit,acquired_at:acquiredAt}}};
const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,{
  contract_version:'core-current-authority-observation.v1',
  source_contract:'workspace-native-effective-authority.v2',decision_id:ids.decision,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  permission_code:'airprop.asset.read',module_code:'airprop_commercial',
  transaction_context:authorityRequest.transaction_context,
  evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',
  source_reference:null,actor_status:'current',decision:'allowed',evaluated_at:evaluatedAt,
  entitlement:{contract_version:'core-authority-entitlement-binding.v1',workspace_id:ids.workspace,
    module_definition_id:ids.module,module_code:'airprop_commercial',
    entitlement_key:'module.airprop_commercial',authority_revision:7},
});
const request={contract_version:selector.CORE_CURRENT_UNIT_PROPERTY_SELECTOR_REQUEST_V1,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  property_id:ids.property,unit_id:ids.unit};
const scope={transaction_id:ids.transaction,database_transaction_id:'41',workspace_id:ids.workspace,
  tenant_id:ids.tenant,actor_id:ids.actor,attempt:1};
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

await check('accepted decision binds current transaction authority and bounded unit metadata',async()=>{
  const calls=[];
  const result=await selector.selectCurrentUnitPropertyV1({...scope,async query(text){
    calls.push(text);
    if(text.includes('txid_current()'))return{rowCount:1,rows:[{transaction_id:'41',actor_id:ids.actor,
      isolation:'serializable',evaluated_at:evaluatedAt}]};
    if(text.includes('canonical_authority_revision_v1'))return{rowCount:1,rows:[{revision:'7'}]};
    if(text.includes('from platform.customer_workspaces w'))return{rowCount:1,rows:[{
      tenant_id:ids.tenant,workspace_status:'ACTIVE',actor_id:ids.actor,membership_status:'active',
      membership_current:true,context_current:true,scope_type:'tenant',property_id:null,
      building_id:null,unit_id:null}]};
    if(text.includes('check_workspace_native_permission_v2'))return{rowCount:1,rows:[{allowed:true}]};
    if(text.includes('workspace_property_bindings'))return{rowCount:1,rows:[{id:ids.binding}]};
    if(text.includes('from portfolio.properties p where'))return{rowCount:1,rows:[{status:'active'}]};
    if(text.includes('from portfolio.units u'))return{rowCount:1,rows:[{unit_status:'active',
      building_status:'active',property_status:'active',building_id:ids.building,
      property_id:ids.property}]};
    throw new Error(`unexpected selector query: ${text}`);
  }},authority,request);
  assert.equal(result.decision,'accepted');
  assert.equal(selector.currentUnitPropertySelectorDecisionV1Schema.safeParse(result).success,true);
  assert.deepEqual(result.binding,{context_id:ids.context,workspace_id:ids.workspace,
    actor_id:ids.actor,authority_version:7,property_id:ids.property,property_lifecycle:'active',
    unit_id:ids.unit,unit_lifecycle:'active',current_unit_to_property:true});
  assert.equal(result.source_disclosure,'status_only');assert.equal(result.source_reference,null);
  assert.equal(result.reusable_as_command_authority,false);
  assert.ok(calls.every(sql=>/^select\b/i.test(sql.trim())));
});

await check('NULL, cross-Workspace and historical transaction receipts fail before SQL',async()=>{
  const noQuery={...scope,query(){throw new Error('must not query');}};
  for(const [changedRequest,changedAuthority] of [
    [{...request,unit_id:null},authority],
    [{...request,workspace_id:randomUUID()},authority],
    [request,{...authority,transaction_context:{...authority.transaction_context,transaction_id:randomUUID()}}],
    [{...request,authority_version:8},authority],
  ]){
    const result=await selector.selectCurrentUnitPropertyV1(noQuery,changedAuthority,changedRequest);
    assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
    assert.equal(result.binding,null);
  }
});

await check('revoked or denied same-transaction authority is bounded and zero-query',async()=>{
  const result=await selector.selectCurrentUnitPropertyV1(
    {...scope,query(){throw new Error('must not query');}},
    {...authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},request);
  assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'AUTHORITY_DENIED');
  assert.equal(result.binding,null);assert.ok(!('authority' in result));
});

await check('serialization failure propagates and source contains no write or AIRPROP coupling',async()=>{
  const serialization=Object.assign(new Error('retry'),{code:'40001'});
  await assert.rejects(()=>selector.selectCurrentUnitPropertyV1(
    {...scope,query:async()=>{throw serialization;}},authority,request),error=>error===serialization);
  const source=readFileSync(new URL(
    '../src/lib/core/current-unit-property-selector-v1.ts',import.meta.url),'utf8');
  assert.match(source,/CoreTransactionScopeV1/);
  assert.doesNotMatch(source,/src\/lib\/airprop|from ['"].*airprop|createCorePostgresTransactionHostV1/);
  assert.doesNotMatch(source,/\b(?:insert|update|delete)\b[\s\S]{0,20}\b(?:portfolio|platform|identity|audit)\b/i);
  assert.doesNotMatch(source,/idempotency_keys|outbox_events|audit\.events/);
});

console.log(`Core current unit/property selector contract: ${checks}/${checks} PASS`);
