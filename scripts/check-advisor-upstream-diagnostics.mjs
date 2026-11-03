import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Inventory gate only: raw findings remain visible and unresolved.
// Runtime/signature/version/definition evidence is in tests 216 and 219.
// Never use this inventory as a release, Auth or security acceptance signal.
export const expected = [
  {
    "name": "extensions.plan",
    "sqlState": "42P01",
    "message": "relation \"__tcache__\" does not exist",
    "category": "SESSION_STATE"
  },
  {
    "name": "extensions.add_result",
    "sqlState": "42P01",
    "message": "relation \"__tresults___numb_seq\" does not exist",
    "category": "SESSION_STATE"
  },
  {
    "name": "extensions.check_test",
    "sqlState": "42P01",
    "message": "relation \"__tresults___numb_seq\" does not exist",
    "category": "SESSION_STATE"
  },
  {
    "name": "extensions._currtest",
    "sqlState": "42P01",
    "message": "relation \"__tresults___numb_seq\" does not exist",
    "category": "SESSION_STATE"
  },
  {
    "name": "extensions._prokind",
    "sqlState": "42703",
    "message": "column \"proisagg\" does not exist",
    "category": "VERSION_BRANCH"
  },
  {
    "name": "extensions.has_tablespace",
    "sqlState": "42703",
    "message": "column \"spclocation\" does not exist",
    "category": "VERSION_BRANCH"
  },
  {
    "name": "extensions._def_is",
    "sqlState": "42883",
    "message": "function is(text, integer, text) does not exist",
    "category": "POLYMORPHIC_STATIC_CALL"
  },
  {
    "name": "extensions.row_eq",
    "sqlState": "42883",
    "message": "operator does not exist: record = integer",
    "category": "POLYMORPHIC_STATIC_CALL"
  }
];
export function audit(rows) {
  assert.ok(Array.isArray(rows), 'raw CLI JSON array required');
  const errors = [], warnings = [];
  for (const row of rows) {
    assert.equal(typeof row.function, 'string');
    assert.ok(Array.isArray(row.issues));
    for (const issue of row.issues) {
      assert.ok(['error', 'warning', 'warning extra'].includes(issue.level), 'unknown severity requires review');
      (issue.level === 'error' ? errors : warnings).push({ name: row.function, ...issue });
    }
  }
  assert.equal(errors.length, 8, 'error inventory changed: review raw report, never auto-waive');
  const seen = new Set();
  for (const issue of errors) {
    const item = expected.find(item => item.name === issue.name);
    assert.ok(item, 'unexpected application or extension error: ' + issue.name);
    assert.ok(!seen.has(issue.name), 'duplicate error requires review');
    seen.add(issue.name);
    assert.equal(issue.sqlState, item.sqlState, issue.name);
    assert.equal(issue.message, item.message, issue.name);
  }
  return { gate: 'EXACT_DIAGNOSTIC_INVENTORY_MATCH', rawErrors: 8,
    applicationErrors: 0, upstreamErrorsStillOpen: 8, rawWarnings: warnings.length,
    findingsResolvedByThisInventory: 0, release: 'NOT_ACCEPTED',
    prerequisiteEvidence: ['216_pgtap_session_probe_v1_test.sql', '219_advisor_upstream_extension_catalog_v1_test.sql'] };
}
export function selfTest() {
  const fixture = expected.map(item => ({ function: item.name, issues: [{ level: 'error', sqlState: item.sqlState, message: item.message }] }));
  assert.equal(audit(fixture).upstreamErrorsStillOpen, 8);
  const cases = [
    null, {}, [], fixture.slice(1),
    [...fixture, { function: 'assets.new_failure', issues: [{ level: 'error', sqlState: '55000', message: 'new failure' }] }],
    fixture.map((row, i) => i ? row : { ...row, function: 'extensions.unreviewed' }),
    fixture.map((row, i) => i ? row : { ...row, issues: [{ ...row.issues[0], sqlState: 'XX000' }] }),
    fixture.map((row, i) => i ? row : { ...row, issues: [{ ...row.issues[0], message: 'changed' }] }),
    [fixture[0], ...fixture.slice(0, 7)],
    fixture.map((row, i) => i ? row : { ...row, issues: [{ ...row.issues[0], level: 'notice' }] }),
  ];
  for (const rows of cases) assert.throws(() => audit(rows));
  const warning = { function: 'assets.warning_is_not_hidden', issues: [{ level: 'warning', sqlState: '00000', message: 'retained' }] };
  assert.equal(audit([...fixture, warning]).rawWarnings, 1);
  assert.equal(audit([...fixture, { ...warning, issues: [{ ...warning.issues[0], level: 'warning extra' }] }]).rawWarnings, 1);
  return { suite: 'advisor-upstream-diagnostic-inventory', negativeControls: cases.length,
    warningRetention: 'PASS', runtime: 'NOT_RUN_NOT_PASS' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') console.log(JSON.stringify(selfTest()));
  else {
    assert.equal(args.length, 2, 'use --input <raw-CLI-json-file> or --self-test');
    assert.equal(args[0], '--input');
    console.log(JSON.stringify(audit(JSON.parse(readFileSync(args[1], 'utf8')))));
  }
}
