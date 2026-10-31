import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {prepareProfile} from './prepare-local-migration-profile.mjs';

// This exact native proof is not a TAP suite and has never been authorized by
// the automatic disposable baseline. Preserve its independent execution gate.
export function baselineTapFiles(directory='supabase/tests') {
 const manual='operations-checklist-command-v2.test.sql';
 const names=readdirSync(directory).filter(name=>name.endsWith('.sql')).sort();
 if(!names.includes(manual)||createHash('sha256').update(readFileSync(join(directory,manual))).digest('hex')!=='c4ef35deac1a847b958b72e2c4f411b296ce5d3824e19c80ec647d2092856bf7')throw Error('manual native proof seal changed; re-review required');
 const suites=names.filter(name=>name!==manual).map(name=>join(directory,name));
 if(!suites.length)throw Error('no baseline TAP suites');
 return suites;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const suites=baselineTapFiles();
 console.log('operations-checklist-command-v2.test.sql: independent session/authority proof NOT_RUN_NOT_PASS; not TAP');
 console.log('Running all '+suites.length+' baseline TAP files; no TAP suite excluded');
 // CLI file-by-file staging omits relative include fixtures. Preserve the full
 // test directory (including all nested fixtures) in an unlinked local profile.
 const temp=mkdtempSync(join(tmpdir(),'cladora-baseline-tap-'));
 let status=1;
 try {
  const project=join(temp,'project');
  prepareProfile(fileURLToPath(new URL('../',import.meta.url)),project);
  rmSync(join(project,'supabase/tests/operations-checklist-command-v2.test.sql'));
  const result=spawnSync('supabase',['test','db','--local','--workdir',project],{stdio:'inherit'});
  if(result.error)throw result.error;
  status=result.status??1;
 } finally {rmSync(temp,{recursive:true,force:true});}
 process.exit(status);
}
