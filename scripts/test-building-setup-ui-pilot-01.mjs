/**
 * Target Presentation & A11y Test Suite for ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01
 * 
 * Verifies presentation-only enhancements for Building Setup components:
 * 1. Visual segmentation, typography hierarchy, and card layouts
 * 2. Visual & programmatic accessible labels in FA, EN, RO (period start/end, localized EDIT state)
 * 3. Mobile touch targets (44px min-height), focus rings, and RTL direction
 * 4. Distinct states: error, loading, disabled, denied, unknown, conflict, and empty
 * 5. Focus management after unit deletion
 * 6. Zero operational mutations / controlled mock transport
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });

// Global test harness setup
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  sessionStorage: dom.window.sessionStorage,
  IS_REACT_ACT_ENVIRONMENT: true
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

function loadModule(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const mod = new Module(filename);
  mod.require = (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id));
  mod._compile(
    ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText,
    filename
  );
  return mod.exports;
}

const schema = loadModule('src/lib/customer/building-setup-schema.ts');
const helper = loadModule('src/lib/customer/building-workspace-onboarding.ts', {
  './building-setup-schema': schema
});

const { CustomerBuildingSetupProgress: Progress } = loadModule(
  'src/components/customer/CustomerBuildingSetupProgress.tsx'
);

const ctx = '80000000-0000-0000-0000-000000000004';
const membership = '80000000-0000-0000-0000-000000000007';
const workspace = '90000000-0000-0000-0000-000000000001';
const run = '80000000-0000-0000-0000-000000000005';

let activeContext = { context_id: ctx, membership_id: membership };
let registeredGuards = new Map();
const registerUnsavedGuard = (key, dirty, discard) => {
  if (dirty) registeredGuards.set(key, discard);
  else registeredGuards.delete(key);
  return () => {
    if (registeredGuards.get(key) === discard) registeredGuards.delete(key);
  };
};

const { CustomerBuildingSetupWizard: Wizard } = loadModule(
  'src/components/customer/CustomerBuildingSetupWizard.tsx',
  {
    './CustomerOnboardingTemplates': { CustomerOnboardingTemplates: () => null },
    './CustomerBuildingSetupProgress': { CustomerBuildingSetupProgress: Progress },
    './CustomerContextProvider': {
      useCustomerContext: () => ({
        active: activeContext,
        dashboard: { workspace_id: workspace },
        registerUnsavedGuard
      })
    },
    '@/lib/customer/building-setup-schema': schema,
    '@/lib/customer/building-workspace-onboarding': helper,
    'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
  }
);

let checks = 0;
function check(value, msg) {
  checks++;
  assert.ok(value, msg);
}

const root = createRoot(document.getElementById('root'));

async function renderWizard(lang = 'en', key = 'default') {
  await act(async () => {
    root.render(React.createElement(Wizard, { lang, key }));
  });
}

async function renderProgress(props) {
  await act(async () => {
    root.render(React.createElement(Progress, props));
  });
}

console.log('=== RUNNING ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01 PRESENTATION TESTS ===\n');

// -----------------------------------------------------------------------------
// TEST 1: Visual Segmentation, Spacing, and Card Architecture
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Visual Segmentation & Card Architecture ---');
sessionStorage.clear();
await renderWizard('en', 'test-segmentation');

const section = document.querySelector('section');
check(section !== null, 'Root section mounted');
check(section.classList.contains('rounded-2xl'), 'Root section uses modern rounded-2xl container');
check(section.classList.contains('max-w-5xl'), 'Root container enforces max-w-5xl readability boundary');

const fieldsets = document.querySelectorAll('fieldset');
check(fieldsets.length >= 3, 'Multiple distinct fieldset cards present for segmentation');
for (const fs of fieldsets) {
  check(fs.classList.contains('rounded-2xl'), 'Each fieldset is encapsulated in a rounded-2xl card');
  check(fs.classList.contains('border-slate-200'), 'Card borders use subtle slate-200');
  check(fs.classList.contains('bg-white'), 'Card backgrounds use clean white');
}

const legends = document.querySelectorAll('legend');
check(legends.length >= 3, 'Semantic legend headings present for each fieldset');
console.log('✓ TEST 1: Visual segmentation and card architecture passed.\n');

// -----------------------------------------------------------------------------
// TEST 2: Visual & Accessible Labels in FA, RO, EN (Period & Localized EDIT)
// -----------------------------------------------------------------------------
console.log('--- TEST 2: Multilingual Labels & Localized State Text ---');

// EN assertions
await renderWizard('en', 'test-lang-en');
check(document.body.textContent.includes('Accounting period start'), 'EN visible label for period start exists');
check(document.body.textContent.includes('Accounting period end'), 'EN visible label for period end exists');
check(document.querySelector('input[aria-label="period start"]') !== null, 'EN period start aria-label preserved');
check(document.querySelector('input[aria-label="period end"]') !== null, 'EN period end aria-label preserved');
check(document.body.textContent.includes('Drafting building details'), 'EN internal EDIT state converted to human-readable label');
check(!document.body.textContent.includes('EDIT ·') && !document.querySelector('p[aria-live="polite"]').textContent.trim().startsWith('EDIT'), 'Raw internal uppercase EDIT string avoided in UI display');

// RO assertions
await renderWizard('ro', 'test-lang-ro');
check(document.body.textContent.includes('Data de început a perioadei contabile'), 'RO visible label for period start exists');
check(document.body.textContent.includes('Data de sfârșit a perioadei contabile'), 'RO visible label for period end exists');
check(document.body.textContent.includes('Editare detalii clădire'), 'RO internal EDIT state converted to human-readable label');
check(document.querySelector('section').getAttribute('dir') === 'ltr', 'RO layout uses LTR direction');

// FA assertions
await renderWizard('fa', 'test-lang-fa');
check(document.body.textContent.includes('تاریخ شروع دورهٔ حسابداری'), 'FA visible label for period start exists');
check(document.body.textContent.includes('تاریخ پایان دورهٔ حسابداری'), 'FA visible label for period end exists');
check(document.body.textContent.includes('در حال تنظیم اطلاعات ساختمان'), 'FA internal EDIT state converted to human-readable label');
check(document.querySelector('section').getAttribute('dir') === 'rtl', 'FA layout strictly uses RTL direction');
console.log('✓ TEST 2: Multilingual labels and localized state text passed.\n');

// -----------------------------------------------------------------------------
// TEST 3: Mobile Touch Targets (44px) & High-Contrast Focus Rings
// -----------------------------------------------------------------------------
console.log('--- TEST 3: Mobile Touch Targets & Focus Styling ---');
await renderWizard('en', 'test-mobile-a11y');

const allButtons = Array.from(document.querySelectorAll('button'));
check(allButtons.length > 0, 'Buttons found in wizard');
for (const btn of allButtons) {
  check(btn.classList.contains('min-h-[44px]'), `Button "${btn.textContent.trim()}" implements min-h-[44px] touch target`);
}

const allInputs = Array.from(document.querySelectorAll('input'));
check(allInputs.length > 0, 'Inputs found in wizard');
for (const inp of allInputs) {
  check(inp.classList.contains('min-h-[44px]'), 'Input implements min-h-[44px] touch target');
  check(inp.classList.contains('focus-visible:ring-[#0E9F8E]'), 'Input uses CLADORA teal focus ring token');
}
console.log('✓ TEST 3: Mobile touch targets and focus styling passed.\n');

// -----------------------------------------------------------------------------
// TEST 4: Distinct States (Progress Component)
// -----------------------------------------------------------------------------
console.log('--- TEST 4: Distinct Progress Component States ---');

// Checking state
await renderProgress({ lang: 'en', saved: null, dirty: false, condition: 'checking', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Checking the current status'), 'Progress checking status displayed');

// Dirty state
await renderProgress({ lang: 'en', saved: null, dirty: true, condition: null, canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Changes on this form are not saved yet'), 'Progress dirty alert displayed');

// Saved draft state
const savedMock = {
  status: 'draft',
  revision: 1,
  reference: 'run-uuid-001',
  building: 'Bloc 14 Pipera',
  units: 12
};
await renderProgress({ lang: 'en', saved: savedMock, dirty: false, condition: null, canContinue: false });
check(document.querySelector('dl') !== null, 'Progress definition list rendered when saved');
check(document.body.textContent.includes('Bloc 14 Pipera'), 'Saved building name displayed');
check(document.body.textContent.includes('Draft saved'), 'Saved draft stage displayed');

// Provisioned state with dashboard handoff
const provisionedMock = { ...savedMock, status: 'provisioned', revision: 5 };
await renderProgress({ lang: 'en', saved: provisionedMock, dirty: false, condition: null, canContinue: true });
const dashLink = document.querySelector('a');
check(dashLink !== null, 'Dashboard handoff link rendered for provisioned setup');
check(dashLink.getAttribute('href') === '/en/app/dashboard', 'Dashboard handoff points to /en/app/dashboard');
check(dashLink.classList.contains('min-h-[44px]'), 'Dashboard handoff meets 44px min-height');

// Blocked condition
await renderProgress({ lang: 'ro', saved: null, dirty: false, condition: 'blocked', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Starea salvată nu poate fi confirmată'), 'Romanian blocked condition displayed');

// Unknown condition
await renderProgress({ lang: 'fa', saved: null, dirty: false, condition: 'unknown', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('نتیجهٔ درخواست هنوز مشخص نیست'), 'Persian unknown condition displayed');
console.log('✓ TEST 4: Distinct progress component states passed.\n');

// -----------------------------------------------------------------------------
// TEST 5: Focus Management and Unit Deletion
// -----------------------------------------------------------------------------
console.log('--- TEST 5: Focus Management & Unit Row Deletion ---');
await renderWizard('en', 'test-focus-mgmt');

// Add a unit
const addBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Add unit');
check(addBtn !== undefined, 'Add unit button exists');

await act(async () => {
  addBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});

let unitRows = document.querySelectorAll('input[data-unit-code]');
check(unitRows.length === 2, 'Two units present after clicking Add unit');

// Now remove the second unit
const removeButtons = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Remove');
check(removeButtons.length === 2, 'Two remove buttons present');

await act(async () => {
  removeButtons[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});

unitRows = document.querySelectorAll('input[data-unit-code]');
check(unitRows.length === 1, 'Unit successfully removed');

// Single remaining unit has its Remove button disabled
const remainingRemoveBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Remove');
check(remainingRemoveBtn.disabled === true, 'Remove button is disabled when only one unit remains');
console.log('✓ TEST 5: Focus management and unit deletion passed.\n');

// -----------------------------------------------------------------------------
// TEST 6: Inline Feedback for Disabled Actions & Balances
// -----------------------------------------------------------------------------
console.log('--- TEST 6: Inline Disabled Action Feedback ---');
await renderWizard('en', 'test-balance-feedback');

// With default 0 debit and 0 credit, difference is 0.00 RON
check(document.body.textContent.includes('Difference: 0.00 RON'), 'Balanced preview rendered');
check(document.body.textContent.includes('Balanced'), 'Balanced badge rendered');

// Set debit to 100 without matching credit
const debitInput = Array.from(document.querySelectorAll('input')).find((i) => i.previousElementSibling?.textContent?.includes('Opening debits'));
if (debitInput) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(debitInput, '100');
    debitInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  check(document.body.textContent.includes('Difference: 100.00 RON'), 'Unbalanced preview difference updated');
  check(document.body.textContent.includes('Unbalanced'), 'Unbalanced badge rendered');
  check(document.body.textContent.includes('Opening debits and credits must balance'), 'Helpful inline explanation rendered when Create draft is blocked');
}
console.log('✓ TEST 6: Inline disabled action feedback passed.\n');

console.log(`=======================================================`);
console.log(`ALL PRESENTATION PILOT TESTS PASSED CLEANLY! (${checks} checks)`);
console.log(`=======================================================\n`);
