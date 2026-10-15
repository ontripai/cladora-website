begin;
select plan(36);

select has_table('platform','jurisdiction_profiles','jurisdiction profile registry exists');
select has_table('platform','jurisdiction_profile_domains','domain artifact registry exists');
select has_table('platform','property_jurisdiction_assignments','property binding registry exists');
select has_trigger('platform','jurisdiction_profiles','jurisdiction_profiles_guard','profile guard exists');
select has_trigger('platform','jurisdiction_profile_domains','jurisdiction_domains_guard','domain guard exists');
select has_trigger('platform','property_jurisdiction_assignments','property_jurisdiction_assignments_guard','assignment guard exists');
select has_trigger('portfolio','addresses','jurisdiction_bound_address_guard','address country guard exists');
select has_trigger('portfolio','properties','jurisdiction_bound_property_address_guard','property address guard exists');

select is((select count(*)::integer from platform.jurisdiction_profiles),0,
  'migration seeds no country profile');
select is((select count(*)::integer from platform.property_jurisdiction_assignments),0,
  'migration backfills no property');
select ok(not has_table_privilege('anon','platform.jurisdiction_profiles','SELECT'),
  'anon cannot read profiles');
select ok(not has_table_privilege('authenticated','platform.jurisdiction_profiles','SELECT'),
  'authenticated cannot read profiles');
select ok(not has_table_privilege('service_role','platform.jurisdiction_profiles','INSERT'),
  'service role cannot activate profiles');
select ok(not has_table_privilege('service_role','platform.property_jurisdiction_assignments','INSERT'),
  'service role cannot bind properties');
select is((select column_default from information_schema.columns
  where table_schema='portfolio' and table_name='addresses' and column_name='country_code'),null,
  'address country has no implicit default');
select is((select count(*)::integer from pg_index i
  join pg_class c on c.oid=i.indrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portfolio' and c.relname='addresses' and i.indisunique
    and exists(select 1 from unnest(i.indkey::smallint[]) key
      join pg_attribute a on a.attrelid=c.oid and a.attnum=key
      where a.attname='postal_code')),0,
  'postal code is not part of a uniqueness rule');

insert into platform.jurisdiction_profiles(
  id,code,version,country_code,name,default_currency_code,default_timezone,
  calendar_code,manifest_sha256,status,valid_from,
  legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at
) values(
  '10000000-0000-0000-0000-000000000001','test_ro_property',1,'RO','Test Romania',
  'RON','Europe/Bucharest','gregorian',repeat('a',64),'draft','2026-01-01',
  'legal:test',statement_timestamp(),'accounting:test',statement_timestamp()
),(
  '10000000-0000-0000-0000-000000000002','test_ir_property',1,'IR','Test Iran',
  'IRR','Asia/Tehran','solar_hijri',repeat('b',64),'draft','2026-01-01',
  'legal:test',statement_timestamp(),'accounting:test',statement_timestamp()
),(
  '10000000-0000-0000-0000-000000000005','test_ca_property',1,'CA','Test Canada',
  'CAD','America/Toronto','gregorian',repeat('6',64),'draft','2026-01-01',
  'legal:test',statement_timestamp(),'accounting:test',statement_timestamp()
);
insert into platform.jurisdiction_profile_domains(
  jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from
) values
  ('10000000-0000-0000-0000-000000000001','finance.statutory','finance-statutory.v1',repeat('c',64),true,'active','2026-01-01'),
  ('10000000-0000-0000-0000-000000000002','finance.statutory','finance-statutory.v1',repeat('d',64),true,'active','2026-01-01'),
  ('10000000-0000-0000-0000-000000000005','finance.statutory','finance-statutory.v1',repeat('7',64),true,'active','2026-01-01'),
  ('10000000-0000-0000-0000-000000000001','payments.local_rails','payments-local-rails.v1',repeat('8',64),true,'active','2026-01-01'),
  ('10000000-0000-0000-0000-000000000002','payments.local_rails','payments-local-rails.v1',repeat('9',64),true,'active','2026-01-01'),
  ('10000000-0000-0000-0000-000000000005','payments.local_rails','payments-local-rails.v1',repeat('0',64),true,'active','2026-01-01');
update platform.jurisdiction_profiles set status='validated';
update platform.jurisdiction_profiles set status='active';

select is((select count(*)::integer from platform.jurisdiction_profiles where status='active'),3,
  'multiple countries can have independent active profiles');
select is((select count(distinct country_code)::integer from platform.jurisdiction_profiles),3,
  'profile registry is not limited to a two-country model');
select is((select count(*)::integer from platform.jurisdiction_profile_domains
  where domain_code='payments.local_rails' and status='active'),3,
  'each example country pins an independent payment-rules artifact');
select throws_like($$delete from platform.jurisdiction_profiles where code='test_ro_property'$$,
  'jurisdiction_profile_history_immutable','profile deletion is denied');
select throws_like($$update platform.jurisdiction_profiles set country_code='IR' where code='test_ro_property'$$,
  'jurisdiction_profile_definition_immutable','profile country mutation is denied');
select throws_like($$update platform.jurisdiction_profile_domains set artifact_sha256=repeat('e',64)
  where domain_code='finance.statutory'$$,
  'jurisdiction_domain_artifact_immutable','domain artifact mutation is denied');
select throws_like($$insert into platform.jurisdiction_profile_domains(
  jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
  values('10000000-0000-0000-0000-000000000001','tax.reporting','tax-reporting.v1',repeat('f',64),true,'active','2026-01-01')$$,
  'jurisdiction_profile_definition_closed','active profile cannot gain an unreviewed domain');

insert into platform.jurisdiction_profiles(
  id,code,version,country_code,name,default_currency_code,default_timezone,
  calendar_code,manifest_sha256,status,valid_from,
  legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at
) values(
  '10000000-0000-0000-0000-000000000003','test_unsigned',1,'GB','Unsigned',
  'GBP','Europe/London','gregorian',repeat('1',64),'draft','2026-01-01',null,null,null,null
);
insert into platform.jurisdiction_profile_domains(
  jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
values('10000000-0000-0000-0000-000000000003','finance.statutory','finance-statutory.v1',repeat('2',64),true,'active','2026-01-01');
update platform.jurisdiction_profiles set status='validated' where code='test_unsigned';
select throws_like($$update platform.jurisdiction_profiles set status='active' where code='test_unsigned'$$,
  'jurisdiction_profile_signoff_required','unsigned profile cannot activate');

insert into platform.jurisdiction_profiles(
  id,code,version,country_code,name,default_currency_code,default_timezone,
  calendar_code,manifest_sha256,status,valid_from,
  legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at
) values(
  '10000000-0000-0000-0000-000000000004','test_domain_pending',1,'DE','Pending domain',
  'EUR','Europe/Berlin','gregorian',repeat('3',64),'draft','2026-01-01',
  'legal:test',statement_timestamp(),'accounting:test',statement_timestamp()
);
insert into platform.jurisdiction_profile_domains(
  jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
values('10000000-0000-0000-0000-000000000004','tax.reporting','tax-reporting.v1',repeat('4',64),true,'validated','2026-01-01');
update platform.jurisdiction_profiles set status='validated' where code='test_domain_pending';
select throws_like($$update platform.jurisdiction_profiles set status='active' where code='test_domain_pending'$$,
  'jurisdiction_profile_required_domain_unavailable','pending required domain blocks activation');

select throws_like($$insert into platform.jurisdiction_profiles(
  code,version,country_code,name,default_currency_code,default_timezone,calendar_code,
  manifest_sha256,status,valid_from) values(
  'test_timezone',1,'US','Bad timezone','USD','Invalid/Nowhere','gregorian',repeat('5',64),'draft','2026-01-01')$$,
  'jurisdiction_profile_timezone_invalid','unknown timezone is rejected');
select ok((select country_code='RO' from platform.jurisdiction_profiles where code='test_ro_property'),
  'Romania profile remains unchanged');
select ok((select country_code='IR' from platform.jurisdiction_profiles where code='test_ir_property'),
  'Iran profile remains independent');
select is((select count(*)::integer from platform.property_jurisdiction_assignments),0,
  'profile validation creates no property assignment');

insert into platform.tenants(id,legal_name,status,default_locale,timezone)
values('20000000-0000-4000-8000-000000000001','Multi-country test','active','en','UTC');
insert into platform.customer_workspaces(
  id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment
) values(
  '20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
  'OWNER_PORTFOLIO','ACTIVE','Synthetic test','PILOT'
);
select throws_like($$insert into portfolio.addresses(id,tenant_id,city,street) values(
  '20000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000001','Unknown','No country')$$,
  'null value in column "country_code"%','new address without explicit country is rejected');
insert into portfolio.addresses(id,tenant_id,country_code,city,street,postal_code) values
  ('20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','RO','Bucharest','Test','010101'),
  ('20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','IR','Tehran','Test','010101'),
  ('20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','CA','Ottawa','Test','K1A 0B1');
select is((select count(*)::integer from portfolio.addresses where postal_code='010101'),2,
  'the same postal text may identify addresses in different countries');
select is((select count(*)::integer from portfolio.addresses where postal_code in ('010101','K1A 0B1')),3,
  'numeric and alphanumeric postal formats coexist');
insert into portfolio.properties(id,tenant_id,type,name,address_id,base_currency,status) values
  ('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','condominium','RO property','20000000-0000-4000-8000-000000000003','RON','active'),
  ('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','condominium','IR property','20000000-0000-4000-8000-000000000004','IRR','active'),
  ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','condominium','CA property','20000000-0000-4000-8000-000000000009','CAD','active');
insert into platform.workspace_property_bindings(
  id,tenant_id,customer_workspace_id,property_id,status,valid_from,binding_source
) values
  ('20000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','active',statement_timestamp()-interval '1 day','platform_assignment'),
  ('20000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000006','active',statement_timestamp()-interval '1 day','platform_assignment'),
  ('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000010','active',statement_timestamp()-interval '1 day','platform_assignment');
insert into platform.property_jurisdiction_assignments(
  tenant_id,customer_workspace_id,property_id,jurisdiction_profile_id,
  assignment_version,status,binding_source,reason
) values
  ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000001',1,'active','platform_verified','Synthetic RO binding'),
  ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000006','10000000-0000-0000-0000-000000000002',1,'active','platform_verified','Synthetic IR binding'),
  ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000010','10000000-0000-0000-0000-000000000005',1,'active','platform_verified','Synthetic CA binding');

select is((select count(distinct country_code)::integer
  from platform.property_jurisdiction_assignments
  where customer_workspace_id='20000000-0000-4000-8000-000000000002'),3,
  'one Workspace may contain active properties across an open country catalog');
select throws_like($$insert into platform.property_jurisdiction_assignments(
  tenant_id,customer_workspace_id,property_id,jurisdiction_profile_id,
  assignment_version,status,binding_source,reason) values(
  '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000002',
  2,'active','platform_verified','Cross-country attempt')$$,
  'property_jurisdiction_address_country_mismatch','property cannot consume another country profile');
select throws_like($$update portfolio.addresses set country_code='IR'
  where id='20000000-0000-4000-8000-000000000003'$$,
  'property_jurisdiction_address_country_immutable','bound address country cannot change');
select throws_like($$update portfolio.properties
  set address_id='20000000-0000-4000-8000-000000000004'
  where id='20000000-0000-4000-8000-000000000005'$$,
  'property_jurisdiction_property_country_immutable','bound property cannot move to another country address');

select * from finish();
rollback;
