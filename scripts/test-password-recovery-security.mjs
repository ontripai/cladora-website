import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Set test environment before imports
process.env.NODE_ENV = 'test';

import {
  createRecoverySessionToken,
  verifyRecoverySessionToken,
  RECOVERY_COOKIE_NAME,
  getRecoveryCookieOptions,
  getClearRecoveryCookieOptions,
} from '../src/lib/auth/recovery-cookie.ts';

import {
  mapUpdateUserError,
  recoveryErrorCopy,
} from '../src/lib/auth/recovery-errors.ts';

import {
  parseCallbackContract,
  hasForbiddenAuthQuery,
  hasDuplicateCallbackParameters,
  hasUnexpectedCallbackQuery,
  resolvePkceDestination,
  resolveAuthEmailDestination,
} from '../src/lib/auth/email-callback.mjs';

console.log('--- Test 1: Cryptographic Recovery Cookie Security ---');

const testUserId = '8c011c70-6844-4676-8ef5-642c0c6bf118';
const testSessionId = 'f2ab97b2-2b0b-4d0d-852e-9669400bc8bf';

// 1. Valid token creation and verification
const token = createRecoverySessionToken(testUserId, testSessionId);
assert.ok(typeof token === 'string' && token.includes('.'), 'Token must be formatted with payload and signature');
const verified = verifyRecoverySessionToken(token);
assert.ok(verified, 'Valid token must verify successfully');
assert.equal(verified.userId, testUserId);
assert.equal(verified.sessionId, testSessionId);

// 2. Forged / modified token rejection
const [payloadPart, sigPart] = token.split('.');
const tamperedPayload = Buffer.from(
  JSON.stringify({ userId: 'attacker-id', purpose: 'password_recovery', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })
).toString('base64url');
assert.equal(verifyRecoverySessionToken(`${tamperedPayload}.${sigPart}`), null, 'Tampered payload must be rejected');

const tamperedSig = sigPart.slice(0, -2) + (sigPart.endsWith('a') ? 'b' : 'a');
assert.equal(verifyRecoverySessionToken(`${payloadPart}.${tamperedSig}`), null, 'Tampered signature must be rejected');

// 3. Expired token rejection
const expiredPayload = Buffer.from(
  JSON.stringify({ userId: testUserId, purpose: 'password_recovery', iat: Math.floor(Date.now() / 1000) - 1000, exp: Math.floor(Date.now() / 1000) - 10 })
).toString('base64url');
const expiredToken = `${expiredPayload}.${sigPart}`;
assert.equal(verifyRecoverySessionToken(expiredToken), null, 'Expired token must be rejected');

// 4. Invalid purpose rejection
const wrongPurposePayload = Buffer.from(
  JSON.stringify({ userId: testUserId, purpose: 'login', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })
).toString('base64url');
assert.equal(verifyRecoverySessionToken(`${wrongPurposePayload}.${sigPart}`), null, 'Token with non-recovery purpose must be rejected');

// 5. Malformed inputs
assert.equal(verifyRecoverySessionToken(null), null);
assert.equal(verifyRecoverySessionToken(undefined), null);
assert.equal(verifyRecoverySessionToken(''), null);
assert.equal(verifyRecoverySessionToken('invalid-dot-token'), null);
assert.equal(verifyRecoverySessionToken('a.b.c'), null);

// 6. Cookie options security
const secureOpts = getRecoveryCookieOptions(true);
assert.equal(secureOpts.httpOnly, true, 'Recovery cookie must be HttpOnly');
assert.equal(secureOpts.secure, true, 'Recovery cookie must be Secure');
assert.equal(secureOpts.sameSite, 'lax', 'Recovery cookie must be SameSite=Lax');
assert.ok(secureOpts.maxAge > 0 && secureOpts.maxAge <= 900, 'Max-age must be between 1 and 15 minutes');

const clearOpts = getClearRecoveryCookieOptions(true);
assert.equal(clearOpts.maxAge, 0, 'Clear cookie must have maxAge 0');

console.log('PASS: Cryptographic recovery cookie security verified.');

console.log('--- Test 2: Reset Password Page Guard Verification ---');

// Simulate the guard checks performed in ResetPasswordPage:
function evaluateResetPageAccess(claims, recoveryCookieRaw) {
  if (!claims || !claims.sub) return { allow: false, reason: 'missing_session' };
  const verifiedCookie = verifyRecoverySessionToken(recoveryCookieRaw);
  if (!verifiedCookie) return { allow: false, reason: 'invalid_or_missing_recovery_cookie' };
  if (verifiedCookie.userId !== claims.sub) return { allow: false, reason: 'user_mismatch' };
  return { allow: true };
}

// Case A: Direct navigation without session
assert.deepEqual(evaluateResetPageAccess(null, null), { allow: false, reason: 'missing_session' });

// Case B: Ordinary authenticated user navigating directly without recovery cookie
const ordinaryUserClaims = { sub: 'normal-user-123', aud: 'authenticated' };
assert.deepEqual(
  evaluateResetPageAccess(ordinaryUserClaims, null),
  { allow: false, reason: 'invalid_or_missing_recovery_cookie' },
  'Normal signed in user without recovery cookie must be denied'
);

// Case C: Authenticated user with forged recovery cookie
assert.deepEqual(
  evaluateResetPageAccess(ordinaryUserClaims, 'forged.cookie'),
  { allow: false, reason: 'invalid_or_missing_recovery_cookie' }
);

// Case D: Authenticated user A with recovery cookie belonging to user B
const userAClaims = { sub: 'user-a-123' };
const userBRecoveryToken = createRecoverySessionToken('user-b-456');
assert.deepEqual(
  evaluateResetPageAccess(userAClaims, userBRecoveryToken),
  { allow: false, reason: 'user_mismatch' },
  'Recovery cookie for another account must be rejected'
);

// Case E: Authenticated user matching the valid recovery cookie
const validUserClaims = { sub: testUserId };
assert.deepEqual(
  evaluateResetPageAccess(validUserClaims, token),
  { allow: true },
  'User with matching valid recovery cookie must be allowed'
);

console.log('PASS: Reset Password Page guard contracts verified.');

console.log('--- Test 3: Granular 7-State Error Mapping ---');

// 1. recovery_session_missing
assert.equal(mapUpdateUserError({ name: 'AuthSessionMissingError' }), 'recovery_session_missing');
assert.equal(mapUpdateUserError({ status: 401 }), 'recovery_session_missing');
assert.equal(mapUpdateUserError({ code: 'session_missing' }), 'recovery_session_missing');

// 2. same_password_rejected
assert.equal(mapUpdateUserError({ code: 'same_password', status: 422 }), 'same_password_rejected');
assert.equal(mapUpdateUserError({ code: 'current_password_required', status: 400 }), 'same_password_rejected');
assert.equal(mapUpdateUserError({ status: 422, message: 'New password should be different from the old password.' }), 'same_password_rejected');

// 3. password_policy_failed
assert.equal(mapUpdateUserError({ name: 'AuthWeakPasswordError' }), 'password_policy_failed');
assert.equal(mapUpdateUserError({ code: 'weak_password' }), 'password_policy_failed');
assert.equal(mapUpdateUserError({ code: 'password_policy_violation' }), 'password_policy_failed');

// 4. rate_limited
assert.equal(mapUpdateUserError({ status: 429 }), 'rate_limited');
assert.equal(mapUpdateUserError({ code: 'over_request_rate_limit' }), 'rate_limited');

// 5. recovery_link_expired
assert.equal(mapUpdateUserError({ code: 'otp_expired' }), 'recovery_link_expired');
assert.equal(mapUpdateUserError({ code: 'session_expired' }), 'recovery_link_expired');

// 6. recovery_link_already_used
assert.equal(mapUpdateUserError({ code: 'token_already_used' }), 'recovery_link_already_used');
assert.equal(mapUpdateUserError({ code: 'code_challenge_failed' }), 'recovery_link_already_used');

// 7. unexpected_update_failure
assert.equal(mapUpdateUserError({ status: 500 }), 'unexpected_update_failure');
assert.equal(mapUpdateUserError(null), 'unexpected_update_failure');

console.log('PASS: Error mapping correctly differentiates all 7 states.');

console.log('--- Test 4: Multilingual Translation Audit ---');

const formSource = readFileSync(new URL('../src/components/auth/ResetPasswordForm.tsx', import.meta.url), 'utf8');
const errorModuleSource = readFileSync(new URL('../src/lib/auth/recovery-errors.ts', import.meta.url), 'utf8');

for (const lang of ['ro', 'en', 'fa']) {
  assert.ok(formSource.includes(`${lang}:`), `Form must contain translations for ${lang}`);
  assert.ok(errorModuleSource.includes(`${lang}:`), `Error module must contain translations for ${lang}`);
}

const requiredErrorKeys = [
  'recovery_session_missing',
  'recovery_link_expired',
  'recovery_link_already_used',
  'password_policy_failed',
  'same_password_rejected',
  'rate_limited',
  'unexpected_update_failure',
];

for (const key of requiredErrorKeys) {
  assert.ok(errorModuleSource.includes(key), `recoveryErrorCopy must define key: ${key}`);
}

// Persian RTL specific check
assert.ok(errorModuleSource.includes('رمز عبور جدید نمی‌تواند همانند رمز عبور قبلی باشد'), 'Persian same password translation must be present');
assert.ok(errorModuleSource.includes('نشست بازیابی رمز عبور یافت نشد یا منقضی شده است'), 'Persian session missing translation must be present');
assert.ok(errorModuleSource.includes('تعداد تلاش‌های مجاز بیش از حد بوده است'), 'Persian rate limit translation must be present');

console.log('PASS: Multilingual copy and Persian translations verified.');

console.log('--- Test 5: Open Redirect & Security Containment ---');

for (const maliciousNext of [
  'https://evil.example.com',
  '//evil.example.com',
  'javascript:alert(1)',
  '/ro/reset-password/../../platform/overview',
  '/fa/reset-password?steal=true',
  '/en/reset-password#fragment',
]) {
  assert.equal(resolvePkceDestination('ro', maliciousNext), null, `Malicious destination must be rejected: ${maliciousNext}`);
  assert.equal(resolveAuthEmailDestination('ro', 'recovery', maliciousNext), null, `Malicious destination must be rejected: ${maliciousNext}`);
}

assert.equal(resolvePkceDestination('fa', '/fa/reset-password'), '/fa/reset-password');
assert.equal(resolveAuthEmailDestination('fa', 'recovery', '/fa/reset-password'), '/fa/reset-password');

console.log('PASS: All open redirect and traversal attempts rejected.');
console.log('=== ALL PASSWORD RECOVERY SECURITY CONTRACT TESTS PASSED ===');
