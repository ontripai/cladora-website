import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('=== RUNNING R10 CLAIMS COMPLIANCE & LEGAL POSITIONING REGRESSION TESTS ===\n');

let passedAssertions = 0;
let totalAssertions = 0;

function runAssertion(name, fn) {
  totalAssertions++;
  try {
    fn();
    passedAssertions++;
    console.log(`[PASS] Assertion ${totalAssertions}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Assertion ${totalAssertions}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// Helper: normalize unicode strings for cross-platform comparison
// -----------------------------------------------------------------------------
function normalizeText(text) {
  return text
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function readFile(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

// =============================================================================
// Assertion 1: Exact Forbidden Claims Absence
// =============================================================================
runAssertion('Absence of forbidden claims across public/marketing source code', () => {
  const forbiddenPatterns = [
    { pattern: /European Financial Standards/i, desc: 'European Financial Standards claim' },
    { pattern: /standarde financiare europene/i, desc: 'Romanian standarde financiare europene' },
    { pattern: /استانداردهای مالی اروپایی/, desc: 'Persian European Financial Standards claim' },
    { pattern: /depunere[a]? automată a declarațiilor/i, desc: 'Automated tax filing claim' },
    { pattern: /depunere directă SPV/i, desc: 'Direct SPV filing claim' },
    { pattern: /active filing of (?:D112|D100|tax returns)/i, desc: 'Active filing claim' },
    { pattern: /direct live SPV ingestion/i, desc: 'Direct live SPV ingestion claim' },
    { pattern: /direct production SPV connection/i, desc: 'Production SPV connection without demo disclosure' },
  ];

  const targetFiles = [
    'src/config/routes-metadata.ts',
    'src/app/[lang]/layout.tsx',
    'src/app/[lang]/page.tsx',
    'src/app/[lang]/association/page.tsx',
    'src/app/[lang]/modules/page.tsx',
    'src/app/[lang]/platform/page.tsx',
    'src/app/[lang]/manager/page.tsx',
    'src/app/[lang]/prototype/page.tsx',
    'src/app/[lang]/information-architecture/page.tsx',
    'src/app/[lang]/user-testing/page.tsx',
    'src/app/[lang]/trust/page.tsx',
    'src/components/layout/Header.tsx',
    'src/components/layout/Footer.tsx',
    'src/components/home/FinancialTruthSection.tsx',
    'src/components/home/TrustStrip.tsx',
    'src/components/demo/DemoAccountingPage.tsx',
    'src/components/manager/utility-bills/UtilityBillsWorkspace.tsx',
    'src/data/mockUtilityBills.ts',
    'src/dictionaries/ro.ts',
    'src/dictionaries/en.ts',
    'src/dictionaries/fa.ts',
  ];

  for (const relPath of targetFiles) {
    const content = readFile(relPath);
    for (const { pattern, desc } of forbiddenPatterns) {
      assert.ok(
        !pattern.test(content),
        `File ${relPath} contains forbidden claim "${desc}" matching pattern ${pattern}`
      );
    }
  }
});

// =============================================================================
// Assertion 2: Canonical Accounting Positioning Presence (RO / EN / FA)
// =============================================================================
runAssertion('Canonical Accounting Positioning Presence in Romanian, English, and Persian dictionaries', () => {
  const roContent = readFile('src/dictionaries/ro.ts');
  const enContent = readFile('src/dictionaries/en.ts');
  const faContent = readFile('src/dictionaries/fa.ts');

  const expectedRo = 'CLADORA păstrează registrele obligatorii în partidă simplă pentru asociațiile de proprietari din România. Registrul în partidă dublă este un instrument analitic suplimentar și nu înlocuiește registrele și formularele statutare.';
  const expectedEn = 'CLADORA maintains Romania’s statutory simple-entry registers for condominium associations. Its double-entry general ledger is an optional supplemental analytical control and does not replace statutory books or forms.';
  const expectedFa = 'کلادورا دفاتر قانونی حسابداری یک‌طرفه انجمن‌های مالکان رومانی را نگهداری می‌کند. دفتر کل دوطرفه صرفاً یک ابزار تحلیلی تکمیلی است و جایگزین دفاتر و فرم‌های قانونی نمی‌شود.';

  assert.ok(
    roContent.includes(expectedRo),
    'Romanian dictionary (src/dictionaries/ro.ts) must contain exact canonical copy'
  );

  assert.ok(
    enContent.includes(expectedEn),
    'English dictionary (src/dictionaries/en.ts) must contain exact canonical copy'
  );

  // For Persian, test with normalized unicode comparison
  const normalizedFaContent = normalizeText(faContent);
  const normalizedExpectedFa = normalizeText(expectedFa);
  assert.ok(
    normalizedFaContent.includes(normalizedExpectedFa),
    'Persian dictionary (src/dictionaries/fa.ts) must contain exact normalized canonical copy'
  );
});

// =============================================================================
// Assertion 3: Routes Metadata Qualification (routes-metadata.ts)
// =============================================================================
runAssertion('Route metadata accurately qualifies simple-entry and supplemental analytical control', () => {
  const metadataContent = readFile('src/config/routes-metadata.ts');

  assert.ok(
    metadataContent.includes('partidă simplă') || metadataContent.includes('simple-entry'),
    'routes-metadata.ts must reflect statutory simple-entry bookkeeping'
  );
  assert.ok(
    metadataContent.includes('suplimentar') || metadataContent.includes('supplemental') || metadataContent.includes('analitic'),
    'routes-metadata.ts must qualify double-entry as supplemental/analytical'
  );
  assert.ok(
    !metadataContent.includes('European Financial Standards'),
    'routes-metadata.ts must not mention European Financial Standards'
  );
});

// =============================================================================
// Assertion 4: Public Marketing & Feature Sections Double-Entry Qualification
// =============================================================================
runAssertion('Double-entry references in public components are qualified as supplemental / analytical', () => {
  const financialTruthContent = readFile('src/components/home/FinancialTruthSection.tsx');
  const trustStripContent = readFile('src/components/home/TrustStrip.tsx');
  const footerContent = readFile('src/components/layout/Footer.tsx');
  const associationPageContent = readFile('src/app/[lang]/association/page.tsx');

  assert.ok(
    financialTruthContent.includes('Control Analitic Suplimentar') ||
    financialTruthContent.includes('instrument suplimentar') ||
    financialTruthContent.includes('Supplemental Analytical GL'),
    'FinancialTruthSection must qualify double-entry as supplemental analytical control'
  );

  assert.ok(
    trustStripContent.includes('Control Analitic') || trustStripContent.includes('suplimentar'),
    'TrustStrip must qualify general ledger / double-entry'
  );

  assert.ok(
    (footerContent.includes('partidă simplă') || footerContent.includes('simple-entry')) &&
    (footerContent.includes('controlul analitic') || footerContent.includes('supplemental') || footerContent.includes('تحلیلی')),
    'Footer must state statutory simple-entry alongside supplemental analytical control'
  );

  assert.ok(
    associationPageContent.includes('partidă simplă') &&
    (associationPageContent.includes('suplimentar') || associationPageContent.includes('supplemental')),
    'Association page must qualify month-end close with simple-entry and supplemental ledger'
  );
});

// =============================================================================
// Assertion 5: SPV / e-Factura Demo Disclosures & Simulation Identifiers
// =============================================================================
runAssertion('Demo components display visible simulation badges and use DEMO-SIM identifiers', () => {
  const mockBills = readFile('src/data/mockUtilityBills.ts');
  const utilityWorkspace = readFile('src/components/manager/utility-bills/UtilityBillsWorkspace.tsx');
  const prototypePage = readFile('src/app/[lang]/prototype/page.tsx');

  // Check mock invoice IDs start with DEMO-SIM
  assert.ok(
    mockBills.includes('DEMO-SIM-'),
    'mockUtilityBills.ts must use DEMO-SIM prefixed IDs'
  );
  assert.ok(
    !mockBills.includes('"SPV-RO-2026-991823"'),
    'mockUtilityBills.ts must not use un-prefixed SPV production-like ID'
  );

  // Check visible simulation badges/disclosures in UI components
  assert.ok(
    utilityWorkspace.includes('Simulare Demo') || utilityWorkspace.includes('No production SPV connection'),
    'UtilityBillsWorkspace must display a visible simulation disclosure banner'
  );
  assert.ok(
    utilityWorkspace.includes('DEMO-SIM-SPV-'),
    'UtilityBillsWorkspace must reference DEMO-SIM invoice IDs'
  );

  // Check prototype demo disclosure
  assert.ok(
    prototypePage.includes('Simulare Demo') || prototypePage.includes('No production SPV connection'),
    'Prototype page must state simulation status for SPV / e-Factura'
  );
  assert.ok(
    prototypePage.includes('DEMO-SIM-'),
    'Prototype page must use DEMO-SIM identifiers'
  );
});

// =============================================================================
// Assertion 6: Demo Accounting Page Disclosures
// =============================================================================
runAssertion('Demo Accounting Page displays prominent simulation badge and qualified ledger controls', () => {
  const demoPage = readFile('src/components/demo/DemoAccountingPage.tsx');

  assert.ok(
    demoPage.includes('Date de Simulare') || demoPage.includes('Demo Simulation') || demoPage.includes('Simulare Demo'),
    'DemoAccountingPage must display a prominent simulation banner/badge'
  );
  assert.ok(
    demoPage.includes('Control Analitic Suplimentar') || demoPage.includes('Supplemental Analytical Ledger') || demoPage.includes('analitic suplimentar'),
    'DemoAccountingPage must qualify double-entry general ledger as supplemental analytical instrument'
  );
});

// =============================================================================
// Assertion 7: Law 196/2018 Statutory Simple-Entry vs Supplemental Ledger Distinction
// =============================================================================
runAssertion('Statutory simple-entry registers are strictly distinguished from supplemental general ledger', () => {
  const roDict = readFile('src/dictionaries/ro.ts');
  const enDict = readFile('src/dictionaries/en.ts');
  const faDict = readFile('src/dictionaries/fa.ts');

  // RO
  assert.ok(
    roDict.includes('Partidă simplă statutară') || roDict.includes('partidă simplă'),
    'RO dictionary must explicitly reference statutory simple-entry'
  );

  // EN
  assert.ok(
    enDict.includes('statutory simple-entry') || enDict.includes('Simple-entry') || enDict.includes('simple-entry registers'),
    'EN dictionary must explicitly reference statutory simple-entry'
  );

  // FA
  assert.ok(
    faDict.includes('یک‌طرفه') || faDict.includes('یکطرفه'),
    'FA dictionary must explicitly reference single-entry statutory accounting'
  );
});

// =============================================================================
// Assertion 8: Tax Declarations & Calendar Positioning (Preparation vs Active Direct Filing)
// =============================================================================
runAssertion('Tax module positions as calendar and data preparation for authorized accountant, not direct filing', () => {
  const roDict = readFile('src/dictionaries/ro.ts');
  const enDict = readFile('src/dictionaries/en.ts');

  // Verify preparation/calendar keywords present
  assert.ok(
    roDict.includes('pregătire date pentru contabil autorizat') || roDict.includes('Calendar de conformitate'),
    'RO dictionary must position tax declarations as calendar and data preparation'
  );
  assert.ok(
    enDict.includes('accountant-ready data preparation') || enDict.includes('compliance calendar') || enDict.includes('Compliance Calendar'),
    'EN dictionary must position tax declarations as compliance calendar & accountant preparation'
  );

  // Verify absence of direct automated submission promises
  assert.ok(
    !roDict.includes('depunerea automată a declarațiilor'),
    'RO dictionary must not promise automated filing of tax returns'
  );
  assert.ok(
    !enDict.includes('automated tax filing'),
    'EN dictionary must not promise automated tax filing'
  );
});

// =============================================================================
// Assertion 9: GDPR and Data Residency Legal Qualification
// =============================================================================
runAssertion('Trust page qualifies data protection with lawful bases and safeguards, avoiding absolute zero-transfer claims', () => {
  const trustPage = readFile('src/app/[lang]/trust/page.tsx');

  assert.ok(
    trustPage.includes('minimizare a datelor') || trustPage.includes('temei legal') || trustPage.includes('Articolul 6'),
    'Trust page must articulate lawful basis and data minimization principles'
  );
  assert.ok(
    !trustPage.includes('datele nu părăsesc niciodată românia'),
    'Trust page must not make unqualified absolute geographic containment claims'
  );
});

// =============================================================================
// Assertion 10: Regression Guard - Fail-Safe on Unauthorized Claims Insertion
// =============================================================================
runAssertion('Comprehensive scan against critical regression terms across all application pages', () => {
  const scanDirs = ['src/app', 'src/components', 'src/dictionaries'];
  const disallowedTerms = [
    { term: 'European Financial Standards', regex: /\bEuropean Financial Standards\b/i },
    { term: 'standarde financiare europene', regex: /\bstandarde financiare europene\b/i },
    { term: 'depunere directă SPV', regex: /\bdepunere directă SPV\b/i },
    { term: 'active D112 automated submission', regex: /\bactive D112 automated submission\b/i },
  ];

  function walkDir(dir) {
    const entries = fs.readdirSync(path.join(projectRoot, dir), { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(walkDir(fullPath));
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = scanDirs.flatMap(d => walkDir(d));

  for (const file of allFiles) {
    const content = readFile(file);
    for (const { term, regex } of disallowedTerms) {
      assert.ok(
        !regex.test(content),
        `Regression violation: Found disallowed term "${term}" in ${file}`
      );
    }
  }
});

console.log(`\n=== SUMMARY: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED ===`);

if (passedAssertions !== totalAssertions) {
  process.exit(1);
}
