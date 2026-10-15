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
  property:id(),module:id(),profile:id(),assignment:id()};
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
  return{input,bytes,artifactSha,artifact:{...input,artifact_sha256:artifactSha}};
});

function rowFor(value=artifacts[0],overrides={}){
  return{profile_id:ids.profile,profile_code:'de.property.2026',profile_version:1,
    country_code:'DE',profile_manifest_sha256:hash('manifest'),
    artifact_contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    domain_code:value.input.domain.domain_code,domain_version:value.input.domain.domain_version,
    artifact_sha256:value.artifactSha,canonical_bytes:value.bytes,
    canonical_bytes_sha256:value.artifactSha,effective_from:value.input.effective_from,
    effective_to:null,lifecycle_status:'active',profile_status:'active',
    profile_valid_from:'2026-01-01',profile_valid_to:null,domain_status:'active',
    domain_valid_from:'2026-01-01',domain_valid_to:null,...overrides};
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
    if(text.includes('from platform.jurisdiction_domain_artifacts'))return{rowCount:rows.length,rows};
    throw new Error(`unexpected resolver query: ${text}`);
  }};
}
const selectionFor=value=>({contract_version:'core-jurisdiction-profile-selector-decision.v1',
  selector_version:1,decision_id:id(),decision:'accepted',denial_reason:null,binding:{
    context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
    property_id:ids.property,assignment_id:ids.assignment,assignment_version:1,
    profile_id:ids.profile,profile_code:'de.property.2026',profile_version:1,country_code:'DE',
    default_currency_code:'EUR',default_timezone:'Europe/Berlin',calendar_code:'gregorian',
    profile_manifest_sha256:hash('manifest'),domains:[{domain_code:value.input.domain.domain_code,
      contract_version:value.input.domain.domain_version,artifact_sha256:value.artifactSha}]},
  evaluated_at:now,source_disclosure:'status_only',source_reference:null,
  reusable_as_command_authority:false});
const currentRequestFor=value=>({
  contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,mode:'current',
  transaction_id:ids.transaction,command_id:ids.command,attempt:1,context_id:ids.context,
  workspace_id:ids.workspace,actor_id:ids.actor,authority_version:7,
  provider_source_ids:[ids.property],lock:{kind:'command_aggregate',
    aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id},
  domain_code:value.input.domain.domain_code,domain_version:value.input.domain.domain_version,
  effective_at:now});
const historicalRequestFor=value=>({
  contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
  mode:'historical',reference:{profile_id:ids.profile,profile_code:'de.property.2026',
    profile_version:1,country_code:'DE',profile_manifest_sha256:hash('manifest'),
    domain_code:value.input.domain.domain_code,domain_version:value.input.domain.domain_version,
    artifact_sha256:value.artifactSha,effective_at:now}});
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

await check('all four official domain schemas resolve exact immutable historical bytes',async()=>{
  for(const value of artifacts){
    const scoped=scopeFor([rowFor(value)]);
    const result=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
      scoped,historicalRequestFor(value));
    assert.equal(result.decision,'accepted',JSON.stringify(result));
    assert.equal(result.artifact.domain.domain_code,value.input.domain.domain_code);
    assert.equal(result.fingerprint.artifact_sha256,value.artifactSha);
    assert.equal(result.source_disclosure,'bounded_artifact');
    assert.equal(result.source_reference,null);
    assert.equal(result.reusable_as_command_authority,false);
    assert.ok(scoped.calls.every(sql=>/^select\b/i.test(sql.trim())));
  }
});

await check('current resolution exact-matches command, authority, selector and source locks',async()=>{
  const value=artifacts[0],scoped=scopeFor([rowFor(value)]);
  const result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(scoped,command,authority,
    selectionFor(value),currentRequestFor(value));
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.equal(result.artifact.artifact_sha256,value.artifactSha);
  assert.match(scoped.calls.at(-1),/for share of a,p,d/i);
});

await check('binding mismatches and denied authority fail before artifact reads',async()=>{
  const value=artifacts[0],noQuery={...baseScope,query(){throw new Error('must not query');}};
  for(const changed of [
    {...currentRequestFor(value),command_id:id()},
    {...currentRequestFor(value),workspace_id:id()},
    {...currentRequestFor(value),provider_source_ids:[]},
    {...currentRequestFor(value),lock:{kind:'command_aggregate',aggregate_type:'portfolio.unit',
      aggregate_id:ids.property}},
  ]){
    const result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
      noQuery,command,authority,selectionFor(value),changed);
    assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
  }
  const denied=await resolver.resolveCurrentJurisdictionDomainArtifactV1(noQuery,command,
    {...authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},selectionFor(value),
    currentRequestFor(value));
  assert.equal(denied.decision,'denied');assert.equal(denied.denial_reason,'AUTHORITY_DENIED');
});

await check('stale revision, inactive artifact and unavailable review are bounded denials',async()=>{
  const value=artifacts[0];
  let result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
    scopeFor([rowFor(value)],{revision:8}),command,authority,selectionFor(value),
    currentRequestFor(value));
  assert.equal(result.denial_reason,'STALE_AUTHORITY');
  const suspended={...value.input,status:'suspended'};
  const suspendedBytes=Buffer.from(canonical(suspended)),suspendedHash=hash(suspendedBytes);
  const suspendedValue={input:suspended,bytes:suspendedBytes,artifactSha:suspendedHash};
  result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
    scopeFor([rowFor(suspendedValue,{lifecycle_status:'suspended'})]),command,authority,
    selectionFor(suspendedValue),currentRequestFor(suspendedValue));
  assert.equal(result.denial_reason,'ARTIFACT_INACTIVE');
  const pending={...value.input,legal_review:{status:'pending',review_version:1,
    reviewed_at:null,evidence_sha256:null}};
  const pendingBytes=Buffer.from(canonical(pending)),pendingHash=hash(pendingBytes);
  const pendingValue={input:pending,bytes:pendingBytes,artifactSha:pendingHash};
  result=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
    scopeFor([rowFor(pendingValue)]),command,authority,selectionFor(pendingValue),
    currentRequestFor(pendingValue));
  assert.equal(result.denial_reason,'REVIEW_UNAVAILABLE');
});

await check('historical lookup never upgrades missing v1 to an available v2 artifact',async()=>{
  const value=artifacts[0];
  const missing=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([]),historicalRequestFor(value));
  assert.equal(missing.denial_reason,'ARTIFACT_UNAVAILABLE');
  const ambiguous=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([rowFor(value),rowFor(value)]),historicalRequestFor(value));
  assert.equal(ambiguous.denial_reason,'ARTIFACT_AMBIGUOUS');
});

await check('missing, tampered and unknown canonical bytes fail closed',async()=>{
  const value=artifacts[0];
  const cases=[
    [rowFor(value,{canonical_bytes:null}),'ARTIFACT_BYTES_MISSING'],
    [rowFor(value,{canonical_bytes:Buffer.from('tampered')}),'ARTIFACT_HASH_MISMATCH'],
    [rowFor(value,{canonical_bytes:Buffer.from('{}'),canonical_bytes_sha256:hash('{}'),
      artifact_sha256:hash('{}')}),'ARTIFACT_SCHEMA_UNSUPPORTED'],
  ];
  for(const [row,reason] of cases){
    const request={...historicalRequestFor(value),reference:{...historicalRequestFor(value).reference,
      artifact_sha256:row.artifact_sha256}};
    const result=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(scopeFor([row]),request);
    assert.equal(result.denial_reason,reason);
  }
});

await check('real serialization errors propagate and all other provider failures are bounded',async()=>{
  const value=artifacts[0],serialization=Object.assign(new Error('retry'),{code:'40001'});
  await assert.rejects(()=>resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([],{throwOn:/jurisdiction_domain_artifacts/,error:serialization}),
    historicalRequestFor(value)),error=>error===serialization);
  const unavailable=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(
    scopeFor([],{throwOn:/jurisdiction_domain_artifacts/,error:new Error('unavailable')}),
    historicalRequestFor(value));
  assert.equal(unavailable.denial_reason,'PROVIDER_UNAVAILABLE');
});

await check('resolver is SELECT-only and does not create a parallel consumer store',async()=>{
  const source=readFileSync(new URL(
    '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:insert\s+into|update\s+[a-z]|delete\s+from|grant\s+|create\s+table)\b/i);
  assert.doesNotMatch(source,/src\/lib\/(?:community|services|documents)/i);
  assert.match(source,/CoreTransactionScopeV1/);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const previous=readdirSync(directory).filter(name=>name.endsWith('.sql')
    && name!=='20261015203723_core_jurisdiction_domain_artifact_resolver_v1.sql').sort();
  const tree=createHash('sha256');
  for(const name of previous){
    tree.update(name);tree.update(Buffer.from([0]));
    tree.update(createHash('sha256').update(readFileSync(new URL(name,directory))).digest());
  }
  assert.equal(previous.length,259);
  assert.equal(tree.digest('hex'),'535388f88ae02693bfbaa88385af8e7db9c89846709243eb67415fa093dc59de');
});

console.log(`Core jurisdiction domain artifact resolver contract: ${checks}/${checks} PASS`);
