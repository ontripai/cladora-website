import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(readFileSync('docs/contracts/CORE-AUTHORITY-REVISION-SOURCES-v1.json','utf8'));
const directory='supabase/migrations';
const baseline=readdirSync(directory).filter(f=>f.endsWith('.sql')&&f.slice(0,14)<=manifest.baseline_migrations.last_version).sort()
  .map(name=>({name,sha256:hash(readFileSync(join(directory,name)))}));
assert.equal(baseline.length,manifest.baseline_migrations.count);
assert.equal(hash(JSON.stringify(baseline)),manifest.baseline_migrations.sha256,'every historical migration stays byte-identical');
assert.equal(readdirSync(directory).filter(f=>f.endsWith('.sql')&&f.slice(0,14)<='20261012190924').length,247);
assert.equal(manifest.sources.length,25);assert.equal(new Set(manifest.sources).size,25);
const migration=readdirSync(directory).filter(f=>f.endsWith('_core_canonical_authority_revision_v1.sql'));
assert.equal(migration.length,1);
const sql=readFileSync(join(directory,migration[0]),'utf8');
assert.doesNotMatch(sql,/\bgrant\s/i,'no new grants');
for(const source of manifest.sources){
  assert.ok(sql.includes(`after insert or update or delete or truncate on ${source}\n`),source);
  assert.ok(sql.includes(`alter table ${source} enable always trigger canonical_authority_revision_changed;`),source);
}
assert.equal((sql.match(/create trigger canonical_authority_revision_changed/g)||[]).length,25);
assert.match(sql,/revision between 1 and 9007199254740991/);
console.log('Canonical authority revision static: 246 immutable baseline migrations; 25 complete source hooks; zero GRANT');
