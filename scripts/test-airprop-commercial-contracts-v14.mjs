import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = require;
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return compiled.exports;
}

const {
  commercialLifecycleCommandV1Schema,
  airpropListingControlCommandV1Schema,
  airpropReservationControlCommandV1Schema,
  airpropManagementMandateCommandV1Schema,
  airpropManagementActionLinkCommandV1Schema,
  airpropManagementPortfolioReadV1Schema,
} = load('src/lib/airprop/commercial-lifecycle-v1.ts');
const id = value => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const base = { version: 1, context_id: id(1), workspace_id: id(2), idempotency_key: 'commercial-contract-v14' };
const edit = { ...base, action: 'edit_listing', listing_id: id(3), expected_version: 1, available_from: '2026-10-12T00:00:00Z', available_until: null, reason: 'Correct availability.' };

for (const command of [
  edit,
  { ...base, action: 'withdraw_listing', listing_id: id(3), expected_version: 2, reason: 'Pause marketing.' },
  { ...base, action: 'republish_listing', listing_id: id(3), expected_version: 3, available_from: '2026-10-13T00:00:00Z', available_until: null, reason: 'Resume marketing.' },
]) assert.equal(airpropListingControlCommandV1Schema.safeParse(command).success, true);

for (const command of [
  { ...edit, workspace_id: undefined },
  { ...edit, expected_version: 0 },
  { ...edit, actor_id: id(9) },
  { ...edit, available_until: '2026-10-11T00:00:00Z' },
]) assert.equal(airpropListingControlCommandV1Schema.safeParse(command).success, false);

const reservation = { ...base, idempotency_key: 'reservation-contract-v14', reservation_id: id(4), expected_version: 1, reason: 'Customer request.' };
for (const command of [
  { ...reservation, action: 'cancel_reservation' },
  { ...reservation, action: 'expire_reservation' },
  { ...reservation, action: 'extend_reservation', reserved_until: '2026-10-14T00:00:00Z' },
  { ...reservation, action: 'convert_reservation', conversion_reference: 'urn:airprop:conversion:1' },
]) assert.equal(airpropReservationControlCommandV1Schema.safeParse(command).success, true);
for (const command of [
  { ...reservation, action: 'extend_reservation', reserved_until: 'tomorrow' },
  { ...reservation, action: 'convert_reservation', conversion_reference: 'short' },
  { ...reservation, action: 'cancel_reservation', expected_version: 0 },
  { ...reservation, action: 'expire_reservation', actor_id: id(9) },
]) assert.equal(airpropReservationControlCommandV1Schema.safeParse(command).success, false);

const resale = { ...base, idempotency_key: 'resale-contract-v14', action: 'link_execution', property_id: id(5), unit_id: id(6), kind: 'resale', core_record_id: id(7), commercial_terms: { price: '100.0000', currency: 'EUR' }, effective_from: '2026-10-12', effective_to: null };
assert.equal(commercialLifecycleCommandV1Schema.safeParse(resale).success, true);
for (const command of [
  { ...resale, commercial_terms: { price: '100.0000' } },
  { ...resale, commercial_terms: { price: '-1', currency: 'EUR' } },
  { ...resale, effective_to: '2026-10-13' },
]) assert.equal(commercialLifecycleCommandV1Schema.safeParse(command).success, false);

const lease = { ...base, idempotency_key: 'lease-contract-v14', action: 'link_execution', property_id: id(5), unit_id: id(6), kind: 'lease', core_record_id: id(8), commercial_terms: { rent_amount: 1500, currency: 'EUR' }, effective_from: '2026-10-12', effective_to: null };
assert.equal(commercialLifecycleCommandV1Schema.safeParse(lease).success, true);
for (const command of [
  { ...lease, commercial_terms: { rent_amount: 0, currency: 'EUR' } },
  { ...lease, commercial_terms: { rent_amount: 1500, currency: 'euro' } },
]) assert.equal(commercialLifecycleCommandV1Schema.safeParse(command).success, false);

const mandate = { ...base, idempotency_key: 'mandate-contract-v14', action: 'request_management_mandate', property_id: id(5), owner_party_id: id(9), scope: { capabilities: ['listing', 'owner_reporting'] }, valid_from: '2026-10-12', valid_to: '2027-10-12', proposal_evidence_reference: 'urn:airprop:mandate:proposal:1' };
assert.equal(airpropManagementMandateCommandV1Schema.safeParse(mandate).success, true);
assert.equal(airpropManagementMandateCommandV1Schema.safeParse({ ...base, idempotency_key: 'mandate-accept-v14', action: 'accept_management_mandate', mandate_request_id: id(10), acceptance_evidence_reference: 'urn:airprop:mandate:acceptance:1' }).success, true);
for (const command of [
  { ...mandate, valid_to: '2026-10-11' },
  { ...mandate, scope: { capabilities: ['listing', 'listing'] } },
  { ...mandate, authority_id: id(11) },
]) assert.equal(airpropManagementMandateCommandV1Schema.safeParse(command).success, false);

const actionLink = { ...base, idempotency_key: 'action-link-contract-v14', action: 'link_management_work_order', mandate_request_id: id(10), work_order_id: id(11) };
assert.equal(airpropManagementActionLinkCommandV1Schema.safeParse(actionLink).success, true);
assert.equal(airpropManagementActionLinkCommandV1Schema.safeParse({ ...actionLink, workspace_id: id(12), actor_id: id(13) }).success, false);

const portfolioRead = { ...base, idempotency_key: 'portfolio-read-contract-v14', action: 'read_management_portfolio' };
assert.equal(airpropManagementPortfolioReadV1Schema.safeParse(portfolioRead).success, true);
assert.equal(airpropManagementPortfolioReadV1Schema.safeParse({ ...portfolioRead, authority: true }).success, false);

console.log('AIRPROP commercial contract bundle: 31 checks passed');
