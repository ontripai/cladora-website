import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

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
const escaped = value => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

let checks = 0;
const check = (name, fn) => {
  fn();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
};

check('fixed profile is literal and immutable', () => {
  assert.match(source, /coreReadAuthorityProfileV1Schema\s*=\s*z\.strictObject\(/);
  assert.match(source, /CORE_READ_AUTHORITY_PROFILE_V1[^=]*=\s*Object\.freeze\(/);
  const fixedStrings = {
    contract_version: 'core-read-authority-profile.v1',
    permission_code: 'experience.guide.read',
    module_code: 'experience_guides',
    entitlement_code: 'module.experience_guides',
    evaluation_purpose: 'experience.guide.content_policy.read',
    domain_code: 'content.policy',
    domain_version: 'content-policy.v1',
  };
  for (const [field, value] of Object.entries(fixedStrings)) {
    assert.match(source, new RegExp(`${field}:\\s*z\\.literal\\('${escaped(value)}'\\)`));
  }
  for (const field of [
    'entitlement_required', 'server_owned', 'immutable',
  ]) assert.match(source, new RegExp(`${field}:\\s*z\\.literal\\(true\\)`));
  assert.match(source, /reusable_as_command_authority:\s*z\.literal\(false\)/);
});

check('every fixed binding rejects caller substitution', () => {
  const profileSchema = source.match(
    /coreReadAuthorityProfileV1Schema\s*=\s*z\.strictObject\(\{([\s\S]*?)\n\}\);/,
  )?.[1];
  assert.ok(profileSchema);
  for (const field of [
    'permission_code', 'module_code', 'entitlement_code', 'evaluation_purpose',
    'domain_code', 'domain_version',
  ]) assert.match(profileSchema, new RegExp(`${field}:\\s*z\\.literal\\(`));
  assert.doesNotMatch(source, /z\.string\(\)[\s\S]{0,80}(permission_code|module_code|domain_code)/);
});

check('revision precondition is strict and cannot carry authority fields', () => {
  const precondition = source.match(
    /coreReadAuthorityRevisionPreconditionV1Schema\s*=\s*z\.strictObject\(\{([\s\S]*?)\n\}\);/,
  )?.[1];
  assert.ok(precondition);
  assert.match(precondition, /contract_version:\s*z\.literal\('core-read-authority-revision-precondition\.v1'\)/);
  assert.match(precondition, /expected_authority_revision:\s*authorityRevisionSchema/);
  assert.doesNotMatch(precondition, /permission|module|entitlement|purpose|domain|authority_decision/);
  assert.match(source, /authorityRevisionSchema\s*=\s*z\.number\(\)\.int\(\)\.positive\(\)\.safe\(\)/);
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
