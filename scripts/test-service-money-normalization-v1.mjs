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

const implementationUrl = new URL(
  '../src/lib/customer/service-money-normalization-v1.ts', import.meta.url,
);
const {
  SERVICE_MONEY_NORMALIZATION_REQUEST_V1,
  evaluateServiceMoneyNormalizationV1,
  serviceMoneyNormalizationDecisionV1Schema,
} = load(implementationUrl);
const {
  CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
  calculateJurisdictionDomainArtifactSha256V1,
} = load(new URL('../src/lib/core/jurisdiction-domain-artifact-v1.ts', import.meta.url));

const hash = value => createHash('sha256').update(value).digest('hex');
const evaluatedAt = '2026-10-16T12:00:00.000Z';
const policies = {
  BHD: { exponent: 3, rounding_mode: 'half_even', increment_minor_units: 1 },
  EUR: { exponent: 2, rounding_mode: 'half_even', increment_minor_units: 1 },
  JPY: { exponent: 0, rounding_mode: 'half_even', increment_minor_units: 1 },
  RON: { exponent: 6, rounding_mode: 'half_up', increment_minor_units: 1 },
};

const approvedReview = seed => ({
  status: 'approved',
  review_version: 1,
  reviewed_at: '2026-09-01T00:00:00.000Z',
  evidence_sha256: hash(seed),
});

function artifactFor(currency, overrides = {}) {
  const policy = { currency_code: currency, ...policies[currency], ...overrides.policy };
  const hashInput = {
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
    artifact_version: 1,
    profile: {
      profile_id: '00000000-0000-4000-8000-000000000101',
      profile_code: 'synthetic.money.fixture',
      profile_version: 1,
      country_code: 'ZZ',
      manifest_sha256: hash('synthetic-manifest'),
    },
    domain: {
      domain_code: 'payments.policy',
      domain_version: 'payments-policy.v1',
      policy: {
        currencies: [policy],
        rails: [{
          rail_code: 'synthetic_fixture',
          status: 'active',
          supported_currency_codes: [currency],
          supported_operations: ['authorize'],
          settlement: { mode: 'same_day', maximum_business_days: 0,
            finality_code: 'synthetic' },
          refund: { supported: false, original_rail_required: false, maximum_days: null },
          receipt_invoice: { receipt_required: false, invoice_required: false,
            evidence_codes: [] },
          regulatory_evidence: { required: false, evidence_codes: [] },
        }],
      },
    },
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: null,
    status: 'active',
    legal_review: approvedReview('legal'),
    accounting_review: approvedReview('accounting'),
    reusable_as_command_authority: false,
    ...overrides.artifact,
  };
  return { ...hashInput,
    artifact_sha256: calculateJurisdictionDomainArtifactSha256V1(hashInput) };
}

function request(currency, amount, operation = 'decimal_to_minor', overrides = {}) {
  return {
    contract_version: SERVICE_MONEY_NORMALIZATION_REQUEST_V1,
    operation,
    currency_code: currency,
    amount,
    effective_at: evaluatedAt,
    ...overrides,
  };
}

function evaluate(currency, amount, options = {}) {
  return evaluateServiceMoneyNormalizationV1({
    request: request(currency, amount, options.operation, options.request),
    artifact: options.artifact ?? artifactFor(currency, options.artifactOptions),
  });
}

function accepted(result, decimal, minor) {
  assert.equal(result.decision, 'accepted');
  assert.equal(result.decimal_amount, decimal);
  assert.equal(result.minor_units, minor);
  assert.equal(result.durable_writes, 0);
  assert.equal(result.rail_selected, false);
  assert.equal(result.provider_selected, false);
  assert.equal(result.payment_intent_created, false);
  serviceMoneyNormalizationDecisionV1Schema.parse(result);
}

function denied(result, reason) {
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, reason);
  assert.equal(result.durable_writes, 0);
  assert.equal(result.rail_selected, false);
  assert.equal(result.provider_selected, false);
  assert.equal(result.payment_intent_created, false);
  serviceMoneyNormalizationDecisionV1Schema.parse(result);
}

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

test('exponent 0 synthetic JPY half-even', () =>
  accepted(evaluate('JPY', '123.5'), '124', '124'));
test('exponent 2 synthetic EUR', () =>
  accepted(evaluate('EUR', '1.235'), '1.24', '124'));
test('exponent 3 synthetic BHD', () =>
  accepted(evaluate('BHD', '1.2345'), '1.234', '1234'));
test('exponent 6 synthetic RON', () =>
  accepted(evaluate('RON', '0.1234567'), '0.123457', '123457'));

test('half-even tie rounds even quotient down', () =>
  accepted(evaluate('EUR', '1.225'), '1.22', '122'));
test('half-even tie rounds odd quotient up', () =>
  accepted(evaluate('EUR', '1.235'), '1.24', '124'));
test('half-up positive tie rounds away from zero', () =>
  accepted(evaluate('EUR', '1.225', { artifactOptions: {
    policy: { rounding_mode: 'half_up' },
  } }), '1.23', '123'));
test('down positive rounds toward zero', () =>
  accepted(evaluate('EUR', '1.239', { artifactOptions: {
    policy: { rounding_mode: 'down' },
  } }), '1.23', '123'));
test('up positive rounds away from zero', () =>
  accepted(evaluate('EUR', '1.231', { artifactOptions: {
    policy: { rounding_mode: 'up' },
  } }), '1.24', '124'));

test('non-unit increment rounds down to multiple', () =>
  accepted(evaluate('EUR', '1.02', { artifactOptions: {
    policy: { rounding_mode: 'half_up', increment_minor_units: 5 },
  } }), '1.00', '100'));
test('non-unit increment rounds up to multiple', () =>
  accepted(evaluate('EUR', '1.03', { artifactOptions: {
    policy: { rounding_mode: 'half_up', increment_minor_units: 5 },
  } }), '1.05', '105'));
test('non-unit half-even uses increment quotient parity', () =>
  accepted(evaluate('EUR', '1.025', { artifactOptions: {
    policy: { rounding_mode: 'half_even', increment_minor_units: 5 },
  } }), '1.00', '100'));
test('minor to decimal exponent 0', () =>
  accepted(evaluate('JPY', '123', { operation: 'minor_to_decimal' }), '123', '123'));
test('minor to decimal exponent 2', () =>
  accepted(evaluate('EUR', '5', { operation: 'minor_to_decimal' }), '0.05', '5'));
test('minor to decimal exponent 3', () =>
  accepted(evaluate('BHD', '12345', { operation: 'minor_to_decimal' }), '12.345', '12345'));
test('minor to decimal exponent 6', () =>
  accepted(evaluate('RON', '1', { operation: 'minor_to_decimal' }), '0.000001', '1'));
test('minor input must align with non-unit increment', () =>
  denied(evaluate('EUR', '102', { operation: 'minor_to_decimal', artifactOptions: {
    policy: { increment_minor_units: 5 },
  } }), 'MINOR_INCREMENT_MISMATCH'));

for (const rounding_mode of ['half_even', 'half_up', 'down', 'up']) {
  test(`negative decimal is denied for ${rounding_mode}`, () =>
    denied(evaluate('EUR', '-1.235', { artifactOptions: {
      policy: { rounding_mode },
    } }), 'INVALID_DECIMAL_AMOUNT'));
  test(`negative minor units are denied for ${rounding_mode}`, () =>
    denied(evaluate('EUR', '-123', { operation: 'minor_to_decimal', artifactOptions: {
      policy: { rounding_mode },
    } }), 'INVALID_MINOR_AMOUNT'));
}
test('negative decimal zero is denied', () =>
  denied(evaluate('EUR', '-0'), 'INVALID_DECIMAL_AMOUNT'));
test('negative fixed decimal zero is denied', () =>
  denied(evaluate('EUR', '-0.00'), 'INVALID_DECIMAL_AMOUNT'));
test('negative minor zero is denied', () =>
  denied(evaluate('EUR', '-0', { operation: 'minor_to_decimal' }), 'INVALID_MINOR_AMOUNT'));

for (const invalid of ['', '1.', '.1', '+1', '01', '1e2', 'NaN', 'Infinity', ' 1', '1,2']) {
  test(`invalid decimal is denied: ${JSON.stringify(invalid)}`, () =>
    denied(evaluate('EUR', invalid), 'INVALID_DECIMAL_AMOUNT'));
}
for (const invalid of ['1.0', '+1', '01', '1e2', 'NaN']) {
  test(`invalid minor amount is denied: ${invalid}`, () =>
    denied(evaluate('EUR', invalid, { operation: 'minor_to_decimal' }),
      'INVALID_MINOR_AMOUNT'));
}

test('decimal overflow is denied', () =>
  denied(evaluate('JPY', '100000000000000000000000000000000000000'), 'AMOUNT_OVERFLOW'));
test('minor overflow is denied', () =>
  denied(evaluate('JPY', '100000000000000000000000000000000000000', {
    operation: 'minor_to_decimal',
  }), 'AMOUNT_OVERFLOW'));
test('maximum bounded minor value is accepted', () =>
  accepted(evaluate('JPY', '99999999999999999999999999999999999999', {
    operation: 'minor_to_decimal',
  }), '99999999999999999999999999999999999999',
  '99999999999999999999999999999999999999'));

test('missing explicit currency is malformed', () => {
  const value = request('EUR', '1.00');
  delete value.currency_code;
  denied(evaluateServiceMoneyNormalizationV1({ request: value, artifact: artifactFor('EUR') }),
    'MALFORMED_REQUEST');
});
test('unknown currency has no RON or global fallback', () => {
  denied(evaluateServiceMoneyNormalizationV1({
    request: request('USD', '1.00'), artifact: artifactFor('EUR'),
  }), 'CURRENCY_POLICY_UNAVAILABLE');
});
test('missing exponent fails closed', () => {
  const value = artifactFor('EUR');
  delete value.domain.policy.currencies[0].exponent;
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_INVALID');
});
test('missing rounding mode fails closed', () => {
  const value = artifactFor('EUR');
  delete value.domain.policy.currencies[0].rounding_mode;
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_INVALID');
});
test('missing increment fails closed', () => {
  const value = artifactFor('EUR');
  delete value.domain.policy.currencies[0].increment_minor_units;
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_INVALID');
});
test('unsupported exponent fails closed', () => {
  const value = artifactFor('EUR');
  value.domain.policy.currencies[0].exponent = 7;
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_INVALID');
});
test('tampered artifact hash is denied', () => {
  const value = artifactFor('EUR');
  value.domain.policy.currencies[0].exponent = 3;
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_HASH_MISMATCH');
});
test('inactive artifact is denied', () => {
  const value = artifactFor('EUR', { artifact: { status: 'suspended' } });
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_INACTIVE');
});
test('future artifact is denied', () => {
  const value = artifactFor('EUR', { artifact: {
    effective_from: '2027-01-01T00:00:00.000Z',
  } });
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'ARTIFACT_NOT_EFFECTIVE');
});
test('unreviewed artifact is denied', () => {
  const value = artifactFor('EUR', { artifact: { legal_review: {
    status: 'pending', review_version: 1, reviewed_at: null, evidence_sha256: null,
  } } });
  denied(evaluateServiceMoneyNormalizationV1({ request: request('EUR', '1.00'), artifact: value }),
    'REVIEW_UNAVAILABLE');
});

test('evaluation does not mutate request or artifact', () => {
  const requestValue = request('EUR', '10.005');
  const artifactValue = artifactFor('EUR');
  const before = JSON.stringify({ requestValue, artifactValue });
  evaluateServiceMoneyNormalizationV1({ request: requestValue, artifact: artifactValue });
  assert.equal(JSON.stringify({ requestValue, artifactValue }), before);
});
test('implementation is resolver-independent and contains no I/O surface', () => {
  const source = readFileSync(implementationUrl, 'utf8');
  assert.doesNotMatch(source, /jurisdiction-domain-artifact-resolver/i);
  assert.doesNotMatch(source, /create(?:Admin)?Client\(|fetch\(|\.rpc\(|process\.env|\.from\(/i);
  assert.doesNotMatch(source, /parseFloat|parseInt|Number\(|Math\.|toFixed/);
  assert.match(source, /coreJurisdictionDomainArtifactV1Schema/);
});
test('synthetic currency fixtures make no legal claim', () => {
  const document = readFileSync(new URL(
    '../docs/contracts/CLADORA-SERVICE-MONEY-NORMALIZATION-v1.0.md', import.meta.url,
  ), 'utf8');
  assert.match(document, /synthetic test fixtures/i);
  assert.match(document, /not legal, regulatory,\s*rail, or provider evidence/i);
});

process.stdout.write(`\nSERVICE money normalization: ${passed}/${passed} PASS\n`);
