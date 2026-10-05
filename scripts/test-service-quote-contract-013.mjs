import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the actual TypeScript schemas; do not mirror their validation rules.
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const localRequire = id => id.startsWith('.') ? load(new URL(`${id}.ts`, file))
    : id.startsWith('@/') ? load(new URL(`../src/${id.slice(2)}.ts`, import.meta.url)) : require(id);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}
const { createServiceQuoteDraftSchema: schema, checkServiceQuoteRequest: check } = load(new URL('../src/lib/customer/service-quote-schema.ts', import.meta.url));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const quote={context_id:id,workspace_id:id,request_id:id,published_revision_id:id,scope:'Synthetic maintenance quote',total_minor:'12345',currency:'RON',payer_shares:[{party_id:id,amount_minor:'2345'},{party_id:other,amount_minor:'10000'}],valid_until:'2026-10-06T12:00:00Z',idempotency_key:'service-quote-013'};
let cases=0;
function valid(value, expected){assert.equal(schema.safeParse(value).success,expected);cases++;}
valid(quote,true);
for(const field of Object.keys(quote))valid({...quote,[field]:undefined},false);
for(const field of ['context_id','workspace_id','request_id','published_revision_id']) for(const value of [null,'bad'])valid({...quote,[field]:value},false);
for(const field of ['actor_id','tenant_id','provider_party_id','beneficiary_party_id','status','quote_version','order_id','accepted_by','payment_id','work_order_id'])valid({...quote,[field]:id},false);
for(const total_minor of ['-1','01','1.23','1e2',' 12345','1000000000000000000',12345,null])valid({...quote,total_minor},false);
for(const currency of ['JPY','ron','XXX',null])valid({...quote,currency},false);
for(const payer_shares of [[],[{party_id:id,amount_minor:'12344'}],[{party_id:id,amount_minor:'12346'}],[{party_id:id,amount_minor:'1'},{party_id:id.toUpperCase(),amount_minor:'12344'}],[{party_id:id,amount_minor:'12345',accepted:true}],[{party_id:'bad',amount_minor:'12345'}]])valid({...quote,payer_shares},false);
valid({...quote,total_minor:'9007199254740993',payer_shares:[{party_id:id,amount_minor:'9007199254740992'},{party_id:other,amount_minor:'1'}]},true);
valid({...quote,total_minor:'9007199254740993',payer_shares:[{party_id:id,amount_minor:'9007199254740992'}]},false);
valid({...quote,total_minor:'0',payer_shares:[{party_id:id,amount_minor:'0'}]},true);
valid({...quote,total_minor:'999999999999999999',payer_shares:[{party_id:id,amount_minor:'999999999999999999'}]},true);
for(const valid_until of ['bad','2026-10-06',null])valid({...quote,valid_until},false);
for(const scope of ['','    ','x'.repeat(5001)])valid({...quote,scope},false);
const request={id,workspace_id:id,published_revision_id:id,status:'submitted'},now=Date.parse('2026-10-05T12:00:00Z');
assert.equal(check(quote,request,now),'OK');
assert.equal(check(quote,{...request,id:other},now),'REQUEST_MISMATCH');
assert.equal(check(quote,{...request,workspace_id:other},now),'REQUEST_MISMATCH');
assert.equal(check(quote,{...request,published_revision_id:other},now),'REVISION_MISMATCH');
assert.equal(check(quote,{...request,id:id.toUpperCase()},now),'OK');
for(const status of ['cancelled','completed','draft'])assert.equal(check(quote,{...request,status},now),'UNAVAILABLE');
for(const t of [NaN,Infinity,Date.parse(quote.valid_until),Date.parse(quote.valid_until)+1])assert.equal(check(quote,request,t),'UNAVAILABLE');
assert.equal(check({...quote,valid_until:'bad'},request,now),'UNAVAILABLE');
console.log(`PASS ${cases} quote payload cases plus historical revision, workspace and expiry boundaries`);
