import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, filename);
  return compiled.exports;
}
const contexts = [
  {context_id: 'owner', role_code: 'owner', role_name: 'Owner', tenant_name: 'Pilot', context_label: 'A-01', scope_type: 'unit'},
  {context_id: 'reviewer', role_code: 'building_setup_reviewer', role_name: 'Reviewer', tenant_name: 'Pilot', scope_type: 'tenant'},
];
const links = node => !node || typeof node !== 'object' ? [] : [
  ...(node.props?.href ? [node.props.href] : []), ...React.Children.toArray(node.props?.children).flatMap(links),
];
for (const lang of ['fa', 'ro', 'en']) for (const status of ['prepared', 'active', 'expired']) {
  const db = {auth: {
    getClaims: async () => ({data: {claims: {sub: 'actor'}}}),
    mfa: {getAuthenticatorAssuranceLevel: async () => ({data: {currentLevel: 'aal2'}})},
  }, schema: () => ({rpc: async name => ({data: name === 'list_contexts_v1' ? contexts :
    name === 'my_pilot_setup_reviewer_v1' ? status === 'expired' ? {} : {status} :
    name === 'list_my_unit_invitations_v1' ? [] : false})})};
  const Page = load('src/app/[lang]/account/page.tsx', {
    'next/link': () => null, 'next/navigation': {redirect: () => {throw Error('unexpected redirect');}},
    '@/lib/supabase/server': {createClient: async () => db}, '@/types': {isSupportedLocale: () => true},
    '@/components/auth/SignOutButton': {SignOutButton: () => null},
  }).default;
  const hrefs = links(await Page({params: Promise.resolve({lang}), searchParams: Promise.resolve({choose: '1'})}));
  assert.ok(hrefs.includes(`/${lang}/app/dashboard?context=owner`));
  assert.ok(!hrefs.includes(`/${lang}/app/dashboard?context=reviewer`));
  assert.equal(hrefs.includes(`/${lang}/pilot-reviewer`), status !== 'expired');
  const {GET} = load('src/app/api/customer/v1/contexts/route.ts', {'@/lib/supabase/server': {createClient: async () => db}});
  assert.deepEqual((await (await GET()).json()).contexts, [contexts[0]]);
}

// A context switch must never expose the previous context's dashboard permissions.
const dom = new JSDOM('<div id="root"></div>', {url: 'https://cladora.test/fa/app/dashboard'});
const saved = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
let resolveSecond;
const second = new Promise(resolve => {resolveSecond = resolve;});
const transport = async url => url === '/api/customer/v1/contexts'
  ? {ok: true, json: async () => ({contexts: [contexts[0], {...contexts[0], context_id: 'second'}]})}
  : url.endsWith('=second') ? second : {ok: true, json: async () => ({contextId: 'owner', permissions: ['documents.vault.hold']})};
const {CustomerContextProvider, useCustomerContext} = load('src/components/customer/CustomerContextProvider.tsx', {
  '@/components/dashboard-lab/DashboardTransport': {useDashboardFetch: () => transport, useDashboardPreview: () => false},
});
let state;
function Observer() {state = useCustomerContext(); return null;}
const root = createRoot(document.getElementById('root'));
try {
  await act(async () => root.render(React.createElement(CustomerContextProvider, null, React.createElement(Observer))));
  assert.equal(state.dashboard.contextId, 'owner');
  await act(async () => state.select('second'));
  assert.equal(state.active.context_id, 'second');
  assert.equal(state.dashboard, null);
  await act(async () => resolveSecond({ok: true, json: async () => ({contextId: 'second', permissions: []})}));
  assert.deepEqual(state.dashboard.permissions, []);
  console.log('PASS reviewer routing: 9 language/lifecycle cases, dedicated review destination and context-safe permissions');
} finally {
  await act(async () => root.unmount());
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  dom.window.close();
}
