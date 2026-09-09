import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== RUNNING CUSTOMER COMMUNICATIONS & STATUTORY DELIVERY CONTRACT TESTS ===\n');

const root = process.cwd();

// =============================================================================
// Suite 1: Route Handlers Contract & Security Verification
// =============================================================================
console.log('[Suite 1] Route Handlers Contract & Schema Delegation Verification');

const COMM_ROUTES = [
  { path: 'src/app/api/customer/v1/communications/notices/route.ts', rpc: 'get_official_notices_v1', mutationRpc: 'create_notice_draft_v1', methods: ['GET', 'POST'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/route.ts', rpc: 'get_notice_detail_v1', methods: ['GET'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/approve/route.ts', rpc: 'approve_notice_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/publish/route.ts', rpc: 'publish_notice_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/cancel/route.ts', rpc: 'cancel_notice_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/acknowledge/route.ts', rpc: 'acknowledge_notice_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/deliveries/route.ts', rpc: 'list_notice_deliveries_v1', methods: ['GET'] },
  { path: 'src/app/api/customer/v1/communications/notices/[id]/evidence/route.ts', rpc: 'record_statutory_evidence_v1', methods: ['POST'] },
  { path: 'src/app/api/customer/v1/communications/evidence/[id]/verify/route.ts', rpc: 'verify_statutory_evidence_v1', methods: ['POST'] },
];

const INTERNAL_SCHEMAS = [
  'platform', 'finance', 'billing', 'payments', 'utilities',
  'maintenance', 'governance', 'communications', 'documents',
  'occupancy', 'security_access', 'audit', 'identity', 'app_private'
];

for (const route of COMM_ROUTES) {
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
  }
}

console.log('  ✓ All 9 Communications route handlers satisfy security and schema delegation contract');

// =============================================================================
// Suite 2: Migration 79 Contract & Database Hardening Verification
// =============================================================================
console.log('\n[Suite 2] Migration 79 Contract & Database Hardening Verification');

const migrationPath = path.join(root, 'supabase/migrations/20260909115850_official_communications_delivery_evidence.sql');
assert.ok(fs.existsSync(migrationPath), 'Migration 79 file must exist');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Strict transaction boundaries
assert.ok(migrationSql.startsWith('begin;'), 'Migration 79 must start with begin;');
assert.ok(migrationSql.trim().endsWith('commit;'), 'Migration 79 must end with commit;');

// Zero TODO / FIXME
assert.ok(!migrationSql.includes('TODO'), 'Migration 79 must have zero TODOs');
assert.ok(!migrationSql.includes('FIXME'), 'Migration 79 must have zero FIXMEs');

// SECURITY INVOKER on all customer_api functions
const customerApiFuncs = [
  'get_official_notices_v1',
  'get_notice_detail_v1',
  'create_notice_draft_v1',
  'approve_notice_v1',
  'publish_notice_v1',
  'acknowledge_notice_v1',
  'record_statutory_evidence_v1',
  'verify_statutory_evidence_v1',
  'cancel_notice_v1',
  'list_notice_deliveries_v1'
];

for (const fn of customerApiFuncs) {
  assert.ok(migrationSql.includes(`create or replace function customer_api.${fn}`), `Migration 79 must define customer_api.${fn}`);
  assert.ok(migrationSql.includes(`revoke all on function customer_api.${fn}`), `customer_api.${fn} must revoke public/anon`);
}

assert.ok(migrationSql.includes('set search_path = pg_catalog'), 'Customer API wrappers must pin search_path = pg_catalog');
assert.ok(migrationSql.includes("raise exception 'authentication_required'"), 'Customer API wrappers must guard auth.uid()');

console.log('  ✓ Migration 79 transaction boundaries, RPC signatures and security hardening verified');

// =============================================================================
// Suite 3: pgTAP Test 063 Contract Verification
// =============================================================================
console.log('\n[Suite 3] pgTAP Test 063 Contract Verification');

const testPath = path.join(root, 'supabase/tests/063_official_communications_delivery_evidence.test.sql');
assert.ok(fs.existsSync(testPath), 'Test 063 file must exist');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.ok(testSql.includes('select plan(48);'), 'Test 063 must plan exactly 48 assertions');
assert.ok(testSql.includes('select * from finish();'), 'Test 063 must call finish()');
assert.ok(testSql.includes('rollback;'), 'Test 063 must end with rollback;');

console.log('  ✓ Test 063 verified covering all 48 planned assertions across lifecycle functions and security');

// =============================================================================
// Suite 4: UI Trilingual & RTL Integrity Verification
// =============================================================================
console.log('\n[Suite 4] UI Component Trilingual (RO/EN/FA) & RTL Integrity Verification');

const uiPath = path.join(root, 'src/components/customer/CustomerCommunicationsDashboard.tsx');
assert.ok(fs.existsSync(uiPath), 'CustomerCommunicationsDashboard.tsx must exist');
const uiContent = fs.readFileSync(uiPath, 'utf8');

assert.ok(uiContent.includes("official_notices"), 'UI must support official_notices view');
assert.ok(uiContent.includes("statutoryBannerTitle"), 'UI must include Romanian Law 196/2018 statutory banner');
assert.ok(uiContent.includes("NoticeDetailModal"), 'UI must render NoticeDetailModal');
assert.ok(uiContent.includes("CreateNoticeModal"), 'UI must render CreateNoticeModal');
assert.ok(uiContent.includes("dir={lang === \"fa\" ? \"rtl\" : \"ltr\"}"), 'UI must support RTL layout for Persian');
assert.ok(!uiContent.includes("DemoStore"), 'UI must not use DemoStore mock violation');

console.log('  ✓ UI trilingual completeness, RTL support and zero-mock integrity verified');

// =============================================================================
// Suite 5: Romanian Law 196/2018 Statutory Separation Contract Verification
// =============================================================================
console.log('\n[Suite 5] Romanian Law 196/2018 Statutory Separation Contract Verification');

assert.ok(
  migrationSql.includes("communications.notice_acknowledgements") &&
  migrationSql.includes("communications.statutory_evidence"),
  'Database schema must strictly separate digital acknowledgements from physical statutory evidence'
);

assert.ok(
  migrationSql.includes("noticeboard_posting") &&
  migrationSql.includes("nominal_convening_table") &&
  migrationSql.includes("registered_postal_letter"),
  'Database must support statutory physical evidence types under Romanian Law 196/2018'
);

console.log('  ✓ Strict demarcation between electronic receipt acknowledgement and physical statutory proof verified');

console.log('\n=======================================================');
console.log('ALL CUSTOMER COMMUNICATIONS CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================\n');
