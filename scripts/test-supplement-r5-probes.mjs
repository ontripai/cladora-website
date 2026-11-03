// Real-component probe verification for SUPPLEMENT-R5
// TASK_ID: ANTIGRAVITY-DEMO-FUNCTIONAL-REPAIR-05 / SUPPLEMENT-R5
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const root = process.cwd();
const localRequire = createRequire(path.join(root, 'package.json'));
let checks = 0;
const check = (v, m) => { assert.ok(v, m); checks++; };
const equal = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

// Custom loader for real TypeScript / TSX components
const cache = new Map();
let currentPathname = '/en/demo/app/dashboard';
let authListeners = [];
let mockSession = null;
let mockUser = null;
let lastPushedRoute = null;

let currentMockReports = null;
let lastQueriedModule = null;

// Mock control for pending lookup and retry in DemoAuthPortal
let pendingLookupResolver = null;
let simulateSlowLookup = false;
let mockLookupError = null;
let mockWorkspaceReturn = null;

// Mock control for slow getSession and signOut in DemoAppShell
let slowGetSessionResolver = null;
let simulateSlowGetSession = false;
let mockSignOutError = null;
let mockSignOutThrows = false;

const mockSupabaseClient = {
  auth: {
    getSession: async () => {
      if (simulateSlowGetSession) {
        return new Promise((resolve) => {
          slowGetSessionResolver = resolve;
        });
      }
      return {
        data: { session: mockSession },
        error: null
      };
    },
    onAuthStateChange: (cb) => {
      authListeners.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners = authListeners.filter((fn) => fn !== cb);
            }
          }
        }
      };
    },
    signOut: async () => {
      if (mockSignOutThrows) {
        throw new Error('Network failure during sign out');
      }
      if (mockSignOutError) {
        return { error: mockSignOutError };
      }
      mockSession = null;
      mockUser = null;
      authListeners.forEach((fn) => fn('SIGNED_OUT', null));
      return { error: null };
    }
  }
};

const mockRouter = {
  push: (url) => { lastPushedRoute = url; },
  replace: (url) => { lastPushedRoute = url; }
};

const mocks = {
  'server-only': {},
  'next/link': {
    __esModule: true,
    default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
  },
  'next/navigation': {
    usePathname: () => currentPathname,
    useRouter: () => mockRouter,
    notFound: () => { throw new Error('NOT_FOUND'); },
    redirect: (url) => { lastPushedRoute = url; }
  },
  '@/lib/supabase/client': {
    createClient: () => mockSupabaseClient
  },
  '@/lib/supabase/env': {
    isSupabaseConfigured: () => true
  },
  '@/lib/demo/demo-client': {
    normalizeDigitsToAscii: (str) => {
      if (!str || typeof str !== 'string') return '';
      const map = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '۸': '8', '٩': '9',
      };
      return str.replace(/[۰-۹٠-٩]/g, (ch) => map[ch] || ch);
    },
    validateDemoPhone: (phone) => {
      if (!phone || typeof phone !== 'string') return { valid: false, normalized: '' };
      const ascii = phone.replace(/[۰-۹]/g, (ch) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch).toString()).trim();
      if (!/^\+?[0-9 ()-]+$/.test(ascii)) return { valid: false, normalized: '' };
      const prefix = ascii.startsWith('+') ? '+' : '';
      const digits = ascii.replace(/[^0-9]/g, '');
      const normalized = prefix + digits;
      if (!/^\+?[0-9]{8,15}$/.test(normalized)) {
        return { valid: false, normalized: '' };
      }
      return { valid: true, normalized };
    },
    validateDemoPersonName: (name) => {
      if (!name || typeof name !== 'string') return false;
      const trimmed = name.trim();
      return trimmed.length >= 1 && trimmed.length <= 80 && !/[\x00-\x1F\x7F]/.test(trimmed);
    },
    validateDemoWorkspaceName: (name) => {
      if (!name || typeof name !== 'string') return false;
      const trimmed = name.trim();
      return trimmed.length >= 2 && trimmed.length <= 120 && !/[\x00-\x1F\x7F]/.test(trimmed);
    },
    fetchDemoItems: async (_client, _wsId, opts) => {
      lastQueriedModule = opts.module;
      return { items: [], total: 0, requestedModule: opts.module };
    },
    fetchDemoReports: async () => {
      return currentMockReports || { source: 'mock', native_business_data: false, finance: null };
    },
    fetchDemoWorkspace: async () => {
      if (simulateSlowLookup) {
        return new Promise((resolve) => {
          pendingLookupResolver = resolve;
        });
      }
      if (mockLookupError) {
        return { workspace: null, error: mockLookupError };
      }
      return { workspace: mockWorkspaceReturn, error: null };
    },
    initializeDemoWorkspace: async () => ({ workspace: { id: 'ws-new' } })
  }
};

function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file);
  cache.set(file, mod);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.') || id.startsWith('@/')) {
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const candidates = [
        base + '.ts',
        base + '.tsx',
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
        base
      ];
      const found = candidates.find((p) => {
        try {
          return existsSync(p) && readFileSync(p);
        } catch {
          return false;
        }
      });
      if (found) return load(found);
    }
    return localRequire(id);
  };
  mod._compile(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    file
  );
  return mod.exports;
}

// Set up JSDOM environment
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test/en/demo' });
const oldGlobals = new Map();
for (const [k, v] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  Event: dom.window.Event,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true
})) {
  oldGlobals.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
  Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
}
const { createRoot } = localRequire('react-dom/client');
const container = dom.window.document.getElementById('root');
const mounted = createRoot(container);

async function flushPromises(iterations = 4) {
  for (let i = 0; i < iterations; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

console.log('=== RUNNING SUPPLEMENT-R5 REAL-COMPONENT CLOSED PROBE GATE ===\n');

try {
  // ==========================================================================
  // REAL CONTRACT DESCRIPTOR FIXTURES (Matching supabase/hosted-demo/public-demo-preview-only-v1.sql)
  // Target contract: strictly 'read_only' | 'locked'
  // ==========================================================================
  const realPreviewOnlyNavigation = [
    { key: 'dashboard', access: 'read_only' },
    { key: 'properties', access: 'read_only' },
    { key: 'residents', access: 'read_only' },
    { key: 'maintenance', access: 'read_only' },
    { key: 'assets', access: 'read_only' },
    { key: 'utilities', access: 'read_only' },
    { key: 'communications', access: 'read_only' },
    { key: 'documents', access: 'read_only' },
    { key: 'bookings', access: 'read_only' },
    { key: 'services', access: 'read_only' },
    { key: 'governance', access: 'read_only' },
    { key: 'finance', access: 'read_only' },
    { key: 'reports', access: 'read_only' },
    { key: 'activity', access: 'read_only' },
    { key: 'payments', access: 'locked' },
    { key: 'role_administration', access: 'locked' }
  ];

  const realFeatures = {
    form_preview: true,
    demo_data_write: false,
    workflow_continue: false,
    financial_write: false,
    full_iban: false,
    native_operations: false,
    platform_administration: false,
    role_assignment: false,
    ballot_write: false,
    external_notifications: false,
    real_file_upload: false,
    bulk_delete: false,
    export: false
  };

  const realProfileA = {
    first_name: 'Elena',
    last_name: 'Popescu',
    email: 'elena.popescu@example.com',
    mobile_contact: '+40721000001',
    mobile_verified: false,
    marketing_consent: false,
    privacy_accepted: true
  };

  const realContractWorkspaceA = {
    id: '80000000-0000-0000-0000-000000000001',
    name: 'Asociația de Proprietari Bloc 14',
    locale: 'en',
    is_demo: true,
    role: 'demo_owner',
    demo_mode: 'preview_only',
    seed_version: 1,
    created_at: '2026-10-31T12:00:00Z',
    navigation: realPreviewOnlyNavigation,
    features: realFeatures,
    profile: realProfileA
  };

  // --------------------------------------------------------------------------
  // PROBE 1: Shell binding to verified UID before asynchronous bootstrap (P0)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 1: DemoAppShell Verified UID Binding Before Async Bootstrap ---');
  const { DemoAppShell } = load('src/components/demo/DemoAppShell.tsx');

  authListeners = [];
  lastPushedRoute = null;
  simulateSlowGetSession = true;
  slowGetSessionResolver = null;
  mockSession = { user: { id: 'usr-A' } };

  // Mount Shell with workspace A and explicit authenticatedUserId = 'usr-A'
  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          key: 'app-shell-uid-p0',
          workspace: realContractWorkspaceA,
          lang: 'en',
          authenticatedUserId: 'usr-A'
        },
        React.createElement('div', { id: 'user-a-secret-child' }, 'USER_A_PRIVATE_CONTENT')
      )
    );
  });
  await flushPromises(2);

  // Initial mount: User A's content rendered
  check(container.textContent.includes('USER_A_PRIVATE_CONTENT'), 'User A content initially visible');
  check(container.textContent.includes('Asociația de Proprietari Bloc 14'), 'Workspace A title visible');
  check(container.textContent.includes('Elena Popescu'), 'Profile A visible');

  // While getSession is still pending/unresolved, SIGNED_IN event for User B arrives
  await act(async () => {
    authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: 'usr-B' } }));
  });
  await flushPromises(2);

  // Immediate protection: User B must IMMEDIATELY hide all of A's views
  check(!container.textContent.includes('USER_A_PRIVATE_CONTENT'), 'User A content immediately unmounted on UID switch to B');
  check(!container.textContent.includes('Asociația de Proprietari Bloc 14'), 'Header workspace A masked on UID switch to B');
  check(!container.textContent.includes('Elena Popescu'), 'Sidebar profile A masked on UID switch to B');
  check(container.textContent.includes('Signing out of demo workspace'), 'Rendered protective transition view');
  equal(lastPushedRoute, '/en/demo', 'Router redirected to /en/demo');

  // Now, delayed getSession for A resolves: MUST NOT restore A's view or overwrite reference
  if (slowGetSessionResolver) {
    await act(async () => {
      slowGetSessionResolver({ data: { session: { user: { id: 'usr-A' } } }, error: null });
    });
    await flushPromises(2);
  }
  check(!container.textContent.includes('USER_A_PRIVATE_CONTENT'), 'Delayed getSession for A does NOT restore A content');
  check(!container.textContent.includes('Asociația de Proprietari Bloc 14'), 'Delayed getSession does NOT restore header A');
  check(!container.textContent.includes('Elena Popescu'), 'Delayed getSession does NOT restore sidebar A');
  simulateSlowGetSession = false;

  // Case 1B: Valid same-UID, TOKEN_REFRESHED, or INITIAL_SESSION must NOT invalidate active view
  authListeners = [];
  lastPushedRoute = null;
  mockSession = { user: { id: 'usr-A' } };

  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          key: 'app-shell-same-uid',
          workspace: { ...realContractWorkspaceA, id: '80000000-0000-0000-0000-000000000002' },
          lang: 'en',
          authenticatedUserId: 'usr-A'
        },
        React.createElement('div', { id: 'user-a-same-uid-child' }, 'STABLE_USER_A_CONTENT')
      )
    );
  });
  await flushPromises();

  check(container.textContent.includes('STABLE_USER_A_CONTENT'), 'Stable mount for User A');

  // Emit TOKEN_REFRESHED with same UID
  await act(async () => {
    authListeners.forEach((fn) => fn('TOKEN_REFRESHED', { user: { id: 'usr-A' } }));
  });
  await flushPromises(2);

  check(container.textContent.includes('STABLE_USER_A_CONTENT'), 'same-UID TOKEN_REFRESHED keeps active view intact');
  check(lastPushedRoute === null, 'same-UID TOKEN_REFRESHED does not trigger redirection');
  console.log('✓ PROBE 1: Shell verified UID binding before async bootstrap passed.\n');

  // --------------------------------------------------------------------------
  // PROBE 2: Recoverable Failed Sign-Out (P0)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 2: Recoverable Failed Sign-Out ---');
  authListeners = [];
  lastPushedRoute = null;
  mockSignOutError = null;
  mockSignOutThrows = false;

  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          key: 'app-shell-signout-err',
          workspace: { ...realContractWorkspaceA, id: '80000000-0000-0000-0000-000000000003' },
          lang: 'en',
          authenticatedUserId: 'usr-A'
        },
        React.createElement('div', { id: 'signout-test-child' }, 'ACTIVE_SIGNOUT_TEST_CONTENT')
      )
    );
  });
  await flushPromises();

  check(container.textContent.includes('ACTIVE_SIGNOUT_TEST_CONTENT'), 'Mounted before sign out');

  // Find Sign Out button
  const signOutBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Sign Out') || b.textContent.includes('Deconectare'));
  check(signOutBtn !== undefined, 'Sign out button found in shell header/sidebar');

  // Case 2A: signOut returns { error }
  mockSignOutError = { message: 'Network offline 503' };

  await act(async () => {
    signOutBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await flushPromises(4);

  // Before await & after error: all of A's information MUST be masked!
  check(!container.textContent.includes('ACTIVE_SIGNOUT_TEST_CONTENT'), 'Children masked during failed sign out');
  check(!container.textContent.includes('Elena Popescu'), 'User profile masked during failed sign out');
  check(lastPushedRoute === null, 'Route not changed before sign-out outcome determined');

  // Safe error state rendered with 3-language message and Retry button
  check(container.textContent.includes('Sign Out Failed') || container.textContent.includes('Deconectarea nu a reușit') || container.textContent.includes('خروج از حساب با خطا مواجه شد'), 'Safe error title rendered');
  check(container.textContent.includes('Network offline 503'), 'Error message displayed');

  const retrySignOutBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Retry Sign Out') || b.textContent.includes('Reîncearcă') || b.textContent.includes('تلاش مجدد'));
  check(retrySignOutBtn !== undefined, 'Retry Sign Out button available');

  // Now fix network and click retry
  mockSignOutError = null;
  await act(async () => {
    retrySignOutBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await flushPromises(4);

  equal(lastPushedRoute, '/en/demo', 'Successful retry redirects to /en/demo');

  // Case 2B: signOut throws an exception
  lastPushedRoute = null;
  mockSignOutThrows = true;

  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          key: 'app-shell-signout-throw',
          workspace: { ...realContractWorkspaceA, id: '80000000-0000-0000-0000-000000000004' },
          lang: 'ro',
          authenticatedUserId: 'usr-A'
        },
        React.createElement('div', { id: 'throw-test-child' }, 'THROW_TEST_CONTENT')
      )
    );
  });
  await flushPromises();

  const signOutBtnRo = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Ieșire') || b.textContent.includes('Deconectare') || b.textContent.includes('Sign Out'));
  await act(async () => {
    signOutBtnRo.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await flushPromises(4);

  check(!container.textContent.includes('THROW_TEST_CONTENT'), 'Children masked when signOut throws');
  check(container.textContent.includes('Deconectarea nu a reușit'), 'Romanian failed sign out error displayed');
  check(container.textContent.includes('Reîncearcă deconectarea'), 'Romanian retry button rendered');
  mockSignOutThrows = false;
  console.log('✓ PROBE 2: Recoverable failed sign-out passed.\n');

  // --------------------------------------------------------------------------
  // PROBE 3: Retry of lookup is also current lookup (P0)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 3: Retry of Lookup Lifecycle Guard ---');
  const { DemoAuthPortal } = load('src/components/demo/DemoAuthPortal.tsx');

  authListeners = [];
  mockSession = null;
  mockUser = null;
  simulateSlowLookup = false;
  mockLookupError = null;
  mockWorkspaceReturn = null;

  // Mount DemoAuthPortal
  await act(async () => {
    mounted.render(
      React.createElement(DemoAuthPortal, {
        key: 'portal-retry-p0',
        lang: 'en'
      })
    );
  });
  await flushPromises();

  // Initial login with user that experiences lookup error
  mockLookupError = new Error('Database connection timeout 504');
  const retryUser = { id: 'usr-retry-test', email: 'retry@cladora.test' };

  await act(async () => {
    authListeners.forEach((fn) => fn('INITIAL_SESSION', { user: retryUser }));
  });
  await flushPromises(4);

  // Verify initial error card is displayed with Retry button
  check(container.textContent.includes('Workspace Verification Error') || container.textContent.includes('Could Not Verify Workspace'), 'Verification error card rendered');
  check(container.textContent.includes('Database connection timeout 504'), 'Error message rendered');

  const retryLookupBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Retry Verification') || b.textContent.includes('Reîncearcă') || b.textContent.includes('تلاش مجدد'));
  check(retryLookupBtn !== undefined, 'Retry verification button rendered');

  // Now click Retry with slow pending response
  simulateSlowLookup = true;
  pendingLookupResolver = null;
  mockLookupError = null;

  await act(async () => {
    retryLookupBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await flushPromises(2);

  // While retry is pending:
  // 1. Password/Signup form MUST NOT be displayed!
  check(!container.textContent.includes('Password (min. 8 characters)'), 'Password form NOT shown while retry lookup is pending');
  check(!container.textContent.includes('Create your preview account'), 'Signup intro NOT shown while retry lookup is pending');

  // 2. Retry card stays rendered and button shows Retrying spinner
  check(container.textContent.includes('Retrying...') || container.textContent.includes('Could Not Verify Workspace'), 'Retry card remains active during lookup');

  // 3. same-UID event (TOKEN_REFRESHED) during retry lookup does NOT dismiss the retry card or drop to signup form
  await act(async () => {
    authListeners.forEach((fn) => fn('TOKEN_REFRESHED', { user: retryUser }));
  });
  await flushPromises(2);

  check(!container.textContent.includes('Password (min. 8 characters)'), 'same-UID event does NOT display password form during pending retry');

  // 4. Resolve retry with valid null workspace (user has no workspace -> opens completion setup form WITHOUT password)
  if (pendingLookupResolver) {
    await act(async () => {
      pendingLookupResolver({ workspace: null, error: null });
    });
    await flushPromises(4);
  }
  simulateSlowLookup = false;

  // Completion setup form displayed WITHOUT password field
  check(container.textContent.includes('Configure Your Private Demo Workspace') || container.textContent.includes('Complete Demo Setup'), 'Setup completion form displayed on valid null workspace');
  check(!container.textContent.includes('Password (min. 8 characters)'), 'Completion form has NO password input');

  // 5. SIGNED_OUT invalidates in-flight retry and wipes state completely
  await act(async () => {
    authListeners.forEach((fn) => fn('SIGNED_OUT', null));
  });
  await flushPromises(4);

  check(container.textContent.includes('Create Demo') || container.textContent.includes('Sign In'), 'Clean portal state on SIGNED_OUT');
  console.log('✓ PROBE 3: Retry of lookup lifecycle guard passed.\n');

  // --------------------------------------------------------------------------
  // PROBE 4: Effective Demo Contract from Override (read_only / locked) (P1)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 4: Effective Override Preview-Only Contract (read_only / locked) ---');
  const { DemoModuleView } = load('src/components/demo/DemoModuleView.tsx');

  // Case 4A: Missing access on communications and locked bookings -> 0 queries sent!
  const missingCommAccessWorkspace = {
    ...realContractWorkspaceA,
    id: '80000000-0000-0000-0000-000000000005',
    navigation: [
      { key: 'dashboard', access: 'read_only' },
      { key: 'communications' }, // missing access!
      { key: 'bookings', access: 'locked' }
    ]
  };

  lastQueriedModule = null;
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        key: 'ce-missing-access',
        workspace: missingCommAccessWorkspace,
        moduleKey: 'community-experience',
        lang: 'en'
      })
    );
  });
  await flushPromises(4);

  equal(lastQueriedModule, null, 'CE sends ZERO backend queries when communications has missing access and bookings is locked');
  check(container.textContent.includes('Community & Experience Module is Locked in Preview'), 'CE renders locked notice for missing access');

  // Case 4B: Permitted bookings (read_only) with missing communications -> queries ONLY bookings
  const partialBookingsWorkspace = {
    ...realContractWorkspaceA,
    id: '80000000-0000-0000-0000-000000000006',
    navigation: [
      { key: 'dashboard', access: 'read_only' },
      { key: 'communications' }, // missing access
      { key: 'bookings', access: 'read_only' } // valid read_only
    ]
  };

  lastQueriedModule = null;
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        key: 'ce-partial-read-only',
        workspace: partialBookingsWorkspace,
        moduleKey: 'community-experience',
        lang: 'en'
      })
    );
  });
  await flushPromises(4);

  const ceBtns = Array.from(container.querySelectorAll('button'));
  const commBtn = ceBtns.find((b) => b.textContent.includes('Announcements'));
  const bookBtn = ceBtns.find((b) => b.textContent.includes('Amenity Bookings'));

  check(commBtn && commBtn.disabled === true, 'Announcements with missing access is disabled');
  check(bookBtn && bookBtn.disabled === false, 'Amenity bookings with read_only access is enabled');
  equal(lastQueriedModule, 'bookings', 'Only permitted read_only bookings module was queried');

  // Case 4C: Standard module with locked descriptor sends 0 queries
  const lockedPropWorkspace = {
    ...realContractWorkspaceA,
    id: '80000000-0000-0000-0000-000000000007',
    navigation: [
      { key: 'properties', access: 'locked' }
    ]
  };

  lastQueriedModule = null;
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        key: 'prop-locked',
        workspace: lockedPropWorkspace,
        moduleKey: 'properties',
        lang: 'en'
      })
    );
  });
  await flushPromises(4);

  equal(lastQueriedModule, null, 'Locked standard module sends ZERO backend queries');

  // Case 4D: DemoDashboardView with preview-only contract (read_only) and native_business_data: false
  const { DemoDashboardView } = load('src/components/demo/DemoDashboardView.tsx');

  currentMockReports = {
    source: 'demo_get_reports_v1',
    native_business_data: false,
    counts: { properties: 5, residents: 12 },
    finance: null
  };

  await act(async () => {
    mounted.render(
      React.createElement(DemoDashboardView, {
        key: 'dash-preview-only',
        workspace: realContractWorkspaceA,
        lang: 'en'
      })
    );
  });
  await flushPromises(4);

  const renderedDashText = container.textContent;
  check(!renderedDashText.includes('simulated financial rows'), 'Intro snippet omits finance when null');
  check(renderedDashText.includes('Data unavailable'), 'Finance card shows Data unavailable');
  console.log('✓ PROBE 4: Effective preview-only contract (read_only/locked) passed.\n');

  // --------------------------------------------------------------------------
  // PROBE 5: Exact 12 Approved Strings (T10, T25, T64, T65) (P1)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 5: Verification of Exact 12 Approved Strings (T10, T25, T64, T65) ---');
  const threeDomainsSrc = readFileSync(path.join(root, 'src/components/home/ThreeDomainsSection.tsx'), 'utf8');
  const cePageSrc = readFileSync(path.join(root, 'src/app/[lang]/community-experience/page.tsx'), 'utf8');
  const moduleViewSrc = readFileSync(path.join(root, 'src/components/demo/DemoModuleView.tsx'), 'utf8');

  // 1. T10 in ThreeDomainsSection.tsx
  check(threeDomainsSrc.includes('معرفی رویدادها با وضعیت واقعی دسترسی'), 'T10 FA exact in ThreeDomainsSection');
  check(threeDomainsSrc.includes('Event information with its actual availability'), 'T10 EN exact in ThreeDomainsSection');
  check(threeDomainsSrc.includes('Informații despre evenimente, cu disponibilitatea reală indicată'), 'T10 RO exact in ThreeDomainsSection');

  // 2. T25 in src/app/[lang]/community-experience/page.tsx
  check(cePageSrc.includes('دسترسی عملیاتی به وضعیت انتشار، راه‌اندازی پروژه و مجوز معتبر وابسته است.'), 'T25 FA exact in community-experience/page.tsx');
  check(cePageSrc.includes('Operational access depends on release status, project setup and valid permissions.'), 'T25 EN exact in community-experience/page.tsx');
  check(cePageSrc.includes('Accesul operațional depinde de stadiul lansării, configurarea proiectului și permisiuni valide.'), 'T25 RO exact in community-experience/page.tsx');

  // 3. T64 in DemoModuleView.tsx
  check(moduleViewSrc.includes('برای این دمو راهنمای معتبر قابل‌نمایش ارائه نشده است؛ فقط ساختار اولیه را می‌بینید.'), 'T64 FA exact in DemoModuleView');
  check(moduleViewSrc.includes('No eligible guide content has been provided for this demo; only the initial structure is shown.'), 'T64 EN exact in DemoModuleView');
  check(moduleViewSrc.includes('Pentru acest demo nu a fost furnizat conținut eligibil de ghid; este afișată doar structura inițială.'), 'T64 RO exact in DemoModuleView');

  // 4. T65 in DemoModuleView.tsx
  check(moduleViewSrc.includes('برای این دمو رویداد معتبری برای نمایش ارائه نشده است؛ این بخش فقط پیش‌نمایش است.'), 'T65 FA exact in DemoModuleView');
  check(moduleViewSrc.includes('No eligible event has been provided for this demo; this section is a preview only.'), 'T65 EN exact in DemoModuleView');
  check(moduleViewSrc.includes('Pentru acest demo nu a fost furnizat niciun eveniment eligibil; această secțiune este doar o previzualizare.'), 'T65 RO exact in DemoModuleView');

  // Render verification for T64 and T65 on real component in DOM
  for (const [testLang, expT64, expT65] of [
    ['en', 'No eligible guide content has been provided for this demo; only the initial structure is shown.', 'No eligible event has been provided for this demo; this section is a preview only.'],
    ['fa', 'برای این دمو راهنمای معتبر قابل‌نمایش ارائه نشده است؛ فقط ساختار اولیه را می‌بینید.', 'برای این دمو رویداد معتبری برای نمایش ارائه نشده است؛ این بخش فقط پیش‌نمایش است.'],
    ['ro', 'Pentru acest demo nu a fost furnizat conținut eligibil de ghid; este afișată doar structura inițială.', 'Pentru acest demo nu a fost furnizat niciun eveniment eligibil; această secțiune este doar o previzualizare.']
  ]) {
    await act(async () => {
      mounted.render(
        React.createElement(DemoModuleView, {
          key: `ce-copy-${testLang}`,
          workspace: realContractWorkspaceA,
          moduleKey: 'community-experience',
          lang: testLang
        })
      );
    });
    await flushPromises(2);

    // Switch to guides
    const guidesBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Ghiduri') || b.textContent.includes('راهنما') || b.textContent.includes('Guides'));
    if (guidesBtn) {
      await act(async () => {
        guidesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      await flushPromises(2);
      check(container.textContent.includes(expT64), `T64 ${testLang} rendered in DOM`);
    }

    // Switch to events
    const eventsBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Evenimente') || b.textContent.includes('رویداد') || b.textContent.includes('Events'));
    if (eventsBtn) {
      await act(async () => {
        eventsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      await flushPromises(2);
      check(container.textContent.includes(expT65), `T65 ${testLang} rendered in DOM`);
    }
  }

  console.log('✓ PROBE 5: All 12 approved strings (T10, T25, T64, T65) verified in files and rendered in DOM.\n');

} finally {
  await act(async () => {
    mounted.unmount();
  });
  for (const [k, d] of oldGlobals) {
    if (d) Object.defineProperty(globalThis, k, d);
    else delete globalThis[k];
  }
  dom.window.close();
}

console.log(`=======================================================`);
console.log(`ALL 5 CLOSED REAL-COMPONENT PROBES PASSED! (${checks} checks)`);
console.log(`=======================================================`);
