import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readReviewedServiceShellPreimage } from './lib/app-service-shell-fixture-transition-v1.mjs';
const entry = JSON.parse(readFileSync('docs/verification/SERVICE08-COUNTRY-SIGNAL-FIXTURE-02.json')).entries[0];
const shell = entry.path, helper = 'scripts/lib/app-layout-mfa-composition.mjs';
assert.equal(readReviewedServiceShellPreimage(entry).length, 77113);
const mutations = [
  [shell, s => s.replace('layoutMfa.setupRequired', 'true')],
  [shell, s => s.replace('layoutMfa.authorizedShell', 'true')],
  [shell, s => s.replace('await verifyAppLayoutMfaComposition()', '{}')],
  [shell, s => s.replace('AppLayout queries', 'AppLayout skips')],
  [shell, s => s + '\n'],
  [helper, s => s.replace("if (!hasVerifiedFactor)", 'if (false)')],
];
for (const [path, mutate] of mutations) {
  const read = p => p === path ? Buffer.from(mutate(readFileSync(p, 'utf8'))) : readFileSync(p);
  assert.throws(() => readReviewedServiceShellPreimage(entry, read));
}
assert.throws(() => readReviewedServiceShellPreimage({ ...entry, path: 'unreviewed.mjs' }));
assert.throws(() => readReviewedServiceShellPreimage({ ...entry, sha256: '0'.repeat(64) }));
console.log('PASS exact shell preimage and eight unreviewed source/guard/helper/pin denials; native NOT_RUN');
