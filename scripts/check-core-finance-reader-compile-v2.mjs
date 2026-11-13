/** Same real Finance cde harness; only expected source/body pins advance.
 * Explicit user-authorized embedded WASM only, never a server/target connection. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3),hash=s=>createHash('sha256').update(s).digest('hex');
const receipt=arg('receipt'),finance=arg('finance-source'),pgliteModule=arg('pglite-module'),out=arg('out'),compileOnly=process.argv.includes('--compile-only');
if(!receipt||!finance||!pgliteModule||!out)throw Error('EXACT_RECEIPT_FINANCE_MODULE_AND_OUTPUT_REQUIRED');
const bytes=readFileSync(receipt);assert.equal(bytes.length,28369);assert.equal(hash(bytes),'b413f605d69460c450e10a3e5c02fe0adaede5a2536a5c33d83cdfb26d6a5879');
const packet=JSON.parse(bytes),original=packet.Finance_coupling_test.afterimage_utf8;
assert.equal(hash(original),'322440a82dcbdede7301195f8ee369d153fca31f549c42dc9c1a2a906de85f3d');
const sql=readFileSync(resolve(root,'supabase/proposals/core-finance-invoice-decisions-v2/reader.sql'),'utf8'),body=sql.match(/AS \$reader\$([\s\S]*?)\$reader\$/)[1];
let adapted=original;for(const[old,value]of[['6eb71c153839f3774fb9a04930e30830c3c3e0fa816a69a793fe8465e56deaa8',hash(sql)],['815759f80526b8386cad743603159ee0fb5e7b897aa777f3fc95ab15bd7a47dd',hash(body)]]){assert.equal(adapted.split(old).length-1,1);adapted=adapted.replace(old,value);}
if(compileOnly){
 const boundary=adapted.indexOf('// Grants below belong');assert.ok(boundary>0);
 adapted=adapted.slice(0,boundary).replace('try{await db.exec(reader);}',`assert.equal((await db.query("select current_setting('check_function_bodies') as setting")).rows[0].setting,'on');
try{await db.exec(reader);}`);
 adapted+=`
const probe=(await db.query("select current_setting('check_function_bodies') as setting,version() as embedded_version")).rows[0];
assert.equal(probe.setting,'on');
const functions=(await db.query("select count(*)::int n from pg_proc where pronamespace='app_private'::regnamespace and proname in ('finance_invoice_origin_scope_v2','finance_invoice_decision_scope_v2','lock_finance_invoice_decisions_v2')")).rows[0].n;assert.equal(functions,3);
console.log(JSON.stringify({result:'COMPILE_ONLY_VALIDATOR_ON_PASS',check_function_bodies:probe.setting,embedded_version:probe.embedded_version,functions,SQL_target:0,native:'NOT_RUN_NOT_PASS'}));await db.close();
`;
}
mkdirSync(out,{recursive:true});const harness=resolve(out,'actual-finance-cde-harness-with-new-pins.mjs');writeFileSync(harness,adapted);
// No inherited database URLs, Supabase credentials, tokens or arbitrary NODE_OPTIONS.
const env={FIN_MONTHLY_PGLITE_MODULE:resolve(pgliteModule),FIN_INVOICE_CORE31_ROOT:root,FIN_INVOICE_CORE1F_ROOT:root,FIN_INVOICE_CORE30_ROOT:root,TZ:'UTC'};
let stdout;try{stdout=execFileSync(process.execPath,[harness],{cwd:resolve(finance),env,encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});}catch(error){writeFileSync(resolve(out,'failed-stdout.txt'),String(error.stdout??''));writeFileSync(resolve(out,'failed-stderr.txt'),String(error.stderr??''));throw error;}
writeFileSync(resolve(out,'stdout.txt'),stdout);const record=JSON.parse(stdout.trim().split('\n').at(-1));
assert.equal(record.result,compileOnly?'COMPILE_ONLY_VALIDATOR_ON_PASS':'EXPECTED_NOT_READY_ON_ACTUAL_READER','BLOCKED/fixture success is not compile/coupling closure');
if(compileOnly){assert.equal(record.check_function_bodies,'on');assert.equal(record.functions,3);}else{assert.equal(record.checks,4);assert.equal(record.actual_role_RLS,'NOT_ADMITTED');}
const evidence={contract_version:'core-finance-reader-embedded-compile.v2',reader_file_sha256:hash(sql),reader_body_sha256:hash(body),original_harness_sha256:hash(original),adapted_harness_sha256:hash(adapted),adaptation:compileOnly?'SAME_PRE_GRANT_HARNESS_PREFIX_PLUS_READ_ONLY_VALIDATOR_ON_AND_VERSION_ASSERTIONS':'TWO_EXPECTED_HASH_LITERALS_ONLY',result:record,fixture_sha256:hash(readFileSync(resolve(finance,'scripts/fin-monthly-e2e-01/invoice-v2-fixture.sql'))),module_path_private:true,toolchain_owner_version_match:'NOT_CONFIRMED',PostgreSQL_server_native:'NOT_RUN_NOT_PASS',target_SQL:0,runtime_binding:null};
writeFileSync(resolve(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
