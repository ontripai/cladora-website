/** Exact source identities/admission; no SQL parser, compilation or execution. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),source=process.argv.find(a=>a.startsWith('--finance-source='))?.slice(17);
if(!source)throw Error('--finance-source required');
const read=p=>readFileSync(resolve(root,p),'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('docs/core/domain-ports-01/finance-composition-30/manifest.json'));
for(const x of manifest.inventory){const b=readFileSync(resolve(root,x.path));assert.equal(b.length,x.bytes,x.path);assert.equal(hash(b),x.sha256,x.path);}
for(const x of manifest.finance.source_pins){const b=readFileSync(resolve(source,x.path));assert.equal(b.length,x.bytes,x.path);assert.equal(hash(b),x.sha256,x.path);}
const query=JSON.parse(read('src/lib/core/finance-monthly-query-profile-v1.json'));
const finance=p=>readFileSync(resolve(source,'src/lib/customer/finance-monthly-bridge-v1',p),'utf8');
assert.equal(query.finance_head,manifest.finance.full_sha);
assert.equal(query.plan,finance('plan.ts').match(/FINANCE_MONTHLY_PLAN_SQL_V1=`([\s\S]*?)`;/)[1]);
assert.equal(query.readback,finance('provider.ts').match(/`(select k.actor_id[\s\S]*?)`,/)[1]);
assert.equal(query.validation,finance('provider.ts').match(/scope.query\(`(select cy.id[\s\S]*?)`,/)[1]);
assert.ok(finance('provider.ts').includes("'"+query.mutation+"'"));
assert.ok(finance('provider.ts').includes('receipt.mutation_id!==payload.cycle_id'));
const base=read('supabase/proposals/core-service-authoring-custody-v1/preflight.sql');
const current=read('supabase/proposals/core-finance-monthly-binding-v1/preflight.sql');
const oldPins=[...base.matchAll(/\('app_private\.[^\n]+/g)].map(x=>x[0]);for(const pin of oldPins)assert.ok(current.includes(pin),pin);
const sql=read('supabase/proposals/core-finance-monthly-binding-v1/checkpoint.sql');
assert.ok(sql.indexOf('core_functional_checkpoint_v1')<sql.indexOf('t:=clock_timestamp()'));
assert.ok(sql.indexOf('FOR SHARE;')<sql.indexOf('t:=clock_timestamp()'));
for(const token of ['stored.expires_at<=t','stored.response_ref IS DISTINCT FROM expected_receipt','stored.request_hash IS DISTINCT FROM request_hash'])assert.ok(sql.includes(token),token);
for(const token of['require_request_session_current_at_v1(t)','resolve_workspace_native_context_v2_at_v1(ctx,ws,t)','resolve_workspace_from_customer_context_v1_at_v1(ctx,false,t)','check_workspace_native_permission_v2_at_v1(ctx,ws,permission,module,t)',"'billing.issue','billing',t"])assert.ok(sql.includes(token),token);
assert.ok(!/EXCEPTION\s+WHEN/i.test(sql));assert.ok(!/\bGRANT\s+(EXECUTE|ALL|USAGE)/i.test(sql));
assert.equal(manifest.runtime,null);assert.equal(manifest.native,'NOT_RUN_NOT_PASS');
console.log(JSON.stringify({source_pins:manifest.finance.source_pins.length,postimage_pins:manifest.inventory.length,recursive_fresh_pins:oldPins.length,source:'PASS',SQL:'NOT_RUN_NOT_PASS',target:null}));
