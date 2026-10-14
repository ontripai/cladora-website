import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function normalize(path) {
  return path.split(sep).join('/');
}

function listFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => normalize(relative(directory, join(entry.parentPath, entry.name))))
    .sort();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function protectedDigest(directory, paths) {
  const digest = createHash('sha256');
  for (const path of paths) {
    digest.update(`${normalize(directory)}/${path}`).update('\0')
      .update(readFileSync(join(directory, path))).update('\0');
  }
  return digest.digest('hex');
}

export function snapshotProtectedDirectory({ directory, isProtected }) {
  const paths = listFiles(directory).filter(isProtected);
  return { count: paths.length, digest: protectedDigest(directory, paths), paths };
}

export function validateProtectedDirectory({
  directory,
  expectedProtectedCount,
  expectedProtectedDigest,
  isProtected,
  reviewedAdditions,
  reviewedReplacements = {},
  historicalProtectedCount,
  historicalProtectedDigest,
  label,
}) {
  const replacementPaths = Object.keys(reviewedReplacements);
  for (const path of Object.keys(reviewedAdditions)) {
    assert.equal(isProtected(path), false,
      `${label}: reviewed addition overlaps the protected baseline: ${path}`);
    assert.equal(Object.hasOwn(reviewedReplacements, path), false,
      `${label}: path cannot be both an addition and replacement: ${path}`);
  }
  for (const path of replacementPaths) {
    assert.equal(isProtected(path), false,
      `${label}: reviewed replacement overlaps the unchanged protected baseline: ${path}`);
  }
  if (replacementPaths.length > 0) {
    assert.equal(historicalProtectedCount, expectedProtectedCount + replacementPaths.length,
      `${label}: historical protected count lineage changed`);
    assert.match(historicalProtectedDigest ?? '', /^[a-f0-9]{64}$/,
      `${label}: historical protected digest lineage missing`);
  }

  const allPaths = listFiles(directory);
  const protectedPaths = allPaths.filter(isProtected);
  assert.equal(protectedPaths.length, expectedProtectedCount,
    `${label}: protected file set changed (deletion, rename, or baseline insertion)`);
  assert.equal(protectedDigest(directory, protectedPaths), expectedProtectedDigest,
    `${label}: protected baseline names or bytes changed`);

  for (const path of replacementPaths) {
    const review = reviewedReplacements[path];
    assert.ok(allPaths.includes(path), `${label}: reviewed replacement missing: ${path}`);
    assert.match(review.historicalSha256, /^[a-f0-9]{64}$/,
      `${label}: reviewed replacement historical hash invalid: ${path}`);
    assert.match(review.sha256, /^[a-f0-9]{64}$/,
      `${label}: reviewed replacement hash invalid: ${path}`);
    assert.notEqual(review.historicalSha256, review.sha256,
      `${label}: reviewed replacement does not record a byte change: ${path}`);
    const actual = sha256(readFileSync(join(directory, path)));
    assert.ok(actual === review.historicalSha256 || actual === review.sha256,
      `${label}: reviewed replacement bytes changed: ${path} (${review.owner})`);
  }

  const additions = allPaths.filter(path => !isProtected(path)
    && !Object.hasOwn(reviewedReplacements, path));
  for (const path of additions) {
    const review = reviewedAdditions[path];
    assert.ok(review,
      `${label}: unreviewed addition: ${path}`);
    assert.equal(sha256(readFileSync(join(directory, path))), review.sha256,
      `${label}: reviewed addition bytes changed: ${path} (${review.owner})`);
  }

  return {
    protectedCount: protectedPaths.length,
    reviewedAdditionsPresent: additions.map(path => ({ path, owner: reviewedAdditions[path].owner })),
    reviewedReplacementsPresent: replacementPaths.map(path => ({
      path,
      owner: reviewedReplacements[path].owner,
      historicalSha256: reviewedReplacements[path].historicalSha256,
      sha256: reviewedReplacements[path].sha256,
      status: sha256(readFileSync(join(directory, path))) === reviewedReplacements[path].sha256
        ? 'replacement_present' : 'historical_present',
    })),
    historicalProtectedCount: replacementPaths.length > 0 ? historicalProtectedCount : undefined,
    historicalProtectedDigest: replacementPaths.length > 0 ? historicalProtectedDigest : undefined,
  };
}
