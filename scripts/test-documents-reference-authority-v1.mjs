import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url), cache=new Map();
export function load(url) {
  if(cache.has(url.href)) return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const mod={exports:{}}; cache.set(url.href,mod.exports);
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  return mod.exports;
}

const api=load(new URL('../src/lib/customer/documents-reference-authority-v1.ts',import.meta.url));
const selector=load(new URL('../src/lib/customer/documents-reference-tx-selector-v1.ts',import.meta.url));
const core=load(new URL('../src/lib/core/transaction-provider-evidence-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const ids={transaction:randomUUID(),command:randomUUID(),context:randomUUID(),workspace:randomUUID(),
  actor:randomUUID(),document:randomUUID(),version:randomUUID(),decision:randomUUID(),
  guide:randomUUID(),module:randomUUID()};
const command={contract_version:'core-transaction-command.v2',transaction_id:ids.transaction,
  command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:1,permission_code:'documents.vault.read',module_code:'documents',
  evaluation_purpose:'documents.reference.read',aggregate_type:'documents.document',
  aggregate_id:ids.document,aggregate_version:1,provider_source_ids:[ids.document,ids.version],
  idempotency_key:'documents-reference-test',input_fingerprint:'doc1:0123456789abcdef',
  subject_reference:{kind:'documents.document_version',id:ids.version,version:1,relation:'read',request_version:1}};
const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
  decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:1,permission_code:'documents.vault.read',module_code:'documents',
  evaluation_purpose:'documents.reference.read',
  transaction_context:{transaction_id:ids.transaction,command_id:ids.command,attempt:1,
    isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:ids.workspace,
      aggregate_type:'documents.document',aggregate_id:ids.document,acquired_at:new Date().toISOString()}}};
const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,{
  contract_version:'core-current-authority-observation.v1',source_contract:'workspace-native-effective-authority.v2',
  decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
  authority_version:1,permission_code:'documents.vault.read',module_code:'documents',
  transaction_context:authorityRequest.transaction_context,
  evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',source_reference:null,
  actor_status:'current',decision:'allowed',evaluated_at:new Date().toISOString(),
});
const scope={transaction_id:ids.transaction,database_transaction_id:'1',workspace_id:ids.workspace,
  tenant_id:randomUUID(),actor_id:ids.actor,attempt:1,query:async()=>{throw new Error('private SQL detail');}};
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};

await check('provider identity and output are the canonical Core evidence contract',async()=>{
  assert.equal(authorityPort.currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(authority).success,true);
  assert.equal(authority.contract_version,'core-current-authority-decision-receipt.v1');
  assert.equal(authority.receipt_version,1);
  assert.equal(authority.rechecked_after_lock,true);assert.equal(authority.transaction_bound,true);
  assert.equal(api.documentsReferenceAuthorityProviderCodeV1,'documents-reference-authority.v1');
  const result=await api.validateDocumentsReferenceAuthorityV1(scope,command,authority);
  assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'PROVIDER_UNAVAILABLE');
  assert.equal(core.coreTransactionProviderEvidenceV1Schema.safeParse(result).success,true);
  assert.equal(result.source_disclosure,'status_only');assert.equal(result.source_reference,null);
  for(const field of ['content','title','sha256','mime_type','object_path','bucket_id','tenant_id','permissions','entitlement']) {
    assert.ok(!(field in result));
  }
});
await check('subject, relation and command mismatches deny before querying',async()=>{
  const noQuery={...scope,query(){throw new Error('must not query');}};
  for(const changed of [
    {...command,aggregate_type:'documents.other'},
    {...command,subject_reference:{...command.subject_reference,kind:'documents.document'}},
    {...command,subject_reference:{...command.subject_reference,relation:'write'}},
    {...command,subject_reference:{...command.subject_reference,request_version:2}},
    {...command,aggregate_version:2},
    {...command,provider_source_ids:[ids.version]},
  ]) {
    const result=await api.validateDocumentsReferenceAuthorityV1(noQuery,changed,authority);
    assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'RELATION_MISMATCH');
    assert.equal(core.coreTransactionProviderEvidenceV1Schema.safeParse(result).success,true);
  }
});
await check('authority binding mismatch denies before querying',async()=>{
  const result=await api.validateDocumentsReferenceAuthorityV1(
    {...scope,query(){throw new Error('must not query');}},command,{...authority,authority_version:2});
  assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'SUBJECT_DENIED');
});
await check('serialization abort escapes to the Core host',async()=>{
  const error=Object.assign(new Error('retry'),{code:'40001'});
  await assert.rejects(()=>api.validateDocumentsReferenceAuthorityV1(
    {...scope,query:async()=>{throw error;}},command,authority),e=>e===error);
});
await check('source consumes Core v2 types without resolving or duplicating authority interfaces',()=>{
  const source=readFileSync(new URL('../src/lib/customer/documents-reference-authority-v1.ts',import.meta.url),'utf8');
  assert.match(source,/CoreTransactionProvidersV2/);
  assert.match(source,/CoreTransactionProviderEvidenceV1/);
  assert.doesNotMatch(source,/current-authority-postgres-provider|resolveAuthority|interface\s+CoreTransaction/);
  assert.doesNotMatch(source,/\b(?:insert into|update documents|delete from|set_config|authorize_download_internal|object_path|metadata_json)\b/i);
});
await check('transaction selector reuses canonical Core authority and Documents current-state resolver',async()=>{
  const acquiredAt=new Date(Date.now()-1000).toISOString(), evaluatedAt=new Date().toISOString();
  const selectorCommand={...command,permission_code:'experience.guide.manage',module_code:'experience_guides',
    evaluation_purpose:'experience.guide.publish',aggregate_type:'experience_guide',aggregate_id:ids.guide,
    provider_source_ids:[ids.guide,ids.document,ids.version],
    subject_reference:{kind:'experience.guide',id:ids.guide,version:1,relation:'publish',request_version:1}};
  const request={...authorityRequest,permission_code:selectorCommand.permission_code,
    module_code:selectorCommand.module_code,evaluation_purpose:selectorCommand.evaluation_purpose,
    transaction_context:{...authorityRequest.transaction_context,
      lock:{...authorityRequest.transaction_context.lock,aggregate_type:'experience_guide',
        aggregate_id:ids.guide,acquired_at:acquiredAt}}};
  const transactionAuthority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(request,{
    contract_version:'core-current-authority-observation.v1',source_contract:'workspace-native-effective-authority.v2',
    decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,
    authority_version:1,permission_code:selectorCommand.permission_code,module_code:selectorCommand.module_code,
    transaction_context:request.transaction_context,evaluator:'app_private.check_workspace_native_permission_v2',
    source_disclosure:'status_only',source_reference:null,actor_status:'current',decision:'allowed',evaluated_at:evaluatedAt,
    entitlement:{contract_version:'core-authority-entitlement-binding.v1',workspace_id:ids.workspace,
      module_definition_id:ids.module,module_code:selectorCommand.module_code,
      entitlement_key:'module.experience_guides',authority_revision:1},
  });
  const calls=[];
  const liveScope={...scope,async query(text,values=[]){
    calls.push({text,values});
    if(text.includes('txid_current()')&&text.includes('as evaluated_at')) return {rowCount:1,rows:[{transaction_id:'1',actor_id:ids.actor,
      isolation:'serializable',evaluated_at:evaluatedAt}]};
    if(text.includes('canonical_authority_revision_v1')) return {rowCount:1,rows:[{revision:'1'}]};
    if(text.includes('from identity.context_grants g join identity.memberships')) return {rowCount:1,
      rows:[{tenant_id:scope.tenant_id,actor_id:ids.actor,status:'active',current:true}]};
    if(text.includes('from platform.customer_workspaces')) return {rowCount:1,rows:[{tenant_id:scope.tenant_id}]};
    if(text.includes('app_private.check_workspace_native_permission_v2')) return {rowCount:1,
      rows:[{allowed:true,evaluated_at:evaluatedAt,module_definition_id:ids.module,
        entitlement_key:'module.documents'}]};
    if(text.includes('current_setting(\'transaction_isolation\')')&&text.includes('actor_bound')) return {rowCount:1,
      rows:[{transaction_id:'1',isolation:'serializable',actor_bound:true,aal2:true}]};
    if(text.includes('from documents.documents d where')) return {rowCount:1,
      rows:[{current_version:1,active:true}]};
    if(text.includes('from documents.document_versions v')&&!text.includes('document_scan_attestations')) return {rowCount:1,
      rows:[{version:1,scanning_status:'clean',checksum_status:'verified'}]};
    if(text.includes('from documents.document_permissions p\n')) return {rowCount:0,rows:[]};
    if(text.includes('documents.customer_document_scope_matches')) return {rowCount:1,rows:[{allowed:true}]};
    if(text.includes('documents.document_scan_attestations')) return {rowCount:1,rows:[{clean:true}]};
    if(text.includes('clock_timestamp()::text as now')) return {rowCount:1,rows:[{now:evaluatedAt}]};
    throw new Error(`unexpected selector query: ${text}`);
  }};
  const target={document_id:ids.document,document_version_id:ids.version,document_version:1};
  const result=await selector.selectDocumentsReferenceInCoreTransactionV1(
    liveScope,selectorCommand,transactionAuthority,target);
  assert.equal(result.decision,'accepted',JSON.stringify({result,calls}));
  assert.equal(selector.documentsReferenceTxSelectorDecisionV1Schema.safeParse(result).success,true);
  assert.deepEqual(result.target,target);assert.equal(result.source_disclosure,'status_only');
  assert.equal(result.source_reference,null);
  assert.ok(calls.some(call=>call.text.includes('canonical_authority_revision_v1')));
  assert.ok(calls.some(call=>call.text.includes('from documents.documents d where')));
  for(const field of ['content','title','body','sha256','mime_type','object_path','bucket_id','tenant_id',
    'permissions','entitlement','role']) assert.ok(!(field in result));
});
await check('selector binding and authority revision mismatches fail before source queries',async()=>{
  const source=readFileSync(new URL('../src/lib/customer/documents-reference-tx-selector-v1.ts',import.meta.url),'utf8');
  assert.match(source,/current-authority-postgres-provider-v1/);
  assert.match(source,/selectDocumentsReferenceCurrentStateV1/);
  assert.match(source,/CoreTransactionScopeV1/);
  assert.doesNotMatch(source,/interface\s+.*Authority|createCorePostgresTransactionHost|create table|idempotency_keys|outbox_events|audit\.events/i);
  assert.doesNotMatch(source,/\b(?:insert|update|delete)\b[\s\S]{0,20}\b(?:documents|platform|audit)\b/i);
  const noQuery={...scope,query(){throw new Error('must not query');}};
  const target={document_id:ids.document,document_version_id:ids.version,document_version:1};
  const missingLock=await selector.selectDocumentsReferenceInCoreTransactionV1(
    noQuery,{...command,provider_source_ids:[ids.document]},authority,target);
  assert.equal(missingLock.decision,'denied');assert.equal(missingLock.denial_reason,'BINDING_MISMATCH');
  const stale=await selector.selectDocumentsReferenceInCoreTransactionV1(
    noQuery,command,{...authority,authority_version:2},target);
  assert.equal(stale.decision,'denied');assert.equal(stale.denial_reason,'BINDING_MISMATCH');
});
console.log(`Documents reference contract: ${checks}/${checks} PASS`);
