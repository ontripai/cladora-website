begin;
select plan(13);

insert into platform.tenants(id,legal_name,registration_number,status)
values ('15400000-0000-4000-8000-000000000001','Lifecycle authority A','LC154A','active'),
       ('15400000-0000-4000-8000-000000000002','Lifecycle authority B','LC154B','active');
insert into portfolio.properties(id,tenant_id,type,name,status)
values ('15400000-0000-4000-8000-000000000003','15400000-0000-4000-8000-000000000001','condominium','One subject','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status)
values ('15400000-0000-4000-8000-000000000004','15400000-0000-4000-8000-000000000001','ASSOCIATION','Association','ACTIVE'),
       ('15400000-0000-4000-8000-000000000005','15400000-0000-4000-8000-000000000001','PROPERTY_MANAGER','Manager','ACTIVE'),
       ('15400000-0000-4000-8000-000000000006','15400000-0000-4000-8000-000000000002','ASSOCIATION','Other tenant','ACTIVE');

insert into platform.workspace_property_authorities
  (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values ('15400000-0000-4000-8000-000000000010','15400000-0000-4000-8000-000000000001',
  '15400000-0000-4000-8000-000000000003','15400000-0000-4000-8000-000000000004',
  'property_operations','synthetic mandate','test://mandate/1',statement_timestamp()-interval '1 day');
select lives_ok($$
  insert into platform.workspace_property_authorities
    (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
  values ('15400000-0000-4000-8000-000000000011','15400000-0000-4000-8000-000000000001',
    '15400000-0000-4000-8000-000000000003','15400000-0000-4000-8000-000000000005',
    'service_delivery','synthetic mandate','test://mandate/2',statement_timestamp()-interval '1 day')
$$,'One canonical property serves two explicit workspaces');
select is((select count(distinct customer_workspace_id) from platform.workspace_property_authorities
  where property_id='15400000-0000-4000-8000-000000000003'),2::bigint,'Two workspace IDs; one subject ID');
select throws_ok($$
  insert into platform.workspace_property_authorities
    (tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
  values ('15400000-0000-4000-8000-000000000001','15400000-0000-4000-8000-000000000003',
    '15400000-0000-4000-8000-000000000004','property_operations','duplicate','test://mandate/3',statement_timestamp())
$$,'23505','workspace_property_authority_overlap','Same workspace/purpose cannot overlap');
select throws_ok($$
  insert into platform.workspace_property_authorities
    (tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
  values ('15400000-0000-4000-8000-000000000001','15400000-0000-4000-8000-000000000003',
    '15400000-0000-4000-8000-000000000006','service_delivery','foreign','test://mandate/4',statement_timestamp())
$$,'42501','workspace_property_authority_tenant_mismatch','Foreign tenant workspace rejected');
select throws_ok($$
  update platform.workspace_property_authorities set customer_workspace_id='15400000-0000-4000-8000-000000000005'
  where id='15400000-0000-4000-8000-000000000010'
$$,'42501','workspace_property_authority_history_immutable','Cannot rewrite authority subject');
select throws_ok($$
  delete from platform.workspace_property_authorities where id='15400000-0000-4000-8000-000000000010'
$$,'42501','workspace_property_authority_history_immutable','Cannot delete history');
select lives_ok($$
  update platform.workspace_property_authorities
    set status='revoked',revoked_at=statement_timestamp(),valid_to=statement_timestamp(),revocation_reason='mandate ended'
  where id='15400000-0000-4000-8000-000000000010'
$$,'Explicit revocation');
select is((select count(*) from platform.workspace_property_authorities
  where id='15400000-0000-4000-8000-000000000010' and status='active'),0::bigint,'Revoked relationship no longer active');
select throws_ok($$
  update platform.workspace_property_authorities set status='active',revoked_at=null,valid_to=null,revocation_reason=null
  where id='15400000-0000-4000-8000-000000000010'
$$,'42501','workspace_property_authority_history_immutable','Revocation cannot be undone');
select lives_ok($$
  insert into platform.workspace_property_authorities
    (tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
  values ('15400000-0000-4000-8000-000000000001','15400000-0000-4000-8000-000000000003',
    '15400000-0000-4000-8000-000000000004','property_operations','renewed mandate','test://mandate/5',statement_timestamp())
$$,'New evidence creates new interval after revocation');
select ok(not has_table_privilege('authenticated','platform.workspace_property_authorities','SELECT'),'Customer cannot read relationship table');
select ok(not has_table_privilege('authenticated','platform.workspace_property_authorities','INSERT'),'Customer cannot issue authority directly');
select ok(not has_function_privilege('authenticated','app_private.guard_workspace_property_authority_v1()','EXECUTE'),'Guard is private');

select * from finish();
rollback;
