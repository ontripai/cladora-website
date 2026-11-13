// Reconcile the immutable Checklist packet with the approved, separately versioned
// root engine metadata transition. Never re-seal the historical packet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
export function verifyEngineMetadataOnly(file, before, after) {
  assert.ok(['package.json', 'package-lock.json'].includes(file));
  const original = JSON.parse(before), expected = structuredClone(original);
  const root = file === 'package.json' ? expected : expected.packages[''];
  assert.equal(root.engines.node, '>=22.0.0');
  root.engines.node = '22.x || 24.x';
  assert.deepEqual(JSON.parse(after), expected, 'only the root engines.node selector may change');
  assert.equal(after.toString(), before.toString().replace('"node": ">=22.0.0"', '"node": "22.x || 24.x"'), 'all other bytes must remain identical');
}
export function verifyPublishedEngineTransition(root, packetPin) {
  const record = JSON.parse(readFileSync(path.join(root, 'docs/app/published-source-consolidation-01/engine-source-transition.json')));
  assert.equal(record.format, 'APP_ROOT_ENGINE_SOURCE_TRANSITION_V1');
  assert.deepEqual(record.files.map(f => f.path).sort(), ['package-lock.json', 'package.json']);
  const pin = record.files.find(f => f.path === packetPin.path);
  assert.ok(pin, 'transition must name an approved package path');
  // CI checkouts may be shallow. Restore only the authorized literal, then
  // authenticate that entire preimage against the unchanged historical packet.
  // This is not a fallback accepting unpinned bytes or a new dependency snapshot.
  const approved = readFileSync(path.join(root, pin.path));
  const before = Buffer.from(approved.toString().replace('"node": "22.x || 24.x"', '"node": ">=22.0.0"'));
  assert.deepEqual(identity(before), { bytes: packetPin.bytes, sha256: packetPin.sha256 });
  assert.deepEqual(identity(before), pin.before);
  const blob = createHash('sha1').update(`blob ${before.length}\0`).update(before).digest('hex');
  assert.equal(blob, packetPin.git_blob, 'restored preimage must be the original Git blob');
  assert.deepEqual(identity(approved), pin.after);
  verifyEngineMetadataOnly(pin.path, before, approved);
  return true;
}
