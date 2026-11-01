// Verification test suite for ANTIGRAVITY-DEMO-FUNCTIONAL-REPAIR-05 / SUPPLEMENT-R8
// Target defect: R6-12-F01 (Mobile drawer lock release on desktop lg breakpoint transition)
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

// Global JSDOM setup with dynamic viewport and matchMedia support
let currentViewportWidth = 390;
const mediaQueryListeners = new Set();

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });

function updateViewport(width) {
  currentViewportWidth = width;
  dom.window.innerWidth = width;
  const isDesktop = width >= 1024;
  for (const listener of mediaQueryListeners) {
    listener({ matches: isDesktop, media: '(min-width: 1024px)' });
  }
  dom.window.dispatchEvent(new dom.window.Event('resize'));
}

dom.window.matchMedia = (query) => {
  const isDesktopQuery = query.includes('min-width: 1024px');
  return {
    get matches() {
      if (isDesktopQuery) return currentViewportWidth >= 1024;
      return false;
    },
    media: query,
    onchange: null,
    addListener: (cb) => { mediaQueryListeners.add(cb); },
    removeListener: (cb) => { mediaQueryListeners.delete(cb); },
    addEventListener: (_type, cb) => { mediaQueryListeners.add(cb); },
    removeEventListener: (_type, cb) => { mediaQueryListeners.delete(cb); },
    dispatchEvent: () => true
  };
};

dom.window.innerWidth = currentViewportWidth;

for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  sessionStorage: dom.window.sessionStorage,
  matchMedia: dom.window.matchMedia,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  IS_REACT_ACT_ENVIRONMENT: true
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { createRoot } = await import('react-dom/client');

// Custom module loader for real TSX components
const cache = new Map();
let currentPathname = '/en/demo/app/dashboard';
let authListeners = [];
let mockSession = null;
let lastPushedRoute = null;

const mockSupabaseClient = {
  auth: {
    getSession: async () => ({
      data: { session: mockSession },
      error: null
    }),
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
      mockSession = null;
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
  const code = readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText;
  mod._compile(compiled, file);
  return mod.exports;
}

const { DemoAppShell } = load('src/components/demo/DemoAppShell.tsx');

const baseWorkspace = {
  id: 'ws-r8-breakpoint',
  name: 'Complex Pipera Rezidential',
  demo_mode: 'preview',
  profile: {
    first_name: 'Elena',
    last_name: 'Popescu'
  },
  navigation: [
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
    { key: 'community_experience', access: 'read_only' },
    { key: 'governance', access: 'read_only' },
    { key: 'finance', access: 'read_only' },
    { key: 'reports', access: 'read_only' },
    { key: 'activity', access: 'read_only' },
    { key: 'payments', access: 'read_only' },
    { key: 'role_administration', access: 'read_only' },
    { key: 'settings', access: 'read_only' }
  ]
};

const flushPromises = async (n = 3) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
};

console.log('=== RUNNING SUPPLEMENT-R8 TARGETED DRAWER BREAKPOINT VERIFICATION ===\n');

const container = dom.window.document.getElementById('root');
const mounted = createRoot(container);

// -----------------------------------------------------------------------------
// TEST 1: Defect Reproduction & Fix Verification (390px -> 1365px -> 390px)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Mobile Open (390px) -> Desktop Resize (1365px) -> Return to Mobile (390px) ---');

// 1A. Start on mobile viewport 390px
updateViewport(390);
mockSession = { user: { id: 'usr-r8-test' } };

await act(async () => {
  mounted.render(
    React.createElement(
      DemoAppShell,
      {
        workspace: baseWorkspace,
        lang: 'en',
        authenticatedUserId: 'usr-r8-test'
      },
      React.createElement('div', { id: 'test-main-content' }, 'Main Content Viewport')
    )
  );
});
await flushPromises();

const openerBtn = container.querySelector('button[aria-controls="mobile-navigation-drawer"]');
check(openerBtn !== null, 'Found mobile drawer opener button');
equal(openerBtn.getAttribute('aria-expanded'), 'false', 'Drawer is initially closed on mobile');
check(dom.window.document.body.style.overflow !== 'hidden', 'Scroll is not locked initially');

// 1B. Open drawer on mobile (width 390)
await act(async () => {
  openerBtn.click();
});
await flushPromises(4);

equal(openerBtn.getAttribute('aria-expanded'), 'true', 'Drawer is opened on 390px mobile');
const drawerDialog = container.querySelector('#mobile-navigation-drawer');
check(drawerDialog !== null, '#mobile-navigation-drawer is mounted in DOM');
equal(dom.window.document.body.style.overflow, 'hidden', 'Scroll lock (body overflow: hidden) is active while drawer is open');

const headerElem = container.querySelector('header');
const mainElem = container.querySelector('main');
const asideElem = container.querySelector('aside');
equal(headerElem.getAttribute('aria-hidden'), 'true', 'Header is marked aria-hidden="true" while drawer is open');
equal(mainElem.getAttribute('aria-hidden'), 'true', 'Main is marked aria-hidden="true" while drawer is open');
equal(asideElem.getAttribute('aria-hidden'), 'true', 'Aside is marked aria-hidden="true" while drawer is open');

// 1C. Resize to desktop 1365px (Defect scenario R6-12-F01)
console.log('Simulating viewport resize to 1365px (lg desktop breakpoint)...');
await act(async () => {
  updateViewport(1365);
});
await flushPromises(4);

// Assert modal state, scroll locks, and aria-hidden attributes are completely released
check(container.querySelector('#mobile-navigation-drawer') === null, 'R6-12-F01: #mobile-navigation-drawer is unmounted on 1365px desktop');
equal(openerBtn.getAttribute('aria-expanded'), 'false', 'R6-12-F01: Opener aria-expanded reset to "false"');
equal(dom.window.document.body.style.overflow, '', 'R6-12-F01: Body scroll lock immediately released (overflow is not hidden)');
check(headerElem.getAttribute('aria-hidden') === null, 'R6-12-F01: Header aria-hidden released on desktop');
check(mainElem.getAttribute('aria-hidden') === null, 'R6-12-F01: Main aria-hidden released on desktop');
check(asideElem.getAttribute('aria-hidden') === null, 'R6-12-F01: Aside aria-hidden released on desktop');

// Assert focus did NOT return to hidden mobile opener button
check(
  dom.window.document.activeElement !== openerBtn,
  'R6-12-F01: Focus did NOT return to hidden mobile opener on desktop'
);

// 1D. Return to mobile 390px (must NOT auto-reopen)
console.log('Simulating return to 390px mobile viewport...');
await act(async () => {
  updateViewport(390);
});
await flushPromises(4);

check(container.querySelector('#mobile-navigation-drawer') === null, 'Drawer remains closed when returning to mobile (does not auto-reopen)');
equal(openerBtn.getAttribute('aria-expanded'), 'false', 'Opener aria-expanded remains false');
equal(dom.window.document.body.style.overflow, '', 'Body scroll remains unlocked');

console.log('✓ TEST 1: Breakpoint transition lifecycle and lock releases verified.\n');

// -----------------------------------------------------------------------------
// TEST 2: Consecutive Rapid Resize Events (Stability & Idempotency)
// -----------------------------------------------------------------------------
console.log('--- TEST 2: Consecutive Rapid Viewport Resize Transitions ---');

// Open drawer on mobile
await act(async () => {
  openerBtn.click();
});
await flushPromises(4);
check(container.querySelector('#mobile-navigation-drawer') !== null, 'Drawer re-opened on mobile');

// Rapid consecutive resizes
const widths = [400, 768, 1024, 1365, 1200, 1024, 800, 390, 1024, 1440, 375];
for (const w of widths) {
  await act(async () => {
    updateViewport(w);
  });
}
await flushPromises(4);

// At final width 375, drawer should stay closed and unlocked
check(container.querySelector('#mobile-navigation-drawer') === null, 'Drawer cleanly closed after rapid resize cycles');
equal(dom.window.document.body.style.overflow, '', 'Body scroll lock cleanly unlocked');
check(headerElem.getAttribute('aria-hidden') === null, 'Header aria-hidden is released after rapid resize cycles');
check(mainElem.getAttribute('aria-hidden') === null, 'Main aria-hidden is released after rapid resize cycles');
check(asideElem.getAttribute('aria-hidden') === null, 'Aside aria-hidden is released after rapid resize cycles');

console.log('✓ TEST 2: Rapid resize transitions passed with zero leaks.\n');

// -----------------------------------------------------------------------------
// TEST 3: Multilingual Verification (FA, RO, EN)
// -----------------------------------------------------------------------------
console.log('--- TEST 3: Multilingual Verification (FA, RO, EN) ---');

for (const testLang of ['fa', 'ro', 'en']) {
  updateViewport(390);
  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          workspace: baseWorkspace,
          lang: testLang,
          authenticatedUserId: 'usr-r8-test'
        },
        React.createElement('div', null, `Content ${testLang}`)
      )
    );
  });
  await flushPromises();

  const langOpener = container.querySelector('button[aria-controls="mobile-navigation-drawer"]');
  check(langOpener !== null, `Opener present in ${testLang}`);

  // Open drawer
  await act(async () => {
    langOpener.click();
  });
  await flushPromises(4);
  const langDrawer = container.querySelector('#mobile-navigation-drawer');
  check(langDrawer !== null, `Drawer mounted in ${testLang}`);
  equal(dom.window.document.body.style.overflow, 'hidden', `Scroll locked in ${testLang}`);

  // Resize to desktop
  await act(async () => {
    updateViewport(1365);
  });
  await flushPromises(4);

  check(container.querySelector('#mobile-navigation-drawer') === null, `Drawer unmounted on 1365px in ${testLang}`);
  equal(dom.window.document.body.style.overflow, '', `Scroll released on 1365px in ${testLang}`);
  check(container.querySelector('main').getAttribute('aria-hidden') === null, `Main aria-hidden cleared in ${testLang}`);
}

console.log('✓ TEST 3: Multilingual drawer breakpoint behavior passed.\n');

// -----------------------------------------------------------------------------
// TEST 4: Auth Lifecycle Cleanup during Open Drawer & Resize
// -----------------------------------------------------------------------------
console.log('--- TEST 4: Auth Lifecycle Cleanup (SIGNED_OUT & UID switch) ---');

updateViewport(390);
await act(async () => {
  mounted.render(
    React.createElement(
      DemoAppShell,
      {
        workspace: baseWorkspace,
        lang: 'en',
        authenticatedUserId: 'usr-r8-test'
      },
      React.createElement('div', null, 'Auth Test')
    )
  );
});
await flushPromises();

const authOpener = container.querySelector('button[aria-controls="mobile-navigation-drawer"]');
await act(async () => {
  authOpener.click();
});
await flushPromises(4);
check(container.querySelector('#mobile-navigation-drawer') !== null, 'Drawer open before SIGNED_OUT');

// Trigger SIGNED_OUT while drawer is open
await act(async () => {
  authListeners.forEach((fn) => fn('SIGNED_OUT', null));
});
await flushPromises(4);

check(container.querySelector('#mobile-navigation-drawer') === null, 'Drawer immediately unmounted on SIGNED_OUT');
equal(dom.window.document.body.style.overflow, '', 'Body overflow restored on SIGNED_OUT');
check(container.querySelector('main')?.getAttribute('aria-hidden') == null, 'Zero aria-hidden locks remain on SIGNED_OUT');
equal(lastPushedRoute, '/en/demo', 'Redirected to /en/demo on SIGNED_OUT');

console.log('✓ TEST 4: Auth lifecycle cleanup during open drawer passed.\n');

console.log('--- ENVIRONMENTAL EXECUTION STATUS ---');
console.log('NOTE: Real browser / GPU hardware window resizing execution: NOT_RUN (Headless execution environment without display server / browser socket; verified authoritatively via dynamic JSDOM viewport resize, matchMedia listeners, and focus tracking).');

console.log(`\n=======================================================`);
console.log(`ALL SUPPLEMENT-R8 BREAKPOINT DRAWER TESTS PASSED! (${checks} checks)`);
console.log(`=======================================================\n`);
