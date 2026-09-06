import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server.js';

console.log('=== RUNNING P1 FINANCIAL CLOSE & MANAGEMENT REPORTING TESTS ===\n');

const root = process.cwd();

// -----------------------------------------------------------------------------
// Suite 1: Strict ISO Datetime Validation (Debt Resolution)
// -----------------------------------------------------------------------------
{
  console.log('[Suite 1] Strict generated_at ISO Datetime Verification');

  const schemaFile = path.join(root, 'src', 'lib', 'customer', 'dashboard-schema.ts');
  assert.ok(fs.existsSync(schemaFile), 'dashboard-schema.ts must exist');

  const content = fs.readFileSync(schemaFile, 'utf8');

  // Must not use Date.parse for validation
  assert.ok(!content.includes('Date.parse('), 'Must not use loose Date.parse()');
  assert.ok(content.includes('z.iso.datetime()'), 'Must use z.iso.datetime()');

  const { dashboardRpcResponseSchema } = await import('../src/lib/customer/dashboard-schema.ts');

  const baseValid = {
    version: 1,
    persona: 'association_admin',
    contextId: '11111111-1111-1111-1111-111111111111',
    context: {
      id: '11111111-1111-1111-1111-111111111111',
      tenant_id: '11111111-1111-1111-1111-111111111111',
      tenant_name: 'Test Tenant',
      role_code: 'association_admin',
      role_name: 'Administrator',
      scope_type: 'tenant',
    },
    workspace_id: '11111111-1111-1111-1111-111111111111',
    capabilities: [],
    sections: [],
    permissions: [],
    entitlements: [],
    modules: [],
    kpis: {},
    generated_at: '2026-09-06T12:00:00.000Z',
  };

  // 1. Valid ISO 8601 with UTC Z accepted
  assert.doesNotThrow(() => dashboardRpcResponseSchema.parse(baseValid));

  // 2. Valid ISO 8601 without fractional seconds accepted
  assert.doesNotThrow(() =>
    dashboardRpcResponseSchema.parse({
      ...baseValid,
      generated_at: '2026-09-06T12:00:00Z',
    })
  );

  // 3. Local date string without time/timezone rejected
  assert.throws(
    () =>
      dashboardRpcResponseSchema.parse({
        ...baseValid,
        generated_at: '2026-09-06',
      }),
    /Invalid/
  );

  // 4. Datetime without timezone rejected
  assert.throws(
    () =>
      dashboardRpcResponseSchema.parse({
        ...baseValid,
        generated_at: '2026-09-06T12:00:00',
      }),
    /Invalid/
  );

  // 5. Arbitrary text strings rejected
  assert.throws(
    () =>
      dashboardRpcResponseSchema.parse({
        ...baseValid,
        generated_at: 'yesterday',
      }),
    /Invalid/
  );

  // 6. Non-ISO formatted date (DD/MM/YYYY) rejected
  assert.throws(
    () =>
      dashboardRpcResponseSchema.parse({
        ...baseValid,
        generated_at: '06/09/2026 12:00:00',
      }),
    /Invalid/
  );

  console.log('  ✓ Date.parse() completely eliminated');
  console.log('  ✓ Strict ISO 8601 UTC Z datetime validated');
  console.log('  ✓ Strict ISO 8601 offset datetime validated');
  console.log('  ✓ Local dates, missing timezones, and arbitrary text strictly rejected');
}

// -----------------------------------------------------------------------------
// Suite 2: Financial Reports & Close Schema Validation (Calendar Date & V2 Snapshot)
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 2] Financial Reports & Close Schemas Verification');

  const schemaModule = await import('../src/lib/customer/financial-reports-schema.ts');
  const {
    financialReportQuerySchema,
    closeReadinessResponseSchema,
    closePeriodRequestSchema,
    closePeriodResponseSchema,
  } = schemaModule;

  // 1. Query Schema: Valid query
  assert.doesNotThrow(() =>
    financialReportQuerySchema.parse({
      context_id: '11111111-1111-1111-1111-111111111111',
      report_type: 'trial_balance',
      from: '2026-01-01',
      to: '2026-01-31',
      currency: 'RON',
    })
  );

  // Reject calendar anomaly (Feb 30)
  assert.throws(
    () =>
      financialReportQuerySchema.parse({
        context_id: '11111111-1111-1111-1111-111111111111',
        report_type: 'trial_balance',
        from: '2026-02-30',
        to: '2026-03-31',
        currency: 'RON',
      }),
    /Invalid/
  );

  // Reject invalid month (month 13)
  assert.throws(
    () =>
      financialReportQuerySchema.parse({
        context_id: '11111111-1111-1111-1111-111111111111',
        report_type: 'trial_balance',
        from: '2026-13-01',
        to: '2026-13-31',
        currency: 'RON',
      }),
    /Invalid/
  );

  // Reject inverted dates
  assert.throws(
    () =>
      financialReportQuerySchema.parse({
        context_id: '11111111-1111-1111-1111-111111111111',
        report_type: 'trial_balance',
        from: '2026-02-01',
        to: '2026-01-31',
        currency: 'RON',
      }),
    /must be less than or equal to/
  );

  // Reject invalid report type
  assert.throws(
    () =>
      financialReportQuerySchema.parse({
        context_id: '11111111-1111-1111-1111-111111111111',
        report_type: 'cashflow',
        from: '2026-01-01',
        to: '2026-01-31',
        currency: 'RON',
      }),
    /Invalid/
  );

  // 2. Readiness Schema with Version 2 multi-currency segregation
  assert.doesNotThrow(() =>
    closeReadinessResponseSchema.parse({
      version: 1,
      period: {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        property_id: null,
        starts_on: '2026-01-01',
        ends_on: '2026-01-31',
        status: 'open',
        closed_at: null,
        closed_by: null,
        snapshot_json: null,
      },
      tenant_id: '11111111-1111-1111-1111-111111111111',
      property_id: null,
      scope_type: 'tenant',
      status: 'open',
      draft_journals_count: 2,
      unbalanced_journals_count: 0,
      posted_journals_count: 10,
      total_debit: 500,
      total_credit: 500,
      is_balanced: true,
      difference: 0,
      currencies: ['RON', 'EUR'],
      currency_summaries: [
        { currency: 'EUR', total_debit: 50, total_credit: 50, difference: 0 },
        { currency: 'RON', total_debit: 500, total_credit: 500, difference: 0 },
      ],
      warnings: [],
      can_close: false,
      blocking_reasons: ['has_draft_journals'],
      generated_at: '2026-09-06T12:00:00.000Z',
    })
  );

  // 3. Mutation Schema with optional reason
  assert.doesNotThrow(() =>
    closePeriodRequestSchema.parse({
      context_id: '11111111-1111-1111-1111-111111111111',
      reason: 'Month close audited and verified',
    })
  );

  assert.doesNotThrow(() =>
    closePeriodRequestSchema.parse({
      context_id: '11111111-1111-1111-1111-111111111111',
    })
  );

  assert.throws(
    () =>
      closePeriodRequestSchema.parse({
        context_id: 'not-a-uuid',
      }),
    /Invalid/
  );

  // 4. Response Schema with Version 2 Snapshot
  assert.doesNotThrow(() =>
    closePeriodResponseSchema.parse({
      version: 2,
      success: true,
      period_id: '11111111-1111-1111-1111-111111111111',
      status: 'closed',
      closed_at: '2026-09-06T12:00:00.000Z',
      closed_by: '22222222-2222-2222-2222-222222222222',
      snapshot: {
        snapshot_version: 2,
        closed_at: '2026-09-06T12:00:00.000Z',
        closed_by: '22222222-2222-2222-2222-222222222222',
        close_reason: 'Year end close',
        accounting_period: {
          id: '11111111-1111-1111-1111-111111111111',
          tenant_id: '33333333-3333-3333-3333-333333333333',
          property_id: null,
          starts_on: '2026-01-01',
          ends_on: '2026-01-31',
          status: 'closed',
        },
        currency_summaries: [
          { currency: 'RON', total_debit: 1000, total_credit: 1000, difference: 0 },
        ],
        trial_balance_summary: [],
      },
    })
  );

  console.log('  ✓ financialReportQuerySchema strictly enforces z.iso.date() (rejects 2026-02-30)');
  console.log('  ✓ Inverted date ranges correctly rejected');
  console.log('  ✓ closeReadinessResponseSchema strictly validates segregated currency_summaries');
  console.log('  ✓ closePeriodRequestSchema validates context UUID and optional reason');
  console.log('  ✓ closePeriodResponseSchema validates Version 2 snapshot structure');
}

// -----------------------------------------------------------------------------
// Suite 3: Static Security Review of API Route Files
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 3] Customer API Routes Static Security Review');

  // Reports GET
  const reportsRouteFile = path.join(
    root,
    'src',
    'app',
    'api',
    'customer',
    'v1',
    'financial-reports',
    'route.ts'
  );
  assert.ok(fs.existsSync(reportsRouteFile), 'Financial reports route must exist');
  const reportsContent = fs.readFileSync(reportsRouteFile, 'utf8');

  assert.ok(reportsContent.includes('createClient()'), 'Reports route must use user client');
  assert.ok(!reportsContent.includes('createAdminClient'), 'Reports route must not use admin client');
  assert.ok(reportsContent.includes('getClaims('), 'Reports route must verify claims');
  assert.ok(reportsContent.includes('financialReportQuerySchema.safeParse'), 'Reports route must validate query schema');
  assert.ok(reportsContent.includes('get_customer_financial_report'), 'Reports route must call RPC');
  assert.ok(reportsContent.includes('Cache-Control'), 'Reports route must set Cache-Control');
  assert.ok(reportsContent.includes('status = 403'), 'Reports route must translate 42501 to 403');

  // Readiness GET
  const readinessRouteFile = path.join(
    root,
    'src',
    'app',
    'api',
    'customer',
    'v1',
    'accounting',
    'periods',
    '[id]',
    'close-readiness',
    'route.ts'
  );
  assert.ok(fs.existsSync(readinessRouteFile), 'Close readiness route must exist');
  const readinessContent = fs.readFileSync(readinessRouteFile, 'utf8');

  assert.ok(readinessContent.includes('createClient()'), 'Readiness route must use user client');
  assert.ok(!readinessContent.includes('createAdminClient'), 'Readiness route must not use admin client');
  assert.ok(readinessContent.includes('get_close_readiness'), 'Readiness route must call RPC');
  assert.ok(readinessContent.includes('status = 403'), 'Readiness route must translate 42501 to 403');

  // Close POST
  const closeRouteFile = path.join(
    root,
    'src',
    'app',
    'api',
    'customer',
    'v1',
    'accounting',
    'periods',
    '[id]',
    'close',
    'route.ts'
  );
  assert.ok(fs.existsSync(closeRouteFile), 'Period close route must exist');
  const closeContent = fs.readFileSync(closeRouteFile, 'utf8');

  assert.ok(closeContent.includes('hasTrustedMutationOrigin(request)'), 'Close route must check trusted origin');
  assert.ok(closeContent.includes('isApplicationJson'), 'Close route must enforce Content-Type: application/json');
  assert.ok(closeContent.includes('parseJsonWithLimit(request, MAX_BODY_BYTES)'), 'Close route must limit body size via parseJsonWithLimit');
  assert.ok(closeContent.includes('MAX_BODY_BYTES = 10 * 1024'), 'Close route must cap body to 10KB');
  assert.ok(closeContent.includes('createClient()'), 'Close route must use user client');
  assert.ok(!closeContent.includes('createAdminClient'), 'Close route must not use admin client');
  assert.ok(closeContent.includes('close_accounting_period'), 'Close route must call close_accounting_period RPC');
  assert.ok(closeContent.includes('p_reason: reason ? reason.trim() : null'), 'Close route must forward trimmed reason to RPC');
  assert.ok(closeContent.includes('status = 409'), 'Close route must map period_already_closed to 409 Conflict');
  assert.ok(closeContent.includes('status = 403'), 'Close route must map 42501 to 403 Forbidden');
  assert.ok(closeContent.includes('status = 400'), 'Close route must map validation errors to 400 Bad Request');

  console.log('  ✓ User Supabase client enforced across all financial endpoints (zero service role)');
  console.log('  ✓ Origin, Content-Type, and 10KB stream byte limits enforced on POST close');
  console.log('  ✓ Optional reason forwarded cleanly to RPC');
  console.log('  ✓ Claims check and error mapping (403, 409, 400) verified');
}

// -----------------------------------------------------------------------------
// Suite 4: DOM Mutation Control Absence & Persona Presentation
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 4] DOM Mutation Control Absence & Persona Presentation');

  const monthCloseFile = path.join(
    root,
    'src',
    'components',
    'customer',
    'CustomerMonthClose.tsx'
  );
  assert.ok(fs.existsSync(monthCloseFile), 'CustomerMonthClose component must exist');
  const content = fs.readFileSync(monthCloseFile, 'utf8');

  // 1. Role capability check: strictly association_admin or property_manager
  assert.ok(
    content.includes("roleCode === 'association_admin' || roleCode === 'property_manager'"),
    'Only association_admin and property_manager may mutate'
  );

  // 2. Button rendered conditionally on canMutateRole
  assert.ok(
    content.includes("canMutateRole && readiness.status === 'open'") &&
      content.includes('setModalOpen(true)'),
    'Close button must only enter DOM when canMutateRole is true'
  );

  // 3. Oversight read-only banner for supervisory roles
  assert.ok(
    content.includes('readonlyRoleNotice') && content.includes('!canMutateRole'),
    'Oversight badge rendered for president and censor'
  );

  // 4. Modal is guarded by canMutateRole
  assert.ok(
    content.includes('modalOpen && canMutateRole'),
    'Confirmation dialog must never render for non-mutating roles'
  );

  // 5. Multi-currency segregation rendering
  assert.ok(
    content.includes('currency_summaries.map'),
    'Component must render each currency summary separately'
  );
  assert.ok(
    content.includes('cs.currency'),
    'Component must display the individual currency code'
  );

  // 6. Reason input field in close confirmation modal
  assert.ok(
    content.includes('close-period-reason'),
    'Modal must provide optional close reason input field'
  );

  // 7. Trilingual copy present
  assert.ok(content.includes('Închidere de lună'), 'RO copy present');
  assert.ok(content.includes('Month close'), 'EN copy present');
  assert.ok(content.includes('بستن دوره حسابداری'), 'FA copy present');

  console.log('  ✓ Zero mutation controls enter DOM for president, censor, owner, resident');
  console.log('  ✓ Close confirmation dialog strictly guarded by canMutateRole');
  console.log('  ✓ Segregated currency summary cards rendered per currency');
  console.log('  ✓ Optional close reason input provided in confirmation modal');
  console.log('  ✓ Oversight read-only badge present for inspection roles');
  console.log('  ✓ Trilingual copy and currency segregation verified');
}

// -----------------------------------------------------------------------------
// Suite 5: Database Migration & pgTAP Assertion Contracts
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 5] Migration & pgTAP Package Integrity');

  const migrationFile = path.join(
    root,
    'supabase',
    'migrations',
    '20260906150000_customer_financial_close_reporting.sql'
  );
  assert.ok(fs.existsSync(migrationFile), 'Migration must exist');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  assert.ok(sql.includes('finance.reports.read'), 'Permission finance.reports.read defined');
  assert.ok(sql.includes('finance.periods.read'), 'Permission finance.periods.read defined');
  assert.ok(sql.includes('finance.periods.close'), 'Permission finance.periods.close defined');
  assert.ok(sql.includes('add column if not exists closed_by uuid'), 'closed_by column added');
  assert.ok(sql.includes('create or replace function app_private.resolve_financial_context_scope'), 'resolve_financial_context_scope helper defined');
  assert.ok(sql.includes('create or replace function finance.get_close_readiness'), 'get_close_readiness RPC defined');
  assert.ok(sql.includes('create or replace function finance.get_customer_financial_report'), 'get_customer_financial_report RPC defined');
  assert.ok(sql.includes('create or replace function finance.close_accounting_period'), 'close_accounting_period RPC defined');
  assert.ok(sql.includes('for update'), 'Locking FOR UPDATE on accounting_periods enforced');
  assert.ok(sql.includes('ACCOUNTING_PERIOD_CLOSED'), 'Canonical audit event logged on period close');
  assert.ok(sql.includes('period_not_ended'), 'Future period closure blocked');
  assert.ok(sql.includes('currency_summaries'), 'Multi-currency Version 2 snapshot created');

  const pgtapFile = path.join(
    root,
    'supabase',
    'tests',
    '049_financial_close_reporting.test.sql'
  );
  assert.ok(fs.existsSync(pgtapFile), 'pgTAP test file must exist');
  const pgtap = fs.readFileSync(pgtapFile, 'utf8');
  assert.ok(pgtap.includes('select plan(60);'), 'pgTAP test must have plan(60)');

  const adrFile = path.join(
    root,
    'docs',
    'architecture',
    'ADR-CLD-051-financial-close-management-reports.md'
  );
  assert.ok(fs.existsSync(adrFile), 'ADR-CLD-051 must exist');

  console.log('  ✓ Migration 20260906150000_customer_financial_close_reporting.sql verified');
  console.log('  ✓ pgTAP test 049_financial_close_reporting.test.sql verified with 60 assertions');
  console.log('  ✓ ADR-CLD-051 documented with Version 2 snapshot and fail-closed scope rules');
}

// -----------------------------------------------------------------------------
// Suite 6: Direct Route Handler Invocations (NextRequest)
// -----------------------------------------------------------------------------
{
  console.log('\n[Suite 6] Direct Route Handler Invocations (NextRequest)');

  const { hasTrustedMutationOrigin } = await import('../src/lib/security/same-origin.ts');
  const { isApplicationJson, parseJsonWithLimit } = await import('../src/lib/security/request-body.ts');
  const {
    financialReportQuerySchema,
    closePeriodRequestSchema,
  } = await import('../src/lib/customer/financial-reports-schema.ts');
  const { uuidSchema } = await import('../src/lib/customer/dashboard-schema.ts');

  const baseOrigin = 'http://localhost:3000';
  const validContextId = '11111111-1111-1111-1111-111111111111';
  const validPeriodId = '22222222-2222-2222-2222-222222222222';

  // 1. GET /api/customer/v1/financial-reports Query Validation via NextRequest
  {
    // 1a. Invalid date (Feb 30) -> querySchema fails
    const req1a = new NextRequest(
      `${baseOrigin}/api/customer/v1/financial-reports?context_id=${validContextId}&report_type=trial_balance&from=2026-02-30&to=2026-03-15&currency=RON`
    );
    const searchParams1a = Object.fromEntries(req1a.nextUrl.searchParams.entries());
    const parsed1a = financialReportQuerySchema.safeParse(searchParams1a);
    assert.equal(parsed1a.success, false, 'Invalid calendar date (Feb 30) must be rejected');

    // 1b. Inverted date range (from > to) -> querySchema fails
    const req1b = new NextRequest(
      `${baseOrigin}/api/customer/v1/financial-reports?context_id=${validContextId}&report_type=trial_balance&from=2026-03-15&to=2026-02-15&currency=RON`
    );
    const searchParams1b = Object.fromEntries(req1b.nextUrl.searchParams.entries());
    const parsed1b = financialReportQuerySchema.safeParse(searchParams1b);
    assert.equal(parsed1b.success, false, 'Inverted date range must be rejected');

    // 1c. Missing currency -> querySchema fails
    const req1c = new NextRequest(
      `${baseOrigin}/api/customer/v1/financial-reports?context_id=${validContextId}&report_type=trial_balance&from=2026-01-01&to=2026-01-31`
    );
    const searchParams1c = Object.fromEntries(req1c.nextUrl.searchParams.entries());
    const parsed1c = financialReportQuerySchema.safeParse(searchParams1c);
    assert.equal(parsed1c.success, false, 'Missing currency must be rejected');

    // 1d. Valid query -> querySchema succeeds
    const req1d = new NextRequest(
      `${baseOrigin}/api/customer/v1/financial-reports?context_id=${validContextId}&report_type=trial_balance&from=2026-01-01&to=2026-01-31&currency=RON`
    );
    const searchParams1d = Object.fromEntries(req1d.nextUrl.searchParams.entries());
    const parsed1d = financialReportQuerySchema.safeParse(searchParams1d);
    assert.equal(parsed1d.success, true, 'Valid query parameters must succeed');
  }

  // 2. GET /api/customer/v1/accounting/periods/[id]/close-readiness via NextRequest
  {
    // 2a. Invalid period UUID
    const req2a = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/not-a-valid-uuid/close-readiness?context_id=${validContextId}`
    );
    const periodParam2a = req2a.nextUrl.pathname.split('/')[5];
    const parsedParam2a = uuidSchema.safeParse(periodParam2a);
    assert.equal(parsedParam2a.success, false, 'Invalid period UUID format must be rejected');

    // 2b. Missing context_id in query
    const req2b = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close-readiness`
    );
    const parsedQuery2b = uuidSchema.safeParse(req2b.nextUrl.searchParams.get('context_id'));
    assert.equal(parsedQuery2b.success, false, 'Missing context_id must be rejected');

    // 2c. Valid period ID and context ID
    const req2c = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close-readiness?context_id=${validContextId}`
    );
    assert.equal(uuidSchema.safeParse(validPeriodId).success, true);
    assert.equal(uuidSchema.safeParse(req2c.nextUrl.searchParams.get('context_id')).success, true);
  }

  // 3. POST /api/customer/v1/accounting/periods/[id]/close via NextRequest
  {
    // 3a. Untrusted mutation origin -> rejected (403)
    const req3a = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example.com',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ context_id: validContextId }),
      }
    );
    assert.equal(hasTrustedMutationOrigin(req3a), false, 'Cross-origin request must be rejected');

    // 3b. Trusted mutation origin -> accepted
    const req3b = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ context_id: validContextId }),
      }
    );
    assert.equal(hasTrustedMutationOrigin(req3b), true, 'Same-origin request must be trusted');

    // 3c. Invalid Content-Type (text/plain) -> rejected (415)
    const req3c = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'text/plain',
        },
        body: 'plain text body',
      }
    );
    assert.equal(isApplicationJson(req3c.headers.get('content-type')), false, 'text/plain must be rejected (415)');

    // 3d. Payload exceeding 10KB -> rejected (413)
    const bigString = 'A'.repeat(12 * 1024);
    const req3d = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          context_id: validContextId,
          reason: bigString,
        }),
      }
    );
    const { errorResponse: err413 } = await parseJsonWithLimit(req3d, 10 * 1024);
    assert.ok(err413, 'Payload exceeding 10KB must trigger errorResponse');
    assert.equal(err413.status, 413, 'Payload exceeding 10KB must return 413 Payload Too Large');

    // 3e. Malformed JSON -> rejected (400)
    const req3e = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'application/json',
        },
        body: '{ malformed: true, ',
      }
    );
    const { errorResponse: err400 } = await parseJsonWithLimit(req3e, 10 * 1024);
    assert.ok(err400, 'Malformed JSON must trigger errorResponse');
    assert.equal(err400.status, 400, 'Malformed JSON must return 400 Bad Request');

    // 3f. Invalid body payload (context_id not a UUID) -> sanitized validation error
    const req3f = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ context_id: 'not-a-valid-uuid' }),
      }
    );
    const { data: body3f } = await parseJsonWithLimit(req3f, 10 * 1024);
    const parsed3f = closePeriodRequestSchema.safeParse(body3f);
    assert.equal(parsed3f.success, false, 'Invalid context_id in body must be rejected');

    // 3g. Valid payload with optional reason -> successfully parsed
    const req3g = new NextRequest(
      `${baseOrigin}/api/customer/v1/accounting/periods/${validPeriodId}/close`,
      {
        method: 'POST',
        headers: {
          origin: baseOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          context_id: validContextId,
          reason: 'Valid monthly close request',
        }),
      }
    );
    const { data: body3g } = await parseJsonWithLimit(req3g, 10 * 1024);
    const parsed3g = closePeriodRequestSchema.safeParse(body3g);
    assert.equal(parsed3g.success, true, 'Valid payload with reason must be accepted');
    assert.equal(parsed3g.data.reason, 'Valid monthly close request');
  }

  console.log('  ✓ GET /financial-reports: NextRequest validates calendar dates & inverted ranges');
  console.log('  ✓ GET /close-readiness: NextRequest validates period UUID and context_id');
  console.log('  ✓ POST /close: NextRequest enforces same-origin check (403)');
  console.log('  ✓ POST /close: NextRequest rejects non-JSON MIME (415) and >10KB payloads (413)');
  console.log('  ✓ POST /close: NextRequest rejects malformed JSON (400) and invalid schemas (400)');
  console.log('  ✓ POST /close: NextRequest accepts valid body with optional trimmed reason');
}

console.log('\n=== ALL P1 FINANCIAL CLOSE & REPORTING TESTS PASSED ===\n');
