import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
  const { evaluateValuationSourceReadinessV1: evaluate, valuationSourceInventoryV1Schema: schema } = createRequire(import.meta.url)(join(output, 'valuation-source-readiness-v1.js'));
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
  const input = { source, as_of: '2026-10-10T00:00:00Z', workspace_id: id, intended_use: 'quality_evaluation' };
  const changed = rights => ({ ...input, source: { ...source, rights: { ...source.rights, ...rights } } });
  const blocked = (value, reason) => { const result = evaluate(value); assert.equal(result.readiness, 'blocked'); assert.ok(result.blockers.includes(reason)); };
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
  check('malformed timestamps and unknown permission fields are rejected', () => { assert.throws(() => evaluate({ ...input, as_of: 'yesterday' })); assert.throws(() => evaluate({ ...input, can_manage: true })); });
  check('readiness never activates a connector or publishes a Listing', () => { const result = evaluate(input); assert.equal(result.permits_connector_activation, false); assert.equal(result.permits_publication, false); assert.equal('range' in result, false); });
  console.log(`AIRPROP AP-VAL-01A3: ${passed} behavioral checks passed`);
} finally { rmSync(output, { recursive: true, force: true }); }
