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

export async function scanDocumentVersion({ client, versionId, run = command, clamscan = 'clamscan', freshclam = 'freshclam' }) {
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
  const { data: recorded, error: recordError } = await client.rpc('record_document_scan_v1', {
    p_version_id: versionId, p_scan_id: randomUUID(), p_verdict: verdict,
    p_content_sha256: digest, p_engine_version: engineVersion, p_scanned_at: scannedAt,
  });
  if (recordError || recorded?.verdict !== verdict) throw new Error('SCAN_RECORD_FAILED');
  return { versionId, verdict };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const versionId = process.argv[2];
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SCANNER_CREDENTIALS_MISSING');
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await scanDocumentVersion({ client, versionId,
      clamscan: process.env.CLAMSCAN_PATH || 'clamscan',
      freshclam: process.env.FRESHCLAM_PATH || 'freshclam' });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'SCAN_FAILED'}\n`);
    process.exitCode = 1;
  }
}
