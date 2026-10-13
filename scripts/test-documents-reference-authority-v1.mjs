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
const request={contract_version:'documents-reference-authority.v1',context_id:randomUUID(),workspace_id:randomUUID(),
  command_id:randomUUID(),authority_version:1,document_id:randomUUID(),document_version_id:randomUUID(),
  document_version:1,evaluation_mode:'new_command'};
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
await check('strict request rejects client authority, content and undeclared fields',()=>{
  assert.equal(api.documentsReferenceAuthorityRequestV1Schema.safeParse(request).success,true);
  for(const field of ['actor_id','tenant_id','safe_label','permission_code','module_code','content','object_path','receipt']) {
    assert.equal(api.documentsReferenceAuthorityRequestV1Schema.safeParse({...request,[field]:randomUUID()}).success,false);
  }
  for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(api.documentsReferenceAuthorityRequestV1Schema.safeParse({...request,document_version:value}).success,false);
    assert.equal(api.documentsReferenceAuthorityRequestV1Schema.safeParse({...request,authority_version:value}).success,false);
  }
});
await check('invalid or cross-Workspace request never queries or writes',async()=>{
  const scope={workspace_id:request.workspace_id,query(){throw new Error('must not query');}};
  assert.equal((await api.resolveDocumentsReferenceAuthorityV1(scope,{...request,content:'private'})).code,'INVALID_REQUEST');
  assert.equal((await api.resolveDocumentsReferenceAuthorityV1(scope,{...request,workspace_id:randomUUID()})).decision,'denied');
});
await check('SQL errors are bounded; serialization abort propagates to the Core host',async()=>{
  const error=Object.assign(new Error('private SQL and credentials'),{code:'42501'});
  const scope={workspace_id:request.workspace_id,query:async()=>{throw error;}};
  assert.deepEqual(await api.resolveDocumentsReferenceAuthorityV1(scope,request),{
    contract_version:'documents-reference-authority.v1',decision:'denied',evidence:null,code:'PROVIDER_UNAVAILABLE'});
  error.code='40001';
  await assert.rejects(()=>api.resolveDocumentsReferenceAuthorityV1(scope,request),e=>e===error);
});
await check('denial evidence is always null and result schema rejects unrelated permission data',()=>{
  const denial={contract_version:'documents-reference-authority.v1',decision:'denied',code:'AUTHORITY_DENIED',evidence:null};
  assert.equal(api.documentsReferenceAuthorityResultV1Schema.safeParse(denial).success,true);
  for(const extra of [{evidence:{document_id:request.document_id}},{permissions:['unrelated']},{content:'private'}]) {
    assert.equal(api.documentsReferenceAuthorityResultV1Schema.safeParse({...denial,...extra}).success,false);
  }
});
await check('provider stays unwired and imports the canonical Core provider directly',()=>{
  const source=readFileSync(new URL('../src/lib/customer/documents-reference-authority-v1.ts',import.meta.url),'utf8');
  assert.match(source,/import \{ resolveAuthority \} from '..\/core\/current-authority-postgres-provider-v1'/);
  assert.match(source,/scope: CoreTransactionScopeV1/);
  assert.doesNotMatch(source,/\b(?:insert into|update documents|delete from|set_config|authorize_download_internal|object_path|metadata_json)\b/i);
});
console.log(`Documents reference contract: ${checks}/${checks} PASS`);
