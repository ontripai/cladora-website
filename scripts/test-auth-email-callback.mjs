import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTH_EMAIL_TYPES,
  hasDuplicateCallbackParameters,
  hasForbiddenAuthQuery,
  hasUnexpectedCallbackQuery,
  isSupportedAuthEmailType,
  isSupportedLocale,
  mapOtpErrorStatus,
  parseCallbackContract,
  resolveAuthEmailDestination,
  resolvePkceDestination,
} from '../src/lib/auth/email-callback.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const callback = read('src/app/[lang]/auth/callback/route.ts');
const resultPage = read('src/app/[lang]/auth-result/page.tsx');
const proxy = read('src/proxy.ts');

assert.deepEqual(AUTH_EMAIL_TYPES, [
  'email',
  'invite',
  'magiclink',
  'recovery',
  'signup',
  'email_change',
]);
assert.equal(isSupportedLocale('ro'), true);
assert.equal(isSupportedLocale('en'), true);
assert.equal(isSupportedLocale('fa'), true);
assert.equal(isSupportedLocale('de'), false);
assert.equal(isSupportedAuthEmailType('invite'), true);
assert.equal(isSupportedAuthEmailType('recovery'), true);
assert.equal(isSupportedAuthEmailType('unknown'), false);

assert.equal(resolveAuthEmailDestination('ro', 'invite', null), '/ro/invitation-continuation');
assert.equal(resolveAuthEmailDestination('en', 'recovery', null), '/en/reset-password');
assert.equal(resolveAuthEmailDestination('fa', 'magiclink', null), '/fa/app/dashboard');
assert.equal(resolveAuthEmailDestination('en', 'signup', '/en/app/dashboard'), '/en/app/dashboard');
assert.equal(resolveAuthEmailDestination('fa', 'email_change', '/fa/app/settings'), '/fa/app/settings');

// PKCE destination resolution
assert.equal(resolvePkceDestination('fa', '/fa/reset-password'), '/fa/reset-password');
assert.equal(resolvePkceDestination('en', '/en/reset-password'), '/en/reset-password');
assert.equal(resolvePkceDestination('ro', '/ro/app/dashboard'), '/ro/app/dashboard');
assert.equal(resolvePkceDestination('fa', null), '/fa/app/dashboard');
assert.equal(resolvePkceDestination('fa', 'https://attacker.example/steal'), null);
assert.equal(resolvePkceDestination('ro', '//attacker.example/steal'), null);

for (const unsafeNext of [
  'https://attacker.example/steal',
  '//attacker.example/steal',
  '/en/reset-password?access_token=secret',
  '/en/reset-password#access_token=secret',
  '/fa/app/dashboard?refresh_token=secret',
  '/ro/app/dashboard/../platform/overview',
]) {
  assert.equal(resolveAuthEmailDestination('en', 'recovery', unsafeNext), null);
  assert.equal(resolvePkceDestination('en', unsafeNext), null);
}
assert.equal(resolveAuthEmailDestination('de', 'recovery', null), null);
assert.equal(resolveAuthEmailDestination('en', 'invite', '/en/app/dashboard'), null);
assert.equal(resolveAuthEmailDestination('en', 'invite', '/en/invitation-continuation'), '/en/invitation-continuation');
assert.equal(resolveAuthEmailDestination('en', 'invite', '/en/invitation-continuation?workspace=unsafe'), null);

for (const key of [
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'session',
  'session_id',
  'token',
  'ACCESS_TOKEN',
]) {
  assert.equal(hasForbiddenAuthQuery(new URLSearchParams([[key, 'redacted']])), true);
}
assert.equal(
  hasForbiddenAuthQuery(new URLSearchParams({ token_hash: 'one-time-hash', type: 'recovery' })),
  false,
);
assert.equal(
  hasForbiddenAuthQuery(new URLSearchParams({ code: 'valid-pkce-code-longer-than-16', next: '/fa/reset-password' })),
  false,
);

// Duplicate parameters
assert.equal(
  hasDuplicateCallbackParameters(new URLSearchParams('token_hash=a&token_hash=b&type=recovery')),
  true,
);
assert.equal(
  hasDuplicateCallbackParameters(new URLSearchParams('code=a&code=b')),
  true,
);
assert.equal(
  hasDuplicateCallbackParameters(new URLSearchParams('code=valid-pkce-code-longer-than-16&next=/fa/reset-password')),
  false,
);

// Contract parsing tests: mutual exclusivity & strict bounds
// 1. Valid PKCE contract
const validPkce = parseCallbackContract(
  new URLSearchParams('code=1234567890abcdef1234567890&next=/fa/reset-password')
);
assert.equal(validPkce.valid, true);
assert.equal(validPkce.kind, 'pkce');
assert.equal(validPkce.code, '1234567890abcdef1234567890');
assert.equal(validPkce.next, '/fa/reset-password');

// 2. Valid OTP contract
const validOtp = parseCallbackContract(
  new URLSearchParams('token_hash=1234567890abcdef1234567890&type=recovery&next=/fa/reset-password')
);
assert.equal(validOtp.valid, true);
assert.equal(validOtp.kind, 'otp');
assert.equal(validOtp.tokenHash, '1234567890abcdef1234567890');
assert.equal(validOtp.type, 'recovery');

// 3. Rejection of ambiguous code + token_hash
const ambiguous = parseCallbackContract(
  new URLSearchParams('code=1234567890abcdef1234567890&token_hash=1234567890abcdef1234567890')
);
assert.equal(ambiguous.valid, false);
assert.equal(ambiguous.reason, 'unsafe');

// 4. Rejection of ambiguous code + type
const ambiguousType = parseCallbackContract(
  new URLSearchParams('code=1234567890abcdef1234567890&type=recovery')
);
assert.equal(ambiguousType.valid, false);
assert.equal(ambiguousType.reason, 'unsafe');

// 5. Rejection of empty/short/whitespace code
assert.equal(parseCallbackContract(new URLSearchParams('code=short')).valid, false);
assert.equal(parseCallbackContract(new URLSearchParams('code=with space 1234567890abcdef')).valid, false);
assert.equal(parseCallbackContract(new URLSearchParams('code=')).valid, false);

// 6. Unexpected query keys
assert.equal(hasUnexpectedCallbackQuery(new URLSearchParams('code=1234567890abcdef1234567890&foo=bar')), true);
assert.equal(hasUnexpectedCallbackQuery(new URLSearchParams('token_hash=1234567890abcdef1234567890&type=recovery&foo=bar')), true);
assert.equal(hasUnexpectedCallbackQuery(new URLSearchParams('code=1234567890abcdef1234567890&next=/fa/reset-password')), false);
assert.equal(hasUnexpectedCallbackQuery(new URLSearchParams('token_hash=1234567890abcdef1234567890&type=recovery&next=/fa/reset-password')), false);

assert.equal(mapOtpErrorStatus('otp_expired'), 'expired');
assert.equal(mapOtpErrorStatus('unexpected_failure'), 'invalid');

// Route code contract assertions
assert.match(callback, /auth\.verifyOtp\(\{/);
assert.match(callback, /auth\.exchangeCodeForSession\(/);
assert.doesNotMatch(callback, /window\.location\.hash|location\.hash/);
assert.doesNotMatch(callback, /console\.(log|error|warn|info)/);
assert.match(callback, /'Referrer-Policy': 'no-referrer'/);
assert.match(callback, /'X-Robots-Tag': 'noindex, nofollow, noarchive'/);
assert.match(callback, /createRecoverySessionToken/);
assert.doesNotMatch(resultPage, /access_token|refresh_token|token_hash/);
assert.match(resultPage, /'confirmed'/);
assert.match(resultPage, /'expired'/);
assert.match(resultPage, /'reused'/);
assert.match(resultPage, /'missing'/);
assert.doesNotMatch(proxy, /auth\/callback.*matcher/);

console.log('Secure Auth email callback: policy, locale, PKCE, OTP, and containment tests passed.');
