import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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

const composition=load(new URL(
  '../src/lib/customer/documents-country-retention-resolution-v1.ts',import.meta.url));
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
const now='2026-10-16T12:00:00.000Z',acquired='2026-10-16T11:59:59.000Z';
const ids={transaction:id(),command:id(),context:id(),workspace:id(),otherWorkspace:id(),actor:id(),
  tenant:id(),property:id(),module:id(),oldProfile:id(),currentProfile:id(),assignment:id(),
  binding:id(),receipt:id()};
const command={contract_version:'core-transaction-command.v1',transaction_id:ids.transaction,
  command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:7,permission_code:'documents.retention.read',module_code:'documents_vault',
  evaluation_purpose:'documents.country-retention.resolve',aggregate_type:'portfolio.property',
  aggregate_id:ids.property,aggregate_version:2,provider_source_ids:[ids.property],
  idempotency_key:'documents-retention-resolution-contract-01',
  input_fingerprint:`sha256:${hash('documents-retention-resolution-contract-01')}`};
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
    entitlement_key:'module.documents_vault',authority_revision:7},
});
const review=seed=>({status:'approved',review_version:1,reviewed_at:'2026-09-01T00:00:00.000Z',
  evidence_sha256:hash(seed)});
function artifactFor(profileId,profileVersion,ruleCode,period){
  const input=artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse({
    contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    profile:{profile_id:profileId,profile_code:`de.property.2026.v${profileVersion}`,
      profile_version:profileVersion,country_code:'DE',manifest_sha256:hash(`manifest-${profileVersion}`)},
    domain:{domain_code:'documents.retention',domain_version:'documents-retention.v1',policy:{
      document_types:[{document_type_code:'invoice',retention_rule_code:ruleCode,
        retention_period:period,legal_hold_overrides_disposal:true,immutable_version_required:true,
        evidence_codes:['retention.proof']}],disposal_requires_review:true,
      residency_rule_code:'country_storage'}},
    effective_from:profileVersion===1?'2026-01-01T00:00:00.000Z':'2026-10-01T00:00:00.000Z',
    effective_to:null,status:'active',legal_review:review(`${profileVersion}:legal`),
    accounting_review:review(`${profileVersion}:accounting`),reusable_as_command_authority:false,
  });
  const bytes=Buffer.from(canonical(input));
  const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(input);
  assert.equal(hash(bytes),artifactSha);
  return{input,bytes,artifactSha};
}
const historicalArtifact=artifactFor(ids.oldProfile,1,'historical_statutory','P10Y');
const currentArtifact=artifactFor(ids.currentProfile,2,'current_statutory','P12Y');
function rowFor(value,overrides={}){
  return{receipt_id:ids.receipt,receipt_workspace_id:ids.workspace,
    source_property_id:ids.property,source_transaction_id:ids.transaction,
    source_command_id:ids.command,source_attempt:1,profile_id:value.input.profile.profile_id,
    profile_code:value.input.profile.profile_code,profile_version:value.input.profile.profile_version,
    country_code:'DE',profile_manifest_sha256:value.input.profile.manifest_sha256,
    artifact_contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    domain_code:'documents.retention',domain_version:'documents-retention.v1',
    artifact_sha256:value.artifactSha,canonical_bytes:value.bytes,
    canonical_bytes_sha256:value.artifactSha,effective_from:value.input.effective_from,
    effective_to:null,lifecycle_status:'active',profile_status:'active',
    profile_valid_from:'2026-01-01',profile_valid_to:null,domain_status:'active',
    domain_valid_from:'2026-01-01',domain_valid_to:null,...overrides};
}
const baseScope={transaction_id:ids.transaction,database_transaction_id:'81',
  workspace_id:ids.workspace,tenant_id:ids.tenant,actor_id:ids.actor,attempt:1};
function scopeFor(rows,options={}){
  const calls=[];
  return{...baseScope,calls,async query(text){
    calls.push(text);
    if(options.throwOn?.test(text))throw options.error;
    if(text.includes('txid_current()'))return{rowCount:1,rows:[{transaction_id:'81',
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
      assignment_id:ids.assignment,assignment_version:'2',assignment_country_code:'DE',
      assignment_manifest_sha256:currentArtifact.input.profile.manifest_sha256,
      profile_id:ids.currentProfile,profile_code:currentArtifact.input.profile.profile_code,
      profile_version:'2',profile_country_code:'DE',default_currency_code:'EUR',
      default_timezone:'Europe/Berlin',calendar_code:'gregorian',
      profile_manifest_sha256:currentArtifact.input.profile.manifest_sha256,
      legal_signed:true,accounting_signed:true}]};
    if(text.includes('from platform.jurisdiction_profile_domains d'))return{rowCount:1,rows:[{
      domain_code:'documents.retention',contract_version:'documents-retention.v1',
      artifact_sha256:currentArtifact.artifactSha}]};
    if(text.includes('from platform.jurisdiction_domain_artifact_receipt_evidence'))
      return{rowCount:rows.length,rows};
    if(text.includes('from platform.jurisdiction_domain_artifacts a'))
      return{rowCount:rows.length,rows};
    throw new Error(`unexpected resolver query: ${text}`);
  }};
}
const currentRequest={contract_version:composition.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
  mode:'current',property_id:ids.property,expected_country_code:'DE',document_type_code:'invoice',
  document_immutable_version:4,legal_hold_state:'none',requested_operation:'read-policy'};
const committedEvidence={contract_version:'core-jurisdiction-domain-artifact-committed-evidence.v1',
  receipt_id:ids.receipt,source_workspace_id:ids.workspace,source_property_id:ids.property,
  source_actor_id:ids.actor,source_transaction_id:ids.transaction,source_command_id:ids.command,
  source_attempt:1,reference:{profile_id:ids.oldProfile,
    profile_code:historicalArtifact.input.profile.profile_code,profile_version:1,country_code:'DE',
    profile_manifest_sha256:historicalArtifact.input.profile.manifest_sha256,
    domain_code:'documents.retention',domain_version:'documents-retention.v1',
    artifact_sha256:historicalArtifact.artifactSha,effective_at:'2026-09-15T00:00:00.000Z'}};
const historicalRequest={
  contract_version:composition.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
  mode:'historical',committed_evidence:committedEvidence,document_type_code:'invoice',
  document_immutable_version:3,legal_hold_state:'none',requested_operation:'retain'};
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

await check('current composition resolves only the current canonical property artifact',async()=>{
  const scoped=scopeFor([rowFor(currentArtifact)]);
  const result=await composition.resolveDocumentsCountryRetentionV1(
    scoped,command,authority,currentRequest);
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.equal(result.mode,'current');
  assert.equal(result.evaluation.resolution.retention_rule_code,'current_statutory');
  assert.equal(result.evaluation.artifact_fingerprint.profile_version,2);
  assert.equal(result.evaluation.effective_at,now);
  assert.ok(scoped.calls.some(sql=>sql.includes('property_jurisdiction_assignments')));
  assert.ok(scoped.calls.every(sql=>/^select\b/i.test(sql.trim())));
});

await check('historical composition stays pinned to committed receipt evidence',async()=>{
  const scoped=scopeFor([rowFor(historicalArtifact)]);
  const result=await composition.resolveDocumentsCountryRetentionV1(
    scoped,command,authority,historicalRequest);
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.equal(result.mode,'historical');
  assert.equal(result.evaluation.resolution.retention_rule_code,'historical_statutory');
  assert.equal(result.evaluation.artifact_fingerprint.profile_version,1);
  assert.equal(result.evaluation.effective_at,committedEvidence.reference.effective_at);
  assert.ok(scoped.calls.some(sql=>sql.includes('jurisdiction_domain_artifact_receipt_evidence')));
  assert.ok(scoped.calls.every(sql=>!sql.includes('property_jurisdiction_assignments')));
});

await check('callers cannot inject an artifact or effective timestamp',async()=>{
  for(const injected of [
    {...currentRequest,artifact:currentArtifact.input},
    {...currentRequest,effective_at:now},
    {...historicalRequest,artifact:historicalArtifact.input},
  ]){
    const noQuery={...baseScope,query(){throw new Error('must not query');}};
    const result=await composition.resolveDocumentsCountryRetentionV1(
      noQuery,command,authority,injected);
    assert.equal(result.denial_reason,'MALFORMED_INPUT');
    assert.equal(result.mode,null);
  }
});

await check('active legal hold always blocks disposal without a write',async()=>{
  const scoped=scopeFor([rowFor(currentArtifact)]);
  const result=await composition.resolveDocumentsCountryRetentionV1(scoped,command,authority,
    {...currentRequest,requested_operation:'dispose',legal_hold_state:'active'});
  assert.equal(result.denial_reason,'EVALUATOR_DENIED');
  assert.equal(result.evaluation.denial_reason,'LEGAL_HOLD_BLOCKS_DISPOSAL');
  assert.ok(scoped.calls.every(sql=>/^select\b/i.test(sql.trim())));
});

await check('missing, ambiguous and stale current evidence fail closed',async()=>{
  for(const [rows,options,reason] of [
    [[],{},'ARTIFACT_UNAVAILABLE'],
    [[rowFor(currentArtifact),rowFor(currentArtifact)],{},'ARTIFACT_AMBIGUOUS'],
    [[rowFor(currentArtifact)],{revision:8},'STALE_AUTHORITY'],
  ]){
    const result=await composition.resolveDocumentsCountryRetentionV1(
      scopeFor(rows,options),command,authority,currentRequest);
    assert.equal(result.decision,'denied');
    assert.equal(result.denial_reason,'RESOLVER_DENIED');
    assert.equal(result.resolver_denial_reason,reason);
    assert.equal(result.evaluation,null);
  }
});

await check('cross-Workspace evidence and revoked access fail before evaluation',async()=>{
  const cross={...historicalRequest,committed_evidence:{...committedEvidence,
    source_workspace_id:ids.otherWorkspace}};
  const crossResult=await composition.resolveDocumentsCountryRetentionV1(
    scopeFor([]),command,authority,cross);
  assert.equal(crossResult.resolver_denial_reason,'BINDING_MISMATCH');
  const revoked={...authority,decision:'denied',denial_reason:'ACTOR_REVOKED'};
  const revokedResult=await composition.resolveDocumentsCountryRetentionV1(
    scopeFor([]),command,revoked,historicalRequest);
  assert.equal(revokedResult.resolver_denial_reason,'AUTHORITY_DENIED');
});

await check('malformed, mismatched and absent receipt evidence is denied with zero write',async()=>{
  const malformed=await composition.resolveDocumentsCountryRetentionV1(scopeFor([]),command,authority,
    {...historicalRequest,committed_evidence:{...committedEvidence,receipt_id:'not-a-uuid'}});
  assert.equal(malformed.denial_reason,'MALFORMED_INPUT');
  const absent=await composition.resolveDocumentsCountryRetentionV1(
    scopeFor([]),command,authority,historicalRequest);
  assert.equal(absent.resolver_denial_reason,'HISTORICAL_RECEIPT_UNAVAILABLE');
  const tamperedRequest={...historicalRequest,committed_evidence:{...committedEvidence,
    reference:{...committedEvidence.reference,artifact_sha256:hash('not-the-artifact')}}};
  const tampered=await composition.resolveDocumentsCountryRetentionV1(
    scopeFor([rowFor(historicalArtifact)]),command,authority,tamperedRequest);
  assert.equal(tampered.denial_reason,'RESOLVER_EVIDENCE_MISMATCH');
  assert.equal(tampered.resolver_denial_reason,null);
});

await check('real 40001 errors propagate for Core host retry',async()=>{
  const serialization=Object.assign(new Error('retry transaction'),{code:'40001'});
  await assert.rejects(()=>composition.resolveDocumentsCountryRetentionV1(
    scopeFor([],{throwOn:/jurisdiction_domain_artifacts a/,error:serialization}),
    command,authority,currentRequest),error=>error===serialization);
});

await check('accepted and denied output stays metadata-only and non-authorizing',async()=>{
  for(const result of [
    await composition.resolveDocumentsCountryRetentionV1(
      scopeFor([rowFor(currentArtifact)]),command,authority,currentRequest),
    await composition.resolveDocumentsCountryRetentionV1(
      scopeFor([]),command,authority,historicalRequest),
  ]){
    const output=JSON.stringify(result);
    assert.equal(result.reusable_as_command_authority,false);
    assert.equal(result.source_disclosure,'status_only');
    assert.equal(result.source_reference,null);
    assert.doesNotMatch(output,/document_id|object_path|storage|permission|canonical_bytes|receipt_id/i);
  }
});

await check('composition imports canonical Core resolution and remains mutation-free',async()=>{
  const source=readFileSync(new URL(
    '../src/lib/customer/documents-country-retention-resolution-v1.ts',import.meta.url),'utf8');
  assert.match(source,/resolveCurrentJurisdictionDomainArtifactV1/);
  assert.match(source,/resolveHistoricalJurisdictionDomainArtifactV1/);
  assert.match(source,/committedJurisdictionDomainArtifactEvidenceReferenceV1Schema/);
  assert.doesNotMatch(source,/\b(?:insert\s+into|update\s+[a-z]|delete\s+from|grant\s+|create\s+table)\b/i);
  assert.doesNotMatch(source,/jurisdiction_domain_artifacts|jurisdiction_domain_artifact_receipt_evidence/);
});

console.log(`Documents country retention resolution contract: ${checks}/${checks} PASS`);
