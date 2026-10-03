import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareBracesDepthGuard } from './apply-braces-depth-guard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function assessAudit(report, policy, evidence, now = Date.now()) {
  if (report?.auditReportVersion !== 2 || report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities) {
    throw new Error('Invalid or failed npm audit report');
  }
  const entries = Object.entries(report.vulnerabilities);
  const severities = ['info', 'low', 'moderate', 'high', 'critical'];
  for (const [name, value] of entries) {
    if (value.name !== name || !severities.includes(value.severity)) throw new Error('Invalid audit entry');
  }
  for (const severity of severities) {
    if (entries.filter(([, value]) => value.severity === severity).length !== report.metadata.vulnerabilities[severity]) {
      throw new Error('Audit severity counts disagree');
    }
  }
  if (entries.length !== report.metadata.vulnerabilities.total) throw new Error('Audit total disagrees');
  const blocking = entries.filter(([, value]) => ['high', 'critical'].includes(value.severity));
  if (!blocking.length) return { excepted: [], message: 'Raw audit contains no high/critical findings' };
  if (policy?.version !== 1 || policy.status !== 'approved' || !policy.approval?.approved_by || !policy.approval?.reference) {
    throw new Error('Temporary exception is pending explicit user approval');
  }
  const from = Date.parse(policy.valid_from);
  const expires = Date.parse(policy.expires_at);
  if (!Number.isFinite(now) || !Number.isFinite(from) || !Number.isFinite(expires) || expires <= from || expires - from > 7 * 86400000 || now < from || now >= expires) {
    throw new Error('Exception is outside its maximum seven-day validity window');
  }
  if (policy.advisory !== 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' || policy.source !== 1240992) throw new Error('Unrecognized exception advisory');
  if (evidence.lockHash !== policy.lock_sha256 || evidence.patchHash !== policy.patch_sha256) throw new Error('Lockfile or mitigation manifest changed');
  const visiting = new Set();
  const reviewed = new Set();
  const visit = (name) => {
    if (reviewed.has(name)) return;
    if (visiting.has(name)) throw new Error('Cyclic audit chain');
    visiting.add(name);
    const value = report.vulnerabilities[name];
    const allowed = policy.packages[name];
    if (!allowed || !value || value.severity !== 'high' || !Array.isArray(value.via) || !Array.isArray(value.nodes)) throw new Error(`Unreviewed finding: ${name}`);
    if (!same(value.nodes, Object.keys(allowed.nodes))) throw new Error(`Changed dependency locations: ${name}`);
    for (const node of value.nodes) {
      const actual = evidence.lock.packages[node];
      const expected = allowed.nodes[node];
      if (!actual || actual.version !== expected.version || actual.integrity !== expected.integrity || actual.dev !== true) throw new Error(`Changed or non-development dependency: ${node}`);
    }
    const via = value.via.map((item) => {
      if (typeof item === 'string') { visit(item); return item; }
      if (name !== 'braces' || item?.name !== 'braces' || item.dependency !== 'braces' || item.source !== policy.source || item.url !== policy.advisory || item.severity !== 'high') {
        throw new Error(`Unreviewed advisory: ${name}`);
      }
      return 'advisory';
    });
    if (!same(via, allowed.via)) throw new Error(`Changed advisory chain: ${name}`);
    visiting.delete(name); reviewed.add(name);
  };
  for (const [name] of blocking) visit(name);
  if (!reviewed.has('braces')) throw new Error('Missing root advisory');
  const lockedCopies = Object.keys(evidence.lock.packages).filter((path) => /(^|\/)node_modules\/braces$/.test(path));
  const reviewedCopies = Object.keys(policy.packages.braces.nodes);
  if (!same(lockedCopies, reviewedCopies)) throw new Error('Unreviewed braces installation');
  for (const path of lockedCopies) evidence.verifyPatch(path);
  return { excepted: blocking.map(([name]) => name), message: `Known advisory temporarily accepted until ${policy.expires_at}; raw findings remain visible` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Audit policy cannot be overridden through CLI arguments');
    const audit = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    if (audit.error || ![0, 1].includes(audit.status)) throw new Error('npm audit execution failed');
    // Print the original report, including the excepted advisory, before evaluation.
    process.stdout.write(audit.stdout);
    const lockBytes = readFileSync(join(root, 'package-lock.json'));
    const patchBytes = readFileSync(join(root, 'patches/braces-3.0.3-depth-guard.json'));
    const policy = JSON.parse(readFileSync(join(root, 'patches/braces-audit-exception-proposal.json'), 'utf8'));
    const evidence = {
      lockHash: hash(lockBytes), patchHash: hash(patchBytes), lock: JSON.parse(lockBytes),
      verifyPatch: (path) => {
        if (prepareBracesDepthGuard(join(root, path)).some((file) => file.changed)) throw new Error(`Mitigation is not installed: ${path}`);
      },
    };
    const result = assessAudit(JSON.parse(audit.stdout), policy, evidence);
    console.log(result.message);
  } catch (error) {
    console.error(`Shared dependency audit BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}
