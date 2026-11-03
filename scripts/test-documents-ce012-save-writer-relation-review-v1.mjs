// New Docs coupling counterexamples only. No SQL parser/driver, Auth or native proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/contracts/documents-ce012-save-writer-relation-review-v1/manifest.json', import.meta.url)));
const CE = 'd767e84a6d8489ee731f64eb5c8b38f29d35a7fe';
const CORE = 'ef69fa82e19ab269701d6df9abd7bdfd67e3e50e';
const DOCS = '5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa';
assert.equal(manifest.base, DOCS); assert.equal(manifest.ce_candidate, CE); assert.equal(manifest.core_reader, CORE);
const git = (...args) => execFileSync('git', args, { cwd: root });
const sha = value => createHash('sha256').update(value).digest('hex');
const pins = new Map(manifest.source_files.map(p => [`${p.commit}:${p.path}`, p]));
function pinned(ref, p) {
  const pin = pins.get(`${ref}:${p}`); assert.ok(pin, 'Unpinned dependency');
  const bytes = git('show', `${ref}:${p}`);
  assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256);
  assert.equal(git('rev-parse', `${ref}:${p}`).toString().trim(), pin.git_blob);
  return bytes.toString('utf8');
}
for (const p of manifest.source_files) pinned(p.commit, p.path);
const reviewSource = p => pinned(p.startsWith('src/lib/core/') ? CORE
  : p.startsWith('src/lib/customer/documents-') ? DOCS : CE, p);
// Reuse ONLY the pinned CE transport model definitions, not its 27 checks.
// Actual CE writer/executor + Core host + Docs factory/selector are loaded.
// All source imports use the fixed owner commits above; SQL answers remain fixtures.
const original = pinned(CE, 'scripts/test-ce012-save-writer-v1.mjs');
const boundary = original.indexOf("const relationOnly="); assert.ok(boundary > 0);
let definitions = original.slice(0, boundary);
const sourceStart = definitions.indexOf('const source=p=>');
const sourceEnd = definitions.indexOf('\nfunction load(p)', sourceStart);
assert.ok(sourceStart > 0 && sourceEnd > sourceStart);
definitions = definitions.slice(0, sourceStart) + 'const source=reviewSource;' + definitions.slice(sourceEnd);
definitions = definitions.replace('const require=createRequire', 'const transportRequire=createRequire').replace(':require(n)', ':transportRequire(n)');
definitions = definitions.replaceAll('import.meta.url', JSON.stringify(new URL('./test-ce012-save-writer-v1.mjs', import.meta.url).href));
const compiled = ts.transpileModule(`${definitions}\nmodule.exports={fixture,command,writer,core,docs,load,id,actor,tenant,workspace,context,now};`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const model = { exports: {} };
new Function('require', 'module', 'exports', 'reviewSource', compiled)(createRequire(import.meta.url), model, model.exports, reviewSource);
const { fixture, command, writer, load, id, actor, tenant, workspace } = model.exports;
const reader = load('src/lib/core/ce012-stored-relation-v1.ts');
const normalize = sql => sql.replace(/\s+/g, ' ').trim();
const row = rows => ({ rows, rowCount: rows.length });
let count = 0;
async function check(name, fn) { await fn(); console.log(`ok ${++count} - ${name}`); }
async function savedCase() {
  const f = fixture(), { cmd, guide } = command();
  // Necessary modeled setup for NEW read-coupling assertions, not a baseline rerun.
  const result = await f.host.execute(cmd, writer.createCe012SaveWriterProviderV1(guide, model.exports.docs));
  assert.equal(result.status, 'committed');
  const client = await f.pool.connect();
  const observed = { expired: false, queries: [], writes: structuredClone(f.writes) };
  const scope = { transaction_id: cmd.transaction_id, database_transaction_id: '777',
    tenant_id: tenant, workspace_id: workspace, actor_id: actor, attempt: 1,
    async query(sql, values) {
      observed.queries.push(normalize(sql));
      if (sql === reader.CORE_CE012_STORED_RELATION_SQL) return row([{
        tenant_id: tenant, actor_id: f.ledger.actor_id, key: f.ce.canonical_key,
        request_hash: f.ledger.request_hash, response_ref: f.ledger.response_ref,
        expires_at: '2026-11-02T18:00:00.000000Z', database_transaction_id: '777',
        observed_actor_id: scope.actor_id, isolation: 'serializable',
      }]);
      if (sql === reader.CORE_CE012_STORED_EXPIRY_SQL) return row([{
        unexpired: !observed.expired, database_transaction_id: '777',
        observed_actor_id: scope.actor_id, isolation: 'serializable',
      }]);
      return client.query(sql, values);
    } };
  const request = { contract: reader.CORE_CE012_STORED_RELATION_V1, command: cmd, guide_command: guide,
    expected: { core_receipt_id: result.receipt.receipt_id,
      core_receipt_hash: load('src/lib/core/transaction-replay-provider-hook-v1.ts').coreTransactionReplayReceiptHashV1(result.receipt),
      ce_save_receipt_id: f.ce.ce_receipt.receipt_id,
      receipt_hash_contract: 'core-transaction-replay-provider-receipt.v1' } };
  return { f, cmd, guide, result, observed, scope, request };
}
await check('actual CE relation + Core match still has no combined/disclosure authorization', async () => {
  const x = await savedCase();
  const relation = await writer.readCe012SaveWriterRelationV1(x.scope, x.cmd, x.guide, x.result.receipt);
  const core = await reader.readCoreCe012StoredRelationV1(x.scope, x.request);
  assert.equal(relation.action_authorization, 'not_evaluated'); assert.equal(relation.runtime_binding, null);
  assert.equal(core.core_status, 'matched'); assert.equal(core.status, 'not_ready');
  assert.equal(core.stored_ce_relation, null); assert.equal(core.action_authorization, 'not_evaluated');
  assert.deepEqual(x.f.writes, x.observed.writes);
});
await check('new reader differs from original writer: neither ABI silently substitutes actor', async () => {
  const x = await savedCase(); x.scope.actor_id = id(81);
  const before = x.observed.queries.length;
  await assert.rejects(writer.readCe012SaveWriterRelationV1(x.scope, x.cmd, x.guide, x.result.receipt));
  assert.equal((await reader.readCoreCe012StoredRelationV1(x.scope, x.request)).core_status, 'mismatch');
  assert.equal(x.observed.queries.length, before);
  const changed = structuredClone(x.request); changed.command.actor_id = x.scope.actor_id;
  assert.equal((await reader.readCoreCe012StoredRelationV1(x.scope, changed)).core_status, 'mismatch');
  assert.deepEqual(x.f.writes, x.observed.writes);
});
await check('Core-first then CE wait is not a terminal expiry proof: fresh Core read expires', async () => {
  const x = await savedCase();
  assert.equal((await reader.readCoreCe012StoredRelationV1(x.scope, x.request)).core_status, 'matched');
  const query = x.scope.query.bind(x.scope);
  x.scope.query = async (sql, v) => { if (sql === writer.CE012_SAVE_STORED_SQL) x.observed.expired = true; return query(sql, v); };
  const ce = await writer.readCe012SaveWriterRelationV1(x.scope, x.cmd, x.guide, x.result.receipt);
  assert.equal(ce.action_authorization, 'not_evaluated');
  assert.equal((await reader.readCoreCe012StoredRelationV1(x.scope, x.request)).core_status, 'expired');
  assert.deepEqual(x.f.writes, x.observed.writes);
});
await check('expected CE receipt identity is not yet verified by Core/CE combined mapping', async () => {
  const x = await savedCase(); x.request.expected.ce_save_receipt_id = id(82);
  const core = await reader.readCoreCe012StoredRelationV1(x.scope, x.request);
  const ce = await writer.readCe012SaveWriterRelationV1(x.scope, x.cmd, x.guide, x.result.receipt);
  assert.equal(core.core_status, 'matched'); assert.equal(core.status, 'not_ready');
  assert.notEqual(ce.ce_receipt.receipt_id, x.request.expected.ce_save_receipt_id);
  assert.equal(ce.action_authorization, 'not_evaluated');
});
await check('stored-label counterexample is private integrity-only; original factory label remains neutral', async () => {
  const x = await savedCase(); assert.equal(x.f.ce.ce_receipt.document_target.label, 'Document reference');
  // Deliberately corrupt modeled storage. NOT a reachable INSERT/UPDATE or DDL proof.
  x.f.ce.ce_receipt.document_target.label = 'UNTRUSTED-STORED-LABEL';
  const ce = await writer.readCe012SaveWriterRelationV1(x.scope, x.cmd, x.guide, x.result.receipt);
  assert.equal(ce.ce_receipt.document_target.label, 'UNTRUSTED-STORED-LABEL');
  assert.equal(ce.action_authorization, 'not_evaluated');
  assert.deepEqual(x.f.writes, x.observed.writes);
});
await check('late module-expiry model exposes missing terminal canonical checkpoint; not native revoke proof', async () => {
  const f = fixture(), { cmd, guide } = command();
  const connect = f.pool.connect.bind(f.pool); let late = false, evaluationsAfter = 0;
  f.pool.connect = async () => {
    const c = await connect(), query = c.query.bind(c);
    c.query = async (sql, values) => {
      const q = normalize(sql);
      if (q.includes('from documents.documents d where d.id=')) { late = true; f.allowed = false; }
      if (late && q.includes('check_workspace_native_permission_v2')) evaluationsAfter++;
      return query(sql, values);
    }; return c;
  };
  const result = await f.host.execute(cmd, writer.createCe012SaveWriterProviderV1(guide, model.exports.docs));
  assert.equal(late, true); assert.equal(evaluationsAfter, 0); assert.equal(result.status, 'committed');
  // This demonstrates model/source call order only. Epoch-lock participation,
  // actual clock expiry, native session/COMMIT and durable effects are NOT_RUN.
});
await check('proposal/immutable lineage and cleanup limits are source-pinned, not SQL-validated', async () => {
  const proposal = pinned(CE, 'supabase/proposals/ce012_save_writer_relation_v1.sql');
  assert.match(proposal, /ce012_save_writer_review_only/); assert.match(proposal, /deferrable initially deferred/);
  assert.match(proposal, /security invoker set search_path=pg_catalog/);
  assert.match(proposal, /before update or delete/); assert.match(proposal, /force row level security/);
  assert.doesNotMatch(proposal, /\bgrant\s+(?:all|select|insert|execute)/i);
  const migration = pinned(DOCS, 'supabase/migrations/20261014082947_experience_guide_storage_lifecycle_v1.sql');
  assert.match(migration, /v\.id=new\.document_version_id and v\.document_id=new\.target_id/);
  assert.match(migration, /v\.tenant_id=new\.tenant_id and d\.workspace_id=new\.workspace_id/);
  assert.match(migration, /raise exception 'ce_guide_content_immutable'/);
  assert.match(proposal, /expired\/deleted the relationship is unavailable/);
  assert.doesNotMatch(proposal, /foreign key[^;]*platform\.idempotency_keys/i);
  assert.equal(reader.CORE_CE012_STORED_RELATION_RUNTIME_BINDING, null);
});
console.log(JSON.stringify({ result: 'PASS_NEW_CONTROLLED_COUPLING_ONLY', groups: count,
  source_files: pins.size, historical_slots: 'BLOCKED_UNCHANGED', combined_reader: 'NOT_READY',
  sql_parser_ddl_trigger_pg_auth: 'NOT_RUN_NOT_PASS' }));
