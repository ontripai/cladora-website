import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_COMMIT = '83a18a583fb30b8177246a60e3505e3aac634215';
const INVENTORY_EVIDENCE_PATH = 'docs/architecture/references/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-EVIDENCE.json';
const INVENTORY_EVIDENCE_SHA256 = '43f4e5f89ce55da665c21046c2e9b3fa5c26b1c51f24174e4801fc40798a85cd';
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceFiles(directory) {
  const result = [];
  for (const name of readdirSync(path.join(root, directory))) {
    const relativePath = path.join(directory, name);
    const absolutePath = path.join(root, relativePath);
    if (statSync(absolutePath).isDirectory()) result.push(...sourceFiles(relativePath));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(name)) result.push(relativePath.split(path.sep).join('/'));
  }
  return result;
}

const allSourceFiles = sourceFiles('src');
const technicalFreeAllowlist = new Map([
  ['src/app/[lang]/platform/(control-plane)/retention-operations/page.tsx', ['side-effect-free']],
  ['src/lib/community/experience-guide-lifecycle-http-v1.ts', ['write-free']],
]);

for (const file of allSourceFiles) {
  const source = read(file);
  const matches = source.match(/\bfree\b|gratuit(?:ă|e|i)?|رایگان|مجانی|\bcomplimentary\b/giu) ?? [];
  const allowed = technicalFreeAllowlist.get(file) ?? [];
  check(matches.length === allowed.length,
    `${file} must not add public free/complimentary wording (${matches.join(', ') || 'none'})`);
  for (const phrase of allowed) {
    check(source.includes(phrase), `${file} must retain only the allowlisted technical phrase ${phrase}`);
  }
}

const correctedCopy = {
  'src/components/home/PilotProgramSection.tsx': [
    'Migrare asistată a datelor istorice din software vechi sau foi de calcul',
    'مهاجرت هدایت‌شدهٔ داده‌های تاریخی از سامانه‌های قدیمی یا فایل‌های صفحه‌گسترده',
    'Assisted historical data migration from legacy software or spreadsheets',
    '1–3 luni de reconciliere paralelă prin Shadow Ledger în perioada pilot',
    '۱ تا ۳ ماه تطبیق موازی با Shadow Ledger در دورهٔ پایلوت',
    '1–3 months of parallel Shadow Ledger reconciliation during the pilot',
  ],
  'src/components/home/PricingPreviewSection.tsx': [
    'Pachetele pilot sprijină migrarea asistată și reconcilierea paralelă prin Shadow Ledger.',
    'پلن‌های پایلوت از مهاجرت هدایت‌شده و تطبیق موازی با Shadow Ledger پشتیبانی می‌کنند.',
    'Pilot plans support assisted migration and parallel Shadow Ledger reconciliation.',
  ],
  'src/components/home/FinalCtaSection.tsx': [
    'Explorează demo-ul interactiv cu date de test',
    'محیط دموی تعاملی را بدون نیاز به ورود آزمایش کنید',
    'Explore our interactive demo with test data',
  ],
  'src/components/home/InteractiveProductPreview.tsx': [
    'Sandbox Interactiv',
    'محیط سندباکس تعاملی',
    'Interactive Sandbox',
  ],
  'src/components/auth/LoginForm.tsx': [
    'Deschide Demo Interactiv',
    'ورود به دموی تعاملی',
    'Launch Interactive Demo',
  ],
  'src/data/guides/cluster-b-operations.ts': [
    'reparații care ar fi fost acoperite de garanție',
  ],
};

for (const [file, phrases] of Object.entries(correctedCopy)) {
  const source = read(file);
  for (const phrase of phrases) check(source.includes(phrase), `${file} must contain ${phrase}`);
}

const retiredClaims = [
  'Free historical database migration',
  'zero financial risk',
  'fără costuri suplimentare',
  'بدون هیچ هزینه اضافی',
  'migrarea gratuită',
  'مهاجرت رایگان',
  'Explorează gratuit',
  'zero-login interactive demo',
  'Testare Gratuită',
  'آزمودن آنلاین و رایگان',
  'Free Sandbox',
  'Demo Interactiv Gratuit',
  'دموی آزمایشی رایگان',
  'Free Interactive Demo',
  'reparații care ar fi fost gratuite',
];
const allSource = allSourceFiles.map(file => read(file)).join('\n');
for (const phrase of retiredClaims) {
  check(!allSource.includes(phrase), `retired public claim must remain absent: ${phrase}`);
}

const zeroValueClaimPatterns = [
  /(?:amount|price|invoice|total)[^\n]{0,100}(?:===?|<=?)\s*(?:0|['"]0(?:\.0+)?['"])[^\n]{0,120}(?:free|complimentary|included with|included in your|gratuit|رایگان)/i,
  /(?:free|complimentary|included with|included in your|gratuit|رایگان)[^\n]{0,120}(?:amount|price|invoice|total)[^\n]{0,100}(?:===?|<=?)\s*(?:0|['"]0(?:\.0+)?['"])/i,
  /(?:missing|null|undefined|waived)[ _-]?(?:amount|price|invoice)[^\n]{0,120}(?:free|complimentary|included with|included in your|gratuit|رایگان)/i,
];
for (const pattern of zeroValueClaimPatterns) {
  check(!pattern.test(allSource), `source must not infer benefit wording from a numeric/missing value: ${pattern}`);
}

const servicePresentationFiles = allSourceFiles.filter(file =>
  file.startsWith('src/components/customer/CustomerService')
  || file === 'src/app/[lang]/app/services/page.tsx'
  || file === 'src/app/[lang]/service/page.tsx'
  || file === 'src/lib/customer/service-catalog-management-copy.ts');
const memberBenefitPhrases = [
  /Included with membership/i,
  /Included in your Workspace benefits/i,
  /Included with your occupancy benefits/i,
  /Included as a limited-time benefit/i,
  /Sponsored by/i,
  /\bmember allowance\b/i,
  /\bcomplimentary\b/i,
  /مشمول (?:عضویت|مزایای فضای کاری|مزایای سکونت)/,
  /با حمایت \[/,
  /Inclus (?:în abonamentul de membru|în beneficiile Workspace-ului)/i,
];
for (const file of servicePresentationFiles) {
  const source = read(file);
  for (const pattern of memberBenefitPhrases) {
    check(!pattern.test(source), `${file} must not turn a SERVICE presentation into a member benefit: ${pattern}`);
  }
}

const benefitPresentationFiles = [
  'src/app/[lang]/community-experience/page.tsx',
  'src/app/[lang]/app/community/page.tsx',
  'src/app/[lang]/app/community/events/page.tsx',
  'src/app/[lang]/app/experience/guides/page.tsx',
  'src/components/customer/CustomerCommunityBase.tsx',
  'src/components/customer/CustomerCommunityBasePage.tsx',
  'src/components/customer/CustomerEventInterestPage.tsx',
  'src/components/customer/CustomerExperienceGuide.tsx',
  'src/components/customer/CustomerExperienceGuidePage.tsx',
  ...servicePresentationFiles,
];
const benefitPresentation = [...new Set(benefitPresentationFiles)].map(file => read(file)).join('\n');

check(!/(?:localeConfig|getLocaleConfig)/.test(benefitPresentation),
  'CE benefit and SERVICE handoff presentation must not consume locale defaults as evidence');
for (const pattern of [
  /(?:lang|locale)\s*===?\s*['"](?:ro|en|fa)['"]\s*\?\s*['"](?:RO|IR|GB|RON|EUR)['"]/,
  /(?:lang|locale)[^\n]{0,120}(?:membership_bundled|service_charge_bundled|rent_bundled|owner_budget|workspace_budget|sponsor_funded|promotional_budget)/i,
  /(?:lang|locale)[^\n]{0,120}(?:funding_coverage_decision|eligibility_reason|country_code|accounting_treatment)/i,
]) {
  check(!pattern.test(benefitPresentation), `locale must not determine benefit, funding or jurisdiction evidence: ${pattern}`);
}

const publicBenefitProjection = benefitPresentation.replace(
  /target_membership_id:\s*input\.membership_id/g,
  'internal_attendance_subject_binding',
);
for (const privateField of [
  'membership_id',
  'tier_name',
  'eligibility_reason',
  'rent_amount',
  'service_charge_composition',
  'budget_balance',
  'accounting_code',
  'sponsor_contract',
  'sponsor_amount',
]) {
  check(!publicBenefitProjection.includes(privateField),
    `public CE benefit presentation must not expose ${privateField}`);
}

const canonical = read('docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md');
const canonicalNormalized = canonical.replace(/\s+/g, ' ');
for (const statement of [
  'Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**',
  'CE owns local placement and presentation, the member-facing experience',
  'A zero numeric price does not turn a SERVICE Offering into an included benefit.',
  'CE cannot create an Order',
  'Sponsored by _label_',
  'Do not expose private tier names, eligibility reasons, rent/service-charge',
  'Locale and translation select presentation only.',
]) {
  check(canonicalNormalized.includes(statement.replace(/\s+/g, ' ')),
    `canonical funding contract must retain: ${statement}`);
}

const policy = read('docs/architecture/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-v1.0.md');
const policyNormalized = policy.replace(/\s+/g, ' ');
for (const statement of [
  'Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**',
  'CE ownership remains limited to placement, presentation, experience',
  'Included with membership',
  'Included in your Workspace benefits',
  'Included with your occupancy benefits',
  'Sponsored by `[approved public label]`',
  'Included as a limited-time benefit',
  'No active public member-benefit projection',
  'No automatic purchase.',
  '**NOT_IMPLEMENTED / NOT_RUN_NOT_PASS**',
]) {
  check(policyNormalized.includes(statement.replace(/\s+/g, ' ')), `audit policy must state: ${statement}`);
}

const inventory = JSON.parse(read('docs/architecture/references/CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-INVENTORY.json'));
const inventoryEvidence = JSON.parse(read(INVENTORY_EVIDENCE_PATH));
check(inventory.schema === 'ce-member-benefit-terminology-inventory.v1', 'inventory schema must be exact');
check(inventory.baseline_commit === BASELINE_COMMIT, 'inventory baseline must pin the reviewed main commit');
check(inventory.canonical_merge_commit === '360df4b2a154bf188c2ad3ea5c673be64738c3e9',
  'inventory must separately pin the canonical funding merge');
check(inventory.evidence_snapshot === INVENTORY_EVIDENCE_PATH,
  'inventory must pin the local evidence snapshot path');
check(inventory.evidence_sha256 === INVENTORY_EVIDENCE_SHA256,
  'inventory must pin the reviewed evidence payload hash');
check(inventory.entry_count === inventory.entries.length, 'inventory entry count must match entries');
check(inventory.entry_count === 532, 'baseline inventory must retain all 532 matched occurrences');
check(inventoryEvidence.schema === 'ce-member-benefit-terminology-evidence.v1',
  'evidence snapshot schema must be exact');
check(inventoryEvidence.baseline_commit === BASELINE_COMMIT,
  'evidence snapshot must pin the same reviewed baseline commit');
check(inventoryEvidence.hash_algorithm === 'sha256', 'evidence snapshot must use sha256');
check(inventoryEvidence.payload_sha256 === INVENTORY_EVIDENCE_SHA256,
  'evidence snapshot must declare the reviewed payload hash');
const evidencePayload = { ...inventoryEvidence };
delete evidencePayload.payload_sha256;
check(sha256(canonicalJson(evidencePayload)) === INVENTORY_EVIDENCE_SHA256,
  'evidence snapshot payload bytes must match the reviewed hash');

const requiredClassificationCounts = {
  accepted: 211,
  ambiguous: 157,
  incorrect: 17,
  internal_only: 147,
};
const computedClassificationCounts = Object.fromEntries(
  Object.keys(requiredClassificationCounts).map(classification => [classification, 0]),
);
for (const classification of ['accepted', 'ambiguous', 'incorrect', 'internal_only']) {
  check(inventory.classifications.includes(classification), `inventory must declare ${classification}`);
  check(inventory.entries.some(entry => entry.classification === classification), `inventory must contain ${classification}`);
}
const evidenceFiles = new Map(inventoryEvidence.files.map(file => [file.path, file]));
check(evidenceFiles.size === inventoryEvidence.files.length,
  'evidence snapshot must not contain duplicate file paths');
const inventoryPaths = [...new Set(inventory.entries.map(entry => entry.path))].sort();
check(JSON.stringify([...evidenceFiles.keys()].sort()) === JSON.stringify(inventoryPaths),
  'evidence snapshot paths must exactly match inventory paths');
for (const entry of inventory.entries) {
  check(typeof entry.path === 'string' && Number.isInteger(entry.line) && Number.isInteger(entry.column),
    'every inventory occurrence must have path, line and column');
  check(inventory.classifications.includes(entry.classification),
    `inventory occurrence must use a canonical classification: ${entry.path}:${entry.line}`);
  computedClassificationCounts[entry.classification] += 1;
  const fileEvidence = evidenceFiles.get(entry.path);
  check(Boolean(fileEvidence), `inventory path must have baseline evidence: ${entry.path}`);
  check(inventory.baseline_file_sha256[entry.path] === fileEvidence.sha256,
    `inventory file hash must match baseline evidence: ${entry.path}`);
  const lineEvidence = fileEvidence.lines[String(entry.line)];
  check(typeof lineEvidence === 'string',
    `inventory coordinate must have versioned line evidence: ${entry.path}:${entry.line}`);
  check(lineEvidence.slice(entry.column - 1, entry.column - 1 + entry.term.length) === entry.term,
    `inventory term must begin at the exact baseline coordinate: ${entry.path}:${entry.line}:${entry.column} (${entry.term})`);
  if (entry.classification === 'incorrect') {
    check(entry.resolution === 'reworded_in_pr', `incorrect occurrence must have a bounded correction: ${entry.path}:${entry.line}`);
  }
}
check(JSON.stringify(computedClassificationCounts) === JSON.stringify(requiredClassificationCounts),
  'computed classification counts must retain accepted=211, ambiguous=157, incorrect=17 and internal_only=147');
check(JSON.stringify(inventory.classification_counts) === JSON.stringify(computedClassificationCounts),
  'declared classification counts must exactly match entries');
check(Object.keys(inventory.baseline_file_sha256).length === evidenceFiles.size,
  'inventory file-hash paths must exactly match evidence paths');
for (const fileEvidence of inventoryEvidence.files) {
  check(/^[a-f0-9]{64}$/.test(fileEvidence.sha256), `baseline file hash must be sha256: ${fileEvidence.path}`);
  check(Number.isInteger(fileEvidence.byte_length) && fileEvidence.byte_length > 0,
    `baseline file byte length must be positive: ${fileEvidence.path}`);
  check(Number.isInteger(fileEvidence.line_count) && fileEvidence.line_count > 0,
    `baseline file line count must be positive: ${fileEvidence.path}`);
}

const locales = read('src/config/locales.ts');
const layout = read('src/app/[lang]/layout.tsx');
check(/fa:\s*\{[\s\S]*?direction:\s*'rtl'/.test(locales), 'Persian locale must remain RTL');
check(layout.includes('dir={locale.direction}'), 'localized public layout must apply locale direction');

const servicePage = read('src/app/[lang]/service/page.tsx');
check(servicePage.includes('An included CE experience remains a separate flow with its own funding, entitlement, redemption, and receipt.'),
  'SERVICE must retain the canonical independent CE handoff');
check(servicePage.includes('After its allowance ends, a member may choose an independent SERVICE Offering only with a new identity, price, terms, explicit consent, and separate receipt.'),
  'exhausted allowance must require an explicit independent SERVICE flow');

console.log(`CE member-benefit terminology audit passed: ${assertions} assertions; 532 baseline occurrences classified; unsupported public free claims absent; RO/EN/FA parity and RTL preserved.`);
