import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = readFileSync('supabase/fixtures/cladora_workspace_onboarding_001.sql', 'utf8');
const rollback = readFileSync('supabase/fixtures/cladora_workspace_onboarding_001.rollback.sql', 'utf8');
const dbTest = readFileSync('supabase/tests/080_workspace_onboarding_controlled_fixture.test.sql', 'utf8');
const shell = readFileSync('src/components/customer/CustomerAppShell.tsx', 'utf8');
const dashboardSchema = readFileSync('src/lib/customer/dashboard-schema.ts', 'utf8');

assert.match(fixture, /CLADORA-WORKSPACE-ONBOARDING-001-FIXTURE/);
assert.match(fixture, /environment[\s\S]*'PILOT'/);
assert.match(fixture, /current_setting\('cladora\.fixture_email', true\)/);
assert.match(fixture, /fixture_target_email_required/);
assert.doesNotMatch(fixture, /ontrip\.ai@gmail\.com/i);
assert.match(fixture, /lower\(code\) = 'association_admin'/);
assert.match(fixture, /on conflict/g);
assert.doesNotMatch(fixture, /insert\s+into\s+auth\.users/i);
assert.doesNotMatch(rollback, /delete\s+from\s+auth\.users/i);
assert.match(dbTest, /^begin;/m);
assert.match(dbTest, /^rollback;/m);
assert.match(dbTest, /select plan\(12\)/);
assert.match(dbTest, /outsider cannot load the dashboard/);
assert.match(
  dashboardSchema,
  /z\.iso\.datetime\(\{\s*offset:\s*true\s*\}\)/,
  'dashboard accepts the PostgreSQL timestamptz offset returned in production'
);

for (const marker of [
  'Nu există niciun context activ alocat.',
  'No active assigned context is available.',
  'هیچ زمینه تخصیص‌یافته فعالی وجود ندارد.',
]) {
  assert.ok(shell.includes(marker), `missing localized workspace state: ${marker}`);
}

assert.match(shell, /dir=\{lang === "fa" \? "rtl" : "ltr"\}/);
console.log('CLADORA-WORKSPACE-ONBOARDING-001 static contract: PASS (RO/EN/FA + RTL + rollback)');
