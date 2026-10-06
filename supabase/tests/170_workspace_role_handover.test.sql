begin;
select plan(12);

-- Reuse the canonical AIRPROP fixture from test 135 with distinct IDs via a
-- transaction-local setup below. The role is published through the public API.
do $$
declare
  tenant_id uuid := '17000000-0000-0000-0000-000000000001';
  ws_id uuid := '17000000-0000-0000-0000-000000000100';
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
  select id into admin_role from identity.roles where code='association_admin' and tenant_id is null limit 1;
  select id into owner_role from identity.roles where code='owner' and tenant_id is null limit 1;
  insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
    values(admin_mem,tenant_id,admin_id,admin_role,'active',now()-interval '1 day'),
      (old_mem,tenant_id,old_id,owner_role,'active',now()-interval '1 day'),
      (next_mem,tenant_id,next_id,owner_role,'active',now()-interval '1 day');
  insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at)
    values('17000000-0000-0000-0000-000010000001',tenant_id,admin_mem,'tenant',now()-interval '1 day'),
      ('17000000-0000-0000-0000-000010000002',tenant_id,old_mem,'tenant',now()-interval '1 day'),
      ('17000000-0000-0000-0000-000010000003',tenant_id,next_mem,'tenant',now()-interval '1 day');
  insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
    select tenant_id,ws_id,id,code,'active','Synthetic handover' from platform.module_definitions
      where code='airprop_commercial';
  insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
    values(ws_id,'module.airprop_commercial','boolean',true,now()-interval '1 day');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  result := customer_api.create_workspace_role_draft_v1('17000000-0000-0000-0000-000010000001',
    'handover_reader','Handover reader','Synthetic role handover','workspace',null,
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
select lives_ok($$select customer_api.assign_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001','17000000-0000-0000-0000-000001000002',
  (select id from platform.workspace_roles where code='handover_reader'),
  'workspace',null,null,null,now()+interval '1 day','Synthetic first assignment','handover_assign_170')$$,
  'manager assigns old member');
select throws_ok($$select customer_api.handover_workspace_role_v1(
  '17000000-0000-0000-0000-000010000001',
  (select id from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000002'),
  1,'17000000-0000-0000-0000-000001000003',now()+interval '2 days',
  'Synthetic excessive duration','handover_long_170')$$,'42501',
  'workspace_handover_expiry_exceeds_previous','successor expiry cannot exceed old grant');
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
  '17000000-0000-0000-0000-000000000100')=2,'retry leaves exactly two immutable assignments');
select ok((select valid_to<=statement_timestamp() from platform.workspace_member_roles where membership_id=
  '17000000-0000-0000-0000-000001000002'),'old assignment ended');
select ok((select assigned_by_membership_id='17000000-0000-0000-0000-000001000001'
  from platform.workspace_member_roles where membership_id='17000000-0000-0000-0000-000001000003'),
  'new assignment retains manager attribution');
select ok((select count(*) from audit.events where action='WORKSPACE_ROLE_HANDED_OVER'
  and tenant_id='17000000-0000-0000-0000-000000000001')=1,'one transfer audit');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2(
  '17000000-0000-0000-0000-000010000002'))=0,'previous member loses discovery');
select set_config('request.jwt.claims',
  '{"sub":"17000000-0000-0000-0000-000000000030","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2(
  '17000000-0000-0000-0000-000010000003'))=1,'successor gains workspace discovery');
select ok((select count(*) from platform.workspace_member_roles where membership_id=
  '17000000-0000-0000-0000-000001000002' and assigned_by_user_id=
  '17000000-0000-0000-0000-000000000010')=1,'historic assignment attribution survives');
select * from finish();
rollback;
