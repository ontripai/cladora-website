-- CORE-ASSETS-ACTUAL-ROLE-PROBE-01; test-only, Coordinator execution.
-- BASE: a942c805b9691c6f0790d49c99d85943610b991d
-- SQL-session JWT fixture, NOT a signed token, genuine Auth or real HTTP proof.
-- Run only on an authorized disposable DB with pgTAP already installed.
-- Expected temporal denial assertions may FAIL on BASE: do not invert/skip them.
begin;
set local search_path = public, extensions, pg_catalog;
set local row_security = on;
select plan(209);

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


-- SQL-session JWT fixture only; not signed Auth/JWT or genuine HTTP proof.
-- All 22 public wrappers are called for authority denials, not full business positives.
-- No product function, grant, role, policy, trigger or extension is changed here.
create function pg_temp.descriptor_command(n integer, ctx integer) returns text
language plpgsql security invoker set search_path=pg_catalog
as $command$
declare names text[]:=ARRAY['list_assets_v1','get_asset_detail_v1','create_asset_v1','update_asset_v1','transition_asset_lifecycle_v1','update_asset_operational_status_v1','start_asset_downtime_v1','end_asset_downtime_v1','list_asset_inspections_v1','record_asset_inspection_v1','verify_asset_inspection_v1','get_asset_warranty_v1','upsert_asset_warranty_v1','list_warranty_claims_v1','create_warranty_claim_v1','resolve_warranty_claim_v1','list_compliance_policies_v1','configure_compliance_policy_v1','request_asset_decommission_v1','approve_asset_decommission_v1','get_asset_registration_choices_v1','register_equipment_v1']; proc record; args text;
begin
 if current_user<>'authenticated' or current_setting('row_security')<>'on' then
  raise exception 'descriptor_probe_wrong_role_or_rls';
 end if;
 if n<1 or n>22 then raise exception 'descriptor_probe_invalid_wrapper'; end if;
 select p.* into strict proc from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
 where ns.nspname='customer_api' and p.proname=names[n] and p.prokind='f';
 if (select count(*) from unnest(proc.proargnames) a where a='p_context_id')<>1 then
  raise exception 'descriptor_probe_unrecognized_signature';
 end if;
 select string_agg(case when proc.proargnames[k+1]='p_context_id'
   then quote_literal(pg_temp.assets_probe_id(ctx)::text)||'::uuid'
   else 'null::'||format_type(proc.proargtypes[k],null) end,',' order by k)
 into args from generate_series(0,proc.pronargs-1) k;
 return format('select customer_api.%I(%s)',names[n],args);
end;
$command$;

-- Privileged, read-only domain fingerprint; no product call is elevated.
create function pg_temp.descriptor_state() returns text
language plpgsql security invoker set search_path=pg_catalog
as $state$
declare rel record; value text; hashes text:='';
begin
 for rel in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and (n.nspname='assets' or (n.nspname='audit' and c.relname='events'))
  order by n.nspname,c.relname
 loop
  execute format('select md5(coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb)::text) from (select to_jsonb(t) row_data from %I.%I t) s',rel.nspname,rel.relname) into value;
  hashes:=hashes||rel.nspname||'.'||rel.relname||':'||value||';';
 end loop;
 return md5(hashes);
end;
$state$;
create temp table descriptor_baseline as select pg_temp.descriptor_state() fingerprint;
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='list_assets_internal_v1'),'list_assets_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='get_asset_detail_internal_v1'),'get_asset_detail_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='create_asset_internal_v1'),'create_asset_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='update_asset_internal_v1'),'update_asset_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='transition_asset_lifecycle_internal_v1'),'transition_asset_lifecycle_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='update_asset_operational_status_internal_v1'),'update_asset_operational_status_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='start_asset_downtime_internal_v1'),'start_asset_downtime_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='end_asset_downtime_internal_v1'),'end_asset_downtime_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='list_asset_inspections_internal_v1'),'list_asset_inspections_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='record_asset_inspection_internal_v1'),'record_asset_inspection_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='verify_asset_inspection_internal_v1'),'verify_asset_inspection_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='get_asset_warranty_internal_v1'),'get_asset_warranty_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='upsert_asset_warranty_internal_v1'),'upsert_asset_warranty_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='list_warranty_claims_internal_v1'),'list_warranty_claims_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='create_warranty_claim_internal_v1'),'create_warranty_claim_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='resolve_warranty_claim_internal_v1'),'resolve_warranty_claim_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='list_compliance_policies_internal_v1'),'list_compliance_policies_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='configure_compliance_policy_internal_v1'),'configure_compliance_policy_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='request_asset_decommission_internal_v1'),'request_asset_decommission_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='approve_asset_decommission_internal_v1'),'approve_asset_decommission_internal_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='registration_context_v1'),'registration_context_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='registration_choices_v1'),'registration_choices_v1: explicit caller descriptor installed');
select ok((select count(*)=1 and bool_and(position('as typed_caller(' in pg_get_functiondef(p.oid))>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assets' and p.proname='register_equipment_v1'),'register_equipment_v1: explicit caller descriptor installed');
set local role authenticated;
set local row_security=on;
select is(current_user::text,'authenticated','actual ordinary SQL caller');
select is(current_setting('row_security'),'on','native RLS remains on');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='customer_api' and p.proname=any(array['list_assets_v1','get_asset_detail_v1','create_asset_v1','update_asset_v1','transition_asset_lifecycle_v1','update_asset_operational_status_v1','start_asset_downtime_v1','end_asset_downtime_v1','list_asset_inspections_v1','record_asset_inspection_v1','verify_asset_inspection_v1','get_asset_warranty_v1','upsert_asset_warranty_v1','list_warranty_claims_v1','create_warranty_claim_v1','resolve_warranty_claim_v1','list_compliance_policies_v1','configure_compliance_policy_v1','request_asset_decommission_v1','approve_asset_decommission_v1','get_asset_registration_choices_v1','register_equipment_v1']) and not p.prosecdef),22,'all 22 existing public wrappers remain invoker');
select set_config('request.jwt.claims','{}',true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','list_assets_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','get_asset_detail_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','create_asset_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','update_asset_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','transition_asset_lifecycle_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','update_asset_operational_status_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','start_asset_downtime_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','end_asset_downtime_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','list_asset_inspections_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','record_asset_inspection_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','verify_asset_inspection_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','get_asset_warranty_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','upsert_asset_warranty_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','list_warranty_claims_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','create_warranty_claim_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','resolve_warranty_claim_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','list_compliance_policies_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','configure_compliance_policy_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','request_asset_decommission_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','approve_asset_decommission_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','get_asset_registration_choices_v1: missing actor');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','AUTHENTICATION_REQUIRED: Valid user session required','register_equipment_v1: missing actor');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,101),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(2,101),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(3,101),'42501','ACCESS_DENIED: User context invalid or inactive','create_asset_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(4,101),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(5,101),'42501','ACCESS_DENIED: User context invalid or inactive','transition_asset_lifecycle_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(6,101),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_operational_status_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(7,101),'42501','ACCESS_DENIED: User context invalid or inactive','start_asset_downtime_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(8,101),'42501','ACCESS_DENIED: User context invalid or inactive','end_asset_downtime_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(9,101),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(10,101),'42501','ACCESS_DENIED: User context invalid or inactive','record_asset_inspection_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(11,101),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(12,101),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(13,101),'42501','ACCESS_DENIED: User context invalid or inactive','upsert_asset_warranty_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(14,101),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(15,101),'42501','ACCESS_DENIED: User context invalid or inactive','create_warranty_claim_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(16,101),'42501','ACCESS_DENIED: User context invalid or inactive','resolve_warranty_claim_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(17,101),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(18,101),'42501','ACCESS_DENIED: User context invalid or inactive','configure_compliance_policy_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(19,101),'42501','ACCESS_DENIED: User context invalid or inactive','request_asset_decommission_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(20,101),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(21,101),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_registration_choices_v1: borrowed tenant Context');
select throws_ok(pg_temp.descriptor_command(22,101),'42501','ACCESS_DENIED: User context invalid or inactive','register_equipment_v1: borrowed tenant Context');
reset role;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'all Assets tables and audit unchanged after missing/borrowed actor denials');

-- TEMPORAL: context-expired
savepoint temporal_case;
update identity.context_grants set ends_at=statement_timestamp()-interval '1 hour' where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','asset_context_access_denied','create_asset_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','asset_context_access_denied','update_asset_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','asset_context_access_denied','transition_asset_lifecycle_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','asset_context_access_denied','update_asset_operational_status_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','asset_context_access_denied','start_asset_downtime_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','asset_context_access_denied','end_asset_downtime_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','asset_context_access_denied','record_asset_inspection_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','asset_context_access_denied','upsert_asset_warranty_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','asset_context_access_denied','create_warranty_claim_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','asset_context_access_denied','resolve_warranty_claim_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','asset_context_access_denied','configure_compliance_policy_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','asset_context_access_denied','request_asset_decommission_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','asset_context_access_denied','get_asset_registration_choices_v1: context-expired');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','asset_context_access_denied','register_equipment_v1: context-expired');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'context-expired: all Assets tables and audit unchanged');

-- TEMPORAL: context-future
savepoint temporal_case;
update identity.context_grants set starts_at=statement_timestamp()+interval '1 hour' where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: context-future');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: context-future');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','asset_context_access_denied','create_asset_v1: context-future');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','asset_context_access_denied','update_asset_v1: context-future');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','asset_context_access_denied','transition_asset_lifecycle_v1: context-future');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','asset_context_access_denied','update_asset_operational_status_v1: context-future');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','asset_context_access_denied','start_asset_downtime_v1: context-future');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','asset_context_access_denied','end_asset_downtime_v1: context-future');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: context-future');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','asset_context_access_denied','record_asset_inspection_v1: context-future');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: context-future');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: context-future');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','asset_context_access_denied','upsert_asset_warranty_v1: context-future');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: context-future');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','asset_context_access_denied','create_warranty_claim_v1: context-future');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','asset_context_access_denied','resolve_warranty_claim_v1: context-future');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: context-future');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','asset_context_access_denied','configure_compliance_policy_v1: context-future');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','asset_context_access_denied','request_asset_decommission_v1: context-future');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: context-future');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','asset_context_access_denied','get_asset_registration_choices_v1: context-future');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','asset_context_access_denied','register_equipment_v1: context-future');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'context-future: all Assets tables and audit unchanged');

-- TEMPORAL: context-revoked
savepoint temporal_case;
delete from identity.context_grants where id=pg_temp.assets_probe_id(100);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','ACCESS_DENIED: User context invalid or inactive','create_asset_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','ACCESS_DENIED: User context invalid or inactive','transition_asset_lifecycle_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_operational_status_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','ACCESS_DENIED: User context invalid or inactive','start_asset_downtime_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','ACCESS_DENIED: User context invalid or inactive','end_asset_downtime_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','ACCESS_DENIED: User context invalid or inactive','record_asset_inspection_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','ACCESS_DENIED: User context invalid or inactive','upsert_asset_warranty_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','ACCESS_DENIED: User context invalid or inactive','create_warranty_claim_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','ACCESS_DENIED: User context invalid or inactive','resolve_warranty_claim_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','ACCESS_DENIED: User context invalid or inactive','configure_compliance_policy_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','ACCESS_DENIED: User context invalid or inactive','request_asset_decommission_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_registration_choices_v1: context-revoked');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','ACCESS_DENIED: User context invalid or inactive','register_equipment_v1: context-revoked');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'context-revoked: all Assets tables and audit unchanged');

-- TEMPORAL: member-expired
savepoint temporal_case;
update identity.memberships set ends_at=statement_timestamp()-interval '1 hour' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','asset_context_access_denied','create_asset_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','asset_context_access_denied','update_asset_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','asset_context_access_denied','transition_asset_lifecycle_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','asset_context_access_denied','update_asset_operational_status_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','asset_context_access_denied','start_asset_downtime_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','asset_context_access_denied','end_asset_downtime_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','asset_context_access_denied','record_asset_inspection_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','asset_context_access_denied','upsert_asset_warranty_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','asset_context_access_denied','create_warranty_claim_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','asset_context_access_denied','resolve_warranty_claim_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','asset_context_access_denied','configure_compliance_policy_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','asset_context_access_denied','request_asset_decommission_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','asset_context_access_denied','get_asset_registration_choices_v1: member-expired');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','asset_context_access_denied','register_equipment_v1: member-expired');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'member-expired: all Assets tables and audit unchanged');

-- TEMPORAL: member-future
savepoint temporal_case;
update identity.memberships set starts_at=statement_timestamp()+interval '1 hour' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: member-future');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: member-future');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','asset_context_access_denied','create_asset_v1: member-future');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','asset_context_access_denied','update_asset_v1: member-future');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','asset_context_access_denied','transition_asset_lifecycle_v1: member-future');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','asset_context_access_denied','update_asset_operational_status_v1: member-future');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','asset_context_access_denied','start_asset_downtime_v1: member-future');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','asset_context_access_denied','end_asset_downtime_v1: member-future');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: member-future');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','asset_context_access_denied','record_asset_inspection_v1: member-future');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: member-future');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: member-future');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','asset_context_access_denied','upsert_asset_warranty_v1: member-future');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: member-future');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','asset_context_access_denied','create_warranty_claim_v1: member-future');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','asset_context_access_denied','resolve_warranty_claim_v1: member-future');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: member-future');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','asset_context_access_denied','configure_compliance_policy_v1: member-future');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','asset_context_access_denied','request_asset_decommission_v1: member-future');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: member-future');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','asset_context_access_denied','get_asset_registration_choices_v1: member-future');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','asset_context_access_denied','register_equipment_v1: member-future');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'member-future: all Assets tables and audit unchanged');

-- TEMPORAL: member-revoked
savepoint temporal_case;
update identity.memberships set status='revoked' where id=pg_temp.assets_probe_id(90);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.assets_probe_id(1),'role','authenticated','aal','aal2')::text,true);
select throws_ok(pg_temp.descriptor_command(1,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_assets_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(2,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_detail_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(3,100),'42501','ACCESS_DENIED: User context invalid or inactive','create_asset_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(4,100),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(5,100),'42501','ACCESS_DENIED: User context invalid or inactive','transition_asset_lifecycle_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(6,100),'42501','ACCESS_DENIED: User context invalid or inactive','update_asset_operational_status_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(7,100),'42501','ACCESS_DENIED: User context invalid or inactive','start_asset_downtime_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(8,100),'42501','ACCESS_DENIED: User context invalid or inactive','end_asset_downtime_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(9,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_asset_inspections_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(10,100),'42501','ACCESS_DENIED: User context invalid or inactive','record_asset_inspection_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(11,100),'42501','ACCESS_DENIED: User context invalid or inactive','verify_asset_inspection_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(12,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_warranty_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(13,100),'42501','ACCESS_DENIED: User context invalid or inactive','upsert_asset_warranty_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(14,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_warranty_claims_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(15,100),'42501','ACCESS_DENIED: User context invalid or inactive','create_warranty_claim_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(16,100),'42501','ACCESS_DENIED: User context invalid or inactive','resolve_warranty_claim_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(17,100),'42501','ACCESS_DENIED: User context invalid or inactive','list_compliance_policies_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(18,100),'42501','ACCESS_DENIED: User context invalid or inactive','configure_compliance_policy_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(19,100),'42501','ACCESS_DENIED: User context invalid or inactive','request_asset_decommission_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(20,100),'42501','ACCESS_DENIED: User context invalid or inactive','approve_asset_decommission_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(21,100),'42501','ACCESS_DENIED: User context invalid or inactive','get_asset_registration_choices_v1: member-revoked');
select throws_ok(pg_temp.descriptor_command(22,100),'42501','ACCESS_DENIED: User context invalid or inactive','register_equipment_v1: member-revoked');
reset role;
rollback to temporal_case;
select is(pg_temp.descriptor_state(),(select fingerprint from descriptor_baseline),'member-revoked: all Assets tables and audit unchanged');

select * from finish();
rollback;
