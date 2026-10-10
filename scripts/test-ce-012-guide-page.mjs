import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { classifyGuideResponse, guideReadResponseSchema, toExperienceGuideView } from '../src/lib/community/experience-guide-client.ts';
import { CANONICAL_ROLES, isRouteAllowedForPersona } from '../src/lib/customer/access-matrix.ts';
import { classifyCustomerRoute } from '../src/lib/customer/route-classifier.ts';

const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = { guide_id: id(1), workspace_id: id(2), title: 'Arrival guide', audience: { kind: 'workspace' }, status: 'draft', version: 2, can_edit: true,
  steps: [{ id: id(3), title: 'Arrival', body: 'Use the main entrance.', references: [{ id: id(4), target_type: 'document', label: 'Building rules' }] }] };
const parsed = guideReadResponseSchema.parse({ guides: [item], limit: 50 });
assert.equal(parsed.guides[0].steps[0].references[0].label, 'Building rules');
assert.equal(guideReadResponseSchema.safeParse({ guides: [{ ...item, tenant_id: id(9) }], limit: 50 }).success, false, 'private fields fail closed');
const leaked = structuredClone(item); leaked.steps[0].references[0].target_id = id(8);
assert.equal(guideReadResponseSchema.safeParse({ guides: [leaked], limit: 50 }).success, false, 'document target identifiers are not accepted in list projection');
for (const lang of ['ro', 'en', 'fa']) {
  const view = toExperienceGuideView(parsed.guides[0], lang);
  assert.equal(view.can_edit, false); assert.equal(view.steps[0].references[0].label, 'Building rules');
  assert.equal('href' in view.steps[0].references[0], false);
}
assert.deepEqual([401, 403, 404, 503, 500].map(classifyGuideResponse), ['session', 'denied', 'denied', 'not_ready', 'retry']);

const route = classifyCustomerRoute('/app/experience/guides');
assert.equal(route?.status, 'permission protected');
assert.deepEqual(route?.requirement?.permissions, ['experience.guide.read']);
assert.deepEqual(route?.requirement?.entitlements, ['module.experience_guides']);
assert.deepEqual(route?.requirement?.modules, ['experience_guides']);
for (const role of CANONICAL_ROLES) assert.equal(isRouteAllowedForPersona(role, '/app/experience/guides'), true);
const pageSource = fs.readFileSync('src/components/customer/CustomerExperienceGuidePage.tsx', 'utf8');
const shellSource = fs.readFileSync('src/components/customer/CustomerAppShell.tsx', 'utf8');
assert.doesNotMatch(pageSource, /method:\s*['"]POST['"]/);
assert.match(pageSource, /dashboard\.workspace_id/); assert.match(pageSource, /cache: 'no-store'/); assert.match(pageSource, /credentials: 'same-origin'/);
assert.match(shellSource, /hasEnt\("module\.experience_guides"\) && hasPerm\("experience\.guide\.read"\)/);

const runtimeFiles = [];
function compile(sourceName, runtimeName, replacements = []) {
  let source = fs.readFileSync(path.join('src/components/customer', sourceName), 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const target = path.join('scripts', runtimeName);
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  runtimeFiles.push(target); return `./${runtimeName}`;
}
const transportRuntime = path.join('scripts', '.ce012-dashboard-transport-runtime.mjs');
fs.writeFileSync(transportRuntime, "import{createContext,useContext}from'react';const C=createContext(globalThis.fetch);export const DashboardTransportProvider=C.Provider;export function useDashboardFetch(){return useContext(C)}export function useDashboardPreview(){return true}");
runtimeFiles.push(transportRuntime);
await import(compile('CustomerExperienceGuide.tsx', '.ce012-guide-runtime.mjs'));
const contextModule = await import(compile('CustomerContextProvider.tsx', '.ce012-context-runtime.mjs', [["@/components/dashboard-lab/DashboardTransport", './.ce012-dashboard-transport-runtime.mjs']]));
const pageModule = await import(compile('CustomerExperienceGuidePage.tsx', '.ce012-page-runtime.mjs', [
  ["@/components/dashboard-lab/DashboardTransport", './.ce012-dashboard-transport-runtime.mjs'], ['./CustomerContextProvider', './.ce012-context-runtime.mjs'],
  ['./CustomerExperienceGuide', './.ce012-guide-runtime.mjs'], ["@/lib/community/experience-guide-client", '../src/lib/community/experience-guide-client.ts'],
]));
const { DashboardTransportProvider } = await import('./.ce012-dashboard-transport-runtime.mjs');
const { CustomerContextProvider } = contextModule; const { CustomerExperienceGuidePage } = pageModule;
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/en/app/experience/guides' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client'); const container = document.getElementById('root');
const contextId = id(11); const workspaceId = id(2); let mode = 'ready'; const requests = [];
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockFetch = async (input) => {
  const url = String(input); requests.push(url);
  if (url === '/api/customer/v1/contexts') return response({ contexts: [{ context_id: contextId, membership_id: id(12), tenant_name: 'Test', role_code: 'owner', role_name: 'Owner', scope_type: 'tenant', context_label: 'Home' }] });
  if (url.startsWith('/api/customer/v1/dashboard')) return response({ contextId, workspace_id: workspaceId, context: { role_code: 'owner' }, permissions: ['experience.guide.read'], entitlements: ['module.experience_guides'], modules: ['experience_guides'] });
  if (url.startsWith('/api/customer/v1/experience/guides')) return mode === 'not_ready' ? response({ error: { code: 'CE_GUIDE_CONNECTION_NOT_READY' } }, 503) : response({ guides: [item], limit: 50 });
  throw new Error(`Unexpected request: ${url}`);
};
async function flush() { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
const renderPage = () => React.createElement(DashboardTransportProvider, { value: mockFetch }, React.createElement(CustomerContextProvider, null, React.createElement(CustomerExperienceGuidePage, { lang: 'en' })));
let root = createRoot(container); await act(async () => root.render(renderPage())); await flush();
assert.match(container.textContent, /Arrival guide/); assert.match(container.textContent, /Building rules/); assert.match(container.textContent, /Reference editing remains unavailable/);
assert.doesNotMatch(container.textContent, new RegExp(item.guide_id)); assert.equal(container.querySelector('form'), null); assert.equal(requests.some((url) => url.includes('reference_id=')), false);
await act(async () => root.unmount());
mode = 'not_ready'; requests.length = 0; container.innerHTML = ''; root = createRoot(container); await act(async () => root.render(renderPage())); await flush();
assert.match(container.textContent, /operational guides connection has not been activated yet/); await act(async () => root.unmount());
for (const file of runtimeFiles) fs.rmSync(file, { force: true });

console.log('CE-012 read-only guide page acceptance passed: strict opaque references, named selection, no UUID display/mutation, capability routing, actionable 503 state, and mounted rendering.');
