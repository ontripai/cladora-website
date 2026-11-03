begin;
select plan(31);

select has_table('communications','request_receipts','COM01 has one additive durable receipt table');
select ok((select relrowsecurity from pg_class where oid='communications.request_receipts'::regclass),'receipt table has RLS');
select ok(not has_table_privilege('authenticated','communications.request_receipts','SELECT'),'clients cannot read receipt storage directly');
select ok(not has_table_privilege('service_role','communications.request_receipts','SELECT'),'service role cannot bypass receipt gateway');
select has_function('customer_api','create_private_conversation_v2',array['jsonb'],'#166 exposes one bounded Workspace writer');
select ok((select prosecdef from pg_proc where oid='customer_api.create_private_conversation_v2(jsonb)'::regprocedure),'writer is security definer');
select ok(has_function_privilege('authenticated','customer_api.create_private_conversation_v2(jsonb)','EXECUTE'),'authenticated may use v2 gateway');
select ok(not has_function_privilege('anon','customer_api.create_private_conversation_v2(jsonb)','EXECUTE'),'anon cannot create conversations');
select ok(not has_function_privilege('service_role','customer_api.create_private_conversation_v2(jsonb)','EXECUTE'),'service role cannot impersonate a customer');
select ok(not has_function_privilege('authenticated','customer_api.create_private_conversation_v1(uuid,uuid,uuid,text,uuid)','EXECUTE'),'pre-Workspace writer is closed');
select alike(pg_get_functiondef('customer_api.create_private_conversation_v2(jsonb)'::regprocedure),'%check_workspace_native_permission_v2%','writer consumes current AUTH01');
select alike(pg_get_functiondef('customer_api.create_private_conversation_v2(jsonb)'::regprocedure),'%private_pair_allowed%','writer reuses existing pair policy');
select alike(pg_get_functiondef('customer_api.create_private_conversation_v2(jsonb)'::regprocedure),'%private_conversation_workspace_writer_v1%','writer passes the existing D5 guard');

insert into auth.users(id,email,email_confirmed_at) values
 ('c0010000-0000-4000-8000-000000000001','com01-actor@cladora.test',statement_timestamp()),
 ('c0010000-0000-4000-8000-000000000002','com01-recipient@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('c0010000-0000-4000-8000-000000000003','COM01 tenant','COM01-A','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('c0010000-0000-4000-8000-000000000004','c0010000-0000-4000-8000-000000000003','condominium','COM01 property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('c0010000-0000-4000-8000-000000000005','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000004','A','COM01 building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('c0010000-0000-4000-8000-000000000006','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000005','A-01');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('c0010000-0000-4000-8000-000000000007','c0010000-0000-4000-8000-000000000003','ASSOCIATION','COM01 operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select 'c0010000-0000-4000-8000-000000000008','c0010000-0000-4000-8000-000000000003',
 'c0010000-0000-4000-8000-000000000001',r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r where r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select 'c0010000-0000-4000-8000-000000000009','c0010000-0000-4000-8000-000000000003',
 'c0010000-0000-4000-8000-000000000002',r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r where r.code='property_manager' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('c0010000-0000-4000-8000-000000000010','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000008','tenant',null,statement_timestamp()-interval '1 day'),
 ('c0010000-0000-4000-8000-000000000011','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000009','property','c0010000-0000-4000-8000-000000000004',statement_timestamp()-interval '1 day'),
 ('c0010000-0000-4000-8000-000000000014','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000008','property','c0010000-0000-4000-8000-000000000004',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select 'c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000007',p.id,m.id,'active',statement_timestamp()-interval '1 day','c0010000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models m
where p.code='residential_condominium' and p.version=1 and m.code='association_managed' and m.version=1;
insert into platform.workspace_property_bindings(id,tenant_id,customer_workspace_id,property_id,status,valid_from,binding_source,created_by) values
 ('c0010000-0000-4000-8000-000000000012','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000007','c0010000-0000-4000-8000-000000000004','active',statement_timestamp()-interval '1 day','migration_verified','c0010000-0000-4000-8000-000000000001');
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,activated_at,activated_by,reason)
select 'c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000007',m.id,m.code,'active',statement_timestamp()-interval '1 day',statement_timestamp()-interval '1 day','c0010000-0000-4000-8000-000000000001','COM01 fixture'
from platform.module_definitions m where m.code='communications';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('c0010000-0000-4000-8000-000000000007','module.communications','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values
 ('c0010000-0000-4000-8000-000000000013','c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000007','com01_member','COM01 member','workspace','c0010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select 'c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000013',m.id
from platform.module_definitions m where m.code='communications';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select 'c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000013',p.id,'allow'
from identity.permissions p where p.code='communications.feed.read';
update platform.workspace_roles set lifecycle_status='published',lock_version=2 where id='c0010000-0000-4000-8000-000000000013';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from) values
 ('c0010000-0000-4000-8000-000000000003','c0010000-0000-4000-8000-000000000007','c0010000-0000-4000-8000-000000000008','c0010000-0000-4000-8000-000000000013','workspace','c0010000-0000-4000-8000-000000000001','c0010000-0000-4000-8000-000000000008','COM01 actor fixture',statement_timestamp()-interval '1 hour');

create temporary table com01_request(payload jsonb) on commit drop;
insert into com01_request values(jsonb_build_object(
 'contract_version','communications-private-conversation-workspace.v1',
 'context_id','c0010000-0000-4000-8000-000000000010','workspace_id','c0010000-0000-4000-8000-000000000007',
 'conversation_id','c0010000-0000-4000-8000-000000000020','unit_id','c0010000-0000-4000-8000-000000000006',
 'recipient_membership_id','c0010000-0000-4000-8000-000000000009','initial_message_id','c0010000-0000-4000-8000-000000000021',
 'body','COM01 canonical first message','client_request_id','c0010000-0000-4000-8000-000000000022',
 'idempotency_key','com01-private-001'));

select throws_ok($$select customer_api.create_private_conversation_v2((select payload from com01_request))$$,
 '42501','private_conversation_denied','unauthenticated caller is denied');
select set_config('request.jwt.claims','{"sub":"c0010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(customer_api.create_private_conversation_v2((select payload from com01_request))#>>'{communication_receipt,request_status}','accepted','current allowed pair creates a conversation');
select is((select workspace_id from communications.private_conversations where id='c0010000-0000-4000-8000-000000000020'),'c0010000-0000-4000-8000-000000000007'::uuid,'conversation pins explicit Workspace');
select is((select count(*) from communications.private_participants where conversation_id='c0010000-0000-4000-8000-000000000020'),2::bigint,'exactly two participants are stored');
select is((select count(*) from communications.private_messages where id='c0010000-0000-4000-8000-000000000021'),1::bigint,'initial message uses existing history engine');
select is((select count(*) from communications.notifications where payload->>'message_id'='c0010000-0000-4000-8000-000000000021'),1::bigint,'recipient gets one existing notification');
select is((select receipt#>>'{delivery_evidence,0,recipient_disclosure}' from communications.request_receipts),'withheld','durable receipt withholds recipient identity');
select is((select count(*) from audit.events where action='communication.request.accepted'),1::bigint,'accepted request has audit evidence');
select is((select count(*) from platform.outbox_events where event_type='communication.request.accepted'),1::bigint,'accepted request has outbox evidence');
select is(customer_api.create_private_conversation_v2((select payload from com01_request))->>'replayed','true','exact retry replays the original receipt');
select is((select count(*) from communications.private_conversations where id='c0010000-0000-4000-8000-000000000020'),1::bigint,'replay creates no duplicate conversation');
select is((select count(*) from communications.notifications where payload->>'message_id'='c0010000-0000-4000-8000-000000000021'),1::bigint,'replay creates no duplicate notification');
select throws_ok($$select customer_api.create_private_conversation_v2(jsonb_set((select payload from com01_request),'{body}','"Different body"'))$$,
 '23505','private_conversation_request_conflict','same key with different input fails closed');
select throws_ok($$update communications.request_receipts set receipt=receipt$$,'42501','communication_request_receipt_immutable','receipt update is blocked');
select throws_ok($$delete from communications.request_receipts$$,'42501','communication_request_receipt_immutable','receipt deletion is blocked');

update identity.context_grants set ends_at=statement_timestamp()-interval '1 second'
 where id='c0010000-0000-4000-8000-000000000011';
select throws_ok($$select customer_api.create_private_conversation_v2((select payload from com01_request))$$,
 '42501','private_conversation_denied','replay is denied after recipient relationship revoke');
select is((select count(*) from communications.private_conversations),1::bigint,'revoked replay creates no additional domain record');
select is((select count(*) from communications.request_receipts),1::bigint,'revoked replay creates no additional receipt');

select * from finish();
rollback;
