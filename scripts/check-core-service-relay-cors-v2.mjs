/** Current source reconciliation; original Core17 delivery remains historical. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyCore17RelaySourcesV2} from './lib/core-service-relay-cors-v2-preflight.mjs';

const recordPath='docs/verification/CORE17-RELAY-CORS-LAUNCHER-01.json';
const hash=raw=>createHash('sha256').update(raw).digest('hex');
assert.equal(hash(readFileSync(recordPath)),'43ad6124e6a7aaaa3bad63cfc1ec105437f52a479efe6d035016d34e396b0723');
const record=JSON.parse(readFileSync(recordPath));
const expectedPaths=['scripts/run-core-service-app-assembly-17.mjs',
  'scripts/lib/core-service-relay-cors-v2-preflight.mjs',
  'scripts/test-core-service-relay-cors-v2-preflight.mjs',
  'docs/contracts/CORE17-RELAY-CORS-LAUNCHER-01.md'];
function exact(path,pin){
  const raw=readFileSync(path);assert.equal(raw.length,pin.bytes,path);assert.equal(hash(raw),pin.sha256,path);
}
function validate(r){
  assert.equal(r.contract,'core17-relay-cors-launcher-source-successor.v1');
  assert.equal(r.classification,'SOURCE_COMPATIBILITY_ONLY_NATIVE_AUTH_BROWSER_NOT_RUN');
  assert.equal(r.native,'NOT_RUN_NOT_PASS');assert.equal(r.runtime_binding,null);
  assert.equal(r.prior_app_source,'5aa951bfbe8b1254b81212aa248f51a13179f890');
  assert.equal(r.installed_Core_base,'ee883b62cf4a318af3450c506931a969623b8987');
  assert.equal(r.historical_manifest,'supabase/install/core-service-app-assembly-v1/manifest.json');
  assert.equal(r.historical_manifest_sha256,'4e8972cef4cff39cb707ab1dca8613c4c23089e178a7658a7dbcd3f597050a4f');
  assert.equal(hash(readFileSync(r.historical_manifest)),r.historical_manifest_sha256);
  assert.equal(r.relay_source,'b20d0bf33a01e5f846421d852c7e778aaa26f4e6');
  assert.equal(r.relay_seal_file_sha256,'c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02');
  assert.equal(r.ABI,'platform17.relay-cors-preflight.v2');
  assert.deepEqual(r.selectors,['CLADORA_CORE17_TRANSPORT_PROFILE','CLADORA_CORE17_TRANSPORT_BINDING_SHA256']);
  assert.deepEqual(r.current_sources.map(x=>x.path),expectedPaths);
  for(const pin of r.current_sources)exact(pin.path,pin);
  const historical=JSON.parse(readFileSync(r.historical_manifest));
  const old=historical.inventory.find(x=>x.path===expectedPaths[0]);
  assert.deepEqual(r.launcher_before,old.after);
  assert.notEqual(r.current_sources[0].sha256,r.launcher_before.sha256);
  for(const pin of historical.inventory){
    exact(pin.path,pin.path===expectedPaths[0]?r.current_sources[0]:pin.after);
  }
  for(const pin of historical.protectedSources)exact(pin.path,pin);
  for(const pin of historical.units)exact(pin.path,pin);
  verifyCore17RelaySourcesV2(process.cwd());
}
validate(record);
let negatives=0;
for(const [name,mutate]of [
  ['wrong installed base',x=>{x.installed_Core_base=x.prior_app_source;}],
  ['wrong relay ABI',x=>{x.ABI='arbitrary';}],
  ['unreviewed seal',x=>{x.relay_seal_file_sha256='f'.repeat(64);}],
  ['missing source pin',x=>{x.current_sources.pop();}],
  ['tampered source pin',x=>{x.current_sources[0].sha256='f'.repeat(64);}],
  ['broken predecessor lineage',x=>{x.launcher_before.sha256='f'.repeat(64);}],
  ['historical manifest rewrite',x=>{x.historical_manifest_sha256='f'.repeat(64);}],
  ['runtime binding inserted',x=>{x.runtime_binding={approved:true};}],
  ['native overclaim',x=>{x.native='PASS';}],
]){
  const changed=structuredClone(record);mutate(changed);assert.throws(()=>validate(changed));
  negatives++;console.log('PASS rejects '+name);
}
console.log(JSON.stringify({source_reconciliation:'PASS',historical_inventory:32,protected_sources:15,
  reviewed_launcher_successors:1,negative_controls:negatives,native_activation_Auth_browser:'NOT_RUN'}));
