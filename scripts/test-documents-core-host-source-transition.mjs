import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyReviewedCoreHostSourcePinV1 } from './lib/reviewed-core-host-source-pin-v1.mjs';
const host = readFileSync(new URL('../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url));
const profile = readFileSync(new URL('./core17-native-source-successor-v1/source-successor.json', import.meta.url));
assert.equal(verifyReviewedCoreHostSourcePinV1(host, profile), '9436c082f8ce8a054d8300f55bd49ac4b6120240cf06fa6ca94190b5c6c1858a');
const tampered = Buffer.from(host); tampered[tampered.length - 2] ^= 1;
assert.throws(() => verifyReviewedCoreHostSourcePinV1(tampered, profile), /REVIEWED_CORE_HOST_SOURCE_IDENTITY/);
assert.throws(() => verifyReviewedCoreHostSourcePinV1(Buffer.concat([host, Buffer.from('\n')]), profile), /REVIEWED_CORE_HOST_SOURCE_IDENTITY/);
for (const edit of [p => { p.native_execution_eligible = true; }, p => { p.historical_to_current_changes.find(x => x.path.endsWith('postgres-transaction-host-v1.ts')).historical.sha256 = '0'.repeat(64); }, p => { p.current_product_sources.push({ path: 'unreviewed' }); }]) {
  const changed = JSON.parse(profile); edit(changed);
  assert.throws(() => verifyReviewedCoreHostSourcePinV1(host, Buffer.from(JSON.stringify(changed))), /EXACT_CORE_SOURCE_SUCCESSOR_PROFILE/);
}
console.log('PASS Core host source transition: exact historical/current identity; five tamper/extra/native negatives; SQL/native NOT_RUN');
