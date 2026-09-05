import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const testsDir = join(root, "supabase", "tests");
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const tests = readdirSync(testsDir).filter((name) => name.endsWith(".sql")).sort();

const failures = [];
const BASELINE_MIGRATIONS = 58;
const BASELINE_TESTS = 45;
const BASELINE_ASSERTIONS = 1155;

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
  const plan = Number(sql.match(/select\s+plan\((\d+)\)/i)?.[1] ?? -1);
  const assertions = (sql.match(/^select\s+(?:has_schema|has_table|has_function|ok\(|lives_ok\(|throws_like\(|throws_ok\()/gim) ?? []).length;
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
