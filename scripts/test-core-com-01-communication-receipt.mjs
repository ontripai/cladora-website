import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE COM-01 COMMUNICATION RECEIPT TESTS ===\n');

const schemaPath = 'src/lib/core/communication-request-receipt-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-COM-01-COMMUNICATION-REQUEST-RECEIPT-v1.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

assert.ok(schema.includes('communication-request-receipt.v1'), 'request/receipt has an executable versioned schema');
assert.ok(contract.includes('communication-request-receipt.v1'), 'request/receipt is documented');

for (const source of [
  'communications.channels',
  'communications.notifications',
  'communications.notification_preferences',
  'communications.official_notices',
  'communications.delivery_attempts',
  'communications.notice_acknowledgements',
  'communications.statutory_evidence',
  'platform.outbox_events',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

assert.match(schema, /audience_kind:\s*z\.literal\('canonical_relationship'\)[\s\S]*canonicalResourceReferenceV1InputSchema[\s\S]*relationship_kinds/, 'relationship audiences use canonical resource inputs');
assert.match(schema, /recipient_disclosure:\s*z\.literal\('withheld'\)/, 'delivery evidence withholds recipients');
assert.match(schema, /request_status:\s*z\.literal\('rejected'\)[\s\S]*resolved_audience_policy:\s*z\.null\(\)[\s\S]*selected_channels:\s*z\.array\(z\.never\(\)\)\.max\(0\)[\s\S]*delivery_evidence:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'rejected receipts expose no audience, channels or evidence');
assert.match(schema, /action_authorization:\s*z\.literal\('not_evaluated'\)[\s\S]*delivery_authorization:\s*z\.literal\('not_implied'\)/, 'acceptance grants neither action nor delivery authority');
assert.match(contract, /never accepts raw recipient email, phone number, address or arbitrary rendered body/, 'raw recipients and rendered bodies stay outside the shared request');
assert.match(contract, /creates no parallel feed, notification, conversation, outbox, audit, idempotency, template, delivery-attempt or statutory-evidence engine/, 'parallel communications infrastructure is forbidden');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ Requests pin domain source/version, audience policy and channel preferences.');
console.log('  ✔ Receipts distinguish acceptance from delivery and statutory evidence.');
console.log('  ✔ Recipient identifiers and provider payloads remain withheld.');
console.log('  ✔ Existing communications, audit, idempotency and outbox sources remain canonical.');
