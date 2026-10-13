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
  label,
}) {
  for (const path of Object.keys(reviewedAdditions)) {
    assert.equal(isProtected(path), false,
      `${label}: reviewed addition overlaps the protected baseline: ${path}`);
  }

  const allPaths = listFiles(directory);
  const protectedPaths = allPaths.filter(isProtected);
  assert.equal(protectedPaths.length, expectedProtectedCount,
    `${label}: protected file set changed (deletion, rename, or baseline insertion)`);
  assert.equal(protectedDigest(directory, protectedPaths), expectedProtectedDigest,
    `${label}: protected baseline names or bytes changed`);

  const additions = allPaths.filter(path => !isProtected(path));
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
  };
}
