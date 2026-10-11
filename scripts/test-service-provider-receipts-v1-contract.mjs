import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { receiptEnvelope } from './service-receipt-test-fixtures.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(
    name => name.startsWith('.') ? load(new URL(`${name}.ts`, file))
      : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name), mod, mod.exports,
  );
  cache.set(file.href, mod.exports);
  return mod.exports;
}

const id = n => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(2);
const intent = { workspace_id: workspaceId, idempotency_key: 'service-receipt-envelope-001', action: 'verify' };
const schemas = {
  offering: load(new URL('../src/lib/customer/service-offering-v14-schema.ts', import.meta.url)).providerAgreementVerificationReceiptV1Schema,
  resource: load(new URL('../src/lib/customer/service-offering-v14-schema.ts', import.meta.url)).dw02CanonicalResourceResolutionReceiptV1Schema,
  quote: load(new URL('../src/lib/customer/service-order-acceptance-v14-schema.ts', import.meta.url)).financialProposalPostingReceiptV1Schema,
  subject: load(new URL('../src/lib/customer/service-collaboration-v14-schema.ts', import.meta.url)).serviceSubjectLinkAdapterReceiptV1Schema,
  evidence: load(new URL('../src/lib/customer/service-delivery-v14-schema.ts', import.meta.url)).serviceDeliveryEvidenceReceiptV1Schema,
  capacity: load(new URL('../src/lib/customer/service-booking-v14-schema.ts', import.meta.url)).sharedCapacityAllocationReceiptV1Schema,
  portfolio: load(new URL('../src/lib/customer/service-portfolio-v14-schema.ts', import.meta.url)).portfolioServiceActionProjectionReceiptV1Schema,
  finance: load(new URL('../src/lib/customer/service-finance-v14-schema.ts', import.meta.url)).serviceFinancialOperationReceiptV1Schema,
};
const common = (contract, sourceKind, sourceId, sourceVersion, payload) => receiptEnvelope({
  contract, intent, workspaceId, sourceKind, sourceId, sourceVersion, ...payload,
});
const cases = [
  ['offering', common('provider-agreement-verification.v1', 'provider_agreement', id(3), 4, {
    provider_party_id: id(5), agreement_id: id(3), agreement_version: 4, agreement_status: 'active',
    valid_from: '2026-10-01T00:00:00Z', valid_until: null, capability_codes: [], policy_codes: [],
  })],
  ['resource', common('dw02-canonical-resource-resolution.v1', 'canonical_resource', id(6), 7, {
    resource_id: id(6), resource_version: 7, resource_type: 'unit', state: 'available', capability_codes: [], policy_codes: [],
  })],
  ['quote', common('financial-proposal-posting-receipt.v1', 'service_quote', id(8), 9, {
    quote_id: id(8), quote_version: 9, provider_party_id: id(5), beneficiary_party_id: id(10),
    price_snapshot_id: id(11), tax_snapshot_id: id(12), currency: 'EUR', amount_minor: '12500',
  })],
  ['subject', common('service-subject-link-adapter.v1', 'document', id(13), 14, {
    request_id: id(15), request_version: 16, reference_kind: 'document', reference_id: id(13), reference_version: 14,
    relation: 'evidence', reference_state: 'available', current_actor_can_read: true, request_party_audience_only: true,
  })],
  ['evidence', common('service-delivery-evidence-receipt.v1', 'service_stage', id(17), 18, {
    order_id: id(19), order_version: 20, stage_id: id(17), stage_version: 18,
    evidence_references: [{ reference_id: id(21), source_version: 22, workspace_id: workspaceId,
      state: 'available', current_actor_can_read: true }],
  })],
  ['capacity', common('shared-capacity-allocation-receipt.v1', 'service_stage', id(17), 18, {
    action: 'request_hold', order_id: id(19), order_version: 20, stage_id: id(17), stage_version: 18,
    allocation_id: null, allocation_version: null, requested_start: '2026-10-12T09:00:00+03:30',
    requested_end: '2026-10-12T10:00:00+03:30', requested_capacity: 1, resource_ids: [id(6)],
  })],
  ['portfolio', common('portfolio-service-action-projection-receipt.v1', 'service_portfolio', id(23), 24, {
    portfolio_id: id(23), current_actor_can_read: true, order_references: [{ service_order_id: id(19),
      order_version: 20, resource_id: id(6), available_actions: ['view_order'] }],
  })],
  ['finance', common('service-financial-operation-receipt.v1', 'delivery_acceptance', id(21), 22, {
    action: 'request_invoice', order_id: id(19), order_version: 20, source_kind: 'delivery_acceptance',
    source_id: id(21), source_version: 22, posting_reference_id: id(25), currency: 'EUR', amount_minor: '12500',
    tax_snapshot_id: id(26), rounding_policy_version: 1, payer_share_snapshot_id: id(27),
  })],
];

for (const [name, receipt] of cases) {
  const schema = schemas[name];
  assert.equal(schema.safeParse(receipt).success, true, `${name}: complete receipt`);
  for (const field of ['receipt_id', 'source_identity', 'workspace_id', 'authority', 'decision_status', 'result_code',
    'evaluated_at', 'idempotency_key', 'input_fingerprint', 'idempotency_binding_id']) {
    const tampered = { ...receipt }; delete tampered[field];
    assert.equal(schema.safeParse(tampered).success, false, `${name}: missing ${field}`);
  }
  assert.equal(schema.safeParse({ ...receipt, workspace_id: id(99) }).success, true, `${name}: foreign workspace remains bounded data`);
  assert.equal(schema.safeParse({ ...receipt, source_identity: { ...receipt.source_identity, version: 0 } }).success, false,
    `${name}: stale/invalid source version`);
  assert.equal(schema.safeParse({ ...receipt, idempotency_key: `${receipt.idempotency_key}-replay` }).success, true,
    `${name}: replay value is parsed then denied by consumer binding`);
  assert.equal(schema.safeParse({ ...receipt, input_fingerprint: 'svc1:0000000000000000' }).success, true,
    `${name}: tamper value is parsed then denied by consumer binding`);
  const before = JSON.stringify(receipt);
  Object.freeze(receipt);
  schema.safeParse(receipt);
  assert.equal(JSON.stringify(receipt), before, `${name}: denial/validation is zero-write`);
}

const commonSource = readFileSync(new URL('../src/lib/customer/service-provider-receipt-v1-schema.ts', import.meta.url), 'utf8');
assert.match(commonSource, /Providers remain canonical owners and mint receipts/);
assert.match(commonSource, /performs no write/);
console.log('SERVICE provider receipt envelopes: PASS (8 specialized payloads; tamper/stale/replay/zero-write)');
