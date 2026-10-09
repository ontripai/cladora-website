begin;
select plan(33);

select has_table('airprop','management_mandate_requests','AP06 mandate request receipt exists');
select has_function('customer_api','request_airprop_management_mandate_v1',
 array['uuid','uuid','uuid','uuid','jsonb','date','date','text','text'],'bounded request RPC exists');
select has_function('customer_api','accept_airprop_management_mandate_v1',
 array['uuid','uuid','uuid','text','text'],'bounded acceptance RPC exists');
select is((select relrowsecurity from pg_class where oid='airprop.management_mandate_requests'::regclass),true,
 'mandate receipts use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop'
 and table_name='management_mandate_requests' and grantee in('anon','authenticated','service_role')),0::bigint,
 'no API role has direct table grants');
select ok(has_function_privilege('authenticated',
 'customer_api.request_airprop_management_mandate_v1(uuid,uuid,uuid,uuid,jsonb,date,date,text,text)','EXECUTE'),
 'authenticated may execute request gateway');
select ok(not has_function_privilege('anon',
 'customer_api.request_airprop_management_mandate_v1(uuid,uuid,uuid,uuid,jsonb,date,date,text,text)','EXECUTE'),
 'anon cannot execute request gateway');
select ok(has_function_privilege('authenticated',
 'customer_api.accept_airprop_management_mandate_v1(uuid,uuid,uuid,text,text)','EXECUTE'),
 'authenticated may execute acceptance gateway');
select ok(not has_function_privilege('anon',
 'customer_api.accept_airprop_management_mandate_v1(uuid,uuid,uuid,text,text)','EXECUTE'),
 'anon cannot execute acceptance gateway');

insert into auth.users(id,email) values
 ('17700000-0000-4000-8000-000000000001','mandate-requester-177@cladora.test'),
 ('17700000-0000-4000-8000-000000000002','mandate-acceptor-177@cladora.test'),
 ('17700000-0000-4000-8000-000000000003','mandate-outsider-177@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17700000-0000-4000-8000-000000000004','Mandate tenant 177','AIRPROP-177','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17700000-0000-4000-8000-000000000005','17700000-0000-4000-8000-000000000004',
  'ASSOCIATION','Mandate owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000004',
  'condominium','Mandate property 177','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17700000-0000-4000-8000-000000000007','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000006','B177','Mandate building 177','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17700000-0000-4000-8000-000000000008','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000007','U177','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17700000-0000-4000-8000-000000000009','17700000-0000-4000-8000-000000000004','person','Owner 177'),
 ('17700000-0000-4000-8000-000000000010','17700000-0000-4000-8000-000000000004','person','Non-owner 177');
insert into portfolio.ownerships(id,tenant_id,unit_id,party_id,share,valid_from) values
 ('17700000-0000-4000-8000-000000000011','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000008','17700000-0000-4000-8000-000000000009',1,'2026-01-01');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000005',
  '17700000-0000-4000-8000-000000000006','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select x.membership_id,'17700000-0000-4000-8000-000000000004',x.user_id,r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r cross join(values
 ('17700000-0000-4000-8000-000000000012'::uuid,'17700000-0000-4000-8000-000000000001'::uuid),
 ('17700000-0000-4000-8000-000000000013'::uuid,'17700000-0000-4000-8000-000000000002'::uuid)
) x(membership_id,user_id) where r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000012','tenant',statement_timestamp()-interval '1 day'),
 ('17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000013','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000005',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17700000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000005',
 id,code,'active','Mandate fixture' from platform.module_definitions
where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17700000-0000-4000-8000-000000000005','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17700000-0000-4000-8000-000000000016','17700000-0000-4000-8000-000000000004',
  '17700000-0000-4000-8000-000000000005','mandate_manager_177','Mandate manager 177','workspace',
  '17700000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000016',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000016',id,'allow'
from identity.permissions where code='airprop.asset.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='17700000-0000-4000-8000-000000000016';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values
 ('17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000005',
  '17700000-0000-4000-8000-000000000012','17700000-0000-4000-8000-000000000016','workspace',
  '17700000-0000-4000-8000-000000000001','17700000-0000-4000-8000-000000000012',
  'Mandate requester assignment',statement_timestamp()-interval '1 hour'),
 ('17700000-0000-4000-8000-000000000004','17700000-0000-4000-8000-000000000005',
  '17700000-0000-4000-8000-000000000013','17700000-0000-4000-8000-000000000016','workspace',
  '17700000-0000-4000-8000-000000000001','17700000-0000-4000-8000-000000000012',
  'Mandate acceptor assignment',statement_timestamp()-interval '1 hour');

select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009','{"capabilities":[]}',
 '2026-11-01','2027-11-01','urn:proposal:177','mandate-invalid-scope-177')$$,
 '22023','airprop_management_mandate_invalid','empty scope is rejected');
select throws_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009','{"capabilities":["listing"]}',
 '2027-11-01','2026-11-01','urn:proposal:177','mandate-invalid-period-177')$$,
 '22023','airprop_management_mandate_invalid','invalid duration is rejected');
select throws_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000010','{"capabilities":["listing"]}',
 '2026-11-01','2027-11-01','urn:proposal:177','mandate-owner-mismatch-177')$$,
 '22023','airprop_management_owner_mismatch','non-owner request is rejected');
select lives_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009',
 '{"capabilities":["listing","owner_reporting"],"notes":"Bounded owner services"}',
 '2026-11-01','2027-11-01','urn:proposal:mandate-177','mandate-request-create-177')$$,
 'authorized mandate request succeeds');
select ok((select status='requested' and valid_from='2026-11-01' and valid_to='2027-11-01'
 and scope->'capabilities'='["listing","owner_reporting"]'::jsonb
 from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'request persists exact scope and duration');
select is((select count(*) from audit.events where tenant_id='17700000-0000-4000-8000-000000000004'
 and action='AIRPROP_MANAGEMENT_MANDATE_REQUESTED'),1::bigint,'request uses shared audit');
select ok((select count(*)=0 from platform.workspace_property_authorities where tenant_id='17700000-0000-4000-8000-000000000004')
 and (select count(*)=0 from airprop.commercial_execution_links where tenant_id='17700000-0000-4000-8000-000000000004'
  and kind='management_mandate'),'request creates no software authority or execution link');
select is((customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009',
 '{"capabilities":["listing","owner_reporting"],"notes":"Bounded owner services"}',
 '2026-11-01','2027-11-01','urn:proposal:mandate-177','mandate-request-create-177')->>'idempotent')::boolean,
 true,'exact request replay is idempotent');
select throws_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009',
 '{"capabilities":["maintenance_coordination"]}','2026-11-01','2027-11-01',
 'urn:proposal:mandate-177','mandate-request-create-177')$$,
 '23505','airprop_management_mandate_idempotency_conflict','changed request replay conflicts');
select throws_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:mandate-177','mandate-accept-create-177')$$,
 '42501','airprop_management_mandate_self_acceptance_denied','requester cannot self-accept');

select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:mandate-177','mandate-accept-outsider-177')$$,
 '42501','workspace_native_context_access_denied','outsider cannot accept or replay');

select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:mandate-177','mandate-accept-create-177')$$,'independent acceptance succeeds');
select ok((select status='accepted' and accepted_by='17700000-0000-4000-8000-000000000002'
 and acceptance_evidence_reference='urn:acceptance:mandate-177'
 from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'acceptance receipt identifies independent recorder and evidence');
select is((select count(*) from audit.events where tenant_id='17700000-0000-4000-8000-000000000004'
 and action='AIRPROP_MANAGEMENT_MANDATE_ACCEPTED'),1::bigint,'acceptance uses shared audit');
select ok((select count(*)=0 from platform.workspace_property_authorities where tenant_id='17700000-0000-4000-8000-000000000004')
 and (select count(*)=2 from platform.workspace_member_roles where tenant_id='17700000-0000-4000-8000-000000000004')
 and (select count(*)=0 from airprop.commercial_execution_links where tenant_id='17700000-0000-4000-8000-000000000004'
  and kind='management_mandate'),'acceptance creates no authority, role or execution link');
select is((customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:mandate-177','mandate-accept-create-177')->>'idempotent')::boolean,true,
 'exact acceptance replay is idempotent');
select throws_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:changed-177','mandate-accept-create-177')$$,
 '23505','airprop_management_mandate_idempotency_conflict','changed acceptance replay conflicts');
select throws_ok($$update airprop.management_mandate_requests set scope='{"capabilities":["listing"]}'
 where request_idempotency_key='mandate-request-create-177'$$,
 '42501','airprop_management_mandate_immutable','accepted scope is immutable');
select throws_ok($$delete from airprop.management_mandate_requests
 where request_idempotency_key='mandate-request-create-177'$$,
 '42501','airprop_management_mandate_immutable','accepted receipt cannot be deleted');

select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.request_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000014','17700000-0000-4000-8000-000000000005',
 '17700000-0000-4000-8000-000000000006','17700000-0000-4000-8000-000000000009',
 '{"capabilities":["maintenance_coordination"]}','2027-01-01','2027-12-01',
 'urn:proposal:overlap-177','mandate-request-overlap-177')$$,'overlapping proposal may be recorded for review');
select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-overlap-177'),
 'urn:acceptance:overlap-177','mandate-accept-overlap-177')$$,
 '23505','airprop_management_mandate_conflict','overlapping accepted mandate is rejected under property lock');
select ok((select status='requested' from airprop.management_mandate_requests
 where request_idempotency_key='mandate-request-overlap-177')
 and (select count(*)=0 from platform.workspace_property_authorities where tenant_id='17700000-0000-4000-8000-000000000004'),
 'conflict leaves proposal pending and creates no authority');

select set_config('request.jwt.claims','{"sub":"17700000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.accept_airprop_management_mandate_v1(
 '17700000-0000-4000-8000-000000000015','17700000-0000-4000-8000-000000000005',
 (select id from airprop.management_mandate_requests where request_idempotency_key='mandate-request-create-177'),
 'urn:acceptance:mandate-177','mandate-accept-create-177')$$,
 '42501','workspace_native_context_access_denied','exact replay reauthorizes and denies outsider');
select is((select count(*) from airprop.management_mandate_requests where tenant_id='17700000-0000-4000-8000-000000000004'
 and status='accepted'),1::bigint,'accepted evidence persists after denied replay and conflict');

select * from finish();
rollback;
