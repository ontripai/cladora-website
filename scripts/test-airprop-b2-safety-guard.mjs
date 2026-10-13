import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  snapshotProtectedDirectory,
  validateProtectedDirectory,
} from './lib/airprop-b2-safety-guard.mjs';

const cutoff = '20261012190924';
const allowedName = '20261013062342_service_request_subject_context_v1.sql';
const allowedBytes = 'reviewed additive migration\n';
const allowedHash = createHash('sha256').update(allowedBytes).digest('hex');
const isProtected = path => path.slice(0, 14) <= cutoff;

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'airprop-b2-safety-'));
  writeFileSync(join(directory, '20261012190923_first.sql'), 'first protected migration\n');
  writeFileSync(join(directory, '20261012190924_second.sql'), 'second protected migration\n');
  const snapshot = snapshotProtectedDirectory({ directory, isProtected });
  const options = {
    directory,
    expectedProtectedCount: snapshot.count,
    expectedProtectedDigest: snapshot.digest,
    isProtected,
    reviewedAdditions: {
      [allowedName]: { owner: 'SERVICE', sha256: allowedHash },
    },
    label: 'fixture migration baseline',
  };
  return { directory, options };
}

function run(mutator, expectation) {
  const { directory, options } = fixture();
  try {
    mutator(directory);
    expectation(options);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

run(
  directory => writeFileSync(join(directory, allowedName), allowedBytes),
  options => assert.deepEqual(validateProtectedDirectory(options).reviewedAdditionsPresent,
    [{ path: allowedName, owner: 'SERVICE' }]),
);
run(
  directory => writeFileSync(join(directory, '20261012190923_first.sql'), 'mutated\n'),
  options => assert.throws(() => validateProtectedDirectory(options),
    /protected baseline names or bytes changed/),
);
run(
  directory => unlinkSync(join(directory, '20261012190923_first.sql')),
  options => assert.throws(() => validateProtectedDirectory(options),
    /protected file set changed/),
);
run(
  directory => writeFileSync(join(directory, '20261013070000_unknown.sql'), 'unknown\n'),
  options => assert.throws(() => validateProtectedDirectory(options),
    /unreviewed addition/),
);
run(
  directory => writeFileSync(join(directory, allowedName), 'tampered\n'),
  options => assert.throws(() => validateProtectedDirectory(options),
    /reviewed addition bytes changed/),
);

console.log('PASS B2 safety guard: protected mutation/deletion and reviewed, unknown, and tampered additions are classified independently');
