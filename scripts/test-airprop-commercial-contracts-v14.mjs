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
  airpropListingControlCommandV1Schema,
  airpropReservationControlCommandV1Schema,
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

console.log('AIRPROP commercial contract bundle: 15 checks passed');
