begin;
select plan(38);

-- Reuse the canonical AIRPROP fixture from test 135 with distinct IDs via a
-- transaction-local setup below. The role is published through the public API.
do $$
declare
  tenant_id uuid := '17000000-0000-0000-0000-000000000001';
  ws_id uuid := '17000000-0000-0000-0000-000000000100';
  prop_id uuid := '17000000-0000-0000-0000-000000001000';
  admin_id uuid := '17000000-0000-0000-0000-000000000010';
  old_id uuid := '17000000-0000-0000-0000-000000000020';
  next_id uuid := '17000000-0000-0000-0000-000000000030';
  admin_mem uuid := '17000000-0000-0000-0000-000001000001';
  old_mem uuid := '17000000-0000-0000-0000-000001000002';
  next_mem uuid := '17000000-0000-0000-0000-000001000003';
  admin_role uuid;
  owner_role uuid;
  result jsonb;
  role_id uuid;
begin
  insert into auth.users(id,email) values(admin_id,'handover_admin@test.local'),
    (old_id,'handover_old@test.local'),(next_id,'handover_next@test.local');
  insert into platform.tenants(id,legal_name,registration_number,status)
    values(tenant_id,'Handover tenant','RO-TEST-170','active');
  insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status)
    values(ws_id,tenant_id,'ASSOCIATION','Owner 170','PILOT','ACTIVE');
  insert into portfolio.properties(id,tenant_id,type,name,status)
    values(prop_id,tenant_id,'condominium','Handover property','active');
  insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source)
    values(tenant_id,ws_id,prop_id,'active','platform_assignment');
  insert into platform.workspace_taxonomy_assignments(
    tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
    select tenant_id,ws_id,p.id,o.id,'active',now()-interval '1 day',admin_id,'RO'
    from platform.property_profiles p cross join platform.operating_models o
    where p.code='residential_condominium' and p.version=1
      and o.code='association_managed' and o.version=1;
  select r.id into admin_role from identity.roles r where r.code='association_admin' and r.tenant_id is null limit 1;
  select r.id into owner_role from identity.roles r where r.code='owner' and r.tenant_id is null limit 1;
  insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
    values(admin_mem,tenant_id,admin_id,admin_role,'active',now()-interval '1 day'),
      (old_mem,tenant_id,old_id,owner_role,'active',now()-interval '1 day'),
      (next_mem,tenant_id,next_id,owner_role,'active',now()-interval '1 day');
  insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at)
    values('17000000-0000-0000-0000-000010000001',tenant_id,admin_mem,'property',prop_id,now()-interval '1 day'),
      ('17000000-0000-0000-0000-000010000002',tenant_id,old_mem,'property',prop_id,now()-interval '1 day'),
      ('17000000-0000-0000-0000-000010000003',tenant_id,next_mem,'property',prop_id,now()-interval '1 day');
  insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
    select tenant_id,ws_id,id,code,'active','Synthetic handover' from platform.module_definitions
      where code='airprop_commercial';
  insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
    values(ws_id,'module.airprop_commercial','boolean',true,now()-interval '1 day');
  -- The rollback-only fixture gives the grantor a strict authority superset;
  -- production role permissions are not changed by this test.
  insert into identity.role_permissions(role_id,permission_id,effect)
    select admin_role,p.id,'allow' from identity.permissions p
    where p.code in ('airprop.opportunity.read','airprop.opportunity.manage','airprop.underwriting.manage')
    on conflict(role_id,permission_id) do update set effect='allow';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  result := customer_api.create_workspace_role_draft_v1('17000000-0000-0000-0000-000010000001',
    'handover_reader','Handover reader','Synthetic role handover','property',null,
    'Synthetic role handover','handover_create_170');
  role_id := (result->>'id')::uuid;
  perform customer_api.attach_workspace_role_module_v1('17000000-0000-0000-0000-000010000001',
    role_id,(select id from platform.module_definitions where code='airprop_commercial'),1,
    'Synthetic module attachment','handover_module_170');
  perform customer_api.attach_workspace_role_permission_v1('17000000-0000-0000-0000-000010000001',
    role_id,(select id from identity.permissions where code='airprop.opportunity.read'),'allow',2,
    'Synthetic read attachment','handover_read_170');
  perform customer_api.publish_workspace_role_v1('17000000-0000-0000-0000-000010000001',role_id,3,
    'Synthetic publish role','handover_publish_170');
end;
$$;

select ok(not has_function_privilege('anon',
  'customer_api.handover_workspace_role_v1(uuid,uuid,integer,uuid,timestamptz,text,text)','execute'),
  'handover is not public');
select ok(not has_function_privilege('authenticated',
  'customer_api.assign_workspace_role_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text)','execute'),
  'old generic assignment entry point is closed to authenticated callers');
select ok(not has_function_privilege('authenticated',
  'customer_api.revoke_workspace_role_assignment_v1(uuid,uuid,integer,text,text)','execute'),
  'old generic revoke entry point is closed to authenticated callers');
select ok((select count(*)=3 from identity.role_permissions rp
  join identity.permissions p on p.id=rp.permission_id
  where rp.role_id=(select role_id from identity.memberships
    where id='17000000-0000-0000-0000-000001000001')
    and rp.effect='allow' and p.code in ('airprop.opportunity.read','airprop.opportunity.manage','airprop.underwriting.manage')),
  'manager has broader direct AIRPROP authority');
select lives_ok($$select customer_api.assign_workspace_role_v2(
  '17000000-0000-0000-0000-000010000001',null,'17000000-0000-0000-0000-000001000002',
  (select id from platform.workspace_roles where code='handover_reader'),
  'property','17000000-0000-0000-0000-000000001000',null,null,now()+interval '1 day','Synthetic first assignment','handover_assign_170')$$,
  'manager assigns old member');
select throws_ok($$select customer_api.handover_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001',
  (select id from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000002'),
  1,'17000000-0000-0000-0000-000001000003',now()+interval '2 days',
  'Synthetic excessive duration','handover_long_170')$$,'42501',
  'workspace_handover_expiry_exceeds_previous','successor expiry cannot exceed old grant');
update identity.context_grants set ends_at=now()+interval '6 hours'
  where id='17000000-0000-0000-0000-000010000003';
select throws_ok($$select customer_api.handover_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001',
  (select id from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000002'),
  1,'17000000-0000-0000-0000-000001000003',now()+interval '12 hours',
  'Synthetic excessive context duration','handover_context_170')$$,'42501',
  'workspace_handover_successor_context_required','successor context must cover the full term');
update identity.context_grants set ends_at=null
  where id='17000000-0000-0000-0000-000010000003';
select lives_ok($$select customer_api.handover_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001',
  (select id from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000002'),
  1,'17000000-0000-0000-0000-000001000003',now()+interval '12 hours',
  'Synthetic role transfer','handover_ok_170')$$,'manager transfers to successor');
select lives_ok($$select customer_api.handover_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001',
  (select id from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000002'),
  1,'17000000-0000-0000-0000-000001000003',now()+interval '12 hours',
  'Synthetic role transfer','handover_ok_170')$$,'exact retry returns saved result');
select ok((select count(*) from platform.workspace_member_roles where customer_workspace_id=
  '17000000-0000-0000-0000-000000000100')=2,'retry leaves two immutable assignments');
select ok((select valid_to<=statement_timestamp() from platform.workspace_member_roles where membership_id=
  '17000000-0000-0000-0000-000001000002'),'old assignment ended');
select ok((select assigned_by_membership_id='17000000-0000-0000-0000-000001000001'
  from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000003'),
  'new assignment retains manager attribution');
select ok((select count(*) from audit.events where action='WORKSPACE_ROLE_HANDED_OVER'
  and tenant_id='17000000-0000-0000-0000-000000000001')=1,'one transfer audit');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok(not app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000002','airprop.opportunity.read','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'previous member loses scoped permission');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000030","aal":"aal2"}',true);
select ok(app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000003','airprop.opportunity.read','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'successor gains scoped permission');
update identity.context_grants set ends_at=now()
  where id='17000000-0000-0000-0000-000010000001';
select ok(not app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000003','airprop.opportunity.read','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'successor loses permission when manager context ends');
update identity.context_grants set ends_at=null
  where id='17000000-0000-0000-0000-000010000001';
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select customer_api.renew_workspace_role_assignment_v1(
  '17000000-0000-0000-0000-000010000001',null,
  (select a.id from platform.workspace_member_roles a join platform.workspace_roles r
    on r.id=a.workspace_role_id where a.membership_id='17000000-0000-0000-0000-000001000003'
    and r.code='handover_reader' and a.valid_to>statement_timestamp()),
  1,now()+interval '18 hours','Synthetic bounded extension','handover_renew_170')$$,
  'manager renews successor term atomically');
select lives_ok($$select customer_api.renew_workspace_role_assignment_v1(
  '17000000-0000-0000-0000-000010000001',null,
  (select a.id from platform.workspace_member_roles a join platform.workspace_roles r
    on r.id=a.workspace_role_id where a.membership_id='17000000-0000-0000-0000-000001000003'
    and r.code='handover_reader' and a.valid_to<=statement_timestamp()),
  1,now()+interval '18 hours','Synthetic bounded extension','handover_renew_170')$$,
  'exact renewal retry returns stored result');
select ok((select count(*) from platform.workspace_member_roles a join platform.workspace_roles r
  on r.id=a.workspace_role_id where a.membership_id='17000000-0000-0000-0000-000001000003'
    and r.code='handover_reader' and a.valid_to>statement_timestamp())=1,
  'renewal leaves one active successor assignment');
select ok((select count(*) from audit.events where action='WORKSPACE_ROLE_RENEWED'
  and tenant_id='17000000-0000-0000-0000-000000000001')=1,'one renewal audit');
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
  ('17000000-0000-0000-0000-000010000011','17000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000001000001','tenant',now()-interval '1 day'),
  ('17000000-0000-0000-0000-000010000012','17000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000001000002','tenant',now()-interval '1 day'),
  ('17000000-0000-0000-0000-000010000013','17000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000001000003','tenant',now()-interval '1 day');
select lives_ok($flow$do $$
declare role_id uuid; result jsonb;
begin
  result := customer_api.create_workspace_role_draft_v1(
    '17000000-0000-0000-0000-000010000001','handover_native_reader',
    'Native handover reader','Synthetic workspace role','workspace',null,
    'Synthetic workspace role','handover_native_create_170');
  role_id := (result->>'id')::uuid;
  perform customer_api.attach_workspace_role_module_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from platform.module_definitions where code='airprop_commercial'),1,
    'Synthetic module attachment','handover_native_module_170');
  perform customer_api.attach_workspace_role_permission_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from identity.permissions where code='airprop.opportunity.read'),'allow',2,
    'Synthetic read attachment','handover_native_read_170');
  perform customer_api.attach_workspace_role_permission_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from identity.permissions where code='airprop.opportunity.manage'),'allow',3,
    'Synthetic manage attachment','handover_native_manage_170');
  perform customer_api.publish_workspace_role_v1(
    '17000000-0000-0000-0000-000010000001',role_id,4,
    'Synthetic publish role','handover_native_publish_170');
end; $$;$flow$,'publish native workspace role');
select ok(app_private.native_workspace_scope_for_membership_v2(
  '17000000-0000-0000-0000-000010000011','17000000-0000-0000-0000-000001000001',
  '17000000-0000-0000-0000-000000000100'),'manager holds native scope');
select lives_ok($$select customer_api.assign_workspace_role_v2(
  '17000000-0000-0000-0000-000010000001','17000000-0000-0000-0000-000010000011',
  '17000000-0000-0000-0000-000001000002',
  (select id from platform.workspace_roles where code='handover_native_reader'),
  'workspace',null,null,null,now()+interval '1 day',
  'Synthetic old native authority','handover_native_old_170')$$,'old member holds native scope');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select lives_ok($$select customer_api.create_airprop_opportunity_v2(
  '17000000-0000-0000-0000-000010000012','17000000-0000-0000-0000-000000000100',
  'handover_before_170',
  '{"name":"Before handover","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"12.3400"}')$$,
  'previous member records earlier action');
select ok((select created_by from airprop.investment_opportunities
  where tenant_id='17000000-0000-0000-0000-000000000001'
    and idempotency_key like '%/handover_before_170')='17000000-0000-0000-0000-000000000020',
  'earlier action remains attributed to previous member');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select customer_api.handover_workspace_role_v2(
  '17000000-0000-0000-0000-000010000001','17000000-0000-0000-0000-000010000011',
  (select a.id from platform.workspace_member_roles a join platform.workspace_roles r
    on r.id=a.workspace_role_id where a.membership_id='17000000-0000-0000-0000-000001000002'
    and r.code='handover_native_reader'),1,'17000000-0000-0000-0000-000001000003',
  now()+interval '12 hours','Synthetic native transfer','handover_native_ok_170')$$,
  'dual context transfers workspace scope');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2(
  '17000000-0000-0000-0000-000010000012'))=0,'old member loses native discovery');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000030","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2(
  '17000000-0000-0000-0000-000010000013'))=1,'successor gains native discovery');
select lives_ok($$select customer_api.create_airprop_opportunity_v2(
  '17000000-0000-0000-0000-000010000013','17000000-0000-0000-0000-000000000100',
  'handover_after_170',
  '{"name":"After handover","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"12.3400"}')$$,
  'successor records new action');
select ok((select created_by from airprop.investment_opportunities
  where tenant_id='17000000-0000-0000-0000-000000000001'
    and idempotency_key like '%/handover_after_170')='17000000-0000-0000-0000-000000000030',
  'new action belongs to successor');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($flow$do $$
declare role_id uuid; result jsonb;
begin
  result:=customer_api.create_workspace_role_draft_v1(
    '17000000-0000-0000-0000-000010000001','handover_composite',
    'Composite handover role','Synthetic combined permissions','property',null,
    'Synthetic combined permissions','handover_composite_create_170');
  role_id:=(result->>'id')::uuid;
  perform customer_api.attach_workspace_role_module_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from platform.module_definitions where code='airprop_commercial'),1,
    'Synthetic module attachment','handover_composite_module_170');
  perform customer_api.attach_workspace_role_permission_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from identity.permissions where code='airprop.opportunity.read'),'allow',2,
    'Synthetic read attachment','handover_composite_read_170');
  perform customer_api.attach_workspace_role_permission_v1(
    '17000000-0000-0000-0000-000010000001',role_id,
    (select id from identity.permissions where code='airprop.opportunity.manage'),'allow',3,
    'Synthetic manage attachment','handover_composite_manage_170');
  perform customer_api.publish_workspace_role_v1(
    '17000000-0000-0000-0000-000010000001',role_id,4,
    'Synthetic publish role','handover_composite_publish_170');
end; $$;$flow$,'publish role assembled from distinct manager sources');
select lives_ok($$select customer_api.assign_workspace_role_v2(
  '17000000-0000-0000-0000-000010000001',null,
  '17000000-0000-0000-0000-000001000002',
  (select id from platform.workspace_roles where code='handover_composite'),
  'property','17000000-0000-0000-0000-000000001000',null,null,now()+interval '12 hours',
  'Synthetic combined assignment','handover_composite_assign_170')$$,
  'manager grants role from two local authority sources');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok(app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000002','airprop.opportunity.manage','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'combined role initially grants manage');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000010","aal":"aal2"}',true);
update identity.role_permissions set effect='deny'
  where role_id=(select role_id from identity.memberships
    where id='17000000-0000-0000-0000-000001000001')
    and permission_id=(select id from identity.permissions where code='airprop.opportunity.manage');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok(not app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000002','airprop.opportunity.manage','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'reduced manager source removes manage');
select ok(app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000002','airprop.opportunity.read','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'remaining manager source retains read');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000030","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2(
  '17000000-0000-0000-0000-000010000013'))=0,'successor native scope ends with manager authority');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000010","aal":"aal2"}',true);
update identity.role_permissions set effect='deny'
  where role_id=(select role_id from identity.memberships
    where id='17000000-0000-0000-0000-000001000001')
    and permission_id=(select id from identity.permissions where code='airprop.opportunity.read');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000030","aal":"aal2"}',true);
select ok(not app_private.check_scoped_effective_permission_v1(
  '17000000-0000-0000-0000-000010000003','airprop.opportunity.read','airprop_commercial',
  'property','17000000-0000-0000-0000-000000001000'),'successor loses permission when manager authority ends');
select ok((select count(*) from platform.workspace_member_roles a join platform.workspace_roles r
  on r.id=a.workspace_role_id where a.membership_id=
  '17000000-0000-0000-0000-000001000002' and r.code='handover_reader'
  and a.assigned_by_user_id='17000000-0000-0000-0000-000000000010')=1,
  'historic assignment attribution survives');
select * from finish();
rollback;
