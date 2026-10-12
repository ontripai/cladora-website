begin;
select plan(33);

select has_table('airprop','commercial_execution_links','AP04 resale receipt store exists');
select has_function('customer_api','link_airprop_commercial_execution_v1',
 array['uuid','uuid','uuid','uuid','text','uuid','jsonb','date','date','text'],
 'bounded resale receipt gateway exists');
select is((select relrowsecurity from pg_class where oid='airprop.commercial_execution_links'::regclass),
 true,'commercial receipts use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop'
 and table_name='commercial_execution_links' and grantee in('anon','authenticated','service_role')),0::bigint,
 'commercial receipts have no direct API grants');
select ok(has_function_privilege('authenticated',
 'customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),
 'authenticated may execute the bounded gateway');
select ok(not has_function_privilege('anon',
 'customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),
 'anon cannot execute the gateway');
select ok(not has_function_privilege('service_role',
 'customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),
 'service role cannot bypass the gateway');
select ok(exists(select 1 from pg_indexes where schemaname='airprop'
 and tablename='commercial_execution_links' and indexdef like '%kind, core_record_id%'),
 'one AIRPROP receipt is allowed per canonical Core fact');
select ok(pg_get_functiondef('customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)'::regprocedure)
 like '%pg_advisory_xact_lock%','same-transfer commands use a transaction serialization lock');
select is((select count(*) from pg_trigger where tgrelid='airprop.commercial_execution_links'::regclass
 and tgname='immutable_commercial_execution_link' and not tgisinternal),1::bigint,
 'commercial execution receipt history is immutable');

insert into auth.users(id,email) values
 ('17500000-0000-4000-8000-000000000001','resale-admin-175@cladora.test'),
 ('17500000-0000-4000-8000-000000000002','resale-outsider-175@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17500000-0000-4000-8000-000000000003','Resale receipt tenant','AIRPROP-175','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17500000-0000-4000-8000-000000000004','17500000-0000-4000-8000-000000000003','ASSOCIATION','Resale receipt owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000003','condominium','Resale receipt property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17500000-0000-4000-8000-000000000006','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000005','B175','Resale receipt building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17500000-0000-4000-8000-000000000007','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000006','U175','active'),
 ('17500000-0000-4000-8000-000000000008','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000006','U175-OTHER','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17500000-0000-4000-8000-000000000009','17500000-0000-4000-8000-000000000003','person','Resale seller 175'),
 ('17500000-0000-4000-8000-000000000010','17500000-0000-4000-8000-000000000003','person','Resale buyer 175');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000004',
  '17500000-0000-4000-8000-000000000005','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000003',
 '17500000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000011','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000004',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17500000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000004',
 id,code,'active','Resale receipt fixture'
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17500000-0000-4000-8000-000000000004','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17500000-0000-4000-8000-000000000013','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000004','resale_manager_175','Resale manager 175','workspace',
  '17500000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000013',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000013',id,'allow'
from identity.permissions where code='airprop.asset.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
 where id='17500000-0000-4000-8000-000000000013';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013','workspace',
 '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000011',
 'Resale receipt assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17500000-0000-4000-8000-000000000014','17500000-0000-4000-8000-000000000003',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000004',
 'investment','synthetic','test://resale-authority-175',statement_timestamp()-interval '1 day');
insert into documents.documents(id,tenant_id,property_id,title,document_type,classification,created_by) values
 ('17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000005','Synthetic signed deed 175','legal','internal',
  '17500000-0000-4000-8000-000000000001');
insert into documents.document_versions
 (id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,uploaded_by) values
 ('17500000-0000-4000-8000-000000000016','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000015',1,'synthetic/deed-175.pdf',repeat('7',64),
  'application/pdf',175,'17500000-0000-4000-8000-000000000001');
insert into portfolio.relationship_proposals
 (id,tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,target_party_id,
  effective_from,evidence_reference,reason,proposed_by,request_id,idempotency_key,request_hash)
values('17500000-0000-4000-8000-000000000017','17500000-0000-4000-8000-000000000003',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007',
 '17500000-0000-4000-8000-000000000004','ownership_transfer',
 '17500000-0000-4000-8000-000000000009','17500000-0000-4000-8000-000000000010',
 '2026-10-09','urn:cladora:document-version:17500000-0000-4000-8000-000000000016',
 'Synthetic verified resale deed 175','17500000-0000-4000-8000-000000000001',
 '17500000-0000-4000-8000-000000000018','resale-proposal-175',repeat('8',64));
insert into portfolio.ownerships(id,tenant_id,unit_id,party_id,share,valid_from,valid_to,evidence_id) values
 ('17500000-0000-4000-8000-000000000019','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000007','17500000-0000-4000-8000-000000000009',1,
  '2026-01-01','2026-10-09','17500000-0000-4000-8000-000000000016'),
 ('17500000-0000-4000-8000-000000000020','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000007','17500000-0000-4000-8000-000000000010',1,
  '2026-10-09',null,'17500000-0000-4000-8000-000000000016');
insert into portfolio.ownership_transfers
 (id,tenant_id,property_id,unit_id,relationship_proposal_id,outgoing_ownership_id,incoming_ownership_id,
  source_party_id,target_party_id,evidence_version_id,effective_on,share,executed_by,idempotency_key,request_hash)
values('17500000-0000-4000-8000-000000000021','17500000-0000-4000-8000-000000000003',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007',
 '17500000-0000-4000-8000-000000000017','17500000-0000-4000-8000-000000000019',
 '17500000-0000-4000-8000-000000000020','17500000-0000-4000-8000-000000000009',
 '17500000-0000-4000-8000-000000000010','17500000-0000-4000-8000-000000000016',
 '2026-10-09',1,'17500000-0000-4000-8000-000000000001','core-resale-transfer-175',repeat('9',64));

select set_config('request.jwt.claims',
 '{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000"}','2026-10-09',null,'resale-missing-currency-175')$$,
 '22023','airprop_resale_receipt_invalid','resale receipt requires currency');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"0","currency":"EUR"}','2026-10-09',null,'resale-zero-price-175')$$,
 '22023','airprop_resale_receipt_invalid','resale receipt requires positive price');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR"}',
 '2026-10-09','2026-10-10','resale-period-175')$$,
 '22023','airprop_resale_receipt_invalid','resale receipt is point-in-time');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000099','{"price":"240000.0000","currency":"EUR"}',
 '2026-10-09',null,'resale-fake-core-175')$$,
 '22023','airprop_execution_link_core_mismatch','unknown Core transfer is rejected');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000008','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR"}',
 '2026-10-09',null,'resale-wrong-unit-175')$$,
 '22023','airprop_execution_link_core_mismatch','Core transfer unit must match');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR"}',
 '2026-10-08',null,'resale-wrong-date-175')$$,
 '22023','airprop_execution_link_core_mismatch','Core transfer effective date must match');
select set_config('request.jwt.claims',
 '{"sub":"17500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR"}',
 '2026-10-09',null,'resale-outsider-175')$$,
 '42501','workspace_native_context_access_denied','unauthorized actor is denied');
select ok((select count(*)=0 from airprop.commercial_execution_links where kind='resale')
 and (select count(*)=0 from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'
 and action='AIRPROP_RESALE_RECEIPT_RECORDED'),
 'rejected commands create no receipt or audit effect');

select set_config('request.jwt.claims',
 '{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR","reference":"SALE-175"}',
 '2026-10-09',null,'resale-create-175')$$,'authorized resale receipt succeeds');
select ok((select kind='resale' and core_record_type='portfolio.ownership_transfer'
 and core_record_id='17500000-0000-4000-8000-000000000021' and effective_from='2026-10-09'
 and commercial_terms->>'price'='240000.0000' and commercial_terms->>'currency'='EUR'
 from airprop.commercial_execution_links where id=(select id from airprop.commercial_execution_links where kind='resale')),
 'receipt stores the exact immutable Core reference and commercial terms');
select is((select count(*) from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'
 and action='AIRPROP_RESALE_RECEIPT_RECORDED'),1::bigint,'accepted receipt emits one shared audit event');
select ok((select count(*)=2 from portfolio.ownerships where tenant_id='17500000-0000-4000-8000-000000000003'
 and unit_id='17500000-0000-4000-8000-000000000007')
 and (select valid_to='2026-10-09' from portfolio.ownerships where id='17500000-0000-4000-8000-000000000019')
 and (select valid_from='2026-10-09' and valid_to is null from portfolio.ownerships where id='17500000-0000-4000-8000-000000000020'),
 'AIRPROP receipt does not execute or rewrite canonical title intervals');
select is((select count(*) from portfolio.ownership_transfers where id='17500000-0000-4000-8000-000000000021'),
 1::bigint,'canonical Core transfer remains the single title receipt');
select is((select count(*) from occupancy.lifecycle_events where tenant_id='17500000-0000-4000-8000-000000000003'),
 0::bigint,'AIRPROP receipt creates no Core lifecycle transition');
select is((select count(*) from platform.outbox_events where tenant_id='17500000-0000-4000-8000-000000000003'
 and aggregate_type='airprop.commercial_execution_link'),0::bigint,
 'receipt does not invent an unowned delivery event');
select is((select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR","reference":"SALE-175"}',
 '2026-10-09',null,'resale-create-175')->>'idempotent'),'true','exact replay returns the original receipt');
select ok((select count(*)=1 from airprop.commercial_execution_links where kind='resale')
 and (select count(*)=1 from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'
 and action='AIRPROP_RESALE_RECEIPT_RECORDED'),
 'exact replay creates no duplicate receipt or audit effect');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"250000.0000","currency":"EUR","reference":"SALE-175"}',
 '2026-10-09',null,'resale-create-175')$$,
 '23505','airprop_execution_link_idempotency_conflict','changed payload with the same key conflicts');
select ok((select commercial_terms->>'price'='240000.0000' from airprop.commercial_execution_links where kind='resale')
 and (select count(*)=1 from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'
 and action='AIRPROP_RESALE_RECEIPT_RECORDED'),
 'changed replay leaves the receipt and audit history unchanged');
select throws_ok($$select customer_api.link_airprop_commercial_execution_v1(
 '17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000004',
 '17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000007','resale',
 '17500000-0000-4000-8000-000000000021','{"price":"240000.0000","currency":"EUR","reference":"SALE-175"}',
 '2026-10-09',null,'resale-second-key-175')$$,
 '23505','airprop_execution_link_conflict','a second command cannot replace the Core-linked receipt');
select ok((select count(*)=1 from airprop.commercial_execution_links where kind='resale')
 and (select count(*)=1 from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'
 and action='AIRPROP_RESALE_RECEIPT_RECORDED'),
 'same-transfer conflict creates no duplicate side effect');
select throws_ok($$update airprop.commercial_execution_links set commercial_terms='{"price":"1","currency":"EUR"}'
 where kind='resale'$$,'55000','airprop_commercial_execution_history_immutable',
 'resale receipt cannot be rewritten');
select throws_ok($$delete from airprop.commercial_execution_links where kind='resale'$$,
 '55000','airprop_commercial_execution_history_immutable','resale receipt cannot be deleted');

select * from finish();
rollback;
