// Only new Documents08 result-adoption tests. Actual pinned owner modules; transport/model only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/contracts/documents-ce012-core11-adoption-v1/manifest.json', import.meta.url)));
const CORE = '847fa09039578eace8361ed00a4eedf815e03ded', CE = '0191e0415297a76f3073cbeef7396f4799d3a25c';
const BASE = '4c1f1ec70195acf6ed5e94641ea7a3a160f977c4';
assert.equal(manifest.base, BASE); assert.equal(manifest.core_port, CORE); assert.equal(manifest.ce_r1, CE);
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = b => createHash('sha256').update(b).digest('hex');
const sources = new Map();
for (const p of manifest.source_files) {
  const bytes = p.commit === 'LOCAL' ? readFileSync(path.join(root, p.path)) : git('show', `${p.commit}:${p.path}`);
  assert.equal(bytes.length, p.bytes); assert.equal(hash(bytes), p.sha256);
  assert.equal(execFileSync('git', ['hash-object', '--stdin'], { cwd: root, input: bytes }).toString().trim(), p.git_blob);
  assert.ok(!sources.has(p.path), 'Ambiguous source mapping'); sources.set(p.path, bytes.toString('utf8'));
}
const source = p => { assert.ok(sources.has(p), `Unpinned source: ${p}`); return sources.get(p); };
if (process.argv.includes('--typecheck')) {
  // Virtual official-source overlay, no copying/editing owner files on disk.
  const options = { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true,
    strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] };
  const host = ts.createCompilerHost(options), originalGet = host.getSourceFile.bind(host), originalExists = host.fileExists.bind(host);
  const rel = p => path.relative(root, p).split(path.sep).join('/');
  host.fileExists = p => sources.has(rel(p)) || originalExists(p);
  host.getSourceFile = (p, language, onError, fresh) => sources.has(rel(p))
    ? ts.createSourceFile(p, sources.get(rel(p)), language) : originalGet(p, language, onError, fresh);
  const program = ts.createProgram([path.join(root, 'src/lib/customer/documents-ce012-target-disclosure-port-v1.ts')], options, host);
  const errors = ts.getPreEmitDiagnostics(program);
  if (errors.length) { console.error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: p => p, getCurrentDirectory: () => root, getNewLine: () => '\n',
  })); process.exitCode = 1; } else console.log('PASS_SCOPED_ES5_TYPECHECK_PINNED_OWNER_SOURCE_OVERLAY');
} else {
  const require = createRequire(import.meta.url), cache = new Map();
  function load(p) {
    if (cache.has(p)) return cache.get(p).exports;
    const m = { exports: {} }; cache.set(p, m);
    const js = ts.transpileModule(source(p), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', js)(n => n.startsWith('.')
      ? load(path.posix.normalize(path.posix.join(path.posix.dirname(p), n.endsWith('.ts') ? n : `${n}.ts`))) : require(n), m, m.exports);
    return m.exports;
  }
  const core = load('src/lib/core/postgres-transaction-host-v1.ts');
  const writer = load('src/lib/community/experience-guide-save-writer-v1.ts');
  const docs = load('src/lib/customer/documents-ce012-reference-provider-v1.ts');
  const ce = load('src/lib/community/experience-guide-command-contract.ts');
  const { readCoreCe012CombinedRelationV1: combined, CORE_CE012_SAVE_RELATION_SQL: ceSql } = load('src/lib/core/ce012-combined-stored-relation-v1.ts');
  const { CORE_CE012_STORED_RELATION_SQL: coreSql, CORE_CE012_STORED_EXPIRY_SQL: expirySql } = load('src/lib/core/ce012-stored-relation-v1.ts');
  const { coreTransactionReplayReceiptHashV1: receiptHash } = load('src/lib/core/transaction-replay-provider-hook-v1.ts');
  const corePort = load('src/lib/core/ce012-terminal-authority-port-v1.ts');
  const api = load('src/lib/customer/documents-ce012-target-disclosure-port-v1.ts');
  const SQL = corePort.CORE_CE012_TERMINAL_SQL;
  // Reuse ONLY official09 fixture definitions, then official10 saved-case SQL
  // overrides. Neither original suite's check()/test bodies execute.
  const original09 = source('scripts/test-core-ce012-writer-joint-review-09.mjs');
  const prefix = original09.slice(original09.indexOf('const id=n=>'), original09.indexOf('const findings='));
  assert.ok(prefix.includes('function fixture()') && !prefix.includes('await check('));
  const helpers = new Function('load', 'core', 'writer', 'docs', 'ce', 'combined', 'ceSql', 'coreSql', 'expirySql', 'receiptHash', 'assert',
    prefix + '\nreturn {fixture,command,request,id,ids};')(load, core, writer, docs, ce, combined, ceSql, coreSql, expirySql, receiptHash, assert);
  const { fixture, command, request, id, ids } = helpers;
  const norm = q => q.replace(/\s+/g, ' ').trim(); const result = rows => ({ rows, rowCount: rows.length });
  const original10 = source('scripts/test-core-ce012-terminal-authority-port-10.mjs');
  const savedDefinition = original10.slice(original10.indexOf('async function saved(unknown=false)'), original10.indexOf('async function run('));
  const saved = new Function('fixture', 'command', 'writer', 'docs', 'core', 'SQL', 'result', 'norm', 'ids', 'id', 'assert',
    savedDefinition + '\nreturn saved;')(fixture, command, writer, docs, core, SQL, result, norm, ids, id, assert);

  const original11 = source('scripts/test-core-host-terminal-lifecycle-11.mjs');
  const setupDefinition = original11.slice(original11.indexOf('async function setup()'), original11.indexOf('function next('));
  const setup = new Function('env', 'core', 'assert', setupDefinition + '\nreturn setup;')({ saved }, core, assert);
  const nextDefinition = original11.slice(original11.indexOf('function next('), original11.indexOf('function provider('));
  const next = new Function('env', 'writer', nextDefinition + '\nreturn next;')({ command }, writer);
  let groups = 0;
  async function check(name, fn) { await fn(); console.log(`ok ${++groups} - ${name}`); }
  const info = core.coreHostTerminalLifecycleV1;
  const bytes = value => Buffer.from(JSON.stringify(value), 'utf8');
  function closed(r, code) {
    assert.equal(r.status, 'not_ready'); assert.equal(r.projection, null);
    assert.equal(r.host_binding, 'UNBOUND'); assert.equal(r.action_authorization, 'not_evaluated');
    assert.equal(r.code, code); assert.doesNotMatch(JSON.stringify(r), /safe_label|document_id|receipt_id|Caller|PRIVATE/);
  }
  async function captured(options = {}) {
    const x = await setup(), p = writer.createCe012SaveWriterProviderV1(x.guide, docs);
    let port, observation;
    const before = structuredClone(x.f.writes), commits = x.f.commits;
    const r = await x.f.host.execute(x.cmd, { ...p, terminal_checkpoint: 'core-ce012-host-terminal.v1',
      async validateReplay(scope, c, a, receipt) {
        port = api.createDocumentsCe012TargetDisclosurePortV1(scope, request(x));
        const replay = await p.validateReplay(port.scope, c, a, receipt);
        const observed = await port.observe(); assert.equal(observed.documents_status, 'observed');
        observation = observed.observation;
        if (options.laterWait) await port.scope.query('select clock_timestamp()::text as now');
        return replay;
      } });
    assert.equal(r.status, 'exact_replay', JSON.stringify(r));
    assert.equal(info(r).settlement, 'replay_rolled_back');
    assert.deepEqual(x.f.writes, before); assert.equal(x.f.commits, commits);
    return { ...x, port, observation, r };
  }
  await check('real Core11 result identity and bytes correlate only known fields; joint binding stays NOT_READY', async () => {
    const x = await captured(); try {
      assert.equal(info(x.r).observation, 'sealed_and_closed');
      assert.equal(info(x.r).response_sha256, hash(bytes(x.r)));
      assert.equal(info(x.r).attempt, 1); assert.equal(info(x.r).database_transaction_id, String(100 + x.f.attempts));
      closed(x.port.reconcileCore11Replay(x.observation, x.r, bytes(x.r)), 'JOINT_REGISTRATION_REQUIRED');
    } finally { x.port.close(); }
  });
  await check('forged host result, JSON metadata and copied Docs token cannot mint a relationship', async () => {
    const x = await captured(); try {
      for (const fake of [structuredClone(x.r), { ...x.r, lifecycle: info(x.r), committed: true }, {}]) {
        closed(x.port.reconcileCore11Replay(x.observation, fake, bytes(x.r)), 'HOST_RESULT_UNRECOGNIZED');
      }
      for (const token of [{ ...x.observation }, JSON.parse(JSON.stringify(x.observation)), null]) {
        closed(x.port.reconcileCore11Replay(token, x.r, bytes(x.r)), 'INVALIDATED_CANDIDATE');
      }
      const detached = x.port.reconcileCore11Replay;
      closed(detached.call({ inspectPrivate: () => ({ status: 'private_candidate_not_ready' }) },
        { ...x.observation }, x.r, bytes(x.r)), 'INVALIDATED_CANDIDATE');
    } finally { x.port.close(); }
  });
  await check('exact immutable host bytes required; CE wrapper/newline/truncation are not that response', async () => {
    const x = await captured(); try {
      for (const b of [Buffer.from(JSON.stringify(x.r) + '\n'), bytes(x.r.receipt), bytes({ receipt: x.r.receipt, status: 'exact_replay' }), bytes(x.r).subarray(1)]) {
        closed(x.port.reconcileCore11Replay(x.observation, x.r, b), 'RESPONSE_BYTES_MISMATCH');
      }
      closed(x.port.reconcileCore11Replay(x.observation, x.r, Buffer.from(bytes(x.r))), 'JOINT_REGISTRATION_REQUIRED');
    } finally { x.port.close(); }
  });
  await check('different actual replay attempt/DBtx cannot be substituted for the candidate attempt', async () => {
    const x = await captured(); try {
      const p = writer.createCe012SaveWriterProviderV1(x.guide, docs);
      const later = await x.f.host.execute(x.cmd, { ...p, terminal_checkpoint: 'core-ce012-host-terminal.v1' });
      assert.equal(later.status, 'exact_replay'); assert.notEqual(info(later).database_transaction_id, info(x.r).database_transaction_id);
      closed(x.port.reconcileCore11Replay(x.observation, later, bytes(later)), 'BINDING_MISMATCH');
    } finally { x.port.close(); }
  });
  await check('a later facade wait invalidates candidate before closed host metadata is consumed', async () => {
    const x = await captured({ laterWait: true }); try {
      assert.equal(info(x.r).settlement, 'replay_rolled_back');
      closed(x.port.reconcileCore11Replay(x.observation, x.r, bytes(x.r)), 'INVALIDATED_CANDIDATE');
    } finally { x.port.close(); }
  });
  await check('post-settlement attempted query and close cannot revive a historical candidate', async () => {
    const x = await captured();
    await assert.rejects(x.port.scope.query('select clock_timestamp()::text as now'));
    closed(x.port.reconcileCore11Replay(x.observation, x.r, bytes(x.r)), 'INVALIDATED_CANDIDATE');
    x.port.close(); closed(x.port.reconcileCore11Replay(x.observation, x.r, bytes(x.r)), 'INVALIDATED_CANDIDATE');
  });
  await check('actual committed and UNKNOWN Core11 results are negative inputs, never a read-only positive', async () => {
    for (const unknown of [false, true]) {
      const x = await captured(); try {
        const c = next(x); x.f.lostCommit = unknown;
        // Negative result fixture through actual owner code, in MEMORY ONLY.
        // The Docs adopter never invokes host.execute or performs these writes.
        const r = await x.f.host.execute(c.cmd, { ...writer.createCe012SaveWriterProviderV1(c.guide, docs),
          terminal_checkpoint: 'core-ce012-host-terminal.v1' });
        assert.equal(r.status, unknown ? 'unknown_commit' : 'committed');
        assert.ok(info(r)); const before = structuredClone(x.f.writes);
        closed(x.port.reconcileCore11Replay(x.observation, r, bytes(r)), 'REPLAY_SETTLEMENT_REQUIRED');
        assert.deepEqual(x.f.writes, before);
      } finally { x.port.close(); }
    }
  });
  await check('expired C03 produces denial without reservation; adapter has no execute/fallback path', async () => {
    const x = await captured(); try {
      x.f.expiry = '2000-01-01T00:00:00.000000Z';
      const before = structuredClone(x.f.writes), p = writer.createCe012SaveWriterProviderV1(x.guide, docs);
      const r = await x.f.host.execute(x.cmd, { ...p, terminal_checkpoint: 'core-ce012-host-terminal.v1',
        async validateProviders() { assert.fail('fresh path forbidden for expired C03'); },
        async mutate() { assert.fail('mutation forbidden'); } });
      assert.equal(r.status, 'denied'); assert.deepEqual(x.f.writes, before);
      closed(x.port.reconcileCore11Replay(x.observation, r, bytes(r)), 'REPLAY_SETTLEMENT_REQUIRED');
    } finally { x.port.close(); }
  });
  await check('missing C03 exposes generic-host fresh fallback; reject at provider entry, never reserve', async () => {
    const x = await captured(); try {
      x.f.ledgers.delete(x.key); let enteredFresh = false;
      const before = structuredClone(x.f.writes), p = writer.createCe012SaveWriterProviderV1(x.guide, docs);
      const r = await x.f.host.execute(x.cmd, { ...p, terminal_checkpoint: 'core-ce012-host-terminal.v1',
        async validateProviders() { enteredFresh = true; throw Error('READ_ONLY_REPLAY_REQUIRED'); },
        async mutate() { assert.fail('mutation forbidden'); } });
      assert.equal(enteredFresh, true); assert.equal(r.status, 'denied'); assert.deepEqual(x.f.writes, before);
      closed(x.port.reconcileCore11Replay(x.observation, r, bytes(r)), 'REPLAY_SETTLEMENT_REQUIRED');
      // This is an OPEN Core API gap, not acceptance of a replay-only dispatcher.
    } finally { x.port.close(); }
  });
  assert.equal(existsSync(path.join(root, 'src/lib/core/ce012-host-terminal-checkpoint-v1.ts')), false);
  console.log(JSON.stringify({ result: 'PASS_NEW_CORE11_ADOPTION_COUNTEREXAMPLES_ONLY', groups,
    joint_registration: 'CORE_EXTENSION_REQUIRED', read_only_replay_dispatch: 'CORE_EXTENSION_REQUIRED',
    host_binding: 'UNBOUND', projection: null, native_sql_pg_auth: 'NOT_RUN_NOT_PASS' }));
}
