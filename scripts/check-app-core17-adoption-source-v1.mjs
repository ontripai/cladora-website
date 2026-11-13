// APP CI source composition only. Original Core checker/admission/native gates
// remain untouched; historical evidence is not an admission for the successor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE17_CONSUMER_PROTECTED_SOURCES } from './lib/core17-exact-consumer-admission-v1.mjs';
import { verifyEngineMetadataOnly } from './lib/app-engine-source-transition.mjs';
const HISTORY = '6cecfa15b00f445be68817e756d766fb0e6fe026';
const manifestPath = 'docs/verification/CORE17-POST-AUTH-CONSUMER-ADOPTION-01.json';
const checkerPath = 'scripts/check-core17-post-auth-consumer-adoption.mjs';
const profilePath = 'scripts/core17-native-source-successor-v1/source-successor.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function verifyAppCore17AdoptionSourceV1(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const current = options.readCurrent ?? (p => readFileSync(resolve(root, p)));
  const historical = options.readHistorical ?? (p => execFileSync('git', ['show', `${HISTORY}:${p}`], { cwd: root, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  const manifestRaw = current(manifestPath);
  assert.equal(sha(manifestRaw), '4ae178aeba90b5e93b1cef5608ef6b893a21461e916ef06719b233edb6d6e160', 'ORIGINAL_ADOPTION_MANIFEST');
  const manifest = JSON.parse(manifestRaw), checkerRaw = current(checkerPath);
  assert.equal(sha(checkerRaw), manifest.changed_paths.find(p => p.path === checkerPath).after.sha256, 'ORIGINAL_ADOPTION_CHECKER');
  const source = checkerRaw.toString(), start = source.indexOf('function validate(m){'), end = source.indexOf('\nassert.equal(validate(manifest),true);');
  assert.ok(start >= 0 && end > start);
  // Run the complete original validator body in its original, exact Git context.
  const validateHistory = new Function('assert', 'readFileSync', 'sha', 'CORE17_CONSUMER_PROTECTED_SOURCES', source.slice(start, end) + '\nreturn validate;')(
    assert, historical, sha, CORE17_CONSUMER_PROTECTED_SOURCES);
  assert.equal(validateHistory(manifest), true);
  for (const p of manifest.changed_paths) {
    const actual = current(p.path);
    assert.equal(actual.length, p.after.bytes, p.path);
    assert.equal(sha(actual), p.after.sha256, 'CURRENT_ADOPTION_OPERATOR_DRIFT ' + p.path);
  }
  const profileRaw = current(profilePath);
  assert.equal(sha(profileRaw), '09ad4bdd83cea119735ec555da3834ec290c75db263bedaa6e1fb55a5eed3682', 'EXACT_CORE_SUCCESSOR_PROFILE');
  const profile = JSON.parse(profileRaw);
  assert.equal(profile.reviewed_source_head, '67f17777f342c103e2588410949c0b32a104a37f');
  assert.equal(profile.native_execution_eligible, false); assert.equal(profile.runtime_activation, null);
  const approvedCore = ['src/lib/core/functional-command-runtime-v1.ts', 'src/lib/core/postgres-transaction-host-v1.ts'];
  const accepted = [];
  for (const p of manifest.preserved_source_pins) {
    const actual = current(p.path);
    if (['package.json', 'package-lock.json'].includes(p.path)) {
      const original = historical(p.path);
      assert.equal(sha(original), p.sha256); assert.equal(blob(original), p.git_blob);
      verifyEngineMetadataOnly(p.path, original, actual); accepted.push(p.path);
    } else if (approvedCore.includes(p.path)) {
      const transition = profile.historical_to_current_changes.find(x => x.path === p.path);
      assert.ok(transition); assert.equal(transition.historical.sha256, p.sha256);
      assert.equal(transition.historical.git_blob, p.git_blob);
      assert.deepEqual(transition.current, profile.current_product_sources.find(x => x.path === p.path));
      assert.equal(actual.length, transition.current.bytes, p.path);
      assert.equal(sha(actual), transition.current.sha256, 'REVIEWED_CORE_DRIFT ' + p.path);
      assert.equal(blob(actual), transition.current.git_blob); accepted.push(p.path);
    } else {
      assert.equal(sha(actual), p.sha256, 'UNREVIEWED_ADOPTION_SOURCE_DRIFT ' + p.path);
    }
  }
  assert.deepEqual(accepted.sort(), ['package-lock.json', 'package.json', ...approvedCore].sort());
  return { historical_source: HISTORY, historical_validator: 'UNCHANGED_EXECUTED', current_changes: accepted,
    source_only: true, native_execution_eligible: false, runtime_binding: null, native: 'NOT_RUN_NOT_PASS' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAppCore17AdoptionSourceV1()));
