begin;
select plan(27);

select has_function('customer_api','get_workspace_cost_benchmark_v1',array['uuid','uuid','date','date','text'],'C14 exposes one bounded projection RPC');
select ok((select prosecdef from pg_proc where oid='customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)'::regprocedure),'C14 RPC is SECURITY DEFINER');
select is((select provolatile::text from pg_proc where oid='customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)'::regprocedure),'s','C14 projection is STABLE and zero-write');
select ok(has_function_privilege('authenticated','customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)','EXECUTE'),'authenticated may use C14 gateway');
select ok(not has_function_privilege('service_role','customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)','EXECUTE'),'service role cannot bypass C14 actor authority');
select alike(pg_get_functiondef('customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)'::regprocedure),'%check_workspace_native_permission_v2%','C14 consumes AUTH01');
select alike(pg_get_functiondef('customer_api.get_workspace_cost_benchmark_v1(uuid,uuid,date,date,text)'::regprocedure),'%workspace_property_bindings%','C14 scopes ledger rows through current Workspace bindings');
select ok(not has_table_privilege('authenticated','finance.journal_entries','INSERT'),'C14 consumer cannot write the ledger directly');

insert into auth.users(id,email,email_confirmed_at) values('14010000-0000-4000-8000-000000000001','c14@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values('14010000-0000-4000-8000-000000000002','C14 tenant','C14-A','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('14010000-0000-4000-8000-000000000003','14010000-0000-4000-8000-000000000002','condominium','C14 bound','active'),
 ('14010000-0000-4000-8000-000000000103','14010000-0000-4000-8000-000000000002','condominium','C14 unbound','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('14010000-0000-4000-8000-000000000004','14010000-0000-4000-8000-000000000002','ASSOCIATION','C14 operator','ACTIVE'),
 ('14010000-0000-4000-8000-000000000104','14010000-0000-4000-8000-000000000002','ASSOCIATION','Other operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '14010000-0000-4000-8000-000000000005','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000001',r.id,'active',statement_timestamp()-interval '1 day'
from identity.roles r where r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000005','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000004',p.id,o.id,'active',statement_timestamp()-interval '1 day','14010000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o where p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,activated_at,activated_by,reason)
select '14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000004',m.id,m.code,'active',statement_timestamp()-interval '1 day',statement_timestamp()-interval '1 day','14010000-0000-4000-8000-000000000001','C14 fixture'
from platform.module_definitions m where m.code='accounting';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values('14010000-0000-4000-8000-000000000004','module.accounting','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from) values('14010000-0000-4000-8000-000000000007','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000004','c14_reader','C14 reader','workspace','14010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000007',m.id from platform.module_definitions m where m.code='accounting';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000007',p.id,'allow' from identity.permissions p where p.code='finance.reports.read';
update platform.workspace_roles set lifecycle_status='published',lock_version=2 where id='14010000-0000-4000-8000-000000000007';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from) values('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000004','14010000-0000-4000-8000-000000000005','14010000-0000-4000-8000-000000000007','workspace','14010000-0000-4000-8000-000000000001','14010000-0000-4000-8000-000000000005','C14 authority',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_bindings(id,tenant_id,customer_workspace_id,property_id,status,valid_from,binding_source,created_by) values('14010000-0000-4000-8000-000000000008','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000004','14010000-0000-4000-8000-000000000003','active',statement_timestamp()-interval '1 day','platform_assignment','14010000-0000-4000-8000-000000000001');

insert into finance.accounts(id,tenant_id,property_id,code,name,type,currency) values
 ('14010000-0000-4000-8000-000000000010','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','601','Utilities','expense','RON'),
 ('14010000-0000-4000-8000-000000000011','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','602','Maintenance','expense','RON'),
 ('14010000-0000-4000-8000-000000000012','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','512','Cash','asset','RON'),
 ('14010000-0000-4000-8000-000000000112','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000103','699','Secret other property','expense','RON'),
 ('14010000-0000-4000-8000-000000000113','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000103','519','Other cash','asset','RON');
insert into finance.journals(id,tenant_id,property_id,occurred_on,currency,description,source_type,status) values
 ('14010000-0000-4000-8000-000000000020','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','2026-09-10','RON','Previous utilities','fixture','draft'),
 ('14010000-0000-4000-8000-000000000021','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','2026-10-05','RON','Current utilities','fixture','draft'),
 ('14010000-0000-4000-8000-000000000022','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','2026-10-06','RON','Current maintenance','fixture','draft'),
 ('14010000-0000-4000-8000-000000000023','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000003','2026-10-07','EUR','Wrong currency draft','fixture','draft'),
 ('14010000-0000-4000-8000-000000000024','14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000103','2026-10-08','RON','Unbound secret','fixture','draft');
insert into finance.journal_entries(tenant_id,journal_id,account_id,side,amount) values
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000020','14010000-0000-4000-8000-000000000010','debit',100),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000020','14010000-0000-4000-8000-000000000012','credit',100),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000021','14010000-0000-4000-8000-000000000010','debit',150),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000021','14010000-0000-4000-8000-000000000012','credit',150),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000022','14010000-0000-4000-8000-000000000011','debit',50),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000022','14010000-0000-4000-8000-000000000012','credit',50),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000024','14010000-0000-4000-8000-000000000112','debit',999),
 ('14010000-0000-4000-8000-000000000002','14010000-0000-4000-8000-000000000024','14010000-0000-4000-8000-000000000113','credit',999);
update finance.journals set status='posted',posted_at=statement_timestamp(),posted_by='14010000-0000-4000-8000-000000000001' where id in('14010000-0000-4000-8000-000000000020','14010000-0000-4000-8000-000000000021','14010000-0000-4000-8000-000000000022','14010000-0000-4000-8000-000000000024');

select throws_ok($$select customer_api.get_workspace_cost_benchmark_v1('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON')$$,'42501',null,'unauthenticated caller is denied');
select set_config('request.jwt.claims','{"sub":"14010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
create temporary table c14_result(value jsonb) on commit drop;
insert into c14_result select customer_api.get_workspace_cost_benchmark_v1('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON');
select is((select value->>'contract_version' from c14_result),'workspace-cost-benchmark.v1','C14 returns versioned projection');
select is((select (value->'current_period'->>'expense_total')::numeric from c14_result),200::numeric,'current bound Workspace expense total is correct');
select is((select (value->'previous_period'->>'expense_total')::numeric from c14_result),100::numeric,'equal-length previous period total is correct');
select is((select (value->>'delta_amount')::numeric from c14_result),100::numeric,'absolute delta is correct');
select is((select (value->>'delta_percent')::numeric from c14_result),100::numeric,'percentage delta is correct');
select is((select jsonb_array_length(value->'categories') from c14_result),2,'two visible expense categories are returned');
select ok(not ((select value::text from c14_result) like '%Secret other property%'),'unbound property account is not disclosed');
select ok(not ((select value from c14_result) ?| array['tenant_id','actor_id']),'tenant and actor identifiers are withheld');
select is((select value->'external_benchmark'->>'status' from c14_result),'withheld','regional benchmark is withheld without approved data');
select is((select value->'external_benchmark'->>'reason_code' from c14_result),'approved_regional_dataset_unavailable','withholding reason is explicit');
select is((select value->>'comparison_kind' from c14_result),'workspace_prior_period','result does not masquerade as regional comparison');
select is((select value->>'read_only_projection' from c14_result),'true','response declares zero-write projection');
select is((select count(*) from audit.events where entity_type like 'cost_benchmark%'),0::bigint,'C14 read writes no audit row');
select is((select count(*) from platform.outbox_events where aggregate_type like 'cost_benchmark%'),0::bigint,'C14 read writes no outbox row');
select throws_ok($$select customer_api.get_workspace_cost_benchmark_v1('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000104','2026-10-01','2026-10-31','RON')$$,'42501',null,'other Workspace is denied');
select throws_ok($$select customer_api.get_workspace_cost_benchmark_v1('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000004','2025-01-01','2026-10-31','RON')$$,'22023','cost_benchmark_input_invalid','period longer than one year is rejected');
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id='14010000-0000-4000-8000-000000000006';
select throws_ok($$select customer_api.get_workspace_cost_benchmark_v1('14010000-0000-4000-8000-000000000006','14010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON')$$,'42501',null,'projection cannot replay after AUTH01 revoke');
select is((select count(*) from finance.journals),5::bigint,'all C14 reads and denials leave the ledger unchanged');

select * from finish();
rollback;
