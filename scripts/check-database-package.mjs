import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const testsDir = join(root, "supabase", "tests");
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const tests = readdirSync(testsDir).filter((name) => name.endsWith(".sql")).sort();

const failures = [];
const BASELINE_MIGRATIONS = 66;
const BASELINE_TESTS = 50;
const BASELINE_ASSERTIONS = 1518;

if (migrations.length < BASELINE_MIGRATIONS) {
  failures.push(`expected at least ${BASELINE_MIGRATIONS} migrations, found ${migrations.length}`);
}
if (tests.length < BASELINE_TESTS) {
  failures.push(`expected at least ${BASELINE_TESTS} pgTAP files, found ${tests.length}`);
}

let previousVersion = '';
for (const name of migrations) {
  const version = name.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1];
  if (!version) failures.push(`${name}: expected a 14-digit Supabase CLI migration version and snake_case name`);
  if (version && previousVersion && version <= previousVersion) failures.push(`${name}: migration version must be strictly increasing`);
  if (version) previousVersion = version;
  const sql = readFileSync(join(migrationsDir, name), "utf8");
  const begins = (sql.match(/^begin;/gim) ?? []).length;
  const ends = (sql.match(/^(commit|rollback);/gim) ?? []).length;
  if (begins !== ends) failures.push(`${name}: transaction boundary mismatch ${begins}/${ends}`);
  if (/\b(TODO|FIXME)\b/i.test(sql)) failures.push(`${name}: unresolved TODO/FIXME`);
}

let assertionTotal = 0;
for (const name of tests) {
  const sql = readFileSync(join(testsDir, name), "utf8");
  let plan = Number(sql.match(/select\s+plan\((\d+)\)/i)?.[1] ?? -1);
  const directAssertions = (sql.match(/^select\s+(?:has_schema|has_table|has_function|has_trigger|has_column\(|hasnt_column\(|results_eq\(|ok\(|is\(|isnt\(|alike\(|unalike\(|cmp_ok\(|lives_ok\(|throws_like\(|throws_ok\()/gim) ?? []).length;
  const skippedAssertions = [...sql.matchAll(/select\s+\*\s+from\s+skip\(\s*'(?:''|[^'])*'\s*,\s*(\d+)\s*\)/gim)]
    .reduce((total, match) => total + Number(match[1]), 0);
  let assertions = directAssertions + skippedAssertions;
  // Test 216 probes pgTAP itself before initializing any TAP session. Its fixed
  // standalone TAP plan and every catalog gate/case are independently audited;
  // do not generalize this exception to arbitrary dynamic/manual TAP producers.
  if (name === '216_pgtap_session_probe_v1_test.sql') {
    const { audit } = await import('./test-pgtap-session-probe.mjs');
    const receipt = audit(sql);
    plan = Number(sql.match(/^select '1\.\.(\d+)';$/m)?.[1] ?? -1);
    assertions = receipt.totalTapAssertionsAuthored;
    if (directAssertions || skippedAssertions || assertions !== 30) {
      failures.push(`${name}: standalone pgTAP probe contract changed`);
    }
  }
  assertionTotal += assertions;
  if (plan !== assertions) failures.push(`${name}: plan ${plan} does not match ${assertions} assertions`);
}
if (assertionTotal < BASELINE_ASSERTIONS) {
  failures.push(`expected at least ${BASELINE_ASSERTIONS} assertions, found ${assertionTotal}`);
}

if (failures.length) {
  console.error("Database package contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Database package contract passed: ${migrations.length} migrations, ${tests.length} tests, ${assertionTotal} assertions.`);
