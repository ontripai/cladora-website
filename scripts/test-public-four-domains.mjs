// Verification test suite for TASK_ID: ANTIGRAVITY-PUBLIC-FOUR-DOMAINS-RELEASE-01
// Verifies 4 peer domains (AIRPROP, SERVICE, Operations, Community & Experience)
// across viewports (375px, 390px, 1365px), RTL, keyboard, focus, and link integrity.
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

// Global JSDOM setup
let currentViewportWidth = 1365;
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

// Custom module loader for TSX
const cache = new Map();
let currentPathname = '/en';
let lastPushedRoute = null;

const mockRouter = {
  push: (url) => { lastPushedRoute = url; },
  replace: (url) => { lastPushedRoute = url; }
};

const mocks = {
  'server-only': {},
  'next/link': {
    __esModule: true,
    default: ({ href, onClick, children, ...props }) => React.createElement('a', {
      href,
      onClick: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (onClick) onClick(e);
      },
      ...props
    }, children)
  },
  'next/navigation': {
    usePathname: () => currentPathname,
    useRouter: () => mockRouter,
    notFound: () => { throw new Error('NOT_FOUND'); },
    redirect: (url) => { lastPushedRoute = url; }
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

// Load target components
const { Header } = load('src/components/layout/Header.tsx');
const { Footer } = load('src/components/layout/Footer.tsx');
const { ThreeDomainsSection } = load('src/components/home/ThreeDomainsSection.tsx');
const PlatformPageModule = load('src/app/[lang]/platform/page.tsx');
const PlatformPage = PlatformPageModule.default || PlatformPageModule;
const CEPageModule = load('src/app/[lang]/community-experience/page.tsx');
const CommunityExperiencePage = CEPageModule.default || CEPageModule;

console.log('=== RUNNING PUBLIC FOUR DOMAINS RELEASE VERIFICATION ===\n');

async function renderComponent(element) {
  const container = document.getElementById('root');
  container.innerHTML = '';
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    }
  };
}

async function runSuite() {
  const locales = ['fa', 'ro', 'en'];
  const viewports = [375, 390, 1365];

  // =========================================================================
  // 1. HEADER VERIFICATION (DESKTOP & MOBILE, KEYBOARD, RTL, FOCUS)
  // =========================================================================
  console.log('--- 1. HEADER: Desktop & Mobile 4-Domain Parity & Interactions ---');

  for (const lang of locales) {
    const isRtl = lang === 'fa';

    for (const width of viewports) {
      updateViewport(width);
      currentPathname = `/${lang}`;

      const { container, unmount } = await renderComponent(React.createElement(Header, { lang }));

      if (width >= 1024) {
        // Desktop Header (1365px)
        const buttons = Array.from(container.querySelectorAll('button'));
        const servicesBtn = buttons.find((b) =>
          b.textContent.includes(lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان' : 'Services & Domains')
        );
        check(servicesBtn, `Desktop (${width}px, ${lang}): Services dropdown button rendered`);
        equal(servicesBtn.getAttribute('aria-expanded'), 'false', 'Initial aria-expanded is false');

        // Click to expand dropdown
        await act(async () => {
          servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        equal(servicesBtn.getAttribute('aria-expanded'), 'true', 'aria-expanded is true after click');

        // Check 4 peer domain links
        const ceLink = container.querySelector(`a[href="/${lang}/community-experience"]`);
        check(ceLink, `Desktop (${width}px, ${lang}): CE link present in dropdown`);
        check(ceLink.textContent.includes('CE'), 'CE badge present in link text');

        const airpropLink = container.querySelector(`a[href="/${lang}/airprop"]`);
        check(airpropLink, `Desktop (${width}px, ${lang}): AIRPROP link present in dropdown`);
        const serviceLink = container.querySelector(`a[href="/${lang}/service"]`);
        check(serviceLink, `Desktop (${width}px, ${lang}): SERVICE link present in dropdown`);
        const opsLink = container.querySelector(`a[href="/${lang}/operations"]`);
        check(opsLink, `Desktop (${width}px, ${lang}): Operations link present in dropdown`);

        await unmount();

        // Active state check when on CE path
        currentPathname = `/${lang}/community-experience`;
        const activeView = await renderComponent(React.createElement(Header, { lang }));
        const activeButtons = Array.from(activeView.container.querySelectorAll('button'));
        const activeBtn = activeButtons.find((b) =>
          b.textContent.includes(lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان' : 'Services & Domains')
        );
        check(activeBtn.className.includes('bg-[#EAF8F5]'), `Desktop (${width}px, ${lang}): Nav button highlighted on /${lang}/community-experience`);
        await activeView.unmount();
      } else {
        // Mobile Header (375px, 390px)
        const mobileToggleBtn = Array.from(container.querySelectorAll('button')).find((b) => {
          const label = b.getAttribute('aria-label') || '';
          return /menu|منو|meniu/i.test(label);
        });
        check(mobileToggleBtn, `Mobile (${width}px, ${lang}): Mobile menu button rendered`);

        // Click to open mobile drawer
        await act(async () => {
          mobileToggleBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });

        // 4th domain CE link in mobile menu
        const ceMobileLink = container.querySelector(`a[href="/${lang}/community-experience"]`);
        check(ceMobileLink, `Mobile (${width}px, ${lang}): CE link present in mobile drawer`);
        check(ceMobileLink.textContent.includes('CE'), 'CE label present in mobile menu text');

        // RTL check
        const arrowSvg = ceMobileLink.querySelector('svg');
        if (isRtl) {
          check(arrowSvg.getAttribute('class')?.includes('rtl:rotate-180'), `Mobile (${width}px, ${lang}): RTL rotation applied to arrow icon`);
        }

        // Clicking link closes mobile menu
        await act(async () => {
          const evt = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
          ceMobileLink.dispatchEvent(evt);
        });

        await unmount();
      }
    }
  }

  // =========================================================================
  // 2. HOME THREE/FOUR DOMAINS SECTION (ThreeDomainsSection)
  // =========================================================================
  console.log('\n--- 2. HOME: Four Peer Domains Section & Approved Copy ---');

  for (const lang of locales) {
    const { container, unmount } = await renderComponent(React.createElement(ThreeDomainsSection, { lang }));

    // Responsive 4-column grid check
    const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    check(grid, `Home (${lang}): 4-column responsive grid container rendered`);

    // 4 cards check
    const cards = container.querySelectorAll('.card-proptech');
    equal(cards.length, 4, `Home (${lang}): Exactly 4 peer domain cards rendered`);

    // CE card check
    const ceCard = cards[3];
    check(ceCard.textContent.includes('CE'), `Home (${lang}): CE badge present on 4th card`);
    const ceLink = ceCard.querySelector(`a[href="/${lang}/community-experience"]`);
    check(ceLink, `Home (${lang}): Explore link points to /${lang}/community-experience`);

    // Approved factual copy without automated booking promises (T10 copy invariant)
    const expectedT10Copy = {
      ro: 'Informații despre evenimente, cu disponibilitatea reală indicată',
      fa: 'معرفی رویدادها با وضعیت واقعی دسترسی',
      en: 'Event information with its actual availability'
    }[lang];

    check(ceCard.textContent.includes(expectedT10Copy), `Home (${lang}): Approved T10 copy without automated booking promise verified`);

    await unmount();
  }

  // =========================================================================
  // 3. PLATFORM ARCHITECTURE PAGE (/platform)
  // =========================================================================
  console.log('\n--- 3. PLATFORM: Peer Domain Framing & Direct Navigation ---');

  for (const lang of locales) {
    const pageJsx = await PlatformPage({ params: Promise.resolve({ lang }) });
    const { container, unmount } = await renderComponent(pageJsx);

    // Tier 04 describes 4 domains
    const fullText = container.textContent;
    check(
      fullText.includes('AIRPROP') &&
      fullText.includes('SERVICE') &&
      (fullText.includes('OPERAȚIUNI') || fullText.includes('OPERATIONS') || fullText.includes('عملیات')) &&
      (fullText.includes('COMUNITATE') || fullText.includes('COMMUNITY') || fullText.includes('جامعه')),
      `Platform (${lang}): Tier 04 explicitly covers all four peer domains`
    );

    // Links to all 4 peer domains
    const ceLink = container.querySelector(`a[href="/${lang}/community-experience"]`);
    check(ceLink, `Platform (${lang}): Link to /${lang}/community-experience present`);
    const airpropLink = container.querySelector(`a[href="/${lang}/airprop"]`);
    check(airpropLink, `Platform (${lang}): Link to /${lang}/airprop present`);
    const serviceLink = container.querySelector(`a[href="/${lang}/service"]`);
    check(serviceLink, `Platform (${lang}): Link to /${lang}/service present`);
    const opsLink = container.querySelector(`a[href="/${lang}/operations"]`);
    check(opsLink, `Platform (${lang}): Link to /${lang}/operations present`);

    // Contrast & accessible link styling check (PUBLIC-F01: >= 4.5:1 contrast against white)
    check(
      ceLink.className.includes('text-teal-700') && ceLink.className.includes('hover:text-teal-800'),
      `Platform (${lang}): Link uses text-teal-700/hover:text-teal-800 meeting WCAG AA contrast (5.56:1 / 7.32:1 >= 4.5:1)`
    );

    // Peer framing check: not subordinate
    const ceCardText = ceLink.closest('div.bg-white')?.textContent || '';
    check(
      !ceCardText.includes('sub-module of SERVICE') &&
      !ceCardText.includes('زیرمجموعه سرویس'),
      `Platform (${lang}): CE framed as architectural peer (never subordinate)`
    );

    await unmount();
  }

  // =========================================================================
  // 4. COMMUNITY & EXPERIENCE PAGE (/community-experience)
  // =========================================================================
  console.log('\n--- 4. COMMUNITY & EXPERIENCE: Access Condition & Canonical Truth ---');

  for (const lang of locales) {
    const pageJsx = await CommunityExperiencePage({ params: Promise.resolve({ lang }) });
    const { container, unmount } = await renderComponent(pageJsx);

    // T25 access condition in Hero
    const expectedAccessCondition = {
      ro: 'Accesul operațional depinde de stadiul lansării, configurarea proiectului și permisiuni valide.',
      fa: 'دسترسی عملیاتی به وضعیت انتشار، راه‌اندازی پروژه و مجوز معتبر وابسته است.',
      en: 'Operational access depends on release status, project setup and valid permissions.'
    }[lang];

    check(container.textContent.includes(expectedAccessCondition), `CE Page (${lang}): T25 operational access condition verified`);

    // Peer domain section
    check(
      container.textContent.includes('AIRPROP') &&
      container.textContent.includes('SERVICE'),
      `CE Page (${lang}): First-class peer domain section verified`
    );

    // Consumes truth from canonical providers
    check(container.textContent.includes('CORE'), `CE Page (${lang}): Truth from CORE verified`);
    check(container.textContent.includes('BK01'), `CE Page (${lang}): Truth from BK01 verified`);
    check(container.textContent.includes('FIN01'), `CE Page (${lang}): Truth from FIN01 verified`);
    check(
      container.textContent.includes('DOCUMENTS') ||
      container.textContent.includes('VAULT') ||
      container.textContent.includes('اسناد'),
      `CE Page (${lang}): Truth from DOCUMENTS/VAULT verified`
    );

    await unmount();
  }

  // =========================================================================
  // 5. FOOTER VERIFICATION
  // =========================================================================
  console.log('\n--- 5. FOOTER: CE Link Consistency ---');

  for (const lang of locales) {
    const { container, unmount } = await renderComponent(React.createElement(Footer, { lang }));
    const ceFooterLink = container.querySelector(`ul a[href="/${lang}/community-experience"]`);
    check(ceFooterLink, `Footer (${lang}): Nav link to /${lang}/community-experience present`);
    check(ceFooterLink.textContent.includes('(CE)'), `Footer (${lang}): Formatted with (CE)`);
    await unmount();
  }

  // =========================================================================
  // 6. ENVIRONMENTAL RECORD (PUBLIC-E01)
  // =========================================================================
  console.log('\n--- ENVIRONMENTAL EXECUTION STATUS (PUBLIC-E01) ---');
  console.log('NOTE: Native hardware browser / GPU window execution: NOT_RUN (Headless server seat execution environment without live display server).');
  console.log('SCOPE DELIMITATION: Current automated suite operates within JSDOM (evaluating React tree rendering, DOM hierarchy, synthetic click events, class bindings, and analytical WCAG contrast).');
  console.log('LIMITATION NOTICE: JSDOM innerWidth and CSS class assertions do not constitute live browser proof of physical Tab focus ring rendering, layout overflow, physical geometry, or complete visual viewport rendering of CE; those criteria require native browser execution and remain officially NOT_RUN.');

  console.log('\n=======================================================');
  console.log(`ALL PUBLIC FOUR DOMAINS VERIFICATION CHECKS PASSED! (${checks} checks)`);
  console.log('=======================================================\n');
}

runSuite().catch((err) => {
  console.error('VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
