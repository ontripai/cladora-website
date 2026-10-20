import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Standalone, synthetic HTTP boundary control of the ACTUAL consumer/provider.
// This does not start Next, authenticate, contact an API/DB, or use Docker.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const component = join(root, 'src/components/customer/CustomerCommunicationsDashboard.tsx');
const provider = join(root, 'src/components/customer/CustomerContextProvider.tsx');
const globals = join(root, 'src/styles/globals.css');
const injectFailure = process.argv.includes('--inject-failure');
const hash = value => createHash('sha256').update(value).digest('hex');
const receipt = { suite: 'CE-MOBILE-NOTICE-READ-ISOLATION-01/VIEWPORT-EVIDENCE-01',
  provenance: 'ACTUAL_REACT_CONSUMER_CONTEXT_PROVIDER_CSS_SYNTHETIC_HTTP_LOOPBACK',
  real_next_api_rpc_db_auth: 'NOT_RUN', physical_android_iphone: 'NOT_RUN', cases: [],
  network: { reads: 0, domain_mutations: 0, external_attempts: 0 }, runtime_errors: [] };
const copy = {
  en: { details: 'Details', close: 'Close', create: 'Create Official Notice', save: 'Save Notice Draft', evidence: 'Record Physical Evidence', submit: 'Record Evidence', error: 'Communications could not be loaded.' },
  ro: { details: 'Detalii', close: 'Închide', create: 'Creează înștiințare oficială', save: 'Salvează ciornă', evidence: 'Înregistrează dovadă fizică', submit: 'Înregistrează dovadă', error: 'Comunicările nu au putut fi încărcate.' },
  fa: { details: 'جزئیات', close: 'بستن', create: 'ثبت ابلاغیه رسمی جدید', save: 'ذخیره پیش‌نویس ابلاغیه', evidence: 'ثبت مدرک فیزیکی / پستی', submit: 'ثبت شواهد', error: 'دریافت ارتباطات ناموفق بود.' },
};
let browser; let server; let compiler; let temp; let deadline; let origin; let aborted = false;
const contexts = new Set(); const releases = new Set();
const source = await readFile(component, 'utf8');
const line = needle => `src/components/customer/CustomerCommunicationsDashboard.tsx:${source.split('\n').findIndex(x => x.includes(needle)) + 1}`;
const location = { table: line('min-w-[900px]'), detail: line('max-w-4xl'), create: line('max-w-3xl'),
  keyboard: line('function useNoticeDialog'), evidence: line('showEvidenceForm ?'), privacy: line('const contextScope'), denied: line('error={error || detailRead.error}') };
const bounded = (promise, ms, label) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]).finally(() => clearTimeout(timer));
};
async function executable() {
  for (const path of [chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    try { await access(path); return path; } catch { /* No download or substitution. */ }
  }
  throw new Error('COMPATIBLE_BROWSER_UNAVAILABLE_NO_INSTALL_ATTEMPT');
}
async function build() {
  temp = await mkdtemp(join(tmpdir(), 'ce-mobile-viewport-'));
  const entry = join(temp, 'entry.tsx');
  const loader = join(temp, 'typescript-loader.cjs');
  await writeFile(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  await writeFile(entry, `import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {CustomerContextProvider,useCustomerContext} from ${JSON.stringify(provider)};
import {CustomerCommunicationsDashboard} from ${JSON.stringify(component)};
function FixtureContextControls(){const c=useCustomerContext();useEffect(()=>{const key=e=>{if(e.altKey&&['0','1','2'].includes(e.key)){e.preventDefault();c.select(e.key==='1'?'A':e.key==='2'?'B':'');}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[c.select]);return <nav aria-label="Synthetic fixture Context controls"><span>Fixture Alt+1/2/0 </span>{['A','B',''].map((id,i)=><button key={i} type="button" data-fixture-context={id||'none'} onClick={()=>c.select(id)} style={{minHeight:44,minWidth:44}}>{id||'none'}</button>)}<output data-fixture-active>{c.active?.context_id||'none'}</output></nav>;}
const root=createRoot(document.getElementById('root'));window.disposeViewportControl=()=>root.unmount();root.render(<CustomerContextProvider><FixtureContextControls/><CustomerCommunicationsDashboard lang={document.documentElement.lang}/></CustomerContextProvider>);`);
  const webpack = require('next/dist/compiled/webpack/webpack').webpack;
  compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry,
    output: { path: temp, filename: 'control.js' },
    // Supply Next's own browser process polyfill, as its normal bundler does.
    // next/link and DashboardTransport themselves remain the installed source.
    plugins: [new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') })],
    resolve: { extensions: ['.tsx', '.ts', '.js', '.json'], modules: [join(root, 'node_modules')],
      alias: { '@': join(root, 'src') } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: [{ loader }] }] },
  });
  await bounded(new Promise((resolveBuild, reject) => compiler.run((error, stats) => {
    if (error || stats.hasErrors()) reject(new Error('STANDALONE_WEBPACK_BUILD_FAILED'));
    else resolveBuild();
  })), 60_000, 'STANDALONE_BUILD_TIMEOUT');
  await bounded(new Promise((resolveClose, reject) => compiler.close(e => e ? reject(e) : resolveClose())), 5000, 'COMPILER_CLOSE_TIMEOUT');
  compiler = null;
  const config = require(join(root, 'tailwind.config.js'));
  const css = await postcss([tailwindcss({ ...config, content: [component, entry] })])
    .process(await readFile(globals, 'utf8'), { from: globals });
  const js = await readFile(join(temp, 'control.js'));
  receipt.inputs = { consumer_sha256: hash(source), provider_sha256: hash(await readFile(provider)),
    global_css_sha256: hash(await readFile(globals)), compiled_css_sha256: hash(css.css),
    playwright: require('@playwright/test/package.json').version };
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (path === '/control.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); }
    else if (path === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
    else if (['/en', '/ro', '/fa'].includes(path)) {
      const lang = path.slice(1);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>CE synthetic viewport control</title><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/control.js"></script></body></html>`);
    } else { res.statusCode = 404; res.end(); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await bounded(new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); }), 5000, 'OWNED_LOOPBACK_BIND_TIMEOUT');
  origin = `http://127.0.0.1:${server.address().port}`;
}
function fixture(lang) {
  const word = { en: 'SYNTHETIC-NOTICE-', ro: 'ÎNȘTIINȚARE-SINTETICĂ-', fa: 'ابلاغیه‌آزمایشی‌' }[lang];
  const title = `${word}${'LongReference'.repeat(20)}`;
  const row = id => ({ id: `notice-${id}`, notice_number: id === 'A' ? 101 : 202,
    title_ro: `${id}-${title}`, title_en: `${id}-${title}`, title_fa: `${id}-${title}`,
    status: 'published', communication_type: 'general_announcement', legal_classification: 'informational_optional',
    source_module: 'general', created_at: '2026-01-01T00:00:00Z' });
  const body = id => `PRIVATE-SYNTHETIC-${id}\n${`${word} ${'UnbrokenBody'.repeat(20)}\n`.repeat(35)}`;
  return { row, detail: id => ({ notice: { ...row(id), body_ro: body(id), body_en: body(id), body_fa: body(id) },
    my_acknowledgement: null, statutory_evidence: [{ id: 'synthetic-evidence', evidence_type: 'noticeboard_posting',
      evidence_reference: `REF-${'SyntheticReference'.repeat(25)}`, occurred_at: '2026-01-01T00:00:00Z',
      verification_status: 'verified', verified_at: '2026-01-01T00:00:00Z', notes: 'Synthetic fixture only' }] }) };
}
async function hold() {
  let timer; let release;
  const promise = new Promise(resolveHold => {
    release = () => { clearTimeout(timer); releases.delete(release); resolveHold(); };
    releases.add(release); timer = setTimeout(release, 10_000);
  });
  return { promise, release };
}
async function pageGeometry(page) {
  return page.evaluate(() => {
    const measure = () => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth });
    const production = measure(); const previous = document.body.style.overflow;
    // Diagnostic only: the real global body overflow-x:hidden must not mask a
    // component defect. No global CSS file or consumer style is edited.
    document.body.style.overflow = 'visible'; const unclipped = measure();
    document.body.style.overflow = previous;
    return { production, unclipped };
  });
}
async function runCase(lang, width) {
  const t = copy[lang]; const data = fixture(lang);
  const record = { lang, viewport: { width, height: 740 }, checks: [], measurements: {} }; receipt.cases.push(record);
  const context = await browser.newContext({ viewport: record.viewport, locale: lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US',
    isMobile: width < 768, hasTouch: width < 768, serviceWorkers: 'block', acceptDownloads: false });
  contexts.add(context);
  const page = await context.newPage(); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => receipt.runtime_errors.push({ lang, width, name: error.name }));
  let mode = 'normal'; let held;
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) { receipt.network.external_attempts++; await route.abort(); return; }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    if (request.method() !== 'GET') { receipt.network.domain_mutations++; await route.abort(); return; }
    receipt.network.reads++;
    const id = url.searchParams.get('context_id') ?? 'A';
    let response;
    let status = 200;
    if (url.pathname.endsWith('/contexts')) response = { contexts: ['A', 'B'].map(context_id => ({ context_id, membership_id: `member-${context_id}`,
      tenant_name: `Synthetic ${context_id}`, role_code: 'association_admin', role_name: 'Administrator', scope_type: 'tenant', context_label: context_id })) };
    else if (url.pathname.endsWith('/dashboard')) response = { contextId: id };
    else if (url.pathname.endsWith('/notices')) {
      if (mode === 'deny-B' && id === 'B') { status = 403; response = { error: { code: 'SYNTHETIC_ACCESS_DENIED' } }; }
      else response = { total: 1, rows: [data.row(id)] };
      if (mode === 'late-list' && id === 'A') { held = await hold(); await held.promise; }
    } else if (/\/notices\/notice-[AB]$/.test(url.pathname)) {
      response = data.detail(id);
      if (mode === 'late-detail' && id === 'A') { held = await hold(); await held.promise; }
    } else { status = 404; response = { error: { code: 'SYNTHETIC_UNKNOWN_ENDPOINT' } }; }
    try { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(response) }); }
    catch { if (!request.failure() && !page.isClosed() && !aborted) receipt.runtime_errors.push({ lang, width, name: 'SYNTHETIC_ROUTE_FAILURE' }); }
  });
  const check = async (name, sourceLocation, test) => {
    try { await test(); record.checks.push({ name, status: 'PASS' }); }
    catch (e) { record.checks.push({ name, status: 'FAIL', source: sourceLocation, error: e.message.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 400) }); }
  };
  const geometry = async key => {
    const m = await pageGeometry(page); record.measurements[key] = m;
    for (const mode of ['production', 'unclipped']) {
      assert.ok(m[mode].document <= width + 1 && m[mode].body <= width + 1, `${key}/${mode}: PAGE overflow ${JSON.stringify(m[mode])}`);
    }
  };
  // Use the actual Provider's supported URL selector on each NEW document;
  // a previous fixture selection in sessionStorage must not change this setup.
  const reload = async () => { mode = 'normal'; await page.goto(`${origin}/${lang}?context=A`); await expect(page.locator('tbody tr')).toHaveCount(1); };
  const close = async () => { if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape'); };
  const reachable = async (locator, name) => {
    await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox();
    assert.ok(b, `${name}: bounding box`); record.measurements[name] = b;
    assert.ok(b.x >= -1 && b.x + b.width <= width + 1 && b.y >= -1 && b.y + b.height <= 741, `${name}: control outside viewport ${JSON.stringify(b)}`);
    assert.ok(b.width >= 43 && b.height >= 43, `${name}: touch target ${b.width}x${b.height}`);
  };
  const keyboard = async label => {
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeFocused();
    const first = dialog.locator('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)').first();
    const last = dialog.locator('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)').last();
    await first.focus(); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
    await page.keyboard.press('Tab'); await expect(first).toBeFocused();
    record.measurements[`${label}_keyboard`] = 'REAL_CHROMIUM_TAB_SHIFT_TAB';
  };
  try {
    await reload();
    await check('list-page-no-overflow-direction-and-real-horizontal-scroll', location.table, async () => {
      await geometry('list');
      assert.equal(await page.locator('#root > div').getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
      const region = page.getByRole('region').first(); await expect(region).toHaveAttribute('tabindex', '0');
      const m = await region.evaluate(el => { const before = el.scrollLeft; el.scrollLeft = 500; if (el.scrollLeft === before) el.scrollLeft = -500;
        return { client: el.clientWidth, scroll: el.scrollWidth, left: el.scrollLeft, width: el.getBoundingClientRect().width }; });
      record.measurements.table = m; assert.ok(m.scroll > m.client && Math.abs(m.left) > 0 && m.width <= width + 1, 'table scroll is contained and works in actual direction');
    });
    await check('long-detail-vertical-scroll-control-reachability', location.detail, async () => {
      await page.getByRole('button', { name: t.details, exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('PRIVATE-SYNTHETIC-A');
      const panel = page.getByRole('dialog').locator(':scope > div').first();
      const m = await panel.evaluate(el => { el.scrollTop = 100; return { client: el.clientHeight, scroll: el.scrollHeight, top: el.scrollTop, width: el.clientWidth }; });
      record.measurements.detail_panel = m; assert.ok(m.scroll > m.client && m.top > 0);
      await geometry('detail'); await reachable(page.getByRole('button', { name: t.close, exact: true }), 'detail_close');
      await reachable(page.getByRole('button', { name: t.evidence, exact: true }), 'detail_evidence_opener');
    });
    await check('detail-keyboard-escape-and-restoration', location.keyboard, async () => {
      await close(); const opener = page.getByRole('button', { name: t.details, exact: true });
      await opener.click(); await expect(page.getByRole('dialog')).toContainText('PRIVATE-SYNTHETIC-A');
      await keyboard('detail'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(opener).toBeFocused();
    });
    await check('evidence-form-scroll-reference-wrap-and-keyboard', location.evidence, async () => {
      await close(); await page.getByRole('button', { name: t.details, exact: true }).click();
      await page.getByRole('button', { name: t.evidence, exact: true }).click();
      await page.getByPlaceholder('e.g. PV-2026/09, AWB RO12345678').fill(`SYNTHETIC-${'Reference'.repeat(40)}`);
      await geometry('evidence'); await reachable(page.getByRole('button', { name: t.submit, exact: true }), 'evidence_submit');
      await reachable(page.getByRole('button', { name: t.close, exact: true }).first(), 'evidence_dialog_close');
      await page.getByRole('dialog').focus(); await keyboard('evidence'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    });
    await check('create-dialog-vertical-scroll-controls-and-keyboard', location.create, async () => {
      await close(); await page.getByRole('button', { name: t.create, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await keyboard('create');
      // Exercise the real optional translation controls so content genuinely
      // exceeds the panel even at tablet width; fitting content is not a defect.
      await dialog.locator('summary').click();
      await dialog.focus(); await keyboard('create_translations_expanded');
      const panel = dialog.locator(':scope > div').first(); const m = await panel.evaluate(el => { el.scrollTop = 100; return { client: el.clientHeight, scroll: el.scrollHeight, top: el.scrollTop }; });
      record.measurements.create_panel = m; assert.ok(m.scroll > m.client && m.top > 0, 'expanded create content scrolls vertically');
      await geometry('create'); await reachable(page.getByRole('button', { name: t.save, exact: true }), 'create_save');
      await reachable(page.getByRole('button', { name: t.close, exact: true }).first(), 'create_close');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: t.create, exact: true })).toBeFocused();
    });
    await check('late-list-context-isolation-current-denied', location.privacy, async () => {
      await close(); mode = 'late-list'; held = null;
      await page.reload(); await expect.poll(() => Boolean(held)).toBe(true);
      const pendingA = held; mode = 'deny-B'; await page.keyboard.press('Alt+2');
      await expect(page.locator('[data-fixture-active]')).toHaveText('B');
      await expect(page.getByRole('alert')).toContainText(t.error); pendingA.release();
      await expect(page.locator('tbody tr')).toHaveCount(0); await expect(page.locator('body')).not.toContainText('PRIVATE-SYNTHETIC-A');
      await page.keyboard.press('Alt+0'); await expect(page.locator('[data-fixture-active]')).toHaveText('none');
      await expect(page.locator('tbody tr')).toHaveCount(0);
    });
    await check('loaded-private-detail-hidden-before-next-context-read', location.privacy, async () => {
      await reload(); await page.getByRole('button', { name: t.details, exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('PRIVATE-SYNTHETIC-A');
      mode = 'deny-B'; await page.keyboard.press('Alt+2');
      assert.equal((await page.locator('body').innerText()).includes('PRIVATE-SYNTHETIC-A'), false, 'loaded previous private body hidden on Context change');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('alert')).toContainText(t.error);
    });
    await check('late-detail-context-isolation-real-abort', location.privacy, async () => {
      await reload(); mode = 'late-detail'; held = null;
      await page.getByRole('button', { name: t.details, exact: true }).click(); await expect.poll(() => Boolean(held)).toBe(true);
      const pendingA = held; mode = 'deny-B'; await page.keyboard.press('Alt+2');
      await expect(page.locator('[data-fixture-active]')).toHaveText('B'); await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('alert')).toContainText(t.error); pendingA.release();
      await expect(page.locator('body')).not.toContainText('PRIVATE-SYNTHETIC-A');
      await geometry('denied');
    });
    await check('zero-read-driven-domain-mutations-and-external-requests', location.privacy, async () => {
      assert.equal(receipt.network.domain_mutations, 0); assert.equal(receipt.network.external_attempts, 0);
    });
  } finally {
    for (const release of [...releases]) release();
    try { await page.evaluate(() => window.disposeViewportControl()); } catch { /* Page/browser may already be closing on deadline. */ }
    await context.close(); contexts.delete(context);
  }
}
const cancel = () => { aborted = true; for (const release of [...releases]) release(); void browser?.close(); };
process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
try {
  deadline = setTimeout(cancel, 240_000);
  const path = await executable(); receipt.browser_executable = path;
  await build();
  browser = await chromium.launch({ executablePath: path, headless: true, timeout: 20_000 });
  receipt.browser = browser.version();
  if (injectFailure) {
    const context = await browser.newContext(); contexts.add(context); await context.newPage();
    throw new Error('INJECTED_OWNED_RESOURCE_FAILURE');
  }
  for (const lang of ['en', 'ro', 'fa']) for (const width of [320, 390, 768]) {
    if (aborted) throw new Error('BOUNDED_PROOF_DEADLINE_OR_SIGNAL');
    await runCase(lang, width);
  }
  receipt.status = receipt.cases.some(c => c.checks.some(x => x.status === 'FAIL')) || receipt.runtime_errors.length ? 'FAILED_NOT_PASS' : 'PASS_VIEWPORT_CONTROL_ONLY';
} catch (error) {
  receipt.status = injectFailure && error.message === 'INJECTED_OWNED_RESOURCE_FAILURE'
    ? 'INJECTED_FAILURE_AWAITING_CLEANUP' : 'BLOCKED_OR_RUNTIME_FAILURE_NOT_PASS';
  receipt.failure = { name: error.name, message: error.message.slice(0, 500) };
} finally {
  clearTimeout(deadline); const cleanup = [];
  for (const release of [...releases]) release();
  receipt.contexts_before_final_cleanup = contexts.size;
  for (const context of contexts) try { await bounded(context.close(), 5000, 'CONTEXT_CLOSE_TIMEOUT'); assert.equal(context.pages().length, 0); } catch { cleanup.push('CONTEXT_CLOSE_FAILED'); }
  contexts.clear();
  if (browser) try { await bounded(browser.close(), 5000, 'BROWSER_CLOSE_TIMEOUT'); assert.equal(browser.isConnected(), false); receipt.browser_closed = true; } catch { cleanup.push('BROWSER_CLOSE_FAILED'); }
  if (compiler) try { await bounded(new Promise(yes => compiler.close(yes)), 5000, 'COMPILER_CLOSE_TIMEOUT'); } catch { cleanup.push('COMPILER_CLOSE_FAILED'); }
  if (server) try {
    server.closeAllConnections(); await bounded(new Promise(yes => server.close(yes)), 5000, 'SERVER_CLOSE_TIMEOUT'); assert.equal(server.listening, false);
    if (origin) await bounded(new Promise((yes, no) => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(new URL(origin).port) });
      socket.once('connect', () => { socket.destroy(); no(new Error('OWNED_PORT_STILL_LIVE')); });
      socket.once('error', error => { socket.destroy(); if (error.code === 'ECONNREFUSED') yes(); else no(error); });
      socket.setTimeout(800, () => { socket.destroy(); no(new Error('OWNED_PORT_PROBE_TIMEOUT')); });
    }), 1000, 'OWNED_PORT_PROBE_TIMEOUT');
    receipt.owned_port_closed = true;
  } catch { cleanup.push('OWNED_SERVER_CLOSE_FAILED'); }
  if (temp) try { await rm(temp, { recursive: true, force: true }); await assert.rejects(access(temp), { code: 'ENOENT' }); receipt.owned_temp_removed = true; } catch { cleanup.push('OWNED_TEMP_CLEANUP_FAILED'); }
  process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  receipt.cleanup = cleanup.length ? cleanup : 'PASS_OWNED_BROWSER_CONTEXT_SERVER_TIMERS_TEMP';
  if (cleanup.length || aborted) receipt.status = 'FAILED_NOT_PASS';
  else if (receipt.status === 'INJECTED_FAILURE_AWAITING_CLEANUP') receipt.status = 'PASS_INJECTED_FAILURE_CLEANUP_ONLY';
  console.log(JSON.stringify(receipt, null, 2));
}
if (!['PASS_VIEWPORT_CONTROL_ONLY', 'PASS_INJECTED_FAILURE_CLEANUP_ONLY'].includes(receipt.status)) process.exitCode = 1;
