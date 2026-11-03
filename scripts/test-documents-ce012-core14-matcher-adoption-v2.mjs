// New Documents10 consumer couplings only; not Core88/23+33 suites. Actual pinned owner modules; transport/model only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/contracts/documents-ce012-core14-matcher-adoption-v2/manifest.json', import.meta.url)));
const CORE = '3e9593af25433dcf32042f624731f514d09ec35b', CE = '0191e0415297a76f3073cbeef7396f4799d3a25c';
const BASE = 'f64fa2dacf895fdea698e46ffc178aa0d8270f0e';
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
  sources.set('__docs10_type_abi__.ts', `import type { CoreCe012ClosedBindingExpectationV1 } from './src/lib/core/postgres-transaction-host-v1';\nimport type { DocumentsCe012ClosedReplayExpectationV2 } from './src/lib/customer/documents-ce012-closed-replay-adopter-v2';\ndeclare const docs: DocumentsCe012ClosedReplayExpectationV2;\nexport const actualCoreExpectation: CoreCe012ClosedBindingExpectationV1 = docs.matcher;`);
  const options = { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true,
    strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] };
  const host = ts.createCompilerHost(options), originalGet = host.getSourceFile.bind(host), originalExists = host.fileExists.bind(host);
  const rel = p => path.relative(root, p).split(path.sep).join('/');
  host.fileExists = p => sources.has(rel(p)) || originalExists(p);
  host.getSourceFile = (p, language, onError, fresh) => sources.has(rel(p))
    ? ts.createSourceFile(p, sources.get(rel(p)), language) : originalGet(p, language, onError, fresh);
  const program = ts.createProgram([path.join(root, 'src/lib/customer/documents-ce012-closed-replay-adopter-v2.ts'), path.join(root, '__docs10_type_abi__.ts')], options, host);
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
  const api = load('src/lib/customer/documents-ce012-closed-replay-adopter-v2.ts');
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


  const read = api.readDocumentsCe012ClosedReplayV2;
  const v1 = load('src/lib/customer/documents-ce012-core13-closed-replay-adopter-v1.ts');
  const joint = core.coreHostJointReplaySealV1;
  const wire = r => Buffer.from(JSON.stringify(r), 'utf8');
  const provider = x => ({ ...writer.createCe012SaveWriterProviderV1(x.guide, docs), terminal_checkpoint: 'core-ce012-host-terminal.v1' });
  function expectation(x, r) {
    const j = joint(r), c = structuredClone(x.cmd), row = x.f.ces.get(x.key);
    // EXPLICIT synthetic fixture producer identities, NOT UI/metadata inference.
    return { contract: api.DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2, original: request(x),
      matcher: { contract: core.CORE_CE012_CLOSED_BINDING_MATCHER_V1, command: c, binding: {
        transaction_id: c.transaction_id, database_transaction_id: j.database_transaction_id,
        attempt: j.attempt, backend_pid: j.backend_pid, actor_id: c.actor_id, tenant_id: ids.tenant,
        context_id: c.context_id, workspace_id: c.workspace_id, membership_id: ids.member, command_id: c.command_id,
        canonical_key: x.key, command_hash: hash(JSON.stringify(c)), authority_revision: c.authority_version,
        ce_save_receipt_id: row.ce_receipt.receipt_id, core_receipt_id: r.receipt.receipt_id,
        core_receipt_hash: receiptHash(r.receipt), mutation_id: r.receipt.mutation_id,
        target: { document_id: ids.doc, document_version_id: ids.docVersion, document_version: 3 } } } };
  }
  const x = await setup(), writesBefore = structuredClone(x.f.writes), r = await x.f.host.executeReplayOnly(x.cmd, provider(x));
  assert.equal(r.status, 'exact_replay'); assert.deepEqual(x.f.writes, writesBefore);
  const expected = expectation(x, r), bytes = wire(r);
  let groups = 0;
  async function check(name, fn) { await fn(); console.log(`ok ${++groups} - ${name}`); }
  function consume(value = expected, result = r, body = bytes) {
    const before = { queries: x.f.trace.length, attempts: x.f.attempts, writes: structuredClone(x.f.writes), registration: joint(r) };
    const answer = read(result, body, value);
    assert.equal(x.f.trace.length, before.queries); assert.equal(x.f.attempts, before.attempts);
    assert.deepEqual(x.f.writes, before.writes); assert.equal(joint(r), before.registration);
    assert.equal(answer.status, 'not_ready'); assert.equal(answer.projection, null); assert.equal(answer.current_authority, 'not_evaluated');
    assert.equal(answer.runtime_binding, null); assert.equal(answer.reusable_as_command_authority, false);
    assert.ok(Object.isFrozen(answer)); assert.doesNotMatch(JSON.stringify(answer), /document_id|receipt_id|safe_label|Caller|PRIVATE/);
    return answer;
  }
  const no = (v, result = r, body = bytes) => assert.equal(consume(v, result, body).match, 'NO_MATCH');
  await check('same real host result/bytes with coherent Core+CE receipts yields historical MATCH only', () => {
    assert.equal(api.documentsCe012ClosedReplayExpectationV2Schema.safeParse(expected).success, true);
    assert.equal(core.matchCoreCe012ClosedBindingV1(r, bytes, expected.matcher).match, 'MATCH');
    const value = consume(); assert.equal(value.match, 'MATCH'); assert.equal(value.code, 'HISTORICAL_CLOSED_BINDING_MATCH');
    assert.equal(api.DOCUMENTS_CE012_CLOSED_REPLAY_RUNTIME_BINDING_V2, null);
  });
  await check('only CE receipt changed consistently reaches actual matcher and becomes NO_MATCH', () => {
    const v = structuredClone(expected); v.original.expected.ce_save_receipt_id = id(88); v.matcher.binding.ce_save_receipt_id = id(88);
    assert.equal(api.documentsCe012ClosedReplayExpectationV2Schema.safeParse(v).success, true);
    assert.equal(core.matchCoreCe012ClosedBindingV1(r, bytes, v.matcher).match, 'NO_MATCH'); no(v);
  });
  await check('wrong original CE expectation cannot hide behind correct independently matching matcher input', () => {
    const v = structuredClone(expected); v.original.expected.ce_save_receipt_id = id(88);
    assert.equal(core.matchCoreCe012ClosedBindingV1(r, bytes, v.matcher).match, 'MATCH');
    assert.equal(api.documentsCe012ClosedReplayExpectationV2Schema.safeParse(v).success, false);
    assert.equal(consume(v).code, 'INVALID_EXPECTATION'); no(v);
    const reverse = structuredClone(expected); reverse.matcher.binding.ce_save_receipt_id = id(88); no(reverse);
  });
  await check('two valid but unrelated original and matcher commands cannot return MATCH', () => {
    const v = structuredClone(expected), other = command(2, 1);
    v.original.command = other.cmd; v.original.guide_command = other.guide;
    assert.equal(core.matchCoreCe012ClosedBindingV1(r, bytes, v.matcher).match, 'MATCH'); no(v);
    const commands = structuredClone(expected); commands.matcher.command.input_fingerprint = `sha256:${'a'.repeat(64)}`; no(commands);
  });
  await check('independent command/key/hash/receipt/mutation/scope/target/execution drift rejects at consumer boundary', () => {
    for (const change of [
      v => { v.original.command.actor_id = id(88); },
      v => { v.matcher.binding.canonical_key += '-other'; },
      v => { v.matcher.binding.command_hash = 'a'.repeat(64); },
      v => { v.matcher.binding.core_receipt_id = id(88); },
      v => { v.original.expected.core_receipt_hash = 'a'.repeat(64); },
      v => { v.matcher.binding.mutation_id = id(88); },
      v => { v.matcher.binding.tenant_id = id(88); },
      v => { v.matcher.binding.membership_id = id(88); },
      v => { v.matcher.binding.context_id = id(88); },
      v => { v.matcher.binding.workspace_id = id(88); },
      v => { v.matcher.binding.attempt++; },
      v => { v.matcher.binding.backend_pid++; },
      v => { v.matcher.binding.database_transaction_id = '999'; },
      v => { v.matcher.binding.target.document_id = id(88); },
      v => { v.original.guide_command.payload.document_target.document_version_id = id(88); },
      v => { v.matcher.binding.target.document_version++; },
      v => { v.original.guide_command.expected_guide_version++; },
    ]) { const v = structuredClone(expected); change(v); no(v); }
  });
  await check('coherently recomputed changed command/key/hash/fingerprint remains a different private record', () => {
    const v = structuredClone(expected); v.original.guide_command.payload.title = 'Different synthetic title';
    v.original.guide_command.payload_fingerprint = ce.fingerprintCe012GuideSavePayload(v.original.guide_command);
    v.original.command.input_fingerprint = v.original.guide_command.payload_fingerprint;
    v.original.guide_command.idempotency_key += '-different'; v.original.command.idempotency_key = v.original.guide_command.idempotency_key;
    v.matcher.command = structuredClone(v.original.command);
    v.matcher.binding.canonical_key = `core-tx.v1:${v.matcher.command.workspace_id}:${v.matcher.command.idempotency_key}`;
    v.matcher.binding.command_hash = hash(JSON.stringify(v.matcher.command));
    assert.equal(api.documentsCe012ClosedReplayExpectationV2Schema.safeParse(v).success, true); no(v);
  });
  await check('all required nested fields and strict extra fields fail closed; tenant/member never default or infer', () => {
    const paths = [[], ['original'], ['original', 'command'], ['original', 'guide_command'], ['original', 'expected'],
      ['matcher'], ['matcher', 'command'], ['matcher', 'binding'], ['matcher', 'binding', 'target']];
    const at = (o, p) => p.reduce((v, k) => v[k], o);
    for (const p of paths) {
      for (const k of Object.keys(at(expected, p))) { const v = structuredClone(expected); delete at(v, p)[k]; no(v); }
      const v = structuredClone(expected); at(v, p).allowed = true; no(v);
    }
    for (const k of ['tenant_id', 'membership_id']) for (const value of [null, undefined, '', 'UNKNOWN']) {
      const v = structuredClone(expected); v.matcher.binding[k] = value; no(v);
    }
    no({ ...expected, candidate: joint(r) }); no({ ...expected, verifier: () => true }); no(null); no(JSON.stringify(expected));
  });
  await check('whole host bytes, copied/forged result and foreign invocation cannot become MATCH', async () => {
    for (const body of [Buffer.from(bytes.toString() + '\n'), wire(r.receipt), wire({ receipt: r.receipt, status: 'exact_replay' }), bytes.subarray(1)]) no(expected, r, body);
    for (const fake of [structuredClone(r), { ...r, joint: joint(r), committed: true }, {}, true, null]) no(expected, fake);
    const later = await x.f.host.executeReplayOnly(x.cmd, provider(x)); assert.equal(later.status, 'exact_replay');
    no(expected, later, wire(later));
  });
  await check('actual UNKNOWN rollback settlement is NO_MATCH, never current permission', async () => {
    const y = await setup(); y.f.beforeQuery = async q => { if (q === 'rollback') throw Object.assign(Error('controlled ACK loss'), { code: '08006' }); };
    const unknown = await y.f.host.executeReplayOnly(y.cmd, provider(y));
    assert.equal(core.coreHostTerminalLifecycleV1(unknown).settlement, 'unknown'); no(expected, unknown, wire(unknown));
  });
  await check('v1 remains a distinct unchanged historical matcher-required ABI', () => {
    const j = joint(r), old = { contract: v1.DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1, original: request(x),
      execution: { attempt: j.attempt, backend_pid: j.backend_pid, database_transaction_id: j.database_transaction_id } };
    assert.equal(v1.readDocumentsCore13ClosedReplayV1(r, bytes, old).code, 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
    const wrong = structuredClone(old); wrong.original.expected.ce_save_receipt_id = id(88);
    assert.equal(v1.readDocumentsCore13ClosedReplayV1(r, bytes, wrong).code, 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
    no(old); assert.notEqual(api.DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2, old.contract);
  });
  assert.equal(existsSync(path.join(root, 'src/lib/core/ce012-documents-joint-candidate-v1.ts')), false);
  console.log(JSON.stringify({ result: 'PASS_NEW_DOCS10_CONSUMER_ONLY', groups, runtime_binding: null,
    projection: null, match_is: 'historical_only_not_current_authority', accepted_core88_and23plus33: 'NOT_RERUN',
    assembly_native_sql_pg_auth: 'NOT_RUN_NOT_PASS' }));
}
