import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { admit, sha256, CASES, TABLES, SEQUENCES, localUrl, validateRequest } from './docs-ce012-live-connection-v1/admission.mjs';
import { scopeFixture, observerFixture } from './docs-ce012-live-connection-v1/scope-test-fixture.mjs';
import { measure, preflight, XACT_STATS_SQL } from './docs-ce012-live-connection-v1/measure.mjs';

// Pure admission/control tests. Ephemeral signing key and fake catalog/counter
// objects below are NOT coordinator authorization, real roles, Auth or PG proof.
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = scopeFixture();
const { input, payload, signed, closure } = fixture;
const { requestBytes, inventoryBytes, planBytes, now, trustedPublicKey } = input;
const request = JSON.parse(requestBytes), inventory = JSON.parse(inventoryBytes);
const rejects = (data, code) => assert.throws(() => admit({ ...input, ...data }), e => e.code === code);
let groups = 0;
const selectedScope = process.argv.includes('--scope-only');
async function check(name, operation) {
  if (selectedScope && !['only exact request', 'plan/request', 'health-only', 'catalog admission', 'scoped catalog'].some(prefix => name.startsWith(prefix))) return;
  await operation(); console.log(`ok ${++groups} - ${name}`); }
await check('only exact request/effect/file pins admitted offline, partial case source remains dispatch-blocked', () => {
  const result = admit({ ...input, root });
  assert.equal(result.plan.cases.length, CASES.length);
  assert.equal(result.plan.cases.every(c => c.command === null), true);
});
await check('unsigned/self-approved or embedded trust anchor cannot authorize a request', () => {
  rejects({ trustedPublicKey: undefined }, 'COORDINATOR_TRUST_ANCHOR_MISSING');
  rejects({ envelope: { ...signed(payload), approved: true } }, 'REVIEW_ENVELOPE_SHAPE');
  rejects({ envelope: { payload, signature: Buffer.alloc(64).toString('base64') } }, 'REVIEW_SIGNATURE_INVALID');
  rejects({ trustedKeySha256: 'c'.repeat(64) }, 'COORDINATOR_TRUST_ANCHOR_MISSING');
});
await check('plan/request/inventory byte substitution and expired admission are rejected', () => {
  rejects({ planBytes: Buffer.from('{}') }, 'REVIEW_BINDING_MISMATCH');
  rejects({ inventoryBytes: Buffer.from('{}') }, 'INVENTORY_BYTES_MISMATCH');
  rejects({ now: now + 700000 }, 'REVIEW_EXPIRED_OR_OVERLONG');
  const r = { ...request, live_default: 'OPEN' };
  rejects({ requestBytes: Buffer.from(JSON.stringify(r)) }, 'REQUEST_VERSION');
});
await check('arbitrary entrypoint, SQL/shell hooks, effects and connection expansion rejected', () => {
  for (const r of [{ ...request, entrypoint: '../../shell.sh' }, { ...request, sql: 'select true' },
    { ...request, effects: [...request.effects, 'install'] }, { ...request, limits: { ...request.limits, max_connections: 100 } }]) {
    assert.throws(() => validateRequest(r));
  }
});
await check('health-only or unreviewed native installation and open mapping/label gates rejected', () => {
  for (const delta of [{ installation: { ...payload.installation, lineage: [] } },
    { decisions: { ...payload.decisions, save_host_mapping: false } },
    { decisions: { ...payload.decisions, neutral_label: false } },
    { target: { ...payload.target, synthetic_only: false } }]) {
    const p = { ...payload, ...delta }; assert.throws(() => admit({ ...input, envelope: signed(p) }));
  }
});
await check('remote/hosted/system DB, observer admin and unchecked URL options rejected', () => {
  for (const value of ['postgres://x@production.example/docs_ce012_0123456789abcdef',
    'postgres://x@127.0.0.1/postgres', 'postgres://x@127.0.0.1/docs_ce012_0123456789abcdef?options=unsafe']) {
    assert.throws(() => localUrl(value, 'db'));
  }
  const p = { ...payload, target: { ...payload.target, observer_role: 'service_role' } };
  rejects({ envelope: signed(p) }, 'OBSERVER_IDENTITY_UNREVIEWED');
});
await check('real entrypoint CLI fails closed before imports/network without coordinator admission', () => {
  const command = 'scripts/docs-ce012-live-connection-v1/run.mjs';
  for (const args of [[], ['--run'], ['--exec', 'anything']]) {
    const child = spawnSync(process.execPath, [command, ...args], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(child.status, 2, child.stderr);
    const result = JSON.parse(child.stdout); assert.equal(result.result, 'BLOCKED');
    assert.equal(result.live_proof, 'NOT_RUN_NOT_PASS');
  }
});
await check('source drift rejected by file pins without reading credentials or executing product', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'docs-ce012-admission-'));
  try {
    writeFileSync(path.join(temporary, 'package.json'), '{}');
    assert.throws(() => admit({ ...input, root: temporary }));
  } finally { rmSync(temporary, { recursive: true }); }
});
await check('catalog admission stops on mismatched physical identity or absent native installation', async () => {
  const identity = { ...payload.target, session_role: payload.target.observer_role, version: 170000, read_only: 'on' };
  let calls = 0;
  const observer = { async query() { calls++; return { rows: [calls === 1 ? identity
    : { native: false, safety: false, documents: false, guides: false }] }; } };
  await assert.rejects(() => preflight(observer, payload, closure), e => e.code === 'NATIVE_INSTALLATION_MISSING');
  assert.equal(calls, 2);
  await assert.rejects(() => preflight({ query: async () => ({ rows: [{ ...identity, database_oid: '999' }] }) }, payload, closure),
    e => e.code === 'TARGET_IDENTITY_MISMATCH');
});
await check('scoped catalog substitution and writable/filtered observer cannot pass installation admission', async () => {
  for (const stage of ['catalog', 'acl', 'sequence']) {
    const altered = structuredClone(fixture.catalog);
    if (stage === 'catalog') altered.digests.functions = 'b'.repeat(64);
    const base = observerFixture(payload, altered);
    const observer = { async query(...args) {
      const result = await base.query(...args);
      if (base.calls === 5 && stage === 'acl') result.rows[0].writable = true;
      if (base.calls === 6 && stage === 'sequence') result.rows[0].readable = false;
      return result;
    } };
    await assert.rejects(() => preflight(observer, payload, closure), e => e.code === ({ catalog: 'SCOPED_CATALOG_CHANGED',
      acl: 'OBSERVER_COVERAGE_OR_ACL_MISSING', sequence: 'OBSERVER_SEQUENCE_COVERAGE_MISSING' })[stage]);
  }
});
function fakeMeasurement({ sharedPid = false } = {}) {
  let changed = false, tupleWrites = false, sequenceChanged = false;
  const scope = { async query(sql) {
    if (sql.includes('pg_backend_pid')) return { rows: [{ pid: 1 }] };
    assert.equal(sql, XACT_STATS_SQL);
    return { rows: [{ inserted: tupleWrites ? '1' : '0', updated: '0', deleted: '0' }] };
  } };
  const observer = { async query(sql) {
    if (sql.includes('pg_backend_pid')) return { rows: [{ pid: sharedPid ? 1 : 2 }] };
    if (sql.startsWith('select')) return { rowCount: TABLES.length + SEQUENCES.length,
      rows: [...TABLES, ...SEQUENCES].map(relation => ({ relation, count: '1', digest: changed || (sequenceChanged && relation === 'audit.events_id_seq') ? 'after' : 'before' })) };
    return { rows: [] };
  } };
  return { scope, observer, stageWrite() { tupleWrites = true; }, durableWrite() { changed = true; }, sequenceWrite() { sequenceChanged = true; } };
}
await check('measurement rejects same connection, staged writes and separately visible durable changes', async () => {
  const same = fakeMeasurement({ sharedPid: true });
  await assert.rejects(() => measure(same.scope, same.observer, 'synthetic', async () => null), e => e.code === 'INDEPENDENT_OBSERVER_REQUIRED');
  for (const type of ['stageWrite', 'durableWrite', 'sequenceWrite']) {
    const f = fakeMeasurement();
    await assert.rejects(() => measure(f.scope, f.observer, 'synthetic', async () => { f[type](); }),
      e => e.code === (type === 'stageWrite' ? 'PROVIDER_STAGED_TUPLE_WRITE' : 'PROVIDER_DURABLE_WRITE_OBSERVED'));
  }
});
console.log(JSON.stringify({ contract: 'documents-ce012-live-admission-test.v1', groups,
  result: 'PASS_OFFLINE_ADMISSION_ONLY', postgres_auth_roles_locks_retry: 'NOT_RUN_NOT_PASS',
  prior_provider_9_plus_7: 'NOT_RERUN' }));
