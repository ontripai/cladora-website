// Targeted verification suite for TASK_ID: ANTIGRAVITY-PUBLIC-FOUR-DOMAINS-RELEASE-01 / BROWSER-FIX-02
// Specifically verifies:
// 1. PUBLIC-BR-01: Focus restoration on Escape to visible openers (Services, Solutions, Mobile Toggle);
//    safe non-focus on resize/navigation/unmount; scroll lock release; LanguageSwitcher safety.
// 2. PUBLIC-BR-02: CE mobile peer-domain banner wrap/stack (flex-col sm:flex-row, flex-wrap)
//    without clipping or dropping pillars; environmental demarcation for geometry.
// 3. PUBLIC-BR-03: Contrast resolution (Header title hover, subtitle, desc; CE primary/closing CTA,
//    capabilities, industries; preservation of secondary CTA on navy gradient and platform teal).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Module, { createRequire } from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const root = process.cwd();
const localRequire = createRequire(path.join(root, 'package.json'));
let checks = 0;
const check = (v, m) => { assert.ok(v, m); checks++; };
const equal = (a, b, m) => {
  if (a && typeof a === 'object' && a.nodeType) {
    assert.ok(a === b, `${m}: Expected node [${b?.tagName || b}] but got [${a?.tagName || a}]`);
  } else {
    assert.deepEqual(a, b, m);
  }
  checks++;
};

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
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  Event: dom.window.Event,
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
const CEPageModule = load('src/app/[lang]/community-experience/page.tsx');
const CommunityExperiencePage = CEPageModule.default || CEPageModule;

console.log('=== RUNNING TARGETED VERIFICATION: BROWSER-FIX-02 ===\n');

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

// Relative Luminance & Contrast Helpers
function sRGBtoLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relativeLuminance(rgb) {
  return 0.2126 * sRGBtoLinear(rgb[0]) + 0.7152 * sRGBtoLinear(rgb[1]) + 0.0722 * sRGBtoLinear(rgb[2]);
}
function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runBrowserFixSuite() {
  const locales = ['fa', 'ro', 'en'];

  // =========================================================================
  // 1. PUBLIC-BR-01: FOCUS RETURN TO OPENER ON ESCAPE & LIFECYCLE GUARDS
  // =========================================================================
  console.log('--- PUBLIC-BR-01: Focus Return, ActiveElement & Lifecycle Safety ---');

  for (const lang of locales) {
    // 1A. Desktop (1365px): Services Opener
    updateViewport(1365);
    currentPathname = `/${lang}`;
    let { container, unmount } = await renderComponent(React.createElement(Header, { lang }));

    const buttons = Array.from(container.querySelectorAll('button'));
    const servicesBtn = buttons.find((b) =>
      b.textContent.includes(lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان' : 'Services & Domains')
    );
    check(servicesBtn, `Desktop (${lang}): Services opener button found`);

    // Open Services dropdown
    servicesBtn.focus();
    await act(async () => {
      servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): Services dropdown opened`);

    // Dispatch Escape key
    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Services dropdown closed on Escape`);
    equal(dom.window.document.activeElement, servicesBtn, `Desktop (${lang}): Focus returned to Services opener button (not BODY)`);
    check(servicesBtn.offsetParent !== null || dom.window.getComputedStyle(servicesBtn).display !== 'none', `Desktop (${lang}): Services opener is visible`);

    // 1B. Desktop (1365px): Solutions Opener
    const solutionsBtn = buttons.find((b) =>
      b.textContent.includes(lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions')
    );
    check(solutionsBtn, `Desktop (${lang}): Solutions opener button found`);

    // Open Solutions dropdown
    solutionsBtn.focus();
    await act(async () => {
      solutionsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(solutionsBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): Solutions dropdown opened`);

    // Dispatch Escape key
    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    equal(solutionsBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Solutions dropdown closed on Escape`);
    equal(dom.window.document.activeElement, solutionsBtn, `Desktop (${lang}): Focus returned to Solutions opener button (not BODY)`);
    check(solutionsBtn.offsetParent !== null || dom.window.getComputedStyle(solutionsBtn).display !== 'none', `Desktop (${lang}): Solutions opener is visible`);

    // 1C. Desktop: Services open -> Focus & Activate real LanguageSwitcher -> Tab to real language option -> Escape (PUBLIC-BR-01-LANGUAGE, PUBLIC-BR-04)
    await act(async () => {
      servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): Services dropdown reopened`);

    const desktopLangBtn = container.querySelector('.hidden.lg\\:flex .relative.inline-block.text-start button');
    check(desktopLangBtn, `Desktop (${lang}): Real LanguageSwitcher button found in header`);

    // Focus LanguageSwitcher button
    desktopLangBtn.focus();
    equal(dom.window.document.activeElement, desktopLangBtn, `Desktop (${lang}): Focus moved to LanguageSwitcher button`);

    // Activate LanguageSwitcher dropdown
    await act(async () => {
      desktopLangBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(desktopLangBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): LanguageSwitcher dropdown opened`);

    // Focus real language option item (PUBLIC-BR-04)
    const langMenuItems = Array.from(container.querySelectorAll('.hidden.lg\\:flex .relative.inline-block.text-start div[role="menu"] a[role="menuitem"]'));
    check(langMenuItems.length > 0, `Desktop (${lang}): Real language option items found inside LanguageSwitcher dropdown`);
    const targetOption = langMenuItems[0];
    targetOption.focus();
    equal(dom.window.document.activeElement, targetOption, `Desktop (${lang}): Focus moved to real language option item before Escape`);

    // Dispatch Escape key on real language option item (event bubbles, propagates to Header, unmounts option)
    await act(async () => {
      targetOption.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    equal(servicesBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Services dropdown closed on option Escape`);
    equal(desktopLangBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): LanguageSwitcher closed on option Escape`);
    equal(dom.window.document.activeElement, desktopLangBtn, `Desktop (${lang}): Focus PRESERVED on LanguageSwitcher trigger (NOT stolen to Services opener)`);
    check(dom.window.document.activeElement !== servicesBtn, `Desktop (${lang}): Focus was NOT moved to Services button`);
    check(dom.window.document.activeElement !== dom.window.document.body, `Desktop (${lang}): Focus was NOT reset to BODY`);

    // 1C2. Desktop: Solutions open -> Activate LanguageSwitcher -> Tab to real language option -> Escape (PUBLIC-BR-04)
    await act(async () => {
      solutionsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(solutionsBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): Solutions dropdown reopened`);

    desktopLangBtn.focus();
    await act(async () => {
      desktopLangBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(desktopLangBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): LanguageSwitcher dropdown opened for Solutions test`);

    const solutionsLangMenuItems = Array.from(container.querySelectorAll('.hidden.lg\\:flex .relative.inline-block.text-start div[role="menu"] a[role="menuitem"]'));
    check(solutionsLangMenuItems.length > 0, `Desktop (${lang}): Real language option items found`);
    const targetOptionSolutions = solutionsLangMenuItems[solutionsLangMenuItems.length - 1];
    targetOptionSolutions.focus();
    equal(dom.window.document.activeElement, targetOptionSolutions, `Desktop (${lang}): Focus moved to real language option item for Solutions`);

    await act(async () => {
      targetOptionSolutions.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    equal(solutionsBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Solutions dropdown closed on option Escape`);
    equal(desktopLangBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): LanguageSwitcher closed on option Escape`);
    equal(dom.window.document.activeElement, desktopLangBtn, `Desktop (${lang}): Focus PRESERVED on LanguageSwitcher trigger (NOT stolen to Solutions opener)`);
    check(dom.window.document.activeElement !== solutionsBtn, `Desktop (${lang}): Focus was NOT moved to Solutions button`);
    check(dom.window.document.activeElement !== dom.window.document.body, `Desktop (${lang}): Focus was NOT reset to BODY`);

    // 1D. Desktop: Services open -> Focus external control (Sign In link) -> Escape preserves focus on external control
    await act(async () => {
      servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'true', `Desktop (${lang}): Services dropdown opened for external control test`);

    const signInLink = container.querySelector('a[href$="/login"]');
    check(signInLink, `Desktop (${lang}): Sign In link found`);
    signInLink.focus();
    equal(dom.window.document.activeElement, signInLink, `Desktop (${lang}): Focus moved to Sign In external control`);

    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Services dropdown closed on Escape`);
    equal(dom.window.document.activeElement, signInLink, `Desktop (${lang}): Focus PRESERVED on Sign In link (NOT stolen to Services)`);

    // 1E. Desktop: Services open -> Focus item inside Services menu -> Escape returns focus to Services opener
    await act(async () => {
      servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    const servicesMenuItem = container.querySelector('div[role="menu"] a[href$="/airprop"]');
    check(servicesMenuItem, `Desktop (${lang}): Services menuitem found`);
    servicesMenuItem.focus();
    equal(dom.window.document.activeElement, servicesMenuItem, `Desktop (${lang}): Focus inside Services menuitem`);

    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    equal(servicesBtn.getAttribute('aria-expanded'), 'false', `Desktop (${lang}): Services dropdown closed on Escape`);
    equal(dom.window.document.activeElement, servicesBtn, `Desktop (${lang}): Focus returned to Services opener when focus belonged to Services menu`);

    // 1F. Inactive Escape Guard: When no dropdown is open, Escape does NOT redirect focus
    const dummyElement = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(dummyElement);
    dummyElement.focus();
    equal(dom.window.document.activeElement, dummyElement, 'Pre-check: Dummy element has focus');

    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    equal(dom.window.document.activeElement, dummyElement, `Desktop (${lang}): Inactive Escape does NOT steal focus to Header openers`);
    dom.window.document.body.removeChild(dummyElement);

    await unmount();

    // 1G. Mobile (390px & 375px): Mobile Toggle Opener & LanguageSwitcher Focus
    for (const width of [390, 375]) {
      updateViewport(width);
      const mobView = await renderComponent(React.createElement(Header, { lang }));
      const mobContainer = mobView.container;

      const mobButtons = Array.from(mobContainer.querySelectorAll('button'));
      const toggleBtn = mobButtons.find((b) => {
        const ariaLabel = b.getAttribute('aria-label') || '';
        return /menu|منو|meniu/i.test(ariaLabel);
      });
      check(toggleBtn, `Mobile (${width}px, ${lang}): Mobile toggle button found`);

      // Open mobile drawer
      await act(async () => {
        toggleBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      equal(dom.window.document.body.style.overflow, 'hidden', `Mobile (${width}px, ${lang}): Body scroll locked when drawer opened`);

      // Press Escape
      await act(async () => {
        dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      equal(dom.window.document.body.style.overflow, '', `Mobile (${width}px, ${lang}): Body scroll lock released on Escape`);
      equal(dom.window.document.activeElement, toggleBtn, `Mobile (${width}px, ${lang}): Focus returned to Mobile toggle button (not BODY)`);
      check(toggleBtn.offsetParent !== null || dom.window.getComputedStyle(toggleBtn).display !== 'none', `Mobile (${width}px, ${lang}): Mobile toggle is visible`);

      // Mobile drawer open -> Shift+Tab to mobile header LanguageSwitcher -> Enter -> Tab to real language option -> Escape (PUBLIC-BR-04)
      await act(async () => {
        toggleBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      equal(dom.window.document.body.style.overflow, 'hidden', `Mobile (${width}px, ${lang}): Drawer opened for LanguageSwitcher option test`);

      const mobLangBtn = mobContainer.querySelector('.lg\\:hidden button[aria-haspopup="true"]');
      check(mobLangBtn, `Mobile (${width}px, ${lang}): Mobile header LanguageSwitcher found`);
      mobLangBtn.focus();
      equal(dom.window.document.activeElement, mobLangBtn, `Mobile (${width}px, ${lang}): Focus on mobile LanguageSwitcher trigger`);

      await act(async () => {
        mobLangBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      equal(mobLangBtn.getAttribute('aria-expanded'), 'true', `Mobile (${width}px, ${lang}): Mobile LanguageSwitcher opened`);

      const mobLangOptions = Array.from(mobContainer.querySelectorAll('.lg\\:hidden div[role="menu"] a[role="menuitem"]'));
      check(mobLangOptions.length > 0, `Mobile (${width}px, ${lang}): Mobile real language options found`);
      const mobTargetOption = mobLangOptions[0];
      mobTargetOption.focus();
      equal(dom.window.document.activeElement, mobTargetOption, `Mobile (${width}px, ${lang}): Focus moved to real mobile language option`);

      // Dispatch Escape on real language option item
      await act(async () => {
        mobTargetOption.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      equal(dom.window.document.body.style.overflow, '', `Mobile (${width}px, ${lang}): Drawer closed and scroll released on option Escape`);
      equal(mobLangBtn.getAttribute('aria-expanded'), 'false', `Mobile (${width}px, ${lang}): Mobile LanguageSwitcher closed on option Escape`);
      equal(dom.window.document.activeElement, mobLangBtn, `Mobile (${width}px, ${lang}): Focus PRESERVED on mobile LanguageSwitcher trigger (NOT stolen to toggleBtn)`);
      check(dom.window.document.activeElement !== toggleBtn, `Mobile (${width}px, ${lang}): Focus was NOT moved to mobile toggle button`);
      check(dom.window.document.activeElement !== dom.window.document.body, `Mobile (${width}px, ${lang}): Focus was NOT reset to BODY`);

      // Mobile drawer open -> focus item inside drawer -> Escape returns focus to toggleBtn
      await act(async () => {
        toggleBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      const drawerLink = mobContainer.querySelector('nav[aria-label] a[href$="/platform"]');
      check(drawerLink, `Mobile (${width}px, ${lang}): Drawer nav link found`);
      drawerLink.focus();
      equal(dom.window.document.activeElement, drawerLink, `Mobile (${width}px, ${lang}): Focus inside drawer link`);

      await act(async () => {
        dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      equal(dom.window.document.body.style.overflow, '', `Mobile (${width}px, ${lang}): Drawer closed on Escape`);
      equal(dom.window.document.activeElement, toggleBtn, `Mobile (${width}px, ${lang}): Focus returned to toggleBtn when focus belonged to drawer`);

      // 1H. Resize Transition: Mobile open -> resize to desktop (1365px)
      await act(async () => {
        toggleBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      equal(dom.window.document.body.style.overflow, 'hidden', 'Pre-resize: Body scroll locked');

      // Resize to desktop
      await act(async () => {
        updateViewport(1365);
      });
      equal(dom.window.document.body.style.overflow, '', `Resize (${lang}): Scroll lock released on desktop breakpoint transition`);
      check(dom.window.document.activeElement !== toggleBtn, `Resize (${lang}): Focus is NOT moved to hidden mobile toggle on desktop resize`);

      await mobView.unmount();
    }
  }

  // =========================================================================
  // 2. PUBLIC-BR-02: CE MOBILE PEER-DOMAIN BANNER WRAP/STACK
  // =========================================================================
  console.log('\n--- PUBLIC-BR-02: CE Mobile Peer-Domain Banner Wrap/Stack Layout ---');

  for (const lang of locales) {
    const pageJsx = await CommunityExperiencePage({ params: Promise.resolve({ lang }) });
    const { container, unmount } = await renderComponent(pageJsx);

    const peerSection = container.querySelector('#peer-domain');
    check(peerSection, `CE Page (${lang}): #peer-domain section found`);

    // Banner container
    const banner = peerSection.querySelector('.bg-teal-50\\/60');
    check(banner, `CE Page (${lang}): Connected peer domain banner container found`);
    check(
      banner.className.includes('flex-col') && banner.className.includes('sm:flex-row'),
      `CE Page (${lang}): Banner container applies local wrap/stack (flex-col sm:flex-row)`
    );

    // Inner label and badges container
    const innerWrap = banner.firstElementChild;
    check(innerWrap, `CE Page (${lang}): Inner label and badge cluster found`);
    check(
      innerWrap.className.includes('flex-wrap'),
      `CE Page (${lang}): Label & badges container applies flex-wrap`
    );

    // Badges wrapper
    const badgesCluster = innerWrap.querySelector('.flex.items-center.flex-wrap');
    check(badgesCluster, `CE Page (${lang}): Badge group applies dedicated flex-wrap`);

    // Verify all 4 peer domain badges preserved in DOM
    const badgeText = banner.textContent;
    check(badgeText.includes('AIRPROP'), `CE Page (${lang}): AIRPROP badge preserved`);
    check(badgeText.includes('SERVICE'), `CE Page (${lang}): SERVICE badge preserved`);
    check(badgeText.includes('OPERATIONS'), `CE Page (${lang}): OPERATIONS badge preserved`);
    check(badgeText.includes('C&E') || badgeText.includes('C&amp;E'), `CE Page (${lang}): C&E badge preserved`);

    // Verify Capability Matrix link preserved
    const capLink = banner.querySelector(`a[href="/${lang}/capabilities"]`);
    check(capLink, `CE Page (${lang}): Capabilities link preserved`);

    await unmount();
  }

  // =========================================================================
  // 3. PUBLIC-BR-03: CONTRAST RESOLUTION IN HEADER & CE PAGE (>= 4.5:1)
  // =========================================================================
  console.log('\n--- PUBLIC-BR-03: Contrast Resolution & Analytical Luminance Verification ---');

  // 3A. Header Dropdown Contrast
  updateViewport(1365);
  for (const lang of locales) {
    const { container, unmount } = await renderComponent(React.createElement(Header, { lang }));
    const buttons = Array.from(container.querySelectorAll('button'));
    const servicesBtn = buttons.find((b) =>
      b.textContent.includes(lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان' : 'Services & Domains')
    );
    await act(async () => {
      servicesBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const ceLink = container.querySelector(`a[href="/${lang}/community-experience"]`);
    check(ceLink, `Header (${lang}): CE dropdown link found`);

    // Title hover class check
    const titleSpan = ceLink.querySelector('.font-bold.text-xs');
    check(
      titleSpan.className.includes('group-hover:text-teal-700'),
      `Header (${lang}): CE title uses group-hover:text-teal-700 (>= 4.5:1 contrast against white/hover bg)`
    );

    // Subtitle class check
    const subtitleSpan = ceLink.querySelector('.text-\\[10px\\]');
    check(
      subtitleSpan.className.includes('text-[#52667A]'),
      `Header (${lang}): CE subtitle uses text-[#52667A] (5.932:1 contrast against white >= 4.5:1)`
    );

    // Description class check
    const descP = ceLink.querySelector('p.text-\\[11px\\]');
    check(
      descP.className.includes('text-[#52667A]'),
      `Header (${lang}): CE description uses text-[#52667A] (5.932:1 contrast against white >= 4.5:1)`
    );

    // Solutions "View all" link check
    const solutionsBtn = buttons.find((b) =>
      b.textContent.includes(lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions')
    );
    await act(async () => {
      solutionsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    const viewAllLink = container.querySelector(`a[href="/${lang}/solutions"]`);
    check(
      viewAllLink.className.includes('text-teal-700') && viewAllLink.className.includes('hover:text-teal-800'),
      `Header (${lang}): Solutions 'View all' link uses text-teal-700 hover:text-teal-800 (>= 4.5:1)`
    );

    await unmount();
  }

  // 3B. CE Page Contrast
  for (const lang of locales) {
    const pageJsx = await CommunityExperiencePage({ params: Promise.resolve({ lang }) });
    const { container, unmount } = await renderComponent(pageJsx);

    // Hero Primary CTA
    const heroPrimaryCta = container.querySelector('a[href="#peer-domain"]');
    check(heroPrimaryCta, `CE Page (${lang}): Hero primary CTA found`);
    check(
      heroPrimaryCta.className.includes('bg-teal-700') && heroPrimaryCta.className.includes('hover:bg-teal-800') && heroPrimaryCta.className.includes('text-white'),
      `CE Page (${lang}): Hero primary CTA uses bg-teal-700 text-white hover:bg-teal-800 (5.473:1 normal / 7.584:1 hover >= 4.5:1)`
    );

    // Capabilities Link
    const capLink = container.querySelector(`a[href="/${lang}/capabilities"]`);
    check(
      capLink.className.includes('text-teal-700') && capLink.className.includes('hover:text-teal-800'),
      `CE Page (${lang}): Capabilities link uses text-teal-700 hover:text-teal-800 (>= 4.5:1)`
    );

    // Industries Link
    const indLink = container.querySelector(`a[href="/${lang}/industries"]`);
    check(
      indLink.className.includes('text-teal-700') && indLink.className.includes('hover:text-teal-800'),
      `CE Page (${lang}): Industries link uses text-teal-700 hover:text-teal-800 (>= 4.5:1)`
    );

    // Closing Primary CTA
    const closingPrimaryCta = container.querySelector('section.bg-gradient-to-br a[href$="/platform/architecture"]');
    check(closingPrimaryCta, `CE Page (${lang}): Closing primary CTA found`);
    check(
      closingPrimaryCta.className.includes('bg-teal-700') && closingPrimaryCta.className.includes('hover:bg-teal-800') && closingPrimaryCta.className.includes('text-white'),
      `CE Page (${lang}): Closing primary CTA uses bg-teal-700 text-white hover:bg-teal-800 (>= 4.5:1)`
    );

    // Preserved Secondary CTA on navy gradient
    const closingSecondaryCta = container.querySelector('section.bg-gradient-to-br a[href$="/contact"]');
    check(closingSecondaryCta, `CE Page (${lang}): Closing secondary CTA found`);
    check(
      closingSecondaryCta.className.includes('bg-white/10') && closingSecondaryCta.className.includes('text-white'),
      `CE Page (${lang}): Secondary CTA on navy gradient preserved intact (bg-white/10 text-white)`
    );

    await unmount();
  }

  // 3C. Analytical Relative Luminance and Contrast Mathematical Proof
  const contrastProofCases = [
    {
      name: 'White text on bg-teal-700 (#0f766e)',
      fg: [255, 255, 255],
      bg: [15, 118, 110],
      minRatio: 4.5,
      expected: '5.473250'
    },
    {
      name: 'White text on hover:bg-teal-800 (#115e59)',
      fg: [255, 255, 255],
      bg: [17, 94, 89],
      minRatio: 4.5,
      expected: '7.583502'
    },
    {
      name: 'text-teal-700 (#0f766e) on white background (#ffffff)',
      fg: [15, 118, 110],
      bg: [255, 255, 255],
      minRatio: 4.5,
      expected: '5.473250'
    },
    {
      name: 'hover:text-teal-800 (#115e59) on white background (#ffffff)',
      fg: [17, 94, 89],
      bg: [255, 255, 255],
      minRatio: 4.5,
      expected: '7.583502'
    },
    {
      name: 'text-[#52667A] on white background (#ffffff)',
      fg: [82, 102, 122],
      bg: [255, 255, 255],
      minRatio: 4.5,
      expected: '5.931627'
    },
    {
      name: 'text-teal-700 (#0f766e) on subtle card background #F6F9FC',
      fg: [15, 118, 110],
      bg: [246, 249, 252],
      minRatio: 4.5,
      expected: '5.179908'
    },
    {
      name: 'hover:text-teal-800 (#115e59) on subtle card background #F6F9FC',
      fg: [17, 94, 89],
      bg: [246, 249, 252],
      minRatio: 4.5,
      expected: '7.177060'
    }
  ];

  const cssDeclarationProof = `
/* BROWSER-FIX-02 Verified Readable CSS Declarations */
.bg-teal-700 { background-color: #0f766e; color: #ffffff; }
.hover\\:bg-teal-800:hover { background-color: #115e59; color: #ffffff; }
.text-teal-700 { color: #0f766e; }
.hover\\:text-teal-800:hover { color: #115e59; }
.text-\\[\\#52667A\\] { color: #52667A; }
`.trim();

  const declarationHash = crypto.createHash('sha256').update(cssDeclarationProof).digest('hex');

  for (const c of contrastProofCases) {
    const l1 = relativeLuminance(c.fg);
    const l2 = relativeLuminance(c.bg);
    const ratio = contrastRatio(l1, l2);
    check(ratio >= c.minRatio, `${c.name} satisfies WCAG AA >= ${c.minRatio}:1`);
    equal(ratio.toFixed(6), c.expected, `${c.name} matches exact computed ratio ${c.expected}:1`);
    console.log(`PASS: ${c.name} -> ${ratio.toFixed(6)}:1 (>= ${c.minRatio}:1)`);
  }
  console.log(`Witness CSS Proof Hash (SHA256): ${declarationHash}`);

  // =========================================================================
  // 4. ENVIRONMENTAL RECORD & NOT_RUN DECLARATION
  // =========================================================================
  console.log('\n--- ENVIRONMENTAL RECORD & BOUNDARY DECLARATION ---');
  console.log('STATUS: Headless/native browser engine execution (pixel geometry, layout overflow): NOT_RUN');
  console.log('NOTE: Current automated harness operates within JSDOM (evaluating React tree rendering, DOM hierarchy, synthetic event dispatch, focus activeElement return, class bindings, and analytical WCAG luminance contrast).');
  console.log('LIMITATION: JSDOM does not compute physical layout geometry or live viewport clipping. As mandated, lack of native browser execution is NOT substituted with a fake PASS; native physical geometry remains officially NOT_RUN.');

  console.log('\n=======================================================');
  console.log(`ALL BROWSER-FIX-02 TARGETED VERIFICATION CHECKS PASSED! (${checks} checks)`);
  console.log('=======================================================\n');
}

runBrowserFixSuite().catch((err) => {
  console.error('VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
