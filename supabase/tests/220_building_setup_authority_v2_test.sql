-- Core test 220: actual authenticated SQL role; SQL-session JWT FIXTURE only.
-- Not genuine Auth-issued JWT, HTTP, hosted or Production evidence.
begin;
set local search_path=public,extensions,pg_catalog;
set local row_security=on;
select plan(133);
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
select is(current_user::text,'authenticated','canonical role publication uses actual authenticated role');
-- Each delegated role has two permissions, a strict subset of the independent
-- managers' existing three canonical onboarding permissions. Operator cannot
-- approve, reviewer cannot manage; no unrelated module or new source grant.
insert into bs_state values('operator_role',pg_temp.bs_publish('bs220_operator',
 array['onboarding.import.read','onboarding.import.manage']));
insert into bs_state values('reviewer_role',pg_temp.bs_publish('bs220_reviewer',
 array['onboarding.import.read','onboarding.import.approve']));
-- Both roots possess existing canonical system permissions, not invented grants.
select lives_ok($$select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(110),null,pg_temp.bs_id(91),(select value from bs_state where name='operator_role'),
 'property',pg_temp.bs_id(30),null,null,statement_timestamp()+interval '4 hours',
 'Synthetic independent manager bootstrap','bs220-manager-b-property')$$,'independent manager A canonically assigns B at property scope');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(2),'aal','aal2')::text,true);
select lives_ok($$select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(111),null,pg_temp.bs_id(90),(select value from bs_state where name='operator_role'),
 'property',pg_temp.bs_id(30),null,null,statement_timestamp()+interval '4 hours',
 'Synthetic independent manager bootstrap','bs220-manager-a-property')$$,'independent manager B canonically assigns A at property scope');
select lives_ok($$select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(111),pg_temp.bs_id(101),pg_temp.bs_id(90),(select value from bs_state where name='operator_role'),
 'workspace',null,null,null,statement_timestamp()+interval '4 hours',
 'Synthetic exact Workspace operator','bs220-manager-a-workspace')$$,'manager B assigns exact Workspace authority to A through v2');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
insert into bs_state select 'reviewer_context',(customer_api.claim_pilot_setup_reviewer_v1(
 pg_temp.bs_id(50),'Synthetic reviewer','en')->>'context_id')::uuid;
reset role;
insert into bs_state select 'reviewer_membership',membership_id
 from platform.pilot_setup_reviewers where id=pg_temp.bs_id(210);

-- Test-only mounted process-consumer boundary. Main adapter has NO authenticated
-- EXECUTE; this temporary definer forwards only its fixed typed contract, never
-- rewrites claims/role or supplies authority. This is NOT a real process RPC.
create function pg_temp.bs_require(ctx uuid,ws uuid,perm text,action text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $consumer$
 select to_jsonb(a) from app_private.require_building_setup_authority_v2(ctx,ws,perm,action) a;
$consumer$;
revoke all on function pg_temp.bs_require(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function pg_temp.bs_require(uuid,uuid,text,text) to authenticated;

-- Denial fingerprints are taken by the fixture owner before/after authenticated
-- calls, never used as authority. They include domain data, timestamps, audit,
-- canonical assignments/provenance/lineage and role command receipts.
reset role;
create function pg_temp.bs_fingerprint() returns jsonb language sql stable security invoker
set search_path=pg_catalog as $fingerprint$
 select jsonb_object_agg(name,digest) from (
  select 'runs' name,md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) digest
   from platform.building_setup_runs t where t.tenant_id in (pg_temp.bs_id(10),pg_temp.bs_id(20))
  union all select 'assignments',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.workspace_member_roles t where t.tenant_id=pg_temp.bs_id(10)
  union all select 'sources',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))
   from platform.workspace_member_role_authority_sources t
   where t.assignment_id in (select id from platform.workspace_member_roles where tenant_id=pg_temp.bs_id(10))
  union all select 'lineage',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))
   from platform.workspace_role_handover_lineage t
   where t.successor_assignment_id in (select id from platform.workspace_member_roles where tenant_id=pg_temp.bs_id(10))
  union all select 'audit',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from audit.events t where t.tenant_id in (pg_temp.bs_id(10),pg_temp.bs_id(20))
  union all select 'outbox',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.outbox_events t where t.tenant_id in (pg_temp.bs_id(10),pg_temp.bs_id(20))
  union all select 'roles',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.workspace_roles t where t.tenant_id=pg_temp.bs_id(10)
  union all select 'command_receipts',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))
   from platform.workspace_role_idempotency t where t.tenant_id=pg_temp.bs_id(10)
  union all select 'members',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from identity.memberships t where t.tenant_id=pg_temp.bs_id(10)
  union all select 'contexts',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from identity.context_grants t where t.tenant_id=pg_temp.bs_id(10)
  union all select 'basis',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.workspace_access_bases t where t.customer_workspace_id=pg_temp.bs_id(50)
  union all select 'reviewers',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.pilot_setup_reviewers t where t.customer_workspace_id=pg_temp.bs_id(50)
  union all select 'module_activation',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.workspace_modules t where t.customer_workspace_id=pg_temp.bs_id(50)
  union all select 'entitlement',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,''))
   from platform.workspace_entitlements t where t.customer_workspace_id=pg_temp.bs_id(50)
  union all select 'bindings',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))
   from platform.module_permission_bindings t where t.module_definition_id=(select value from pg_temp.bs_state where name='module')
  union all select 'reviewer_permissions',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))
   from identity.role_permissions t where t.role_id in (select id from identity.roles where tenant_id=pg_temp.bs_id(10))
 ) hashes;
$fingerprint$;
revoke all on function pg_temp.bs_fingerprint() from public,anon,authenticated,service_role;
create temp table bs_before(fingerprint jsonb not null);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select is(current_user::text,'authenticated','reviewer is actual authenticated SQL role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.approve','approve')$$,'42501',
 'building_setup_native_assignment_required','valid pilot claim alone is never approval authority');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'claim without assignment: denial is zero-write');
truncate bs_before;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select customer_api.assign_workspace_role_v2(
 pg_temp.bs_id(110),pg_temp.bs_id(100),(select value from bs_state where name='reviewer_membership'),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '2 hours','Synthetic bounded independent reviewer','bs220-reviewer-assignment')$$,
 'ordinary authenticated independent manager grants reviewer through canonical v2');
reset role;
select ok((select count(*)=4 and bool_and(authority_policy_version=2)
 from platform.workspace_member_roles where customer_workspace_id=pg_temp.bs_id(50)),
 'all four assignments originate in v2; no privileged legacy-v1 insertion');
select ok((select count(*)=2 from platform.workspace_member_role_authority_sources s
 join platform.workspace_member_roles a on a.id=s.assignment_id
 where a.membership_id=(select value from bs_state where name='reviewer_membership')
 and a.assigned_by_membership_id=pg_temp.bs_id(90) and s.source_kind='identity_role'),
 'reviewer read and approve each retain actual independent manager provenance');

insert into bs_state select 'reviewer_assignment',a.id from platform.workspace_member_roles a
 where a.membership_id=(select value from bs_state where name='reviewer_membership');

-- Isolation targets deliberately created only after the canonical bootstrap.
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 (pg_temp.bs_id(51),pg_temp.bs_id(10),'ASSOCIATION','Synthetic sibling','PILOT','ACTIVE'),
 (pg_temp.bs_id(60),pg_temp.bs_id(20),'ASSOCIATION','Synthetic foreign','PILOT','ACTIVE');
insert into platform.building_setup_runs
 (id,tenant_id,customer_workspace_id,idempotency_key,status,setup_payload,payload_hash,created_by) values
 (pg_temp.bs_id(300),pg_temp.bs_id(10),pg_temp.bs_id(50),'bs220-own-run','draft','{"currency":"RON","synthetic":true}','synthetic-fixture',pg_temp.bs_id(1)),
 (pg_temp.bs_id(301),pg_temp.bs_id(10),pg_temp.bs_id(51),'bs220-sibling-run','draft','{"currency":"RON","synthetic":true}','synthetic-fixture',pg_temp.bs_id(1)),
 (pg_temp.bs_id(302),pg_temp.bs_id(20),pg_temp.bs_id(60),'bs220-foreign-run','draft','{"currency":"RON","synthetic":true}','synthetic-fixture',pg_temp.bs_id(1));
select is((select count(*)::integer from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 where m.code='building_setup' and m.version=1 and b.binding_version=1 and b.is_delegable
 and b.is_assignable_to_local_role and b.requires_aal2 and b.lifecycle_status='active'),3,
 'exact three accepted assignable/delegable AAL2 bindings');
select ok((select count(*)=1 from platform.module_property_profile_compatibilities c
 join platform.module_definitions m on m.id=c.module_definition_id
 join platform.property_profiles p on p.id=c.property_profile_id
 where m.code='building_setup' and p.code='residential_condominium' and p.version=1 and c.compatibility_level='compatible'),
 'only accepted existing profile bound');
select ok(not has_function_privilege('authenticated',
 'app_private.require_building_setup_authority_v2(uuid,uuid,text,text)','EXECUTE')
 and not has_function_privilege('anon','app_private.can_read_building_setup_v2(uuid,uuid)','EXECUTE')
 and not has_function_privilege('service_role','app_private.can_read_building_setup_v2(uuid,uuid)','EXECUTE'),
 'main adapter remains private; policy predicate has no anon/service grant');
select ok((select count(*)=2 and bool_and(prosecdef and provolatile='s'
 and proconfig=array['search_path=pg_catalog'])
 from pg_proc where oid in ('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure,
 'app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure)), 'both private boundaries are stable, definer, fixed path');
select ok((select count(*)=2 from pg_proc p where p.oid in
 ('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure,
 'app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure)
 and p.proowner=(select proowner from pg_proc where oid='app_private.require_setup_context(uuid,text)'::regprocedure)),
 'actual catalog owners match existing process owner');
select diag(p.proname||'; actual owner='||pg_get_userbyid(p.proowner)||'; ACL='||coalesce(p.proacl::text,'default'))
 from pg_proc p where p.oid in ('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)'::regprocedure,
 'app_private.can_read_building_setup_v2(uuid,uuid)'::regprocedure);

insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','operator read policy caller role');
select is(current_setting('row_security'),'on','read policy is evaluated with RLS enabled');
select ok(row_security_active('platform.building_setup_runs'::regclass),'actual authenticated caller is subject to runs RLS');
select lives_ok($$select pg_temp.bs_require(pg_temp.bs_id(100),pg_temp.bs_id(50),'onboarding.import.manage','create')$$,
 'operator valid current Workspace creation authority');
select is((select count(*)::integer from platform.building_setup_runs),1,'operator sees only exact authorized Workspace, not sibling tenant Workspace');
select throws_ok($$select app_private.require_building_setup_authority_v2(
 pg_temp.bs_id(100),pg_temp.bs_id(50),'onboarding.import.read','read')$$,'42501',null,'ordinary callers cannot execute private adapter directly');
select throws_ok($$select pg_temp.bs_require(pg_temp.bs_id(100),pg_temp.bs_id(50),'onboarding.import.approve','provision')$$,
 '42501','building_setup_action_permission_denied','approval permission cannot be substituted for provisioning manage');
select throws_ok($$select pg_temp.bs_require(pg_temp.bs_id(100),pg_temp.bs_id(51),'onboarding.import.read','read')$$,
 '42501',null,'sibling Workspace denied despite same tenant');
select throws_ok($$select pg_temp.bs_require(pg_temp.bs_id(100),pg_temp.bs_id(60),'onboarding.import.read','read')$$,
 '42501',null,'foreign tenant Workspace denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select lives_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.approve','approve')$$,'reviewer positive requires BOTH canonical assignment and current exact pilot receipt/basis');
select is((select count(*)::integer from platform.building_setup_runs),1,'reviewer raw SELECT is exact Workspace isolated');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'positive reads and operator isolation denials leave state unchanged');
truncate bs_before;

reset role;
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.manage','create')$$,
 '42501','building_setup_reviewer_action_denied','reviewer cannot create');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.manage','update')$$,
 '42501','building_setup_reviewer_action_denied','reviewer cannot edit');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.manage','provision')$$,
 '42501','building_setup_reviewer_action_denied','reviewer cannot provision');
select throws_ok($$select customer_api.assign_workspace_role_v2(
 (select value from bs_state where name='reviewer_context'),null,pg_temp.bs_id(91),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '1 hour','Forbidden reviewer delegation','bs220-reviewer-forbidden')$$,
 '42501',null,'reviewer cannot assign roles');
select throws_ok($$insert into platform.building_setup_runs
 (tenant_id,customer_workspace_id,idempotency_key,status,setup_payload,payload_hash,created_by)
 values(pg_temp.bs_id(10),pg_temp.bs_id(50),'bs220-forbidden','draft','{}','fixture',pg_temp.bs_id(3))$$,
 '42501',null,'authenticated has no direct run mutation privilege');
select throws_ok($$select pg_temp.bs_require(pg_temp.bs_id(100),pg_temp.bs_id(50),
 'onboarding.import.read','read')$$,'42501',null,'reviewer cannot borrow independent manager Context');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(4),'aal','aal2')::text,true);
select throws_ok($$select customer_api.assign_workspace_role_v2(pg_temp.bs_id(110),pg_temp.bs_id(100),
 (select value from bs_state where name='reviewer_membership'),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '1 hour','Unowned manager Context','bs220-outsider-forbidden')$$,
 '42501',null,'actor with no manager authority cannot borrow manager assignment Context');
select is((select count(*)::integer from platform.building_setup_runs),0,'outsider direct table SELECT discloses no runs');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'all forbidden calls leave data/audit/receipts/timestamps unchanged');
truncate bs_before;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_receipt_expired;
update platform.pilot_setup_reviewers set expires_at=statement_timestamp() where id=pg_temp.bs_id(210);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','receipt_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'receipt_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'receipt_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'receipt_expired: denied calls have zero writes');
rollback to bs_receipt_expired;
release savepoint bs_receipt_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_receipt_revoked;
update platform.pilot_setup_reviewers set status='revoked',revoked_at=statement_timestamp() where id=pg_temp.bs_id(210);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','receipt_revoked: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'receipt_revoked: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'receipt_revoked: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'receipt_revoked: denied calls have zero writes');
rollback to bs_receipt_revoked;
release savepoint bs_receipt_revoked;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_context_expired;
update identity.context_grants set ends_at=statement_timestamp() where id=(select value from bs_state where name='reviewer_context');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','context_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'context_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'context_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'context_expired: denied calls have zero writes');
rollback to bs_context_expired;
release savepoint bs_context_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_context_future;
update identity.context_grants set starts_at=statement_timestamp()+interval '1 hour' where id=(select value from bs_state where name='reviewer_context');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','context_future: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'context_future: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'context_future: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'context_future: denied calls have zero writes');
rollback to bs_context_future;
release savepoint bs_context_future;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_member_expired;
update identity.memberships set ends_at=statement_timestamp() where id=(select value from bs_state where name='reviewer_membership');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','member_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'member_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'member_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'member_expired: denied calls have zero writes');
rollback to bs_member_expired;
release savepoint bs_member_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_member_future;
update identity.memberships set starts_at=statement_timestamp()+interval '1 hour' where id=(select value from bs_state where name='reviewer_membership');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','member_future: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'member_future: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'member_future: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'member_future: denied calls have zero writes');
rollback to bs_member_future;
release savepoint bs_member_future;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_member_revoked;
update identity.memberships set status='revoked' where id=(select value from bs_state where name='reviewer_membership');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','member_revoked: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'member_revoked: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'member_revoked: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'member_revoked: denied calls have zero writes');
rollback to bs_member_revoked;
release savepoint bs_member_revoked;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_basis_expired;
update platform.workspace_access_bases set expires_at=statement_timestamp() where id=pg_temp.bs_id(200);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','basis_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'basis_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'basis_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'basis_expired: denied calls have zero writes');
rollback to bs_basis_expired;
release savepoint bs_basis_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_basis_revoked;
update platform.workspace_access_bases set status='revoked',revoked_by=pg_temp.bs_id(2),revoked_at=statement_timestamp(),revoke_reason='Synthetic basis revocation' where id=pg_temp.bs_id(200);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','basis_revoked: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'basis_revoked: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'basis_revoked: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'basis_revoked: denied calls have zero writes');
rollback to bs_basis_revoked;
release savepoint bs_basis_revoked;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_basis_future;
update platform.workspace_access_bases set activated_at=statement_timestamp()+interval '1 hour' where id=pg_temp.bs_id(200);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','basis_future: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'basis_future: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'basis_future: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'basis_future: denied calls have zero writes');
rollback to bs_basis_future;
release savepoint bs_basis_future;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_assignment_ended;
update platform.workspace_member_roles set valid_to=statement_timestamp(),lock_version=lock_version+1,reason='Synthetic assignment ended' where id=(select value from bs_state where name='reviewer_assignment');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','assignment_ended: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'assignment_ended: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'assignment_ended: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'assignment_ended: denied calls have zero writes');
rollback to bs_assignment_ended;
release savepoint bs_assignment_ended;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_grantor_member_expired;
update identity.memberships set ends_at=statement_timestamp() where id=pg_temp.bs_id(90);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','grantor_member_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'grantor_member_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'grantor_member_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'grantor_member_expired: denied calls have zero writes');
rollback to bs_grantor_member_expired;
release savepoint bs_grantor_member_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_grantor_member_revoked;
update identity.memberships set status='revoked' where id=pg_temp.bs_id(90);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','grantor_member_revoked: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'grantor_member_revoked: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'grantor_member_revoked: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'grantor_member_revoked: denied calls have zero writes');
rollback to bs_grantor_member_revoked;
release savepoint bs_grantor_member_revoked;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_grantor_context_expired;
update identity.context_grants set ends_at=statement_timestamp() where id=pg_temp.bs_id(100);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','grantor_context_expired: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'grantor_context_expired: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'grantor_context_expired: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'grantor_context_expired: denied calls have zero writes');
rollback to bs_grantor_context_expired;
release savepoint bs_grantor_context_expired;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_grantor_context_future;
update identity.context_grants set starts_at=statement_timestamp()+interval '1 hour' where id=pg_temp.bs_id(100);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','grantor_context_future: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'grantor_context_future: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'grantor_context_future: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'grantor_context_future: denied calls have zero writes');
rollback to bs_grantor_context_future;
release savepoint bs_grantor_context_future;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_module_deactivated;
update platform.workspace_modules set status='deactivated',valid_to=statement_timestamp(),deactivated_at=statement_timestamp(),deactivated_by=pg_temp.bs_id(2),reason='Synthetic deactivation' where customer_workspace_id=pg_temp.bs_id(50) and module_code='building_setup' and status='active';
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','module_deactivated: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'module_deactivated: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'module_deactivated: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'module_deactivated: denied calls have zero writes');
rollback to bs_module_deactivated;
release savepoint bs_module_deactivated;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_entitlement_missing;
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=pg_temp.bs_id(50) and entitlement_key='module.building_setup';
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select is(current_user::text,'authenticated','entitlement_missing: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'entitlement_missing: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'entitlement_missing: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'entitlement_missing: denied calls have zero writes');
rollback to bs_entitlement_missing;
release savepoint bs_entitlement_missing;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_aal1;
-- Only the explicitly labelled SQL-session JWT fixture changes.
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal1')::text,true);
select is(current_user::text,'authenticated','aal1: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'aal1: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'aal1: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'aal1: denied calls have zero writes');
rollback to bs_aal1;
release savepoint bs_aal1;

-- Fixture-only state transition; all product triggers/RLS remain enabled.
savepoint bs_unauthenticated;
-- Missing subject fixture; no Auth token is fabricated.
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select is(current_user::text,'authenticated','unauthenticated: actual caller role');
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'unauthenticated: approval denies immediately');
select is((select count(*)::integer from platform.building_setup_runs),0,'unauthenticated: direct SELECT denies too');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'unauthenticated: denied calls have zero writes');
rollback to bs_unauthenticated;
release savepoint bs_unauthenticated;

-- Closing one canonical assignment under its original public revoke protocol.

savepoint bs_permission_deny;
update identity.role_permissions set effect='deny' where role_id=(select role_id from identity.memberships where id=(select value from bs_state where name='reviewer_membership')) and permission_id in (select id from identity.permissions where code in ('onboarding.import.read','onboarding.import.approve'));
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'permission_deny: approval denied');
select is((select count(*)::integer from platform.building_setup_runs),0,'permission_deny: read denied');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'permission_deny: zero writes');
rollback to bs_permission_deny;
release savepoint bs_permission_deny;

savepoint bs_role_archived;
update platform.workspace_roles set lifecycle_status='archived',valid_to=statement_timestamp(),lock_version=lock_version+1 where id=(select value from bs_state where name='reviewer_role');
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'role_archived: approval denied');
select is((select count(*)::integer from platform.building_setup_runs),0,'role_archived: read denied');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'role_archived: zero writes');
rollback to bs_role_archived;
release savepoint bs_role_archived;

savepoint bs_receipt_cap_shortened;
update platform.pilot_setup_reviewers set expires_at=statement_timestamp()+interval '1 hour' where id=pg_temp.bs_id(210);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'receipt_cap_shortened: approval denied');
select is((select count(*)::integer from platform.building_setup_runs),0,'receipt_cap_shortened: read denied');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'receipt_cap_shortened: zero writes');
rollback to bs_receipt_cap_shortened;
release savepoint bs_receipt_cap_shortened;

savepoint bs_basis_cap_shortened;
update platform.workspace_access_bases set expires_at=statement_timestamp()+interval '1 hour' where id=pg_temp.bs_id(200);
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'basis_cap_shortened: approval denied');
select is((select count(*)::integer from platform.building_setup_runs),0,'basis_cap_shortened: read denied');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'basis_cap_shortened: zero writes');
rollback to bs_basis_cap_shortened;
release savepoint bs_basis_cap_shortened;

-- Canonical revoke is separate from fixture-only expiry simulation.

savepoint bs_binding_deprecated;
update platform.module_permission_bindings set lifecycle_status='deprecated',valid_to=statement_timestamp()
 where module_definition_id=(select value from bs_state where name='module') and binding_version=1;
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),pg_temp.bs_id(50),
 'onboarding.import.approve','approve')$$,'42501',null,'deprecated accepted binding denies approval');
select is((select count(*)::integer from platform.building_setup_runs),0,'deprecated binding denies direct table read');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'binding deprecation: denials have zero writes');
rollback to bs_binding_deprecated;
release savepoint bs_binding_deprecated;

savepoint bs_canonical_revoke;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select customer_api.revoke_workspace_role_assignment_v2(
 pg_temp.bs_id(110),pg_temp.bs_id(100),(select value from bs_state where name='reviewer_assignment'),
 1,'Synthetic canonical assignment revoke','bs220-canonical-revoke')$$,'independent authenticated manager revokes through v2');
reset role;
insert into bs_before select pg_temp.bs_fingerprint();
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.approve','approve')$$,'42501',null,'canonical revoke immediately removes approval');
select is((select count(*)::integer from platform.building_setup_runs),0,'canonical revoke immediately removes raw SELECT');
reset role;
select is(pg_temp.bs_fingerprint(),(select fingerprint from bs_before),'canonical revoke: subsequent denials do not write');
rollback to bs_canonical_revoke;
release savepoint bs_canonical_revoke;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select lives_ok($$select pg_temp.bs_require((select value from bs_state where name='reviewer_context'),
 pg_temp.bs_id(50),'onboarding.import.approve','approve')$$,'savepoint restoration retains valid positive control');
select is((select count(*)::integer from platform.building_setup_runs),1,'restored exact-Workspace RLS positive control');
reset role;
select * from finish();
rollback;
