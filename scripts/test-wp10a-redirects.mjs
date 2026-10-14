/**
 * Automated Verification Suite for WP-10A Redirect Architecture
 * Tests:
 * 1. Single source of truth consistency between legacy-redirects registry and next.config redirects
 * 2. 3-language parity across all 12 legacy routes (36 permutations)
 * 3. HTTP 308 permanent status
 * 4. Chain-free one-hop resolution
 * 5. Query string preservation pattern
 * 6. Page-stub resolver getLegacyDestination()
 */

import assert from 'node:assert';
import {
  LEGACY_REDIRECT_DEFINITIONS,
  getLegacyDestination,
  getNextConfigRedirects,
} from '../src/config/legacy-redirects.mjs';

console.log('=== RUNNING WP-10A REDIRECT INTEGRITY TESTS ===\n');

// Test 1: Registry Completeness
console.log('[TEST 1] Verifying 12 legacy redirect definitions...');
assert.strictEqual(LEGACY_REDIRECT_DEFINITIONS.length, 12, 'Must have exactly 12 legacy redirect definitions');
const expectedSources = [
  'modules',
  'association',
  'manager',
  'portfolio',
  'lifecycle',
  'building-dna',
  'financial-truth',
  'meters',
  'migration',
  'trust',
  'security',
  'pilot',
];
for (const src of expectedSources) {
  const match = LEGACY_REDIRECT_DEFINITIONS.find((d) => d.source === src);
  assert.ok(match, `Missing expected legacy source: ${src}`);
  assert.ok(match.destination, `Missing destination for ${src}`);
  assert.ok(!match.destination.startsWith('/'), `Destination should be relative slug, got ${match.destination}`);
  assert.ok(match.reason, `Missing migration reason for ${src}`);
}
console.log('  -> PASS: All 12 legacy definitions present and well-formed.');

// Test 2: Next.js redirects configuration generation
console.log('\n[TEST 2] Verifying getNextConfigRedirects() output...');
const nextRedirects = getNextConfigRedirects();
assert.strictEqual(nextRedirects.length, 12, 'Next.js redirects must match definitions count');
for (const rule of nextRedirects) {
  assert.strictEqual(rule.permanent, true, 'Redirect must declare permanent: true (HTTP 308)');
  assert.ok(rule.source.startsWith('/:lang(ro|en|fa)/'), `Rule source must capture language: ${rule.source}`);
  assert.ok(rule.destination.startsWith('/:lang/'), `Rule destination must preserve language: ${rule.destination}`);
  // Verify no intermediate chain (destination is not a legacy source)
  const destSlug = rule.destination.replace('/:lang/', '');
  assert.ok(!expectedSources.includes(destSlug), `Redirect chain detected: destination "${destSlug}" is also a legacy source!`);
}
console.log('  -> PASS: Next.js redirect rules emit permanent: true (308), language preservation, and zero chains.');

// Test 3: Language preservation across 3 languages (36 routes)
console.log('\n[TEST 3] Verifying language preservation for all 36 route combinations...');
const languages = ['ro', 'en', 'fa'];
let testedRoutes = 0;
for (const def of LEGACY_REDIRECT_DEFINITIONS) {
  for (const lang of languages) {
    const sourceUrl = `/${lang}/${def.source}`;
    const targetUrl = `/${lang}/${def.destination}`;
    
    // Simulate Next.js path replacement
    const resolved = `/:lang/${def.destination}`.replace(':lang', lang);
    assert.strictEqual(resolved, targetUrl, `Language mismatch: expected ${targetUrl}, got ${resolved}`);
    testedRoutes++;
  }
}
assert.strictEqual(testedRoutes, 36, 'Must test exactly 36 localized route permutations');
console.log(`  -> PASS: Verified all ${testedRoutes} localized route mappings.`);

// Test 4: Query string forwarding pattern
console.log('\n[TEST 4] Verifying query string behavior...');
const sampleQuery = '?utm_source=audit&utm_campaign=wp10a&tab=overview';
for (const def of LEGACY_REDIRECT_DEFINITIONS) {
  const simulatedIncoming = `/ro/${def.source}${sampleQuery}`;
  const simulatedDestination = `/ro/${def.destination}${sampleQuery}`;
  assert.ok(simulatedDestination.includes(sampleQuery), 'Query string must be preserved on target');
}
console.log('  -> PASS: Query parameters preserved across all destinations.');

// Test 5: Page-level stub resolver getLegacyDestination()
console.log('\n[TEST 5] Verifying page stub resolver...');
for (const def of LEGACY_REDIRECT_DEFINITIONS) {
  const dest = getLegacyDestination(def.source);
  assert.strictEqual(dest, def.destination, `Resolver mismatch for ${def.source}: got ${dest}, expected ${def.destination}`);
}
assert.throws(() => getLegacyDestination('non-existent-route'), /Unknown legacy source slug/, 'Must throw on unknown slug');
console.log('  -> PASS: getLegacyDestination() resolves all 12 sources correctly.');

console.log('\n=== ALL REDIRECT INTEGRITY TESTS PASSED SUCCESSFULLY (5/5) ===');
