-- Exercise existing onboarding security and completion through the exposed API gateway.
begin;
set local search_path = public, extensions;

select plan(27);

do $$
declare
  v_admin uuid := 'c1000000-0000-0000-0000-000000000001';
  v_other uuid := 'c1000000-0000-0000-0000-000000000002';
  v_ops uuid := 'c1000000-0000-0000-0000-000000000003';
  v_tenant uuid := 'c2000000-0000-0000-0000-000000000001';
  v_role uuid := 'c3000000-0000-0000-0000-000000000001';
  v_membership uuid := 'c4000000-0000-0000-0000-000000000001';
  v_workspace uuid := 'c5000000-0000-0000-0000-000000000001';
  v_platform_user uuid := 'c6000000-0000-0000-0000-000000000001';
begin
  insert into auth.users (id,email,email_confirmed_at) values
    (v_admin,'onboarding.admin@cladora.test',statement_timestamp()),
    (v_other,'onboarding.other@cladora.test',statement_timestamp()),
    (v_ops,'onboarding.ops@cladora.test',statement_timestamp());
  insert into platform.tenants (id,legal_name,registration_number) values (v_tenant,'Onboarding Tenant','RO-ONBOARD');
  insert into identity.roles (id,tenant_id,code,name,is_system) values (v_role,v_tenant,'WORKSPACE_OWNER','Workspace Owner',false);
  insert into identity.profiles (user_id,display_name,locale,timezone) values (v_admin,'Primary Administrator','en','Europe/Bucharest');
  insert into identity.memberships (id,tenant_id,user_id,role_id,status,starts_at)
    values (v_membership,v_tenant,v_admin,v_role,'active',statement_timestamp());
  insert into identity.context_grants (membership_id,tenant_id,scope_type,starts_at)
    values (v_membership,v_tenant,'tenant',statement_timestamp());
  insert into platform.customer_workspaces
    (id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment,primary_admin_user_id,primary_admin_membership_id,primary_admin_accepted_at)
    values (v_workspace,v_tenant,'ASSOCIATION','PROVISIONING','Onboarding Owner','PRODUCTION',v_admin,v_membership,statement_timestamp());
  insert into platform.platform_users (id,auth_user_id,employee_ref,display_name,status)
    values (v_platform_user,v_ops,'ONBOARD-OPS','Onboarding Operations','active');
  insert into platform.platform_role_assignments (platform_user_id,role,status,grant_reason)
    values (v_platform_user,'PLATFORM_SUPER_ADMIN','active','ENG-010C fixture');
end;
$$;

select ok((select count(*)=2 from information_schema.columns where table_schema='platform' and table_name='customer_workspaces' and column_name in ('onboarding_completed_at','onboarding_completed_by')),'workspace completion columns exist');
select ok(to_regclass('platform.customer_workspaces_onboarding_completed_by_idx') is not null,'onboarding actor foreign key is indexed');
select ok(not has_function_privilege('public','customer_api.complete_primary_admin_onboarding_v1(uuid,integer,text)','execute'),'PUBLIC cannot complete onboarding');
select ok(has_function_privilege('authenticated','customer_api.complete_primary_admin_onboarding_v1(uuid,integer,text)','execute'),'authenticated caller can invoke guarded completion RPC');
select ok(not has_function_privilege('public','customer_api.get_my_primary_admin_onboarding_v1(uuid)','execute'),'PUBLIC cannot read primary admin onboarding state');
select ok(has_function_privilege('authenticated','customer_api.get_my_primary_admin_onboarding_v1(uuid)','execute'),'authenticated caller can invoke guarded onboarding state RPC');
select ok(not has_function_privilege('authenticated','platform.assert_workspace_activation_ready(uuid)','execute'),'activation readiness helper is not exposed to authenticated clients');
select ok((select not p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='customer_api' and p.proname='complete_primary_admin_onboarding_v1'),'completion gateway is security invoker with fixed search path');
select ok(exists(select 1 from pg_trigger where tgname='customer_workspaces_activation_gate' and not tgisinternal),'activation gate trigger exists');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'Completing secure onboarding')$$,'%authentication_required%','unauthenticated completion is denied');

select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'Completing secure onboarding')$$,'%mfa_required%','AAL1 completion is denied');

select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'Completing secure onboarding')$$,'%access_denied%','a different AAL2 user cannot complete onboarding');
select throws_like($$select * from customer_api.get_my_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001')$$,'%access_denied%','a different user cannot read primary admin onboarding state');

select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',2,'Completing secure onboarding')$$,'%concurrency_conflict%','stale workspace version is denied');
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'short')$$,'%invalid_reason%','short completion reason is denied');
select throws_like($$select customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'Completing secure onboarding')$$,'%mfa_not_enrolled%','completion requires a verified MFA factor');

reset role;
insert into auth.mfa_factors (id,user_id,friendly_name,factor_type,status,secret,created_at,updated_at)
values ('c7000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','CLADORA Test TOTP','totp','verified','TEST-SECRET-NOT-REAL',statement_timestamp(),statement_timestamp());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok((select (customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',1,'Primary administrator completed secure onboarding')->>'onboarding_completed')::boolean),'eligible primary administrator completes onboarding');

reset role;
select ok((select onboarding_completed_by='c1000000-0000-0000-0000-000000000001' and version=2 from platform.customer_workspaces where id='c5000000-0000-0000-0000-000000000001'),'completion stores actor and increments version');
select ok((select count(*)=1 from audit.events where action='PRIMARY_ADMIN_ONBOARDING_COMPLETED' and actor_id='c1000000-0000-0000-0000-000000000001'),'completion writes one audit event');
select ok(platform.assert_workspace_activation_ready('c5000000-0000-0000-0000-000000000001'),'completed workspace satisfies activation readiness');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok((select (customer_api.complete_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001',2,'Idempotent onboarding completion retry')->>'workspace_version')::integer=2),'completion retry is idempotent');

select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select ok((select (platform.transition_workspace_lifecycle('c5000000-0000-0000-0000-000000000001','ACTIVE',2,'Activating completed production workspace')).lifecycle_status='ACTIVE'),'platform actor activates a completed production workspace');

reset role;
select ok((select count(*)=1 from audit.events where action='WORKSPACE_LIFECYCLE_TRANSITION' and entity_id='c5000000-0000-0000-0000-000000000001'),'production activation remains audited');
select ok((select lifecycle_status='ACTIVE' and version=3 from platform.customer_workspaces where id='c5000000-0000-0000-0000-000000000001'),'activated workspace has expected final state and version');

select ok(not has_function_privilege('anon','customer_api.get_my_primary_admin_onboarding_v1(uuid)','execute'),'anonymous gateway read is denied');
select ok(not has_function_privilege('anon','customer_api.complete_primary_admin_onboarding_v1(uuid,integer,text)','execute'),'anonymous gateway completion is denied');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok((select onboarding_completed and workspace_version=3 from customer_api.get_my_primary_admin_onboarding_v1('c5000000-0000-0000-0000-000000000001')),'primary administrator can read completed state through gateway');
select * from finish();
rollback;
