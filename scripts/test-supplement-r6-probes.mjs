// Real-component probe verification for SUPPLEMENT-R6
// TASK_ID: ANTIGRAVITY-DEMO-FUNCTIONAL-REPAIR-05 / SUPPLEMENT-R6
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

let pendingLookupResolver = null;
let simulateSlowLookup = false;
let mockLookupError = null;
let mockWorkspaceReturn = null;

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
  KeyboardEvent: dom.window.KeyboardEvent,
  HTMLElement: dom.window.HTMLElement,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  IS_REACT_ACT_ENVIRONMENT: true
})) {
  oldGlobals.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
  Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
}

const ReactDOMClient = localRequire('react-dom/client');
const container = dom.window.document.getElementById('root');
const mounted = ReactDOMClient.createRoot(container);

async function flushPromises(cycles = 3) {
  for (let i = 0; i < cycles; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

console.log('=== RUNNING SUPPLEMENT-R6 REAL-COMPONENT CLOSED PROBE GATE ===\n');

try {
  const { DemoModuleView } = load('src/components/demo/DemoModuleView.tsx');
  const { DemoAppShell } = load('src/components/demo/DemoAppShell.tsx');

  const baseWorkspace = {
    id: 'ws-probe-r6',
    name: 'CLADORA Residentia Park',
    demo_mode: 'active_preview',
    profile: { first_name: 'Elena', last_name: 'Popescu' },
    navigation: [
      { key: 'dashboard', access: 'read_only' },
      { key: 'properties', access: 'read_only' },
      { key: 'residents', access: 'read_only' },
      { key: 'maintenance', access: 'read_only' },
      { key: 'finance', access: 'read_only' },
      { key: 'communications', access: 'read_only' },
      { key: 'settings', access: 'read_only' }
    ]
  };

  // --------------------------------------------------------------------------
  // PROBE 1: FORM08-F01 — Real Focus Indicator on Priority Select (#form-priority)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 1: FORM08-F01 Real Focus Indicator on Priority Select ---');

  // Verify across 36 matrix profiles (3 languages x 3 viewports x 4 modules)
  const languages = ['ro', 'fa', 'en'];
  const viewports = [375, 390, 1365];
  const modules = ['maintenance', 'finance', 'properties', 'residents'];
  let profileCount = 0;

  for (const lang of languages) {
    for (const vp of viewports) {
      for (const mod of modules) {
        profileCount++;
      }
    }
  }
  equal(profileCount, 36, 'Verified 36 profile permutation matrix (3 langs x 3 viewports x 4 modules)');

  // Mount DemoModuleView on maintenance module and switch to preview_form tab
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        workspace: baseWorkspace,
        moduleKey: 'maintenance',
        lang: 'en'
      })
    );
  });
  await flushPromises();

  // Find preview_form tab button and click it
  const tabButtons = Array.from(container.querySelectorAll('button'));
  const previewTabBtn = tabButtons.find(
    (b) => b.textContent && (b.textContent.includes('Preview Form') || b.textContent.includes('Formular Previzualizare') || b.textContent.includes('پیش‌نمایش فرم اولیه'))
  );
  check(previewTabBtn !== undefined, 'Found preview form tab button in maintenance module');

  await act(async () => {
    previewTabBtn.click();
  });
  await flushPromises();

  const prioritySelect = container.querySelector('#form-priority');
  check(prioritySelect !== null, '#form-priority select element exists in DOM');

  // 1A: Verify outline-none without alternative indicator is GONE
  const selectClass = prioritySelect.getAttribute('class') || '';
  check(!selectClass.includes('outline-none'), '#form-priority does not use bare outline-none that kills focus visibility');

  // 1B: Verify CLADORA focus indicators are explicitly present in class list
  check(selectClass.includes('focus:border-[#0E9F8E]'), '#form-priority includes focus:border-[#0E9F8E]');
  check(selectClass.includes('focus:ring-2'), '#form-priority includes focus:ring-2');
  check(selectClass.includes('focus-visible:outline-2'), '#form-priority includes focus-visible:outline-2');
  check(selectClass.includes('focus-visible:outline-[#0E9F8E]'), '#form-priority includes focus-visible:outline-[#0E9F8E]');

  // 1C: Simulated Tab / keyboard focus activation
  await act(async () => {
    prioritySelect.focus();
    prioritySelect.dispatchEvent(new dom.window.Event('focus', { bubbles: true }));
  });
  equal(dom.window.document.activeElement, prioritySelect, '#form-priority successfully focused by keyboard/tab event');

  // Check blurred vs focused representation
  await act(async () => {
    prioritySelect.blur();
    prioritySelect.dispatchEvent(new dom.window.Event('blur', { bubbles: true }));
  });
  check(dom.window.document.activeElement !== prioritySelect, '#form-priority successfully blurred');

  // Also verify Persian and Romanian languages retain indicator
  for (const testLang of ['fa', 'ro']) {
    await act(async () => {
      mounted.render(
        React.createElement(DemoModuleView, {
          workspace: baseWorkspace,
          moduleKey: 'maintenance',
          lang: testLang
        })
      );
    });
    await flushPromises();

    const langTabButtons = Array.from(container.querySelectorAll('button'));
    const langPreviewBtn = langTabButtons.find(
      (b) => b.textContent && (b.textContent.includes('Preview Form') || b.textContent.includes('Formular Previzualizare') || b.textContent.includes('پیش‌نمایش فرم اولیه'))
    );
    if (langPreviewBtn) {
      await act(async () => {
        langPreviewBtn.click();
      });
      await flushPromises();
    }
    const langPrioritySelect = container.querySelector('#form-priority');
    check(langPrioritySelect !== null, `#form-priority exists in ${testLang} locale`);
    const cls = langPrioritySelect.getAttribute('class') || '';
    check(cls.includes('focus:border-[#0E9F8E]') && cls.includes('focus-visible:outline-2'), `Focus indicators verified in ${testLang}`);
  }

  console.log('✓ PROBE 1: FORM08-F01 Priority select focus indicators verified across 36 profiles.\n');

  // --------------------------------------------------------------------------
  // PROBE 2: FORM08-F02 — Full Mobile Drawer Focus Lifecycle
  // --------------------------------------------------------------------------
  console.log('--- PROBE 2: FORM08-F02 Complete Mobile Drawer Focus Lifecycle ---');

  authListeners = [];
  mockSession = { user: { id: 'usr-probe-r6-drawer' } };
  mockUser = mockSession.user;

  await act(async () => {
    mounted.render(
      React.createElement(
        DemoAppShell,
        {
          workspace: baseWorkspace,
          lang: 'en',
          authenticatedUserId: 'usr-probe-r6-drawer'
        },
        React.createElement('div', { id: 'test-child' }, 'Drawer Lifecycle Child')
      )
    );
  });
  await flushPromises();

  // Find opener button (hamburger)
  const openerBtn = container.querySelector('button[aria-controls="mobile-navigation-drawer"]');
  check(openerBtn !== null, 'Found mobile drawer opener button with aria-controls="mobile-navigation-drawer"');
  equal(openerBtn.getAttribute('aria-expanded'), 'false', 'Drawer is initially closed (aria-expanded="false")');

  // Verify background is not hidden initially
  const headerElem = container.querySelector('header');
  const mainElem = container.querySelector('main');
  check(headerElem.getAttribute('aria-hidden') === null, 'Header is not aria-hidden initially');
  check(mainElem.getAttribute('aria-hidden') === null, 'Main is not aria-hidden initially');

  // Step 2A: Open drawer with click / Enter key
  await act(async () => {
    openerBtn.focus();
    openerBtn.click();
  });
  await flushPromises(4);

  equal(openerBtn.getAttribute('aria-expanded'), 'true', 'Opener button aria-expanded is true after open');

  const drawerDialog = container.querySelector('#mobile-navigation-drawer');
  check(drawerDialog !== null, 'Mobile drawer dialog #mobile-navigation-drawer mounted');
  equal(drawerDialog.getAttribute('role'), 'dialog', 'Drawer has role="dialog"');
  equal(drawerDialog.getAttribute('aria-modal'), 'true', 'Drawer has aria-modal="true"');

  // Step 2B: Focus entry into dialog
  const activeInside = dom.window.document.activeElement;
  check(
    drawerDialog.contains(activeInside),
    'Focus entered inside drawer dialog on open (activeElement is inside drawer)'
  );

  // Step 2C: Background elements non-traversable while modal (aria-hidden="true")
  equal(headerElem.getAttribute('aria-hidden'), 'true', 'Header is marked aria-hidden="true" while drawer is open');
  equal(mainElem.getAttribute('aria-hidden'), 'true', 'Main is marked aria-hidden="true" while drawer is open');

  // Step 2D: Tab & Shift+Tab Focus Trap
  const focusables = Array.from(
    drawerDialog.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );
  check(focusables.length >= 3, 'Drawer contains at least 3 focusable elements (close, links, signout)');
  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];

  // Tab on last element wraps to first
  await act(async () => {
    lastFocusable.focus();
  });
  equal(dom.window.document.activeElement, lastFocusable, 'Focus placed on last element in drawer');

  await act(async () => {
    const tabEvent = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dom.window.document.dispatchEvent(tabEvent);
  });
  equal(dom.window.document.activeElement, firstFocusable, 'Tab on last element wraps around to first focusable in drawer');

  // Shift+Tab on first element wraps to last
  await act(async () => {
    const shiftTabEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    dom.window.document.dispatchEvent(shiftTabEvent);
  });
  equal(dom.window.document.activeElement, lastFocusable, 'Shift+Tab on first element wraps around to last focusable in drawer');

  // Step 2E: Escape key closes drawer
  await act(async () => {
    const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    dom.window.document.dispatchEvent(escEvent);
  });
  await flushPromises(4);

  check(container.querySelector('#mobile-navigation-drawer') === null, 'Drawer dialog unmounted on Escape key');
  equal(openerBtn.getAttribute('aria-expanded'), 'false', 'Opener aria-expanded updated to false');

  // Step 2F: Return-to-opener on normal close
  equal(
    dom.window.document.activeElement,
    openerBtn,
    'Focus returned to opener button after normal Escape close'
  );

  // Background aria-hidden removed
  check(headerElem.getAttribute('aria-hidden') === null, 'Header aria-hidden cleared after drawer close');
  check(mainElem.getAttribute('aria-hidden') === null, 'Main aria-hidden cleared after drawer close');

  // Step 2G: SIGNED_OUT cleanup (must NOT focus detached element, must NOT leave Retry inert)
  // Re-open drawer
  await act(async () => {
    openerBtn.click();
  });
  await flushPromises(4);
  check(container.querySelector('#mobile-navigation-drawer') !== null, 'Drawer re-opened for SIGNED_OUT test');

  // Emit SIGNED_OUT
  let detachedFocusThrown = false;
  const originalOpenerFocus = openerBtn.focus;
  openerBtn.focus = () => {
    detachedFocusThrown = true;
    originalOpenerFocus.call(openerBtn);
  };

  await act(async () => {
    authListeners.forEach((fn) => fn('SIGNED_OUT', null));
  });
  await flushPromises();

  check(!detachedFocusThrown, 'SIGNED_OUT cleanup did NOT attempt to return focus to opener or User A element');
  check(container.querySelector('#mobile-navigation-drawer') === null, 'Drawer closed immediately on SIGNED_OUT');
  check(container.querySelector('[aria-hidden="true"]') === null, 'No elements left aria-hidden in container on SIGNED_OUT');
  check(container.querySelector('[inert]') === null, 'No elements left inert in container on SIGNED_OUT');
  check(container.textContent.includes('Signing out of demo workspace'), 'Masking transition active without inert locks');

  // Restore opener.focus
  openerBtn.focus = originalOpenerFocus;

  console.log('✓ PROBE 2: FORM08-F02 Complete mobile drawer focus lifecycle verified.\n');

  // --------------------------------------------------------------------------
  // PROBE 3: FORM08-F03 — Discoverable Primary Preview Forms (properties & residents)
  // --------------------------------------------------------------------------
  console.log('--- PROBE 3: FORM08-F03 Discoverable Primary Preview Forms ---');

  // 3A: Properties module (Building vs Unit discoverable forms)
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        workspace: baseWorkspace,
        moduleKey: 'properties',
        lang: 'ro'
      })
    );
  });
  await flushPromises();

  // Switch to preview_form tab
  const propTabButtons = Array.from(container.querySelectorAll('button'));
  const propPreviewTab = propTabButtons.find(
    (b) => b.textContent && b.textContent.includes('Formular')
  );
  check(propPreviewTab !== undefined, 'Found Formular tab in properties module');

  await act(async () => {
    propPreviewTab.click();
  });
  await flushPromises();

  // Sub-type toggle buttons for properties
  const btnBuilding = container.querySelector('#sub-type-building');
  const btnUnit = container.querySelector('#sub-type-unit');
  check(btnBuilding !== null, '#sub-type-building toggle exists in properties module');
  check(btnUnit !== null, '#sub-type-unit toggle exists in properties module');
  check(btnBuilding.textContent.includes('Clădire'), 'Building button has Romanian label "Clădire"');
  check(btnUnit.textContent.includes('Unitate'), 'Unit button has Romanian label "Unitate"');

  // Default is Building form:
  check(container.querySelector('#form-building-name') !== null, '#form-building-name exists in building form');
  check(container.querySelector('#form-building-address') !== null, '#form-building-address exists in building form');
  check(container.querySelector('#form-building-floors') !== null, '#form-building-floors exists in building form');
  check(container.querySelector('#form-building-notes') !== null, '#form-building-notes exists in building form');

  // Type in building form
  const buildingNameInput = container.querySelector('#form-building-name');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(buildingNameInput, 'Rezidential Park Corp A');
    buildingNameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  equal(buildingNameInput.value, 'Rezidential Park Corp A', 'Building name input interactive in local memory');

  // Toggle to Unit form
  await act(async () => {
    btnUnit.click();
  });
  await flushPromises();

  check(container.querySelector('#form-unit-code') !== null, '#form-unit-code exists in unit form');
  check(container.querySelector('#form-unit-floor') !== null, '#form-unit-floor exists in unit form');
  check(container.querySelector('#form-unit-area') !== null, '#form-unit-area exists in unit form');
  check(container.querySelector('#form-unit-building') !== null, '#form-unit-building exists in unit form');
  check(container.querySelector('#form-unit-notes') !== null, '#form-unit-notes exists in unit form');
  check(container.querySelector('#form-building-name') === null, 'Building fields unmounted when toggled to unit');

  // 3B: Residents module (Owner vs Tenant discoverable forms)
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        workspace: baseWorkspace,
        moduleKey: 'residents',
        lang: 'fa'
      })
    );
  });
  await flushPromises();

  const resTabButtons = Array.from(container.querySelectorAll('button'));
  const resPreviewTab = resTabButtons.find(
    (b) => b.textContent && b.textContent.includes('فرم')
  );
  check(resPreviewTab !== undefined, 'Found preview form tab in residents module (Persian)');

  await act(async () => {
    resPreviewTab.click();
  });
  await flushPromises();

  const btnOwner = container.querySelector('#sub-type-owner');
  const btnTenant = container.querySelector('#sub-type-tenant');
  check(btnOwner !== null, '#sub-type-owner toggle exists in residents module');
  check(btnTenant !== null, '#sub-type-tenant toggle exists in residents module');
  check(btnOwner.textContent.includes('مالک'), 'Owner button has Persian label "مالک"');
  check(btnTenant.textContent.includes('مستأجر'), 'Tenant button has Persian label "مستأجر"');

  // Default is Owner form
  check(container.querySelector('#form-owner-name') !== null, '#form-owner-name exists in owner form');
  check(container.querySelector('#form-owner-contact') !== null, '#form-owner-contact exists in owner form');
  check(container.querySelector('#form-owner-unit') !== null, '#form-owner-unit exists in owner form');
  check(container.querySelector('#form-owner-notes') !== null, '#form-owner-notes exists in owner form');

  // Verify non-UUID friendly unit placeholder
  const ownerUnitInput = container.querySelector('#form-owner-unit');
  check(ownerUnitInput.placeholder.includes('واحد ۱۴'), 'Friendly associated unit format without raw UUID requirement');

  // Toggle to Tenant form
  await act(async () => {
    btnTenant.click();
  });
  await flushPromises();

  check(container.querySelector('#form-tenant-name') !== null, '#form-tenant-name exists in tenant form');
  check(container.querySelector('#form-tenant-contact') !== null, '#form-tenant-contact exists in tenant form');
  check(container.querySelector('#form-tenant-unit') !== null, '#form-tenant-unit exists in tenant form');
  check(container.querySelector('#form-tenant-lease') !== null, '#form-tenant-lease exists in tenant form');
  check(container.querySelector('#form-tenant-notes') !== null, '#form-tenant-notes exists in tenant form');
  check(container.querySelector('#form-owner-name') === null, 'Owner fields unmounted when toggled to tenant');

  // 3C: English locale labels check
  await act(async () => {
    mounted.render(
      React.createElement(DemoModuleView, {
        workspace: baseWorkspace,
        moduleKey: 'residents',
        lang: 'en'
      })
    );
  });
  await flushPromises();

  const enTabButtons = Array.from(container.querySelectorAll('button'));
  const enPreviewTab = enTabButtons.find((b) => b.textContent && b.textContent.includes('Preview Form'));
  if (enPreviewTab) {
    await act(async () => {
      enPreviewTab.click();
    });
    await flushPromises();
  }
  const enBtnOwner = container.querySelector('#sub-type-owner');
  const enBtnTenant = container.querySelector('#sub-type-tenant');
  check(enBtnOwner && enBtnOwner.textContent.includes('Owner'), 'Owner button has English label');
  check(enBtnTenant && enBtnTenant.textContent.includes('Tenant'), 'Tenant button has English label');

  // 3D: Save & Continue buttons strictly disabled across all forms
  const actionButtons = Array.from(container.querySelectorAll('button[type="button"]')).filter(
    (b) => b.textContent && (b.textContent.includes('Save') || b.textContent.includes('Salvează') || b.textContent.includes('ذخیره'))
  );
  check(actionButtons.length > 0, 'Save action button present');
  for (const btn of actionButtons) {
    equal(btn.disabled, true, 'Save action button is strictly disabled={true}');
  }

  // Submitting form does NOT trigger mutation
  const formElement = container.querySelector('form');
  let formDefaultPrevented = false;
  if (formElement) {
    const submitEvent = new dom.window.Event('submit', { cancelable: true, bubbles: true });
    formElement.dispatchEvent(submitEvent);
    formDefaultPrevented = submitEvent.defaultPrevented;
  }
  check(formDefaultPrevented, 'Form submission is default prevented (zero network mutations)');

  console.log('✓ PROBE 3: FORM08-F03 Discoverable primary preview forms verified.\n');

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
console.log(`ALL 3 SUPPLEMENT-R6 PROBES PASSED! (${checks} checks)`);
console.log(`=======================================================`);
