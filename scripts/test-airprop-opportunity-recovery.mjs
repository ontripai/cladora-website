import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
 const filename = fileURLToPath(new URL(`../${path}`, import.meta.url)), mod = new Module(filename);
 mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
 mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
 }).outputText, filename);
 return mod.exports;
}
const { readAirpropOpportunityRecovery: read, writeAirpropOpportunityRecovery: write } = load('src/lib/customer/airprop-opportunity-recovery.ts', {
 '@/lib/airprop/opportunity-contract-v2': load('src/lib/airprop/opportunity-contract-v2.ts'),
});
const scope = { contextId: '11111111-1111-4111-8111-111111111111', workspaceId: '22222222-2222-4222-8222-222222222222' };
const command = { version: 2, context_id: scope.contextId, workspace_id: scope.workspaceId, idempotency_key: 'recovery-original-01',
 payload: { name: '  Original intent  ', country_code: 'RO', city: 'Cluj', asking_price: '12.30', currency: 'RON' } };
const snapshot = JSON.stringify(command);
let cases = 0;
assert.deepEqual(read(null, scope), { state: 'empty' }); cases++;
const legacy = read(snapshot, scope);
assert.equal(legacy.state, 'uncertain'); assert.equal(JSON.stringify(legacy.command), snapshot); cases++;
for (const state of ['uncertain', 'blocked']) {
 const raw = write(command, state), envelope = JSON.parse(raw);
 assert.equal(envelope.recovery_version, 1); assert.equal(envelope.state, state); assert.deepEqual(envelope.command, command);
 const restored = read(raw, scope);
 assert.equal(restored.state, state); assert.equal(JSON.stringify(restored.command), snapshot);
 if (state === 'blocked') assert.equal(restored.reason, 'IDEMPOTENCY_CONFLICT');
 // A fresh decoder/module instance, as on reload, has no volatile conflict registry.
 const fresh = load('src/lib/customer/airprop-opportunity-recovery.ts', { '@/lib/airprop/opportunity-contract-v2': load('src/lib/airprop/opportunity-contract-v2.ts') });
 assert.equal(fresh.readAirpropOpportunityRecovery(raw, scope).state, state); cases++;
}
const blocked = JSON.parse(write(command, 'blocked'));
for (const raw of ['', '{', 'null', '[]', '{}', JSON.stringify({ ...command, version: 3 }),
 JSON.stringify({ ...command, workspace_id: scope.contextId }),
 JSON.stringify({ ...command, context_id: scope.workspaceId }),
 JSON.stringify({ ...blocked, recovery_version: 2 }), JSON.stringify({ ...blocked, error_code: 'UNKNOWN' }),
 JSON.stringify({ ...blocked, error_code: undefined }), JSON.stringify({ ...blocked, state: 'cleared' }),
 JSON.stringify({ ...blocked, state: 'uncertain' }), JSON.stringify({ ...blocked, extra: true }),
 JSON.stringify({ ...blocked, command: { ...command, payload: { ...command.payload, currency: 'USD' } } }),
 JSON.stringify({ ...blocked, command: { ...command, workspace_id: scope.contextId } }),
 JSON.stringify({ ...blocked, command: { ...command, context_id: scope.workspaceId } })]) {
 assert.deepEqual(read(raw, scope), { state: 'blocked', command: null, reason: 'INVALID_RECOVERY' }); cases++;
}
assert.throws(() => write({ ...command, idempotency_key: 'bad' }, 'blocked')); cases++;
assert.equal(JSON.stringify(command), snapshot, 'codec never mutates the original evidence');
console.log(`PASS ${cases} offline recovery-codec cases: legacy uncertainty, versioned conflict, fresh decoder, exact intent and fail-closed invalid/foreign records`);
