/** Only three directly affected shared-engine controls; no old suite rerun. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const fixtureUrl=new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url),text=readFileSync(fixtureUrl,'utf8');
const definitions=text.slice(text.indexOf('const original='),text.indexOf('\nlet n=0;')).replace("new URL('./test-core-host-terminal-lifecycle-11.mjs',import.meta.url)","new URL('./test-core-host-terminal-lifecycle-11.mjs',providedUrl)");
assert.ok(!definitions.includes('\nawait check('));
const{setup,replay,core,next,provider}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','providedUrl',definitions+'\nreturn {setup,replay,core,next,provider};')(assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,fixtureUrl.href);
const x=await setup(),a=next(x),normal=await x.f.host.execute(a.cmd,provider(a.guide));assert.equal(normal.status,'committed');console.log('PASS default C03 fresh path still commits actual CE provider');
const r=await replay(x);assert.equal(r.status,'exact_replay');assert.ok(core.coreHostJointReplaySealV1(r));console.log('PASS existing CE012 replay/opaque joint seal unchanged');
const before=structuredClone(x.f.writes),wrong=await x.f.host.executeDocumentsReplayOnly(x.cmd,provider(x.guide));assert.equal(wrong.status,'denied');assert.equal(wrong.code,'PROVIDER_UNAVAILABLE');assert.deepEqual(x.f.writes,before);console.log('PASS CE012 command cannot enter Documents replay family');
console.log(JSON.stringify({affected_shared_engine_controls:3,native:'NOT_RUN_NOT_PASS'}));
