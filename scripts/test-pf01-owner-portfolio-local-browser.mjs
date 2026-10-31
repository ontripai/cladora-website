import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import {
  assertPf01NoDotenv, assertPf01LocalExecutionInputs, cleanupPf01Users,
  createPf01Aal2User, createPf01DatabaseFixture, localProjectRef,
  pf01FreeLoopbackPort, pf01PortIsLive, provePf01ContentUpdateDetection,
  revokePf01CurrentAuthority, revokePf01ManagementAuthority,
  snapshotPf01ReadState, startPf01BrowserNextApp, verifyPf01LocalTarget,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

export const SUITE = 'CORE-PF01-LOCAL-BROWSER-01';
const LOCALES = ['ro', 'en', 'fa'];
const UI = {
  ro: { title: 'Portofoliul proprietarului', official: 'Registrul oficial al unităților', withheld: 'Legătura de acțiune este ascunsă', empty: 'Nu există unități oficiale care pot fi dezvăluite.' },
  en: { title: 'Multi-unit owner portfolio', official: 'Official unit records', withheld: 'Action link withheld', empty: 'No official units are currently disclosable.' },
  fa: { title: 'کارتابل مالک چندواحدی', official: 'دفتر رسمی واحدها', withheld: 'پیوند اقدام محفوظ است', empty: 'واحد رسمی قابل افشایی وجود ندارد.' },
};
function workspaceHeading(locale, ordinal) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false }).format(ordinal);
  return locale === 'fa' ? `ورک‌اسپیس رسمی ${number} — نام در دسترس نیست`
    : locale === 'ro' ? `Spațiu oficial ${number} — nume indisponibil`
      : `Official Workspace ${number} — name unavailable`;
}
const REQUIRED_INPUTS = {
  target: 'PF01_LOCAL_TARGET', ephemeralOptIn: 'PF01_LOCAL_EPHEMERAL',
  realAuthOptIn: 'PF01_LOCAL_REAL_AUTH', supabaseUrl: 'PF01_LOCAL_SUPABASE_URL',
  databaseUrl: 'PF01_LOCAL_DATABASE_URL', anonKey: 'PF01_LOCAL_ANON_KEY',
  serviceRoleKey: 'PF01_LOCAL_SERVICE_ROLE_KEY',
};
export function browserInputs(env, appOrigin, projectRef) {
  const inputs = { appOrigin, projectRef };
  for (const [field, name] of Object.entries(REQUIRED_INPUTS)) {
    if (!env[name]?.trim()) throw new Error('pf01_browser_required_input_missing');
    inputs[field] = env[name].trim();
  }
  assertPf01LocalExecutionInputs(inputs);
  return inputs;
}

export function assertBrowserOrigin(origin) {
  const url = new URL(origin);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('pf01_browser_origin_rejected');
  }
  return url.origin;
}

// No bearer headers, keys, persisted state, recordings or application log capture.
export function browserContextOptions(origin, locale) {
  return { baseURL: assertBrowserOrigin(origin), locale, serviceWorkers: 'block',
    acceptDownloads: false, viewport: { width: 1365, height: 900 } };
}

export async function closeBrowserResources(browser, contexts) {
  const errors = [];
  for (const context of [...contexts]) {
    try { await context.close(); contexts.delete(context); } catch (error) { errors.push(error); }
  }
  if (browser) {
    try { await browser.close(); } catch (error) { errors.push(error); }
    if (browser.isConnected()) errors.push(new Error('browser_still_connected'));
  }
  if (errors.length) throw new AggregateError(errors, 'browser_cleanup_failed');
}

function fixtureCookies(cookie, origin) {
  assertBrowserOrigin(origin);
  return cookie.split('; ').map(pair => {
    const separator = pair.indexOf('=');
    if (separator < 1 || !/^sb-[a-zA-Z0-9_.-]+$/.test(pair.slice(0, separator))) {
      throw new Error('pf01_session_cookie_invalid');
    }
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1),
      url: origin, sameSite: 'Lax' };
  });
}

export async function configureBrowserContext(context, { origin, supabaseUrl, stats }) {
  assertBrowserOrigin(origin);
  const api = new URL(supabaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) throw new Error('browser_backend_not_local');
  const allowed = new Set([origin, api.origin]);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!allowed.has(url.origin)) {
      // Containment only. Never replace a local response with fixture data.
      stats.externalRequests += 1;
      if (['xhr', 'fetch', 'document', 'websocket'].includes(request.resourceType())
          || /supabase|\/api\/|\/rest\/|\/auth\//i.test(url.href)) stats.remoteBackend += 1;
      await route.abort('blockedbyclient');
      return;
    }
    const method = request.method();
    const authHousekeeping = url.origin === api.origin && url.pathname.startsWith('/auth/v1/');
    const methods = authHousekeeping ? stats.authMethods : stats.readMethods;
    methods[method] = (methods[method] ?? 0) + 1;
    if (!authHousekeeping && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      stats.domainMutationRequests += 1;
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

function metrics() {
  return { readMethods: {}, authMethods: {}, domainMutationRequests: 0, remoteBackend: 0,
    externalRequests: 0, contexts: 0, navigations: 0, projectionResponses: 0 };
}

async function openContext(browser, contexts, { origin, supabaseUrl, locale, cookie, stats }) {
  const context = await browser.newContext(browserContextOptions(origin, locale));
  contexts.add(context);
  stats.contexts += 1;
  await configureBrowserContext(context, { origin, supabaseUrl, stats });
  if (cookie) await context.addCookies(fixtureCookies(cookie, origin));
  return context;
}

function officialSection(page, locale) {
  return page.locator('main section').filter({ has: page.getByRole('heading', { name: UI[locale].official, exact: true }) });
}

async function directRpc(inputs, token) {
  // Independent real actor-bound local RPC; used only to compare browser output.
  const db = createClient(inputs.supabaseUrl, inputs.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.schema('customer_api').rpc('list_my_owner_portfolio_projections_v1', { p_expected_unit_versions: {} });
  assert.equal(error, null, 'actor RPC must succeed');
  return data;
}

function stableProjection(projections) {
  // Only clock fields differ between separate live RPC reads, not source/version/action.
  return JSON.parse(JSON.stringify(projections, (key, value) =>
    ['as_of', 'evaluated_at'].includes(key) ? undefined : value));
}

async function loadPortfolio({ page, locale, stats, origin }) {
  const projectionPromise = page.waitForResponse(response =>
    response.url() === `${origin}/api/owner-portfolio/v1/projection` && response.request().method() === 'GET', { timeout: 90_000 });
  stats.navigations += 1;
  const response = await page.goto(`/${locale}/owner-portfolio`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  assert.equal(response.status(), 200, 'actual page must render without protected-route bypass');
  assert.equal(new URL(page.url()).pathname, `/${locale}/owner-portfolio`);
  await expect(page.getByRole('heading', { name: UI[locale].title, exact: true })).toBeVisible();
  const projectionResponse = await projectionPromise;
  assert.equal(projectionResponse.status(), 200, 'actual browser projection request must succeed');
  stats.projectionResponses += 1;
  const body = await projectionResponse.json(); // In memory only; never emit payload.
  await expect(officialSection(page, locale).getByRole('status')).toHaveCount(0, { timeout: 30_000 });
  return body.projections;
}

async function verifyOfficial(page, locale, projections, fixture, blockers) {
  const official = officialSection(page, locale);
  await expect(official).toBeVisible();
  const available = projections.filter(projection => projection.projection_status === 'available');
  const articles = official.locator('article');
  await expect(articles).toHaveCount(available.length);
  const text = await official.innerText();
  for (const hidden of ['Private-A', 'Private owner address', 'Secret Other', 'Other-X',
    'private evidence must not leak', 'other owner evidence secret', 'cross tenant evidence secret',
    'PF01 private lease must not leak', 'PF01 private cash must not leak', fixture.crossTenantUnit]) {
    assert.equal(text.includes(hidden), false, 'private/foreign data must be absent from official DOM');
    assert.equal(JSON.stringify(projections).includes(hidden), false, 'private/foreign data must be absent from browser projection');
  }
  // commercial_owner is NOT a canonical name. Ordinals are presentation only,
  // matched to actual ordered RPC groups and their canonical Unit content.
  const headings = (await articles.getByRole('heading', { level: 3 }).allTextContents()).map(text => text.replace(/\s+/g, ' ').trim());
  assert.deepEqual(headings, available.map((_, index) => workspaceHeading(locale, index + 1)));
  assert.equal(new Set(headings).size, available.length, 'visible group headings must be distinct');
  for (const heading of headings) {
    assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(heading), false, 'Workspace UUID must not become a display name');
    assert.equal(/PF01 operator|Property One|Property Two/.test(heading), false, 'operator/property names must not substitute for a Workspace name');
  }
  const unitNames = new Map([[fixture.unitOne, 'A-01'], [fixture.unitTwo, 'B-02']]);
  for (const [index, projection] of available.entries()) {
    const article = articles.nth(index);
    await expect(article.locator('li')).toHaveCount(projection.items.length);
    for (const item of projection.items) {
      const { canonical_reference: reference, relationship, source } = item.resource;
      const row = article.locator('li').filter({ hasText: reference.display_name ?? reference.resource_id });
      await expect(row).toHaveCount(1);
      const text = await row.innerText();
      if (!(await row.locator('strong').innerText()).includes(unitNames.get(reference.resource_id))) {
        blockers.add('UI_CANONICAL_UNIT_DISPLAY_MISSING_UUID_FALLBACK');
      }
      for (const value of [relationship.relationship_kind, source.source_reference,
        `${reference.resource_version} / ${relationship.relationship_version}`,
        reference.reference_status, relationship.valid_from, relationship.valid_until ?? '∞']) {
        assert.ok(text.includes(String(value)), 'relationship/source/version/validity must match actual RPC');
      }
      const allowed = item.actions.filter(action => action.action_status === 'allowed');
      await expect(row.locator('a')).toHaveCount(allowed.length);
      for (const action of allowed) await expect(row.locator('a')).toHaveAttribute('href', `/${locale}${action.href}`);
      if (item.actions.some(action => action.action_status !== 'allowed')) {
        await expect(row.getByText(UI[locale].withheld, { exact: true })).toBeVisible();
      }
    }
  }
}

async function verifyPrivate(page, locale, other) {
  const main = page.locator('main');
  const own = other ? ['Other-X'] : ['Private-A', 'Private-B', 'Private-C'];
  const absent = other ? ['Private-A', 'Private-B', 'Private-C', 'PF01 private lease must not leak'] : ['Secret Other', 'Other-X'];
  for (const label of own) {
    const button = main.getByRole('button').filter({ hasText: label });
    await expect(button).toHaveCount(1, { timeout: 45_000 });
    assert.equal(await officialSection(page, locale).getByText(label, { exact: false }).count(), 0);
  }
  const text = await main.innerText();
  for (const label of absent) assert.equal(text.includes(label), false, 'fresh actor context must not retain another private book');
}

export async function runBrowserProof() {
  let phase = 'static-preflight';
  let browser = null;
  let next = null;
  let pool = null;
  const contexts = new Set();
  const users = [];
  const blockers = new Set();
  const stats = metrics();
  const results = {};
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const receipt = { suite: SUITE, sha, browser: 'NOT_RUN_NOT_PASS', locales: 0, scenarios: 0,
    path: 'NOT_RUN_NOT_PASS', results, blockers: [], production: 'NOT_RUN_NOT_PASS',
    product_limitations: ['WORKSPACE_CANONICAL_NAME_UNAVAILABLE'],
    hosted_preview_e2e: 'NOT_RUN_NOT_PASS', pilot_release: 'NOT_RUN_NOT_PASS' };
  try {
    const port = await pf01FreeLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const inputs = browserInputs(process.env, origin, await localProjectRef());
    const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
    const adminClient = createClient(inputs.supabaseUrl, inputs.serviceRoleKey, options);
    const actorClient = createClient(inputs.supabaseUrl, inputs.anonKey, options);
    pool = new Pool({ connectionString: inputs.databaseUrl, max: 4 });
    phase = 'connected-read-only-preflight';
    await verifyPf01LocalTarget({ ...inputs, pool, adminClient, actorClient });
    await assertPf01NoDotenv();
    results.target = 'MATCHED_AUTH_DB_LOCAL_IDENTITY_BEFORE_WRITES_OR_BROWSER';
    // Browser installation/availability checked before any fixture Auth/domain writes.
    phase = 'chromium-launch';
    browser = await chromium.launch({ headless: true });
    receipt.browser = browser.version();
    phase = 'real-auth-fixture';
    const onCreated = user => users.push(user);
    const owner = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'browser-owner', onCreated });
    const other = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'browser-other', onCreated });
    const fixture = await createPf01DatabaseFixture(pool, {
      ownerUserId: owner.userId, otherUserId: other.userId, ownerEmail: owner.email, otherEmail: other.email,
    });
    await provePf01ContentUpdateDetection(pool);
    phase = 'actual-next';
    next = await startPf01BrowserNextApp({ port, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, signal: cancellation.signal });
    const open = async (locale, cookie) => openContext(browser, contexts, { origin, supabaseUrl: inputs.supabaseUrl, locale, cookie, stats });
    const closed = async context => { await context.close(); contexts.delete(context); };
    const before = await snapshotPf01ReadState(pool);
    results.observed_table_count = Object.keys(before).length;
    results.initial_read_state_sha256 = createHash('sha256').update(JSON.stringify(before)).digest('hex');
    for (const locale of LOCALES) {
      phase = `browser-${locale}-anonymous`;
      const anonymous = await open(locale);
      const page = await anonymous.newPage();
      stats.navigations += 1;
      await page.goto(`/${locale}/owner-portfolio`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(page).toHaveURL(new RegExp(`/${locale}/login(?:[?]|$)`));
      assert.equal(await page.locator('main article').count(), 0);
      await closed(anonymous);
      receipt.scenarios += 1;

      phase = `browser-${locale}-owner`;
      const context = await open(locale, owner.cookie);
      const ownerPage = await context.newPage();
      const projections = await loadPortfolio({ page: ownerPage, locale, stats, origin });
      assert.equal(projections.length, 2);
      assert.deepEqual(projections.map(p => p.portfolio_workspace_id).sort(), [fixture.workspaceOne, fixture.workspaceTwo].sort());
      assert.equal(projections.flatMap(p => p.items).length, 2);
      assert.deepEqual(stableProjection(projections), stableProjection(await directRpc(inputs, owner.accessToken)));
      await verifyOfficial(ownerPage, locale, projections, fixture, blockers);
      await verifyPrivate(ownerPage, locale, false);
      await expect(ownerPage.locator('main')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
      await closed(context);
      receipt.scenarios += 1;

      phase = `browser-${locale}-other-owner`;
      const isolated = await open(locale, other.cookie);
      const isolatedPage = await isolated.newPage();
      const empty = await loadPortfolio({ page: isolatedPage, locale, stats, origin });
      assert.deepEqual(empty, []);
      await verifyOfficial(isolatedPage, locale, empty, fixture, blockers);
      await expect(officialSection(isolatedPage, locale).getByText(UI[locale].empty, { exact: true })).toBeVisible();
      await verifyPrivate(isolatedPage, locale, true);
      await closed(isolated);
      receipt.scenarios += 1;
      receipt.locales += 1;
    }
    assert.deepEqual(await snapshotPf01ReadState(pool), before, 'all locale/actor/anonymous navigation is zero durable write');
    results.after_read_state_sha256 = createHash('sha256').update(JSON.stringify(await snapshotPf01ReadState(pool))).digest('hex');
    Object.assign(results, { real_page_api_rpc_db: 'PASS', actor_locale_isolation: 'PASS', private_official_separation: 'PASS',
      relationship_source_version_validity: 'PASS', allowed_withheld_links: 'PASS', read_count_content_fingerprints: 'UNCHANGED_27_TABLES',
      localized_distinct_workspace_unavailable_headings: 'PASS_ZERO_AND_MULTIPLE_GROUPS',
      negative_content_control: 'DETECTED_ROLLED_BACK' });
    receipt.path = 'REAL_CHROMIUM_NEXT_PAGE_NEXT_API_ACTOR_RPC_LOCAL_POSTGRES';

    phase = 'management-revocation';
    const preserved = await revokePf01ManagementAuthority(pool, owner.userId);
    assert.equal(preserved.ownerships, 3);
    assert.equal(preserved.private_units, 3);
    const afterManagement = await snapshotPf01ReadState(pool);
    const management = await open('en', owner.cookie);
    const managementPage = await management.newPage();
    const surviving = await loadPortfolio({ page: managementPage, locale: 'en', stats, origin });
    assert.deepEqual(surviving.map(p => p.portfolio_workspace_id), [fixture.workspaceTwo]);
    await verifyOfficial(managementPage, 'en', surviving, fixture, blockers);
    await verifyPrivate(managementPage, 'en', false);
    assert.deepEqual(await snapshotPf01ReadState(pool), afterManagement);
    receipt.scenarios += 1;
    results.management_revoke_ownership_preserved = 'PASS';
    results.localized_distinct_workspace_unavailable_headings = 'PASS_ZERO_MULTIPLE_AND_REVOKED_SINGLE_GROUP';

    phase = 'current-authority-session-revoke-reload';
    await revokePf01CurrentAuthority(pool, owner.userId);
    await owner.revokeSession();
    const afterRevoke = await snapshotPf01ReadState(pool);
    stats.navigations += 1;
    await managementPage.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await expect(managementPage.locator('main article')).toHaveCount(0);
    await closed(management);
    // Reinstall the OLD in-memory cookies in a fresh context, never persist state.
    const replay = await open('en', owner.cookie);
    const replayPage = await replay.newPage();
    stats.navigations += 1;
    await replayPage.goto('/en/owner-portfolio', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await expect(replayPage.locator('main article')).toHaveCount(0);
    const replayedProjection = await replay.request.get(`${origin}/api/owner-portfolio/v1/projection`);
    assert.ok([401, 403].includes(replayedProjection.status()), 'old cookie cannot restore official visibility');
    assert.equal((await replayPage.locator('body').innerText()).includes(fixture.workspaceTwo), false);
    await expect(replayPage.getByRole('heading', { name: workspaceHeading('en', 1), exact: true })).toHaveCount(0);
    await expect(replayPage.getByText('B-02', { exact: true })).toHaveCount(0);
    await closed(replay);
    assert.deepEqual(await snapshotPf01ReadState(pool), afterRevoke);
    receipt.scenarios += 2;
    results.revoked_reload_old_cookie_replay = 'DENIED_ZERO_WRITE_NO_STALE_DOM';

    phase = 'injected-browser-consumer-failure';
    const failingContext = await open('en', other.cookie);
    await (await failingContext.newPage()).goto('/en/owner-portfolio', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    let injected = false;
    try { throw new Error('pf01_redacted_injected_browser_failure'); }
    catch { injected = true; }
    finally {
      await closeBrowserResources(browser, contexts);
      await next.close();
      await cleanupPf01Users(pool, users);
    }
    assert.equal(injected, true);
    assert.equal(browser.isConnected(), false);
    assert.equal(contexts.size, 0);
    assert.equal(await pf01PortIsLive(port), false);
    browser = null;
    next = null;
    receipt.scenarios += 1;
    results.injected_failure_cleanup = 'BROWSER_CONTEXT_PROCESS_PORT_AUTHORITY_SESSIONS_VERIFIED';
    assert.equal(stats.domainMutationRequests, 0);
    assert.equal(stats.remoteBackend, 0);
    receipt.status = blockers.size ? 'BLOCKED_OUTSIDE_ALLOWED_UI_SCOPE' : 'PASS';
  } catch (error) {
    receipt.status = 'FAILED';
    // Never print error.message/actual/expected, Auth data, DOM text or response bodies.
    const line = /test-pf01-owner-portfolio-local-browser\.mjs:(\d+)/.exec(error?.stack ?? '')?.[1];
    receipt.failure = { phase, type: error?.name === 'AssertionError' ? 'ASSERTION_FAILED' : 'BOUNDED_FAILURE', line: line ? Number(line) : null };
  } finally {
    const cleanup = [];
    try { await closeBrowserResources(browser, contexts); } catch { cleanup.push('BROWSER_CLEANUP_FAILED'); }
    if (next) try { await next.close(); } catch { cleanup.push('PROCESS_CLEANUP_FAILED'); }
    if (pool) {
      try { await cleanupPf01Users(pool, users); } catch { cleanup.push('AUTHORITY_SESSION_CLEANUP_FAILED'); }
      try { await pool.end(); } catch { cleanup.push('POOL_CLEANUP_FAILED'); }
    }
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    receipt.cleanup = cleanup.length ? cleanup : 'VERIFIED_OWNED_RESOURCES_LOGICAL_AUTHORITY_SESSIONS';
    receipt.retained_fixture_history = 'DISPOSABLE_STACK_TEARDOWN_REQUIRED';
    if (cleanup.length) receipt.status = 'FAILED';
    receipt.blockers = [...blockers].sort();
    receipt.network = stats;
    // Fingerprint observed table contents, not an audit of attempted SQL.
    receipt.evidence_classification = 'REPORTED_NOT_COORDINATOR_ACCEPTED';
    console.log(JSON.stringify(receipt, null, 2));
  }
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runBrowserProof();
  if (result.status !== 'PASS') process.exitCode = 1;
}
