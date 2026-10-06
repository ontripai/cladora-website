begin;
select plan(12);

insert into auth.users(id,email) values ('15700000-0000-4000-8000-000000000001','lineage157@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('15700000-0000-4000-8000-000000000002','Lineage tenant','LC157A','active'),
 ('15700000-0000-4000-8000-000000000003','Other lineage tenant','LC157B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('15700000-0000-4000-8000-000000000004','15700000-0000-4000-8000-000000000002','condominium','Planned property','active'),
 ('15700000-0000-4000-8000-000000000005','15700000-0000-4000-8000-000000000003','condominium','Other property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('15700000-0000-4000-8000-000000000006','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','B1','Planned building'),
 ('15700000-0000-4000-8000-000000000007','15700000-0000-4000-8000-000000000003','15700000-0000-4000-8000-000000000005','B2','Other building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('15700000-0000-4000-8000-000000000010','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000006','Planned 1'),
 ('15700000-0000-4000-8000-000000000011','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000006','Planned 2'),
 ('15700000-0000-4000-8000-000000000012','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000006','Split A'),
 ('15700000-0000-4000-8000-000000000013','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000006','Split B'),
 ('15700000-0000-4000-8000-000000000014','15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000006','Merged'),
 ('15700000-0000-4000-8000-000000000015','15700000-0000-4000-8000-000000000003','15700000-0000-4000-8000-000000000007','Foreign');

select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','split',
 array['15700000-0000-4000-8000-000000000010']::uuid[],
 array['15700000-0000-4000-8000-000000000012','15700000-0000-4000-8000-000000000013']::uuid[],
 'test://plan/split','15700000-0000-4000-8000-000000000001')$$,'Two planned successors retain distinct identities');
select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','merge',
 array['15700000-0000-4000-8000-000000000012','15700000-0000-4000-8000-000000000011']::uuid[],
 array['15700000-0000-4000-8000-000000000014']::uuid[],
 'test://plan/merge','15700000-0000-4000-8000-000000000001')$$,'Merge links another planned unit without rewriting it');
select is((select count(*) from portfolio.units where id in
 ('15700000-0000-4000-8000-000000000010','15700000-0000-4000-8000-000000000011')),
 2::bigint,'Original planned UUIDs remain');
select is((select count(*) from portfolio.unit_lineage_events),2::bigint,'Both immutable events remain');
select throws_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','split',
 array['15700000-0000-4000-8000-000000000014']::uuid[],
 array['15700000-0000-4000-8000-000000000010','15700000-0000-4000-8000-000000000013']::uuid[],
 'test://cycle','15700000-0000-4000-8000-000000000001')$$,'23514','unit_lineage_cycle','Indirect cycle denied');
select throws_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','split',
 array['15700000-0000-4000-8000-000000000010']::uuid[],
 array['15700000-0000-4000-8000-000000000012','15700000-0000-4000-8000-000000000012']::uuid[],
 'test://duplicate','15700000-0000-4000-8000-000000000001')$$,'23505','unit_lineage_duplicate_subject','Repeated successor denied');
select throws_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15700000-0000-4000-8000-000000000002','15700000-0000-4000-8000-000000000004','split',
 array['15700000-0000-4000-8000-000000000010']::uuid[],
 array['15700000-0000-4000-8000-000000000012','15700000-0000-4000-8000-000000000015']::uuid[],
 'test://foreign','15700000-0000-4000-8000-000000000001')$$,'42501','unit_lineage_subject_mismatch','Other tenant successor denied');
select throws_ok($$update portfolio.unit_lineage_events set source_reference='changed'$$,
 '42501','unit_lineage_immutable','History cannot be rewritten');
select throws_ok($$delete from portfolio.unit_lineage_events$$,
 '42501','unit_lineage_immutable','History cannot be deleted');
select ok(not has_table_privilege('authenticated','portfolio.unit_lineage_events','SELECT'),'Customer has no direct history read');
select ok(not has_table_privilege('service_role','portfolio.unit_lineage_events','INSERT'),'Service role has no direct write');
select is((select count(*) from portfolio.unit_lineage_events),2::bigint,'Rejected attempts left history intact');
select * from finish();
rollback;
