import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countTapAssertions, checkTapPlan } from './lib/database-test-accounting.mjs';

const branch = `select plan(2);
select col_is_null('s','t','c');
\\if :{?native}
select ok(true);
\\else
select throws_ok('select broken()');
\\endif
select * from finish();`;
assert.equal(countTapAssertions(branch), 2);
assert.equal(checkTapPlan(branch, countTapAssertions(branch)), 'fixed');
assert.throws(() => checkTapPlan(branch.replace('plan(2)', 'plan(3)'), 2), /does not match/);
assert.throws(() => countTapAssertions(branch.replace('select throws_ok', 'select ok(true);\nselect throws_ok')), /unequal/);
assert.throws(() => countTapAssertions(branch.replace('\\endif', '')), /unterminated/);
assert.throws(() => countTapAssertions('\\else'), /invalid/);
assert.throws(() => countTapAssertions('\\endif'), /unmatched/);
assert.throws(() => countTapAssertions('\\if :flag\nselect ok(true);\n\\endif'), /unequal/);
assert.equal(countTapAssertions("select * from skip(\n 'pending',\n 37\n);"), 37);
const dynamic = 'select no_plan();\nselect matches(\'source\',\'pattern\');\nselect * from finish();';
assert.equal(checkTapPlan(dynamic, countTapAssertions(dynamic)), 'dynamic');
assert.throws(() => checkTapPlan(dynamic.replace('select * from finish();', ''), 1), /missing TAP finish/);
assert.throws(() => checkTapPlan('select no_plan();\nselect * from finish();', 0), /must have assertions/);
assert.throws(() => checkTapPlan(dynamic + '\nselect plan(1);', 1), /exactly one/);
assert.throws(() => checkTapPlan('select ok(true);', 1), /exactly one/);
for (const [file, count, kind] of [
  ['223_building_setup_command_proof_v2.test.sql', 12, 'fixed'],
  ['225_service_quote_request_version_v2.test.sql', 21, 'fixed'],
  ['226_core_notice_ack_receipt_replay_v1.test.sql', 42, 'dynamic'],
]) {
  const sql = readFileSync(new URL(`../supabase/tests/${file}`, import.meta.url), 'utf8');
  assert.equal(countTapAssertions(sql), count, file);
  assert.equal(checkTapPlan(sql, count), kind, file);
}
console.log('PASS static TAP accounting: exclusive branches, assertion types, dynamic plans and negative controls; SQL not executed');
