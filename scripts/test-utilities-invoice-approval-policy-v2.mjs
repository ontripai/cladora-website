/** Policy delta only. Actual TS adapters; SQL boundary controlled. No PG/Auth run. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url);
const entry=resolve(root,'src/lib/utilities/monthly-input-producer-v1.ts');
function environment(entryText){const cache=new Map();function load(path){if(cache.has(path))return cache.get(path).exports;
 const mod={exports:{}};cache.set(path,mod);const require=id=>{if(id==='server-only')return{};if(!id.startsWith('@/')&&!id.startsWith('.'))return native(id);
 let p=id.startsWith('@/')?resolve(root,'src',id.slice(2)):resolve(dirname(path),id);if(!extname(p))p+='.ts';return p.endsWith('.json')?JSON.parse(readFileSync(p,'utf8')):load(p);};
 const source=path===entry&&entryText!==undefined?entryText:readFileSync(path,'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',compiled)(require,mod,mod.exports);return mod.exports;}return load(entry);}
const api=environment(),parent='ab28c87a4eb82f5f462d3faf971149c4fec858f6';
const old=environment(execFileSync('git',['show',`${parent}:src/lib/utilities/monthly-input-producer-v1.ts`],{cwd:root,encoding:'utf8'}));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
// Tokens model different DB content hashes only; NOT PostgreSQL JSONB serialization proof.
const content={id:id(1),workspace_id:id(2),property_id:id(3),period:'2026-10',currency:'RON',amount:'100.0001',lines:['canonical-line'],provenance:'canonical-document'};
const token=image=>createHash('sha256').update(JSON.stringify(image)).digest('hex');
const plan={contract_version:'utilities-monthly-input.v2',operation:'review_invoice',source_id:id(1),review_task_id:id(4),source_hash_contract:'utilities-invoice-content.v2',expected_source_sha256:token(content),decision:'approved',reason:'Synthetic policy review'};
function fixture(p=plan,implementation=api){const calls=[];let originActor=id(90),currentHash=token(content),fault=null,afterRead=null;
 const command={contract_version:'core-transaction-command.v1',transaction_id:id(10),command_id:id(11),context_id:id(12),workspace_id:id(2),actor_id:id(14),authority_version:7,permission_code:'utilities.invoices.review',module_code:'utilities',evaluation_purpose:'utilities.invoice.review',aggregate_type:'utilities.provider_invoice',aggregate_id:p.source_id,aggregate_version:1,provider_source_ids:[p.source_id,p.review_task_id],idempotency_key:'synthetic-original-key',input_fingerprint:implementation.fingerprintUtilitiesMonthlyInputV1(p)};
 const scope={transaction_id:id(10),database_transaction_id:'101',workspace_id:id(2),tenant_id:id(15),actor_id:id(14),attempt:1,query:async(sql,args)=>{
  calls.push({sql,args});if(fault)throw fault;
  if(sql===api.UTILITIES_INVOICE_REVIEW_SOURCE_SQL_V1){const result={contract_version:'utilities-invoice-review-source.v2',source_hash_contract:'utilities-invoice-content.v2',source_id:p.source_id,review_task_id:p.review_task_id,source_sha256:currentHash,origin_actor_id:originActor,origin_record_id:id(91),tenant_id:scope.tenant_id,actor_id:scope.actor_id,database_transaction_id:scope.database_transaction_id};if(afterRead)await afterRead();return{rowCount:1,rows:[{result}]};}
  assert.equal(sql,api.UTILITIES_MONTHLY_INPUT_SQL_V1);return{rowCount:1,rows:[{result:{contract_version:'utilities-monthly-input-result.v1',source_relation:'utilities.provider_invoices',source_id:p.source_id,source_sha256:'f'.repeat(64),status:p.decision==='approved'?'approved':'void',mutation_id:p.source_id,tenant_id:scope.tenant_id,actor_id:scope.actor_id,database_transaction_id:scope.database_transaction_id}}]};}};
 return{scope,command,calls,setOrigin(v){originActor=v;},setHash(v){currentHash=v;},setFault(v){fault=v;},afterRead(v){afterRead=v;},mutationCalls(){return calls.filter(c=>c.sql===api.UTILITIES_MONTHLY_INPUT_SQL_V1).length;}};}
let n=0;async function check(name,fn){if(process.argv.includes('--source')&&!name.startsWith('static')&&!name.startsWith('coherent'))return;await fn();console.log(`PASS ${++n}: ${name}`);}
await check('before: actual parent adapter accepted same actor; controlled witness, not SQL execution',async()=>{
 const p={...plan,contract_version:'utilities-monthly-input.v1'};delete p.source_hash_contract;const f=fixture(p,old);f.setOrigin(f.scope.actor_id);
 assert.deepEqual(await old.mutateUtilitiesMonthlyInputV1(f.scope,f.command,p),{mutation_id:p.source_id});assert.equal(f.mutationCalls(),1);
 const sql=execFileSync('git',['show',`${parent}:supabase/proposals/utilities-monthly-input-v1/producer.sql`],{cwd:root,encoding:'utf8'});assert.ok(!sql.includes('origin.actor_id=auth.uid()'));
});
await check('after: same actor denied even when both actions available; no mutation dispatch',async()=>{
 const f=fixture();f.setOrigin(f.scope.actor_id);await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),e=>e.code==='42501');assert.equal(f.mutationCalls(),0);
});
await check('session/Context/authority revision changes never exempt the same actor',async()=>{
 for(const patch of [{context_id:id(99)},{authority_version:8},{context_id:id(98),authority_version:9}]){const f=fixture();Object.assign(f.command,patch);f.setOrigin(f.scope.actor_id);await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),e=>e.code==='42501');assert.equal(f.mutationCalls(),0);}
 // No session/role/creator override field belongs to the strict domain body.
 for(const patch of [{session_id:id(99)},{role:'accountant'},{origin_actor_id:id(90)},{ingested_by:id(90)}])assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...plan,...patch}));
});
await check('positive control: independent actor, exact task/hash, two fixed calls in the same scope',async()=>{
 const f=fixture();assert.deepEqual(await api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),{mutation_id:plan.source_id});
 assert.deepEqual(f.calls.map(c=>c.sql),[api.UTILITIES_INVOICE_REVIEW_SOURCE_SQL_V1,api.UTILITIES_MONTHLY_INPUT_SQL_V1]);assert.equal(f.mutationCalls(),1);
});
await check('content/scope/provenance drift never transfers the old hash approval',async()=>{
 for(const key of Object.keys(content)){const f=fixture(),changed={...content,[key]:Array.isArray(content[key])?['different-line']:String(content[key])+'-changed'};f.setHash(token(changed));await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),e=>e.code==='22023');assert.equal(f.mutationCalls(),0);}
});
await check('task mismatch and legacy/malformed origin preparation fail before mutation',async()=>{
 for(const patch of [{review_task_id:id(99)},{origin_actor_id:null},{origin_record_id:null},{contract_version:'utilities-invoice-review-source.v1'}]){
 const f=fixture(),q=f.scope.query;f.scope.query=async(...args)=>{const r=await q(...args);Object.assign(r.rows[0].result,patch);return r;};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan));assert.equal(f.mutationCalls(),0);}
});
await check('invoice v1 command is not upgraded, rewritten or resent as v2',async()=>{
 const oldInput={...plan,contract_version:'utilities-monthly-input.v1'};delete oldInput.source_hash_contract;const f=fixture();await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,oldInput));assert.equal(f.calls.length,0);
});
await check('expiry/revoke during read wait preserves current denial and stops effect',async()=>{
 for(const cause of ['expired','revoked']){const f=fixture(),err=Object.assign(Error(cause),{code:'42501'});f.scope.query=async()=>{await Promise.resolve();throw err;};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),e=>e===err);assert.equal(f.mutationCalls(),0);}
});
await check('same40001 and UNKNOWN after prepared read survive unchanged; no local retry or success',async()=>{
 for(const code of ['40001','08006','42501']){const f=fixture(),q=f.scope.query,err=Object.assign(Error('controlled effect failure'),{code});let tries=0;f.scope.query=async(sql,args)=>{if(sql===api.UTILITIES_MONTHLY_INPUT_SQL_V1){tries++;throw err;}return q(sql,args);};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan),e=>e===err);assert.equal(tries,1);}
});
await check('scope drift during preparation and creator disclosure are blocked',async()=>{
 const f=fixture();f.afterRead(()=>{f.scope.attempt++;});await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plan));assert.equal(f.mutationCalls(),0);
 const g=fixture(),v=await api.readUtilitiesInvoiceReviewSourceV1(g.scope,{context_id:g.command.context_id,workspace_id:g.scope.workspace_id,authority_version:7,source_id:plan.source_id});assert.ok(!('origin_actor_id'in v));assert.ok(!('origin_record_id'in v));assert.equal(v.source_hash_contract,'utilities-invoice-content.v2');
});
const sql=readFileSync(resolve(root,'supabase/proposals/utilities-monthly-input-v1/producer.sql'),'utf8'),integrity=readFileSync(resolve(root,'supabase/proposals/utilities-monthly-input-v1/origin-integrity.sql'),'utf8');
function sourcePolicy(body,guard){
 assert.ok(body.includes("values(tenant,task.id,auth.uid(),'submitted'"));
 assert.ok(body.includes("'contract_version','utilities-invoice-origin.v1'"));
 assert.ok((body.match(/origin\.actor_id is null or origin\.actor_id=auth\.uid\(\)/g)||[]).length>=3);
 const review=body.slice(body.indexOf("elsif op='review_invoice' then\n  select"),body.indexOf(" else\n  select * into r"));
 assert.ok(review.indexOf("reason='utilities.invoice.origin.v1' for share")<review.indexOf('if origin.actor_id is null'));
 assert.ok(review.indexOf('if origin.actor_id is null')<review.indexOf('update utilities.provider_invoices set status'));
 assert.ok(body.includes("'source_image',before_row,'origin_record_id',origin.id,'ingested_by',origin.actor_id"));
 assert.ok(body.includes("'source_hash_contract','utilities-invoice-content.v2'"));
 for(const k of ['scope','invoice','contract','provenance','lines'])assert.ok(body.includes(`'${k}',`));
 assert.ok(body.includes('utility_review_content_changed'));assert.ok(body.includes("p_input->>'contract_version' is distinct from 'utilities-monthly-input.v2'"));
 const preparation=body.slice(body.indexOf('create function utilities.read_invoice_review_source_v1'));
 assert.ok(preparation.includes('where id=p_source and tenant_id=tenant for update'));
 assert.ok(preparation.includes("status in('open','assigned') for update"));
 assert.ok(guard.includes('new.actor_id is distinct from auth.uid()'));assert.ok(guard.includes("new.after_snapshot->>'source_id' is distinct from binding.invoice_id::text"));
 assert.ok(guard.includes("on utilities.review_decisions(tenant_id,(after_snapshot->>'source_id'))"));
 assert.ok(guard.includes('before insert or update or delete'));assert.ok(guard.includes('utility_invoice_provenance_immutable'));
 assert.ok(guard.includes("old.approved_snapshot->>'contract_version'='utilities-invoice-approval.v2'"));
 assert.ok(guard.includes("to_jsonb(new)-array['status','updated_at','ledger_journal_id']"));
 assert.ok(guard.includes('utility_invoice_approved_version_immutable'));
 assert.ok(!/grant\s|create role|insert into (finance|billing|payments)\./i.test(body+guard));
}
await check('static actual SQL source: immutable canonical origin, full version and late guard (NOT compile proof)',()=>sourcePolicy(sql,integrity));
await check('coherent source negatives: removing separation, reverting per-task uniqueness or allowing origin rewrite rejected',()=>{
 assert.throws(()=>sourcePolicy(sql.replaceAll('origin.actor_id=auth.uid()','false'),integrity));
 assert.throws(()=>sourcePolicy(sql,integrity.replace("(tenant_id,(after_snapshot->>'source_id'))",'(tenant_id,task_id)')));
 assert.throws(()=>sourcePolicy(sql,integrity.replaceAll('new.actor_id is distinct from auth.uid()','false')));
 assert.throws(()=>sourcePolicy(sql.replaceAll('utility_review_content_changed','unused'),integrity));
 assert.throws(()=>sourcePolicy(sql,integrity.replaceAll('utility_invoice_approved_version_immutable','unused')));
 assert.throws(()=>sourcePolicy(sql.replace('where id=p_source and tenant_id=tenant for update','where id=p_source and tenant_id=tenant for share'),integrity));
});
assert.equal(api.UTILITIES_MONTHLY_INPUT_RUNTIME_BINDING,null);
console.log(JSON.stringify({new_affected_groups:n,result:'PASS',sql_parser_compile_pg_auth:'NOT_RUN',target_writes:0,proof:'controlled actual adapter and static source only'}));
