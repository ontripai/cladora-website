// Offline APP source-composition verification. No runtime/admission/installation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { validateProtectedDirectory } from './airprop-b2-safety-guard.mjs';
const CORE = '4b3138f0ff0a27187d23d8a5b058d114ddcad773';
const HISTORY = '6cecfa15b00f445be68817e756d766fb0e6fe026';
const directory = 'src/lib/core';
function git(root, ...args) { return execFileSync('git', args, { cwd: root, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
function list(root, prefix = '') {
  return readdirSync(resolve(root, directory, prefix), { withFileTypes: true }).flatMap(e => {
    assert.ok(!e.isSymbolicLink(), 'UNREVIEWED_CORE_SYMLINK');
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? list(root, path) : [path];
  }).sort();
}
export function verifyOfficialCoreDirectoryV1(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const entries = git(root, 'ls-tree', '-r', `${CORE}:${directory}`).toString().trim().split('\n').map(line => {
    const [identity, path] = line.split('\t'); return { path, blob: identity.split(' ')[2] };
  });
  const paths = options.listCurrent ? options.listCurrent() : list(root);
  assert.deepEqual([...paths].sort(), entries.map(e => e.path).sort(), 'OFFICIAL_CORE_PATH_SET');
  for (const e of entries) {
    const bytes = options.readCurrent ? options.readCurrent(e.path) : readFileSync(resolve(root, directory, e.path));
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), e.blob, 'OFFICIAL_CORE_BLOB ' + e.path);
  }
  return { owner_commit: CORE, source_tree: git(root, 'rev-parse', `${CORE}:${directory}`).toString().trim(), files: entries.length,
    source_only: true, native_execution_eligible: false, runtime: null };
}
export function validateAppCoreProtectedDirectoryV1(options) {
  assert.equal(options.directory, directory);
  const root = process.cwd(), official = verifyOfficialCoreDirectoryV1({ root });
  // Keep the original AIRPROP guard and every historical count/digest/hash.
  // Only its original source domain is materialized in a task-owned temp tree.
  const guardPath = 'scripts/lib/airprop-b2-safety-guard.mjs';
  assert.deepEqual(readFileSync(resolve(root, guardPath)), git(root, 'show', `${HISTORY}:${guardPath}`), 'ORIGINAL_B2_GUARD');
  const scratch = mkdtempSync(join(tmpdir(), 'app-core-source-history-'));
  try {
    const paths = git(root, 'ls-tree', '-r', '--name-only', `${HISTORY}:${directory}`).toString().trim().split('\n');
    for (const p of paths) { const target = join(scratch, directory, p); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, git(root, 'show', `${HISTORY}:${directory}/${p}`)); }
    process.chdir(scratch);
    const historical = validateProtectedDirectory(options);
    return { ...historical, historical_source: HISTORY, currentCoreSourceIdentity: official };
  } finally { process.chdir(root); rmSync(scratch, { recursive: true, force: true }); }
}
