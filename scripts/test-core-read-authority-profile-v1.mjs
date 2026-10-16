import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  CORE_READ_AUTHORITY_PROFILE_V1,
  coreReadAuthorityProfileV1Schema,
  coreReadAuthorityRevisionPreconditionV1Schema,
} from '../src/lib/core/read-authority-profile-v1.ts';

const migrationName = '20261016080831_core_read_authority_profile_v1.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const source = readFileSync('src/lib/core/read-authority-profile-v1.ts', 'utf8');
const contract = readFileSync(
  'docs/contracts/CLADORA-CORE-READ-AUTHORITY-PROFILE-v1.0.md',
  'utf8',
);
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();
const executableSql = migration.replace(/--[^\n]*/g, '');
const sha256 = value => createHash('sha256').update(value).digest('hex');

let checks = 0;
const check = (name, fn) => {
  fn();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
};

check('fixed profile parses and is immutable', () => {
  assert.equal(coreReadAuthorityProfileV1Schema.safeParse(CORE_READ_AUTHORITY_PROFILE_V1).success, true);
  assert.equal(Object.isFrozen(CORE_READ_AUTHORITY_PROFILE_V1), true);
  assert.deepEqual(CORE_READ_AUTHORITY_PROFILE_V1, {
    contract_version: 'core-read-authority-profile.v1',
    profile_version: 1,
    permission_code: 'experience.guide.read',
    module_code: 'experience_guides',
    entitlement_code: 'module.experience_guides',
    evaluation_purpose: 'experience.guide.content_policy.read',
    domain_code: 'content.policy',
    domain_version: 'content-policy.v1',
    entitlement_required: true,
    server_owned: true,
    immutable: true,
    reusable_as_command_authority: false,
  });
});

check('every fixed binding rejects caller substitution', () => {
  for (const [field, value] of Object.entries({
    permission_code: 'experience.guide.manage',
    module_code: 'documents',
    entitlement_code: 'module.documents',
    evaluation_purpose: 'experience.guide.command',
    domain_code: 'payments.policy',
    domain_version: 'payments-policy.v1',
  })) {
    const changed = { ...CORE_READ_AUTHORITY_PROFILE_V1, [field]: value };
    assert.equal(coreReadAuthorityProfileV1Schema.safeParse(changed).success, false, field);
  }
});

check('revision precondition is strict and cannot carry authority fields', () => {
  const valid = {
    contract_version: 'core-read-authority-revision-precondition.v1',
    expected_authority_revision: 17,
  };
  assert.equal(coreReadAuthorityRevisionPreconditionV1Schema.safeParse(valid).success, true);
  assert.equal(coreReadAuthorityRevisionPreconditionV1Schema.safeParse({
    ...valid,
    permission_code: 'experience.guide.read',
  }).success, false);
  assert.equal(coreReadAuthorityRevisionPreconditionV1Schema.safeParse({
    ...valid,
    expected_authority_revision: 0,
  }).success, false);
});

check('migration is additive registry-only and generated in canonical order', () => {
  assert.ok(migrations.includes(migrationName));
  assert.match(migration, /insert into identity\.permissions\(code,resource,action,description\)/i);
  assert.match(migration, /insert into platform\.module_definitions\(/i);
  assert.match(migration, /insert into platform\.module_permission_bindings\(/i);
  assert.doesNotMatch(executableSql, /^\s*grant\b/im);
  assert.doesNotMatch(executableSql, /^\s*create\s+role\b/im);
  assert.doesNotMatch(executableSql, /insert into identity\.role_permissions/i);
  assert.doesNotMatch(executableSql, /insert into platform\.workspace_role_permissions/i);
  assert.doesNotMatch(executableSql, /insert into platform\.workspace_modules/i);
  assert.doesNotMatch(executableSql, /insert into platform\.workspace_entitlements/i);
});

check('read and manage remain independent', () => {
  assert.match(migration, /'experience\.guide\.read'[\s\S]*'experience\.guide'[\s\S]*'read'/i);
  assert.doesNotMatch(migration, /'experience\.guide\.manage'/i);
  assert.match(contract, /Neither\s+implies, bootstraps or falls back to the other/i);
});

check('profile adds no read host, decision, consumer or sensitive payload', () => {
  assert.doesNotMatch(source, /CoreReadScope|CoreTransactionScope|resolveAuthority|decision:\s*z\./);
  assert.doesNotMatch(source, /guide_body|reviewer|signoff|country_pack|credential|service_role/i);
  assert.match(contract, /no Guide body, Country Pack artifact, policy payload/i);
});

console.log(JSON.stringify({
  contract: 'core-read-authority-profile.v1',
  checks,
  migration_count: migrations.length,
  migration_sha256: sha256(migration),
  source_sha256: sha256(source),
  activation: 'inactive',
}));
