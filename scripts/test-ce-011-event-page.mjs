import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import {
  classifyEventResponse,
  eventReadResponseSchema,
  newEventCommandIdentity,
  toEventInterestView,
} from '../src/lib/community/event-interest-client.ts';
import { eventCommandSchema } from '../src/lib/community/event-interest-schema.ts';
import { CANONICAL_ROLES, isRouteAllowedForPersona } from '../src/lib/customer/access-matrix.ts';
import { classifyCustomerRoute } from '../src/lib/customer/route-classifier.ts';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const item = {
  event_id: id(1), occurrence_id: id(2), workspace_id: id(3), title: 'Community briefing',
  starts_at: '2026-10-10T12:00:00+00:00', ends_at: '2026-10-10T13:00:00+00:00', timezone: 'Europe/Bucharest',
  status: 'published', version: 2, audience_kind: 'roles', interest_status: null, interest_version: 0,
  can_publish: false, can_cancel: true, can_register_interest: true, can_withdraw_interest: false,
  can_record_attendance: true, eligible_attendance_members: [{ membership_id: id(4), display_name: 'Ana Popescu' }],
};
const parsed = eventReadResponseSchema.parse({ workspace_id: id(3), events: [item] });
assert.equal(parsed.events[0].eligible_attendance_members[0].display_name, 'Ana Popescu');
assert.equal(eventReadResponseSchema.safeParse({ workspace_id: id(3), events: [{ ...item, tenant_id: id(9) }] }).success, false, 'private projection fields fail closed');
assert.equal(eventReadResponseSchema.safeParse({ workspace_id: id(5), events: [{ ...item, workspace_id: id(5), version: 0 }] }).success, false, 'invalid optimistic version fails closed');

assert.equal(toEventInterestView(parsed.events[0], 'ro').audience_label, 'Roluri eligibile');
assert.equal(toEventInterestView(parsed.events[0], 'en').audience_label, 'Eligible roles');
assert.equal(toEventInterestView(parsed.events[0], 'fa').audience_label, 'نقش‌های مجاز');
assert.deepEqual([401, 403, 404, 503, 500].map(classifyEventResponse), ['session', 'denied', 'denied', 'not_ready', 'retry']);

const identity = newEventCommandIdentity(() => id(10));
assert.deepEqual(identity, { command_id: id(10), idempotency_key: `ce011.ui.${id(10)}` });
const base = { ...identity, context_id: id(11), workspace_id: id(3), event_id: id(1), expected_version: 2, reason: 'Customer event page acceptance test' };
for (const command of [
  { ...base, type: 'publish_event' },
  { ...base, type: 'cancel_event' },
  { ...base, type: 'register_interest', expected_interest_version: 0 },
  { ...base, type: 'withdraw_interest', expected_interest_version: 1 },
  { ...base, type: 'record_attendance', target_membership_id: id(4), observed_local: '2026-10-10T15:10', timezone: 'Europe/Bucharest' },
]) assert.equal(eventCommandSchema.safeParse(command).success, true, `${command.type} matches the server command contract`);

const route = classifyCustomerRoute('/app/community/events');
assert.equal(route?.status, 'permission protected');
assert.deepEqual(route?.requirement?.permissions, ['events.event.read']);
assert.deepEqual(route?.requirement?.entitlements, ['module.community_events']);
assert.deepEqual(route?.requirement?.modules, ['community_events']);
assert.equal(classifyCustomerRoute('/app/community/events/private')?.status, 'permission protected');
for (const role of CANONICAL_ROLES) assert.equal(isRouteAllowedForPersona(role, '/app/community/events'), true, `${role} may consume an authorized event audience`);

const page = fs.readFileSync('src/components/customer/CustomerEventInterestPage.tsx', 'utf8');
const shell = fs.readFileSync('src/components/customer/CustomerAppShell.tsx', 'utf8');
const sql = fs.readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql', 'utf8');
assert.match(page, /dashboard\.workspace_id/);
assert.match(page, /credentials: 'same-origin'/);
assert.match(page, /cache: 'no-store'/);
assert.match(page, /expected_interest_version/);
assert.match(page, /target_membership_id/);
assert.match(page, /response\.status === 409/);
assert.match(page, /CE|not a booking|nu crea o rezervare|بدون ایجاد رزرو/);
assert.match(shell, /hasEnt\("module\.community_events"\) && hasPerm\("events\.event\.read"\)/);
for (const field of ['workspace_id','audience_kind','can_publish','can_cancel','can_register_interest','can_withdraw_interest','can_record_attendance','eligible_attendance_members']) assert.match(sql, new RegExp(`'${field}'`));
assert.match(sql, /identity\.profiles/);
assert.match(sql, /ce_event_audience_eligible_v1\(e\.id,m\.id\)/);

const runtimeFiles = [];
function compile(sourceName, runtimeName, replacements = []) {
  let source = fs.readFileSync(path.join('src/components/customer', sourceName), 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const target = path.join('scripts', runtimeName);
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  runtimeFiles.push(target);
  return `./${runtimeName}`;
}

const transportRuntime = path.join('scripts', '.ce011-dashboard-transport-runtime.mjs');
fs.writeFileSync(transportRuntime, "import{createContext,useContext}from'react';const C=createContext(globalThis.fetch);export const DashboardTransportProvider=C.Provider;export function useDashboardFetch(){return useContext(C)}export function useDashboardPreview(){return true}");
runtimeFiles.push(transportRuntime);
const interestModule = await import(compile('CustomerEventInterest.tsx', '.ce011-interest-page-runtime.mjs'));
const contextModule = await import(compile('CustomerContextProvider.tsx', '.ce011-context-page-runtime.mjs', [
  ["@/components/dashboard-lab/DashboardTransport", './.ce011-dashboard-transport-runtime.mjs'],
]));
const pageModule = await import(compile('CustomerEventInterestPage.tsx', '.ce011-page-runtime.mjs', [
  ["@/components/dashboard-lab/DashboardTransport", './.ce011-dashboard-transport-runtime.mjs'],
  ['./CustomerContextProvider', './.ce011-context-page-runtime.mjs'],
  ['./CustomerEventInterest', './.ce011-interest-page-runtime.mjs'],
  ["@/lib/community/event-interest-client", '../src/lib/community/event-interest-client.ts'],
]));
const { DashboardTransportProvider } = await import('./.ce011-dashboard-transport-runtime.mjs');
const { CustomerContextProvider } = contextModule;
const { CustomerEventInterestPage } = pageModule;
assert.equal(typeof interestModule.CustomerEventInterest, 'function');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/en/app/community/events' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const contextId = id(11); const workspaceId = id(3); const membershipId = id(12);
let mode = 'ready'; const requests = [];
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockFetch = async (input, init = {}) => {
  const url = String(input); requests.push({ url, init });
  if (url === '/api/customer/v1/contexts') return response({ contexts: [{ context_id: contextId, membership_id: membershipId, tenant_name: 'Test', role_code: 'owner', role_name: 'Owner', scope_type: 'tenant', context_label: 'Home' }] });
  if (url.startsWith('/api/customer/v1/dashboard')) return response({ contextId, workspace_id: workspaceId, context: { role_code: 'owner' }, permissions: ['events.event.read', 'events.interest.manage_self'], entitlements: ['module.community_events'], modules: ['community_events'] });
  if (url.startsWith('/api/customer/v1/community/events') && (!init.method || init.method === 'GET')) return mode === 'not_ready' ? response({ error: { code: 'CE_EVENT_CONNECTION_NOT_READY' } }, 503) : response({ workspace_id: workspaceId, events: [item] });
  if (url === '/api/customer/v1/community/events' && init.method === 'POST') return response({ ok: true });
  throw new Error(`Unexpected test request: ${url}`);
};
const container = document.getElementById('root');
async function flush() { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
const renderPage = () => React.createElement(
  DashboardTransportProvider,
  { value: mockFetch },
  React.createElement(CustomerContextProvider, null, React.createElement(CustomerEventInterestPage, { lang: 'en' })),
);
let root = createRoot(container);
await act(async () => root.render(renderPage()));
await flush();
assert.match(container.textContent, /Community briefing/, `requests: ${requests.map((request) => request.url).join(', ')}`);
assert.match(container.textContent, /Registering interest is not a booking/);
assert.doesNotMatch(container.textContent, new RegExp(item.event_id));
const interestButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Register interest');
assert.ok(interestButton, 'Mounted page exposes the server-authorized interest action');
await act(async () => { interestButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await Promise.resolve(); });
await flush();
const post = requests.find((request) => request.init.method === 'POST');
assert.ok(post, 'Mounted action reaches the authenticated Event API');
const posted = JSON.parse(post.init.body);
assert.equal(posted.context_id, contextId); assert.equal(posted.workspace_id, workspaceId); assert.equal(posted.event_id, item.event_id);
assert.equal(posted.expected_version, 2); assert.equal(posted.expected_interest_version, 0); assert.equal(posted.type, 'register_interest');
await act(async () => root.unmount());

mode = 'not_ready'; requests.length = 0; container.innerHTML = ''; root = createRoot(container);
await act(async () => root.render(renderPage()));
await flush();
assert.match(container.textContent, /operational events connection has not been activated yet/);
await act(async () => root.unmount());
for (const file of runtimeFiles) fs.rmSync(file, { force: true });

console.log('CE-011 mounted page acceptance passed: strict projection, exact versioned POST, named choices, no UUID display, capability navigation, route guard, actionable 503 state, and RO/EN/FA copy.');
