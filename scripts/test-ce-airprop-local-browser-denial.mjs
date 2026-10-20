import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import {
  browserInputs, browserContextOptions, configureBrowserContext, closeBrowserResources,
} from './test-pf01-owner-portfolio-local-browser.mjs';
import {
  withVerifiedPf01LocalTarget, assertPf01NoDotenv, localProjectRef,
  pf01FreeLoopbackPort, pf01PortIsLive, createPf01Aal2User,
  createPf01DatabaseFixture, snapshotPf01ReadState, cleanupPf01Users,
  startPf01BrowserNextApp,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

export const SUITE = 'CE-AIRPROP-LOCAL-BROWSER-DISCOVERY-DENIAL-01';
export const executeVerifiedDenial = (options, consume) => withVerifiedPf01LocalTarget(options, consume);
const UI = {
  ro: { title: 'Workspace AIRPROP', choose: 'Alege workspace-ul', context: 'Context activ' },
  en: { title: 'AIRPROP workspace', choose: 'Choose workspace', context: 'Active context' },
  fa: { title: 'ورک‌اسپیس AIRPROP', choose: 'انتخاب ورک‌اسپیس', context: 'زمینه فعال' },
};

// Consume only the real session returned by Core; never construct Auth tokens.
export function sessionCookies(cookie, origin) {
  browserContextOptions(origin, 'en');
  return cookie.split('; ').map(pair => {
    const i = pair.indexOf('=');
    if (i < 1 || !/^sb-[a-zA-Z0-9_.-]+$/.test(pair.slice(0, i))) throw new Error('ce_fixture_cookie_format_rejected');
    return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin, sameSite: 'Lax' };
  });
}

async function readState(pool) {
  const state = await snapshotPf01ReadState(pool);
  // The accepted shared snapshot covers authority/audit/idempotency. Also observe
  // the actual Opportunity store consumed by this new read-only browser slice.
  const { rows } = await pool.query(`select count(*)::int as count,
    coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'') as canonical
    from airprop.investment_opportunities t`);
  return { ...state, 'airprop.investment_opportunities': { count: rows[0].count,
    sha256: createHash('sha256').update(rows[0].canonical).digest('hex') } };
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pathOf = response => new URL(response.url()).pathname;
async function readInBrowser(page, path) {
  return page.evaluate(async path => {
    const response = await fetch(path, { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  }, path);
}
export function requireError(result, status, code) {
  assert.equal(result.status, status, 'unexpected HTTP status is not an authorization PASS');
  assert.equal(result.body?.error?.code, code, 'unexpected backend code is not an authorization PASS');
}

export async function runDenialProof() {
  let phase = 'preflight'; let browser = null; let next = null; let pool = null;
  const contexts = new Set(); const users = []; const blockers = new Set();
  const errorReads = []; const httpErrors = new Map();
  const stats = { readMethods: {}, authMethods: {}, domainMutationRequests: 0,
    remoteBackend: 0, externalRequests: 0, contexts: 0 };
  const receipt = { suite: SUITE,
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    browser: 'NOT_RUN_NOT_PASS', locales: 0, scenarios: 0, findings: [],
    product_limitations: ['WORKSPACE_CANONICAL_NAME_UNAVAILABLE'],
    positive_commercial_e2e: 'NOT_RUN_NOT_PASS', hosted_preview_e2e: 'NOT_RUN_NOT_PASS', release: 'NOT_RUN_NOT_PASS' };
  const cancellation = new AbortController(); const cancel = () => cancellation.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const port = await pf01FreeLoopbackPort(); const origin = `http://127.0.0.1:${port}`;
    const inputs = browserInputs(process.env, origin, await localProjectRef());
    const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const adminClient = createClient(inputs.supabaseUrl, inputs.serviceRoleKey, clientOptions);
    const actorClient = createClient(inputs.supabaseUrl, inputs.anonKey, clientOptions);
    pool = new Pool({ connectionString: inputs.databaseUrl, max: 4 });
    await executeVerifiedDenial({ ...inputs, pool, adminClient, actorClient }, async () => {
      await assertPf01NoDotenv();
      receipt.identity = 'VERIFIED_LOCAL_AUTH_DB_STACK_BEFORE_AUTH_WRITES_OR_BROWSER';
      phase = 'chromium'; browser = await chromium.launch({ headless: true }); receipt.browser = browser.version();
      phase = 'fixture';
      const onCreated = user => users.push(user);
      const owner = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'ce-discovery-owner', onCreated });
      const other = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'ce-discovery-other', onCreated });
      const fixture = await createPf01DatabaseFixture(pool, {
        ownerUserId: owner.userId, otherUserId: other.userId, ownerEmail: owner.email, otherEmail: other.email,
      });
      // Read the fixture's actual native scope, not its label or expired property mandate.
      const native = await pool.query(`select w.id, w.tenant_id=g.tenant_id as same_tenant,
        wr.lifecycle_status='published' and wr.valid_from<=statement_timestamp()
        and (wr.valid_to is null or wr.valid_to>statement_timestamp())
        and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp()) as current_assignment
        from identity.context_grants g join platform.workspace_member_roles a on a.membership_id=g.membership_id
        join platform.workspace_roles wr on wr.id=a.workspace_role_id
        join platform.customer_workspaces w on w.id=a.customer_workspace_id
        where g.id=$1 and w.lifecycle_status='ACTIVE'`, [fixture.context]);
      phase = 'next'; next = await startPf01BrowserNextApp({ port, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, signal: cancellation.signal });
      const open = async (locale, cookie) => {
        const context = await browser.newContext(browserContextOptions(origin, locale));
        contexts.add(context); stats.contexts += 1;
        context.on('response', response => {
          const url = new URL(response.url());
          if (url.origin !== origin || !url.pathname.startsWith('/api/') || response.status() < 400) return;
          if (response.status() >= 500) blockers.add('UNEXPECTED_API_SERVER_ERROR');
          errorReads.push((async () => {
            let code = 'ERROR_BODY_UNAVAILABLE';
            try {
              const body = await response.json();
              if (typeof body?.error?.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(body.error.code)) code = body.error.code;
            } catch { /* Record a bounded classification, never a raw body. */ }
            const item = { path: url.pathname, status: response.status(), code };
            httpErrors.set(JSON.stringify(item), item);
          })());
        });
        await configureBrowserContext(context, { origin, supabaseUrl: inputs.supabaseUrl, stats });
        if (cookie) await context.addCookies(sessionCookies(cookie, origin));
        return context;
      };
      const close = async context => { await context.close(); contexts.delete(context); };
      const before = await readState(pool); receipt.before_read_sha256 = fingerprint(before);
      receipt.observed_tables = Object.keys(before).length;
      for (const [locale, text] of Object.entries(UI)) {
        phase = `${locale}-anonymous`;
        const anonymous = await open(locale); const anonymousPage = await anonymous.newPage();
        await anonymousPage.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await expect(anonymousPage).toHaveURL(new RegExp(`/${locale}/login(?:[?]|$)`));
        await close(anonymous); receipt.scenarios += 1;

        phase = `${locale}-owner-discovery`;
        const context = await open(locale, owner.cookie); const page = await context.newPage();
        const routeResponse = await page.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        assert.equal(routeResponse.status(), 200);
        assert.equal(new URL(page.url()).pathname, `/${locale}/app/airprop`);
        const contextSelector = page.locator('header select');
        await expect(contextSelector.locator(`option[value="${fixture.context}"]`)).toHaveCount(1, { timeout: 60_000 });
        await contextSelector.selectOption(fixture.context);
        await expect(page.getByRole('heading', { level: 1, name: text.title, exact: true })).toBeVisible({ timeout: 60_000 });
        const targets = await readInBrowser(page, `/api/customer/v1/workspace/targets?context_id=${fixture.context}`);
        assert.equal(targets.status, 200, 'target setup/runtime failure is not expected denial');
        assert.ok(Array.isArray(targets.body.workspaces));
        const discovered = targets.body.workspaces.map(x => x.workspace_id).sort();
        const expected = [fixture.workspaceOne, fixture.workspaceTwo].sort();
        const canonical = native.rows.filter(x => x.same_tenant && x.current_assignment).map(x => x.id).sort();
        assert.deepEqual(discovered, canonical, 'discovery must match actual current native fixture assignments');
        if (JSON.stringify(discovered) !== JSON.stringify(expected)) blockers.add('FIXTURE_DISCOVERY_NOT_EXACTLY_TWO_EXPECTED_WORKSPACES');
        if (discovered.includes(fixture.expiredWorkspace)) blockers.add('EXPIRED_MANAGEMENT_WORKSPACE_RETAINS_CURRENT_NATIVE_ASSIGNMENT');
        assert.ok(expected.every(id => discovered.includes(id)), 'required valid targets missing');
        assert.ok(native.rows.every(row => row.same_tenant), 'no cross-tenant target in returned fixture scope');
        receipt.findings.push({ locale, targets_status: targets.status, discovered_count: discovered.length,
          expected_count: 2, matches_current_native_scope: true,
          expired_management_target_excluded: !discovered.includes(fixture.expiredWorkspace) });
        const selector = page.getByRole('combobox', { name: text.choose, exact: true });
        await expect(selector).toBeVisible();
        assert.deepEqual((await selector.locator('option').evaluateAll(options => options.map(o => o.value))).filter(Boolean).sort(), discovered);
        for (const workspace of [fixture.workspaceOne, fixture.workspaceTwo]) {
          phase = `${locale}-workspace-denial`;
          const opportunityResponse = page.waitForResponse(response => pathOf(response) === '/api/customer/v2/airprop/opportunities'
            && new URL(response.url()).searchParams.get('workspace_id') === workspace && response.request().method() === 'GET', { timeout: 90_000 });
          const b2Response = page.waitForResponse(response => pathOf(response) === '/api/customer/v2/airprop/artifact-b2'
            && new URL(response.url()).searchParams.get('workspace_id') === workspace && response.request().method() === 'GET', { timeout: 90_000 });
          await selector.selectOption(workspace);
          const opportunity = await opportunityResponse; const b2 = await b2Response;
          requireError({ status: opportunity.status(), body: await opportunity.json() }, 403, 'AIRPROP_ACCESS_DENIED');
          requireError({ status: b2.status(), body: await b2.json() }, 403, 'AIRPROP_PRE_ACTIVATION');
          await expect(page.locator('main [role="alert"]')).toBeVisible();
          await expect(page.locator('main table tbody tr')).toHaveCount(0);
          await expect(page.locator('main > section')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
          await expect(selector).toHaveValue(workspace);
          receipt.findings.push({ locale, opportunity_status: opportunity.status(), opportunity_code: 'AIRPROP_ACCESS_DENIED',
            scoped_b2_status: b2.status(), scoped_b2_code: 'AIRPROP_PRE_ACTIVATION' });
          receipt.scenarios += 1;
        }
        const controls = await readInBrowser(page, '/api/customer/v2/airprop/artifact-b2');
        assert.equal(controls.status, 200, 'unscoped controls may succeed without a portfolio');
        assert.equal(controls.body.commands, null); assert.equal(controls.body.can_edit, false);
        assert.equal(controls.body.state, 'pre_activation'); assert.equal(Object.hasOwn(controls.body, 'view'), false);
        await close(context); receipt.scenarios += 2;

        phase = `${locale}-fresh-other-actor`;
        const isolated = await open(locale, other.cookie); const isolatedPage = await isolated.newPage();
        await isolatedPage.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        assert.equal(new URL(isolatedPage.url()).pathname, `/${locale}/app/airprop`);
        const forbidden = await readInBrowser(isolatedPage, `/api/customer/v1/workspace/targets?context_id=${fixture.context}`);
        requireError(forbidden, 403, 'WORKSPACE_ACCESS_DENIED');
        await expect(isolatedPage.getByRole('combobox', { name: text.choose, exact: true })).toHaveCount(0);
        for (const hidden of [fixture.workspaceOne, fixture.workspaceTwo, 'Private-A', 'PF01 private lease must not leak']) {
          assert.equal((await isolatedPage.locator('main').innerText()).includes(hidden), false);
        }
        await close(isolated); receipt.scenarios += 1; receipt.locales += 1;
      }
      assert.deepEqual(await readState(pool), before, 'read-only browser paths changed domain state');
      receipt.after_read_sha256 = fingerprint(await readState(pool));
      receipt.path = 'REAL_CHROMIUM_ACTUAL_APP_LAYOUT_LOCAL_API_CANONICAL_RPC_POSTGRES';
      receipt.domain_integrity = 'UNCHANGED_COUNTS_AND_CONTENT_HASHES_NOT_SQL_ATTEMPT_AUDIT';
      phase = 'injected-failure-cleanup';
      const failing = await open('en', owner.cookie);
      await (await failing.newPage()).goto('/en/app/airprop', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      let injected = false;
      try { throw new Error('redacted_ce_consumer_failure'); }
      catch { injected = true; }
      finally {
        await closeBrowserResources(browser, contexts); await next.close(); await cleanupPf01Users(pool, users);
      }
      assert.equal(injected, true); assert.equal(browser.isConnected(), false);
      assert.equal(contexts.size, 0); assert.equal(await pf01PortIsLive(port), false);
      receipt.injected_failure_cleanup = 'VERIFIED_BROWSER_CONTEXT_PROCESS_PORT_AUTHORITY_SESSIONS';
      browser = null; next = null; receipt.scenarios += 1;
      assert.equal(stats.domainMutationRequests, 0); assert.equal(stats.remoteBackend, 0); assert.equal(stats.externalRequests, 0);
      receipt.status = blockers.size ? 'BLOCKED_FIXTURE_SCOPE_MISMATCH' : 'PASS';
    });
  } catch (error) {
    const line = /test-ce-airprop-local-browser-denial\.mjs:(\d+)/.exec(error?.stack ?? '')?.[1];
    receipt.status = 'FAILED_NOT_PASS';
    receipt.failure = { phase, type: error?.name === 'AssertionError' ? 'ASSERTION_FAILED' : 'BOUNDED_FAILURE', line: line ? Number(line) : null };
  } finally {
    const errors = [];
    try { await closeBrowserResources(browser, contexts); } catch { errors.push('BROWSER_CLEANUP_FAILED'); }
    if (next) try { await next.close(); } catch { errors.push('PROCESS_CLEANUP_FAILED'); }
    if (pool) {
      try { await cleanupPf01Users(pool, users); } catch { errors.push('AUTHORITY_SESSION_CLEANUP_FAILED'); }
      try { await pool.end(); } catch { errors.push('POOL_CLEANUP_FAILED'); }
    }
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    receipt.cleanup = errors.length ? errors : users.length ? 'VERIFIED_OWNED_BROWSER_PROCESS_AUTHORITY_SESSIONS' : 'NO_AUTH_FIXTURE_OR_BROWSER_CREATED';
    if (errors.length) receipt.status = 'FAILED_NOT_PASS';
    await Promise.allSettled(errorReads);
    receipt.http_errors = [...httpErrors.values()];
    receipt.blockers = [...blockers]; receipt.network = stats;
    receipt.stack_cleanup = 'REQUIRED_WORKFLOW_ALWAYS_TEARDOWN';
    console.log(JSON.stringify(receipt, null, 2));
  }
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = await runDenialProof();
  if (receipt.status !== 'PASS') process.exitCode = 1;
}
