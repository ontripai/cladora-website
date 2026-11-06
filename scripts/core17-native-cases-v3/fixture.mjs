/** New, per-case synthetic scopes using existing canonical registry/store. No
 * Auth creation, product grants, existing role mutation or history deletion. */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createCore15NativeLoader} from '../lib/core15-native-ts-loader.mjs';
let revisionSchema;
function canonicalRevision(value){revisionSchema??=createCore15NativeLoader(fileURLToPath(new URL('../../',import.meta.url))).load('src/lib/customer/service-catalog-schema.ts').serviceOfferingRevisionSchema;return revisionSchema.parse(value);}
const labels={en:'Core17 synthetic proof',fa:'آزمون مصنوعی Core17',ro:'Probă sintetică Core17'};
const checkOne=r=>{assert.equal(r.rowCount,1);return r.rows[0];};
export async function seedFixture(c,f,actor,publisher){
 // Closed relation set, no dynamic table name from input.
 for(const [query,ids]of [
  ['select id from platform.tenants where id=any($1::uuid[])',[f.tenant]],
  ['select id from platform.customer_workspaces where id=any($1::uuid[])',[f.workspace]],
  ['select id from identity.memberships where id=any($1::uuid[])',[f.membership]],
  ['select id from identity.context_grants where id=any($1::uuid[])',[f.context]],
  ['select id from service_catalog.offerings where id=any($1::uuid[])',[f.offering]],
 ])assert.equal((await c.query(query,[ids])).rowCount,0,'PRESTATE_ID_PRESENT_STOP');
 const taxonomy=checkOne(await c.query("select p.id profile,o.id model from platform.property_profiles p cross join platform.operating_models o where p.code='residential_condominium' and p.version=1 and p.is_active and o.code='association_managed' and o.version=1 and o.is_active"));
 const modules=(await c.query("select id,code from platform.module_definitions where code=any($1::text[]) and version=1 and is_active and lifecycle_status='published'",[['services_orders','services_catalog']])).rows;
 assert.equal(modules.length,2);assert.equal(new Set(modules.map(x=>x.code)).size,2);
 await c.query("insert into platform.tenants(id,legal_name,status,timezone) values($1,'Core17 isolated synthetic proof','active','UTC')",[f.tenant]);
 await c.query("insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment) values($1,$2,'ASSOCIATION','ACTIVE','Core17 synthetic proof','PILOT')",[f.workspace,f.tenant]);
 await c.query('insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,created_by) values($1,$2,$3,$4,$5)',[f.tenant,f.workspace,taxonomy.profile,taxonomy.model,actor]);
 for(const m of modules){await c.query("insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,activated_by,reason) values($1,$2,$3,$4,'active',$5,'Core17 dedicated synthetic test only')",[f.tenant,f.workspace,m.id,m.code,actor]);await c.query("insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value) values($1,$2,'boolean',true)",[f.workspace,'module.'+m.code]);}
 await c.query("insert into identity.roles(id,tenant_id,code,name) values($1,$2,'core17_synthetic_requester','Core17 dedicated requester')",[f.role,f.tenant]);
 assert.equal((await c.query("insert into identity.role_permissions(role_id,permission_id,effect) select $1,id,'allow' from identity.permissions where code=any($2::text[]) returning permission_id",[f.role,['services.catalog.read','services.orders.read','services.orders.request']])).rowCount,3);
 await c.query("insert into identity.memberships(id,tenant_id,user_id,role_id,status) values($1,$2,$3,$4,'active')",[f.membership,f.tenant,actor,f.role]);
 await c.query("insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values($1,$2,$3,'tenant')",[f.context,f.membership,f.tenant]);
 await c.query("insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,lifecycle_status,created_by) values($1,$2,$3,'core17_proof_requester','Core17 proof',$4,'workspace','published',$5)",[f.workspace_role,f.tenant,f.workspace,f.role,actor]);
 await c.query("insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,authority_policy_version) values($1,$2,$3,$4,'workspace',$5,$3,'Core17 synthetic admin genesis only',1)",[f.tenant,f.workspace,f.membership,f.workspace_role,actor]);
 await c.query("insert into portfolio.parties(id,tenant_id,type,legal_name) values($1,$2,'person','Core17 synthetic beneficiary')",[f.beneficiary,f.tenant]);
 await c.query('insert into identity.membership_parties(membership_id,tenant_id,party_id) values($1,$2,$3)',[f.membership,f.tenant,f.beneficiary]);
 await seedOffering(c,f,actor,publisher);
 return {fixture_source:'core17.per-case.synthetic.v3',tenant:f.tenant,workspace:f.workspace,actor,publication:'ADMIN_SYNTHETIC_GENESIS_NOT_PRODUCT_PUBLICATION_PROOF',permission_codes:['services.catalog.read','services.orders.read','services.orders.request']};
}
/** Used for existing authorized B: no membership/role/permission/beneficiary
 * writer and no Request/receipt/audit/outbox seed. Caller resolves B canonically. */
export async function seedOffering(c,f,actor,publisher){
 assert.notEqual(publisher,actor,'PUBLISHER_MUST_BE_DISTINCT');
 assert.match(publisher??'',/^[a-f0-9-]{36}$/i);
 checkOne(await c.query('select id from auth.users where id=$1',[publisher]));
 for(const [sql,id]of [
  ['select id from portfolio.parties where id=$1',f.provider],
  ['select id from platform.provider_agreement_heads_v1 where id=$1',f.agreement],
  ['select id from service_catalog.definitions where id=$1',f.definition],
  ['select id from service_catalog.offerings where id=$1',f.offering],
  ['select id from service_catalog.revisions where id=$1',f.revision],
 ])assert.equal((await c.query(sql,[id])).rowCount,0,'OFFERING_PRESTATE_ID_PRESENT');
 checkOne(await c.query("select id from platform.customer_workspaces where id=$1 and tenant_id=$2 and archived_at is null and lifecycle_status='ACTIVE' for share",[f.workspace,f.tenant]));
 await c.query("insert into portfolio.parties(id,tenant_id,type,legal_name) values($1,$2,'company','Core17 synthetic provider')",[f.provider,f.tenant]);
 const created=checkOne(await c.query("select app_private.write_core_provider_agreement_v1('create',$1,$2,$3,$4,0,(clock_timestamp() at time zone 'UTC')::date-1,null,ARRAY['service.request.create']) value",[f.agreement,f.tenant,f.workspace,f.provider]));assert.equal(created.value.version,1);
 const at=checkOne(await c.query(`select to_char((clock_timestamp()-interval '5 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') at`)).at;
 const terms=canonicalRevision({labels,description:labels,acquisition_mode:'pre_quote',price:{kind:'quote_required'},valid_from:at,valid_until:null,cancellation_terms:labels,acceptance_criteria:labels,document_version_ids:[]});
 await c.query("insert into service_catalog.definitions(id,tenant_id,workspace_id,code,labels) values($1,$2,$3,'core17_native_proof',$4)",[f.definition,f.tenant,f.workspace,labels]);
 await c.query('insert into service_catalog.offerings(id,tenant_id,workspace_id,definition_id,provider_party_id,current_revision_id,published_revision_id,created_by) values($1,$2,$3,$4,$5,$6,$6,$7)',[f.offering,f.tenant,f.workspace,f.definition,f.provider,f.revision,actor]);
 await c.query("insert into service_catalog.revisions(id,tenant_id,workspace_id,offering_id,commercial_terms,valid_from,status,created_by,submitted_by,published_by,revision_version,provider_agreement_id,provider_agreement_version,coverage,eligibility) values($1,$2,$3,$4,$5,$6,'published',$7,$7,$11,1,$8,1,$9,$10)",[f.revision,f.tenant,f.workspace,f.offering,terms,at,actor,f.agreement,{kind:'workspace'},{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},publisher]);
 return {fixture_source:'core17.non-reservation-offering.v3',tenant:f.tenant,workspace:f.workspace,actor,offering_id:f.offering,published_revision_id:f.revision,publication:'ADMIN_SYNTHETIC_GENESIS_NOT_PRODUCT_PUBLICATION_PROOF',Request_C03_seeded:0};
}
