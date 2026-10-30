import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { prepareDemoCandidate } from './prepare-demo-migration-candidate.mjs';

const actual = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'cladora-demo-candidate-proof-'));
let checks = 0;
try {
  const source = join(temp,'source');
  mkdirSync(source);
  cpSync(join(actual,'supabase'),join(source,'supabase'), {recursive:true, filter:p=>!p.includes('/.temp')});
  mkdirSync(join(source,'supabase/.temp'),{recursive:true});
  writeFileSync(join(source,'supabase/.temp/project-ref'),'must-not-copy');
  writeFileSync(join(source,'.env'),'must-not-copy');
  const manifest = JSON.parse(readFileSync(join(source,'supabase/local-profiles/baseline-v14.manifest.json')));
  const sourceBytes = manifest.source_migrations.map(r => readFileSync(join(source,'supabase/migrations',r.name)));
  const target = join(temp,'candidate');
  const r = prepareDemoCandidate(source,target);
  assert.equal(r.active.length,297); assert.equal(r.held.length,3);
  assert.equal(r.accepted,false); assert.equal(r.executable_hosted,false); checks++;
  for (const [i,row] of manifest.source_migrations.entries()) {
    assert.deepEqual(readFileSync(join(source,'supabase/migrations',row.name)),sourceBytes[i]);
    const out=join(target,'supabase/migrations',row.name);
    if (r.held.some(h=>h.name===row.name)) assert.equal(existsSync(out),false);
    else assert.deepEqual(readFileSync(out),sourceBytes[i]);
  }
  checks++;
  assert.equal(readdirSync(join(target,'supabase')).includes('.temp'),false);
  assert.equal(existsSync(join(target,'.env')),false);
  assert.match(readFileSync(join(target,'supabase/config.toml'),'utf8'),/^project_id = "cladora-demo-candidate"$/m); checks++;
  assert.throws(()=>prepareDemoCandidate(source,target),/fresh/); checks++;
  assert.throws(()=>prepareDemoCandidate(source,join(source,'nested')),/inside source/); checks++;
  const invalid=join(temp,'invalid');
  const first=join(source,'supabase/migrations',manifest.source_migrations[0].name);
  writeFileSync(first,'-- altered before allocation');
  assert.throws(()=>prepareDemoCandidate(source,invalid),/source changed/);
  assert.equal(existsSync(invalid),false); checks++;
  writeFileSync(first,sourceBytes[0]);
  writeFileSync(join(source,'supabase/migrations/20990101000000_extra.sql'),'select 1;');
  assert.throws(()=>prepareDemoCandidate(source,invalid),/inventory changed/);
  assert.equal(existsSync(invalid),false); checks++;
  rmSync(join(source,'supabase/migrations/20990101000000_extra.sql'));
  const config=join(source,'supabase/config.toml');
  writeFileSync(config,readFileSync(config,'utf8').replace('project_id = "cladora-local"','project_id\t=\t"cladora-local"'));
  const formatted=join(temp,'formatted');
  prepareDemoCandidate(source,formatted);
  assert.match(readFileSync(join(formatted,'supabase/config.toml'),'utf8'),/^project_id = "cladora-demo-candidate"$/m); checks++;
  writeFileSync(config,'project_id = "cladora-local"\nproject_id = "another-project"\n');
  assert.throws(()=>prepareDemoCandidate(source,invalid),/unsafe candidate target/);
  assert.equal(existsSync(invalid),false); checks++;
  writeFileSync(join(source,'supabase/config.toml'),'project_id = "hosted-project"\n');
  assert.throws(()=>prepareDemoCandidate(source,invalid),/unexpected source target/);
  assert.equal(existsSync(invalid),false); checks++;
  console.log(JSON.stringify({checks,result:'PASS',native:'NOT_ESTABLISHED_BY_THIS_TEST',hosted_execution:false}));
} finally { rmSync(temp,{recursive:true,force:true}); }
