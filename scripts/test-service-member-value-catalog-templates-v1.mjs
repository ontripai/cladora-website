import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const document = read('docs/architecture/CLADORA-SERVICE-MEMBER-VALUE-CATALOG-AND-TEMPLATES-03-v1.0.md');
const page = read('src/app/[lang]/service/page.tsx');
const metadata = read('src/config/routes-metadata.ts');
const catalogSchema = read('src/lib/customer/service-catalog-schema.ts');
const catalogMigration = read('supabase/migrations/20261003200211_20261003141918_service_catalog_persistence_v1.sql');
const ceBoundary = read('docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md');
const paymentDiscovery = read('docs/roadmap/CLADORA-SERVICE-MULTI-COUNTRY-PAYMENT-PROFILE-01-v1.0.md');
const workflow = read('.github/workflows/service-catalog-contract.yml');

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function includesAll(source, values, label) {
  for (const value of values) {
    assert.ok(source.includes(value), `${label} is missing: ${value}`);
  }
}

check('package is explicitly documentation and static-contract only', () => {
  assert.match(document, /Status: \*\*documentation\/static-contract-only; no runtime acceptance\*\*/);
  assert.match(document, /No table, migration, route, handler, grant, credential, adapter,/);
  assert.match(document, /issues no SERVICE runtime acceptance/);
});

check('live inventory distinguishes observed implementation from missing template capabilities', () => {
  includesAll(document, [
    '`service_catalog.definitions`',
    '`service_catalog.offerings`',
    'immutable `service_catalog.revisions`',
    'No SERVICE template identity, version, lifecycle, adoption, fork lineage',
    'not the canonical six-model taxonomy',
  ], 'inventory evidence');
  assert.match(catalogMigration, /create table service_catalog\.definitions/);
  assert.match(catalogMigration, /create table service_catalog\.offerings/);
  assert.match(catalogMigration, /create table service_catalog\.revisions/);
  assert.match(catalogMigration, /service_catalog_revision_immutable/);
});

check('official SERVICE Maintenance and CE boundaries remain separate', () => {
  assert.match(document, /\| \*\*SERVICE\*\* \| Optional service a member independently orders, books or purchases/);
  assert.match(document, /\| \*\*Maintenance\*\* \| Technical, preventive, corrective or mandatory work/);
  assert.match(document, /\| \*\*CE\*\* \| Experience or included benefit governed by an independent funding and eligibility decision/);
  assert.match(document, /Benefits\/Commerce\/Loyalty owner: \*\*`OPEN_PRODUCT_DECISION`\*\*/);
  assert.match(ceBoundary, /Benefits\/Commerce\/Loyalty owner: \*\*`OPEN_PRODUCT_DECISION`\*\*/);
});

check('representative member-service taxonomy is complete', () => {
  includesAll(document, [
    'cleaning inside a unit',
    'repair or installation of equipment inside a unit',
    'car wash and vehicle care',
    'dry cleaning',
    'food, catering and breakfast ordering',
    'everyday shopping and morning bread delivery',
    'concierge and parcel handling',
    'reserving a space, desk, room or equipment',
    'reserving a freight elevator for a move',
    'unloading, loading, packing and movement of goods',
    'custom office, commercial, industrial and hospitality services',
  ], 'SERVICE example');
});

check('technical and statutory maintenance stays outside SERVICE', () => {
  includesAll(document, [
    'lift repair and periodic lift servicing',
    'fire-safety system maintenance',
    'repair of pumps, generators, boilers and central plant',
    'preventive or statutory maintenance of common areas and infrastructure',
  ], 'Maintenance exclusion');
  assert.match(document, /Booking a freight elevator for a move is a SERVICE reservation\. Servicing or\s+certifying that elevator is Maintenance/);
});

check('four-layer model and owners are explicit', () => {
  includesAll(document, [
    '### 4.1 Service Archetype',
    '### 4.2 Workspace Service Definition',
    '### 4.3 Reusable Service Template',
    '### 4.4 Workspace Offering',
    'Platform SERVICE taxonomy governance',
    'Source Workspace under current SERVICE authority',
    'SERVICE template aggregate',
    'Destination Workspace',
  ], 'entity or owner');
});

check('template lifecycle uses the closed eight-state vocabulary', () => {
  const lifecycle = document.match(/The closed lifecycle vocabulary is:\n\n```text\n([\s\S]*?)\n```/)?.[1];
  assert.ok(lifecycle, 'lifecycle code block is missing');
  assert.deepEqual(lifecycle.split('\n'), [
    'draft',
    'private',
    'shared',
    'submitted_for_review',
    'approved',
    'published',
    'deprecated',
    'withdrawn',
  ]);
});

check('published templates are immutable and adoption is exact-version pinned', () => {
  includesAll(document, [
    'Every published revision is immutable and content-hash bound.',
    'Adoption pins `template_id + template_version + content_hash`.',
    'Upgrade requires an explicit destination-Workspace command',
    'A fork creates a new definition identity and retains its complete lineage',
    'deprecating or withdrawing a template cannot delete an accepted',
  ], 'versioning rule');
});

check('public publication requires exact moderation and safety evidence', () => {
  assert.match(document, /Public publication requires moderation and safety review for the exact/);
  assert.match(document, /A prior version's approval cannot approve a changed one/);
  assert.match(document, /CORE-TEMPLATE-MODERATION-DECISION-01/);
});

check('template payload excludes operational financial private and country authority', () => {
  includesAll(document, [
    'final price',
    'currency or tax assumption',
    'provider account',
    'merchant ID',
    'bank account',
    'API key, token or secret',
    'active payment rail',
    'member entitlement',
    'private member or unit data',
    'Country Pack authority',
  ], 'forbidden template field');
  assert.match(document, /cannot contain executable\ncode, SQL, a route, permission assignment, grant, role membership, provider\ncredential/);
});

check('destination Workspace owns all local Offering bindings', () => {
  includesAll(document, [
    'internal or external provider',
    'beneficiary and eligibility',
    'service area and delivery point',
    'schedule, capacity and time slot',
    'price and currency',
    'tax and invoice treatment',
    'payment rail',
    'cancellation',
    'acceptance and dispute handling',
    'SLA',
  ], 'destination decision');
});

check('six commercial models are closed and current shape is not overstated', () => {
  const models = document.match(/canonical SERVICE commercial vocabulary proposed for future alignment is:\n\n```text\n([\s\S]*?)\n```/)?.[1];
  assert.ok(models, 'commercial model block is missing');
  assert.deepEqual(models.split('\n'), [
    'fixed_price',
    'usage_based',
    'subscription',
    'booking',
    'quotation',
    'post_assessment',
  ]);
  includesAll(catalogSchema, [
    "z.literal('quote_required')",
    "z.literal('fixed')",
    "z.literal('unit')",
    "'direct', 'pre_quote', 'on_site', 'project', 'reservation'",
  ], 'observed catalogue shape');
});

check('SERVICE does not own included benefits or CE entitlement', () => {
  assert.match(document, /SERVICE does not own or produce an included benefit, CE entitlement,/);
  assert.match(document, /A zero price is not proof of an included\nbenefit/);
  assert.match(document, /Funding or discount references may be attached as independently verified\nevidence/);
});

check('CE handoff keeps breakfast and car wash paths independent', () => {
  includesAll(document, [
    'Paid breakfast order',
    'Breakfast included with membership',
    'Paid car wash',
    'Seasonal car-wash allowance',
    'must not create an Order or charge',
    'separate aggregate identity, idempotency key,',
    'command fingerprint, consent and receipt',
  ], 'CE handoff rule');
});

check('service and asset histories remain independent', () => {
  assert.match(document, /Every accepted SERVICE purchase, reservation or order has a SERVICE Order/);
  assert.match(document, /Only a service with a real technical effect on an asset may reference the/);
  assert.match(document, /Food, bread, catering, dry cleaning and car wash are not recorded as\n  Maintenance/);
  assert.match(document, /SERVICE history and asset Maintenance history remain separate canonical/);
});

check('country selection is canonical and has no contextual fallback', () => {
  assert.match(document, /Country comes only from the canonical Property jurisdiction decision/);
  assert.match(document, /Currency, tax, invoice and payment rail come from accepted, versioned\n   Country Pack domain artifacts/);
  assert.match(document, /Locale, language, IP address, timezone, browser settings and Workspace\n   defaults cannot select or fabricate country/);
  assert.match(document, /Source-Workspace price, currency, tax, invoice, rail and country policy are\n   never imposed on the destination/);
  assert.match(paymentDiscovery, /There is no fallback to locale/);
});

check('country incompatibility and missing destination configuration fail closed', () => {
  assert.match(document, /Adoption must fail closed when a required destination Country Pack artifact/);
  assert.match(document, /Missing destination configuration returns a bounded unavailable result with\nzero writes/);
  assert.match(document, /Compatibility is a gate, not an authority grant/);
});

check('threat model covers replay rollback unknown commit and disclosure', () => {
  includesAll(document, [
    'Same key with changed version/binding',
    'Provider or authority changes before commit',
    'Commit acknowledgement is lost',
    '`READBACK_REQUIRED`',
    'Full rollback',
    'Normal denials reveal no source private data',
  ], 'threat control');
});

check('gap analysis does not claim missing providers or stores are implemented', () => {
  includesAll(document, [
    'Archetype/primitive registry | Missing',
    'Template aggregate/lifecycle | Missing',
    'Moderation/safety provider | Missing/named owner required',
    'Adoption and fork lineage | Missing',
    'Benefits/Commerce/Loyalty ownership | `OPEN_PRODUCT_DECISION`',
    'Runtime API/UI | Not authorized by this package',
  ], 'gap status');
});

check('topological package order keeps contracts and owner providers before persistence and runtime', () => {
  const ordered = [
    'SV-SERVICE-ARCHETYPE-TAXONOMY-04',
    'SV-REUSABLE-TEMPLATE-CONTRACT-05',
    'CORE-TEMPLATE-MODERATION-DECISION-01',
    'CORE-COUNTRY-TEMPLATE-COMPATIBILITY-01',
    'SV-TEMPLATE-PERSISTENCE-06',
    'SV-TEMPLATE-ADOPTION-07',
    'SV-OFFERING-MODEL-ALIGNMENT-08',
    'SV-TEMPLATE-MANAGEMENT-09',
    'SV-TEMPLATE-RUNTIME-ACCEPTANCE-10',
  ];
  let previous = -1;
  for (const packageId of ordered) {
    const position = document.indexOf(packageId);
    assert.ok(position > previous, `dependency order is wrong at ${packageId}`);
    previous = position;
  }
});

check('future matrix covers exact version concurrency and zero-write behavior', () => {
  for (let index = 1; index <= 36; index += 1) {
    assert.match(document, new RegExp(`\\| MVC-${String(index).padStart(2, '0')} \\|`));
  }
  assert.match(document, /One commit and one exact replay/);
  assert.match(document, /zero writes/i);
});

check('public SERVICE copy preserves capability wording and independent CE handoff', () => {
  assert.match(page, /A Workspace can configure or choose its own service catalog/);
  assert.match(page, /included CE experience remains a separate flow with its own funding, entitlement, redemption, and receipt/);
  assert.match(page, /independent SERVICE Offering only with a new identity, price, terms, explicit consent, and separate receipt/);
  assert.match(metadata, /SERVICE — Member Services & Bookings/);
  assert.doesNotMatch(metadata, /Services, Bookings & Benefits/);
});

check('static contract is wired into the SERVICE contract workflow', () => {
  assert.match(workflow, /docs\/architecture\/CLADORA-SERVICE-MEMBER-VALUE-CATALOG-AND-TEMPLATES-03-v1\.0\.md/);
  assert.match(workflow, /scripts\/test-service-member-value-catalog-templates-v1\.mjs/);
  assert.match(workflow, /node scripts\/test-service-member-value-catalog-templates-v1\.mjs/);
  assert.match(workflow, /npx eslint scripts\/test-service-member-value-catalog-templates-v1\.mjs --max-warnings=0/);
});

check('explicit non-acceptance forbids every requested operational side effect', () => {
  assert.match(document, /does not create or authorize a migration, handler, route,/);
  assert.match(document, /marketplace, provider network, payment wiring, permission, grant, credential,/);
  assert.match(document, /Remote database operation, Production activation or merge/);
  assert.match(document, /does not\nresolve `OPEN_PRODUCT_DECISION`, publish a template, adopt a template, activate/);
});

process.stdout.write(`\nSERVICE member value catalogue/template static contract: ${passed}/${passed} PASS\n`);
