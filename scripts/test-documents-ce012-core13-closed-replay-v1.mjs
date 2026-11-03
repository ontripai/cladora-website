// Only new Documents09 closed-registration consumption tests. Actual pinned owner modules; transport/model only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/contracts/documents-ce012-core13-closed-replay-v1/manifest.json', import.meta.url)));
const CORE = '1971770a7ee92c2020387c5222b0c7da03a552d8', CE = '0191e0415297a76f3073cbeef7396f4799d3a25c';
const BASE = '6f69db12455b9c750eae0c2a24c7a7c7faa16d3d';
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
  const program = ts.createProgram([path.join(root, 'src/lib/customer/documents-ce012-core13-closed-replay-adopter-v1.ts')], options, host);
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
  const api = load('src/lib/customer/documents-ce012-core13-closed-replay-adopter-v1.ts');
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

  const read = api.readDocumentsCore13ClosedReplayV1;
  const docsTarget = load('src/lib/customer/documents-ce012-target-disclosure-port-v1.ts');
  const joint = core.coreHostJointReplaySealV1, lifecycle = core.coreHostTerminalLifecycleV1;
  const wire = r => Buffer.from(JSON.stringify(r), 'utf8');
  const provider = x => ({ ...writer.createCe012SaveWriterProviderV1(x.guide, docs),
    terminal_checkpoint: 'core-ce012-host-terminal.v1' });
  const expectation = (x, r) => ({ contract: api.DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1,
    original: request(x), execution: { attempt: joint(r).attempt, backend_pid: joint(r).backend_pid,
      database_transaction_id: joint(r).database_transaction_id } });
  let groups = 0;
  async function check(name, fn) { await fn(); console.log(`ok ${++groups} - ${name}`); }
  function closed(value, code) {
    assert.equal(value.status, 'not_ready'); assert.equal(value.projection, null); assert.equal(value.runtime_binding, null);
    assert.equal(value.current_authority, 'not_evaluated'); assert.equal(value.reusable_as_command_authority, false);
    if (code) assert.equal(value.code, code);
    assert.doesNotMatch(JSON.stringify(value), /document_id|safe_label|Caller|PRIVATE|candidate_id|receipt_id/);
  }
  async function sealed() {
    const x = await setup(), writes = structuredClone(x.f.writes), commits = x.f.commits;
    const r = await x.f.host.executeReplayOnly(x.cmd, provider(x));
    assert.equal(r.status, 'exact_replay', JSON.stringify(r)); assert.ok(joint(r));
    assert.deepEqual(x.f.writes, writes); assert.equal(x.f.commits, commits);
    return { ...x, r, expected: expectation(x, r) };
  }
  await check('real Core13 registered replay + lifecycle + bytes + receipt/target tuple stops at official matcher gap', async () => {
    const x = await sealed(), queries = x.f.trace.length, writes = structuredClone(x.f.writes);
    assert.equal(lifecycle(x.r).settlement, 'replay_rolled_back'); assert.equal(joint(x.r).registration, 'closed_opaque_candidate');
    closed(read(x.r, wire(x.r), x.expected), 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
    assert.equal(x.f.trace.length, queries); assert.deepEqual(x.f.writes, writes);
    assert.equal(api.DOCUMENTS_CORE13_CLOSED_REPLAY_RUNTIME_BINDING, null);
  });
  await check('copied result, caller lifecycle/joint JSON and flags cannot mint registered identity', async () => {
    const x = await sealed();
    for (const fake of [structuredClone(x.r), { ...x.r, joint: joint(x.r), lifecycle: lifecycle(x.r), committed: true }, {}]) {
      closed(read(fake, wire(x.r), x.expected), 'UNRECOGNIZED_RESULT');
    }
    closed(read(x.r, wire(x.r), { ...x.expected, verifier: () => true }), 'INVALID_EXPECTATION');
  });
  await check('whole host bytes/hash exact; newline, CE wrapping and reordered/truncated wire reject', async () => {
    const x = await sealed();
    for (const b of [Buffer.from(JSON.stringify(x.r) + '\n'), wire(x.r.receipt),
      wire({ receipt: x.r.receipt, status: 'exact_replay' }), wire(x.r).subarray(1)]) {
      closed(read(x.r, b, x.expected), 'RESPONSE_BYTES_MISMATCH');
    }
    closed(read(x.r, Uint8Array.from(wire(x.r)), x.expected), 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
  });
  await check('expected attempt/backend/DBtx mismatch or another actual replay rejects', async () => {
    const x = await sealed();
    for (const [k, v] of [['attempt', 2], ['backend_pid', 81], ['database_transaction_id', '999']]) {
      const expected = structuredClone(x.expected); expected.execution[k] = v;
      closed(read(x.r, wire(x.r), expected), 'EXECUTION_MISMATCH');
    }
    const later = await x.f.host.executeReplayOnly(x.cmd, provider(x)); assert.ok(joint(later));
    assert.notEqual(joint(later).candidate_id, joint(x.r).candidate_id);
    closed(read(later, wire(later), x.expected), 'EXECUTION_MISMATCH');
  });
  await check('original command/receipt/hash/Context/target/version drift never passes as a matched binding', async () => {
    const x = await sealed();
    for (const mutate of [v => { v.original.expected.core_receipt_id = id(88); },
      v => { v.original.expected.core_receipt_hash = 'a'.repeat(64); },
      v => { v.original.command.actor_id = id(88); },
      v => { v.original.command.context_id = id(88); },
      v => { v.original.guide_command.payload.document_target.document_version = 4; },
      v => { v.original.guide_command.payload.document_target.document_version_id = id(88); },
      v => { v.original.command.provider_source_ids = []; }]) {
      const expected = structuredClone(x.expected); mutate(expected);
      const r = read(x.r, wire(x.r), expected); closed(r); assert.notEqual(r.code, 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
    }
  });
  await check('private CE receipt identity is unexposed: mismatch remains explicitly unverified, never guessed', async () => {
    const x = await sealed(), expected = structuredClone(x.expected);
    expected.original.expected.ce_save_receipt_id = id(88);
    assert.notEqual(expected.original.expected.ce_save_receipt_id, x.f.ces.get(x.key).ce_receipt.receipt_id);
    closed(read(x.r, wire(x.r), expected), 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
    assert.equal('ce_receipt_id' in joint(x.r), false); assert.equal('binding' in joint(x.r), false);
  });
  await check('equal older external candidate is not the host-created candidate; API has no token substitution', async () => {
    const x = await setup(), p = provider(x); let port, token, expectedTarget;
    const r = await x.f.host.executeReplayOnly(x.cmd, { ...p, async validateReplay(scope, c, a, receipt) {
      port = docsTarget.createDocumentsCe012TargetDisclosurePortV1(scope, request(x));
      const replay = await p.validateReplay(port.scope, c, a, receipt);
      token = (await port.observe()).observation;
      expectedTarget = port.inspectPrivate(token).private_projection.target;
      return replay;
    } });
    assert.equal(r.status, 'exact_replay'); assert.deepEqual(joint(r).target, expectedTarget);
    const expected = expectation(x, r);
    closed(read(r, wire(r), { ...expected, candidate: token }), 'INVALID_EXPECTATION');
    closed(read(r, wire(r), { ...expected, candidate_id: joint(r).candidate_id }), 'INVALID_EXPECTATION');
    port.close(); closed(read(r, wire(r), expected), 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
  });
  await check('actual UNKNOWN rollback ACK and actual new COMMIT have no usable closed replay record', async () => {
    const x = await sealed();
    x.f.beforeQuery = async q => { if (q === 'rollback') throw Object.assign(Error('ACK loss'), { code: '08006' }); };
    const unknown = await x.f.host.executeReplayOnly(x.cmd, provider(x));
    assert.equal(lifecycle(unknown).settlement, 'unknown'); assert.equal(joint(unknown), null);
    closed(read(unknown, wire(unknown), x.expected), 'UNRECOGNIZED_RESULT');
    x.f.beforeQuery = null;
    const c = next(x), committed = await x.f.host.execute(c.cmd, { ...writer.createCe012SaveWriterProviderV1(c.guide, docs),
      terminal_checkpoint: 'core-ce012-host-terminal.v1' });
    assert.equal(committed.status, 'committed'); assert.equal(joint(committed), null);
    closed(read(committed, wire(committed), x.expected), 'UNRECOGNIZED_RESULT');
  });
  assert.equal(existsSync(path.join(root, 'src/lib/core/ce012-documents-joint-candidate-v1.ts')), false);
  console.log(JSON.stringify({ result: 'PASS_NEW_DOCS09_CONTROLLED_ADOPTER_ONLY', groups,
    runtime_binding: null, projection: null, private_binding_matcher: 'REQUIRED',
    accepted_core23plus33: 'NOT_RERUN', native_sql_pg_auth: 'NOT_RUN_NOT_PASS' }));
}
