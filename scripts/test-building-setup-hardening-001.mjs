import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260914075648_building_setup_security_invoker_gateway.sql','utf8');
const dbTest = readFileSync('supabase/tests/082_building_setup_security_invoker_gateway.test.sql','utf8');
const report = readFileSync('docs/roadmap/CLADORA-P2-SETUP-HARDENING-001-CLOSURE-REPORT-v1.0.md','utf8');

for (const name of ['create','rehearse','submit','approve','provision']) {
  assert.match(migration,new RegExp(`alter function customer_api\\.${name}_building_setup_v1|alter function customer_api\\.${name === 'create' ? 'create_building_setup_v1' : name + '_building_setup_v1'}`));
}
assert.match(migration,/set schema app_private/g);
assert.match(migration,/security invoker/g);
assert.match(migration,/from public,anon/);
assert.doesNotMatch(migration,/insert\s+into|update\s+portfolio|delete\s+from/i);
assert.match(dbTest,/^begin;/m);
assert.match(dbTest,/^rollback;/m);
assert.match(dbTest,/select plan\(30\)/);
assert.match(dbTest,/AAL1 fails closed/);
assert.match(dbTest,/self approval remains blocked/);
assert.match(dbTest,/emits no journal/);
assert.match(report,/SETUP-001-SEC-01/);
assert.match(report,/SETUP-001-DOC-01/);
console.log('CLADORA-P2-SETUP-HARDENING-001 static contract: PASS (Migration 95 / Test 082 / closure report)');
