import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const hash = value => createHash('sha256').update(value).digest('hex');
const migrationName = '20261015183000_core_jurisdiction_profile_v1.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const source = readFileSync('src/lib/core/jurisdiction-profile-v1.ts', 'utf8');
const contract = readFileSync('docs/contracts/CLADORA-CORE-JURISDICTION-PROFILE-v1.0.md', 'utf8');
const seed = readFileSync('supabase/seed.sql', 'utf8');
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();

let cases = 0;
assert.equal(migrations.at(-1), migrationName);
assert.match(migration, /No country profile, assignment, grant,\s*-- backfill, Remote installation or runtime activation/is);
assert.match(migration, /property_jurisdiction_country_rebind_forbidden/);
assert.match(migration, /property_jurisdiction_address_country_mismatch/);
assert.match(migration, /jurisdiction_profile_required_domain_unavailable/);
assert.match(migration, /alter table portfolio\.addresses alter column country_code drop default/i);
assert.match(migration, /Optional country-specific postal text[\s\S]*no global format or uniqueness/i);
assert.match(migration, /revoke all on platform\.jurisdiction_profiles,[\s\S]*from public,anon,authenticated,service_role/i);
assert.doesNotMatch(migration, /insert into platform\.jurisdiction_profiles/i);
assert.doesNotMatch(migration, /default\s+'(?:RO|RON|IR|IRR)'/i);
assert.doesNotMatch(migration, /\b(locale|ip_address)\s+(?:text|varchar|char)/i);
assert.match(source, /country_code:\s*countryCode/);
assert.match(source, /reusable_as_command_authority:\s*z\.literal\(false\)/);
assert.match(contract, /open country catalog/i);
assert.match(contract, /Postal codes are country-specific text/i);
assert.match(contract, /payments\.local_rails/);
assert.match(seed, /insert into portfolio\.addresses\([^)]*country_code[^)]*\)/i);
cases += 17;

console.log(JSON.stringify({
  contract: 'core-jurisdiction-profile-static.v1',
  cases,
  migration_count: migrations.length,
  migration_sha256: hash(migration),
  activation: 'inactive',
}));
