import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PF02_CANDIDATE_SHA, PF02_GATE } from './lib/airprop-provider-revisions.mjs';
const root = resolve(process.env.CLADORA_PF02_PROVIDER_ROOT ?? '');
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), PF02_CANDIDATE_SHA);
const from = path => import(pathToFileURL(`${root}/src/lib/${path}`));
const resources = await from('core/resource-contracts-v1.ts');
const workspace = await from('customer/workspace-composition-schema.ts');
const contract = await from('core/resource-authority-contract-v1.ts');
const authoritySchema = await from('core/workspace-authority-decision-v2.ts');
const require = createRequire(import.meta.url);
function load(path, dependencies) {
  const filename = `${root}/src/lib/core/${path}`;
  const loadedModule = new Module(filename);
  loadedModule.require = name => dependencies[name] ?? require(name);
  loadedModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loadedModule.exports;
}
const owner = load('owner-portfolio-projection-v1.ts', {
  '@/lib/core/resource-contracts-v1': resources,
  '@/lib/customer/workspace-composition-schema': workspace,
});
const { mapAirpropCoreCompanionV1: map } = load('airprop-companion-mapping-v1.ts', {
  './resource-authority-contract-v1.ts': contract,
  './owner-portfolio-projection-v1.ts': owner,
  './workspace-authority-decision-v2.ts': authoritySchema,
});
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const at = '2026-10-11T09:00:00Z';
const authority = { contract_version: 'workspace-native-effective-authority.v2', decision_id: id(5),
  workspace_id: id(2), permission_code: 'airprop.asset.read', module_code: 'airprop_commercial',
  target_scope_type: 'workspace', target_scope_id: id(2), evaluator: 'app_private.check_workspace_native_permission_v2',
  authority_policy_version: 2, source_disclosure: 'status_only', source_reference: null, evaluated_at: at,
  current_authority_recheck_required: true, reusable_as_command_authority: false,
  decision: 'allowed', reason_codes: ['current_effective_permission_allowed'] };
const request = { contract_version: 'core-resource-authority.v1', evaluation_time: at,
  resource: { contract_version: 'canonical-resource-reference.v1', context_id: id(1), workspace_id: id(2),
    resource_type: 'property', resource_id: id(3), resource_version: 4, permission_code: 'airprop.asset.read', purpose: 'airprop.portfolio.read' },
  relationship: { relationship_id: id(4), relationship_version: 2, relationship_kind: 'ownership', required_scope_codes: ['owner_reporting'] },
  authority: { contract_version: authority.contract_version, decision_id: id(5), context_id: id(1), workspace_id: id(2),
    permission_code: authority.permission_code, module_code: authority.module_code,
    target_scope_type: 'workspace', target_scope_id: id(2), evaluation_purpose: 'airprop.portfolio.read' } };
const companion = { item_kind: 'canonical_resource',
  source: { source_class: 'official_workspace_record', source_reference: 'private-source-marker', source_workspace_id: id(2), source_context_id: id(1) },
  canonical_reference: { contract_version: 'canonical-resource-reference.v1', reference_status: 'verified', tenant_id: id(6),
    workspace_id: id(2), resource_type: 'property', resource_id: id(3), resource_version: 4, party_kind: null,
    display_name: 'AP-PF02 synthetic property', lifecycle_status: 'active', evaluated_at: at, action_authorization: 'not_evaluated' },
  relationship: { contract_version: 'resource-relationship.v1', relationship_id: id(4), relationship_version: 2,
    tenant_id: id(6), workspace_id: id(2), party_id: id(7), party_kind: 'person', resource_type: 'property', resource_id: id(3),
    relationship_kind: 'ownership', scope_codes: ['owner_reporting'], valid_from: '2026-10-11T12:00:00+03:30',
    valid_until: '2026-10-11T10:00:00Z', evidence_reference: 'private-evidence-marker', relationship_status: 'effective',
    evaluated_at: at, action_authorization: 'not_evaluated' } };
const input = { request, companion, authority };
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, result: 'pass' }); console.log(`PASS ${name}`); };
function withheld(change) {
  const result = map(change); assert.equal(result.disclosure, 'withheld');
  for (const field of ['context_id', 'resource', 'party', 'representation', 'provenance']) assert.equal(result[field], null);
  assert.doesNotMatch(JSON.stringify(result), /private-source-marker|private-evidence-marker|AP-PF02 synthetic property/);
}
for (const kind of ['person', 'company']) check(`${kind}_owner_mapping`, () => {
  const result = map({ ...input, companion: { ...companion, relationship: { ...companion.relationship, party_kind: kind } } });
  assert.equal(result.disclosure, 'verified'); assert.equal(result.resource.resource_version, 4);
  assert.equal(result.resource.display_name, companion.canonical_reference.display_name);
  assert.equal(result.party.party_kind, kind); assert.equal(result.party.display_name, null);
});
check('explicit_representation', () => {
  const result = map({ ...input, request: { ...request, relationship: { ...request.relationship, relationship_kind: 'representation' } },
    companion: { ...companion, relationship: { ...companion.relationship, relationship_kind: 'representation' } } });
  assert.equal(result.disclosure, 'verified'); assert.equal(result.representation.represented_resource_id, id(3));
});
check('wrong_workspace', () => withheld({ ...input, authority: { ...authority, workspace_id: id(20) } }));
check('wrong_context', () => withheld({ ...input, companion: { ...companion, source: { ...companion.source, source_context_id: id(20) } } }));
check('missing_authority', () => withheld({ ...input, authority: null }));
check('current_authority_revoked', () => withheld({ ...input, authority: { ...authority, decision: 'denied', reason_codes: ['current_effective_permission_denied'] } }));
check('stale_authority', () => withheld({ ...input, authority: { ...authority, evaluated_at: '2026-10-11T08:59:59Z' } }));
for (const status of ['revoked', 'expired']) check(`${status}_relationship`, () => withheld({ ...input, companion: { ...companion, relationship: { ...companion.relationship, relationship_status: status } } }));
check('expired_instant', () => withheld({ ...input, companion: { ...companion, relationship: { ...companion.relationship, valid_until: '2026-10-11T12:30:00+03:30' } } }));
check('stale_resource_version', () => withheld({ ...input, companion: { ...companion, canonical_reference: { ...companion.canonical_reference, resource_version: 5 } } }));
check('stale_relationship_version', () => withheld({ ...input, companion: { ...companion, relationship: { ...companion.relationship, relationship_version: 3 } } }));
check('malformed_evidence_denies', () => withheld({ ...input, companion: { private: 'not-a-companion' } }));
check('provenance_redacted_and_snapshot_not_command_authority', () => {
  const result = map(input); assert.equal(result.provenance.source_reference, null);
  assert.equal(result.provenance.relationship_evidence_reference, null);
  assert.equal(result.current_authority_recheck_required, true); assert.equal(result.reusable_as_command_authority, false);
});
check('historical_ids_preserved_without_invented_aliases', () => {
  assert.equal(map(input).resource.resource_id, request.resource.resource_id);
  withheld({ ...input, request: { ...request, resource: { ...request.resource, resource_id: id(25) } } });
});
writeFileSync('airprop-pf02-candidate-evidence.json', JSON.stringify({ package: 'AP-PF02', provider_pr: 353,
  provider_sha: PF02_CANDIDATE_SHA, consumer_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), gate: PF02_GATE, runtime_enabled: false, scope: 'offline_candidate_contract_tests', checks }, null, 2));
console.log('::notice title=AIRPROP PF02 evidence::' + readFileSync('airprop-pf02-candidate-evidence.json', 'utf8').replace(/\n/g, ''));
console.log(`AP-PF02 accepted revision: ${checks.length} PASS; consumer verification complete`);
