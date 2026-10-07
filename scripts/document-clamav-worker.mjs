import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function command(binary, args) {
  try {
    const { stdout } = await execFileAsync(binary, args, { timeout: 120_000, maxBuffer: 65536, windowsHide: true });
    return { code: 0, stdout };
  } catch (error) {
    // Only exit 1 from the actual scan means an infection. Every other error
    // (including a stale database and timeouts) leaves the file unavailable.
    if (typeof error.code === 'number' && !error.killed) {
      return { code: error.code, stdout: error.stdout ?? '' };
    }
    throw new Error('CLAMAV_COMMAND_FAILED');
  }
}

export async function scanDocumentVersion({ client, versionId, run = command, clamscan = 'clamscan', freshclam = 'freshclam', completionJob = null }) {
  if (!UUID.test(versionId)) throw new Error('INVALID_VERSION_ID');
  const signatures = await run(freshclam, ['--quiet']);
  if (signatures.code !== 0) throw new Error('SIGNATURE_UPDATE_FAILED');
  const engine = await run(clamscan, ['--version']);
  if (engine.code !== 0 || !engine.stdout?.trim()) throw new Error('CLAMAV_VERSION_UNAVAILABLE');
  const engineVersion = engine.stdout.trim().split(/\r?\n/)[0].slice(0, 160);
  const { data: target, error: targetError } = await client.rpc('get_document_scan_target_v1', { p_version_id: versionId });
  if (targetError || !target || target.bucket_id !== 'document-vault'
    || target.version_id !== versionId || !SHA256.test(target.sha256)
    || !Number.isSafeInteger(target.size_bytes) || target.size_bytes < 0 || target.size_bytes > 20971520
    || typeof target.object_path !== 'string' || !target.object_path || target.object_path.startsWith('/')
    || target.object_path.split('/').includes('..')) throw new Error('INVALID_SCAN_TARGET');

  const { data: blob, error: storageError } = await client.storage.from('document-vault').download(target.object_path);
  if (storageError || !blob) throw new Error('STORAGE_DOWNLOAD_FAILED');
  const bytes = Buffer.from(await blob.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== target.size_bytes || digest !== target.sha256) throw new Error('STORAGE_CONTENT_MISMATCH');

  const directory = await mkdtemp(join(tmpdir(), 'cladora-vault-scan-'));
  let verdict;
  try {
    const file = join(directory, 'document.bin');
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    const result = await run(clamscan, [
      '--no-summary', '--fail-if-cvd-older-than=2', '--alert-exceeds-max=yes',
      '--alert-encrypted=yes', file,
    ]);
    // A file may be marked clean only for an unambiguous exit 0 and a report
    // confirming the exact temporary file was scanned successfully.
    if (result.code === 0 && result.stdout?.includes(`${file}: OK`)) verdict = 'clean';
    else if (result.code === 1 && result.stdout?.includes(`${file}:`) && result.stdout.includes('FOUND')) verdict = 'quarantined';
    else throw new Error('SCAN_INCOMPLETE');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const scannedAt = new Date().toISOString();
  const { data: recorded, error: recordError } = await client.rpc(completionJob ? 'complete_document_scan_job_v1' : 'record_document_scan_v1', {
    ...(completionJob ? { p_job_id: completionJob.job_id, p_lease_token: completionJob.lease_token }
      : { p_version_id: versionId }),
    p_scan_id: randomUUID(), p_verdict: verdict,
    p_content_sha256: digest, p_engine_version: engineVersion, p_scanned_at: scannedAt,
  });
  if (recordError || recorded?.verdict !== verdict) throw new Error('SCAN_RECORD_FAILED');
  return { versionId, verdict };
}

export async function scanNextDocument({ client, workerId, run = command, clamscan = 'clamscan', freshclam = 'freshclam' }) {
  if (typeof workerId !== 'string' || !/^[A-Za-z0-9._:-]{3,120}$/.test(workerId)) throw new Error('WORKER_ID_INVALID');
  const { data: job, error: claimError } = await client.rpc('claim_document_scan_job_v1', {
    p_worker_id: workerId, p_lease_seconds: 900,
  });
  if (claimError) throw new Error('SCAN_CLAIM_FAILED');
  if (!job) return scanNextInternalDocument({ client, workerId, run, clamscan, freshclam });
  if (!UUID.test(job.job_id) || !UUID.test(job.lease_token) || !UUID.test(job.version_id)
    || !Number.isInteger(job.attempt_count) || job.attempt_count < 1 || job.attempt_count > 10) {
    throw new Error('SCAN_LEASE_INVALID');
  }
  try {
    const result = await scanDocumentVersion({ client, versionId: job.version_id,
      completionJob: job, run, clamscan, freshclam });
    return { outcome: 'completed', ...result };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'SCAN_FAILED';
    const errorCode = /^[A-Z0-9_]{3,80}$/.test(reason) ? reason : 'SCAN_FAILED';
    const { data: failure, error: failError } = await client.rpc('fail_document_scan_job_v1', {
      p_job_id: job.job_id, p_lease_token: job.lease_token, p_error_code: errorCode,
      p_retry_after_seconds: Math.min(3600, 60 * 2 ** (job.attempt_count - 1)),
    });
    if (failError) throw new Error('SCAN_FAILURE_RECORD_FAILED');
    return { outcome: failure?.state ?? 'retry', versionId: job.version_id, errorCode };
  }
}

export async function scanNextInternalDocument({ client, workerId, run = command, clamscan = 'clamscan', freshclam = 'freshclam' }) {
  if (typeof workerId !== 'string' || !/^[A-Za-z0-9._:-]{3,120}$/.test(workerId)) throw new Error('WORKER_ID_INVALID');
  const { data: job, error: claimError } = await client.rpc('claim_internal_private_scan_job_v1', {
    p_worker_id: workerId, p_lease_seconds: 900,
  });
  if (claimError?.code === 'PGRST202' || claimError?.code === '42883') return { outcome: 'idle' };
  if (claimError) throw new Error('INTERNAL_SCAN_CLAIM_FAILED');
  if (!job) return { outcome: 'idle' };
  if (!UUID.test(job.job_id) || !UUID.test(job.lease_token) || !UUID.test(job.document_id)
    || !Number.isInteger(job.attempt_count) || job.attempt_count < 1 || job.attempt_count > 5) {
    throw new Error('INTERNAL_SCAN_LEASE_INVALID');
  }
  try {
    const signatures = await run(freshclam, ['--quiet']);
    if (signatures.code !== 0) throw new Error('SIGNATURE_UPDATE_FAILED');
    const engine = await run(clamscan, ['--version']);
    if (engine.code !== 0 || !engine.stdout?.trim()) throw new Error('CLAMAV_VERSION_UNAVAILABLE');
    const { data: target, error: targetError } = await client.rpc('get_internal_private_scan_target_v1', {
      p_document_id: job.document_id,
    });
    if (targetError || !target || target.document_id !== job.document_id
      || target.bucket_id !== 'internal-message-vault' || !SHA256.test(target.sha256)
      || !Number.isSafeInteger(target.size_bytes) || target.size_bytes < 1 || target.size_bytes > 20971520
      || typeof target.object_path !== 'string' || !target.object_path || target.object_path.startsWith('/')
      || target.object_path.split('/').includes('..')) throw new Error('INVALID_INTERNAL_SCAN_TARGET');
    const { data: blob, error: storageError } = await client.storage.from('internal-message-vault').download(target.object_path);
    if (storageError || !blob) throw new Error('STORAGE_DOWNLOAD_FAILED');
    const bytes = Buffer.from(await blob.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== target.size_bytes || digest !== target.sha256) throw new Error('STORAGE_CONTENT_MISMATCH');
    const directory = await mkdtemp(join(tmpdir(), 'cladora-internal-scan-'));
    let verdict;
    try {
      const file = join(directory, 'document.bin');
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      const result = await run(clamscan, ['--no-summary', '--fail-if-cvd-older-than=2',
        '--alert-exceeds-max=yes', '--alert-encrypted=yes', file]);
      if (result.code === 0 && result.stdout?.includes(`${file}: OK`)) verdict = 'clean';
      else if (result.code === 1 && result.stdout?.includes(`${file}:`) && result.stdout.includes('FOUND')) verdict = 'quarantined';
      else throw new Error('SCAN_INCOMPLETE');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    const { data: recorded, error: recordError } = await client.rpc('complete_internal_private_scan_job_v1', {
      p_job_id: job.job_id, p_lease_token: job.lease_token, p_verdict: verdict,
      p_sha256: digest, p_engine_version: engine.stdout.trim().split(/\r?\n/)[0].slice(0, 160),
      p_scanned_at: new Date().toISOString(),
    });
    if (recordError || recorded?.verdict !== verdict) throw new Error('INTERNAL_SCAN_RECORD_FAILED');
    return { outcome: 'completed', documentId: job.document_id, verdict };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'SCAN_FAILED';
    const errorCode = /^[A-Z0-9_]{3,80}$/.test(reason) ? reason : 'SCAN_FAILED';
    const { data: failure, error: failError } = await client.rpc('fail_internal_private_scan_job_v1', {
      p_job_id: job.job_id, p_lease_token: job.lease_token, p_error_code: errorCode,
      p_retry_after_seconds: Math.min(3600, 60 * 2 ** (job.attempt_count - 1)),
    });
    if (failError) throw new Error('INTERNAL_SCAN_FAILURE_RECORD_FAILED');
    return { outcome: failure?.state ?? 'retry', documentId: job.document_id, errorCode };
  }
}

export async function checkDocumentScanQueue({ client, now = Date.now(), maxPendingMinutes = 30 }) {
  const { data, error } = await client.rpc('get_document_scan_queue_status_v1');
  if (error || !data) throw new Error('SCAN_QUEUE_STATUS_UNAVAILABLE');
  const deadLetter = Number(data.dead_letter);
  const pending = Number(data.pending) + Number(data.retry);
  const oldest = data.oldest_pending_at ? Date.parse(data.oldest_pending_at) : null;
  if (!Number.isSafeInteger(deadLetter) || !Number.isSafeInteger(pending)
    || (oldest !== null && !Number.isFinite(oldest)) || (pending > 0 && oldest === null)) throw new Error('SCAN_QUEUE_STATUS_INVALID');
  const stale = pending > 0 && oldest !== null && now - oldest > maxPendingMinutes * 60_000;
  if (deadLetter > 0 || stale) throw new Error('SCAN_QUEUE_UNHEALTHY');
  const { data: internal, error: internalError } = await client.rpc('get_internal_private_scan_queue_status_v1');
  // The private-vault migration is deployed after the existing worker. A
  // missing RPC is treated as not-yet-migrated; all other failures are fatal.
  if (internalError && internalError.code !== 'PGRST202' && internalError.code !== '42883')
    throw new Error('INTERNAL_SCAN_QUEUE_STATUS_UNAVAILABLE');
  if (internalError) return { pending, deadLetter, healthy: true };
  const internalPending = Number(internal?.pending) + Number(internal?.retry);
  const internalDead = Number(internal?.dead_letter);
  const internalOldest = internal?.oldest_pending_at ? Date.parse(internal.oldest_pending_at) : null;
  if (!Number.isSafeInteger(internalPending) || !Number.isSafeInteger(internalDead)
    || (internalPending > 0 && !Number.isFinite(internalOldest))
    || internalDead > 0 || (internalOldest !== null && internalPending > 0
      && now - internalOldest > maxPendingMinutes * 60_000)) throw new Error('INTERNAL_SCAN_QUEUE_UNHEALTHY');
  return { pending: pending + internalPending, deadLetter: deadLetter + internalDead, healthy: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const versionId = process.argv[2];
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SCANNER_CREDENTIALS_MISSING');
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const options = { client,
      clamscan: process.env.CLAMSCAN_PATH || 'clamscan',
      freshclam: process.env.FRESHCLAM_PATH || 'freshclam' };
    const result = versionId === '--queue'
      ? await scanNextDocument({ ...options, workerId: process.env.DOCUMENT_SCAN_WORKER_ID || 'cladora-vault-worker' })
      : versionId === '--status' ? await checkDocumentScanQueue({ client })
        : await scanDocumentVersion({ ...options, versionId });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'SCAN_FAILED'}\n`);
    process.exitCode = 1;
  }
}
