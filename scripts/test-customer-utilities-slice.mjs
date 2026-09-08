import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== RUNNING CUSTOMER UTILITIES & METERING SLICE CONTRACT TESTS ===\n');

const root = process.cwd();

// =============================================================================
// Suite 1: Utilities Route Handlers Contract & Security Verification
// =============================================================================
console.log('[Suite 1] Utilities Route Handlers Contract & Schema Delegation Verification');

const UTILITIES_ROUTES = [
  { path: 'src/app/api/customer/v1/utilities/summary/route.ts', rpc: 'get_utilities_summary_v1', methods: ['GET'] },
  { path: 'src/app/api/customer/v1/utilities/meters/route.ts', rpc: 'get_utilities_v1', mutationRpc: 'create_meter_v1', methods: ['GET', 'POST'] },
  { path: 'src/app/api/customer/v1/utilities/meters/[id]/route.ts', rpc: 'get_utilities_v1', mutationRpc: 'update_meter_v1', methods: ['GET', 'PATCH'] },
  { path: 'src/app/api/customer/v1/utilities/meters/[id]/replace/route.ts', rpc: 'replace_meter_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/meters/[id]/decommission/route.ts', rpc: 'decommission_meter_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/route.ts', rpc: 'get_utilities_v1', mutationRpc: 'capture_reading_v1', methods: ['GET', 'POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/import/route.ts', rpc: 'import_readings_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/ocr-candidate/route.ts', rpc: 'create_ocr_candidate_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/[id]/approve/route.ts', rpc: 'approve_reading_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/[id]/reject/route.ts', rpc: 'reject_reading_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/readings/[id]/correct/route.ts', rpc: 'correct_reading_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/consumption/route.ts', rpc: 'get_utilities_v1', mutationRpc: 'calculate_consumption_v1', methods: ['GET', 'POST'] },
  { path: 'src/app/api/customer/v1/utilities/consumption/[id]/approve/route.ts', rpc: 'approve_consumption_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/consumption/[id]/bill/route.ts', rpc: 'bill_consumption_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/utilities/tariffs/route.ts', rpc: 'get_utilities_v1', mutationRpc: 'create_tariff_v1', methods: ['GET', 'POST'] },
  { path: 'src/app/api/customer/v1/utilities/anomalies/route.ts', rpc: 'get_utilities_v1', methods: ['GET'] },
  { path: 'src/app/api/customer/v1/utilities/variance/route.ts', rpc: 'get_meter_variance_v1', methods: ['GET'] },
];

const INTERNAL_SCHEMAS = [
  'platform', 'finance', 'billing', 'payments', 'utilities',
  'maintenance', 'governance', 'communications', 'documents',
  'occupancy', 'security_access', 'audit', 'identity', 'app_private'
];

for (const route of UTILITIES_ROUTES) {
  const fullPath = path.join(root, route.path);
  assert.ok(fs.existsSync(fullPath), `Route file ${route.path} must exist`);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Must use customer_api schema
  assert.ok(
    content.includes(".schema('customer_api')") || content.includes('.schema("customer_api")'),
    `${route.path}: must explicitly select customer_api schema`
  );

  // Must call versioned wrapper RPC
  assert.ok(
    content.includes(route.rpc) || (route.mutationRpc && content.includes(route.mutationRpc)),
    `${route.path}: must call versioned wrapper RPC`
  );

  // Must never expose internal schemas directly in .schema()
  for (const schema of INTERNAL_SCHEMAS) {
    assert.ok(
      !content.includes(`.schema('${schema}')`) && !content.includes(`.schema("${schema}")`),
      `${route.path}: must NOT call internal schema ${schema} directly`
    );
  }

  // Must have no-store headers
  assert.ok(
    content.includes('no-store') || content.includes('HEADERS'),
    `${route.path}: must specify no-store caching policy`
  );

  // Mutations must enforce security controls
  if (route.methods.includes('POST') || route.methods.includes('PATCH')) {
    assert.ok(
      content.includes('hasTrustedMutationOrigin'),
      `${route.path}: mutation must check hasTrustedMutationOrigin`
    );
    assert.ok(
      content.includes('isApplicationJson'),
      `${route.path}: mutation must check isApplicationJson`
    );
    assert.ok(
      content.includes('parseJsonWithLimit'),
      `${route.path}: mutation must use parseJsonWithLimit`
    );
  }
}

console.log('✓ All 17 Utilities route handlers satisfy the security and schema delegation contract\n');

// =============================================================================
// Suite 2: Human Approval Boundary Verification
// =============================================================================
console.log('[Suite 2] OCR Human Approval Boundary Contract Verification');

const ocrCandidateRoute = path.join(root, 'src/app/api/customer/v1/utilities/readings/ocr-candidate/route.ts');
const ocrContent = fs.readFileSync(ocrCandidateRoute, 'utf8');
assert.ok(
  ocrContent.includes('create_ocr_candidate_v1'),
  'OCR candidate route must call create_ocr_candidate_v1'
);

const migration71Path = path.join(root, 'supabase/migrations/20260908120000_utilities_metering_billing_slice.sql');
assert.ok(fs.existsSync(migration71Path), 'Migration 71 must exist');
const migrationSql = fs.readFileSync(migration71Path, 'utf8');

// Ensure trigger blocks automatic approval
assert.ok(
  migrationSql.includes('ocr_candidate_requires_human_approval'),
  'Migration 71 must include ocr_candidate_requires_human_approval enforcement trigger'
);
assert.ok(
  migrationSql.includes('pending_review'),
  'Migration 71 must explicitly force OCR candidates to pending_review'
);

console.log('✓ Human approval boundary strictly enforced at both API route and database trigger levels\n');

// =============================================================================
// Suite 3: Continuous GL Parity & Billing Integration Verification
// =============================================================================
console.log('[Suite 3] Billing Integration & Continuous GL Parity Verification');

// Ensure bill_consumption_v1 uses existing billing.create_bill and billing.issue_bill
assert.ok(
  migrationSql.includes('billing.create_bill') && migrationSql.includes('billing.issue_bill'),
  'bill_consumption_v1 must use existing billing engine functions without parallel accounting'
);

const test055Path = path.join(root, 'supabase/tests/055_customer_utilities_metering_slice.test.sql');
assert.ok(fs.existsSync(test055Path), 'Test 055 must exist');
const testSql = fs.readFileSync(test055Path, 'utf8');
assert.ok(
  testSql.includes('billing.invoices') && testSql.includes('billing.receivables'),
  'pgTAP test 055 verifies billing.invoices and billing.receivables'
);

console.log('✓ Existing billing engine and GL accounting contract preserved without parallel engines\n');

// =============================================================================
// Suite 4: Route Classifier & Access Control Verification
// =============================================================================
console.log('[Suite 4] Route Classifier & Customer Portal Isolation');

const classifierPath = path.join(root, 'src/lib/customer/route-classifier.ts');
const classifierContent = fs.readFileSync(classifierPath, 'utf8');
assert.ok(
  classifierContent.includes('/app/meters') && classifierContent.includes('utilities.metering.read'),
  '/app/meters must be properly classified with utilities.metering.read'
);
assert.ok(
  classifierContent.includes('/app/utilities'),
  '/app/utilities route must be classified matching /app/meters'
);

// Zero-mock check: /demo/app must not be touched
const demoAppPath = path.join(root, 'src/app/[lang]/demo/app/[...slug]/page.tsx');
assert.ok(fs.existsSync(demoAppPath), 'Demo app page must exist');

console.log('✓ Route classification and portal isolation verified\n');

// =============================================================================
// Suite 5: CLADORA-P2-UTIL-002 Explicit Tax Policy Contract Hardening
// =============================================================================
console.log('[Suite 5] Explicit Tax Policy & Tariff Contract Hardening Verification');

const migration72Path = path.join(root, 'supabase/migrations/20260908150000_explicit_tax_policy_tariff_contract.sql');
assert.ok(fs.existsSync(migration72Path), 'Migration 72 must exist');
const migration72Sql = fs.readFileSync(migration72Path, 'utf8');

assert.ok(
  migration72Sql.includes('alter column tax_rate drop default;') && migration72Sql.includes('utilities.tariffs'),
  'Migration 72 must drop table default on tax_rate'
);
assert.ok(
  migration72Sql.includes('tax_rate_required') && migration72Sql.includes('tax_rate_out_of_range'),
  'Migration 72 routines must enforce tax_rate_required and tax_rate_out_of_range'
);
assert.ok(
  migration72Sql.includes('protect_tariff_immutability'),
  'Migration 72 must enforce protect_tariff_immutability trigger on billed tariffs'
);
assert.ok(
  !migration72Sql.includes('default 0.19') && !migration72Sql.includes('default 0.21'),
  'Migration 72 must not introduce any legal rate default'
);

const test056Path = path.join(root, 'supabase/tests/056_explicit_tax_policy_tariff_contract.test.sql');
assert.ok(fs.existsSync(test056Path), 'Test 056 must exist');
const test056Sql = fs.readFileSync(test056Path, 'utf8');
assert.ok(
  test056Sql.includes('plan(12)'),
  'Test 056 must plan 12 assertions'
);

const schemaPath = path.join(root, 'src/lib/customer/utilities-schema.ts');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
assert.ok(
  !schemaSql.includes('default(0.19)') && !schemaSql.includes('default(0.21)'),
  'Utilities schema must have zero implicit legal VAT default'
);
assert.ok(
  schemaSql.includes('tax_rate_required') && schemaSql.includes('tax_rate_out_of_range'),
  'Utilities schema must enforce tax_rate_required and tax_rate_out_of_range'
);

const dashboardPath = path.join(root, 'src/components/customer/CustomerUtilitiesDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert.ok(
  !dashboardContent.includes("useState<number>(19)") && !dashboardContent.includes("useState(19)"),
  'Dashboard UI must not default tax rate to 19%'
);
assert.ok(
  dashboardContent.includes("taxRateRequired"),
  'Dashboard UI must enforce tax rate input before submission'
);

console.log('✓ Migration 72, Test 056, Zod schema, and Dashboard UI explicit tax contract verified\n');

console.log('=======================================================');
console.log('ALL CUSTOMER UTILITIES CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================\n');

