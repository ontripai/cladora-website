import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// A standalone loopback React/component/HTTP control. Not Next/Auth/API/RPC/DB E2E.
const require = createRequire(import.meta.url), repo = fileURLToPath(new URL('../', import.meta.url));
let chromium;
try { ({ chromium } = require('playwright')); } catch { throw new Error('NOT_RUN: installed Playwright is required; do not install or borrow a stack'); }
const { webpack } = require('next/dist/compiled/webpack/webpack');
const directory = await mkdtemp(join(tmpdir(), 'airprop-body-control-'));
let browser, server, compiler, origin, scenario, passed = 0, offOrigin = 0, mutations = 0;
const contexts = new Set(), sockets = new Set(), timers = new Set();
const context = '11111111-1111-4111-8111-111111111111', workspace = '22222222-2222-4222-8222-222222222222';
const errorCopy = { en: 'Unable to load this workspace.', ro: 'Workspace-ul nu poate fi încărcat.', fa: 'اطلاعات ورک‌اسپیس دریافت نشد.' };
const unavailable = { en: 'The managed portfolio is currently unavailable.', ro: 'Portofoliul administrat nu este disponibil momentan.', fa: 'سبد تحت مدیریت در حال حاضر در دسترس نیست.' };
const emptyB2 = { en: 'No currently authorized managed property.', ro: 'Nicio proprietate administrată autorizată în prezent.', fa: 'ملک تحت مدیریتِ مجاز فعلی وجود ندارد.' };
const emptyView = { version: 1, idempotent: true, as_of: '2026-10-20T12:00:00Z', properties: [], operations: { detail_owner: 'Operations', mode: 'canonical_references_only' }, finance: { detail_owner: 'Finance', mode: 'not_connected', reason: 'canonical_receipt_contract_unavailable' } };
async function bounded(promise, milliseconds, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function waitFor(predicate, milliseconds, label) {
  let interval;
  try { await bounded(new Promise(done => { interval = setInterval(() => { if (predicate()) done(); }, 10); if (predicate()) done(); }), milliseconds, label); }
  finally { clearInterval(interval); }
}
try {
  const stub = join(directory, 'stub.js'), provider = join(directory, 'provider.js'), entry = join(directory, 'entry.js'), loader = join(directory, 'loader.cjs');
  await writeFile(stub, 'export const CustomerAirpropDiligence=()=>null; export const CustomerAirpropUnderwriting=()=>null;');
  await writeFile(provider, `export const useCustomerContext=()=>({active:{context_id:${JSON.stringify(context)}},registerUnsavedGuard:()=>()=>{}});`);
  await writeFile(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
  await writeFile(entry, `import React from 'react';import {createRoot} from 'react-dom/client';
import {CustomerAirpropWorkspace} from ${JSON.stringify(resolve(repo, 'src/components/customer/CustomerAirpropWorkspace.tsx'))};
import {CustomerAirpropB2Workspace} from ${JSON.stringify(resolve(repo, 'src/components/customer/CustomerAirpropB2.tsx'))};
const query=new URLSearchParams(location.search),root=createRoot(document.getElementById('root'));
root.render(React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>root.unmount(),'data-unmount':true},'Unmount'),query.get('lane')==='b2'?React.createElement(CustomerAirpropB2Workspace,{lang:query.get('lang'),contextId:${JSON.stringify(context)},workspaceId:${JSON.stringify(workspace)}}):React.createElement(CustomerAirpropWorkspace,{lang:query.get('lang')})));
`);
  compiler = webpack({ mode: 'development', target: 'web', entry, devtool: false, output: { path: directory, filename: 'bundle.js' },
    resolve: { extensions: ['.js', '.ts', '.tsx'], modules: [resolve(repo, 'node_modules'), 'node_modules'], alias: { '@': resolve(repo, 'src'), './CustomerContextProvider': provider, './CustomerAirpropDiligence': stub, './CustomerAirpropUnderwriting': stub } },
    module: { rules: [{ test: /\.tsx?$/, use: loader }] }, optimization: { minimize: false },
  });
  await bounded(new Promise((resolveBuild, reject) => compiler.run((error, stats) => {
    if (error || stats.hasErrors()) reject(new Error('Component control bundle failed; no runtime proof'));
    else resolveBuild();
  })), 45000, 'Component control bundle deadline');
  await bounded(new Promise((done, reject) => compiler.close(error => error ? reject(error) : done())), 5000, 'Compiler close deadline'); compiler = null;
  const bundle = await readFile(join(directory, 'bundle.js'));
  server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method !== 'GET') { mutations++; response.writeHead(405).end(); return; }
    if (path === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'none'; frame-src 'none'" }).end('<meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>'); return; }
    if (path === '/bundle.js') { response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }).end(bundle); return; }
    if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
    const lane = path.endsWith('/targets') ? 'targets' : path.endsWith('/artifact-b2') ? 'b2' : path.endsWith('/opportunities') ? 'opportunities' : null;
    if (!lane || !path.startsWith('/api/customer/')) { response.writeHead(404).end(); return; }
    scenario.requests.push(lane);
    if (lane !== scenario.lane || scenario.kind === 'success') {
      const data = lane === 'targets' ? { workspaces: [{ workspace_id: workspace, environment: 'TEST' }] } : lane === 'opportunities' ? { opportunities: [] } : { artifact_id: 'AIRPROP-ARTIFACT-B2-20261013-R1', commands: null, can_edit: false, state: 'pre_activation', view: emptyView };
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(data)); return;
    }
    const own = scenario;
    response.on('close', () => { own.closed++; if (!response.writableFinished) own.cancelled++; });
    response.writeHead(own.kind === 'server' ? 500 : 403, { 'content-type': own.kind === 'html' ? 'text/html' : 'application/json', 'cache-control': 'no-store' });
    if (own.kind === 'pending' || own.kind === 'unmount') { response.write('{"error":'); return; }
    if (own.kind === 'oversize') { response.write('x'.repeat(20000)); return; }
    const raw = own.kind === 'html' ? '<html>DO_NOT_EXPOSE_BACKEND_TEXT</html>' : JSON.stringify({ error: { code: lane === 'b2' ? 'AIRPROP_PRE_ACTIVATION' : 'AIRPROP_ACCESS_DENIED', message: 'DO_NOT_EXPOSE_BACKEND_TEXT' } });
    response.write(raw.slice(0, 8));
    const timer = setTimeout(() => { timers.delete(timer); if (!response.destroyed) response.end(raw.slice(8)); }, 40); timers.add(timer);
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const allowedEnv = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'TZ', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS'];
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, timeout: 15000, env: Object.fromEntries(allowedEnv.filter(key => process.env[key]).map(key => [key, process.env[key]])) });
  for (const lang of ['en', 'ro', 'fa']) for (const lane of ['targets', 'opportunities', 'b2']) for (const kind of ['denied', 'server', 'html', 'pending', 'oversize', 'unmount', 'success']) {
    scenario = { lang, lane, kind, requests: [], cancelled: 0, closed: 0 };
    const ownedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.add(ownedContext);
    await ownedContext.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { offOrigin++; return route.abort(); } return route.continue(); });
    try {
      const page = await ownedContext.newPage(); page.setDefaultTimeout(5000);
      await page.goto(`${origin}/?lane=${lane}&lang=${lang}`, { waitUntil: 'domcontentloaded' });
      if (lane === 'opportunities') await page.locator('label select').first().selectOption(workspace);
      if (kind === 'unmount') {
        await page.waitForFunction(() => document.querySelectorAll('[role="alert"]').length === 0);
        // Wait for the server-observed original request, without reading/cloning its Response in the harness.
        await waitFor(() => scenario.requests.includes(lane), 2000, 'Original request absent');
        await page.locator('[data-unmount]').click();
      } else if (kind !== 'success') {
        await page.getByText(lane === 'b2' ? unavailable[lang] : errorCopy[lang], { exact: true }).waitFor();
      } else if (lane === 'targets') await page.locator('label select').first().waitFor();
      else if (lane === 'opportunities') await page.locator('form').waitFor();
      else await page.getByText(emptyB2[lang], { exact: true }).waitFor();
      if (['pending', 'oversize', 'unmount'].includes(kind)) await waitFor(() => scenario.cancelled > 0, 2500, 'Owned stream was not cancelled');
      assert.equal(scenario.requests.filter(requestLane => requestLane === lane).length, 1, 'only one original error/success GET');
      assert.equal(await page.getByText('DO_NOT_EXPOSE_BACKEND_TEXT', { exact: false }).count(), 0);
      if (lang === 'fa' && kind !== 'unmount') assert.equal(await page.locator('section').first().getAttribute('dir'), 'rtl');
      assert.equal(offOrigin, 0); assert.equal(mutations, 0); passed++;
    } finally { await bounded(ownedContext.close(), 5000, 'Owned browser context close deadline'); contexts.delete(ownedContext); }
  }
  console.log(`PASS ${passed} standalone Chromium loopback component/HTTP controls; actual browser fetch unchanged, one original GET, error streams cancelled, EN/RO/FA/RTL; viewport emulation only; Next/Auth/API/RPC/DB and physical devices NOT_RUN`);
} finally {
  const cleanup = [];
  for (const timer of timers) clearTimeout(timer);
  for (const owned of contexts) { try { await bounded(owned.close(), 5000, 'Context cleanup deadline'); } catch { cleanup.push('context'); } }
  if (browser) { try { await bounded(browser.close(), 5000, 'Browser cleanup deadline'); } catch { cleanup.push('browser'); } }
  for (const socket of sockets) socket.destroy();
  if (server?.listening) { try { await bounded(new Promise((done, reject) => server.close(error => error ? reject(error) : done())), 5000, 'Server cleanup deadline'); } catch { cleanup.push('server'); } }
  if (compiler) { try { await bounded(new Promise(done => compiler.close(done)), 5000, 'Compiler cleanup deadline'); } catch { cleanup.push('compiler'); } }
  await rm(directory, { recursive: true, force: true });
  if (cleanup.length) throw new Error(`Owned cleanup failed: ${cleanup.join(',')}`);
}
