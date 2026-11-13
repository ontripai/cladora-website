// Exact owner-reviewed transition; historical native evidence is never relabelled.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const hostPath = 'src/lib/core/postgres-transaction-host-v1.ts';
export function verifyReviewedCoreHostSourcePinV1(hostBytes, profileBytes) {
  assert.equal(sha(profileBytes), '09ad4bdd83cea119735ec555da3834ec290c75db263bedaa6e1fb55a5eed3682', 'EXACT_CORE_SOURCE_SUCCESSOR_PROFILE');
  const profile = JSON.parse(profileBytes);
  assert.equal(profile.reviewed_source_head, '67f17777f342c103e2588410949c0b32a104a37f');
  assert.equal(profile.native_execution_eligible, false);
  assert.equal(profile.runtime_activation, null);
  const transition = profile.historical_to_current_changes.find(p => p.path === hostPath);
  assert.ok(transition);
  assert.equal(transition.historical.source, profile.historical_App);
  assert.deepEqual(transition.current, profile.current_product_sources.find(p => p.path === hostPath));
  assert.equal(hostBytes.length, transition.current.bytes, 'REVIEWED_CORE_HOST_SOURCE_IDENTITY');
  assert.equal(sha(hostBytes), transition.current.sha256, 'REVIEWED_CORE_HOST_SOURCE_IDENTITY');
  assert.equal(createHash('sha1').update(`blob ${hostBytes.length}\0`).update(hostBytes).digest('hex'), transition.current.git_blob);
  return transition.historical.sha256;
}
