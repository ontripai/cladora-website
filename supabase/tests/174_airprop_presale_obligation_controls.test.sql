begin;
select plan(30);

select has_function('customer_api','record_airprop_obligation_schedule_v1',
 array['uuid','uuid','uuid','text','numeric','jsonb','text','text'],
 'AP03 obligation gateway exists');
select is((select relrowsecurity from pg_class where oid='airprop.purchase_obligation_schedules'::regclass),
 true,'obligation schedules use RLS');
select is((select count(*) from information_schema.role_table_grants
 where table_schema='airprop' and table_name='purchase_obligation_schedules'
 and grantee in('anon','authenticated','service_role')),0::bigint,
 'obligation schedules have no direct API grants');
select ok(has_function_privilege('authenticated',
 'customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text)','EXECUTE'),
 'authenticated may execute the bounded gateway');
select ok(not has_function_privilege('anon',
 'customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text)','EXECUTE'),
 'anon cannot execute the gateway');
select ok(not has_function_privilege('service_role',
 'customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text)','EXECUTE'),
 'service role cannot bypass the gateway');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.purchase_obligation_schedules'::regclass
 and contype='f' and confrelid='airprop.presale_contracts'::regclass),
 'schedule reuses the canonical signed presale');
select ok(pg_get_functiondef('customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text)'::regprocedure)
 like '%pg_advisory_xact_lock%',
 'same-presale commands use a transaction serialization lock');

insert into auth.users(id,email) values
 ('17400000-0000-4000-8000-000000000001','obligation-admin-174@cladora.test'),
 ('17400000-0000-4000-8000-000000000002','obligation-outsider-174@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17400000-0000-4000-8000-000000000003','Obligation controls tenant','AIRPROP-174','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17400000-0000-4000-8000-000000000004','17400000-0000-4000-8000-000000000003','ASSOCIATION','Obligation controls owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17400000-0000-4000-8000-000000000005','17400000-0000-4000-8000-000000000003','condominium','Obligation controls property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17400000-0000-4000-8000-000000000006','17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000005','B174','Obligation controls building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17400000-0000-4000-8000-000000000007','17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000006','U174','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17400000-0000-4000-8000-000000000008','17400000-0000-4000-8000-000000000003','person','Presale buyer 174');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000004','17400000-0000-4000-8000-000000000005','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17400000-0000-4000-8000-000000000009','17400000-0000-4000-8000-000000000003',
 '17400000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000003',
  '17400000-0000-4000-8000-000000000009','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000004',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17400000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000004',
 id,code,'active','Obligation controls fixture'
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17400000-0000-4000-8000-000000000004','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17400000-0000-4000-8000-000000000011','17400000-0000-4000-8000-000000000003',
  '17400000-0000-4000-8000-000000000004','obligation_manager_174','Obligation manager 174','workspace',
  '17400000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000011',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000011',id,'allow'
from identity.permissions where code='airprop.presale.execute';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
 where id='17400000-0000-4000-8000-000000000011';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17400000-0000-4000-8000-000000000003','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000009','17400000-0000-4000-8000-000000000011','workspace',
 '17400000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000009',
 'Obligation controls assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17400000-0000-4000-8000-000000000012','17400000-0000-4000-8000-000000000003',
 '17400000-0000-4000-8000-000000000005','17400000-0000-4000-8000-000000000004',
 'investment','synthetic','test://obligation-authority-174',statement_timestamp()-interval '1 day');
insert into airprop.investment_opportunities
 (id,tenant_id,workspace_id,property_id,idempotency_key,name,country_code,city,asking_price,currency,status,source_ref,input_hash,created_by)
values('17400000-0000-4000-8000-000000000013','17400000-0000-4000-8000-000000000003',
 '17400000-0000-4000-8000-000000000004','17400000-0000-4000-8000-000000000005',
 'obligation-opportunity-174','Obligation opportunity 174','RO','Bucharest',240000,'EUR','approved',
 'test://obligation-opportunity-174','obligation-input-174','17400000-0000-4000-8000-000000000001');
insert into documents.documents(id,tenant_id,property_id,title,document_type,classification,created_by) values
 ('17400000-0000-4000-8000-000000000014','17400000-0000-4000-8000-000000000003',
  '17400000-0000-4000-8000-000000000005','Synthetic signed presale 174','legal','internal',
  '17400000-0000-4000-8000-000000000001');
insert into documents.document_versions
 (id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,uploaded_by) values
 ('17400000-0000-4000-8000-000000000015','17400000-0000-4000-8000-000000000003',
  '17400000-0000-4000-8000-000000000014',1,'synthetic/presale-174.pdf',repeat('e',64),
  'application/pdf',174,'17400000-0000-4000-8000-000000000001');
insert into portfolio.relationship_proposals
 (id,tenant_id,property_id,unit_id,customer_workspace_id,kind,target_party_id,effective_from,
  evidence_reference,reason,proposed_by,request_id,idempotency_key,request_hash)
values('17400000-0000-4000-8000-000000000016','17400000-0000-4000-8000-000000000003',
 '17400000-0000-4000-8000-000000000005','17400000-0000-4000-8000-000000000007',
 '17400000-0000-4000-8000-000000000004','contractual_buyer','17400000-0000-4000-8000-000000000008',
 current_date,'urn:cladora:document-version:17400000-0000-4000-8000-000000000015',
 'Synthetic signed presale proposal 174','17400000-0000-4000-8000-000000000001',
 '17400000-0000-4000-8000-000000000017','obligation-proposal-174',repeat('f',64));
insert into airprop.presale_contracts
 (id,tenant_id,workspace_id,opportunity_id,relationship_proposal_id,unit_id,buyer_party_id,evidence_version_id,
  signed_on,effective_from,recorded_by,idempotency_key,request_hash)
values('17400000-0000-4000-8000-000000000018','17400000-0000-4000-8000-000000000003',
 '17400000-0000-4000-8000-000000000004','17400000-0000-4000-8000-000000000013',
 '17400000-0000-4000-8000-000000000016','17400000-0000-4000-8000-000000000007',
 '17400000-0000-4000-8000-000000000008','17400000-0000-4000-8000-000000000015',
 current_date,current_date,'17400000-0000-4000-8000-000000000001','obligation-presale-174',repeat('1',64));

select set_config('request.jwt.claims',
 '{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":240000}]','urn:finance:proposal:174','obligation-missing-label-174')$$,
 '22023','airprop_obligation_invalid','missing term label is rejected');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-02-30","amount":240000,"label":"Invalid date"}]','urn:finance:proposal:174','obligation-invalid-date-174')$$,
 '22023','airprop_obligation_invalid','invalid calendar date is rejected');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":240000,"label":"Deposit","unexpected":true}]',
 'urn:finance:proposal:174','obligation-extra-key-174')$$,
 '22023','airprop_obligation_invalid','unexpected term fields are rejected');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":0,"label":"Deposit"}]','urn:finance:proposal:174','obligation-zero-174')$$,
 '22023','airprop_obligation_invalid','nonpositive term amount is rejected');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":40000,"label":"Deposit"},{"due_on":"2027-01-01","amount":190000,"label":"Closing"}]',
 'urn:finance:proposal:174','obligation-total-mismatch-174')$$,
 '22023','airprop_obligation_total_mismatch','term sum must equal total amount');
select set_config('request.jwt.claims',
 '{"sub":"17400000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":40000,"label":"Deposit"},{"due_on":"2027-01-01","amount":200000,"label":"Closing"}]',
 'urn:finance:proposal:174','obligation-outsider-174')$$,
 '42501','workspace_native_context_access_denied','unauthorized actor is denied');
select is((select count(*) from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018'),0::bigint,
 'rejected commands create no schedule');

select set_config('request.jwt.claims',
 '{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":40000,"label":"Deposit"},{"due_on":"2027-01-01","amount":200000,"label":"Closing"}]',
 '  urn:finance:proposal:174  ','obligation-create-174')$$,
 'authorized obligation schedule succeeds');
select is((select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":40000,"label":"Deposit"},{"due_on":"2027-01-01","amount":200000,"label":"Closing"}]',
 'urn:finance:proposal:174','obligation-create-174')->>'idempotent'),'true',
 'exact replay returns the original receipt');
select ok((select currency='EUR' and total_amount=240000 and status='recorded'
 and financial_source_reference='urn:finance:proposal:174' and jsonb_array_length(terms)=2
 from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018'),
 'schedule stores exact bounded commercial terms and trimmed source reference');
select is((select count(*) from audit.events where tenant_id='17400000-0000-4000-8000-000000000003'
 and action='AIRPROP_OBLIGATION_SCHEDULE_RECORDED'),1::bigint,
 'successful command emits one shared audit event');
select is((select count(*) from finance.journals where tenant_id='17400000-0000-4000-8000-000000000003'),0::bigint,
 'recording a schedule posts no journal');
select is((select count(*) from payments.payments where tenant_id='17400000-0000-4000-8000-000000000003'),0::bigint,
 'recording a schedule records no payment');
select is((select count(*) from billing.invoices where tenant_id='17400000-0000-4000-8000-000000000003'),0::bigint,
 'recording a schedule creates no invoice');
select is((select count(*) from platform.outbox_events where tenant_id='17400000-0000-4000-8000-000000000003'
 and aggregate_type='airprop.purchase_obligation_schedule'),0::bigint,
 'schedule recording does not invent an unowned Finance delivery event');
select is((select count(*) from portfolio.ownerships where tenant_id='17400000-0000-4000-8000-000000000003'
 and unit_id='17400000-0000-4000-8000-000000000007'),0::bigint,
 'schedule recording grants no title');
select is((select count(*) from occupancy.leases where tenant_id='17400000-0000-4000-8000-000000000003'
 and unit_id='17400000-0000-4000-8000-000000000007'),0::bigint,
 'schedule recording grants no tenancy');
select ok((select count(*)=1 from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018')
 and (select count(*)=1 from audit.events where tenant_id='17400000-0000-4000-8000-000000000003'
 and action='AIRPROP_OBLIGATION_SCHEDULE_RECORDED'),
 'exact replay creates no duplicate schedule or audit effect');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":50000,"label":"Changed deposit"},{"due_on":"2027-01-01","amount":190000,"label":"Changed closing"}]',
 'urn:finance:proposal:174','obligation-create-174')$$,
 '23505','airprop_obligation_idempotency_conflict','changed payload with the same key conflicts');
select ok((select count(*)=1 from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018')
 and (select terms->0->>'amount'='40000' from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018'),
 'changed replay leaves the original schedule unchanged');
select throws_ok($$select customer_api.record_airprop_obligation_schedule_v1(
 '17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000004',
 '17400000-0000-4000-8000-000000000018','EUR',240000,
 '[{"due_on":"2026-11-01","amount":40000,"label":"Deposit"},{"due_on":"2027-01-01","amount":200000,"label":"Closing"}]',
 'urn:finance:proposal:174','obligation-second-key-174')$$,
 '23505','airprop_obligation_schedule_conflict','a second command cannot replace the signed-presale schedule');
select ok((select count(*)=1 from airprop.purchase_obligation_schedules
 where presale_contract_id='17400000-0000-4000-8000-000000000018')
 and (select count(*)=1 from audit.events where tenant_id='17400000-0000-4000-8000-000000000003'
 and action='AIRPROP_OBLIGATION_SCHEDULE_RECORDED'),
 'conflicting commands create no duplicate side effects');

select * from finish();
rollback;
