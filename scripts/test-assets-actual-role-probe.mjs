import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Offline contract inspection only. This entry point has no DB/Auth/Docker,
// process runner, network client, dotenv loader or runtime execution option.
const sqlUrl = new URL('../supabase/tests/215_assets_actual_role_probe_v1_test.sql', import.meta.url);
const options = process.argv.slice(2);
assert.ok(options.length <= 1 && options.every(value => ['--source-check', '--help'].includes(value)),
  'Only --source-check or --help is supported; Coordinator owns DB execution');
if (options.includes('--help')) {
  console.log('Offline: node scripts/test-assets-actual-role-probe.mjs --source-check');
  console.log('Coordinator only, on an authorized existing disposable stack with pgTAP:');
  console.log('supabase test db supabase/tests/215_assets_actual_role_probe_v1_test.sql');
  console.log('This is a SQL-session JWT fixture probe, not genuine Auth/JWT or HTTP proof.');
  console.log('Temporal get_asset_detail denials may FAIL on BASE; do not skip or invert them.');
} else {
  const sql = await readFile(sqlUrl, 'utf8');
  assert.match(sql, /BASE: 0b7f16f6127957d47c7fda233860d55c01b1dcfc/);
  assert.match(sql, /SQL-session JWT fixture, NOT a signed token/);
  assert.match(sql, /^begin;$/m);
  assert.match(sql, /^select plan\(72\);$/m);
  assert.match(sql, /select \* from finish\(\);[\s\S]*rollback;\s*$/i);
  assert.match(sql, /set local role authenticated;/i);
  assert.match(sql, /set local row_security\s*=\s*on;/i);
  assert.match(sql, /current_user <> 'authenticated'/);
  assert.match(sql, /current_setting\('row_security'\) <> 'on'/);
  assert.match(sql, /bool_and\(row_security_active\(c\.oid\)\)/);
  assert.match(sql, /select is\(current_user::text,'authenticated'/);
  assert.match(sql, /select diag\('PROVENANCE: SQL-session JWT fixture only/);
  assert.match(sql, /owner='\|\|pg_get_userbyid/);
  assert.match(sql, /'; volatility='\|\|p\.provolatile::text\|\|/,
    'catalog diagnostic must explicitly cast PostgreSQL internal char before concatenation');
  assert.match(sql, /pg_temp\.assets_probe_call\([\s\S]*?security invoker set search_path=pg_catalog/i);
  const wrappers = ['create_asset_v1', 'register_equipment_v1',
    'get_asset_registration_choices_v1', 'get_asset_detail_v1'];
  for (const wrapper of wrappers) assert.ok(sql.includes('customer_api.' + wrapper + '('), wrapper);
  const paths = ['create', 'registration', 'choices', 'detail'];
  for (const path of paths) {
    assert.ok(sql.includes("pg_temp.assets_probe_call('" + path + "')"), path + ' valid positive');
    for (const scenario of ['no-actor', 'borrowed', 'permission']) {
      assert.ok(sql.includes("pg_temp.assets_probe_call('" + path + "','" + scenario + "'"),
        path + ' / ' + scenario);
    }
  }
  const temporal = ['context-expired', 'context-future', 'context-revoked',
    'member-expired', 'member-future', 'member-revoked'];
  for (const scenario of temporal) {
    assert.ok(sql.includes('-- TEMPORAL_PROBE: ' + scenario));
    for (const path of paths) {
      assert.ok(sql.includes("select throws_ok($$select pg_temp.assets_probe_call('" + path + "','" + scenario + "')$$,"),
        'Strict denial expected, including known temporal GET gap: ' + path + ' / ' + scenario);
    }
  }
  for (const path of ['create', 'registration']) {
    assert.ok(sql.includes("'" + path + "','critical-aal1',critical=>true"));
    assert.ok(sql.includes("'" + path + "','critical-aal2',critical=>true"));
  }
  assert.match(sql, /select throws_ok\(\$\$select assets\.registration_context_v1/);
  assert.match(sql, /not has_function_privilege\('authenticated',\(select p\.oid/);
  assert.match(sql, /p\.proname='registration_context_v1'/);
  assert.match(sql, /assets_probe_existing_manager_permissions_required/);
  assert.match(sql, /assets_probe_existing_negative_role_not_permissionless/);
  // Strip comments so prohibition checks inspect statements, not descriptions.
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(statements, /security\s+definer|\b(?:grant|revoke)\b|alter\s+(?:table|role|function|policy)|create\s+(?:policy|role)|row_security\s*=\s*off/i);
  assert.doesNotMatch(statements, /(?:insert into|update|delete from)\s+identity\.(?:roles|permissions|role_permissions)\b/i);
  assert.doesNotMatch(statements, /(?:create|replace)\s+function\s+(?:assets|customer_api|app_private)\./i);
  assert.doesNotMatch(statements, /select\s+(?:todo|skip)\s*\(/i);
  assert.equal((sql.match(/^savepoint temporal_case;$/gm) ?? []).length, temporal.length);
  assert.equal((sql.match(/^rollback to temporal_case;$/gm) ?? []).length, temporal.length);
  console.log(JSON.stringify({
    task: 'CORE-ASSETS-ACTUAL-ROLE-PROBE-01',
    suite: 'assets-actual-role-offline-contract',
    result: 'PASS',
    provenance: 'source inspection only; SQL-session JWT fixture, not signed Auth/JWT',
    wrappers: wrappers.length,
    temporalCases: temporal.length,
    runtime: 'NOT_RUN_NOT_PASS',
    expectedGap: 'BASE check_asset_caller_v1 omits temporal checks; strict GET denials retained',
  }));
}
