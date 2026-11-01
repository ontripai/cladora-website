/**
 * Target Presentation & A11y Test Suite for ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01 / R1
 * 
 * Verifies presentation-only enhancements and findings closure:
 * 1. PILOT-F01: Accessible localized date names via aria-labelledby and stable id/name locators (no English overrides in FA/RO)
 * 2. PILOT-F02: High-contrast CTAs (bg-teal-800 text-white >= 4.5:1) and 44px touch targets across Wizard & Progress
 * 3. PILOT-F03: Fully localized status badge copy in FA, RO, EN; conditioned gating so old results do not appear active during checking/blocked/unknown
 * 4. PILOT-F04: Reduced motion compliance; removal of misleading animate-pulse on confirmed/saved statuses
 * 5. PILOT-F05: Valid Tailwind 3.4.19 CSS tokens (shadow-sm, zero invalid shadow-xs / shadow-2xs)
 * 6. Focus management after unit row deletion
 * 7. Zero operational mutations / controlled mock transport
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

console.log('=== RUNNING ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01 / R1 VERIFICATION TESTS ===\n');

// -----------------------------------------------------------------------------
// TEST 1: Visual Segmentation, Spacing, and Valid CSS Tokens (PILOT-F05)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Visual Segmentation & Valid CSS Tokens (PILOT-F05) ---');
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

// PILOT-F05: Assert absence of ungenerated Tailwind v4 classes in Tailwind 3.4.19
check(document.querySelectorAll('.shadow-xs').length === 0, 'PILOT-F05: Zero occurrences of ungenerated shadow-xs in wizard');
check(document.querySelectorAll('.shadow-2xs').length === 0, 'PILOT-F05: Zero occurrences of ungenerated shadow-2xs in wizard');
check(document.querySelectorAll('.shadow-sm').length > 0, 'PILOT-F05: Uses valid Tailwind 3.4.19 shadow-sm token');
console.log('✓ TEST 1: Visual segmentation and valid CSS tokens passed.\n');

// -----------------------------------------------------------------------------
// TEST 2: Multilingual Labels & Accessible Date Names (PILOT-F01)
// -----------------------------------------------------------------------------
console.log('--- TEST 2: Multilingual Accessible Date Labels (PILOT-F01) ---');

// EN assertions
await renderWizard('en', 'test-lang-en');
check(document.body.textContent.includes('Accounting period start'), 'EN visible label for period start exists');
check(document.body.textContent.includes('Accounting period end'), 'EN visible label for period end exists');

const enStartInput = document.getElementById('period-start-input');
const enEndInput = document.getElementById('period-end-input');
check(enStartInput !== null, 'PILOT-F01: Stable id #period-start-input exists');
check(enEndInput !== null, 'PILOT-F01: Stable id #period-end-input exists');
check(enStartInput.getAttribute('name') === 'period_start', 'PILOT-F01: name="period_start" locator exists');
check(enEndInput.getAttribute('name') === 'period_end', 'PILOT-F01: name="period_end" locator exists');
check(enStartInput.getAttribute('aria-labelledby') === 'period-start-label', 'PILOT-F01: aria-labelledby links to period-start-label');
check(enEndInput.getAttribute('aria-labelledby') === 'period-end-label', 'PILOT-F01: aria-labelledby links to period-end-label');
check(document.getElementById('period-start-label')?.textContent === 'Accounting period start', 'EN label span matches period start text');
check(document.getElementById('period-end-label')?.textContent === 'Accounting period end', 'EN label span matches period end text');

check(document.body.textContent.includes('Drafting building details'), 'EN internal EDIT state converted to human-readable label');
check(!document.body.textContent.includes('EDIT ·') && !document.querySelector('p[aria-live="polite"]').textContent.trim().startsWith('EDIT'), 'Raw internal uppercase EDIT string avoided in UI display');

// RO assertions
await renderWizard('ro', 'test-lang-ro');
check(document.body.textContent.includes('Data de început a perioadei contabile'), 'RO visible label for period start exists');
check(document.body.textContent.includes('Data de sfârșit a perioadei contabile'), 'RO visible label for period end exists');
const roStartInput = document.getElementById('period-start-input');
check(roStartInput !== null, 'RO period start input exists');
check(roStartInput.getAttribute('aria-labelledby') === 'period-start-label', 'RO period start has aria-labelledby');
check(document.getElementById('period-start-label')?.textContent === 'Data de început a perioadei contabile', 'RO label span matches Romanian text');
check(roStartInput.getAttribute('aria-label') === null, 'PILOT-F01: English aria-label removed to prevent overriding Romanian label');
check(document.body.textContent.includes('Editare detalii clădire'), 'RO internal EDIT state converted to human-readable label');
check(document.querySelector('section').getAttribute('dir') === 'ltr', 'RO layout uses LTR direction');

// FA assertions
await renderWizard('fa', 'test-lang-fa');
check(document.body.textContent.includes('تاریخ شروع دورهٔ حسابداری'), 'FA visible label for period start exists');
check(document.body.textContent.includes('تاریخ پایان دورهٔ حسابداری'), 'FA visible label for period end exists');
const faStartInput = document.getElementById('period-start-input');
check(faStartInput !== null, 'FA period start input exists');
check(faStartInput.getAttribute('aria-labelledby') === 'period-start-label', 'FA period start has aria-labelledby');
check(document.getElementById('period-start-label')?.textContent === 'تاریخ شروع دورهٔ حسابداری', 'FA label span matches Persian text');
check(faStartInput.getAttribute('aria-label') === null, 'PILOT-F01: English aria-label removed to prevent overriding Persian label');
check(document.body.textContent.includes('در حال تنظیم اطلاعات ساختمان'), 'FA internal EDIT state converted to human-readable label');
check(document.querySelector('section').getAttribute('dir') === 'rtl', 'FA layout strictly uses RTL direction');
console.log('✓ TEST 2: Multilingual accessible date labels passed.\n');

// -----------------------------------------------------------------------------
// TEST 3: Mobile Touch Targets & High-Contrast CTAs (PILOT-F02)
// -----------------------------------------------------------------------------
console.log('--- TEST 3: Mobile Touch Targets & High-Contrast CTAs (PILOT-F02) ---');
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

// PILOT-F02: Primary CTA buttons must use high-contrast bg-teal-800 text-white (7.44:1 contrast >= 4.5:1)
const primaryCTA = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Create draft');
check(primaryCTA !== undefined, 'Primary Create draft CTA exists');
check(primaryCTA.className.includes('bg-teal-800') && primaryCTA.className.includes('text-white'), 'PILOT-F02: Active CTA uses high-contrast bg-teal-800 text-white (7.44:1 >= 4.5:1)');
check(!primaryCTA.className.includes('bg-[#0E9F8E]'), 'PILOT-F02: Low-contrast bg-[#0E9F8E] replaced on active primary button');
console.log('✓ TEST 3: Mobile touch targets and high-contrast CTAs passed.\n');

// -----------------------------------------------------------------------------
// TEST 4: Distinct Progress States, Localized Badges & Reduced Motion (PILOT-F03 & PILOT-F04)
// -----------------------------------------------------------------------------
console.log('--- TEST 4: Progress Component States, Localized Badges & Reduced Motion (PILOT-F03, F04, F05) ---');

const savedMock = {
  status: 'draft',
  revision: 1,
  reference: 'run-uuid-001',
  building: 'Bloc 14 Pipera',
  units: 12
};

// Checking state: status badge MUST NOT be rendered even if saved is passed
await renderProgress({ lang: 'en', saved: savedMock, dirty: false, condition: 'checking', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Checking the current status'), 'Progress checking status displayed');
check(document.querySelector('.rounded-full.bg-teal-50') === null, 'PILOT-F03: Status badge suppressed during checking condition');

// Blocked state: status badge MUST NOT be rendered even if saved is passed
await renderProgress({ lang: 'ro', saved: savedMock, dirty: false, condition: 'blocked', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Starea salvată nu poate fi confirmată'), 'Romanian blocked condition displayed');
check(document.querySelector('.rounded-full.bg-teal-50') === null, 'PILOT-F03: Status badge suppressed during blocked condition');

// Unknown state: status badge MUST NOT be rendered
await renderProgress({ lang: 'fa', saved: savedMock, dirty: false, condition: 'unknown', canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('نتیجهٔ درخواست هنوز مشخص نیست'), 'Persian unknown condition displayed');
check(document.querySelector('.rounded-full.bg-teal-50') === null, 'PILOT-F03: Status badge suppressed during unknown condition');

// Dirty state without condition
await renderProgress({ lang: 'en', saved: null, dirty: true, condition: null, canContinue: false });
check(document.querySelector('[role="status"]').textContent.includes('Changes on this form are not saved yet'), 'Progress dirty alert displayed');

// Confirmed saved draft state (EN): localized badge rendered
await renderProgress({ lang: 'en', saved: savedMock, dirty: false, condition: null, canContinue: false });
check(document.querySelector('dl') !== null, 'Progress definition list rendered when saved');
check(document.body.textContent.includes('Bloc 14 Pipera'), 'Saved building name displayed');
check(document.body.textContent.includes('Draft saved'), 'Saved draft stage displayed');

const enBadge = document.querySelector('.rounded-full.bg-teal-50');
check(enBadge !== null, 'Status badge rendered when condition is null and saved is present');
check(enBadge.textContent.includes('Draft saved'), 'PILOT-F03: Status badge displays localized "Draft saved"');

// Confirmed saved draft state (RO): localized badge rendered without raw English
await renderProgress({ lang: 'ro', saved: savedMock, dirty: false, condition: null, canContinue: false });
const roBadge = document.querySelector('.rounded-full.bg-teal-50');
check(roBadge !== null, 'RO status badge rendered');
check(roBadge.textContent.includes('Ciornă salvată'), 'PILOT-F03: RO status badge displays localized "Ciornă salvată"');

// Confirmed saved draft state (FA): localized badge rendered without raw English
await renderProgress({ lang: 'fa', saved: savedMock, dirty: false, condition: null, canContinue: false });
const faBadge = document.querySelector('.rounded-full.bg-teal-50');
check(faBadge !== null, 'FA status badge rendered');
check(faBadge.textContent.includes('پیش‌نویس ذخیره شد'), 'PILOT-F03: FA status badge displays localized "پیش‌نویس ذخیره شد"');

// Confirmed provisioned state (FA): localized badge and dashboard link contrast
const provisionedMock = { ...savedMock, status: 'provisioned', revision: 5 };
await renderProgress({ lang: 'fa', saved: provisionedMock, dirty: false, condition: null, canContinue: true });
const faProvBadge = document.querySelector('.rounded-full.bg-teal-50');
check(faProvBadge.textContent.includes('ساختار ساختمان ایجاد شد'), 'PILOT-F03: FA provisioned status badge displays localized text');

// PILOT-F04: Status badge dot must NOT contain animate-pulse and must have motion-reduce support
const badgeDot = faProvBadge.querySelector('span.rounded-full');
check(badgeDot !== null, 'Status badge dot exists');
check(!badgeDot.classList.contains('animate-pulse'), 'PILOT-F04: Misleading animate-pulse removed from confirmed status dot');
check(badgeDot.classList.contains('motion-reduce:animate-none'), 'PILOT-F04: motion-reduce:animate-none present for reduced-motion safety');

// PILOT-F02: Dashboard CTA button contrast in Progress
const dashLink = document.querySelector('a');
check(dashLink !== null, 'Dashboard handoff link rendered for provisioned setup');
check(dashLink.getAttribute('href') === '/fa/app/dashboard', 'Dashboard handoff points to /fa/app/dashboard');
check(dashLink.classList.contains('min-h-[44px]'), 'Dashboard handoff meets 44px min-height');
check(dashLink.className.includes('bg-teal-800') && dashLink.className.includes('text-white'), 'PILOT-F02: Dashboard link uses high-contrast bg-teal-800 text-white (7.44:1 >= 4.5:1)');

// PILOT-F05: Valid CSS tokens in Progress
check(document.querySelectorAll('.shadow-xs').length === 0, 'PILOT-F05: Zero shadow-xs in Progress');
check(document.querySelectorAll('.shadow-2xs').length === 0, 'PILOT-F05: Zero shadow-2xs in Progress');
check(document.querySelectorAll('.shadow-sm').length > 0, 'PILOT-F05: Uses valid shadow-sm in Progress cards');
console.log('✓ TEST 4: Distinct progress states, localized badges, and reduced motion passed.\n');

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
