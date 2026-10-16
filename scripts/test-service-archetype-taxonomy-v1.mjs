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

const taxonomy = load(new URL('../src/lib/customer/service-archetype-taxonomy-v1.ts', import.meta.url));
const source = readFileSync(new URL('../src/lib/customer/service-archetype-taxonomy-v1.ts', import.meta.url), 'utf8');
const document = readFileSync(new URL('../docs/contracts/CLADORA-SERVICE-ARCHETYPE-TAXONOMY-v1.0.md', import.meta.url), 'utf8');
const boundaryDocument = readFileSync(new URL('../docs/architecture/CLADORA-SERVICE-MEMBER-VALUE-CATALOG-AND-TEMPLATES-03-v1.0.md', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/service-catalog-contract.yml', import.meta.url), 'utf8');

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const hash = number => number.toString(16).padStart(64, '0');
const labels = code => ({ ro: `RO ${code}`, en: `EN ${code}`, fa: `FA ${code}` });
const publishedAt = '2026-10-16T12:00:00+03:30';

const primitives = taxonomy.SERVICE_PRIMITIVE_CODES.map((primitiveCode, index) => {
  const archetypeCode = taxonomy.SERVICE_ARCHETYPE_CODES.find(code => (
    taxonomy.SERVICE_ARCHETYPE_PRIMITIVE_MAP[code].includes(primitiveCode)
  ));
  assert.ok(archetypeCode, `missing archetype for ${primitiveCode}`);
  return {
    contract: taxonomy.SERVICE_ARCHETYPE_TAXONOMY_CONTRACT,
    contract_version: 1,
    owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    primitive_id: id(index + 1),
    primitive_code: primitiveCode,
    primitive_version: 1,
    content_hash: hash(index + 1),
    classification: 'member_orderable_service',
    country_scope: 'country_neutral',
    technical_effect: ['in_unit_repair', 'in_unit_equipment_installation'].includes(primitiveCode)
      ? 'possible_incidental_asset_effect'
      : 'none',
    contexts: [...taxonomy.SERVICE_ARCHETYPE_CONTEXT_MAP[archetypeCode]],
    labels: labels(primitiveCode),
    published_at: publishedAt,
  };
});

const primitiveByCode = new Map(primitives.map(primitive => [primitive.primitive_code, primitive]));
const archetypes = taxonomy.SERVICE_ARCHETYPE_CODES.map((archetypeCode, index) => ({
  contract: taxonomy.SERVICE_ARCHETYPE_TAXONOMY_CONTRACT,
  contract_version: 1,
  owner: taxonomy.SERVICE_TAXONOMY_OWNER,
  archetype_id: id(100 + index),
  archetype_code: archetypeCode,
  archetype_version: 1,
  content_hash: hash(100 + index),
  classification: 'member_orderable_service',
  country_scope: 'country_neutral',
  technical_effect_policy: 'asset_history_only_when_actual_technical_effect_is_verified',
  contexts: [...taxonomy.SERVICE_ARCHETYPE_CONTEXT_MAP[archetypeCode]],
  primitive_references: taxonomy.SERVICE_ARCHETYPE_PRIMITIVE_MAP[archetypeCode].map(primitiveCode => {
    const primitive = primitiveByCode.get(primitiveCode);
    assert.ok(primitive, `missing primitive fixture: ${primitiveCode}`);
    return {
      primitive_id: primitive.primitive_id,
      primitive_code: primitive.primitive_code,
      primitive_version: primitive.primitive_version,
      content_hash: primitive.content_hash,
    };
  }),
  labels: labels(archetypeCode),
  published_at: publishedAt,
}));

const catalog = {
  contract: taxonomy.SERVICE_ARCHETYPE_TAXONOMY_CONTRACT,
  contract_version: 1,
  owner: taxonomy.SERVICE_TAXONOMY_OWNER,
  primitives,
  archetypes,
  deprecations: [],
};

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function expectRejected(schema, value, message) {
  assert.equal(schema.safeParse(value).success, false, message);
}

check('contract and owner identities are exact', () => {
  assert.equal(taxonomy.SERVICE_ARCHETYPE_TAXONOMY_CONTRACT, 'service-archetype-taxonomy.v1');
  assert.equal(taxonomy.SERVICE_TEMPLATE_ARCHETYPE_REFERENCE_CONTRACT, 'service-template-archetype-reference.v1');
  assert.equal(taxonomy.SERVICE_TAXONOMY_DEPRECATION_CONTRACT, 'service-taxonomy-deprecation-decision.v1');
  assert.equal(taxonomy.SERVICE_TAXONOMY_OWNER, 'platform_service_taxonomy_governance');
});

check('all five Workspace contexts are present and closed', () => {
  assert.deepEqual(taxonomy.SERVICE_CONTEXT_CODES, ['residential', 'office', 'industrial', 'retail', 'hospitality']);
});

check('primitive vocabulary is closed and excludes Maintenance and CE authority', () => {
  assert.equal(taxonomy.SERVICE_PRIMITIVE_CODES.length, 27);
  for (const forbidden of [
    'elevator_servicing', 'lift_inspection', 'fire_safety_maintenance', 'boiler_repair',
    'preventive_maintenance', 'benefit_entitlement', 'allowance_redemption',
  ]) assert.equal(taxonomy.SERVICE_PRIMITIVE_CODES.includes(forbidden), false);
});

check('required member examples map to their official archetypes', () => {
  const expected = {
    unit_cleaning: 'unit_care_and_cleaning',
    in_unit_repair: 'in_unit_repair_and_installation',
    in_unit_equipment_installation: 'in_unit_repair_and_installation',
    car_wash: 'vehicle_care',
    dry_cleaning: 'garment_and_laundry',
    catering: 'food_catering_and_breakfast',
    breakfast_order: 'food_catering_and_breakfast',
    daily_shopping: 'daily_essentials_and_bread_delivery',
    bread_delivery: 'daily_essentials_and_bread_delivery',
    freight_elevator_move_reservation: 'move_and_freight_elevator_booking',
    goods_unloading: 'goods_handling_and_logistics',
    goods_loading: 'goods_handling_and_logistics',
  };
  for (const [primitiveCode, archetypeCode] of Object.entries(expected)) {
    assert.ok(taxonomy.SERVICE_ARCHETYPE_PRIMITIVE_MAP[archetypeCode].includes(primitiveCode));
  }
});

check('every primitive belongs to exactly one archetype', () => {
  for (const primitiveCode of taxonomy.SERVICE_PRIMITIVE_CODES) {
    const owners = taxonomy.SERVICE_ARCHETYPE_CODES.filter(code => (
      taxonomy.SERVICE_ARCHETYPE_PRIMITIVE_MAP[code].includes(primitiveCode)
    ));
    assert.equal(owners.length, 1, `${primitiveCode} must have one archetype`);
  }
});

check('valid primitive revisions parse without defaults', () => {
  for (const primitive of primitives) {
    assert.deepEqual(taxonomy.servicePrimitiveRevisionV1Schema.parse(primitive), primitive);
  }
});

check('primitive version must be a positive safe integer', () => {
  const primitive = primitives[0];
  for (const primitiveVersion of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const candidate = { ...primitive, primitive_version: primitiveVersion };
    if (primitiveVersion === undefined) delete candidate.primitive_version;
    expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, candidate, `version accepted: ${primitiveVersion}`);
  }
});

check('primitive identity and content hash are strict', () => {
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], primitive_id: 'invalid' });
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], content_hash: 'abcd' });
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], primitive_code: 'lift_servicing' });
});

check('duplicate primitive contexts are rejected', () => {
  const primitive = primitives[0];
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, {
    ...primitive,
    contexts: [primitive.contexts[0], primitive.contexts[0]],
  });
});

check('primitive rejects commercial provider credential and authority injection', () => {
  for (const field of [
    'price', 'currency', 'tax', 'invoice_treatment', 'provider_id', 'provider_account',
    'merchant_id', 'bank_account', 'credential', 'api_key', 'token', 'secret',
    'payment_rail', 'entitlement_id', 'member_id', 'workspace_id', 'tenant_id',
    'permission', 'authority', 'country_code', 'country_pack', 'route', 'sql',
  ]) {
    expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], [field]: 'forbidden' }, field);
  }
});

check('primitive classification and country scope are fixed', () => {
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], classification: 'maintenance' });
  expectRejected(taxonomy.servicePrimitiveRevisionV1Schema, { ...primitives[0], country_scope: 'RO' });
});

check('valid archetype revisions use exact primitive and context sets', () => {
  for (const archetype of archetypes) {
    assert.deepEqual(taxonomy.serviceArchetypeRevisionV1Schema.parse(archetype), archetype);
  }
});

check('missing additional and wrong archetype primitives are rejected', () => {
  const archetype = archetypes.find(item => item.archetype_code === 'vehicle_care');
  assert.ok(archetype);
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, {
    ...archetype,
    primitive_references: archetype.primitive_references.slice(0, 1),
  });
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, {
    ...archetype,
    primitive_references: [...archetype.primitive_references, archetypes[0].primitive_references[0]],
  });
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, {
    ...archetype,
    primitive_references: archetypes[0].primitive_references,
  });
});

check('duplicate archetype primitive references are rejected', () => {
  const archetype = archetypes[0];
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, {
    ...archetype,
    primitive_references: [archetype.primitive_references[0], archetype.primitive_references[0]],
  });
});

check('archetype context coverage is exact and cannot become authority', () => {
  const archetype = archetypes[0];
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, { ...archetype, contexts: ['industrial'] });
  expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, { ...archetype, workspace_id: id(900) });
});

check('archetype rejects commercial private country and executable fields', () => {
  for (const field of [
    'price', 'tax', 'provider_id', 'credential', 'payment_rail', 'entitlement_id',
    'member_id', 'workspace_id', 'authority', 'country_code', 'country_pack',
    'schedule', 'capacity', 'sla', 'handler', 'route', 'sql', 'executable_code',
  ]) {
    expectRejected(taxonomy.serviceArchetypeRevisionV1Schema, { ...archetypes[0], [field]: 'forbidden' }, field);
  }
});

check('complete exact catalog is accepted', () => {
  assert.deepEqual(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema.parse(catalog), catalog);
});

check('catalog rejects a tampered primitive reference hash', () => {
  const candidate = structuredClone(catalog);
  candidate.archetypes[0].primitive_references[0].content_hash = hash(999);
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, candidate);
});

check('catalog rejects duplicate primitive and archetype revisions', () => {
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    primitives: [...primitives, structuredClone(primitives[0])],
  });
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    archetypes: [...archetypes, structuredClone(archetypes[0])],
  });
});

check('primitive code and identity remain one-to-one across versions', () => {
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    primitives: [...primitives, { ...primitives[0], primitive_id: id(700), primitive_version: 2, content_hash: hash(700) }],
  });
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    primitives: [...primitives, { ...primitives[0], primitive_code: 'car_wash', primitive_version: 2, content_hash: hash(701) }],
  });
});

check('archetype code and identity remain one-to-one across versions', () => {
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    archetypes: [...archetypes, { ...archetypes[0], archetype_id: id(702), archetype_version: 2, content_hash: hash(702) }],
  });
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, {
    ...catalog,
    archetypes: [...archetypes, { ...archetypes[0], archetype_code: 'garment_and_laundry', archetype_version: 2, content_hash: hash(703) }],
  });
});

check('template reference pins exact archetype identity version and hash', () => {
  const archetype = archetypes[0];
  const reference = {
    contract: taxonomy.SERVICE_TEMPLATE_ARCHETYPE_REFERENCE_CONTRACT,
    contract_version: 1,
    archetype: {
      archetype_id: archetype.archetype_id,
      archetype_code: archetype.archetype_code,
      archetype_version: archetype.archetype_version,
      content_hash: archetype.content_hash,
    },
  };
  assert.deepEqual(taxonomy.serviceTemplateArchetypeReferenceV1Schema.parse(reference), reference);
  const missingVersion = structuredClone(reference);
  delete missingVersion.archetype.archetype_version;
  expectRejected(taxonomy.serviceTemplateArchetypeReferenceV1Schema, missingVersion);
  expectRejected(taxonomy.serviceTemplateArchetypeReferenceV1Schema, { ...reference, latest: true });
  expectRejected(taxonomy.serviceTemplateArchetypeReferenceV1Schema, {
    ...reference,
    archetype: { ...reference.archetype, archetype_version: 'latest' },
  });
});

check('same immutable revision and bytes is exact replay', () => {
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], structuredClone(primitives[0])), 'EXACT_REPLAY');
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(archetypes[0], structuredClone(archetypes[0])), 'EXACT_REPLAY');
});

check('same revision with changed bytes is an immutable conflict', () => {
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], {
    ...primitives[0], labels: { ...primitives[0].labels, en: 'Changed' }, content_hash: hash(800),
  }), 'IMMUTABLE_REVISION_CONFLICT');
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(archetypes[0], {
    ...archetypes[0], labels: { ...archetypes[0].labels, en: 'Changed' }, content_hash: hash(801),
  }), 'IMMUTABLE_REVISION_CONFLICT');
});

check('revision must advance exactly once', () => {
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], {
    ...primitives[0], primitive_version: 2, content_hash: hash(802),
  }), 'NEW_VERSION');
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision({
    ...primitives[0], primitive_version: 2, content_hash: hash(802),
  }, primitives[0]), 'STALE_VERSION');
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], {
    ...primitives[0], primitive_version: 3, content_hash: hash(803),
  }), 'VERSION_GAP');
});

check('revision cannot change stable identity or kind', () => {
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], {
    ...primitives[0], primitive_id: id(804), primitive_version: 2, content_hash: hash(804),
  }), 'IDENTITY_MISMATCH');
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], archetypes[0]), 'IDENTITY_MISMATCH');
});

check('invalid revisions produce a bounded invalid result', () => {
  assert.equal(taxonomy.compareImmutableServiceTaxonomyRevision(primitives[0], { ...primitives[0], price: '1.00' }), 'INVALID_CONTRACT');
});

check('deprecation is a separate exact-target decision', () => {
  const primitive = primitives[0];
  const decision = {
    contract: taxonomy.SERVICE_TAXONOMY_DEPRECATION_CONTRACT,
    contract_version: 1,
    owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    decision_id: id(850),
    decision_version: 1,
    target_kind: 'primitive',
    target: {
      primitive_id: primitive.primitive_id,
      primitive_code: primitive.primitive_code,
      primitive_version: primitive.primitive_version,
      content_hash: primitive.content_hash,
    },
    successor: null,
    reason_code: 'superseded_policy',
    effective_at: '2026-10-17T12:00:00+03:30',
  };
  const before = JSON.stringify(primitive);
  assert.deepEqual(taxonomy.serviceTaxonomyDeprecationDecisionV1Schema.parse(decision), decision);
  assert.equal(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema.safeParse({ ...catalog, deprecations: [decision] }).success, true);
  assert.equal(JSON.stringify(primitive), before);
});

check('deprecation successor must retain identity and advance', () => {
  const primitive = primitives[0];
  const primitiveV2 = { ...primitive, primitive_version: 2, content_hash: hash(851) };
  const decision = {
    contract: taxonomy.SERVICE_TAXONOMY_DEPRECATION_CONTRACT,
    contract_version: 1,
    owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    decision_id: id(851),
    decision_version: 1,
    target_kind: 'primitive',
    target: {
      primitive_id: primitive.primitive_id,
      primitive_code: primitive.primitive_code,
      primitive_version: 1,
      content_hash: primitive.content_hash,
    },
    successor: {
      primitive_id: primitiveV2.primitive_id,
      primitive_code: primitiveV2.primitive_code,
      primitive_version: 2,
      content_hash: primitiveV2.content_hash,
    },
    reason_code: 'revised_definition',
    effective_at: '2026-10-17T12:00:00+03:30',
  };
  assert.equal(taxonomy.serviceTaxonomyDeprecationDecisionV1Schema.safeParse(decision).success, true);
  assert.equal(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema.safeParse({
    ...catalog, primitives: [...primitives, primitiveV2], deprecations: [decision],
  }).success, true);
  expectRejected(taxonomy.serviceTaxonomyDeprecationDecisionV1Schema, {
    ...decision,
    successor: { ...decision.successor, primitive_id: id(852) },
  });
  expectRejected(taxonomy.serviceTaxonomyDeprecationDecisionV1Schema, {
    ...decision,
    successor: { ...decision.successor, primitive_version: 1 },
  });
});

check('catalog rejects unresolved deprecation target or successor', () => {
  const primitive = primitives[0];
  const decision = {
    contract: taxonomy.SERVICE_TAXONOMY_DEPRECATION_CONTRACT,
    contract_version: 1,
    owner: taxonomy.SERVICE_TAXONOMY_OWNER,
    decision_id: id(860),
    decision_version: 1,
    target_kind: 'primitive',
    target: {
      primitive_id: primitive.primitive_id,
      primitive_code: primitive.primitive_code,
      primitive_version: 1,
      content_hash: hash(999),
    },
    successor: null,
    reason_code: 'unresolved_target',
    effective_at: '2026-10-17T12:00:00+03:30',
  };
  expectRejected(taxonomy.serviceArchetypeTaxonomyCatalogV1Schema, { ...catalog, deprecations: [decision] });
});

check('freight elevator reservation is SERVICE while technical lift work is absent', () => {
  assert.ok(taxonomy.SERVICE_ARCHETYPE_PRIMITIVE_MAP.move_and_freight_elevator_booking.includes('freight_elevator_move_reservation'));
  for (const forbidden of ['lift_servicing', 'lift_repair', 'lift_inspection']) {
    assert.equal(taxonomy.SERVICE_PRIMITIVE_CODES.includes(forbidden), false);
  }
  assert.match(document, /Freight elevator reservation for a move.*SERVICE reservation.*elevator repair\/servicing remains Maintenance/);
});

check('documentation maps residential office industrial retail and hospitality examples', () => {
  for (const context of taxonomy.SERVICE_CONTEXT_CODES) assert.match(document, new RegExp(context, 'i'));
  assert.match(document, /Cleaning inside a unit/);
  assert.match(document, /Food, catering and paid breakfast order/);
  assert.match(document, /Loading, unloading, packing and movement of goods/);
});

check('documentation preserves the merged SERVICE Maintenance and CE boundary', () => {
  assert.match(document, /Benefits\/Commerce\/Loyalty owner: \*\*`OPEN_PRODUCT_DECISION`\*\*/);
  assert.match(document, /No CE entitlement, funding or redemption primitive exists/);
  assert.match(boundaryDocument, /Platform SERVICE taxonomy governance/);
  assert.match(boundaryDocument, /Benefits\/Commerce\/Loyalty owner: \*\*`OPEN_PRODUCT_DECISION`\*\*/);
});

check('schema remains pure no-I/O and persistence-free', () => {
  assert.match(source, /import \{ z \} from 'zod'/);
  assert.match(source, /import \{ uuidSchema \} from '\.\/workspace-composition-schema'/);
  for (const forbidden of [
    /supabase/i, /postgres/i, /fetch\(/, /process\.env/, /node:fs/, /node:crypto/,
    /createClient/, /route\.ts/, /migration/i, /insert\s+into/i, /grant\s+/i,
  ]) assert.doesNotMatch(source, forbidden);
});

check('contract explicitly forbids persistence route marketplace payment and activation', () => {
  assert.match(document, /creates no migration, taxonomy persistence, template persistence,/);
  assert.match(document, /handler, route, marketplace, provider network, payment wiring, grant,/);
  assert.match(document, /Remote database operation, runtime activation or Production/);
});

check('targeted SERVICE CI runs schema conformance and lint', () => {
  assert.match(workflow, /src\/lib\/customer\/service-archetype-taxonomy-v1\.ts/);
  assert.match(workflow, /docs\/contracts\/CLADORA-SERVICE-ARCHETYPE-TAXONOMY-v1\.0\.md/);
  assert.match(workflow, /scripts\/test-service-archetype-taxonomy-v1\.mjs/);
  assert.match(workflow, /node scripts\/test-service-archetype-taxonomy-v1\.mjs/);
  assert.match(workflow, /npx eslint src\/lib\/customer\/service-archetype-taxonomy-v1\.ts scripts\/test-service-archetype-taxonomy-v1\.mjs --max-warnings=0/);
});

process.stdout.write(`\nSERVICE archetype taxonomy conformance: ${passed}/${passed} PASS\n`);
