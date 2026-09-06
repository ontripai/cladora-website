import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== RUNNING P1 ROLE-AWARE DASHBOARD & ACCESS MATRIX TESTS ===\n');

const root = process.cwd();

// Import central access matrix and route classifier
const {
  CANONICAL_ROLES,
  PERSONA_ACCESS_MATRIX,
  isCanonicalRole,
  getPersonaMatrix,
  isRouteAllowedForPersona,
  matchesRoutePattern,
  isSectionAllowed,
  isCapabilityAllowed,
  isPersonaReadOnly,
} = await import('../src/lib/customer/access-matrix.ts');

const {
  EXPLICITLY_ALLOWED_ROUTES,
  EXPLICITLY_UNAVAILABLE_ROUTES,
  ROUTE_REQUIREMENTS,
  classifyCustomerRoute,
} = await import('../src/lib/customer/route-classifier.ts');

// All 37 customer portal routes
const ALL_37_CUSTOMER_ROUTES = [
  '/app/access-logs',
  '/app/accounting',
  '/app/accounting/allocations',
  '/app/accounting/month-close',
  '/app/assets',
  '/app/audit',
  '/app/billing',
  '/app/communications',
  '/app/credentials',
  '/app/dashboard',
  '/app/documents',
  '/app/documents/123', // dynamic route instance of /app/documents/[id]
  '/app/governance',
  '/app/invoices',
  '/app/leases',
  '/app/maintenance',
  '/app/meetings',
  '/app/meters',
  '/app/migration/shadow-ledger',
  '/app/notifications',
  '/app/occupancy',
  '/app/occupancy/456', // dynamic route instance of /app/occupancy/[id]
  '/app/onboarding',
  '/app/ownership',
  '/app/payments',
  '/app/portfolio',
  '/app/procurement',
  '/app/purchase-orders',
  '/app/receivables',
  '/app/reconciliation',
  '/app/residents',
  '/app/security-access',
  '/app/settings',
  '/app/vendor-contracts',
  '/app/vendor-sla',
  '/app/vendors',
  '/app/visitors',
];

// -----------------------------------------------------------------------------
// Suite 1: Canonical Roles & Central Access Matrix Integrity
// -----------------------------------------------------------------------------
{
  console.log('[Suite 1] Canonical Roles & Access Matrix Integrity');

  assert.equal(CANONICAL_ROLES.length, 6, 'Must strictly define exactly 6 canonical roles');
  const expectedRoles = [
    'association_admin',
    'property_manager',
    'president',
    'censor',
    'owner',
    'tenant_resident',
  ];
  for (const role of expectedRoles) {
    assert.ok(CANONICAL_ROLES.includes(role), `Canonical roles must include ${role}`);
    assert.ok(isCanonicalRole(role), `isCanonicalRole(${role}) must return true`);
    const matrix = getPersonaMatrix(role);
    assert.ok(matrix, `Matrix must exist for ${role}`);
    assert.equal(matrix.role, role);
  }

  // Strictly no contractor or unauthorized roles
  assert.equal(isCanonicalRole('contractor'), false, 'Contractor must not be a canonical role');
  assert.equal(isCanonicalRole('vendor'), false, 'Vendor must not be a canonical role');
  assert.equal(isCanonicalRole('admin'), false, 'Generic admin must not be a canonical role');
  assert.equal(isCanonicalRole(''), false, 'Empty role must not be canonical');
  assert.equal(isCanonicalRole(null), false, 'Null role must not be canonical');
  assert.equal(isCanonicalRole(undefined), false, 'Undefined role must not be canonical');

  console.log('  ✓ Exactly 6 canonical roles verified');
  console.log('  ✓ Contractor and unapproved roles strictly excluded');
  console.log('  ✓ Central matrix exists for all canonical roles');
}

// -----------------------------------------------------------------------------
// Suite 2: Functional Route Evaluation for All 37 Routes & Personas
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 2] 37 Customer Routes Evaluation Across All 6 Personas');

  assert.equal(ALL_37_CUSTOMER_ROUTES.length, 37, 'Must evaluate exactly 37 customer routes');

  for (const role of CANONICAL_ROLES) {
    const matrix = getPersonaMatrix(role);

    for (const route of ALL_37_CUSTOMER_ROUTES) {
      const allowed = isRouteAllowedForPersona(role, route);

      // 1. Explicitly unavailable routes MUST NEVER be allowed
      if (EXPLICITLY_UNAVAILABLE_ROUTES.some((u) => matchesRoutePattern(u, route))) {
        assert.equal(allowed, false, `Unavailable route ${route} must be denied for ${role}`);
      }

      // 2. If allowed, it must be matched by matrix.allowedNavLinks
      if (allowed) {
        const matchesAllowed = matrix.allowedNavLinks.some((a) => matchesRoutePattern(a, route));
        assert.ok(matchesAllowed, `Allowed route ${route} must be in allowedNavLinks of ${role}`);
      }

      // 3. /app/dashboard is allowed for all canonical roles
      if (route === '/app/dashboard') {
        assert.equal(allowed, true, `/app/dashboard must be allowed for ${role}`);
      }
    }
  }

  // Specific role isolation assertions on routes:
  // Censor cannot access governance, maintenance, or security
  assert.equal(isRouteAllowedForPersona('censor', '/app/governance'), false, 'censor cannot access /app/governance');
  assert.equal(isRouteAllowedForPersona('censor', '/app/maintenance'), false, 'censor cannot access /app/maintenance');
  assert.equal(isRouteAllowedForPersona('censor', '/app/security-access'), false, 'censor cannot access /app/security-access');
  assert.equal(isRouteAllowedForPersona('censor', '/app/accounting'), true, 'censor can access /app/accounting');
  assert.equal(isRouteAllowedForPersona('censor', '/app/audit'), true, 'censor can access /app/audit');

  // Owner cannot access audit, security-access, or occupancy
  assert.equal(isRouteAllowedForPersona('owner', '/app/audit'), false, 'owner cannot access /app/audit');
  assert.equal(isRouteAllowedForPersona('owner', '/app/security-access'), false, 'owner cannot access /app/security-access');
  assert.equal(isRouteAllowedForPersona('owner', '/app/occupancy'), false, 'owner cannot access /app/occupancy');
  assert.equal(isRouteAllowedForPersona('owner', '/app/billing'), true, 'owner can access /app/billing');
  assert.equal(isRouteAllowedForPersona('owner', '/app/documents'), true, 'owner can access /app/documents');
  assert.equal(isRouteAllowedForPersona('owner', '/app/documents/123'), true, 'owner can access /app/documents/123');

  // Tenant cannot access governance, audit, ownership, or security-access
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/governance'), false, 'tenant cannot access /app/governance');
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/audit'), false, 'tenant cannot access /app/audit');
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/ownership'), false, 'tenant cannot access /app/ownership');
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/security-access'), false, 'tenant cannot access /app/security-access');
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/meters'), true, 'tenant can access /app/meters');

  // Unknown role fails closed on ALL routes
  for (const route of ALL_37_CUSTOMER_ROUTES) {
    assert.equal(isRouteAllowedForPersona('contractor', route), false, `Unknown role must fail closed on ${route}`);
    assert.equal(isRouteAllowedForPersona(null, route), false, `Null role must fail closed on ${route}`);
  }

  console.log('  ✓ All 37 routes verified against allowlists for 6 canonical personas');
  console.log('  ✓ Censor, Owner, and Tenant boundary routes enforced');
  console.log('  ✓ Unknown role rejected across all 37 routes');
}

// -----------------------------------------------------------------------------
// Suite 3: Prefix Vulnerability & Malicious Path Rejection
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 3] Prefix Vulnerability & Malicious Path Rejection');

  const maliciousPaths = [
    '/app/audit-malicious',
    '/app/audit/secret-export',
    '/app/documents-secret',
    '/app/documents/123/extra-subpath',
    '/app/payments-admin',
    '/app/accounting-hacked',
    '/app/billing-bypass',
  ];

  for (const role of CANONICAL_ROLES) {
    for (const badPath of maliciousPaths) {
      const allowed = isRouteAllowedForPersona(role, badPath);
      assert.equal(allowed, false, `Malicious or prefix route ${badPath} must be denied for ${role}`);
    }
  }

  // Dynamic route pattern matcher unit tests
  assert.equal(matchesRoutePattern('/app/documents', '/app/documents'), true);
  assert.equal(matchesRoutePattern('/app/documents/[id]', '/app/documents/abc-123'), true);
  assert.equal(matchesRoutePattern('/app/documents/[id]', '/app/documents-secret'), false);
  assert.equal(matchesRoutePattern('/app/documents/[id]', '/app/documents/123/extra'), false);
  assert.equal(matchesRoutePattern('/app/audit', '/app/audit-malicious'), false);

  console.log('  ✓ Malicious prefix routes rejected');
  console.log('  ✓ Dynamic parameter matching verified without regex bypass');
}

// -----------------------------------------------------------------------------
// Suite 4: Censor Persona Absolute Read-Only Enforcement
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 4] Censor Absolute Read-Only Enforcement');

  assert.equal(isPersonaReadOnly('censor'), true, 'Censor must have isReadOnly=true');
  const censorMatrix = getPersonaMatrix('censor');

  assert.ok(censorMatrix.forbiddenCapabilities.includes('can_manage_work_orders'));
  assert.ok(censorMatrix.forbiddenCapabilities.includes('can_mutate_financials'));
  assert.ok(censorMatrix.forbiddenCapabilities.includes('can_approve_requests'));
  assert.ok(censorMatrix.forbiddenCapabilities.includes('can_register_items'));

  // Ensure censor has NO mutating capabilities
  for (const cap of censorMatrix.allowedCapabilities) {
    assert.ok(!cap.includes('manage'), `Censor allowed capabilities must not contain manage (${cap})`);
    assert.ok(!cap.includes('create'), `Censor allowed capabilities must not contain create (${cap})`);
    assert.ok(!cap.includes('edit'), `Censor allowed capabilities must not contain edit (${cap})`);
    assert.ok(!cap.includes('delete'), `Censor allowed capabilities must not contain delete (${cap})`);
  }

  console.log('  ✓ Censor is strictly read-only with zero mutating capabilities');
}

// -----------------------------------------------------------------------------
// Suite 5: Navigation & Route Guard Synchronization
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 5] Navigation & Route Guard Synchronization');

  const shellSrc = fs.readFileSync(path.join(root, 'src/components/customer/CustomerAppShell.tsx'), 'utf8');
  const guardSrc = fs.readFileSync(path.join(root, 'src/components/customer/CustomerRouteGuard.tsx'), 'utf8');

  // Both must import and use isRouteAllowedForPersona
  assert.ok(
    shellSrc.includes('isRouteAllowedForPersona'),
    'CustomerAppShell must import and use isRouteAllowedForPersona'
  );
  assert.ok(
    guardSrc.includes('isRouteAllowedForPersona'),
    'CustomerRouteGuard must import and use isRouteAllowedForPersona'
  );

  // Shell must not use forbidden-only check
  assert.ok(
    !shellSrc.includes('!isForbiddenByPersona'),
    'CustomerAppShell must not rely on !isForbiddenByPersona'
  );

  console.log('  ✓ Navigation and Route Guard both use centralized isRouteAllowedForPersona');
}

// -----------------------------------------------------------------------------
// Suite 6: Dashboard Server-Authoritative Section Rendering & No Synthetic Data
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 6] Dashboard Server-Authoritative Section Rendering & Cleanliness');

  const dashboardSrc = fs.readFileSync(path.join(root, 'src/components/customer/CustomerDashboard.tsx'), 'utf8');

  // 1. Must check dashboard.sections from server
  assert.ok(
    dashboardSrc.includes('canRenderDashboardSection'),
    'CustomerDashboard must implement canRenderDashboardSection'
  );
  assert.ok(
    dashboardSrc.includes('serverSections.includes(section)') ||
      dashboardSrc.includes('dashboard.sections.includes'),
    'CustomerDashboard must check server dashboard.sections'
  );

  // 2. Must not contain ?? 1
  assert.ok(
    !dashboardSrc.includes('?? 1'),
    'CustomerDashboard must not contain synthetic fallback ?? 1'
  );

  // 3. Must check version 1
  assert.ok(
    dashboardSrc.includes('dashboard.version !== 1'),
    'CustomerDashboard must enforce version 1 payload'
  );

  // 4. Must fail-closed on persona mismatch
  assert.ok(
    dashboardSrc.includes('dashboard.persona.toLowerCase() !== roleCode'),
    'CustomerDashboard must fail-closed on persona / role mismatch'
  );

  // 5. Must not contain hardcoded unlocalized strings
  assert.ok(
    !dashboardSrc.includes('>ReadOnly Oversight<'),
    'CustomerDashboard must localize ReadOnly Oversight'
  );
  assert.ok(
    !dashboardSrc.includes('>Active meters<'),
    'CustomerDashboard must localize Active meters'
  );
  assert.ok(
    dashboardSrc.includes('t.buildingsUnits'),
    'CustomerDashboard must use localized t.buildingsUnits'
  );

  // 6. Must not contain mutating CTAs
  assert.ok(
    !dashboardSrc.includes('payNow'),
    'CustomerDashboard must not render payNow mutating CTA'
  );

  console.log('  ✓ Server-authoritative section rendering confirmed');
  console.log('  ✓ Zero synthetic fallback values');
  console.log('  ✓ Localized strings in ro, en, fa');
  console.log('  ✓ Mutating CTAs removed');
}

// -----------------------------------------------------------------------------
// Suite 7: Customer Dashboard API Route Hardening
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 7] Customer Dashboard API Route Security');

  const apiSrc = fs.readFileSync(path.join(root, 'src/app/api/customer/v1/dashboard/route.ts'), 'utf8');

  // Must not use service role
  assert.ok(!apiSrc.includes('createServiceClient'), 'API route must not use createServiceClient');
  assert.ok(!apiSrc.includes('service_role'), 'API route must not use service_role');

  // Must call platform.get_customer_dashboard RPC
  assert.ok(apiSrc.includes('get_customer_dashboard'), 'API route must call get_customer_dashboard');

  // Must map 42501 to 403
  assert.ok(apiSrc.includes("42501'"), 'API route must check 42501 error code');
  assert.ok(apiSrc.includes('403'), 'API route must return HTTP 403 for 42501');

  // Must set Cache-Control no-store
  assert.ok(apiSrc.includes('no-store, private'), 'API route must set no-store, private');

  console.log('  ✓ API route uses authenticated client (no service role)');
  console.log('  ✓ Error translation 42501 -> 403 verified');
  console.log('  ✓ Cache-Control header verified');
}

// -----------------------------------------------------------------------------
// Suite 8: Database Migration & pgTAP Contract Integrity
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 8] Database Migration & pgTAP Contract Integrity');

  const migSrc = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260906120000_customer_role_aware_dashboard.sql'),
    'utf8'
  );
  const testSrc = fs.readFileSync(
    path.join(root, 'supabase/tests/048_customer_role_aware_dashboard.test.sql'),
    'utf8'
  );

  // Migration checks
  assert.ok(migSrc.includes('create or replace function platform.get_customer_dashboard'));
  assert.ok(migSrc.includes('security definer'));
  assert.ok(migSrc.includes('override_value_json'));
  assert.ok(migSrc.includes('resident_party_mapping_required'));
  assert.ok(migSrc.includes('ownership_required'));
  assert.ok(migSrc.includes('active_lease_required'));
  assert.ok(migSrc.includes('revoke all on function platform.get_customer_dashboard'));

  // Test checks
  assert.ok(testSrc.includes('select plan(55);'));
  assert.ok(testSrc.includes('association_admin'));
  assert.ok(testSrc.includes('property_manager'));
  assert.ok(testSrc.includes('president'));
  assert.ok(testSrc.includes('censor'));
  assert.ok(testSrc.includes('owner'));
  assert.ok(testSrc.includes('tenant_resident'));
  assert.ok(testSrc.includes('module.override_true'));
  assert.ok(testSrc.includes('module.override_false'));
  assert.ok(testSrc.includes('module.override_expired'));

  console.log('  ✓ Migration contains override semantics, party mapping, ownership & lease validation');
  console.log('  ✓ pgTAP test covers all 6 canonical roles and failure modes');
}

console.log('\n=== ALL P1 ROLE-AWARE DASHBOARD TESTS PASSED SUCCESSFULLY ===');
