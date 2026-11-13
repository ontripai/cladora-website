/** Actual Finance75 source rebind + Core SQL source contract. No SQL parsing/run. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(new URL('..',import.meta.url).pathname),digest=b=>createHash('sha256').update(b).digest('hex');
export function inspectCoreFinanceInvoiceReaderV2(sql){
 const body=sql.match(/AS \$reader\$([\s\S]*?)\$reader\$/)?.[1];assert.ok(body);
 for(const token of['finance.require_invoice_source_scope_v2(p_context,p_workspace,p_permission,p_module,p_cycle)','core_finance_monthly_checkpoint_v1(p_context,p_workspace,p_permission,p_module,revision)','row_security_active(rel.oid)','policy.polroles IS DISTINCT FROM ARRAY[who.oid]','pg_get_expr(policy.polqual','pg_get_expr(policy.polwithcheck','p.polcmd IN (\'r\',\'w\',\'*\')','records:=array_append(records,d)','origins=0 OR approvals=0','FOR SHARE OF rd'])assert.ok(body.includes(token),token);
 const tasks=body.indexOf('FOR task IN SELECT'),rows=body.indexOf('FOR d IN SELECT'),buffer=body.indexOf('records:=array_append'),fresh=body.lastIndexOf('t:=clock_timestamp()'),ret=body.indexOf('RETURN NEXT');
 assert.ok(tasks<rows&&rows<buffer&&buffer<fresh&&fresh<ret);
 assert.match(body.slice(tasks,rows),/ORDER BY rt.id FOR UPDATE/);
 const scan=body.slice(rows,buffer);assert.ok(!/\b(limit|offset)\b|actor_id\s*=|task_id\s*=\s*p_/i.test(scan));
 assert.ok(!/\b(INSERT\s+INTO|UPDATE\s+[a-z_.]+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|SECURITY\s+DEFINER)\b/i.test(sql.replace(/^\s*--.*$/gm,'')));
 assert.equal((sql.match(/SECURITY INVOKER/g)||[]).length,3);
 for(const tag of ['origin_scope','decision_scope']){const b=sql.match(new RegExp('AS \\$'+tag+'\\$([\\s\\S]*?)\\$'+tag+'\\$'))[1];assert.ok(sql.includes(digest(b)));}
 const projection=sql.match(/AS \$origin_scope\$([\s\S]*?)\$origin_scope\$/)[1];
 assert.ok(projection.includes('finance.require_invoice_source_scope_v2(ctx,ws,permission,module,cycle)'));
 assert.ok(!/WHEN[^;]*42501/.test(projection));
 assert.ok(projection.includes("RAISE EXCEPTION 'finance_invoice_reader_denied' USING ERRCODE='42501'"));
 assert.ok(!/WHEN\s+(OTHERS|'40001'|SQLSTATE\s+'40001')/i.test(sql));
 return {source:'PASS',functions:3};
}
export function checkCoreFinance75RebindV2(source){
 const read=p=>readFileSync(resolve(root,p)),m=JSON.parse(read('docs/core/domain-ports-01/finance-private-reader-31/manifest.json'));
 for(const pin of m.inventory){const b=read(pin.path);assert.equal(b.length,pin.bytes,pin.path);assert.equal(digest(b),pin.sha256,pin.path);}
 for(const pin of m.protected_pins){assert.equal(digest(read(pin.path)),pin.sha256,pin.path);}
 for(const pin of m.finance.source_pins){const b=readFileSync(resolve(source,pin.path));assert.equal(b.length,pin.bytes,pin.path);assert.equal(digest(b),pin.sha256,pin.path);}
 const previous=JSON.parse(read('docs/core/domain-ports-01/finance-composition-30/manifest.json'));
 const current=JSON.parse(read('src/lib/core/finance-monthly-query-profile-v1.json'));
 assert.equal(current.finance_head,'75c51eac67408b181b014749a393997c8363cda4');
 const {finance_head: _head,...wire}=current;assert.equal(digest(JSON.stringify(wire)),m.query_profile_without_identity_sha256);
 let changed=0;for(const pin of previous.finance.source_pins){const b=readFileSync(resolve(source,pin.path));if(digest(b)!==pin.sha256){changed++;assert.equal(pin.path,'supabase/install/fin-monthly-e2e-01/domain-kernel-v1.sql');}}
 assert.equal(changed,1);
 const owner=readFileSync(resolve(source,'supabase/install/fin-monthly-e2e-01/invoice-content-v2.sql'),'utf8');
 assert.ok(owner.includes('app_private.lock_finance_invoice_decisions_v2(p_context,p_workspace,p_permission,p_module,p_cycle,p_invoice)'));
 for(const name of ['finance.require_invoice_source_scope_v2','finance.monthly_invoice_snapshot_v2','app_private.capture_monthly_cycle_source_internal_v1']){
  const start=owner.toLowerCase().indexOf('function '+name),end=owner.toLowerCase().indexOf('as ',start);assert.ok(start>=0);assert.ok(owner.slice(start,end).toLowerCase().includes('security invoker'),name);
 }
 assert.equal(m.runtime,null);return {finance:m.finance.head,old_pins_unchanged:9,kernel_rebound:1,proof:'SOURCE_ONLY',native:'NOT_RUN_NOT_PASS'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const source=process.argv.find(a=>a.startsWith('--finance-source='))?.slice(17);if(!source)throw Error('--finance-source required');
 console.log(JSON.stringify({...inspectCoreFinanceInvoiceReaderV2(readFileSync(resolve(root,'supabase/proposals/core-finance-invoice-decisions-v2/reader.sql'),'utf8')),...checkCoreFinance75RebindV2(source)}));
}
