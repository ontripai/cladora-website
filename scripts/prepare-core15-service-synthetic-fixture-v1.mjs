/** Owned development fixture only; NOT product onboarding/publication evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import pg from 'pg';
const root='/workspace/private/cladora-functional-dev-v1';
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const read=p=>JSON.parse(readFileSync(root+'/'+p));
assert.equal(read('core15/service-domain-v1/subject-validity-committed.json').state,'COMMIT_AND_RFQ_I');
const mfa=read('core15/service-mfa-private.json');assert.equal(mfa.state,'TWO_REAL_SYNTHETIC_AAL2_SESSIONS');const s=read('secrets.json');
const recordPath=root+'/core15/service-fixture-private.json';assert.equal(existsSync(recordPath),false,'STOP previous fixture dispatch, no overwrite/reseed');
const identities=[];
for(const item of mfa.users){const auth=createClient('http://127.0.0.1:55421',s.anon_key,{auth:{persistSession:false,autoRefreshToken:false}}),u=await auth.auth.getUser(item.access_token),c=await auth.auth.getClaims(item.access_token);assert.equal(u.error,null);assert.equal(c.error,null);assert.equal(c.data.claims.aal,'aal2');assert.equal(u.data.user.id,item.actor_id);identities.push(c.data.claims);}
const id=()=>randomUUID();const record={contract:'core15-owned-service-fixture.v1',state:'DISPATCHED_NO_RETRY',run:id(),scope:'synthetic administrative genesis only; NOT G2/publication execution proof',actors:mfa.users.map(x=>x.actor_id),tenants:[id(),id()],workspaces:[id(),id()],roles:[id(),id(),id()],members:[id(),id(),id()],contexts:[id(),id(),id()],workspace_roles:[id(),id(),id()],beneficiaries:[id(),id()],provider:id(),agreement:id(),offering:id(),revision:id(),definition:id()};
const save=()=>writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n',{mode:0o600});save();
const secret=read('core15/service-native-v2/installer-secret.json');const c=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:5000,query_timeout:30000});const tags=[],ready=[];c.connection.on('commandComplete',m=>tags.push(m.text));c.connection.on('readyForQuery',m=>ready.push(m.status));
try{
 await c.connect();const pre=await c.query("select current_user::text actor,(select count(*)::int from platform.customer_workspaces) workspaces,(select count(*)::int from service_catalog.requests) requests,(select rolsuper or rolbypassrls from pg_roles where rolname=current_user) privileged");assert.deepEqual(pre.rows,[{actor:'cladora_core_installer',workspaces:0,requests:0,privileged:false}]);
 await c.query('begin');await c.query("set local lock_timeout='5s'");await c.query("set local statement_timeout='20s'");
 const taxonomy=await c.query("select p.id profile,o.id model from platform.property_profiles p cross join platform.operating_models o where p.code='residential_condominium' and p.version=1 and p.is_active and o.code='association_managed' and o.version=1 and o.is_active");assert.equal(taxonomy.rowCount,1);
 const serviceModule=await c.query("select id from platform.module_definitions where code='services_orders' and version=1 and is_active and lifecycle_status='published'");assert.equal(serviceModule.rowCount,1);
 for(let i=0;i<2;i++){
  await c.query("insert into platform.tenants(id,legal_name,status,timezone) values($1,'Core15 synthetic owned fixture','active','UTC')",[record.tenants[i]]);
  await c.query("insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment) values($1,$2,'ASSOCIATION','ACTIVE','Core15 synthetic fixture','PILOT')",[record.workspaces[i],record.tenants[i]]);
  await c.query('insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,created_by) values($1,$2,$3,$4,$5)',[record.tenants[i],record.workspaces[i],taxonomy.rows[0].profile,taxonomy.rows[0].model,record.actors[0]]);
  await c.query("insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,activated_by,reason) values($1,$2,$3,'services_orders','active',$4,'Owned synthetic fixture only')",[record.tenants[i],record.workspaces[i],serviceModule.rows[0].id,record.actors[0]]);
  await c.query("insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value) values($1,'module.services_orders','boolean',true)",[record.workspaces[i]]);
  await c.query("insert into portfolio.parties(id,tenant_id,type,legal_name) values($1,$2,'person','Synthetic requester person')",[record.beneficiaries[i],record.tenants[i]]);
 }
 for(let i=0;i<3;i++){
  const tenant=i===2?1:0,actor=i===1?1:0;
  await c.query("insert into identity.roles(id,tenant_id,code,name) values($1,$2,$3,'Core15 synthetic scoped role')",[record.roles[i],record.tenants[tenant],i===1?'core15_fixture_publisher':'core15_fixture_requester']);
  const codes=i===1?['services.catalog.publish']:['services.orders.read','services.orders.request'];
  const permission=await c.query("insert into identity.role_permissions(role_id,permission_id,effect) select $1,id,'allow' from identity.permissions where code=any($2::text[]) returning permission_id",[record.roles[i],codes]);assert.equal(permission.rowCount,codes.length);
  await c.query("insert into identity.memberships(id,tenant_id,user_id,role_id,status) values($1,$2,$3,$4,'active')",[record.members[i],record.tenants[tenant],record.actors[actor],record.roles[i]]);
  await c.query("insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values($1,$2,$3,'tenant')",[record.contexts[i],record.members[i],record.tenants[tenant]]);
  await c.query("insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,lifecycle_status,created_by) values($1,$2,$3,$4,'Synthetic genesis role',$5,'workspace','published',$6)",[record.workspace_roles[i],record.tenants[tenant],record.workspaces[tenant],'core15_fixture_'+i,record.roles[i],record.actors[actor]]);
  await c.query("insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,authority_policy_version) values($1,$2,$3,$4,'workspace',$5,$3,'Synthetic admin genesis; not delegated writer proof',1)",[record.tenants[tenant],record.workspaces[tenant],record.members[i],record.workspace_roles[i],record.actors[actor]]);
  if(i!==1)await c.query('insert into identity.membership_parties(membership_id,tenant_id,party_id) values($1,$2,$3)',[record.members[i],record.tenants[tenant],record.beneficiaries[tenant]]);
 }
 await c.query("insert into portfolio.parties(id,tenant_id,type,legal_name) values($1,$2,'company','Synthetic provider company')",[record.provider,record.tenants[0]]);
 await c.query("select app_private.write_core_provider_agreement_v1('create',$1,$2,$3,$4,0,(clock_timestamp() at time zone 'UTC')::date-1,null,ARRAY['service.request.create'])",[record.agreement,record.tenants[0],record.workspaces[0],record.provider]);
 const now=await c.query(`select to_char((clock_timestamp()-interval '5 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') at`);
 const labels={ro:'Test sintetic',en:'Synthetic test',fa:'آزمون مصنوعی'},terms={labels,description:labels,acquisition_mode:'pre_quote',price:{kind:'quote_required'},valid_from:now.rows[0].at,valid_until:null,cancellation_terms:labels,acceptance_criteria:labels,document_version_ids:[]};
 await c.query("insert into service_catalog.definitions(id,tenant_id,workspace_id,code,labels) values($1,$2,$3,'core15_synthetic',$4)",[record.definition,record.tenants[0],record.workspaces[0],labels]);
 await c.query('insert into service_catalog.offerings(id,tenant_id,workspace_id,definition_id,provider_party_id,current_revision_id,published_revision_id,created_by) values($1,$2,$3,$4,$5,$6,$6,$7)',[record.offering,record.tenants[0],record.workspaces[0],record.definition,record.provider,record.revision,record.actors[0]]);
 await c.query("insert into service_catalog.revisions(id,tenant_id,workspace_id,offering_id,commercial_terms,valid_from,status,created_by,submitted_by,published_by,revision_version,provider_agreement_id,provider_agreement_version,coverage,eligibility) values($1,$2,$3,$4,$5,$6,'published',$7,$7,$8,1,$9,1,$10,$11)",[record.revision,record.tenants[0],record.workspaces[0],record.offering,terms,now.rows[0].at,record.actors[0],record.actors[1],record.agreement,{kind:'workspace'},{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]}]);
 const committed=await c.query('commit');assert.equal(committed.command,'COMMIT');assert.equal(ready.at(-1),'I');record.state='ADMIN_FIXTURE_COMMIT_RFQ_I';save();
 // Real canonical evaluation, NOT a mocked bool or a substitute for runtime proof.
 await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(identities[0])]);
 const guard=await c.query('select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) allowed',[record.contexts[0],record.workspaces[0],'services.orders.request','services_orders']);
 const other=await c.query('select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) allowed',[record.contexts[0],record.workspaces[1],'services.orders.request','services_orders']);
 await c.query('rollback');assert.equal(guard.rows[0].allowed,true);assert.equal(other.rows[0].allowed,false);record.canonical_fixture_predicates={own_context:true,foreign_workspace:false};save();
 console.log(JSON.stringify({state:record.state,canonical_fixture_predicates:record.canonical_fixture_predicates,private_receipt_sha256:createHash('sha256').update(readFileSync(recordPath)).digest('hex'),Request_C03_receipts_seeded:0,G2_onboarding_or_publication_proof:false}));
}catch(e){record.previous_state=record.state;record.state='FAILED_OR_UNKNOWN_STOP';record.error_code=e.code??'LOCAL_ASSERTION';record.error_message=e.message?.slice(0,300);try{const r=await c.query('rollback');record.rollback=r.command;}catch{record.rollback='UNKNOWN';}save();console.error(JSON.stringify({state:record.state,error_code:record.error_code,private_diagnostic:true}));process.exitCode=1;}finally{await c.end();}
