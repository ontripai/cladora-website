begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(34);

select ok(exists(select 1 from information_schema.columns
  where table_schema='communications' and table_name='private_messages' and column_name='version'),
  'Canonical message version exists');
select ok(exists(select 1 from information_schema.columns
  where table_schema='communications' and table_name='private_messages' and column_name='lifecycle_state'),
  'Canonical message lifecycle exists');
select ok((select a.attnotnull from pg_attribute a
  where a.attrelid='communications.private_messages'::regclass and a.attname='version' and not a.attisdropped),
  'Message version is required');
select ok((select a.attnotnull from pg_attribute a
  where a.attrelid='communications.private_messages'::regclass and a.attname='lifecycle_state' and not a.attisdropped),
  'Message lifecycle is required');
select ok(not has_table_privilege('authenticated','communications.private_messages','SELECT'),
  'Authenticated callers cannot read the canonical message store');
select ok(not has_function_privilege('anon',
  'communications.resolve_private_message_subject_v1(uuid,uuid,uuid,uuid,bigint)','EXECUTE'),
  'Anonymous resolver execution denied');
select ok(not has_function_privilege('authenticated',
  'communications.resolve_private_message_subject_v1(uuid,uuid,uuid,uuid,bigint)','EXECUTE'),
  'Authenticated resolver execution denied');
select ok(has_function_privilege('service_role',
  'communications.resolve_private_message_subject_v1(uuid,uuid,uuid,uuid,bigint)','EXECUTE'),
  'Only the trusted transaction role can execute the resolver');

insert into auth.users(id,email) values
  ('17500000-0000-4000-8000-000000000001','actor175@cladora.test'),
  ('17500000-0000-4000-8000-000000000002','peer175@cladora.test');
insert into identity.profiles(user_id,display_name) values
  ('17500000-0000-4000-8000-000000000001','Actor'),
  ('17500000-0000-4000-8000-000000000002','Peer');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('17500000-0000-4000-8000-000000000003','Subject Provider Test','SUBJECT175','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('17500000-0000-4000-8000-000000000004','17500000-0000-4000-8000-000000000003','condominium','Primary','active'),
  ('17500000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000003','condominium','Other','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('17500000-0000-4000-8000-000000000006','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000004','A','Primary building'),
  ('17500000-0000-4000-8000-000000000007','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000005','B','Other building');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('17500000-0000-4000-8000-000000000008','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000006','1');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('17500000-0000-4000-8000-0000000000'||n)::uuid,
  '17500000-0000-4000-8000-000000000003',
  ('17500000-0000-4000-8000-0000000000'||u)::uuid,r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r cross join (values('09','01'),('10','02')) v(n,u)
where r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
  ('17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000009','property','17500000-0000-4000-8000-000000000004',statement_timestamp()-interval '1 day'),
  ('17500000-0000-4000-8000-000000000012','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000010','property','17500000-0000-4000-8000-000000000004',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
  ('17500000-0000-4000-8000-000000000013','17500000-0000-4000-8000-000000000003','ASSOCIATION','Primary','ACTIVE'),
  ('17500000-0000-4000-8000-000000000014','17500000-0000-4000-8000-000000000003','ASSOCIATION','Other','ACTIVE');
insert into platform.workspace_property_bindings(
  id,tenant_id,customer_workspace_id,property_id,status,binding_source
) values
  ('17500000-0000-4000-8000-000000000017','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000013','17500000-0000-4000-8000-000000000004','active','migration_verified'),
  ('17500000-0000-4000-8000-000000000018','17500000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000014','17500000-0000-4000-8000-000000000005','active','migration_verified');
insert into platform.workspace_entitlements(
  customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
) values
  ('17500000-0000-4000-8000-000000000013','module.communications','boolean',true,statement_timestamp()-interval '1 day'),
  ('17500000-0000-4000-8000-000000000014','module.communications','boolean',true,statement_timestamp()-interval '1 day');
insert into communications.private_conversations(
  id,tenant_id,unit_id,created_by,client_request_id
) values(
  '17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000008','17500000-0000-4000-8000-000000000009',
  '17500000-0000-4000-8000-000000000019'
);
insert into communications.private_participants(conversation_id,membership_id) values
  ('17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000009'),
  ('17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000010');
insert into communications.private_messages(
  id,conversation_id,sender_id,client_request_id,body
) values(
  '17500000-0000-4000-8000-000000000016','17500000-0000-4000-8000-000000000015',
  '17500000-0000-4000-8000-000000000009','17500000-0000-4000-8000-000000000020','Private body'
);

select is((select version from communications.private_messages where id='17500000-0000-4000-8000-000000000016'),1::bigint,
  'Existing insert begins at version one');
select is((select lifecycle_state from communications.private_messages where id='17500000-0000-4000-8000-000000000016'),'available',
  'Existing insert begins available');

create function pg_temp.provider_counts() returns jsonb language sql stable as $$
  select jsonb_build_array(
    (select count(*) from communications.private_messages where conversation_id='17500000-0000-4000-8000-000000000015'),
    (select count(*) from audit.events where tenant_id='17500000-0000-4000-8000-000000000003'),
    (select count(*) from platform.outbox_events where tenant_id='17500000-0000-4000-8000-000000000003'),
    (select count(*) from platform.idempotency_keys where tenant_id='17500000-0000-4000-8000-000000000003')
  )
$$;
create temporary table provider_before as select pg_temp.provider_counts() counts;

set local role service_role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','17500000-0000-4000-8000-000000000001','role','service_role','aal','aal2'
)::text,true);
select is((select count(*) from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
)),1::bigint,'Exact message resolves once');
select is((select workspace_id from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
)),'17500000-0000-4000-8000-000000000013'::uuid,'Resolver returns the exact canonical Workspace');
select ok((select participant_current and not participant_revoked
  from communications.resolve_private_message_subject_v1(
    '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
    '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
  )),'Current participant state is explicit');
select is((select count(*) from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
) r cross join lateral jsonb_object_keys(to_jsonb(r))),6::bigint,'Resolver exposes exactly six bounded fields');
select ok(not exists(select 1 from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
) r cross join lateral jsonb_object_keys(to_jsonb(r)) as keys(key)
where key in ('body','sender_id','conversation_id','unit_id','membership_id','participants')),
  'Body, source internals, and participant identities are absent');
select throws_ok($$select * from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',2
)$$,'40001','private_message_version_conflict','Stale expected version fails closed');
select throws_ok($$select * from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000014',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',1
)$$,'42501','private_message_subject_denied','Cross-Workspace resolution shares a bounded denial');
select throws_ok($$select * from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000002','17500000-0000-4000-8000-000000000016',1
)$$,'42501','private_message_subject_denied','Actor binding mismatch denied');
select is(pg_temp.provider_counts(),(select counts from provider_before),
  'Stale and authority/scope denials write no domain, idempotency, audit, or outbox rows');
reset role;

select throws_ok($$update communications.private_messages set body='Changed without version'
  where id='17500000-0000-4000-8000-000000000016'$$,
  '23514','private_message_version_increment_required','Body cannot change without version increment');
select throws_ok($$update communications.private_messages set lifecycle_state='quarantined'
  where id='17500000-0000-4000-8000-000000000016'$$,
  '23514','private_message_version_increment_required','Lifecycle cannot change without version increment');
select throws_ok($$update communications.private_messages set version=2
  where id='17500000-0000-4000-8000-000000000016'$$,
  '23514','private_message_version_change_requires_revision','Version cannot advance without a revision');
select throws_ok($$update communications.private_messages set sender_id='17500000-0000-4000-8000-000000000010',version=2
  where id='17500000-0000-4000-8000-000000000016'$$,
  '23514','private_message_identity_immutable','Message identity remains immutable');
update communications.private_messages set body='Versioned body',version=2
where id='17500000-0000-4000-8000-000000000016';
select is((select version from communications.private_messages where id='17500000-0000-4000-8000-000000000016'),2::bigint,
  'Body revision advances version exactly once');
update communications.private_messages set lifecycle_state='quarantined',version=3
where id='17500000-0000-4000-8000-000000000016';
select is((select lifecycle_state from communications.private_messages where id='17500000-0000-4000-8000-000000000016'),'quarantined',
  'Quarantine transition advances the canonical row');

set local role service_role;
select is((select lifecycle_state from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',3
)),'quarantined','Resolver reports the current quarantined lifecycle');
reset role;

update communications.private_participants set revoked_at=statement_timestamp()
where conversation_id='17500000-0000-4000-8000-000000000015'
  and membership_id='17500000-0000-4000-8000-000000000009';
update provider_before set counts=pg_temp.provider_counts();
set local role service_role;
select ok((select participant_revoked and not participant_current
  from communications.resolve_private_message_subject_v1(
    '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
    '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',3
  )),'Revoked participant state is explicit and current access is false');
select is(pg_temp.provider_counts(),(select counts from provider_before),
  'Revoked resolution is read-only');
reset role;

update communications.private_messages set lifecycle_state='deleted',version=4
where id='17500000-0000-4000-8000-000000000016';
select is((select version from communications.private_messages where id='17500000-0000-4000-8000-000000000016'),4::bigint,
  'Deleted transition advances version');
set local role service_role;
select is((select lifecycle_state from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',4
)),'deleted','Resolver reports deleted lifecycle without returning content');
select throws_ok($$select * from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',0
)$$,'22023','private_message_subject_invalid','Non-positive expected version rejected');
reset role;

select throws_ok($$insert into communications.private_messages(
  conversation_id,sender_id,client_request_id,body,version
) values(
  '17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000010',
  '17500000-0000-4000-8000-000000000021','Invalid initial version',2
)$$,'23514','private_message_initial_version_invalid','Message cannot start above version one');
select throws_ok($$insert into communications.private_messages(
  conversation_id,sender_id,client_request_id,body,lifecycle_state
) values(
  '17500000-0000-4000-8000-000000000015','17500000-0000-4000-8000-000000000010',
  '17500000-0000-4000-8000-000000000022','Invalid initial lifecycle','deleted'
)$$,'23514','private_message_initial_version_invalid','Message cannot start deleted');

insert into platform.workspace_property_bindings(
  id,tenant_id,customer_workspace_id,property_id,status,binding_source
) values(
  '17500000-0000-4000-8000-000000000023','17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000014','17500000-0000-4000-8000-000000000004',
  'active','migration_verified'
);
set local role service_role;
select throws_ok($$select * from communications.resolve_private_message_subject_v1(
  '17500000-0000-4000-8000-000000000011','17500000-0000-4000-8000-000000000013',
  '17500000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000016',4
)$$,'42501','private_message_subject_denied','Ambiguous Workspace binding fails closed');

select * from finish();
rollback;
