// Reconcile the immutable Checklist packet with the approved, separately versioned
// root engine metadata transition. Never re-seal the historical packet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  const git = spec => execFileSync('git', ['show', spec], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
  const before = git(`${record.before_commit}:${pin.path}`), approved = git(`${record.approved_commit}:${pin.path}`);
  assert.deepEqual(identity(before), { bytes: packetPin.bytes, sha256: packetPin.sha256 });
  assert.deepEqual(identity(before), pin.before);
  assert.deepEqual(identity(approved), pin.after);
  assert.equal(execFileSync('git', ['rev-parse', `${record.before_commit}:${pin.path}`], { cwd: root, encoding: 'utf8' }).trim(), packetPin.git_blob);
  verifyEngineMetadataOnly(pin.path, before, approved);
  verifyEngineMetadataOnly(pin.path, before, readFileSync(path.join(root, pin.path)));
  return true;
}
