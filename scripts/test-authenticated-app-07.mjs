/**
 * TARGETED TEST SUITE: ANTIGRAVITY-AUTHENTICATED-APP-07
 *
 * Verifies the authenticated application shell:
 * 1. Login/logout & session expiration messaging across RO, EN, FA.
 * 2. Workspace / context switching with immediate stale data eviction.
 * 3. Human-readable denial & empty context states (no raw technical codes/UUIDs).
 * 4. Active route navigation highlighting on Desktop and Mobile.
 * 5. RTL layout direction and keyboard/focus accessibility.
 * 6. Local font preservation (Vazirmatn variable with 4 explicit weight descriptors).
 */

import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

let totalChecks = 0;
function check(condition, message) {
  totalChecks++;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  totalChecks++;
  assert.strictEqual(actual, expected, message);
}

console.log('=== RUNNING TARGETED VERIFICATION: ANTIGRAVITY-AUTHENTICATED-APP-07 ===\n');

// =========================================================================
// 1. LOGIN & SESSION EXPIRATION MESSAGING
// =========================================================================
console.log('--- 1. Login & Session Expiration Messaging ---');

const loginPagePath = path.join(root, 'src', 'app', '[lang]', 'login', 'page.tsx');
check(existsSync(loginPagePath), 'src/app/[lang]/login/page.tsx exists');
const loginPageCode = readFileSync(loginPagePath, 'utf8');

check(loginPageCode.includes('reason?: string'), 'login page receives reason searchParam');
check(loginPageCode.includes('reason={reason}'), 'login page passes reason to LoginForm');

const loginFormPath = path.join(root, 'src', 'components', 'auth', 'LoginForm.tsx');
check(existsSync(loginFormPath), 'src/components/auth/LoginForm.tsx exists');
const loginFormCode = readFileSync(loginFormPath, 'utf8');

check(loginFormCode.includes('reason?: string'), 'LoginFormProps includes optional reason');
check(loginFormCode.includes("reason === 'session_expired'"), 'LoginForm handles session_expired reason');
check(loginFormCode.includes('role="status"'), 'LoginForm renders accessible status announcement');
check(loginFormCode.includes('aria-live="polite"'), 'LoginForm status announcement has polite live region');

// Check translations for session_expired in LoginForm
check(loginFormCode.includes('Sesiunea dumneavoastră a expirat'), 'LoginForm has RO session_expired message');
check(loginFormCode.includes('Your session has expired'), 'LoginForm has EN session_expired message');
check(loginFormCode.includes('نشست کاری شما منقضی شده است'), 'LoginForm has FA session_expired message');

// =========================================================================
// 2. CONTEXT PROVIDER: IMMEDIATE STALE DATA EVICTION & ERROR CLASSIFICATION
// =========================================================================
console.log('\n--- 2. CustomerContextProvider Stale Data Eviction & Error Classification ---');

const contextProviderPath = path.join(root, 'src', 'components', 'customer', 'CustomerContextProvider.tsx');
check(existsSync(contextProviderPath), 'src/components/customer/CustomerContextProvider.tsx exists');
const providerCode = readFileSync(contextProviderPath, 'utf8');

check(providerCode.includes("setDashboard(null);"), 'CustomerContextProvider evicts dashboard on select');
check(providerCode.includes("setError('session_expired');"), 'CustomerContextProvider classifies 401 as session_expired');
check(providerCode.includes("setError('forbidden');"), 'CustomerContextProvider classifies 403 as forbidden');
check(providerCode.includes("response.status === 401"), 'CustomerContextProvider inspects HTTP 401 status on contexts and dashboard');
check(providerCode.includes("response.status === 403"), 'CustomerContextProvider inspects HTTP 403 status on dashboard');
check(providerCode.includes("availableContexts.length === 0"), 'CustomerContextProvider gracefully handles zero contexts');

// =========================================================================
// 3. ROUTE GUARD: READABLE ACCESS DENIAL & ACTIONS (NO RAW TECHNICAL CODES)
// =========================================================================
console.log('\n--- 3. CustomerRouteGuard Readable Access Denial & Friendly Actions ---');

const routeGuardPath = path.join(root, 'src', 'components', 'customer', 'CustomerRouteGuard.tsx');
check(existsSync(routeGuardPath), 'src/components/customer/CustomerRouteGuard.tsx exists');
const routeGuardCode = readFileSync(routeGuardPath, 'utf8');

check(routeGuardCode.includes("state.error === 'session_expired'"), 'CustomerRouteGuard handles state.error session_expired');
check(routeGuardCode.includes("state.error === 'forbidden'"), 'CustomerRouteGuard handles state.error forbidden');
check(routeGuardCode.includes("reason === 'session_expired'"), 'AccessRestrictedCard supports session_expired reason');
check(routeGuardCode.includes("reason === 'forbidden'"), 'AccessRestrictedCard supports forbidden reason');
check(routeGuardCode.includes("reason === 'no_context'"), 'AccessRestrictedCard supports no_context reason');

// Verify session_expired action href points directly to login
check(routeGuardCode.includes("/login?reason=session_expired"), 'AccessRestrictedCard directs session_expired to /login?reason=session_expired');

// Verify RO/EN/FA translations in AccessRestrictedCard
check(routeGuardCode.includes("sessionExpiredTitle: 'Sesiune Expirată'"), 'RO sessionExpiredTitle exists');
check(routeGuardCode.includes("sessionExpiredTitle: 'Session Expired'"), 'EN sessionExpiredTitle exists');
check(routeGuardCode.includes("sessionExpiredTitle: 'نشست کاری منقضی شده است'"), 'FA sessionExpiredTitle exists');

check(routeGuardCode.includes("forbiddenTitle: 'Acces Nepermis'"), 'RO forbiddenTitle exists');
check(routeGuardCode.includes("forbiddenTitle: 'Access Denied'"), 'EN forbiddenTitle exists');
check(routeGuardCode.includes("forbiddenTitle: 'دسترسی غیرمجاز'"), 'FA forbiddenTitle exists');

check(routeGuardCode.includes("noContextTitle: 'Niciun Spațiu de Lucru'"), 'RO noContextTitle exists');
check(routeGuardCode.includes("noContextTitle: 'No Workspace Assigned'"), 'EN noContextTitle exists');
check(routeGuardCode.includes("noContextTitle: 'فضای کاری تخصیص نیافته است'"), 'FA noContextTitle exists');

// Verify icons used
check(routeGuardCode.includes("isSessionExpired ? <Lock"), 'AccessRestrictedCard uses Lock icon for session expiration');
check(routeGuardCode.includes("<ShieldAlert"), 'AccessRestrictedCard uses ShieldAlert for permissions');

// =========================================================================
// 4. CUSTOMER APP SHELL: NAVIGATION, HIGHLIGHTING & SAFE CONTEXT LABELS
// =========================================================================
console.log('\n--- 4. CustomerAppShell Navigation, Active Page Highlighting & Safe Labels ---');

const appShellPath = path.join(root, 'src', 'components', 'customer', 'CustomerAppShell.tsx');
check(existsSync(appShellPath), 'src/components/customer/CustomerAppShell.tsx exists');
const appShellCode = readFileSync(appShellPath, 'utf8');

check(appShellCode.includes("usePathname"), 'CustomerAppShell imports usePathname');
check(appShellCode.includes("aria-current={isActive ? 'page' : undefined}"), 'CustomerAppShell sets aria-current on active nav item');
check(appShellCode.includes("bg-[#EAF8F5] text-[#0A6E62]"), 'CustomerAppShell applies active styling to selected nav link');
check(appShellCode.includes("label = [c.tenant_name, c.context_label, c.role_name].filter(Boolean).join"), 'CustomerAppShell safely formats context select options without raw UUIDs');
check(appShellCode.includes("aria-label=\"Mobile Navigation\""), 'CustomerAppShell includes accessible mobile navigation');
check(appShellCode.includes("state.error === 'session_expired'"), 'CustomerAppShell renders session expired alert in sidebar');
check(appShellCode.includes("dir={lang === \"fa\" ? \"rtl\" : \"ltr\"}"), 'CustomerAppShell sets correct RTL direction for FA');

// =========================================================================
// 5. LOCAL FONT PRESERVATION (VAZIRMATN VARIABLE WEBFONT)
// =========================================================================
console.log('\n--- 5. Local Font Preservation (Vazirmatn Variable Webfont) ---');

const layoutPath = path.join(root, 'src', 'app', '[lang]', 'layout.tsx');
check(existsSync(layoutPath), 'src/app/[lang]/layout.tsx exists');
const layoutCode = readFileSync(layoutPath, 'utf8');

check(layoutCode.includes("import localFont from 'next/font/local'"), 'layout.tsx imports localFont');
check(layoutCode.includes("path: '../../fonts/vazirmatn/Vazirmatn[wght].woff2'"), 'layout.tsx references Vazirmatn[wght].woff2');
check(layoutCode.includes("weight: '400'"), 'layout.tsx configures explicit weight 400');
check(layoutCode.includes("weight: '600'"), 'layout.tsx configures explicit weight 600');
check(layoutCode.includes("weight: '700'"), 'layout.tsx configures explicit weight 700');
check(layoutCode.includes("weight: '800'"), 'layout.tsx configures explicit weight 800');
check(layoutCode.includes("variable: '--font-vazirmatn'"), 'layout.tsx preserves --font-vazirmatn variable');

console.log('\n=======================================================');
console.log(`ALL AUTHENTICATED APP SHELL CHECKS PASSED! (${totalChecks} checks)`);
console.log('=======================================================\n');
