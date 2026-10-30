import assert from 'node:assert/strict';
import {mkdtempSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareProfile} from './prepare-local-migration-profile.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'cladora-profile-test-'));
try {
 const source=join(temp,'source');
 mkdirSync(source);
 cpSync(join(root,'supabase'),join(source,'supabase'),{recursive:true,filter:path=>!path.includes('/.temp')});
 mkdirSync(join(source,'supabase/.temp'),{recursive:true});
 writeFileSync(join(source,'supabase/.temp/project-ref'),'must-not-be-copied');
 writeFileSync(join(source,'.env'),'must-not-be-copied');
 const manifest=JSON.parse(readFileSync(join(source,'supabase/local-profiles/baseline-v14.manifest.json')));
 const before=manifest.source_migrations.map(row=>readFileSync(join(source,'supabase/migrations',row.name)));
 const output=join(temp,'profile');
 const receipt=prepareProfile(source,output);
 assert.equal(receipt.active_migrations,299);
 assert.equal(receipt.hosted_execution,false);
 assert.equal(receipt.g2_runtime,'NOT_INSTALLED_NOT_PROVED');
 assert.equal(readdirSync(join(output,'supabase/migrations')).length,299);
 for(const [i,row] of manifest.source_migrations.entries()) {
  assert.deepEqual(readFileSync(join(source,'supabase/migrations',row.name)),before[i]);
  const target=join(output,'supabase/migrations',row.name);
  if(row.name===manifest.inactive_installers[0].name)assert.equal(existsSync(target),false);
  else assert.deepEqual(readFileSync(target),before[i]);
 }
 assert.equal(existsSync(join(output,'supabase/.temp')),false);
 assert.equal(existsSync(join(output,'.env')),false);
 assert.throws(()=>prepareProfile(source,output),/fresh/);
 assert.throws(()=>prepareProfile(source,join(source,'nested')),/outside source/);
 const target=join(temp,'rejected');
 const first=join(source,'supabase/migrations',manifest.source_migrations[0].name);
 writeFileSync(first,'-- tampered');
 assert.throws(()=>prepareProfile(source,target),/source changed/);
 assert.equal(existsSync(target),false);
 writeFileSync(first,before[0]);
 const extra=join(source,'supabase/migrations/20990101000000_unreviewed.sql');
 writeFileSync(extra,'select 1;');
 assert.throws(()=>prepareProfile(source,target),/inventory changed/);
 assert.equal(existsSync(target),false);
 rmSync(extra);
 const config=join(source,'supabase/config.toml');
 writeFileSync(config,readFileSync(config,'utf8').replace('cladora-local','hosted-project'));
 assert.throws(()=>prepareProfile(source,target),/cladora-local/);
 assert.equal(existsSync(target),false);
 console.log('PASS: exact 299-file local profile; all 300 sources preserved; linked credentials excluded; tamper, inventory, target and reuse rejected before allocation');
} finally {rmSync(temp,{recursive:true,force:true});}
