import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-source-test-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`ok ${passed} - ${name}`); };
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--strict', '--skipLibCheck', '--esModuleInterop', '--target', 'ES2020',
    '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/valuation-source-readiness-v1.ts',
  ], { cwd: root, stdio: 'inherit' });
  const { evaluateValuationSourceReadinessV1: evaluate, valuationSourceInventoryV1Schema: schema,
    valuationSourceReadinessV1Schema: responseSchema } = createRequire(import.meta.url)(join(output, 'valuation-source-readiness-v1.js'));
  const id = '11111111-1111-4111-8111-111111111111';
  const source = {
    contract: 'valuation-source-inventory.v1', source_id: 'synthetic-market', source_version: 'fixture-v1',
    owner_ref: 'AIRPROP/synthetic-test', acquisition_method: 'manual_import',
    evidence_kinds: ['asking'], freshness_days: 30, review_state: 'verified',
    rights: { evidence_ref: 'synthetic-only/rights-v1', reviewed_at: '2026-10-01T00:00:00Z',
      effective_from: '2026-10-01T00:00:00Z', effective_until: '2026-11-01T00:00:00Z',
      scope: 'workspace_private', workspace_id: id, permitted_uses: ['quality_evaluation', 'result_display'],
      raw_retention_until: '2026-10-20T00:00:00Z', derived_retention_until: '2026-10-25T00:00:00Z' },
  };
  const input = { source, as_of: '2026-10-10T00:00:00Z', workspace_id: id, intended_use: 'quality_evaluation', has_current_workspace_authority: true };
  const changed = rights => ({ ...input, source: { ...source, rights: { ...source.rights, ...rights } } });
  const denied = { contract: 'valuation-source-readiness.v1', readiness: 'blocked', reason_code: 'source_usage_denied' };
  const deniedResponses = [];
  const blocked = (value, reason) => { const result = evaluate(value); assert.deepEqual(result, denied, reason); deniedResponses.push(result); };
  check('reviewed synthetic evidence is ready only for its declared use', () => assert.equal(evaluate(input).readiness, 'evidence_ready'));
  check('unreviewed sources remain blocked', () => blocked({ ...input, source: { ...source, review_state: 'pending' } }, 'source_pending'));
  check('revocation defeats valid dates and usage evidence', () => blocked({ ...input, source: { ...source, review_state: 'revoked' } }, 'source_revoked'));
  check('public label alone supplies no usage evidence', () => blocked({ ...input, source: { ...source, rights: null } }, 'missing_usage_evidence'));
  check('future review cannot enter historical evaluation', () => blocked(changed({ reviewed_at: '2026-10-11T00:00:00Z' }), 'review_after_as_of'));
  check('future usage agreement is blocked', () => blocked(changed({ effective_from: '2026-10-11T00:00:00Z' }), 'rights_not_effective'));
  check('rights expiry is exclusive', () => blocked({ ...input, as_of: source.rights.effective_until }, 'rights_expired'));
  check('another Workspace cannot consume private evidence', () => blocked({ ...input, workspace_id: '22222222-2222-4222-8222-222222222222' }, 'workspace_mismatch'));
  check('missing Workspace fails closed', () => blocked({ ...input, workspace_id: null }, 'workspace_mismatch'));
  check('model training requires its own declared usage right', () => blocked({ ...input, intended_use: 'model_training' }, 'use_not_permitted'));
  check('result display does not imply comparable disclosure', () => blocked({ ...input, intended_use: 'comparable_display' }, 'use_not_permitted'));
  check('raw evidence stops at retention boundary', () => blocked({ ...input, as_of: source.rights.raw_retention_until }, 'raw_retention_expired'));
  check('derived results can outlive raw records only within explicit policy', () => assert.equal(evaluate({ ...input, as_of: source.rights.raw_retention_until, intended_use: 'result_display' }).readiness, 'evidence_ready'));
  check('derived display stops at its independent retention boundary', () => blocked({ ...input, as_of: source.rights.derived_retention_until, intended_use: 'result_display' }, 'derived_retention_expired'));
  check('public licensed evidence still needs Core Resource authority', () => { const result = evaluate(changed({ scope: 'public', workspace_id: null })); assert.equal(result.readiness, 'evidence_ready'); assert.equal(result.requires_current_core_authority, true); });
  check('licensed Workspace evidence has the same isolation rule', () => blocked({ ...changed({ scope: 'licensed_workspace' }), workspace_id: null }, 'workspace_mismatch'));
  check('public evidence cannot carry a hidden Workspace restriction', () => assert.equal(schema.safeParse({ ...source, rights: { ...source.rights, scope: 'public' } }).success, false));
  check('empty or reversed rights interval is rejected', () => assert.equal(schema.safeParse({ ...source, rights: { ...source.rights, effective_until: source.rights.effective_from } }).success, false));
  check('malformed timestamps and unknown permission fields fail closed', () => { blocked({ ...input, as_of: 'yesterday' }, 'invalid timestamp'); blocked({ ...input, can_manage: true }, 'unknown authority assertion'); });
  check('readiness never activates a connector or publishes a Listing', () => { const result = evaluate(input); assert.equal(result.permits_connector_activation, false); assert.equal(result.permits_publication, false); assert.equal('range' in result, false); });
  check('wrong or invalid Workspace returns the same public deny', () => {
    for (const workspace_id of ['22222222-2222-4222-8222-222222222222', 'invalid-workspace', null]) {
      blocked({ ...input, workspace_id }, 'Workspace denial');
    }
  });
  check('missing or absent current Workspace authority fails closed', () => {
    const { has_current_workspace_authority: omitted, ...withoutAuthority } = input;
    assert.equal(omitted, true);
    blocked(withoutAuthority, 'missing authority');
    blocked({ ...input, has_current_workspace_authority: false }, 'absent authority');
    blocked({ ...changed({ scope: 'public', workspace_id: null }), has_current_workspace_authority: false }, 'public license is not authority');
  });
  check('revoked usage has the same redacted deny as revoked review', () => {
    blocked(changed({ permitted_uses: [] }), 'revoked use');
    blocked({ ...input, source: { ...source, review_state: 'revoked' } }, 'revoked review');
  });
  check('expired usage and retention evidence disclose no expiry details', () => {
    for (const as_of of [source.rights.effective_until, source.rights.raw_retention_until, source.rights.derived_retention_until]) {
      blocked({ ...input, as_of }, 'expired evidence');
    }
  });
  check('every denied response excludes private identifiers at runtime and in its type contract', () => {
    for (const response of deniedResponses) {
      assert.deepEqual(Object.keys(response).sort(), ['contract', 'readiness', 'reason_code']);
      const serialized = JSON.stringify(response);
      for (const privateValue of [source.source_id, source.source_version, source.owner_ref, source.rights.evidence_ref, id,
        source.rights.raw_retention_until, source.rights.derived_retention_until]) assert.equal(serialized.includes(privateValue), false);
      assert.equal(responseSchema.safeParse(response).success, true);
      for (const field of ['source_id', 'source_version', 'metadata', 'rights', 'retention_ref', 'usage_evidence', 'blockers']) {
        assert.equal(responseSchema.safeParse({ ...response, [field]: 'private' }).success, false);
      }
    }
    const boundaryTest = join(output, 'denied-boundary.ts');
    writeFileSync(boundaryTest, `import type { ValuationSourceReadinessV1 } from '../src/lib/airprop/valuation-source-readiness-v1';
declare const result: ValuationSourceReadinessV1;
if (result.readiness === 'blocked') {
  // @ts-expect-error denied responses cannot expose source identity
  result.source_id;
  // @ts-expect-error denied responses cannot expose source version
  result.source_version;
  // @ts-expect-error denied responses cannot expose usage evidence
  result.rights;
} else { result.source_id; result.source_version; }
`);
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck',
      '--esModuleInterop', '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', boundaryTest], { cwd: root, stdio: 'inherit' });
  });
  console.log(`AIRPROP AP-VAL-01A3: ${passed} behavioral checks passed`);
} finally { rmSync(output, { recursive: true, force: true }); }
