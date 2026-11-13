import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { verifyEngineMetadataOnly, verifyPublishedEngineTransition } from './lib/app-engine-source-transition.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url), semver = require('semver');
const packet = JSON.parse(readFileSync(new URL('../supabase/operations-command/checklist-v2.manifest.json', import.meta.url)));
const record = JSON.parse(readFileSync(new URL('../docs/app/published-source-consolidation-01/engine-source-transition.json', import.meta.url)));
let negative = 0;
for (const file of record.files) {
  const pin = packet.immutable_sources.find(p => p.path === file.path);
  assert.equal(verifyPublishedEngineTransition(root, pin), true);
  const before = execFileSync('git', ['show', `${record.before_commit}:${file.path}`], { cwd: root });
  const after = readFileSync(new URL(`../${file.path}`, import.meta.url));
  const json = JSON.parse(after);
  for (const mutate of [
    value => { (file.path === 'package.json' ? value : value.packages['']).engines.node = '>=22.0.0'; },
    value => { value.dependencies = { ...value.dependencies, injected: '1.0.0' }; },
    value => { if (file.path === 'package-lock.json') value.packages['node_modules/zod'].integrity = 'forged'; else value.scripts.build = 'echo bypass'; },
  ]) {
    const changed = structuredClone(json); mutate(changed);
    assert.throws(() => verifyEngineMetadataOnly(file.path, before, Buffer.from(JSON.stringify(changed)))); negative++;
  }
  assert.throws(() => verifyEngineMetadataOnly(file.path, before, Buffer.concat([after, Buffer.from('\n')]))); negative++;
  assert.throws(() => verifyPublishedEngineTransition(root, { ...pin, sha256: '0'.repeat(64) })); negative++;
}
for (const major of [20, 22, 23, 24, 25, 26]) assert.equal(semver.satisfies(`${major}.0.0`, '22.x || 24.x'), [22, 24].includes(major));
console.log(JSON.stringify({ positive: 2, negative, rangeMajors: [20,22,23,24,25,26], result: 'PASS', native: 'NOT_RUN_NOT_PASS' }));
