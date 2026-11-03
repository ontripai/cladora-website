/** Offline consistency and negative controls; not native/fresh-install proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex'),path='supabase/install/core-service-app-assembly-v1/manifest.json',m=JSON.parse(readFileSync(path));
function validate(v){
 assert.equal(v.contract,'core-service-real-app-assembly.delivery.v1');assert.equal(v.base,'29ed18541c602dae4e6db5c98a96201250af630b');assert.equal(v.branch,'codex/core-service-real-app-assembly-17');
 assert.deepEqual(v.units.map(x=>x.path),['supabase/install/core-service-app-assembly-v1/catalog-compatibility.sql','supabase/install/core-service-app-assembly-v1/read-access.sql']);
 assert.equal(new Set(v.inventory.map(x=>x.path)).size,v.inventory.length);for(const x of v.inventory){const b=readFileSync(x.path);assert.equal(b.length,x.after.bytes);assert.equal(sha(b),x.after.sha256,x.path);}
 for(const x of v.protectedSources){assert.equal(x.unchanged,true);assert.equal(sha(readFileSync(x.path)),x.sha256);}
 for(const u of v.units){assert.equal(sha(readFileSync(u.path)),u.sha256);assert.equal(u.actor,'cladora_core_installer');assert.equal(u.settlement,'COMMIT_AND_READYFORQUERY_I');}
 for(const w of v.witnesses)if(w.sourcePins)for(const [p,h]of Object.entries(w.sourcePins))assert.equal(sha(readFileSync(p)),h);
 assert.equal(v.installer_binding.generation_selected,'historical-v2');assert.equal(v.installer_binding.fresh_v3,'CONTROLLED_POSITIVE_NEGATIVE_ONLY_NATIVE_FRESH_NOT_RUN');assert.equal(v.witnesses.find(x=>x.receipt==='core17-installer-binding-native.json').generation,'historical-v2');
 for(const key of ['staging_production_changed','public_grants_added','default_ACL_changed','shared_host_evaluator_S01_changed','historical_migrations_changed','frontend_changed','package_lock_changed','rejected_report_republished'])assert.equal(v.scope[key],false,key);
 assert.ok(v.open_gates.includes('consumer browser entry/shared-shell integration'));
 const source=readFileSync('supabase/migrations/20261004083750_20261004083058_service_catalog_registry_compatibility_v1.sql','utf8'),selected=readFileSync(v.units[0].path,'utf8');assert.ok(selected.includes(source.replace(/^begin;/,'').replace(/commit;\s*$/,'')));
 for(const unit of v.units)assert.doesNotMatch(readFileSync(unit.path,'utf8'),/ALTER\s+DEFAULT\s+PRIVILEGES|TO\s+(?:PUBLIC|anon|authenticated|service_role)\s*;/i);
 return true;
}
assert.equal(validate(m),true);let negatives=0;
function reject(name,edit){const x=structuredClone(m);edit(x);assert.throws(()=>validate(x));console.log('PASS rejects '+name);negatives++;}
reject('wrong Base',x=>{x.base='0'.repeat(40);});
reject('using deleted old branch',x=>{x.branch='codex/program-core-service-s01-producer-01';});
reject('omitted compatibility dependency',x=>{x.units.shift();});
reject('wrong source pin',x=>{x.inventory[0].after.sha256='f'.repeat(64);});
reject('wrong send-image identity',x=>{x.units[1].sha256='f'.repeat(64);});
reject('duplicate effect inventory identity',x=>{x.inventory.push(structuredClone(x.inventory[0]));});
reject('historical credential relabeled fresh',x=>{x.installer_binding.generation_selected='v3';});
reject('controlled fresh case relabeled native',x=>{x.installer_binding.fresh_v3='NATIVE_PASS';});
reject('public activation claimed',x=>{x.scope.public_grants_added=true;});
reject('browser gate erased',x=>{x.open_gates=x.open_gates.filter(x=>x!=='consumer browser entry/shared-shell integration');});
console.log(JSON.stringify({manifest_positive:1,negative_controls:negatives,native:'NOT_CLAIMED_BY_CHECKER'}));
