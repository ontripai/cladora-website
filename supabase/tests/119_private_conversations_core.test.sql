begin;
set local search_path = public, extensions;
select plan(38);

-- The original conversation lifecycle in this historical test predates D5.
-- The baseline discovery/denial contract remains live; canonical creation and
-- attachment behavior is covered by tests 191, 192, 195 and 198.

insert into auth.users(id,email) values
  ('11900000-0000-4000-8000-000000000001','one119@cladora.test'),
  ('11900000-0000-4000-8000-000000000002','two119@cladora.test'),
  ('11900000-0000-4000-8000-000000000003','other119@cladora.test');
insert into identity.profiles(user_id,display_name) values
  ('11900000-0000-4000-8000-000000000001','First manager'),
  ('11900000-0000-4000-8000-000000000002','Second manager'),
  ('11900000-0000-4000-8000-000000000003','Other manager');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('11900000-0000-4000-8000-000000000004','Private Test','PRIVATE119','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('11900000-0000-4000-8000-000000000005','11900000-0000-4000-8000-000000000004','condominium','One','active'),
  ('11900000-0000-4000-8000-000000000006','11900000-0000-4000-8000-000000000004','condominium','Other','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('11900000-0000-4000-8000-000000000007','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000005','A','Building A'),
  ('11900000-0000-4000-8000-000000000008','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000006','B','Building B');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000007','1');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('11900000-0000-4000-8000-0000000000' || n)::uuid,
  '11900000-0000-4000-8000-000000000004',
  ('11900000-0000-4000-8000-0000000000' || n)::uuid,
  id,'active',statement_timestamp()-interval '1 day'
from identity.roles cross join (values ('01'),('02'),('03')) v(n)
where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
  ('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000001','property','11900000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
  ('11900000-0000-4000-8000-000000000012','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000002','property','11900000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
  ('11900000-0000-4000-8000-000000000013','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000003','property','11900000-0000-4000-8000-000000000006',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
  ('11900000-0000-4000-8000-000000000014','11900000-0000-4000-8000-000000000004','ASSOCIATION','Private Test','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
  ('11900000-0000-4000-8000-000000000014','module.communications','boolean',true,statement_timestamp()-interval '1 day');

select ok(not has_table_privilege('authenticated','communications.private_messages','SELECT'),'Raw message table unavailable');
select ok(not has_function_privilege('anon','customer_api.get_private_conversations_v1(uuid,uuid)','EXECUTE'),'Anonymous read denied');
select ok(not has_function_privilege('anon','customer_api.send_private_message_v1(uuid,uuid,text,uuid)','EXECUTE'),'Anonymous send denied');
select ok(communications.member_covers_unit('11900000-0000-4000-8000-000000000001','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000009'),'First member covers unit');
select ok(not communications.member_covers_unit('11900000-0000-4000-8000-000000000003','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000009'),'Other property excluded');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000001','role','authenticated','aal','aal1','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000011')::text,true);
select throws_ok($$select customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000002','Hello','11900000-0000-4000-8000-000000000021')$$,'42501','permission denied for function create_private_conversation_v1','legacy AAL1 create is denied at the S4 ACL');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000001','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000011')::text,true);
select is(jsonb_array_length(customer_api.list_private_units_v1('11900000-0000-4000-8000-000000000011',null,25,0)),1,'Sender discovers permitted unit');
select is(jsonb_array_length(customer_api.list_private_recipients_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009')),1,'Only related recipient discoverable');
select throws_ok($$select customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000003','Hello','11900000-0000-4000-8000-000000000021')$$,'42501','permission denied for function create_private_conversation_v1','legacy cross-property create is denied at the S4 ACL');
select throws_ok($$select customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000002','Hello','11900000-0000-4000-8000-000000000021')$$,'42501','permission denied for function create_private_conversation_v1','legacy create path is closed after S4');

select * from skip(
  'pre-D5 conversation lifecycle superseded by canonical tests 191, 192, 195 and 198',
  28
);

select * from finish();
rollback;
