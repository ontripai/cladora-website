import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { browserInputs, browserContextOptions, configureBrowserContext } from './test-pf01-owner-portfolio-local-browser.mjs';
import {
  withVerifiedPf01LocalTarget, assertPf01NoDotenv, localProjectRef,
  pf01FreeLoopbackPort, pf01PortIsLive, createPf01Aal2User, cleanupPf01Users, startPf01BrowserNextApp,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';
import {
  bounded, ceFingerprint, ceReadState, createCeAirpropLocalFixture, verifyCeNativeFixture,
  verifyCeControlCleanup, launchOwnedCeBrowser, closeOwnedCeBrowser, observeCeRequests,
  installCeErrorBodyDrain, cancelCeErrorBodyDrains,
} from './lib/ce-airprop-local-browser-fixture.mjs';

export const SUITE = 'CORE-CE-AIRPROP-BROWSER-RECOVERY-01';
export const executeVerifiedDenial = (options, consume) => withVerifiedPf01LocalTarget(options, consume);
const UI = {
  ro: { title: 'Oportunități imobiliare · AIRPROP', choose: 'Alege spațiul de lucru', error: 'Datele spațiului de lucru nu au putut fi încărcate. Verifică accesul și revino la pagina oportunităților.', b2: 'Portofoliul administrat nu este disponibil momentan.' },
  en: { title: 'Property opportunities · AIRPROP', choose: 'Choose a workspace', error: 'Workspace details could not be loaded. Check your access and return to the opportunities page.', b2: 'The managed portfolio is currently unavailable.' },
  fa: { title: 'فرصت‌های ملکی · AIRPROP', choose: 'انتخاب فضای کاری', error: 'اطلاعات فضای کاری دریافت نشد. دسترسی خود را بررسی کنید و به صفحهٔ فرصت‌ها برگردید.', b2: 'سبد تحت مدیریت در حال حاضر در دسترس نیست.' },
};
export function sessionCookies(cookie, origin) {
  browserContextOptions(origin, 'en');
  return cookie.split('; ').map(pair => {
    const i = pair.indexOf('=');
    if (i < 1 || !/^sb-[a-zA-Z0-9_.-]+$/.test(pair.slice(0, i))) throw new Error('ce_fixture_cookie_format_rejected');
    return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin, sameSite: 'Lax' };
  });
}
export function requireError(result, status, code) {
  assert.equal(result.status, status, 'unexpected HTTP status is not an authorization PASS');
  assert.equal(result.body?.error?.code, code, 'headers or unexpected backend code are not an authorization PASS');
}
async function readInBrowser(page, path, signal, emit) {
  // Additional real GETs for explicit negative controls/unscoped controls only.
  // They do not replace selected, completed UI response + DOM verification.
  return bounded(() => page.evaluate(async path => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
      const text = await response.text();
      if (text.length > 256 * 1024) throw new Error('bounded_control_body');
      return { status: response.status, body: JSON.parse(text) };
    } finally { clearTimeout(timer); }
  }, path), { ms: 20_000, stage: 'browser_control_body', signal, emit });
}
export async function runDenialProof() {
  let phase = 'preflight'; let owned = null; let next = null; let pool = null; let fixture = null; let owner = null;
  const contexts = new Set(); const users = []; const blockers = new Set(); const observers = [];
  const diagnosticCounts = {}; const diagnostics = [];
  const emit = event => {
    diagnosticCounts[event.stage] = (diagnosticCounts[event.stage] ?? 0) + 1;
    const value = { phase, ...event }; diagnostics.push(value); if (diagnostics.length > 200) diagnostics.shift();
    console.log(JSON.stringify({ diagnostic: SUITE, ...value })); // Fixed metadata only, no URLs/IDs/headers/bodies.
    if (event.stage === 'headers_received' && event.status >= 500) blockers.add('UNEXPECTED_API_SERVER_ERROR');
  };
  const stats = { readMethods: {}, authMethods: {}, domainMutationRequests: 0, remoteBackend: 0, externalRequests: 0, contexts: 0 };
  const receipt = { suite: SUITE,
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    browser: 'NOT_RUN_NOT_PASS', locales: 0, scenarios: 0, findings: [],
    product_limitations: ['WORKSPACE_CANONICAL_NAME_UNAVAILABLE'],
    positive_commercial_e2e: 'NOT_RUN_NOT_PASS', hosted_preview_e2e: 'NOT_RUN_NOT_PASS', release: 'NOT_RUN_NOT_PASS' };
  const cancellation = new AbortController(); const cancel = () => cancellation.abort();
  const proofTimer = setTimeout(cancel, 600_000); // Leave cleanup margin inside the unchanged 900s outer watchdog.
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let complete = false; let injected = false; let port;
  try {
    port = await pf01FreeLoopbackPort(); const origin = `http://127.0.0.1:${port}`;
    const inputs = browserInputs(process.env, origin, await localProjectRef());
    const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const adminClient = createClient(inputs.supabaseUrl, inputs.serviceRoleKey, clientOptions);
    const actorClient = createClient(inputs.supabaseUrl, inputs.anonKey, clientOptions);
    pool = new Pool({ connectionString: inputs.databaseUrl, max: 4, connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000, query_timeout: 15_000 });
    await executeVerifiedDenial({ ...inputs, pool, adminClient, actorClient }, async () => {
      await assertPf01NoDotenv(); receipt.identity = 'VERIFIED_LOCAL_AUTH_DB_STACK_BEFORE_AUTH_WRITES_OR_BROWSER';
      phase = 'chromium'; emit({ stage: 'launch_owned_browser' });
      owned = await launchOwnedCeBrowser(chromium); receipt.browser = owned.browser.version();
      phase = 'fixture'; emit({ stage: 'fixture_setup_started' });
      const onCreated = user => users.push(user);
      owner = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'ce-recovery-owner', onCreated });
      const other = await createPf01Aal2User({ adminClient, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, label: 'ce-recovery-other', onCreated });
      fixture = await createCeAirpropLocalFixture(pool, {
        ownerUserId: owner.userId, otherUserId: other.userId, ownerEmail: owner.email, otherEmail: other.email,
      });
      const eligibility = await verifyCeNativeFixture(pool, fixture, inputs, owner);
      receipt.fixture_controls = eligibility.controls; emit({ stage: 'fixture_setup_verified', native_targets: 2, expired: true, foreign: true });
      phase = 'next'; next = await startPf01BrowserNextApp({ port, supabaseUrl: inputs.supabaseUrl, anonKey: inputs.anonKey, signal: cancellation.signal });
      const open = async (locale, cookie) => {
        const context = await owned.browser.newContext(browserContextOptions(origin, locale));
        contexts.add(context); stats.contexts += 1;
        const observer = observeCeRequests(context, origin, emit); observers.push(observer);
        await installCeErrorBodyDrain(context, emit);
        await configureBrowserContext(context, { origin, supabaseUrl: inputs.supabaseUrl, stats });
        if (cookie) await context.addCookies(sessionCookies(cookie, origin));
        return { context, observer };
      };
      const close = async ({ context, observer }) => {
        await cancelCeErrorBodyDrains(context);
        observer.stop();
        await bounded(() => context.close(), { ms: 5_000, stage: 'scenario_context_close', emit, signal: cancellation.signal });
        contexts.delete(context); await observer.drain(); emit({ stage: 'scenario_context_closed' });
      };
      const before = await ceReadState(pool); receipt.before_read_sha256 = ceFingerprint(before);
      receipt.observed_tables = Object.keys(before).length; emit({ stage: 'read_baseline_established', tables: receipt.observed_tables });
      for (const [locale, text] of Object.entries(UI)) {
        phase = `${locale}-anonymous`; emit({ stage: 'scenario_started' });
        const anonymous = await open(locale); const anonymousPage = await anonymous.context.newPage();
        await anonymousPage.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await expect(anonymousPage).toHaveURL(new RegExp(`/${locale}/login(?:[?]|$)`));
        await close(anonymous); receipt.scenarios += 1;

        phase = `${locale}-owner-discovery`; emit({ stage: 'scenario_started' });
        const active = await open(locale, owner.cookie); const page = await active.context.newPage();
        const routeResponse = await page.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        assert.equal(routeResponse.status(), 200);
        assert.equal(new URL(page.url()).pathname, `/${locale}/app/airprop`);
        const contextSelector = page.locator('header select');
        await expect(contextSelector.locator(`option[value="${fixture.context}"]`)).toHaveCount(1, { timeout: 60_000 });
        await contextSelector.selectOption(fixture.context, { timeout: 15_000 });
        await expect(contextSelector).toHaveValue(fixture.context);
        await expect(page.getByRole('heading', { level: 1, name: text.title, exact: true })).toBeVisible();
        const targets = await active.observer.selected({ after: 0, endpoint: 'targets', contextId: fixture.context, workspaceId: null, signal: cancellation.signal });
        assert.equal(targets.status, 200); assert.ok(Array.isArray(targets.body.workspaces));
        const discovered = targets.body.workspaces.map(x => x.workspace_id).sort();
        assert.deepEqual(discovered, eligibility.expected, 'actual UI discovery must exactly match verified current native targets');
        assert.equal(discovered.includes(fixture.expiredWorkspace), false);
        assert.equal(discovered.includes(fixture.foreignWorkspace), false);
        const selector = page.getByRole('combobox', { name: text.choose, exact: true });
        await expect(selector).toBeVisible();
        assert.deepEqual((await selector.locator('option').evaluateAll(options => options.map(o => o.value))).filter(Boolean).sort(), discovered);
        receipt.findings.push({ locale, targets_status: 200, discovered_count: 2, native_expired_excluded: true, active_foreign_excluded: true });
        for (const [round, workspace] of [fixture.workspaceOne, fixture.workspaceTwo].entries()) {
          phase = `${locale}-workspace-${round + 1}`; emit({ stage: 'selection_started', round: round + 1 });
          const after = active.observer.checkpoint();
          await selector.selectOption(workspace, { timeout: 15_000 });
          const [opportunity, b2] = await bounded(() => Promise.all([
            active.observer.selected({ after, endpoint: 'opportunity', contextId: fixture.context, workspaceId: workspace, signal: cancellation.signal }),
            active.observer.selected({ after, endpoint: 'b2', contextId: fixture.context, workspaceId: workspace, signal: cancellation.signal }),
          ]), { ms: 70_000, stage: 'ui_denial_pair', signal: cancellation.signal, emit });
          requireError(opportunity, 403, 'AIRPROP_ACCESS_DENIED');
          requireError(b2, 403, 'AIRPROP_PRE_ACTIVATION');
          await expect(page.locator('main [role="alert"]').filter({ hasText: text.error })).toHaveText(text.error);
          await expect(page.locator('main [role="alert"]').filter({ hasText: text.error })).toBeVisible();
          await expect(page.locator('main').getByText(text.b2, { exact: true })).toBeVisible();
          await expect(page.locator('main table tbody tr')).toHaveCount(0);
          await expect(page.locator('main > section')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
          await expect(selector).toHaveValue(workspace);
          emit({ stage: 'actual_ui_denial_verified', opportunity_status: opportunity.status, opportunity_code: 'AIRPROP_ACCESS_DENIED', b2_status: b2.status, b2_code: 'AIRPROP_PRE_ACTIVATION' });
          receipt.findings.push({ locale, round: round + 1, opportunity_status: 403, opportunity_code: 'AIRPROP_ACCESS_DENIED',
            scoped_b2_status: 403, scoped_b2_code: 'AIRPROP_PRE_ACTIVATION', completed_current_ui_response_and_dom: true });
          receipt.scenarios += 1;
        }
        for (const [label, forbiddenWorkspace] of [['expired_native', fixture.expiredWorkspace], ['foreign_tenant', fixture.foreignWorkspace]]) {
          phase = `${locale}-${label}-control`;
          const result = await readInBrowser(page, `/api/customer/v2/airprop/opportunities?context_id=${fixture.context}&workspace_id=${forbiddenWorkspace}`, cancellation.signal, emit);
          requireError(result, 403, 'AIRPROP_ACCESS_DENIED');
          receipt.findings.push({ locale, negative_control: label, status: 403, code: 'AIRPROP_ACCESS_DENIED' });
          receipt.scenarios += 1;
        }
        phase = `${locale}-unscoped-controls`;
        const controls = await readInBrowser(page, '/api/customer/v2/airprop/artifact-b2', cancellation.signal, emit);
        assert.equal(controls.status, 200);
        assert.equal(controls.body.commands, null); assert.equal(controls.body.can_edit, false);
        assert.equal(controls.body.state, 'pre_activation'); assert.equal(Object.hasOwn(controls.body, 'view'), false);
        await close(active); receipt.scenarios += 2;

        phase = `${locale}-fresh-other-actor`;
        const isolated = await open(locale, other.cookie); const isolatedPage = await isolated.context.newPage();
        await isolatedPage.goto(`/${locale}/app/airprop`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        assert.equal(new URL(isolatedPage.url()).pathname, `/${locale}/app/airprop`);
        const forbidden = await readInBrowser(isolatedPage, `/api/customer/v1/workspace/targets?context_id=${fixture.context}`, cancellation.signal, emit);
        requireError(forbidden, 403, 'WORKSPACE_ACCESS_DENIED');
        await expect(isolatedPage.getByRole('combobox', { name: text.choose, exact: true })).toHaveCount(0);
        for (const hidden of [fixture.workspaceOne, fixture.workspaceTwo, fixture.foreignWorkspace, 'Private-A', 'PF01 private lease must not leak']) {
          assert.equal((await isolatedPage.locator('main').innerText()).includes(hidden), false);
        }
        await close(isolated); receipt.scenarios += 1; receipt.locales += 1;
      }
      phase = 'after-read-integrity';
      const after = await ceReadState(pool); receipt.after_read_sha256 = ceFingerprint(after);
      assert.deepEqual(after, before, 'complete browser read scenarios must leave all observed domain/control/ledger contents unchanged');
      assert.equal(receipt.locales, 3); assert.equal(receipt.scenarios, 24);
      assert.equal(stats.domainMutationRequests, 0); assert.equal(stats.remoteBackend, 0); assert.equal(stats.externalRequests, 0);
      receipt.path = 'REAL_CHROMIUM_ACTUAL_APP_LAYOUT_LOCAL_API_CANONICAL_RPC_POSTGRES';
      receipt.domain_integrity = 'COMPLETE_BEFORE_AFTER_EQUAL_COUNTS_AND_CONTENT_NOT_SQL_ATTEMPT_AUDIT';
      complete = true;
      phase = 'injected-connected-failure';
      const failing = await open('en', owner.cookie);
      await (await failing.context.newPage()).goto('/en/app/airprop', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      injected = true; receipt.scenarios += 1;
      throw Object.assign(new Error('controlled_ce_consumer_failure'), { code: 'CE_INJECTED_FAILURE' });
    });
  } catch (error) {
    cancellation.abort();
    if (error.code === 'CE_INJECTED_FAILURE' && complete && injected) {
      receipt.injected_failure = 'CONTROLLED_CONSUMER_FAILURE_OBSERVED';
      receipt.status = 'PASS_PENDING_CLEANUP';
    } else {
      const line = /test-ce-airprop-local-browser-denial\.mjs:(\d+)/.exec(error?.stack ?? '')?.[1];
      receipt.status = 'FAILED_NOT_PASS';
      receipt.failure = { phase, type: error?.name === 'AssertionError' ? 'ASSERTION_FAILED' : error?.name === 'BrowserProofDeadline' ? 'DEADLINE' : 'BOUNDED_FAILURE',
        operation: error?.stage, line: line ? Number(line) : null };
    }
  } finally {
    clearTimeout(proofTimer); cancellation.abort();
    const errors = [];
    const cleanup = async (stage, work, ms = 30_000) => {
      emit({ stage: `cleanup_${stage}_started` });
      try { await bounded(work, { ms, stage: `cleanup_${stage}`, emit }); emit({ stage: `cleanup_${stage}_finished` }); }
      catch { errors.push(stage.toUpperCase() + '_CLEANUP_FAILED'); emit({ stage: `cleanup_${stage}_failed` }); }
    };
    phase = 'cleanup';
    await cleanup('passive_readers', () => Promise.all([...contexts].map(context => cancelCeErrorBodyDrains(context))), 2_000);
    for (const observer of observers) observer.stop();
    await cleanup('browser', async () => {
      receipt.browser_cleanup = await closeOwnedCeBrowser(owned, contexts, { emit });
      if (receipt.browser_cleanup.errors.length) errors.push(...receipt.browser_cleanup.errors);
    }, 20_000);
    if (next) await cleanup('process_port', async () => {
      await next.close(); assert.equal(await pf01PortIsLive(port), false);
    }, 12_000);
    if (pool) {
      for (const [index, user] of users.entries()) await cleanup(`user_${index + 1}`, () => cleanupPf01Users(pool, [user]));
      if (fixture && owner) await cleanup('fixture_controls', () => verifyCeControlCleanup(pool, fixture, owner.userId));
      await cleanup('pool', () => pool.end(), 10_000);
    }
    for (const observer of observers) await cleanup('reader_drain', () => observer.drain(), 3_000);
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    receipt.cleanup_errors = errors;
    receipt.cleanup = errors.length ? 'FAILED_NOT_PASS' : 'VERIFIED_OWNED_BROWSER_PROCESS_AUTHORITY_SESSIONS_CONTROLS_READERS';
    receipt.blockers = [...blockers]; receipt.network = stats;
    receipt.diagnostic_counts = diagnosticCounts; receipt.diagnostics = diagnostics;
    receipt.stack_cleanup = 'REQUIRED_WORKFLOW_ALWAYS_NO_BACKUP_TEARDOWN';
    if (errors.length || blockers.size || !complete || !receipt.after_read_sha256) receipt.status = 'FAILED_NOT_PASS';
    else if (receipt.status === 'PASS_PENDING_CLEANUP') receipt.status = 'PASS';
    console.log(JSON.stringify(receipt, null, 2));
  }
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = await runDenialProof(); if (receipt.status !== 'PASS') process.exitCode = 1;
}
