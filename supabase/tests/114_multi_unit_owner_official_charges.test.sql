begin;
set local search_path=public,extensions;
select plan(5);
insert into auth.users(id,email,email_confirmed_at) values
('a1140000-0000-4000-8000-000000000001','charge-owner-114@cladora.test',now()),
('a1140000-0000-4000-8000-000000000002','charge-manager-114@cladora.test',now()),
('a1140000-0000-4000-8000-000000000003','charge-admin-114@cladora.test',now()),
('a1140000-0000-4000-8000-000000000004','charge-stranger-114@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b1140000-0000-4000-8000-000000000003','a1140000-0000-4000-8000-000000000003','OWNER-CHARGE-114','Link Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b1140000-0000-4000-8000-000000000003','PLATFORM_SUPER_ADMIN','Link test');
insert into platform.tenants(id,legal_name,registration_number,status) values
('c1140000-0000-4000-8000-000000000001','Owner Private Tenant 114','CLD-114-PERSONAL','active'),
('c1140000-0000-4000-8000-000000000002','Building Tenant 114','CLD-114-BUILDING','active');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('d1140000-0000-4000-8000-000000000001','OWNER-CHARGE-114','pilot','Link Owner','charge-owner-114@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('e1140000-0000-4000-8000-000000000001','d1140000-0000-4000-8000-000000000001','charge-owner-114@cladora.test','a1140000-0000-4000-8000-000000000003');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('e1140000-0000-4000-8000-000000000001','a1140000-0000-4000-8000-000000000001');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,ends_at) values
('f1140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000001','a1140000-0000-4000-8000-000000000001',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active',now()+interval '72 hours'),
('f1140000-0000-4000-8000-000000000002','c1140000-0000-4000-8000-000000000002','a1140000-0000-4000-8000-000000000002',(select id from identity.roles where tenant_id is null and code='association_admin'),'active',null);
insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
values('e1140000-0000-4000-8000-000000000001','a1140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000001','f1140000-0000-4000-8000-000000000001','a1140000-0000-4000-8000-000000000003','Verified linked unit test case',now()+interval '72 hours');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
values('01140000-0000-4000-8000-000000000001','a1140000-0000-4000-8000-000000000001','Personal building','A1','Bucharest Sector 2');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner)
values('11140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','ASSOCIATION','ACTIVE','Test sales');
insert into portfolio.properties(id,tenant_id,type,name,status)
values('21140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','condominium','Canonical property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name)
values('31140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','21140000-0000-4000-8000-000000000001','B1','Canonical building');
insert into portfolio.units(id,tenant_id,building_id,code)
values('41140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','31140000-0000-4000-8000-000000000001','A1');
insert into portfolio.parties(id,tenant_id,type,legal_name)
values('51140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','person','Verified owner');
insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from)
values('c1140000-0000-4000-8000-000000000002','41140000-0000-4000-8000-000000000001','51140000-0000-4000-8000-000000000001',1,current_date-1);
insert into identity.context_grants(membership_id,tenant_id,scope_type)
values('f1140000-0000-4000-8000-000000000002','c1140000-0000-4000-8000-000000000002','tenant');

insert into portfolio.parties(id,tenant_id,type,legal_name) values
('51140000-0000-4000-8000-000000000002','c1140000-0000-4000-8000-000000000002','person','Different liable person');
insert into billing.invoices(id,tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,due_on,subtotal)
values('61140000-0000-4000-8000-000000000001','c1140000-0000-4000-8000-000000000002','21140000-0000-4000-8000-000000000001','41140000-0000-4000-8000-000000000001','51140000-0000-4000-8000-000000000001',current_date-35,current_date-5,current_date+7,100),
('61140000-0000-4000-8000-000000000002','c1140000-0000-4000-8000-000000000002','21140000-0000-4000-8000-000000000001','41140000-0000-4000-8000-000000000001','51140000-0000-4000-8000-000000000002',current_date-35,current_date-5,current_date+7,200);
insert into billing.invoice_lines(tenant_id,invoice_id,description,unit_price,line_subtotal)
values('c1140000-0000-4000-8000-000000000002','61140000-0000-4000-8000-000000000001','Owner charge',100,100),
('c1140000-0000-4000-8000-000000000002','61140000-0000-4000-8000-000000000002','Other liable person',200,200);
update billing.invoices set status='issued' where id in ('61140000-0000-4000-8000-000000000001','61140000-0000-4000-8000-000000000002');
insert into billing.receivables(tenant_id,invoice_id,original_amount) values
('c1140000-0000-4000-8000-000000000002','61140000-0000-4000-8000-000000000001',100),
('c1140000-0000-4000-8000-000000000002','61140000-0000-4000-8000-000000000002',200);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.list_my_owner_building_charges_v1('01140000-0000-4000-8000-000000000001')),0,'Unlinked unit has no official charges');
select set_config('owner.charge.link',customer_api.request_owner_unit_link_v1('01140000-0000-4000-8000-000000000001','11140000-0000-4000-8000-000000000001','41140000-0000-4000-8000-000000000001','Ownership evidence submitted for charge test')::text,true);
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select customer_api.manager_verify_owner_unit_link_v1(current_setting('owner.charge.link')::uuid,'51140000-0000-4000-8000-000000000001','Manager reviewed official owner record');
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select customer_api.approve_owner_unit_link_v1(current_setting('owner.charge.link')::uuid,'Independent review of owner charge access');
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.list_my_owner_building_charges_v1('01140000-0000-4000-8000-000000000001')),1,'Only invoice liable to verified owner is visible');
select is(customer_api.list_my_owner_building_charges_v1('01140000-0000-4000-8000-000000000001')->0->>'total','100.0000','Official amount comes from invoice');
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.list_my_owner_building_charges_v1('01140000-0000-4000-8000-000000000001')$$,'%owner_role_required%','Unassigned user cannot read charges');
reset role;
update portfolio.ownerships set valid_to=current_date where party_id='51140000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1140000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.list_my_owner_building_charges_v1('01140000-0000-4000-8000-000000000001')),0,'Expired ownership removes official charge access');
select * from finish();
rollback;
