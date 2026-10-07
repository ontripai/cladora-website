-- Actual canonical bootstrap, assignment, AIRPROP retry/read and expiry revocation.
begin;
select plan(64);
do $$
declare
  v_tenant_id uuid := '15100000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '15100000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '15100000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '15100000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '15100000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '15100000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '15100000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '15100000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '15100000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '15100000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '15100000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '15100000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '15100000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '15100000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '15100000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '15100000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '15100000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '15100000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '15100000-0000-0000-0000-000010000002'::uuid;
  v_profile_id uuid;
  v_model_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    (v_user_admin_id, 'ws_admin@test.local'),
    (v_user_member_id, 'ws_member@test.local'),
    (v_user_other_id, 'ws_other@test.local')
  on conflict (id) do nothing;

  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_id, 'Test Tenant 135', 'RO-TEST-135-A', 'active'),
    (v_tenant2_id, 'Test Tenant 135 B', 'RO-TEST-135-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 135', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 135 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 135 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 135 B', 'active')
  on conflict (id) do nothing;

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    (v_bld_id, v_tenant_id, v_prop_id, 'BLD-1', 'Building 1', 'active'),
    (v_bld2_id, v_tenant_id, v_prop_id, 'BLD-2', 'Building 2', 'active')
  on conflict (id) do nothing;

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    (v_unit1_id, v_tenant_id, v_bld_id, '101', 'active'),
    (v_unit2_id, v_tenant_id, v_bld_id, '102', 'active')
  on conflict (id) do nothing;

  -- Workspace Property Bindings
  insert into platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source) values
    (v_tenant_id, v_ws_id, v_prop_id, 'active', 'platform_assignment'),
    (v_tenant_id, v_ws2_id, v_prop2_id, 'active', 'platform_assignment')
  on conflict do nothing;

  -- Roles & Memberships
  select id into v_admin_role_id from identity.roles where lower(code) = 'association_admin' and tenant_id is null and is_system = true limit 1;
  select id into v_member_role_id from identity.roles where lower(code) = 'association_admin' and tenant_id is null and is_system = true limit 1;

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_mem_admin_id, v_tenant_id, v_user_admin_id, v_admin_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_target_id, v_tenant_id, v_user_member_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_other_id, v_tenant2_id, v_user_other_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Context Grants
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_ctx_admin_id, v_tenant_id, v_mem_admin_id, 'property', v_prop_id, statement_timestamp() - interval '1 day'),
    (v_ctx_admin_ws2_id, v_tenant_id, v_mem_admin_id, 'property', v_prop2_id, statement_timestamp() - interval '1 day'),
    (v_ctx_member_id, v_tenant_id, v_mem_target_id, 'property', v_prop_id, statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Active Taxonomy Assignment
  select id into v_profile_id from platform.property_profiles where code = 'residential_condominium' and version = 1 limit 1;
  select id into v_model_id from platform.operating_models where code = 'association_managed' and version = 1 limit 1;

  insert into platform.workspace_taxonomy_assignments (
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
  ) values
    (v_tenant_id, v_ws_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_admin_id, 'RO'),
    (v_tenant_id, v_ws2_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_admin_id, 'RO')
  on conflict do nothing;

  -- Active Modules & Entitlements for Maintenance, Documents and Core identity
  insert into platform.workspace_modules (
    tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason
  ) select v_tenant_id, v_ws_id, id, code, 'active', 'Initial test activation'
  from platform.module_definitions where code in ('maintenance', 'documents', 'core_unit_identity')
  on conflict do nothing;

  insert into platform.workspace_entitlements (
    customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
  ) values
    (v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.documents', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.core_unit_identity', 'boolean', true, statement_timestamp() - interval '1 day')
  on conflict do nothing;
end;
$$;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000001000002','tenant',now()-interval '1 day');
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
 select '15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000000000100',id,code,'active','Synthetic AIRPROP flow'
 from platform.module_definitions where code='airprop_commercial';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('15100000-0000-0000-0000-000000000100','module.airprop_commercial','boolean',true,now()-interval '1 day');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('15100000-0000-0000-0000-000000000901','15100000-0000-0000-0000-000000000001',
 '15100000-0000-0000-0000-000000001000','15100000-0000-0000-0000-000000000100',
 'property_operations','synthetic','test://t03-property-mandate',now()-interval '1 day');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select lives_ok($flow$do $$
declare result jsonb; role_id uuid; version integer;
begin
 result=customer_api.create_workspace_role_draft_v1('15100000-0000-0000-0000-000010000001','airprop_diligence_writer','AIRPROP flow reader writer','Synthetic authorized flow','workspace',null,'Synthetic authorized flow','flow_create_151');
 role_id=(result->>'id')::uuid;
 perform customer_api.attach_workspace_role_module_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from platform.module_definitions where code='airprop_commercial'),1,'Synthetic module attachment','flow_module_151');
 perform customer_api.attach_workspace_role_module_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from platform.module_definitions where code='core_unit_identity'),2,'Synthetic Core module attachment','flow_core_module_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.read'),'allow',3,'Synthetic read attachment','flow_read_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.manage'),'allow',4,'Synthetic manage attachment','flow_manage_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.underwriting.manage'),'allow',5,'Synthetic underwriting attachment','flow_underwriting_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.diligence.manage'),'allow',6,'Synthetic diligence attachment','flow_diligence_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.diligence.submit'),'allow',7,'Synthetic submission attachment','flow_submit_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.acquisition.propose'),'allow',8,'Synthetic proposal attachment','flow_propose_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.acquisition.approve'),'allow',9,'Synthetic decision attachment','flow_approve_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.presale.execute'),'allow',10,'Synthetic presale attachment','flow_presale_151');
 perform customer_api.attach_workspace_role_permission_v1('15100000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='core.relationships.execute'),'allow',11,'Synthetic relationship execution attachment','flow_relationship_execute_151');
 perform customer_api.publish_workspace_role_v1('15100000-0000-0000-0000-000010000001',role_id,12,'Synthetic publish role','flow_publish_151');
end; $$;$flow$,'publish role through canonical commands');
select lives_ok($$select customer_api.assign_workspace_role_v1('15100000-0000-0000-0000-000010000001','15100000-0000-0000-0000-000001000002',(select id from platform.workspace_roles where code='airprop_diligence_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic bounded assignment','diligence_assign_151')$$,'assign explicit diligence role');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select lives_ok($$select customer_api.create_airprop_opportunity_v2('15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000000000100','diligence_opportunity_151','{"name":"Synthetic diligence flow","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"100000","property_id":"15100000-0000-0000-0000-000000001000"}')$$,'create native opportunity');
create temporary table diligence_test_response(result jsonb);
select lives_ok($$select customer_api.create_airprop_underwriting_v2('15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='15100000-0000-0000-0000-000000000100'),'diligence_eval_151',0,'{"acquisition_cost":"100000","annual_rent":"8000","annual_opex":"1000","currency":"EUR"}')$$,'evaluate exact baseline');
select lives_ok($$insert into diligence_test_response select customer_api.create_airprop_diligence_draft_v1('15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='15100000-0000-0000-0000-000000000100'),1,'diligence_draft_151')$$,'create exact-version draft through gateway');

-- Canonical Vault verification and trusted scanner attestation; no forged clean client flags.
insert into documents.documents(id,tenant_id,property_id,title,document_type,classification,created_by)
values('15100000-0000-0000-0000-000000000701','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000000001000','Synthetic diligence evidence','legal','internal','15100000-0000-0000-0000-000000000020');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,uploaded_by,created_at)
values('15100000-0000-0000-0000-000000000702','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000000000701',1,'synthetic/diligence-151.txt',repeat('a',64),'text/plain',20,'15100000-0000-0000-0000-000000000020',now()-interval '1 minute');
insert into storage.objects(bucket_id,name)values('document-vault','synthetic/diligence-151.txt');
select lives_ok($$select public.record_document_scan_v1('15100000-0000-0000-0000-000000000702','15100000-0000-0000-0000-000000000703','clean',repeat('a',64),'ClamAV synthetic 149',statement_timestamp())$$,'trusted scanner records actual attestation');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select customer_api.verify_document_evidence_v1('15100000-0000-0000-0000-000010000001','15100000-0000-0000-0000-000000000701','signed_presale','verified','Synthetic independent verification')$$,'independent verifier uses existing Vault gateway');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000020","aal":"aal2"}',true);
create function pg_temp.review_command(p_mode text,p_revision integer,p_key text,p_snapshot jsonb default null) returns jsonb language plpgsql as $$
declare c airprop.diligence_cases;begin
 select * into c from airprop.diligence_cases where tenant_id='15100000-0000-0000-0000-000000000001';
 if p_mode='save' then return customer_api.save_airprop_diligence_revision_v1('15100000-0000-0000-0000-000010000010',c.workspace_id,c.opportunity_id,c.id,'15100000-0000-0000-0000-000010000002',p_revision,p_snapshot,p_key);end if;
 return customer_api.submit_airprop_diligence_review_v1('15100000-0000-0000-0000-000010000010',c.workspace_id,c.opportunity_id,c.id,'15100000-0000-0000-0000-000010000002',p_revision,c.underwriting_version,1,p_key);
end;$$;
create function pg_temp.review_content(p_blocking boolean default false) returns jsonb language sql as $$select jsonb_build_object('checklist',(select jsonb_agg(jsonb_build_object('code',c,'status','satisfied','evidence_version_ids',jsonb_build_array('15100000-0000-0000-0000-000000000702')))from unnest(array['legal','financial','technical'])c),'findings',case when p_blocking then '[{"finding_id":"15100000-0000-0000-0000-000000000710","severity":"blocking","status":"open","summary":"Synthetic blocker","evidence_version_ids":[]}]'::jsonb else '[]'::jsonb end)$$;
select lives_ok($$select pg_temp.review_command('save',1,'review_save_151',pg_temp.review_content(true))$$,'save actual revision and bound evidence');
select is((select count(*) from airprop.diligence_revision_evidence where diligence_case_id=(select id from airprop.diligence_cases where tenant_id='15100000-0000-0000-0000-000000000001')),1::bigint,'one exact immutable evidence link');
select ok(pg_temp.review_command('save',1,'review_save_151',pg_temp.review_content(true))->>'idempotent'='true','retry returns original revision');
select throws_ok($$select pg_temp.review_command('submit',2,'review_submit_blocked_151')$$,'22023','airprop_diligence_not_ready','blocking finding prevents review submission');
select throws_ok($$select pg_temp.review_command('save',2,'review_erase_151',pg_temp.review_content())$$,'22023','airprop_invalid_diligence_snapshot','blocking finding cannot disappear');
select lives_ok($$select pg_temp.review_command('save',2,'review_resolution_151',jsonb_set(pg_temp.review_content(true),'{findings}','[{"finding_id":"15100000-0000-0000-0000-000000000710","severity":"blocking","status":"resolved","summary":"Synthetic blocker","resolution":"Independent remediation proof","evidence_version_ids":["15100000-0000-0000-0000-000000000702"]}]'))$$,'resolve blocker with verified evidence');
select lives_ok($$select pg_temp.review_command('submit',3,'review_submit_151')$$,'submit complete exact revision');
select ok(pg_temp.review_command('submit',3,'review_submit_151')->>'idempotent'='true','exact submission retry');
select is((select count(*) from airprop.diligence_submissions where diligence_case_id=(select id from airprop.diligence_cases where tenant_id='15100000-0000-0000-0000-000000000001')),1::bigint,'single immutable submission');
select is((select status from airprop.investment_opportunities where workspace_id='15100000-0000-0000-0000-000000000100'),'underwriting','submission does not approve opportunity');
select throws_ok($$select pg_temp.review_command('save',3,'review_after_submit_151',pg_temp.review_content(true))$$,'22023','airprop_diligence_revision_conflict','submitted revision cannot be overwritten');
select throws_ok($$delete from airprop.diligence_revisions$$,'22023','airprop_diligence_review_immutable','review history is immutable');
select throws_ok($$delete from documents.document_versions where id='15100000-0000-0000-0000-000000000702'$$,'55000','document_versions_are_immutable','evidence source retains Vault immutability');
select ok(not has_table_privilege('authenticated','airprop.diligence_revision_evidence','SELECT'),'customer cannot read evidence bindings directly');
select ok(not has_table_privilege('service_role','airprop.diligence_submissions','INSERT'),'service role cannot directly insert review submission');
select is((select count(*) from audit.events where tenant_id='15100000-0000-0000-0000-000000000001' and action='AIRPROP_DILIGENCE_REVIEW_SUBMITTED'),1::bigint,'one submission audit event');
select is((select count(*) from platform.outbox_events where tenant_id='15100000-0000-0000-0000-000000000001' and event_type='airprop.diligence.review_submitted.v1'),1::bigint,'one submission outbox event');

-- Additional independent reviewer uses the same canonical role composition and bounded assignment.
insert into auth.users(id,email) values('15100000-0000-0000-0000-000000000040','independent_reviewer@test.local');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '15100000-0000-0000-0000-000001000004','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000000000040',role_id,'active',now()-interval '1 day' from identity.memberships where id='15100000-0000-0000-0000-000001000001';
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('15100000-0000-0000-0000-000010000004','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000001000004','property','15100000-0000-0000-0000-000000001000',now()-interval '1 day'),
 ('15100000-0000-0000-0000-000010000011','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000001000001','tenant',null,now()-interval '1 day'),
 ('15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000000000001','15100000-0000-0000-0000-000001000004','tenant',null,now()-interval '1 day');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select customer_api.assign_workspace_role_v1('15100000-0000-0000-0000-000010000001','15100000-0000-0000-0000-000001000001',(select id from platform.workspace_roles where code='airprop_diligence_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic independent review','review_admin_assign_151')$$,'assign first reviewer through canonical gateway');
select lives_ok($$select customer_api.assign_workspace_role_v1('15100000-0000-0000-0000-000010000001','15100000-0000-0000-0000-000001000004',(select id from platform.workspace_roles where code='airprop_diligence_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic independent review','review_second_assign_151')$$,'assign second reviewer through canonical gateway');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000020","aal":"aal2"}',true);
create temporary table acquisition_test_response(payload jsonb);
create function pg_temp.acquisition_command(p_mode text,p_context uuid,p_document_context uuid,p_revision integer,p_key text,p_decision text default 'approve') returns jsonb language plpgsql as $$
declare c airprop.diligence_cases; s airprop.diligence_submissions; p airprop.acquisition_proposals;
begin
 select * into c from airprop.diligence_cases where id=(select (result->>'diligence_case_id')::uuid from diligence_test_response limit 1);
 select * into s from airprop.diligence_submissions where diligence_case_id=c.id;
 if p_mode='propose' then return customer_api.propose_airprop_acquisition_v1(p_context,c.workspace_id,c.opportunity_id,c.id,p_document_context,s.id,s.revision,c.underwriting_version,'Synthetic internal acquisition proposal',p_key);end if;
 select * into p from airprop.acquisition_proposals where diligence_case_id=c.id;
 if p_mode='read' then return customer_api.get_airprop_acquisition_v1(p_context,c.workspace_id,c.opportunity_id,c.id,p_document_context);end if;
 return customer_api.decide_airprop_acquisition_v1(p_context,c.workspace_id,c.opportunity_id,c.id,p_document_context,p.id,p_revision,p_decision,'Synthetic independent decision',p_key);
end;$$;
select lives_ok($$insert into acquisition_test_response select pg_temp.acquisition_command('propose','15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000010000002',1,'acquisition_propose_151')$$,'propose exact submitted baseline');
select ok(pg_temp.acquisition_command('propose','15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000010000002',1,'acquisition_propose_151')->>'idempotent'='true','proposal replay');
select throws_ok($$select pg_temp.acquisition_command('propose','15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000010000002',1,'duplicate_propose_151')$$,'22023','airprop_acquisition_proposal_conflict','baseline cannot duplicate proposal');
select throws_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000010','15100000-0000-0000-0000-000010000002',1,'self_approve_151')$$,'42501','airprop_acquisition_independence_required','proposer and preparer cannot approve');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000011','15100000-0000-0000-0000-000010000001',1,'first_approve_151')$$,'first independent actual gateway approval');
select is(pg_temp.acquisition_command('read','15100000-0000-0000-0000-000010000011','15100000-0000-0000-0000-000010000001',1,'unused')->'proposal'->>'status','pending','one approval is insufficient');
select throws_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000011','15100000-0000-0000-0000-000010000001',2,'same_actor_again_151')$$,'42501','airprop_acquisition_independence_required','one person cannot supply both approvals');
select ok(pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000011','15100000-0000-0000-0000-000010000001',1,'first_approve_151')->>'idempotent'='true','first approval replay');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000040","aal":"aal2"}',true);
select throws_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000010000004',1,'stale_approve_151')$$,'22023','airprop_acquisition_decision_conflict','stale optimistic version cannot decide');
select lives_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000010000004',2,'second_approve_151')$$,'second independent actual gateway approval');
select is(pg_temp.acquisition_command('read','15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000010000004',1,'unused')->'proposal'->>'status','internally_approved','two distinct approvals complete internal decision');
select is((select count(*) from airprop.acquisition_decisions where proposal_id=(select (payload->>'proposal_id')::uuid from acquisition_test_response)),2::bigint,'two append-only decisions');
select is((select status from airprop.investment_opportunities where workspace_id='15100000-0000-0000-0000-000000000100'),'underwriting','internal decision does not execute or approve opportunity');
select ok(pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000010000004',2,'second_approve_151')->>'idempotent'='true','terminal exact replay');

-- T03: independently reviewed signed presale creates only a contractual-buyer fact.
insert into portfolio.parties(id,tenant_id,type,legal_name)
values('15100000-0000-0000-0000-000000000801','15100000-0000-0000-0000-000000000001','person','Synthetic presale buyer');
insert into portfolio.relationship_proposals(
 id,tenant_id,property_id,unit_id,customer_workspace_id,kind,target_party_id,
 effective_from,evidence_reference,reason,proposed_by,request_id,idempotency_key,request_hash)
values('15100000-0000-0000-0000-000000000802','15100000-0000-0000-0000-000000000001',
 '15100000-0000-0000-0000-000000001000','15100000-0000-0000-0000-000000100001',
 '15100000-0000-0000-0000-000000000100','contractual_buyer',
 '15100000-0000-0000-0000-000000000801',current_date,
 'urn:cladora:document-version:15100000-0000-0000-0000-000000000702',
 'Synthetic signed presale proposal','15100000-0000-0000-0000-000000000020',
 '15100000-0000-0000-0000-000000000803','t03-proposal-151',repeat('a',64));
insert into portfolio.relationship_reviews(
 id,proposal_id,tenant_id,decision,evidence_reference,reason,reviewed_by,
 request_id,idempotency_key,request_hash)
values('15100000-0000-0000-0000-000000000804','15100000-0000-0000-0000-000000000802',
 '15100000-0000-0000-0000-000000000001','verified',
 'urn:cladora:document-version:15100000-0000-0000-0000-000000000702',
 'Independent signed presale verification','15100000-0000-0000-0000-000000000010',
 '15100000-0000-0000-0000-000000000805','t03-review-151',repeat('b',64));
create function pg_temp.activate_t03(p_signed_on date,p_key text) returns jsonb language sql as $$
 select customer_api.activate_airprop_contractual_buyer_v1(
  '15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000000000100',
  '15100000-0000-0000-0000-000000001000',
  (select id from airprop.investment_opportunities where workspace_id='15100000-0000-0000-0000-000000000100'),
  '15100000-0000-0000-0000-000000000802','15100000-0000-0000-0000-000010000004',
  '15100000-0000-0000-0000-000000000702',p_signed_on,current_date,p_key)
$$;
select lives_ok($$select pg_temp.activate_t03(current_date,'activate-t03-151')$$,
 'verified signed presale activates contractual buyer');
select is(pg_temp.activate_t03(current_date,'activate-t03-151')->>'status','contractual_buyer',
 'receipt identifies purpose-limited relationship');
select is(pg_temp.activate_t03(current_date,'activate-t03-151')->>'idempotent','true',
 'exact T03 replay returns original receipt');
select throws_ok($$select pg_temp.activate_t03(current_date-1,'activate-t03-151')$$,
 '23505','airprop_presale_idempotency_conflict','changed T03 replay conflicts');
select is((select count(*) from airprop.presale_contracts where relationship_proposal_id=
 '15100000-0000-0000-0000-000000000802'),1::bigint,'one immutable presale contract');
select is((select count(*) from portfolio.contractual_buyer_relationships where unit_id=
 '15100000-0000-0000-0000-000000100001'),1::bigint,'one contractual-buyer relationship');
select is((select count(*) from portfolio.ownerships where unit_id=
 '15100000-0000-0000-0000-000000100001'),0::bigint,'presale grants no title');
select is((select count(*) from occupancy.leases where unit_id=
 '15100000-0000-0000-0000-000000100001'),0::bigint,'presale grants no tenancy');
select is((select count(*) from communications.unit_invitations where unit_id=
 '15100000-0000-0000-0000-000000100001'),0::bigint,'presale sends no owner invitation');
select is((select count(*) from platform.owner_unit_links where canonical_unit_id=
 '15100000-0000-0000-0000-000000100001'),0::bigint,'presale creates no owner account link');
select is((select count(*) from identity.membership_parties where party_id=
 '15100000-0000-0000-0000-000000000801'),0::bigint,'buyer receives no account-party authority');
select ok(not has_table_privilege('authenticated','airprop.presale_contracts','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('service_role','portfolio.contractual_buyer_relationships','INSERT'),
 'presale and relationship tables stay behind the gateway');
select throws_ok($$delete from airprop.presale_contracts where relationship_proposal_id=
 '15100000-0000-0000-0000-000000000802'$$,'55000','contractual_buyer_history_immutable',
 'presale history is immutable');
select throws_ok($$update portfolio.contractual_buyer_relationships set valid_to=current_date+1
 where unit_id='15100000-0000-0000-0000-000000100001'$$,'55000',
 'contractual_buyer_history_immutable','relationship history is immutable');
select is((select count(*) from audit.events where tenant_id='15100000-0000-0000-0000-000000000001'
 and action='AIRPROP_PRESALE_ACTIVATED'),1::bigint,'one T03 audit event');
select is((select count(*) from platform.outbox_events where tenant_id='15100000-0000-0000-0000-000000000001'
 and event_type='core.relationship.contractual_buyer_activated.v1'),1::bigint,'one T03 outbox event');
select throws_ok($$delete from airprop.acquisition_proposals where tenant_id='15100000-0000-0000-0000-000000000001'$$,'22023','airprop_acquisition_decision_immutable','proposal history cannot be deleted');
select throws_ok($$update airprop.acquisition_decisions set decision='reject' where proposal_id=(select (payload->>'proposal_id')::uuid from acquisition_test_response)$$,'22023','airprop_acquisition_decision_immutable','decision cannot be changed');
select ok(not has_table_privilege('authenticated','airprop.acquisition_decisions','SELECT,INSERT,UPDATE,DELETE'),'customer tables closed');
select ok(not has_table_privilege('service_role','airprop.acquisition_proposals','INSERT'),'service-role cannot bypass proposal gateway');
select ok(not has_function_privilege('authenticated','app_private.airprop_acquisition_independent_v1(uuid)','EXECUTE'),'private independence helper closed');
select is((select count(*) from audit.events where tenant_id='15100000-0000-0000-0000-000000000001' and action='AIRPROP_ACQUISITION_DECISION_RECORDED'),2::bigint,'one audit per independent vote');
select is((select count(*) from platform.outbox_events where tenant_id='15100000-0000-0000-0000-000000000001' and event_type='airprop.acquisition.decision_recorded.v1'),2::bigint,'one event per independent vote');
select set_config('request.jwt.claims','{"sub":"15100000-0000-0000-0000-000000000040","aal":"aal1"}',true);
select throws_ok($$select pg_temp.acquisition_command('decide','15100000-0000-0000-0000-000010000014','15100000-0000-0000-0000-000010000004',2,'second_approve_151')$$,'42501','mfa_required','AAL2 required even for historical replay');
select * from finish();
rollback;
