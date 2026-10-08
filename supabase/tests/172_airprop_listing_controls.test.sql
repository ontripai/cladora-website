begin;
select plan(33);

select has_table('airprop','market_listing_revisions','revision ledger exists');
select has_function('customer_api','control_airprop_listing_v1',array['uuid','uuid','uuid','text','integer','timestamp with time zone','timestamp with time zone','text','text'],'bounded listing control gateway exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='market_listings' and column_name='version'),'listing version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='market_listings' and column_name='withdrawn_reason'),'withdrawal reason exists');
select is((select relrowsecurity from pg_class where oid='airprop.market_listing_revisions'::regclass),true,'revision ledger RLS is active');
select is((select count(*) from information_schema.role_routine_grants where routine_schema='customer_api' and routine_name='control_airprop_listing_v1' and grantee='authenticated' and privilege_type='EXECUTE'),1::bigint,'authenticated receives explicit gateway execution');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='market_listing_revisions' and grantee in('anon','authenticated','service_role')),0::bigint,'revision ledger has no direct API grants');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='f' and confrelid='airprop.market_listings'::regclass),'revision listing reference is enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='f' and confrelid='auth.users'::regclass),'revision actor reference is enforced');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='market_listing_revisions' and indexname='airprop_market_listing_revisions_listing_idx'),'revision history index exists');
select is((select count(*) from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='u'),2::bigint,'replay and version uniqueness are enforced');
select ok(not has_function_privilege('anon','customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)','EXECUTE'),'anon cannot execute listing controls');
select ok(has_function_privilege('authenticated','customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)','EXECUTE'),'authenticated can execute through the gateway');

insert into auth.users(id,email) values
 ('17200000-0000-4000-8000-000000000001','listing-admin-172@cladora.test'),
 ('17200000-0000-4000-8000-000000000002','listing-outsider-172@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17200000-0000-4000-8000-000000000003','Listing controls tenant','AIRPROP-172','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000003',
  'ASSOCIATION','Listing controls owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17200000-0000-4000-8000-000000000005','17200000-0000-4000-8000-000000000003',
  'condominium','Listing controls property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17200000-0000-4000-8000-000000000006','17200000-0000-4000-8000-000000000003',
  '17200000-0000-4000-8000-000000000005','B172','Listing controls building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17200000-0000-4000-8000-000000000007','17200000-0000-4000-8000-000000000003',
  '17200000-0000-4000-8000-000000000006','U172','active');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000004',
  '17200000-0000-4000-8000-000000000005','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17200000-0000-4000-8000-000000000008','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000003',
  '17200000-0000-4000-8000-000000000008','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000004',p.id,o.id,
 'active',statement_timestamp()-interval '1 day','17200000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000004',id,code,
 'active','Listing controls fixture' from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17200000-0000-4000-8000-000000000004','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17200000-0000-4000-8000-000000000010','17200000-0000-4000-8000-000000000003',
  '17200000-0000-4000-8000-000000000004','listing_manager_172','Listing manager 172','workspace',
  '17200000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000010',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000010',id,'allow'
from identity.permissions where code='airprop.opportunity.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='17200000-0000-4000-8000-000000000010';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000008','17200000-0000-4000-8000-000000000010','workspace',
 '17200000-0000-4000-8000-000000000001','17200000-0000-4000-8000-000000000008',
 'Listing controls assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17200000-0000-4000-8000-000000000011','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000005','17200000-0000-4000-8000-000000000004',
 'investment','synthetic','test://listing-authority-172',statement_timestamp()-interval '1 day');
insert into airprop.investment_opportunities
 (id,tenant_id,property_id,idempotency_key,name,country_code,city,asking_price,currency,status,source_ref,input_hash,created_by)
values('17200000-0000-4000-8000-000000000012','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000005','listing-opportunity-172','Listing opportunity 172','RO','Bucharest',
 100000,'EUR','approved','test://listing-opportunity-172','listing-input-172','17200000-0000-4000-8000-000000000001');
insert into airprop.market_listings
 (id,tenant_id,workspace_id,opportunity_id,property_id,unit_id,kind,status,available_from,available_until,
  published_by,idempotency_key,request_hash)
values('17200000-0000-4000-8000-000000000013','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000012',
 '17200000-0000-4000-8000-000000000005','17200000-0000-4000-8000-000000000007','resale','published',
 '2026-01-01T00:00:00Z','2099-12-31T00:00:00Z','17200000-0000-4000-8000-000000000001',
 'listing-publish-172','listing-publish-hash-172');

select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','edit',1,'2026-02-01T00:00:00Z','2099-11-30T00:00:00Z',
 'Correct the listing availability window.','listing-edit-runtime-172')$$,'authorized edit succeeds');
select ok((select version=2 and status='published' and available_from='2026-02-01T00:00:00Z'
 from airprop.market_listings where id='17200000-0000-4000-8000-000000000013'),'edit updates the expected version and window');
select is((select count(*) from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013'),1::bigint,'edit records one immutable revision');
select is((select count(*) from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action='AIRPROP_LISTING_EDIT'),1::bigint,'edit records one audit event');
select is((select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','edit',1,'2026-02-01T00:00:00Z','2099-11-30T00:00:00Z',
 'Correct the listing availability window.','listing-edit-runtime-172')->>'idempotent'),'true','exact replay returns the prior receipt');
select ok((select count(*)=1 from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=1 from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action like 'AIRPROP_LISTING_%'),
 'exact replay creates no revision or audit side effect');
select throws_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','edit',1,'2026-03-01T00:00:00Z','2099-11-30T00:00:00Z',
 'Changed request content must conflict.','listing-edit-runtime-172')$$,
 '23505','airprop_listing_control_idempotency_conflict','changed request content with the same key conflicts');
select ok((select version=2 and available_from='2026-02-01T00:00:00Z' from airprop.market_listings where id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=1 from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013'),
 'changed replay leaves listing and revision history unchanged');
select throws_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','edit',1,'2026-04-01T00:00:00Z','2099-11-30T00:00:00Z',
 'A stale version must be rejected.','listing-edit-stale-172')$$,
 '23505','airprop_listing_version_conflict','stale version is rejected');
select ok((select version=2 and available_from='2026-02-01T00:00:00Z' from airprop.market_listings where id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=1 from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013'),
 'stale command has no listing or revision side effect');
select lives_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','withdraw',2,null,null,
 'Owner withdrew this market listing.','listing-withdraw-runtime-172')$$,'authorized withdrawal succeeds');
select ok((select version=3 and status='withdrawn' and withdrawn_reason='Owner withdrew this market listing.'
 from airprop.market_listings where id='17200000-0000-4000-8000-000000000013'),'withdrawal updates state and version');
select is((select count(*) from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action='AIRPROP_LISTING_WITHDRAW'),1::bigint,'withdrawal records one audit event');
select lives_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','republish',3,'2026-05-01T00:00:00Z','2099-10-31T00:00:00Z',
 'Owner approved renewed market publication.','listing-republish-runtime-172')$$,'authorized republish succeeds');
select ok((select version=4 and status='published' and withdrawn_reason is null and available_from='2026-05-01T00:00:00Z'
 from airprop.market_listings where id='17200000-0000-4000-8000-000000000013'),'republish updates state, version and window');
select is((select count(*) from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action='AIRPROP_LISTING_REPUBLISH'),1::bigint,'republish records one audit event');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','edit',4,'2026-06-01T00:00:00Z','2099-09-30T00:00:00Z',
 'Unauthorized actor must be rejected.','listing-unauthorized-172')$$,
 '42501','workspace_native_context_access_denied','invalid actor cannot reuse another user context');
select ok((select version=4 and available_from='2026-05-01T00:00:00Z' from airprop.market_listings where id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=3 from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=3 from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action like 'AIRPROP_LISTING_%'),
 'invalid access creates no listing, revision or audit side effect');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17200000-0000-4000-8000-000000000014','17200000-0000-4000-8000-000000000003','person','Applicant 172');
insert into airprop.applicants
 (id,tenant_id,workspace_id,listing_id,party_id,status,submitted_by,idempotency_key,request_hash)
values('17200000-0000-4000-8000-000000000015','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000013',
 '17200000-0000-4000-8000-000000000014','accepted','17200000-0000-4000-8000-000000000001',
 'listing-applicant-172','listing-applicant-hash-172');
insert into airprop.exclusive_reservations
 (id,tenant_id,workspace_id,listing_id,applicant_id,unit_id,status,reserved_from,reserved_until,
  created_by,idempotency_key,request_hash)
values('17200000-0000-4000-8000-000000000016','17200000-0000-4000-8000-000000000003',
 '17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000013',
 '17200000-0000-4000-8000-000000000015','17200000-0000-4000-8000-000000000007','active',
 statement_timestamp()-interval '1 hour','2099-08-31T00:00:00Z','17200000-0000-4000-8000-000000000001',
 'listing-reservation-172','listing-reservation-hash-172');
select throws_ok($$select customer_api.control_airprop_listing_v1(
 '17200000-0000-4000-8000-000000000009','17200000-0000-4000-8000-000000000004',
 '17200000-0000-4000-8000-000000000013','withdraw',4,null,null,
 'Active reservation must block withdrawal.','listing-active-reservation-172')$$,
 '23505','airprop_listing_active_reservation','active reservation blocks withdrawal');
select ok((select version=4 and status='published' from airprop.market_listings where id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=3 from airprop.market_listing_revisions where listing_id='17200000-0000-4000-8000-000000000013')
 and (select count(*)=3 from audit.events where entity_id='17200000-0000-4000-8000-000000000013' and action like 'AIRPROP_LISTING_%'),
 'active-reservation rejection creates no listing, revision or audit side effect');

select * from finish();
rollback;
