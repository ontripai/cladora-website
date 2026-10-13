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
const core=load(new URL('../src/lib/core/transaction-provider-evidence-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const ids={transaction:randomUUID(),command:randomUUID(),context:randomUUID(),workspace:randomUUID(),
  actor:randomUUID(),document:randomUUID(),version:randomUUID(),decision:randomUUID()};
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
console.log(`Documents reference contract: ${checks}/${checks} PASS`);
