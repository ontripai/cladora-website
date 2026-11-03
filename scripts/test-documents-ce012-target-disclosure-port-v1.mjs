// Only new Documents07 tests. Actual pinned owner modules; transport/model only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/contracts/documents-ce012-target-disclosure-port-v1/manifest.json', import.meta.url)));
const CORE = '534be1a3d69a3b36d0f04edc555bf01c3d666842', CE = '0191e0415297a76f3073cbeef7396f4799d3a25c';
const BASE = 'f92d142558b19469e37c0e5b9d6f6f92fc9eb619';
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
  let groups = 0;
  async function check(name, fn) { await fn(); console.log(`ok ${++groups} - ${name}`); }
  async function inside(x, fn, value = request(x)) {
    const before = structuredClone(x.f.writes), p = writer.createCe012SaveWriterProviderV1(x.guide, docs);
    let error, port;
    const outcome = await x.f.host.execute(x.cmd, { ...p, async validateReplay(scope, c, a, r) {
      port = api.createDocumentsCe012TargetDisclosurePortV1(scope, value);
      try {
        try { await fn(port, scope); } catch (e) { error = e; throw e; }
        return await p.validateReplay(port.scope, c, a, r);
      } finally { port.close(); }
    } });
    if (error && !['40001', '57014', '08006'].includes(error.code)) throw error;
    assert.deepEqual(x.f.writes, before); return { outcome, port };
  }
  function closed(r, status) {
    assert.equal(r.status, 'not_ready'); assert.equal(r.projection, null); assert.equal(r.host_binding, 'UNBOUND');
    assert.equal(r.action_authorization, 'not_evaluated');
    if (status) assert.equal(r.documents_status, status);
    if (r.documents_status !== 'observed') assert.equal(r.observation, null);
    assert.doesNotMatch(JSON.stringify(r), /safe_label|Caller label|ce_receipt|object_path|sha256/);
  }
  await check('actual CE R1 -> Core10 -> Docs factory yields private exact target only; host remains unbound', async () => {
    const x = await saved(); let token;
    await inside(x, async port => { const r = await port.observe(); closed(r, 'observed'); token = r.observation;
      const i = port.inspectPrivate(token); assert.equal(i.status, 'private_candidate_not_ready');
      assert.deepEqual(i.private_projection, { target: { document_id: ids.doc, document_version_id: ids.docVersion, document_version: 3 },
        safe_label: 'Document reference', reusable_as_command_authority: false });
      assert.equal(i.projection, null); assert.equal(i.settlement, 'not_observed');
      assert.ok(Object.isFrozen(token) && Object.isFrozen(i.private_projection) && Object.isFrozen(i.private_projection.target));
    }); assert.equal(api.DOCUMENTS_CE012_TARGET_DISCLOSURE_RUNTIME_BINDING, null);
  });
  await check('copied/JSON/foreign-port/old/closed observations cannot disclose a candidate', async () => {
    const x = await saved(); let token; const r = await inside(x, async (port, scope) => {
      token = (await port.observe()).observation; assert.ok(token);
      for (const fake of [{ ...token }, JSON.parse(JSON.stringify(token)), { committed: true, replay: true }, null, 'token']) {
        assert.equal(port.inspectPrivate(fake).status, 'invalidated');
      }
      const foreign = api.createDocumentsCe012TargetDisclosurePortV1(scope, request(x));
      assert.equal(foreign.inspectPrivate(token).status, 'invalidated'); foreign.close();
      await port.observe(); assert.equal(port.inspectPrivate(token).status, 'invalidated');
    }); assert.equal(r.port.inspectPrivate(token).status, 'invalidated');
  });
  await check('next tracked wait invalidates before dispatch and pending operation prevents observation', async () => {
    const x = await saved(); await inside(x, async port => {
      const token = (await port.observe()).observation; let enter, release;
      const entered = new Promise(r => { enter = r; });
      x.f.onDocumentWait = async () => { enter(); await new Promise(r => { release = r; }); };
      const wait = port.scope.query('select d.current_version from documents.documents d where d.id=$1 for share', [ids.doc]);
      await entered; assert.equal(port.inspectPrivate(token).status, 'invalidated'); closed(await port.observe(), 'unavailable');
      release(); await wait; x.f.onDocumentWait = null;
      assert.equal(port.inspectPrivate(token).status, 'invalidated'); closed(await port.observe(), 'observed');
    });
  });
  await check('exact immutable historical target is retained without current-version substitution', async () => {
    const x = await saved(); x.f.documentVersion = 4;
    await inside(x, async port => { const r = await port.observe(); closed(r, 'observed');
      assert.equal(port.inspectPrivate(r.observation).private_projection.target.document_version, 3); });
  });
  await check('private CE label and caller replay/committed/verifier fields are never disclosure authority', async () => {
    const x = await saved(); x.f.ces.get(x.key).ce_receipt.document_target.label = 'PRIVATE-CE-LABEL';
    await inside(x, async port => { const r = await port.observe(); closed(r, 'observed');
      assert.equal(port.inspectPrivate(r.observation).private_projection.safe_label, 'Document reference'); });
    const y = await saved(); await inside(y, async port => closed(await port.observe(), 'mismatch'),
      { ...request(y), committed: true, replay: true, verifier: () => true });
    const z = await saved(); await inside(z, async port => closed(await port.observe({ replay: true }), 'mismatch'));
  });
  await check('missing/NULL Workspace, scan/checksum/quarantine/delete/visibility/AAL denial produces no candidate', async () => {
    for (const kind of ['null_workspace', 'cross_workspace', 'scan', 'checksum', 'deleted', 'quarantine', 'visibility', 'aal']) {
      const x = await saved(), connect = x.f.pool.connect.bind(x.f.pool);
      x.f.pool.connect = async () => { const c = await connect(), query = c.query.bind(c); c.query = async (sql, v) => {
        const q = norm(sql);
        if (q.includes('from documents.documents d where d.id=')) {
          if (kind === 'null_workspace' || kind === 'cross_workspace') return result([]);
          if (kind === 'deleted') return result([{ current_version: 3, active: false }]);
        }
        if (q.includes('select v.version,v.scanning_status')) return result([{ version: 3,
          scanning_status: kind === 'scan' ? 'pending' : kind === 'quarantine' ? 'quarantined' : 'clean',
          checksum_status: kind === 'checksum' ? 'pending' : 'verified' }]);
        if (q.includes("auth.jwt()->>'aal'='aal2'" ) && kind === 'aal') return result([{
          transaction_id: String(100 + x.f.attempts), isolation: 'serializable', actor_bound: true, aal2: false }]);
        if (q.includes('as allowed') && q.includes('from documents.documents') && kind === 'visibility') return result([{ allowed: false }]);
        return query(sql, v);
      }; return c; };
      await inside(x, async port => { const r = await port.observe(); closed(r); assert.notEqual(r.documents_status, 'observed'); });
    }
  });
  await check('final Core denial/expiry/drift after selector waits cannot retain candidate', async () => {
    for (const kind of ['revoke', 'expired', 'backend', 'revision', 'target']) {
      const x = await saved(); let sampled = 0;
      if (kind === 'target') x.f.onDocumentWait = async () => { x.f.ces.get(x.key).ce_receipt.document_target.document_version = 8; };
      x.f.onFinal = async () => { if (++sampled >= 2) {
        if (kind === 'revoke') x.f.docsAllowed = false;
        if (kind === 'expired') x.f.now = x.f.expiry;
      } };
      x.f.changeFinal = r => { if (sampled >= 2 && kind === 'backend') r.backend_pid = 81;
        if (sampled >= 2 && kind === 'revision') r.authority_revision = '2'; };
      await inside(x, async port => { const r = await port.observe(); closed(r);
        assert.notEqual(r.documents_status, 'observed'); });
    }
  });
  await check('scope/attempt/query replacement drift and close invalidate private candidate', async () => {
    const x = await saved(); await inside(x, async (port, scope) => {
      const token = (await port.observe()).observation;
      for (const field of ['attempt', 'actor_id', 'query']) {
        const mutable = { ...scope }, own = api.createDocumentsCe012TargetDisclosurePortV1(mutable, request(x));
        const o = await own.observe(); closed(o, 'observed');
        mutable[field] = field === 'attempt' ? mutable.attempt + 1 : field === 'query' ? scope.query.bind(scope) : id(88);
        assert.equal(own.inspectPrivate(o.observation).status, 'invalidated'); own.close();
      }
      const moved = { ...scope, attempt: scope.attempt + 1 };
      const other = api.createDocumentsCe012TargetDisclosurePortV1(moved, request(x));
      assert.equal(other.inspectPrivate(token).status, 'invalidated'); other.close();
      port.close(); assert.equal(port.inspectPrivate(token).status, 'invalidated'); closed(await port.observe(), 'mismatch');
    });
  });
  await check('original serialization/cancellation failures remain errors; no retry engine or extra writes', async () => {
    for (const code of ['40001', '57014']) {
      const x = await saved(), e = Object.assign(Error('controlled transport failure'), { code });
      let seen = 0; x.f.faultModules = true; x.f.error = e;
      // Use a Documents selector wait fault instead: host pre-authority must run.
      x.f.faultModules = false;
      const connect = x.f.pool.connect.bind(x.f.pool);
      x.f.pool.connect = async () => { const c = await connect(), query = c.query.bind(c); c.query = async (sql, v) => {
        if (norm(sql).includes('select v.version,v.scanning_status')) throw e; return query(sql, v);
      }; return c; };
      await inside(x, async port => { try { await port.observe(); assert.fail(); }
        catch (actual) { assert.equal(actual, e); seen++; throw actual; } });
      assert.equal(seen, code === '40001' ? 3 : 1);
    }
  });
  assert.equal(existsSync(path.join(root, 'src/lib/core/ce012-terminal-authority-port-v1.ts')), false,
    'Core source must remain a pinned dependency, not copied into Documents branch');
  console.log(JSON.stringify({ result: 'PASS_NEW_CONTROLLED_TARGET_PORT_ONLY', groups,
    source_files: sources.size, core_source: CORE, ce_source: CE, host_binding: 'UNBOUND',
    historical_slots: 'BLOCKED_UNCHANGED', native_sql_pg_auth: 'NOT_RUN_NOT_PASS' }));
}
