import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import pg from 'pg';

// Fresh job-owned official Supabase ONLY. Never borrow another Worker stack.
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CI-only disposable proof');
assert.equal(process.env.BUILDING_SETUP_CI_OWNS_FRESH_DAEMON, '1');
const lease = process.env.BUILDING_SETUP_TEST_LEASE ?? '';
assert.match(lease, /^building-[0-9]+-[0-9]+-[a-f0-9]{40}$/);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.ok(lease.endsWith(sha), 'lease binds the checked-out exact SHA');
const dockerEnv = { ...process.env };
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
const docker = ['--host=unix:///var/run/docker.sock'];
const container = 'supabase_db_cladora-local';
const info = JSON.parse(execFileSync('docker', [...docker, 'inspect', container], { env: dockerEnv, encoding: 'utf8' }))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'], 'cladora-local');
assert.match(info.Config.Image, /(?:public\.ecr\.aws\/supabase\/|supabase\/)postgres:17\.6\.1\.095$/);
const source = `cladora_setup_fixture_${randomUUID().replaceAll('-', '')}`;
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const admin = new pg.Client({ connectionString: url });
let created = false;

function completion(child, label) {
  // Do not print SQL, keys, fixture data or credential-bearing command output.
  child.stdout?.resume();
  child.stderr?.resume();
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(Error(`${label}: process start failed`)));
    child.once('close', code => code === 0 ? resolve() : reject(Error(`${label}: failed (SQL output withheld)`)));
  });
}

try {
  await admin.connect();
  assert.equal((await admin.query('select current_database() name')).rows[0].name, 'postgres');
  await admin.query(`create database "${source}" template template0`);
  created = true;
  // Clone a consistent logical snapshot without disconnecting Auth/PostgREST.
  // The source postgres DB is never altered. --clean applies ONLY to the newly
  // created task-owned destination, not a user database or shared stack.
  const dump = spawn('docker', [...docker, 'exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--clean', '--if-exists'], { env: dockerEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const restore = spawn('docker', [...docker, 'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', source, '-v', 'ON_ERROR_STOP=1'], { env: dockerEnv, stdio: ['pipe', 'ignore', 'pipe'] });
  // Both processes are awaited, including the failure path; no dangling dump.
  const dumpDone = new Promise((resolve, reject) => {
    dump.stderr.resume();
    dump.once('error', () => reject(Error('fixture snapshot process start failed')));
    dump.once('close', code => code === 0 ? resolve() : reject(Error('fixture snapshot failed; SQL withheld')));
  });
  dump.stdout.pipe(restore.stdin);
  restore.stdin.on('error', () => { dump.kill('SIGTERM'); });
  const copied = await Promise.allSettled([dumpDone, completion(restore, 'fixture restore')]);
  for (const result of copied) if (result.status === 'rejected') throw result.reason;
  const fixture = await readFile(new URL('../supabase/tests/fixtures/building_setup_authority_v2.inc', import.meta.url), 'utf8');
  assert.ok(!/^\s*\\/m.test(fixture), 'fixture contains SQL only, no psql shell commands');
  const load = spawn('docker', [...docker, 'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', source, '-v', 'ON_ERROR_STOP=1'], { env: dockerEnv, stdio: ['pipe', 'ignore', 'pipe'] });
  const loaded = completion(load, 'canonical fixture');
  load.stdin.on('error', () => {}); // The process exit remains a required failure.
  load.stdin.end(`begin;\n${fixture}\ncommit;\n`);
  await loaded;
  const setting = (await admin.query('select format(\'alter database %I set cladora.synthetic_setup_lease to %L\', $1::text, $2::text) sql', [source, lease])).rows[0].sql;
  await admin.query(setting);
  const run = spawn(process.execPath, ['scripts/test-building-workspace-onboarding-postgres.mjs'], {
    env: { ...process.env, BUILDING_SETUP_EPHEMERAL: '1', BUILDING_SETUP_TEST_LEASE: lease,
      BUILDING_SETUP_TEST_DATABASE_URL: new URL(`/${source}`, url).href,
      BUILDING_SETUP_ACCEPTED_FIXTURE: JSON.stringify({ actor: 'c2200000-0000-4000-8000-000000000001', context: 'c2200000-0000-4000-8000-000000000100', workspace: 'c2200000-0000-4000-8000-000000000050' }) },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    run.once('error', reject);
    run.once('close', code => code === 0 ? resolve() : reject(Error('actual-role concurrency proof failed')));
  });
} finally {
  try {
    if (created) {
      // No FORCE/termination: an open foreign/owned session makes cleanup fail.
      await admin.query(`drop database "${source}"`);
      assert.equal((await admin.query('select count(*)::integer n from pg_database where datname=$1', [source])).rows[0].n, 0);
    }
  } finally { await admin.end(); }
}
console.log(JSON.stringify({ suite: 'building-setup-concurrency-ci', sha, fixture_database_cleanup: 'PASS', issued_auth_http: 'NOT_RUN_NOT_PASS' }));
