import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  bindCorePropertyJurisdictionEvidenceV1,
  coreJurisdictionProfileV1Schema,
  corePropertyJurisdictionEvidenceV1Schema,
} from '../src/lib/core/jurisdiction-profile-v1.ts';

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = value => createHash('sha256').update(value).digest('hex');

const countryFixtures = {
  RO: { currency: 'RON', timezone: 'Europe/Bucharest', calendar: 'gregorian' },
  IR: { currency: 'IRR', timezone: 'Asia/Tehran', calendar: 'solar_hijri' },
  DE: { currency: 'EUR', timezone: 'Europe/Berlin', calendar: 'gregorian' },
  US: { currency: 'USD', timezone: 'America/New_York', calendar: 'gregorian' },
  JP: { currency: 'JPY', timezone: 'Asia/Tokyo', calendar: 'gregorian' },
};

function evidence({ country, property, profile, ordinal }) {
  const fixture = countryFixtures[country];
  assert.ok(fixture, `fixture must exist for ${country}`);
  return {
    contract_version: 'core-property-jurisdiction-evidence.v1',
    assignment_id: id(10 + ordinal),
    assignment_version: 1,
    tenant_id: id(1),
    workspace_id: id(2),
    property_id: property,
    profile: {
      contract_version: 'core-jurisdiction-profile.v1',
      profile_id: profile,
      profile_code: `${country.toLowerCase()}_property_management`,
      profile_version: 1,
      country_code: country,
      default_currency_code: fixture.currency,
      default_timezone: fixture.timezone,
      calendar_code: fixture.calendar,
      manifest_sha256: hash(country),
      status: 'active',
      valid_from: '2026-01-01',
      valid_to: null,
      legal_signoff_present: true,
      accounting_signoff_present: true,
      domains: [{
        domain_code: 'finance.statutory',
        contract_version: 'finance-statutory.v1',
        artifact_sha256: hash(`${country}:finance`),
        required: true,
        status: 'active',
      }, {
        domain_code: 'payments.local_rails',
        contract_version: 'payments-local-rails.v1',
        artifact_sha256: hash(`${country}:payments`),
        required: true,
        status: 'active',
      }],
    },
    evaluated_at: '2026-10-15T18:30:00.000Z',
    source_disclosure: 'status_only',
    reusable_as_command_authority: false,
  };
}

let cases = 0;
const countries = ['RO', 'IR', 'DE', 'US', 'JP'];
const evidenceByCountry = countries.map((country, index) => evidence({
  country,
  property: id(20 + index),
  profile: id(30 + index),
  ordinal: index,
}));
const [ro, ir] = evidenceByCountry;
for (const value of evidenceByCountry) {
  corePropertyJurisdictionEvidenceV1Schema.parse(value);
  const bound = bindCorePropertyJurisdictionEvidenceV1({
    expected_workspace_id: id(2),
    expected_property_id: value.property_id,
    expected_country_code: value.profile.country_code,
    evidence: value,
  });
  assert.equal(bound.workspace_id, id(2));
  cases++;
}
assert.notEqual(ro.profile.country_code, ir.profile.country_code,
  'one Workspace can bind properties in different countries');
assert.equal(new Set(evidenceByCountry.map(value => value.profile.country_code)).size, countries.length,
  'the contract has no two-country ceiling');
assert.ok(evidenceByCountry.every(value => value.profile.domains.some(
  domain => domain.domain_code === 'payments.local_rails' && domain.status === 'active',
)), 'each example country independently pins its payment rules');
cases += 3;

assert.throws(() => bindCorePropertyJurisdictionEvidenceV1({
  expected_workspace_id: id(2), expected_property_id: ir.property_id, evidence: ro,
}), /jurisdiction_profile_binding_mismatch/);
assert.throws(() => bindCorePropertyJurisdictionEvidenceV1({
  expected_workspace_id: id(2), expected_property_id: ro.property_id,
  expected_country_code: 'IR', evidence: ro,
}), /jurisdiction_profile_country_mismatch/);
assert.throws(() => bindCorePropertyJurisdictionEvidenceV1({
  expected_workspace_id: id(2), expected_property_id: ro.property_id,
  evidence: { ...ro, profile: { ...ro.profile, status: 'suspended' } },
}), /jurisdiction_profile_inactive/);
assert.throws(() => bindCorePropertyJurisdictionEvidenceV1({
  expected_workspace_id: id(2), expected_property_id: ro.property_id,
  evidence: { ...ro, profile: { ...ro.profile, legal_signoff_present: false } },
}), /jurisdiction_profile_signoff_missing/);
assert.throws(() => bindCorePropertyJurisdictionEvidenceV1({
  expected_workspace_id: id(2), expected_property_id: ro.property_id,
  evidence: { ...ro, profile: { ...ro.profile, domains: [{
    ...ro.profile.domains[0], status: 'validated',
  }] } },
}), /jurisdiction_profile_domain_unavailable/);
cases += 5;

assert.throws(() => coreJurisdictionProfileV1Schema.parse({ ...ro.profile, locale: 'ro' }));
assert.throws(() => coreJurisdictionProfileV1Schema.parse({ ...ro.profile, country_code: 'ro' }));
cases += 2;

console.log(JSON.stringify({
  contract: 'core-jurisdiction-profile.v1',
  cases,
  properties_per_workspace: 'unbounded-country-catalog-supported',
  address_country: 'explicit-required',
  postal_code: 'country-specific-non-unique-text',
  payments: 'country-versioned-runtime-separate',
  activation: 'inactive',
}));
