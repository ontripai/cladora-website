import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE OPS-01 EXECUTION RECEIPT TESTS ===\n');

const schemaPath = 'src/lib/core/operations-execution-receipt-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-OPS-01-EXECUTION-REQUEST-RECEIPT-v1.0.md';
const migrationPath = 'supabase/migrations/20261019194632_ops01_service_execution_request_v1.sql';
const routePath = 'src/app/api/customer/v1/services/requests/execution/route.ts';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');

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
assert.match(schema, /serviceOperationsExecutionRequestV1Schema/, 'first runtime consumer is narrowed in the executable contract');
assert.match(migration, /request_service_execution_v1/, 'OPS01 exposes one bounded SERVICE-to-Operations RPC');
assert.match(migration, /service_request_subject_context_v1/, 'OPS01 pins the existing SERVICE request/version');
assert.match(migration, /resolve_canonical_resource_reference_v1/, 'OPS01 consumes the DW02 canonical Unit resolver');
assert.match(migration, /check_workspace_native_permission_v2[\s\S]*maintenance\.work_orders\.manage/, 'OPS01 rechecks AUTH01 Operations authority');
assert.match(migration, /maintenance\.create_work_order/, 'OPS01 delegates execution creation to the existing Work Order engine');
assert.match(migration, /fin01_proposal_adapter_unavailable/, 'Finance references fail closed until FIN01 is connected');
assert.match(route, /serviceOperationsExecutionRequestV1Schema\.safeParse/, 'the bounded API validates the first-consumer request');
assert.match(route, /operationsExecutionRequestReceiptV1Schema\.safeParse/, 'the bounded API validates the database receipt');

console.log('  ✔ Requests pin source/resource versions and optional Finance proposals.');
console.log('  ✔ Accepted receipts reference the existing canonical Work Order lifecycle.');
console.log('  ✔ Rejected receipts expose no Work Order, status or Finance identifiers.');
console.log('  ✔ Domain state and Operations execution remain separate.');
console.log('  ✔ Existing SERVICE requests are the first real consumer; AUTH01 and DW02 are rechecked.');

await import('./test-ops-01-service-execution-route.mjs');
await import('./test-core-bk-01-shared-capacity.mjs');
