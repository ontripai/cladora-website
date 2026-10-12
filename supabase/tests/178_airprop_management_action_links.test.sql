begin;
select plan(28);

select has_table('airprop','management_action_links','AP07 management action receipt exists');
select has_function('customer_api','link_airprop_management_work_order_v1',
 array['uuid','uuid','uuid','uuid','text'],'bounded Operations reference RPC exists');
select is((select relrowsecurity from pg_class where oid='airprop.management_action_links'::regclass),true,
 'management action receipts use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop'
 and table_name='management_action_links' and grantee in('anon','authenticated','service_role')),0::bigint,
 'no API role has direct table grants');
select ok(has_function_privilege('authenticated',
 'customer_api.link_airprop_management_work_order_v1(uuid,uuid,uuid,uuid,text)','EXECUTE'),
 'authenticated may execute bounded link gateway');
select ok(not has_function_privilege('anon',
 'customer_api.link_airprop_management_work_order_v1(uuid,uuid,uuid,uuid,text)','EXECUTE'),
 'anon cannot execute link gateway');
select is((select count(*) from pg_trigger where tgrelid='airprop.management_action_links'::regclass
 and tgname='immutable_airprop_management_action_link' and not tgisinternal),1::bigint,
 'management action receipt is immutable');
select is((select count(*) from pg_constraint where conrelid='airprop.management_action_links'::regclass
 and confrelid='maintenance.work_orders'::regclass and contype='f'),1::bigint,
 'receipt has one canonical Operations work-order reference');
select ok(not has_function_privilege('authenticated',
 'app_private.guard_airprop_management_action_link_v1()','EXECUTE'),
 'table guard is private');

insert into auth.users(id,email) values
 ('17800000-0000-4000-8000-000000000001','action-actor-178@cladora.test'),
 ('17800000-0000-4000-8000-000000000002','action-requester-178@cladora.test'),
 ('17800000-0000-4000-8000-000000000003','action-outsider-178@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17800000-0000-4000-8000-000000000004','Management action tenant','AIRPROP-178','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17800000-0000-4000-8000-000000000005','17800000-0000-4000-8000-000000000004',
  'ASSOCIATION','Management action owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17800000-0000-4000-8000-000000000006','17800000-0000-4000-8000-000000000004',
  'condominium','Managed property 178','active'),
 ('17800000-0000-4000-8000-000000000007','17800000-0000-4000-8000-000000000004',
  'condominium','Other property 178','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17800000-0000-4000-8000-000000000008','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000006','B178','Managed building 178','active'),
 ('17800000-0000-4000-8000-000000000009','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000007','B178X','Other building 178','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17800000-0000-4000-8000-000000000010','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000008','U178','active'),
 ('17800000-0000-4000-8000-000000000011','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000009','U178X','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17800000-0000-4000-8000-000000000012','17800000-0000-4000-8000-000000000004','person','Owner 178');
insert into portfolio.ownerships(id,tenant_id,unit_id,party_id,share,valid_from) values
 ('17800000-0000-4000-8000-000000000013','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000010','17800000-0000-4000-8000-000000000012',1,'2026-01-01');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000005',
  '17800000-0000-4000-8000-000000000006','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17800000-0000-4000-8000-000000000014','17800000-0000-4000-8000-000000000004',
 '17800000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000014','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000005',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17800000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000005',
 id,code,'active','Management action fixture' from platform.module_definitions
where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17800000-0000-4000-8000-000000000005','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17800000-0000-4000-8000-000000000016','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000005','action_manager_178','Action manager 178','workspace',
  '17800000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000016',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000016',id,'allow'
from identity.permissions where code='airprop.asset.manage';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='17800000-0000-4000-8000-000000000016';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17800000-0000-4000-8000-000000000004','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000014','17800000-0000-4000-8000-000000000016','workspace',
 '17800000-0000-4000-8000-000000000001','17800000-0000-4000-8000-000000000014',
 'Management action assignment',statement_timestamp()-interval '1 hour');

insert into airprop.management_mandate_requests(
 id,tenant_id,workspace_id,property_id,owner_party_id,scope,valid_from,valid_to,
 proposal_evidence_reference,status,requested_by,request_idempotency_key,request_hash,
 accepted_by,accepted_at,acceptance_evidence_reference,acceptance_idempotency_key,acceptance_hash)
values
 ('17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000005','17800000-0000-4000-8000-000000000006',
  '17800000-0000-4000-8000-000000000012','{"capabilities":["maintenance_coordination"]}',
  '2026-01-01','2027-01-01','urn:proposal:action-178','accepted',
  '17800000-0000-4000-8000-000000000002','request-action-178',repeat('1',64),
  '17800000-0000-4000-8000-000000000001',statement_timestamp(),'urn:acceptance:action-178',
  'accept-action-178',repeat('2',64)),
 ('17800000-0000-4000-8000-000000000018','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000005','17800000-0000-4000-8000-000000000006',
  '17800000-0000-4000-8000-000000000012','{"capabilities":["maintenance_coordination"]}',
  '2026-01-01','2027-01-01','urn:proposal:action-second-178','accepted',
  '17800000-0000-4000-8000-000000000002','request-action-second-178',repeat('3',64),
  '17800000-0000-4000-8000-000000000001',statement_timestamp(),'urn:acceptance:action-second-178',
  'accept-action-second-178',repeat('4',64));
insert into maintenance.work_orders(
 id,tenant_id,property_id,building_id,unit_id,title,priority,status,scheduled_start,scheduled_end,created_by)
values
 ('17800000-0000-4000-8000-000000000019','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000006','17800000-0000-4000-8000-000000000008',
  '17800000-0000-4000-8000-000000000010','Scheduled repair 178','normal','scheduled',
  statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days','17800000-0000-4000-8000-000000000001'),
 ('17800000-0000-4000-8000-000000000020','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000006','17800000-0000-4000-8000-000000000008',
  '17800000-0000-4000-8000-000000000010','Draft repair 178','normal','draft',null,null,
  '17800000-0000-4000-8000-000000000001'),
 ('17800000-0000-4000-8000-000000000021','17800000-0000-4000-8000-000000000004',
  '17800000-0000-4000-8000-000000000007','17800000-0000-4000-8000-000000000009',
  '17800000-0000-4000-8000-000000000011','Foreign property repair 178','normal','scheduled',
  statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days','17800000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"17800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','short')$$,
 '22023','airprop_management_action_invalid','malformed idempotency key is rejected');
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','action-no-authority-178')$$,
 '42501','airprop_management_action_access_denied','accepted contract alone grants no software authority');

insert into platform.workspace_property_authorities(
 id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17800000-0000-4000-8000-000000000022','17800000-0000-4000-8000-000000000004',
 '17800000-0000-4000-8000-000000000006','17800000-0000-4000-8000-000000000005',
 'property_operations','synthetic','test://operations-authority-178',statement_timestamp()-interval '1 day');

select set_config('request.jwt.claims','{"sub":"17800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','action-outsider-178')$$,
 '42501','workspace_native_context_access_denied','outsider is denied');

select set_config('request.jwt.claims','{"sub":"17800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000020','action-draft-178')$$,
 '22023','airprop_management_action_core_mismatch','draft work order is not an actionable source');
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000021','action-property-mismatch-178')$$,
 '22023','airprop_management_action_core_mismatch','foreign property work order is rejected');
select lives_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','action-create-178')$$,
 'authorized canonical work order reference succeeds');
select ok((select core_record_type='maintenance.work_order'
 and core_record_id='17800000-0000-4000-8000-000000000019'
 and property_id='17800000-0000-4000-8000-000000000006'
 and unit_id='17800000-0000-4000-8000-000000000010' and source_status_snapshot='scheduled'
 from airprop.management_action_links where idempotency_key='action-create-178'),
 'receipt preserves exact canonical subject and source status');
select is((select count(*) from audit.events where tenant_id='17800000-0000-4000-8000-000000000004'
 and action='AIRPROP_MANAGEMENT_WORK_ORDER_LINKED'),1::bigint,'link uses shared audit');
select ok((select status='scheduled' from maintenance.work_orders where id='17800000-0000-4000-8000-000000000019')
 and (select count(*)=0 from maintenance.work_order_events where tenant_id='17800000-0000-4000-8000-000000000004'),
 'AIRPROP does not mutate Operations work order or events');
select ok((select count(*)=0 from service_catalog.requests where tenant_id='17800000-0000-4000-8000-000000000004')
 and (select count(*)=0 from platform.outbox_events where tenant_id='17800000-0000-4000-8000-000000000004')
 and (select count(*)=0 from maintenance.vendor_payables where tenant_id='17800000-0000-4000-8000-000000000004'),
 'link creates no SERVICE request, outbox or Finance payable');
select is((customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','action-create-178')->>'idempotent')::boolean,
 true,'exact replay is idempotent');
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000018','17800000-0000-4000-8000-000000000019','action-create-178')$$,
 '23505','airprop_management_action_idempotency_conflict','changed replay conflicts');
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000018','17800000-0000-4000-8000-000000000019','action-second-key-178')$$,
 '23505','airprop_management_action_conflict','canonical work order cannot be linked twice');
select throws_ok($$update airprop.management_action_links set source_status_snapshot='completed'
 where idempotency_key='action-create-178'$$,
 '42501','airprop_management_action_link_immutable','receipt cannot be edited');
select throws_ok($$delete from airprop.management_action_links where idempotency_key='action-create-178'$$,
 '42501','airprop_management_action_link_immutable','receipt cannot be deleted');

update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Synthetic AP07 revoke'
where id='17800000-0000-4000-8000-000000000022';
select throws_ok($$select customer_api.link_airprop_management_work_order_v1(
 '17800000-0000-4000-8000-000000000015','17800000-0000-4000-8000-000000000005',
 '17800000-0000-4000-8000-000000000017','17800000-0000-4000-8000-000000000019','action-create-178')$$,
 '42501','airprop_management_action_access_denied','exact replay rechecks revoked operations authority');
select ok((select count(*)=1 from airprop.management_action_links where tenant_id='17800000-0000-4000-8000-000000000004')
 and (select status='scheduled' from maintenance.work_orders where id='17800000-0000-4000-8000-000000000019'),
 'denied replay preserves one receipt and canonical work order');
select is((select count(*) from audit.events where tenant_id='17800000-0000-4000-8000-000000000004'
 and action='AIRPROP_MANAGEMENT_WORK_ORDER_LINKED'),1::bigint,'replay and conflicts do not duplicate audit');
select ok((select count(*)=0 from maintenance.vendor_payables where tenant_id='17800000-0000-4000-8000-000000000004')
 and (select count(*)=0 from service_catalog.requests where tenant_id='17800000-0000-4000-8000-000000000004'),
 'revocation and conflict create no downstream order or payable');

select * from finish();
rollback;
