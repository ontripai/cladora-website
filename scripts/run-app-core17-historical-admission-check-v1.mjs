// Preserve historical admission tests in their own source domain. This never
// admits the current candidate or changes a runtime binding/sourceGate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = process.cwd(), history = '6cecfa15b00f445be68817e756d766fb0e6fe026';
const manifestPath = 'docs/verification/CORE17-POST-AUTH-CONSUMER-ADOPTION-01.json';
const manifest = JSON.parse(readFileSync(manifestPath));
const immutable = [manifestPath, ...manifest.changed_paths.map(p => p.path)];
execFileSync('git', ['diff', '--exit-code', history, '--', ...immutable], { cwd: root, stdio: 'inherit' });
const scratch = mkdtempSync(join(tmpdir(), 'app-core17-admission-history-'));
const source = join(scratch, 'source'); let registered = false;
try {
  execFileSync('git', ['worktree', 'add', '--detach', source, history], { cwd: root, stdio: 'pipe' }); registered = true;
  for (const pin of manifest.preserved_source_pins) {
    const original = execFileSync('git', ['show', `${history}:${pin.path}`], { cwd: root });
    assert.deepEqual(readFileSync(join(source, pin.path)), original);
  }
  if (!process.argv.includes('--check-only')) {
    execFileSync(process.execPath, ['scripts/test-core17-consumer-admission-v1.mjs'], { cwd: source, stdio: 'inherit' });
  }
  console.log(JSON.stringify({ domain: 'HISTORICAL_ADMISSION_TESTS_ONLY', source: history,
    tests: process.argv.includes('--check-only') ? 'NOT_RUN_LOCAL_INSPECTION_ONLY' : 'PASS_IN_ORIGINAL_CONTEXT',
    current_candidate_admission: 'NOT_READY_NOT_GRANTED', native_execution_eligible: false, runtime_binding: null }));
} finally {
  if (registered) execFileSync('git', ['worktree', 'remove', source], { cwd: root, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
}
