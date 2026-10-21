-- CORE-ASSETS-ACTUAL-ROLE-PROBE-01; test-only, Coordinator execution.
-- BASE: 0b7f16f6127957d47c7fda233860d55c01b1dcfc
-- SQL-session JWT fixture, NOT a signed token, genuine Auth or real HTTP proof.
-- Run only on an authorized disposable DB with pgTAP already installed.
-- Expected temporal denial assertions may FAIL on BASE: do not invert/skip them.
begin;
set local search_path = public, extensions, pg_catalog;
set local row_security = on;
select plan(72);

-- Pure test identifiers: no shared fixture, product helper or ACL is changed.
create function pg_temp.assets_probe_id(n integer) returns uuid
language sql immutable security invoker set search_path=pg_catalog
as $$ select ('c2150000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid $$;

do $fixture_preconditions$
begin
  if exists(select 1 from platform.tenants where id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20)))
     or exists(select 1 from auth.users where id in (pg_temp.assets_probe_id(1),pg_temp.assets_probe_id(2))) then
    raise exception 'assets_probe_fixture_collision';
  end if;
  if (select count(*) from identity.roles where tenant_id is null
      and code in ('property_manager','multi_unit_owner')) <> 2 then
    raise exception 'assets_probe_existing_roles_required';
  end if;
  if (select count(distinct p.code) from identity.roles r
      join identity.role_permissions rp on rp.role_id=r.id and rp.effect='allow'
      join identity.permissions p on p.id=rp.permission_id
      where r.tenant_id is null and r.code='property_manager'
      and p.code in ('assets.read','assets.manage','assets.critical.manage')) <> 3 then
    raise exception 'assets_probe_existing_manager_permissions_required';
  end if;
  if exists(select 1 from identity.roles r
      join identity.role_permissions rp on rp.role_id=r.id and rp.effect='allow'
      join identity.permissions p on p.id=rp.permission_id
      where r.tenant_id is null and r.code='multi_unit_owner'
      and p.code in ('assets.read','assets.manage','assets.critical.manage')) then
    raise exception 'assets_probe_existing_negative_role_not_permissionless';
  end if;
end;
$fixture_preconditions$;

-- Fixture setup is privileged; every product invocation below switches to the
-- actual authenticated database role. No grants, policy or trigger changes.
insert into auth.users(id,email) values
 (pg_temp.assets_probe_id(1),'assets-probe-215-a@fixture.invalid'),
 (pg_temp.assets_probe_id(2),'assets-probe-215-b@fixture.invalid');
insert into platform.tenants(id,legal_name,registration_number,status) values
 (pg_temp.assets_probe_id(10),'Assets probe synthetic A','ASSETS-PROBE-215-A','active'),
 (pg_temp.assets_probe_id(20),'Assets probe synthetic B','ASSETS-PROBE-215-B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 (pg_temp.assets_probe_id(30),pg_temp.assets_probe_id(10),'condominium','Allowed A','active'),
 (pg_temp.assets_probe_id(31),pg_temp.assets_probe_id(10),'condominium','Other A','active'),
 (pg_temp.assets_probe_id(40),pg_temp.assets_probe_id(20),'condominium','Foreign B','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 (pg_temp.assets_probe_id(50),pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(30),'A','Allowed A'),
 (pg_temp.assets_probe_id(51),pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(31),'O','Other A'),
 (pg_temp.assets_probe_id(60),pg_temp.assets_probe_id(20),pg_temp.assets_probe_id(40),'B','Foreign B');
insert into assets.asset_categories(id,tenant_id,code,name,status) values
 (pg_temp.assets_probe_id(70),pg_temp.assets_probe_id(10),'PROBE215','Synthetic A','active'),
 (pg_temp.assets_probe_id(80),pg_temp.assets_probe_id(20),'PROBE215','Synthetic B','active');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select pg_temp.assets_probe_id(slot),pg_temp.assets_probe_id(tenant),pg_temp.assets_probe_id(actor),
 r.id,'active',statement_timestamp()-interval '1 day'
from (values (90,10,1,'property_manager'),(91,20,2,'property_manager'),
 (92,10,1,'multi_unit_owner')) f(slot,tenant,actor,role_code)
join identity.roles r on r.tenant_id is null and r.code=f.role_code;
insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id,starts_at) values
 (pg_temp.assets_probe_id(100),pg_temp.assets_probe_id(90),pg_temp.assets_probe_id(10),'property',pg_temp.assets_probe_id(30),statement_timestamp()-interval '1 day'),
 (pg_temp.assets_probe_id(101),pg_temp.assets_probe_id(91),pg_temp.assets_probe_id(20),'property',pg_temp.assets_probe_id(40),statement_timestamp()-interval '1 day'),
 (pg_temp.assets_probe_id(102),pg_temp.assets_probe_id(92),pg_temp.assets_probe_id(10),'property',pg_temp.assets_probe_id(30),statement_timestamp()-interval '1 day');
-- Known detail targets, independent of whether a creation positive succeeds.
insert into assets.assets(id,tenant_id,property_id,category_id,asset_code,name,scope,created_by) values
 (pg_temp.assets_probe_id(200),pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(30),pg_temp.assets_probe_id(70),'DETAIL-215-A','Synthetic detail A','property',pg_temp.assets_probe_id(1)),
 (pg_temp.assets_probe_id(201),pg_temp.assets_probe_id(20),pg_temp.assets_probe_id(40),pg_temp.assets_probe_id(80),'DETAIL-215-B','Synthetic detail B','property',pg_temp.assets_probe_id(2));

-- Temporary test adapter is INVOKER, never an elevated fixture bridge.
-- Only fixed existing public wrappers; engine errors propagate into pgTAP.
create function pg_temp.assets_probe_call(
 path text, tag text default 'positive', ctx integer default 100,
 property_no integer default 30, category_no integer default 70,
 target_no integer default 200, critical boolean default false
) returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $probe_call$
declare response jsonb;
begin
 if current_user <> 'authenticated' or current_setting('row_security') <> 'on' then
   raise exception 'assets_probe_wrong_execution_role_or_rls';
 end if;
 case path
 when 'create' then
   response:=customer_api.create_asset_v1(
     p_context_id=>pg_temp.assets_probe_id(ctx),p_property_id=>pg_temp.assets_probe_id(property_no),
     p_category_id=>pg_temp.assets_probe_id(category_no),p_asset_code=>'CREATE-215-'||tag,
     p_name=>'Synthetic create',p_is_safety_critical=>critical,
     p_criticality_level=>case when critical then 'critical' else 'medium' end);
 when 'registration' then
   response:=customer_api.register_equipment_v1(pg_temp.assets_probe_id(ctx),
     pg_temp.assets_probe_id(property_no),null,case when critical then 'elevator' else 'ventilation' end,
     'REGISTER-215-'||tag,'Synthetic registration');
 when 'choices' then
   response:=customer_api.get_asset_registration_choices_v1(pg_temp.assets_probe_id(ctx));
 when 'detail' then
   response:=customer_api.get_asset_detail_v1(pg_temp.assets_probe_id(ctx),pg_temp.assets_probe_id(target_no));
 else raise exception 'assets_probe_unknown_path';
 end case;
 if path in ('create','registration') then
   if (response->>'success')::boolean is distinct from true
      or response->>'asset_id' is null then
     raise exception 'assets_probe_invalid_creation_response';
   end if;
   perform (response->>'asset_id')::uuid;
 elsif path='choices' then
   if jsonb_array_length(response->'properties') is distinct from 1
     or response#>>'{properties,0,id}' is distinct from pg_temp.assets_probe_id(30)::text
     or jsonb_array_length(response->'buildings') is distinct from 1
     or response#>>'{buildings,0,id}' is distinct from pg_temp.assets_probe_id(50)::text then
     raise exception 'assets_probe_choices_scope_projection_invalid';
   end if;
 elsif response->>'id' is distinct from pg_temp.assets_probe_id(target_no)::text
    or response->>'property_id' is distinct from pg_temp.assets_probe_id(property_no)::text then
   raise exception 'assets_probe_detail_projection_invalid';
 end if;
 return response;
end;
$probe_call$;

-- Fixed public-contract inventory and provenance, from actual catalog at runtime.
select diag('PROVENANCE: SQL-session JWT fixture only; not signed Auth/JWT/HTTP');
select diag('runner session_user='||session_user||'; initial current_user='||current_user);
select diag(n.nspname||'.'||p.proname||'; owner='||pg_get_userbyid(p.proowner)||
 '; definer='||p.prosecdef||'; volatility='||p.provolatile::text||
 '; path='||coalesce(p.proconfig::text,'default')||'; acl='||coalesce(p.proacl::text,'default'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='assets' and p.proname in
 ('check_asset_caller_v1','create_asset_internal_v1','registration_context_v1',
  'registration_choices_v1','register_equipment_v1','get_asset_detail_internal_v1'))
 or (n.nspname='customer_api' and p.proname in
 ('create_asset_v1','get_asset_registration_choices_v1','register_equipment_v1','get_asset_detail_v1'))
order by n.nspname,p.proname;

set local role authenticated;
set local row_security=on;
-- JWT FIXTURE: deliberately no selected tenant/Context/membership authority.
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal1')::text,true);
select is(current_user::text,'authenticated','actual authenticated role, not a JWT role claim');
select is(current_setting('row_security'),'on','RLS stays enabled');
-- Resolve OIDs through readable catalogs: missing schema USAGE must fail the
-- independent wrapper positives, not abort this earlier metadata probe.
select ok((select count(*)=3 and bool_and(row_security_active(c.oid))
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='assets' and c.relname='assets')
    or (n.nspname='identity' and c.relname in ('memberships','context_grants'))),
 'ordinary caller is subject to native RLS');
select ok(not (auth.jwt() ?| array['active_tenant_id','active_context_id','active_membership_id']),
 'JWT fixture contains no selected authority claims');
select ok(not has_function_privilege('authenticated',(select p.oid
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='assets' and p.proname='registration_context_v1'
 and p.proargtypes='2950'::oidvector),'EXECUTE'),
 'registration_context remains private');
select throws_ok($$select assets.registration_context_v1(pg_temp.assets_probe_id(100))$$,
 '42501',null,'actual authenticated direct registration_context invocation is denied');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='customer_api' and p.proname in
 ('create_asset_v1','get_asset_registration_choices_v1','register_equipment_v1','get_asset_detail_v1')
 and not p.prosecdef),4,'all four existing wrappers remain invoker');

-- Independent pgTAP catches: a positive 55000/ACL failure never aborts the next path.
select lives_ok($$select pg_temp.assets_probe_call('create')$$,'positive create under authenticated / AAL1 fixture');
select lives_ok($$select pg_temp.assets_probe_call('registration')$$,'positive registration under authenticated / AAL1 fixture');
select lives_ok($$select pg_temp.assets_probe_call('choices')$$,'positive scoped choices under authenticated / AAL1 fixture');
select lives_ok($$select pg_temp.assets_probe_call('detail')$$,'positive get_asset_detail under authenticated / AAL1 fixture');
reset role;
select is((select count(*) from assets.assets where tenant_id=pg_temp.assets_probe_id(10)),3::bigint,
 'seed plus two successful authenticated writes');
select is((select count(*) from assets.asset_history where tenant_id=pg_temp.assets_probe_id(10)
 and event_type='asset_created'),2::bigint,'only two wrapper creations wrote creation history');

-- All denial groups roll back separately, even if a broken denial writes data.
create temp table assets_probe_allowed_state as select
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.assets t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as asset_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.asset_history t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as history_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.asset_categories t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as category_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from audit.events t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as audit_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from identity.memberships t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as member_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from identity.context_grants t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))) as context_hash;
savepoint negative_cases;
set local role authenticated;

-- Missing actor: JWT fixture only, not an anonymous HTTP test.
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select pg_temp.assets_probe_call('create','no-actor')$$,'42501',
 'AUTHENTICATION_REQUIRED: Valid user session required','create: missing fixture actor is denied');
select throws_ok($$select pg_temp.assets_probe_call('registration','no-actor')$$,'42501',
 'AUTHENTICATION_REQUIRED: Valid user session required','registration: missing fixture actor is denied');
select throws_ok($$select pg_temp.assets_probe_call('choices','no-actor')$$,'42501',
 'AUTHENTICATION_REQUIRED: Valid user session required','choices: missing fixture actor is denied');
select throws_ok($$select pg_temp.assets_probe_call('detail','no-actor')$$,'42501',
 'AUTHENTICATION_REQUIRED: Valid user session required','detail: missing fixture actor is denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal1')::text,true);

-- Borrowing another tenant/actor Context is denied independently on all paths.
select throws_ok($$select pg_temp.assets_probe_call('create','borrowed',ctx=>101)$$,'42501',
 'ACCESS_DENIED: User context invalid or inactive','create: foreign actor/tenant Context is denied');
select throws_ok($$select pg_temp.assets_probe_call('registration','borrowed',ctx=>101)$$,'42501',
 'ACCESS_DENIED: User context invalid or inactive','registration: foreign actor/tenant Context is denied');
select throws_ok($$select pg_temp.assets_probe_call('choices','borrowed',ctx=>101)$$,'42501',
 'ACCESS_DENIED: User context invalid or inactive','choices: foreign actor/tenant Context is denied');
select throws_ok($$select pg_temp.assets_probe_call('detail','borrowed',ctx=>101)$$,'42501',
 'ACCESS_DENIED: User context invalid or inactive','detail: foreign actor/tenant Context is denied');

-- Valid own Context with foreign target entities.
select throws_ok($$select pg_temp.assets_probe_call('create','foreign-property',property_no=>40)$$,
 '22023','asset_entity_scope_invalid','create: own Context cannot create in another tenant');
select throws_ok($$select pg_temp.assets_probe_call('registration','foreign-property',property_no=>40)$$,
 '22023','asset_entity_scope_invalid','registration: own Context cannot create in another tenant');
select throws_ok($$select pg_temp.assets_probe_call('create','foreign-category',category_no=>80)$$,
 '22023','asset_entity_scope_invalid','create: foreign category is denied');
select throws_ok($$select pg_temp.assets_probe_call('detail','foreign-asset',target_no=>201)$$,
 'P0001','ASSET_NOT_FOUND: Asset c2150000-0000-4000-8000-000000000201 does not exist in this tenant',
 'detail: another tenant asset is not projected');
select throws_ok($$select pg_temp.assets_probe_call('create','other-property',property_no=>31)$$,
 '42501','asset_context_scope_violation','create: same-tenant property ceiling is enforced');
select throws_ok($$select pg_temp.assets_probe_call('registration','other-property',property_no=>31)$$,
 '42501','asset_context_scope_violation','registration: same-tenant property ceiling is enforced');

-- Existing permissionless membership/Context: do not edit role permission catalogs.
select throws_ok($$select pg_temp.assets_probe_call('create','permission',ctx=>102)$$,
 '42501','INSUFFICIENT_PERMISSIONS: Required permission assets.manage','create: missing canonical permission is denied');
select throws_ok($$select pg_temp.assets_probe_call('registration','permission',ctx=>102)$$,
 '42501','INSUFFICIENT_PERMISSIONS: Required permission assets.manage','registration: missing canonical permission is denied');
select throws_ok($$select pg_temp.assets_probe_call('choices','permission',ctx=>102)$$,
 '42501','INSUFFICIENT_PERMISSIONS: Required permission assets.manage','choices: missing canonical permission is denied');
select throws_ok($$select pg_temp.assets_probe_call('detail','permission',ctx=>102)$$,
 '42501','INSUFFICIENT_PERMISSIONS: Required permission assets.read','detail: missing canonical permission is denied');

-- AAL1 is valid for noncritical paths, but not critical creation/registration.
select throws_ok($$select pg_temp.assets_probe_call('create','critical-aal1',critical=>true)$$,
 '42501','MFA_REQUIRED: Elevated AAL2 authentication required','create: critical write requires AAL2');
select throws_ok($$select pg_temp.assets_probe_call('registration','critical-aal1',critical=>true)$$,
 '42501','MFA_REQUIRED: Elevated AAL2 authentication required','registration: critical write requires AAL2');
reset role;
rollback to negative_cases;

savepoint critical_positive;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select lives_ok($$select pg_temp.assets_probe_call('create','critical-aal2',critical=>true)$$,
 'create: valid critical AAL2 fixture positive must succeed');
select lives_ok($$select pg_temp.assets_probe_call('registration','critical-aal2',critical=>true)$$,
 'registration: valid critical AAL2 fixture positive must succeed');
reset role;
rollback to critical_positive;

-- TEMPORAL_PROBE: context-expired. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select is(current_user::text,'authenticated','context-expired: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','context-expired')$$,
 '42501','asset_context_access_denied','create: context-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','context-expired')$$,
 '42501','asset_context_access_denied','registration: context-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','context-expired')$$,
 '42501','asset_context_access_denied','choices: context-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','context-expired')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: context-expired denies access, including historic detail');
reset role;
rollback to temporal_case;

-- TEMPORAL_PROBE: context-future. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
update identity.context_grants set starts_at=statement_timestamp()+interval '1 day' where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select is(current_user::text,'authenticated','context-future: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','context-future')$$,
 '42501','asset_context_access_denied','create: context-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','context-future')$$,
 '42501','asset_context_access_denied','registration: context-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','context-future')$$,
 '42501','asset_context_access_denied','choices: context-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','context-future')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: context-future denies access, including historic detail');
reset role;
rollback to temporal_case;

-- TEMPORAL_PROBE: context-revoked. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
delete from identity.context_grants where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select is(current_user::text,'authenticated','context-revoked: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','context-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','create: context-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','context-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','registration: context-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','context-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','choices: context-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','context-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: context-revoked denies access, including historic detail');
reset role;
rollback to temporal_case;

-- TEMPORAL_PROBE: member-expired. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
update identity.memberships set ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select is(current_user::text,'authenticated','member-expired: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','member-expired')$$,
 '42501','asset_context_access_denied','create: member-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','member-expired')$$,
 '42501','asset_context_access_denied','registration: member-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','member-expired')$$,
 '42501','asset_context_access_denied','choices: member-expired denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','member-expired')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: member-expired denies access, including historic detail');
reset role;
rollback to temporal_case;

-- TEMPORAL_PROBE: member-future. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
update identity.memberships set starts_at=statement_timestamp()+interval '1 day' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select is(current_user::text,'authenticated','member-future: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','member-future')$$,
 '42501','asset_context_access_denied','create: member-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','member-future')$$,
 '42501','asset_context_access_denied','registration: member-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','member-future')$$,
 '42501','asset_context_access_denied','choices: member-future denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','member-future')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: member-future denies access, including historic detail');
reset role;
rollback to temporal_case;

-- TEMPORAL_PROBE: member-revoked. No TODO/skip or success-on-denial expectation.
savepoint temporal_case;
update identity.memberships set status='revoked' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select is(current_user::text,'authenticated','member-revoked: actual database role');
select throws_ok($$select pg_temp.assets_probe_call('create','member-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','create: member-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('registration','member-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','registration: member-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('choices','member-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','choices: member-revoked denies access, including historic detail');
select throws_ok($$select pg_temp.assets_probe_call('detail','member-revoked')$$,
 '42501','ACCESS_DENIED: User context invalid or inactive','detail: member-revoked denies access, including historic detail');
reset role;
rollback to temporal_case;

-- The four temporal GET assertions above deliberately require denial even though
-- BASE check_asset_caller_v1 lacks time predicates. A success is FAIL, not proof
-- that the Context is valid, and must not be relabeled as a checker false positive.
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal1')::text,true);
select lives_ok($$select pg_temp.assets_probe_call('detail','restored')$$,
 'restored valid Context/member can read detail after negative subtransactions');
select lives_ok($$select pg_temp.assets_probe_call('choices','restored')$$,
 'restored Context can load choices after negative subtransactions');
reset role;

select results_eq(
 $$select count(*)::bigint from assets.assets where tenant_id=pg_temp.assets_probe_id(10)$$,
 $$select 3::bigint$$,'negative and critical subtransactions preserve the original positive rows');
select results_eq(
 $$select count(*)::bigint from assets.asset_history where tenant_id=pg_temp.assets_probe_id(10) and event_type='asset_created'$$,
 $$select 2::bigint$$,'negative and critical subtransactions leave no creation history');
select is((select count(*) from assets.asset_categories
 where tenant_id=pg_temp.assets_probe_id(10) and code='elevator'),0::bigint,
 'critical fixture category was rolled back');
select is((select count(*) from audit.events where tenant_id=pg_temp.assets_probe_id(10)
 and action='ASSET_CATEGORY_CREATED'),1::bigint,'only the original registration category audit survives inside test transaction');
select results_eq($$select
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.assets t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.asset_history t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from assets.asset_categories t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from audit.events t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from identity.memberships t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20))),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text)
  from identity.context_grants t where tenant_id in (pg_temp.assets_probe_id(10),pg_temp.assets_probe_id(20)))$$,
 $$select asset_hash,history_hash,category_hash,audit_hash,member_hash,context_hash
   from assets_probe_allowed_state$$,'negative/critical subtransactions preserve domain and authority content, not just counts');

select * from finish();
-- Fixture users, domain rows, audit rows, test functions and all mutations roll back.
rollback;
