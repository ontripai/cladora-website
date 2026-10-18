import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
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

const resolver=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url));
const artifactContract=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-v1.ts',import.meta.url));
const authorityPort=load(new URL(
  '../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const id=()=>randomUUID(),hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`
  :value!==null&&typeof value==='object'
    ?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
    :JSON.stringify(value);
const now='2026-10-15T12:00:00.000Z',acquired='2026-10-15T11:59:59.000Z';
const ids={transaction:id(),command:id(),context:id(),workspace:id(),actor:id(),tenant:id(),
  property:id(),module:id(),profile:id(),assignment:id(),binding:id(),receipt:id()};
const command={contract_version:'core-transaction-command.v1',transaction_id:ids.transaction,
  command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:'airprop.asset.read',module_code:'airprop_commercial',
  evaluation_purpose:'airprop.country-pack.resolve',aggregate_type:'portfolio.property',
  aggregate_id:ids.property,aggregate_version:2,provider_source_ids:[ids.property],
  idempotency_key:'jurisdiction-artifact-resolver-contract-01',
  input_fingerprint:`sha256:${hash('jurisdiction-artifact-resolver-contract-01')}`};
const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
  decision_id:id(),context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:command.permission_code,module_code:command.module_code,
  evaluation_purpose:command.evaluation_purpose,transaction_context:{transaction_id:ids.transaction,
    command_id:ids.command,attempt:1,isolation_level:'serializable',lock:{kind:'command_aggregate',
      workspace_id:ids.workspace,aggregate_type:command.aggregate_type,
      aggregate_id:command.aggregate_id,acquired_at:acquired}}};
const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,{
  contract_version:'core-current-authority-observation.v1',
  source_contract:'workspace-native-effective-authority.v2',decision_id:authorityRequest.decision_id,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  permission_code:command.permission_code,module_code:command.module_code,
  transaction_context:authorityRequest.transaction_context,
  evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',
  source_reference:null,actor_status:'current',decision:'allowed',evaluated_at:now,
  entitlement:{contract_version:'core-authority-entitlement-binding.v1',workspace_id:ids.workspace,
    module_definition_id:ids.module,module_code:command.module_code,
    entitlement_key:'module.airprop_commercial',authority_revision:7},
});
const review=seed=>({status:'approved',review_version:1,reviewed_at:'2026-09-01T00:00:00.000Z',
  evidence_sha256:hash(seed)});
const base=domain=>({contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
  profile:{profile_id:ids.profile,profile_code:'de.property.2026',profile_version:1,
    country_code:'DE',manifest_sha256:hash('manifest')},domain,
  effective_from:'2026-01-01T00:00:00.000Z',effective_to:null,status:'active',
  legal_review:review(`${domain.domain_code}:legal`),
  accounting_review:review(`${domain.domain_code}:accounting`),
  reusable_as_command_authority:false});
const domains=[
  {domain_code:'address.structure',domain_version:'address-structure.v1',policy:{
    country_source:'explicit_address_country',forbidden_country_inference_sources:[
      'currency','ip_address','language','locale','phone_number','timezone'],
    ordered_fields:[{field_code:'country_code',required:true,max_length:2},
      {field_code:'postal_code',required:true,max_length:32}],postal_code:{
      value_type:'country_text',required:true,globally_unique:false,normalization:'trim',
      validation:{kind:'country_artifact_grammar',formats:[{segments:[{kind:'digits',length:5}]}]}}}},
  {domain_code:'finance.tax-accounting',domain_version:'finance-tax-accounting.v1',policy:{
    reporting_currency_code:'EUR',accounting_basis_code:'accrual',monetary_rules:[{
      currency_code:'EUR',exponent:2,rounding_mode:'half_even',increment_minor_units:1}],
    tax_rules:[],posting_rules:[]}},
  {domain_code:'documents.retention',domain_version:'documents-retention.v1',policy:{
    document_types:[{document_type_code:'invoice',retention_rule_code:'statutory',
      retention_period:'P10Y',legal_hold_overrides_disposal:true,immutable_version_required:true,
      evidence_codes:['retention.proof']}],disposal_requires_review:true,
    residency_rule_code:'country_storage'}},
  {domain_code:'payments.policy',domain_version:'payments-policy.v1',policy:{currencies:[{
    currency_code:'EUR',exponent:2,rounding_mode:'half_even',increment_minor_units:1}],rails:[{
      rail_code:'country_transfer',status:'active',supported_currency_codes:['EUR'],
      supported_operations:['settle'],settlement:{mode:'same_day',maximum_business_days:0,
        finality_code:'confirmed'},refund:{supported:false,original_rail_required:true,
        maximum_days:null},receipt_invoice:{receipt_required:true,invoice_required:false,
        evidence_codes:['payment.receipt']},regulatory_evidence:{required:true,
        evidence_codes:['payment.regulatory']}}]}},
];
const artifacts=domains.map(domain=>{
  const input=artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse(base(domain));
  const bytes=Buffer.from(canonical(input));
  const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(input);
  assert.equal(hash(bytes),artifactSha);
  return{input,bytes,artifactSha};
});
function rowFor(value=artifacts[0],overrides={}){
  return{receipt_id:ids.receipt,receipt_workspace_id:ids.workspace,
    source_property_id:ids.property,source_transaction_id:ids.transaction,
    source_command_id:ids.command,source_attempt:1,profile_id:ids.profile,
    profile_code:'de.property.2026',profile_version:1,country_code:'DE',
    profile_manifest_sha256:hash('manifest'),artifact_contract_version:'core-jurisdiction-domain-artifact.v1',
    artifact_version:1,domain_code:value.input.domain.domain_code,
    domain_version:value.input.domain.domain_version,artifact_sha256:value.artifactSha,
    canonical_bytes:value.bytes,canonical_bytes_sha256:value.artifactSha,
    effective_from:value.input.effective_from,effective_to:null,lifecycle_status:'active',
    profile_status:'active',profile_valid_from:'2026-01-01',profile_valid_to:null,
    domain_status:'active',domain_valid_from:'2026-01-01',domain_valid_to:null,...overrides};
}
const baseScope={transaction_id:ids.transaction,database_transaction_id:'71',
  workspace_id:ids.workspace,tenant_id:ids.tenant,actor_id:ids.actor,attempt:1};
function scopeFor(rows,options={}){
  const calls=[];
  return{...baseScope,calls,async query(text){
    calls.push(text);
    if(options.throwOn?.test(text))throw options.error;
    if(text.includes('txid_current()'))return{rowCount:1,rows:[{transaction_id:'71',
      actor_id:ids.actor,isolation:'serializable',evaluated_at:now}]};
    if(text.includes('canonical_authority_revision_v1'))return{rowCount:1,
      rows:[{revision:String(options.revision??7)}]};
    if(text.includes('from platform.customer_workspaces w'))return{rowCount:1,rows:[{
      tenant_id:ids.tenant,workspace_status:'ACTIVE',actor_id:ids.actor,membership_status:'active',
      membership_current:true,context_current:true,scope_type:'property',property_id:ids.property,
      building_id:null,unit_id:null}]};
    if(text.includes('check_workspace_native_permission_v2'))return{rowCount:1,rows:[{allowed:true}]};
    if(text.includes('from platform.workspace_property_bindings'))return{rowCount:1,
      rows:[{id:ids.binding}]};
    if(text.includes('from portfolio.properties p join portfolio.addresses'))return{rowCount:1,
      rows:[{status:'active',country_code:'DE'}]};
    if(text.includes('from platform.property_jurisdiction_assignments'))return{rowCount:1,rows:[{
      assignment_id:ids.assignment,assignment_version:'1',assignment_country_code:'DE',
      assignment_manifest_sha256:hash('manifest'),profile_id:ids.profile,
      profile_code:'de.property.2026',profile_version:'1',profile_country_code:'DE',
      default_currency_code:'EUR',default_timezone:'Europe/Berlin',calendar_code:'gregorian',
      profile_manifest_sha256:hash('manifest'),legal_signed:true,accounting_signed:true}]};
    if(text.includes('from platform.jurisdiction_profile_domains d')){
      const value=options.currentValue??artifacts[0];return{rowCount:1,rows:[{
        domain_code:value.input.domain.domain_code,
        contract_version:value.input.domain.domain_version,artifact_sha256:value.artifactSha}]};
    }
    if(text.includes('from platform.jurisdiction_domain_artifact_receipt_evidence'))
      return{rowCount:rows.length,rows};
    if(text.includes('from platform.jurisdiction_domain_artifacts a'))
      return{rowCount:rows.length,rows};
    throw new Error(`unexpected resolver query: ${text}`);
  }};
}
const bindingFields={transaction_id:ids.transaction,command_id:ids.command,attempt:1,
  context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  provider_source_ids:[ids.property],lock:{kind:'command_aggregate',
    aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id}};
const currentRequestFor=value=>({
  contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,mode:'current',
  ...bindingFields,property_id:ids.property,expected_country_code:'DE',
  domain_code:value.input.domain.domain_code,domain_version:value.input.domain.domain_version});
const historicalRequestFor=value=>({
  contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
  mode:'historical',...bindingFields,committed_evidence:{
    contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1,
    receipt_id:ids.receipt,source_workspace_id:ids.workspace,source_property_id:ids.property,
    source_actor_id:ids.actor,source_transaction_id:ids.transaction,source_command_id:ids.command,
    source_attempt:1,reference:{profile_id:ids.profile,
      profile_code:'de.property.2026',profile_version:1,country_code:'DE',
      profile_manifest_sha256:hash('manifest'),domain_code:value.input.domain.domain_code,
      domain_version:value.input.domain.domain_version,artifact_sha256:value.artifactSha,
      effective_at:now}}});
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

await check('all four domains require exact committed evidence and current disclosure authority',async()=>{
  for(const value of artifacts){
    const scoped=scopeFor([rowFor(value)],{currentValue:value});
    const result=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
      scoped,command,authority,historicalRequestFor(value));
    assert.equal(result.decision,'accepted',JSON.stringify(result));
    assert.equal(result.artifact.domain.domain_code,value.input.domain.domain_code);
    assert.equal(result.fingerprint.artifact_sha256,value.artifactSha);
    assert.equal(result.reusable_as_command_authority,false);
    assert.ok(scoped.calls.every(sql=>/^select\b/i.test(sql.trim())));
  }
});

await check('current resolver invokes canonical selector internally in the same scope',async()=>{
  const value=artifacts[0],scoped=scopeFor([rowFor(value)],{currentValue:value});
  const result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
    scoped,command,authority,currentRequestFor(value));
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.ok(scoped.calls.some(sql=>sql.includes('property_jurisdiction_assignments')));
  assert.match(scoped.calls.at(-1),/for share of a,p,d/i);
  const injected=await resolver.resolveCurrentJurisdictionDomainArtifactV1(scoped,command,authority,
    {...currentRequestFor(value),selection:{decision:'accepted'}});
  assert.equal(injected.denial_reason,'BINDING_MISMATCH');
  const candidate=resolver.toCoreJurisdictionDomainArtifactCommitCandidateV1(result,ids.property);
  assert.equal(candidate.contract_version,
    'core-jurisdiction-domain-artifact-commit-candidate.v1');
  assert.equal(candidate.resolver_decision_id,result.decision_id);
  assert.equal(candidate.property_id,ids.property);
  assert.equal(candidate.fingerprint.artifact_sha256,value.artifactSha);
  assert.equal(candidate.reusable_as_command_authority,false);
});

await check('binding mismatch and revoked current authority fail before evidence reads',async()=>{
  const value=artifacts[0],noQuery={...baseScope,query(){throw new Error('must not query');}};
  for(const changed of [
    {...currentRequestFor(value),command_id:id()},
    {...currentRequestFor(value),workspace_id:id()},
    {...currentRequestFor(value),provider_source_ids:[]},
  ]){
    const result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
      noQuery,command,authority,changed);
    assert.equal(result.denial_reason,'BINDING_MISMATCH');
  }
  const denied=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(noQuery,command,
    {...authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},historicalRequestFor(value));
  assert.equal(denied.denial_reason,'AUTHORITY_DENIED');
});

await check('fabricated, absent and mismatched historical receipts fail closed',async()=>{
  const value=artifacts[0];
  for(const request of [
    historicalRequestFor(value),
    {...historicalRequestFor(value),committed_evidence:{...historicalRequestFor(value).committed_evidence,
      receipt_id:id()}},
    {...historicalRequestFor(value),committed_evidence:{...historicalRequestFor(value).committed_evidence,
      source_property_id:id()}},
  ]){
    const result=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
      scopeFor([]),command,authority,request);
    assert.ok(['HISTORICAL_RECEIPT_UNAVAILABLE','BINDING_MISMATCH'].includes(result.denial_reason));
  }
  const raw={contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
    mode:'historical',reference:historicalRequestFor(value).committed_evidence.reference};
  const rawResult=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([]),command,authority,raw);
  assert.equal(rawResult.denial_reason,'BINDING_MISMATCH');
});

await check('stale authority and invalid canonical bytes are bounded denials',async()=>{
  const value=artifacts[0];
  const stale=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([rowFor(value)],{revision:8}),command,authority,historicalRequestFor(value));
  assert.equal(stale.denial_reason,'STALE_AUTHORITY');
  for(const [row,reason] of [
    [rowFor(value,{canonical_bytes:null}),'ARTIFACT_BYTES_MISSING'],
    [rowFor(value,{canonical_bytes:Buffer.from('tampered')}),'ARTIFACT_HASH_MISMATCH'],
    [rowFor(value,{canonical_bytes:Buffer.from('{}'),canonical_bytes_sha256:hash('{}'),
      artifact_sha256:hash('{}')}),'ARTIFACT_SCHEMA_UNSUPPORTED'],
  ]){
    const request=historicalRequestFor(value);
    request.committed_evidence.reference.artifact_sha256=row.artifact_sha256;
    const result=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
      scopeFor([row]),command,authority,request);
    assert.equal(result.denial_reason,reason);
  }
});

await check('real serialization errors propagate and other failures are bounded',async()=>{
  const value=artifacts[0],serialization=Object.assign(new Error('retry'),{code:'40001'});
  await assert.rejects(()=>resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([],{throwOn:/receipt_evidence/,error:serialization}),command,authority,
    historicalRequestFor(value)),error=>error===serialization);
  const unavailable=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([],{throwOn:/receipt_evidence/,error:new Error('unavailable')}),command,authority,
    historicalRequestFor(value));
  assert.equal(unavailable.denial_reason,'PROVIDER_UNAVAILABLE');
});

await check('resolver stays SELECT-only and prior migrations remain byte-identical',async()=>{
  const source=readFileSync(new URL(
    '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url),'utf8');
  const hostSource=readFileSync(new URL(
    '../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url),'utf8');
  const migrationSource=readFileSync(new URL(
    '../supabase/migrations/20261015203723_core_jurisdiction_domain_artifact_resolver_v1.sql',
    import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:insert\s+into|update\s+[a-z]|delete\s+from|grant\s+|create\s+table)\b/i);
  assert.match(source,/selectCurrentPropertyJurisdictionProfileV1/);
  assert.match(source,/jurisdiction_domain_artifact_receipt_evidence/);
  assert.match(hostSource,/core-jurisdiction-domain-artifact-host-projection\.v1/);
  assert.match(hostSource,/jurisdiction_artifacts: jurisdictionArtifacts/);
  assert.match(hostSource,/source_idempotency_key,source_receipt_contract_version/);
  assert.match(migrationSource,/deferrable initially deferred/);
  assert.match(migrationSource,/jurisdiction_domain_artifact_receipt_projection_incomplete/);
  assert.match(migrationSource,/primary key\(receipt_id,artifact_ordinal\)/);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const previous=readdirSync(directory).filter(name=>name.endsWith('.sql')
    && name<'20261015203723_core_jurisdiction_domain_artifact_resolver_v1.sql').sort();
  const tree=createHash('sha256');
  for(const name of previous){tree.update(name);tree.update(Buffer.from([0]));
    tree.update(createHash('sha256').update(readFileSync(new URL(name,directory))).digest());}
  assert.equal(previous.length,263);
  assert.equal(tree.digest('hex'),'3671b99d4bcdf7875975dfbae0d288dd552bfb55e2362525efe94ce44fc2ae61');
});

console.log(`Core jurisdiction domain artifact resolver contract: ${checks}/${checks} PASS`);
