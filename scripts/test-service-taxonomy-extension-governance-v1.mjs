import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const result = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.')
    ? load(new URL(`${moduleId}.ts`, file))
    : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const governance = load(new URL('../src/lib/customer/service-taxonomy-extension-governance-v1.ts', import.meta.url));
const taxonomy = load(new URL('../src/lib/customer/service-archetype-taxonomy-v1.ts', import.meta.url));
const source = readFileSync(new URL('../src/lib/customer/service-taxonomy-extension-governance-v1.ts', import.meta.url), 'utf8');
const document = readFileSync(new URL('../docs/contracts/CLADORA-SERVICE-TAXONOMY-EXTENSION-GOVERNANCE-v1.0.md', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/service-catalog-contract.yml', import.meta.url), 'utf8');

const id = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const hash = number => number.toString(16).padStart(64, '0');
const labels = code => ({ ro: `RO ${code}`, en: `EN ${code}`, fa: `FA ${code}` });
const now = '2026-10-16T14:00:00+03:30';

function proposal(overrides = {}) {
  const value = {
    contract: taxonomy.SERVICE_TAXONOMY_EXTENSION_PROPOSAL_CONTRACT,
    contract_version: 1,
    proposal_id: id(1),
    proposal_version: 1,
    proposal_only: true,
    governance_owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    proposer_workspace_reference: id(2),
    proposed_primitive: {
      suggested_code: 'balcony_plant_care',
      labels: labels('balcony_plant_care'),
      definition: 'Member-requested care for plants located on a private residential balcony.',
      technical_effect: 'none',
    },
    proposed_archetype: {
      suggested_code: 'residential_plant_care',
      labels: labels('residential_plant_care'),
      definition: 'Country-neutral grouping for member-requested residential plant care.',
    },
    compatibility_hints: ['residential', 'mixed_use'],
    submitted_at: now,
  };
  return {
    ...value,
    ...overrides,
    proposed_primitive: { ...value.proposed_primitive, ...(overrides.proposed_primitive ?? {}) },
    proposed_archetype: { ...value.proposed_archetype, ...(overrides.proposed_archetype ?? {}) },
  };
}

function registry(overrides = {}) {
  return {
    contract: 'service-taxonomy-registry-snapshot.v1',
    contract_version: 1,
    taxonomy_revision: 7,
    primitive_codes: [...taxonomy.SERVICE_PRIMITIVE_CODES],
    archetype_codes: [...taxonomy.SERVICE_ARCHETYPE_CODES],
    semantic_fingerprints: [],
    evaluated_at: now,
    ...overrides,
  };
}

function authority(outcome = 'verified') {
  return {
    contract: 'service-taxonomy-governance-authority-evidence.v1',
    owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    actor_party_reference: id(3),
    authority_revision: 4,
    outcome,
    evaluated_at: now,
  };
}

function semanticReview(value, boundaryClassification = 'member_orderable_service', overrides = {}) {
  return {
    contract: governance.SERVICE_TAXONOMY_SEMANTIC_REVIEW_CONTRACT,
    contract_version: 1,
    proposal_id: value.proposal_id,
    proposal_version: value.proposal_version,
    boundary_classification: boundaryClassification,
    primitive_semantic_fingerprint: governance.fingerprintServiceTaxonomyPrimitiveProposalV1(value),
    archetype_semantic_fingerprint: governance.fingerprintServiceTaxonomyArchetypeProposalV1(value),
    semantic_duplicate_of: null,
    reviewed_at: now,
    ...overrides,
  };
}

function submitCommand(value, overrides = {}) {
  return {
    contract: governance.SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_COMMAND_CONTRACT,
    contract_version: 1,
    command_id: id(10),
    decision_id: id(11),
    action: 'submit',
    proposal: value,
    expected_proposal_version: value.proposal_version,
    expected_proposal_fingerprint: governance.fingerprintServiceTaxonomyExtensionProposalV1(value),
    idempotency_key: 'taxonomy-submit-0001',
    evaluated_at: now,
    ...overrides,
  };
}

function acceptCommand(value, overrides = {}) {
  return {
    contract: governance.SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_COMMAND_CONTRACT,
    contract_version: 1,
    command_id: id(20),
    decision_id: id(21),
    action: 'accept',
    proposal: value,
    expected_proposal_version: value.proposal_version,
    expected_proposal_fingerprint: governance.fingerprintServiceTaxonomyExtensionProposalV1(value),
    authority: authority(),
    semantic_review: semanticReview(value),
    expected_taxonomy_revision: 7,
    proposed_taxonomy_revision: 8,
    primitive_identity: id(22),
    primitive_content_hash: hash(22),
    archetype_identity: id(23),
    archetype_content_hash: hash(23),
    idempotency_key: 'taxonomy-accept-0001',
    evaluated_at: now,
    ...overrides,
  };
}

function rejectCommand(value, boundaryClassification, reasonCode) {
  return {
    contract: governance.SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_COMMAND_CONTRACT,
    contract_version: 1,
    command_id: id(30),
    decision_id: id(31),
    action: 'reject',
    proposal: value,
    expected_proposal_version: value.proposal_version,
    expected_proposal_fingerprint: governance.fingerprintServiceTaxonomyExtensionProposalV1(value),
    authority: authority(),
    semantic_review: semanticReview(value, boundaryClassification),
    reason_code: reasonCode,
    idempotency_key: 'taxonomy-reject-0001',
    evaluated_at: now,
  };
}

function evaluate(command, currentProposal = command.proposal, registryValue = registry(), priorDecision) {
  return governance.evaluateServiceTaxonomyExtensionGovernanceV1({
    command,
    currentProposal,
    registry: registryValue,
    priorDecision,
  });
}

function acceptedDecision(value = proposal()) {
  const result = evaluate(acceptCommand(value));
  assert.equal(result.outcome, 'new_decision');
  assert.equal(result.decision.lifecycle_status, 'accepted');
  return result.decision;
}

function reusableTemplate(value, decision, overrides = {}) {
  const candidate = decision.taxonomy_candidate;
  assert.ok(candidate);
  return {
    contract: governance.SERVICE_REUSABLE_TAXONOMY_TEMPLATE_CONTRACT,
    contract_version: 1,
    template_id: id(40),
    template_version: 1,
    content_hash: hash(40),
    lifecycle: 'accepted',
    source_workspace_reference: value.proposer_workspace_reference,
    taxonomy_revision: candidate.taxonomy_revision,
    exact_archetype_reference: {
      archetype_id: candidate.archetype.archetype_id,
      archetype_code: candidate.archetype.archetype_code,
      archetype_version: candidate.archetype.archetype_version,
      content_hash: candidate.archetype.content_hash,
      semantic_fingerprint: candidate.archetype.semantic_fingerprint,
      primitive_semantic_fingerprint: candidate.primitive.semantic_fingerprint,
    },
    provenance: {
      source_proposal: decision.proposal,
      governance_decision_id: decision.decision_id,
      governance_decision_version: 1,
      parent_template: null,
    },
    public_definition: {
      labels: candidate.archetype.labels,
      semantic_definition: candidate.archetype.semantic_definition,
    },
    country_scope: 'country_neutral',
    compatibility_hints: candidate.compatibility_hints,
    accepted_at: now,
    ...overrides,
  };
}

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function expectRejected(schema, value, message) {
  assert.equal(schema.safeParse(value).success, false, message);
}

check('merged proposal contract is consumed directly', () => {
  assert.match(source, /serviceTaxonomyExtensionProposalV1Schema/);
  assert.match(source, /type ServiceTaxonomyExtensionProposalV1/);
  assert.doesNotMatch(source, /export const serviceTaxonomyExtensionProposalV1Schema\s*=/);
  assert.equal(taxonomy.serviceTaxonomyExtensionProposalV1Schema.safeParse(proposal()).success, true);
});

check('lifecycle is closed to pending rejected and accepted', () => {
  assert.deepEqual(governance.serviceTaxonomyExtensionLifecycleV1Schema.options, ['pending', 'rejected', 'accepted']);
  expectRejected(governance.serviceTaxonomyExtensionLifecycleV1Schema, 'published');
});

check('submission creates a pending nonexecutable zero-side-effect decision', () => {
  const value = proposal();
  const result = evaluate(submitCommand(value));
  assert.equal(result.outcome, 'new_decision');
  assert.equal(result.decision.lifecycle_status, 'pending');
  assert.equal(result.decision.taxonomy_candidate, null);
  assert.equal(result.decision.executable, false);
  assert.equal(result.decision.zero_side_effects, true);
});

check('residential innovation can be accepted only as the next taxonomy candidate', () => {
  const value = proposal();
  const result = evaluate(acceptCommand(value));
  assert.equal(result.outcome, 'new_decision');
  assert.equal(result.decision.lifecycle_status, 'accepted');
  assert.equal(result.decision.decision_owner, taxonomy.SERVICE_TAXONOMY_OWNER);
  assert.equal(result.decision.taxonomy_candidate.taxonomy_revision, 8);
  assert.equal(result.decision.taxonomy_candidate.candidate_only, true);
  assert.equal(result.decision.taxonomy_candidate.orderability, 'not_orderable');
  assert.equal(result.decision.taxonomy_candidate.publication, 'not_published');
  assert.equal(result.decision.taxonomy_candidate.activation, 'inactive');
});

check('accepted candidate freezes exact semantic definitions and fingerprints', () => {
  const value = proposal();
  const candidate = acceptedDecision(value).taxonomy_candidate;
  assert.equal(candidate.primitive.semantic_definition, value.proposed_primitive.definition);
  assert.equal(candidate.archetype.semantic_definition, value.proposed_archetype.definition);
  assert.equal(candidate.primitive.semantic_fingerprint, governance.fingerprintServiceTaxonomyPrimitiveProposalV1(value));
  assert.equal(candidate.archetype.semantic_fingerprint, governance.fingerprintServiceTaxonomyArchetypeProposalV1(value));
  assert.deepEqual(candidate.archetype.exact_primitive_reference, {
    primitive_id: candidate.primitive.primitive_id,
    primitive_code: candidate.primitive.primitive_code,
    primitive_version: 1,
    content_hash: candidate.primitive.content_hash,
  });
});

check('non-governance owner cannot issue an accepted command', () => {
  const value = proposal();
  expectRejected(governance.serviceTaxonomyExtensionGovernanceCommandV1Schema, {
    ...acceptCommand(value),
    authority: { ...authority(), owner: 'workspace_taxonomy_owner' },
  });
});

check('denied governance authority cannot accept', () => {
  const value = proposal();
  const result = evaluate(acceptCommand(value, { authority: authority('denied') }));
  assert.equal(result.decision.lifecycle_status, 'rejected');
  assert.equal(result.decision.result_code, 'GOVERNANCE_AUTHORITY_DENIED');
  assert.equal(result.decision.taxonomy_candidate, null);
});

check('proposal never carries direct commerce or authority', () => {
  const value = proposal();
  for (const field of ['offering', 'orderable', 'price', 'availability', 'authority', 'activation']) {
    expectRejected(taxonomy.serviceTaxonomyExtensionProposalV1Schema, { ...value, [field]: true }, field);
  }
});

check('all eight contexts remain optional nonauthoritative hints', () => {
  const allHints = [...taxonomy.SERVICE_COMPATIBILITY_HINT_CODES];
  assert.equal(allHints.length, 8);
  const value = proposal({ compatibility_hints: allHints });
  assert.equal(taxonomy.serviceTaxonomyExtensionProposalV1Schema.safeParse(value).success, true);
  const noHints = proposal();
  delete noHints.compatibility_hints;
  assert.equal(taxonomy.serviceTaxonomyExtensionProposalV1Schema.safeParse(noHints).success, true);
  const candidate = acceptedDecision(value).taxonomy_candidate;
  assert.deepEqual(candidate.compatibility_hints, allHints);
});

check('office breakfast and catering semantic duplicate is rejected', () => {
  const value = proposal({
    proposal_id: id(101),
    proposed_primitive: {
      suggested_code: 'office_breakfast_delivery',
      definition: 'Member-requested office breakfast delivery and catering service.',
    },
    proposed_archetype: {
      suggested_code: 'office_breakfast_and_catering',
      definition: 'Office breakfast and catering grouping for member-requested paid orders.',
    },
    compatibility_hints: ['office_workplace'],
  });
  const duplicate = {
    kind: 'archetype', identity: id(102), code: 'food_catering_and_breakfast', version: 1,
    semantic_fingerprint: 'svc1:1111111111111111',
  };
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'member_orderable_service', {
    semantic_duplicate_of: duplicate,
  }) });
  assert.equal(evaluate(command).decision.result_code, 'SEMANTIC_DUPLICATE');
});

check('industrial loading semantic duplicate is rejected', () => {
  const value = proposal({
    proposal_id: id(110),
    proposed_primitive: { suggested_code: 'industrial_loading_help', definition: 'Member-requested loading and unloading for an industrial Workspace.' },
    proposed_archetype: { suggested_code: 'industrial_goods_loading', definition: 'Industrial goods loading and unloading service grouping.' },
    compatibility_hints: ['industrial', 'logistics'],
  });
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'member_orderable_service', {
    semantic_duplicate_of: {
      kind: 'primitive', identity: id(111), code: 'goods_loading', version: 1,
      semantic_fingerprint: 'svc1:2222222222222222',
    },
  }) });
  assert.equal(evaluate(command).decision.result_code, 'SEMANTIC_DUPLICATE');
});

check('automotive vehicle-care semantic duplicate is rejected', () => {
  const value = proposal({
    proposal_id: id(120),
    proposed_primitive: { suggested_code: 'automotive_member_care', definition: 'Member-requested exterior vehicle care in an automotive Workspace.' },
    proposed_archetype: { suggested_code: 'automotive_vehicle_service', definition: 'Automotive vehicle-care grouping for optional member orders.' },
    compatibility_hints: ['automotive'],
  });
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'member_orderable_service', {
    semantic_duplicate_of: {
      kind: 'archetype', identity: id(121), code: 'vehicle_care', version: 1,
      semantic_fingerprint: 'svc1:3333333333333333',
    },
  }) });
  assert.equal(evaluate(command).decision.result_code, 'SEMANTIC_DUPLICATE');
});

check('hospitality guest convenience proposal stays country neutral', () => {
  const value = proposal({
    proposal_id: id(130),
    proposed_primitive: { suggested_code: 'guest_luggage_staging', definition: 'Member-requested short-duration luggage staging for hospitality guests.' },
    proposed_archetype: { suggested_code: 'hospitality_guest_convenience', definition: 'Hospitality convenience grouping for optional guest-requested services.' },
    compatibility_hints: ['hospitality', 'mixed_use'],
  });
  const candidate = acceptedDecision(value).taxonomy_candidate;
  assert.equal(candidate.country_scope, 'country_neutral');
  assert.deepEqual(candidate.compatibility_hints, ['hospitality', 'mixed_use']);
});

check('Maintenance masquerading under a custom label is rejected', () => {
  const value = proposal({
    proposal_id: id(140),
    proposed_primitive: { suggested_code: 'resident_lift_care', definition: 'Custom-labelled periodic technical servicing of a shared elevator.' },
    proposed_archetype: { suggested_code: 'resident_mobility_care', definition: 'Custom-labelled technical maintenance of shared lift infrastructure.' },
  });
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'maintenance') });
  assert.equal(evaluate(command).decision.result_code, 'MAINTENANCE_MASQUERADE');
});

check('CE masquerading under a custom label is rejected', () => {
  const value = proposal({
    proposal_id: id(150),
    proposed_primitive: { suggested_code: 'member_welcome_gift', definition: 'Membership-funded welcome benefit with no member per-use payment.' },
    proposed_archetype: { suggested_code: 'membership_welcome_experience', definition: 'Included membership experience funded by the Workspace programme.' },
  });
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'community_experience') });
  assert.equal(evaluate(command).decision.result_code, 'COMMUNITY_EXPERIENCE_MASQUERADE');
});

check('unknown semantic classification fails closed', () => {
  const value = proposal();
  const command = acceptCommand(value, { semantic_review: semanticReview(value, 'unknown') });
  assert.equal(evaluate(command).decision.result_code, 'UNKNOWN_SEMANTICS');
});

check('code collision against a prior extension is rejected', () => {
  const value = proposal();
  const result = evaluate(acceptCommand(value), value, registry({
    primitive_codes: [...taxonomy.SERVICE_PRIMITIVE_CODES, value.proposed_primitive.suggested_code],
  }));
  assert.equal(result.decision.result_code, 'CODE_COLLISION');
});

check('semantic fingerprint rejects a duplicate even when the proposed code differs', () => {
  const original = proposal();
  const renamed = proposal({
    proposal_id: id(160),
    proposed_primitive: { suggested_code: 'terrace_botanical_care' },
    proposed_archetype: { suggested_code: 'member_terrace_plant_service' },
  });
  const result = evaluate(acceptCommand(renamed), renamed, registry({
    semantic_fingerprints: [governance.fingerprintServiceTaxonomyPrimitiveProposalV1(original)],
  }));
  assert.equal(result.decision.result_code, 'SEMANTIC_DUPLICATE');
});

check('taxonomy revision must advance exactly once', () => {
  const value = proposal();
  for (const proposedRevision of [7, 9]) {
    const result = evaluate(acceptCommand(value, { proposed_taxonomy_revision: proposedRevision }));
    assert.equal(result.decision.result_code, 'TAXONOMY_REVISION_CONFLICT');
  }
  const staleRegistry = registry({ taxonomy_revision: 8 });
  const result = evaluate(acceptCommand(value), value, staleRegistry);
  assert.equal(result.decision.result_code, 'TAXONOMY_REVISION_CONFLICT');
});

check('stale proposal version is rejected with zero side effects', () => {
  const oldProposal = proposal();
  const currentProposal = proposal({ proposal_version: 2, submitted_at: '2026-10-17T14:00:00+03:30' });
  const result = evaluate(acceptCommand(oldProposal), currentProposal);
  assert.equal(result.decision.result_code, 'STALE_PROPOSAL');
  assert.equal(result.decision.zero_side_effects, true);
  assert.equal(result.decision.taxonomy_candidate, null);
});

check('changed bytes at the same proposal version are rejected', () => {
  const commandProposal = proposal();
  const currentProposal = proposal({
    proposed_primitive: { definition: 'Changed member-requested residential balcony plant-care definition.' },
  });
  const result = evaluate(acceptCommand(commandProposal), currentProposal);
  assert.equal(result.decision.result_code, 'PROPOSAL_IMMUTABILITY_CONFLICT');
});

check('semantic review is bound to exact proposal definitions', () => {
  const value = proposal();
  const command = acceptCommand(value, { semantic_review: {
    ...semanticReview(value), primitive_semantic_fingerprint: 'svc1:4444444444444444',
  } });
  assert.equal(evaluate(command).decision.result_code, 'PROPOSAL_IMMUTABILITY_CONFLICT');
});

check('explicit governance rejection produces no taxonomy candidate', () => {
  const value = proposal();
  const result = evaluate(rejectCommand(value, 'member_orderable_service', 'OTHER_REVIEW_REJECTION'));
  assert.equal(result.decision.lifecycle_status, 'rejected');
  assert.equal(result.decision.result_code, 'REVIEW_REJECTED');
  assert.equal(result.decision.taxonomy_candidate, null);
});

check('exact replay returns the byte-equivalent prior decision', () => {
  const value = proposal();
  const command = acceptCommand(value);
  const first = evaluate(command);
  const replay = evaluate(command, value, registry(), first.decision);
  assert.equal(replay.outcome, 'exact_replay');
  assert.deepEqual(replay.decision, first.decision);
});

check('changed replay under the same idempotency key conflicts', () => {
  const value = proposal();
  const firstCommand = acceptCommand(value);
  const first = evaluate(firstCommand);
  const changed = acceptCommand(value, { archetype_content_hash: hash(999) });
  const replay = evaluate(changed, value, registry(), first.decision);
  assert.deepEqual(replay, { outcome: 'replay_conflict', code: 'REPLAY_CONFLICT' });
});

check('accepted reusable template has exact identity version hash and provenance', () => {
  const value = proposal();
  const decision = acceptedDecision(value);
  const template = reusableTemplate(value, decision);
  assert.deepEqual(governance.serviceReusableTaxonomyTemplateV1Schema.parse(template), template);
  assert.equal(template.provenance.source_proposal.proposal_fingerprint,
    governance.fingerprintServiceTaxonomyExtensionProposalV1(value));
  assert.equal(template.provenance.governance_decision_id, decision.decision_id);
});

check('template semantic definition cannot drift from accepted fingerprint', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  expectRejected(governance.serviceReusableTaxonomyTemplateV1Schema, {
    ...template,
    public_definition: { ...template.public_definition, semantic_definition: 'Changed semantic definition after governance acceptance.' },
  });
});

check('template cannot carry local commerce authority or activation', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  for (const field of ['eligibility', 'price', 'availability', 'authority', 'activation', 'offering']) {
    expectRejected(governance.serviceReusableTaxonomyTemplateV1Schema, { ...template, [field]: true }, field);
  }
});

check('template lifecycle must be accepted before adopt or fork', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  expectRejected(governance.serviceReusableTaxonomyTemplateV1Schema, { ...template, lifecycle: 'pending' });
  expectRejected(governance.serviceReusableTaxonomyTemplateV1Schema, { ...template, lifecycle: 'published' });
});

check('adoption pins the exact accepted template and creates no local facts', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  const command = {
    contract: governance.SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT,
    contract_version: 1,
    action: 'adopt',
    operation_id: id(50),
    destination_workspace_reference: id(51),
    template,
    result_identity: id(52),
    idempotency_key: 'taxonomy-adopt-0001',
    evaluated_at: now,
  };
  const decision = governance.evaluateServiceTaxonomyTemplateUseV1(command);
  assert.deepEqual(decision.exact_template_reference, {
    template_id: template.template_id,
    template_version: template.template_version,
    content_hash: template.content_hash,
  });
  assert.equal(decision.local_eligibility, 'not_evaluated');
  assert.equal(decision.local_price, 'not_set');
  assert.equal(decision.local_availability, 'not_evaluated');
  assert.equal(decision.local_activation, 'inactive');
  assert.equal(decision.zero_side_effects, true);
});

check('fork keeps provenance and uses a distinct result identity', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  const decision = governance.evaluateServiceTaxonomyTemplateUseV1({
    contract: governance.SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT,
    contract_version: 1,
    action: 'fork',
    operation_id: id(60),
    destination_workspace_reference: id(61),
    template,
    result_identity: id(62),
    idempotency_key: 'taxonomy-fork-0001',
    evaluated_at: now,
  });
  assert.equal(decision.action, 'fork');
  assert.equal(decision.provenance_preserved, true);
  assert.notEqual(decision.result_identity, template.template_id);
});

check('adoption or fork requires another Workspace and a new result identity', () => {
  const value = proposal();
  const template = reusableTemplate(value, acceptedDecision(value));
  const command = {
    contract: governance.SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT,
    contract_version: 1,
    action: 'adopt',
    operation_id: id(63),
    destination_workspace_reference: template.source_workspace_reference,
    template,
    result_identity: id(64),
    idempotency_key: 'taxonomy-adopt-0002',
    evaluated_at: now,
  };
  expectRejected(governance.serviceTaxonomyTemplateUseCommandV1Schema, command);
  expectRejected(governance.serviceTaxonomyTemplateUseCommandV1Schema, {
    ...command,
    destination_workspace_reference: id(65),
    result_identity: template.template_id,
  });
});

check('fork template cannot use itself as its parent identity', () => {
  const value = proposal();
  const base = reusableTemplate(value, acceptedDecision(value));
  expectRejected(governance.serviceReusableTaxonomyTemplateV1Schema, {
    ...base,
    provenance: {
      ...base.provenance,
      parent_template: {
        template_id: base.template_id,
        template_version: base.template_version,
        content_hash: base.content_hash,
      },
    },
  });
});

check('country neutrality and OPEN_PRODUCT_DECISION remain explicit', () => {
  assert.match(document, /country-neutral/);
  assert.match(document, /Benefits\/Commerce\/Loyalty.*`OPEN_PRODUCT_DECISION`/);
  assert.match(document, /Country Pack/);
});

check('SERVICE Maintenance and CE boundaries remain explicit', () => {
  assert.match(document, /technical elevator maintenance.*Maintenance/i);
  assert.match(document, /included benefit.*CE/i);
  assert.match(document, /freight-elevator move reservation.*SERVICE/i);
});

check('implementation remains pure no-I/O and inactive', () => {
  for (const forbidden of [
    /supabase/i, /postgres/i, /fetch\(/, /process\.env/, /node:fs/, /node:crypto/,
    /createClient/, /route\.ts/, /insert\s+into/i, /grant\s+/i,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /executable: z\.literal\(false\)/);
  assert.match(source, /zero_side_effects: z\.literal\(true\)/);
});

check('contract forbids persistence migration marketplace route payment grant and activation', () => {
  assert.match(document, /creates no persistence, migration, template store, marketplace, route,/);
  assert.match(document, /payment wiring, grant, Remote database operation or activation/);
});

check('targeted SERVICE workflow runs governance harness and lint', () => {
  assert.match(workflow, /src\/lib\/customer\/service-taxonomy-extension-governance-v1\.ts/);
  assert.match(workflow, /scripts\/test-service-taxonomy-extension-governance-v1\.mjs/);
  assert.match(workflow, /node scripts\/test-service-taxonomy-extension-governance-v1\.mjs/);
  assert.match(workflow, /npx eslint src\/lib\/customer\/service-taxonomy-extension-governance-v1\.ts scripts\/test-service-taxonomy-extension-governance-v1\.mjs --max-warnings=0/);
});

process.stdout.write(`\nSERVICE taxonomy extension governance: ${passed}/${passed} PASS\n`);
