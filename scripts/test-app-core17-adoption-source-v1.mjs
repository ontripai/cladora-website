import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { verifyAppCore17AdoptionSourceV1 } from './check-app-core17-adoption-source-v1.mjs';
// Cache immutable Git blobs only inside this test; current reads are never cached.
const cache = new Map();
const historical = p => { if (!cache.has(p)) cache.set(p, execFileSync('git', ['show', `6cecfa15b00f445be68817e756d766fb0e6fe026:${p}`])); return Buffer.from(cache.get(p)); };
assert.equal(verifyAppCore17AdoptionSourceV1({ readHistorical: historical }).native_execution_eligible, false);
const cases = [
  ['package-lock.json', b => Buffer.concat([b, Buffer.from('\n')])],
  ['src/lib/core/functional-command-runtime-v1.ts', b => { const x = Buffer.from(b); x[x.length - 2] ^= 1; return x; }],
  ['src/lib/core/private-service-development-binding-v1.ts', b => Buffer.concat([b, Buffer.from('\n')])],
  ['scripts/lib/core17-exact-consumer-admission-v1.mjs', b => Buffer.concat([b, Buffer.from('\n')])],
  ['docs/verification/CORE17-POST-AUTH-CONSUMER-ADOPTION-01.json', b => Buffer.from(JSON.stringify({ ...JSON.parse(b), native: 'PASS' }))],
  ['scripts/core17-native-source-successor-v1/source-successor.json', b => Buffer.from(JSON.stringify({ ...JSON.parse(b), native_execution_eligible: true }))],
];
for (const [path, mutate] of cases) assert.throws(() => verifyAppCore17AdoptionSourceV1({ readHistorical: historical, readCurrent: p => p === path ? mutate(readFileSync(p)) : readFileSync(p) }), undefined, path);
console.log('PASS APP historical adoption/current composition: positive + six engine/runtime/operator/protected/native tamper controls; no admission/native execution');
