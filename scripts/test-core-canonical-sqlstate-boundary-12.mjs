/** Text/byte checks + explicitly labeled JS control-flow MODEL; no SQL parser/PG. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build,validateBody,validateDefinition,validatePacket,transformBody,identity,BASE,ROOT,PATH,INSERT} from './generate-core-canonical-sqlstate-boundary-12.mjs';
const p=build();let checks=0;
const check=(name,fn)=>{fn();console.log(`PASS ${++checks} ${name}`);};
check('exact canonical eight-boundary family on22 lexical routines, zero unmapped app_private edges',()=>{assert.equal(p.records.length,8);assert.equal(p.plan.closure.named_routines.length,22);assert.deepEqual(p.plan.closure.unmapped,[]);assert.equal(new Set(p.records.map(f=>f.signature)).size,8);});
check('every body is restored byte-identically by removing only the added40001 bare-RAISE clause',()=>{for(const f of p.records){assert.equal(f.afterBody.replace(INSERT,''),f.body);validateBody(f.body,f.afterBody);assert.equal(f.afterClause.replace(INSERT,''),f.beforeClause);assert.equal(f.before_body.sha256,identity(f.body).sha256);assert.equal(f.after_body.sha256,identity(f.afterBody).sha256);}});
for(const f of p.records)check(`independent FULL definition round-trip: ${f.signature}`,()=>{
 const opening=/\bas\s+(\$[a-z0-9_]*\$)/i.exec(f.afterDefinition);
 assert.equal(opening?.[1],f.delimiter);assert.equal(f.afterDefinition.split(f.delimiter).length,3);
 const stripped=f.afterDefinition.replace(INSERT,'');
 const normalizedBefore=f.definition.replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function');
 assert.equal(stripped,normalizedBefore);validateDefinition(f.definition,f.afterDefinition);
});
check('CORE12-F01 reproduces actual predecessor replacement-dollar corruption and rejects each broken definition',()=>{
 let broken=0;
 for(const f of p.records){
  const bad=f.definition.replace(f.delimiter+f.body+f.delimiter,f.delimiter+f.afterBody+f.delimiter).replace(/^create\s+(?:or\s+replace\s+)?function/i,'create or replace function');
  if(f.delimiter==='$$'){broken++;assert.notEqual(bad,f.afterDefinition);assert.throws(()=>validateDefinition(f.definition,bad),/DEFINITION_DELIMITER/);}
  else assert.equal(bad,f.afterDefinition);
 }
 assert.equal(broken,4);
});
for(const [name,mutate] of [
 ['header security',s=>s.replace(/security definer/i,'security invoker')],
 ['header search_path',s=>s.replace(/search_path\s*=\s*pg_catalog/i,'search_path=public')],
 ['closing dollar delimiter',s=>s.slice(0,s.lastIndexOf('$$'))+'$'+s.slice(s.lastIndexOf('$$')+2)],
 ['definition suffix',s=>s+' '],
])check(`coherently resealed full-definition ${name} rejected`,()=>{
 const f=p.records.find(x=>x.delimiter==='$$'),bad=mutate(f.afterDefinition);identity(bad);
 assert.throws(()=>validateDefinition(f.definition,bad),/DEFINITION_/);
});
check('non-Core qualified callees closed to existing Auth/system primitives, not invented evaluator',()=>{assert.deepEqual(p.plan.closure.external_qualified_calls,['auth.jwt','auth.uid','pg_catalog.isfinite']);});
check('guards preimages/catalog attributes/owner/ACL/default/dependency and final ROLLBACK present',()=>{validatePacket(p);assert.ok(p.sql.indexOf('core12_review_only_execution_hold')<p.sql.indexOf('CREATE TEMP TABLE'));for(const text of ['core12_preimage_mismatch','core12_exact_owner_create_required','core12_postimage_mismatch','core12_catalog_owner_acl_attribute_delta','core12_default_acl_delta','core12_dependency_delta'])assert.ok(p.sql.includes(text));assert.ok(p.sql.endsWith('ROLLBACK;\n'));});
for(const [name,change,reason] of [
 ['remove rethrow',s=>s.replace(INSERT,''),'SERIALIZATION_RETHROW_MISSING'],
 ['swallow serialization',s=>s.replace('then raise;','then return false;'),'SERIALIZATION_RETHROW_MISSING'],
 ['return allow on serialization',s=>s.replace('then raise;','then return true;'),'SERIALIZATION_RETHROW_MISSING'],
 ['change ordinary fallback',s=>s.replace(/when others then\s+return false;/i,'when others then return true;'),'NON_BOUNDARY_BODY_CHANGE'],
 ['relabel serialization',s=>s.replace("'40001'","'40P01'"),'SERIALIZATION_RETHROW_MISSING'],
 ['add explicit cancellation catcher',s=>s.replace(INSERT,INSERT+" when sqlstate '57014' then return false;"),'NON_BOUNDARY_BODY_CHANGE'],
 ['duplicate rethrow',s=>s.replace(INSERT,INSERT+INSERT),'SERIALIZATION_RETHROW_COUNT'],
 ['change authority predicate',s=>s.replace('return false;','return true;'),'NON_BOUNDARY_BODY_CHANGE'],
])check(`coherently resealed ${name} rejected by body invariant, not hash`,()=>{const f=p.records[0],after=change(f.afterBody);assert.equal(identity(after).sha256.length,64);assert.throws(()=>validateBody(f.body,after),new RegExp(reason));});
for(const [name,mutate,reason] of [
 ['target omitted',q=>q.records.pop(),'TARGET_FAMILY_DRIFT'],
 ['corrupted rendered delimiter',q=>{q.records[0].afterDefinition=q.records[0].afterDefinition.replace('$$','$');},'DEFINITION_DELIMITER_MISMATCH'],
 ['wrong preimage',q=>{q.records[0].body+=' ';q.records[0].afterBody=transformBody(q.records[0].body);},'CANONICAL_PREIMAGE_DRIFT'],
 ['guard removed',q=>{q.sql=q.sql.replace('core12_review_only_execution_hold','removed');},'GUARD_MISSING'],
 ['commit activation',q=>{q.sql=q.sql.replace(/ROLLBACK;\n$/,'COMMIT;\n');},'NO_FINAL_ROLLBACK'],
 ['default privileges',q=>{q.sql=q.sql.replace(/ROLLBACK;\n$/,'ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;\nROLLBACK;\n');},'PRIVILEGE_OR_ACTIVATION_DELTA'],
 ['positive GRANT',q=>{q.sql=q.sql.replace(/ROLLBACK;\n$/,'GRANT EXECUTE ON FUNCTION app_private.fake() TO PUBLIC;\nROLLBACK;\n');},'PRIVILEGE_OR_ACTIVATION_DELTA'],
 ['ordinary SQL insertion',q=>{q.sql=q.sql.replace(/ROLLBACK;\n$/,'SELECT true;\nROLLBACK;\n');},'NONCANONICAL_DELTA'],
 ['claimed execution authorization',q=>{const m=JSON.parse(q.planText);m.execution_authorization=true;q.planText=JSON.stringify(m,null,2)+'\n';},'EXECUTION_BINDING_NOT_NULL'],
 ['changed native expected state',q=>{q.harness=q.harness.replace("'40001'","'42501'");},'NONCANONICAL_HARNESS'],
])check(`packet ${name} rejected after recomputed identities`,()=>{const q=structuredClone(p);mutate(q);identity(q.sql);identity(q.harness);assert.throws(()=>validatePacket(q),new RegExp(reason));});
function model(variant,code,control){if(code===null)return control;if(code==='57014'||code==='P0004'||(variant==='after'&&code==='40001'))throw Object.freeze({code,model_only:true});return false;}
check('JS MODEL counterexample: predecessor swallows40001; successor rethrows; NOT a PG SQLSTATE proof',()=>{assert.equal(model('before','40001',false),false);assert.throws(()=>model('after','40001',false),e=>e.code==='40001'&&e.model_only);});
check('JS MODEL ordinary fail-closed and cancellation/assertion/normal controls unchanged',()=>{for(const code of ['42501','22023','42P01','40P01','XX000','P0001'])assert.equal(model('before',code,false),model('after',code,false));for(const code of ['57014','P0004'])for(const v of ['before','after'])assert.throws(()=>model(v,code,false),e=>e.code===code);for(const value of [false,true])assert.equal(model('before',null,value),model('after',null,value));});
check('PG-only future source has exact extracted handlers,176planned calls, closed TEMP ACL and guard; NOT_RUN',()=>{assert.equal(p.plan.pg_only.planned_calls,176);for(const f of p.records){assert.ok(p.harness.includes(f.beforeClause));assert.ok(p.harness.includes(f.afterClause));}assert.equal((p.harness.match(/CREATE FUNCTION pg_temp\./g)??[]).length,16);assert.equal((p.harness.match(/REVOKE ALL ON FUNCTION pg_temp\./g)??[]).length,16);assert.ok(p.harness.includes('GET STACKED DIAGNOSTICS'));assert.ok(p.harness.includes("current_database()<>'core_sqlstate_boundary_proof'"));assert.ok(p.harness.endsWith('ROLLBACK;\n'));assert.equal(p.plan.execution_authorization,null);assert.equal(p.plan.execution_target,null);assert.equal(p.plan.runtime_binding,null);assert.equal(p.plan.status,'NOT_RUN_NOT_PASS');});
check('source artifacts deterministic and current installers/Core11 remain exact accepted Base',()=>{for(const [name,body] of Object.entries({'delta.sql':p.sql,'pg-only-boundary.test.sql':p.harness,'caseplan.json':p.planText}))assert.equal(readFileSync(new URL('../'+PATH+name,import.meta.url),'utf8'),body);for(const path of [...p.sources.map(s=>s.path),'src/lib/core/postgres-transaction-host-v1.ts','src/lib/core/ce012-host-terminal-checkpoint-v1.ts'])assert.equal(readFileSync(new URL('../'+path,import.meta.url),'utf8'),execFileSync('git',['show',BASE+':'+path],{cwd:ROOT,encoding:'utf8'}));});
console.log(JSON.stringify({task:'CORE-CANONICAL-SQLSTATE-BOUNDARY-12',static_and_model_groups:checks,result:'PASS_SOURCE_BYTES_AND_MODEL_ONLY',native_sqlstate:'NOT_RUN_NOT_PASS',planned_pg_boundary_calls:p.plan.pg_only.planned_calls,runtime_binding:null,historical_slots:'BLOCKED'}));
