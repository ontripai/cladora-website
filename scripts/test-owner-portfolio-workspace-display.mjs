import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

// Focused component regression only. This synthetic read transport is NOT the
// separate real Chromium/Auth/API/RPC/PostgreSQL acceptance proof.
const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../src/components/owner/OwnerPortfolioPanel.tsx', import.meta.url));
const source = readFileSync(filename, 'utf8');
const copy = {
  ro: { official: 'Registrul oficial al unităților', heading: n => `Spațiu oficial ${n} — nume indisponibil` },
  en: { official: 'Official unit records', heading: n => `Official Workspace ${n} — name unavailable` },
  fa: { official: 'دفتر رسمی واحدها', heading: n => `ورک‌اسپیس رسمی ${n} — نام در دسترس نیست` },
};
let transport;
const panelModule = new Module(filename);
panelModule.require = id => {
  if (id === '@/components/dashboard-lab/DashboardTransport') return {
    useDashboardFetch: () => transport,
    useDashboardPreview: () => false,
    DashboardLink: ({ children, ...props }) => React.createElement('a', props, children),
  };
  if (id === './OwnerOverviewPanel') return { OwnerOverviewPanel: () => null };
  if (id === '@/components/auth/SignOutButton') return { SignOutButton: () => null };
  if (id === '@/lib/owner-portfolio/labels') return { ownerLabel: (_, value) => value };
  return require(id);
};
panelModule._compile(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const { OwnerPortfolioPanel } = panelModule.exports;
const workspaceOne = '00000000-0000-4000-8000-000000000061';
const workspaceTwo = '00000000-0000-4000-8000-000000000062';
function projection(workspace, unitName, actionStatus) {
  return { projection_status: 'available', portfolio_workspace_id: workspace, items: [{
    resource: { item_kind: 'canonical_resource',
      canonical_reference: { resource_id: `${workspace}-unit`, display_name: unitName, resource_version: '7', reference_status: 'available' },
      relationship: { relationship_id: `${workspace}-relationship`, relationship_kind: 'owns', relationship_version: '3', valid_from: '2026-01-01T00:00:00Z', valid_until: null },
      source: { source_reference: `official:${workspace}` },
    }, actions: [actionStatus === 'allowed'
      ? { action_status: 'allowed', action_code: 'services.read', href: `/app/services?workspace=${workspace}` }
      : { action_status: 'withheld' }],
  }] };
}
const first = projection(workspaceOne, 'A-01', 'allowed');
const second = projection(workspaceTwo, 'B-02', 'withheld');
const calls = [];
function setProjectionData(data) {
  transport = async (input, init) => {
    assert.equal(init?.method ?? 'GET', 'GET', 'display and read rerenders must not submit a domain action');
    calls.push(String(input));
    const body = String(input).endsWith('/projection') ? { projections: data }
      : String(input).endsWith('/links') ? { links: [] }
        : String(input).includes('/annual?') ? { groups: [] }
          : { units: [], leases: [], entries: [], count: 0 };
    return { ok: true, json: async () => body };
  };
}
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:41793/en/owner-portfolio',
});
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
let scenarios = 0;
let root;
try {
  for (const lang of ['ro', 'en', 'fa']) {
    root = createRoot(document.getElementById('root'));
    const render = async data => {
      setProjectionData(data);
      await act(async () => { root.render(React.createElement(OwnerPortfolioPanel, { lang })); });
      const section = [...document.querySelectorAll('main section')].find(node =>
        node.querySelector('h2')?.textContent === copy[lang].official);
      assert.ok(section, 'the actual official section must remain present');
      return section;
    };
    const check = (section, expectedUnits) => {
      const articles = [...section.querySelectorAll('article')];
      const headings = articles.map(article => article.querySelector('h3').textContent.replace(/\s+/g, ' ').trim());
      assert.deepEqual(headings, expectedUnits.map((_, index) =>
        copy[lang].heading(new Intl.NumberFormat(lang, { useGrouping: false }).format(index + 1))));
      assert.equal(new Set(headings).size, articles.length);
      for (const [index, article] of articles.entries()) {
        const heading = article.querySelector('h3');
        assert.ok(heading.querySelector('bdi'), 'ordinal is bidi isolated, including RTL rendering');
        assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(heading.textContent), false);
        assert.equal(/PF01 operator|commercial_owner|Property One|tenant/i.test(heading.textContent), false);
        assert.equal(article.querySelector('strong').textContent, expectedUnits[index]);
        const expected = expectedUnits[index] === 'A-01' ? first : second;
        assert.ok(article.textContent.includes(expected.items[0].resource.source.source_reference));
        assert.ok(article.textContent.includes('7 / 3'));
        assert.ok(article.textContent.includes('owns'));
        assert.ok(article.textContent.includes('2026-01-01T00:00:00Z — ∞'));
        const link = article.querySelector('a');
        if (expected === first) assert.equal(link?.getAttribute('href'), `/${lang}${first.items[0].actions[0].href}`);
        else assert.equal(link, null, 'withheld action must not acquire an href');
      }
      assert.equal(document.querySelector('main').getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
      assert.equal(section.querySelector('[role="status"]'), null, 'missing name is not a pending transport');
      return articles;
    };
    check(await render([]), []);
    scenarios += 1;
    check(await render([second]), ['B-02']);
    scenarios += 1;
    const multiple = check(await render([first, second]), ['A-01', 'B-02']);
    scenarios += 1;
    const surviving = check(await render([second]), ['B-02']);
    assert.equal(surviving[0], multiple[1], 'React identity must remain the opaque Workspace key, never the ordinal');
    assert.equal(document.querySelector('main article')?.textContent.includes('A-01'), false);
    scenarios += 1;
    // A withheld group must not create ordinal holes or hide later available groups.
    check(await render([{ projection_status: 'withheld', portfolio_workspace_id: null, items: [] }, first, second]), ['A-01', 'B-02']);
    scenarios += 1;
    const hostileText = '<img src=x onerror="globalThis.displayInjected=true">';
    const escaped = projection(workspaceOne, hostileText, 'allowed');
    const section = await render([escaped]);
    assert.equal(section.querySelector('strong').textContent, hostileText);
    assert.equal(section.querySelector('img'), null, 'ordinary React text escaping remains intact');
    assert.equal(globalThis.displayInjected, undefined);
    assert.equal(section.querySelector('h3').textContent.replace(/\s+/g, ' ').trim(), copy[lang].heading(new Intl.NumberFormat(lang).format(1)));
    scenarios += 1;
    await act(async () => root.unmount());
    root = null;
  }
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
assert.ok(calls.length > 0);
console.log(JSON.stringify({ suite: 'CORE-PF01-WORKSPACE-DISPLAY-01-component', result: 'PASS',
  locales: 3, scenarios, zero_one_multiple_withheld_revoked_groups: 'PASS',
  opaque_key_unit_pairing_unchanged: 'PASS', localized_unavailable_headings_bidi_escaping: 'PASS',
  synthetic_component_transport: 'NOT_REAL_BROWSER_ACCEPTANCE',
  product_limitation: 'WORKSPACE_CANONICAL_NAME_UNAVAILABLE' }, null, 2));
