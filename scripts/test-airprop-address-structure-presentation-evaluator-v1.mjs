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
  AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_REQUEST_V1,
  evaluateAirpropAddressStructurePresentationV1,
} = load(new URL(
  '../src/lib/airprop/address-structure-presentation-evaluator-v1.ts', import.meta.url));

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const effectiveAt = '2026-10-16T12:00:00.000Z';
const digits = length => ({ kind: 'digits', length });
const letters = length => ({ kind: 'letters', length });
const literal = value => ({ kind: 'literal', value });
const approvedReview = seed => ({
  status: 'approved', review_version: 1,
  reviewed_at: '2026-10-01T00:00:00.000Z', evidence_sha256: hash(seed),
});

const fixtures = [
  {
    country: 'XA', postal: '10115', normalization: 'trim',
    fields: [
      ['country_code', true, 2], ['postal_code', true, 16], ['locality', true, 128],
      ['street_name', true, 256], ['street_number', false, 32],
    ],
    formats: [{ segments: [digits(5)] }],
    address: [
      ['street_number', '7'], ['street_name', 'Oak Street'],
      ['locality', 'Northport'], ['postal_code', ' 10115 '],
    ],
  },
  {
    country: 'XB', postal: '10115', normalization: 'uppercase_trim',
    fields: [
      ['country_code', true, 2], ['street_number', true, 32], ['street_name', true, 256],
      ['locality', true, 128], ['administrative_area', true, 128],
      ['postal_code', true, 16],
    ],
    formats: [{ segments: [digits(5)] },
      { segments: [digits(5), literal('-'), digits(4)] }],
    address: [
      ['postal_code', '10115'], ['administrative_area', 'West Territory'],
      ['locality', 'Bay City'], ['street_name', 'Second Avenue'], ['street_number', '14'],
    ],
  },
  {
    country: 'XC', postal: 'ABC-123', normalization: 'uppercase_trim',
    fields: [
      ['country_code', true, 2], ['postal_code', true, 16],
      ['administrative_area', false, 128], ['locality', true, 128],
      ['street_name', true, 256],
    ],
    formats: [{ segments: [letters(3), literal('-'), digits(3)] }],
    address: [
      ['street_name', 'Harbour Road'], ['locality', 'East Cape'],
      ['postal_code', ' abc-123 '],
    ],
  },
  {
    country: 'XD', postal: '1136917111', normalization: 'preserve',
    fields: [
      ['country_code', true, 2], ['administrative_area', true, 128],
      ['locality', true, 128], ['postal_code', true, 16],
      ['street_name', true, 256], ['building', false, 128], ['unit', false, 64],
    ],
    formats: [{ segments: [digits(10)] }],
    address: [
      ['unit', 'واحد ۴'], ['street_name', 'خیابان نمونه'], ['locality', 'شهر آزمایشی'],
      ['administrative_area', 'استان آزمایشی'], ['postal_code', '1136917111'],
    ],
  },
  {
    country: 'XE', postal: null, normalization: 'preserve',
    fields: [
      ['country_code', true, 2], ['locality', true, 128],
      ['district', false, 128], ['street_name', true, 256], ['postal_code', false, 32],
    ],
    formats: null,
    address: [['street_name', 'Coastal Walk'], ['locality', 'South Haven']],
  },
];

function withHash(hashInput) {
  return {
    ...hashInput,
    artifact_sha256: calculateJurisdictionDomainArtifactSha256V1(hashInput),
  };
}

function addressArtifact(fixture, ordinal, overrides = {}) {
  const postalRequired = fixture.fields.find(([field]) => field === 'postal_code')?.[1] ?? false;
  const base = {
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_V1,
    artifact_version: 1,
    profile: {
      profile_id: id(100 + ordinal),
      profile_code: `${fixture.country.toLowerCase()}.synthetic.property.2026`,
      profile_version: 1,
      country_code: fixture.country,
      manifest_sha256: hash(`${fixture.country}:synthetic:manifest`),
    },
    domain: {
      domain_code: 'address.structure', domain_version: 'address-structure.v1',
      policy: {
        country_source: 'explicit_address_country',
        forbidden_country_inference_sources: [
          'currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone',
        ],
        ordered_fields: fixture.fields.map(([field_code, required, max_length]) =>
          ({ field_code, required, max_length })),
        postal_code: {
          value_type: 'country_text', required: postalRequired, globally_unique: false,
          normalization: fixture.normalization,
          validation: fixture.formats === null ? { kind: 'none' }
            : { kind: 'country_artifact_grammar', formats: fixture.formats },
        },
      },
    },
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: '2027-01-01T00:00:00.000Z',
    status: 'active',
    legal_review: approvedReview(`${fixture.country}:legal`),
    accounting_review: approvedReview(`${fixture.country}:accounting`),
    reusable_as_command_authority: false,
    ...overrides,
  };
  return withHash(base);
}

function request(artifact, fixture, overrides = {}) {
  return {
    contract_version: AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_REQUEST_V1,
    artifact,
    effective_at: effectiveAt,
    country_code: fixture.country,
    address_fields: fixture.address.map(([field_code, value]) => ({ field_code, value })),
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

const artifacts = fixtures.map((fixture, ordinal) => addressArtifact(fixture, ordinal));

check('five synthetic countries use five artifact-owned field structures', () => {
  const structures = new Set();
  fixtures.forEach((fixture, ordinal) => {
    const result = evaluateAirpropAddressStructurePresentationV1(
      request(artifacts[ordinal], fixture));
    assert.equal(result.decision, 'accepted');
    assert.equal(result.reusable_as_command_authority, false);
    assert.equal(result.display_parts[0].field_code, 'country_code');
    assert.equal(result.display_parts[0].value, fixture.country);
    structures.add(result.display_parts.map(part => part.field_code).join('|'));
  });
  assert.equal(structures.size, fixtures.length);
});

check('artifact order wins over caller field order and supplies postal normalization', () => {
  const result = evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0]));
  assert.deepEqual(result.display_parts, [
    { field_code: 'country_code', value: 'XA' },
    { field_code: 'postal_code', value: '10115' },
    { field_code: 'locality', value: 'Northport' },
    { field_code: 'street_name', value: 'Oak Street' },
    { field_code: 'street_number', value: '7' },
  ]);
  const xc = evaluateAirpropAddressStructurePresentationV1(request(artifacts[2], fixtures[2]));
  assert.equal(xc.display_parts[1].value, 'ABC-123');
});

check('the same postal text is accepted in two countries without uniqueness', () => {
  const xa = evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0]));
  const xb = evaluateAirpropAddressStructurePresentationV1(request(artifacts[1], fixtures[1]));
  assert.equal(xa.display_parts.find(part => part.field_code === 'postal_code').value, '10115');
  assert.equal(xb.display_parts.find(part => part.field_code === 'postal_code').value, '10115');
});

check('optional postal code is omitted without a default or inferred value', () => {
  const result = evaluateAirpropAddressStructurePresentationV1(request(artifacts[4], fixtures[4]));
  assert.equal(result.decision, 'accepted');
  assert.equal(result.display_parts.some(part => part.field_code === 'postal_code'), false);
});

check('LTR and RTL values are preserved without country or direction inference', () => {
  const ltr = evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0]));
  const rtl = evaluateAirpropAddressStructurePresentationV1(request(artifacts[3], fixtures[3]));
  assert.equal(ltr.display_parts.find(part => part.field_code === 'street_name').value,
    'Oak Street');
  assert.equal(rtl.display_parts.find(part => part.field_code === 'street_name').value,
    'خیابان نمونه');
  assert.equal(rtl.display_parts.find(part => part.field_code === 'unit').value, 'واحد ۴');
  assert.equal(rtl.display_parts[0].value, 'XD');
});

check('inference metadata and absent explicit country are malformed input', () => {
  for (const key of [
    'locale', 'language', 'currency', 'timezone', 'phone_number', 'ip_address',
    'browser_headers', 'workspace_default',
  ]) {
    const result = evaluateAirpropAddressStructurePresentationV1({
      ...request(artifacts[0], fixtures[0]), [key]: 'forbidden',
    });
    assert.equal(result.denial_reason, 'MALFORMED_INPUT', key);
  }
  const { country_code: _country, ...withoutCountry } = request(artifacts[0], fixtures[0]);
  assert.equal(evaluateAirpropAddressStructurePresentationV1(withoutCountry).denial_reason,
    'MALFORMED_INPUT');
});

check('inactive and not-effective artifacts fail closed', () => {
  const inactive = rehash(artifacts[0], { status: 'suspended' });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(
    request(inactive, fixtures[0])).denial_reason, 'ARTIFACT_INACTIVE');
  assert.equal(evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0], {
    effective_at: '2027-01-01T00:00:00.000Z',
  })).denial_reason, 'ARTIFACT_NOT_EFFECTIVE');
  const invalidPeriod = structuredClone(artifacts[0]);
  invalidPeriod.effective_to = '2025-12-31T00:00:00.000Z';
  assert.equal(evaluateAirpropAddressStructurePresentationV1(
    request(invalidPeriod, fixtures[0])).denial_reason, 'MALFORMED_ARTIFACT');
});

check('hash mismatch fails closed before presentation', () => {
  const changed = structuredClone(artifacts[0]);
  changed.domain.policy.ordered_fields[1].max_length = 17;
  const result = evaluateAirpropAddressStructurePresentationV1(request(changed, fixtures[0]));
  assert.equal(result.denial_reason, 'ARTIFACT_HASH_MISMATCH');
  assert.equal(result.display_parts, null);
});

check('country mismatch fails closed without consulting address values', () => {
  const result = evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0], {
    country_code: 'XB',
  }));
  assert.equal(result.denial_reason, 'COUNTRY_MISMATCH');
  assert.equal(result.display_parts, null);
});

check('unknown and duplicate fields are classified separately', () => {
  const baseFields = request(artifacts[0], fixtures[0]).address_fields;
  const unknown = evaluateAirpropAddressStructurePresentationV1(request(artifacts[0], fixtures[0], {
    address_fields: [...baseFields, { field_code: 'county_guess', value: 'not allowed' }],
  }));
  assert.equal(unknown.denial_reason, 'UNKNOWN_FIELD');
  const duplicate = evaluateAirpropAddressStructurePresentationV1(
    request(artifacts[0], fixtures[0], {
      address_fields: [...baseFields, { field_code: 'locality', value: 'Second city' }],
    }));
  assert.equal(duplicate.denial_reason, 'AMBIGUOUS_FIELD');
  const secondCountry = evaluateAirpropAddressStructurePresentationV1(
    request(artifacts[0], fixtures[0], {
      address_fields: [...baseFields, { field_code: 'country_code', value: 'XA' }],
    }));
  assert.equal(secondCountry.denial_reason, 'AMBIGUOUS_FIELD');
});

check('missing, empty and overlong field values fail closed', () => {
  const missing = request(artifacts[0], fixtures[0], {
    address_fields: request(artifacts[0], fixtures[0]).address_fields
      .filter(field => field.field_code !== 'locality'),
  });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(missing).denial_reason,
    'REQUIRED_FIELD_MISSING');
  const empty = request(artifacts[0], fixtures[0], {
    address_fields: request(artifacts[0], fixtures[0]).address_fields.map(field =>
      field.field_code === 'locality' ? { ...field, value: '   ' } : field),
  });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(empty).denial_reason,
    'FIELD_VALUE_INVALID');
  const overlong = request(artifacts[0], fixtures[0], {
    address_fields: request(artifacts[0], fixtures[0]).address_fields.map(field =>
      field.field_code === 'street_number' ? { ...field, value: 'x'.repeat(33) } : field),
  });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(overlong).denial_reason,
    'FIELD_VALUE_INVALID');
});

check('postal grammar is artifact-local and has no global fallback', () => {
  const invalidXa = request(artifacts[0], fixtures[0], {
    address_fields: request(artifacts[0], fixtures[0]).address_fields.map(field =>
      field.field_code === 'postal_code' ? { ...field, value: 'ABC-123' } : field),
  });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(invalidXa).denial_reason,
    'POSTAL_CODE_INVALID');
  const validXc = request(artifacts[2], fixtures[2]);
  assert.equal(evaluateAirpropAddressStructurePresentationV1(validXc).decision, 'accepted');
});

check('future or missing review fails closed', () => {
  const future = rehash(artifacts[0], {
    legal_review: { ...artifacts[0].legal_review, reviewed_at: '2026-12-01T00:00:00.000Z' },
  });
  assert.equal(evaluateAirpropAddressStructurePresentationV1(
    request(future, fixtures[0])).denial_reason, 'REVIEW_UNAVAILABLE');
});

check('output is deterministic, bounded and contains no authority or private identity', () => {
  const input = request(artifacts[3], fixtures[3]);
  const first = evaluateAirpropAddressStructurePresentationV1(input);
  const second = evaluateAirpropAddressStructurePresentationV1(input);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), [
    'contract_version', 'decision', 'denial_reason', 'display_parts',
    'evaluator_version', 'reusable_as_command_authority',
  ]);
  const output = JSON.stringify(first).toLowerCase();
  for (const forbidden of [
    'actor_id', 'context_id', 'workspace_id', 'property_id', 'building_id', 'unit_id',
    'profile_id', 'manifest_sha256', 'artifact_sha256', 'evidence_sha256', 'receipt',
    'permission', 'compliance', 'activation',
  ]) assert.equal(output.includes(forbidden), false, forbidden);
  assert.equal(first.reusable_as_command_authority, false);
});

check('implementation consumes the official schema and has no runtime or inference dependency', () => {
  const source = readFileSync(new URL(
    '../src/lib/airprop/address-structure-presentation-evaluator-v1.ts', import.meta.url),
  'utf8');
  assert.match(source, /coreJurisdictionDomainArtifactV1Schema\.safeParse/);
  assert.match(source, /calculateJurisdictionDomainArtifactSha256V1/);
  assert.doesNotMatch(source,
    /fetch\(|process\.env|new Pool|createClient|scope\.query|randomUUID|new Date\(|Date\.now\(|insert into|update\s+|delete from/i);
  assert.doesNotMatch(source, /postal.*(?:RegExp|\.regex\()/i);
});

check('Artifact B2 and Production composition remain inactive', () => {
  const b2 = readFileSync(new URL('../src/lib/airprop/artifact-b2-contract.ts', import.meta.url),
    'utf8');
  const route = readFileSync(new URL(
    '../src/app/api/customer/v2/airprop/artifact-b2/route.ts', import.meta.url), 'utf8');
  assert.match(b2, /commands: null, can_edit: false, state: 'pre_activation'/);
  assert.match(route, /runtime: null[\s\S]*portfolio: null/);
  assert.equal(route.includes('address-structure-presentation-evaluator-v1'), false);
});

console.log(JSON.stringify({
  package: 'AIRPROP-ADDRESS-STRUCTURE-PRESENTATION-EVALUATOR-09',
  checks,
  result: 'pure_inactive_presentation_evaluator',
  synthetic_countries: fixtures.length,
  postal_global_uniqueness: false,
  global_postal_regex: 'NONE',
  country_inference: 'DENIED',
  output: 'BOUNDED_DISPLAY_PARTS',
  authority: 'NONE',
  unit_linked_runtime: 'FAIL_CLOSED',
  production_activation: 'NOT_RUN_NOT_PASS',
}, null, 2));
