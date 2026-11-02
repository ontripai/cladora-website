import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadPinnedPlanCompiler, assertSourcePin } from './docs-ce012-case-plan-v1/loader.mjs';
import { makeInputs, historicalReference } from './docs-ce012-case-plan-v1/test-inputs.mjs';

const api = loadPinnedPlanCompiler();
let groups = 0;
const compile = f => api.compileCasePlan(f.platform, f.documents);
const row = (result, name) => result.plan.cases.find(c => c.name === name);
const outcome = (result, name) => result.case_results.find(c => c.name === name);
function check(name, operation) { operation(); console.log(`ok ${++groups} - ${name}`); }
check('canonical source inputs compile exact existing nine-slot plan; historical stays blocked, not synthetic success', () => {
  const f = makeInputs(api), before = JSON.stringify(f), result = compile(f);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.case_results.filter(c => c.outcome === 'COMPILED_SHAPE').length, 7, JSON.stringify(result.case_results));
  assert.deepEqual(result.plan.cases.map(c => c.name), api.CASE_NAMES);
  for (const c of f.documents.cases.filter(c => !c.name.startsWith('historical_'))) {
    assert.deepEqual(row(result, c.name).command, c.command);
    assert.deepEqual(row(result, c.name).guide_command, c.guide_command);
  }
  for (const name of ['historical_disclosure', 'historical_revoked']) {
    assert.equal(outcome(result, name).code, 'CANONICAL_STORED_RELATION_MISSING');
    assert.equal(outcome(result, name).producer, 'Core/CE');
    assert.deepEqual(row(result, name), { name, command: null, guide_command: null, receipt_id: null, receipt_hash: null });
  }
  assert.equal(result.reusable_as_live_authority, false); assert.equal(result.runtime_proof, 'NOT_RUN_NOT_PASS');
  assert.equal(JSON.stringify(f), before, 'compiler must not mutate source values');
  assert.equal(result.plan_sha256, createHash('sha256').update(result.plan_bytes).digest('hex'));
  assert.equal(api.validateCompiledPlan(f.platform, f.documents, result.plan, result.plan_sha256, result.input_source_binding_sha256).valid, true);
});
check('Workspace, tenant, document/version/source version and actor mismatches block only affected case', () => {
  for (const [mutate, code] of [
    [c => { c.document.workspace_id = '39000000-0000-4000-8000-000000008888'; }, 'DOCUMENT_WORKSPACE_BINDING_MISMATCH'],
    [c => { c.document.tenant_id = '39000000-0000-4000-8000-000000008888'; }, 'DOCUMENT_VERSION_BINDING_MISMATCH'],
    [c => { c.document_version.version = 3; }, 'DOCUMENT_VERSION_BINDING_MISMATCH'],
    [c => { c.command.subject_reference.version = 6; }, 'CE_CORE_COMMAND_BINDING_MISMATCH'],
    [c => { c.command.actor_id = '39000000-0000-4000-8000-000000008888'; }, 'ACTOR_SESSION_REFERENCE_MISMATCH'],
  ]) {
    const f = makeInputs(api); mutate(f.documents.cases[0]); const result = compile(f);
    assert.equal(outcome(result, 'current_positive').code, code);
    assert.equal(row(result, 'current_positive').command, null);
    assert.equal(outcome(result, 'shared_lock').outcome, 'COMPILED_SHAPE');
  }
});
check('custody/run/DB and Platform input/source hash mismatches invalidate the envelope', () => {
  for (const key of ['run_id', 'custody_nonce', 'database', 'database_oid', 'system_identifier']) {
    const f = makeInputs(api);
    const values = { run_id: 'cladora-lane-999999999999', custody_nonce: 'b'.repeat(32), database: 'docs_ce012_9999999999999999', database_oid: '999', system_identifier: '999' };
    f.documents.custody[key] = values[key]; const result = compile(f);
    assert.equal(result.code, 'CUSTODY_BINDING_MISMATCH'); assert.equal(result.plan, null);
  }
  const f = makeInputs(api); f.platform.database_provenance_sha256 = 'a'.repeat(64);
  assert.equal(compile(f).code, 'PLATFORM_INPUT_HASH_MISMATCH');
  f.platform.harness.source_commit = '0'.repeat(40);
  assert.equal(compile(f).code, 'PLATFORM_INPUT_INVALID');
});
check('permission/scan/lifecycle and exact negative-case belonging are validated without native authority inference', () => {
  for (const [mutate, code] of [
    [c => { c.permissions[0].document_id = '39000000-0000-4000-8000-000000008888'; }, 'PERMISSION_BINDING_MISMATCH'],
    [c => { c.scan_attestation.content_sha256 = 'c'.repeat(64); }, 'CASE_SCAN_BINDING_MISMATCH'],
    [c => { c.document.deleted_at = '2026-11-01T00:00:00.000Z'; }, 'DOCUMENT_LIFECYCLE_MISMATCH'],
    [c => { c.core_fixture_source_sha256 = null; }, 'CORE_NATIVE_FIXTURE_SOURCE_MISSING'],
  ]) {
    const f = makeInputs(api); mutate(f.documents.cases[0]); assert.equal(outcome(compile(f), 'current_positive').code, code);
  }
  const f = makeInputs(api); f.documents.cases.find(c => c.name === 'cross_workspace').document.workspace_id = f.documents.cases[0].document.workspace_id;
  assert.equal(outcome(compile(f), 'cross_workspace').code, 'DOCUMENT_WORKSPACE_BINDING_MISMATCH');
  const g = makeInputs(api); g.documents.cases.find(c => c.name === 'replaced_fresh').document.current_version = 2;
  assert.equal(outcome(compile(g), 'replaced_fresh').code, 'CASE_VERSION_RELATION_MISMATCH');
  const q = makeInputs(api); q.documents.cases.find(c => c.name === 'quarantined').document_version.scanning_status = 'clean';
  assert.equal(outcome(compile(q), 'quarantined').code, 'CASE_SCAN_BINDING_MISMATCH');
});
check('historical metadata reference never becomes committed proof; mismatched receipt/id/hash/Workspace is rejected', () => {
  for (const mutation of ['none', 'id', 'hash', 'workspace']) {
    const f = makeInputs(api), c = f.documents.cases.find(c => c.name === 'historical_disclosure');
    c.historical_reference = historicalReference(c); c.receipt_id = c.historical_reference.core_receipt_id; c.receipt_hash = c.historical_reference.core_receipt_hash;
    if (mutation === 'id') c.receipt_id = '39000000-0000-4000-8000-000000009009';
    if (mutation === 'hash') c.receipt_hash = '7'.repeat(64);
    if (mutation === 'workspace') c.historical_reference.binding.workspace_id = '39000000-0000-4000-8000-000000009009';
    const result = compile(f), o = outcome(result, c.name);
    assert.equal(o.code, mutation === 'none' ? 'CANONICAL_PERSISTED_RELATION_VERIFIER_UNAVAILABLE'
      : mutation === 'workspace' ? 'HISTORICAL_RELATION_BINDING_MISMATCH' : 'HISTORICAL_RECEIPT_REFERENCE_MISMATCH');
    assert.equal(row(result, c.name).receipt_id, null);
    assert.equal(outcome(result, 'shared_lock').outcome, 'COMPILED_SHAPE');
  }
});
check('receipt-shaped JSON, committed flag, current GET and caller verifier cannot complete historical or fresh cases', () => {
  for (const extra of [{ committed: true }, { receipt: { contract_version: 'core-transaction-receipt.v2', receipt_id: '39000000-0000-4000-8000-000000009001' } },
    { verifier: 'always_allow' }, { current_get: { version: 6 } }]) {
    const f = makeInputs(api); Object.assign(f.documents.cases.find(c => c.name === 'historical_disclosure'), extra);
    assert.equal(outcome(compile(f), 'historical_disclosure').code, 'CASE_INPUT_INVALID');
  }
  const f = makeInputs(api), c = f.documents.cases[0]; c.receipt_id = '39000000-0000-4000-8000-000000009001';
  assert.equal(outcome(compile(f), c.name).code, 'FRESH_CASE_HAS_HISTORICAL_EVIDENCE');
});
check('missing historical case/source stays null without guessed version/UUID; duplicate or unknown names invalidate', () => {
  const f = makeInputs(api); f.documents.cases = f.documents.cases.filter(c => !c.name.startsWith('historical_'));
  const result = compile(f); assert.equal(result.plan.cases.length, 9);
  assert.equal(outcome(result, 'historical_disclosure').code, 'CASE_SOURCE_MISSING');
  const d = makeInputs(api); d.documents.cases[1].name = d.documents.cases[0].name;
  assert.equal(compile(d).code, 'CASE_SET_INVALID');
  d.documents.cases[1].name = 'tenth_new_case'; assert.equal(compile(d).code, 'CASE_SET_INVALID');
});
check('semantic/raw/source hash bindings are deterministic and source changes cannot reuse the old seal', () => {
  const f = makeInputs(api), p = JSON.stringify(f.platform), d = JSON.stringify(f.documents);
  const a = api.compileCasePlanJson(p, d), b = api.compileCasePlanJson(JSON.stringify(f.platform, null, 2), d);
  assert.equal(a.plan_sha256, b.plan_sha256); assert.equal(a.input_source_binding_sha256, b.input_source_binding_sha256);
  assert.notEqual(a.raw_input_binding_sha256, b.raw_input_binding_sha256);
  assert.equal(api.validateCompiledPlanJson(p, d, a.plan_bytes, a.plan_sha256, a.input_source_binding_sha256, a.raw_input_binding_sha256).valid, true);
  assert.equal(api.validateCompiledPlanJson(JSON.stringify(f.platform, null, 2), d, a.plan_bytes, a.plan_sha256, a.input_source_binding_sha256, a.raw_input_binding_sha256).code, 'RAW_INPUT_HASH_MISMATCH');
  const altered = structuredClone(f); altered.platform.custody.custody_nonce = 'c'.repeat(32);
  altered.documents.custody.custody_nonce = altered.platform.custody.custody_nonce;
  altered.documents.platform_input_sha256 = api.contentHash(altered.platform);
  assert.equal(api.validateCompiledPlan(altered.platform, altered.documents, a.plan, a.plan_sha256, a.input_source_binding_sha256).valid, false);
  const tamper = structuredClone(a.plan); tamper.cases[3].command = tamper.cases[0].command;
  assert.equal(api.validateCompiledPlan(f.platform, f.documents, tamper, api.contentHash(tamper), a.input_source_binding_sha256).valid, false);
});
check('strict JSON/prototypes/duplicate keys/bounds and unknown secret fields fail without leaking inputs', () => {
  const f = makeInputs(api), p = JSON.stringify(f.platform), d = JSON.stringify(f.documents);
  assert.equal(api.compileCasePlanJson(p.replace('{', '{"contract":"duplicate",'), d).code, 'INPUT_JSON_INVALID_OR_DUPLICATE');
  assert.equal(api.compileCasePlanJson('{"a":1,"\\u0061":2}', d).code, 'INPUT_JSON_INVALID_OR_DUPLICATE');
  const secret = makeInputs(api); secret.platform.auth_provenance.access_token = 'DO_NOT_DISCLOSE';
  const bad = compile(secret); assert.equal(bad.code, 'PLATFORM_INPUT_INVALID'); assert.equal(JSON.stringify(bad).includes('DO_NOT_DISCLOSE'), false);
  let called = false; const getter = { get contract() { called = true; return 'secret'; } };
  assert.equal(api.compileCasePlan(getter, {}).code, 'INPUT_NOT_JSON'); assert.equal(called, false);
  assert.equal(api.compileCasePlan({ x: Infinity }, {}).code, 'INPUT_NOT_JSON');
  assert.equal(api.compileCasePlanJson(' '.repeat(1048577), d).code, 'INPUT_JSON_INVALID_OR_DUPLICATE');
});
check('compiler has no network/SQL/secret/clock/random/generator effects; output is stable with frozen inputs', () => {
  const f = makeInputs(api);
  function freeze(x) { if (x && typeof x === 'object') { Object.freeze(x); Object.values(x).forEach(freeze); } }
  freeze(f); const date = Date.now, fetch = globalThis.fetch;
  try {
    Date.now = () => { throw Error('clock forbidden'); };
    globalThis.fetch = () => { throw Error('network forbidden'); };
    assert.deepEqual(compile(f), compile(f));
  } finally { Date.now = date; globalThis.fetch = fetch; }
  const source = readFileSync(new URL('./docs-ce012-case-plan-v1/compiler.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:fs|process\.env|\bfetch\s*\(|\.query\s*\(|new\s+Pool|randomUUID|randomBytes|Date\.now|Math\.random|new\s+Date/);
});
check('source pins and ABI references preserve actual canonical schema bytes, not an alternate receipt verifier', () => {
  const manifest = JSON.parse(readFileSync(new URL('./docs-ce012-case-plan-v1/source-manifest.json', import.meta.url)));
  for (const pin of manifest.files) {
    const bytes = readFileSync(new URL(`../${pin.path}`, import.meta.url)); assertSourcePin(bytes, pin);
  }
  const pin = manifest.files.find(f => f.path.endsWith('/compiler.ts'));
  assert.throws(() => assertSourcePin(Buffer.from('different'), pin), /COMPILER_SOURCE_PIN_MISMATCH/);
  const contract = JSON.parse(readFileSync(new URL('./docs-ce012-case-plan-v1/contract.json', import.meta.url)));
  assert.equal(contract.output.historical_completion_available, false);
  assert.equal(contract.output.reusable_as_live_authority, false);
  assert.equal(contract.canonical_schema_references.length, 3);
  assert.deepEqual(contract.case_semantics, api.CASE_SEMANTICS);
});
check('CLI writes only the explicit new0600 plan, no stdout/default/overwrite, and no output for invalid custody', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-ce012-plan-'));
  const cli = 'scripts/docs-ce012-case-plan-v1/compile-private-plan.mjs';
  try {
    const f = makeInputs(api), p = path.join(dir, 'platform.json'), d = path.join(dir, 'documents.json'), o = path.join(dir, 'private-plan.json');
    writeFileSync(p, JSON.stringify(f.platform), { mode: 0o600 }); writeFileSync(d, JSON.stringify(f.documents), { mode: 0o600 });
    const args = [cli, '--platform-input', p, '--documents-input', d, '--private-plan-output', o];
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(child.status, 3, child.stderr); assert.equal(child.stdout, '');
    assert.equal(readFileSync(o, 'utf8'), compile(f).plan_bytes); assert.equal(statSync(o).mode & 0o777, 0o600);
    const again = spawnSync(process.execPath, args, { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(again.status, 2); assert.equal(JSON.parse(again.stderr).code, 'PRIVATE_OUTPUT_ALREADY_EXISTS');
    f.documents.custody.database_oid = '999'; writeFileSync(d, JSON.stringify(f.documents));
    const invalid = spawnSync(process.execPath, [...args.slice(0, -1), path.join(dir, 'invalid.json')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(invalid.status, 2); assert.equal(existsSync(path.join(dir, 'invalid.json')), false);
    writeFileSync(d, JSON.stringify(makeInputs(api).documents));
    writeFileSync(p, Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(JSON.stringify(f.platform))]));
    const bom = spawnSync(process.execPath, [...args.slice(0, -1), path.join(dir, 'bom.json')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(bom.status, 2); assert.equal(JSON.parse(bom.stderr).code, 'INPUT_JSON_INVALID_OR_DUPLICATE');
    assert.equal(existsSync(path.join(dir, 'bom.json')), false);
    const missing = spawnSync(process.execPath, [cli], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(missing.status, 2); assert.equal(missing.stdout, '');
  } finally { rmSync(dir, { recursive: true }); }
});
console.log(JSON.stringify({ contract: api.COMPILER_CONTRACT, groups, result: 'PASS_CONTROLLED_COMPILER_ONLY',
  historical_ready_cases: 0, native_runtime: 'NOT_RUN_NOT_PASS', prior_suites: 'NOT_RERUN' }));
