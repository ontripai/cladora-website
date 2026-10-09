begin;
select plan(31);

select has_function('airprop','validate_lease_execution_link_v1',array[]::text[],'AP05 lease receipt validator exists');
select has_function('customer_api','link_airprop_commercial_execution_v1',
 array['uuid','uuid','uuid','uuid','text','uuid','jsonb','date','date','text'],'bounded commercial link gateway remains canonical');
select is((select relrowsecurity from pg_class where oid='airprop.commercial_execution_links'::regclass),true,'lease receipts use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop'
 and table_name='commercial_execution_links' and grantee in('anon','authenticated','service_role')),0::bigint,
 'lease receipts have no direct API grants');
select ok(has_function_privilege('authenticated',
 'customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),
 'authenticated may execute the bounded gateway');
select ok(not has_function_privilege('anon',
 'customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),
 'anon cannot execute the gateway');
select is((select count(*) from pg_trigger where tgrelid='airprop.commercial_execution_links'::regclass
 and tgname='a_validate_lease_execution_link' and not tgisinternal),1::bigint,
 'lease parity is a database table invariant');
select is((select count(*) from pg_trigger where tgrelid='airprop.commercial_execution_links'::regclass
 and tgname='immutable_commercial_execution_link' and not tgisinternal),1::bigint,
 'lease commercial receipt history is immutable');

insert into auth.users(id,email) values
 ('17600000-0000-4000-8000-000000000001','lease-admin-176@cladora.test'),
 ('17600000-0000-4000-8000-000000000002','lease-outsider-176@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17600000-0000-4000-8000-000000000003','Lease receipt tenant','AIRPROP-176','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17600000-0000-4000-8000-000000000004','17600000-0000-4000-8000-000000000003','ASSOCIATION','Lease receipt owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000003','condominium','Lease receipt property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17600000-0000-4000-8000-000000000006','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000005','B176','Lease receipt building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17600000-0000-4000-8000-000000000007','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000006','U176','active'),
 ('17600000-0000-4000-8000-000000000008','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000006','U176-OTHER','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17600000-0000-4000-8000-000000000009','17600000-0000-4000-8000-000000000003','person','Landlord 176'),
 ('17600000-0000-4000-8000-000000000010','17600000-0000-4000-8000-000000000003','person','Tenant 176');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000004',
  '17600000-0000-4000-8000-000000000005','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17600000-0000-4000-8000-000000000011','17600000-0000-4000-8000-000000000003',
 '17600000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000011','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000004',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17600000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000004',
 id,code,'active','Lease receipt fixture' from platform.module_definitions
where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17600000-0000-4000-8000-000000000004','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17600000-0000-4000-8000-000000000013','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000004','lease_manager_176','Lease manager 176','workspace',
  '17600000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000013',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000013',id,'allow'
from identity.permissions where code='airprop.asset.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='17600000-0000-4000-8000-000000000013';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17600000-0000-4000-8000-000000000003','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000011','17600000-0000-4000-8000-000000000013','workspace',
 '17600000-0000-4000-8000-000000000001','17600000-0000-4000-8000-000000000011',
 'Lease receipt assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17600000-0000-4000-8000-000000000014','17600000-0000-4000-8000-000000000003',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000004',
 'investment','synthetic','test://lease-authority-176',statement_timestamp()-interval '1 day');
insert into documents.documents(id,tenant_id,property_id,title,document_type,classification,created_by) values
 ('17600000-0000-4000-8000-000000000015','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000005','Synthetic signed lease 176','legal','internal',
  '17600000-0000-4000-8000-000000000001');
insert into documents.document_versions
 (id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,uploaded_by) values
 ('17600000-0000-4000-8000-000000000016','17600000-0000-4000-8000-000000000003',
  '17600000-0000-4000-8000-000000000015',1,'synthetic/lease-176.pdf',repeat('6',64),
  'application/pdf',176,'17600000-0000-4000-8000-000000000001');
insert into portfolio.relationship_proposals
 (id,tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,target_party_id,
  effective_from,effective_to,evidence_reference,reason,proposed_by,request_id,idempotency_key,request_hash)
values('17600000-0000-4000-8000-000000000017','17600000-0000-4000-8000-000000000003',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007',
 '17600000-0000-4000-8000-000000000004','lease','17600000-0000-4000-8000-000000000009',
 '17600000-0000-4000-8000-000000000010','2026-10-09','2027-10-09',
 'urn:cladora:document-version:17600000-0000-4000-8000-000000000016','Synthetic verified lease 176',
 '17600000-0000-4000-8000-000000000001','17600000-0000-4000-8000-000000000018',
 'lease-proposal-176',repeat('5',64));
insert into occupancy.leases
 (id,tenant_id,unit_id,landlord_party_id,tenant_party_id,starts_on,ends_on,currency,status,evidence_id)
values('17600000-0000-4000-8000-000000000019','17600000-0000-4000-8000-000000000003',
 '17600000-0000-4000-8000-000000000007','17600000-0000-4000-8000-000000000009',
 '17600000-0000-4000-8000-000000000010','2026-10-09','2027-10-09','RON','active',
 '17600000-0000-4000-8000-000000000016');
insert into occupancy.lease_handover_receipts
 (id,tenant_id,property_id,unit_id,lease_id,relationship_proposal_id,evidence_version_id,
  handover_status,effective_on,schedule_snapshot,transferable_facts,executed_by,idempotency_key,request_hash)
values('17600000-0000-4000-8000-000000000020','17600000-0000-4000-8000-000000000003',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007',
 '17600000-0000-4000-8000-000000000019','17600000-0000-4000-8000-000000000017',
 '17600000-0000-4000-8000-000000000016','accepted','2026-10-09',
 '{"currency":"RON","rent_amount":3200,"deposit_amount":6400,"due_day":5}',
 '{"meter_readings":[],"keys_count":2,"open_defects":[],"accepted_items":[]}',
 '17600000-0000-4000-8000-000000000001','core-lease-handover-176',repeat('4',64));

select set_config('request.jwt.claims','{"sub":"17600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"currency":"RON"}','2026-10-09','2027-10-09','lease-missing-rent-176')$$,
 '22023','airprop_lease_receipt_invalid','lease receipt requires rent amount');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"EUR"}',
 '2026-10-09','2027-10-09','lease-currency-mismatch-176')$$,
 '22023','airprop_execution_link_core_mismatch','lease currency must match Core schedule and lease');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3100,"currency":"RON"}',
 '2026-10-09','2027-10-09','lease-rent-mismatch-176')$$,
 '22023','airprop_execution_link_core_mismatch','lease rent must match Core schedule');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON"}',
 '2026-10-08','2027-10-09','lease-date-mismatch-176')$$,
 '22023','airprop_execution_link_core_mismatch','handover effective date must match');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON"}',
 '2026-10-09','2027-11-09','lease-end-mismatch-176')$$,
 '22023','airprop_execution_link_core_mismatch','commercial end date must match canonical lease');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000008','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON"}',
 '2026-10-09','2027-10-09','lease-unit-mismatch-176')$$,
 '22023','airprop_execution_link_core_mismatch','handover unit must match');
select set_config('request.jwt.claims','{"sub":"17600000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON"}',
 '2026-10-09','2027-10-09','lease-outsider-176')$$,
 '42501','workspace_native_context_access_denied','unauthorized actor is denied');
select ok((select count(*)=0 from airprop.commercial_execution_links where kind='lease')
 and (select count(*)=0 from audit.events where tenant_id='17600000-0000-4000-8000-000000000003'
 and action='AIRPROP_LEASE_RECEIPT_RECORDED'),'rejected commands create no receipt or audit effect');

select set_config('request.jwt.claims','{"sub":"17600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON","reference":"LEASE-176"}',
 '2026-10-09','2027-10-09','lease-create-176')$$,'authorized lease receipt succeeds');
select ok((select core_record_type='occupancy.lease_handover' and core_record_id='17600000-0000-4000-8000-000000000020'
 and effective_from='2026-10-09' and effective_to='2027-10-09' and commercial_terms->>'rent_amount'='3200'
 from airprop.commercial_execution_links where kind='lease'),'AIRPROP stores exact canonical handover reference and schedule parity');
select is((select count(*) from audit.events where tenant_id='17600000-0000-4000-8000-000000000003'
 and action='AIRPROP_LEASE_RECEIPT_RECORDED'),1::bigint,'accepted receipt emits one shared audit event');
select is((select count(*) from occupancy.leases where id='17600000-0000-4000-8000-000000000019'),1::bigint,
 'AIRPROP creates no second canonical lease');
select is((select count(*) from occupancy.lease_handover_receipts where id='17600000-0000-4000-8000-000000000020'),1::bigint,
 'Core handover remains the single official receipt');
select is((select count(*) from finance.journals where tenant_id='17600000-0000-4000-8000-000000000003'),0::bigint,
 'lease receipt posts no journal without FIN01');
select is((select count(*) from payments.payments where tenant_id='17600000-0000-4000-8000-000000000003'),0::bigint,
 'lease receipt records no payment without FIN01');
select is((select count(*) from billing.invoices where tenant_id='17600000-0000-4000-8000-000000000003'),0::bigint,
 'lease receipt creates no invoice without FIN01');
select is((select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON","reference":"LEASE-176"}',
 '2026-10-09','2027-10-09','lease-create-176')->>'idempotent'),'true','exact replay returns original receipt');
select ok((select count(*)=1 from airprop.commercial_execution_links where kind='lease')
 and (select count(*)=1 from audit.events where tenant_id='17600000-0000-4000-8000-000000000003'
 and action='AIRPROP_LEASE_RECEIPT_RECORDED'),'replay creates no duplicate side effect');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON","reference":"CHANGED"}',
 '2026-10-09','2027-10-09','lease-create-176')$$,
 '23505','airprop_execution_link_idempotency_conflict','changed payload with same key conflicts');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17600000-0000-4000-8000-000000000012','17600000-0000-4000-8000-000000000004',
 '17600000-0000-4000-8000-000000000005','17600000-0000-4000-8000-000000000007','lease',
 '17600000-0000-4000-8000-000000000020','{"rent_amount":3200,"currency":"RON","reference":"LEASE-176"}',
 '2026-10-09','2027-10-09','lease-second-key-176')$$,
 '23505','airprop_execution_link_conflict','second key cannot replace Core-linked receipt');
select ok((select count(*)=1 from airprop.commercial_execution_links where kind='lease')
 and (select count(*)=1 from audit.events where tenant_id='17600000-0000-4000-8000-000000000003'
 and action='AIRPROP_LEASE_RECEIPT_RECORDED'),'conflicts create no duplicate side effects');
select throws_ok($$update airprop.commercial_execution_links set commercial_terms='{}' where kind='lease'$$,
 '55000','airprop_commercial_execution_history_immutable','lease receipt cannot be rewritten');
select throws_ok($$delete from airprop.commercial_execution_links where kind='lease'$$,
 '55000','airprop_commercial_execution_history_immutable','lease receipt cannot be deleted');

select * from finish();
rollback;
