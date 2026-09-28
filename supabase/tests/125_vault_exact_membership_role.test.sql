begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(4);

insert into auth.users(id,email) values
  ('12500000-0000-4000-8000-000000000001','vault-role-125@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('12500000-0000-4000-8000-000000000002','Vault Role Fixture','VAULT125','active');
insert into identity.roles(id,tenant_id,code,name,is_system) values
  ('12500000-0000-4000-8000-000000000003','12500000-0000-4000-8000-000000000002','association_admin','Restricted local administrator',false);
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at) values
  ('12500000-0000-4000-8000-000000000004','12500000-0000-4000-8000-000000000002',
   '12500000-0000-4000-8000-000000000001','12500000-0000-4000-8000-000000000003','active',statement_timestamp()-interval '1 day');
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
  ('12500000-0000-4000-8000-000000000005','12500000-0000-4000-8000-000000000002',
   '12500000-0000-4000-8000-000000000004','tenant',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
  ('12500000-0000-4000-8000-000000000006','12500000-0000-4000-8000-000000000002','ASSOCIATION','Vault Role Fixture','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
  ('12500000-0000-4000-8000-000000000006','module.documents','boolean',true,statement_timestamp()-interval '1 day');

select ok(exists(select 1 from identity.roles r join identity.role_permissions rp on rp.role_id=r.id
  join identity.permissions p on p.id=rp.permission_id
  where r.code='association_admin' and r.tenant_id is null and rp.effect='allow' and p.code='documents.vault.read'),
  'System role with matching name holds vault read');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select * from documents.resolve_vault_actor('12500000-0000-4000-8000-000000000005','documents.vault.read',false)$$,
  '42501','permission_denied','Same-named system role cannot grant local membership vault read');
reset role;
insert into identity.role_permissions(role_id,permission_id,effect)
  select '12500000-0000-4000-8000-000000000003',id,'allow' from identity.permissions where code='documents.vault.read';
set local role authenticated;
select is((select membership_id from documents.resolve_vault_actor('12500000-0000-4000-8000-000000000005','documents.vault.read',false)),
  '12500000-0000-4000-8000-000000000004'::uuid,'Own role vault read grant succeeds');
select throws_ok($$select * from documents.resolve_vault_actor('12500000-0000-4000-8000-000000000005','documents.vault.upload',false)$$,
  '42501','permission_denied','Read grant cannot inherit upload from same-named role');
select * from finish();
rollback;
