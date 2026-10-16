import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  const mod = { exports: {} }; cache.set(url.href, mod.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name), mod, mod.exports);
  return mod.exports;
}

const {
  CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
  calculateJurisdictionDomainArtifactSha256V1,
} = load(new URL('../src/lib/core/jurisdiction-domain-artifact-v1.ts', import.meta.url));
const {
  DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1,
  evaluateDocumentsCountryRetentionV1,
} = load(new URL('../src/lib/customer/documents-country-retention-evaluator-v1.ts', import.meta.url));

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const effectiveAt = '2026-10-16T10:00:00.000Z';
const approvedReview = seed => ({
  status: 'approved', review_version: 1,
  reviewed_at: '2026-10-01T00:00:00.000Z', evidence_sha256: hash(seed),
});

function withHash(hashInput) {
  return {
    ...hashInput,
    artifact_sha256: calculateJurisdictionDomainArtifactSha256V1(hashInput),
  };
}

function retentionArtifact(overrides = {}) {
  const base = {
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
    artifact_version: 1,
    profile: {
      profile_id: id(1), profile_code: 'synthetic.property.2026', profile_version: 3,
      country_code: 'XZ', manifest_sha256: hash('synthetic:manifest:3'),
    },
    domain: {
      domain_code: 'documents.retention', domain_version: 'documents-retention.v1',
      policy: {
        document_types: [
          { document_type_code: 'billing.invoice', retention_rule_code: 'retention.invoice',
            retention_period: 'P7Y', legal_hold_overrides_disposal: true,
            immutable_version_required: true, evidence_codes: ['document.review'] },
          { document_type_code: 'payment.receipt', retention_rule_code: 'retention.receipt',
            retention_period: 'P5Y6M', legal_hold_overrides_disposal: true,
            immutable_version_required: true, evidence_codes: [] },
        ],
        disposal_requires_review: true,
        residency_rule_code: 'residency.synthetic',
      },
    },
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: '2027-01-01T00:00:00.000Z',
    status: 'active',
    legal_review: approvedReview('legal'),
    accounting_review: approvedReview('accounting'),
    reusable_as_command_authority: false,
    ...overrides,
  };
  return withHash(base);
}

function request(artifact, overrides = {}) {
  return {
    contract_version: DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1,
    artifact,
    document_type_code: 'billing.invoice',
    document_immutable_version: 4,
    effective_at: effectiveAt,
    legal_hold_state: 'none',
    requested_operation: 'retain',
    ...overrides,
  };
}

function rehash(artifact, changes) {
  const { artifact_sha256: _oldHash, ...hashInput } = artifact;
  return withHash({ ...hashInput, ...changes });
}

let checks = 0;
const check = (name, action) => {
  action();
  console.log(`ok ${++checks} - ${name}`);
};

const artifact = retentionArtifact();

check('retain returns a bounded deterministic fingerprint and retention rule', () => {
  const input = request(artifact);
  const first = evaluateDocumentsCountryRetentionV1(input);
  const second = evaluateDocumentsCountryRetentionV1(input);
  assert.deepEqual(first, second);
  assert.equal(first.decision, 'accepted');
  assert.equal(first.resolution.retention_rule_code, 'retention.invoice');
  assert.equal(first.resolution.retention_period, 'P7Y');
  assert.equal(first.resolution.document_immutable_version, 4);
  assert.equal(first.resolution.operation_effect, 'retention_required');
  assert.equal(first.artifact_fingerprint.artifact_contract_version,
    'core-jurisdiction-domain-artifact.v1');
  assert.equal(first.artifact_fingerprint.profile_version, 3);
  assert.equal(first.artifact_fingerprint.artifact_sha256, artifact.artifact_sha256);
  assert.equal(first.reusable_as_command_authority, false);
});

check('read-policy returns policy metadata without authority', () => {
  const result = evaluateDocumentsCountryRetentionV1(request(artifact, {
    requested_operation: 'read-policy', legal_hold_state: 'active',
  }));
  assert.equal(result.decision, 'accepted');
  assert.equal(result.resolution.operation_effect, 'policy_available');
  assert.equal(result.reusable_as_command_authority, false);
});

check('disposal requires review when no legal hold is active', () => {
  const result = evaluateDocumentsCountryRetentionV1(request(artifact, {
    requested_operation: 'dispose',
  }));
  assert.equal(result.decision, 'accepted');
  assert.equal(result.resolution.operation_effect, 'disposal_review_required');
});

check('active legal hold always blocks disposal', () => {
  const result = evaluateDocumentsCountryRetentionV1(request(artifact, {
    requested_operation: 'dispose', legal_hold_state: 'active',
  }));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'LEGAL_HOLD_BLOCKS_DISPOSAL');
  assert.equal(result.resolution, null);
  assert.equal(result.reusable_as_command_authority, false);
});

check('missing document type mapping fails closed', () => {
  const result = evaluateDocumentsCountryRetentionV1(request(artifact, {
    document_type_code: 'unknown.document',
  }));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'DOCUMENT_TYPE_UNAVAILABLE');
});

check('ambiguous document type mapping is a malformed artifact', () => {
  const duplicate = structuredClone(artifact);
  duplicate.domain.policy.document_types.push(
    structuredClone(duplicate.domain.policy.document_types[0]),
  );
  const result = evaluateDocumentsCountryRetentionV1(request(duplicate));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'MALFORMED_ARTIFACT');
  assert.equal(result.artifact_fingerprint, null);
});

check('invalid retention rule fails closed', () => {
  const invalid = structuredClone(artifact);
  invalid.domain.policy.document_types[0].retention_period = 'P0Y';
  const result = evaluateDocumentsCountryRetentionV1(request(invalid));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'MALFORMED_ARTIFACT');
});

check('inactive artifact fails closed after exact hash verification', () => {
  const inactive = rehash(artifact, { status: 'retired' });
  const result = evaluateDocumentsCountryRetentionV1(request(inactive));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'ARTIFACT_INACTIVE');
  assert.equal(result.artifact_fingerprint.artifact_sha256, inactive.artifact_sha256);
});

check('artifact hash mismatch fails closed without a trusted fingerprint', () => {
  const changed = structuredClone(artifact);
  changed.domain.policy.document_types[0].retention_period = 'P8Y';
  const result = evaluateDocumentsCountryRetentionV1(request(changed));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'ARTIFACT_HASH_MISMATCH');
  assert.equal(result.artifact_fingerprint, null);
});

check('invalid and out-of-range effective timestamps fail closed', () => {
  const malformed = evaluateDocumentsCountryRetentionV1(request(artifact, {
    effective_at: 'not-a-timestamp',
  }));
  assert.equal(malformed.decision, 'denied');
  assert.equal(malformed.denial_reason, 'MALFORMED_INPUT');
  const before = evaluateDocumentsCountryRetentionV1(request(artifact, {
    effective_at: '2025-12-31T23:59:59.999Z',
  }));
  const upper = evaluateDocumentsCountryRetentionV1(request(artifact, {
    effective_at: artifact.effective_to,
  }));
  assert.equal(before.denial_reason, 'ARTIFACT_NOT_EFFECTIVE');
  assert.equal(upper.denial_reason, 'ARTIFACT_NOT_EFFECTIVE');
});

check('future or unavailable review fails closed', () => {
  const futureReview = rehash(artifact, {
    legal_review: { ...artifact.legal_review, reviewed_at: '2026-12-01T00:00:00.000Z' },
  });
  const result = evaluateDocumentsCountryRetentionV1(request(futureReview));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'REVIEW_UNAVAILABLE');
});

check('wrong domain fails closed', () => {
  const addressInput = {
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
    artifact_version: 1,
    profile: artifact.profile,
    domain: {
      domain_code: 'address.structure', domain_version: 'address-structure.v1',
      policy: {
        country_source: 'explicit_address_country',
        forbidden_country_inference_sources: [
          'currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone',
        ],
        ordered_fields: [
          { field_code: 'country_code', required: true, max_length: 2 },
          { field_code: 'postal_code', required: false, max_length: 32 },
        ],
        postal_code: { value_type: 'country_text', required: false,
          globally_unique: false, normalization: 'preserve', validation: { kind: 'none' } },
      },
    },
    effective_from: artifact.effective_from, effective_to: artifact.effective_to,
    status: 'active', legal_review: artifact.legal_review,
    accounting_review: artifact.accounting_review, reusable_as_command_authority: false,
  };
  const result = evaluateDocumentsCountryRetentionV1(request(withHash(addressInput)));
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'DOMAIN_MISMATCH');
});

check('new artifact cannot mutate prior artifact or decision history', () => {
  const originalArtifact = structuredClone(artifact);
  const oldDecision = evaluateDocumentsCountryRetentionV1(request(artifact));
  const oldDecisionSnapshot = structuredClone(oldDecision);
  const nextInput = structuredClone(artifact);
  nextInput.profile.profile_version = 4;
  nextInput.profile.manifest_sha256 = hash('synthetic:manifest:4');
  nextInput.domain.policy.document_types[0].retention_rule_code = 'retention.invoice.v2';
  nextInput.domain.policy.document_types[0].retention_period = 'P8Y';
  const { artifact_sha256: _old, ...nextHashInput } = nextInput;
  const nextArtifact = withHash(nextHashInput);
  const nextDecision = evaluateDocumentsCountryRetentionV1(request(nextArtifact));
  assert.equal(nextDecision.decision, 'accepted');
  assert.equal(nextDecision.resolution.retention_rule_code, 'retention.invoice.v2');
  assert.notEqual(nextDecision.artifact_fingerprint.artifact_sha256,
    oldDecision.artifact_fingerprint.artifact_sha256);
  assert.deepEqual(artifact, originalArtifact);
  assert.deepEqual(oldDecision, oldDecisionSnapshot);
});

check('output excludes document identity, content, path and Storage data', () => {
  const result = evaluateDocumentsCountryRetentionV1(request(artifact));
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    'document_id', 'document_version_id', 'object_path', 'bucket', 'storage',
    'filename', 'mime_type', 'content_hash', 'content', 'permission',
  ]) assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  assert.equal(Object.hasOwn(result.resolution, 'evidence_codes'), false);
  assert.equal(Object.hasOwn(result.resolution, 'residency_rule_code'), false);
});

check('malformed request is a bounded denial and never throws', () => {
  const result = evaluateDocumentsCountryRetentionV1({});
  assert.deepEqual(result, {
    contract_version: 'documents-country-retention-decision.v1',
    evaluator_version: 1,
    decision: 'denied',
    denial_reason: 'MALFORMED_INPUT',
    requested_operation: null,
    effective_at: null,
    artifact_fingerprint: null,
    resolution: null,
    reusable_as_command_authority: false,
  });
});

check('implementation has no resolver, database, network, clock or random dependency', () => {
  const source = readFileSync(new URL(
    '../src/lib/customer/documents-country-retention-evaluator-v1.ts', import.meta.url), 'utf8');
  for (const forbidden of [
    'jurisdiction-domain-artifact-resolver', 'CoreTransactionScope', 'scope.query',
    'fetch(', 'randomUUID', 'new Date(', 'Date.now(', 'receipt',
  ]) assert.equal(source.includes(forbidden), false, forbidden);
});

console.log(`Documents country retention evaluator: ${checks}/${checks} PASS; pure, inactive, no resolver or writes`);
