// Reconcile four exact published owner files with unchanged benefit inventories.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export const APP_CE_GUIDE_TRANSITION_PATHS = Object.freeze([
  'src/app/[lang]/app/experience/guides/page.tsx',
  'src/components/customer/CustomerCommunityBasePage.tsx',
  'src/components/customer/CustomerExperienceGuide.tsx',
  'src/components/customer/CustomerExperienceGuidePage.tsx',
]);
const sha = b => createHash('sha256').update(b).digest('hex');
const identity = b => ({ bytes: b.length, sha256: sha(b), git_blob: createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex') });
export function verifyPublishedCeGuideSourceTransitionV1(root, path, predecessorSha, current, options = {}) {
  const raw = options.profileBytes ?? readFileSync(resolve(root, 'docs/app/published-source-consolidation-01/ce-guide-source-transition.json'));
  assert.equal(sha(raw), '336a64d734f6800a63db0c70b3c2497540d364fb8c5f5f22c6e61512ffaad7d0', 'EXACT_PUBLISHED_CE_SOURCE_PROFILE');
  const profile = JSON.parse(raw);
  assert.equal(profile.contract, 'app.published-ce-guide-source-transition.v1');
  assert.equal(profile.before_source, '6cecfa15b00f445be68817e756d766fb0e6fe026');
  assert.equal(profile.qa, 'PENDING_INDEPENDENT_REVIEW');
  assert.equal(profile.native_execution_eligible, false); assert.equal(profile.runtime, null);
  assert.deepEqual(profile.files.map(p => p.path).sort(), [...APP_CE_GUIDE_TRANSITION_PATHS].sort());
  const pin = profile.files.find(p => p.path === path); assert.ok(pin, 'UNREVIEWED_CE_SOURCE_PATH');
  const owner = path === 'src/components/customer/CustomerCommunityBasePage.tsx'
    ? 'c32002bbf93f0dd9b8c5a2097a2afea7503ef3d4' : '7d5ec54a4718bdac600b6a668453d51818f22a4e';
  assert.equal(pin.source_commit, owner);
  assert.equal(pin.before.sha256, predecessorSha, 'HISTORICAL_CE_PREDECESSOR');
  const git = ref => execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.deepEqual(identity(git(profile.before_source)), pin.before);
  const published = git(owner); assert.deepEqual(identity(published), pin.after);
  assert.deepEqual(current, published, 'CURRENT_CE_OWNER_SOURCE_DRIFT');
  return true;
}
