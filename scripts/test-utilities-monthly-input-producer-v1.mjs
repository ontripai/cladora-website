/** New domain-hook checks. Controlled SQL boundary, never PG/Auth/native evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=createRequire(import.meta.url),cache=new Map();
function load(path){if(cache.has(path))return cache.get(path).exports;
 const mod={exports:{}};cache.set(path,mod);
 const require=id=>{if(id==='server-only')return{};if(!id.startsWith('@/')&&!id.startsWith('.'))return native(id);
 let p=id.startsWith('@/')?resolve(root,'src',id.slice(2)):resolve(dirname(path),id);if(!extname(p))p+='.ts';
 if(p.endsWith('.json'))return JSON.parse(readFileSync(p,'utf8'));return load(p);};
 const text=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 new Function('require','module','exports',text)(require,mod,mod.exports);return mod.exports;}
const api=load(resolve(root,'src/lib/utilities/monthly-input-producer-v1.ts'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const plans=[{contract_version:'utilities-monthly-input.v1',operation:'ingest_invoice',source_id:id(1),contract_id:id(2),ingestion_document_id:id(3),external_invoice_no:'SYNTHETIC-REF',issued_on:'2026-11-01',due_on:null,period_start:'2026-10-01',period_end:'2026-11-01',currency:'RON',lines:[{service_type:'water',description:'Synthetic controlled line',line_subtotal:'100.0001',line_tax:'19.0000'}]},
 {contract_version:'utilities-monthly-input.v1',operation:'review_invoice',source_id:id(1),review_task_id:id(4),expected_source_sha256:'a'.repeat(64),decision:'approved',reason:'Synthetic review reason'},
 {contract_version:'utilities-monthly-input.v1',operation:'approve_reading',source_id:id(5),expected_source_sha256:'b'.repeat(64),note:null}];
function fixture(plan){const profile=api.UTILITIES_MONTHLY_INPUT_PROFILES_V1[plan.operation],calls=[];
 const command={contract_version:'core-transaction-command.v1',transaction_id:id(10),command_id:id(11),context_id:id(12),workspace_id:id(13),actor_id:id(14),authority_version:7,permission_code:profile.permission,module_code:'utilities',evaluation_purpose:profile.purpose,aggregate_type:profile.aggregate,aggregate_id:plan.source_id,aggregate_version:1,
 provider_source_ids:plan.operation==='ingest_invoice'?[plan.source_id,plan.contract_id,plan.ingestion_document_id]:plan.operation==='review_invoice'?[plan.source_id,plan.review_task_id]:[plan.source_id],idempotency_key:'synthetic-source-key-01',input_fingerprint:api.fingerprintUtilitiesMonthlyInputV1(plan)};
 const result={contract_version:'utilities-monthly-input-result.v1',source_relation:plan.operation==='approve_reading'?'utilities.meter_readings':'utilities.provider_invoices',source_id:plan.source_id,source_sha256:'c'.repeat(64),status:plan.operation==='ingest_invoice'?'review_required':plan.operation==='approve_reading'?'validated':plan.decision==='approved'?'approved':'void',mutation_id:plan.source_id,tenant_id:id(15),actor_id:id(14),database_transaction_id:'101'};
 const scope={transaction_id:id(10),database_transaction_id:'101',workspace_id:id(13),tenant_id:id(15),actor_id:id(14),attempt:1,query:async(sql,args)=>{calls.push({sql,args});return{rowCount:1,rows:[{result}]};}};
 return{scope,command,result,calls};}
let n=0;async function check(name,fn){if(process.argv.includes('--source')&&!name.startsWith('static'))return;if(process.argv.includes('--review-source')&&!name.startsWith('review source:'))return;await fn();console.log(`PASS ${++n}: ${name}`);}
for(const p of [...plans,{...plans[1],decision:'rejected'}])await check(`${p.operation}/${p.decision??'source'}: exact fixed same-scope query and INTERNAL mutation identity`,async()=>{
 const f=fixture(p);assert.deepEqual(await api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,p),{mutation_id:p.source_id});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].sql,api.UTILITIES_MONTHLY_INPUT_SQL_V1);
 assert.deepEqual(f.calls[0].args,[f.command.context_id,f.command.workspace_id,7,JSON.stringify(api.utilitiesMonthlyInputV1Schema.parse(p))]);});
await check('strict fields reject actor/approval/receipt/status/version and arbitrary SQL',()=>{
 for(const p of plans)for(const [k,v]of Object.entries({actor_id:id(99),approved:true,receipt:{},status:'approved',sql:'select 1',source_version:1,workspace_id:id(99)}))assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...p,[k]:v}));});
await check('money uses exact bounded decimal strings; no missing default, numeric float, exponent or excess precision',()=>{
 for(const amount of [null,1.2,'1e3','0.00001','-1','10000000000000000','NaN'])assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...plans[0],lines:[{...plans[0].lines[0],line_subtotal:amount}]}));
 assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...plans[0],lines:[]}));
 assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...plans[0],period_end:plans[0].period_start}));
 const missing={...plans[0].lines[0]};delete missing.line_tax;assert.throws(()=>api.utilitiesMonthlyInputV1Schema.parse({...plans[0],lines:[missing]}));});
await check('canonical key ordering stable; different valid line body changes fingerprint',()=>{
 const p=plans[0];assert.equal(api.fingerprintUtilitiesMonthlyInputV1(p),api.fingerprintUtilitiesMonthlyInputV1(Object.fromEntries(Object.entries(p).reverse())));
 assert.notEqual(api.fingerprintUtilitiesMonthlyInputV1(p),api.fingerprintUtilitiesMonthlyInputV1({...p,lines:[{...p.lines[0],line_subtotal:'100.0002'}]}));});
await check('foreign actor/workspace/transaction/operation permission/purpose/hash/source rejected BEFORE query',async()=>{
 for(const patch of [{actor_id:id(99)},{workspace_id:id(99)},{transaction_id:id(99)},{module_code:'services_catalog'},{permission_code:'utilities.manage'},{evaluation_purpose:'service.create_request'},{aggregate_id:id(99)},{input_fingerprint:'sha256:'+'d'.repeat(64)},{provider_source_ids:[id(99)]}]){
 const f=fixture(plans[0]);await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,{...f.command,...patch},plans[0]));assert.equal(f.calls.length,0);}});
await check('canonical denial/expiry/revoke after controlled wait preserve failure; no local success',async()=>{
 for(const cause of ['revoked','expired','foreign scope']){const f=fixture(plans[0]),err=Object.assign(Error(cause),{code:'42501'});f.scope.query=async()=>{await Promise.resolve();throw err;};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plans[0]),e=>e===err);}});
await check('same 40001/cancellation/timeout/UNKNOWN error object preserved; no retry/COMMIT/cleanup engine',async()=>{
 for(const code of ['40001','57014','55P03','08006']){const f=fixture(plans[1]),err=Object.assign(Error('synthetic transport failure'),{code});let attempts=0;f.scope.query=async()=>{attempts++;throw err;};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plans[1]),e=>e===err);assert.equal(attempts,1);}});
await check('scope mutation during wait rejected',async()=>{for(const key of ['actor_id','tenant_id','workspace_id','transaction_id','database_transaction_id','attempt']){const f=fixture(plans[0]),q=f.scope.query;f.scope.query=async(...args)=>{const r=await q(...args);f.scope[key]=key==='attempt'?2:id(99);return r;};await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plans[0]));}});
await check('malformed/foreign source result cannot produce mutation evidence',async()=>{for(const patch of [{actor_id:id(99)},{tenant_id:id(99)},{database_transaction_id:'999'},{source_id:id(99)},{mutation_id:id(99)},{status:'approved'},{source_sha256:'invalid'}]){const f=fixture(plans[0]);Object.assign(f.result,patch);await assert.rejects(api.mutateUtilitiesMonthlyInputV1(f.scope,f.command,plans[0]));}});
function checkSql(source){
 for(const name of ['monthly_input_actor_v1','produce_monthly_input_v1','read_invoice_review_source_v1'])assert.ok(source.includes(`create function utilities.${name}`));
 assert.equal((source.match(/security invoker/g)||[]).length,3);
 assert.ok(!/security definer|grant\s|insert into (finance|billing|payments|platform\.)|exception\s+when/i.test(source));
 assert.ok(source.includes("t:=clock_timestamp();"));assert.ok(source.includes('check_effective_permission_v2_at_v1'));
 const writer=source.slice(source.indexOf('create function utilities.produce_monthly_input_v1'),source.indexOf('end $producer$;'));
 assert.ok(writer.lastIndexOf('perform utilities.monthly_input_actor_v1')>writer.indexOf('perform utilities.approve_reading'));
 assert.ok(writer.includes("jsonb_build_object('invoice',to_jsonb(i),'lines',line_image)"));
 assert.ok(writer.indexOf('from utilities.provider_invoice_lines where invoice_id=source')<writer.indexOf('before_row:='));
 const reader=source.slice(source.indexOf('create function utilities.read_invoice_review_source_v1'));
 assert.ok(!/\b(insert into|update utilities\.|delete from)\b/i.test(reader));
 assert.ok(source.includes('into utilities.review_decisions'));assert.ok(source.includes('auth.uid(),p_input'));
 assert.ok(source.includes('revoke all on function'));assert.ok(!/Date\.now|statement_timestamp\(\)/.test(source));
}
await check('static domain closure: canonical evidence/review/reading and final fresh guard; NOT SQL compile',()=>{
 const sql=readFileSync(resolve(root,'supabase/proposals/utilities-monthly-input-v1/producer.sql'),'utf8');checkSql(sql);
 const broken=sql.replace(/ -- Recheck[\s\S]*?perform utilities\.monthly_input_actor_v1[^;]+;/,'');assert.throws(()=>checkSql(broken));
 for(const b of [sql.replaceAll('security invoker','security definer'),sql+'\ngrant execute on function arbitrary() to public;',sql.replaceAll('check_effective_permission_v2_at_v1','check_effective_permission_v2')])assert.throws(()=>checkSql(b));});
await check('review source: real source adapter uses a single fixed read query, no command/reservation/write',async()=>{
 const f=fixture(plans[1]),calls=[];f.scope.query=async(sql,args)=>{calls.push({sql,args});return{rowCount:1,rows:[{result:{contract_version:'utilities-invoice-review-source.v1',source_id:id(1),review_task_id:id(4),source_sha256:'d'.repeat(64),tenant_id:f.scope.tenant_id,actor_id:f.scope.actor_id,database_transaction_id:f.scope.database_transaction_id}}]};};
 assert.deepEqual(await api.readUtilitiesInvoiceReviewSourceV1(f.scope,{context_id:id(12),workspace_id:id(13),authority_version:7,source_id:id(1)}),{source_id:id(1),review_task_id:id(4),source_sha256:'d'.repeat(64)});
 assert.deepEqual(calls,[{sql:api.UTILITIES_INVOICE_REVIEW_SOURCE_SQL_V1,args:[id(12),id(13),7,id(1)]}]);
});
await check('review source: foreign/malformed/scope drift/late denial/same40001 cannot become preparation success',async()=>{
 const selected={context_id:id(12),workspace_id:id(13),authority_version:7,source_id:id(1)};
 const f=fixture(plans[1]);await assert.rejects(api.readUtilitiesInvoiceReviewSourceV1(f.scope,{...selected,workspace_id:id(99)}));assert.equal(f.calls.length,0);
 await assert.rejects(api.readUtilitiesInvoiceReviewSourceV1(f.scope,{...selected,approved:true}));assert.equal(f.calls.length,0);
 for(const code of ['40001','42501','08006']){const err=Object.assign(Error('controlled read failure'),{code});f.scope.query=async()=>{throw err;};await assert.rejects(api.readUtilitiesInvoiceReviewSourceV1(f.scope,selected),e=>e===err);}
 f.scope.query=async()=>({rowCount:0,rows:[]});await assert.rejects(api.readUtilitiesInvoiceReviewSourceV1(f.scope,selected));
 f.scope.query=async()=>{f.scope.attempt++;return{rowCount:1,rows:[]};};await assert.rejects(api.readUtilitiesInvoiceReviewSourceV1(f.scope,selected));
});
assert.equal(api.UTILITIES_MONTHLY_INPUT_RUNTIME_BINDING,null);
console.log(JSON.stringify({new_groups:n,status:'PASS',proof:'controlled domain adapter + static source only',native:'NOT_RUN',target_writes:0}));
