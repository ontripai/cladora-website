/** Selected affected regressions only. Never starts PG or invokes database suites. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='534be1a3d69a3b36d0f04edc555bf01c3d666842';
const host='src/lib/core/postgres-transaction-host-v1.ts';
const manifest=JSON.parse(readFileSync(new URL('../docs/contracts/core-host-terminal-lifecycle-v1/manifest.json',import.meta.url),'utf8'));
const hostPin=manifest.inventory.find(x=>x.path===host);assert.ok(hostPin);
assert.equal(createHash('sha256').update(readFileSync(new URL('../'+host,import.meta.url))).digest('hex'),hostPin.sha256,'exact reviewed shared-host successor pin');
let checks=0;
const cases=[
 'new actual CE/Docs/Core replay-scope coupling and canonical read order',
 'combined original40001 reaches actual trusted host without own retry',
 'UNKNOWN COMMIT retains exact candidate writer command and recovers through actual replay',
 'deferred failure is only a model; no acceptance or partial receipt',
 'current authority denial blocks host before exposing historical relation',
];
for(const name of cases){const out=execFileSync(process.execPath,['scripts/test-core-ce012-writer-joint-review-09.mjs','--case',name],{cwd:root,encoding:'utf8'});assert.match(out,/PASS 1 /);assert.match(out,/"checks":1/);console.log(`PASS legacy Core/CE affected case: ${name}`);checks++;}
const ownerPath='scripts/review-core-service-s01-producer-01/test-producer.mjs';
const original=readFileSync(new URL('../'+ownerPath,import.meta.url),'utf8');
assert.equal(original,execFileSync('git',['show',base+':'+ownerPath],{cwd:root,encoding:'utf8'}),'accepted S01 test source unchanged');
const old=" assert.equal(show(path),readFileSync(resolve(root,path),'utf8'),`shared consumer ABI pin ${path}`);";
assert.equal(original.split(old).length,2,'single exact host-pin adaptation boundary');
// Keep the historical pin assertion: compare its host to the accepted Base host.
// Only runtime loading selects the current, manifest-pinned reviewed host. Other
// three shared source pins and all SERVICE module/helper pins remain unchanged.
const patched=original.replace(old," assert.equal(show(path),path==='"+host+"'?execFileSync('git',['show','"+base+":'+path],{cwd:root,encoding:'utf8'}):readFileSync(resolve(root,path),'utf8'),`accepted ancestor/shared consumer ABI pin ${path}`);");
const temporary=new URL(`../scripts/review-core-service-s01-producer-01/.core11-regression-${randomUUID()}.mjs`,import.meta.url);
try{
 writeFileSync(temporary,patched,{flag:'wx'});
 const selections=[['--serialization-integration-only'],['--case','closeout: original Core host receives 40001 and owns bounded attempts'],['--case','closeout: accepted actual canDisclose propagates 40001 through Core to existing host']];
 for(const args of selections){const out=execFileSync(process.execPath,[fileURLToPath(temporary),...args],{cwd:root,encoding:'utf8'});const lines=out.split('\n').filter(x=>x.startsWith('PASS '));assert.equal(lines.length,args[0]==='--serialization-integration-only'?4:1);for(const line of lines)console.log(line);checks+=lines.length;}
}finally{unlinkSync(temporary);}
console.log(JSON.stringify({task:'CORE-CE012-HOST-TERMINAL-LIFECYCLE-11',affected_regressions:checks,result:'PASS',source:'actual legacy Core/CE and accepted S01/SERVICE modules, current manifest-pinned shared host',pin_adapter:'explicit historical host pin retained against Base; current host identity separately exact',owner_files:'UNCHANGED',sql_pg_auth:'NOT_RUN'}));
