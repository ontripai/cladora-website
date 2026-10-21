-- Synthetic rollback-only fixture adapted from Core test 220.
-- No bypass, native evaluator replacement, identity permission grant, or v1 assignment insert.
-- Fixture caller owns BEGIN/ROLLBACK; never source into a live or remote database.
set local search_path=public,extensions,pg_catalog;
create function pg_temp.bs_id(n integer) returns uuid language sql immutable
as $$select ('c2200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table bs_state(name text primary key,value uuid not null);
grant select,insert on bs_state to authenticated;
do $preconditions$
begin
 if exists(select 1 from platform.tenants where id in (pg_temp.bs_id(10),pg_temp.bs_id(20)))
 then raise exception 'building_setup_fixture_collision'; end if;
 if (select count(distinct p.code) from identity.roles r
  join identity.role_permissions rp on rp.role_id=r.id and rp.effect='allow'
  join identity.permissions p on p.id=rp.permission_id
  where r.code='association_admin' and r.tenant_id is null
  and p.code in ('onboarding.import.read','onboarding.import.manage','onboarding.import.approve',
   'workspace.role.manage','workspace.role.publish','workspace.role.assign'))<>6 then
  raise exception 'building_setup_existing_independent_manager_permissions_missing';
 end if;
end;
$preconditions$;
insert into auth.users(id,email,email_confirmed_at) values
 (pg_temp.bs_id(1),'bs-manager-a@fixture.invalid',statement_timestamp()),
 (pg_temp.bs_id(2),'bs-manager-b@fixture.invalid',statement_timestamp()),
 (pg_temp.bs_id(3),'bs-reviewer@fixture.invalid',statement_timestamp()),
 (pg_temp.bs_id(4),'bs-outsider@fixture.invalid',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values
 (pg_temp.bs_id(10),'Building setup synthetic A','BS-220-A','active'),
 (pg_temp.bs_id(20),'Building setup synthetic B','BS-220-B','active');
-- Initially one Workspace: canonical v2 composes existing v1 internals, not a
-- new bootstrap engine. Additional isolation targets are added after assignment.
insert into platform.customer_workspaces
 (id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status,primary_admin_user_id)
 values(pg_temp.bs_id(50),pg_temp.bs_id(10),'ASSOCIATION','Synthetic','PILOT','ACTIVE',pg_temp.bs_id(1));
insert into portfolio.properties(id,tenant_id,type,name,status)
 values(pg_temp.bs_id(30),pg_temp.bs_id(10),'condominium','Synthetic RO property','active');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source)
 values(pg_temp.bs_id(10),pg_temp.bs_id(50),pg_temp.bs_id(30),'active','platform_assignment');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
 select pg_temp.bs_id(10),pg_temp.bs_id(50),p.id,o.id,'active',statement_timestamp()-interval '1 day',pg_temp.bs_id(1),'RO'
 from platform.property_profiles p cross join platform.operating_models o
 where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at,ends_at)
 select pg_temp.bs_id(89+n),pg_temp.bs_id(10),pg_temp.bs_id(n),r.id,'active',
 statement_timestamp()-interval '1 day',statement_timestamp()+interval '12 hours'
 from generate_series(1,2) n cross join identity.roles r
 where r.code='association_admin' and r.tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at,ends_at)
 select pg_temp.bs_id(99+n),pg_temp.bs_id(10),pg_temp.bs_id(89+n),'tenant',null,
 statement_timestamp()-interval '1 day',statement_timestamp()+interval '12 hours' from generate_series(1,2) n
 union all
 select pg_temp.bs_id(109+n),pg_temp.bs_id(10),pg_temp.bs_id(89+n),'property',pg_temp.bs_id(30),
 statement_timestamp()-interval '1 day',statement_timestamp()+interval '12 hours' from generate_series(1,2) n;
insert into platform.workspace_modules
 (tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
 select pg_temp.bs_id(10),pg_temp.bs_id(50),id,code,'active','Accepted disposable test prerequisite'
 from platform.module_definitions where code='building_setup' and version=1;
insert into platform.workspace_entitlements
 (customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
 values(pg_temp.bs_id(50),'module.building_setup','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_access_bases
 (id,customer_workspace_id,normalized_email,role_id,mode,status,duration_hours,evidence_note,
  approved_by,activated_at,expires_at,membership_id,context_grant_id)
 select pg_temp.bs_id(200),pg_temp.bs_id(50),'bs-manager-a@fixture.invalid',r.id,'PILOT','active',24,
 'Synthetic accepted pilot basis; no commercial receipt or live activation',pg_temp.bs_id(2),
 statement_timestamp()-interval '1 hour',statement_timestamp()+interval '12 hours',
 pg_temp.bs_id(90),pg_temp.bs_id(100)
 from identity.roles r where r.code='association_admin' and r.tenant_id is null;
insert into platform.pilot_setup_reviewers
 (id,customer_workspace_id,normalized_email,status,expires_at,reason,prepared_by)
 values(pg_temp.bs_id(210),pg_temp.bs_id(50),'bs-reviewer@fixture.invalid','prepared',
 statement_timestamp()+interval '6 hours','Synthetic independent reviewer preparation',pg_temp.bs_id(2));

insert into bs_state select 'module',id from platform.module_definitions where code='building_setup' and version=1;

-- Publish roles through existing commands under an actual authenticated grantor.
-- No INSERT into workspace_member_roles or provenance tables anywhere in this test.
create function pg_temp.bs_publish(code text,permissions text[]) returns uuid
language plpgsql security invoker set search_path=pg_catalog as $publish$
declare result jsonb;role_id uuid;revision integer:=1;p text;
begin
 if current_user<>'authenticated' then raise exception 'wrong_test_role'; end if;
 result:=customer_api.create_workspace_role_draft_v1(pg_temp.bs_id(110),code,code,
  'Synthetic reviewed building setup role','workspace',null,'Synthetic fixture role creation','bs220-create-'||code);
 role_id:=(result->>'id')::uuid;
 perform customer_api.attach_workspace_role_module_v1(pg_temp.bs_id(110),role_id,
  (select value from pg_temp.bs_state where name='module'),revision,
  'Synthetic module attachment','bs220-module-'||code);
 revision:=revision+1;
 foreach p in array permissions loop
  perform customer_api.attach_workspace_role_permission_v1(pg_temp.bs_id(110),role_id,
   (select permission.id from identity.permissions permission where permission.code=p),'allow',revision,
   'Synthetic permission attachment','bs220-perm-'||code||'-'||revision);
  revision:=revision+1;
 end loop;
 perform customer_api.publish_workspace_role_v1(pg_temp.bs_id(110),role_id,revision,
  'Synthetic independently reviewed role publication','bs220-publish-'||code);
 return role_id;
end;
$publish$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
-- Each delegated role has two permissions, a strict subset of the independent
-- managers' existing three canonical onboarding permissions. Operator cannot
-- approve, reviewer cannot manage; no unrelated module or new source grant.
insert into bs_state values('operator_role',pg_temp.bs_publish('bs220_operator',
 array['onboarding.import.read','onboarding.import.manage']));
insert into bs_state values('reviewer_role',pg_temp.bs_publish('bs220_reviewer',
 array['onboarding.import.read','onboarding.import.approve']));
-- Both roots possess existing canonical system permissions, not invented grants.
select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(110),null,pg_temp.bs_id(91),(select value from bs_state where name='operator_role'),
 'property',pg_temp.bs_id(30),null,null,statement_timestamp()+interval '4 hours',
 'Synthetic independent manager bootstrap','bs220-manager-b-property');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(2),'aal','aal2')::text,true);
select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(111),null,pg_temp.bs_id(90),(select value from bs_state where name='operator_role'),
 'property',pg_temp.bs_id(30),null,null,statement_timestamp()+interval '4 hours',
 'Synthetic independent manager bootstrap','bs220-manager-a-property');
select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(111),pg_temp.bs_id(101),pg_temp.bs_id(90),(select value from bs_state where name='operator_role'),
 'workspace',null,null,null,statement_timestamp()+interval '4 hours',
 'Synthetic exact Workspace operator','bs220-manager-a-workspace');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
insert into bs_state select 'reviewer_context',(customer_api.claim_pilot_setup_reviewer_v1(
 pg_temp.bs_id(50),'Synthetic reviewer','en')->>'context_id')::uuid;
reset role;
insert into bs_state select 'reviewer_membership',membership_id
 from platform.pilot_setup_reviewers where id=pg_temp.bs_id(210);


-- Independent reviewer assignment uses the same public canonical v2 protocol.
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(110),pg_temp.bs_id(100),(select value from bs_state where name='reviewer_membership'),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '2 hours','Synthetic bounded independent reviewer','bs220-reviewer-assignment');
reset role;
select set_config('cladora.setup_fixture.actor',pg_temp.bs_id(1)::text,true);
select set_config('cladora.setup_fixture.context',pg_temp.bs_id(100)::text,true);
select set_config('cladora.setup_fixture.workspace',pg_temp.bs_id(50)::text,true);
select set_config('cladora.setup_fixture.reviewer_actor',pg_temp.bs_id(3)::text,true);
select set_config('cladora.setup_fixture.reviewer_context',(select value::text from bs_state where name='reviewer_context'),true);

-- Invoker-only test conveniences. They call the real public v2 operations under
-- the caller's authenticated role, never invoke the private adapter directly.
create function pg_temp.bs_payload(balances jsonb default '[]'::jsonb) returns jsonb
language sql immutable security invoker as $$
 select jsonb_build_object('association',jsonb_build_object('name','Synthetic Setup'),
 'building',jsonb_build_object('name','Synthetic Main','code','B081','floors',2),
 'currency','RON','period_start','2026-01-01','period_end','2026-01-31',
 'units','[{"code":"1","floor":0,"area_m2":50},{"code":"2","floor":1,"area_m2":60}]'::jsonb,
 'opening_balances',balances)
$$;
create function pg_temp.bs_create(k text,balances jsonb default '[]'::jsonb) returns jsonb
language sql volatile security invoker as $$
 select customer_api.create_building_setup_v2(pg_temp.bs_id(100),pg_temp.bs_id(50),k,pg_temp.bs_payload(balances))
$$;
create function pg_temp.bs_command(action text,revision integer,ctx uuid default null)
returns jsonb language plpgsql volatile security invoker as $$
declare run uuid:=current_setting('cladora.setup_fixture.run')::uuid;
 key text:='setup-'||run::text||'-r'||revision::text||'-'||action||'-flow';
 context_id uuid:=coalesce(ctx,pg_temp.bs_id(100));
begin
 if action='rehearse' then return customer_api.rehearse_building_setup_v2(context_id,pg_temp.bs_id(50),run,revision,key);
 elsif action='submit' then return customer_api.submit_building_setup_v2(context_id,pg_temp.bs_id(50),run,revision,key);
 elsif action='approve' then return customer_api.approve_building_setup_v2(context_id,pg_temp.bs_id(50),run,revision,key,
   customer_api.get_building_setup_v2(context_id,pg_temp.bs_id(50),run)->>'payload_hash');
 elsif action='provision' then return customer_api.provision_building_setup_v2(context_id,pg_temp.bs_id(50),run,revision,key);
 else raise exception 'invalid fixture command'; end if;
end $$;
