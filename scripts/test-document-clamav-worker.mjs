import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { scanDocumentVersion, scanNextDocument, checkDocumentScanQueue } from './document-clamav-worker.mjs';

const versionId = '55000000-0000-4000-8000-000000000001';
const bytes = Buffer.from('synthetic vault fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const target = { version_id: versionId, bucket_id: 'document-vault',
  object_path: 'synthetic/test.bin', size_bytes: bytes.length, sha256 };

function fixture({ targetOverride = {}, content = bytes, scanCode = 0, scanReport, signatureCode = 0 } = {}) {
  const calls = [];
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      if (name === 'get_document_scan_target_v1') return { data: { ...target, ...targetOverride }, error: null };
      return { data: { verdict: params.p_verdict }, error: null };
    },
    storage: { from: bucket => {
      assert.equal(bucket, 'document-vault');
      return { download: async () => ({ data: new Blob([content]), error: null }) };
    } },
  };
  const run = async (binary, args) => {
    if (binary === 'freshclam') return { code: signatureCode, stdout: '' };
    if (args[0] === '--version') return { code: 0, stdout: 'ClamAV test fixture\n' };
    const path = args.at(-1);
    return { code: scanCode, stdout: scanReport?.(path) ?? `${path}: ${scanCode === 1 ? 'Test.Signature FOUND' : 'OK'}\n` };
  };
  return { client, run, calls };
}

const good = fixture();
assert.deepEqual(await scanDocumentVersion({ ...good, versionId }), { versionId, verdict: 'clean' });
assert.equal(good.calls.at(-1).params.p_content_sha256, sha256);
const malicious = fixture({ scanCode: 1 });
assert.deepEqual(await scanDocumentVersion({ ...malicious, versionId }), { versionId, verdict: 'quarantined' });
const stale = fixture({ signatureCode: 2 });
await assert.rejects(scanDocumentVersion({ ...stale, versionId }), /SIGNATURE_UPDATE_FAILED/);
assert.equal(stale.calls.length, 0);
const mismatch = fixture({ content: Buffer.from('wrong bytes') });
await assert.rejects(scanDocumentVersion({ ...mismatch, versionId }), /STORAGE_CONTENT_MISMATCH/);
assert.equal(mismatch.calls.length, 1);
const incomplete = fixture({ scanReport: () => 'Scanned files: 0\n' });
await assert.rejects(scanDocumentVersion({ ...incomplete, versionId }), /SCAN_INCOMPLETE/);
assert.equal(incomplete.calls.length, 1);
const skipped = fixture({ scanCode: 2 });
await assert.rejects(scanDocumentVersion({ ...skipped, versionId }), /SCAN_INCOMPLETE/);
assert.equal(skipped.calls.length, 1);
const wrongBucket = fixture({ targetOverride: { bucket_id: 'other' } });
await assert.rejects(scanDocumentVersion({ ...wrongBucket, versionId }), /INVALID_SCAN_TARGET/);
assert.equal(wrongBucket.calls.length, 1);
const queueId = '55000000-0000-4000-8000-000000000002';
const leaseToken = '55000000-0000-4000-8000-000000000003';
const queue = fixture();
const originalRpc = queue.client.rpc;
queue.client.rpc = async (name, params) => {
  if (name === 'claim_document_scan_job_v1') return { data: { job_id: queueId, lease_token: leaseToken, version_id: versionId, attempt_count: 1 }, error: null };
  return originalRpc(name, params);
};
assert.deepEqual(await scanNextDocument({ ...queue, workerId: 'worker-001' }), { outcome: 'completed', versionId, verdict: 'clean' });
assert.equal(queue.calls.at(-1).name, 'complete_document_scan_job_v1');
assert.equal(queue.calls.at(-1).params.p_job_id, queueId);
assert.equal('p_version_id' in queue.calls.at(-1).params, false);
const idle = fixture();
idle.client.rpc = async () => ({ data: null, error: null });
assert.deepEqual(await scanNextDocument({ ...idle, workerId: 'worker-001' }), { outcome: 'idle' });
const internal = fixture();
const internalRpc = internal.client.rpc;
internal.client.rpc = async (name, params) => {
  if (name === 'claim_document_scan_job_v1') return { data: null, error: null };
  if (name === 'claim_internal_private_scan_job_v1') return { data: { job_id: queueId,
    lease_token: leaseToken, document_id: versionId, attempt_count: 1 }, error: null };
  if (name === 'get_internal_private_scan_target_v1') return { data: { document_id: versionId,
    bucket_id: 'internal-message-vault', object_path: 'synthetic/internal.bin',
    size_bytes: bytes.length, sha256 }, error: null };
  return internalRpc(name, params);
};
internal.client.storage.from = bucket => {
  assert.equal(bucket, 'internal-message-vault');
  return { download: async () => ({ data: new Blob([bytes]), error: null }) };
};
assert.deepEqual(await scanNextDocument({ ...internal, workerId: 'worker-001' }),
  { outcome: 'completed', documentId: versionId, verdict: 'clean' });
assert.equal(internal.calls.at(-1).name, 'complete_internal_private_scan_job_v1');
const internalMismatch = fixture();
internalMismatch.client.rpc = async (name, params) => {
  if (name === 'claim_document_scan_job_v1') return { data: null, error: null };
  if (name === 'claim_internal_private_scan_job_v1') return { data: { job_id: queueId,
    lease_token: leaseToken, document_id: versionId, attempt_count: 1 }, error: null };
  if (name === 'get_internal_private_scan_target_v1') return { data: { document_id: versionId,
    bucket_id: 'internal-message-vault', object_path: 'synthetic/internal.bin',
    size_bytes: bytes.length, sha256: 'b'.repeat(64) }, error: null };
  if (name === 'fail_internal_private_scan_job_v1') return { data: { state: 'retry' }, error: null };
  return { data: null, error: { code: 'UNEXPECTED_RPC' } };
};
internalMismatch.client.storage.from = bucket => {
  assert.equal(bucket, 'internal-message-vault');
  return { download: async () => ({ data: new Blob([bytes]), error: null }) };
};
assert.deepEqual(await scanNextDocument({ ...internalMismatch, workerId: 'worker-001' }),
  { outcome: 'retry', documentId: versionId, errorCode: 'STORAGE_CONTENT_MISMATCH' });
const failed = fixture({ signatureCode: 2 });
const failedRpc = failed.client.rpc;
failed.client.rpc = async (name, params) => {
  if (name === 'claim_document_scan_job_v1') return { data: { job_id: queueId, lease_token: leaseToken, version_id: versionId, attempt_count: 2 }, error: null };
  if (name === 'fail_document_scan_job_v1') { failed.calls.push({ name, params }); return { data: { state: 'retry' }, error: null }; }
  return failedRpc(name, params);
};
assert.deepEqual(await scanNextDocument({ ...failed, workerId: 'worker-001' }), {
  outcome: 'retry', versionId, errorCode: 'SIGNATURE_UPDATE_FAILED',
});
assert.equal(failed.calls.at(-1).params.p_retry_after_seconds, 120);
const queueStatus = result => ({ rpc: async name => ({ data: name === 'get_internal_private_scan_queue_status_v1'
  ? { pending: 0, retry: 0, dead_letter: 0, oldest_pending_at: null } : result, error: null }) });
assert.deepEqual(await checkDocumentScanQueue({ client: queueStatus({ pending: 1, retry: 0, dead_letter: 0,
  oldest_pending_at: '2026-09-27T18:00:00Z' }), now: Date.parse('2026-09-27T18:15:00Z') }),
{ pending: 1, deadLetter: 0, healthy: true });
await assert.rejects(checkDocumentScanQueue({ client: queueStatus({ pending: 1, retry: 0, dead_letter: 0,
  oldest_pending_at: '2026-09-27T18:00:00Z' }), now: Date.parse('2026-09-27T19:00:00Z') }), /SCAN_QUEUE_UNHEALTHY/);
await assert.rejects(checkDocumentScanQueue({ client: queueStatus({ pending: 0, retry: 0, dead_letter: 1,
  oldest_pending_at: '2026-09-27T18:00:00Z' }) }), /SCAN_QUEUE_UNHEALTHY/);
const internalDead = { rpc: async name => ({ data: name === 'get_internal_private_scan_queue_status_v1'
  ? { pending: 0, retry: 0, dead_letter: 1, oldest_pending_at: '2026-09-27T18:00:00Z' }
  : { pending: 0, retry: 0, dead_letter: 0, oldest_pending_at: null }, error: null }) };
await assert.rejects(checkDocumentScanQueue({ client: internalDead }), /INTERNAL_SCAN_QUEUE_UNHEALTHY/);
console.log('Vault ClamAV worker: clean, quarantine and fail-closed paths passed');
