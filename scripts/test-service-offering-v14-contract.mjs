import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

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

const {
  createServiceOfferingV14Schema,
  createServiceRequestV14Schema,
  serviceConditionEvidenceV1Schema,
  evaluateServiceOfferingEligibility,
} = load(new URL('../src/lib/customer/service-offering-v14-schema.ts', import.meta.url));

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const resource = { resource_id: id(7), resource_version: 3, resource_type: 'unit' };
const providerAgreement = { agreement_id: id(5), agreement_version: 2 };
const revision = {
  labels: { ro: 'Inspecție', en: 'Inspection', fa: 'بازرسی' },
  description: { ro: 'Inspecție tehnică', en: 'Technical inspection', fa: 'بازرسی فنی' },
  acquisition_mode: 'pre_quote', price: { kind: 'quote_required' },
  valid_from: '2026-10-08T00:00:00Z', valid_until: '2027-10-08T00:00:00Z',
  cancellation_terms: { ro: 'Anulare înainte de confirmare', en: 'Cancel before confirmation', fa: 'لغو پیش از تأیید' },
  acceptance_criteria: { ro: 'Raport complet', en: 'Complete report', fa: 'گزارش کامل' }, document_version_ids: [],
};
const offeringCommand = {
  context_id: id(1), workspace_id: id(2), definition_id: id(3), provider_party_id: id(4), provider_agreement: providerAgreement,
  coverage: { kind: 'resources', resources: [resource] },
  eligibility: { policy_version: 1, required_resource_types: ['unit'], required_capabilities: ['module.services_catalog'], required_policy_codes: ['service.inspection.allowed'] },
  revision, idempotency_key: 'service-v14-offering-001',
};
assert.equal(createServiceOfferingV14Schema.safeParse(offeringCommand).success, true);
for (const field of ['actor_id', 'tenant_id', 'agreement_status', 'resource_access', 'valuation_effect']) {
  assert.equal(createServiceOfferingV14Schema.safeParse({ ...offeringCommand, [field]: 'spoofed' }).success, false);
}
assert.equal(createServiceOfferingV14Schema.safeParse({ ...offeringCommand, coverage: { kind: 'resources', resources: [resource, resource] } }).success, false);

const requestCommand = {
  context_id: id(1), workspace_id: id(2), offering_id: id(8), published_revision_id: id(9), provider_agreement: providerAgreement,
  resource, beneficiary_party_id: id(10), description: 'Inspect the selected unit', idempotency_key: 'service-v14-request-001',
};
assert.equal(createServiceRequestV14Schema.safeParse(requestCommand).success, true);
assert.equal(createServiceRequestV14Schema.safeParse({ ...requestCommand, resource: { ...resource, resource_version: 0 } }).success, false);

const offering = {
  workspaceId: id(2), providerPartyId: id(4), providerActive: true, agreementId: id(5), agreementVersion: 2,
  agreementStatus: 'active', agreementValidFrom: '2026-10-01T00:00:00Z', agreementValidUntil: '2026-12-01T00:00:00Z',
  offeringStatus: 'published', offeringValidFrom: '2026-10-08T00:00:00Z', offeringValidUntil: '2026-11-01T00:00:00Z',
  coverage: offeringCommand.coverage, eligibility: offeringCommand.eligibility,
};
const trusted = {
  now: Date.parse('2026-10-08T12:00:00Z'), workspaceId: id(2), providerPartyId: id(4), agreementId: id(5), agreementVersion: 2,
  resource, effectiveRole: true, capabilityCodes: new Set(['module.services_catalog']), policyCodes: new Set(['service.inspection.allowed']),
};
assert.equal(evaluateServiceOfferingEligibility(offering, trusted), 'OK');
assert.equal(evaluateServiceOfferingEligibility({ ...offering, providerActive: false }, trusted), 'PROVIDER_INVALID');
assert.equal(evaluateServiceOfferingEligibility({ ...offering, agreementStatus: 'revoked' }, trusted), 'AGREEMENT_INACTIVE');
assert.equal(evaluateServiceOfferingEligibility(offering, { ...trusted, agreementVersion: 1 }), 'STALE_REFERENCE');
assert.equal(evaluateServiceOfferingEligibility(offering, { ...trusted, workspaceId: id(99) }), 'SCOPE_DENIED');
assert.equal(evaluateServiceOfferingEligibility(offering, { ...trusted, resource: { ...resource, resource_version: 2 } }), 'SCOPE_DENIED');
assert.equal(evaluateServiceOfferingEligibility(offering, { ...trusted, effectiveRole: false }), 'ROLE_REVOKED');
assert.equal(evaluateServiceOfferingEligibility(offering, { ...trusted, policyCodes: new Set() }), 'PREREQUISITE_MISSING');
assert.equal(evaluateServiceOfferingEligibility({ ...offering, offeringValidUntil: '2026-10-08T11:00:00Z' }, trusted), 'OFFERING_UNAVAILABLE');

const workspaceOffering = { ...offering, coverage: { kind: 'workspace' } };
assert.equal(evaluateServiceOfferingEligibility(workspaceOffering, { ...trusted, resource: null }), 'PREREQUISITE_MISSING');
assert.equal(evaluateServiceOfferingEligibility({
  ...workspaceOffering,
  eligibility: { ...workspaceOffering.eligibility, required_resource_types: [] },
}, { ...trusted, resource: null }), 'OK');
assert.equal(evaluateServiceOfferingEligibility(workspaceOffering, trusted), 'OK');
assert.equal(evaluateServiceOfferingEligibility(workspaceOffering, {
  ...trusted,
  resource: { ...resource, resource_type: 'vehicle' },
}), 'PREREQUISITE_MISSING');

const evidence = {
  evidence_id: id(20), workspace_id: id(2), resource, service_request_id: id(21), service_order_id: null,
  category: 'renovation', status: 'estimated', amount_minor: '125000', currency: 'RON', occurred_on: '2026-10-08',
  source_version_id: id(22), recorded_at: '2026-10-08T12:00:00Z',
};
assert.equal(serviceConditionEvidenceV1Schema.safeParse(evidence).success, true);
assert.equal(serviceConditionEvidenceV1Schema.safeParse({ ...evidence, currency: null }).success, false);
assert.equal(serviceConditionEvidenceV1Schema.safeParse({ ...evidence, service_request_id: null }).success, false);
assert.equal(serviceConditionEvidenceV1Schema.safeParse({ ...evidence, valuation_effect: 1.2 }).success, false);

console.log('PASS V14 SERVICE 01 contract: provider agreement, versioned coverage/resource, eligibility denial and valuation-neutral evidence');
