begin;
select plan(24);

select has_function('customer_api','read_airprop_management_portfolio_v1',array['uuid','uuid'],
 'AP08 current-authority management portfolio report exists');
select ok(has_function_privilege('authenticated',
 'customer_api.read_airprop_management_portfolio_v1(uuid,uuid)','EXECUTE'),
 'authenticated may execute report gateway');
select ok(not has_function_privilege('anon',
 'customer_api.read_airprop_management_portfolio_v1(uuid,uuid)','EXECUTE'),
 'anon cannot execute report gateway');
select ok(not has_function_privilege('service_role',
 'customer_api.read_airprop_management_portfolio_v1(uuid,uuid)','EXECUTE'),
 'service role cannot bypass actor context');
select is((select provolatile from pg_proc where oid=
 'customer_api.read_airprop_management_portfolio_v1(uuid,uuid)'::regprocedure),'s'::"char",
 'portfolio report is stable and read-only');

insert into auth.users(id,email) values
 ('17900000-0000-4000-8000-000000000001','report-reader-179@cladora.test'),
 ('17900000-0000-4000-8000-000000000002','report-outsider-179@cladora.test'),
 ('17900000-0000-4000-8000-000000000003','report-requester-179@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('17900000-0000-4000-8000-000000000004','Portfolio report tenant','AIRPROP-179','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('17900000-0000-4000-8000-000000000005','17900000-0000-4000-8000-000000000004',
  'ASSOCIATION','Portfolio report owner','PILOT','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('17900000-0000-4000-8000-000000000006','17900000-0000-4000-8000-000000000004',
  'condominium','Authorized managed property','active'),
 ('17900000-0000-4000-8000-000000000007','17900000-0000-4000-8000-000000000004',
  'condominium','Unauthorized managed property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
 ('17900000-0000-4000-8000-000000000008','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000006','B179','Authorized building','active');
insert into portfolio.units(id,tenant_id,building_id,code,status) values
 ('17900000-0000-4000-8000-000000000009','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000008','U179','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('17900000-0000-4000-8000-000000000010','17900000-0000-4000-8000-000000000004','person','Portfolio owner 179');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000005',
  '17900000-0000-4000-8000-000000000006','active','platform_assignment'),
 ('17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000005',
  '17900000-0000-4000-8000-000000000007','active','platform_assignment');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '17900000-0000-4000-8000-000000000011','17900000-0000-4000-8000-000000000004',
 '17900000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000011','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000005',
 p.id,o.id,'active',statement_timestamp()-interval '1 day','17900000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000005',
 id,code,'active','Portfolio report fixture' from platform.module_definitions
where code='airprop_commercial' and version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('17900000-0000-4000-8000-000000000005','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('17900000-0000-4000-8000-000000000013','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000005','report_reader_179','Report reader 179','workspace',
  '17900000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000013',id
from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000013',id,'allow'
from identity.permissions where code='airprop.asset.read';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='17900000-0000-4000-8000-000000000013';
insert into platform.workspace_member_roles(
 tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
 assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('17900000-0000-4000-8000-000000000004','17900000-0000-4000-8000-000000000005',
 '17900000-0000-4000-8000-000000000011','17900000-0000-4000-8000-000000000013','workspace',
 '17900000-0000-4000-8000-000000000001','17900000-0000-4000-8000-000000000011',
 'Portfolio report assignment',statement_timestamp()-interval '1 hour');

insert into airprop.management_mandate_requests(
 id,tenant_id,workspace_id,property_id,owner_party_id,scope,valid_from,valid_to,
 proposal_evidence_reference,status,requested_by,request_idempotency_key,request_hash,
 accepted_by,accepted_at,acceptance_evidence_reference,acceptance_idempotency_key,acceptance_hash)
values
 ('17900000-0000-4000-8000-000000000014','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000005','17900000-0000-4000-8000-000000000006',
  '17900000-0000-4000-8000-000000000010','{"capabilities":["owner_reporting","maintenance_coordination"]}',
  '2026-01-01','2027-01-01','urn:proposal:report-179','accepted',
  '17900000-0000-4000-8000-000000000003','report-request-179',repeat('1',64),
  '17900000-0000-4000-8000-000000000001',statement_timestamp(),'urn:acceptance:report-179',
  'report-accept-179',repeat('2',64)),
 ('17900000-0000-4000-8000-000000000015','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000005','17900000-0000-4000-8000-000000000007',
  '17900000-0000-4000-8000-000000000010','{"capabilities":["owner_reporting"]}',
  '2026-01-01','2027-01-01','urn:proposal:hidden-179','accepted',
  '17900000-0000-4000-8000-000000000003','report-hidden-request-179',repeat('3',64),
  '17900000-0000-4000-8000-000000000001',statement_timestamp(),'urn:acceptance:hidden-179',
  'report-hidden-accept-179',repeat('4',64)),
 ('17900000-0000-4000-8000-000000000016','17900000-0000-4000-8000-000000000004',
  '17900000-0000-4000-8000-000000000005','17900000-0000-4000-8000-000000000006',
  '17900000-0000-4000-8000-000000000010','{"capabilities":["owner_reporting"]}',
  '2025-01-01','2025-12-31','urn:proposal:expired-179','accepted',
  '17900000-0000-4000-8000-000000000003','report-expired-request-179',repeat('5',64),
  '17900000-0000-4000-8000-000000000001',statement_timestamp(),'urn:acceptance:expired-179',
  'report-expired-accept-179',repeat('6',64));
insert into maintenance.work_orders(
 id,tenant_id,property_id,building_id,unit_id,title,priority,status,scheduled_start,scheduled_end,created_by)
values('17900000-0000-4000-8000-000000000017','17900000-0000-4000-8000-000000000004',
 '17900000-0000-4000-8000-000000000006','17900000-0000-4000-8000-000000000008',
 '17900000-0000-4000-8000-000000000009','Canonical completed repair','normal','completed',
 statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day','17900000-0000-4000-8000-000000000001');
insert into airprop.management_action_links(
 id,tenant_id,workspace_id,mandate_request_id,property_id,unit_id,core_record_type,core_record_id,
 source_status_snapshot,linked_by,idempotency_key,request_hash)
values('17900000-0000-4000-8000-000000000018','17900000-0000-4000-8000-000000000004',
 '17900000-0000-4000-8000-000000000005','17900000-0000-4000-8000-000000000014',
 '17900000-0000-4000-8000-000000000006','17900000-0000-4000-8000-000000000009',
 'maintenance.work_order','17900000-0000-4000-8000-000000000017','scheduled',
 '17900000-0000-4000-8000-000000000001','report-action-179',repeat('7',64));
insert into platform.workspace_property_authorities(
 id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('17900000-0000-4000-8000-000000000019','17900000-0000-4000-8000-000000000004',
 '17900000-0000-4000-8000-000000000006','17900000-0000-4000-8000-000000000005',
 'property_operations','synthetic','test://report-authority-179',statement_timestamp()-interval '1 day');

select set_config('request.jwt.claims','{"sub":"17900000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')$$,
 '42501','workspace_native_context_access_denied','outsider is denied');
select set_config('request.jwt.claims','{"sub":"17900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')$$,
 '42501','mfa_required','AAL1 reader is denied');

select set_config('request.jwt.claims','{"sub":"17900000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is((customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')->>'version')::integer,
 1,'report returns contract version');
select is((customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')->>'idempotent')::boolean,
 true,'read response is current and replay-safe');
select is(jsonb_array_length(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')->'properties'),1,
 'only currently authorized property is returned');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,property,label}',
 'Authorized managed property','canonical property label is returned');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,owner,label}',
 'Portfolio owner 179','canonical owner label is returned');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,scope,capabilities,0}',
 'owner_reporting','bounded mandate scope is returned');
select is(jsonb_array_length(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>'{properties,0,action_links}'),1,
 'AIRPROP action reference is included');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,action_links,0,core_record_type}',
 'maintenance.work_order','report identifies the canonical Operations owner');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,action_links,0,core_record_id}',
 '17900000-0000-4000-8000-000000000017','report preserves canonical Operations reference');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{properties,0,action_links,0,source_status_snapshot}',
 'scheduled','report labels source status as the immutable AIRPROP snapshot');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{operations,mode}',
 'canonical_references_only','Operations live detail remains in Operations');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{finance,mode}',
 'not_connected','report does not fabricate Finance integration');
select is(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')#>>'{finance,reason}',
 'canonical_receipt_contract_unavailable','Finance blocker is explicit');
select ok(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')::text
 not like '%Unauthorized managed property%','unauthorized property label does not leak');
select ok(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')::text
 not like '%report-expired-request-179%','expired mandate is omitted');
select ok((select count(*)=0 from audit.events where tenant_id='17900000-0000-4000-8000-000000000004')
 and (select count(*)=0 from platform.outbox_events where tenant_id='17900000-0000-4000-8000-000000000004'),
 'read model creates no audit or outbox mutation');

update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Synthetic AP08 revoke'
where id='17900000-0000-4000-8000-000000000019';
select is(jsonb_array_length(customer_api.read_airprop_management_portfolio_v1(
 '17900000-0000-4000-8000-000000000012','17900000-0000-4000-8000-000000000005')->'properties'),0,
 'revoked Core property authority removes property immediately');

select * from finish();
rollback;
