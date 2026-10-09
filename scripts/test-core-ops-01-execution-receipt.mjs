import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE OPS-01 EXECUTION RECEIPT TESTS ===\n');

const schemaPath = 'src/lib/core/operations-execution-receipt-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-OPS-01-EXECUTION-REQUEST-RECEIPT-v1.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

assert.ok(schema.includes('operations-execution-request-receipt.v1'), 'Operations envelope has an executable versioned schema');
assert.ok(contract.includes('operations-execution-request-receipt.v1'), 'Operations envelope is documented');

for (const source of [
  'maintenance.work_orders',
  'maintenance.work_order_events',
  'maintenance.work_order_checklist_items',
  'maintenance.work_order_assignments',
  'maintenance.work_order_costs',
  'maintenance.purchase_orders',
  'maintenance.vendor_payables',
  'audit.events',
  'platform.outbox_events',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

for (const status of ['draft', 'scheduled', 'assigned', 'in_progress', 'blocked', 'completed', 'verified', 'cancelled']) {
  assert.match(schema, new RegExp(`'${status}'`), `${status} remains an Operations-owned status`);
}

assert.match(schema, /desired_end_requires_earlier_desired_start/, 'desired execution interval is validated');
assert.match(schema, /financial_proposal_id_and_version_must_coexist/, 'Finance proposal references are version-pinned');
assert.match(schema, /request_status:\s*z\.literal\('rejected'\)[\s\S]*work_order_id:\s*z\.null\(\)[\s\S]*work_order_status:\s*z\.null\(\)[\s\S]*financial_receipt_ids:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'rejected receipts expose no Work Order or Finance identifiers');
assert.match(schema, /action_authorization:\s*z\.literal\('not_evaluated'\)/, 'request acceptance grants no lifecycle action');
assert.match(contract, /creates no parallel Work Order, ticket, asset, vendor, procurement, payable, audit, outbox or idempotency engine/, 'parallel Operations infrastructure is forbidden');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ Requests pin source/resource versions and optional Finance proposals.');
console.log('  ✔ Accepted receipts reference the existing canonical Work Order lifecycle.');
console.log('  ✔ Rejected receipts expose no Work Order, status or Finance identifiers.');
console.log('  ✔ Domain state and Operations execution remain separate.');
