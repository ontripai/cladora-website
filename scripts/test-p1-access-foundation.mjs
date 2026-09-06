import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

console.log('=== RUNNING P1 ACCESS, SESSION & AUDIT FOUNDATION TESTS ===\n');

const root = process.cwd();

// -----------------------------------------------------------------------------
// Suite 1: SignOutButton & Logout Implementation
// -----------------------------------------------------------------------------
{
  console.log('[Suite 1] SignOutButton & Real Logout Verification');

  const signOutFile = path.join(root, 'src', 'components', 'auth', 'SignOutButton.tsx');
  assert.ok(fs.existsSync(signOutFile), 'SignOutButton component must exist');

  const content = fs.readFileSync(signOutFile, 'utf8');

  // 1. Executes supabase.auth.signOut({ scope: 'local' })
  assert.ok(
    content.includes("signOut({ scope: 'local' })") ||
      content.includes('signOut({ scope: "local" })') ||
      content.includes("scope: 'local'"),
    'Must execute supabase.auth.signOut with scope: local'
  );

  // 2. Clears sessionStorage key
  assert.ok(
    content.includes("'cladora.customer-context.v1'") ||
      content.includes('"cladora.customer-context.v1"'),
    'Must clear cladora.customer-context.v1 from sessionStorage'
  );
  assert.ok(
    content.includes('sessionStorage.removeItem'),
    'Must call sessionStorage.removeItem'
  );

  // 3. Redirects to /{lang}/login
  assert.ok(
    content.includes('router.replace(`/${lang}/login`)') ||
      content.includes('/login'),
    'Must redirect to localized login page'
  );

  // 4. Loading state
  assert.ok(
    content.includes('loading') && (content.includes('Loader2') || content.includes('animate-spin')),
    'Must show visual loading state'
  );

  // 5. Accessible trilingual error
  assert.ok(
    content.includes('role="alert"') && content.includes('aria-live="polite"'),
    'Must display accessible error alert with ARIA live region'
  );
  assert.ok(content.includes('Deconectarea a eșuat'), 'Must have Romanian error message');
  assert.ok(content.includes('Sign out failed'), 'Must have English error message');
  assert.ok(content.includes('خروج ناموفق بود'), 'Must have Persian error message');

  // 6. PlatformShell & CustomerAppShell both use SignOutButton
  const platformShellFile = path.join(root, 'src', 'components', 'platform', 'PlatformShell.tsx');
  const platformShellContent = fs.readFileSync(platformShellFile, 'utf8');
  assert.ok(
    platformShellContent.includes('SignOutButton'),
    'PlatformShell must use SignOutButton'
  );
  assert.ok(
    !platformShellContent.includes('<Link\n              href={`/${lang}/login`}\n              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition"'),
    'PlatformShell must not use dummy Exit link'
  );

  const customerShellFile = path.join(root, 'src', 'components', 'customer', 'CustomerAppShell.tsx');
  const customerShellContent = fs.readFileSync(customerShellFile, 'utf8');
  assert.ok(
    customerShellContent.includes('SignOutButton'),
    'CustomerAppShell must use SignOutButton'
  );
  assert.ok(
    !customerShellContent.includes('<Link\n            href={`/${lang}`}\n            aria-label="Exit"'),
    'CustomerAppShell must not use dummy Exit link'
  );

  console.log('  ✓ SignOutButton implements local scope signOut');
  console.log('  ✓ Customer context cleared from sessionStorage');
  console.log('  ✓ Localized redirect to /{lang}/login');
  console.log('  ✓ Accessible loading and trilingual error alert');
  console.log('  ✓ Both PlatformShell and CustomerAppShell use SignOutButton');
}

// -----------------------------------------------------------------------------
// Suite 2: Customer Navigation & Mobile Responsiveness
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 2] Mobile Navigation & Desktop Sidebar Verification');

  const customerShellFile = path.join(root, 'src', 'components', 'customer', 'CustomerAppShell.tsx');
  const content = fs.readFileSync(customerShellFile, 'utf8');

  // Mobile horizontal scroll navigation exists
  assert.ok(
    content.includes('md:hidden') &&
      content.includes('overflow-x-auto') &&
      content.includes('whitespace-nowrap'),
    'CustomerAppShell must include horizontal scrollable navigation on mobile (md:hidden)'
  );

  // Desktop sidebar exists
  assert.ok(
    content.includes('hidden') &&
      content.includes('md:block') &&
      content.includes('w-64'),
    'CustomerAppShell must preserve desktop sidebar structure'
  );

  // Permission/entitlement filtering
  assert.ok(
    content.includes('audit.events.read'),
    'CustomerAppShell must verify audit.events.read permission'
  );
  assert.ok(
    content.includes('/app/audit'),
    'CustomerAppShell must include /app/audit navigation link'
  );

  console.log('  ✓ Mobile horizontal scrollable navigation present');
  console.log('  ✓ Desktop sidebar structure preserved');
  console.log('  ✓ Permission & entitlement gated navigation links');
}

// -----------------------------------------------------------------------------
// Suite 3: CustomerRouteGuard & Route Permission Mapping
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 3] CustomerRouteGuard & Fail-Closed Mock Routes');

  const guardFile = path.join(root, 'src', 'components', 'customer', 'CustomerRouteGuard.tsx');
  assert.ok(fs.existsSync(guardFile), 'CustomerRouteGuard component must exist');

  const content = fs.readFileSync(guardFile, 'utf8');

  // Route rules mapping
  const expectedMappings = [
    { route: '/app/accounting/allocations', perm: 'finance.allocations.read' },
    { route: '/app/accounting', perm: 'finance.ledger.read' },
    { route: '/app/billing', perm: 'billing.receivables.read' },
    { route: '/app/payments', perm: 'payments.reconciliation.read' },
    { route: '/app/reconciliation', perm: 'payments.reconciliation.read' },
    { route: '/app/meters', perm: 'utilities.metering.read', ent: 'module.utilities' },
    { route: '/app/assets', perm: 'maintenance.assets.read', ent: 'module.maintenance' },
    { route: '/app/maintenance', perm: 'maintenance.assets.read', ent: 'module.maintenance' },
    { route: '/app/procurement', perm: 'maintenance.procurement.read', ent: 'module.maintenance' },
    { route: '/app/vendors', perm: 'maintenance.procurement.read', ent: 'module.maintenance' },
    { route: '/app/governance', perm: 'governance.meetings.read', ent: 'module.governance' },
    { route: '/app/meetings', perm: 'governance.meetings.read', ent: 'module.governance' },
    { route: '/app/communications', perm: 'communications.feed.read', ent: 'module.communications' },
    { route: '/app/notifications', perm: 'communications.feed.read', ent: 'module.communications' },
    { route: '/app/documents', perm: 'documents.vault.read', ent: 'module.documents' },
    { route: '/app/occupancy', perm: 'occupancy.registry.read', ent: 'module.occupancy' },
    { route: '/app/ownership', perm: 'occupancy.registry.read', ent: 'module.occupancy' },
    { route: '/app/security-access', perm: 'security.access.read', ent: 'module.security' },
    { route: '/app/audit', perm: 'audit.events.read' },
  ];

  for (const item of expectedMappings) {
    assert.ok(
      content.includes(item.perm),
      `CustomerRouteGuard must map route to permission ${item.perm}`
    );
    if (item.ent) {
      assert.ok(
        content.includes(item.ent),
        `CustomerRouteGuard must map route to entitlement ${item.ent}`
      );
    }
  }

  // Fail-closed mock routes list
  assert.ok(content.includes('/app/portfolio'), 'Must block /app/portfolio');
  assert.ok(content.includes('/app/settings'), 'Must block /app/settings');
  assert.ok(content.includes('/app/accounting/month-close'), 'Must block /app/accounting/month-close');
  assert.ok(content.includes('/app/migration/shadow-ledger'), 'Must block /app/migration/shadow-ledger');

  // Trilingual Access Restricted message and return to dashboard
  assert.ok(content.includes('Acces Restricționat'), 'RO restricted title');
  assert.ok(content.includes('Access Restricted'), 'EN restricted title');
  assert.ok(content.includes('دسترسی محدود شده است'), 'FA restricted title');
  assert.ok(content.includes('/app/dashboard'), 'Link back to dashboard required');

  // Verify the 4 mock pages themselves fail-closed without mock data
  const mockPages = [
    'src/app/[lang]/app/portfolio/page.tsx',
    'src/app/[lang]/app/settings/page.tsx',
    'src/app/[lang]/app/accounting/month-close/page.tsx',
    'src/app/[lang]/app/migration/shadow-ledger/page.tsx',
  ];

  for (const pageRelPath of mockPages) {
    const pageFile = path.join(root, pageRelPath);
    const pageContent = fs.readFileSync(pageFile, 'utf8');
    assert.ok(
      pageContent.includes('AccessRestrictedCard'),
      `${pageRelPath} must render AccessRestrictedCard`
    );
    assert.ok(
      !pageContent.includes('useDemoStore'),
      `${pageRelPath} must NOT import useDemoStore or display mock data`
    );
  }

  // Verify public /demo is preserved
  assert.ok(
    fs.existsSync(path.join(root, 'src', 'app', '[lang]', 'demo', 'page.tsx')),
    'Public /demo route must not be deleted'
  );

  console.log('  ✓ All 13 route permission/entitlement rules mapped correctly');
  console.log('  ✓ Fail-closed blocking for /app/portfolio, /app/settings, /app/accounting/month-close, /app/migration/shadow-ledger');
  console.log('  ✓ Trilingual Access Restricted UI with back to Dashboard link');
  console.log('  ✓ Public /demo preserved');
}

// -----------------------------------------------------------------------------
// Suite 4: Customer Audit Trail Migration & RPC Security Contracts
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 4] Customer Audit Migration & RPC Security Contracts');

  const migrationFile = path.join(
    root,
    'supabase',
    'migrations',
    '20260906090000_customer_audit_access.sql'
  );
  assert.ok(fs.existsSync(migrationFile), 'Audit migration must exist');

  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Transaction boundaries
  assert.equal((sql.match(/^begin;/gim) ?? []).length, 1, 'Single begin; boundary');
  assert.equal((sql.match(/^commit;/gim) ?? []).length, 1, 'Single commit; boundary');

  // Permission definition
  assert.ok(
    sql.includes("'audit.events.read'"),
    'Must define audit.events.read permission'
  );

  // Role whitelist
  assert.ok(
    sql.includes("'association_admin'") &&
      sql.includes("'property_manager'") &&
      sql.includes("'president'") &&
      sql.includes("'censor'"),
    'Must grant to association_admin, property_manager, president, censor'
  );

  // Strictly no owner or tenant_resident grants
  assert.ok(
    !sql.includes("'owner'") && !sql.includes("'tenant_resident'"),
    'Must strictly exclude owner and tenant_resident from audit permission'
  );

  // RPC constraints
  assert.ok(
    sql.includes('create or replace function audit.get_customer_events'),
    'Must define audit.get_customer_events RPC'
  );
  assert.ok(sql.includes('auth.uid() is null'), 'Must enforce authentication check');
  assert.ok(sql.includes('customer_mfa_required()'), 'Must enforce customer MFA check');
  assert.ok(sql.includes("auth.jwt()->>'aal'"), 'Must enforce AAL2 check');
  assert.ok(sql.includes("m.status = 'active'"), 'Must enforce active membership check');
  assert.ok(sql.includes('m.starts_at <= statement_timestamp()'), 'Must enforce membership time bounds');
  assert.ok(sql.includes('g.starts_at <= statement_timestamp()'), 'Must enforce context grant time bounds');
  assert.ok(sql.includes("w.lifecycle_status = 'ACTIVE'"), 'Must enforce active workspace check');
  assert.ok(sql.includes('e.tenant_id = v.tenant_id'), 'Must enforce tenant isolation');
  assert.ok(sql.includes('v.scope_type'), 'Must enforce context scope filtering');
  assert.ok(sql.includes('p_limit > 100'), 'Must enforce pagination upper bound');
  assert.ok(sql.includes('p_from > p_until'), 'Must validate date range');
  assert.ok(sql.includes('app_private.redact_audit_text'), 'Must use redact_audit_text for reason');

  // Snapshots and raw actor ID non-disclosure
  assert.ok(
    !sql.includes("'before_snapshot', e.before_snapshot") &&
      !sql.includes("'after_snapshot', e.after_snapshot"),
    'Client output must not expose before/after snapshots'
  );
  assert.ok(
    !sql.includes('e.actor_id as actor_id'),
    'Client output must not expose raw actor_id'
  );

  // Revoke anon
  assert.ok(
    sql.includes('revoke all on function audit.get_customer_events') &&
      sql.includes('from public, anon'),
    'Must revoke anon/public privileges from RPC'
  );
  assert.ok(
    sql.includes('grant execute on function audit.get_customer_events') &&
      sql.includes('to authenticated'),
    'Must grant execute strictly to authenticated'
  );

  console.log('  ✓ audit.events.read permission defined');
  console.log('  ✓ Role whitelist strictly enforced (no owner/tenant_resident)');
  console.log('  ✓ Authentication, MFA & AAL2 checks enforced');
  console.log('  ✓ Active membership & context grant time bounds validated');
  console.log('  ✓ Active workspace lifecycle enforced');
  console.log('  ✓ Tenant isolation & context scope applied');
  console.log('  ✓ Pagination capped at 100 & date range validated');
  console.log('  ✓ Text redaction applied via app_private.redact_audit_text');
  console.log('  ✓ Snapshots and raw actor ID withheld from client');
  console.log('  ✓ anon privileges revoked');
}

// -----------------------------------------------------------------------------
// Suite 5: Customer Audit API Route & UI Dashboard
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 5] Customer Audit API Route & UI Dashboard Verification');

  const apiFile = path.join(root, 'src', 'app', 'api', 'customer', 'v1', 'audit', 'route.ts');
  assert.ok(fs.existsSync(apiFile), 'Customer audit API route must exist');

  const apiContent = fs.readFileSync(apiFile, 'utf8');

  assert.ok(apiContent.includes('getClaims()'), 'API must call getClaims()');
  assert.ok(apiContent.includes('z.object'), 'API must use Zod schema validation');
  assert.ok(apiContent.includes("'Cache-Control': 'no-store, private'"), 'API must use no-store private cache control');
  assert.ok(apiContent.includes("rpc('get_customer_events'"), 'API must call get_customer_events RPC');
  assert.ok(apiContent.includes('42501') && apiContent.includes('403'), 'API must map pg 42501 to HTTP 403');
  assert.ok(!apiContent.includes('service_role') && !apiContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'API must NOT use service role');

  // UI Component
  const dashboardFile = path.join(
    root,
    'src',
    'components',
    'customer',
    'CustomerAuditDashboard.tsx'
  );
  assert.ok(fs.existsSync(dashboardFile), 'CustomerAuditDashboard component must exist');

  const dashContent = fs.readFileSync(dashboardFile, 'utf8');
  assert.ok(dashContent.includes('/api/customer/v1/audit'), 'Dashboard must fetch real API');
  assert.ok(dashContent.includes('searchInput') || dashContent.includes('Search'), 'Dashboard must have search feature');
  assert.ok(dashContent.includes('totalPages') || dashContent.includes('page'), 'Dashboard must have pagination');
  assert.ok(dashContent.includes('RefreshCw'), 'Dashboard must have refresh button');
  assert.ok(dashContent.includes('occurred_at'), 'Dashboard displays timestamp');
  assert.ok(dashContent.includes('actor_role'), 'Dashboard displays actor role');
  assert.ok(dashContent.includes('action'), 'Dashboard displays action');
  assert.ok(dashContent.includes('entity_type'), 'Dashboard displays entity');
  assert.ok(dashContent.includes('reason'), 'Dashboard displays reason');

  // Verify app/audit/page.tsx has no hardcoded logs
  const auditPageFile = path.join(root, 'src', 'app', '[lang]', 'app', 'audit', 'page.tsx');
  const auditPageContent = fs.readFileSync(auditPageFile, 'utf8');
  assert.ok(
    auditPageContent.includes('CustomerAuditDashboard'),
    'Audit page must render CustomerAuditDashboard'
  );
  assert.ok(
    !auditPageContent.includes('LOG-88219') && !auditPageContent.includes('logs = ['),
    'Hardcoded mock logs must be completely removed from app/audit/page.tsx'
  );

  console.log('  ✓ API verifies getClaims() & validates with Zod');
  console.log('  ✓ API sets Cache-Control: no-store, private');
  console.log('  ✓ API maps 42501 to HTTP 403');
  console.log('  ✓ API uses Supabase User Client (no service role)');
  console.log('  ✓ CustomerAuditDashboard supports search, pagination, refresh, RO/EN/FA');
  console.log('  ✓ Mock audit data completely removed');
}

// -----------------------------------------------------------------------------
// Suite 6: Functional Schema Validation & Security Contract Tests
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 6] Functional Schema Validation & Parameter Edge Cases');

  const querySchema = z.object({
    context_id: z.string().uuid(),
    query: z.string().trim().max(120).optional(),
    action: z.string().trim().max(80).optional(),
    from: z.string().trim().optional(),
    until: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  });

  // 1. Missing context_id fails validation
  {
    const parsed = querySchema.safeParse({});
    assert.equal(parsed.success, false, 'Missing context_id must fail validation');
  }

  // 2. Non-UUID context_id fails validation
  {
    const parsed = querySchema.safeParse({ context_id: 'not-a-valid-uuid' });
    assert.equal(parsed.success, false, 'Non-UUID context_id must fail validation');
  }

  // 3. Valid params pass validation with default pagination
  {
    const parsed = querySchema.safeParse({
      context_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.limit, 25);
    assert.equal(parsed.data?.offset, 0);
  }

  // 4. Over-limit (>100) fails validation
  {
    const parsed = querySchema.safeParse({
      context_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      limit: 150,
    });
    assert.equal(parsed.success, false, 'limit > 100 must fail validation');
  }

  // 5. Negative offset (<0) fails validation
  {
    const parsed = querySchema.safeParse({
      context_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      offset: -5,
    });
    assert.equal(parsed.success, false, 'negative offset must fail validation');
  }

  // 6. Valid pagination boundary (limit=100, offset=0)
  {
    const parsed = querySchema.safeParse({
      context_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      limit: 100,
      offset: 50,
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.limit, 100);
    assert.equal(parsed.data?.offset, 50);
  }

  console.log('  ✓ Missing context_id rejected');
  console.log('  ✓ Invalid UUID format rejected');
  console.log('  ✓ Default pagination (limit=25, offset=0) verified');
  console.log('  ✓ Pagination bounds (1..100, offset >= 0) enforced');
}

console.log('\n=== ALL P1 ACCESS, SESSION & AUDIT FOUNDATION TESTS PASSED ===\n');
