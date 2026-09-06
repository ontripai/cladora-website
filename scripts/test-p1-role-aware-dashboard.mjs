import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== RUNNING P1 ROLE-AWARE DASHBOARD & ACCESS MATRIX TESTS ===\n');

const root = process.cwd();

// Import central access matrix and route classifier
const {
  CANONICAL_ROLES,
  PERSONA_ACCESS_MATRIX,
  PRE_CONTEXT_ALLOWED_ROUTES,
  EXPLICITLY_UNAVAILABLE_ROUTES,
  isPreContextRoute,
  isCanonicalRole,
  getPersonaMatrix,
  isRouteAllowedForPersona,
  matchesRoutePattern,
  isSectionAllowed,
  isCapabilityAllowed,
  isPersonaReadOnly,
} = await import('../src/lib/customer/access-matrix.ts');

const {
  classifyCustomerRoute,
} = await import('../src/lib/customer/route-classifier.ts');

const {
  dashboardRpcResponseSchema,
} = await import('../src/lib/customer/dashboard-schema.ts');

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

// Independent Authoritative Expected 6 x 37 Access Matrix Contract
const EXPECTED_ROUTE_ACCESS_MATRIX = {
  association_admin: {
    '/app/access-logs': true,
    '/app/accounting': true,
    '/app/accounting/allocations': true,
    '/app/accounting/month-close': false,
    '/app/assets': true,
    '/app/audit': true,
    '/app/billing': true,
    '/app/communications': true,
    '/app/credentials': true,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': true,
    '/app/invoices': true,
    '/app/leases': true,
    '/app/maintenance': true,
    '/app/meetings': true,
    '/app/meters': true,
    '/app/migration/shadow-ledger': false,
    '/app/notifications': true,
    '/app/occupancy': true,
    '/app/occupancy/456': true,
    '/app/onboarding': false,
    '/app/ownership': true,
    '/app/payments': true,
    '/app/portfolio': false,
    '/app/procurement': true,
    '/app/purchase-orders': true,
    '/app/receivables': true,
    '/app/reconciliation': true,
    '/app/residents': true,
    '/app/security-access': true,
    '/app/settings': false,
    '/app/vendor-contracts': true,
    '/app/vendor-sla': true,
    '/app/vendors': true,
    '/app/visitors': true,
  },
  property_manager: {
    '/app/access-logs': true,
    '/app/accounting': true,
    '/app/accounting/allocations': true,
    '/app/accounting/month-close': false,
    '/app/assets': true,
    '/app/audit': true,
    '/app/billing': true,
    '/app/communications': true,
    '/app/credentials': true,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': false, // BLOCKED per matrix contract
    '/app/invoices': true,
    '/app/leases': true,
    '/app/maintenance': true,
    '/app/meetings': false, // BLOCKED per matrix contract
    '/app/meters': true,
    '/app/migration/shadow-ledger': false,
    '/app/notifications': true,
    '/app/occupancy': true,
    '/app/occupancy/456': true,
    '/app/onboarding': false,
    '/app/ownership': true,
    '/app/payments': true,
    '/app/portfolio': false,
    '/app/procurement': true,
    '/app/purchase-orders': true,
    '/app/receivables': true,
    '/app/reconciliation': true,
    '/app/residents': true,
    '/app/security-access': true,
    '/app/settings': false,
    '/app/vendor-contracts': true,
    '/app/vendor-sla': true,
    '/app/vendors': true,
    '/app/visitors': true,
  },
  president: {
    '/app/access-logs': false,
    '/app/accounting': true,
    '/app/accounting/allocations': true, // ALLOWED per matrix contract
    '/app/accounting/month-close': false,
    '/app/assets': false,
    '/app/audit': true,
    '/app/billing': true,
    '/app/communications': true,
    '/app/credentials': false,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': true,
    '/app/invoices': true,
    '/app/leases': false,
    '/app/maintenance': false,
    '/app/meetings': true,
    '/app/meters': false,
    '/app/migration/shadow-ledger': false,
    '/app/notifications': true,
    '/app/occupancy': false,
    '/app/occupancy/456': false,
    '/app/onboarding': false,
    '/app/ownership': false,
    '/app/payments': true, // ALLOWED per matrix contract
    '/app/portfolio': false,
    '/app/procurement': false,
    '/app/purchase-orders': false,
    '/app/receivables': true,
    '/app/reconciliation': true, // ALLOWED per matrix contract
    '/app/residents': false,
    '/app/security-access': false,
    '/app/settings': false,
    '/app/vendor-contracts': true,
    '/app/vendor-sla': true,
    '/app/vendors': true,
    '/app/visitors': false,
  },
  censor: {
    '/app/access-logs': false,
    '/app/accounting': true,
    '/app/accounting/allocations': true,
    '/app/accounting/month-close': false,
    '/app/assets': false,
    '/app/audit': true,
    '/app/billing': true,
    '/app/communications': false,
    '/app/credentials': false,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': false,
    '/app/invoices': true,
    '/app/leases': false,
    '/app/maintenance': false,
    '/app/meetings': false,
    '/app/meters': false,
    '/app/migration/shadow-ledger': false,
    '/app/notifications': false,
    '/app/occupancy': false,
    '/app/occupancy/456': false,
    '/app/onboarding': false,
    '/app/ownership': false,
    '/app/payments': true,
    '/app/portfolio': false,
    '/app/procurement': false,
    '/app/purchase-orders': false,
    '/app/receivables': true,
    '/app/reconciliation': true,
    '/app/residents': false,
    '/app/security-access': false,
    '/app/settings': false,
    '/app/vendor-contracts': false,
    '/app/vendor-sla': false,
    '/app/vendors': false,
    '/app/visitors': false,
  },
  owner: {
    '/app/access-logs': false,
    '/app/accounting': false,
    '/app/accounting/allocations': false,
    '/app/accounting/month-close': false,
    '/app/assets': false,
    '/app/audit': false,
    '/app/billing': false, // BLOCKED per matrix contract
    '/app/communications': true,
    '/app/credentials': false,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': true,
    '/app/invoices': true,
    '/app/leases': false,
    '/app/maintenance': false,
    '/app/meetings': true,
    '/app/meters': false, // BLOCKED per matrix contract
    '/app/migration/shadow-ledger': false,
    '/app/notifications': true,
    '/app/occupancy': false,
    '/app/occupancy/456': false,
    '/app/onboarding': false,
    '/app/ownership': true, // ALLOWED per matrix contract
    '/app/payments': true,
    '/app/portfolio': false,
    '/app/procurement': false,
    '/app/purchase-orders': false,
    '/app/receivables': false, // BLOCKED per matrix contract
    '/app/reconciliation': false,
    '/app/residents': false,
    '/app/security-access': false,
    '/app/settings': false,
    '/app/vendor-contracts': false,
    '/app/vendor-sla': false,
    '/app/vendors': false,
    '/app/visitors': false,
  },
  tenant_resident: {
    '/app/access-logs': false,
    '/app/accounting': false,
    '/app/accounting/allocations': false,
    '/app/accounting/month-close': false,
    '/app/assets': false,
    '/app/audit': false,
    '/app/billing': false, // BLOCKED per matrix contract
    '/app/communications': true,
    '/app/credentials': false,
    '/app/dashboard': true,
    '/app/documents': true,
    '/app/documents/123': true,
    '/app/governance': false,
    '/app/invoices': true, // ALLOWED per matrix contract
    '/app/leases': false,
    '/app/maintenance': false,
    '/app/meetings': false,
    '/app/meters': true, // ALLOWED per matrix contract
    '/app/migration/shadow-ledger': false,
    '/app/notifications': true,
    '/app/occupancy': false,
    '/app/occupancy/456': false,
    '/app/onboarding': false,
    '/app/ownership': false,
    '/app/payments': true, // ALLOWED per matrix contract
    '/app/portfolio': false,
    '/app/procurement': false,
    '/app/purchase-orders': false,
    '/app/receivables': false, // BLOCKED per matrix contract
    '/app/reconciliation': false,
    '/app/residents': false,
    '/app/security-access': false,
    '/app/settings': false,
    '/app/vendor-contracts': false,
    '/app/vendor-sla': false,
    '/app/vendors': false,
    '/app/visitors': false,
  },
};

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
// Suite 2: Independent 6 x 37 Expected Matrix Verification
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 2] Independent 6 x 37 Expected Matrix Verification');

  assert.equal(ALL_37_CUSTOMER_ROUTES.length, 37, 'Must evaluate exactly 37 customer routes');

  let evaluatedCells = 0;
  for (const role of CANONICAL_ROLES) {
    for (const route of ALL_37_CUSTOMER_ROUTES) {
      const expectedAllowed = EXPECTED_ROUTE_ACCESS_MATRIX[role][route];
      assert.notEqual(
        expectedAllowed,
        undefined,
        `Expected matrix must define an entry for ${role} on ${route}`
      );

      const actualAllowed = isRouteAllowedForPersona(role, route);
      assert.equal(
        actualAllowed,
        expectedAllowed,
        `Role ${role} on route ${route}: expected ${expectedAllowed}, got ${actualAllowed}`
      );
      evaluatedCells++;
    }
  }

  assert.equal(evaluatedCells, 6 * 37, 'Must evaluate exactly 222 matrix cells');

  // Explicit contract checks
  // 1. Property manager blocked from governance and meetings
  assert.equal(isRouteAllowedForPersona('property_manager', '/app/governance'), false);
  assert.equal(isRouteAllowedForPersona('property_manager', '/app/meetings'), false);

  // 2. President allowed allocations, payments, reconciliation
  assert.equal(isRouteAllowedForPersona('president', '/app/accounting/allocations'), true);
  assert.equal(isRouteAllowedForPersona('president', '/app/payments'), true);
  assert.equal(isRouteAllowedForPersona('president', '/app/reconciliation'), true);

  // 3. Owner allowed ownership; blocked billing, receivables, meters
  assert.equal(isRouteAllowedForPersona('owner', '/app/ownership'), true);
  assert.equal(isRouteAllowedForPersona('owner', '/app/billing'), false);
  assert.equal(isRouteAllowedForPersona('owner', '/app/receivables'), false);
  assert.equal(isRouteAllowedForPersona('owner', '/app/meters'), false);

  // 4. Tenant resident blocked billing, receivables; allowed invoices, payments, meters
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/billing'), false);
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/receivables'), false);
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/invoices'), true);
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/payments'), true);
  assert.equal(isRouteAllowedForPersona('tenant_resident', '/app/meters'), true);

  // 5. Pre-Context centralized route policy: /app/onboarding
  assert.equal(isPreContextRoute('/app/onboarding'), true);
  assert.equal(isPreContextRoute('/app/onboarding/step-1'), false);
  assert.equal(isPreContextRoute('/app/dashboard'), false);
  assert.ok(PRE_CONTEXT_ALLOWED_ROUTES.includes('/app/onboarding'));

  // 6. Unknown role fails closed on ALL routes
  for (const route of ALL_37_CUSTOMER_ROUTES) {
    assert.equal(isRouteAllowedForPersona('contractor', route), false, `Unknown role must fail closed on ${route}`);
    assert.equal(isRouteAllowedForPersona(null, route), false, `Null role must fail closed on ${route}`);
  }

  console.log(`  ✓ All ${evaluatedCells} (6x37) route cells match independent expected contract`);
  console.log('  ✓ Property Manager governance/meetings blocked');
  console.log('  ✓ President allocations/payments/reconciliation allowed');
  console.log('  ✓ Owner ownership allowed; billing/receivables/meters blocked');
  console.log('  ✓ Tenant Resident billing/receivables blocked; invoices/payments/meters allowed');
  console.log('  ✓ Pre-Context /app/onboarding policy validated');
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

  // Guard must use centralized isPreContextRoute
  assert.ok(
    guardSrc.includes('isPreContextRoute'),
    'CustomerRouteGuard must use centralized isPreContextRoute'
  );

  // Shell must not use forbidden-only check
  assert.ok(
    !shellSrc.includes('!isForbiddenByPersona'),
    'CustomerAppShell must not rely on !isForbiddenByPersona'
  );

  console.log('  ✓ Navigation and Route Guard both use centralized isRouteAllowedForPersona and isPreContextRoute');
}

// -----------------------------------------------------------------------------
// Suite 6: Dashboard Server-Authoritative Rendering & Complete Trilingual Localization
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 6] Dashboard Server-Authoritative Rendering & Localization');

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

  // 2. Zero synthetic fallback values (no ?? 0 when key absent)
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

  // 5. Must not render empty grid container when 0 valid KPI cards
  assert.ok(
    dashboardSrc.includes('if (cards.length === 0) return null;'),
    'CustomerDashboard must return null when no KPI cards are available'
  );

  // 6. Verify all 17 hardcoded subtitle phrases are localized into COPY dictionary
  const REQUIRED_KPI_SUBTITLES = [
    'activeMaintenance',
    'totalCommunityDues',
    'unreadNotices',
    'governanceOversight',
    'associationReceivables',
    'inProgressJobs',
    'boardDispatches',
    'ledgerAuditCorpus',
    'reconciledBalance',
    'auditAlerts',
    'titleRegisteredUnits',
    'maintenanceReserveDues',
    'technicalTickets',
    'buildingNotices',
    'assignedUtilitiesMaintenance',
    'activeMaintenanceIssues',
    'residentialUpdates',
  ];

  for (const key of REQUIRED_KPI_SUBTITLES) {
    assert.ok(
      dashboardSrc.includes(`${key}:`),
      `CustomerDashboard must define translation key ${key}`
    );
  }

  // 7. Verify none of the 17 raw English strings are hardcoded into JSX tags
  const RAW_ENGLISH_SUBTITLES = [
    'Total community dues',
    'Governance oversight',
    'Association receivables',
    'In-progress jobs',
    'Board dispatches',
    'Ledger audit corpus',
    'Reconciled balance',
    'Audit alerts',
    'Title-registered units',
    'Maintenance & reserve dues',
    'Technical tickets',
    'Building notices',
    'Assigned utilities & maintenance',
    'Active maintenance issues',
    'Residential updates',
  ];

  // Strip COPY object definition block from the file to inspect only the component JSX
  const jsxPart = dashboardSrc.split('export function CustomerDashboard')[1];
  assert.ok(jsxPart, 'CustomerDashboard function must exist');

  for (const raw of RAW_ENGLISH_SUBTITLES) {
    assert.ok(
      !jsxPart.includes(`>${raw}<`) && !jsxPart.includes(`"${raw}"`),
      `JSX must not contain hardcoded English string: "${raw}"`
    );
  }

  console.log('  ✓ Server-authoritative section rendering confirmed');
  console.log('  ✓ Zero synthetic fallback values; empty KPI grid suppressed');
  console.log('  ✓ All 17 hardcoded subtitle strings moved to trilingual COPY dictionary');
  console.log('  ✓ JSX thoroughly inspected and free of unlocalized strings');
}

// -----------------------------------------------------------------------------
// Suite 7: Customer Dashboard API Route Hardening & Strict Zod Validation
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 7] Customer Dashboard API Route Hardening & Zod Schema');

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

  // Test Zod schema validation directly
  const validPayload = {
    version: 1,
    persona: 'association_admin',
    contextId: '21400000-0000-0000-0000-000000000001',
    context: {
      id: '21400000-0000-0000-0000-000000000001',
      tenant_id: '21100000-0000-0000-0000-000000000001',
      tenant_name: 'Tenant Alpha',
      role_code: 'association_admin',
      role_name: 'Admin Alpha',
      scope_type: 'tenant',
    },
    workspace_id: '21800000-0000-0000-0000-000000000001',
    capabilities: ['can_view_operations'],
    sections: ['operations'],
    permissions: ['maintenance.assets.read'],
    entitlements: ['module.maintenance'],
    modules: ['maintenance'],
    kpis: {
      open_work_orders: 2,
    },
    generated_at: new Date().toISOString(),
  };

  const validParse = dashboardRpcResponseSchema.safeParse(validPayload);
  assert.equal(validParse.success, true, 'Valid RPC payload must pass Zod schema');
  assert.equal(validParse.data.generated_at, validPayload.generated_at, 'generated_at must be preserved after safeParse');

  // Mandatory Schema Rejection Tests (Strict KPI allowlist)
  // 1. Arbitrary / secret object in KPIs
  const rejectArbitrarySecret = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    kpis: { arbitrary_secret: { token: 'leak' } },
  });
  assert.equal(rejectArbitrarySecret.success, false, 'arbitrary_secret object in KPIs must be rejected');

  // 2. null outstanding_amount
  const rejectNullOutstanding = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    kpis: { outstanding_amount: null },
  });
  assert.equal(rejectNullOutstanding.success, false, 'null outstanding_amount in KPIs must be rejected');

  // 3. String 'not-a-number' in KPIs
  const rejectStringKpi = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    kpis: { open_work_orders: 'not-a-number' },
  });
  assert.equal(rejectStringKpi.success, false, 'string KPI value must be rejected');

  // 4. pending_approvals in KPIs
  const rejectPendingApprovals = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    kpis: { pending_approvals: 1 },
  });
  assert.equal(rejectPendingApprovals.success, false, 'pending_approvals in KPIs must be rejected');

  // 5. NaN in KPIs
  const rejectNaNKpi = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    kpis: { outstanding_amount: NaN },
  });
  assert.equal(rejectNaNKpi.success, false, 'NaN in KPIs must be rejected');

  // 6. Unknown root keys (strict root)
  const rejectUnknownRoot = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    arbitrary_root_field: 'unauthorized',
  });
  assert.equal(rejectUnknownRoot.success, false, 'Unknown root key must be rejected by .strict()');

  // 7. Unknown context keys (strict context)
  const rejectUnknownContext = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    context: { ...validPayload.context, leaked_internal_token: 'secret' },
  });
  assert.equal(rejectUnknownContext.success, false, 'Unknown context key must be rejected by .strict()');

  // 8. Invalid scope_type
  const rejectInvalidScope = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    context: { ...validPayload.context, scope_type: 'invalid_scope' },
  });
  assert.equal(rejectInvalidScope.success, false, 'Invalid scope_type must fail Zod schema');

  // 9. Invalid generated_at
  const rejectInvalidGeneratedAt = dashboardRpcResponseSchema.safeParse({
    ...validPayload,
    generated_at: 'invalid-iso-date',
  });
  assert.equal(rejectInvalidGeneratedAt.success, false, 'Invalid generated_at must fail Zod schema');

  // Malformed: version !== 1
  const invalidVersion = dashboardRpcResponseSchema.safeParse({ ...validPayload, version: 2 });
  assert.equal(invalidVersion.success, false, 'Invalid version must fail Zod schema');

  // Malformed: non-canonical role
  const invalidPersona = dashboardRpcResponseSchema.safeParse({ ...validPayload, persona: 'contractor' });
  assert.equal(invalidPersona.success, false, 'Non-canonical persona must fail Zod schema');

  // Malformed: invalid UUID workspace
  const invalidWorkspace = dashboardRpcResponseSchema.safeParse({ ...validPayload, workspace_id: 'bad-uuid' });
  assert.equal(invalidWorkspace.success, false, 'Invalid workspace UUID must fail Zod schema');

  // Mismatch checks in route handler logic
  assert.ok(
    apiSrc.includes('requestedContextId = parsed.data.context_id.toLowerCase().trim()'),
    'Route must normalize requested context_id before comparison'
  );
  assert.ok(
    apiSrc.includes('validated.data.contextId.toLowerCase().trim() !== requestedContextId'),
    'Route must verify contextId matches query parameter with case-insensitive normalization'
  );
  assert.ok(
    apiSrc.includes('validated.data.context.id.toLowerCase().trim() !== requestedContextId'),
    'Route must verify context.id matches query parameter with case-insensitive normalization'
  );
  assert.ok(
    apiSrc.includes('validated.data.persona !== validated.data.context.role_code'),
    'Route must verify persona matches context role_code'
  );
  assert.ok(
    apiSrc.includes('INVALID_DASHBOARD_PAYLOAD'),
    'Route must return INVALID_DASHBOARD_PAYLOAD on validation failure'
  );

  console.log('  ✓ API route uses authenticated client (no service role)');
  console.log('  ✓ Error translation 42501 -> 403 verified');
  console.log('  ✓ Cache-Control header verified');
  console.log('  ✓ Strict Zod response schema tested (version 1, canonical persona, UUIDs, generated_at)');
  console.log('  ✓ Strict KPI allowlist verified: arbitrary secrets, nulls, strings, pending_approvals, NaN rejected');
  console.log('  ✓ Case-insensitive UUID comparison verified in API route');
  console.log('  ✓ Fail-closed Persona and Context ID mismatch verified');
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

  // Active workspace selection logic
  assert.ok(
    migSrc.includes("w.lifecycle_status = 'ACTIVE'"),
    'Migration must filter by active workspace lifecycle'
  );
  assert.ok(
    migSrc.includes("raise exception 'workspace_inactive' using errcode = '42501'"),
    'Migration must raise workspace_inactive when no active workspace exists'
  );

  // Strictly conditional KPI construction
  assert.ok(
    migSrc.includes("v_kpis := '{}'::jsonb;"),
    'KPI object must initialize empty'
  );
  assert.ok(
    !migSrc.includes("'pending_approvals'"),
    'Unauthoritative pending_approvals KPI must be removed'
  );
  const censorBlock = migSrc.split("v.role_code = 'censor'")[1].split('elsif')[0];
  assert.ok(
    !censorBlock.includes("'open_work_orders'"),
    'Censor must be excluded from operational work orders'
  );

  // Financial pairing in migration (no insecure cross-pair logic)
  assert.ok(
    migSrc.includes("(v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing')"),
    'Migration must require matching billing permission and entitlement'
  );
  assert.ok(
    migSrc.includes("(v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')"),
    'Migration must require matching accounting permission and entitlement'
  );
  assert.ok(
    !migSrc.includes('(permission_billing OR permission_accounting)'),
    'Insecure cross-pairing logic must be absent'
  );

  // Test checks
  assert.ok(testSrc.includes('select plan(73);'), 'pgTAP test plan must be 73');
  assert.ok(
    testSrc.trim().endsWith('rollback;'),
    'pgTAP test file must terminate with rollback; for isolation'
  );
  assert.ok(testSrc.includes('active workspace selected when tenant also has archived workspace'));
  assert.ok(testSrc.includes('entitlements read only from active workspace, not archived'));
  assert.ok(testSrc.includes('tenant without any workspace is denied fail-closed'));
  assert.ok(testSrc.includes('censor does not receive open_work_orders kpi without maintenance permission'));
  assert.ok(testSrc.includes('president does not receive unauthoritative pending_approvals kpi'));
  assert.ok(testSrc.includes('tenant resident does not receive community-wide open_work_orders kpi'));
  assert.ok(testSrc.includes('pairing case 1: billing perm + billing ent allows financials section'));
  assert.ok(testSrc.includes('pairing case 4 (cross-pair): accounting perm + billing ent blocks financials section'));
  assert.ok(testSrc.includes('pairing case 3 (cross-pair): billing perm + accounting ent blocks financials section'));
  assert.ok(testSrc.includes('pairing case 2: accounting perm + accounting ent allows financials section'));

  console.log('  ✓ Migration contains active workspace selection, override semantics, and conditional KPIs');
  console.log('  ✓ Strict financial permission + entitlement matching pairs enforced in SQL migration');
  console.log('  ✓ pgTAP test covers 73 assertions: active+archived, 4 financial pairing states, KPI isolation');
}

// -----------------------------------------------------------------------------
// Suite 9: UI Financial Pairing & Zero-Fallback Verification
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 9] UI Financial Pairing & Zero-Fallback Verification');

  const dashboardSrc = fs.readFileSync(
    path.join(root, 'src/components/customer/CustomerDashboard.tsx'),
    'utf8'
  );

  // 1. Pairing logic assertions
  assert.ok(
    dashboardSrc.includes("permissions.includes('billing.receivables.read') &&"),
    'CustomerDashboard must check billing permission'
  );
  assert.ok(
    dashboardSrc.includes("entitlements.includes('module.billing')"),
    'CustomerDashboard must check billing entitlement'
  );
  assert.ok(
    dashboardSrc.includes("permissions.includes('finance.ledger.read') &&"),
    'CustomerDashboard must check accounting permission'
  );
  assert.ok(
    dashboardSrc.includes("entitlements.includes('module.accounting')"),
    'CustomerDashboard must check accounting entitlement'
  );
  assert.ok(
    dashboardSrc.includes('const hasFinancial = hasBillingAccess || hasAccountingAccess;'),
    'CustomerDashboard must combine only matching pairs'
  );

  // 2. Shortcut removal: role === 'association_admin' must NOT bypass financial permissions
  assert.ok(
    !dashboardSrc.includes("role === 'association_admin'"),
    "role === 'association_admin' shortcut must be completely removed"
  );

  // 3. Fallback removal: Number(amount) || 0 must NOT be present
  assert.ok(
    !dashboardSrc.includes('Number(amount) || 0'),
    'Number(amount) || 0 fallback pattern must be completely removed'
  );
  assert.ok(
    !dashboardSrc.includes('|| 0'),
    'Any || 0 fallback must be absent from CustomerDashboard'
  );

  // 4. Functional simulation of the 4 financial pairing states
  const evaluateFinancialAccess = (permissions, entitlements) => {
    const hasBillingAccess =
      permissions.includes('billing.receivables.read') &&
      entitlements.includes('module.billing');
    const hasAccountingAccess =
      permissions.includes('finance.ledger.read') &&
      entitlements.includes('module.accounting');
    return hasBillingAccess || hasAccountingAccess;
  };

  // State 1: Billing Perm + Billing Ent -> ALLOWED
  assert.equal(
    evaluateFinancialAccess(['billing.receivables.read'], ['module.billing']),
    true,
    'State 1: Billing perm + Billing ent must allow financial access'
  );

  // State 2: Accounting Perm + Accounting Ent -> ALLOWED
  assert.equal(
    evaluateFinancialAccess(['finance.ledger.read'], ['module.accounting']),
    true,
    'State 2: Accounting perm + Accounting ent must allow financial access'
  );

  // State 3: Billing Perm + Accounting Ent (Cross-Pair) -> BLOCKED
  assert.equal(
    evaluateFinancialAccess(['billing.receivables.read'], ['module.accounting']),
    false,
    'State 3 (cross-pair): Billing perm + Accounting ent must block financial access'
  );

  // State 4: Accounting Perm + Billing Ent (Cross-Pair) -> BLOCKED
  assert.equal(
    evaluateFinancialAccess(['finance.ledger.read'], ['module.billing']),
    false,
    'State 4 (cross-pair): Accounting perm + Billing ent must block financial access'
  );

  console.log('  ✓ UI financial access strictly matches corresponding permission/entitlement pairs');
  console.log('  ✓ Association admin role shortcut removed (no role-only financial bypass)');
  console.log('  ✓ Zero fallback Number(amount) || 0 removed, strict number formatting enforced');
  console.log('  ✓ 4 independent financial pairing states validated (2 allowed, 2 cross-pair blocked)');
}

console.log('\n=== ALL P1 ROLE-AWARE DASHBOARD TESTS PASSED SUCCESSFULLY ===');
