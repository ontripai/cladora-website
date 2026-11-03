/** Offline identity/order checks and new negative controls. NOT SQL compile proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deriveDomainUnitV1} from './prepare-core15-service-domain-v1.mjs';
const root=new URL('../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const file='supabase/install/core-functional-runtime-v1/service-native-v3/service-cut.manifest.json',m=JSON.parse(readFileSync(new URL(file,root)));
const order=['catalog','module-registry','request','service-v14','subject-validity','request-version','s01-store','canonical-sqlstate','session-authority-delegation','owner-execute-bindings','runtime-access'];
export function validateCore15CutManifestV1(v){
 assert.equal(v.contract,'core15-service-first-native-cut.delivery.v1');assert.equal(v.parent,'a0a37f3c573558d14be2e62ba27e6e5475b9c4fe');
 assert.deepEqual(v.required_native_units,['foundation']);assert.deepEqual(v.domain_order,order);
 assert.deepEqual(v.domain_committed.map(x=>x.id),order);assert.equal(new Set(v.inventory.map(x=>x.path)).size,v.inventory.length);
 assert.equal(v.accepted_native_source.blob,'a13e382d31ea40b2ddd52306a34c56b648f3ed47');assert.equal(v.accepted_native_source.sha256,'94543e82513461f808037fdbfcb6c3d51531f4d826e82155a8844ace15929822');
 assert.equal(v.runtime.unconfigured_and_Vercel,'NULL_FAIL_CLOSED');assert.deepEqual(v.runtime.public_success_abi,['request_id','status']);
 for(const x of v.inventory){const raw=readFileSync(new URL(x.path,root));assert.equal(raw.length,x.after.bytes,x.path);assert.equal(sha(raw),x.after.sha256,x.path);}
 const d=JSON.parse(readFileSync(new URL('supabase/install/core-functional-runtime-v1/service-native-v3/domain-manifest.json',root)));
 assert.deepEqual(d.units.map(x=>x.id),order);
 for(const x of d.units){const raw=readFileSync(new URL(x.path,root),'utf8'),output=deriveDomainUnitV1(raw,x.id),commit=v.domain_committed.find(y=>y.id===x.id);assert.equal(sha(raw),x.source_sha256);assert.equal(sha(output),x.payload_sha256);assert.equal(Buffer.byteLength(output),x.payload_bytes);assert.equal(commit.source_sha256,x.source_sha256);assert.equal(commit.payload_sha256,x.payload_sha256);assert.equal(commit.settlement,'COMMIT_COMMAND_COMPLETE_AND_READYFORQUERY_I');}
 for(const e of v.evidence)if(e.runtime_source_pins)for(const [path,hash]of Object.entries(e.runtime_source_pins))assert.equal(sha(readFileSync(new URL(path,root))),hash,'final native coupling source identity');
 for(const x of v.protectedSources){assert.equal(x.unchanged_from_parent,true);assert.equal(sha(readFileSync(new URL(x.path,root))),x.sha256);}
 return true;
}
assert.equal(validateCore15CutManifestV1(m),true);let negatives=0;
function reject(name,mutate){const changed=structuredClone(m);mutate(changed);assert.throws(()=>validateCore15CutManifestV1(changed),name);negatives++;console.log('PASS rejects '+name);}
reject('request before canonical module registry',v=>{[v.domain_order[1],v.domain_order[2]]=[v.domain_order[2],v.domain_order[1]];});
reject('runtime grants before actual version/subject prerequisites',v=>{v.domain_order.splice(v.domain_order.indexOf('runtime-access'),1);v.domain_order.unshift('runtime-access');});
reject('stale accepted-native manifest',v=>{v.accepted_native_source.sha256='0'.repeat(64);});
reject('send-image substituted for source identity',v=>{v.domain_committed[0].source_sha256=v.domain_committed[0].payload_sha256;});
reject('partial successor missing a committed prerequisite',v=>{v.domain_committed.splice(4,1);});
reject('unproved Maintenance prerequisite added to first cut',v=>{v.required_native_units.push('maintenance-procurement');});
reject('configured development treated as generic public activation',v=>{v.runtime.unconfigured_and_Vercel='ACTIVE';});
reject('unexpected response field changes public ABI',v=>{v.runtime.public_success_abi.push('replayed');});
reject('wrong postimage pin',v=>{v.inventory[0].after.sha256='f'.repeat(64);});
reject('duplicate inventory path with coherent identity',v=>{v.inventory.push(structuredClone(v.inventory[0]));});
console.log(JSON.stringify({offline_manifest_positive:1,new_negative_controls:negatives,SQL_compile_runtime:'NOT_CLAIMED_BY_CHECKER'}));
