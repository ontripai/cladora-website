begin;
select plan(39);

select has_schema('booking','BK01 owns a bounded booking schema');
select has_table('booking','capacity_policies','BK01 policy table exists');
select has_table('booking','capacity_holds','BK01 hold table exists');
select has_table('booking','request_receipts','BK01 immutable receipt table exists');
select ok((select relrowsecurity from pg_class where oid='booking.capacity_holds'::regclass),'BK01 holds use RLS');
select ok(not has_table_privilege('authenticated','booking.capacity_holds','SELECT'),'authenticated has no direct hold access');
select has_function('customer_api','command_amenity_capacity_v1',array['jsonb'],'BK01 exposes one bounded command RPC');
select has_function('customer_api','read_amenity_capacity_v1',array['uuid','uuid'],'C13 exposes one bounded read RPC');
select ok(has_function_privilege('authenticated','customer_api.command_amenity_capacity_v1(jsonb)','EXECUTE'),'authenticated may use the command gateway');
select ok(not has_function_privilege('service_role','customer_api.command_amenity_capacity_v1(jsonb)','EXECUTE'),'service role cannot bypass actor-bound booking');
select alike(pg_get_functiondef('customer_api.command_amenity_capacity_v1(jsonb)'::regprocedure),'%check_workspace_native_permission_v2%','BK01 consumes current AUTH01');
select alike(pg_get_functiondef('customer_api.command_amenity_capacity_v1(jsonb)'::regprocedure),'%resolve_canonical_resource_reference_v1%','BK01 consumes DW02 canonical Unit');
select is((select count(*) from platform.workspace_modules where module_code='booking'),0::bigint,'migration registers but does not activate booking');

insert into auth.users(id,email,email_confirmed_at) values
 ('13010000-0000-4000-8000-000000000001','bk01-actor@cladora.test',statement_timestamp()),
 ('13010000-0000-4000-8000-000000000101','bk01-other@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('13010000-0000-4000-8000-000000000002','BK01 tenant','BK01-A','active'),
 ('13010000-0000-4000-8000-000000000102','Foreign tenant','BK01-B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('13010000-0000-4000-8000-000000000003','13010000-0000-4000-8000-000000000002','condominium','BK01 property','active'),
 ('13010000-0000-4000-8000-000000000103','13010000-0000-4000-8000-000000000102','condominium','Foreign property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('13010000-0000-4000-8000-000000000004','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000003','A','Amenities'),
 ('13010000-0000-4000-8000-000000000104','13010000-0000-4000-8000-000000000102','13010000-0000-4000-8000-000000000103','B','Foreign');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('13010000-0000-4000-8000-000000000005','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000004','COMMUNITY-ROOM'),
 ('13010000-0000-4000-8000-000000000105','13010000-0000-4000-8000-000000000102','13010000-0000-4000-8000-000000000104','FOREIGN-ROOM');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('13010000-0000-4000-8000-000000000007','13010000-0000-4000-8000-000000000002','ASSOCIATION','BK01 operator','ACTIVE'),
 ('13010000-0000-4000-8000-000000000107','13010000-0000-4000-8000-000000000102','ASSOCIATION','Foreign operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '13010000-0000-4000-8000-000000000008','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000001',r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r where r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('13010000-0000-4000-8000-000000000009','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000008','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000007',p.id,o.id,'active',statement_timestamp()-interval '1 day','13010000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_complex' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,activated_at,activated_by,reason)
select '13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000007',m.id,m.code,'active',statement_timestamp()-interval '1 day',statement_timestamp()-interval '1 day','13010000-0000-4000-8000-000000000001','BK01 test fixture'
from platform.module_definitions m where m.code in('booking','core_unit_identity');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('13010000-0000-4000-8000-000000000007','module.booking','boolean',true,statement_timestamp()-interval '1 day'),
 ('13010000-0000-4000-8000-000000000007','module.core_unit_identity','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('13010000-0000-4000-8000-000000000010','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000007','amenity_member','Amenity member','workspace','13010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000010',m.id
from platform.module_definitions m where m.code in('booking','core_unit_identity');
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000010',p.id,'allow'
from identity.permissions p where p.code in('booking.capacity.read','booking.capacity.request','core.units.identity.read');
update platform.workspace_roles set lifecycle_status='published',lock_version=2 where id='13010000-0000-4000-8000-000000000010';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from) values
 ('13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000007','13010000-0000-4000-8000-000000000008','13010000-0000-4000-8000-000000000010','workspace','13010000-0000-4000-8000-000000000001','13010000-0000-4000-8000-000000000008','BK01 authority',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities(id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from) values
 ('13010000-0000-4000-8000-000000000011','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000003','13010000-0000-4000-8000-000000000007','property_operations','fixture','test://bk01/mandate',statement_timestamp()-interval '1 day');
insert into portfolio.unit_specification_versions(tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by,customer_workspace_id) values
 ('13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000005',1,'13010000-0000-4000-8000-000000000004','COMMUNITY-ROOM','test://bk01/unit/v1','13010000-0000-4000-8000-000000000001','13010000-0000-4000-8000-000000000007');
insert into booking.capacity_policies(id,tenant_id,workspace_id,labels,timezone,capacity_unit,total_capacity,hold_ttl_seconds,conflict_mode,resource_id,resource_version,valid_from,created_by) values
 ('13010000-0000-4000-8000-000000000012','13010000-0000-4000-8000-000000000002','13010000-0000-4000-8000-000000000007','{"ro":"Sala comună","en":"Community room","fa":"سالن مشترک"}','Europe/Bucharest','persons',2,300,'counted_capacity','13010000-0000-4000-8000-000000000005',1,statement_timestamp()-interval '1 day','13010000-0000-4000-8000-000000000001');

create temporary table bk01_requests(name text primary key,payload jsonb) on commit drop;
insert into bk01_requests values('first',jsonb_build_object(
 'contract_version','shared-capacity-allocation-receipt.v1','request_id','13010000-0000-4000-8000-000000000020','idempotency_key','bk01-first-001',
 'context_id','13010000-0000-4000-8000-000000000009','workspace_id','13010000-0000-4000-8000-000000000007',
 'source',jsonb_build_object('consumer_domain','community','consumer_entity_type','amenity_reservation','consumer_entity_id','13010000-0000-4000-8000-000000000021','consumer_version',1),
 'policy_id','13010000-0000-4000-8000-000000000012','expected_policy_version',1,'requested_at','2026-10-19T22:30:00Z','action','request_hold',
 'window',jsonb_build_object('requested_start','2026-10-21T10:00:00+03:00','requested_end','2026-10-21T11:00:00+03:00','requested_capacity',1,
  'resources',jsonb_build_array(jsonb_build_object('contract_version','canonical-resource-reference.v1','context_id','13010000-0000-4000-8000-000000000009','workspace_id','13010000-0000-4000-8000-000000000007','resource_type','unit','resource_id','13010000-0000-4000-8000-000000000005','resource_version',1,'permission_code','core.units.identity.read','purpose','core.unit_identity.history')))));
insert into bk01_requests
select 'second',jsonb_set(jsonb_set(jsonb_set(jsonb_set(payload,'{request_id}','"13010000-0000-4000-8000-000000000022"'),'{idempotency_key}','"bk01-second-001"'),'{source,consumer_entity_id}','"13010000-0000-4000-8000-000000000023"'),'{window,requested_capacity}','1') from bk01_requests where name='first';
insert into bk01_requests
select 'denied',jsonb_set(jsonb_set(jsonb_set(payload,'{request_id}','"13010000-0000-4000-8000-000000000024"'),'{idempotency_key}','"bk01-denied-001"'),'{source,consumer_entity_id}','"13010000-0000-4000-8000-000000000025"') from bk01_requests where name='first';
insert into bk01_requests
select 'adjacent',jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(payload,'{request_id}','"13010000-0000-4000-8000-000000000026"'),'{idempotency_key}','"bk01-adjacent-001"'),'{source,consumer_entity_id}','"13010000-0000-4000-8000-000000000027"'),'{window,requested_start}','"2026-10-21T11:00:00+03:00"'),'{window,requested_end}','"2026-10-21T12:00:00+03:00"') from bk01_requests where name='first';

select throws_ok($$select customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='first'))$$,'42501','booking_capacity_access_denied','unauthenticated mutation is denied');
select set_config('request.jwt.claims','{"sub":"13010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_amenity_capacity_v1('13010000-0000-4000-8000-000000000009','13010000-0000-4000-8000-000000000007')->'policies'),1,'C13 reads one verified amenity policy');
select throws_ok($$select customer_api.read_amenity_capacity_v1('13010000-0000-4000-8000-000000000009','13010000-0000-4000-8000-000000000107')$$,'42501',null,'cross-tenant Workspace read is denied');
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='first'))->>'decision_status','verified','first counted-capacity hold is verified');
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='second'))->>'decision_status','verified','remaining counted capacity is allocatable');
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='denied'))->>'decision_status','denied','over-capacity overlap is denied');
select is((select count(*) from booking.capacity_holds),2::bigint,'denied overlap creates zero hold writes');
select ok(not ((select receipt from booking.request_receipts where request_id='13010000-0000-4000-8000-000000000024')->'conflicts'->0 ?| array['source_entity_id','created_by','requested_by']),'conflict disclosure contains no competing party or source');
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='adjacent'))->>'decision_status','verified','adjacent half-open interval does not conflict');
select is((select count(*) from booking.capacity_holds),3::bigint,'adjacent acceptance creates exactly one additional hold');
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='first'))->>'receipt_id',(select id::text from booking.request_receipts where request_id='13010000-0000-4000-8000-000000000020'),'exact retry replays the same receipt');
select is((select count(*) from booking.capacity_holds),3::bigint,'exact replay creates no duplicate hold');
select throws_ok($$select customer_api.command_amenity_capacity_v1(jsonb_set((select payload from bk01_requests where name='first'),'{window,requested_capacity}','2'))$$,'23505','booking_capacity_idempotency_conflict','changed replay fingerprint fails closed');

insert into bk01_requests
select 'confirm',jsonb_build_object('contract_version','shared-capacity-allocation-receipt.v1','request_id','13010000-0000-4000-8000-000000000030','idempotency_key','bk01-confirm-001','context_id','13010000-0000-4000-8000-000000000009','workspace_id','13010000-0000-4000-8000-000000000007','source',payload->'source','policy_id','13010000-0000-4000-8000-000000000012','expected_policy_version',1,'requested_at','2026-10-19T22:31:00Z','action','confirm_hold','hold_id',(select id from booking.capacity_holds where source_entity_id='13010000-0000-4000-8000-000000000021'),'expected_hold_version',1) from bk01_requests where name='first';
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='confirm'))->>'hold_state','confirmed','held capacity can be confirmed');
select is((select version from booking.capacity_holds where source_entity_id='13010000-0000-4000-8000-000000000021'),2,'confirm increments hold version');
insert into bk01_requests
select 'stale-confirm',jsonb_set(jsonb_set(payload,'{request_id}','"13010000-0000-4000-8000-000000000031"'),'{idempotency_key}','"bk01-stale-confirm-001"') from bk01_requests where name='confirm';
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='stale-confirm'))->>'decision_status','stale','stale hold version returns bounded stale receipt');
select is((select version from booking.capacity_holds where source_entity_id='13010000-0000-4000-8000-000000000021'),2,'stale command leaves hold unchanged');
insert into bk01_requests
select 'release',jsonb_build_object('contract_version','shared-capacity-allocation-receipt.v1','request_id','13010000-0000-4000-8000-000000000032','idempotency_key','bk01-release-001','context_id','13010000-0000-4000-8000-000000000009','workspace_id','13010000-0000-4000-8000-000000000007','source',payload->'source','policy_id','13010000-0000-4000-8000-000000000012','expected_policy_version',1,'requested_at','2026-10-19T22:32:00Z','action','release','hold_id',(select id from booking.capacity_holds where source_entity_id='13010000-0000-4000-8000-000000000021'),'expected_hold_version',2,'reason_code','customer_release') from bk01_requests where name='first';
select is(customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='release'))->>'hold_state','released','confirmed hold can be released');
select is((select count(*) from audit.events where action='booking.capacity.verified'),5::bigint,'verified transitions create audit evidence');
select is((select count(*) from platform.outbox_events where event_type='booking.capacity.denied'),1::bigint,'denial creates bounded outbox evidence');

update booking.capacity_holds set expires_at=statement_timestamp()-interval '1 second'
where source_entity_id='13010000-0000-4000-8000-000000000023';
select is(jsonb_array_length(customer_api.read_amenity_capacity_v1('13010000-0000-4000-8000-000000000009','13010000-0000-4000-8000-000000000007')->'my_holds'),3,'C13 projection returns only caller-owned holds');
select is((select state from booking.capacity_holds where source_entity_id='13010000-0000-4000-8000-000000000023'),'expired','read enforces logical expiry without a worker');
select throws_ok($$update booking.request_receipts set receipt=receipt where request_id='13010000-0000-4000-8000-000000000020'$$,'42501','booking_request_receipt_immutable','receipt update is blocked');
select throws_ok($$delete from booking.request_receipts where request_id='13010000-0000-4000-8000-000000000020'$$,'42501','booking_request_receipt_immutable','receipt deletion is blocked');

update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id='13010000-0000-4000-8000-000000000009';
select throws_ok($$select customer_api.command_amenity_capacity_v1((select payload from bk01_requests where name='release'))$$,'42501',null,'accepted receipt cannot replay after AUTH01 revoke');
select is((select count(*) from booking.capacity_holds),3::bigint,'revoked replay makes no hold write');

select * from finish();
rollback;
