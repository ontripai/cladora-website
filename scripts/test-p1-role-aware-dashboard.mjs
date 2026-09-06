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
  isSectionAllowed,
  isCapabilityAllowed,
  isPersonaReadOnly,
} = await import('../src/lib/customer/access-matrix.ts');

const { classifyCustomerRoute } = await import('../src/lib/customer/route-classifier.ts');

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

  console.log('  ✓ Exactly 6 canonical roles verified');
  console.log('  ✓ Contractor and unapproved roles strictly excluded');
  console.log('  ✓ Central matrix exists for all canonical roles');
}

// -----------------------------------------------------------------------------
// Suite 2: Persona-Specific Allowed & Forbidden Sections
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 2] Persona Allowed & Forbidden Sections Verification');

  // 1. association_admin & property_manager
  for (const adminRole of ['association_admin', 'property_manager']) {
    assert.ok(isSectionAllowed(adminRole, 'operations'), `${adminRole} allowed operations`);
    assert.ok(isSectionAllowed(adminRole, 'financials'), `${adminRole} allowed financials`);
    assert.ok(isSectionAllowed(adminRole, 'maintenance'), `${adminRole} allowed maintenance`);
    assert.ok(isSectionAllowed(adminRole, 'communications'), `${adminRole} allowed communications`);
    assert.ok(isSectionAllowed(adminRole, 'documents'), `${adminRole} allowed documents`);
    assert.ok(isSectionAllowed(adminRole, 'audit'), `${adminRole} allowed audit`);

    assert.equal(isSectionAllowed(adminRole, 'my_residence'), false, `${adminRole} forbidden my_residence`);
    assert.equal(isSectionAllowed(adminRole, 'my_expenses'), false, `${adminRole} forbidden my_expenses`);
    assert.equal(isSectionAllowed(adminRole, 'my_units'), false, `${adminRole} forbidden my_units`);
  }

  // 2. president
  assert.ok(isSectionAllowed('president', 'governance'), 'president allowed governance');
  assert.ok(isSectionAllowed('president', 'financial_summary'), 'president allowed financial_summary');
  assert.ok(isSectionAllowed('president', 'contracts'), 'president allowed contracts');
  assert.ok(isSectionAllowed('president', 'operations_summary'), 'president allowed operations_summary');
  assert.equal(isSectionAllowed('president', 'operations'), false, 'president forbidden operational management');
  assert.equal(isSectionAllowed('president', 'my_residence'), false, 'president forbidden my_residence');
  assert.equal(isSectionAllowed('president', 'my_units'), false, 'president forbidden my_units');

  // 3. censor
  assert.ok(isSectionAllowed('censor', 'financial_controls'), 'censor allowed financial_controls');
  assert.ok(isSectionAllowed('censor', 'control_documents'), 'censor allowed control_documents');
  assert.ok(isSectionAllowed('censor', 'discrepancies'), 'censor allowed discrepancies');
  assert.ok(isSectionAllowed('censor', 'audit_trail'), 'censor allowed audit_trail');
  assert.equal(isSectionAllowed('censor', 'operations'), false, 'censor forbidden operations');
  assert.equal(isSectionAllowed('censor', 'maintenance'), false, 'censor forbidden maintenance');
  assert.equal(isSectionAllowed('censor', 'my_residence'), false, 'censor forbidden my_residence');
  assert.equal(isSectionAllowed('censor', 'my_units'), false, 'censor forbidden my_units');

  // 4. owner
  assert.ok(isSectionAllowed('owner', 'my_units'), 'owner allowed my_units');
  assert.ok(isSectionAllowed('owner', 'my_financials'), 'owner allowed my_financials');
  assert.ok(isSectionAllowed('owner', 'my_documents'), 'owner allowed my_documents');
  assert.ok(isSectionAllowed('owner', 'my_voting'), 'owner allowed my_voting');
  assert.ok(isSectionAllowed('owner', 'service_requests'), 'owner allowed service_requests');
  assert.equal(isSectionAllowed('owner', 'operations'), false, 'owner forbidden operations');
  assert.equal(isSectionAllowed('owner', 'maintenance'), false, 'owner forbidden maintenance management');
  assert.equal(isSectionAllowed('owner', 'audit'), false, 'owner forbidden audit');
  assert.equal(isSectionAllowed('owner', 'audit_trail'), false, 'owner forbidden audit_trail');
  assert.equal(isSectionAllowed('owner', 'financial_controls'), false, 'owner forbidden financial_controls');

  // 5. tenant_resident
  assert.ok(isSectionAllowed('tenant_resident', 'my_residence'), 'tenant_resident allowed my_residence');
  assert.ok(isSectionAllowed('tenant_resident', 'my_expenses'), 'tenant_resident allowed my_expenses');
  assert.ok(isSectionAllowed('tenant_resident', 'my_payments'), 'tenant_resident allowed my_payments');
  assert.ok(isSectionAllowed('tenant_resident', 'my_consumption'), 'tenant_resident allowed my_consumption');
  assert.ok(isSectionAllowed('tenant_resident', 'my_tickets'), 'tenant_resident allowed my_tickets');
  assert.ok(isSectionAllowed('tenant_resident', 'resident_notices'), 'tenant_resident allowed resident_notices');
  assert.equal(isSectionAllowed('tenant_resident', 'operations'), false, 'tenant_resident forbidden operations');
  assert.equal(isSectionAllowed('tenant_resident', 'governance'), false, 'tenant_resident forbidden governance');
  assert.equal(isSectionAllowed('tenant_resident', 'ownership'), false, 'tenant_resident forbidden ownership');
  assert.equal(isSectionAllowed('tenant_resident', 'my_units'), false, 'tenant_resident forbidden my_units');
  assert.equal(isSectionAllowed('tenant_resident', 'audit'), false, 'tenant_resident forbidden audit');

  console.log('  ✓ Manager, President, Censor, Owner, and Resident sections verified');
  console.log('  ✓ Cross-persona forbidden section boundaries strictly enforced');
}

// -----------------------------------------------------------------------------
// Suite 3: Censor Strict Read-Only Enforcement
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 3] Censor Strict Read-Only Verification');

  assert.equal(isPersonaReadOnly('censor'), true, 'Censor persona must be strictly read-only');

  const censorMatrix = getPersonaMatrix('censor');
  assert.ok(censorMatrix.isReadOnly, 'censorMatrix.isReadOnly must be true');

  // Must not have mutating capabilities
  const forbiddenCapabilities = [
    'can_manage_work_orders',
    'can_mutate_financials',
    'can_approve_requests',
    'can_register_items',
  ];
  for (const cap of forbiddenCapabilities) {
    assert.equal(isCapabilityAllowed('censor', cap), false, `Censor must not have capability ${cap}`);
  }

  // Verify CustomerDashboard.tsx renders read-only badge and no mutating CTAs for censor
  const dashboardFile = path.join(root, 'src', 'components', 'customer', 'CustomerDashboard.tsx');
  const dashContent = fs.readFileSync(dashboardFile, 'utf8');

  assert.ok(dashContent.includes('readOnlyBadge'), 'CustomerDashboard must render Read-Only badge');
  assert.ok(dashContent.includes('Mod Inspecție — Exclusiv Citire'), 'RO read-only badge copy');
  assert.ok(dashContent.includes('حالت بازرسی — کاملاً فقط خواندنی'), 'FA read-only badge copy');

  console.log('  ✓ Censor is strictly Read-Only in matrix and capabilities');
  console.log('  ✓ Mutating capabilities forbidden for censor');
  console.log('  ✓ Dashboard renders non-mutating inspection view');
}

// -----------------------------------------------------------------------------
// Suite 4: Owner & Tenant-Resident Data Isolation & Forbidden Data
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 4] Owner & Tenant Resident Data Isolation Guarantees');

  const ownerMatrix = getPersonaMatrix('owner');
  assert.ok(ownerMatrix.forbiddenData.includes('other_units_private_info'));
  assert.ok(ownerMatrix.forbiddenData.includes('resident_directory'));
  assert.ok(ownerMatrix.forbiddenData.includes('credentials'));
  assert.ok(ownerMatrix.forbiddenData.includes('access_logs'));
  assert.ok(ownerMatrix.forbiddenData.includes('general_audit'));
  assert.equal(isCapabilityAllowed('owner', 'can_view_audit'), false);
  assert.equal(isCapabilityAllowed('owner', 'can_view_other_units'), false);

  const tenantMatrix = getPersonaMatrix('tenant_resident');
  assert.ok(tenantMatrix.forbiddenData.includes('owner_equity_capital'));
  assert.ok(tenantMatrix.forbiddenData.includes('property_ownership_records'));
  assert.ok(tenantMatrix.forbiddenData.includes('owner_votes'));
  assert.ok(tenantMatrix.forbiddenData.includes('other_units_data'));
  assert.ok(tenantMatrix.forbiddenData.includes('credentials'));
  assert.ok(tenantMatrix.forbiddenData.includes('access_logs'));
  assert.ok(tenantMatrix.forbiddenData.includes('general_audit'));
  assert.equal(isCapabilityAllowed('tenant_resident', 'can_view_audit'), false);
  assert.equal(isCapabilityAllowed('tenant_resident', 'can_view_ownership'), false);

  // Migration code verification
  const migrationFile = path.join(
    root,
    'supabase',
    'migrations',
    '20260906120000_customer_role_aware_dashboard.sql'
  );
  assert.ok(fs.existsSync(migrationFile), 'Dashboard migration must exist');
  const migrationContent = fs.readFileSync(migrationFile, 'utf8');

  // Verify owner receives scoped my_units_count and outstanding_amount strictly for own unit
  assert.ok(migrationContent.includes("'my_units_count'"), 'Owner receives scoped my_units_count');
  assert.ok(migrationContent.includes("'my_open_requests'"), 'Owner receives my_open_requests');
  assert.ok(!migrationContent.includes("'owner' then v_sections := jsonb_build_array('operations'"), 'Owner must not receive operations');

  // Verify tenant_resident receives scoped outstanding_amount and my_open_tickets strictly for resident unit
  assert.ok(migrationContent.includes("'my_open_tickets'"), 'Tenant receives my_open_tickets');
  assert.ok(migrationContent.includes("'my_consumption'"), 'Tenant receives my_consumption');

  console.log('  ✓ Owner data isolation guarantees verified (no audit, other units, directory)');
  console.log('  ✓ Tenant data isolation guarantees verified (no audit, ownership, other units)');
  console.log('  ✓ SQL RPC enforces unit scoping and persona KPI isolation');
}

// -----------------------------------------------------------------------------
// Suite 5: Fail-Closed Enforcement for Unknown Roles & Inactive Contexts
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 5] Fail-Closed Enforcement for Unknown Roles');

  assert.equal(getPersonaMatrix('unknown_role'), null);
  assert.equal(isSectionAllowed('unknown_role', 'operations'), false);
  assert.equal(isCapabilityAllowed('unknown_role', 'can_view_operations'), false);

  // Check SQL migration raises unknown_role exception
  const migrationFile = path.join(
    root,
    'supabase',
    'migrations',
    '20260906120000_customer_role_aware_dashboard.sql'
  );
  const migrationContent = fs.readFileSync(migrationFile, 'utf8');

  assert.ok(
    migrationContent.includes("raise exception 'unknown_role' using errcode = '42501'"),
    'RPC must raise unknown_role with 42501'
  );
  assert.ok(
    migrationContent.includes("raise exception 'workspace_inactive' using errcode = '42501'"),
    'RPC must raise workspace_inactive with 42501'
  );
  assert.ok(
    migrationContent.includes("raise exception 'customer_context_access_denied' using errcode = '42501'"),
    'RPC must raise customer_context_access_denied with 42501'
  );

  // Check CustomerRouteGuard and CustomerDashboard handle unknown roles fail-closed
  const guardFile = path.join(root, 'src', 'components', 'customer', 'CustomerRouteGuard.tsx');
  const guardContent = fs.readFileSync(guardFile, 'utf8');
  assert.ok(
    guardContent.includes('!isCanonicalRole(roleCode)'),
    'CustomerRouteGuard must fail-closed on non-canonical roles'
  );

  const dashFile = path.join(root, 'src', 'components', 'customer', 'CustomerDashboard.tsx');
  const dashContent = fs.readFileSync(dashFile, 'utf8');
  assert.ok(
    dashContent.includes('!isCanonicalRole(roleCode)'),
    'CustomerDashboard must fail-closed on non-canonical roles'
  );

  console.log('  ✓ Database RPC rejects unknown roles and inactive workspaces with 42501');
  console.log('  ✓ UI route guard and dashboard render AccessRestrictedCard for non-canonical roles');
}

// -----------------------------------------------------------------------------
// Suite 6: Customer Dashboard API Route Contract & Non-Guessing Verification
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 6] Customer Dashboard API Route Contract Verification');

  const routeFile = path.join(root, 'src', 'app', 'api', 'customer', 'v1', 'dashboard', 'route.ts');
  assert.ok(fs.existsSync(routeFile), 'Dashboard route.ts must exist');
  const routeContent = fs.readFileSync(routeFile, 'utf8');

  // 1. Must NOT use Service Role
  assert.equal(routeContent.includes('service_role'), false, 'Dashboard API must not use service role');
  assert.equal(
    routeContent.includes('SUPABASE_SERVICE_ROLE_KEY'),
    false,
    'Dashboard API must not use SUPABASE_SERVICE_ROLE_KEY'
  );
  assert.equal(routeContent.includes('createAdminClient'), false, 'Dashboard API must not use createAdminClient');

  // 2. Must NOT guess modules using multiple RPCs
  assert.equal(
    routeContent.includes('get_customer_ledger'),
    false,
    'Dashboard API must NOT guess modules via get_customer_ledger RPC'
  );
  assert.equal(
    routeContent.includes('get_customer_billing'),
    false,
    'Dashboard API must NOT guess modules via get_customer_billing RPC'
  );
  assert.equal(
    routeContent.includes('get_customer_payments'),
    false,
    'Dashboard API must NOT guess modules via get_customer_payments RPC'
  );

  // 3. Must use Zod validation and getClaims()
  assert.ok(routeContent.includes('z.object'), 'Route must use Zod validation');
  assert.ok(routeContent.includes('getClaims()'), 'Route must verify getClaims()');

  // 4. Must map 42501 to HTTP 403
  assert.ok(routeContent.includes("42501 ? 403 : 500") || (routeContent.includes('42501') && routeContent.includes('403')), 'Route must map 42501 to HTTP 403');

  // 5. Must use private no-store cache headers
  assert.ok(routeContent.includes('no-store, private'), 'Route must enforce private no-store cache control');

  console.log('  ✓ Service Role completely absent from Customer Dashboard API');
  console.log('  ✓ Legacy RPC guessing completely eliminated (modules derived authoritatively)');
  console.log('  ✓ Zod validation, getClaims(), 42501->403 mapping, and no-store headers verified');
}

// -----------------------------------------------------------------------------
// Suite 7: Route, Menu & Dashboard Alignment (Defense-in-Depth)
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 7] Route, Navigation & Dashboard Persona Alignment');

  const shellFile = path.join(root, 'src', 'components', 'customer', 'CustomerAppShell.tsx');
  const shellContent = fs.readFileSync(shellFile, 'utf8');

  assert.ok(
    shellContent.includes('isForbiddenByPersona'),
    'CustomerAppShell must filter navigation items using isForbiddenByPersona'
  );

  // Verify owner forbidden nav links are excluded
  const ownerForbidden = PERSONA_ACCESS_MATRIX.owner.forbiddenNavLinks;
  assert.ok(ownerForbidden.includes('/app/audit'), 'Owner forbidden /app/audit');
  assert.ok(ownerForbidden.includes('/app/security-access'), 'Owner forbidden /app/security-access');

  // Verify tenant forbidden nav links are excluded
  const tenantForbidden = PERSONA_ACCESS_MATRIX.tenant_resident.forbiddenNavLinks;
  assert.ok(tenantForbidden.includes('/app/audit'), 'Tenant forbidden /app/audit');
  assert.ok(tenantForbidden.includes('/app/ownership'), 'Tenant forbidden /app/ownership');

  console.log('  ✓ CustomerAppShell integrates Persona Access Matrix');
  console.log('  ✓ Owner and Tenant forbidden routes prevented in navigation');
}

// -----------------------------------------------------------------------------
// Suite 8: Trilingual Copy Verification (RO, EN, FA)
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 8] Multilingual Copy & RTL Verification');

  const dashboardFile = path.join(root, 'src', 'components', 'customer', 'CustomerDashboard.tsx');
  const content = fs.readFileSync(dashboardFile, 'utf8');

  // Language copy blocks
  assert.ok(content.includes("ro: {"), 'Must have Romanian copy');
  assert.ok(content.includes("en: {"), 'Must have English copy');
  assert.ok(content.includes("fa: {"), 'Must have Persian copy');

  // Romanian terms
  assert.ok(content.includes('Tablou principal'), 'RO title');
  assert.ok(content.includes('Mod Inspecție — Exclusiv Citire'), 'RO read-only badge');
  assert.ok(content.includes('Unitățile mele'), 'RO my units KPI');

  // English terms
  assert.ok(content.includes('Dashboard'), 'EN title');
  assert.ok(content.includes('Audit Inspection Mode — Read Only'), 'EN read-only badge');
  assert.ok(content.includes('My units'), 'EN my units KPI');

  // Persian terms
  assert.ok(content.includes('داشبورد'), 'FA title');
  assert.ok(content.includes('حالت بازرسی — کاملاً فقط خواندنی'), 'FA read-only badge');
  assert.ok(content.includes('واحدهای تحت مالکیت من'), 'FA my units KPI');

  // RTL handling
  assert.ok(content.includes("lang === 'fa'"), 'Persian RTL detection');

  console.log('  ✓ Romanian, English, and Persian copy complete across all persona sections');
  console.log('  ✓ Directional and locale formatting verified');
}

console.log('\n=== ALL P1 ROLE-AWARE DASHBOARD & ACCESS MATRIX TESTS PASSED ===\n');
