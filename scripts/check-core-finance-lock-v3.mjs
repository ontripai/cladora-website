/** Only Finance763's newly reachable ENTRY/lock coupling, no healthy suite imports. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(new URL('..',import.meta.url).pathname),arg=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3),hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--source-only')){
 const dir='supabase/proposals/core-finance-invoice-decisions-v2/';
 const reader=readFileSync(resolve(root,dir+'reader.sql'),'utf8'),parent=execFileSync('git',['show','a2ad62a29e522745e91fb6f2170c97ce892131f8:'+dir+'reader.sql'],{cwd:root,encoding:'utf8'});
 assert.equal(hash(parent),'3dfe4be4c032e90fa0800f9bb5f7957f2ba7f796b2be47dabe9933b2a8288d96');
 const oldStart=parent.indexOf(' -- ROW SHARE conflicts'),oldEnd=parent.indexOf(' FOR rel IN SELECT',oldStart);
 const start=reader.indexOf(' -- Take the SAME RowShareLock'),end=reader.indexOf(' FOR rel IN SELECT',start);
 assert.ok(start>0&&end>start&&oldStart>0&&oldEnd>oldStart);
 const replacement=reader.slice(start,end);
 const expected=' PERFORM rt.id FROM utilities.review_tasks rt WHERE false FOR SHARE OF rt;\n PERFORM rd.id FROM utilities.review_decisions rd WHERE false FOR SHARE OF rd;\n';
 assert.ok(replacement.endsWith(expected));assert.equal(parent.slice(0,oldStart)+replacement+parent.slice(oldEnd),reader);
 const valid=s=>s===reader&&s.includes(expected);assert.ok(valid(reader));
 for(const negative of [parent,reader.replace(' FOR SHARE OF rt',''),reader.replace('WHERE false FOR SHARE OF rd','WHERE true FOR SHARE OF rd'),reader.replace(expected,''),reader+'\nGRANT UPDATE ON utilities.review_tasks TO PUBLIC;'])assert.ok(!valid(negative));
 const definition='CREATE OR REPLACE FUNCTION '+reader.split('CREATE FUNCTION ')[3].split('\n\nREVOKE ALL')[0];
 const upgrade=readFileSync(resolve(root,dir+'upgrade-rowshare-v3.sql'),'utf8');assert.equal(upgrade.split('EXECUTE $definition$')[1].split('$definition$;')[0],definition);
 for(const guard of ['before_row.proowner','before_row.proacl','before_row.proargtypes','before_row.prorettype','before_row.proconfig','finance_reader_upgrade_preimage_mismatch','finance_reader_upgrade_postimage_mismatch'])assert.ok(upgrade.includes(guard));
 const body=reader.match(/AS \$reader\$([\s\S]*?)\$reader\$/)[1];assert.ok(readFileSync(resolve(root,dir+'verify.sql'),'utf8').includes(hash(body)));assert.ok(upgrade.includes(hash(body)));
 console.log(JSON.stringify({new_source_groups:3,result:'PASS',whole_parent_delta:'ONLY_RELATION_LOCK_ADMISSION',unknown_or_weak_query_rejected:true,upgrade_exact_definition:true,native_lock_retention:'NOT_RUN_NOT_PASS'}));process.exit(0);
}
const inventoryPath=arg('inventory'),financeBase=arg('finance-base'),pglite=arg('pglite-module'),output=arg('out'),upgradeOnly=process.argv.includes('--upgrade-only');
assert.ok(inventoryPath&&financeBase&&pglite&&output,'EXACT_INPUTS_REQUIRED');
const inventory=readFileSync(inventoryPath);assert.equal(hash(inventory),'ed8c1d4412a94fea01c077a128de47340cdd4dabe7a3ab03b723f617b9f1cf2f');
const packet=JSON.parse(inventory);assert.equal(packet.manifest.Head,'7638f9145f17785ad4bb29108e6c30ac6479e86f');
const out=resolve(output),run=resolve(out,'finance763');mkdirSync(run,{recursive:true});
for(const row of packet.inventory){assert.ok(!row.path.includes('..')&&!row.path.startsWith('/'));const b=Buffer.from(row.afterimage);assert.equal(b.length,row.bytes);assert.equal(hash(b),row.after_sha256);const dest=resolve(run,row.path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b);}
const fixture=readFileSync(resolve(financeBase,'scripts/fin-monthly-e2e-01/invoice-v2-fixture.sql'));assert.equal(hash(fixture),'94b70de0118b3c0b435d3a71f36b26061c408a9074eb0e1b2fe343dc5d5bec58');writeFileSync(resolve(run,'scripts/fin-monthly-e2e-01/invoice-v2-fixture.sql'),fixture);
const harnessPath=resolve(run,'scripts/fin-monthly-e2e-01/test-invoice-entry-delta.mjs'),original=readFileSync(harnessPath,'utf8');assert.equal(hash(original),'77f4510fa3bf3f3f472d259269e0e7a2632ec4704b5f1222538e98e59f18c0bd');
const reader=readFileSync(resolve(root,'supabase/proposals/core-finance-invoice-decisions-v2/reader.sql'),'utf8'),body=reader.match(/AS \$reader\$([\s\S]*?)\$reader\$/)[1];
let adapted=original;for(const[old,next]of[['3dfe4be4c032e90fa0800f9bb5f7957f2ba7f796b2be47dabe9933b2a8288d96',hash(reader)],['1ab4160f37d53d3f8b8f6f7056645cc2ed8ce0aed3e4a03b477fbd723e1c01e1',hash(body)]]){assert.equal(adapted.split(old).length-1,1);adapted=adapted.replace(old,next);}
const anchor="  assert.deepEqual(await settings(),['','','','']);ok(true,'success restores all four initially empty selectors');";
const focusedBlock="\n  const held=(await db.query(\"select relation::regclass::text rel,mode,granted from pg_locks where pid=pg_backend_pid() and relation in ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass) order by 1,2\")).rows;\n  console.log('HELD_LOCKS',JSON.stringify(held));\n  // Retain the failed lock-observation probe separately. Empty WASM pg_locks\n  // cannot attest transaction lock retention; native caseplan still asserts it.\n  const rights=(await db.query(\"select has_table_privilege(current_user,'utilities.review_tasks','UPDATE') broad_update,has_table_privilege(current_user,'utilities.review_tasks','MAINTAIN') maintain,has_column_privilege(current_user,'utilities.review_tasks','id','UPDATE') id_update\")).rows[0];\n  assert.deepEqual(rights,{broad_update:false,maintain:false,id_update:true});\n  await db.exec('savepoint old_table_lock');let lockError;try{await db.exec('LOCK TABLE utilities.review_tasks,utilities.review_decisions IN ROW SHARE MODE');}catch(e){lockError=e;}assert.equal(lockError?.code,'42501');await db.exec('rollback to savepoint old_table_lock');\n  const zero=(await db.query('select rt.id from utilities.review_tasks rt where false for share of rt')).rows;assert.deepEqual(zero,[]);\n  ok(true,'same-role old table LOCK rejected 42501; zero-tuple FOR SHARE succeeds without table UPDATE/MAINTAIN or business rows');";
if(upgradeOnly){
 const parent=execFileSync('git',['show','a2ad62a29e522745e91fb6f2170c97ce892131f8:supabase/proposals/core-finance-invoice-decisions-v2/reader.sql'],{cwd:root});assert.equal(hash(parent),'3dfe4be4c032e90fa0800f9bb5f7957f2ba7f796b2be47dabe9933b2a8288d96');writeFileSync(resolve(out,'a2ad-reader.sql'),parent);
 const boundary=adapted.indexOf(' const id=n=>');assert.ok(boundary>0);adapted=adapted.slice(0,boundary);
 const load='await db.exec(text(paths.reader));';assert.equal(adapted.split(load).length-1,1);adapted=adapted.replace(load,"await db.exec(readFileSync(process.env.CORE33_PARENT_READER,'utf8'));await db.exec(readFileSync(process.env.CORE33_UPGRADE,'utf8'));");
 adapted+=`let repeatError;try{await db.exec(readFileSync(process.env.CORE33_UPGRADE,'utf8'));}catch(e){repeatError=e;}assert.equal(repeatError?.code,'55000');await db.exec('rollback');
console.log(JSON.stringify({result:'PASS_EMBEDDED_GUARDED_UPGRADE_AND_REAPPLY_DENIAL',checks:2}));}finally{await db.close();}
`;
}else{assert.equal(adapted.split(anchor).length-1,1);adapted=adapted.replace(anchor,anchor+focusedBlock);}
writeFileSync(harnessPath,adapted);if(process.argv.includes('--prepare-only')){console.log(JSON.stringify({prepared_harness_sha256:hash(adapted)}));process.exit(0);}const receipt=resolve(out,'raw-receipt.json');
const env={FIN_MONTHLY_PGLITE_MODULE:resolve(pglite),FIN_INVOICE_CORE32_ROOT:root,FIN_INVOICE_CORE31_ROOT:root,FIN_INVOICE_CORE1F_ROOT:root,FIN_INVOICE_CORE30_ROOT:root,FIN_ENTRY_RUNTIME_RECEIPT:receipt,CORE33_PARENT_READER:resolve(out,'a2ad-reader.sql'),CORE33_UPGRADE:resolve(root,'supabase/proposals/core-finance-invoice-decisions-v2/upgrade-rowshare-v3.sql'),TZ:'UTC'};
let stdout;try{stdout=execFileSync(process.execPath,[harnessPath],{cwd:run,env,encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});}catch(error){writeFileSync(resolve(out,'failed-stdout.txt'),String(error.stdout??''));writeFileSync(resolve(out,'failed-stderr.txt'),String(error.stderr??''));throw error;}
writeFileSync(resolve(out,'stdout.txt'),stdout);const last=JSON.parse(stdout.trim().split('\n').at(-1));
assert.equal(last.result,upgradeOnly?'PASS_EMBEDDED_GUARDED_UPGRADE_AND_REAPPLY_DENIAL':'PASS_CONTROLLED_ENTRY_DELTA_ONLY_PENDING_INDEPENDENT_QA');assert.equal(last.checks,upgradeOnly?2:12);
const raw=JSON.parse(readFileSync(receipt));
const evidence={schema:'core-finance-lock-coupling.v3',parent:'a2ad62a29e522745e91fb6f2170c97ce892131f8',Finance:packet.manifest.Head,original_harness_sha256:hash(original),adapted_harness_sha256:hash(adapted),reader_sha256:hash(reader),reader_body_sha256:hash(body),raw_receipt_sha256:hash(readFileSync(receipt)),result:last,names:raw.names??[],substitutions:['Auth/C01/session/resolver schema/role synthetic in ephemeral WASM; exact six RLS policies','actual Core utilities producer creates synthetic input and independent review','post-wait denial/expiry/40001 simulated; not two-connection native waits'],native_lock_retention:'NOT_PROVEN_WASM_PG_LOCKS_EMPTY',historical_cde_runtime:'UNPROVEN',target_SQL:0,runtime:null,actual_role_RLS:'NOT_ADMITTED',native:'NOT_RUN_NOT_PASS'};
writeFileSync(resolve(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
