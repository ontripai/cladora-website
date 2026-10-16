import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const reconciliationPath =
  'docs/architecture/CLADORA-DYNAMIC-WORKSPACE-PRODUCT-COMPOSITION-RECONCILIATION-v1.1.md';
const benefitContractPath =
  'docs/architecture/CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md';
const benefitContractSha256 =
  '623da80b00a53d880d6c711debb26d9bd5d5b8114299ed5ce7dc3a7ea55ed247';

const reconciliation = readFileSync(reconciliationPath, 'utf8');
const benefitContractBytes = readFileSync(benefitContractPath);
const benefitContract = benefitContractBytes.toString('utf8');

let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion ${assertions} failed: ${message}`);
  }
}

const sha256 = createHash('sha256').update(benefitContractBytes).digest('hex');
check(
  sha256 === benefitContractSha256,
  'the merged #439 benefit boundary must retain its reviewed bytes',
);

check(
  reconciliation.includes('**Benefit ownership precedence:**'),
  'the Dynamic Workspace contract must declare benefit ownership precedence',
);
check(
  reconciliation.includes(
    '`CLADORA-CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03-v1.0.md` is the later specialized contract and takes precedence',
  ),
  'precedence must name the specialized #439 contract',
);
check(
  reconciliation.includes('PR #439 at `360df4b2a154bf188c2ad3ea5c673be64738c3e9`'),
  'precedence must pin the merged #439 revision',
);
check(
  reconciliation.includes('all five ownership questions remain `OPEN_PRODUCT_DECISION`'),
  'the unresolved ownership set must remain open',
);

const ceRows = reconciliation
  .split('\n')
  .filter((line) => line.startsWith('| Community & Experience |'));
check(ceRows.length === 1, 'the domain table must contain exactly one CE ownership row');

const ceColumns = ceRows[0]
  .split('|')
  .slice(1, -1)
  .map((column) => column.trim());
check(ceColumns.length === 4, 'the CE ownership row must keep four table columns');
check(ceColumns[0] === 'Community & Experience', 'the checked row must belong to CE');
check(
  ceColumns[1].includes('owner-issued purpose-limited benefit decision reference'),
  'CE consumption must be limited to an owner-issued benefit decision reference',
);
check(
  ceColumns[2] ===
    'community, event, experience and attendance; local placement, presentation and experience orchestration',
  'CE ownership must stay within the reconciled domain boundary',
);

for (const openArtifact of [
  'benefit definition',
  'current benefit eligibility decision',
  'member allowance persistence',
  'redemption aggregate/receipt',
]) {
  check(
    ceColumns[3].includes(openArtifact),
    `CE must not create the unresolved ${openArtifact} artifact`,
  );
}

check(
  !reconciliation.includes('owns events/memberships/redemptions'),
  'the obsolete broad CE ownership statement must be absent',
);
check(
  !reconciliation.includes('membership/benefit eligibility, attendance/redemption state'),
  'the obsolete CE table ownership statement must be absent',
);

for (const openDecision of [
  'Benefits/Commerce/Loyalty',
  'benefit definition',
  'current benefit eligibility decisions',
  'member allowance persistence',
  'redemption aggregates/receipts',
]) {
  check(
    reconciliation.includes(openDecision),
    `the reconciliation must name the open ${openDecision} decision`,
  );
}

check(
  reconciliation.includes('A Workspace product/module entitlement remains a Core platform-composition fact.'),
  'product/module entitlement must remain a Core composition fact',
);
check(
  reconciliation.includes('`platform.entitlement_usage_ledger` is limited to product/module entitlement'),
  'the platform entitlement ledger must stay limited to product/module entitlement',
);
check(
  reconciliation.includes('must not persist or calculate a member allowance'),
  'member allowance must not be conflated with product entitlement usage',
);

for (const preservedBoundary of [
  'SERVICE fallback Offering handoff',
  'Finance funding and accounting',
  'privacy-safe presentation',
  'multi-Workspace Benefit Network',
]) {
  check(
    reconciliation.includes(preservedBoundary),
    `the reconciliation must preserve the ${preservedBoundary} boundary`,
  );
}

check(
  benefitContract.includes('Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**'),
  'the canonical contract must keep Benefits/Commerce/Loyalty ownership open',
);
check(
  benefitContract.includes('CE owns local placement and presentation'),
  'the canonical contract must retain the bounded CE presentation scope',
);
check(
  benefitContract.includes('CE cannot create an Order'),
  'the canonical SERVICE handoff must prohibit automatic CE Orders',
);
check(
  benefitContract.includes('Budget, journals, tax, currency and provider settlement | Finance/accounting'),
  'the canonical Finance boundary must remain present',
);
check(
  benefitContract.includes('## Benefit Network boundary'),
  'the canonical multi-Workspace Benefit Network boundary must remain present',
);
check(
  benefitContract.includes('Cross-tenant authority is forbidden.'),
  'the Benefit Network must not produce cross-tenant authority',
);
check(
  benefitContract.includes('No tier, membership ID, eligibility reason, budget balance'),
  'the canonical privacy boundary must remain present',
);

console.log(
  `CE benefit ownership reconciliation passed: ${assertions} assertions; #439 bytes pinned; CE ownership narrowed; open product decisions preserved.`,
);
