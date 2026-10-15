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
  CORE_JURISDICTION_DOMAIN_BIND_REQUEST_V1,
  bindCoreJurisdictionDomainArtifactV1,
  calculateJurisdictionDomainArtifactSha256V1,
  coreJurisdictionDomainArtifactV1Schema,
  postalCodeMatchesBoundCountryArtifactV1,
} = load(new URL('../src/lib/core/jurisdiction-domain-artifact-v1.ts', import.meta.url));

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const evaluatedAt = '2026-10-15T12:00:00.000Z';
const digits = length => ({ kind: 'digits', length });
const literal = value => ({ kind: 'literal', value });

const fixtures = [
  { country: 'DE', currency: 'EUR', exponent: 2, rail: 'sepa_credit',
    formats: [{ segments: [digits(5)] }], postal: '10115',
    fields: ['country_code', 'postal_code', 'locality', 'street_name', 'street_number'] },
  { country: 'US', currency: 'USD', exponent: 2, rail: 'ach_debit',
    formats: [{ segments: [digits(5)] },
      { segments: [digits(5), literal('-'), digits(4)] }], postal: '02108-1234',
    fields: ['country_code', 'street_number', 'street_name', 'locality',
      'administrative_area', 'postal_code'] },
  { country: 'JP', currency: 'JPY', exponent: 0, rail: 'bank_transfer_jp',
    formats: [{ segments: [digits(3), literal('-'), digits(4)] }], postal: '100-0001',
    fields: ['country_code', 'postal_code', 'administrative_area', 'locality', 'street_name'] },
  { country: 'KW', currency: 'KWD', exponent: 3, rail: 'domestic_transfer_kw',
    formats: [{ segments: [digits(5)] }], postal: '13001',
    fields: ['country_code', 'administrative_area', 'locality', 'block',
      'street_name', 'building', 'postal_code'] },
  { country: 'IR', currency: 'IRR', exponent: 2, rail: 'domestic_transfer_ir',
    formats: [{ segments: [digits(10)] }], postal: '1136917111',
    fields: ['country_code', 'administrative_area', 'locality', 'postal_code',
      'street_name', 'building', 'unit'] },
];

const approvedReview = seed => ({
  status: 'approved', review_version: 1, reviewed_at: '2026-09-01T00:00:00.000Z',
  evidence_sha256: hash(seed),
});

function profile(fixture, ordinal) {
  return {
    profile_id: id(100 + ordinal),
    profile_code: `${fixture.country.toLowerCase()}.property.2026`,
    profile_version: 1,
    country_code: fixture.country,
    manifest_sha256: hash(`${fixture.country}:manifest`),
  };
}

function artifact(hashInput) {
  return {
    ...hashInput,
    artifact_sha256: calculateJurisdictionDomainArtifactSha256V1(hashInput),
  };
}

function baseArtifact(fixture, ordinal, domain) {
  return {
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
    artifact_version: 1,
    profile: profile(fixture, ordinal),
    domain,
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: null,
    status: 'active',
    legal_review: approvedReview(`${fixture.country}:${domain.domain_code}:legal`),
    accounting_review: approvedReview(`${fixture.country}:${domain.domain_code}:accounting`),
    reusable_as_command_authority: false,
  };
}

function addressArtifact(fixture, ordinal) {
  return artifact(baseArtifact(fixture, ordinal, {
    domain_code: 'address.structure',
    domain_version: 'address-structure.v1',
    policy: {
      country_source: 'explicit_address_country',
      forbidden_country_inference_sources: [
        'currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone',
      ],
      ordered_fields: fixture.fields.map(fieldCode => ({
        field_code: fieldCode, required: fieldCode === 'country_code'
          || fieldCode === 'postal_code' || fieldCode === 'locality', max_length: 256,
      })),
      postal_code: {
        value_type: 'country_text', required: true, globally_unique: false,
        normalization: 'uppercase_trim',
        validation: { kind: 'country_artifact_grammar', formats: fixture.formats },
      },
    },
  }));
}

function paymentArtifact(fixture, ordinal, railStatus = 'active', railOverrides = {}) {
  return artifact(baseArtifact(fixture, ordinal, {
    domain_code: 'payments.policy',
    domain_version: 'payments-policy.v1',
    policy: {
      currencies: [{ currency_code: fixture.currency, exponent: fixture.exponent,
        rounding_mode: 'half_even', increment_minor_units: 1 }],
      rails: [{
        rail_code: fixture.rail, status: railStatus,
        supported_currency_codes: [fixture.currency],
        supported_operations: ['authorize', 'capture', 'refund', 'settle'],
        settlement: { mode: ordinal % 2 === 0 ? 'same_day' : 'deferred',
          maximum_business_days: ordinal % 2 === 0 ? 0 : 2, finality_code: 'confirmed' },
        refund: { supported: true, original_rail_required: true, maximum_days: 30 },
        receipt_invoice: { receipt_required: true, invoice_required: ordinal % 2 === 0,
          evidence_codes: ['payment.receipt'] },
        regulatory_evidence: { required: true, evidence_codes: ['payment.regulatory'] },
        ...railOverrides,
      }],
    },
  }));
}

function taxArtifact(fixture, ordinal) {
  return artifact(baseArtifact(fixture, ordinal, {
    domain_code: 'finance.tax-accounting',
    domain_version: 'finance-tax-accounting.v1',
    policy: {
      reporting_currency_code: fixture.currency,
      accounting_basis_code: 'country.reviewed_basis',
      monetary_rules: [{ currency_code: fixture.currency, exponent: fixture.exponent,
        rounding_mode: 'half_even', increment_minor_units: 1 }],
      tax_rules: [{ rule_code: 'tax.reviewed_rule', rule_version: 1, status: 'active',
        calculation_basis_code: 'taxable_amount', evidence_codes: ['tax.review'] }],
      posting_rules: [{ event_code: 'invoice.issued', mapping_version: 1,
        debit_class_code: 'receivable', credit_class_code: 'revenue' }],
    },
  }));
}

function documentsArtifact(fixture, ordinal) {
  return artifact(baseArtifact(fixture, ordinal, {
    domain_code: 'documents.retention',
    domain_version: 'documents-retention.v1',
    policy: {
      document_types: [{ document_type_code: 'payment.receipt',
        retention_rule_code: 'country.reviewed_retention', retention_period: 'P5Y',
        legal_hold_overrides_disposal: true, immutable_version_required: true,
        evidence_codes: ['document.review'] }],
      disposal_requires_review: true,
      residency_rule_code: 'country.reviewed_residency',
    },
  }));
}

function selectionFor(value, ordinal, domains = [{
  domain_code: value.domain.domain_code,
  contract_version: value.domain.domain_version,
  artifact_sha256: value.artifact_sha256,
}]) {
  return {
    contract_version: 'core-jurisdiction-profile-selector-decision.v1',
    selector_version: 1,
    decision_id: id(200 + ordinal),
    decision: 'accepted',
    denial_reason: null,
    binding: {
      context_id: id(300 + ordinal), workspace_id: id(400 + ordinal),
      actor_id: id(500 + ordinal), authority_version: 7, property_id: id(600 + ordinal),
      assignment_id: id(700 + ordinal), assignment_version: 1,
      profile_id: value.profile.profile_id, profile_code: value.profile.profile_code,
      profile_version: value.profile.profile_version, country_code: value.profile.country_code,
      default_currency_code: fixtures[ordinal]?.currency ?? 'EUR',
      default_timezone: 'Etc/UTC', calendar_code: 'gregorian',
      profile_manifest_sha256: value.profile.manifest_sha256,
      domains,
    },
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only', source_reference: null,
    reusable_as_command_authority: false,
  };
}

function requestFor(value, paymentUse = null) {
  return {
    contract_version: CORE_JURISDICTION_DOMAIN_BIND_REQUEST_V1,
    domain_code: value.domain.domain_code,
    domain_version: value.domain.domain_version,
    effective_at: evaluatedAt,
    payment_use: paymentUse,
  };
}

function bind(value, ordinal, paymentUse = null, selection = selectionFor(value, ordinal)) {
  return bindCoreJurisdictionDomainArtifactV1({
    selection, artifact: value, request: requestFor(value, paymentUse),
  });
}

let checks = 0;
const check = (name, action) => {
  action();
  console.log(`ok ${++checks} - ${name}`);
};

const addresses = fixtures.map(addressArtifact);
const payments = fixtures.map((fixture, ordinal) => paymentArtifact(fixture, ordinal));

check('five countries bind different address structures and artifact-local postal rules', () => {
  const fieldShapes = new Set();
  fixtures.forEach((fixture, ordinal) => {
    const result = bind(addresses[ordinal], ordinal);
    assert.equal(result.decision, 'accepted');
    assert.equal(result.reusable_as_command_authority, false);
    assert.equal(postalCodeMatchesBoundCountryArtifactV1(result, {
      country_code: fixture.country, postal_code: fixture.postal,
    }), true);
    fieldShapes.add(result.artifact.domain.policy.ordered_fields
      .map(field => field.field_code).join('|'));
  });
  assert.equal(fieldShapes.size, fixtures.length);
});

check('postal codes are reusable country text and have no global regex or inferred country', () => {
  const de = bind(addresses[0], 0);
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(de,
    { country_code: 'DE', postal_code: '10115' }), true);
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(de,
    { country_code: 'DE', postal_code: '10115' }), true,
  'the same postal text may be used by multiple addresses');
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(de,
    { country_code: 'JP', postal_code: '10115' }), false);
  const jp = bind(addresses[2], 2);
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(jp,
    { country_code: 'JP', postal_code: '100-0001' }), true);
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(jp,
    { country_code: 'JP', postal_code: '10115' }), false);
  assert.throws(() => postalCodeMatchesBoundCountryArtifactV1(de, { postal_code: '10115' }));
  assert.throws(() => postalCodeMatchesBoundCountryArtifactV1(de,
    { country_code: 'DE', postal_code: '10115', locale: 'de-DE' }));
});

check('five payment policies bind country rails and currency exponents 0, 2 and 3', () => {
  const exponents = new Set();
  fixtures.forEach((fixture, ordinal) => {
    const result = bind(payments[ordinal], ordinal, {
      currency_code: fixture.currency, rail_code: fixture.rail, operation: 'settle',
    });
    assert.equal(result.decision, 'accepted');
    assert.equal(result.payment_resolution.rail_code, fixture.rail);
    assert.equal(result.payment_resolution.operation, 'settle');
    exponents.add(result.payment_resolution.exponent);
  });
  assert.deepEqual([...exponents].sort(), [0, 2, 3]);
});

check('tax/accounting and documents/retention artifacts bind without payment use', () => {
  const tax = taxArtifact(fixtures[0], 0);
  const documents = documentsArtifact(fixtures[2], 2);
  assert.equal(bind(tax, 0).decision, 'accepted');
  assert.equal(bind(documents, 2).decision, 'accepted');
});

check('missing payment domain and inactive or unsupported rail fail closed', () => {
  const payment = payments[0];
  const addressDomain = {
    domain_code: addresses[0].domain.domain_code,
    contract_version: addresses[0].domain.domain_version,
    artifact_sha256: addresses[0].artifact_sha256,
  };
  const missing = bind(payment, 0, {
    currency_code: 'EUR', rail_code: 'sepa_credit', operation: 'settle',
  }, selectionFor(payment, 0, [addressDomain]));
  assert.equal(missing.decision, 'denied');
  assert.equal(missing.denial_reason, 'DOMAIN_UNAVAILABLE');

  const inactive = paymentArtifact(fixtures[0], 0, 'inactive');
  const inactiveResult = bind(inactive, 0, {
    currency_code: 'EUR', rail_code: 'sepa_credit', operation: 'settle',
  });
  assert.equal(inactiveResult.denial_reason, 'PAYMENT_POLICY_UNAVAILABLE');
  const unsupported = bind(payment, 0, {
    currency_code: 'EUR', rail_code: 'unknown_rail', operation: 'settle',
  });
  assert.equal(unsupported.denial_reason, 'PAYMENT_POLICY_UNAVAILABLE');
});

check('payment operations are rail-scoped and returned in the bounded resolution', () => {
  const settlementOnly = paymentArtifact(fixtures[0], 0, 'active', {
    supported_operations: ['settle'],
    refund: { supported: false, original_rail_required: true, maximum_days: null },
  });
  const settle = bind(settlementOnly, 0, {
    currency_code: 'EUR', rail_code: 'sepa_credit', operation: 'settle',
  });
  assert.equal(settle.decision, 'accepted');
  assert.equal(settle.payment_resolution.operation, 'settle');
  for (const operation of ['authorize', 'capture', 'refund']) {
    const result = bind(settlementOnly, 0, {
      currency_code: 'EUR', rail_code: 'sepa_credit', operation,
    });
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'PAYMENT_POLICY_UNAVAILABLE');
    assert.equal(result.payment_resolution, null);
  }
});

check('payment policy coherence rejects ambiguous operation, refund, evidence and settlement', () => {
  const value = payments[0];
  const rail = value.domain.policy.rails[0];
  const invalidRails = [
    { ...rail, supported_operations: ['settle', 'authorize', 'capture', 'refund'] },
    { ...rail, supported_operations: ['authorize', 'capture', 'refund', 'refund'] },
    { ...rail, refund: { ...rail.refund, maximum_days: null } },
    { ...rail, refund: { ...rail.refund, maximum_days: 0 } },
    { ...rail, supported_operations: ['authorize', 'capture', 'settle'],
      refund: { ...rail.refund, supported: false, maximum_days: 30 } },
    { ...rail, receipt_invoice: { ...rail.receipt_invoice, evidence_codes: [] } },
    { ...rail, regulatory_evidence: { ...rail.regulatory_evidence, evidence_codes: [] } },
    { ...rail, settlement: { ...rail.settlement, maximum_business_days: 2 } },
    { ...rail, settlement: { ...rail.settlement, mode: 'deferred', maximum_business_days: 0 } },
  ];
  for (const invalidRail of invalidRails) {
    const invalid = { ...value, domain: { ...value.domain,
      policy: { ...value.domain.policy, rails: [invalidRail] } } };
    const result = bindCoreJurisdictionDomainArtifactV1({
      selection: selectionFor(value, 0), artifact: invalid,
      request: requestFor(value, {
        currency_code: 'EUR', rail_code: 'sepa_credit', operation: 'settle',
      }),
    });
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'MALFORMED_INPUT');
  }
});

check('postal validation rejects executable regex forms before request evaluation', () => {
  const value = addresses[0];
  const hostilePatterns = ['^(a+)+$', '^(a)\\1$', '^(?=a)a$', '^(a|aa)+$'];
  for (const pattern of hostilePatterns) {
    const invalid = { ...value, domain: { ...value.domain, policy: { ...value.domain.policy,
      postal_code: { ...value.domain.policy.postal_code,
        validation: { kind: 'country_artifact_pattern', pattern, case_insensitive: false } },
    } } };
    const result = bindCoreJurisdictionDomainArtifactV1({
      selection: selectionFor(value, 0), artifact: invalid, request: requestFor(value),
    });
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'MALFORMED_INPUT');
  }
  assert.equal(postalCodeMatchesBoundCountryArtifactV1(bind(value, 0), {
    country_code: 'DE', postal_code: 'a'.repeat(256),
  }), false);
  assert.throws(() => postalCodeMatchesBoundCountryArtifactV1(bind(value, 0), {
    country_code: 'DE', postal_code: 'a'.repeat(257),
  }));
});

check('reporting currency and positive retention duration are coherent', () => {
  const tax = taxArtifact(fixtures[0], 0);
  const invalidTax = { ...tax, domain: { ...tax.domain, policy: { ...tax.domain.policy,
    reporting_currency_code: 'USD' } } };
  assert.equal(bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(tax, 0), artifact: invalidTax, request: requestFor(tax),
  }).denial_reason, 'MALFORMED_INPUT');

  const documents = documentsArtifact(fixtures[2], 2);
  for (const retentionPeriod of ['P', 'P0Y', 'P0M0D']) {
    const invalid = { ...documents, domain: { ...documents.domain,
      policy: { ...documents.domain.policy, document_types: [{
        ...documents.domain.policy.document_types[0], retention_period: retentionPeriod,
      }] } } };
    assert.equal(bindCoreJurisdictionDomainArtifactV1({
      selection: selectionFor(documents, 2), artifact: invalid, request: requestFor(documents),
    }).denial_reason, 'MALFORMED_INPUT');
  }
  assert.equal(bind(documents, 2).decision, 'accepted');
});

check('profile, country, version, domain and hash mismatches fail closed', () => {
  const value = addresses[0];
  const hashMismatch = bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(value, 0), artifact: { ...value, artifact_sha256: '0'.repeat(64) },
    request: requestFor(value),
  });
  assert.equal(hashMismatch.denial_reason, 'ARTIFACT_HASH_MISMATCH');

  for (const changedProfile of [
    { ...value.profile, profile_id: id(999) },
    { ...value.profile, profile_version: 2 },
    { ...value.profile, country_code: 'FR' },
    { ...value.profile, manifest_sha256: hash('different-manifest') },
  ]) {
    const changedInput = { ...value, profile: changedProfile };
    const { artifact_sha256: ignored, ...withoutHash } = changedInput;
    const changed = artifact(withoutHash);
    const result = bind(changed, 0, null, selectionFor(value, 0, [{
      domain_code: value.domain.domain_code,
      contract_version: value.domain.domain_version,
      artifact_sha256: changed.artifact_sha256,
    }]));
    assert.equal(result.denial_reason, 'PROFILE_MISMATCH');
  }
  const wrongDomainRequest = { ...requestFor(value), domain_version: 'address-structure.v2' };
  const wrongDomain = bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(value, 0), artifact: value, request: wrongDomainRequest,
  });
  assert.equal(wrongDomain.denial_reason, 'DOMAIN_MISMATCH');
  const staleTime = bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(value, 0), artifact: value,
    request: { ...requestFor(value), effective_at: '2026-10-15T12:00:01.000Z' },
  });
  assert.equal(staleTime.denial_reason, 'EFFECTIVE_TIME_MISMATCH');
});

check('inactive, expired and unreviewed artifacts fail closed', () => {
  const value = addresses[0];
  for (const [change, reason] of [
    [{ status: 'suspended' }, 'ARTIFACT_INACTIVE'],
    [{ effective_to: '2026-10-01T00:00:00.000Z' }, 'ARTIFACT_NOT_EFFECTIVE'],
    [{ legal_review: { status: 'pending', review_version: 1,
      reviewed_at: null, evidence_sha256: null } }, 'REVIEW_UNAVAILABLE'],
    [{ accounting_review: { status: 'pending', review_version: 1,
      reviewed_at: null, evidence_sha256: null } }, 'REVIEW_UNAVAILABLE'],
  ]) {
    const changedInput = { ...value, ...change };
    const { artifact_sha256: ignored, ...withoutHash } = changedInput;
    const changed = artifact(withoutHash);
    const result = bind(changed, 0, null, selectionFor(changed, 0));
    assert.equal(result.denial_reason, reason);
  }
});

check('credential-like payload fields are rejected before artifact parsing or hashing', () => {
  const value = payments[0];
  const forbidden = {
    ...value,
    domain: { ...value.domain, policy: { ...value.domain.policy,
      provider_merchant_id: 'synthetic', bank_account_number: 'synthetic' } },
  };
  const result = bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(value, 0), artifact: forbidden, request: requestFor(value, {
      currency_code: 'EUR', rail_code: 'sepa_credit', operation: 'settle',
    }),
  });
  assert.equal(result.denial_reason, 'CREDENTIAL_DATA_FORBIDDEN');
  assert.throws(() => calculateJurisdictionDomainArtifactSha256V1(forbidden),
    /credential_data_forbidden/);
});

check('unknown domains and non-explicit country inputs cannot enter the contract', () => {
  const value = addresses[0];
  const unknown = bindCoreJurisdictionDomainArtifactV1({
    selection: selectionFor(value, 0), artifact: value,
    request: { ...requestFor(value), domain_code: 'country.unsupported' },
  });
  assert.equal(unknown.denial_reason, 'MALFORMED_INPUT');
  assert.throws(() => coreJurisdictionDomainArtifactV1Schema.parse({
    ...value, locale: 'de-DE',
  }));
});

check('implementation has deterministic postal grammar and no executable artifact regex', () => {
  const source = readFileSync(new URL(
    '../src/lib/core/jurisdiction-domain-artifact-v1.ts', import.meta.url), 'utf8');
  assert.match(source, /country_artifact_grammar/);
  assert.doesNotMatch(source, /new RegExp|postal\.validation\.pattern/);
  assert.doesNotMatch(source, /GLOBAL_POSTAL|country_code\s*===\s*['"](?:RO|IR)['"]/);
  assert.doesNotMatch(source, /payment.*adapter|merchant.*client|create.*transaction/i);
  assert.match(source, /reusable_as_command_authority:\s*z\.literal\(false\)/);
});

console.log(`Core jurisdiction domain artifact: ${checks}/${checks} PASS; five synthetic countries; no migration, seed, adapter or activation`);
