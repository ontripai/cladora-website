import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', {url: 'https://cladora.test'});
const globals = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, navigator: dom.window.navigator, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true})) {
  globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
const React = await import('react');
const {act} = React;
const commitRaceOnly = process.env.BUILDING_SETUP_COMMIT_RACE_ONLY === '1';
let commitTrace = null;
// Observe the real hooks without replacing their scheduler or cleanup behavior.
// This transparent test adapter must forward the production hook dependency array.
/* eslint-disable react-hooks/exhaustive-deps */
const observedReact = {...require('react'), useEffect(effect, deps) {
  return React.useEffect(() => { const cleanup = effect(); return typeof cleanup === 'function' ? () => { commitTrace?.push('wizard-passive-cleanup'); cleanup(); } : cleanup; }, deps);
}, useLayoutEffect(effect, deps) {
  return React.useLayoutEffect(() => { const cleanup = effect(); return typeof cleanup === 'function' ? () => { commitTrace?.push('wizard-layout-cleanup'); cleanup(); } : cleanup; }, deps);
}};
/* eslint-enable react-hooks/exhaustive-deps */
const {createRoot} = await import('react-dom/client');
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url)), mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText, filename);
  return mod.exports;
}
const schema = load('src/lib/customer/building-setup-schema.ts');
const helper = load('src/lib/customer/building-workspace-onboarding.ts', {'./building-setup-schema': schema});
const {CustomerBuildingSetupProgress: Progress} = load('src/components/customer/CustomerBuildingSetupProgress.tsx');
const ctx = '10000000-0000-4000-8000-000000000001', member = '20000000-0000-4000-8000-000000000001';
const workspace = '30000000-0000-4000-8000-000000000001', run = '40000000-0000-4000-8000-000000000001';
const property = '50000000-0000-4000-8000-000000000001', other = '60000000-0000-4000-8000-000000000001';
const guards = new Map();
const registerUnsavedGuard = (key, dirty, discard) => {
  if (dirty) guards.set(key, discard); else guards.delete(key);
  return () => { if (guards.get(key) === discard) guards.delete(key); };
};
let context, calls, row, receipts, readHandler, writeHandler, posts, lookupHandler;
const contextValue = () => ({active: {context_id: ctx, membership_id: member}, dashboard: {contextId: ctx, workspace_id: workspace}, loading: false, error: null, registerUnsavedGuard});
const payload = () => ({association: {name: 'Synthetic Association'}, building: {name: 'Synthetic Progress Building', code: 'TEST-A', floors: 2}, currency: 'RON', period_start: '2026-01-01', period_end: '2026-12-31', units: [{code: 'A-01', floor: 0, area_m2: 62}], opening_balances: []});
const savedRow = (status = 'draft') => {
  const revision = {draft: 1, rehearsed: 2, submitted: 3, approved: 4, provisioned: 5, cancelled: 6}[status];
  const command = status === 'draft' ? null : {version: 2, workspace_id: workspace, run_id: run, revision, expected_revision: revision - 1, status, operation: {rehearsed: 'rehearse', submitted: 'submit', approved: 'approve', provisioned: 'provision', cancelled: 'cancel'}[status], command_key: `setup-${run}-r${revision - 1}-confirmed`, payload_hash: 'a'.repeat(64), property_id: status === 'provisioned' ? property : null};
  return {version: 2, workspace_id: workspace, run_id: run, revision, status, payload: payload(), payload_hash: 'a'.repeat(64), creation_request_hash: 'b'.repeat(64), creation_receipt: {version: 2, run_id: run, workspace_id: workspace, revision: 1, status: 'draft', creation_request_hash: 'b'.repeat(64)}, submitted_revision: revision >= 3 ? 3 : null, submitted_payload_hash: revision >= 3 ? 'a'.repeat(64) : null, last_command_key: command?.command_key ?? null, last_command_receipt: command, property_id: status === 'provisioned' ? property : null, effective_units: status === 'provisioned' ? [{code: 'A-01', floor: 0, area_m2: 62}] : null};
};
const response = (body, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => structuredClone(body)});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  calls.push({url, options});
  assert.match(url, /^\/api\/customer\/v1\/onboarding\/building-setup/);
  if (!options.method && url.includes('/commands/')) return lookupHandler(url);
  if (!options.method) return readHandler(url, options);
  posts++;
  return writeHandler(url, options);
};
async function write(url, options) {
  const body = JSON.parse(options.body), key = body.command_key ?? body.idempotency_key;
  if (receipts.has(key)) return response(receipts.get(key));
  if (!body.command_key) {
    row = savedRow(); row.payload = body.payload;
    receipts.set(key, row.creation_receipt); return response(row.creation_receipt, 201);
  }
  if (options.method === 'PATCH') { row.payload.units = body.units; row.status = 'draft'; }
  else row.status = {rehearse: 'rehearsed', submit: 'submitted', provision: 'provisioned'}[url.split('/').at(-1)];
  row.revision++;
  if (row.status === 'submitted') { row.submitted_revision = row.revision; row.submitted_payload_hash = row.payload_hash; }
  if (row.status === 'provisioned') { row.property_id = property; row.effective_units = structuredClone(row.payload.units); }
  row.last_command_key = key;
  row.last_command_receipt = {version: 2, workspace_id: workspace, run_id: run, revision: row.revision, expected_revision: body.expected_revision, status: row.status, operation: options.method === 'PATCH' ? 'update' : url.split('/').at(-1), command_key: key, payload_hash: row.payload_hash, property_id: row.property_id};
  receipts.set(key, structuredClone(row.last_command_receipt));
  return response(row.last_command_receipt);
}
const {CustomerBuildingSetupWizard: Wizard} = load('src/components/customer/CustomerBuildingSetupWizard.tsx', {
  react: observedReact,
  './CustomerContextProvider': {useCustomerContext: () => context},
  './CustomerOnboardingTemplates': {CustomerOnboardingTemplates: () => null},
  './CustomerBuildingSetupProgress': {CustomerBuildingSetupProgress: Progress},
  '@/lib/customer/building-setup-schema': schema,
  '@/lib/customer/building-workspace-onboarding': helper,
  'next/link': ({href, children, ...props}) => React.createElement('a', {href, ...props}, children),
});
const labels = {
  en: {title: 'Setup status and next step', local: 'No building details have been saved yet.', dirty: 'Changes on this form are not saved yet.', create: 'Create draft', save: 'Save units', rehearse: 'Run rehearsal', submit: 'Submit for approval', provision: 'Provision structure', check: 'Check saved access and status', refresh: 'Refresh saved status', retry: 'Check status and retry saved attempt', dashboard: 'Continue to dashboard', draft: 'Draft saved', rehearsed: 'Opening balances checked in a test', submitted: 'Sent to another reviewer for approval', approved: 'Approved by another reviewer; structure not created yet', provisioned: 'Building structure created', unknown: 'The request result is still unknown.', blocked: 'Saved status could not be confirmed.'},
  ro: {title: 'Starea configurării și pasul următor', local: 'Nu ai salvat încă datele clădirii.', dirty: 'Modificările din formular nu sunt încă salvate.', create: 'Creează proiect', save: 'Salvează unitățile', rehearse: 'Rulează simularea', submit: 'Trimite spre aprobare', provision: 'Creează structura', check: 'Verifică accesul și starea salvate', refresh: 'Actualizează starea salvată', retry: 'Verifică starea și reîncearcă operațiunea salvată', dashboard: 'Continuă la panoul de control', draft: 'Ciornă salvată', rehearsed: 'Solduri inițiale verificate prin simulare', submitted: 'Trimis altei persoane pentru aprobare', approved: 'Aprobat de altă persoană; structura nu este încă creată', provisioned: 'Structura clădirii a fost creată', unknown: 'Rezultatul cererii nu este încă clar.', blocked: 'Starea salvată nu poate fi confirmată.'},
  fa: {title: 'وضعیت راه‌اندازی و قدم بعد', local: 'اطلاعات ساختمان هنوز ذخیره نشده است.', dirty: 'تغییرات فرم هنوز ذخیره نشده‌اند.', create: 'ایجاد پیش‌نویس', save: 'ذخیرهٔ واحدها', rehearse: 'اجرای آزمایشی', submit: 'ارسال برای تأیید', provision: 'ایجاد ساختار', check: 'بررسی دسترسی و وضعیت ذخیره‌شده', refresh: 'دریافت وضعیت ثبت‌شده', retry: 'بررسی وضعیت و تکرار همان تلاش', dashboard: 'ادامه در داشبورد', draft: 'پیش‌نویس ذخیره شد', rehearsed: 'مانده‌های شروع دوره آزمایش شدند', submitted: 'برای تأیید فرد دیگری ارسال شد', approved: 'فرد دیگری تأیید کرده است؛ ساختار هنوز ایجاد نشده است', provisioned: 'ساختار ساختمان ایجاد شد', unknown: 'نتیجهٔ درخواست هنوز مشخص نیست.', blocked: 'وضعیت ذخیره‌شده هنوز قابل تأیید نیست.'},
};
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text);
const panel = lang => document.querySelector(`section[aria-label="${labels[lang].title}"]`);
const handoff = lang => [...document.querySelectorAll('a')].find(node => node.textContent === labels[lang].dashboard);
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
let root = createRoot(document.getElementById('root')), checks = 0;
function eq(a, b, message) { checks++; assert.deepEqual(a, b, message); }
function ok(value, message) { checks++; assert.ok(value, message); }
const render = async (lang = 'en', key = 'same') => act(async () => root.render(React.createElement(Wizard, {lang, key})));
const click = async text => act(async () => button(text).click());
const change = async (selector, value) => act(async () => {
  const input = document.querySelector(selector);
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
});
function storeRun() { sessionStorage.setItem(helper.setupStorageKey(ctx, member, workspace), JSON.stringify({version: 2, context_id: ctx, membership_id: member, workspace_id: workspace, run_id: run, pending: null})); }
async function reset(status = null) {
  await act(async () => root.unmount()); root = createRoot(document.getElementById('root'));
  context = contextValue(); calls = []; posts = 0; row = status ? savedRow(status) : null; receipts = new Map(); guards.clear(); sessionStorage.clear();
  readHandler = async url => response(url.includes('idempotency_key=') ? {attempt: row} : row);
  lookupHandler = async () => {
    const attempt=JSON.parse(sessionStorage.getItem(helper.setupStorageKey(ctx,member,workspace))??'null')?.pending;
    return response(lookupProof(attempt,receipts.has(attempt?.command_key)?'complete':'absent'));
  };
  writeHandler = write;
  if (status) storeRun();
}
function lookupProof(attempt, outcome='complete') {
  const operation=attempt.action==='save'?'update':attempt.action;
  const value={version:1,scope:{tenant_id:other,workspace_id:workspace,run_id:run,context_id:ctx,membership_id:member,actor_id:property},command:{command_key:attempt.command_key,operation,expected_revision:attempt.before.revision},coverage:{status:'covered',epoch_id:'building-g2-pm169-v1',from_expected_revision:1,checked_at:'2026-10-26T00:00:00Z'},retention:{status:'activation_hold',policy_id:null},outcome};
  if(outcome==='complete')value.evidence={request_hash:'c'.repeat(64),input_descriptor:{units:attempt.units??null,expected_payload_hash:null},before_record:{revision:attempt.before.revision,status:attempt.before.status,payload_hash:attempt.before.payload_hash},receipt:receipts.get(attempt.command_key)??{version:2,workspace_id:workspace,run_id:run,command_key:attempt.command_key,operation,expected_revision:attempt.before.revision,revision:attempt.before.revision+1,status:{update:'draft',rehearse:'rehearsed',submit:'submitted',provision:'provisioned'}[operation],payload_hash:attempt.before.payload_hash,property_id:operation==='provision'?property:null},epoch_id:'building-g2-pm169-v1',recorded_at:'2026-10-26T00:00:00Z'};
  return value;
}
const g2Only=process.env.BUILDING_SETUP_G2_ONLY==='1';
try {
  if (!commitRaceOnly && !g2Only) {
  for (const lang of ['en', 'ro', 'fa']) {
    await reset(); await render(lang); eq(panel(lang).dir, lang === 'fa' ? 'rtl' : 'ltr');
    ok(panel(lang).textContent.includes(labels[lang].local)); eq(handoff(lang), undefined); eq(posts, 0);
    await change('fieldset input', 'Synthetic unsaved association');
    ok(panel(lang).textContent.includes(labels[lang].dirty)); ok(guards.size > 0);
    eq(panel(lang).querySelector('dl'), null, 'unsaved text is not a server receipt');
    await click(labels[lang].create); ok(panel(lang).textContent.includes(labels[lang].draft));
    eq(panel(lang).querySelectorAll('dd')[1].textContent, '1'); eq(handoff(lang), undefined);
    await change('input[aria-label$="1"][type="number"][min="0"]', '80');
    ok(panel(lang).textContent.includes(labels[lang].dirty));
    eq(panel(lang).querySelectorAll('dd')[1].textContent, '1', 'saved count remains separate from edits');
    await click(labels[lang].save); eq(panel(lang).textContent.includes(labels[lang].dirty), false);
    await click(labels[lang].rehearse); ok(panel(lang).textContent.includes(labels[lang].rehearsed));
    eq(handoff(lang), undefined);
    await click(labels[lang].submit); ok(panel(lang).textContent.includes(labels[lang].submitted));
    eq(handoff(lang), undefined);
    row.status = 'approved'; row.revision++;
    row.last_command_key = `setup-${run}-r${row.revision - 1}-review`;
    row.last_command_receipt = {...savedRow('approved').last_command_receipt, revision: row.revision, expected_revision: row.revision - 1, command_key: row.last_command_key};
    await click(labels[lang].refresh); ok(panel(lang).textContent.includes(labels[lang].approved));
    eq(handoff(lang), undefined, 'approval is not provisioning');
    await click(labels[lang].provision); ok(panel(lang).textContent.includes(labels[lang].provisioned));
    const link = handoff(lang); ok(link); eq(link.getAttribute('href'), `/${lang}/app/dashboard`);
    eq(link.getAttribute('target'), null); eq(link.hasAttribute('data-lab-href'), false, 'native full navigation, no client Context selection');
    eq(link.search, '', 'no property-derived Context in URL');
    link.focus(); eq(document.activeElement, link); ok(link.className.includes('min-h-11'));
    const count = calls.length; await render(lang); eq(calls.length, count, 'render never automatically navigates/refetches');
    eq(panel(lang).querySelectorAll('dd')[2].textContent, String(row.revision));
    // Actual browser navigation is NOT executed in JSDOM.
    await reset('draft'); await render(lang); await change('fieldset input', 'Cannot edit saved association');
    await change('input[aria-label$="1"][type="number"][min="0"]', '90');
    const originalGuard = guards.size;
    const nextLang = lang === 'fa' ? 'en' : 'fa'; await render(nextLang);
    ok(panel(nextLang).textContent.includes(labels[nextLang].dirty)); eq(guards.size, originalGuard);
    eq(document.querySelector('input[aria-label$="1"][type="number"][min="0"]').value, '90');

    // Both a lost write response and a successful POST followed by failed GET
    // retain the original command and show no completed receipt/handoff.
    for (const failure of ['lost-reply', 'failed-readback']) {
      await reset('approved'); await render(lang);
      writeHandler = async (url, options) => {
        const result = await write(url, options);
        if (failure === 'lost-reply') throw Error('Synthetic lost reply');
        readHandler = async () => response(null, 503); return result;
      };
      await click(labels[lang].provision);
      const key = helper.setupStorageKey(ctx, member, workspace), retained = sessionStorage.getItem(key);
      eq(row.status, 'provisioned'); eq(posts, 1); ok(JSON.parse(retained).pending);
      eq(panel(lang).querySelector('dl'), null); eq(handoff(lang), undefined);
      ok(panel(lang).textContent.includes(labels[lang].unknown));
      readHandler = async () => response(row); await click(labels[lang].check);
      ok(handoff(lang)); eq(posts, 1, 'read reconciliation does not issue another POST');
      eq(JSON.parse(sessionStorage.getItem(key)).pending, null);
    }
    for (const denial of [401, 403]) {
      await reset('provisioned'); await render(lang); ok(handoff(lang));
      readHandler = async () => response(null, denial); await click(labels[lang].check);
      eq(panel(lang), null, 'denial removes progress and private receipt'); eq(handoff(lang), undefined);
      readHandler = async () => response(row); await click(labels[lang].check); ok(handoff(lang)); eq(posts, 0);
    }
  }

  for (const mutation of [
    record => { record.property_id = null; },
    record => { delete record.property_id; },
    record => { record.property_id = 'https://foreign.test/property'; },
    record => { record.last_command_receipt.property_id = other; },
    record => { record.last_command_receipt.workspace_id = other; },
    record => { record.last_command_receipt.run_id = other; },
    record => { record.last_command_receipt.status = 'approved'; },
    record => { record.last_command_receipt.revision--; },
    record => { record.last_command_receipt.expected_revision--; },
    record => { record.last_command_receipt.payload_hash = 'c'.repeat(64); },
    record => { record.last_command_receipt.operation = 'submit'; },
    record => { record.last_command_receipt.command_key = 'other-command'; },
    record => { record.last_command_key = ''; record.last_command_receipt.command_key = ''; },
    record => { record.last_command_key = 'foreign-command'; record.last_command_receipt.command_key = 'foreign-command'; },
    record => { record.effective_units = null; },
    record => { delete record.effective_units; },
    record => { record.last_command_receipt = null; },
    record => { record.creation_request_hash = null; },
    record => { record.workspace_id = other; },
  ]) {
    await reset('provisioned'); mutation(row); await render();
    eq(handoff('en'), undefined, 'malformed/foreign/unbound property receipt cannot enable handoff');
    eq(panel('en')?.textContent.includes(labels.en.provisioned) ?? false, false);
    eq(posts, 0);
    eq(document.querySelector('fieldset'), null, 'malformed receipt cannot populate saved form');
    eq(button(labels.en.provision).disabled, true, 'malformed receipt disables next command');
    eq(/APPROVED|PROVISIONED|operation was recorded/.test(document.querySelector('[aria-live="polite"]')?.textContent ?? ''), false);
  }
  await reset('cancelled'); await render(); eq(handoff('en'), undefined); eq(posts, 0);
  await reset('draft'); await render();
  await change('input[aria-label$="1"][type="number"][min="0"]', '0');
  await click(labels.en.save);
  eq(posts, 0, 'invalid units are not dispatched');
  eq(panel('en').textContent.includes(labels.en.local), false, 'invalid edit cannot claim an existing saved run never existed');
  eq(panel('en').textContent.includes(labels.en.draft), false, 'no unverified completion receipt');
  eq(handoff('en'), undefined);
  for (const status of ['draft', 'rehearsed', 'submitted', 'approved']) {
    await reset(status); row.creation_receipt = null; await render();
    ok(panel('en').textContent.includes(labels.en.blocked)); eq(panel('en').querySelector('dl'), null); eq(handoff('en'), undefined);
    if (status !== 'draft') {
      await reset(status); row.last_command_receipt.payload_hash = 'c'.repeat(64); await render();
      ok(panel('en').textContent.includes(labels.en.blocked)); eq(panel('en').querySelector('dl'), null);
    }
  }
  // G2: approval advances the run before the original submit is reconciled.
  // Never convert a later command/status into proof for the lost original one.
  await reset('rehearsed'); await render();
  writeHandler = async (url, options) => { await write(url, options); row = savedRow('approved'); throw Error('Synthetic overwritten receipt'); };
  await click(labels.en.submit); const original = sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace));
  lookupHandler=async()=>{const proof=lookupProof(JSON.parse(original).pending,'unknown');proof.reason='legacy_uncovered';proof.coverage={...proof.coverage,status:'uncovered',epoch_id:null,from_expected_revision:null};return response(proof);};
  await click(labels.en.check);
  ok(panel('en').textContent.includes(labels.en.blocked)); eq(panel('en').querySelector('dl'), null); eq(handoff('en'), undefined);
  eq(sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace)), original); eq(posts, 1);

  for (const dimension of ['context', 'membership', 'workspace', 'missing', 'loading', 'error']) {
    await reset('provisioned'); await render(); ok(handoff('en'));
    const late = defer(); readHandler = async () => ({...response(null), json: () => late.promise});
    await click(labels.en.check); eq(handoff('en'), undefined); eq(panel('en').querySelector('dl'), null, 'refresh clears old receipt immediately');
    const oldRow = structuredClone(row);
    if (dimension === 'context') context = {...context, active: {...context.active, context_id: other}, dashboard: {...context.dashboard, contextId: other}};
    if (dimension === 'membership') context = {...context, active: {...context.active, membership_id: other}};
    if (dimension === 'workspace') context = {...context, dashboard: {...context.dashboard, workspace_id: other}};
    if (dimension === 'missing') context = {...context, active: null};
    if (dimension === 'loading') context = {...context, loading: true};
    if (dimension === 'error') context = {...context, error: 'denied'};
    await render(); await act(async () => late.resolve(oldRow));
    eq(handoff('en'), undefined); eq(panel('en')?.textContent.includes(oldRow.payload.building.name) ?? false, false);
    eq(posts, 0);
  }
  // A late committed write after a newer denial must not revive the receipt.
  await reset('approved'); await render(); const held = defer();
  writeHandler = async (url, options) => { await write(url, options); return held.promise; };
  await click(labels.en.provision);
  const stored = sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace));
  readHandler = async () => response(null, 403); await click(labels.en.check); eq(panel('en'), null);
  await act(async () => held.resolve(response(row.last_command_receipt)));
  eq(panel('en'), null); eq(sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace)), stored); eq(posts, 1);
  // Unmount/reload never uses a local saved status as an authorized receipt.
  await reset('provisioned'); await render(); ok(handoff('en'));
  const heldRead = defer(); readHandler = async () => heldRead.promise;
  await render('en', 'reload'); eq(handoff('en'), undefined); eq(panel('en').querySelector('dl'), null);
  await act(async () => root.unmount()); await act(async () => heldRead.resolve(response(row)));
  eq(document.querySelector('a'), null); root = createRoot(document.getElementById('root'));
  // CF-01: verify the ENTIRE Wizard, not just its Progress child.
  const noSavedSuccess = lang => {
    eq(handoff(lang), undefined);
    eq(document.querySelector('fieldset'), null, 'unconfirmed server fields are not admitted to the form');
    eq(document.body.textContent.includes('Synthetic Progress Building'), false);
    const footer = document.querySelector('[aria-live="polite"]')?.textContent ?? '';
    eq(/APPROVED|PROVISIONED|SUBMITTED|REHEARSED|DRAFT/.test(footer), false, 'no cached saved status in footer');
    eq([...document.querySelectorAll('button')].filter(node => node !== button(labels[lang].check) && !node.disabled).length, 0, 'all fresh commands fail closed');
  };
  for (const lang of ['en', 'ro', 'fa']) {
    await reset('approved'); row.last_command_receipt.payload_hash = 'c'.repeat(64);
    await render(lang); noSavedSuccess(lang); eq(posts, 0);
    ok(panel(lang).textContent.includes(labels[lang].blocked));
    const unchanged = sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace));
    row = savedRow('approved'); await click(labels[lang].check);
    eq(button(labels[lang].provision).disabled, false, 'only fresh valid confirmation permits next command');
    eq(sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace)), unchanged);
    // A currently valid visible snapshot cannot authorize a command after its
    // pre-action read returns a malformed receipt.
    row.last_command_receipt.run_id = other;
    await click(labels[lang].provision); noSavedSuccess(lang); eq(posts, 0);
    eq(sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace)), unchanged);

    // CF-02: same tuple ready is not a renewal of the earlier setup proof.
    for (const outcome of ['deny', 'invalid', 'malformed', 'network', 'valid']) {
      await reset('provisioned'); await render(lang); ok(handoff(lang));
      const readCount = calls.length, saved = sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace));
      context = {...context, loading: true}; await render(lang);
      noSavedSuccess(lang); eq(calls.length, readCount, 'no setup request while provider is unready');
      const fresh = defer(); readHandler = async () => fresh.promise;
      context = {...context, loading: false}; await render(lang);
      eq(calls.length, readCount + 1, 'same-tuple readiness restore starts a new setup read');
      noSavedSuccess(lang); eq(button(labels[lang].check).disabled, true, 'older confirmation cannot unlock during fresh read');
      if (outcome === 'deny') await act(async () => fresh.resolve(response(null, 403)));
      if (outcome === 'invalid') { row.last_command_receipt.payload_hash = 'c'.repeat(64); await act(async () => fresh.resolve(response(row))); }
      if (outcome === 'malformed') await act(async () => fresh.resolve(response({status: 'provisioned'})));
      if (outcome === 'network') await act(async () => fresh.resolve(response(null, 503)));
      if (outcome === 'valid') await act(async () => fresh.resolve(response(row)));
      if (outcome === 'deny') { eq(panel(lang), null); eq(document.querySelector('input'), null); eq(handoff(lang), undefined); }
      else if (outcome === 'valid') ok(handoff(lang));
      else noSavedSuccess(lang);
      eq(posts, 0); eq(sessionStorage.getItem(helper.setupStorageKey(ctx, member, workspace)), saved);
    }
    // Dirty local units survive readiness loss, fresh denial, invalid proof and
    // reauthorization; none of those reads save or discard them.
    await reset('draft'); await render(lang);
    await change('input[aria-label$="1"][type="number"][min="0"]', '91');
    ok(guards.size > 0);
    context = {...context, loading: true}; await render(lang); noSavedSuccess(lang); ok(guards.size > 0);
    readHandler = async () => response(null, 401); context = {...context, loading: false}; await render(lang);
    eq(document.querySelector('input'), null); ok(guards.size > 0); eq(posts, 0);
    row.creation_receipt = null; readHandler = async () => response(row); await click(labels[lang].check); noSavedSuccess(lang); ok(guards.size > 0);
    row = savedRow(); await click(labels[lang].check);
    eq(document.querySelector('input[aria-label$="1"][type="number"][min="0"]').value, '91');
    eq(row.payload.units[0].area_m2, 62); ok(guards.size > 0); eq(posts, 0);
    await click(labels[lang].save); eq(row.payload.units[0].area_m2, 91); eq(posts, 1);
    // Unsaved initial form remains local through same-tuple readiness changes.
    await reset(); await render(lang); await change('fieldset input', 'Synthetic local-only edit');
    context = {...context, loading: true}; await render(lang); ok(guards.size > 0);
    context = {...context, loading: false}; await render(lang);
    eq(document.querySelector('fieldset input').value, 'Synthetic local-only edit'); eq(posts, 0); ok(guards.size > 0);
  }
  // CF-02: old deferred reads and post-body continuations lose ownership even
  // when the new epoch has exactly the same membership/Context/Workspace.
  for (const resolution of ['old-first', 'new-first']) {
    await reset('provisioned'); await render();
    const previous = defer(), fresh = defer();
    const obsolete = structuredClone(row); obsolete.payload.building.name = 'OBSOLETE PRIVATE BUILDING';
    readHandler = async () => ({...response(null), json: () => previous.promise});
    await click(labels.en.check);
    context = {...context, loading: true}; await render();
    readHandler = async () => fresh.promise;
    context = {...context, loading: false}; await render();
    if (resolution === 'old-first') {
      await act(async () => previous.resolve(obsolete));
      noSavedSuccess('en'); eq(button(labels.en.check).disabled, true, 'old finally cannot settle the new reader');
      await act(async () => fresh.resolve(response(row)));
    } else {
      await act(async () => fresh.resolve(response(row)));
      await act(async () => previous.resolve(obsolete));
    }
    ok(handoff('en')); eq(document.body.textContent.includes(obsolete.payload.building.name), false); eq(posts, 0);
  }
  // Provider errors may remove dashboard data. Preserve the mounted local
  // draft without treating its cached identity as readiness or authority.
  await reset('draft'); await render();
  await change('input[aria-label$="1"][type="number"][min="0"]', '93');
  const validDashboard = context.dashboard, beforeMissing = calls.length;
  context = {...context, dashboard: null, error: 'unavailable'}; await render();
  noSavedSuccess('en'); ok(guards.size > 0); eq(calls.length, beforeMissing);
  readHandler = async () => response(null, 403); context = {...context, dashboard: validDashboard, error: null}; await render();
  eq(handoff('en'), undefined); eq(document.querySelector('input'), null); ok(guards.size > 0);
  readHandler = async () => response(row); await click(labels.en.check);
  eq(document.querySelector('input[aria-label$="1"][type="number"][min="0"]').value, '93'); eq(posts, 0);
  // Same-tuple error->ready also requires revalidation.
  await reset('provisioned'); await render(); const count = calls.length;
  context = {...context, error: 'unavailable'}; await render(); noSavedSuccess('en');
  readHandler = async () => response(null, 403); context = {...context, error: null}; await render();
  eq(calls.length, count + 1); eq(handoff('en'), undefined); eq(document.querySelector('input'), null);
  // Preserve the exact pending key/hash/body across a readiness epoch and a
  // denial. A late POST does not clear it; fresh exact readback may resolve it.
  await reset('approved'); await render(); const latePost = defer();
  writeHandler = async (url, options) => { await write(url, options); return latePost.promise; };
  await click(labels.en.provision);
  const storageKey = helper.setupStorageKey(ctx, member, workspace), pendingBytes = sessionStorage.getItem(storageKey);
  const sentBody = calls.find(call => call.options.method === 'POST').options.body;
  context = {...context, loading: true}; await render(); noSavedSuccess('en');
  readHandler = async () => response(null, 403); context = {...context, loading: false}; await render();
  await act(async () => latePost.resolve(response(row.last_command_receipt)));
  eq(sessionStorage.getItem(storageKey), pendingBytes); eq(posts, 1); eq(handoff('en'), undefined);
  eq(JSON.parse(pendingBytes).pending.command_key, JSON.parse(sentBody).command_key);
  eq(JSON.parse(pendingBytes).pending.before.payload_hash, 'a'.repeat(64));
  readHandler = async () => response(row); await click(labels.en.check);
  ok(handoff('en')); eq(posts, 1); eq(JSON.parse(sessionStorage.getItem(storageKey)).pending, null);
  }
  if(!g2Only){
  function CommitFrame({phase, onLayout, children}) {
    React.useLayoutEffect(() => { if (phase) onLayout(); }, [phase, onLayout]);
    React.useEffect(() => { if (phase) commitTrace?.push(`parent-passive:${phase}`); }, [phase]);
    return children;
  }
  function inCommitGap(renderCommit, resume) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Commit-gap harness did not reach layout')), 1000);
      renderCommit(() => {
        commitTrace.push('readiness-loss-committed');
        // Bounded parent layout work makes React yield passive effects to the
        // next task. This is test-only ordering, not a production pause/hook.
        const deadline = performance.now() + 25;
        while (performance.now() < deadline) { /* bounded 25ms commit work */ }
        let drain = Promise.resolve(resume());
        for (let i = 0; i < 20; i++) drain = drain.then(() => undefined);
        void drain.then(() => { commitTrace.push('before-passive-checkpoint'); clearTimeout(timeout); resolve([...commitTrace]); }, reject);
      });
    });
  }
  await reset('approved');
  const pendingKey = `setup-${run}-r4-original`;
  const originalAttempt = {action: 'provision', run_id: run, context_id: ctx, workspace_id: workspace, command_key: pendingKey, before: structuredClone(row)};
  const originalStorage = JSON.stringify({version: 2, context_id: ctx, membership_id: member, workspace_id: workspace, run_id: run, pending: originalAttempt});
  const attemptKey = helper.setupStorageKey(ctx, member, workspace);
  sessionStorage.setItem(attemptKey, originalStorage);
  row = savedRow('provisioned'); row.last_command_key = pendingKey; row.last_command_receipt.command_key = pendingKey;
  const oldBody = defer();
  readHandler = async () => ({...response(null), json: () => oldBody.promise.then(body => { commitTrace?.push('old-body-continuation'); return body; })});
  const frame = (phase, onLayout) => React.createElement(CommitFrame, {phase, onLayout}, React.createElement(Wizard, {lang: 'en'}));
  await act(async () => root.render(frame(0, null)));
  commitTrace = [];
  const previousActMode = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  let ordering;
  try {
    context = {...context, loading: true};
    ordering = await inCommitGap(onLayout => root.render(frame(1, onLayout)), () => oldBody.resolve(structuredClone(row)));
  } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = previousActMode; }
  console.log('COMMIT_GAP_ORDER ' + JSON.stringify(ordering));
  ok(ordering.indexOf('readiness-loss-committed') < ordering.indexOf('old-body-continuation'));
  const passive = ordering.indexOf('wizard-passive-cleanup');
  ok(passive === -1 || ordering.indexOf('old-body-continuation') < passive, 'old continuation explicitly settles before passive cleanup');
  eq(sessionStorage.getItem(attemptKey) === originalStorage, true, 'commit-to-passive window must preserve exact pending bytes');
  readHandler = async () => response(null, 403); context = {...context, loading: false};
  await act(async () => root.render(frame(2, () => undefined)));
  eq(sessionStorage.getItem(attemptKey), originalStorage, 'fresh denial cannot repair evidence deleted by an old continuation');
  eq(handoff('en'), undefined); eq(posts, 0);
  ok(commitTrace.indexOf('parent-passive:1') > commitTrace.indexOf('before-passive-checkpoint'), 'the next passive phase is actually observed after the checkpoint');
  readHandler = async () => response(row);
  await click(labels.en.check); ok(handoff('en')); eq(JSON.parse(sessionStorage.getItem(attemptKey)).pending, null);
  commitTrace = null;
  const lossContext = kind => kind === 'loading' ? {...context, loading: true} : kind === 'error' ? {...context, error: 'unavailable'} : kind === 'dashboard' ? {...context, dashboard: null} : {...context, active: null};
  for (const kind of ['loading', 'error', 'dashboard', 'scope']) {
    for (const point of ['read', 'pre-action', 'post-response', 'post-json', 'post-readback']) {
      await reset('approved');
      const previous = defer();
      if (point === 'pre-action') sessionStorage.setItem(attemptKey, originalStorage);
      if (point === 'read') {
        sessionStorage.setItem(attemptKey, originalStorage);
        row = savedRow('provisioned'); row.last_command_key = pendingKey; row.last_command_receipt.command_key = pendingKey;
        readHandler = async () => ({...response(null), json: () => previous.promise.then(value => { commitTrace?.push('old-continuation'); return value; })});
      } else {
        writeHandler = async (url, options) => {
          const result = await write(url, options);
          if (point === 'post-response') return previous.promise.then(value => { commitTrace?.push('old-continuation'); return value; });
          if (point === 'post-json') return {...result, json: () => previous.promise.then(value => { commitTrace?.push('old-continuation'); return value; })};
          readHandler = async () => ({...response(null), json: () => previous.promise.then(value => { commitTrace?.push('old-continuation'); return value; })});
          return result;
        };
      }
      await act(async () => root.render(frame(0, null)));
      if (point === 'pre-action') {
        readHandler = async () => previous.promise.then(value => { commitTrace?.push('old-continuation'); return value; });
        await click(labels.en.retry);
      } else if (point !== 'read') await click(labels.en.provision);
      const saved = sessionStorage.getItem(attemptKey), before = calls.length, beforePosts = posts, restored = contextValue();
      ok(JSON.parse(saved).pending, 'a real unresolved command exists before commit loss');
      commitTrace = [];
      const actMode = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      let trace;
      try {
        context = lossContext(kind);
        trace = await inCommitGap(onLayout => root.render(frame(1, onLayout)), () => previous.resolve(point === 'post-response' ? response(row.last_command_receipt) : point === 'pre-action' ? response(row) : point === 'post-json' ? structuredClone(row.last_command_receipt) : structuredClone(row)));
      } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = actMode; }
      ok(trace.indexOf('readiness-loss-committed') < trace.indexOf('old-continuation'));
      eq(trace.some(event => event.startsWith('parent-passive:')), false, 'test continuation precedes passive work');
      eq(sessionStorage.getItem(attemptKey) === saved, true, `${kind}/${point}: no stale persist or pending clear`);
      eq(calls.length, before, 'obsolete POST continuation cannot start readback'); eq(posts, beforePosts);
      readHandler = async () => response(null, 403); context = restored;
      await act(async () => root.render(frame(2, () => undefined)));
      eq(sessionStorage.getItem(attemptKey) === saved, true, 'fresh denial retains original bytes');
      eq(handoff('en'), undefined);
      ok(commitTrace.indexOf('parent-passive:1') > commitTrace.indexOf('before-passive-checkpoint'));
      commitTrace = null;
    }
  }
  // Older read/catch/finally resolves while a new committed read owns checking.
  for (const order of ['old-first', 'new-first']) {
    for (const oldOutcome of ['valid', 'denied']) {
      await reset('approved'); sessionStorage.setItem(attemptKey, originalStorage);
      row = savedRow('provisioned'); row.last_command_key = pendingKey; row.last_command_receipt.command_key = pendingKey;
      const oldRead = defer(), freshRead = defer();
      readHandler = async () => oldRead.promise.then(value => { commitTrace?.push('old-continuation'); return value; });
      await act(async () => root.render(frame(0, null)));
      context = {...context, loading: true}; await act(async () => root.render(frame(1, () => undefined)));
      readHandler = async () => freshRead.promise; context = {...context, loading: false}; commitTrace = [];
      const actMode = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        await inCommitGap(onLayout => root.render(frame(2, onLayout)), () => {
          if (order === 'old-first') {
            oldRead.resolve(oldOutcome === 'valid' ? response(row) : response(null, 403));
            return;
          }
          freshRead.resolve(response(row));
          let admitted = Promise.resolve();
          for (let i = 0; i < 12; i++) admitted = admitted.then(() => undefined);
          return admitted.then(() => {
            eq(JSON.parse(sessionStorage.getItem(attemptKey)).pending, null, 'new current proof is admitted before old continuation resumes');
            oldRead.resolve(oldOutcome === 'valid' ? response(row) : response(null, 403));
          });
        });
      } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = actMode; }
      if (order === 'old-first') {
        eq(sessionStorage.getItem(attemptKey) === originalStorage, true);
        eq(button(labels.en.check).disabled, true, 'old read finally cannot unlock the newer committed reader');
        eq(handoff('en'), undefined);
        await act(async () => freshRead.resolve(response(null, 403)));
        eq(sessionStorage.getItem(attemptKey) === originalStorage, true);
        readHandler = async () => response(row); await click(labels.en.check);
      } else await act(async () => undefined);
      ok(handoff('en')); eq(JSON.parse(sessionStorage.getItem(attemptKey)).pending, null); eq(posts, 0);
      commitTrace = null;
    }
  }
  // An old write's catch/finally must not release a new committed write slot.
  for (const oldOutcome of ['valid', 'error']) {
    await reset('approved'); const oldPost = defer(), freshPost = defer(); let dispatched = 0;
    writeHandler = async (url, options) => {
      dispatched++;
      if (dispatched === 1) return oldPost.promise;
      await write(url, options); return freshPost.promise;
    };
    await act(async () => root.render(frame(0, null))); await click(labels.en.provision);
    const saved = sessionStorage.getItem(attemptKey), firstBody = calls.find(call => call.options.method === 'POST').options.body;
    context = {...context, loading: true}; await act(async () => root.render(frame(1, () => undefined)));
    context = {...context, loading: false}; await act(async () => root.render(frame(2, () => undefined)));
    eq(sessionStorage.getItem(attemptKey), saved); eq(posts, 1);
    await click(labels.en.retry); eq(posts, 2); eq(calls.filter(call => call.options.method === 'POST')[1].options.body, firstBody);
    await act(async () => oldPost.resolve(oldOutcome === 'valid' ? response(row.last_command_receipt) : Promise.reject(Error('synthetic transport failure'))));
    eq(button(labels.en.retry).disabled, true, 'old write finally cannot unlock a newer write owner');
    eq(sessionStorage.getItem(attemptKey), saved); eq(handoff('en'), undefined);
    await click(labels.en.retry); eq(posts, 2, 'new owner remains locked against a third dispatch');
    await act(async () => freshPost.resolve(response(row.last_command_receipt)));
    ok(handoff('en')); eq(posts, 2); eq(JSON.parse(sessionStorage.getItem(attemptKey)).pending, null);
  }
  // Focused interaction delta: committed readiness fencing preserves the
  // existing receipt gate and local dirty buffer in every supported language.
  for (const lang of ['en', 'ro', 'fa']) {
    await reset('draft'); await render(lang);
    const input = 'input[aria-label$="1"][type="number"][min="0"]';
    await change(input, '97'); ok(guards.size > 0);
    context = {...context, loading: true}; await render(lang);
    eq(handoff(lang), undefined); ok(guards.size > 0);
    context = {...context, loading: false}; row.creation_receipt = null;
    await render(lang);
    eq(document.querySelector('fieldset'), null); eq(handoff(lang), undefined);
    eq(document.body.textContent.includes('Synthetic Progress Building'), false);
    eq([...document.querySelectorAll('button')].filter(node => node !== button(labels[lang].check) && !node.disabled).length, 0);
    eq(posts, 0); ok(guards.size > 0);
    row = savedRow(); await click(labels[lang].check);
    eq(document.querySelector(input).value, '97'); eq(row.payload.units[0].area_m2, 62);
    ok(guards.size > 0); eq(panel(lang).dir, lang === 'fa' ? 'rtl' : 'ltr');
    await click(labels[lang].save); eq(posts, 1); eq(row.payload.units[0].area_m2, 97);
  }
  // G2-specific commit -> lookup continuation -> passive cleanup window.
  await reset('rehearsed');
  {
    const storage=helper.setupStorageKey(ctx,member,workspace),before=structuredClone(row);
    const attempt={action:'submit',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r2-commit-gap`,before};
    const raw=JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt});sessionStorage.setItem(storage,raw);row=savedRow('approved');
    const wait=defer();lookupHandler=async()=>wait.promise.then(v=>{commitTrace?.push('g2-lookup-continuation');return v;});
    await act(async()=>root.render(frame(0,null)));const readsBefore=calls.length;commitTrace=[];
    const mode=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=false;
    let trace;
    try{context={...context,loading:true};trace=await inCommitGap(onLayout=>root.render(frame(1,onLayout)),()=>wait.resolve(response(lookupProof(attempt))));}
    finally{globalThis.IS_REACT_ACT_ENVIRONMENT=mode;}
    eq(trace.includes('g2-lookup-continuation'),true);eq(trace.some(v=>v.startsWith('parent-passive:')),false);
    eq(sessionStorage.getItem(storage),raw);eq(calls.length,readsBefore,'stale G2 continuation cannot issue final GET');
    readHandler=async()=>response({},403);context={...context,loading:false};await act(async()=>root.render(frame(2,()=>undefined)));
    eq(sessionStorage.getItem(storage),raw);eq(posts,0);
    ok(commitTrace.indexOf('parent-passive:1')>commitTrace.indexOf('before-passive-checkpoint'));
    console.log('G2_COMMIT_GAP_ORDER '+JSON.stringify(trace));commitTrace=null;
  }
  }
  // G2: actual Wizard and real helper/schema, only transport is fake.
  for(const lang of ['en','ro','fa']){
    for(const action of ['submit','save']){
      await reset(action==='submit'?'rehearsed':'draft');
      const before=structuredClone(row),key=`setup-${run}-r${before.revision}-g2`;
      const attempt={action,run_id:run,context_id:ctx,workspace_id:workspace,command_key:key,before,...(action==='save'?{units:[{code:'A-01',floor:0,area_m2:77}]}:{})};
      const storage=helper.setupStorageKey(ctx,member,workspace);
      sessionStorage.setItem(storage,JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt}));
      row=savedRow(action==='submit'?'approved':'rehearsed');
      if(action==='save'){row.revision=3;row.last_command_key=`setup-${run}-r2-later`;row.last_command_receipt={...row.last_command_receipt,revision:3,expected_revision:2,command_key:row.last_command_key};}
      lookupHandler=async()=>response(lookupProof(attempt));
      await render(lang);
      eq(JSON.parse(sessionStorage.getItem(storage)).pending,null);eq(posts,0);eq(calls.filter(c=>c.url.includes('/commands/')).length,1);
      eq(calls.at(-1).url.includes('/commands/'),false,'fresh current read follows historical lookup');
      eq(handoff(lang),undefined,'historical result does not grant dashboard');
      ok(panel(lang).textContent.includes(labels[lang][action==='submit'?'approved':'rehearsed']));
    }
  }
  for(const fault of ['actor','context','workspace','run','member','key','operation','revision','beforeHash','units','unknown','legacy','conflict','unsupported','denied','malformed','fresh403','freshInvalid']){
    await reset('draft');const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'save',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r1-fault`,before,units:[{code:'A-01',floor:0,area_m2:77}]};
    const raw=JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt});sessionStorage.setItem(storage,raw);row=savedRow('rehearsed');
    lookupHandler=async()=>{
      const proof=lookupProof(attempt);
      if(fault==='actor'){
        proof.scope.actor_id=other;
        // Exercise the real accepted SSR actor boundary as part of this
        // consumer transport; no actual Auth, network or Backend suite runs.
        const {GET}=load('src/app/api/customer/v1/onboarding/building-setup/[id]/commands/[command_key]/route.ts',{
          '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:property}},error:null})},schema:()=>({rpc:async()=>({data:proof,error:null})})})},
          '@/lib/customer/building-setup-schema':schema,
          '@/lib/customer/building-workspace-onboarding-api':load('src/lib/customer/building-workspace-onboarding-api.ts',{'./onboarding-import-helper':load('src/lib/customer/onboarding-import-helper.ts')}),
          '@/lib/customer/onboarding-import-helper':load('src/lib/customer/onboarding-import-helper.ts'),
        });
        const {NextRequest}=require('next/server');
        const result=await GET(new NextRequest(`https://cladora.test/api/customer/v1/onboarding/building-setup/${run}/commands/${attempt.command_key}?context_id=${ctx}&workspace_id=${workspace}&operation=update&expected_revision=1`),{params:Promise.resolve({id:run,command_key:attempt.command_key})});
        eq(result.status,502,'canonical route rejects foreign actor before consumer admission');return result;
      }
      if(fault==='context')proof.scope.context_id=other;
      if(fault==='workspace')proof.scope.workspace_id=other;
      if(fault==='run')proof.scope.run_id=other;
      if(fault==='member')proof.scope.membership_id=other;
      if(fault==='key')proof.command.command_key=`setup-${run}-r1-other`;
      if(fault==='operation')proof.command.operation='submit';
      if(fault==='revision')proof.command.expected_revision=2;
      if(fault==='beforeHash')proof.evidence.before_record.payload_hash='d'.repeat(64);
      if(fault==='units')proof.evidence.input_descriptor.units[0].area_m2=78;
      if(['unknown','legacy','conflict'].includes(fault)){delete proof.evidence;proof.outcome=fault==='conflict'?'conflict':'unknown';proof.reason=fault==='conflict'?'own_command_descriptor_mismatch':fault==='legacy'?'legacy_uncovered':'coverage_gap';if(fault==='legacy')proof.coverage={...proof.coverage,status:'uncovered',epoch_id:null,from_expected_revision:null};}
      if(fault==='unsupported')return response({},404);
      if(fault==='denied')return response({},403);
      if(fault==='malformed')return response({});
      if(fault==='fresh403')readHandler=async()=>response({},403);
      if(fault==='freshInvalid')readHandler=async()=>response({...row,creation_receipt:null});
      return response(proof);
    };
    await render();eq(sessionStorage.getItem(storage),raw,fault);eq(posts,0);eq(handoff('en'),undefined);
    eq(document.querySelector('fieldset'),null,'invalid/unresolved proof blocks private saved fields');
  }
  // Exact ordering of command descriptor units is not data-set equivalence.
  {
    await reset('draft');const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'save',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r1-order`,before,units:[{code:'A',floor:0,area_m2:30},{code:'B',floor:0,area_m2:40}]};
    const raw=JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt});sessionStorage.setItem(storage,raw);row=savedRow('rehearsed');
    lookupHandler=async()=>{const proof=lookupProof(attempt);proof.evidence.input_descriptor.units.reverse();return response(proof);};
    await render();eq(sessionStorage.getItem(storage),raw);eq(posts,0);
  }
  // Lookup and final-read continuations never erase replaced storage or stale scope.
  for(const phase of ['lookup','final-read'])for(const loss of ['loading','replacement']){
    await reset('rehearsed');const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'submit',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r2-race`,before};
    const raw=JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt});sessionStorage.setItem(storage,raw);row=savedRow('approved');
    const wait=defer();let final=false;
    lookupHandler=async()=>{if(phase==='lookup')return wait.promise;final=true;return response(lookupProof(attempt));};
    readHandler=async()=>final?wait.promise:response(row);
    await render();const replacement=raw.replace('-race','-replacement');
    if(loss==='loading'){context={...context,loading:true};await render();}else sessionStorage.setItem(storage,replacement);
    await act(async()=>wait.resolve(phase==='lookup'?response(lookupProof(attempt)):response(row)));
    eq(sessionStorage.getItem(storage),loss==='replacement'?replacement:raw);eq(posts,0);eq(handoff('en'),undefined);
  }
  for(const advance of [false,true]){
    await reset('approved');const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'provision',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r4-explicit`,before};
    const raw=JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt});sessionStorage.setItem(storage,raw);
    if(advance)row=savedRow('provisioned');lookupHandler=async()=>response(lookupProof(attempt,'absent'));
    await render();eq(sessionStorage.getItem(storage),raw);eq(posts,0);
    if(!advance){await click(labels.en.retry);eq(posts,1);const body=JSON.parse(calls.find(c=>c.options.method==='POST').options.body);eq(body.command_key,attempt.command_key);eq(body.expected_revision,4);eq(JSON.parse(sessionStorage.getItem(storage)).pending,null);}
    else{eq(handoff('en'),undefined);eq(document.querySelector('fieldset'),null);}
  }
  // Original COMMIT between absent lookup and current read is recognized by
  // the fresh exact last-slot proof, never by the earlier absence observation.
  await reset('approved');
  {
    const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'provision',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r4-concurrent`,before};
    sessionStorage.setItem(storage,JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt}));
    lookupHandler=async()=>{row=savedRow('provisioned');row.last_command_key=attempt.command_key;row.last_command_receipt.command_key=attempt.command_key;return response(lookupProof(attempt,'absent'));};
    await render();eq(JSON.parse(sessionStorage.getItem(storage)).pending,null);eq(posts,0);ok(handoff('en'));
  }
  // A new G2 receipt on an uncovered legacy run is still valid evidence.
  await reset('rehearsed');
  {
    const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'submit',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r2-uncovered`,before};
    sessionStorage.setItem(storage,JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt}));row=savedRow('approved');
    lookupHandler=async()=>{const proof=lookupProof(attempt);proof.coverage={...proof.coverage,status:'uncovered',epoch_id:null,from_expected_revision:null};return response(proof);};
    await render();eq(JSON.parse(sessionStorage.getItem(storage)).pending,null);eq(posts,0);
  }
  // A newer local edit is distinct from the saved command being reconciled.
  await reset('draft');await render();await change('input[aria-label$="1"][type="number"][min="0"]','97');
  {
    const before=structuredClone(row),storage=helper.setupStorageKey(ctx,member,workspace);
    const attempt={action:'save',run_id:run,context_id:ctx,workspace_id:workspace,command_key:`setup-${run}-r1-dirty`,before,units:[{code:'A-01',floor:0,area_m2:77}]};
    sessionStorage.setItem(storage,JSON.stringify({version:2,context_id:ctx,membership_id:member,workspace_id:workspace,run_id:run,pending:attempt}));row=savedRow('draft');row.revision=3;row.last_command_key=`setup-${run}-r2-current`;row.last_command_receipt={version:2,workspace_id:workspace,run_id:run,status:'draft',revision:3,payload_hash:row.payload_hash,command_key:row.last_command_key,expected_revision:2,operation:'update',property_id:null};row.payload.units[0].area_m2=77;
    lookupHandler=async()=>response(lookupProof(attempt));context={...context,loading:true};await render();context={...context,loading:false};await render();
    eq(JSON.parse(sessionStorage.getItem(storage)).pending,null);eq(document.querySelector('input[aria-label$="1"][type="number"][min="0"]').value,'97');ok(guards.size>0);eq(posts,0);
  }
  console.log(`PASS saved building progress: ${checks} mounted assertions; ${g2Only?'targeted G2 cases':commitRaceOnly?'commit-gap and G2 cases':'full affected Wizard/progress cases'}; fake transport; real browser/HTTP/Auth/DB NOT_RUN_NOT_PASS`);
} finally {
  await act(async () => root.unmount()); globalThis.fetch = originalFetch; dom.window.close();
  for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
