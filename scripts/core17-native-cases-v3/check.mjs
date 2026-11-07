/** Source seals/closed case contracts only; never native acceptance. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {productSourceClosure} from './source-closure.mjs';
import {APP,INSTALLED,SOURCE_BASE,CASES,executionLimits} from './contract.mjs';
const dir='scripts/core17-native-cases-v3',m=JSON.parse(readFileSync(dir+'/manifest.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
function validate(x){
 assert.equal(x.contract,'core17.coordinator206.native-case-source.v3');assert.equal(x.App,APP);assert.equal(x.installed_core,INSTALLED);assert.equal(x.source_parent,SOURCE_BASE);assert.equal(x.runtime_activation,null);assert.equal(x.source_only,true);assert.equal(x.native,'NOT_RUN_NOT_PASS');
 for(const p of [...x.operator_sources,...x.product_sources]){const b=readFileSync(p.path);assert.equal(b.length,p.bytes);assert.equal(hash(b),p.sha256,p.path);}
 assert.deepEqual(x.operator_sources.filter(p=>p.unchanged_dependency).map(p=>p.path).sort(),['scripts/lib/core15-native-ts-loader.mjs','scripts/lib/core-installer-credential-binding-v1.mjs','scripts/lib/core-service-assembly-environment-v1.mjs'].sort());
 assert.deepEqual(x.product_sources.map(p=>p.path).sort(),productSourceClosure(process.cwd()));
 for(const p of x.product_sources)assert.equal(p.sha256,hash(execFileSync('git',['show',APP+':'+p.path],{maxBuffer:10*1024*1024})));
 const owned=x.operator_sources.filter(p=>!p.unchanged_dependency).map(p=>p.path.split('/').at(-1)).sort();assert.deepEqual(owned,readdirSync(dir).filter(n=>n!=='manifest.json').sort());
 assert.equal(new Set(x.product_sources.map(p=>p.path)).size,x.product_sources.length);for(const p of x.product_sources)assert.equal(p.unchanged,true);
 assert.deepEqual(x.limits,executionLimits(CASES));assert.equal(x.checks.new_controlled,54);
 const cases=JSON.parse(readFileSync(dir+'/case-contracts.json'));assert.deepEqual(cases.cases.map(v=>v.id),CASES);assert.equal(cases.runtime_execution,'NOT_RUN_NOT_PASS');
 for(const v of Object.values(x.scope))assert.equal(v,false);
 for(const name of ['fixture.mjs','queries.mjs','cases.mjs'])assert.doesNotMatch(readFileSync(dir+'/'+name,'utf8'),/\b(?:GRANT|REVOKE)\s+(?:INSERT|SELECT|UPDATE|DELETE)|ALTER\s+DEFAULT\s+PRIVILEGES|CREATE\s+TRIGGER/i);
 return true;
}
validate(m);let n=0;
for(const [name,edit]of [['v2 source relabel',x=>{x.installed_core=APP;}],['wrong source pin',x=>{x.operator_sources[0].sha256='0'.repeat(64);}],['missing operator source',x=>{x.operator_sources.pop();}],['wrong target App',x=>{x.App='0'.repeat(40);}],['fabricated activation',x=>{x.runtime_activation={allow:true};}],['native model relabel',x=>{x.native='PASS';}],['unbounded budget',x=>{x.limits.new_Requests=999;}],['public permission expansion',x=>{x.scope.Auth_role_ACL_RLS_modified=true;}]]){const x=structuredClone(m);edit(x);assert.throws(()=>validate(x));console.log('PASS rejects '+name);n++;}
console.log(JSON.stringify({positive:1,negative:n,native:'NOT_RUN_NOT_PASS'}));
