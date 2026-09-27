begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(37);

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
 ('11900000-0000-4000-8000-0000000000' || n)::uuid,id,'active',statement_timestamp()-interval '1 day'
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
select throws_ok($$select customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000002','Hello','11900000-0000-4000-8000-000000000021')$$,'42501','private_conversation_denied','AAL1 cannot create');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000001','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000011')::text,true);
select is(jsonb_array_length(customer_api.list_private_units_v1('11900000-0000-4000-8000-000000000011',null,25,0)),1,'Sender discovers permitted unit');
select is(jsonb_array_length(customer_api.list_private_recipients_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009')),1,'Only related recipient discoverable');
select throws_ok($$select customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000003','Hello','11900000-0000-4000-8000-000000000021')$$,'42501','private_conversation_denied','Other property recipient denied');
select is((customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000002','Hello','11900000-0000-4000-8000-000000000021')->>'replayed')::boolean,null::boolean,'First send creates conversation');
select ok((customer_api.create_private_conversation_v1('11900000-0000-4000-8000-000000000011','11900000-0000-4000-8000-000000000009','11900000-0000-4000-8000-000000000002','Hello','11900000-0000-4000-8000-000000000021')->>'replayed')::boolean,'Create retry returns existing');
select is(jsonb_array_length(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000011',null)->0->'messages'),1,'Create retry did not duplicate message');
select is(jsonb_array_length(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000011',null)),1,'Sender reads conversation');
select set_config('test.private_conversation_id',customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000011',null)->0->>'id',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000003','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000013')::text,true);
select is(jsonb_array_length(customer_api.list_private_units_v1('11900000-0000-4000-8000-000000000013',null,25,0)),0,'Other property discovers no unit');
select throws_ok($$select customer_api.list_private_recipients_v1('11900000-0000-4000-8000-000000000013','11900000-0000-4000-8000-000000000009')$$,'42501','private_recipient_discovery_denied','Other property cannot discover recipients');
select is(jsonb_array_length(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000013',null)),0,'Other property cannot list');
select throws_ok($$select customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000013',current_setting('test.private_conversation_id')::uuid)$$,'42501','private_conversation_denied','Other property cannot read by ID');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000002','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000012')::text,true);
select is(jsonb_array_length(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)),1,'Recipient reads conversation');
select is((customer_api.send_private_message_v1('11900000-0000-4000-8000-000000000012',(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)->0->>'id')::uuid,'Reply','11900000-0000-4000-8000-000000000022')->>'replayed')::boolean,false,'Recipient replies');
select ok((customer_api.send_private_message_v1('11900000-0000-4000-8000-000000000012',(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)->0->>'id')::uuid,'Reply','11900000-0000-4000-8000-000000000022')->>'replayed')::boolean,'Reply retry detected');

select is((customer_api.get_private_unread_v1('11900000-0000-4000-8000-000000000012')->0->>'unread_count')::int,1,'Recipient unread excludes own reply');
select is((customer_api.mark_private_conversation_read_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)->>'conversation_id')::uuid,current_setting('test.private_conversation_id')::uuid,'Recipient marks read');
select is((customer_api.get_private_unread_v1('11900000-0000-4000-8000-000000000012')->0->>'unread_count')::int,0,'Recipient unread cleared');
reset role;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('11900000-0000-4000-8000-000000000014','module.documents','boolean',true,statement_timestamp()-interval '1 day');
insert into documents.documents(id,tenant_id,property_id,title,document_type,status)
 values('11900000-0000-4000-8000-000000000031','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000005','Private evidence','test','active');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status)
 values('11900000-0000-4000-8000-000000000032','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000031',1,'test/119','119-clean-sha','application/pdf','clean');
insert into documents.document_permissions(id,tenant_id,document_id,membership_id,valid_from) values
 ('11900000-0000-4000-8000-000000000033','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000031','11900000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
set local role authenticated;
select is(jsonb_array_length(customer_api.list_attachable_private_documents_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),0,'One-sided document grant cannot be shared');
reset role;
insert into documents.document_permissions(id,tenant_id,document_id,membership_id,valid_from) values
 ('11900000-0000-4000-8000-000000000034','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000031','11900000-0000-4000-8000-000000000002',statement_timestamp()-interval '1 day');
set local role authenticated;
select is(jsonb_array_length(customer_api.list_attachable_private_documents_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),1,'Document available to both permitted parties');
select is((customer_api.attach_private_document_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid,(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)->0->'messages'->1->>'id')::uuid,'11900000-0000-4000-8000-000000000031','11900000-0000-4000-8000-000000000032')->>'replayed')::boolean,false,'Author attaches clean document');
select is(jsonb_array_length(customer_api.list_private_attachments_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),1,'Recipient sees attachment metadata');
select is((customer_api.authorize_private_attachment_download_v1('11900000-0000-4000-8000-000000000012',(customer_api.list_private_attachments_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)->0->>'id')::uuid)->>'version_id')::uuid,'11900000-0000-4000-8000-000000000032'::uuid,'Authorized clean version is downloadable');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000002','role','authenticated','aal','aal1','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000012')::text,true);
select throws_ok($$select customer_api.authorize_document_download_v1('11900000-0000-4000-8000-000000000012','11900000-0000-4000-8000-000000000031',null,false)$$,'42501','document_download_access_denied','Vault download requires AAL2');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000003','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000013')::text,true);
select throws_ok($$select customer_api.authorize_document_download_v1('11900000-0000-4000-8000-000000000013','11900000-0000-4000-8000-000000000031',null,false)$$,'42501','document_download_access_denied','Same-tenant manager cannot download another property by document ID');
select set_config('request.jwt.claims',jsonb_build_object('sub','11900000-0000-4000-8000-000000000002','role','authenticated','aal','aal2','active_tenant_id','11900000-0000-4000-8000-000000000004','active_context_id','11900000-0000-4000-8000-000000000012')::text,true);
select set_config('test.private_attachment_id',customer_api.list_private_attachments_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)->0->>'id',true);

reset role;
insert into documents.documents(id,tenant_id,property_id,title,document_type,status,created_by) values
 ('11900000-0000-4000-8000-000000000036','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000005','Sender document','test','active','11900000-0000-4000-8000-000000000002');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status) values
 ('11900000-0000-4000-8000-000000000037','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000036',1,'test/119-owned','119-owned-sha','application/pdf','clean');
set local role authenticated;
select is(jsonb_array_length(customer_api.list_attachable_private_documents_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),2,'Creator may choose own clean document without existing grants');
select is((customer_api.attach_private_document_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid,(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)->0->'messages'->1->>'id')::uuid,'11900000-0000-4000-8000-000000000036','11900000-0000-4000-8000-000000000037')->>'replayed')::boolean,false,'Owner explicitly shares and attaches');
select is(jsonb_array_length(customer_api.list_private_attachments_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),2,'Own document now visible after two-party sharing');
reset role;
update documents.document_permissions set valid_until=statement_timestamp()-interval '1 second'
  where document_id='11900000-0000-4000-8000-000000000031' and membership_id='11900000-0000-4000-8000-000000000002';
set local role authenticated;
select is(jsonb_array_length(customer_api.list_private_attachments_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid)),1,'Expired document permission hides its attachment');
select throws_ok($$select customer_api.authorize_private_attachment_download_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_attachment_id')::uuid)$$,'42501','private_attachment_denied','Expired document permission denies download');
reset role;
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status) values('11900000-0000-4000-8000-000000000035','11900000-0000-4000-8000-000000000004','11900000-0000-4000-8000-000000000031',2,'test/119-pending','119-pending-sha','application/pdf','scanning_pending');
set local role authenticated;
select throws_ok($$select customer_api.attach_private_document_v1('11900000-0000-4000-8000-000000000012',current_setting('test.private_conversation_id')::uuid,(customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)->0->'messages'->1->>'id')::uuid,'11900000-0000-4000-8000-000000000031','11900000-0000-4000-8000-000000000035')$$,'42501','private_attachment_denied','Pending scanner version denied');
reset role;
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id='11900000-0000-4000-8000-000000000012';
set local role authenticated;
select throws_ok($$select customer_api.get_private_conversations_v1('11900000-0000-4000-8000-000000000012',null)$$,'42501','private_conversation_denied','Grant expiry revokes recipient read');
select * from finish();
rollback;
