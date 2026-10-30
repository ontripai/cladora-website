import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { pipeline, Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import {postgres17Sqlstates} from './lib/postgres17-sqlstates.mjs';
import { cleanupOwnedDatabase, parseProofFailureRecord } from './test-building-workspace-onboarding-postgres.mjs';

const sqlstates = postgres17Sqlstates;
const signals = new Set(['SIGTERM','SIGPIPE','SIGKILL','SIGINT','SIGABRT','SIGSEGV']);
const processCodes = new Set(['ENOENT','EACCES','EPERM','EPIPE','ECONNRESET']);
const stages = new Set(['preflight','connect','clone-create','snapshot','dump','restore','fixture-load','lease-set','concurrency-proof','cleanup']);

export class HarnessFailure extends Error {
  constructor(diagnostic) {
    super('building-setup harness failed: ' + JSON.stringify(diagnostic));
    this.diagnostic = diagnostic;
  }
}

// Never retain raw errors, SQL, command arguments, paths, fixture rows or causes.
export function safeFailure(stage, error) {
  if (error instanceof HarnessFailure) return error;
  return new HarnessFailure({stage: stages.has(stage) ? stage : 'preflight',
    category:'operation-failed', sqlstate:sqlstates.has(error?.code) ? error.code : null});
}

export function validateCi(env, sha, info) {
  assert.ok(env.GITHUB_ACTIONS === 'true', 'CI-only disposable proof');
  assert.ok(env.BUILDING_SETUP_CI_OWNS_FRESH_DAEMON === '1', 'fresh job-owned daemon required');
  assert.ok(/^[a-f0-9]{40}$/.test(sha), 'full checked-out SHA required');
  assert.ok(new RegExp('^building-[0-9]+-[0-9]+-' + sha + '$').test(env.BUILDING_SETUP_TEST_LEASE ?? ''), 'lease binds exact SHA');
  assert.ok(info?.Config?.Labels?.['com.supabase.cli.project'] === 'cladora-local', 'official project identity required');
  assert.ok(/^(?:public\.ecr\.aws\/supabase\/|ghcr\.io\/supabase\/|supabase\/)postgres:17\.6\.1\.095$/.test(info?.Config?.Image ?? ''), 'pinned official image required');
}

export function observeProcess(child, stage) {
  let startError = null, sqlstate = null, category = null, tail = '', scanned = 0, missingFunction = null;
  let proofFailure = null, line = '', discardLine = false, scanTruncated = false;
  const proofLine = text => {
    if (proofFailure || Buffer.byteLength(text, 'utf8') > 4096) return;
    let record;
    try { record = parseProofFailureRecord(JSON.parse(text)); } catch { return; }
    if (record) { proofFailure = record; sqlstate = record.sqlstate; category = 'proof-failed'; }
  };
  child.stderr?.on('data', chunk => {
    // Drain all stderr; bound both retained text and parsing work.
    if (scanned >= 65536) { scanTruncated = true; return; }
    const remaining = 65536 - scanned;
    const bounded = chunk.subarray(0, remaining).toString('utf8');
    if (chunk.length > remaining) scanTruncated = true;
    scanned += chunk.length;
    if (stage === 'concurrency-proof') {
      const parts = bounded.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (!discardLine && line.length + parts[i].length > 4096) { discardLine = true; line = ''; }
        if (!discardLine) line += parts[i];
        if (i < parts.length - 1) {
          if (!discardLine) proofLine(line);
          line = ''; discardLine = false;
        }
      }
      return; // Unvalidated JSON/noise must not be treated as psql diagnostics.
    }
    const text = tail + bounded;
    const code = text.match(/(?:ERROR|FATAL|PANIC):\s+([A-Z0-9]{5})(?:\s|:|$)/)?.[1];
    if (sqlstates.has(code)) sqlstate ??= code;
    // Public catalog identifier only: never the argument list or error text.
    const missing=text.match(/ERROR:\s+42883:\s+function ([a-z_][a-z0-9_]{0,62}(?:\.[a-z_][a-z0-9_]{0,62})?)\(/i)?.[1];
    if(missing)missingFunction??=missing;
    for (const [pattern, label] of [
      [/can only create extension in database/i, 'database-bound-extension'],
      [/permission denied|must be owner|must be superuser/i, 'permission-denied'],
      [/no space left on device|disk quota exceeded/i, 'storage-exhausted'],
      [/password authentication failed/i, 'authentication-failed'],
      [/connection refused|could not connect/i, 'connection-failed'],
      [/syntax error/i, 'syntax-error'],
      [/broken pipe/i, 'broken-pipe'],
    ]) if (pattern.test(text)) category ??= label;
    tail = text.slice(-1024);
  });
  return new Promise(resolve => {
    child.once('error', error => { startError = processCodes.has(error?.code) ? error.code : 'UNKNOWN'; });
    // close, not exit/error, proves stdio has also settled.
    child.once('close', (code, signal) => {
      if (stage === 'concurrency-proof' && !scanTruncated && !discardLine && line) proofLine(line);
      resolve({stage, exitCode:Number.isInteger(code) ? code : null,
        signal:signals.has(signal) ? signal : null, startError, sqlstate,
        category:category ?? (startError ? 'process-start-failed' : code === 0 && !signal ? 'ok' : 'process-failed'),
        ...(proofFailure ? {proofFailure} : {}),
        ...(scanTruncated ? {diagnosticScanTruncated:true} : {}),
        ...(missingFunction ? {missingFunction} : {})});
    });
  });
}

export function succeeded(result) {
  return result.exitCode === 0 && result.signal === null && result.startError === null && !result.proofFailure;
}

function terminateOwned(child) {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
}

export async function copySnapshot({spawnProcess = spawn, docker, dockerEnv, container, source}) {
  assert.ok(/^cladora_setup_fixture_[a-f0-9]{32}$/.test(source), 'owned snapshot destination required');
  // A complete Auth/extension snapshot requires the existing local operator.
  // This never changes application roles or grants; restore targets only the
  // fresh task-owned clone, and the proof still calls as authenticated.
  const dump = spawnProcess('docker', [...docker, 'exec', '-e', 'PGPASSWORD=postgres', container, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--clean', '--if-exists', '--exclude-extension=pg_cron', '--exclude-schema=cron'], {env:dockerEnv, stdio:['ignore','pipe','pipe']});
  const dumpDone = observeProcess(dump, 'dump');
  let restore;
  try {
    restore = spawnProcess('docker', [...docker, 'exec', '-i', '-e', 'PGPASSWORD=postgres', container, 'psql', '-X', '-U', 'supabase_admin', '-d', source, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {env:dockerEnv, stdio:['pipe','ignore','pipe']});
  } catch {
    dump.stdout.resume();
    terminateOwned(dump);
    const dumped = await dumpDone;
    throw new HarnessFailure({stage:'snapshot', primary:'restore', dump:dumped,
      restore:{stage:'restore', category:'process-start-failed'}});
  }
  const restoreDone = observeProcess(restore, 'restore');
  const pipeDone = new Promise(resolve => pipeline(dump.stdout, restore.stdin, error => {
    if (error) terminateOwned(dump);
    resolve(error ? (processCodes.has(error.code) ? error.code : 'STREAM_FAILURE') : null);
  }));
  // Preserve BOTH outcomes: destination failure must not be masked by induced
  // dump SIGTERM/EPIPE. Every process and stream settles before DB cleanup.
  const [dumped, restored, pipeError] = await Promise.all([dumpDone, restoreDone, pipeDone]);
  if (!succeeded(dumped) || !succeeded(restored) || pipeError) {
    throw new HarnessFailure({stage:'snapshot',
      failedStages:[...(!succeeded(dumped) ? ['dump'] : []), ...(!succeeded(restored) ? ['restore'] : []), ...(pipeError ? ['pipe'] : [])],
      dump:dumped, restore:restored, pipeError});
  }
}

export async function loadFixture(child, fixture) {
  const done = observeProcess(child, 'fixture-load');
  const input = new Promise(resolve => pipeline(Readable.from(['begin;\n' + fixture + '\ncommit;\n']), child.stdin, error => {
    if (error) terminateOwned(child);
    resolve(error ? 'STREAM_FAILURE' : null);
  }));
  const [result, pipeError] = await Promise.all([done, input]);
  if (!succeeded(result) || pipeError) throw new HarnessFailure({stage:'fixture-load', process:result, pipeError});
}

export async function runCi() {
  let stage = 'preflight', failure;
  // Fresh job-owned official Supabase ONLY. Never borrow another Worker stack.
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CI-only disposable proof');
  assert.equal(process.env.BUILDING_SETUP_CI_OWNS_FRESH_DAEMON, '1');
  const lease = process.env.BUILDING_SETUP_TEST_LEASE ?? '';
  assert.match(lease, /^building-[0-9]+-[0-9]+-[a-f0-9]{40}$/);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  assert.ok(lease.endsWith(sha), 'lease binds the checked-out exact SHA');
  const dockerEnv = { ...process.env };
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
  const docker = ['--host=unix:///var/run/docker.sock'];
  const container = 'supabase_db_cladora-local';
  const info = JSON.parse(execFileSync('docker', [...docker, 'inspect', container], { env: dockerEnv, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }))[0];
  validateCi(process.env, sha, info);
  console.log("Verified official pinned local PostgreSQL image: " + info.Config.Image);
  const source = `cladora_setup_fixture_${randomUUID().replaceAll('-', '')}`;
  const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const {default: pg} = await import('pg');
  const admin = new pg.Client({ connectionString: url });
  let created = false;

  try {
    stage = 'connect';
    await admin.connect();
    assert.equal((await admin.query('select current_database() name')).rows[0].name, 'postgres');
    // pg_cron is intentionally bound to the server's postgres DB. Recreating
    // its operational scheduler in a named fixture DB is invalid and would
    // duplicate scheduled jobs. The original native test DB retains pg_cron.
    const scheduler=(await admin.query("select extversion,current_setting('cron.database_name') database from pg_extension where extname='pg_cron'")).rows;
    assert.equal(scheduler.length,1,'source native database must retain pg_cron');
    assert.equal(scheduler[0].database,'postgres','source scheduler must remain bound to postgres');
    console.log('Owned building clone scope: application/Auth snapshot; pg_cron/cron excluded; scheduler proof NOT_IN_SCOPE');
    stage = 'clone-create';
    await admin.query(`create database "${source}" template template0`);
    created = true;
    // Clone a consistent logical snapshot without disconnecting Auth/PostgREST.
    // The source postgres DB is never altered. --clean applies ONLY to the newly
    // created task-owned destination, not a user database or shared stack.
    stage = 'snapshot';
    await copySnapshot({docker, dockerEnv, container, source});
    stage = 'fixture-load';
    const fixture = await readFile(new URL('../supabase/tests/fixtures/building_setup_authority_v2.inc', import.meta.url), 'utf8');
    assert.ok(!/^\s*\\/m.test(fixture), 'fixture contains SQL only, no psql shell commands');
    const load = spawn('docker', [...docker, 'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', source, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], { env: dockerEnv, stdio: ['pipe', 'ignore', 'pipe'] });
    await loadFixture(load, fixture);
    stage = 'lease-set';
    const setting = (await admin.query('select format(\'alter database %I set cladora.synthetic_setup_lease to %L\', $1::text, $2::text) sql', [source, lease])).rows[0].sql;
    await admin.query(setting);
    stage = 'concurrency-proof';
    const run = spawn(process.execPath, ['scripts/test-building-workspace-onboarding-postgres.mjs'], {
      env: { ...process.env, BUILDING_SETUP_EPHEMERAL: '1', BUILDING_SETUP_TEST_LEASE: lease,
        BUILDING_SETUP_TEST_DATABASE_URL: new URL(`/${source}`, url).href,
        BUILDING_SETUP_ACCEPTED_FIXTURE: JSON.stringify({ actor: 'c2200000-0000-4000-8000-000000000001', context: 'c2200000-0000-4000-8000-000000000100', workspace: 'c2200000-0000-4000-8000-000000000050' }) },
      stdio: ['ignore', 'inherit', 'pipe'],
    });
    const result = await observeProcess(run, 'concurrency-proof');
    if (!succeeded(result)) throw new HarnessFailure({stage:'concurrency-proof', process:result});
  } catch (error) {
    failure = safeFailure(stage, error);
  } finally {
    let cleanupFailure;
    try {
      await cleanupOwnedDatabase({admin, name:source, created});
    } catch (error) { cleanupFailure = safeFailure('cleanup', error); }
    try { await admin.end(); }
    catch (error) { cleanupFailure ??= safeFailure('cleanup', error); }
    if (cleanupFailure) throw new HarnessFailure({stage:'cleanup', prior:failure?.diagnostic ?? null, cleanup:cleanupFailure.diagnostic});
  }
  if (failure) throw failure;
  return { suite: 'building-setup-concurrency-ci', sha, fixture_database_cleanup: 'PASS', snapshot_profile:'application-and-auth-excluding-database-bound-cron', clone_scheduler:'NOT_INSTALLED_NOT_PROVED', issued_auth_http: 'NOT_RUN_NOT_PASS' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCi().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(safeFailure('preflight', error).message);
    process.exitCode = 1;
  });
}
