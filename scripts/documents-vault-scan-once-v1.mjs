/** Vault-only queue entry over the existing real ClamAV worker. No credentials,
 * service-role fallback, configurable verdict/run callback or internal-vault scan.
 */
import { scanDocumentVersion } from './document-clamav-worker.mjs';
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export async function scanVaultDocumentOnceV1({ client, workerId }) {
  if (typeof workerId !== 'string' || !/^[A-Za-z0-9._:-]{3,120}$/.test(workerId)) throw Error('WORKER_ID_INVALID');
  const { data: job, error } = await client.rpc('claim_document_scan_job_v1', {
    p_worker_id: workerId, p_lease_seconds: 900,
  });
  if (error) throw Error('SCAN_CLAIM_FAILED');
  if (!job) return Object.freeze({ outcome: 'idle' }); // Never fall through to another domain/bucket.
  if (!uuid(job.job_id) || !uuid(job.lease_token) || !uuid(job.version_id)
    || !Number.isInteger(job.attempt_count) || job.attempt_count < 1 || job.attempt_count > 10) throw Error('SCAN_LEASE_INVALID');
  try {
    // No injected run/clean flag: this calls freshclam/clamscan via execFile and
    // records only their actual measured verdict through the canonical lease RPC.
    const result = await scanDocumentVersion({ client, versionId: job.version_id, completionJob: job });
    return Object.freeze({ outcome: 'completed', version_id: result.versionId, verdict: result.verdict });
  } catch (first) {
    const reason = first instanceof Error ? first.message : 'SCAN_FAILED';
    const code = /^[A-Z0-9_]{3,80}$/.test(reason) ? reason : 'SCAN_FAILED';
    let recorded;
    try { recorded = await client.rpc('fail_document_scan_job_v1', {
      p_job_id: job.job_id, p_lease_token: job.lease_token, p_error_code: code,
      p_retry_after_seconds: Math.min(3600, 60 * 2 ** (job.attempt_count - 1)),
    }); } catch (recovery) { throw new AggregateError([first, recovery], 'SCAN_FAILURE_RECORD_FAILED', { cause: first }); }
    if (recorded.error) throw new Error('SCAN_FAILURE_RECORD_FAILED', { cause: first });
    const state = recorded.data?.state;
    return Object.freeze({ outcome: state === 'retry' || state === 'dead_letter' ? state : 'readback_required',
      version_id: job.version_id, error_code: code });
  }
}
