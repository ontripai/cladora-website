import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fingerprint, receiptEnvelope } from './service-receipt-test-fixtures.mjs';

// Review-only probes against the exact PR #338 tree. No database or network.
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
const modules = Object.fromEntries(['offering', 'order-acceptance', 'collaboration', 'delivery', 'booking',
  'portfolio', 'finance', 'experience'].map(name => [name,
  load(new URL(`../src/lib/customer/service-${name}-v14-schema.ts`, import.meta.url))]));
const id = n => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const other = id(99);
const base = { context_id: id(1), workspace_id: id(2), service_order_id: id(3),
  expected_order_version: 17, idempotency_key: 'independent-service-review-20261011' };
const order = { id: id(3), workspace_id: id(2), version: 17, status: 'in_progress' };
const mk = (name, schema, evaluate, intent, snapshot, scope, stale, denied, missing) => ({
  name, schema: modules[name][schema], evaluate: modules[name][evaluate], intent, snapshot,
  scope, stale, denied, missing,
});
const quoteIntent = { context_id: id(1), workspace_id: id(2), quote_id: id(4),
  expected_quote_version: 17, idempotency_key: base.idempotency_key };
const quoteReceipt = receiptEnvelope({ contract: 'financial-proposal-posting-receipt.v1', intent: quoteIntent,
  workspaceId: id(2), sourceKind: 'service_quote', sourceId: id(4), sourceVersion: 17,
  quote_id: id(4), quote_version: 17, provider_party_id: id(11), beneficiary_party_id: id(12),
  price_snapshot_id: id(14), tax_snapshot_id: id(15), currency: 'EUR', amount_minor: '12500' });
const quoteSnapshot = { now: Date.parse('2026-10-11T08:00:00Z'), authorityEffective: true,
  workspaceId: id(2), quoteId: id(4), quoteVersion: 17, quoteState: 'presented',
  quoteValidUntil: '2026-10-12T08:00:00Z', requestState: 'submitted', providerActive: true,
  beneficiaryActive: true, financeReceipt: quoteReceipt };
const linkIntent = { context_id: id(1), workspace_id: id(2), service_request_id: id(4),
  expected_request_version: 17, reference_kind: 'document', reference_id: id(5), source_version: 23,
  relation: 'evidence',
  idempotency_key: base.idempotency_key };
const subjectLinkReceipt = receiptEnvelope({ contract: 'service-subject-link-adapter.v1', intent: linkIntent,
  workspaceId: id(2), sourceKind: 'document', sourceId: id(5), sourceVersion: 23,
  request_id: id(4), request_version: 17, reference_kind: 'document', reference_id: id(5), reference_version: 23,
  relation: 'evidence', reference_state: 'available', current_actor_can_read: true, request_party_audience_only: true });
const linkSnapshot = { authority: 'allowed', request: { id: id(4), workspace_id: id(2),
  version: 17, status: 'submitted', current_actor_is_party: true }, subjectLinkReceipt };
const deliveryIntent = { ...base, service_stage_id: id(6), expected_stage_version: 21,
  quantity: '0.125', action: 'record_delivery',
  evidence_references: [{ reference_id: id(5), source_version: 23 }] };
const evidenceReceipt = receiptEnvelope({ contract: 'service-delivery-evidence-receipt.v1', intent: deliveryIntent,
  workspaceId: id(2), sourceKind: 'service_stage', sourceId: id(6), sourceVersion: 21,
  order_id: id(3), order_version: 17, stage_id: id(6), stage_version: 21,
  evidence_references: [{ reference_id: id(5), source_version: 23, workspace_id: id(2),
    state: 'available', current_actor_can_read: true }] });
const deliverySnapshot = { authority: 'allowed', order, stage: { id: id(6), order_id: id(3),
  version: 21, status: 'in_progress', committed_quantity: '2', delivered_quantity: '0.25',
  accepted_quantity: '0', rejected_quantity: '0', current_actor_can_deliver: true,
  current_actor_can_accept: true }, evidenceReceipt };
const bookingIntent = { ...base, service_stage_id: id(6), expected_stage_version: 21,
  action: 'request_hold', requested_start: '2026-10-12T09:00:00+03:30',
  requested_end: '2026-10-12T10:00:00+03:30', requested_capacity: 2, resource_ids: [id(7), id(8)] };
const bookingSnapshot = { now: Date.parse('2026-10-11T08:00:00Z'), authority: 'allowed', order,
  stage: { id: id(6), order_id: id(3), version: 21, status: 'ready', booking_required: true },
  allocation: null, capacity_receipt: receiptEnvelope({ contract: 'shared-capacity-allocation-receipt.v1', intent: bookingIntent,
    workspaceId: id(2), sourceKind: 'service_stage', sourceId: id(6), sourceVersion: 21, action: 'request_hold',
    order_version: 17, stage_version: 21,
    order_id: id(3), stage_id: id(6), allocation_id: null, allocation_version: null,
    requested_start: bookingIntent.requested_start, requested_end: bookingIntent.requested_end,
    requested_capacity: 2, resource_ids: [id(8), id(7)] }) };
const portfolioIntent = { context_id: id(1), workspace_id: id(2), portfolio_id: id(9),
  expected_portfolio_version: 11, service_order_id: id(3), expected_order_version: 17,
  action: 'continue_delivery', idempotency_key: base.idempotency_key };
const portfolioSnapshot = { authority: 'allowed', portfolio_receipt: receiptEnvelope({
  contract: 'portfolio-service-action-projection-receipt.v1', intent: portfolioIntent,
  workspaceId: id(2), sourceKind: 'service_portfolio', sourceId: id(9), sourceVersion: 11,
  portfolio_id: id(9), current_actor_can_read: true,
  order_references: [{ service_order_id: id(3), order_version: 17, resource_id: id(7),
    available_actions: ['continue_delivery'] }] }),
  order: { ...order, resource_id: id(7), available_actions: ['continue_delivery'] } };
const financeIntent = { ...base, action: 'request_invoice', delivery_acceptance_id: id(5), expected_delivery_version: 21 };
const financeSnapshot = { authority: 'allowed', order, source: { id: id(5), version: 21,
  workspace_id: id(2), order_id: id(3), kind: 'delivery_acceptance', state: 'eligible' },
  finance_receipt: receiptEnvelope({ contract: 'service-financial-operation-receipt.v1', intent: financeIntent,
    workspaceId: id(2), sourceKind: 'delivery_acceptance', sourceId: id(5), sourceVersion: 21,
    action: 'request_invoice',
    order_id: id(3), order_version: 17, source_id: id(5), source_version: 21,
    source_kind: 'delivery_acceptance', posting_reference_id: id(14), currency: 'EUR', amount_minor: '12500',
    tax_snapshot_id: id(15), rounding_policy_version: 1, payer_share_snapshot_id: id(16) }) };
const experienceIntent = { contract: modules.experience.SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT,
  version: 1, ...base, actor_reference_id: id(11), participant_reference_id: id(12),
  coordination_source_id: id(13), expected_coordination_source_version: 23,
  action: 'acknowledge_component_status', component_id: id(10),
  expected_component_version: 21, status_reference_id: id(5) };
const experienceReceipt = { contract: experienceIntent.contract, version: 1, receipt_id: id(14),
  decision_status: 'verified', result_code: 'OK', action: 'acknowledge_component_status', workspace_id: id(2),
  service_order_id: id(3), service_order_version: 17, subject_kind: 'component', subject_id: id(10),
  subject_version: 21, coordination_source_id: id(13), coordination_source_version: 23,
  status_reference_id: id(5), reason_code: null, actor_authority: 'verified', participant_authority: 'verified',
  current_coordination_state: 'available', resulting_coordination_state: 'component_status_acknowledged',
  idempotency_binding_id: id(15), evaluated_at: '2026-10-11T12:00:00+00:00' };
const experienceSnapshot = {
  authority: { actor_reference_id: id(11), workspace_id: id(2), result: 'allowed' },
  participant: { participant_reference_id: id(12), workspace_id: id(2), membership_state: 'active' },
  order: { id: id(3), workspace_id: id(2), version: 17, state: 'in_progress' },
  subject: { id: id(10), version: 21, workspace_id: id(2), service_order_id: id(3),
    kind: 'component', state: 'available' },
  source: { id: id(13), workspace_id: id(2), version: 23, state: 'available' },
  allowed_actions: ['acknowledge_component_status', 'request_cancellation', 'request_compensation', 'accept_compensation'],
  resolution: 'known', receipt_reference: { receipt_id: id(14), idempotency_key: experienceIntent.idempotency_key,
    input_fingerprint: modules.experience.fingerprintServiceExperienceIntent(experienceIntent),
    idempotency_binding_id: id(15), evaluated_at: experienceReceipt.evaluated_at },
  coordination_receipt: experienceReceipt };
const boundaries = [
  mk('order-acceptance', 'acceptServiceQuoteV14Schema', 'evaluateServiceQuoteAcceptance', quoteIntent, quoteSnapshot,
    s => ({ ...s, workspaceId: other }), s => ({ ...s, quoteVersion: 18 }),
    s => ({ ...s, authorityEffective: false }), s => ({ ...s, financeReceipt: null })),
  mk('collaboration', 'serviceCollaborationIntentV1Schema', 'evaluateServiceCollaborationLink', linkIntent, linkSnapshot,
    s => ({ ...s, request: { ...s.request, workspace_id: other } }), s => ({ ...s, request: { ...s.request, version: 18 } }),
    s => ({ ...s, authority: 'denied' }), s => ({ ...s, subjectLinkReceipt: null })),
  ...[
    ['delivery', 'serviceDeliveryIntentV1Schema', 'evaluateServiceDelivery', deliveryIntent, deliverySnapshot, 'evidenceReceipt'],
    ['booking', 'serviceBookingIntentV1Schema', 'evaluateServiceBooking', bookingIntent, bookingSnapshot, 'capacity_receipt'],
    ['portfolio', 'servicePortfolioActionIntentV1Schema', 'evaluateServicePortfolioAction', portfolioIntent, portfolioSnapshot, 'portfolio_receipt'],
    ['finance', 'serviceFinanceIntentV1Schema', 'evaluateServiceFinanceIntent', financeIntent, financeSnapshot, 'finance_receipt'],
    ['experience', 'serviceExperienceIntentV1Schema', 'evaluateServiceExperienceIntent', experienceIntent, experienceSnapshot, 'coordination_receipt'],
  ].map(([name, schema, evaluate, intent, snapshot, missing]) => mk(name, schema, evaluate, intent, snapshot,
    s => name === 'experience'
      ? ({ ...s, authority: { ...s.authority, workspace_id: other } })
      : ({ ...s, order: { ...s.order, workspace_id: other } }),
    s => ({ ...s, order: { ...s.order, version: 18 } }),
    s => name === 'experience'
      ? ({ ...s, authority: { ...s.authority, result: 'denied' } })
      : ({ ...s, authority: 'denied' }),
    s => ({ ...s, [missing]: null }))),
];
const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, result: 'pass' }); }
  catch (error) { results.push({ name, result: 'fail', detail: error.message }); }
}
function deny(boundary, intent, snapshot) {
  const result = boundary.evaluate(intent, snapshot);
  assert.match(result, /^[A-Z][A-Z_]*$/, 'decision must be a bounded code');
  assert.notEqual(result, 'OK', 'must deny instead of OK');
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
for (const b of boundaries) {
  check(`${b.name}: valid independent intent and baseline`, () => {
    assert.equal(b.schema.safeParse(b.intent).success, true);
    assert.equal(b.evaluate(b.intent, b.snapshot), 'OK');
  });
  for (const field of ['actor_id', 'tenant_id', 'authority', 'contract_version', 'receipt', 'ledger_entry_id',
    'audit_id', 'outbox_id', 'storage_path', 'audience', 'owner_id', 'resource_registry']) {
    check(`${b.name}: rejects client ${field}`, () => assert.equal(b.schema.safeParse({ ...b.intent, [field]: 'spoof' }).success, false));
  }
  for (const [name, change] of [['cross-workspace', b.scope], ['stale entity', b.stale],
    ['revoked authority', b.denied], ['missing dependency', b.missing]]) {
    check(`${b.name}: ${name} denies`, () => deny(b, b.intent, change(b.snapshot)));
  }
  check(`${b.name}: authority denial takes precedence without disclosing references`, () => {
    const a = b.evaluate(b.intent, b.denied(b.snapshot));
    assert.equal(b.evaluate(b.intent, b.denied(b.missing(b.scope(b.snapshot)))), a);
  });
  check(`${b.name}: frozen input and repeated evaluation stay unchanged`, () => {
    const i = freeze(structuredClone(b.intent)); const s = freeze(structuredClone(b.snapshot));
    const before = JSON.stringify({ i, s });
    assert.equal(b.evaluate(i, s), 'OK'); assert.equal(b.evaluate(i, s), 'OK');
    assert.equal(JSON.stringify({ i, s }), before);
  });
}
const offeringBinding = { workspace_id: id(2), provider_party_id: id(11), agreement_id: id(12),
  agreement_version: 17, resource_id: id(7), resource_version: 21, idempotency_key: base.idempotency_key };
const offeringFingerprint = fingerprint(offeringBinding);
const offeringAgreementReceipt = receiptEnvelope({ contract: 'provider-agreement-verification.v1', intent: offeringBinding,
  workspaceId: id(2), sourceKind: 'provider_agreement', sourceId: id(12), sourceVersion: 17,
  provider_party_id: id(11), agreement_id: id(12), agreement_version: 17, agreement_status: 'active',
  valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z',
  capability_codes: ['services.read'], policy_codes: ['unit.inspect'] });
const offeringResourceReceipt = receiptEnvelope({ contract: 'dw02-canonical-resource-resolution.v1', intent: offeringBinding,
  workspaceId: id(2), sourceKind: 'canonical_resource', sourceId: id(7), sourceVersion: 21,
  resource_id: id(7), resource_version: 21, resource_type: 'unit', state: 'available',
  capability_codes: ['services.read'], policy_codes: ['unit.inspect'] });
const offering = { workspaceId: id(2), providerAgreementReceipt: offeringAgreementReceipt,
  offeringStatus: 'published', offeringValidFrom: '2026-10-01T00:00:00Z', offeringValidUntil: null,
  coverage: { kind: 'resources', resources: [{ resource_id: id(7), resource_version: 21, resource_type: 'unit' }] },
  eligibility: { policy_version: 1, required_resource_types: ['unit'], required_capabilities: ['services.read'], required_policy_codes: ['unit.inspect'] } };
const offeringRequest = { now: Date.parse('2026-10-11T08:00:00Z'), workspaceId: id(2),
  providerPartyId: id(11), agreementId: id(12), agreementVersion: 17,
  resource: { resource_id: id(7), resource_version: 21, resource_type: 'unit' },
  resourceReceipt: offeringResourceReceipt, idempotencyKey: base.idempotency_key, inputFingerprint: offeringFingerprint };
const offeringEval = modules.offering.evaluateServiceOfferingEligibility;
check('offering: independent positive path', () => assert.equal(offeringEval(offering, offeringRequest), 'OK'));
for (const [label, change] of [
  ['workspace isolation', { workspaceId: other }], ['provider isolation', { providerPartyId: other }],
  ['agreement identity', { agreementId: other }], ['agreement version', { agreementVersion: 18 }],
  ['resource version', { resource: { ...offeringRequest.resource, resource_version: 22 } }],
  ['resource type', { resource: { ...offeringRequest.resource, resource_type: 'vehicle' } }],
  ['revocation', { resourceReceipt: { ...offeringResourceReceipt,
    authority: { ...offeringResourceReceipt.authority, outcome: 'denied' } } }],
  ['capability denial', { resourceReceipt: { ...offeringResourceReceipt, capability_codes: [] } }],
  ['policy denial', { resourceReceipt: { ...offeringResourceReceipt, policy_codes: [] } }],
  ['invalid clock', { now: Number.NaN }],
]) check(`offering: ${label}`, () => assert.notEqual(offeringEval(offering, { ...offeringRequest, ...change }), 'OK'));
for (const [label, change] of [['geographic resolver absent', { coverage: { kind: 'geographic', country_code: 'RO', region_codes: ['B'] } }],
  ['revoked agreement', { providerAgreementReceipt: { ...offeringAgreementReceipt, agreement_status: 'revoked' } }],
  ['expiry boundary', { providerAgreementReceipt: { ...offeringAgreementReceipt, valid_until: '2026-10-11T08:00:00Z' } }]]) {
  check(`offering: ${label}`, () => assert.notEqual(offeringEval({ ...offering, ...change }, offeringRequest), 'OK'));
}
for (const [name, snapshot, intent, evaluate, changes] of [
  ['collaboration', linkSnapshot, linkIntent, modules.collaboration.evaluateServiceCollaborationLink,
    [{ subjectLinkReceipt: { ...linkSnapshot.subjectLinkReceipt, workspace_id: other } },
      { subjectLinkReceipt: { ...linkSnapshot.subjectLinkReceipt, request_party_audience_only: false } },
      { subjectLinkReceipt: { ...linkSnapshot.subjectLinkReceipt, reference_state: 'quarantined' } },
      { request: { ...linkSnapshot.request, current_actor_is_party: false } }]],
  ['delivery', deliverySnapshot, deliveryIntent, modules.delivery.evaluateServiceDelivery,
    [{ stage: { ...deliverySnapshot.stage, order_id: other } },
      { evidenceReceipt: { ...deliverySnapshot.evidenceReceipt, evidence_references: [
        { ...deliverySnapshot.evidenceReceipt.evidence_references[0], workspace_id: other }] } },
      { evidenceReceipt: { ...deliverySnapshot.evidenceReceipt, evidence_references: [
        { ...deliverySnapshot.evidenceReceipt.evidence_references[0], current_actor_can_read: false }] } }]],
  ['booking', bookingSnapshot, bookingIntent, modules.booking.evaluateServiceBooking,
    [{ capacity_receipt: { ...bookingSnapshot.capacity_receipt, workspace_id: other } },
      { capacity_receipt: { ...bookingSnapshot.capacity_receipt, decision_status: 'conflict' } },
      { capacity_receipt: { ...bookingSnapshot.capacity_receipt, resource_ids: [other] } }]],
  ['portfolio', portfolioSnapshot, portfolioIntent, modules.portfolio.evaluateServicePortfolioAction,
    [{ portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt, decision_status: 'denied' } },
      { portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt, workspace_id: other } },
      { portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt, portfolio_id: other } }]],
  ['finance', financeSnapshot, financeIntent, modules.finance.evaluateServiceFinanceIntent,
    [{ source: { ...financeSnapshot.source, workspace_id: other } },
      { finance_receipt: { ...financeSnapshot.finance_receipt, order_version: 18 } },
      { finance_receipt: { ...financeSnapshot.finance_receipt, source_version: 22 } },
      { finance_receipt: { ...financeSnapshot.finance_receipt, decision_status: 'denied' } }]],
  ['experience', experienceSnapshot, experienceIntent, modules.experience.evaluateServiceExperienceIntent,
    [{ subject: { ...experienceSnapshot.subject, order_id: other } },
      { coordination_receipt: { ...experienceSnapshot.coordination_receipt, service_order_version: 18 } },
      { coordination_receipt: { ...experienceSnapshot.coordination_receipt, subject_version: 22 } }]],
]) changes.forEach((change, i) => check(`${name}: independent nested isolation/deny ${i + 1}`, () => assert.notEqual(evaluate(intent, { ...snapshot, ...change }), 'OK')));

// Adversarial review requirements: failures remain blockers, not accepted evidence.
check('SV01H: old capacity receipt cannot authorize a changed Order version', () => {
  assert.notEqual(modules.booking.evaluateServiceBooking({ ...bookingIntent, expected_order_version: 18 },
    { ...bookingSnapshot, order: { ...order, version: 18 } }), 'OK');
});
check('SV01H: old capacity receipt cannot authorize a changed stage version', () => {
  assert.notEqual(modules.booking.evaluateServiceBooking({ ...bookingIntent, expected_stage_version: 22 },
    { ...bookingSnapshot, stage: { ...bookingSnapshot.stage, version: 22 } }), 'OK');
});
check('SV01N: CE receipt must bind the status reference acknowledged', () => {
  assert.notEqual(modules.experience.evaluateServiceExperienceIntent({ ...experienceIntent, status_reference_id: other }, experienceSnapshot), 'OK');
});
check('SV01K/L: collaboration reference source version is exact', () => {
  assert.equal(modules.collaboration.evaluateServiceCollaborationLink(linkIntent,
    { ...linkSnapshot, subjectLinkReceipt: { ...linkSnapshot.subjectLinkReceipt,
      source_identity: { ...linkSnapshot.subjectLinkReceipt.source_identity, version: 24 } } }), 'STALE_REFERENCE');
});
check('SV01G/J: delivery evidence source version is exact', () => {
  assert.equal(modules.delivery.evaluateServiceDelivery(deliveryIntent,
    { ...deliverySnapshot, evidenceReceipt: { ...deliverySnapshot.evidenceReceipt, evidence_references: [
      { ...deliverySnapshot.evidenceReceipt.evidence_references[0], source_version: 24 }] } }),
  'STALE_EVIDENCE_REFERENCE');
});
const heldAllocation = { id: id(16), workspace_id: id(2), order_id: id(3), stage_id: id(6), version: 2,
  state: 'held', expires_at: '2026-10-11T09:00:00Z' };
const rescheduleIntent = { ...bookingIntent, action: 'reschedule', allocation_id: id(16), expected_allocation_version: 2 };
const rescheduleReceipt = { ...bookingSnapshot.capacity_receipt, action: 'reschedule', allocation_id: id(16),
  allocation_version: 2 };
check('SV01H: expired held allocation cannot be rescheduled', () => {
  assert.equal(modules.booking.evaluateServiceBooking(rescheduleIntent,
    { ...bookingSnapshot, now: Date.parse(heldAllocation.expires_at), allocation: heldAllocation,
      capacity_receipt: rescheduleReceipt }), 'ACTION_NOT_ALLOWED');
});
const cancelIntent = { context_id: base.context_id, workspace_id: base.workspace_id,
  service_order_id: base.service_order_id, expected_order_version: base.expected_order_version,
  service_stage_id: bookingIntent.service_stage_id, expected_stage_version: bookingIntent.expected_stage_version,
  allocation_id: id(16), expected_allocation_version: 2, action: 'cancel', reason_code: 'CUSTOMER_REQUEST',
  idempotency_key: base.idempotency_key };
const cancelReceipt = { ...bookingSnapshot.capacity_receipt, action: 'cancel', allocation_id: id(16), allocation_version: 2,
  requested_start: null, requested_end: null, requested_capacity: null, resource_ids: [] };
check('SV01H: expired held allocation cannot be cancelled', () => {
  assert.equal(modules.booking.evaluateServiceBooking(cancelIntent,
    { ...bookingSnapshot, now: Date.parse(heldAllocation.expires_at), allocation: heldAllocation,
      capacity_receipt: cancelReceipt }), 'ACTION_NOT_ALLOWED');
});
check('SV01I: portfolio receipt binds the exact Order reference', () => {
  assert.equal(modules.portfolio.evaluateServicePortfolioAction(portfolioIntent,
    { ...portfolioSnapshot, portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt,
      order_references: [{ ...portfolioSnapshot.portfolio_receipt.order_references[0], service_order_id: other }] } }),
  'ORDER_UNAVAILABLE');
});
check('SV01M: Finance receipt binds the exact idempotency key', () => {
  assert.equal(modules.finance.evaluateServiceFinanceIntent(financeIntent,
    { ...financeSnapshot, finance_receipt: { ...financeSnapshot.finance_receipt,
      idempotency_key: `${financeIntent.idempotency_key}-replay` } }), 'FINANCE_RECEIPT_MISMATCH');
});
check('SV01N: full CE receipt binds receipt identity', () => {
  assert.equal(modules.experience.evaluateServiceExperienceIntent(experienceIntent,
    { ...experienceSnapshot, coordination_receipt: { ...experienceSnapshot.coordination_receipt,
      receipt_id: other } }), 'COORDINATION_RECEIPT_MISMATCH');
});
check('SV01I: invalid projection source version cannot be verified', () => {
  assert.notEqual(modules.portfolio.evaluateServicePortfolioAction(portfolioIntent,
    { ...portfolioSnapshot, portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt,
      source_identity: { ...portfolioSnapshot.portfolio_receipt.source_identity, version: 0 } } }), 'OK');
});
check('SV01G/J: malformed committed quantity must deny', () => {
  assert.notEqual(modules.delivery.evaluateServiceDelivery(deliveryIntent,
    { ...deliverySnapshot, stage: { ...deliverySnapshot.stage, committed_quantity: 'not-a-decimal' } }), 'OK');
});
check('SV01G/J: malformed delivered quantity must deny acceptance', () => {
  const { evidence_references: _evidence, ...accept } = deliveryIntent;
  assert.notEqual(modules.delivery.evaluateServiceDelivery({ ...accept, action: 'accept_delivery' },
    { ...deliverySnapshot, stage: { ...deliverySnapshot.stage, status: 'awaiting_acceptance', delivered_quantity: 'not-a-decimal' } }), 'OK');
});

for (const value of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
  check(`SV01I: invalid source version ${String(value)} denies`, () => {
    assert.equal(modules.portfolio.evaluateServicePortfolioAction(portfolioIntent,
      { ...portfolioSnapshot, portfolio_receipt: { ...portfolioSnapshot.portfolio_receipt,
        source_identity: { ...portfolioSnapshot.portfolio_receipt.source_identity, version: value } } }), 'PORTFOLIO_RECEIPT_REQUIRED');
  });
}
for (const value of ['NaN', '-1', '', '1e2', '0.0000001', '1000000000000']) {
  check(`SV01G/J: malformed commitment ${JSON.stringify(value)} denies`, () => {
    assert.equal(modules.delivery.evaluateServiceDelivery(deliveryIntent,
      { ...deliverySnapshot, stage: { ...deliverySnapshot.stage, committed_quantity: value } }), 'QUANTITY_EXCEEDED');
  });
}
for (const field of ['order_version', 'stage_version']) {
  check(`SV01H: receipt missing ${field} denies`, () => {
    const receipt = { ...bookingSnapshot.capacity_receipt }; delete receipt[field];
    assert.equal(modules.booking.evaluateServiceBooking(bookingIntent,
      { ...bookingSnapshot, capacity_receipt: receipt }), 'CAPACITY_DECISION_MISMATCH');
  });
}
check('SV01N: receipt missing acknowledged status reference denies', () => {
  const receipt = { ...experienceSnapshot.coordination_receipt }; delete receipt.status_reference_id;
  assert.equal(modules.experience.evaluateServiceExperienceIntent(experienceIntent,
    { ...experienceSnapshot, coordination_receipt: receipt }), 'COORDINATION_RECEIPT_MISMATCH');
});
const summary = { pass: results.filter(r => r.result === 'pass').length,
  fail: results.filter(r => r.result === 'fail').length,
  protocol_version_status: 'blocked: owner-approved protocol envelopes and adapters absent; entity versions are not protocol versions',
  runtime_status: 'not_run: DB/API/browser/concurrency/transaction zero-write assertions require owner adapters and DB-HIST-01 closure',
  results };
assert.equal(summary.pass + summary.fail, 195, 'independent suite case count changed');
console.log(summary.fail === 0
  ? `SERVICE independent review: ${summary.pass}/195 PASS`
  : JSON.stringify({ ...summary, results: results.filter(r => r.result === 'fail') }, null, 2));
if (summary.fail) process.exitCode = 1;
