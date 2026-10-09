begin;
select plan(39);

select has_table('airprop','reservation_revisions','reservation revision ledger exists');
select has_function('customer_api','control_airprop_reservation_v1',array['uuid','uuid','uuid','text','integer','timestamp with time zone','text','text','text'],'bounded reservation control gateway exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='version'),'reservation version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='conversion_kind'),'bounded conversion kind exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='conversion_reference'),'conversion receipt reference exists');
select is((select relrowsecurity from pg_class where oid='airprop.reservation_revisions'::regclass),true,'revision ledger RLS is active');
select is((select count(*) from information_schema.role_routine_grants where routine_schema='customer_api' and routine_name='control_airprop_reservation_v1' and grantee='authenticated' and privilege_type='EXECUTE'),1::bigint,'authenticated receives explicit gateway execution');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='reservation_revisions' and grantee in('anon','authenticated','service_role')),0::bigint,'revision ledger has no direct API grants');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='f' and confrelid='airprop.exclusive_reservations'::regclass),'revision reservation reference is enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='f' and confrelid='auth.users'::regclass),'revision actor reference is enforced');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='reservation_revisions' and indexname='airprop_reservation_revisions_reservation_idx'),'revision history index exists');
select is((select count(*) from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='u'),2::bigint,'replay and version uniqueness are enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.exclusive_reservations'::regclass and contype='x'),'single-winner exclusion remains enforced');
select ok(not has_function_privilege('anon','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'anon cannot execute reservation controls');
select ok(not has_function_privilege('service_role','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'service role cannot bypass reservation controls');
select ok(has_function_privilege('authenticated','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'authenticated can execute through the gateway');

insert into auth.users(id,email) values
 ('17300000-0000-4000-8000-000000000001','reservation-admin-173@cladora.test'),
 ('17300000-0000-4000-8000-000000000002','reservation-outsider-173@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17300000-0000-4000-8000-000000000003','Reservation controls tenant','AIRPROP-173','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000003','ASSOCIATION','Reservation controls owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000003','condominium','Reservation controls property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17300000-0000-4000-8000-000000000006','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000005','B173','Reservation controls building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17300000-0000-4000-8000-000000000007','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000006','U173-A','active'),
 ('17300000-0000-4000-8000-000000000008','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000006','U173-B','active'),
 ('17300000-0000-4000-8000-000000000009','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000006','U173-C','active'),
 ('17300000-0000-4000-8000-000000000010','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000006','U173-D','active');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000005','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17300000-0000-4000-8000-000000000011','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000011','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004',p.id,o.id,'active',statement_timestamp()-interval '1 day','17300000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004',id,code,'active','Reservation controls fixture'
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17300000-0000-4000-8000-000000000004','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17300000-0000-4000-8000-000000000013','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','reservation_manager_173','Reservation manager 173','workspace','17300000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000013',id from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000013',id,'allow' from identity.permissions where code='airprop.opportunity.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2 where id='17300000-0000-4000-8000-000000000013';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000011','17300000-0000-4000-8000-000000000013','workspace','17300000-0000-4000-8000-000000000001','17300000-0000-4000-8000-000000000011','Reservation controls assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17300000-0000-4000-8000-000000000014','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000004','investment','synthetic','test://reservation-authority-173',statement_timestamp()-interval '1 day');
insert into airprop.investment_opportunities
 (id,tenant_id,property_id,idempotency_key,name,country_code,city,asking_price,currency,status,source_ref,input_hash,created_by)
values('17300000-0000-4000-8000-000000000015','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000005','reservation-opportunity-173','Reservation opportunity 173','RO','Bucharest',100000,'EUR','approved','test://reservation-opportunity-173','reservation-input-173','17300000-0000-4000-8000-000000000001');
insert into airprop.market_listings
 (id,tenant_id,workspace_id,opportunity_id,property_id,unit_id,kind,status,available_from,available_until,published_by,idempotency_key,request_hash)
values
 ('17300000-0000-4000-8000-000000000016','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000015','17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000007','resale','reserved',statement_timestamp()-interval '2 days',statement_timestamp()+interval '30 days','17300000-0000-4000-8000-000000000001','reservation-listing-a-173','reservation-listing-hash-a-173'),
 ('17300000-0000-4000-8000-000000000017','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000015','17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000008','resale','reserved',statement_timestamp()-interval '2 days',statement_timestamp()+interval '30 days','17300000-0000-4000-8000-000000000001','reservation-listing-b-173','reservation-listing-hash-b-173'),
 ('17300000-0000-4000-8000-000000000018','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000015','17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000009','resale','reserved',statement_timestamp()-interval '5 days',statement_timestamp()+interval '30 days','17300000-0000-4000-8000-000000000001','reservation-listing-c-173','reservation-listing-hash-c-173'),
 ('17300000-0000-4000-8000-000000000019','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000015','17300000-0000-4000-8000-000000000005','17300000-0000-4000-8000-000000000010','lease','reserved',statement_timestamp()-interval '2 days',statement_timestamp()+interval '30 days','17300000-0000-4000-8000-000000000001','reservation-listing-d-173','reservation-listing-hash-d-173');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17300000-0000-4000-8000-000000000020','17300000-0000-4000-8000-000000000003','person','Applicant A 173'),
 ('17300000-0000-4000-8000-000000000021','17300000-0000-4000-8000-000000000003','person','Applicant B 173'),
 ('17300000-0000-4000-8000-000000000022','17300000-0000-4000-8000-000000000003','person','Applicant C 173'),
 ('17300000-0000-4000-8000-000000000023','17300000-0000-4000-8000-000000000003','person','Applicant D 173'),
 ('17300000-0000-4000-8000-000000000024','17300000-0000-4000-8000-000000000003','person','Competing applicant 173');
insert into airprop.applicants
 (id,tenant_id,workspace_id,listing_id,party_id,status,submitted_by,idempotency_key,request_hash)
values
 ('17300000-0000-4000-8000-000000000025','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000016','17300000-0000-4000-8000-000000000020','accepted','17300000-0000-4000-8000-000000000001','reservation-applicant-a-173','reservation-applicant-hash-a-173'),
 ('17300000-0000-4000-8000-000000000026','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000017','17300000-0000-4000-8000-000000000021','accepted','17300000-0000-4000-8000-000000000001','reservation-applicant-b-173','reservation-applicant-hash-b-173'),
 ('17300000-0000-4000-8000-000000000027','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000018','17300000-0000-4000-8000-000000000022','accepted','17300000-0000-4000-8000-000000000001','reservation-applicant-c-173','reservation-applicant-hash-c-173'),
 ('17300000-0000-4000-8000-000000000028','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000019','17300000-0000-4000-8000-000000000023','accepted','17300000-0000-4000-8000-000000000001','reservation-applicant-d-173','reservation-applicant-hash-d-173'),
 ('17300000-0000-4000-8000-000000000029','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000019','17300000-0000-4000-8000-000000000024','active','17300000-0000-4000-8000-000000000001','reservation-applicant-e-173','reservation-applicant-hash-e-173');
insert into airprop.exclusive_reservations
 (id,tenant_id,workspace_id,listing_id,applicant_id,unit_id,status,reserved_from,reserved_until,created_by,idempotency_key,request_hash)
values
 ('17300000-0000-4000-8000-000000000030','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000016','17300000-0000-4000-8000-000000000025','17300000-0000-4000-8000-000000000007','active',statement_timestamp()-interval '1 day',statement_timestamp()+interval '2 days','17300000-0000-4000-8000-000000000001','reservation-runtime-a-173','reservation-runtime-hash-a-173'),
 ('17300000-0000-4000-8000-000000000031','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000017','17300000-0000-4000-8000-000000000026','17300000-0000-4000-8000-000000000008','active',statement_timestamp()-interval '1 day',statement_timestamp()+interval '2 days','17300000-0000-4000-8000-000000000001','reservation-runtime-b-173','reservation-runtime-hash-b-173'),
 ('17300000-0000-4000-8000-000000000032','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000018','17300000-0000-4000-8000-000000000027','17300000-0000-4000-8000-000000000009','active',statement_timestamp()-interval '4 days',statement_timestamp()-interval '1 day','17300000-0000-4000-8000-000000000001','reservation-runtime-c-173','reservation-runtime-hash-c-173'),
 ('17300000-0000-4000-8000-000000000033','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000019','17300000-0000-4000-8000-000000000028','17300000-0000-4000-8000-000000000010','active',statement_timestamp()-interval '1 day',statement_timestamp()+interval '2 days','17300000-0000-4000-8000-000000000001','reservation-runtime-d-173','reservation-runtime-hash-d-173');

select set_config('request.jwt.claims','{"sub":"17300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$insert into airprop.exclusive_reservations
 (id,tenant_id,workspace_id,listing_id,applicant_id,unit_id,status,reserved_from,reserved_until,created_by,idempotency_key,request_hash)
 values('17300000-0000-4000-8000-000000000034','17300000-0000-4000-8000-000000000003','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000016','17300000-0000-4000-8000-000000000025','17300000-0000-4000-8000-000000000007','active',statement_timestamp(),statement_timestamp()+interval '1 day','17300000-0000-4000-8000-000000000001','reservation-race-173','reservation-race-hash-173')$$,
 '23P01',null,'single-winner exclusion rejects an overlapping active reservation');
select lives_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','extend',1,'2026-10-20T00:00:00Z',null,'Extend the reservation after applicant confirmation.','reservation-extend-173')$$,'authorized extension succeeds');
select ok((select version=2 and status='active' and reserved_until>statement_timestamp()+interval '2 days' from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000030')
 and (select status='reserved' from airprop.market_listings where id='17300000-0000-4000-8000-000000000016')
 and (select status='accepted' from airprop.applicants where id='17300000-0000-4000-8000-000000000025'),'extension advances version and preserves reserved listing and accepted applicant');
select ok((select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000030') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000030' and action='AIRPROP_RESERVATION_EXTEND'),'extension records one revision and audit event');
select is((select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','extend',1,'2026-10-20T00:00:00Z',null,'Extend the reservation after applicant confirmation.','reservation-extend-173')->>'idempotent'),'true','exact replay returns prior receipt');
select ok((select version=2 from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000030') and (select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000030') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000030' and action like 'AIRPROP_RESERVATION_%'),'replay creates no duplicate side effect');
select throws_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','extend',1,'2026-10-21T00:00:00Z',null,'Changed extension payload must conflict.','reservation-extend-173')$$,'23505','airprop_reservation_control_idempotency_conflict','changed payload with same key conflicts');
select ok((select version=2 from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000030')
 and (select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000030'),'changed replay leaves reservation and revision history unchanged');
select throws_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','cancel',1,null,null,'Stale reservation version must be rejected.','reservation-stale-173')$$,'23505','airprop_reservation_version_conflict','stale version is rejected');
select throws_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','cancel',null,null,null,'Missing expected version must be rejected.','reservation-null-version-173')$$,'22023','airprop_reservation_control_invalid','null expected version is rejected');
select ok((select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000030' and action like 'AIRPROP_RESERVATION_%'),'stale and invalid commands create no audit event');
select set_config('request.jwt.claims','{"sub":"17300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000030','cancel',2,null,null,'Unauthorized actor must be rejected.','reservation-unauthorized-173')$$,'42501','workspace_native_context_access_denied','invalid actor cannot reuse context');
select ok((select version=2 and status='active' from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000030') and (select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000030') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000030' and action like 'AIRPROP_RESERVATION_%'),'rejected commands create no side effect');
select set_config('request.jwt.claims','{"sub":"17300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000031','cancel',1,null,null,'Cancel reservation at applicant request.','reservation-cancel-173')$$,'authorized cancellation succeeds');
select ok((select version=2 and status='cancelled' and ended_reason='cancel' from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000031') and (select status='published' from airprop.market_listings where id='17300000-0000-4000-8000-000000000017') and (select status='active' from airprop.applicants where id='17300000-0000-4000-8000-000000000026'),'cancellation reopens listing and applicant');
select ok((select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000031' and action='cancel') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000031' and action='AIRPROP_RESERVATION_CANCEL'),'cancellation records revision and audit');
select lives_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000032','expire',1,null,null,'Record reservation expiry after its deadline.','reservation-expire-173')$$,'authorized expiry succeeds');
select ok((select version=2 and status='expired' and ended_reason='expire' from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000032') and (select status='published' from airprop.market_listings where id='17300000-0000-4000-8000-000000000018') and (select status='active' from airprop.applicants where id='17300000-0000-4000-8000-000000000027'),'expiry reopens listing and applicant');
select ok((select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000032' and action='expire') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000032' and action='AIRPROP_RESERVATION_EXPIRE'),'expiry records revision and audit');
select lives_ok($$select customer_api.control_airprop_reservation_v1(
 '17300000-0000-4000-8000-000000000012','17300000-0000-4000-8000-000000000004','17300000-0000-4000-8000-000000000033','convert',1,null,'test://lease-handoff-173','Convert reservation to bounded lease handoff.','reservation-convert-173')$$,'authorized conversion succeeds');
select ok((select version=2 and status='converted' and conversion_kind='lease' and conversion_reference='test://lease-handoff-173' from airprop.exclusive_reservations where id='17300000-0000-4000-8000-000000000033') and (select status='completed' from airprop.market_listings where id='17300000-0000-4000-8000-000000000019'),'conversion completes listing with typed handoff');
select ok((select status='accepted' from airprop.applicants where id='17300000-0000-4000-8000-000000000028') and (select status='rejected' from airprop.applicants where id='17300000-0000-4000-8000-000000000029'),'conversion preserves winner and rejects competitor');
select ok((select count(*)=1 from airprop.reservation_revisions where reservation_id='17300000-0000-4000-8000-000000000033' and action='convert') and (select count(*)=1 from audit.events where entity_id='17300000-0000-4000-8000-000000000033' and action='AIRPROP_RESERVATION_CONVERT'),'conversion records revision and audit');

select * from finish();
rollback;
