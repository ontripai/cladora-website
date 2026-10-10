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
const { CustomerContextProvider } = contextModule; const { CustomerCommunityBasePage } = pageModule;
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
  if (url.startsWith('/api/customer/v1/community/base')) return mode === 'not_ready' ? response({ error: { code: 'CE_COMMUNITY_CONNECTION_NOT_READY' } }, 503) : response(payload);
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
await act(async () => root.unmount());
mode = 'not_ready'; requests.length = 0; container.innerHTML = ''; root = createRoot(container); await act(async () => root.render(renderPage())); await flush();
assert.match(container.textContent, /operational Community connection has not been activated yet/); await act(async () => root.unmount());
for (const file of runtimeFiles) fs.rmSync(file, { force: true });

console.log('CE-010 mounted Community page acceptance passed: strict named projection, exact versioned commands, no UUID display, capability routing, actionable 503 state, and RO/EN/FA mapping.');
