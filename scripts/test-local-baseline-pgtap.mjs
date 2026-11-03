import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'cladora-tap-cli-contract-'));
try {
 const executable=join(temp,'supabase');
 writeFileSync(executable,`#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);assert.deepEqual(args.slice(0,4),['test','db','--local','--workdir']);assert.equal(args.length,5);
const project=args[4],dir=path.join(project,'supabase/tests');
assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).length,218);
assert.equal(fs.existsSync(path.join(dir,'operations-checklist-command-v2.test.sql')),false);
for(const name of ['building_setup_authority_v2.inc','ce_011_event_interest_operational_v1.inc','ce_010_community_operational_v1.inc'])assert.ok(fs.statSync(path.join(dir,'fixtures',name)).size>0);
assert.equal(fs.readdirSync(path.join(project,'supabase/migrations')).length,299);
assert.equal(fs.existsSync(path.join(project,'supabase/.temp')),false);
assert.equal(fs.existsSync(path.join(project,'.env')),false);
console.log(JSON.stringify({project,fixtures:'PRESERVED',tap_files:218}));
process.exit(Number(process.env.CLADORA_TEST_CLI_STATUS));
`);
 chmodSync(executable,0o755);
 for(const status of [0,7]) {
  const result=spawnSync(process.execPath,['scripts/run-local-baseline-pgtap.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,PATH:temp+':'+process.env.PATH,CLADORA_TEST_CLI_STATUS:String(status)}});
  assert.equal(result.status,status,result.stderr);
  const receipt=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(receipt.fixtures,'PRESERVED');
  assert.equal(existsSync(receipt.project),false,'temporary test profile must be removed after success or failure');
 }
 console.log('PASS: runner preserves all 218 TAP files and relative fixtures, uses only --local, propagates CLI failure, cleans temporary profiles; no database executed');
} finally {rmSync(temp,{recursive:true,force:true});}
