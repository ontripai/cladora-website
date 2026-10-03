import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessAudit } from './check-shared-dependency-audit.mjs';
import { prepareBracesDepthGuard } from './apply-braces-depth-guard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path));
const json = (path) => JSON.parse(read(path));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = json('scripts/fixtures/braces-audit-report-20261003.json');
const proposal = json('patches/braces-audit-exception-proposal.json');
const now = Date.parse('2026-10-03T13:00:00Z');
const approved = { ...proposal, status: 'approved', approval: { approved_by: 'TEST ONLY', reference: 'unit-test fixture; no production approval' } };
const evidence = {
  lock: json('package-lock.json'), lockHash: hash(read('package-lock.json')),
  patchHash: hash(read('patches/braces-3.0.3-depth-guard.json')),
  verifyPatch: (path) => assert.ok(prepareBracesDepthGuard(join(root, path)).every((file) => !file.changed)),
};
let count = 0;
const check = (name, run) => { run(); console.log(`ok ${++count} - ${name}`); };
const changedReport = (change) => { const value = structuredClone(report); change(value); return value; };
const rejects = (value, policy = approved, proof = evidence, time = now) => assert.throws(() => assessAudit(value, policy, proof, time));

check('checked-in policy is pending and cannot pass known high findings', () => {
  assert.equal(proposal.status, 'pending-user-approval'); assert.equal(proposal.approval, null);
  rejects(report, proposal);
});
check('only the reviewed chain with installed mitigation can pass an approved fixture', () => {
  const result = assessAudit(report, approved, evidence, now);
  assert.equal(result.excepted.length, 7); assert.ok(result.message.includes(approved.expires_at));
});
check('clean raw audit passes without an exception', () => {
  const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } };
  assert.deepEqual(assessAudit(clean, proposal, evidence, now).excepted, []);
});
check('expiry blocks at the exact boundary', () => rejects(report, approved, evidence, Date.parse(approved.expires_at)));
check('one millisecond before expiry still evaluates the exact mitigation', () => assert.equal(assessAudit(report, approved, evidence, Date.parse(approved.expires_at) - 1).excepted.length, 7));
check('future exception is not usable early', () => rejects(report, approved, evidence, Date.parse(approved.valid_from) - 1));
check('invalid clocks and dates reject', () => {
  rejects(report, approved, evidence, NaN);
  rejects(report, { ...approved, expires_at: 'invalid' });
});
check('validity cannot exceed seven days', () => rejects(report, { ...approved, expires_at: '2026-10-11T12:30:00Z' }));
check('missing approval identity or reference rejects', () => {
  rejects(report, { ...approved, approval: {} });
  rejects(report, { ...approved, approval: { approved_by: 'x' } });
});
check('changed advisory identity rejects', () => rejects(report, { ...approved, advisory: 'https://example.com/other' }));
check('changed lock or mitigation bytes reject', () => {
  rejects(report, approved, { ...evidence, lockHash: 'other' });
  rejects(report, approved, { ...evidence, patchHash: 'other' });
});
check('unapplied or changed installed mitigation rejects', () => rejects(report, approved, { ...evidence, verifyPatch: () => { throw new Error('unpatched'); } }));
check('new high finding rejects even with consistent counts', () => rejects(changedReport((r) => {
  r.vulnerabilities.other = { name: 'other', severity: 'high', via: ['braces'], nodes: [] };
  r.metadata.vulnerabilities.high++; r.metadata.vulnerabilities.total++;
})));
check('critical escalation of the known chain rejects', () => rejects(changedReport((r) => {
  r.vulnerabilities.braces.severity = 'critical'; r.metadata.vulnerabilities.high--; r.metadata.vulnerabilities.critical++;
})));
check('new advisory in a reviewed package rejects', () => rejects(changedReport((r) => {
  r.vulnerabilities.braces.via.push({ ...r.vulnerabilities.braces.via[0], source: 9999999, url: 'https://example.com/new' });
})));
check('changed advisory severity rejects', () => rejects(changedReport((r) => { r.vulnerabilities.braces.via[0].severity = 'critical'; })));
check('changed dependency locations reject', () => rejects(changedReport((r) => { r.vulnerabilities.braces.nodes.push('node_modules/other/node_modules/braces'); })));
check('changed transitive chain rejects', () => rejects(changedReport((r) => { r.vulnerabilities.tailwindcss.via = ['braces']; })));
check('cyclic transitive chain rejects', () => rejects(changedReport((r) => { r.vulnerabilities.micromatch.via = ['fast-glob']; })));
check('unrecognized severity rejects', () => rejects(changedReport((r) => { r.vulnerabilities.braces.severity = 'unknown'; })));
check('inconsistent severity counts reject', () => rejects(changedReport((r) => { r.metadata.vulnerabilities.high = 0; })));
check('inconsistent totals reject', () => rejects(changedReport((r) => { r.metadata.vulnerabilities.total--; })));
check('audit errors and unsupported reports reject', () => {
  rejects({ ...report, error: { message: 'network' } }); rejects({ ...report, auditReportVersion: 1 }); rejects({});
});
check('changed dependency release, integrity, or production classification rejects', () => {
  for (const [field, value] of [['version', '3.0.4'], ['integrity', 'other'], ['dev', false]]) {
    const lock = structuredClone(evidence.lock); lock.packages['node_modules/braces'][field] = value;
    rejects(report, approved, { ...evidence, lock });
  }
});
check('additional locked braces copy rejects', () => {
  const lock = structuredClone(evidence.lock);
  lock.packages['node_modules/other/node_modules/braces'] = { ...lock.packages['node_modules/braces'] };
  rejects(report, approved, { ...evidence, lock });
});
console.log(`Shared audit proposal: ${count} behavioral checks passed; exception remains inactive`);
