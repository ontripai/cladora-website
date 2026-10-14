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
const replacementName = '20261012190924_second.sql';
const replacementBytes = 'reviewed replacement migration\n';
const replacementHash = createHash('sha256').update(replacementBytes).digest('hex');
const isProtected = path => path.slice(0, 14) <= cutoff;

function fixture({ replacement = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'airprop-b2-safety-'));
  writeFileSync(join(directory, '20261012190923_first.sql'), 'first protected migration\n');
  writeFileSync(join(directory, '20261012190924_second.sql'), 'second protected migration\n');
  const historical = snapshotProtectedDirectory({ directory, isProtected });
  const historicalReplacementHash = createHash('sha256')
    .update('second protected migration\n').digest('hex');
  const unchanged = snapshotProtectedDirectory({
    directory,
    isProtected: path => isProtected(path) && (!replacement || path !== replacementName),
  });
  const options = {
    directory,
    expectedProtectedCount: unchanged.count,
    expectedProtectedDigest: unchanged.digest,
    isProtected: path => isProtected(path) && (!replacement || path !== replacementName),
    reviewedAdditions: {
      [allowedName]: { owner: 'SERVICE', sha256: allowedHash },
    },
    ...(replacement ? {
      reviewedReplacements: {
        [replacementName]: {
          owner: 'Core', historicalSha256: historicalReplacementHash, sha256: replacementHash,
        },
      },
      historicalProtectedCount: historical.count,
      historicalProtectedDigest: historical.digest,
    } : {}),
    label: 'fixture migration baseline',
  };
  return { directory, options };
}

function run(mutator, expectation, fixtureOptions) {
  const { directory, options } = fixture(fixtureOptions);
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

run(
  directory => writeFileSync(join(directory, replacementName), replacementBytes),
  options => {
    const result = validateProtectedDirectory(options);
    assert.equal(result.protectedCount, 1);
    assert.equal(result.historicalProtectedCount, 2);
    assert.equal(result.reviewedReplacementsPresent[0].path, replacementName);
    assert.equal(result.reviewedReplacementsPresent[0].status, 'replacement_present');
  },
  { replacement: true },
);
run(
  () => {},
  options => assert.equal(
    validateProtectedDirectory(options).reviewedReplacementsPresent[0].status,
    'historical_present',
  ),
  { replacement: true },
);
run(
  directory => writeFileSync(join(directory, replacementName), 'tampered replacement\n'),
  options => assert.throws(() => validateProtectedDirectory(options),
    /reviewed replacement bytes changed/),
  { replacement: true },
);
run(
  directory => unlinkSync(join(directory, replacementName)),
  options => assert.throws(() => validateProtectedDirectory(options),
    /reviewed replacement missing/),
  { replacement: true },
);

console.log('PASS B2 safety guard: protected mutation/deletion plus reviewed replacement, addition, unknown, and tampered bytes are classified independently');
