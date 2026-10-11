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

const adapters = load(new URL('../src/lib/customer/service-provider-adapter-contracts-v1.ts', import.meta.url));
const id = n => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const authority = { actor_reference_id: actorId, authority_version: 7, outcome: 'allowed' };
let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  return name;
};
const bounded = (decision, status, code) => {
  assert.deepEqual(decision, { status, code });
  assert.deepEqual(Object.keys(decision).sort(), ['code', 'status']);
};
const verified = decision => {
  assert.equal(decision.status, 'verified');
  assert.equal(decision.code, 'OK');
  assert.ok(decision.receipt);
};

const subjectIntent = {
  context_id: id(3), workspace_id: workspaceId, service_request_id: id(4), expected_request_version: 5,
  reference_kind: 'document', reference_id: id(6), source_version: 8, relation: 'evidence',
  idempotency_key: 'sv15-subject-0001',
};
const subjectReceipt = receiptEnvelope({
  contract: 'service-subject-link-adapter.v1', intent: subjectIntent, workspaceId,
  sourceKind: 'document', sourceId: subjectIntent.reference_id, sourceVersion: subjectIntent.source_version,
  actorId, authorityVersion: authority.authority_version,
  request_id: subjectIntent.service_request_id, request_version: subjectIntent.expected_request_version,
  reference_kind: subjectIntent.reference_kind, reference_id: subjectIntent.reference_id,
  reference_version: subjectIntent.source_version, relation: subjectIntent.relation,
  reference_state: 'available', current_actor_can_read: true, request_party_audience_only: true,
});

const deliveryIntent = {
  context_id: id(3), workspace_id: workspaceId, service_order_id: id(10), expected_order_version: 11,
  service_stage_id: id(12), expected_stage_version: 13, quantity: '2.50', action: 'record_delivery',
  evidence_references: [{ reference_id: id(14), source_version: 15 }, { reference_id: id(16), source_version: 17 }],
  idempotency_key: 'sv15-delivery-0001',
};
const deliveryReceipt = receiptEnvelope({
  contract: 'service-delivery-evidence-receipt.v1', intent: deliveryIntent, workspaceId,
  sourceKind: 'service_stage', sourceId: deliveryIntent.service_stage_id,
  sourceVersion: deliveryIntent.expected_stage_version, actorId, authorityVersion: authority.authority_version,
  order_id: deliveryIntent.service_order_id, order_version: deliveryIntent.expected_order_version,
  stage_id: deliveryIntent.service_stage_id, stage_version: deliveryIntent.expected_stage_version,
  evidence_references: deliveryIntent.evidence_references.map(item => ({
    ...item, workspace_id: workspaceId, state: 'available', current_actor_can_read: true,
  })),
});

const workOrderIntent = {
  context_id: id(3), workspace_id: workspaceId, service_order_id: id(10), expected_order_version: 11,
  service_stage_id: id(12), expected_stage_version: 13, execution_kind: 'technical',
  work_order_id: id(20), expected_work_order_version: 21, idempotency_key: 'sv15-work-order-0001',
};
const workOrderReceipt = receiptEnvelope({
  contract: 'service-order-stage-work-order-adapter.v1', intent: workOrderIntent, workspaceId,
  sourceKind: 'service_stage', sourceId: workOrderIntent.service_stage_id,
  sourceVersion: workOrderIntent.expected_stage_version, actorId, authorityVersion: authority.authority_version,
  order_id: workOrderIntent.service_order_id, order_version: workOrderIntent.expected_order_version,
  stage_id: workOrderIntent.service_stage_id, stage_version: workOrderIntent.expected_stage_version,
  work_order_id: workOrderIntent.work_order_id, work_order_version: workOrderIntent.expected_work_order_version,
  work_order_status: 'in_progress', current_actor_can_read: true,
});

const portfolioIntent = {
  context_id: id(3), workspace_id: workspaceId, portfolio_id: id(30), expected_portfolio_version: 31,
  service_order_id: id(10), expected_order_version: 11, action: 'continue_delivery',
  idempotency_key: 'sv15-portfolio-0001',
};
const portfolioReceipt = receiptEnvelope({
  contract: 'portfolio-service-action-projection-receipt.v1', intent: portfolioIntent, workspaceId,
  sourceKind: 'service_portfolio', sourceId: portfolioIntent.portfolio_id,
  sourceVersion: portfolioIntent.expected_portfolio_version, actorId, authorityVersion: authority.authority_version,
  portfolio_id: portfolioIntent.portfolio_id, current_actor_can_read: true,
  order_references: [{ service_order_id: portfolioIntent.service_order_id,
    order_version: portfolioIntent.expected_order_version, resource_id: id(32),
    available_actions: ['view_order', 'continue_delivery'] }],
});

const cases = [
  ['subject', adapters.adaptServiceSubjectLinkReceipt, subjectIntent, subjectReceipt],
  ['evidence', adapters.adaptServiceDeliveryEvidenceReceipt, deliveryIntent, deliveryReceipt],
  ['work-order', adapters.adaptServiceStageWorkOrderReceipt, workOrderIntent, workOrderReceipt],
  ['portfolio', adapters.adaptPortfolioServiceActionProjectionReceipt, portfolioIntent, portfolioReceipt],
];

for (const [name, adapt, intent, receipt] of cases) {
  check(`${name}: exact full receipt accepted`, () => verified(adapt(intent, authority, receipt)));
  check(`${name}: result retains full envelope`, () => {
    const result = adapt(intent, authority, receipt);
    verified(result);
    for (const field of ['contract', 'version', 'receipt_id', 'source_identity', 'workspace_id', 'authority',
      'decision_status', 'result_code', 'reason_code', 'evaluated_at', 'idempotency_key', 'input_fingerprint',
      'idempotency_binding_id']) assert.ok(field in result.receipt, field);
  });
  for (const field of ['contract', 'version', 'receipt_id', 'source_identity', 'workspace_id', 'authority',
    'decision_status', 'result_code', 'evaluated_at', 'idempotency_key', 'input_fingerprint', 'idempotency_binding_id']) {
    check(`${name}: missing ${field} denied`, () => {
      const value = structuredClone(receipt);
      delete value[field];
      bounded(adapt(intent, authority, value), 'denied', 'PROVIDER_RECEIPT_REQUIRED');
    });
  }
  check(`${name}: cross-Workspace denied`, () => bounded(
    adapt(intent, authority, { ...receipt, workspace_id: id(90) }), 'denied', 'PROVIDER_BINDING_MISMATCH',
  ));
  check(`${name}: source identity tamper denied`, () => bounded(
    adapt(intent, authority, { ...receipt, source_identity: { ...receipt.source_identity, id: id(91) } }),
    'denied', 'PROVIDER_BINDING_MISMATCH',
  ));
  check(`${name}: stale source version denied`, () => bounded(
    adapt(intent, authority, { ...receipt, source_identity: { ...receipt.source_identity, version: receipt.source_identity.version + 1 } }),
    'denied', 'STALE_PROVIDER_SOURCE',
  ));
  check(`${name}: actor tamper denied`, () => bounded(
    adapt(intent, authority, { ...receipt, authority: { ...receipt.authority, actor_reference_id: id(92) } }),
    'denied', 'AUTHORITY_STALE',
  ));
  check(`${name}: stale authority denied`, () => bounded(
    adapt(intent, authority, { ...receipt, authority: { ...receipt.authority, authority_version: 8 } }),
    'denied', 'AUTHORITY_STALE',
  ));
  check(`${name}: revoked current authority denied before receipt use`, () => bounded(
    adapt(intent, { ...authority, outcome: 'denied' }, receipt), 'denied', 'AUTHORITY_DENIED',
  ));
  check(`${name}: replay key mismatch conflicts`, () => bounded(
    adapt(intent, authority, { ...receipt, idempotency_key: `${receipt.idempotency_key}-changed` }),
    'conflict', 'REPLAY_CONFLICT',
  ));
  check(`${name}: replay fingerprint mismatch conflicts`, () => bounded(
    adapt(intent, authority, { ...receipt, input_fingerprint: 'svc1:0000000000000000' }),
    'conflict', 'REPLAY_CONFLICT',
  ));
  check(`${name}: provider conflict remains bounded`, () => bounded(
    adapt(intent, authority, { ...receipt, decision_status: 'conflict', result_code: receipt.result_code,
      reason_code: 'SOURCE_CONFLICT' }), 'conflict', 'PROVIDER_CONFLICT',
  ));
  check(`${name}: provider unknown remains bounded`, () => bounded(
    adapt(intent, authority, { ...receipt, decision_status: 'unknown', result_code: receipt.result_code,
      reason_code: 'SOURCE_UNKNOWN' }), 'unknown', 'PROVIDER_UNKNOWN',
  ));
  for (const field of ['private_object_path', 'signed_url', 'payload', 'customer_data']) {
    check(`${name}: ${field} disclosure rejected`, () => bounded(
      adapt(intent, authority, { ...receipt, [field]: 'private-value' }), 'denied', 'PROVIDER_RECEIPT_REQUIRED',
    ));
  }
  check(`${name}: denial is zero-write`, () => {
    const intentBefore = JSON.stringify(intent);
    const receiptBefore = JSON.stringify(receipt);
    bounded(adapt(intent, authority, { ...receipt, workspace_id: id(93) }), 'denied', 'PROVIDER_BINDING_MISMATCH');
    assert.equal(JSON.stringify(intent), intentBefore);
    assert.equal(JSON.stringify(receipt), receiptBefore);
  });
}

check('subject: exact request binding required', () => bounded(
  adapters.adaptServiceSubjectLinkReceipt(subjectIntent, authority, { ...subjectReceipt, request_id: id(80) }),
  'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('subject: exact reference version required', () => bounded(
  adapters.adaptServiceSubjectLinkReceipt(subjectIntent, authority,
    { ...subjectReceipt, reference_version: subjectIntent.source_version + 1 }),
  'denied', 'STALE_PROVIDER_SOURCE',
));
for (const patch of [
  { reference_state: 'quarantined' }, { reference_state: 'deleted' },
  { current_actor_can_read: false }, { request_party_audience_only: false },
]) check(`subject: unavailable reference denied ${JSON.stringify(patch)}`, () => bounded(
  adapters.adaptServiceSubjectLinkReceipt(subjectIntent, authority, { ...subjectReceipt, ...patch }),
  'denied', 'PROVIDER_DENIED',
));

check('evidence: exact Order binding required', () => bounded(
  adapters.adaptServiceDeliveryEvidenceReceipt(deliveryIntent, authority, { ...deliveryReceipt, order_version: 12 }),
  'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('evidence: stale individual source denied', () => {
  const refs = structuredClone(deliveryReceipt.evidence_references);
  refs[0].source_version += 1;
  bounded(adapters.adaptServiceDeliveryEvidenceReceipt(deliveryIntent, authority,
    { ...deliveryReceipt, evidence_references: refs }), 'denied', 'STALE_PROVIDER_SOURCE');
});
check('evidence: other Workspace is bounded', () => {
  const refs = structuredClone(deliveryReceipt.evidence_references);
  refs[0].workspace_id = id(81);
  bounded(adapters.adaptServiceDeliveryEvidenceReceipt(deliveryIntent, authority,
    { ...deliveryReceipt, evidence_references: refs }), 'denied', 'PROVIDER_BINDING_MISMATCH');
});
for (const patch of [{ state: 'quarantined' }, { state: 'deleted' }, { current_actor_can_read: false }]) {
  check(`evidence: unavailable evidence denied ${JSON.stringify(patch)}`, () => {
    const refs = structuredClone(deliveryReceipt.evidence_references);
    Object.assign(refs[0], patch);
    bounded(adapters.adaptServiceDeliveryEvidenceReceipt(deliveryIntent, authority,
      { ...deliveryReceipt, evidence_references: refs }), 'denied', 'PROVIDER_DENIED');
  });
}
check('evidence: duplicate canonical reference denied', () => {
  const refs = [deliveryReceipt.evidence_references[0], deliveryReceipt.evidence_references[0]];
  bounded(adapters.adaptServiceDeliveryEvidenceReceipt(deliveryIntent, authority,
    { ...deliveryReceipt, evidence_references: refs }), 'denied', 'PROVIDER_BINDING_MISMATCH');
});

check('work-order: exact stage binding required', () => bounded(
  adapters.adaptServiceStageWorkOrderReceipt(workOrderIntent, authority, { ...workOrderReceipt, stage_id: id(82) }),
  'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('work-order: stale Work Order version denied', () => bounded(
  adapters.adaptServiceStageWorkOrderReceipt(workOrderIntent, authority,
    { ...workOrderReceipt, work_order_version: workOrderIntent.expected_work_order_version + 1 }),
  'denied', 'STALE_PROVIDER_SOURCE',
));
check('work-order: inaccessible Work Order denied', () => bounded(
  adapters.adaptServiceStageWorkOrderReceipt(workOrderIntent, authority,
    { ...workOrderReceipt, current_actor_can_read: false }), 'denied', 'PROVIDER_DENIED',
));
check('work-order: advisory stage cannot invoke adapter', () => bounded(
  adapters.adaptServiceStageWorkOrderReceipt({ ...workOrderIntent, execution_kind: 'advisory' }, authority, workOrderReceipt),
  'denied', 'PROVIDER_RECEIPT_REQUIRED',
));
for (const field of ['delivery_accepted', 'settlement_status', 'financial_receipt_id']) {
  check(`work-order: ${field} authority claim rejected`, () => bounded(
    adapters.adaptServiceStageWorkOrderReceipt(workOrderIntent, authority, { ...workOrderReceipt, [field]: true }),
    'denied', 'PROVIDER_RECEIPT_REQUIRED',
  ));
}

check('portfolio: exact portfolio binding required', () => bounded(
  adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, portfolio_id: id(83) }), 'denied', 'PROVIDER_DENIED',
));
check('portfolio: missing Order denied without metadata', () => bounded(
  adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, order_references: [] }), 'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('portfolio: duplicate Order denied', () => bounded(
  adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, order_references: [portfolioReceipt.order_references[0], portfolioReceipt.order_references[0]] }),
  'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('portfolio: duplicate unrelated Order denied', () => bounded(
  adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, order_references: [portfolioReceipt.order_references[0],
      { ...portfolioReceipt.order_references[0], service_order_id: id(84) },
      { ...portfolioReceipt.order_references[0], service_order_id: id(84) }] }),
  'denied', 'PROVIDER_BINDING_MISMATCH',
));
check('portfolio: stale Order version denied', () => {
  const refs = structuredClone(portfolioReceipt.order_references);
  refs[0].order_version += 1;
  bounded(adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, order_references: refs }), 'denied', 'STALE_PROVIDER_SOURCE');
});
check('portfolio: unavailable action denied', () => {
  const refs = structuredClone(portfolioReceipt.order_references);
  refs[0].available_actions = ['view_order'];
  bounded(adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, order_references: refs }), 'denied', 'PROVIDER_DENIED');
});
check('portfolio: revoked current read denied', () => bounded(
  adapters.adaptPortfolioServiceActionProjectionReceipt(portfolioIntent, authority,
    { ...portfolioReceipt, current_actor_can_read: false }), 'denied', 'PROVIDER_DENIED',
));

const source = readFileSync(new URL('../src/lib/customer/service-provider-adapter-contracts-v1.ts', import.meta.url), 'utf8');
check('contract: canonical owners mint receipts', () => assert.match(source, /canonical owners mint receipts/));
check('contract: adapter is pure', () => assert.match(source, /deliberately pure/));
check('contract: no persistence API', () => assert.doesNotMatch(source, /(?:supabase|\.from\(|\.insert\(|\.update\(|fetch\()/));
check('contract: no acceptance conflation', () => assert.match(source, /does not infer delivery acceptance or settlement/));

console.log(`SERVICE provider adapter conformance: ${passed}/${passed} PASS`);
