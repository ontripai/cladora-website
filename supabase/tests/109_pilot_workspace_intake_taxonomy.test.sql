begin;
set local search_path=public,extensions;
select plan(9);

select ok(exists(select 1 from pg_attribute where attrelid='public.marketing_leads'::regclass and attname='requested_workspace_type' and not attisdropped),'Intake records a workspace category separately from the operator type');
select ok(exists(select 1 from pg_attribute where attrelid='public.marketing_leads'::regclass and attname='requested_workspace_count' and not attisdropped),'Intake records the number of requested workspaces');

insert into auth.users(id,email,email_confirmed_at) values
  ('a9010000-0000-4000-8000-000000000001','pilot-intake-admin@cladora.test',now()),
  ('a9010000-0000-4000-8000-000000000002','pilot-intake-stranger@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000001','EMP-PILOT-INTAKE','Pilot Intake Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b9010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Pilot intake test');

insert into public.marketing_leads(reference_id,lead_type,full_name,email,locale,consent_privacy,
  applicant_type,requested_workspace_type,requested_workspace_subtype,requested_workspace_count,requested_related_buildings)
values('PILOT-109-1','pilot','Industrial applicant','pilot-intake-customer@cladora.test','ro',true,
  'company','industrial','factory',3,null),
  ('PILOT-109-2','pilot','Shared applicant','pilot-intake-shared@cladora.test','ro',true,
  'management_company','shared','parking',1,'Buildings A and B');

select is((select requested_workspace_type from public.marketing_leads where reference_id='PILOT-109-1'),'industrial','Industrial request persists without a residential archetype');
select is((select requested_workspace_count from public.marketing_leads where reference_id='PILOT-109-1'),3,'Multi-workspace count persists');
select is((select requested_related_buildings from public.marketing_leads where reference_id='PILOT-109-2'),'Buildings A and B','Shared facilities retain linked-building description');
select throws_like($$insert into public.marketing_leads(reference_id,lead_type,full_name,email,locale,consent_privacy,requested_workspace_type)
  values('PILOT-109-BAD','pilot','Bad type','bad@cladora.test','ro',true,'unknown')$$,
  '%marketing_leads_requested_workspace_type_check%','Unsupported categories require the explicit other category');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.list_start_requests_v1(50)$$,'%platform_access_required%','Non-staff cannot view intake details');
select set_config('request.jwt.claims','{"sub":"a9010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is((select x->>'requested_workspace_type' from jsonb_array_elements(customer_api.list_start_requests_v1(100)) x where x->>'reference_id'='PILOT-109-1'),'industrial','Staff inbox shows the selected category');
select is((select x->>'requested_workspace_count' from jsonb_array_elements(customer_api.list_start_requests_v1(100)) x where x->>'reference_id'='PILOT-109-1'),'3','Staff inbox shows multi-workspace count');
select * from finish();
rollback;
