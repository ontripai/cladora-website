import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// This exact native proof is not a TAP suite and has never been authorized by
// the automatic disposable baseline. Preserve its independent execution gate.
const manual='operations-checklist-command-v2.test.sql';
const names=readdirSync('supabase/tests').filter(name=>name.endsWith('.sql')).sort();
if(!names.includes(manual)||createHash('sha256').update(readFileSync('supabase/tests/'+manual)).digest('hex')!=='c4ef35deac1a847b958b72e2c4f411b296ce5d3824e19c80ec647d2092856bf7')throw Error('manual native proof seal changed; re-review required');
const suites=names.filter(name=>name!==manual).map(name=>'supabase/tests/'+name);
if(!suites.length)throw Error('no baseline TAP suites');
console.log(manual+': independent session/authority proof NOT_RUN_NOT_PASS; not TAP');
console.log('Running all '+suites.length+' baseline TAP files; no TAP suite excluded');
const result=spawnSync('supabase',['test','db','--local',...suites],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
