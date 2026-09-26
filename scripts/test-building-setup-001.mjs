import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260914071532_controlled_building_setup_opening_rehearsal.sql', 'utf8');
const dbTest = readFileSync('supabase/tests/081_controlled_building_setup_opening_rehearsal.test.sql', 'utf8');
const wizard = readFileSync('src/components/customer/CustomerBuildingSetupWizard.tsx', 'utf8');
const createRoute = readFileSync('src/app/api/customer/v1/onboarding/building-setup/route.ts', 'utf8');
const actionRoute = readFileSync('src/app/api/customer/v1/onboarding/building-setup/[id]/[action]/route.ts', 'utf8');

assert.match(migration, /create table platform\.building_setup_runs/);
assert.match(migration, /rehearse_building_setup_v1/);
assert.match(migration, /opening_balance_rehearsal_not_zero/);
assert.match(migration, /setup_dual_control_violation/);
assert.match(migration, /if r\.status='provisioned'/);
assert.doesNotMatch(migration, /insert into finance\.journals/i);
assert.doesNotMatch(migration, /service_role_key|ontrip\.ai@gmail\.com/i);
assert.match(dbTest, /^begin;/m);
assert.match(dbTest, /^rollback;/m);
assert.match(dbTest, /select plan\(28\)/);
assert.match(dbTest, /zero property writes/);
assert.match(dbTest, /emit no journal/);
for (const marker of ['Configurare controlată a clădirii','Controlled building setup','راه‌اندازی کنترل‌شده ساختمان']) assert.ok(wizard.includes(marker), `missing localized setup copy: ${marker}`);
assert.match(wizard, /dir=\{lang==="fa"\?"rtl":"ltr"\}/);
for (const route of [createRoute,actionRoute]) {
  assert.match(route, /hasTrustedMutationOrigin/);
  assert.match(route, /isApplicationJson/);
  assert.match(route, /parseJsonWithLimit/);
  assert.match(route, /ONBOARDING_HEADERS/);
}
console.log('CLADORA-P2-SETUP-001 static contract: PASS (Migration 94 / Test 081 / RO-EN-FA / no-store)');
