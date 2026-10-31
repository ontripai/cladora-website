/** Contact v2 and fixed BASE pilot vectors. Pure local tests; no DB/notifier. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--isolated')) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--isolated'], {
    encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test', LEAD_IP_HASH_SECRET: 'contact-fingerprint-fixed-vector-test-secret' },
  });
  if (r.error) throw r.error;
  process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status ?? 1);
}
const { computeContactSubmissionFingerprint: contact, CONTACT_FINGERPRINT_VERSION } = await import('../src/lib/security/contact-fingerprint.ts');
const { computeSubmissionFingerprint: legacy, FINGERPRINT_WINDOW_MINUTES } = await import('../src/lib/security/fingerprint.ts');
const payload = {
  fullName: 'Fixture Contact', email: 'TEST@EXAMPLE.INVALID', phone: ' +40(700).000-001 ',
  message: 'Full validated message after character sixty: ' + 'abc'.repeat(30), locale: 'en',
  role: 'owner_single', services: ['operations', 'community_experience'], unitsCount: '2',
};
const fp = p => contact(p, 42).fingerprint;
const tests = [];
function test(name, fn) { fn(); tests.push(name); }
const pilotVectors = [
  [{ leadType: 'pilot', normalizedEmail: ' PILOT@example.invalid ', normalizedPhone: '+40 (700) 000-001', messageSnippet: '  Synthetic pilot request  ' }, 42, '142fc70e90f9b3ee77cb02f7979f22a5484e793bcaf1da846eb630607cf4b75d'],
  [{ leadType: 'pilot', normalizedEmail: 'pilot@example.invalid' }, 0, 'e1543ba08c561f49256553a6d8d0340c6b54a7738981dcfcc8fa8ef899a6825f'],
  [{ leadType: 'pilot', normalizedEmail: 'FA@example.invalid', normalizedPhone: '', messageSnippet: 'A'.repeat(60) + 'ignored tail' }, 1999999, 'd40de3045d1e881fab6cd2856d21c27a16c2894e7154dc4baf9a45762d79edf0'],
  [{ leadType: 'pilot', normalizedEmail: 'fa@example.invalid', normalizedPhone: ' +40.7-0(0) ', messageSnippet: 'نمونهٔ مصنوعی Pilot only' }, 631140, '01fc739fb731d856dc0a3d0cb820b3c0e1a81d559b519c93c0fe9ed123d67d09'],
];
test('shared/pilot source byte identity from exact BASE', () => {
  assert.equal(createHash('sha256').update(readFileSync(new URL('../src/lib/security/fingerprint.ts', import.meta.url))).digest('hex'), 'b043bb8813ef4b448e6a866f1d9dccf0495d5c29a9e8ec8f654ad9080681d43f');
});
for (const [p, bucket, fingerprint] of pilotVectors) test(`BASE pilot fixed vector bucket${bucket}`, () => assert.deepEqual(legacy(p, bucket), { fingerprint, bucket }));
test('pilot tail/case/email/phone behavior remains legacy-compatible', () => {
  assert.equal(legacy({ leadType: 'pilot', normalizedEmail: ' A@example.invalid ', normalizedPhone: '+40 (7)-0.0', messageSnippet: 'A'.repeat(60) + 'FIRST' }, 42).fingerprint,
    legacy({ leadType: 'pilot', normalizedEmail: 'a@example.invalid', normalizedPhone: '+40700', messageSnippet: 'a'.repeat(60) + 'SECOND' }, 42).fingerprint);
});
test('contact fixed literal tuple golden (independently computed with Python HMAC)', () => {
  assert.equal(CONTACT_FINGERPRINT_VERSION, 'cladora.contact.intent.v2');
  assert.deepEqual(contact(payload, 42), { fingerprint: 'e1ea14e7725c931aa82158fa70193e287ae6bfb700e0eb692deacb69a1b9dc95', bucket: 42 });
});
test('property order and original object are unchanged', () => {
  const before = structuredClone(payload);
  assert.equal(fp(payload), fp(Object.fromEntries(Object.entries(payload).reverse())));
  assert.deepEqual(payload, before);
});
test('service set order, duplicates, whitespace and empty IDs', () => {
  assert.equal(fp(payload), fp({ ...payload, services: ['', ' community_experience ', 'operations', 'operations'] }));
  assert.notEqual(fp(payload), fp({ ...payload, services: ['community_experience'] }));
  assert.notEqual(fp(payload), fp({ ...payload, services: ['Operations', 'community_experience'] }));
});
test('absent null empty optional equivalence', () => {
  const keys = ['phone', 'role', 'propertyType', 'portfolioScope', 'stage', 'workspaceStatus', 'city', 'unitsCount', 'services'];
  const absent = { ...payload }; for (const key of keys) delete absent[key];
  for (const value of [null, undefined, '']) {
    const p = { ...absent, ...Object.fromEntries(keys.map(key => [key, key === 'services' ? value === '' ? [] : value : value])) };
    assert.equal(fp(p), fp(absent));
  }
  assert.equal(fp({ ...absent, phone: ' -( ). ', services: ['', ' '] }), fp(absent));
});
test('email and phone normalization preserved, trim follows validated schema', () => {
  assert.equal(fp(payload), fp({ ...payload, email: ' test@example.invalid ', phone: '+40 700 000 001', fullName: ' Fixture Contact ', message: ' ' + payload.message + ' ' }));
});
for (const [key, value] of Object.entries({
  fullName: 'Changed Fixture', email: 'other@example.invalid', phone: '+40700000002', message: payload.message + 'tail',
  locale: 'ro', role: 'owner_portfolio', propertyType: 'commercial', portfolioScope: 'portfolio', stage: 'planning',
  workspaceStatus: 'existing', city: 'Changed Fixture City', unitsCount: '3',
})) test(`business field ${key} is part of identity`, () => assert.notEqual(fp(payload), fp({ ...payload, [key]: value })));
test('message case, internal whitespace, Unicode and last allowed character are preserved', () => {
  for (const message of [payload.message.toLowerCase(), payload.message.replace('validated message', 'validated  message'), payload.message + 'متن']) assert.notEqual(fp(payload), fp({ ...payload, message }));
  assert.notEqual(fp({ ...payload, message: 'x'.repeat(4999) + 'A' }), fp({ ...payload, message: 'x'.repeat(4999) + 'B' }));
});
test('fixed tuple prevents delimiter or field-boundary ambiguity', () => {
  assert.notEqual(fp({ ...payload, role: 'a::b', propertyType: 'c' }), fp({ ...payload, role: 'a', propertyType: 'b::c' }));
});
test('only projected business fields, never raw object serialization', () => {
  const input = { ...payload, sourcePage: '/other', utm_source: 'fixture', turnstileToken: 'synthetic-token', toJSON() { throw Error('raw payload serialized'); } };
  assert.equal(fp(payload), fp(input));
});
test('same algorithm same bucket dedupes; legacy/new same-bucket compatibility is NOT claimed', () => {
  const old = legacy({ leadType: 'contact', normalizedEmail: payload.email, normalizedPhone: payload.phone, messageSnippet: payload.message }, 42);
  assert.notEqual(old.fingerprint, fp(payload));
  assert.deepEqual(contact(payload, 42), contact(payload, 42));
});
test('unchanged fixed UTC900-second boundaries, including explicit bucket0', () => {
  assert.equal(FINGERPRINT_WINDOW_MINUTES * 60, 900);
  const original = Date.now;
  try {
    Date.now = () => 899999; assert.deepEqual(contact(payload), contact(payload, 0));
    Date.now = () => 900000; assert.deepEqual(contact(payload), contact(payload, 1));
    assert.notEqual(contact(payload, 0).fingerprint, contact(payload, 1).fingerprint);
  } finally { Date.now = original; }
});
test('production secret guard retained; no fallback or secret in output', () => {
  const original = process.env.LEAD_IP_HASH_SECRET;
  try {
    process.env.NODE_ENV = 'production'; process.env.LEAD_IP_HASH_SECRET = 'short-fixture';
    assert.throws(() => contact(payload), /SECURITY_CONFIG_ERROR/);
    delete process.env.LEAD_IP_HASH_SECRET; assert.throws(() => contact(payload), /SECURITY_CONFIG_ERROR/);
  } finally { process.env.NODE_ENV = 'test'; process.env.LEAD_IP_HASH_SECRET = original; }
  assert.deepEqual(Object.keys(contact(payload)).sort(), ['bucket', 'fingerprint']);
});
console.log(JSON.stringify({ task: 'CORE-CONTACT-FINGERPRINT-02', result: 'PASS', checks: tests.length, pilotFixedVectors: pilotVectors.length, cases: tests, nativeDB: 'NOT_RUN_NOT_PASS' }, null, 2));
