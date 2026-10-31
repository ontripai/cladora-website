import { createHash } from 'node:crypto';
import { countTapAssertions, checkTapPlan } from './lib/database-test-accounting.mjs';
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
  // This reviewed native proof is deliberately not a pgTAP test. Keep its
  // exact source sealed and report it as unexecuted, without counting a PASS
  // or a synthetic assertion. Unknown planless files still fail below.
  if (name === 'operations-checklist-command-v2.test.sql') {
    const hash = createHash('sha256').update(sql).digest('hex');
    if (hash !== 'c4ef35deac1a847b958b72e2c4f411b296ce5d3824e19c80ec647d2092856bf7') {
      failures.push(`${name}: reviewed native proof source changed; re-audit required`);
    }
    console.log(`${name}: source seal checked; native execution NOT_RUN_NOT_PASS (not TAP)`);
    continue;
  }
  let plan;
  let assertions;
  try { assertions = countTapAssertions(sql); }
  catch (error) { failures.push(`${name}: ${error.message}`); continue; }
  const directAssertions = assertions;
  const skippedAssertions = 0;
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
  if (name === '216_pgtap_session_probe_v1_test.sql') {
    if (plan !== assertions) failures.push(`${name}: standalone plan mismatch`);
  } else {
    try { checkTapPlan(sql, assertions); }
    catch (error) { failures.push(`${name}: ${error.message}`); }
  }
}
if (assertionTotal < BASELINE_ASSERTIONS) {
  failures.push(`expected at least ${BASELINE_ASSERTIONS} assertions, found ${assertionTotal}`);
}

if (failures.length) {
  console.error("Database package contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Database package static contract passed: ${migrations.length} migrations, ${tests.length - 1} TAP files, ${assertionTotal} authored assertions; 1 sealed native proof NOT_RUN_NOT_PASS.`);
