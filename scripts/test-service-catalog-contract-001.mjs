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
  const localRequire = id => id.startsWith('.') ? load(new URL(`${id}.ts`, file)) : require(id);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}
const { createServiceOfferingRequestSchema: create, reviseServiceOfferingRequestSchema: revise,
  transitionServiceOfferingRequestSchema: transition } = load(new URL('../src/lib/customer/service-catalog-schema.ts', import.meta.url));
const id = '00000000-0000-0000-0000-000000000001';
const labels = { ro: 'Curățenie', en: 'Cleaning', fa: 'نظافت' };
const revision = {
  labels, description: labels, acquisition_mode: 'direct',
  price: { kind: 'fixed', amount: '120.50', currency: 'RON', tax_display: 'included' },
  valid_from: '2026-10-03T10:00:00Z', valid_until: null,
  cancellation_terms: labels, acceptance_criteria: labels, document_version_ids: [],
};
const input = { context_id: id, definition_id: id, provider_party_id: id, revision, idempotency_key: 'service-001' };
let cases = 0;
function check(name, fn) { fn(); cases++; console.log(`OK ${name}`); }
const rejects = value => assert.equal(create.safeParse(value).success, false);
check('valid localized offering and exact decimal amount', () => assert.equal(create.parse(input).revision.price.amount, '120.50'));
check('deterministic database UUID accepted', () => assert.equal(create.parse(input).context_id, id));
for (const key of ['tenant_id', 'actor_id', 'status', 'published_at']) {
  check(`reject client-controlled ${key}`, () => rejects({ ...input, [key]: id }));
}
check('nested unknown property rejected', () => rejects({ ...input, revision: { ...revision, status: 'published' } }));
check('missing Persian label rejected', () => rejects({ ...input, revision: { ...revision, labels: { ro: 'x', en: 'x' } } }));
check('blank terms rejected', () => rejects({ ...input, revision: { ...revision, cancellation_terms: { ...labels, en: '   ' } } }));
for (const amount of [-1, 1.2, '-1', '1e3', 'NaN', '01', '1.1234567']) {
  check(`reject ambiguous amount ${amount}`, () => rejects({ ...input, revision: { ...revision, price: { ...revision.price, amount } } }));
}
check('valid_until before start rejected', () => rejects({ ...input, revision: { ...revision, valid_until: '2026-10-03T09:00:00Z' } }));
check('equal instant with different offsets rejected', () => rejects({ ...input, revision: { ...revision, valid_until: '2026-10-03T13:30:00+03:30' } }));
check('date without timezone rejected', () => rejects({ ...input, revision: { ...revision, valid_from: '2026-10-03T10:00:00' } }));
check('direct acquisition without stated price rejected', () => rejects({ ...input, revision: { ...revision, price: { kind: 'quote_required' } } }));
check('pre-quote allowed without amount', () => assert.equal(create.safeParse({ ...input, revision: { ...revision, acquisition_mode: 'pre_quote', price: { kind: 'quote_required' } } }).success, true));
check('duplicate document version rejected', () => rejects({ ...input, revision: { ...revision, document_version_ids: [id, id] } }));
check('invalid idempotency key rejected', () => rejects({ ...input, idempotency_key: 'short' }));
check('revision requires optimistic version', () => assert.equal(revise.safeParse({ context_id: id, offering_id: id, revision, idempotency_key: 'service-001' }).success, false));
const command = { context_id: id, offering_id: id, revision_id: id, expected_lock_version: 1, action: 'publish', reason: 'Reviewed offering', idempotency_key: 'service-001' };
check('valid publish command', () => assert.equal(transition.safeParse(command).success, true));
check('publish requires explicit revision', () => assert.equal(transition.safeParse({ ...command, revision_id: undefined }).success, false));
check('unsafe lock version rejected', () => assert.equal(transition.safeParse({ ...command, expected_lock_version: Number.MAX_SAFE_INTEGER + 1 }).success, false));
check('fabricated approval rejected', () => assert.equal(transition.safeParse({ ...command, approved: true }).success, false));
console.log(`${cases} behavioral schema cases passed`);
