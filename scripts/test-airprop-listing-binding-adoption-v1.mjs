// NEW packet-only controls; synthetic catalog, no PG parser/SQL/native execution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeContract, INPUTS, TABLE, RELATIONS, FUNCTIONS, assessProjection, recoverProjection } from './prepare-airprop-listing-binding-adoption-v1.mjs';
const spec = makeContract(), owner='synthetic_listing_custodian';
const target={database_name:'synthetic_packet_model',database_oid:'1234',server_version_num:'170011',executor:'synthetic_observer',session:'synthetic_observer'};
const clones = value => structuredClone(value);
const roles = [{oid:1,rolname:owner,rolsuper:false,rolbypassrls:false},
  {oid:2,rolname:'synthetic_runtime',rolsuper:false,rolbypassrls:false},
  {oid:3,rolname:'synthetic_installer',rolsuper:true,rolbypassrls:false}];
const effective = roles.map(r=>({role:r.rolname,usage:true,select:r.rolname===owner,insert:r.rolname===owner,
  update:r.rolname===owner,delete:r.rolname===owner,truncate:r.rolname===owner,references:r.rolname===owner,trigger:r.rolname===owner}));
function observation() {
  const table={oid:'99',owner,kind:'r',persistence:'p',rls:true,force_rls:true,schema:'airprop',
    columns:spec.columns.map(c=>({...c,expression:c.generated?'SYNTHETIC_COMPILED_EXPRESSION':null,acl:null})),
    constraints:[...spec.foreign_keys.map((c,n)=>({...clones(c),name:'synthetic_fk_'+n,type:'f'})),
      {name:'synthetic_pk',type:'p',source_columns:spec.primary_key,validated:true},
      ...Array.from({length:7},(_,n)=>({name:'synthetic_check_'+n,type:'c',definition:'SYNTHETIC_ONLY',validated:true}))],
    indexes:spec.indexes.map(name=>({name,valid:true,ready:true,unique:true,definition:'SYNTHETIC_ONLY'})),
    triggers:spec.triggers.map(t=>({...t,enabled:'O',internal:false,definition:'SYNTHETIC_ONLY'})),policies:[],rules:[],acl:null,effective:clones(effective)};
  return {contract:'airprop-listing-binding-catalog.v1',identity:clones(target),observation:{pid:12,at:'2026-11-09T10:00:00Z'},overflow:false,
    relations:RELATIONS.map(name=>({name,present:true,catalog:name===TABLE?table:{owner:'synthetic_dependency'}})),
    functions:FUNCTIONS.map(signature=>({signature,present:true,catalog:signature.startsWith('airprop.')?
      {...clones(spec.functions.find(f=>f.signature===signature)),owner,oid:'123',catalog_sha256:'a'.repeat(64),
        acl:null,effective:roles.map(r=>({role:r.rolname,usage:true,execute:r.rolname===owner}))}:{owner:'synthetic_dependency'}})),
    roles:clones(roles),memberships:[],default_acl:[],event_triggers:[],overloads:FUNCTIONS.slice(0,4)};
}
const table=p=>p.relations.find(r=>r.name===TABLE).catalog;
const run=(p,compiled=null,phase='verify')=>assessProjection(p,target,owner,compiled,phase);
let groups=0; const check=(name,fn)=>{fn();console.log('PASS',++groups,name);};
check('existing source pins and deterministic contract; no hidden download/install or runtime target',()=>{
  assert.deepEqual(JSON.parse(readFileSync('docs/airprop/listing-binding-adoption-v1/contract.json','utf8')),spec);
  assert.equal(spec.activation,null);assert.equal(spec.owner,null);assert.equal(spec.compiled_catalog,null);assert.equal(spec.policy_adoption,null);
  assert.equal(spec.adoption.edits_to_guard,false);assert.equal(spec.adoption.new_roles_grants_policies,false);
});
check('changed predecessor source is rejected without resealing',()=>{
  const path=Object.keys(INPUTS)[0];assert.throws(()=>makeContract(p=>Buffer.from(readFileSync(p,'utf8')+(p===path?'\n':''))),/SOURCE_PIN/);
});
check('source proposal guard and both function byte-extractions stay exact',()=>{
  const ddl=readFileSync(spec.inventory[0].path,'utf8');assert.match(ddl,/raise exception 'AIRPROP_LISTING_SELECTED_BINDING_ADOPTION_REQUIRED' using errcode='55000'/);
  assert.equal(spec.functions.length,2);assert.ok(spec.functions.every(f=>/^[0-9a-f]{64}$/.test(f.body_sha256)&&!f.security_definer));
});
check('existing publish/edit/withdraw/republish mapping is explicit, never a new dispatcher',()=>{
  assert.deepEqual(spec.action_mapping.map(a=>a.action),['publish_listing','edit_listing','withdraw_listing','republish_listing']);
  assert.deepEqual(spec.action_mapping.slice(1).map(a=>a.native_action),['edit','withdraw','republish']);
  assert.equal(spec.c03.aggregate_id,'original selected.unit_id');assert.equal(spec.c03.replay_policy,'provider_current_state_required');
  assert.equal(spec.c03.read_uses_command_receipt,false);assert.equal(spec.c03.session_storage_is_authority,false);
});
check('source structure without compiled evidence is NOT_READY, not install/authority',()=>{
  const p=observation(),r=run(p);assert.equal(r.reason,'COMPILED_CATALOG_UNOBSERVED');assert.equal(r.activation,null);assert.equal(r.next_sql,null);
});
check('full expected metadata equality is comparison-only, never runtime READY',()=>{
  const p=observation(),r=run(p,clones(p));assert.equal(r.status,'CATALOG_MATCH_NOT_ACTIVATED');assert.equal(r.runtime_access,'NOT_ADOPTED');
  assert.equal(r.business_unknown,'UNCHANGED');assert.equal(r.activation,null);
});
check('target identity/owner/role custody mismatch cannot be a matching install',()=>{
  for(const mutate of [p=>p.identity.database_oid='999',p=>p.identity.executor='other',p=>p.identity.session='other']){
    const p=observation();mutate(p);assert.equal(run(p,p).reason,'TARGET_IDENTITY_MISMATCH');
  }
  const p=observation();assert.equal(assessProjection(p,target,null).reason,'OWNER_UNBOUND');
  table(p).owner='other';assert.equal(run(p,p).reason,'OWNER_DRIFT');
  const q=observation();q.roles[0].rolbypassrls=true;assert.equal(run(q,q).reason,'OWNER_CUSTODY_NOT_ADMITTED');
});
check('missing metadata and overflow are not absence and cannot silently truncate closure',()=>{
  for(const mutate of [p=>delete p.default_acl,p=>p.overflow=true,p=>p.relations.pop(),p=>p.functions[0].signature='unknown']){
    const p=observation();mutate(p);assert.equal(run(p).reason,'OBSERVATION_INVALID');
  }
  const p=observation();delete table(p).acl;assert.equal(run(p).reason,'CATALOG_INCOMPLETE');
});
check('missing dependencies are listed before installation, not created by packet',()=>{
  const p=observation();p.functions[2].present=false;p.functions[2].catalog=null;
  assert.equal(run(p).reason,'DEPENDENCY_NOT_READY');assert.deepEqual(run(p).missing,[FUNCTIONS[2]]);
});
check('fully absent vs partially installed object sets are distinguished',()=>{
  const p=observation();p.relations[0].present=false;p.relations[0].catalog=null;
  assert.equal(run(p).reason,'PARTIAL_INSTALL_OR_DRIFT');
  for(const f of p.functions.filter(f=>f.signature.startsWith('airprop.'))){f.present=false;f.catalog=null;}
  p.overloads=FUNCTIONS.slice(2,4);
  assert.equal(run(p,null,'preflight').reason,'ABSENT_INSTALL_REVIEW_REQUIRED');assert.equal(run(p).reason,'ABSENT_NOT_INSTALLED');
});
for(const field of ['rls','force_rls'])check(field+' drift is reason-specific even with coherent metadata baseline',()=>{
  const p=observation();table(p)[field]=false;assert.equal(run(p,p).reason,'TABLE_SECURITY_DRIFT');
});
check('extra overload cannot evade exact-signature projection',()=>{
  const p=observation();p.overloads.push('airprop.guard_listing_selected_binding_v1(integer)');assert.equal(run(p,p).reason,'OVERLOAD_DRIFT');
});
check('column/type/generated/null/default/column-ACL drift rejected',()=>{
  for(const mutate of [c=>c.type='text',c=>c.generated='',c=>c.not_null=false,c=>c.identity='d',c=>c.expression=null,c=>c.acl='{unexpected}']){
    const p=observation();mutate(table(p).columns[6]);assert.equal(run(p,p).reason,'COLUMN_DRIFT');
  }
});
check('FK scope, target, RESTRICT and validation are exact, not count-only',()=>{
  for(const mutate of [fk=>fk.source_columns=['listing_id'],fk=>fk.target='portfolio.properties',fk=>fk.delete_action='c',fk=>fk.validated=false,fk=>fk.deferrable=true]){
    const p=observation();mutate(table(p).constraints[0]);assert.equal(run(p,p).reason,'FK_DRIFT');
  }
});
check('primary key/check count/unvalidated checks fail distinct source constraint gate',()=>{
  for(const mutate of [t=>t.constraints.pop(),t=>t.constraints[4].source_columns=['listing_id'],t=>t.constraints[5].validated=false]){
    const p=observation();mutate(table(p));assert.equal(run(p,p).reason,'CONSTRAINT_DRIFT');
  }
});
check('missing/extra/nonunique/unready index cannot pass',()=>{
  for(const mutate of [t=>t.indexes.pop(),t=>t.indexes[1].unique=false,t=>t.indexes[1].ready=false]){
    const p=observation();mutate(table(p));assert.equal(run(p,p).reason,'INDEX_DRIFT');
  }
});
check('trigger bypass or early receipt check is rejected independently',()=>{
  for(const mutate of [t=>t.triggers[0].enabled='D',t=>t.triggers[2].initially_deferred=false,t=>t.triggers[1].type=32]){
    const p=observation();mutate(table(p));assert.equal(run(p,p).reason,'TRIGGER_DRIFT');
  }
});
check('new RLS policy/rule is not accepted from an unreviewed catalog snapshot',()=>{
  for(const field of ['policies','rules']){const p=observation();table(p)[field].push({unexpected:true});assert.equal(run(p,p).reason,'POLICY_OR_RULE_DRIFT');}
});
check('effective ACL expansion and omitted role visibility are not hidden by raw ACL',()=>{
  const p=observation();table(p).effective[1].insert=true;assert.equal(run(p,p).reason,'ACL_EXPANSION');
  const q=observation();table(q).effective.pop();assert.equal(run(q,q).reason,'EFFECTIVE_ACL_INCOMPLETE');
});
check('invoker/body/owner/search_path drift of both guards fails function gate',()=>{
  for(let i=0;i<2;i++)for(const mutate of [f=>f.security_definer=true,f=>f.body_sha256='0'.repeat(64),f=>f.owner='other',f=>f.config=['search_path=public']]){
    const p=observation();mutate(p.functions[i].catalog);assert.equal(run(p,p).reason,'FUNCTION_DRIFT');
  }
});
check('guard EXECUTE expansion is rejected separately from table ACL',()=>{
  const p=observation();p.functions[1].catalog.effective[1].execute=true;assert.equal(run(p,p).reason,'FUNCTION_ACL_EXPANSION');
});
check('compiled projection mismatch detects expressions/ACL/default ACL/membership/event drift',()=>{
  for(const mutate of [p=>table(p).columns[6].expression='DIFFERENT',p=>table(p).constraints[5].definition='DIFFERENT',
    p=>table(p).indexes[1].definition='DIFFERENT',p=>table(p).acl='{different}',
    p=>p.memberships.push({roleid:4,member:2}),p=>p.default_acl.push({changed:true}),p=>p.event_triggers.push({changed:true})]){
    const p=observation(),expected=clones(p);mutate(p);assert.equal(run(p,expected).reason,'COMPILED_CATALOG_DRIFT');
  }
});
check('observation timestamp/PID refresh alone does not alter stable comparison',()=>{
  const p=observation(),expected=clones(p);p.observation={pid:19,at:'2026-11-09T10:00:01Z'};
  assert.equal(run(p,expected).status,'CATALOG_MATCH_NOT_ACTIVATED');
});
check('unknown install ACK plus matching catalog remains UNKNOWN; no blind install retry or business settlement',()=>{
  const before=observation(),after=observation(),r=recoverProjection(before,after,target,owner,clones(after));
  assert.equal(r.settlement,'UNKNOWN');assert.equal(r.repeat_install,false);assert.equal(r.business_unknown,'UNCHANGED');assert.equal(r.next_sql,null);
  assert.equal(recoverProjection(before,after,target,owner,clones(after),'commit_ack').settlement,'ACK_REQUIRES_INDEPENDENT_VERIFY');
});
check('recovery detects partial/wrong-target/drifting catalog and stops without destructive cleanup',()=>{
  const before=observation(),after=clones(before);table(after).force_rls=false;
  assert.equal(recoverProjection(before,after,target,owner).reason,'RECOVERY_DRIFT_STOP');
  after.identity.database_oid='999';assert.equal(recoverProjection(before,after,target,owner).reason,'TARGET_IDENTITY_MISMATCH');
});
check('catalog projection is bounded READ ONLY and never calls domain/authority helper or returns row data',()=>{
  const sql=readFileSync(spec.projection_sql,'utf8');assert.match(sql,/BEGIN READ ONLY;/);assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/SET LOCAL search_path=pg_catalog,pg_temp;/);assert.match(sql,/LIMIT 257/);
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE airprop|DELETE FROM|GRANT|CREATE TABLE|ALTER TABLE|COMMIT;)\b/i);
  assert.doesNotMatch(sql,/FROM (?:airprop|portfolio|platform|audit)\./i);
  assert.ok(FUNCTIONS.every(f=>sql.includes("('"+f+"')")));
});
console.log(JSON.stringify({groups,proof:'SOURCE_AND_SYNTHETIC_CATALOG_ONLY',sql_compile_execution:'NOT_RUN_NOT_PASS',
  native_auth_db_browser:'NOT_RUN_NOT_PASS',prior_successful_suites:'NOT_REPEATED',activation:null}));
