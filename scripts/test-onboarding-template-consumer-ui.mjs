import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

// Mounted real consumer and Wizard; all transports are fake. No socket/server,
// Supabase client, credential or browser startup is used by this test.
const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', {url: 'https://cladora.test'});
const saved = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, navigator: dom.window.navigator, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022}}).outputText, filename);
  return mod.exports;
}
const ctx = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const membership = '20000000-0000-4000-8000-000000000001';
const workspace = '30000000-0000-4000-8000-000000000001';
const activeContext = () => ({active: {context_id: ctx, membership_id: membership}, dashboard: {contextId: ctx, workspace_id: workspace}, loading: false, error: null, registerUnsavedGuard});
const guards = new Map();
function registerUnsavedGuard(key, dirty, discard) {
  if (dirty) guards.set(key, discard); else guards.delete(key);
  return () => { if (guards.get(key) === discard) guards.delete(key); };
}
let context = activeContext();
let calls = [], downloads = [], revoked = [], allocated = [], answer;
const csvText = '\uFEFF"unit_code","area_m2"\r\n';
const template = {code: 'unit', name: 'Synthetic unit template', description: 'Synthetic columns only', version: 2, format: 'csv', schema: {headers: ['unit_code', 'area_m2']}, max_rows: 10000};
const response = (data, status = 200) => ({ok: status >= 200 && status < 300, status, redirected: false, json: async () => structuredClone(data)});
const csv = (text = csvText, type = 'text/csv; charset=utf-8') => ({...response(null), headers: new Headers({'content-type': type}), blob: async () => new Blob([text], {type})});
const fakeFetch = async (url, options = {}) => {
  calls.push({url: String(url), options});
  assert.equal(options.method ?? 'GET', 'GET', 'template transport never mutates');
  assert.match(String(url), /^\/api\/customer\/v1\/onboarding\/templates(?:\?|\/unit\/download\?)/);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  return answer(String(url), options);
};
const importSchema = load('src/lib/customer/onboarding-import-schema.ts');
const contextMock = {useCustomerContext: () => context};
const {CustomerOnboardingTemplates: Templates} = load('src/components/customer/CustomerOnboardingTemplates.tsx', {
  './CustomerContextProvider': contextMock,
  '@/components/dashboard-lab/DashboardTransport': {useDashboardFetch: () => fakeFetch},
  '@/lib/customer/onboarding-import-schema': importSchema,
});
const setupSchema = load('src/lib/customer/building-setup-schema.ts');
const setupHelper = load('src/lib/customer/building-workspace-onboarding.ts', {'./building-setup-schema': setupSchema});
const {CustomerBuildingSetupWizard: Wizard} = load('src/components/customer/CustomerBuildingSetupWizard.tsx', {
  './CustomerContextProvider': contextMock,
  './CustomerOnboardingTemplates': {CustomerOnboardingTemplates: Templates},
  './CustomerBuildingSetupProgress': {CustomerBuildingSetupProgress: () => null},
  '@/lib/customer/building-setup-schema': setupSchema,
  '@/lib/customer/building-workspace-onboarding': setupHelper,
  'next/link': ({href, children, ...props}) => React.createElement('a', {href, ...props}, children),
});
const originalFetch = globalThis.fetch;
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
const originalClick = dom.window.HTMLAnchorElement.prototype.click;
URL.createObjectURL = blob => { allocated.push(blob); return `blob:synthetic-${allocated.length}`; };
URL.revokeObjectURL = url => revoked.push(url);
dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({href: this.href, filename: this.download}); };
// Any accidental native/product request is rejected without network access.
globalThis.fetch = () => { throw Error('Unexpected native transport'); };
let root = createRoot(document.getElementById('root'));
let checks = 0;
function eq(actual, expected, message) { checks++; assert.deepEqual(actual, expected, message); }
function ok(value, message) { checks++; assert.ok(value, message); }
const listUrl = `/api/customer/v1/onboarding/templates?context_id=${ctx}`;
const downloadUrl = `/api/customer/v1/onboarding/templates/unit/download?context_id=${ctx}`;
const ui = {
  en: {title: 'Import templates', reload: 'Reload templates', download: 'Download CSV', denial: 'Template access is no longer available.', empty: 'No templates are currently available.', error: 'Templates could not be verified.'},
  ro: {title: 'Șabloane de import', reload: 'Reîncarcă șabloanele', download: 'Descarcă CSV', denial: 'Accesul la șabloane nu mai este disponibil.', empty: 'Nu există șabloane disponibile', error: 'Șabloanele nu au putut fi verificate.'},
  fa: {title: 'قالب‌های ورود اطلاعات', reload: 'دریافت دوباره قالب‌ها', download: 'دریافت CSV', denial: 'دسترسی به قالب‌ها دیگر برقرار نیست.', empty: 'در حال حاضر قالبی در دسترس نیست.', error: 'قالب‌ها تأیید نشدند.'},
};
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.startsWith(text));
const render = async (lang = 'en', component = Templates, strict = false) => act(async () => root.render(strict ? React.createElement(React.StrictMode, null, React.createElement(component, {lang})) : React.createElement(component, {lang})));
const click = async text => act(async () => button(text).click());
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
async function reset() {
  await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  context = activeContext(); calls = []; downloads = []; allocated = []; revoked = []; sessionStorage.clear(); guards.clear();
  answer = async url => url.includes('/download?') ? csv() : response([template]);
}
try {
  for (const lang of ['en', 'ro', 'fa']) {
    await reset(); await render(lang);
    eq(calls.map(c => c.url), [listUrl]);
    eq(downloads.length, 0, 'mount has no automatic download');
    eq(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
    eq(document.querySelector('section').getAttribute('aria-label'), ui[lang].title);
    ok(document.body.textContent.includes(template.name));
    ok(document.body.textContent.includes('10000'));
    eq(button(ui[lang].download).type, 'button');
    button(ui[lang].download).focus(); eq(document.activeElement, button(ui[lang].download), 'native button is keyboard focusable');
    await act(async () => document.activeElement.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true, detail: 0})));
    eq(calls.map(c => c.url), [listUrl, downloadUrl], 'explicit keyboard-style activation downloads canonical same-context CSV');
    eq(downloads, [{href: 'blob:synthetic-1', filename: 'cladora-unit.csv'}]);
    eq(await allocated[0].text(), csvText.replace(/^\uFEFF/, ''));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1)); });
    eq(revoked, ['blob:synthetic-1'], 'temporary download URL released');
    ok(document.querySelector('ul').className.includes('sm:grid-cols-2'), 'responsive grid is source-tested, not a browser layout claim');
    ok(button(ui[lang].download).className.includes('min-h-11'), 'mobile target size class');
    eq(document.querySelector('bdi').dir, 'ltr');

    await reset(); answer = async () => response([]); await render(lang);
    ok(document.body.textContent.includes(ui[lang].empty)); eq(button(ui[lang].download), undefined);
    answer = async () => response([template]); await click(ui[lang].reload); ok(button(ui[lang].download));
    for (const status of [401, 403]) {
      answer = async () => response(null, status); await click(ui[lang].download);
      ok(document.body.textContent.includes(ui[lang].denial));
      eq(document.body.textContent.includes(template.name), false, 'denial removes template metadata and actions');
      eq(button(ui[lang].download), undefined); eq(downloads.length, 0);
      const before = calls.length; await render(lang); eq(calls.length, before, 'denial does not automatically reload');
      answer = async () => response([template]); await click(ui[lang].reload);
      ok(button(ui[lang].download)); eq(downloads.length, 0, 'reauthorized list does not download');
    }
    answer = async () => response(null, 503); await click(ui[lang].reload);
    ok(document.body.textContent.includes(ui[lang].error));
    eq(document.body.textContent.includes(ui[lang].denial), false, '5xx is not a denial');
    eq(document.body.textContent.includes(template.name), false);
    answer = async () => { throw Error('Synthetic offline'); }; await click(ui[lang].reload);
    ok(document.body.textContent.includes(ui[lang].error));
    answer = async () => response([template]); await click(ui[lang].reload); ok(button(ui[lang].download));
  }

  // The actual GET shape and configure schema allowlist: no inferred URLs,
  // unknown format/code, missing metadata, duplicate template/header or foreign envelope.
  const invalid = [null, {}, {templates: [template]}, [{...template, code: '../unit'}], [{...template, code: 'future_kind'}], [{...template, format: 'html'}], [{...template, version: 0}], [{...template, max_rows: undefined}], [{...template, max_rows: 100001}], [{...template, name: ''}], [{...template, description: 4}], [{...template, schema: {headers: ['id']}}], [{...template, schema: {headers: ['unit_code', 'unit_code']}}], [{...template, schema: {headers: ['unit_code', '=FORMULA']}}], [template, template], [{...template, context_id: other}], [{...template, download_url: 'https://foreign.test/secret'}]];
  for (const data of invalid) {
    await reset(); answer = async () => response(data); await render();
    eq(document.querySelector('li'), null, 'invalid response fails closed');
    eq(button(ui.en.download), undefined); eq(downloads.length, 0); ok(document.body.textContent.includes(ui.en.error));
  }
  await reset();
  const codes = importSchema.configureImportTemplateSchema.shape.code.options;
  answer = async () => response(codes.map(code => ({...template, code, name: `Synthetic ${code}`})));
  await render(); eq(document.querySelectorAll('li').length, codes.length, 'all canonical template codes are consumable');
  eq(downloads.length, 0);
  await reset(); answer = async () => response([{...template, format: 'xlsx_template_only'}]); await render();
  ok(button(ui.en.download), 'canonical CSV header download also supports xlsx-template-only metadata');
  for (const status of [401, 403]) {
    await reset(); answer = async () => response(null, status); await render();
    ok(document.body.textContent.includes(ui.en.denial)); eq(document.querySelector('li'), null);
  }
  for (const bad of [csv('<html>login</html>', 'text/html'), csv('"unit_code","wrong"\r\n'), csv('"unit_code","area_m2"\r\n"secret","1"\r\n'), {...csv(), redirected: true}, response(null, 404)]) {
    await reset(); await render(); answer = async () => bad; await click(ui.en.download);
    eq(downloads.length, 0); eq(allocated.length, 0); eq(document.querySelector('li'), null); ok(document.body.textContent.includes(ui.en.error));
  }
  for (const data of [() => { throw new DOMException('Synthetic abort', 'AbortError'); }, () => ({...csv(), blob: async () => { throw Error('Synthetic body failure'); }}), () => ({...csv(), blob: async () => ({size: 32769, text: async () => csvText})})]) {
    await reset(); await render(); answer = async () => data(); await click(ui.en.download);
    eq(downloads.length, 0); eq(allocated.length, 0); ok(document.body.textContent.includes(ui.en.error));
  }
  // StrictMode cancellation and same-instance language change do not unlock a busy operation.
  await reset(); await render('en', Templates, true); ok(button(ui.en.download));
  await reset(); const pending = defer(); answer = async () => pending.promise;
  await render(); eq(document.querySelector('section').getAttribute('aria-busy'), 'true');
  await render('fa'); eq(calls.length, 1, 'locale does not restart the list effect');
  eq(button(ui.fa.reload).disabled, true);
  await act(async () => pending.resolve(response([template]))); ok(button(ui.fa.download));
  const heldDownload = defer(); answer = async () => heldDownload.promise;
  await act(async () => { button(ui.fa.download).click(); button(ui.fa.download).click(); });
  eq(calls.length, 2, 'synchronous double activation dispatches one download');
  await render('ro'); eq(button(ui.ro.download).disabled, true); eq(button(ui.ro.reload).disabled, true);
  await act(async () => heldDownload.resolve(csv())); eq(downloads.length, 1);

  // Scope changes fence BOTH network resolution and delayed body decoding;
  // fake transport deliberately ignores AbortSignal to test ownership guards.
  for (const dimension of ['context', 'membership', 'workspace', 'loading', 'error', 'none', 'foreign-dashboard', 'invalid-context', 'invalid-membership', 'invalid-workspace']) {
    await reset(); const late = defer(); answer = async () => ({...response(null), json: () => late.promise});
    await render(); const oldSignal = calls[0].options.signal;
    answer = async () => response([]);
    if (dimension === 'context') context = {...context, active: {...context.active, context_id: other}, dashboard: {...context.dashboard, contextId: other}};
    if (dimension === 'membership') context = {...context, active: {...context.active, membership_id: other}};
    if (dimension === 'workspace') context = {...context, dashboard: {...context.dashboard, workspace_id: other}};
    if (dimension === 'loading') context = {...context, loading: true};
    if (dimension === 'error') context = {...context, error: 'denied'};
    if (dimension === 'none') context = {...context, active: null};
    if (dimension === 'foreign-dashboard') context = {...context, dashboard: {...context.dashboard, contextId: other}};
    if (dimension === 'invalid-context') context = {...context, active: {...context.active, context_id: '../foreign'}};
    if (dimension === 'invalid-membership') context = {...context, active: {...context.active, membership_id: 'invalid'}};
    if (dimension === 'invalid-workspace') context = {...context, dashboard: {...context.dashboard, workspace_id: 'invalid'}};
    const countBefore = calls.length;
    await render(); ok(oldSignal.aborted);
    if (['loading', 'error', 'none', 'foreign-dashboard', 'invalid-context', 'invalid-membership', 'invalid-workspace'].includes(dimension)) eq(calls.length, countBefore, 'unverified scope dispatches no request');
    await act(async () => late.resolve([template]));
    eq(document.body.textContent.includes(template.name), false, `late JSON cannot restore ${dimension} scope`);
    eq(downloads.length, 0);
  }
  for (const phase of ['network', 'blob', 'text']) {
    await reset(); await render(); const late = defer();
    answer = async () => phase === 'network' ? late.promise : {...csv(), blob: async () => phase === 'blob' ? late.promise : {size: 50, text: () => late.promise}};
    await click(ui.en.download); const signal = calls.at(-1).options.signal;
    context = {...context, active: {...context.active, membership_id: other}};
    answer = async () => response(null, 403); await render();
    ok(signal.aborted);
    await act(async () => late.resolve(phase === 'network' ? csv() : phase === 'blob' ? new Blob([csvText]) : csvText));
    eq(downloads.length, 0); eq(allocated.length, 0); ok(document.body.textContent.includes(ui.en.denial));
  }
  await reset(); const unmounted = defer(); answer = async () => unmounted.promise; await render();
  const signal = calls[0].options.signal; await act(async () => root.unmount());
  ok(signal.aborted); await act(async () => unmounted.resolve(response([template]))); eq(downloads.length, 0);
  root = createRoot(document.getElementById('root'));

  // Wizard integration: panel read failures/locale operations do not change
  // dirty draft values, Context guard or the exact unresolved command/key.
  for (const lang of ['en', 'ro', 'fa']) {
    await reset(); await render(lang, Wizard);
    const input = document.querySelector('fieldset input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'Synthetic unsaved association');
      input.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    });
    ok(guards.size > 0, 'Wizard unsaved guard registered');
    answer = async () => response(null, 403); await click(ui[lang].reload);
    eq(input.value, 'Synthetic unsaved association');
    const create = lang === 'en' ? 'Create draft' : lang === 'ro' ? 'Creează proiect' : 'ایجاد پیش‌نویس';
    let writes = 0;
    globalThis.fetch = async (_url, options = {}) => { if (options.method === 'POST') { writes++; throw Error('Synthetic uncertain creation'); } return response({attempt: null}); };
    await click(create); eq(writes, 1);
    const key = setupHelper.setupStorageKey(ctx, membership, workspace);
    const stored = sessionStorage.getItem(key); ok(stored); const original = JSON.parse(stored).pending.command;
    eq(original.payload.association.name, 'Synthetic unsaved association');
    answer = async url => url.includes('/download?') ? csv() : response([template]); await click(ui[lang].reload);
    await click(ui[lang].download); eq(downloads.length, 1, 'Wizard exposes canonical CSV consumer');
    eq(sessionStorage.getItem(key), stored, 'template action retains exact Wizard pending evidence');
    await render(lang === 'fa' ? 'en' : 'fa', Wizard);
    eq(document.querySelector('fieldset input').value, 'Synthetic unsaved association');
    eq(sessionStorage.getItem(key), stored); eq(writes, 1, 'no replay/new write from template or locale changes');
    ok(guards.size > 0); eq(JSON.parse(stored).pending.command.idempotency_key, original.idempotency_key);
    const check = lang === 'fa' ? 'Check saved access and status' : 'بررسی دسترسی و وضعیت ذخیره‌شده';
    globalThis.fetch = async () => response(null, 403);
    await click(check);
    eq(document.querySelector('fieldset'), null, 'Wizard denial clears display including template panel');
    eq(button(ui[lang].download), undefined); eq(sessionStorage.getItem(key), stored);
    globalThis.fetch = async () => response({attempt: null});
    await click(check);
    ok(document.querySelector('fieldset'), 'explicit authorized read restores Wizard');
    eq(sessionStorage.getItem(key), stored); eq(writes, 1);
    globalThis.fetch = () => { throw Error('Unexpected native transport'); };
  }
  console.log(`PASS onboarding template consumer: ${checks} mounted assertions; fake GET/download transport, EN/RO/FA, Wizard integration; real HTTP/DB/Auth/browser NOT_RUN_NOT_PASS`);
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  dom.window.HTMLAnchorElement.prototype.click = originalClick;
  dom.window.close();
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
