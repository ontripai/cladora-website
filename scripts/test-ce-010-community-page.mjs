import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { classifyCommunityResponse, communityReadResponseSchema, toCommunityViews } from '../src/lib/community/community-base-client.ts';
import { CANONICAL_ROLES, isRouteAllowedForPersona } from '../src/lib/customer/access-matrix.ts';
import { classifyCustomerRoute } from '../src/lib/customer/route-classifier.ts';

const id = (n) => `21000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(2); const communityId = id(3); const draftId = id(4); const publishedId = id(5); const reportId = id(6);
const payload = {
  workspace_id: workspaceId,
  communities: [{ id: communityId, workspace_id: workspaceId, name: 'Named community', version: 3, audience_kind: 'workspace', can_create_announcement: true, can_decide_reports: true }],
  announcements: [
    { id: draftId, community_id: communityId, title: 'Draft notice', body: 'Draft notice body', status: 'draft', version: 1, can_report: false, can_publish: true, can_cancel: false },
    { id: publishedId, community_id: communityId, title: 'Safety notice', body: 'Use the named entrance.', status: 'published', version: 2, can_report: true, can_publish: false, can_cancel: true },
  ],
  reports: [{ id: reportId, community_id: communityId, target_title: 'Safety notice', report_reason: 'Needs review', status: 'open', version: 1 }],
  limit: 100,
};
const parsed = communityReadResponseSchema.parse(payload);
assert.equal(communityReadResponseSchema.safeParse({ ...payload, tenant_id: id(90) }).success, false, 'private top-level fields fail closed');
assert.equal(communityReadResponseSchema.safeParse({ ...payload, announcements: [{ ...payload.announcements[0], audience: { kind: 'members', membership_ids: [id(91)] } }] }).success, false, 'raw audience identifiers fail closed');
for (const lang of ['ro', 'en', 'fa']) { const views = toCommunityViews(parsed, lang); assert.equal(views[0].name, 'Named community'); assert.equal(views[0].announcements[1].title, 'Safety notice'); }
assert.deepEqual([401, 403, 404, 503, 500].map(classifyCommunityResponse), ['session', 'denied', 'denied', 'not_ready', 'retry']);

const route = classifyCustomerRoute('/app/community');
assert.equal(route?.status, 'permission protected');
assert.deepEqual(route?.requirement?.permissions, ['community.community.read']);
assert.deepEqual(route?.requirement?.entitlements, ['module.community_basic']);
assert.deepEqual(route?.requirement?.modules, ['community_basic']);
for (const role of CANONICAL_ROLES) assert.equal(isRouteAllowedForPersona(role, '/app/community'), true);
const pageSource = fs.readFileSync('src/components/customer/CustomerCommunityBasePage.tsx', 'utf8');
const shellSource = fs.readFileSync('src/components/customer/CustomerAppShell.tsx', 'utf8');
assert.match(pageSource, /dashboard\.workspace_id/); assert.match(pageSource, /cache: 'no-store'/); assert.match(pageSource, /credentials: 'same-origin'/); assert.match(pageSource, /method: 'POST'/);
assert.match(shellSource, /hasEnt\("module\.community_basic"\) && hasPerm\("community\.community\.read"\)/);

const runtimeFiles = [];
function compile(sourceName, runtimeName, replacements = []) {
  let source = fs.readFileSync(path.join('src/components/customer', sourceName), 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const target = path.join('scripts', runtimeName);
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  runtimeFiles.push(target); return `./${runtimeName}`;
}
const transportRuntime = path.join('scripts', '.ce010-dashboard-transport-runtime.mjs');
fs.writeFileSync(transportRuntime, "import{createContext,useContext}from'react';const C=createContext(globalThis.fetch);export const DashboardTransportProvider=C.Provider;export function useDashboardFetch(){return useContext(C)}export function useDashboardPreview(){return true}");
runtimeFiles.push(transportRuntime);
await import(compile('CustomerCommunityBase.tsx', '.ce010-community-runtime.mjs'));
const contextModule = await import(compile('CustomerContextProvider.tsx', '.ce010-context-runtime.mjs', [["@/components/dashboard-lab/DashboardTransport", './.ce010-dashboard-transport-runtime.mjs']]));
const pageModule = await import(compile('CustomerCommunityBasePage.tsx', '.ce010-page-runtime.mjs', [
  ["@/components/dashboard-lab/DashboardTransport", './.ce010-dashboard-transport-runtime.mjs'], ['./CustomerContextProvider', './.ce010-context-runtime.mjs'],
  ['./CustomerCommunityBase', './.ce010-community-runtime.mjs'], ["@/lib/community/community-base-client", '../src/lib/community/community-base-client.ts'],
]));
const { DashboardTransportProvider } = await import('./.ce010-dashboard-transport-runtime.mjs');
const { CustomerContextProvider, useCustomerContext } = contextModule; const { CustomerCommunityBasePage } = pageModule;
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/en/app/community' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client'); const container = document.getElementById('root'); const contextId = id(11);
let mode = 'ready'; const requests = []; const posts = [];
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockFetch = async (input, init = {}) => {
  const url = String(input); requests.push(url);
  if (url === '/api/customer/v1/contexts') return response({ contexts: [{ context_id: contextId, membership_id: id(12), tenant_name: 'Test', role_code: 'association_admin', role_name: 'Administrator', scope_type: 'tenant', context_label: 'Home' }] });
  if (url.startsWith('/api/customer/v1/dashboard')) return response({ contextId, workspace_id: workspaceId, context: { role_code: 'association_admin' }, permissions: ['community.community.read'], entitlements: ['module.community_basic'], modules: ['community_basic'] });
  if (url.startsWith('/api/customer/v1/community/base') && init.method === 'POST') { posts.push(JSON.parse(init.body)); return response({ ok: true }); }
  if (url.startsWith('/api/customer/v1/community/base')) {
    if (mode === 'not_ready') return response({ error: { code: 'CE_COMMUNITY_CONNECTION_NOT_READY' } }, 503);
    if (mode === 'refresh_fail') return response({ error: { code: 'CE_COMMUNITY_REFRESH_FAILED' } }, 500);
    return response(payload);
  }
  throw new Error(`Unexpected request: ${url}`);
};
async function flush() { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
const renderPage = () => React.createElement(DashboardTransportProvider, { value: mockFetch }, React.createElement(CustomerContextProvider, null, React.createElement(CustomerCommunityBasePage, { lang: 'en' })));
let root = createRoot(container); await act(async () => root.render(renderPage())); await flush();
assert.match(container.textContent, /Named community/); assert.match(container.textContent, /Safety notice/); assert.match(container.textContent, /Draft notice/);
for (const value of [workspaceId, communityId, draftId, publishedId, reportId]) assert.doesNotMatch(container.textContent, new RegExp(value));
const buttons = () => [...container.querySelectorAll('button')]; const byText = (text) => buttons().find((button) => button.textContent === text);
await act(async () => { byText('Publish').click(); await Promise.resolve(); }); await flush();
await act(async () => { byText('Cancel').click(); await Promise.resolve(); }); await flush();
const forms = [...container.querySelectorAll('form')]; const announcementForm = forms.find((form) => /New announcement/.test(form.textContent));
const reportForm = forms.find((form) => /Report content/.test(form.textContent)); const moderationForm = forms.find((form) => /Resolve report/.test(form.textContent));
const setValue = (element, value) => { const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value); element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
await act(async () => { setValue(announcementForm.querySelector('textarea'), 'A new in-app notice'); announcementForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); }); await flush();
await act(async () => { setValue(reportForm.querySelector('select'), publishedId); setValue(reportForm.querySelector('textarea'), 'Please review this notice'); reportForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); }); await flush();
await act(async () => { setValue(moderationForm.querySelector('select'), reportId); setValue(moderationForm.querySelector('textarea'), 'Reviewed by the moderator'); moderationForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); }); await flush();
assert.deepEqual(posts.map((post) => post.type), ['publish_announcement', 'cancel_announcement', 'create_announcement', 'report_content', 'decide_content_report']);
assert.equal(posts[0].expected_version, 1); assert.equal(posts[1].expected_version, 2); assert.equal(posts[2].expected_version, 3); assert.deepEqual(posts[2].audience, { kind: 'workspace' });
assert.equal(posts[3].expected_version, 0); assert.equal(posts[3].target_id, publishedId); assert.equal(posts[4].expected_version, 1); assert.equal(posts[4].report_id, reportId);
for (const post of posts) { assert.equal(post.context_id, contextId); assert.equal(post.workspace_id, workspaceId); assert.match(post.command_id, /^[0-9a-f-]{36}$/i); assert.ok(post.idempotency_key.endsWith(post.command_id)); }

// A successful command may fail while refreshing the projection. Keep every
// unrelated local draft mounted across both the failed refresh and its retry.
const liveAnnouncementForm = [...container.querySelectorAll('form')].find((form) => /New announcement/.test(form.textContent));
const liveReportForm = [...container.querySelectorAll('form')].find((form) => /Report content/.test(form.textContent));
await act(async () => {
  setValue(liveAnnouncementForm.querySelector('textarea'), 'Keep this unsent announcement');
  setValue(liveReportForm.querySelector('select'), publishedId);
  setValue(liveReportForm.querySelector('textarea'), 'Submit only this report');
});
mode = 'refresh_fail';
await act(async () => { liveReportForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); }); await flush();
assert.equal(container.querySelector('form textarea').value, 'Keep this unsent announcement', 'successful report keeps the unrelated draft after refresh failure');
assert.match(container.querySelector('[role="alert"]').textContent, /Community could not be loaded/);
mode = 'ready';
await act(async () => { byText('Try again').click(); await Promise.resolve(); }); await flush();
assert.equal(container.querySelector('form textarea').value, 'Keep this unsent announcement', 'explicit refresh retry keeps the unrelated draft');
assert.equal(container.querySelector('[role="alert"]'), null, 'successful retry clears only the refresh warning');

await act(async () => root.unmount());
mode = 'not_ready'; requests.length = 0; container.innerHTML = ''; root = createRoot(container); await act(async () => root.render(renderPage())); await flush();
assert.match(container.textContent, /operational Community connection has not been activated yet/); await act(async () => root.unmount());

// These harness controls call the real Context API; they do not exercise the
// production CustomerAppShell confirmation UI. Only transport is mocked.
const contextB = id(21); const contextC = id(31); const workspaceB = id(22);
let contextState;
function ContextHarness({ lang }) {
  const state = useCustomerContext();
  contextState = state;
  const [showCommunity, setShowCommunity] = React.useState(true);
  return React.createElement(React.Fragment, null,
    ...[[contextId, 'context-a'], [contextB, 'context-b'], [contextC, 'context-c']].map(([value, label]) =>
      React.createElement('button', { key: label, 'data-harness': label, onClick: () => state.select(value) }, label)),
    React.createElement('button', { 'data-harness': 'keep', onClick: state.cancelContextChange }, 'Keep'),
    React.createElement('button', { 'data-harness': 'discard', onClick: state.confirmContextChange }, 'Discard'),
    React.createElement('button', { 'data-harness': 'toggle', onClick: () => setShowCommunity((value) => !value) }, 'Toggle CE'),
    showCommunity ? React.createElement(CustomerCommunityBasePage, { lang }) : null);
}
let postStatus = 200; let readFailure = false; let pendingPost = null; let deferPost = false; let projectionVersion = 3;
let selectionCommunities = null;
let holdNextProjection = false; let finishProjection;
let allowCreate = true; let allowReport = true; let allowModerate = true;
const guardPosts = [];
const scopedFetch = async (input, init = {}) => {
  const url = String(input);
  if (init.method && !['GET', 'HEAD'].includes(init.method)) {
    assert.equal(url, '/api/customer/v1/community/base');
    guardPosts.push(JSON.parse(init.body));
    if (deferPost) return new Promise((resolve) => { pendingPost = () => resolve(response({ ok: true })); });
    return response(postStatus === 200 ? { ok: true } : { error: { code: 'CONFLICT' } }, postStatus);
  }
  if (url === '/api/customer/v1/contexts') return response({ contexts: [contextId, contextB, contextC].map((value) => ({ context_id: value, membership_id: id(12), tenant_name: 'Test', role_code: 'association_admin', role_name: 'Administrator', scope_type: 'tenant', context_label: value === contextId ? 'A' : 'Other' })) });
  const query = new URL(url, 'http://localhost').searchParams;
  const activeContext = query.get('context_id');
  const activeWorkspace = activeContext === contextB ? workspaceB : workspaceId;
  if (url.startsWith('/api/customer/v1/dashboard')) return response({ contextId: activeContext, workspace_id: activeWorkspace, context: { role_code: 'association_admin' }, permissions: ['community.community.read'], entitlements: ['module.community_basic'], modules: ['community_basic'] });
  if (url.startsWith('/api/customer/v1/community/base')) {
    if (readFailure) return response({ error: { code: 'REFRESH_FAILED' } }, 500);
    assert.equal(query.get('workspace_id'), activeWorkspace);
    const available = selectionCommunities ?? [communityId];
    const scopedId = (value, community) => community === communityId ? value : ({ [draftId]: id(44), [publishedId]: id(45), [reportId]: id(46) })[value] ?? value;
    const nextProjection = { ...payload, workspace_id: activeWorkspace,
      communities: available.flatMap((community) => payload.communities.map((item) => ({ ...item, id: community, name: community === communityId ? 'Named community' : 'Second community', workspace_id: activeWorkspace, version: projectionVersion, can_create_announcement: allowCreate, can_decide_reports: allowModerate }))),
      announcements: available.flatMap((community) => payload.announcements.map((item) => ({ ...item, id: scopedId(item.id, community), community_id: community, can_report: item.can_report && allowReport }))),
      reports: available.flatMap((community) => payload.reports.map((item) => ({ ...item, id: scopedId(item.id, community), community_id: community }))),
    };
    if (holdNextProjection) { holdNextProjection = false; return new Promise((resolve) => { finishProjection = () => resolve(response(nextProjection)); }); }
    return response(nextProjection);
  }
  throw new Error(`Unexpected Context test request: ${url}`);
};
const currentForms = () => [...container.querySelectorAll('form')];
const values = () => currentForms().map((form) => [...form.querySelectorAll('textarea,select')].map((input) => input.value));
function edit(element, value) {
  const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
async function navigate(control) {
  const before = guardPosts.length;
  await act(async () => container.querySelector(`[data-harness="${control}"]`).click());
  await flush();
  assert.equal(guardPosts.length, before, `${control} sends zero mutations`);
}
function assertClean() {
  assert.deepEqual(values(), [[''], ['', ''], ['', 'dismissed', '']], 'no leaked/resurrected local draft');
}
async function dirtyForm(index) {
  await act(async () => {
    const form = currentForms()[index];
    edit(form.querySelector('textarea'), `Unsent ${index}`);
    if (index > 0) edit(form.querySelector('select'), index === 1 ? publishedId : reportId);
    if (index === 2) edit(form.querySelectorAll('select')[1], 'action_required');
  });
}
async function clearForm(index) {
  await act(async () => {
    const form = currentForms()[index];
    edit(form.querySelector('textarea'), '');
    if (index > 0) edit(form.querySelector('select'), '');
    if (index === 2) edit(form.querySelectorAll('select')[1], 'dismissed');
  });
}
async function sendForm(index) {
  await act(async () => currentForms()[index].dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await flush();
}
async function discardAndReturn() {
  await navigate('context-b');
  assert.equal(contextState.pendingContextId, contextB);
  await navigate('discard');
  assert.equal(contextState.active.context_id, contextB);
  assert.equal(contextState.pendingContextId, null);
  assertClean();
  await navigate('context-a');
  assert.equal(contextState.active.context_id, contextId);
  assert.equal(contextState.pendingContextId, null, 'unmounted guards are gone');
  assertClean();
}
let contextScenarios = 0;
for (const lang of ['ro', 'en', 'fa']) {
  postStatus = 200; readFailure = false; deferPost = false; allowCreate = true; allowReport = true; allowModerate = true;
  root = createRoot(container);
  await act(async () => root.render(React.createElement(DashboardTransportProvider, { value: scopedFetch },
    React.createElement(CustomerContextProvider, null, React.createElement(ContextHarness, { lang })))));
  await flush();
  assert.equal(contextState.active.context_id, contextId);
  assert.equal(container.querySelector('section').getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
  assertClean();
  await navigate('context-b');
  assert.equal(contextState.active.context_id, contextB, 'clean switch needs no confirmation');
  assert.equal(contextState.pendingContextId, null);
  await navigate('context-a');
  contextScenarios += 1;

  for (let index = 0; index < 3; index += 1) {
    await dirtyForm(index);
    const before = values();
    await navigate('context-b');
    assert.equal(contextState.active.context_id, contextId);
    assert.equal(contextState.pendingContextId, contextB);
    assert.deepEqual(values(), before);
    await navigate('keep');
    assert.equal(contextState.pendingContextId, null);
    assert.equal(contextState.active.context_id, contextId);
    assert.deepEqual(values(), before, 'Keep preserves every input');
    await discardAndReturn();
    contextScenarios += 1;
  }

  // Selection-only changes count, including changing just the moderation decision.
  for (const [index, selectIndex, value] of [[1, 0, publishedId], [2, 0, reportId], [2, 1, 'action_required']]) {
    await act(async () => edit(currentForms()[index].querySelectorAll('select')[selectIndex], value));
    await navigate('context-c');
    assert.equal(contextState.active.context_id, contextId);
    assert.equal(contextState.pendingContextId, contextC, 'same-workspace Context change is guarded too');
    await navigate('keep');
    await clearForm(index);
    await navigate('context-c');
    assert.equal(contextState.active.context_id, contextC, 'reset form is clean');
    assert.equal(contextState.pendingContextId, null);
    await navigate('context-a');
    assertClean();
    contextScenarios += 1;
  }

  // Success or manual cleanup of one form cannot unregister another kind.
  for (let submitted = 0; submitted < 3; submitted += 1) {
    for (let index = 0; index < 3; index += 1) await dirtyForm(index);
    const before = values(); const count = guardPosts.length;
    await sendForm(submitted);
    assert.equal(guardPosts.length, count + 1);
    assert.deepEqual(values()[submitted], submitted === 0 ? [''] : submitted === 1 ? ['', ''] : ['', 'dismissed', '']);
    for (let index = 0; index < 3; index += 1) if (index !== submitted) assert.deepEqual(values()[index], before[index]);
    await navigate('context-b');
    assert.equal(contextState.pendingContextId, contextB, 'other forms still guard after success');
    await navigate('keep');
    const remaining = [0, 1, 2].filter((index) => index !== submitted);
    await clearForm(remaining[0]);
    await navigate('context-b');
    assert.equal(contextState.pendingContextId, contextB, 'last dirty form still guards after clearing another');
    await navigate('keep');
    await clearForm(remaining[1]);
    await navigate('context-b');
    assert.equal(contextState.active.context_id, contextB);
    assert.equal(contextState.pendingContextId, null, 'all successful/reset forms are clean');
    await navigate('context-a');
    contextScenarios += 1;
  }

  // Failures, conflict reconciliation and projection refresh errors preserve all drafts/guards.
  for (const status of [500, 409]) {
    for (let index = 0; index < 3; index += 1) await dirtyForm(index);
    const before = values(); postStatus = status; projectionVersion += 1;
    await sendForm(1);
    assert.deepEqual(values(), before);
    assert.ok(currentForms()[1].querySelector('[role="alert"]'));
    await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB); await navigate('keep');
    postStatus = 200; readFailure = true;
    await sendForm(1);
    assert.deepEqual(values()[0], before[0]); assert.deepEqual(values()[2], before[2]);
    assert.deepEqual(values()[1], ['', '']);
    assert.ok(container.querySelector('[role="alert"]'), 'failed projection refresh is visible');
    await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB); await navigate('keep');
    readFailure = false;
    const retry = [...container.querySelector('[role="alert"]').querySelectorAll('button')][0];
    await act(async () => retry.click()); await flush();
    assert.deepEqual(values()[0], before[0]); assert.deepEqual(values()[2], before[2]);
    await discardAndReturn();
    contextScenarios += 1;
  }
  // A 409 whose own reconciliation read fails also retains both form and guard.
  await dirtyForm(1); postStatus = 409; readFailure = true;
  const conflictDraft = values(); await sendForm(1); assert.deepEqual(values(), conflictDraft);
  await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB); await navigate('keep');
  postStatus = 200; readFailure = false; await discardAndReturn(); contextScenarios += 1;

  // In-flight writes remain user-initiated: navigation never retries/cancels them,
  // and their late success cannot clear a draft in the new scope.
  await dirtyForm(0); deferPost = true;
  const writesBefore = guardPosts.length;
  await sendForm(0); assert.equal(guardPosts.length, writesBefore + 1);
  await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB);
  await navigate('keep'); assert.equal(values()[0][0], 'Unsent 0');
  await navigate('context-b'); await navigate('discard'); assertClean();
  await dirtyForm(0);
  const newScopeDraft = values();
  await act(async () => pendingPost()); await flush();
  assert.deepEqual(values(), newScopeDraft, 'late completion does not affect new Context');
  assert.equal(guardPosts.length, writesBefore + 1, 'navigation did not generate another command');
  deferPost = false;
  await navigate('context-a'); assert.equal(contextState.pendingContextId, contextId); await navigate('discard'); assertClean();
  contextScenarios += 1;

  // Capability refresh can unmount one form or hide others; their hooks still
  // clean up independently and never leave an invisible guard behind.
  for (let index = 0; index < 3; index += 1) await dirtyForm(index);
  const refreshCapabilities = async () => {
    const publish = [...container.querySelectorAll('article button')][0];
    const before = guardPosts.length;
    await act(async () => publish.click()); await flush();
    assert.equal(guardPosts.length, before + 1, 'only the explicit publish causes a mutation');
  };
  allowCreate = false; await refreshCapabilities();
  assert.equal(currentForms().length, 2);
  await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB); await navigate('keep');
  allowReport = false; allowModerate = false; await refreshCapabilities();
  assert.equal(currentForms().length, 0);
  await navigate('context-b'); assert.equal(contextState.active.context_id, contextB); assert.equal(contextState.pendingContextId, null);
  allowCreate = true; allowReport = true; allowModerate = true;
  await navigate('context-a'); assertClean(); contextScenarios += 1;

  // Removing the CE consumer must unregister every guard without changing Context.
  for (let index = 0; index < 3; index += 1) await dirtyForm(index);
  await navigate('toggle'); assert.equal(currentForms().length, 0);
  await navigate('context-b'); assert.equal(contextState.active.context_id, contextB); assert.equal(contextState.pendingContextId, null);
  await navigate('toggle'); assertClean();
  await navigate('context-a'); contextScenarios += 1;
  await act(async () => root.unmount());
}
console.log(`CE-CONTEXT-DRAFT-GUARD-01 passed: ${contextScenarios} real-provider mounted scenarios across RO/EN/FA, RTL, selection-only dirtiness, independent guard cleanup, failures/409/refresh recovery, scope isolation, late completion and zero-write navigation.`);

// Community selection tests exercise the real local dialog, actual Page and
// actual Provider. Context controls remain a harness, not the shared shell UI.
const secondCommunity = id(43);
const selectionCopy = {
  ro: { title: 'Păstrezi modificările?', keep: 'Continuă editarea', discard: 'Renunță și schimbă comunitatea', unavailable: 'Comunitatea selectată nu mai este disponibilă.' },
  en: { title: 'Keep your changes?', keep: 'Keep editing', discard: 'Discard and switch community', unavailable: 'The selected community is no longer available.' },
  fa: { title: 'تغییرات حفظ شوند؟', keep: 'ادامهٔ ویرایش', discard: 'کنارگذاشتن پیش‌نویس و تغییر جامعه', unavailable: 'جامعهٔ انتخاب‌شده دیگر در دسترس نیست.' },
};
const selector = () => container.querySelector('select[aria-label]');
const localDialog = () => container.querySelector('[role="alertdialog"]');
async function chooseCommunity(target) {
  const before = guardPosts.length;
  await act(async () => { selector().focus(); edit(selector(), target); }); await flush();
  assert.equal(guardPosts.length, before, 'Community selection is zero-write');
}
async function decideCommunity(index) {
  const before = guardPosts.length;
  await act(async () => localDialog().querySelectorAll('button')[index].click()); await flush();
  assert.equal(guardPosts.length, before, 'Keep/Discard causes no domain mutation');
}
async function keyInDialog(key, shiftKey = false) {
  const before = guardPosts.length;
  await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))); await flush();
  assert.equal(guardPosts.length, before, 'keyboard navigation is zero-write');
}
async function publishAndRefresh() {
  const before = guardPosts.length;
  await act(async () => container.querySelector('article button').click()); await flush();
  assert.equal(guardPosts.length, before + 1, 'only explicit publish sends a command');
}
async function finishDeferredPost() {
  await act(async () => pendingPost()); await flush();
  deferPost = false;
}
let selectionScenarios = 0;
for (const [lang, t] of Object.entries(selectionCopy)) {
  selectionCommunities = [communityId, secondCommunity];
  postStatus = 200; readFailure = false; deferPost = false;
  root = createRoot(container);
  await act(async () => root.render(React.createElement(DashboardTransportProvider, { value: scopedFetch },
    React.createElement(CustomerContextProvider, null, React.createElement(ContextHarness, { lang })))));
  await flush();
  assert.equal(selector().value, communityId);
  await chooseCommunity(communityId); assert.equal(localDialog(), null, 'same selection never asks');
  await chooseCommunity(secondCommunity); assert.equal(localDialog(), null, 'clean selection never asks');
  assert.equal(selector().value, secondCommunity); assertClean();
  await chooseCommunity(communityId); selectionScenarios += 1;

  for (let index = 0; index < 3; index += 1) {
    await dirtyForm(index); const before = values();
    await chooseCommunity(communityId); assert.equal(localDialog(), null, 'dirty same selection also needs no confirmation');
    await chooseCommunity(secondCommunity);
    const dialog = localDialog(); const [keep, discard] = dialog.querySelectorAll('button');
    assert.equal(selector().value, communityId, 'dirty selection retains the controlled active community');
    assert.deepEqual(values(), before);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
    assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, t.title);
    assert.ok(document.getElementById(dialog.getAttribute('aria-describedby')).textContent);
    assert.equal(keep.textContent, t.keep); assert.equal(discard.textContent, t.discard);
    assert.equal(document.activeElement, keep, 'initial focus is the safe Keep action');
    assert.ok(selector().closest('[inert]'), 'old form/selector background is inert');
    assert.ok(container.querySelector('[data-harness="context-b"]').closest('[inert]'), 'surrounding controls are inert');
    await keyInDialog('Tab', true); assert.equal(document.activeElement, discard, 'Shift+Tab wraps to last action');
    await keyInDialog('Tab'); assert.equal(document.activeElement, keep, 'Tab wraps to first action');
    await keyInDialog('Tab'); assert.equal(document.activeElement, discard);
    await act(async () => selector().focus()); assert.equal(document.activeElement, keep, 'focus cannot escape');
    const writes = guardPosts.length;
    await act(async () => {
      container.querySelector('article button').click();
      currentForms()[index].dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      container.querySelector('[data-harness="context-b"]').click();
    }); await flush();
    assert.equal(guardPosts.length, writes, 'background click and submit cannot activate');
    assert.equal(contextState.active.context_id, contextId);
    await keyInDialog('Escape');
    assert.equal(localDialog(), null); assert.equal(document.activeElement, selector(), 'Escape restores selector focus');
    assert.deepEqual(values(), before); assert.equal(selector().closest('[inert]'), null);
    await chooseCommunity(secondCommunity); await decideCommunity(0);
    assert.deepEqual(values(), before); assert.equal(selector().value, communityId); assert.equal(document.activeElement, selector());
    await chooseCommunity(secondCommunity); await decideCommunity(1);
    assert.equal(selector().value, secondCommunity); assert.equal(document.activeElement, selector()); assertClean();
    await chooseCommunity(communityId); assert.equal(localDialog(), null); assertClean();
    selectionScenarios += 1;
  }

  for (let index = 0; index < 3; index += 1) await dirtyForm(index);
  const allDrafts = values();
  await chooseCommunity(secondCommunity); await decideCommunity(0); assert.deepEqual(values(), allDrafts);
  await chooseCommunity(secondCommunity); await decideCommunity(1); assertClean();
  await chooseCommunity(communityId); assertClean(); selectionScenarios += 1;

  // A Context request suspends the local dialog. Context Keep resumes the valid
  // local decision, while actual Context confirm destroys that old local scope.
  await dirtyForm(0); await chooseCommunity(secondCommunity);
  await act(async () => contextState.select(contextB)); await flush();
  assert.equal(localDialog(), null); assert.equal(contextState.pendingContextId, contextB);
  await navigate('keep'); assert.ok(localDialog(), 'cancelled Context request resumes local decision');
  await act(async () => contextState.select(contextB)); await flush(); await navigate('discard');
  assert.equal(contextState.active.context_id, contextB); assert.equal(localDialog(), null);
  assert.equal(selector().value, communityId); assertClean();
  await navigate('context-a'); assertClean(); selectionScenarios += 1;

  // Submission failure, conflict reconciliation and refresh failure keep the
  // original scope's drafts usable by the new local-selection guard.
  for (const failureStatus of [500, 409]) {
    for (let index = 0; index < 3; index += 1) await dirtyForm(index);
    const before = values(); postStatus = failureStatus; await sendForm(1);
    assert.deepEqual(values(), before);
    await chooseCommunity(secondCommunity); await decideCommunity(0); assert.deepEqual(values(), before);
    postStatus = 200; readFailure = true; await sendForm(1);
    assert.deepEqual(values()[0], before[0]); assert.deepEqual(values()[2], before[2]);
    await chooseCommunity(secondCommunity); await decideCommunity(0);
    readFailure = false;
    await act(async () => container.querySelector('[role="alert"] button').click()); await flush();
    assert.deepEqual(values()[0], before[0]); assert.deepEqual(values()[2], before[2]);
    await chooseCommunity(secondCommunity); await decideCommunity(1); assertClean();
    await chooseCommunity(communityId); selectionScenarios += 1;
  }

  // Refreshes are driven by completion of an existing explicit command, never a
  // synthetic call into the Page's load or the Provider guard implementation.
  await dirtyForm(0); deferPost = true; await sendForm(0);
  await chooseCommunity(secondCommunity); selectionCommunities = [communityId];
  await finishDeferredPost();
  assert.equal(localDialog(), null, 'removed target cancels pending local selection');
  assert.equal(selector().value, communityId);
  // Completed draft is cleared normally; no obsolete selection happens if the target returns.
  selectionCommunities = [communityId, secondCommunity]; await publishAndRefresh();
  assert.equal(localDialog(), null); assert.equal(selector().value, communityId); selectionScenarios += 1;

  // Removing a target must also preserve OTHER unsent forms and their Context guards.
  await dirtyForm(0); await dirtyForm(1); deferPost = true; await sendForm(1);
  await chooseCommunity(secondCommunity); selectionCommunities = [communityId]; await finishDeferredPost();
  assert.equal(localDialog(), null); assert.equal(values()[0][0], 'Unsent 0');
  await navigate('context-b'); assert.equal(contextState.pendingContextId, contextB); await navigate('keep');
  selectionCommunities = [communityId, secondCommunity]; await publishAndRefresh();
  await chooseCommunity(secondCommunity); await decideCommunity(1); await chooseCommunity(communityId); selectionScenarios += 1;

  // Current-community removal fails closed: no automatic fallback, no old content
  // or authority, and explicit selection is required even if the old community returns.
  for (let index = 0; index < 3; index += 1) await dirtyForm(index);
  deferPost = true; await publishAndRefresh(); await chooseCommunity(secondCommunity);
  selectionCommunities = [secondCommunity]; await finishDeferredPost();
  assert.equal(localDialog(), null); assert.equal(selector().value, ''); assert.equal(currentForms().length, 0);
  assert.ok(container.textContent.includes(t.unavailable));
  assert.equal(document.activeElement, selector());
  await chooseCommunity(secondCommunity); assert.equal(localDialog(), null); assertClean();
  selectionCommunities = [communityId, secondCommunity]; await publishAndRefresh();
  assert.equal(selector().value, secondCommunity, 'returning eligibility never restores the old selection or drafts');
  await chooseCommunity(communityId); assertClean();
  await navigate('context-c'); assert.equal(contextState.pendingContextId, null, 'unavailable forms leave no guard');
  await navigate('context-a'); assertClean(); selectionScenarios += 1;

  // A late user-command result cannot clear the new Community's draft or create
  // another mutation. Existing in-flight semantics are otherwise unchanged.
  await dirtyForm(0); deferPost = true; const beforeLate = guardPosts.length; await sendForm(0);
  assert.equal(guardPosts.at(-1).community_id, communityId);
  await chooseCommunity(secondCommunity); await decideCommunity(1); assertClean();
  await dirtyForm(0); const newDraft = values(); await finishDeferredPost();
  assert.deepEqual(values(), newDraft); assert.equal(selector().value, secondCommunity);
  assert.equal(guardPosts.length, beforeLate + 1);
  await chooseCommunity(communityId); await decideCommunity(1); assertClean(); selectionScenarios += 1;

  // Older projection responses cannot resurrect an already removed target.
  await dirtyForm(0); holdNextProjection = true; await publishAndRefresh();
  await chooseCommunity(secondCommunity);
  selectionCommunities = [communityId];
  // Keep the draft, then explicitly publish again to obtain a newer projection
  // without remounting the Page or replacing its actual load implementation.
  await decideCommunity(0); await publishAndRefresh();
  assert.equal(selector().querySelector(`option[value="${secondCommunity}"]`), null);
  await act(async () => finishProjection()); await flush();
  assert.equal(selector().querySelector(`option[value="${secondCommunity}"]`), null);
  assert.equal(localDialog(), null);
  await clearForm(0); selectionScenarios += 1;

  // Capability refresh may remove every dirty form while a local decision is
  // visible. Cleanup must not leave a hidden Context or Community guard.
  selectionCommunities = [communityId, secondCommunity]; await publishAndRefresh();
  for (let index = 0; index < 3; index += 1) await dirtyForm(index);
  deferPost = true; await publishAndRefresh(); await chooseCommunity(secondCommunity);
  allowCreate = false; allowReport = false; allowModerate = false; await finishDeferredPost();
  assert.equal(currentForms().length, 0);
  await decideCommunity(0);
  await chooseCommunity(secondCommunity); assert.equal(localDialog(), null, 'no invisible Community guard');
  await navigate('context-b'); assert.equal(contextState.pendingContextId, null, 'no invisible Context guard');
  allowCreate = true; allowReport = true; allowModerate = true;
  await navigate('context-a'); assertClean(); selectionScenarios += 1;

  // Every community disappearing closes the modal and restores focus to the
  // remaining Page, without an invisible guard or stale selection after reload.
  selectionCommunities = [communityId, secondCommunity]; await publishAndRefresh();
  await dirtyForm(0); deferPost = true; await publishAndRefresh(); await chooseCommunity(secondCommunity);
  selectionCommunities = []; await finishDeferredPost();
  assert.equal(localDialog(), null); assert.equal(selector(), null); assert.equal(currentForms().length, 0);
  assert.equal(document.activeElement, container.querySelector('section'));
  await navigate('context-b'); assert.equal(contextState.pendingContextId, null);
  await act(async () => root.unmount());
  assert.equal(container.querySelector('[inert]'), null); selectionScenarios += 1;
}
selectionCommunities = null;
console.log(`CE-COMMUNITY-SELECTION-GUARD-01 passed: ${selectionScenarios} mounted selection/accessibility scenarios across RO/EN/FA; actual Page/dialog/Provider, no shell UI claim.`);

for (const file of runtimeFiles) fs.rmSync(file, { force: true });

console.log('CE-010 mounted Community page acceptance passed: strict named projection, exact versioned commands, no UUID display, capability routing, input-preserving refresh recovery, actionable 503 state, and RO/EN/FA mapping.');
