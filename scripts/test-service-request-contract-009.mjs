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
const { createServiceRequestSchema: schema, checkServiceRequestOffering: check } = load(new URL('../src/lib/customer/service-request-schema.ts', import.meta.url));
const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request = { context_id:id,workspace_id:id,offering_id:id,published_revision_id:id,beneficiary_party_id:id,description:'Pilot service assessment',idempotency_key:'service-request-009' };
const offering = { id:id.toLowerCase(),workspace_id:id,published_revision_id:id,status:'published',valid_from:'2026-10-04T12:00:00Z',valid_until:'2026-10-05T12:00:00Z' };
const now=Date.parse('2026-10-04T13:00:00Z');
assert.equal(schema.safeParse(request).success,true);
for(const field of ['context_id','workspace_id','offering_id','published_revision_id','beneficiary_party_id']) for(const value of [undefined,null,'bad']) assert.equal(schema.safeParse({...request,[field]:value}).success,false);
for(const field of ['actor_id','tenant_id','payer_party_id','amount','status','work_order_id','document_version_ids']) assert.equal(schema.safeParse({...request,[field]:id}).success,false);
for(const description of ['', '    ', 'x'.repeat(5001)]) assert.equal(schema.safeParse({...request,description}).success,false);
assert.equal(check(request,offering,now),'OK');
assert.equal(check(request,{...offering,id:other},now),'OFFERING_MISMATCH');
assert.equal(check(request,{...offering,workspace_id:other},now),'OFFERING_MISMATCH');
for(const published_revision_id of [null,other]) assert.equal(check(request,{...offering,published_revision_id},now),'REVISION_CHANGED');
for(const status of ['draft','submitted','suspended','archived']) assert.equal(check(request,{...offering,status},now),'UNAVAILABLE');
for(const t of [NaN,Date.parse(offering.valid_from)-1,Date.parse(offering.valid_until)]) assert.equal(check(request,offering,t),'UNAVAILABLE');
for(const validity of [{valid_from:'bad'},{valid_until:'bad'},{valid_until:offering.valid_from}]) assert.equal(check(request,{...offering,...validity},now),'UNAVAILABLE');
assert.equal(check(request,{...offering,valid_until:null},now),'OK');
console.log('PASS service request: strict payload, spoofed authority/finance fields, pinned revision, cross-workspace and validity boundaries');
