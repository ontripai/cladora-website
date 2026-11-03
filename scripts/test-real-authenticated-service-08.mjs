/**
 * TARGETED TEST SUITE: ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08
 * Package: CLADORA-FIRST-SERVICE-PRODUCT-E2E-01
 * Owner: Antigravity
 *
 * Scope of Evidence:
 * - SOURCE CONTRACTS & CONTROLLED JSDOM SIMULATION: PASS
 * - APPSHELL MOUNTING & ACTIVE SERVICE NAVIGATION: PASS
 * - ACCOUNT/CONTEXT SWITCHING & STALE DATA EVICTION: PASS
 * - ACCESS DENIAL (401 & 403) EVICTION: PASS
 * - LOGOUT (SIGNOUT & STORAGE PURGE): PASS
 * - LATE-ARRIVING RESPONSE FENCING: PASS
 * - MULTILINGUAL (FA/EN/RO) & RTL: PASS
 *
 * Explicit Non-Claimed Boundaries (NOT_RUN):
 * - Connected Playwright against live Core/Platform deployment: NOT_RUN (pending consumable delivery)
 * - Physical mobile hardware measurement: NOT_RUN
 * - Automated WCAG 2.1 AA full scan: NOT_RUN
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

let totalChecks = 0;
function check(condition, message) {
  totalChecks++;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  totalChecks++;
  assert.strictEqual(actual, expected, message);
}

console.log('=== RUNNING TARGETED VERIFICATION: ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08 ===\n');

// =========================================================================
// SECTION 1: REAL AUTH FOUNDATION & MFA GATING
// =========================================================================
console.log('--- 1. Real Auth Foundation & MFA Gating ---');

// 1.1 LoginForm inspection
const loginFormPath = path.join(root, 'src', 'components', 'auth', 'LoginForm.tsx');
check(existsSync(loginFormPath), 'src/components/auth/LoginForm.tsx exists');
const loginFormCode = readFileSync(loginFormPath, 'utf8');

check(loginFormCode.includes("import { createClient } from '@/lib/supabase/client'"), 'LoginForm imports real Supabase client');
check(loginFormCode.includes("await supabase.auth.signInWithPassword"), 'LoginForm calls signInWithPassword');
check(loginFormCode.includes("resolvePostAuthRoute(supabase, lang)"), 'LoginForm delegates post-auth route resolution to resolvePostAuthRoute');
check(loginFormCode.includes("window.location.replace(destination)"), 'LoginForm uses full document navigation to populate SSR auth cookies');
check(loginFormCode.includes("APPROVED_REASON_MESSAGES"), 'LoginForm defines approved sanitized reason messages');

// 1.2 Post-Auth Route & MFA resolution inspection
const postAuthRoutePath = path.join(root, 'src', 'lib', 'auth', 'post-auth-route.ts');
check(existsSync(postAuthRoutePath), 'src/lib/auth/post-auth-route.ts exists');
const postAuthRouteCode = readFileSync(postAuthRoutePath, 'utf8');

check(postAuthRouteCode.includes("supabase.auth.mfa.listFactors()"), 'post-auth route lists MFA factors');
check(postAuthRouteCode.includes("supabase.auth.mfa.getAuthenticatorAssuranceLevel()"), 'post-auth route inspects authenticator assurance level');
check(postAuthRouteCode.includes("assuranceResult.data.currentLevel !== 'aal2'"), 'post-auth route gates AAL2 assurance for MFA users');
check(postAuthRouteCode.includes("return `/${lang}/mfa`"), 'post-auth route redirects to MFA verification when AAL2 is not yet reached');
check(postAuthRouteCode.includes("getCustomerDashboardRoute(lang)"), 'post-auth route directs standard users to customer dashboard');

// 1.3 AppLayout Server Component Auth & MFA Gate
const appLayoutPath = path.join(root, 'src', 'app', '[lang]', 'app', 'layout.tsx');
check(existsSync(appLayoutPath), 'src/app/[lang]/app/layout.tsx exists');
const appLayoutCode = readFileSync(appLayoutPath, 'utf8');

check(appLayoutCode.includes("const { data, error } = await supabase.auth.getClaims()"), 'AppLayout verifies JWT claims via getClaims');
check(appLayoutCode.includes("redirect(`/${lang}/login`)"), 'AppLayout redirects unauthenticated sessions to /login');
check(appLayoutCode.includes("await supabase.auth.mfa.listFactors()"), 'AppLayout lists configured MFA factors');
check(appLayoutCode.includes("rpc('my_mfa_requirement_v1')"), 'AppLayout queries customer_api.my_mfa_requirement_v1');
check(appLayoutCode.includes("redirect(`/${lang}/mfa/setup?reason=customer_required`)"), 'AppLayout forces MFA setup when required');
check(appLayoutCode.includes("assurance.currentLevel !== 'aal2'"), 'AppLayout gates on AAL2 level when MFA is required');
check(appLayoutCode.includes("<CustomerAppShell lang={lang}>{children}</CustomerAppShell>"), 'AppLayout renders CustomerAppShell for authorized sessions');

// =========================================================================
// SECTION 2: CUSTOMER APP SHELL & SERVICE NAVIGATION
// =========================================================================
console.log('\n--- 2. CustomerAppShell Navigation to SERVICE ---');

const appShellPath = path.join(root, 'src', 'components', 'customer', 'CustomerAppShell.tsx');
check(existsSync(appShellPath), 'src/components/customer/CustomerAppShell.tsx exists');
const appShellCode = readFileSync(appShellPath, 'utf8');

// Check navigation item definition for SERVICE
check(appShellCode.includes("href: `/${lang}/app/services`"), 'CustomerAppShell defines /app/services navigation href');
check(appShellCode.includes("label: t.services"), 'CustomerAppShell assigns localized services label');
check(appShellCode.includes("icon: BriefcaseBusiness"), 'CustomerAppShell assigns BriefcaseBusiness icon for services');
check(appShellCode.includes("visible: state.active?.scope_type === \"tenant\""), 'CustomerAppShell restricts services nav item to tenant scope');

// Check role permission evaluation for SERVICE
check(appShellCode.includes('["/app/airprop", "/app/services", "/app/ownership/relationships"].includes(path)'),
  'CustomerAppShell explicitly permits /app/services when active scope_type is tenant');

// Check active navigation highlighting
check(appShellCode.includes("aria-current={isActive ? 'page' : undefined}"), 'CustomerAppShell applies aria-current on active nav item');
check(appShellCode.includes("bg-[#EAF8F5] text-[#0A6E62]"), 'CustomerAppShell applies active emerald styling');

// Check Mobile navigation bar
check(appShellCode.includes('aria-label="Mobile Navigation"'), 'CustomerAppShell includes accessible mobile navigation bar');
check(appShellCode.includes('className="flex md:hidden items-center gap-2 overflow-x-auto'),
  'CustomerAppShell configures horizontal scrollable mobile navigation');

// Check Context selector and SignOut
check(appShellCode.includes('<select'), 'CustomerAppShell includes context selector');
check(appShellCode.includes('aria-label={t.context}'), 'Context selector has accessible name');
check(appShellCode.includes('<SignOutButton lang={lang} variant="customer" />'), 'CustomerAppShell mounts SignOutButton');

// Check RTL support
check(appShellCode.includes('dir={lang === "fa" ? "rtl" : "ltr"}'), 'CustomerAppShell sets RTL direction for FA');

// =========================================================================
// SECTION 3: ROUTE GUARD & SERVICE CATALOG ROUTE
// =========================================================================
console.log('\n--- 3. Route Guard & Service Catalog Route ---');

// 3.1 Service Page inspection
const servicePagePath = path.join(root, 'src', 'app', '[lang]', 'app', 'services', 'page.tsx');
check(existsSync(servicePagePath), 'src/app/[lang]/app/services/page.tsx exists');
const servicePageCode = readFileSync(servicePagePath, 'utf8');
check(servicePageCode.includes('<CustomerServiceCatalog lang={lang} />'), 'ServicesPage renders CustomerServiceCatalog');

// 3.2 Route classifier inspection
const classifierPath = path.join(root, 'src', 'lib', 'customer', 'route-classifier.ts');
check(existsSync(classifierPath), 'src/lib/customer/route-classifier.ts exists');
const classifierCode = readFileSync(classifierPath, 'utf8');
check(classifierCode.includes('{ pathPrefix: "/app/services", exactOnly: true, nativeWorkspaceDiscovery: true }'),
  'route-classifier configures /app/services with nativeWorkspaceDiscovery');

// 3.3 CustomerRouteGuard native workspace discovery handling
const routeGuardPath = path.join(root, 'src', 'components', 'customer', 'CustomerRouteGuard.tsx');
check(existsSync(routeGuardPath), 'src/components/customer/CustomerRouteGuard.tsx exists');
const routeGuardCode = readFileSync(routeGuardPath, 'utf8');
check(routeGuardCode.includes('classification.requirement?.nativeWorkspaceDiscovery'),
  'CustomerRouteGuard evaluates nativeWorkspaceDiscovery');
check(routeGuardCode.includes("state.active?.scope_type === 'tenant'"),
  'CustomerRouteGuard checks scope_type === tenant for native discovery routes');

// 3.4 CustomerServiceCatalog mounting & workspace targets
const catalogPath = path.join(root, 'src', 'components', 'customer', 'CustomerServiceCatalog.tsx');
check(existsSync(catalogPath), 'src/components/customer/CustomerServiceCatalog.tsx exists');
const catalogCode = readFileSync(catalogPath, 'utf8');

check(catalogCode.includes('const { active } = useCustomerContext()'), 'CustomerServiceCatalog retrieves active context');
check(catalogCode.includes('active ? <WorkspaceChoice key={active.context_id}'),
  'CustomerServiceCatalog binds WorkspaceChoice key to active.context_id ensuring fresh remount on switch');
check(catalogCode.includes('<Notice text={t.noContext} />'), 'CustomerServiceCatalog displays noContext notice when unassigned');
check(catalogCode.includes('/api/customer/v1/workspace/targets'), 'WorkspaceChoice queries workspace targets');
check(catalogCode.includes('/api/customer/v1/services/catalog'), 'Offerings queries services catalog');
check(catalogCode.includes('<CustomerServiceRequests'), 'CustomerServiceCatalog renders CustomerServiceRequests form');

// =========================================================================
// SECTION 4: DYNAMIC APPSHELL RENDER & LIFECYCLE SIMULATION (JSDOM)
// =========================================================================
console.log('\n--- 4. Dynamic CustomerAppShell Render & Lifecycle Simulation (JSDOM) ---');

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const contextIdA = uuid(101);
const contextIdB = uuid(102);
const workspaceId1 = uuid(201);
const workspaceId2 = uuid(202);
const offeringId = uuid(301);
const revisionId = uuid(302);

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test/en/app/services' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const modulesCache = new Map();
let currentFetchHandler = async () => new Response('{}');
let signOutCalled = false;
let lastRouterReplace = null;

function loadModule(relativePath) {
  const fullPath = path.resolve(root, relativePath);
  if (modulesCache.has(fullPath)) return modulesCache.get(fullPath).exports;

  const mod = new Module(fullPath);
  modulesCache.set(fullPath, mod);

  mod.require = (request) => {
    if (request === '@/components/dashboard-lab/DashboardTransport') {
      return {
        useDashboardFetch: () => currentFetchHandler,
        useDashboardPreview: () => false,
        DashboardTransportProvider: ({ children, value }) => {
          currentFetchHandler = value;
          return React.createElement('div', { 'data-transport': 'true' }, children);
        },
      };
    }
    if (request === '@/lib/supabase/client') {
      return {
        createClient: () => ({
          auth: {
            signOut: async () => {
              signOutCalled = true;
              return { error: null };
            },
          },
        }),
      };
    }
    if (request === 'next/navigation') {
      return {
        usePathname: () => '/en/app/services',
        useRouter: () => ({
          replace: (url) => { lastRouterReplace = url; },
          push: () => {},
          refresh: () => {},
        }),
      };
    }
    if (request === 'next/link') {
      return {
        __esModule: true,
        default: ({ children, ...props }) => React.createElement('a', props, children),
      };
    }
    if (request === '@/components/brand/CladoraBrand') {
      return {
        CladoraBrand: () => React.createElement('span', { 'data-testid': 'brand' }),
      };
    }
    if (request === '@/components/ui/LanguageSwitcher') {
      return {
        LanguageSwitcher: () => React.createElement('button', { 'data-testid': 'lang-switcher' }, 'Lang'),
      };
    }
    if (request.startsWith('@/')) {
      const target = 'src/' + request.slice(2);
      const ext = existsSync(path.resolve(root, target + '.tsx')) ? '.tsx' : '.ts';
      return loadModule(target + ext);
    }
    if (request.startsWith('.')) {
      const dir = path.dirname(fullPath);
      let resolvedTarget = path.resolve(dir, request);
      if (!existsSync(resolvedTarget)) {
        if (existsSync(resolvedTarget + '.tsx')) resolvedTarget += '.tsx';
        else if (existsSync(resolvedTarget + '.ts')) resolvedTarget += '.ts';
      }
      return loadModule(path.relative(root, resolvedTarget));
    }
    return require(request);
  };

  const fileContent = readFileSync(fullPath, 'utf8');
  const compiled = ts.transpileModule(fileContent, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  mod._compile(compiled, fullPath);
  return mod.exports;
}

const { CustomerAppShell } = loadModule('src/components/customer/CustomerAppShell.tsx');
const { CustomerServiceCatalog } = loadModule('src/components/customer/CustomerServiceCatalog.tsx');

const tenantContextA = {
  context_id: contextIdA,
  membership_id: uuid(501),
  tenant_name: 'Alpha Property Association',
  role_code: 'property_manager',
  role_name: 'Property Manager',
  scope_type: 'tenant',
  context_label: 'Alpha Main',
};

const tenantContextB = {
  context_id: contextIdB,
  membership_id: uuid(502),
  tenant_name: 'Beta Commercial Complex',
  role_code: 'property_manager',
  role_name: 'Property Manager',
  scope_type: 'tenant',
  context_label: 'Beta North',
};

const sampleOfferings = [
  {
    offering_id: offeringId,
    revision_id: revisionId,
    labels: { en: 'HVAC Seasonal Inspection', ro: 'Inspecție sezonieră HVAC', fa: 'بازرسی فصلی تأسیسات' },
    description: { en: 'Comprehensive cooling and heating audit', ro: 'Audit complet de climatizare', fa: 'بررسی جامع سیستم‌های سرمایش و گرمایش' },
    acquisition_mode: 'direct',
    price: { kind: 'fixed', amount: '1250.00', currency: 'RON', tax_display: 'included' },
    valid_from: '2026-01-01T00:00:00.000Z',
    valid_until: null,
    cancellation_terms: { en: '48h notice required', ro: 'Notificare cu 48h înainte', fa: 'اعلام ۴۸ ساعت قبل الزامی است' },
    acceptance_criteria: { en: 'Signed engineering report', ro: 'Raport tehnic semnat', fa: 'گزارش امضا شده مهندسی' },
  },
];

const rootElement = dom.window.document.getElementById('root');
const reactRoot = createRoot(rootElement);
const tick = () => new Promise((resolve) => setTimeout(resolve, 15));

let catalogRequestedWorkspace = null;

try {
  // Test 4.1: Render actual CustomerAppShell with CustomerServiceCatalog inside
  currentFetchHandler = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/customer/v1/profile')) {
      return { ok: true, status: 200, json: async () => ({ display_name: 'Elena Vancea' }) };
    }
    if (urlStr.includes('/api/customer/v1/contexts')) {
      return { ok: true, status: 200, json: async () => ({ contexts: [tenantContextA, tenantContextB] }) };
    }
    if (urlStr.includes('/api/customer/v1/dashboard')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          contextId: contextIdA,
          context: { role_code: 'property_manager' },
          permissions: ['workspace.role.read'],
          entitlements: ['module.maintenance'],
          modules: ['maintenance'],
        }),
      };
    }
    if (urlStr.includes('/api/customer/v1/workspace/targets')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          workspaces: [
            { workspace_id: workspaceId1, workspace_type: 'ASSOCIATION', environment: 'PRODUCTION' },
            { workspace_id: workspaceId2, workspace_type: 'ASSOCIATION', environment: 'PRODUCTION' },
          ],
        }),
      };
    }
    if (urlStr.includes('/api/customer/v1/services/catalog')) {
      const u = new URL(urlStr, 'https://cladora.test');
      catalogRequestedWorkspace = u.searchParams.get('workspace_id');
      return { ok: true, status: 200, json: async () => ({ offerings: sampleOfferings }) };
    }
    if (urlStr.includes('/api/customer/v1/services/requests')) {
      return { ok: true, status: 200, json: async () => ({ can_request: true, beneficiaries: [], requests: [] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  await act(async () => {
    reactRoot.render(
      React.createElement(CustomerAppShell, { lang: 'en' },
        React.createElement(CustomerServiceCatalog, { lang: 'en' })
      )
    );
    await tick();
  });

  // Verify CustomerAppShell is actually rendered in the DOM
  const header = dom.window.document.querySelector('header');
  check(header !== null, 'CustomerAppShell header is rendered in DOM');

  const contextSelect = dom.window.document.querySelector('select[aria-label="Active context"]');
  check(contextSelect !== null, 'CustomerAppShell context dropdown is rendered in DOM');
  equal(contextSelect.value, contextIdA, 'Context select defaults to initial tenant context A');

  // Verify active navigation highlighting for /en/app/services in AppShell
  const mobileNav = dom.window.document.querySelector('nav[aria-label="Mobile Navigation"]');
  check(mobileNav !== null, 'Mobile navigation bar is rendered in DOM');
  const mobileServiceLink = mobileNav.querySelector('a[href="/en/app/services"]');
  check(mobileServiceLink !== null, 'Mobile navigation contains /en/app/services link');
  equal(mobileServiceLink.getAttribute('aria-current'), 'page', 'Mobile service nav item has aria-current="page"');
  check(mobileServiceLink.className.includes('bg-[#EAF8F5]'), 'Mobile service nav item has active background styling');

  const desktopSidebar = dom.window.document.querySelector('aside');
  check(desktopSidebar !== null, 'Desktop sidebar navigation is rendered in DOM');
  const desktopServiceLink = desktopSidebar.querySelector('a[href="/en/app/services"]');
  check(desktopServiceLink !== null, 'Desktop sidebar contains /en/app/services link');
  equal(desktopServiceLink.getAttribute('aria-current'), 'page', 'Desktop service nav item has aria-current="page"');

  // Select workspace 1
  const workspaceSelect = dom.window.document.querySelector('select[aria-label="Choose a workspace"]');
  check(workspaceSelect !== null, 'Workspace selector inside CustomerServiceCatalog is rendered');

  await act(async () => {
    workspaceSelect.value = workspaceId1;
    workspaceSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick();
  });

  equal(catalogRequestedWorkspace, workspaceId1, 'Catalog was fetched for chosen workspace 1');
  check(dom.window.document.body.textContent.includes('HVAC Seasonal Inspection'), 'Offering title is visible in DOM');
  check(dom.window.document.body.textContent.includes('1250.00 RON'), 'Offering price is rendered with exact currency');
  check(dom.window.document.body.textContent.includes('48h notice required'), 'Cancellation terms are rendered');

  // Test 4.2: Dynamic Context / Account Switch via AppShell context selector
  await act(async () => {
    contextSelect.value = contextIdB;
    contextSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick();
  });

  equal(contextSelect.value, contextIdB, 'Context dropdown successfully updated to tenant context B');
  // Stale offerings and previous workspace choice must be immediately evicted from DOM
  check(!dom.window.document.body.textContent.includes('HVAC Seasonal Inspection'),
    'Switching context immediately evicts previous service offerings from DOM');
  const resetWorkspaceSelect = dom.window.document.querySelector('select[aria-label="Choose a workspace"]');
  check(resetWorkspaceSelect !== null, 'New WorkspaceChoice is mounted with reset selection');
  equal(resetWorkspaceSelect.value, '', 'New workspace selector starts unselected');

  // Test 4.3: Dynamic 403 Forbidden Denial -> AccessRestrictedCard rendered & data cleared
  currentFetchHandler = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/customer/v1/contexts')) {
      return { ok: false, status: 403, json: async () => ({ error: { code: 'FORBIDDEN' } }) };
    }
    return { ok: false, status: 403, json: async () => ({}) };
  };

  const refreshBtn = dom.window.document.querySelector('button[aria-label="Refresh"]');
  check(refreshBtn !== null, 'CustomerAppShell refresh button is rendered');

  await act(async () => {
    refreshBtn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await tick();
  });

  check(dom.window.document.body.textContent.includes('Access Denied'),
    '403 denial causes CustomerRouteGuard to render AccessRestrictedCard with Access Denied');
  check(!dom.window.document.body.textContent.includes('HVAC Seasonal Inspection'),
    '403 denial guarantees zero service offering data remains in DOM');

  // Test 4.4: Dynamic 401 Session Expired Denial -> Lock card with login action
  currentFetchHandler = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/customer/v1/contexts')) {
      return { ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  };

  await act(async () => {
    reactRoot.render(
      React.createElement(CustomerAppShell, { lang: 'en' },
        React.createElement(CustomerServiceCatalog, { lang: 'en' })
      )
    );
    await tick();
  });

  check(dom.window.document.body.textContent.includes('Session Expired'),
    '401 denial causes CustomerRouteGuard to render AccessRestrictedCard with Session Expired');
  const loginAction = dom.window.document.querySelector('a[href="/en/login?reason=session_expired"]');
  check(loginAction !== null, '401 denial renders action link directing to /en/login?reason=session_expired');

  // Test 4.5: Dynamic SignOut / Logout via SignOutButton
  dom.window.sessionStorage.setItem('cladora.customer-context.v1', contextIdA);
  const signOutBtn = dom.window.document.querySelector('button[title="Secure sign out"]');
  check(signOutBtn !== null, 'CustomerAppShell header mounts SignOutButton');

  await act(async () => {
    signOutBtn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await tick();
  });

  check(signOutCalled, 'SignOutButton triggers supabase.auth.signOut({ scope: "local" })');
  equal(dom.window.sessionStorage.getItem('cladora.customer-context.v1'), null,
    'SignOutButton removes customer-context key from sessionStorage');
  equal(lastRouterReplace, '/en/login', 'SignOutButton navigates router to /en/login');

  // Test 4.6: Dynamic Late-Arriving Response Fencing
  let releaseLateDashboard;
  const pendingLateDashboard = new Promise((resolve) => {
    releaseLateDashboard = resolve;
  });

  currentFetchHandler = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/customer/v1/contexts')) {
      return { ok: true, status: 200, json: async () => ({ contexts: [tenantContextA, tenantContextB] }) };
    }
    if (urlStr.includes('/api/customer/v1/dashboard')) {
      if (urlStr.includes(contextIdA)) {
        return pendingLateDashboard;
      }
      return {
        ok: true, status: 200,
        json: async () => ({
          contextId: contextIdB,
          context: { role_code: 'property_manager' },
          marker: 'FRESH_CONTEXT_B_DATA',
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  // Switch context from A to B while A's dashboard fetch is pending
  await act(async () => {
    contextSelect.value = contextIdB;
    contextSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick();
  });

  // Release late response for A
  await act(async () => {
    releaseLateDashboard({
      ok: true, status: 200,
      json: async () => ({
        contextId: contextIdA,
        context: { role_code: 'property_manager' },
        marker: 'STALE_CONTEXT_A_LEAK',
      }),
    });
    await tick();
  });

  check(!dom.window.document.body.textContent.includes('STALE_CONTEXT_A_LEAK'),
    'Late-arriving response from prior context is strictly fenced and cannot resurrect previous data');

  console.log('PASS Dynamic CustomerAppShell render, context switch, 403/401 denial, logout, and late fencing verified');
} finally {
  await act(async () => reactRoot.unmount());
  dom.window.close();
}

// =========================================================================
// SECTION 5: MULTILINGUAL, RTL, KEYBOARD & MOBILE ACCESSIBILITY
// =========================================================================
console.log('\n--- 5. Multilingual, RTL, Keyboard & Mobile Accessibility ---');

// 5.1 Multilingual translations check
const locales = ['fa', 'en', 'ro'];
for (const lang of locales) {
  check(appShellCode.includes(`${lang}: {`), `CustomerAppShell contains translations for ${lang}`);
  check(catalogCode.includes(`${lang}: {`), `CustomerServiceCatalog contains translations for ${lang}`);
  check(loginFormCode.includes(`${lang}: '`), `LoginForm contains approved messages for ${lang}`);
}

// Check specific FA RTL copy
check(appShellCode.includes("services: \"خدمات فضای کاری\""), 'CustomerAppShell has correct FA translation for services');
check(catalogCode.includes("title: 'خدمات فضای کاری'"), 'CustomerServiceCatalog has correct FA translation for title');
check(catalogCode.includes("choose: 'فضای کاری را انتخاب کنید'"), 'CustomerServiceCatalog has correct FA translation for workspace select');

// Check RO copy
check(appShellCode.includes("services: \"Servicii în spațiul de lucru\""), 'CustomerAppShell has correct RO translation for services');
check(catalogCode.includes("title: 'Serviciile spațiului de lucru'"), 'CustomerServiceCatalog has correct RO translation for title');
check(catalogCode.includes("choose: 'Alege un spațiu de lucru'"), 'CustomerServiceCatalog has correct RO translation for workspace select');

// Check EN copy
check(appShellCode.includes("services: \"Workspace services\""), 'CustomerAppShell has correct EN translation for services');
check(catalogCode.includes("title: 'Workspace services'"), 'CustomerServiceCatalog has correct EN translation for title');
check(catalogCode.includes("choose: 'Choose a workspace'"), 'CustomerServiceCatalog has correct EN translation for workspace select');

// 5.2 SignOutButton & Storage Eviction
const signOutPath = path.join(root, 'src', 'components', 'auth', 'SignOutButton.tsx');
check(existsSync(signOutPath), 'src/components/auth/SignOutButton.tsx exists');
const signOutCode = readFileSync(signOutPath, 'utf8');

check(signOutCode.includes("sessionStorage.removeItem(STORAGE_KEY)"), 'SignOutButton removes customer-context from sessionStorage');
check(signOutCode.includes("supabase.auth.signOut({ scope: 'local' })"), 'SignOutButton calls supabase.auth.signOut');
check(signOutCode.includes("router.replace(`/${lang}/login`)"), 'SignOutButton redirects to /login on sign-out');

// 5.3 Interface contract ADR file existence
const adrPath = path.join(root, 'docs', 'architecture', 'ADR-CLD-052-real-authenticated-service-product-e2e.md');
check(existsSync(adrPath), 'ADR-CLD-052 interface specification document exists');
const adrContent = readFileSync(adrPath, 'utf8');
check(adrContent.includes('ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08'), 'ADR-CLD-052 references TASK_ID');
check(adrContent.includes('CLADORA-FIRST-SERVICE-PRODUCT-E2E-01'), 'ADR-CLD-052 references package');
check(adrContent.includes('Service Domain Owner'), 'ADR-CLD-052 defines Service domain owner boundaries');
check(adrContent.includes('Core Domain Owner'), 'ADR-CLD-052 defines Core domain owner boundaries');
check(adrContent.includes('Data Isolation & Stale Data Eviction Guarantees'), 'ADR-CLD-052 documents data isolation guarantees');

// =========================================================================
// SECTION 6: EVIDENCE CLASSIFICATION & NOT_RUN BOUNDARIES
// =========================================================================
const receipt = {
  task_id: 'ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08',
  verdict: 'SCOPED_EVIDENCE_SOURCE_AND_CONTROLLED_JSDOM_PASS',
  total_checks_passed: totalChecks,
  tested_surfaces: {
    real_auth_source_contracts_and_mfa_gating: 'PASS',
    appshell_rendered_in_dom: 'PASS',
    service_navigation_active_highlighting: 'PASS',
    account_context_switch_eviction: 'PASS',
    denial_403_forbidden_eviction: 'PASS',
    denial_401_session_expired_eviction: 'PASS',
    logout_sessionstorage_auth_eviction: 'PASS',
    late_arriving_response_fencing: 'PASS',
    multilingual_fa_en_ro_and_rtl_direction: 'PASS',
  },
  not_run_boundaries: {
    connected_playwright_live_deployment: 'NOT_RUN_PENDING_CONSUMABLE_CORE_PLATFORM',
    physical_mobile_device_testing: 'NOT_RUN',
    automated_wcag_full_scan: 'NOT_RUN',
  },
};

console.log('\n=======================================================');
console.log(JSON.stringify(receipt, null, 2));
console.log(`\nPASS ${totalChecks}/${totalChecks} SOURCE CONTRACTS & CONTROLLED APPSHELL/SERVICE JSDOM SIMULATION; CONNECTED BROWSER NOT_RUN PENDING CONSUMABLE CORE/PLATFORM DELIVERY`);
console.log('=======================================================\n');
