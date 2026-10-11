import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as resources from '../src/lib/core/resource-contracts-v1.ts';
import { uuidSchema } from '../src/lib/customer/workspace-composition-schema.ts';
import * as authorityContracts from '../src/lib/core/resource-authority-contract-v1.ts';
import * as authoritySchemas from '../src/lib/core/workspace-authority-decision-v2.ts';
const { evaluateCoreResourceAuthorityV1 } = authorityContracts;

// Load the existing companion schema with its real dependencies, resolving only
// the repository aliases that Node's native TypeScript loader does not resolve.
const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../src/lib/core/owner-portfolio-projection-v1.ts', import.meta.url));
const companionModule = new Module(filename);
companionModule.require = (name) => {
  if (name === '@/lib/core/resource-contracts-v1') return resources;
  if (name === '@/lib/customer/workspace-composition-schema') return { uuidSchema };
  return require(name);
};
companionModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { ownerPortfolioCanonicalResourceV1Schema } = companionModule.exports;
const mappingFilename = fileURLToPath(new URL('../src/lib/core/airprop-companion-mapping-v1.ts', import.meta.url));
const mappingModule = new Module(mappingFilename);
mappingModule.require = (name) => {
  if (name === './resource-authority-contract-v1.ts') return authorityContracts;
  if (name === './owner-portfolio-projection-v1.ts') return companionModule.exports;
  if (name === './workspace-authority-decision-v2.ts') return authoritySchemas;
  return require(name);
};
mappingModule._compile(ts.transpileModule(readFileSync(mappingFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, mappingFilename);
const { mapAirpropCoreCompanionV1, AP_PF02_CORE_COMPANION_VERSION } = mappingModule.exports;

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const at = '2026-10-10T08:45:00Z';
const relationship = {
  contract_version: 'resource-relationship.v1', relationship_id: id(4), relationship_version: 2,
  tenant_id: id(6), workspace_id: id(2), party_id: id(7), party_kind: 'person',
  resource_type: 'property', resource_id: id(3), relationship_kind: 'ownership',
  scope_codes: ['owner_reporting'], valid_from: '2026-10-10T12:00:00+03:30',
  valid_until: '2026-10-10T09:00:00Z', evidence_reference: 'test://canonical-provenance',
  relationship_status: 'effective', evaluated_at: at, action_authorization: 'not_evaluated',
};
const resource = {
  contract_version: 'canonical-resource-reference.v1', reference_status: 'verified',
  tenant_id: id(6), workspace_id: id(2), resource_type: 'property', resource_id: id(3),
  resource_version: 4, party_kind: null, display_name: 'Synthetic named property',
  lifecycle_status: 'active', evaluated_at: at, action_authorization: 'not_evaluated',
};
const authority = {
  contract_version: 'workspace-native-effective-authority.v2', decision_id: id(5),
  workspace_id: id(2), permission_code: 'airprop.asset.read', module_code: 'airprop_commercial',
  target_scope_type: 'workspace', target_scope_id: id(2),
  evaluator: 'app_private.check_workspace_native_permission_v2', authority_policy_version: 2,
  source_disclosure: 'status_only', source_reference: null, evaluated_at: at,
  current_authority_recheck_required: true, reusable_as_command_authority: false,
  decision: 'allowed', reason_codes: ['current_effective_permission_allowed'],
};
const request = {
  contract_version: 'core-resource-authority.v1', evaluation_time: at,
  resource: { contract_version: 'canonical-resource-reference.v1', context_id: id(1),
    workspace_id: id(2), resource_type: 'property', resource_id: id(3), resource_version: 4,
    permission_code: 'airprop.asset.read', purpose: 'airprop.portfolio.read' },
  relationship: { relationship_id: id(4), relationship_version: 2,
    relationship_kind: 'ownership', required_scope_codes: ['owner_reporting'] },
  authority: { contract_version: authority.contract_version, decision_id: id(5),
    context_id: id(1), workspace_id: id(2), permission_code: authority.permission_code,
    module_code: authority.module_code, target_scope_type: 'workspace', target_scope_id: id(2),
    evaluation_purpose: 'airprop.portfolio.read' },
};
let cases = 0;
function check(name, fn) { fn(); cases++; console.log(`PASS ${name}`); }
const parse = (changes) => resources.resourceRelationshipV1Schema.safeParse({ ...relationship, ...changes });
const decide = (rel, auth = authority, req = request) => evaluateCoreResourceAuthorityV1(req, { resource, relationship: rel, authority: auth });

check('R1 offset interval orders actual instants', () => {
  assert.equal(parse({}).success, true);
  assert.equal(decide(relationship).decision, 'allowed');
});
check('R1 reversed instants reject despite ascending strings', () => {
  assert.equal(parse({ valid_from: '2026-10-10T09:00:00Z', valid_until: '2026-10-10T12:00:00+03:30' }).success, false);
});
check('R1 offset-equivalent endpoints reject zero-length interval', () => {
  assert.equal(parse({ valid_until: '2026-10-10T08:30:00Z' }).success, false);
});
check('R1 inclusive start and exclusive end use instants', () => {
  assert.equal(decide({ ...relationship, valid_from: '2026-10-10T12:15:00+03:30' }).decision, 'allowed');
  assert.deepEqual(decide({ ...relationship, valid_until: '2026-10-10T12:15:00+03:30' }).reason_codes, ['relationship_outside_evaluation_time']);
});
check('R1 open-ended interval remains valid', () => {
  assert.equal(decide({ ...relationship, valid_until: null }).decision, 'allowed');
});
for (const partyKind of ['person', 'company']) {
  check(`AP-PF02 existing companion maps ${partyKind} and named canonical identity`, () => {
    const rel = { ...relationship, party_kind: partyKind };
    const companion = ownerPortfolioCanonicalResourceV1Schema.parse({
      item_kind: 'canonical_resource',
      source: { source_class: 'official_workspace_record', source_reference: 'test://canonical-provenance',
        source_workspace_id: id(2), source_context_id: id(1) },
      canonical_reference: resource, relationship: rel,
    });
    assert.equal(companion.canonical_reference.display_name, 'Synthetic named property');
    assert.equal(companion.relationship.party_kind, partyKind);
    assert.equal(companion.source.source_context_id, request.resource.context_id);
    const decision = decide(companion.relationship);
    assert.equal(decision.decision, 'allowed');
    assert.equal(decision.resource_identity.resource_id, companion.canonical_reference.resource_id);
    assert.equal(decision.resource_identity.resource_version, 4);
    assert.equal(decision.relationship_reference.party_id, companion.relationship.party_id);
    assert.equal(decision.authority_reference.reusable_as_command_authority, false);
  });
}
check('AP-PF02 representation is an explicit separate relationship', () => {
  const req = structuredClone(request); req.relationship.relationship_kind = 'representation';
  const rel = { ...relationship, relationship_kind: 'representation' };
  assert.equal(decide(rel, authority, req).decision, 'allowed');
  for (const status of ['revoked', 'expired']) {
    const denied = decide({ ...rel, relationship_status: status }, authority, req);
    assert.equal(denied.decision, 'denied');
    assert.equal(denied.resource_identity, null);
    assert.equal(denied.relationship_reference, null);
  }
});
check('AP-PF02 effective representation cannot override revoked software authority', () => {
  const req = structuredClone(request); req.relationship.relationship_kind = 'representation';
  const denied = decide({ ...relationship, relationship_kind: 'representation' }, {
    ...authority, decision: 'denied', reason_codes: ['current_effective_permission_denied'],
  }, req);
  assert.deepEqual(denied.reason_codes, ['authority_denied']);
  assert.doesNotMatch(JSON.stringify(denied), /Synthetic named property|canonical-provenance/);
});
check('AP-PF02 companion rejects inconsistent source Workspace', () => {
  assert.equal(ownerPortfolioCanonicalResourceV1Schema.safeParse({
    item_kind: 'canonical_resource',
    source: { source_class: 'official_workspace_record', source_reference: 'test://canonical-provenance',
      source_workspace_id: id(20), source_context_id: id(1) },
    canonical_reference: resource, relationship,
  }).success, false);
});


check('R1 equivalent snapshot offsets are the same instant', () => {
  const evidence = { resource: { ...resource, evaluated_at: '2026-10-10T12:15:00+03:30' },
    relationship: { ...relationship, evaluated_at: '2026-10-10T10:45:00+02:00' },
    authority: { ...authority, evaluated_at: '2026-10-10T08:45:00.000Z' } };
  assert.equal(evaluateCoreResourceAuthorityV1(request, evidence).decision, 'allowed');
});
for (const [name, changes] of [
  ['invalid date', { valid_from: '2026-02-30T08:00:00Z' }],
  ['invalid offset', { valid_until: '2026-10-10T09:00:00+99:99' }],
  ['invalid text', { valid_from: 'invalid' }],
  ['future interval', { valid_from: '2026-10-10T12:16:00+03:30' }],
  ['expired interval', { valid_until: '2026-10-10T12:14:00+03:30' }],
]) {
  check(`R1 ${name} denies and redacts`, () => {
    const denied = decide({ ...relationship, ...changes });
    assert.equal(denied.decision, 'denied'); assert.equal(denied.disclosure, 'withheld');
    assert.equal(denied.resource_identity, null); assert.equal(denied.relationship_reference, null);
  });
}
function companion(rel = relationship) {
  return { item_kind: 'canonical_resource',
    source: { source_class: 'official_workspace_record', source_reference: 'private-provenance-marker',
      source_workspace_id: id(2), source_context_id: id(1) },
    canonical_reference: resource, relationship: rel };
}
const map = (item = companion(), auth = authority, req = request) =>
  mapAirpropCoreCompanionV1({ request: req, companion: item, authority: auth });
for (const kind of ['person', 'company']) {
  check(`AP-PF02 versioned ${kind} mapping uses safe resource name and explicit provenance boundary`, () => {
    const mapped = map(companion({ ...relationship, party_kind: kind }));
    assert.equal(mapped.mapping_version, AP_PF02_CORE_COMPANION_VERSION);
    assert.equal(mapped.disclosure, 'verified'); assert.equal(mapped.context_id, id(1));
    assert.equal(mapped.resource.display_name, resource.display_name);
    assert.equal(mapped.party.party_kind, kind); assert.equal(mapped.party.display_name, null);
    assert.equal(mapped.provenance.source_reference, null);
    assert.equal(mapped.provenance.relationship_evidence_reference, null);
    assert.doesNotMatch(JSON.stringify(mapped), /private-provenance-marker|canonical-provenance/);
  });
}
check('AP-PF02 Context mismatch with valid Workspace is withheld', () => {
  const item = companion(); item.source.source_context_id = id(21);
  const withheld = map(item); assert.equal(withheld.disclosure, 'withheld');
  for (const field of ['context_id', 'resource', 'party', 'representation', 'provenance']) assert.equal(withheld[field], null);
});
check('AP-PF02 representation pins representative and represented Resource without implied authority', () => {
  const req = structuredClone(request); req.relationship.relationship_kind = 'representation';
  const mapped = map(companion({ ...relationship, relationship_kind: 'representation' }), authority, req);
  assert.equal(mapped.representation.representative_party_id, id(7));
  assert.equal(mapped.representation.represented_resource_id, id(3));
  assert.equal(mapped.reusable_as_command_authority, false);
});
for (const change of ['authority', 'workspace', 'tenant', 'revoked', 'invalid']) {
  check(`AP-PF02 ${change} denial withholds all companion identity/names/provenance`, () => {
    const item = companion(); let auth = authority;
    if (change === 'authority') auth = { ...authority, decision: 'denied', reason_codes: ['current_effective_permission_denied'] };
    if (change === 'workspace') item.source.source_workspace_id = id(22);
    if (change === 'tenant') item.relationship.tenant_id = id(23);
    if (change === 'revoked') item.relationship.relationship_status = 'revoked';
    if (change === 'invalid') item.relationship.valid_until = 'invalid';
    const withheld = map(item, auth); assert.equal(withheld.disclosure, 'withheld');
    assert.doesNotMatch(JSON.stringify(withheld), /Synthetic|private-provenance-marker|canonical-provenance/);
    for (const field of ['context_id', 'resource', 'party', 'representation', 'provenance']) assert.equal(withheld[field], null);
  });
}
console.log(`${cases} R1 temporal/companion regressions passed`);
