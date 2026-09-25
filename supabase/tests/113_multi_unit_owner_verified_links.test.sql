begin;
set local search_path=public,extensions;
select plan(11);

insert into auth.users(id,email,email_confirmed_at) values
('a1130000-0000-4000-8000-000000000001','link-owner-113@cladora.test',now()),
('a1130000-0000-4000-8000-000000000002','link-manager-113@cladora.test',now()),
('a1130000-0000-4000-8000-000000000003','link-admin-113@cladora.test',now()),
('a1130000-0000-4000-8000-000000000004','link-stranger-113@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b1130000-0000-4000-8000-000000000003','a1130000-0000-4000-8000-000000000003','OWNER-LINK-113','Link Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b1130000-0000-4000-8000-000000000003','PLATFORM_SUPER_ADMIN','Link test');
insert into platform.tenants(id,legal_name,registration_number,status) values
('c1130000-0000-4000-8000-000000000001','Owner Private Tenant 113','CLD-113-PERSONAL','active'),
('c1130000-0000-4000-8000-000000000002','Building Tenant 113','CLD-113-BUILDING','active');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('d1130000-0000-4000-8000-000000000001','OWNER-LINK-113','pilot','Link Owner','link-owner-113@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('e1130000-0000-4000-8000-000000000001','d1130000-0000-4000-8000-000000000001','link-owner-113@cladora.test','a1130000-0000-4000-8000-000000000003');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('e1130000-0000-4000-8000-000000000001','a1130000-0000-4000-8000-000000000001');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,ends_at) values
('f1130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000001','a1130000-0000-4000-8000-000000000001',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active',now()+interval '72 hours'),
('f1130000-0000-4000-8000-000000000002','c1130000-0000-4000-8000-000000000002','a1130000-0000-4000-8000-000000000002',(select id from identity.roles where tenant_id is null and code='association_admin'),'active',null);
insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
values('e1130000-0000-4000-8000-000000000001','a1130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000001','f1130000-0000-4000-8000-000000000001','a1130000-0000-4000-8000-000000000003','Verified linked unit test case',now()+interval '72 hours');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
values('01130000-0000-4000-8000-000000000001','a1130000-0000-4000-8000-000000000001','Personal building','A1','Bucharest Sector 2');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner)
values('11130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000002','ASSOCIATION','ACTIVE','Test sales');
insert into portfolio.properties(id,tenant_id,type,name,status)
values('21130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000002','condominium','Canonical property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name)
values('31130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000002','21130000-0000-4000-8000-000000000001','B1','Canonical building');
insert into portfolio.units(id,tenant_id,building_id,code)
values('41130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000002','31130000-0000-4000-8000-000000000001','A1');
insert into portfolio.parties(id,tenant_id,type,legal_name)
values('51130000-0000-4000-8000-000000000001','c1130000-0000-4000-8000-000000000002','person','Verified owner');
insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from)
values('c1130000-0000-4000-8000-000000000002','41130000-0000-4000-8000-000000000001','51130000-0000-4000-8000-000000000001',1,current_date-1);
insert into identity.context_grants(membership_id,tenant_id,scope_type)
values('f1130000-0000-4000-8000-000000000002','c1130000-0000-4000-8000-000000000002','tenant');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.request_owner_unit_link_v1('01130000-0000-4000-8000-000000000001','11130000-0000-4000-8000-000000000001','41130000-0000-4000-8000-000000000001','Stranger cannot request a link')$$,'%owner_role_required%','Stranger cannot claim owner unit');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('owner.link.id',customer_api.request_owner_unit_link_v1('01130000-0000-4000-8000-000000000001','11130000-0000-4000-8000-000000000001','41130000-0000-4000-8000-000000000001','Evidence submitted by claimed owner')::text,true);
select is(jsonb_array_length(customer_api.list_my_owner_unit_links_v1()),1,'Owner sees own pending link');
select throws_like($$select customer_api.manager_verify_owner_unit_link_v1(current_setting('owner.link.id')::uuid,'51130000-0000-4000-8000-000000000001','Self verification forbidden')$$,'%verification_denied%','Owner cannot approve own link');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.manager_verify_owner_unit_link_v1(current_setting('owner.link.id')::uuid,'51130000-0000-4000-8000-000000000001','Unrelated verification denied')$$,'%verification_denied%','Unassigned user cannot verify link');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.list_workspace_owner_link_requests_v1('11130000-0000-4000-8000-000000000001')),1,'Manager sees workspace-specific queue');
select lives_ok($$select customer_api.manager_verify_owner_unit_link_v1(current_setting('owner.link.id')::uuid,'51130000-0000-4000-8000-000000000001','Manager checked ownership evidence')$$,'Manager verifies recorded ownership');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.approve_owner_unit_link_v1(current_setting('owner.link.id')::uuid,'Customer cannot approve final link')$$,'%platform_access_required%','Owner cannot grant final approval');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.approve_owner_unit_link_v1(current_setting('owner.link.id')::uuid,'Independent platform approval')$$,'Superadmin independently approves verified link');
select set_config('request.jwt.claims','{"sub":"a1130000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(customer_api.list_my_owner_unit_links_v1()->0->>'status','linked','Owner sees linked status after approvals');
select throws_like($$select customer_api.request_owner_unit_link_v1('01130000-0000-4000-8000-000000000001','11130000-0000-4000-8000-000000000001','41130000-0000-4000-8000-000000000001','Duplicate link must be prevented')$$,'%duplicate key%','Duplicate active link cannot be inserted');
reset role;
select is((select count(*)::integer from identity.context_grants where membership_id='f1130000-0000-4000-8000-000000000001'),0,'Link does not grant workspace-wide context');
select * from finish();
rollback;
