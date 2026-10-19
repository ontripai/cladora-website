begin;
select plan(25);

select has_function('customer_api','get_observed_savings_evidence_v1',array['uuid','uuid','date','date','text'],'C15 exposes a bounded projection RPC');
select is((select provolatile::text from pg_proc where oid='customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)'::regprocedure),'s','C15 projection is STABLE');
select ok((select prosecdef from pg_proc where oid='customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)'::regprocedure),'C15 RPC is SECURITY DEFINER');
select ok(has_function_privilege('authenticated','customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)','EXECUTE'),'authenticated may use C15 gateway');
select ok(not has_function_privilege('service_role','customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)','EXECUTE'),'service role cannot bypass actor authority');
select alike(pg_get_functiondef('customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)'::regprocedure),'%get_workspace_cost_benchmark_v1%','C15 consumes C14 instead of duplicating its ledger projection');
select ok(pg_get_functiondef('customer_api.get_observed_savings_evidence_v1(uuid,uuid,date,date,text)'::regprocedure) not like '%finance.journal_entries%','C15 creates no parallel ledger reader');
select ok(not has_table_privilege('authenticated','finance.journals','INSERT'),'C15 consumer cannot write Finance journals');

insert into auth.users(id,email,email_confirmed_at)values('15010000-0000-4000-8000-000000000001','c15@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status)values('15010000-0000-4000-8000-000000000002','C15 tenant','C15-A','active');
insert into portfolio.properties(id,tenant_id,type,name,status)values('15010000-0000-4000-8000-000000000003','15010000-0000-4000-8000-000000000002','condominium','C15 property','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status)values('15010000-0000-4000-8000-000000000004','15010000-0000-4000-8000-000000000002','ASSOCIATION','C15 operator','ACTIVE'),('15010000-0000-4000-8000-000000000104','15010000-0000-4000-8000-000000000002','ASSOCIATION','Other operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)select'15010000-0000-4000-8000-000000000005','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000001',r.id,'active',statement_timestamp()-interval'1 day'from identity.roles r where r.code='association_admin'and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at)values('15010000-0000-4000-8000-000000000006','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000005','tenant',statement_timestamp()-interval'1 day');
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)select'15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000004',p.id,o.id,'active',statement_timestamp()-interval'1 day','15010000-0000-4000-8000-000000000001','RO'from platform.property_profiles p cross join platform.operating_models o where p.code='residential_condominium'and p.version=1 and o.code='association_managed'and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,activated_at,activated_by,reason)select'15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000004',m.id,m.code,'active',statement_timestamp()-interval'1 day',statement_timestamp()-interval'1 day','15010000-0000-4000-8000-000000000001','C15 fixture'from platform.module_definitions m where m.code='accounting';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)values('15010000-0000-4000-8000-000000000004','module.accounting','boolean',true,statement_timestamp()-interval'1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)values('15010000-0000-4000-8000-000000000007','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000004','c15_reader','C15 reader','workspace','15010000-0000-4000-8000-000000000001',statement_timestamp()-interval'1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)select'15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000007',m.id from platform.module_definitions m where m.code='accounting';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)select'15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000007',p.id,'allow'from identity.permissions p where p.code='finance.reports.read';
update platform.workspace_roles set lifecycle_status='published',lock_version=2 where id='15010000-0000-4000-8000-000000000007';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from)values('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000004','15010000-0000-4000-8000-000000000005','15010000-0000-4000-8000-000000000007','workspace','15010000-0000-4000-8000-000000000001','15010000-0000-4000-8000-000000000005','C15 authority',statement_timestamp()-interval'1 hour');
insert into platform.workspace_property_bindings(id,tenant_id,customer_workspace_id,property_id,status,valid_from,binding_source,created_by)values('15010000-0000-4000-8000-000000000008','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000004','15010000-0000-4000-8000-000000000003','active',statement_timestamp()-interval'1 day','platform_assignment','15010000-0000-4000-8000-000000000001');
insert into finance.accounts(id,tenant_id,property_id,code,name,type,currency)values
 ('15010000-0000-4000-8000-000000000010','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','601','Utilities','expense','RON'),
 ('15010000-0000-4000-8000-000000000011','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','602','Maintenance','expense','RON'),
 ('15010000-0000-4000-8000-000000000012','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','512','Cash','asset','RON');
insert into finance.journals(id,tenant_id,property_id,occurred_on,currency,description,source_type,status)values
 ('15010000-0000-4000-8000-000000000020','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','2026-09-10','RON','Baseline','fixture','draft'),
 ('15010000-0000-4000-8000-000000000021','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','2026-10-05','RON','Current utility','fixture','draft'),
 ('15010000-0000-4000-8000-000000000022','15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000003','2026-10-06','RON','Current maintenance','fixture','draft');
insert into finance.journal_entries(tenant_id,journal_id,account_id,side,amount)values
 ('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000020','15010000-0000-4000-8000-000000000010','debit',200),('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000020','15010000-0000-4000-8000-000000000012','credit',200),
 ('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000021','15010000-0000-4000-8000-000000000010','debit',150),('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000021','15010000-0000-4000-8000-000000000012','credit',150),
 ('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000022','15010000-0000-4000-8000-000000000011','debit',20),('15010000-0000-4000-8000-000000000002','15010000-0000-4000-8000-000000000022','15010000-0000-4000-8000-000000000012','credit',20);
update finance.journals set status='posted',posted_at=statement_timestamp(),posted_by='15010000-0000-4000-8000-000000000001';

select throws_ok($$select customer_api.get_observed_savings_evidence_v1('15010000-0000-4000-8000-000000000006','15010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON')$$,'42501',null,'unauthenticated caller is denied through C14/AUTH01');
select set_config('request.jwt.claims','{"sub":"15010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
create temporary table c15_result(value jsonb)on commit drop;insert into c15_result select customer_api.get_observed_savings_evidence_v1('15010000-0000-4000-8000-000000000006','15010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON');
select is((select value->>'contract_version'from c15_result),'observed-savings-evidence.v1','C15 response is versioned');
select is((select(value->>'observed_savings')::numeric from c15_result),30::numeric,'total observed reduction is arithmetic and correct');
select is((select(value->>'observed_added_cost')::numeric from c15_result),0::numeric,'overall added cost is separated from reduction');
select is((select(value->>'net_savings')::numeric from c15_result),30::numeric,'net favourable variance is correct');
select is((select jsonb_array_length(value->'categories')from c15_result),2,'category evidence comes from C14 categories');
select is((select value->'categories'->0->>'classification'from c15_result),'observed_saving','largest category is classified as observed saving');
select ok(exists(select 1 from c15_result,jsonb_array_elements(value->'categories')item where item->>'classification'='increased_cost'),'increased category cost is not hidden by net savings');
select is((select value->'causal_attribution'->>'status'from c15_result),'withheld','causal attribution is withheld');
select is((select value->'asset_value_claim'->>'status'from c15_result),'withheld','asset value claim is withheld');
select is((select value->'evidence_basis'->>'contract_version'from c15_result),'workspace-cost-benchmark.v1','evidence pins C14 source contract');
select is((select value->>'read_only_projection'from c15_result),'true','C15 declares zero-write projection');
select is((select count(*)from audit.events where entity_type like'observed_savings%'),0::bigint,'C15 read creates no audit mutation');
select is((select count(*)from platform.outbox_events where aggregate_type like'observed_savings%'),0::bigint,'C15 read creates no outbox mutation');
select throws_ok($$select customer_api.get_observed_savings_evidence_v1('15010000-0000-4000-8000-000000000006','15010000-0000-4000-8000-000000000104','2026-10-01','2026-10-31','RON')$$,'42501',null,'other Workspace is denied');
update identity.context_grants set ends_at=statement_timestamp()-interval'1 second'where id='15010000-0000-4000-8000-000000000006';
select throws_ok($$select customer_api.get_observed_savings_evidence_v1('15010000-0000-4000-8000-000000000006','15010000-0000-4000-8000-000000000004','2026-10-01','2026-10-31','RON')$$,'42501',null,'C15 cannot replay after AUTH01 revoke');
select is((select count(*)from finance.journals),3::bigint,'C15 reads leave the ledger unchanged');

select*from finish();rollback;
