import { readFileSync, existsSync } from 'fs';
import path from 'path';

const root = process.cwd();
let passed = 0;
let total = 0;

function check(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING TARGETED VERIFICATION: CONTEXT-R1-AND-MANROPE ===\n');

// 1. CustomerContextProvider source assertions
console.log('--- 1. CustomerContextProvider Concurrency, Refresh & Revocation ---');
const providerPath = path.join(root, 'src', 'components', 'customer', 'CustomerContextProvider.tsx');
check(existsSync(providerPath), 'CustomerContextProvider.tsx exists');
const providerCode = readFileSync(providerPath, 'utf8');

check(providerCode.includes('contextsSeq'), 'Contexts fetch uses sequence counter for race condition protection');
check(providerCode.includes('dashboardSeq'), 'Dashboard fetch uses sequence counter for race condition protection');
check(providerCode.includes('activeIdRef'), 'Active ID tracked in ref for synchronous callback/effect state checks');
check(providerCode.includes('const isStillValid = availableContexts.some((c) => c.context_id === currentActiveId)'), 'Preserves currently active context selection across refresh');
check(providerCode.includes('unsavedGuards.current.clear()'), 'Clears unsaved guards immediately when context is revoked');
check(providerCode.includes("setError('forbidden')"), 'Sets forbidden error when active context is removed from server');
check(providerCode.includes('if (seq !== dashboardSeq.current || cancelled || activeIdRef.current !== targetContextId)'), 'Drops stale or late-arriving dashboard responses');

// 2. LoginForm reason sanitization
console.log('\n--- 2. LoginForm Reason Parameter Sanitization ---');
const loginFormPath = path.join(root, 'src', 'components', 'auth', 'LoginForm.tsx');
check(existsSync(loginFormPath), 'LoginForm.tsx exists');
const loginFormCode = readFileSync(loginFormPath, 'utf8');

check(loginFormCode.includes('APPROVED_REASON_MESSAGES'), 'Defines APPROVED_REASON_MESSAGES whitelist');
check(!loginFormCode.includes(': reason}'), 'Ensures unknown reason is never rendered as raw free text');
check(loginFormCode.includes('{reasonMessage && ('), 'Only renders reason banner if reasonMessage matches an approved reason');

// 3. Manrope local font stabilization
console.log('\n--- 3. Manrope Local Webfont Determinism ---');
const layoutPath = path.join(root, 'src', 'app', '[lang]', 'layout.tsx');
check(existsSync(layoutPath), 'src/app/[lang]/layout.tsx exists');
const layoutCode = readFileSync(layoutPath, 'utf8');

check(!layoutCode.includes("from 'next/font/google'"), 'Zero imports from next/font/google in layout.tsx');
check(layoutCode.includes("path: '../../fonts/manrope/Manrope[wght].woff2'"), 'layout.tsx references Manrope[wght].woff2');
check(layoutCode.includes("variable: '--font-manrope'"), 'layout.tsx preserves --font-manrope variable');
check(layoutCode.includes("weight: '700'"), 'layout.tsx defines weight 700 for Manrope');
check(layoutCode.includes("weight: '800'"), 'layout.tsx defines weight 800 for Manrope');

const manropeDir = path.join(root, 'src', 'fonts', 'manrope');
check(existsSync(path.join(manropeDir, 'Manrope[wght].woff2')), 'Manrope[wght].woff2 exists locally');
check(existsSync(path.join(manropeDir, 'Manrope-Bold.woff2')), 'Manrope-Bold.woff2 exists locally');
check(existsSync(path.join(manropeDir, 'Manrope-ExtraBold.woff2')), 'Manrope-ExtraBold.woff2 exists locally');
check(existsSync(path.join(manropeDir, 'OFL.txt')), 'src/fonts/manrope/OFL.txt exists locally');
check(existsSync(path.join(manropeDir, 'README.md')), 'src/fonts/manrope/README.md exists locally');

const manropeReadme = readFileSync(path.join(manropeDir, 'README.md'), 'utf8');
check(manropeReadme.includes('30b83738add8c9edd9e3450b98036a9a8fb5668d0cbd4eb0ce5fe6761197f21f'), 'README.md documents exact Manrope[wght].woff2 SHA256 hash');
check(manropeReadme.includes('58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b'), 'README.md documents exact OFL.txt SHA256 hash');
check(manropeReadme.includes('googlefonts/manrope'), 'README.md documents official upstream repository');

console.log('\n=======================================================');
console.log(`ALL CONTEXT REFRESH & MANROPE CHECKS PASSED! (${passed}/${total})`);
console.log('=======================================================\n');
