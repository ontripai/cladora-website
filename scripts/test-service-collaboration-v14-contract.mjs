import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { receiptEnvelope } from './service-receipt-test-fixtures.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}
const source = readFileSync(new URL('../src/lib/customer/service-collaboration-v14-schema.ts', import.meta.url), 'utf8');
const { serviceCollaborationIntentV1Schema, evaluateServiceCollaborationLink } = load(
  new URL('../src/lib/customer/service-collaboration-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const intent = { context_id: id(1), workspace_id: id(2), service_request_id: id(3), expected_request_version: 4,
  reference_kind: 'document', reference_id: id(4), source_version: 7,
  relation: 'evidence', idempotency_key: 'service-collaboration-001' };
const subjectLinkReceipt = receiptEnvelope({ contract: 'service-subject-link-adapter.v1', intent,
  workspaceId: id(2), sourceKind: 'document', sourceId: id(4), sourceVersion: 7,
  request_id: id(3), request_version: 4, reference_kind: 'document', reference_id: id(4),
  reference_version: 7, relation: 'evidence', reference_state: 'available', current_actor_can_read: true,
  request_party_audience_only: true });
const snapshot = { authority: 'allowed', request: { id: id(3), workspace_id: id(2), version: 4,
  status: 'in_progress', current_actor_is_party: true }, subjectLinkReceipt };

assert.equal(serviceCollaborationIntentV1Schema.safeParse(intent).success, true);
for (const field of ['actor_id', 'tenant_id', 'audience_party_ids', 'notification_status', 'object_path', 'storage_path',
  'signed_url', 'message_body', 'private_payload', 'customer_data', 'retention_decision'])
  assert.equal(serviceCollaborationIntentV1Schema.safeParse({ ...intent, [field]: id(8) }).success, false, field);
for (const source_version of [null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1, '7']) {
  assert.equal(serviceCollaborationIntentV1Schema.safeParse({ ...intent, source_version }).success, false);
}
assert.equal(serviceCollaborationIntentV1Schema.safeParse({ ...intent, reference_kind: 'message', relation: 'attachment' }).success, false);
assert.equal(serviceCollaborationIntentV1Schema.safeParse({ ...intent, reference_kind: 'document', relation: 'conversation' }).success, false);
assert.equal(evaluateServiceCollaborationLink(intent, snapshot), 'OK');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, request: null }), 'REQUEST_UNAVAILABLE');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, request: { ...snapshot.request, status: 'cancelled' } }), 'REQUEST_UNAVAILABLE');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, request: { ...snapshot.request, version: 5 } }), 'STALE_REQUEST');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, request: { ...snapshot.request, current_actor_is_party: false } }), 'PARTY_ACCESS_REQUIRED');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot, subjectLinkReceipt: null }), 'REFERENCE_UNAVAILABLE');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, reference_state: 'quarantined' } }), 'REFERENCE_UNAVAILABLE');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, workspace_id: id(9) } }), 'REFERENCE_MISMATCH');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, reference_kind: 'message' } }), 'REFERENCE_MISMATCH');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, source_identity: { ...subjectLinkReceipt.source_identity, version: 8 } } }), 'STALE_REFERENCE');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, current_actor_can_read: false } }), 'REFERENCE_ACCESS_DENIED');
assert.equal(evaluateServiceCollaborationLink(intent, { ...snapshot,
  subjectLinkReceipt: { ...subjectLinkReceipt, request_party_audience_only: false } }), 'REFERENCE_ACCESS_DENIED');
assert.match(source, /not an authorization boundary/i);
assert.match(source, /audit row, and outbox receipt atomically/i);
console.log('SERVICE v1.4 collaboration contract: PASS');
