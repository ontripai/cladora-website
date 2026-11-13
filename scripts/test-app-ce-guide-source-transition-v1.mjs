import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CE_GUIDE_TRANSITION_PATHS, verifyPublishedCeGuideSourceTransitionV1 } from './lib/app-ce-guide-source-transition-v1.mjs';
const root = process.cwd(), raw = readFileSync('docs/app/published-source-consolidation-01/ce-guide-source-transition.json'), profile = JSON.parse(raw);
for (const path of APP_CE_GUIDE_TRANSITION_PATHS) {
  const before = profile.files.find(p => p.path === path).before.sha256, actual = readFileSync(path);
  assert.equal(verifyPublishedCeGuideSourceTransitionV1(root, path, before, actual), true);
  const changed = Buffer.from(actual); changed[changed.length - 2] ^= 1;
  assert.throws(() => verifyPublishedCeGuideSourceTransitionV1(root, path, before, changed), /CURRENT_CE_OWNER_SOURCE_DRIFT/);
  assert.throws(() => verifyPublishedCeGuideSourceTransitionV1(root, path, '0'.repeat(64), actual), /HISTORICAL_CE_PREDECESSOR/);
}
assert.throws(() => verifyPublishedCeGuideSourceTransitionV1(root, 'unreviewed.ts', '', Buffer.alloc(0)), /UNREVIEWED_CE_SOURCE_PATH/);
const mutation = JSON.parse(raw); mutation.native_execution_eligible = true;
assert.throws(() => verifyPublishedCeGuideSourceTransitionV1(root, APP_CE_GUIDE_TRANSITION_PATHS[0], '', Buffer.alloc(0), { profileBytes: Buffer.from(JSON.stringify(mutation)) }), /EXACT_PUBLISHED_CE_SOURCE_PROFILE/);
console.log('PASS published CE source transition: four exact owner identities and ten predecessor/byte/extra/native negatives; QA/native remain open');
