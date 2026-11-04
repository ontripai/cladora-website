import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCeGuideInactiveRuntime } from './lib/ce-guide-inactive-runtime-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = 'docs/architecture/CLADORA-CE-BENEFIT-PRESENTATION-AND-SERVICE-HANDOFF-05-v1.0.md';
const inventoryPath = 'docs/architecture/references/CLADORA-CE-BENEFIT-PRESENTATION-AND-SERVICE-HANDOFF-05-INVENTORY.json';
const baselineCommit = 'aa854730df7590e7ed48666f3d45cf653ede4f15';
const baselineTree = 'aebc118d045a73b8a787243e43ecb1e48849cc34';
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}
function bytes(relativePath) {
  return readFileSync(path.join(root, relativePath));
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function normalized(value) {
  return value.replace(/\s+/g, ' ');
}
function markdownTable(source, firstHeader) {
  const lines = source.split('\n');
  const headerIndex = lines.findIndex(line => line.startsWith(`| ${firstHeader} |`));
  check(headerIndex >= 0, `markdown table must exist: ${firstHeader}`);
  check(/^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[headerIndex + 1]),
    `markdown table separator must follow: ${firstHeader}`);
  const rows = [];
  for (let index = headerIndex + 2; index < lines.length && lines[index].startsWith('|'); index += 1) {
    rows.push(lines[index].slice(1, -1).split('|').map(cell => cell.trim()));
  }
  return rows;
}

const contract = read(contractPath);
const contractNormalized = normalized(contract);
const fundingContract = normalized(read('docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md'));
const terminologyPolicySource = read('docs/architecture/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-v1.0.md');
const terminologyPolicy = normalized(terminologyPolicySource);
const ownershipContract = normalized(read('docs/architecture/CLADORA-DYNAMIC-WORKSPACE-PRODUCT-COMPOSITION-RECONCILIATION-v1.1.md'));
const applicationWorkflow = read('.github/workflows/application-foundation.yml');
const inventory = JSON.parse(read(inventoryPath));
const overlayPath = 'docs/verification/CE-BENEFIT-HANDOFF-INTEGRATION-01.json';
const overlay = JSON.parse(read(overlayPath));
check(sha256(bytes(inventoryPath)) === '88b54b42fc1348020c0f55d46d5a94962ad474b6bf89047f65f0bfe6ef287240',
  'historical inventory bytes must retain their original identity');
check(sha256(bytes(overlayPath)) === 'de414e403fe45b7c6682c58460a0bcaf6a70aa5200fc6d97735fc05ef4d0498e',
  'integration overlay bytes must retain their reviewed identity');
check(overlay.schema === 'ce-benefit-handoff-integration-overlay.v1', 'integration overlay schema must be exact');
check(overlay.historical_inventory === inventoryPath
  && overlay.historical_inventory_sha256 === sha256(bytes(inventoryPath)), 'historical inventory must remain byte-identical');
check(overlay.classification === 'SOURCE_RECONCILIATION_NOT_NATIVE_ACCEPTANCE', 'integration must not imply native acceptance');
check(overlay.integrated_source === '1d17c2483eeebf2b0f187fa9ac48ccb9e4757842', 'integration must pin its exact reviewed source');
const changes = new Map(overlay.changes.map(entry => [entry.path, entry]));
check(changes.size === 10 && overlay.changes.length === 10, 'only ten reviewed source successors supersede inventory pins');
const serviceSuccessorPath = 'docs/verification/CE-BENEFIT-HANDOFF-SERVICE-SUCCESSOR-02.json';
check(sha256(bytes(serviceSuccessorPath)) === '6e50e7f95719d897068d9bb9c884ea255f74ea6dff2bf1849ecb78780762a954',
  'SERVICE successor reconciliation must retain its exact reviewed identity');
const serviceSuccessor = JSON.parse(read(serviceSuccessorPath));
check(serviceSuccessor.schema === 'ce-benefit-handoff-service-successor.v1'
  && serviceSuccessor.previous_overlay === overlayPath
  && serviceSuccessor.previous_overlay_sha256 === sha256(bytes(overlayPath)),
  'SERVICE successor must extend the unchanged historical overlay');
check(serviceSuccessor.source_commit === '0e07ff13de4d26fa793f55d7ff90df14a47f3b57'
  && serviceSuccessor.source_tree === 'b8b22f51e85ca456a63390d2a56e113c084938c8'
  && serviceSuccessor.source_prerequisite === 'ee883b62cf4a318af3450c506931a969623b8987',
  'SERVICE successor must pin the independently reviewed R3 source');
check(serviceSuccessor.classification === 'SOURCE_AND_CONTROLLED_ACCEPTANCE_NOT_NATIVE_ACCEPTANCE'
  && serviceSuccessor.native_browser === 'NOT_RUN_NOT_PASS',
  'reconciliation must not turn source acceptance into native acceptance');
const serviceChanges = new Map(serviceSuccessor.changes.map(entry => [entry.path, entry]));
assertions += 1;
assert.deepEqual([...serviceChanges.keys()].sort(), [
  'src/components/customer/CustomerServiceCatalog.tsx',
  'src/components/customer/CustomerServiceRequests.tsx',
], 'only the two reviewed SERVICE components may supersede the prior overlay');
check(serviceSuccessor.changes.length === 2, 'duplicate SERVICE successor entries are forbidden');

check(inventory.schema === 'ce-benefit-presentation-service-handoff-inventory.v1', 'inventory schema must be exact');
check(inventory.baseline_commit === baselineCommit, 'inventory must pin the reviewed live-main commit');
check(inventory.baseline_tree === baselineTree, 'inventory must pin the reviewed live-main tree');
check(inventory.hash_algorithm === 'sha256', 'inventory must use sha256');
check(inventory.entry_count === 23 && inventory.entry_count === inventory.entries.length, 'inventory must contain exactly 23 reviewed paths');

const expectedPaths = [
  'docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md',
  'docs/architecture/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-v1.0.md',
  'src/app/[lang]/community-experience/page.tsx',
  'src/app/[lang]/app/community/page.tsx',
  'src/app/[lang]/app/community/events/page.tsx',
  'src/app/[lang]/app/experience/guides/page.tsx',
  'src/components/customer/CustomerCommunityBase.tsx',
  'src/components/customer/CustomerCommunityBasePage.tsx',
  'src/components/customer/CustomerEventInterestPage.tsx',
  'src/components/customer/CustomerExperienceGuide.tsx',
  'src/components/customer/CustomerExperienceGuidePage.tsx',
  'src/lib/community/experience-guide-client.ts',
  'src/app/[lang]/service/page.tsx',
  'src/app/[lang]/app/services/page.tsx',
  'src/components/customer/CustomerServiceCatalog.tsx',
  'src/components/customer/CustomerServiceRequests.tsx',
  'src/lib/customer/service-catalog-schema.ts',
  'src/lib/customer/service-request-schema.ts',
  'src/config/locales.ts',
  'src/app/[lang]/layout.tsx',
  'src/dictionaries/ro.ts',
  'src/dictionaries/en.ts',
  'src/dictionaries/fa.ts',
].sort();
const actualPaths = inventory.entries.map(entry => entry.path).sort();
assertions += 1;
assert.deepEqual(actualPaths, expectedPaths, 'inventory paths must exactly cover the reviewed CE, SERVICE and locale surfaces');
check(new Set(actualPaths).size === actualPaths.length, 'inventory paths must be unique');

const computedCounts = { accepted: 0, inactive: 0, internal_only: 0 };
for (const entry of inventory.entries) {
  check(existsSync(path.join(root, entry.path)), `inventory path must exist: ${entry.path}`);
  check(['canonical_contract', 'ce_presentation_surface', 'service_handoff_surface', 'localization_infrastructure'].includes(entry.kind),
    `inventory kind must be bounded: ${entry.path}`);
  check(['accepted', 'inactive', 'internal_only'].includes(entry.classification),
    `inventory classification must be bounded: ${entry.path}`);
  check(typeof entry.owner === 'string' && entry.owner.length > 0, `inventory owner must be recorded: ${entry.path}`);
  check(typeof entry.finding === 'string' && entry.finding.length > 0, `inventory finding must be recorded: ${entry.path}`);
  check(/^[a-f0-9]{64}$/.test(entry.sha256), `inventory hash must be sha256: ${entry.path}`);
  const successor = changes.get(entry.path);
  if (successor) {
    check(successor.before_sha256 === entry.sha256, `successor must bind the historical pin: ${entry.path}`);
    check(/^[a-f0-9]{40}$/.test(successor.source_commit) && /^[a-f0-9]{40}$/.test(successor.source_git_blob),
      `successor must retain exact owner provenance: ${entry.path}`);
    const serviceChange = serviceChanges.get(entry.path);
    if (serviceChange) {
      check(serviceChange.before_sha256 === successor.after_sha256
        && serviceChange.source_commit === serviceSuccessor.source_commit
        && /^[a-f0-9]{40}$/.test(serviceChange.source_git_blob),
        `SERVICE successor must bind the exact prior pin and reviewed source: ${entry.path}`);
      serviceChanges.delete(entry.path);
    }
    const current = serviceChange ?? successor;
    check(bytes(entry.path).length === current.after_bytes && sha256(bytes(entry.path)) === current.after_sha256,
      `covered file bytes must match the reviewed owner successor: ${entry.path}`);
    changes.delete(entry.path);
  } else check(sha256(bytes(entry.path)) === entry.sha256, `covered file bytes must match the reviewed inventory: ${entry.path}`);
  computedCounts[entry.classification] += 1;
}
check(changes.size === 0, 'no unrelated source may enter the integration overlay');
check(serviceChanges.size === 0, 'every SERVICE successor must extend a reviewed inventory entry');
assertions += 1;
assert.deepEqual(computedCounts, { accepted: 10, inactive: 9, internal_only: 4 }, 'classification counts must be computed from entries');
assertions += 1;
assert.deepEqual(inventory.classification_counts, computedCounts, 'declared classification counts must exactly match entries');

for (const statement of [
  'Ownership dependency: `CLADORA-DYNAMIC-WORKSPACE-PRODUCT-COMPOSITION-RECONCILIATION-v1.1.md`',
  'consumes its current `OPEN_PRODUCT_DECISION` status and bounded CE domain row',
  'current, purpose-limited projection',
  '`eligible`, `unavailable`, `withheld` or `exhausted`',
  '`amount = 0`',
  'never produces `free`, `complimentary` or `included`',
  'No automatic Request, Order, charge, booking or receipt',
  'New SERVICE command idempotency key',
  '`commands={null}`',
  '`can_edit: false`',
  'Every denial and unknown outcome is zero-write.',
]) {
  check(contractNormalized.includes(normalized(statement)), `contract must retain: ${statement}`);
}
check(!contract.includes('Benefits/Commerce/Loyalty owner:'),
  'the presentation contract must not redefine Benefits/Commerce/Loyalty ownership');
check(!contract.includes('CE scope remains limited to'),
  'the presentation contract must consume rather than restate the CE ownership row');

for (const statement of [
  'A zero numeric price does not turn a SERVICE Offering into an included benefit.',
  'CE cannot create an Order',
]) {
  check(fundingContract.includes(normalized(statement)), `canonical funding contract must retain: ${statement}`);
}
for (const statement of [
  '**Benefit ownership precedence:**',
  'all five ownership questions remain `OPEN_PRODUCT_DECISION`',
  'community, event, experience and attendance; local placement, presentation and experience orchestration',
  'benefit definition, current benefit eligibility decision, member allowance persistence, redemption aggregate/receipt',
]) {
  check(ownershipContract.includes(normalized(statement)), `merged #454 ownership contract must retain: ${statement}`);
}
check(terminologyPolicy.includes('Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**'),
  'terminology policy must retain open product ownership');
check(terminologyPolicy.includes('No active public member-benefit projection'),
  'terminology policy must retain inactive presentation status');

const presentationKeyConcepts = [
  ['`included_membership`', 'membership inclusion'],
  ['`included_workspace`', 'Workspace inclusion'],
  ['`included_occupancy`', 'occupancy inclusion'],
  ['`sponsored_public_label`', 'sponsorship'],
  ['`included_limited_time`', 'limited promotion'],
];
const contractKeyConcepts = markdownTable(contract, 'Presentation key').map(row => row.slice(0, 2));
assertions += 1;
assert.deepEqual(contractKeyConcepts, presentationKeyConcepts,
  'presentation keys must map exactly to canonical terminology concepts');

const canonicalTerminologyRows = markdownTable(terminologyPolicySource, 'Concept');
const canonicalByConcept = new Map(canonicalTerminologyRows.map(row => [row[0], row]));
const vocabulary = presentationKeyConcepts.map(([, concept]) => {
  const row = canonicalByConcept.get(concept);
  check(row?.length === 5, `canonical terminology row must be exact: ${concept}`);
  return row.slice(1, 4);
});
for (const row of vocabulary) {
  for (const phrase of row) {
    check(!contract.includes(phrase), `presentation contract must not duplicate canonical wording: ${phrase}`);
  }
}

const fundingDependency = "      - 'docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md'";
const [pullRequestPaths, pushPaths] = applicationWorkflow.split('\n  push:');
check(pullRequestPaths.includes(fundingDependency),
  'pull_request path filters must include the canonical funding contract');
check(pushPaths?.includes(fundingDependency),
  'push path filters must include the canonical funding contract');
check(applicationWorkflow.split(fundingDependency).length - 1 === 2,
  'the canonical funding dependency must appear once in each path filter');

const executablePaths = inventory.entries
  .filter(entry => ['ce_presentation_surface', 'service_handoff_surface'].includes(entry.kind))
  .map(entry => entry.path);
const executableSource = executablePaths.map(read).join('\n');
for (const row of vocabulary) {
  for (const phrase of row) {
    check(!executableSource.includes(phrase.replaceAll('`', '')),
      `inactive source must not emit positive benefit vocabulary without an owner-issued outcome: ${phrase}`);
  }
}

const cePaths = inventory.entries.filter(entry => entry.kind === 'ce_presentation_surface').map(entry => entry.path);
const ceSource = cePaths.map(read).join('\n');
for (const forbiddenDependency of [
  '/api/customer/v1/services/requests',
  'CustomerServiceRequests',
  'service-request-schema',
  'createOrder',
  'createCharge',
]) {
  check(!ceSource.includes(forbiddenDependency), `CE presentation must not invoke SERVICE mutation dependency: ${forbiddenDependency}`);
}

const servicePage = read('src/app/[lang]/service/page.tsx');
for (const statement of [
  'An included CE experience remains a separate flow with its own funding, entitlement, redemption, and receipt.',
  'After its allowance ends, a member may choose an independent SERVICE Offering only with a new identity, price, terms, explicit consent, and separate receipt.',
  'O experiență inclusă prin CE rămâne un flux separat',
  'identitate nouă, un preț nou, termeni noi, consimțământ explicit și un document separat',
  'تجربه‌ای که در CE برای عضو لحاظ شده، مسیر جداگانه‌ای',
  'شناسه، قیمت، شرایط، رضایت صریح و رسیدی جدید و جداگانه',
]) {
  check(servicePage.includes(statement), `SERVICE handoff copy must retain: ${statement}`);
}
check(!servicePage.includes('/api/customer/v1/services/requests'), 'public SERVICE explanation must not create a Request');

const serviceRequests = read('src/components/customer/CustomerServiceRequests.tsx');
for (const disclaimer of [
  'Sending a request does not accept a price, create an order or authorize payment.',
  'Trimiterea cererii nu acceptă un preț, nu creează o comandă și nu autorizează plata.',
  'ارسال درخواست به معنی قبول قیمت، ایجاد سفارش یا اجازهٔ پرداخت نیست.',
]) {
  check(serviceRequests.includes(disclaimer), `explicit SERVICE request disclaimer must remain: ${disclaimer}`);
}
check(serviceRequests.includes("onClick={()=>void submit()}"), 'SERVICE request must require an explicit member action');
check(serviceRequests.includes("idempotency_key:crypto.randomUUID()"), 'SERVICE request must create its own command idempotency key');

const serviceCatalogSchema = read('src/lib/customer/service-catalog-schema.ts');
const serviceRequestSchema = read('src/lib/customer/service-request-schema.ts');
for (const field of ['offering_id', 'revision_id', 'idempotency_key']) {
  check(serviceCatalogSchema.includes(field), `SERVICE Offering contract must retain independent ${field}`);
}
for (const field of ['offering_id', 'published_revision_id', 'idempotency_key']) {
  check(serviceRequestSchema.includes(field), `SERVICE Request contract must retain independent ${field}`);
}

const guidePage = read('src/components/customer/CustomerExperienceGuidePage.tsx');
const guideClient = read('src/lib/community/experience-guide-client.ts');
const guideComponent = read('src/components/customer/CustomerExperienceGuide.tsx');
check(guidePage.includes('commands={commands}'), 'Guide commands must use the conditional session binding');
check(/can_edit:\s*item\.can_edit/.test(guideClient), 'Guide projection must preserve the explicit server edit decision');
await assertCeGuideInactiveRuntime();
check(guideComponent.includes('guide.can_edit && commands'), 'Guide editor must require both capability and injected commands');

for (const source of [ceSource, servicePage]) {
  check(!/(?:localeConfig|getLocaleConfig)/.test(source), 'benefit/handoff presentation must not consume locale defaults as evidence');
  check(!/(?:lang|locale)[^\n]{0,120}(?:funding|eligibility|country|currency|tax|accounting)/i.test(source),
    'locale must not select funding, eligibility, country, currency, tax or accounting');
}
const locales = read('src/config/locales.ts');
const layout = read('src/app/[lang]/layout.tsx');
check(/fa:\s*\{[\s\S]*?direction:\s*'rtl'/.test(locales), 'Persian locale must remain RTL');
check(layout.includes('dir={locale.direction}'), 'localized layout must apply locale direction');
check(read('src/components/customer/CustomerServiceCatalog.tsx').includes("dir={lang === 'fa' ? 'rtl' : 'ltr'}"),
  'SERVICE presentation must preserve Persian RTL');
check(guidePage.includes("dir={lang === 'fa' ? 'rtl' : 'ltr'}"), 'Guide presentation must preserve Persian RTL');

console.log(`CE benefit presentation and SERVICE handoff contract passed: ${assertions} assertions; ${inventory.entry_count} inventory paths; no active benefit projection or automatic SERVICE mutation.`);
