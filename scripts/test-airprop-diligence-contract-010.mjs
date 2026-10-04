import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-diligence-test-'));
let passed = 0;
const check = (name, run) => { run(); console.log(`ok ${++passed} - ${name}`); };
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--strict', '--skipLibCheck', '--esModuleInterop',
    '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/diligence-contract-v1.ts'], { cwd: root, stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const { assessAirpropDiligenceReviewV1: assess, airpropDiligenceSnapshotV1Schema: snapshotSchema,
    submitAirpropDiligenceReviewV1Schema: commandSchema } = require(join(output, 'diligence-contract-v1.js'));
  const id = '00000000-0000-0000-0000-000000000001';
  const second = 'ab000000-0000-0000-0000-000000000002';
  const policy = { policy_version: 1, required_checklist_codes: ['legal', 'financial', 'technical'] };
  const snapshot = { version: 1, workspace_id: id, opportunity_id: id, underwriting_case_id: id,
    underwriting_version: 2, revision: 1, policy_version: 1,
    checklist: policy.required_checklist_codes.map(code => ({ code, status: 'satisfied', evidence_version_ids: [second] })), findings: [] };
  const command = { version: 1, context_id: id, workspace_id: id, opportunity_id: id, diligence_case_id: id,
    expected_revision: 1, expected_underwriting_version: 2, expected_policy_version: 1, idempotency_key: 'diligence-review-0001' };
  const open = { finding_id: second, severity: 'blocking', status: 'open', summary: 'Unresolved title inconsistency', evidence_version_ids: [] };
  check('complete exact-version checklist is ready for review', () => assert.deepEqual(assess(snapshot, policy, 2), { ready_for_review: true, reasons: [] }));
  check('changed underwriting invalidates old review', () => assert.deepEqual(assess(snapshot, policy, 3).reasons, ['stale_underwriting_version']));
  check('changed policy invalidates old review', () => assert.equal(assess(snapshot, { ...policy, policy_version: 2 }, 2).ready_for_review, false));
  check('missing required check cannot be hidden', () => assert.deepEqual(assess({ ...snapshot, checklist: snapshot.checklist.slice(1) }, policy, 2).reasons, ['incomplete_check:legal']));
  check('pending check blocks review', () => assert.equal(assess({ ...snapshot, checklist: snapshot.checklist.map(x => ({ ...x, status: 'pending' })) }, policy, 2).reasons.length, 3));
  check('unknown checklist codes fail closed', () => assert.equal(assess({ ...snapshot, checklist: [...snapshot.checklist, { code: 'bypass', status: 'satisfied', evidence_version_ids: [second] }] }, policy, 2).ready_for_review, false));
  check('unresolved blocking finding prevents review', () => assert.deepEqual(assess({ ...snapshot, findings: [open] }, policy, 2).reasons, [`blocking_finding:${second}`]));
  check('advisory finding remains visible without implying approval', () => assert.equal(assess({ ...snapshot, findings: [{ ...open, severity: 'advisory' }] }, policy, 2).ready_for_review, true));
  check('resolution with pinned evidence permits review', () => assert.equal(assess({ ...snapshot, findings: [{ ...open, status: 'resolved', resolution: 'Verified corrected title', evidence_version_ids: [second] }] }, policy, 2).ready_for_review, true));
  for (const findings of [[{ ...open, status: 'resolved', resolution: ' ' }], [open, open], [{ ...open, status: 'waived' }], [{ ...open, approved: true }]]) {
    check('invalid or ambiguous finding rejected', () => assert.equal(snapshotSchema.safeParse({ ...snapshot, findings }).success, false));
  }
  for (const checklist of [[snapshot.checklist[0], snapshot.checklist[0]], [{ ...snapshot.checklist[0], evidence_version_ids: [] }], [{ ...snapshot.checklist[0], evidence_version_ids: [second, second.toUpperCase()] }]]) {
    check('invalid checklist evidence rejected', () => assert.equal(snapshotSchema.safeParse({ ...snapshot, checklist }).success, false));
  }
  check('exact version command accepted', () => assert.deepEqual(commandSchema.parse(command), command));
  for (const patch of [{ expected_revision: 0 }, { expected_underwriting_version: 2.5 }, { expected_policy_version: '1' },
    { workspace_id: 'fake' }, { approved: true }, { snapshot }, { ready_for_review: true }, { document_path: '/private/file' }, { idempotency_key: 'short' }]) {
    check('untrusted command shortcut rejected', () => assert.equal(commandSchema.safeParse({ ...command, ...patch }).success, false));
  }
  check('uppercase canonical references normalize', () => assert.equal(snapshotSchema.parse({ ...snapshot, opportunity_id: second.toUpperCase() }).opportunity_id, second));
  check('invalid current version and empty policy rejected', () => { assert.throws(() => assess(snapshot, policy, 0)); assert.throws(() => assess(snapshot, { ...policy, required_checklist_codes: [] }, 2)); });
  check('assessment preserves historical snapshot', () => { const before = JSON.stringify(snapshot); assess(snapshot, policy, 3); assert.equal(JSON.stringify(snapshot), before); });
  check('reasons stable across checklist order', () => { const incomplete = { ...snapshot, checklist: snapshot.checklist.map(x => ({ ...x, status: 'pending' })) }; assert.deepEqual(assess(incomplete, policy, 2), assess({ ...incomplete, checklist: [...incomplete.checklist].reverse() }, policy, 2)); });
  console.log(`AIRPROP diligence contract: ${passed} behavioral checks passed`);
} finally { rmSync(output, { recursive: true, force: true }); }
