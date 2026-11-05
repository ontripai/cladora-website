/** Current source seals + preserved historical identities; no runtime queries. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CORE17_CONSUMER_PROTECTED_SOURCES} from './lib/core17-exact-consumer-admission-v1.mjs';
const path='docs/verification/CORE17-POST-AUTH-CONSUMER-ADOPTION-01.json';
const manifest=JSON.parse(readFileSync(path));
const sha=b=>createHash('sha256').update(b).digest('hex');
function validate(m){
 assert.equal(m.contract,'core17.post-auth-consumer-source.v1');
 assert.equal(m.source_base,'b696ff211daabd4be3989522c569f24ccccd0dce');
 assert.equal(m.installed_Core_base,'ee883b62cf4a318af3450c506931a969623b8987');
 assert.equal(m.runtime_binding,null);assert.equal(m.native,'NOT_RUN_NOT_PASS');
 assert.deepEqual(m.changed_paths.map(x=>x.path).sort(),[
  'docs/contracts/CORE17-POST-AUTH-CONSUMER-ADOPTION-01.md',
  'scripts/check-core17-post-auth-consumer-adoption.mjs',
  'scripts/lib/core17-exact-consumer-admission-v1.mjs',
  'scripts/run-core-service-app-assembly-17.mjs',
  'scripts/test-core17-consumer-admission-v1.mjs',
  'scripts/test-core17-post-auth-security-contract.mjs',
 ].sort());
 for(const p of m.changed_paths){const raw=readFileSync(p.path);assert.equal(raw.length,p.after.bytes);assert.equal(sha(raw),p.after.sha256,p.path);}
 const expectedPreserved=[...new Set([...CORE17_CONSUMER_PROTECTED_SOURCES,
 'scripts/lib/core-service-relay-cors-v2-preflight.mjs','scripts/lib/core-service-assembly-environment-v1.mjs',
 'scripts/service-consumer-rehearsal-17/lane.py',
 ...['stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf'].map(p=>'scripts/functional-dev-stack-v1/'+p),
 ...['CONTRACT.md','activation-binding.template.json','cors_policy.py','profile.json','relay_v2.py','sdk-source-pins.json','test_cors_v2.py','transition.py','source-seal.json'].map(p=>'scripts/functional-dev-relay-cors-v2/'+p),
 'docs/verification/CORE17-RELAY-CORS-LAUNCHER-01.json',
 ])].sort();
 assert.deepEqual(m.preserved_source_pins.map(x=>x.path).sort(),expectedPreserved);
 for(const p of m.preserved_source_pins){assert.equal(p.unchanged,true);assert.equal(sha(readFileSync(p.path)),p.sha256,p.path);}
 assert.equal(m.transport_anchor.sha,m.source_base);assert.equal(m.transport_anchor.tree,'534ec94f21699a65686bade5539517dfd818ec1e');
 assert.equal(m.transport_anchor.launcher_sha256,'5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092');
 assert.equal(m.checks.consumer_admission,39);assert.equal(m.checks.post_auth_contract,19);
 assert.equal(m.authorization,'AUTH_MFA_PRE_AAL2_IS_NOT_BUSINESS_AUTHORITY');
 return true;
}
assert.equal(validate(manifest),true);let negatives=0;
for(const [name,edit]of [
 ['wrong install base',m=>{m.installed_Core_base=m.source_base;}],
 ['wrong current source pin',m=>{m.changed_paths[0].after.sha256='0'.repeat(64);}],
 ['lost protected pin',m=>{m.preserved_source_pins[0].unchanged=false;}],
 ['omitted protected source',m=>{m.preserved_source_pins.pop();}],
 ['new native success claim',m=>{m.native='PASS';}],
 ['fabricated runtime binding',m=>{m.runtime_binding={allow:true};}],
 ['wrong historical transport tree',m=>{m.transport_anchor.tree='0'.repeat(40);}],
 ['missing source closure',m=>{m.changed_paths.pop();}],
 ]){const m=structuredClone(manifest);edit(m);assert.throws(()=>validate(m));negatives++;console.log('PASS rejects '+name);}
console.log(JSON.stringify({source_manifest_positive:1,negatives,native:'NOT_RUN_NOT_PASS'}));
