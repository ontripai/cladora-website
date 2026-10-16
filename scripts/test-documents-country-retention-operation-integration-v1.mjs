import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url),cache=new Map(),overrides=new Map();
function load(url){
  if(overrides.has(url.href))return overrides.get(url.href);
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }});
  const mod={exports:{}};cache.set(url.href,mod.exports);
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  return mod.exports;
}

const resolutionUrl=new URL(
  '../src/lib/customer/documents-country-retention-resolution-v1.ts',import.meta.url);
const selectorUrl=new URL(
  '../src/lib/customer/documents-reference-tx-selector-v1.ts',import.meta.url);
const resolution=load(resolutionUrl);
const evaluator=load(new URL(
  '../src/lib/customer/documents-country-retention-evaluator-v1.ts',import.meta.url));
const artifactContract=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-v1.ts',import.meta.url));
let selectorMode='accepted',selectorCalls=0,resolutionCalls=0,lastResolutionInput=null;
const ids={transaction:randomUUID(),command:randomUUID(),context:randomUUID(),workspace:randomUUID(),
  otherWorkspace:randomUUID(),actor:randomUUID(),tenant:randomUUID(),property:randomUUID(),
  otherProperty:randomUUID(),document:randomUUID(),version:randomUUID(),module:randomUUID(),
  profile:randomUUID(),receipt:randomUUID()};
const now='2026-10-16T09:00:00.000Z';
function selectorDecision(command,target){
  selectorCalls+=1;
  return{contract_version:'documents-reference-tx-selector-decision.v1',decision_id:randomUUID(),
    context_id:command.context_id,workspace_id:command.workspace_id,actor_id:command.actor_id,
    authority_version:command.authority_version,target,evaluated_at:now,
    source_disclosure:'status_only',source_reference:null,
    ...(selectorMode==='accepted'?{decision:'accepted',denial_reason:null,
      reference_state:'available',current_actor_can_read:true}:{decision:'denied',
      denial_reason:selectorMode})};
}
overrides.set(selectorUrl.href,{async selectDocumentsReferenceInCoreTransactionV1(
  _scope,command,_authority,target){return selectorDecision(command,target);}});

const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`
  :value!==null&&typeof value==='object'
    ?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
    :JSON.stringify(value);
const review=seed=>({status:'approved',review_version:1,
  reviewed_at:'2026-01-01T00:00:00.000Z',evidence_sha256:hash(seed)});
const artifactInput=artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse({
  contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
  profile:{profile_id:ids.profile,profile_code:'de.documents.v1',profile_version:1,
    country_code:'DE',manifest_sha256:hash('manifest')},
  domain:{domain_code:'documents.retention',domain_version:'documents-retention.v1',policy:{
    document_types:[{document_type_code:'invoice',retention_rule_code:'synthetic_rule',
      retention_period:'P10Y',legal_hold_overrides_disposal:true,
      immutable_version_required:true,evidence_codes:['synthetic.evidence']}],
    disposal_requires_review:true,residency_rule_code:'synthetic_residency'}},
  effective_from:'2026-01-01T00:00:00.000Z',effective_to:null,status:'active',
  legal_review:review('legal'),accounting_review:review('accounting'),
  reusable_as_command_authority:false,
});
const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(artifactInput);
assert.equal(hash(Buffer.from(canonical(artifactInput))),artifactSha);
function resolutionDecision(input){
  const evaluation=evaluator.evaluateDocumentsCountryRetentionV1({
    contract_version:evaluator.DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1,
    artifact:{...artifactInput,artifact_sha256:artifactSha},document_type_code:input.document_type_code,
    document_immutable_version:input.document_immutable_version,effective_at:now,
    legal_hold_state:input.legal_hold_state,requested_operation:input.requested_operation,
  });
  return resolution.documentsCountryRetentionResolutionDecisionV1Schema.parse({
    contract_version:resolution.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_DECISION_V1,
    composition_version:1,mode:input.mode,
    decision:evaluation.decision==='accepted'?'accepted':'denied',
    denial_reason:evaluation.decision==='accepted'?null:'EVALUATOR_DENIED',
    resolver_contract_version:'core-jurisdiction-domain-artifact-resolver-decision.v1',
    resolver_version:1,resolver_denial_reason:null,evaluation,
    source_disclosure:'status_only',source_reference:null,reusable_as_command_authority:false,
  });
}
overrides.set(resolutionUrl.href,{...resolution,
  async resolveDocumentsCountryRetentionV1(_scope,_command,_authority,input){
    resolutionCalls+=1;lastResolutionInput=structuredClone(input);return resolutionDecision(input);
  }});
const integration=load(new URL(
  '../src/lib/customer/documents-country-retention-operation-integration-v1.ts',import.meta.url));

const target={document_id:ids.document,document_version_id:ids.version,document_version:4};
const currentRequest={
  contract_version:integration.DOCUMENTS_COUNTRY_RETENTION_OPERATION_REQUEST_V1,
  mode:'current',target,requested_operation:'read-policy'};
const committedEvidence={
  contract_version:'core-jurisdiction-domain-artifact-committed-evidence.v1',
  receipt_id:ids.receipt,source_workspace_id:ids.workspace,source_property_id:ids.property,
  source_actor_id:ids.actor,source_transaction_id:ids.transaction,source_command_id:ids.command,
  source_attempt:1,reference:{profile_id:ids.profile,profile_code:'de.documents.v1',
    profile_version:1,country_code:'DE',profile_manifest_sha256:hash('manifest'),
    domain_code:'documents.retention',domain_version:'documents-retention.v1',
    artifact_sha256:artifactSha,effective_at:now}};
const historicalRequest={...currentRequest,mode:'historical',requested_operation:'retain',
  committed_evidence:committedEvidence};
function commandFor(request=currentRequest,overrides={}){
  const command={contract_version:'core-transaction-command.v2',transaction_id:ids.transaction,
    command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
    authority_version:9,permission_code:'documents.vault.read',module_code:'documents',
    evaluation_purpose:'documents.country-retention.resolve',aggregate_type:'portfolio.property',
    aggregate_id:ids.property,aggregate_version:2,
    provider_source_ids:[ids.property,ids.document,ids.version],
    idempotency_key:'documents-retention-operation-static-01',
    input_fingerprint:integration.documentsCountryRetentionOperationInputFingerprintV1(request),
    subject_reference:{kind:'documents.document_version',id:ids.version,version:4,
      relation:request.requested_operation,request_version:1}};
  return{...command,...overrides};
}
function authorityFor(command=commandFor()){
  return{contract_version:'core-current-authority-transaction-port-decision.v1',
    decision_id:randomUUID(),context_id:command.context_id,workspace_id:command.workspace_id,
    actor_id:command.actor_id,authority_version:command.authority_version,
    permission_code:command.permission_code,module_code:command.module_code,
    evaluation_purpose:command.evaluation_purpose,decision:'allowed',denial_reason:null,
    rechecked_after_lock:true,transaction_bound:true,reusable_as_command_authority:false,
    evaluated_at:now,source_disclosure:'status_only',source_reference:null,
    entitlement:{contract_version:'core-authority-entitlement-binding.v1',
      workspace_id:command.workspace_id,module_definition_id:ids.module,
      module_code:'documents',entitlement_key:'module.documents',authority_revision:9},
    transaction_context:{transaction_id:command.transaction_id,command_id:command.command_id,
      attempt:1,isolation_level:'serializable',lock:{kind:'command_aggregate',
        workspace_id:command.workspace_id,aggregate_type:command.aggregate_type,
        aggregate_id:command.aggregate_id,acquired_at:'2026-10-16T08:59:59.000Z'}}};
}
function scopeFor(options={}){
  const calls=[];
  return{transaction_id:ids.transaction,database_transaction_id:'91',workspace_id:ids.workspace,
    tenant_id:ids.tenant,actor_id:ids.actor,attempt:1,calls,async query(text){
      calls.push(text);
      if(options.throwOn?.test(text))throw options.error;
      if(text.includes('from documents.documents d'))return{rowCount:options.documentMissing?0:1,
        rows:options.documentMissing?[]:[{property_id:options.property??ids.property,
          document_type_code:options.documentType??'invoice',legacy_legal_hold:options.legacyHold??false,
          current_version:options.currentVersion??4,immutable_version:options.version??4}]};
      if(text.includes('from platform.workspace_property_bindings b'))return{
        rowCount:options.bindingMissing?0:1,rows:options.bindingMissing?[]:[{id:randomUUID()}]};
      if(text.includes('from documents.legal_holds h'))return{rowCount:(options.holds??[]).length,
        rows:options.holds??[]};
      if(text.includes('clock_timestamp()'))return{rowCount:1,rows:[{now}]};
      throw new Error(`unexpected query: ${text}`);
    }};
}
let checks=0;
const check=async(name,fn)=>{selectorMode='accepted';selectorCalls=0;resolutionCalls=0;
  lastResolutionInput=null;await fn();console.log(`ok ${++checks} - ${name}`);};

await check('current operation binds the real document, Property and immutable version',async()=>{
  const scope=scopeFor(),command=commandFor(),authority=authorityFor(command);
  const result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authority,currentRequest);
  assert.equal(result.decision,'accepted',JSON.stringify(result));
  assert.equal(result.document_binding,'exact');assert.equal(result.reusable_as_command_authority,false);
  assert.equal(lastResolutionInput.property_id,ids.property);
  assert.equal(lastResolutionInput.document_type_code,'invoice');
  assert.equal(lastResolutionInput.document_immutable_version,4);
  assert.equal(lastResolutionInput.legal_hold_state,'none');
  assert.equal(lastResolutionInput.requested_operation,'read-policy');
  assert.equal(selectorCalls,1);assert.equal(resolutionCalls,1);
  assert.ok(scope.calls.every(sql=>/^select\b/i.test(sql.trim())));
  assert.doesNotMatch(JSON.stringify(result),/document_id|document_version_id|object_path|storage|content/i);
});

await check('server-owned authority and domain profile cannot be overridden',async()=>{
  for(const injected of [
    {...currentRequest,permission_code:'airprop.asset.read'},
    {...currentRequest,module_code:'airprop_commercial'},
    {...currentRequest,entitlement_code:'module.airprop_commercial'},
    {...currentRequest,evaluation_purpose:'airprop.country-pack.resolve'},
    {...currentRequest,domain_code:'address.structure'},
    {...currentRequest,domain_version:'address-structure.v1'},
  ]){
    const scope=scopeFor();const command=commandFor();
    const result=await integration.resolveDocumentsCountryRetentionOperationV1(
      scope,command,authorityFor(command),injected);
    assert.equal(result.denial_reason,'MALFORMED_INPUT');assert.equal(scope.calls.length,0);
  }
  for(const changed of [
    {permission_code:'airprop.asset.read'}, {permission_code:'documents.vault.manage'},
    {module_code:'airprop_commercial'}, {evaluation_purpose:'documents.reference.read'},
  ]){
    const command=commandFor(currentRequest,changed),scope=scopeFor();
    const result=await integration.resolveDocumentsCountryRetentionOperationV1(
      scope,command,authorityFor(command),currentRequest);
    assert.equal(result.denial_reason,'COMMAND_PROFILE_MISMATCH');assert.equal(scope.calls.length,0);
  }
});

await check('stale, denied and cross-Workspace document state fails closed',async()=>{
  selectorMode='STALE_REFERENCE';let scope=scopeFor(),command=commandFor();
  let result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),currentRequest);
  assert.equal(result.denial_reason,'STALE_DOCUMENT_VERSION');assert.equal(resolutionCalls,0);
  selectorMode='REFERENCE_DENIED';scope=scopeFor();
  result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),currentRequest);
  assert.equal(result.denial_reason,'DOCUMENT_REFERENCE_DENIED');assert.equal(resolutionCalls,0);
  selectorMode='accepted';scope=scopeFor({property:ids.otherProperty});
  result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),currentRequest);
  assert.equal(result.denial_reason,'DOCUMENT_BINDING_MISMATCH');assert.equal(resolutionCalls,0);
});

await check('current legal hold is rechecked after document lock and blocks disposal',async()=>{
  const request={...currentRequest,requested_operation:'dispose'};
  const command=commandFor(request),scope=scopeFor({holds:[{id:randomUUID(),status:'active'}]});
  const result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),request);
  assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'RETENTION_DENIED');
  assert.equal(result.retention.evaluation.denial_reason,'LEGAL_HOLD_BLOCKS_DISPOSAL');
  assert.equal(lastResolutionInput.legal_hold_state,'active');
  const docIndex=scope.calls.findIndex(sql=>sql.includes('from documents.documents d'));
  const holdIndex=scope.calls.findIndex(sql=>sql.includes('from documents.legal_holds h'));
  assert.ok(docIndex>=0&&holdIndex>docIndex);assert.ok(scope.calls.every(sql=>/^select\b/i.test(sql.trim())));
});

await check('historical mode accepts only exact committed receipt evidence',async()=>{
  let command=commandFor(historicalRequest),scope=scopeFor();
  let result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),historicalRequest);
  assert.equal(result.decision,'accepted');assert.equal(lastResolutionInput.mode,'historical');
  assert.deepEqual(lastResolutionInput.committed_evidence,committedEvidence);
  const cross={...historicalRequest,committed_evidence:{...committedEvidence,
    source_workspace_id:ids.otherWorkspace}};
  command=commandFor(cross);scope=scopeFor();
  result=await integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),cross);
  assert.equal(result.denial_reason,'DOCUMENT_BINDING_MISMATCH');assert.equal(resolutionCalls,1);
});

await check('real 40001 is propagated to the Core host retry loop',async()=>{
  const serialization=Object.assign(new Error('retry'),{code:'40001'});
  const command=commandFor(),scope=scopeFor({throwOn:/documents\.legal_holds/,error:serialization});
  await assert.rejects(()=>integration.resolveDocumentsCountryRetentionOperationV1(
    scope,command,authorityFor(command),currentRequest),error=>error===serialization);
});

await check('Core provider uses current-state replay and creates no duplicate evidence',async()=>{
  const command=commandFor(),authority=authorityFor(command),scope=scopeFor();
  const providers=integration.createDocumentsCountryRetentionOperationProvidersV1(currentRequest);
  const evidence=await providers.validateProviders(scope,command,authority);
  assert.equal(evidence.decision,'accepted');assert.equal(evidence.source_reference,null);
  assert.equal((await providers.mutate(scope,command)).mutation_id,command.command_id);
  const receipt={contract_version:'core-transaction-receipt.v2',receipt_version:2,
    receipt_id:randomUUID(),transaction_id:command.transaction_id,command_id:command.command_id,
    workspace_id:command.workspace_id,actor_id:command.actor_id,
    aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id,
    aggregate_version:command.aggregate_version,input_fingerprint:command.input_fingerprint,
    idempotency_key:command.idempotency_key,replay_validation:{
      contract_version:'core-transaction-replay-provider-requirement.v1',
      provider_code:integration.documentsCountryRetentionOperationProviderCodeV1},
    authority,mutation_id:command.command_id,audit_event_id:'1',outbox_event_id:randomUUID(),
    subject_reference:command.subject_reference,provider_evidence:evidence,committed_at:now};
  const replay=await providers.validateReplay(scope,command,authority,receipt);
  assert.equal(replay.decision,'accepted',JSON.stringify(replay));assert.equal(replay.read_only,true);
  assert.equal(resolutionCalls,2,'fresh and replay each run one independent current-state composition');
  assert.ok(scope.calls.every(sql=>!/(?:insert|update|delete)\s/i.test(sql)));
  assert.ok(scope.calls.every(sql=>!sql.includes('jurisdiction_domain_artifact_receipt_evidence')));
});

await check('implementation consumes accepted selectors and contains no disposal mutation',async()=>{
  const source=readFileSync(new URL(
    '../src/lib/customer/documents-country-retention-operation-integration-v1.ts',import.meta.url),
  'utf8');
  assert.match(source,/selectDocumentsReferenceInCoreTransactionV1/);
  assert.match(source,/resolveDocumentsCountryRetentionV1/);
  assert.match(source,/provider_current_state_required/);
  assert.match(source,/permission_code === 'documents\.vault\.read'/);
  assert.match(source,/entitlement_key === 'module\.documents'/);
  assert.match(source,/evaluation_purpose === 'documents\.country-retention\.resolve'/);
  assert.doesNotMatch(source,/Storage.*delete|deleteObject|removeObject|disposeDocument/i);
  assert.doesNotMatch(source,/\b(?:insert\s+into|update\s+documents|delete\s+from|grant\s+)\b/i);
});

console.log(`Documents country retention operation integration: ${checks}/${checks} PASS`);
