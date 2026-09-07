begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

-- 1. Permissions & Role Grants
select ok(exists(select 1 from identity.permissions where code = 'occupancy.occupancies.manage'), 'occupancy.occupancies.manage permission exists');
select ok(exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'association_admin' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'association_admin has occupancies.manage');
select ok(exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'property_manager' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'property_manager has occupancies.manage');
select ok(not exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'president' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'president denied occupancies.manage');
select ok(not exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'censor' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'censor denied occupancies.manage');
select ok(not exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'owner' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'owner denied occupancies.manage');
select ok(not exists(select 1 from identity.role_permissions rp join identity.roles r on r.id = rp.role_id join identity.permissions p on p.id = rp.permission_id where r.code = 'tenant_resident' and p.code = 'occupancy.occupancies.manage' and rp.effect = 'allow'), 'tenant_resident denied occupancies.manage');

-- 2. Occupancy Functions Exist
select has_function('occupancy', 'get_customer_registry', ARRAY['uuid','text','text','text','text','date','date','integer','integer','uuid'], 'get_customer_registry exists');
select has_function('occupancy', 'get_unit_occupancy_detail', ARRAY['uuid','uuid'], 'get_unit_occupancy_detail exists');
select has_function('occupancy', 'create_occupancy', ARRAY['uuid','uuid','text','timestamp with time zone','timestamp with time zone','uuid[]','text','text'], 'create_occupancy exists');
select has_function('occupancy', 'update_occupancy', ARRAY['uuid','uuid','timestamp with time zone','text','text'], 'update_occupancy exists');
select has_function('occupancy', 'end_occupancy', ARRAY['uuid','uuid','timestamp with time zone','text'], 'end_occupancy exists');
select has_function('occupancy', 'renew_occupancy', ARRAY['uuid','uuid','timestamp with time zone','text'], 'renew_occupancy exists');
select has_function('occupancy', 'transfer_occupancy', ARRAY['uuid','uuid','uuid','timestamp with time zone','text'], 'transfer_occupancy exists');

-- 3. Customer API Wrappers Exist
select has_function('customer_api', 'get_unit_occupancy_detail_v1', ARRAY['uuid','uuid'], 'customer_api.get_unit_occupancy_detail_v1 exists');
select has_function('customer_api', 'create_occupancy_v1', ARRAY['uuid','uuid','text','timestamp with time zone','timestamp with time zone','uuid[]','text','text'], 'customer_api.create_occupancy_v1 exists');
select has_function('customer_api', 'update_occupancy_v1', ARRAY['uuid','uuid','timestamp with time zone','text','text'], 'customer_api.update_occupancy_v1 exists');
select has_function('customer_api', 'end_occupancy_v1', ARRAY['uuid','uuid','timestamp with time zone','text'], 'customer_api.end_occupancy_v1 exists');
select has_function('customer_api', 'renew_occupancy_v1', ARRAY['uuid','uuid','timestamp with time zone','text'], 'customer_api.renew_occupancy_v1 exists');
select has_function('customer_api', 'transfer_occupancy_v1', ARRAY['uuid','uuid','uuid','timestamp with time zone','text'], 'customer_api.transfer_occupancy_v1 exists');

-- 4. Public and Anon Access Denied on customer_api
select ok(not has_function_privilege('anon', 'customer_api.get_unit_occupancy_detail_v1(uuid,uuid)', 'EXECUTE'), 'anon denied get_unit_occupancy_detail_v1');
select ok(not has_function_privilege('public', 'customer_api.get_unit_occupancy_detail_v1(uuid,uuid)', 'EXECUTE'), 'public denied get_unit_occupancy_detail_v1');
select ok(has_function_privilege('authenticated', 'customer_api.get_unit_occupancy_detail_v1(uuid,uuid)', 'EXECUTE'), 'authenticated allowed get_unit_occupancy_detail_v1');

select ok(not has_function_privilege('anon', 'customer_api.create_occupancy_v1(uuid,uuid,text,timestamptz,timestamptz,uuid[],text,text)', 'EXECUTE'), 'anon denied create_occupancy_v1');
select ok(not has_function_privilege('public', 'customer_api.create_occupancy_v1(uuid,uuid,text,timestamptz,timestamptz,uuid[],text,text)', 'EXECUTE'), 'public denied create_occupancy_v1');
select ok(has_function_privilege('authenticated', 'customer_api.create_occupancy_v1(uuid,uuid,text,timestamptz,timestamptz,uuid[],text,text)', 'EXECUTE'), 'authenticated allowed create_occupancy_v1');

select ok(not has_function_privilege('anon', 'customer_api.update_occupancy_v1(uuid,uuid,timestamptz,text,text)', 'EXECUTE'), 'anon denied update_occupancy_v1');
select ok(not has_function_privilege('public', 'customer_api.update_occupancy_v1(uuid,uuid,timestamptz,text,text)', 'EXECUTE'), 'public denied update_occupancy_v1');

select ok(not has_function_privilege('anon', 'customer_api.end_occupancy_v1(uuid,uuid,timestamptz,text)', 'EXECUTE'), 'anon denied end_occupancy_v1');
select ok(not has_function_privilege('public', 'customer_api.end_occupancy_v1(uuid,uuid,timestamptz,text)', 'EXECUTE'), 'public denied end_occupancy_v1');

select ok(not has_function_privilege('anon', 'customer_api.renew_occupancy_v1(uuid,uuid,timestamptz,text)', 'EXECUTE'), 'anon denied renew_occupancy_v1');
select ok(not has_function_privilege('public', 'customer_api.renew_occupancy_v1(uuid,uuid,timestamptz,text)', 'EXECUTE'), 'public denied renew_occupancy_v1');

select ok(not has_function_privilege('anon', 'customer_api.transfer_occupancy_v1(uuid,uuid,uuid,timestamptz,text)', 'EXECUTE'), 'anon denied transfer_occupancy_v1');
select ok(not has_function_privilege('public', 'customer_api.transfer_occupancy_v1(uuid,uuid,uuid,timestamptz,text)', 'EXECUTE'), 'public denied transfer_occupancy_v1');

-- 5. Security Definer Checks
select ok((select prosecdef from pg_proc where oid = 'occupancy.get_unit_occupancy_detail(uuid,uuid)'::regprocedure), 'get_unit_occupancy_detail is security definer');
select ok((select prosecdef from pg_proc where oid = 'occupancy.create_occupancy(uuid,uuid,text,timestamptz,timestamptz,uuid[],text,text)'::regprocedure), 'create_occupancy is security definer');
select ok((select prosecdef from pg_proc where oid = 'occupancy.update_occupancy(uuid,uuid,timestamptz,text,text)'::regprocedure), 'update_occupancy is security definer');
select ok((select prosecdef from pg_proc where oid = 'occupancy.end_occupancy(uuid,uuid,timestamptz,text)'::regprocedure), 'end_occupancy is security definer');

select * from finish();
rollback;
