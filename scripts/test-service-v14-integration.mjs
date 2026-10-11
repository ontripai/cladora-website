import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { receiptEnvelope } from './service-receipt-test-fixtures.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const result = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.')
    ? load(new URL(`${moduleId}.ts`, file))
    : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const workspaceId = id(2);
const orderId = id(3);
const stageId = id(5);
const sourceId = id(6);

const orderModule = load(new URL('../src/lib/customer/service-order-acceptance-v14-schema.ts', import.meta.url));
const collaborationModule = load(new URL('../src/lib/customer/service-collaboration-v14-schema.ts', import.meta.url));
const deliveryModule = load(new URL('../src/lib/customer/service-delivery-v14-schema.ts', import.meta.url));
const bookingModule = load(new URL('../src/lib/customer/service-booking-v14-schema.ts', import.meta.url));
const portfolioModule = load(new URL('../src/lib/customer/service-portfolio-v14-schema.ts', import.meta.url));
const financeModule = load(new URL('../src/lib/customer/service-finance-v14-schema.ts', import.meta.url));
const experienceModule = load(new URL('../src/lib/customer/service-experience-v14-schema.ts', import.meta.url));

const orderIntent = {
  context_id: id(1), workspace_id: workspaceId, quote_id: id(4), expected_quote_version: 4,
  idempotency_key: 'service-integration-order-001',
};
const orderFinanceReceipt = receiptEnvelope({ contract: 'financial-proposal-posting-receipt.v1', intent: orderIntent,
  workspaceId, sourceKind: 'service_quote', sourceId: id(4), sourceVersion: 4,
  quote_id: id(4), quote_version: 4, provider_party_id: id(7), beneficiary_party_id: id(8),
  price_snapshot_id: id(9), tax_snapshot_id: id(10), currency: 'EUR', amount_minor: '12500' });
const orderSnapshot = {
  now: Date.parse('2026-10-09T12:00:00Z'), authorityEffective: true, workspaceId,
  quoteId: id(4), quoteVersion: 4, quoteState: 'presented', quoteValidUntil: '2026-10-10T12:00:00Z',
  requestState: 'submitted', providerActive: true, beneficiaryActive: true, financeReceipt: orderFinanceReceipt,
};
const collaborationIntent = {
  context_id: id(1), workspace_id: workspaceId, service_request_id: id(4), expected_request_version: 4,
  reference_kind: 'document', reference_id: sourceId, source_version: 3, relation: 'evidence',
  idempotency_key: 'service-integration-collaboration-001',
};
const collaborationSnapshot = {
  authority: 'allowed',
  request: { id: id(4), workspace_id: workspaceId, version: 4, status: 'in_progress', current_actor_is_party: true },
  subjectLinkReceipt: receiptEnvelope({ contract: 'service-subject-link-adapter.v1', intent: collaborationIntent,
    workspaceId, sourceKind: 'document', sourceId, sourceVersion: 3,
    request_id: id(4), request_version: 4, reference_kind: 'document', reference_id: sourceId,
    reference_version: 3, relation: 'evidence', reference_state: 'available', current_actor_can_read: true,
    request_party_audience_only: true }),
};
const deliveryIntent = {
  context_id: id(1), workspace_id: workspaceId, service_order_id: orderId, expected_order_version: 4,
  service_stage_id: stageId, expected_stage_version: 6, quantity: '1', action: 'record_delivery',
  evidence_references: [{ reference_id: sourceId, source_version: 3 }],
  idempotency_key: 'service-integration-delivery-001',
};
const deliverySnapshot = {
  authority: 'allowed', order: { id: orderId, workspace_id: workspaceId, version: 4, status: 'in_progress' },
  stage: {
    id: stageId, order_id: orderId, version: 6, status: 'in_progress', committed_quantity: '10',
    delivered_quantity: '1', accepted_quantity: '0', rejected_quantity: '0',
    current_actor_can_deliver: true, current_actor_can_accept: true,
  },
  evidenceReceipt: receiptEnvelope({ contract: 'service-delivery-evidence-receipt.v1', intent: deliveryIntent,
    workspaceId, sourceKind: 'service_stage', sourceId: stageId, sourceVersion: 6,
    order_id: orderId, order_version: 4, stage_id: stageId, stage_version: 6,
    evidence_references: [{ reference_id: sourceId, workspace_id: workspaceId, source_version: 3,
      state: 'available', current_actor_can_read: true }] }),
};
const bookingIntent = {
  context_id: id(1), workspace_id: workspaceId, service_order_id: orderId, expected_order_version: 4,
  service_stage_id: stageId, expected_stage_version: 6, action: 'request_hold',
  requested_start: '2026-10-10T09:00:00+03:30', requested_end: '2026-10-10T10:00:00+03:30',
  requested_capacity: 1, resource_ids: [sourceId], idempotency_key: 'service-integration-booking-001',
};
const bookingReceipt = receiptEnvelope({ contract: 'shared-capacity-allocation-receipt.v1', intent: bookingIntent,
  workspaceId, sourceKind: 'service_stage', sourceId: stageId, sourceVersion: 6,
  action: 'request_hold', order_id: orderId,
  order_version: 4, stage_id: stageId, stage_version: 6, allocation_id: null, allocation_version: null,
  requested_start: bookingIntent.requested_start, requested_end: bookingIntent.requested_end,
  requested_capacity: 1, resource_ids: [sourceId],
});
const bookingSnapshot = {
  now: Date.parse('2026-10-09T12:00:00Z'), authority: 'allowed',
  order: { id: orderId, workspace_id: workspaceId, version: 4, status: 'in_progress' },
  stage: { id: stageId, order_id: orderId, version: 6, status: 'ready', booking_required: true },
  allocation: null, capacity_receipt: bookingReceipt,
};
const portfolioIntent = {
  context_id: id(1), workspace_id: workspaceId, portfolio_id: id(4), service_order_id: orderId,
  expected_portfolio_version: 1, expected_order_version: 4, action: 'continue_delivery',
  idempotency_key: 'service-integration-portfolio-001',
};
const portfolioSnapshot = {
  authority: 'allowed',
  portfolio_receipt: receiptEnvelope({ contract: 'portfolio-service-action-projection-receipt.v1', intent: portfolioIntent,
    workspaceId, sourceKind: 'service_portfolio', sourceId: id(4), sourceVersion: 1,
    portfolio_id: id(4), current_actor_can_read: true,
    order_references: [{ service_order_id: orderId, order_version: 4, resource_id: sourceId,
      available_actions: ['continue_delivery'] }],
  }),
  order: {
    id: orderId, workspace_id: workspaceId, version: 4, resource_id: sourceId,
    status: 'in_progress', available_actions: ['continue_delivery'],
  },
};
const financeIntent = {
  context_id: id(1), workspace_id: workspaceId, service_order_id: orderId, expected_order_version: 4,
  action: 'request_invoice', delivery_acceptance_id: sourceId, expected_delivery_version: 6,
  idempotency_key: 'service-integration-finance-001',
};
const financeSnapshot = {
  authority: 'allowed', order: { id: orderId, workspace_id: workspaceId, version: 4, status: 'in_progress' },
  source: {
    id: sourceId, version: 6, workspace_id: workspaceId, order_id: orderId,
    kind: 'delivery_acceptance', state: 'eligible',
  },
  finance_receipt: receiptEnvelope({ contract: 'service-financial-operation-receipt.v1', intent: financeIntent,
    workspaceId, sourceKind: 'delivery_acceptance', sourceId, sourceVersion: 6,
    action: 'request_invoice', order_id: orderId,
    order_version: 4, source_id: sourceId, source_version: 6,
    source_kind: 'delivery_acceptance', posting_reference_id: id(11), currency: 'EUR', amount_minor: '12500',
    tax_snapshot_id: id(12), rounding_policy_version: 1, payer_share_snapshot_id: id(13),
  }),
};
const experienceIntent = {
  contract: experienceModule.SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT, version: 1,
  context_id: id(1), workspace_id: workspaceId, service_order_id: orderId, expected_order_version: 4,
  actor_reference_id: id(7), participant_reference_id: id(8), coordination_source_id: sourceId,
  expected_coordination_source_version: 3,
  action: 'request_cancellation', reason_code: 'CUSTOMER_REQUEST',
  idempotency_key: 'service-integration-experience-001',
};
const experienceReceipt = {
  contract: experienceIntent.contract, version: 1, receipt_id: id(9), decision_status: 'verified', result_code: 'OK',
  action: experienceIntent.action, workspace_id: workspaceId, service_order_id: orderId, service_order_version: 4,
  subject_kind: 'none', subject_id: null, subject_version: null, coordination_source_id: sourceId,
  coordination_source_version: 3, status_reference_id: null, reason_code: 'CUSTOMER_REQUEST',
  actor_authority: 'verified', participant_authority: 'verified', current_coordination_state: 'available',
  resulting_coordination_state: 'cancellation_requested', idempotency_binding_id: id(10),
  evaluated_at: '2026-10-11T12:00:00+00:00',
};
const experienceSnapshot = {
  authority: { actor_reference_id: id(7), workspace_id: workspaceId, result: 'allowed' },
  participant: { participant_reference_id: id(8), workspace_id: workspaceId, membership_state: 'active' },
  order: { id: orderId, workspace_id: workspaceId, version: 4, state: 'in_progress' }, subject: null,
  source: { id: sourceId, workspace_id: workspaceId, version: 3, state: 'available' },
  allowed_actions: ['acknowledge_component_status', 'request_cancellation', 'request_compensation', 'accept_compensation'],
  resolution: 'known',
  receipt_reference: { receipt_id: id(9), idempotency_key: experienceIntent.idempotency_key,
    input_fingerprint: experienceModule.fingerprintServiceExperienceIntent(experienceIntent),
    idempotency_binding_id: id(10), evaluated_at: experienceReceipt.evaluated_at },
  coordination_receipt: experienceReceipt,
};

const boundaries = [
  {
    name: 'order acceptance', schema: orderModule.acceptServiceQuoteV14Schema, intent: orderIntent,
    evaluate: orderModule.evaluateServiceQuoteAcceptance, snapshot: orderSnapshot,
    deny: snapshot => ({ ...snapshot, authorityEffective: false }), stale: snapshot => ({ ...snapshot, quoteVersion: 5 }),
    missing: snapshot => ({ ...snapshot, financeReceipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_QUOTE', 'FINANCE_CONTRACT_REQUIRED'],
  },
  {
    name: 'collaboration', schema: collaborationModule.serviceCollaborationIntentV1Schema, intent: collaborationIntent,
    evaluate: collaborationModule.evaluateServiceCollaborationLink, snapshot: collaborationSnapshot,
    deny: snapshot => ({ ...snapshot, authority: 'denied' }),
    stale: snapshot => ({ ...snapshot, request: { ...snapshot.request, version: 5 } }),
    missing: snapshot => ({ ...snapshot, subjectLinkReceipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_REQUEST', 'REFERENCE_UNAVAILABLE'],
  },
  {
    name: 'delivery', schema: deliveryModule.serviceDeliveryIntentV1Schema, intent: deliveryIntent,
    evaluate: deliveryModule.evaluateServiceDelivery, snapshot: deliverySnapshot,
    deny: snapshot => ({ ...snapshot, authority: 'denied' }),
    stale: snapshot => ({ ...snapshot, order: { ...snapshot.order, version: 5 } }),
    missing: snapshot => ({ ...snapshot, evidenceReceipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_ORDER', 'EVIDENCE_UNAVAILABLE'],
  },
  {
    name: 'booking', schema: bookingModule.serviceBookingIntentV1Schema, intent: bookingIntent,
    evaluate: bookingModule.evaluateServiceBooking, snapshot: bookingSnapshot,
    deny: snapshot => ({ ...snapshot, authority: 'denied' }),
    stale: snapshot => ({ ...snapshot, order: { ...snapshot.order, version: 5 } }),
    missing: snapshot => ({ ...snapshot, capacity_receipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_ORDER', 'CAPACITY_DECISION_REQUIRED'],
  },
  {
    name: 'portfolio', schema: portfolioModule.servicePortfolioActionIntentV1Schema, intent: portfolioIntent,
    evaluate: portfolioModule.evaluateServicePortfolioAction, snapshot: portfolioSnapshot,
    deny: snapshot => ({ ...snapshot, authority: 'denied' }),
    stale: snapshot => ({ ...snapshot, order: { ...snapshot.order, version: 5 } }),
    missing: snapshot => ({ ...snapshot, portfolio_receipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_ORDER', 'PORTFOLIO_RECEIPT_REQUIRED'],
  },
  {
    name: 'finance', schema: financeModule.serviceFinanceIntentV1Schema, intent: financeIntent,
    evaluate: financeModule.evaluateServiceFinanceIntent, snapshot: financeSnapshot,
    deny: snapshot => ({ ...snapshot, authority: 'denied' }),
    stale: snapshot => ({ ...snapshot, order: { ...snapshot.order, version: 5 } }),
    missing: snapshot => ({ ...snapshot, finance_receipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_ORDER', 'FINANCE_RECEIPT_REQUIRED'],
  },
  {
    name: 'experience', schema: experienceModule.serviceExperienceIntentV1Schema, intent: experienceIntent,
    evaluate: experienceModule.evaluateServiceExperienceIntent, snapshot: experienceSnapshot,
    deny: snapshot => ({ ...snapshot, authority: { ...snapshot.authority, result: 'denied' } }),
    stale: snapshot => ({ ...snapshot, order: { ...snapshot.order, version: 5 } }),
    missing: snapshot => ({ ...snapshot, coordination_receipt: null }),
    expected: ['AUTHORITY_DENIED', 'STALE_ORDER', 'COORDINATION_RECEIPT_REQUIRED'],
  },
];

for (const boundary of boundaries) {
  assert.equal(boundary.schema.safeParse(boundary.intent).success, true, `${boundary.name}: valid intent`);
  for (const field of ['actor_id', 'tenant_id', 'audit_id', 'outbox_id']) {
    assert.equal(
      boundary.schema.safeParse({ ...boundary.intent, [field]: id(99) }).success,
      false,
      `${boundary.name}: reject ${field}`,
    );
  }
  assert.equal(boundary.evaluate(boundary.intent, boundary.snapshot), 'OK', `${boundary.name}: happy path`);
  assert.equal(boundary.evaluate(boundary.intent, boundary.deny(boundary.snapshot)), boundary.expected[0]);
  assert.equal(boundary.evaluate(boundary.intent, boundary.stale(boundary.snapshot)), boundary.expected[1]);
  assert.equal(boundary.evaluate(boundary.intent, boundary.missing(boundary.snapshot)), boundary.expected[2]);
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const aggregate = packageJson.scripts['test:service-v14'];
for (const script of [
  'test-service-provider-receipts-v1-contract.mjs',
  'test-service-offering-v14-contract.mjs',
  'test-service-order-acceptance-v14-contract.mjs',
  'test-service-collaboration-v14-contract.mjs',
  'test-service-delivery-v14-contract.mjs',
  'test-service-booking-v14-contract.mjs',
  'test-service-portfolio-v14-contract.mjs',
  'test-service-finance-v14-contract.mjs',
  'test-service-experience-v14-contract.mjs',
  'test-service-resource-picker-v14.mjs',
  'test-service-v14-integration.mjs',
]) assert.match(aggregate, new RegExp(script.replaceAll('.', '\\.')));

const workflow = readFileSync(new URL('../.github/workflows/service-catalog-contract.yml', import.meta.url), 'utf8');
assert.match(workflow, /npm run test:service-v14/);
assert.match(workflow, /scripts\/test-service-v14-integration\.mjs/);
assert.match(workflow, /scripts\/test-service-resource-picker-v14\.mjs/);

const evidence = readFileSync(
  new URL('../docs/architecture/CLADORA-SERVICE-V14-09-UX-AUTH-INTEGRATION-EVIDENCE.md', import.meta.url),
  'utf8',
);
for (const dependency of [
  'provider-agreement-verification.v1',
  'financial-proposal-posting-receipt.v1',
  'service-subject-link-adapter.v1',
  'service-delivery-evidence-receipt.v1',
  'shared-capacity-allocation-receipt.v1',
  'portfolio-service-action-projection-receipt.v1',
  'service-financial-operation-receipt.v1',
  'service-experience-coordination-receipt.v1',
]) assert.match(evidence, new RegExp(dependency.replaceAll('.', '\\.')));
assert.match(evidence, /No database, API, browser workflow, concurrency, migration or Production test/i);

console.log('SERVICE v1.4 SV01O/P/Q UX, authorization and integration evidence: PASS');
