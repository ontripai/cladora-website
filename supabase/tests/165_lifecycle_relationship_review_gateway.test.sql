begin;
select plan(21);
insert into auth.users(id,email) values ('16500000-0000-4000-8000-000000000001','proposer165@cladora.test'), ('16500000-0000-4000-8000-000000000011','reviewer165@cladora.test'), ('16500000-0000-4000-8000-000000000012','outsider165@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('16500000-0000-4000-8000-000000000002','Core identity tenant','LC160','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000002','condominium','Test property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('16500000-0000-4000-8000-000000000004','16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000003','B','Test building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('16500000-0000-4000-8000-000000000005','16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000004','P-01');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16500000-0000-4000-8000-000000000006','16500000-0000-4000-8000-000000000002','ASSOCIATION','Test operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '16500000-0000-4000-8000-000000000007','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000001',id,'active',now()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000007','tenant',now()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000006',p.id,o.id,
 'active',now()-interval '1 day','16500000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
  and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000006',id,code,
 'active','Synthetic activation' from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('16500000-0000-4000-8000-000000000006','module.core_unit_identity','boolean',true,now()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('16500000-0000-4000-8000-000000000009','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000006','relationship_proposer','Relationship proposer','workspace',
 '16500000-0000-4000-8000-000000000001',now()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000009',id
from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000009',id,'allow'
from identity.permissions where code in ('core.relationships.propose','core.relationships.read');
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='16500000-0000-4000-8000-000000000009';
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('16500000-0000-4000-8000-000000000013','16500000-0000-4000-8000-000000000002','person','From'),
 ('16500000-0000-4000-8000-000000000014','16500000-0000-4000-8000-000000000002','person','To');
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000007','16500000-0000-4000-8000-000000000009',
 'workspace','16500000-0000-4000-8000-000000000001','16500000-0000-4000-8000-000000000007',
 'Synthetic assignment',now()-interval '1 hour');

insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '16500000-0000-4000-8000-000000000015','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000011',id,'active',now()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000015','tenant',now()-interval '1 day');

select throws_ok($$select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Test proposal','16500000-0000-4000-8000-000000000017','test-key-165')$$,
 '42501','core_relationship_access_denied','Anonymous proposal denied');
select set_config('request.jwt.claims','{"sub":"16500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Test proposal','16500000-0000-4000-8000-000000000017','test-key-165')$$,
 '42501','core_relationship_access_denied','Role without property mandate denied');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('16500000-0000-4000-8000-000000000010','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000006',
 'property_operations','synthetic','test://mandate',now()-interval '1 day');
select lives_ok($$select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Test proposal','16500000-0000-4000-8000-000000000017','test-key-165')$$,
 'Authorized proposal recorded');
select is((select count(*) from portfolio.relationship_proposals where request_id=
 '16500000-0000-4000-8000-000000000017'),1::bigint,'Exactly one proposal');
select is((select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Test proposal','16500000-0000-4000-8000-000000000017','test-key-165')->>'idempotent'),
 'true','Exact retry returns receipt');
select throws_ok($$select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Changed reason','16500000-0000-4000-8000-000000000017','test-key-165')$$,
 '23505','core_relationship_idempotency_conflict','Changed payload with same key conflicts');
select throws_ok($$select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'verified','test://review-evidence','Independent review','16500000-0000-4000-8000-000000000018','review-key-165')$$,
 '42501','core_relationship_access_denied','Proposer cannot self-review');
select set_config('request.jwt.claims','{"sub":"16500000-0000-4000-8000-000000000011","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'verified','test://review-evidence','Independent review','16500000-0000-4000-8000-000000000018','review-key-165')$$,
 '42501','core_relationship_access_denied','Independent account without reviewer role denied');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('16500000-0000-4000-8000-000000000019','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000006','relationship_reviewer','Relationship reviewer','workspace',
 '16500000-0000-4000-8000-000000000001',now()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000019',id
from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000019',id,'allow'
from identity.permissions where code in ('core.relationships.review','core.relationships.read');
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='16500000-0000-4000-8000-000000000019';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('16500000-0000-4000-8000-000000000002','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000015','16500000-0000-4000-8000-000000000019',
 'workspace','16500000-0000-4000-8000-000000000001','16500000-0000-4000-8000-000000000007',
 'Synthetic reviewer assignment',now()-interval '1 hour');
insert into identity.membership_parties(membership_id,tenant_id,party_id,valid_from)
values('16500000-0000-4000-8000-000000000015','16500000-0000-4000-8000-000000000002',
 '16500000-0000-4000-8000-000000000013',now()-interval '1 day');
select throws_ok($$select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'verified','test://review-evidence','Independent review','16500000-0000-4000-8000-000000000018','review-key-165')$$,
 '42501','core_relationship_access_denied','Linked transaction party cannot review even with reviewer role');
delete from identity.membership_parties where membership_id='16500000-0000-4000-8000-000000000015';
select lives_ok($$select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'verified','test://review-evidence','Independent review','16500000-0000-4000-8000-000000000018','review-key-165')$$,
 'Independent reviewer records decision');
select is((select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'verified','test://review-evidence','Independent review','16500000-0000-4000-8000-000000000018','review-key-165')->>'idempotent'),
 'true','Review retry returns same decision');
select throws_ok($$select customer_api.review_core_relationship_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 (select id from portfolio.relationship_proposals where request_id='16500000-0000-4000-8000-000000000017'),
 'rejected','test://review-evidence','Changed decision','16500000-0000-4000-8000-000000000018','review-key-165')$$,
 '23505','core_relationship_review_conflict','Second decision conflicts');
select is((select count(*) from portfolio.ownerships where unit_id='16500000-0000-4000-8000-000000000005'),
 0::bigint,'Review has no title effect');
select is((select jsonb_array_length(customer_api.list_core_relationship_proposals_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003')->'proposals')),1,
 'Originating workspace can read its ledger');
select is((select jsonb_array_length(customer_api.list_core_relationship_subjects_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003')->'units')),1,
 'Authorized workspace sees its property unit choice');
select is((select jsonb_array_length(customer_api.list_core_relationship_properties_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006')->'properties')),1,
 'Tenant-scoped reviewer sees only a mandated property');
select set_config('request.jwt.claims','{"sub":"16500000-0000-4000-8000-000000000012","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.list_core_relationship_proposals_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003')$$,
 '42501','core_relationship_access_denied','Unrelated account cannot read ledger');
select throws_ok($$select customer_api.list_core_relationship_subjects_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003')$$,
 '42501','core_relationship_access_denied','Unrelated account cannot enumerate parties');
select throws_ok($$select customer_api.list_core_relationship_properties_v1(
 '16500000-0000-4000-8000-000000000016','16500000-0000-4000-8000-000000000006')$$,
 '42501','core_relationship_access_denied','Unrelated account cannot enumerate properties');
update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Test revoke'
where id='16500000-0000-4000-8000-000000000010';
select set_config('request.jwt.claims','{"sub":"16500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.propose_core_relationship_v1(
 '16500000-0000-4000-8000-000000000008','16500000-0000-4000-8000-000000000006',
 '16500000-0000-4000-8000-000000000003','16500000-0000-4000-8000-000000000005',
 'ownership_transfer','16500000-0000-4000-8000-000000000013',
 '16500000-0000-4000-8000-000000000014',current_date,null,
 'test://evidence-transfer','Test proposal','16500000-0000-4000-8000-000000000017','test-key-165')$$,
 '42501','core_relationship_access_denied','Revoked mandate denies even exact retry');
select ok(not has_table_privilege('authenticated','portfolio.relationship_proposals','INSERT')
 and not has_table_privilege('authenticated','portfolio.relationship_reviews','SELECT')
 and not has_function_privilege('service_role',
 'customer_api.review_core_relationship_v1(uuid,uuid,uuid,text,text,text,uuid,text)','EXECUTE'),
 'Direct ledger and service role access remain denied');
select * from finish();
rollback;
