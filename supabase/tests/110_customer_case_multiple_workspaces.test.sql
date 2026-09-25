begin;
set local search_path=public,extensions;
select plan(14);

insert into auth.users(id,email,email_confirmed_at) values
('aa100000-0000-4000-8000-000000000001','multi-admin@cladora.test',now()),
('aa100000-0000-4000-8000-000000000002','multi-customer@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('ba100000-0000-4000-8000-000000000001','aa100000-0000-4000-8000-000000000001','EMP-MULTI-ADMIN','Multi Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('ba100000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Multiple-workspace test');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy)
values('ca100000-0000-4000-8000-000000000001','MULTI-110-1','pilot','Multiple buildings','multi-customer@cladora.test','fa',true);
insert into platform.tenants(id,legal_name,status) values
('da100000-0000-4000-8000-000000000001','Multiple workspace tenant','draft'),
('da100000-0000-4000-8000-000000000002','Other tenant','draft');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment)
values('ea100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','ASSOCIATION','Commercial owner','PILOT'),
('ea100000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','ASSOCIATION','Commercial owner','PILOT'),
('ea100000-0000-4000-8000-000000000003','da100000-0000-4000-8000-000000000002','ASSOCIATION','Commercial owner','PILOT'),
('ea100000-0000-4000-8000-000000000004','da100000-0000-4000-8000-000000000001','ASSOCIATION','Commercial owner','PILOT');
insert into platform.workspace_access_bases(customer_workspace_id,normalized_email,role_id,mode,duration_hours,evidence_note,approved_by)
select w.id,'multi-customer@cladora.test',r.id,'PILOT',24,'Independently verified pilot customer',
  'aa100000-0000-4000-8000-000000000001'
from platform.customer_workspaces w cross join lateral
  (select id from identity.roles where code='association_admin' and tenant_id is null limit 1) r
where w.id in ('ea100000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000002','ea100000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('case.multi.id',customer_api.open_customer_case_v1('ca100000-0000-4000-8000-000000000001','Identity verified before preparing workspace links')->>'case_id',true);
select lives_ok($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000001',null,'First approved workspace')$$,'First approved workspace is linked');
select lives_ok($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000002',null,'Second approved workspace')$$,'Same tenant may link a second approved workspace');
select is(jsonb_array_length(customer_api.get_customer_case_v1(current_setting('case.multi.id')::uuid)->'workspace_links'),2,'Case lists both approved workspaces');
select is((customer_api.get_customer_case_v1(current_setting('case.multi.id')::uuid)->>'workspace_id'),'ea100000-0000-4000-8000-000000000001','Original first workspace remains primary');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000002',null,'Duplicated workspace link')$$,'%workspace_already_linked%','Duplicate workspace link is rejected');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000003',null,'Unrelated tenant workspace')$$,'%case_workspace_tenant_mismatch%','Different tenant cannot be linked even with matching email');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000004',null,'Unapproved workspace link')$$,'%approved_access_basis_required%','Each additional workspace needs its own approved basis');
select is(jsonb_array_length(customer_api.get_customer_case_v1(current_setting('case.multi.id')::uuid)->'workspace_links'),2,'Denied links do not persist');
select ok(jsonb_array_length(customer_api.list_case_workspace_options_v1(current_setting('case.multi.id')::uuid))>0,'Compatible property and operating model options are available');
select set_config('case.multi.prepared',customer_api.create_case_workspace_v1(
  current_setting('case.multi.id')::uuid,'ASSOCIATION','residential_condominium',
  'association_managed','Commercial owner','Additional building for the same customer')->>'workspace_id',true);
select is(jsonb_array_length(customer_api.get_customer_case_v1(current_setting('case.multi.id')::uuid)->'workspace_links'),2,'Prepared LEAD workspace does not grant case access');
select throws_like($$select customer_api.create_case_workspace_v1(current_setting('case.multi.id')::uuid,'ASSOCIATION','industrial_park','association_managed','Commercial owner','Reject incompatible workspace')$$,'%compatible_taxonomy_required%','Incompatible profile and model are rejected');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,current_setting('case.multi.prepared')::uuid,null,'No commercial basis yet')$$,'%approved_access_basis_required%','New workspace needs independent access approval before linking');
select set_config('request.jwt.claims','{"sub":"aa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.get_customer_case_v1(current_setting('case.multi.id')::uuid)$$,'%case_access_denied%','Unclaimed customer cannot view linked workspaces');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.multi.id')::uuid,'ea100000-0000-4000-8000-000000000004',null,'Unauthorized attempt')$$,'%platform_access_required%','Customer cannot create an approved workspace link');
select * from finish();
rollback;
