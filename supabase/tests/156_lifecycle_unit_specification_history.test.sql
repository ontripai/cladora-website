begin;
select plan(13);

insert into auth.users(id,email) values ('15600000-0000-4000-8000-000000000001','unit156@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('15600000-0000-4000-8000-000000000002','Unit version tenant','LC156A','active'),
 ('15600000-0000-4000-8000-000000000003','Other unit tenant','LC156B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('15600000-0000-4000-8000-000000000004','15600000-0000-4000-8000-000000000002','condominium','Versioned property','active'),
 ('15600000-0000-4000-8000-000000000005','15600000-0000-4000-8000-000000000003','condominium','Foreign property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('15600000-0000-4000-8000-000000000006','15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000004','B1','Versioned building'),
 ('15600000-0000-4000-8000-000000000007','15600000-0000-4000-8000-000000000003','15600000-0000-4000-8000-000000000005','B2','Foreign building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('15600000-0000-4000-8000-000000000008','15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000006','U1');

select lives_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,area_m2,source_reference,recorded_by) values
 ('15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000008',1,
 '15600000-0000-4000-8000-000000000006','Provisional 1',50,'test://plan/1','15600000-0000-4000-8000-000000000001')$$,'Initial provisional snapshot');
select lives_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,area_m2,source_reference,recorded_by) values
 ('15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000008',2,
 '15600000-0000-4000-8000-000000000006','Final 101',52,'test://plan/2','15600000-0000-4000-8000-000000000001')$$,'Second snapshot preserves canonical identity');
select is((select array_agg(unit_code order by version) from portfolio.unit_specification_versions
 where unit_id='15600000-0000-4000-8000-000000000008'),array['Provisional 1','Final 101']::text[],'Both codes remain in order');
select is((select count(distinct unit_id) from portfolio.unit_specification_versions
 where tenant_id='15600000-0000-4000-8000-000000000002'),1::bigint,'One canonical unit across revisions');
select is((select area_m2 from portfolio.unit_specification_versions where unit_id='15600000-0000-4000-8000-000000000008' and version=1),50.000::numeric,'Earlier area remains unchanged');
select throws_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by) values
 ('15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000008',4,
 '15600000-0000-4000-8000-000000000006','Gap','test://gap','15600000-0000-4000-8000-000000000001')$$,'23505','unit_specification_version_conflict','Skipped version denied');
select throws_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by) values
 ('15600000-0000-4000-8000-000000000003','15600000-0000-4000-8000-000000000008',3,
 '15600000-0000-4000-8000-000000000006','Foreign','test://foreign','15600000-0000-4000-8000-000000000001')$$,'42501','unit_specification_subject_mismatch','Tenant mismatch denied');
select throws_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by) values
 ('15600000-0000-4000-8000-000000000002','15600000-0000-4000-8000-000000000008',3,
 '15600000-0000-4000-8000-000000000007','Wrong building','test://building','15600000-0000-4000-8000-000000000001')$$,'42501','unit_specification_subject_mismatch','Foreign building denied');
select throws_ok($$update portfolio.unit_specification_versions set unit_code='rewritten'
 where unit_id='15600000-0000-4000-8000-000000000008' and version=1$$,'42501','unit_specification_history_immutable','History cannot be rewritten');
select throws_ok($$delete from portfolio.unit_specification_versions
 where unit_id='15600000-0000-4000-8000-000000000008' and version=1$$,'42501','unit_specification_history_immutable','History cannot be deleted');
select ok(not has_table_privilege('authenticated','portfolio.unit_specification_versions','SELECT'),'Customer cannot read private snapshots');
select ok(not has_table_privilege('service_role','portfolio.unit_specification_versions','INSERT'),'Service role cannot insert directly');
select is((select count(*) from portfolio.unit_specification_versions where unit_id='15600000-0000-4000-8000-000000000008'),2::bigint,'Rejected changes wrote no version');
select * from finish();
rollback;
