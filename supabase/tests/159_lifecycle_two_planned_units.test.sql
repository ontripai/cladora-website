begin;
select plan(12);

insert into auth.users(id,email) values ('15900000-0000-4000-8000-000000000001','lifecycle159@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('15900000-0000-4000-8000-000000000002','Lifecycle two unit tenant','LC159','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('15900000-0000-4000-8000-000000000003','15900000-0000-4000-8000-000000000002','condominium','Planned property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('15900000-0000-4000-8000-000000000004','15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000003','B','Planned building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('15900000-0000-4000-8000-000000000010','15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000004','P-01'),
 ('15900000-0000-4000-8000-000000000011','15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000004','P-02'),
 ('15900000-0000-4000-8000-000000000012','15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000004','F-01A'),
 ('15900000-0000-4000-8000-000000000013','15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000004','F-01B');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('15900000-0000-4000-8000-000000000020','15900000-0000-4000-8000-000000000002','person','Synthetic party');
insert into portfolio.ownerships(id,tenant_id,unit_id,party_id,share,valid_from,evidence_id) values
 ('15900000-0000-4000-8000-000000000021','15900000-0000-4000-8000-000000000002',
  '15900000-0000-4000-8000-000000000010','15900000-0000-4000-8000-000000000020',1,'2026-01-01',null);

select lives_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,area_m2,source_reference,recorded_by) values
 ('15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000010',1,
  '15900000-0000-4000-8000-000000000004','P-01',90,'test://plan/1','15900000-0000-4000-8000-000000000001'),
 ('15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000011',1,
  '15900000-0000-4000-8000-000000000004','P-02',80,'test://plan/1','15900000-0000-4000-8000-000000000001')$$,
 'Two planned units have independent initial snapshots');
select lives_ok($$insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,area_m2,source_reference,recorded_by) values
 ('15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000010',2,
  '15900000-0000-4000-8000-000000000004','Final-01',92,'test://plan/2','15900000-0000-4000-8000-000000000001')$$,
 'Renumber and area revision keep the first UUID');
select is((select array_agg(unit_code order by version) from portfolio.unit_specification_versions
 where unit_id='15900000-0000-4000-8000-000000000010'),array['P-01','Final-01']::text[],
 'Prior provisional code remains traceable');
select is((select count(*) from portfolio.unit_specification_versions where unit_id='15900000-0000-4000-8000-000000000011'),
 1::bigint,'Second planned unit is not rewritten by first revision');
select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15900000-0000-4000-8000-000000000002','15900000-0000-4000-8000-000000000003','split',
 array['15900000-0000-4000-8000-000000000010']::uuid[],
 array['15900000-0000-4000-8000-000000000012','15900000-0000-4000-8000-000000000013']::uuid[],
 'test://split','15900000-0000-4000-8000-000000000001')$$,
 'Split records new identities without reassigning older rows');
select is((select unit_id from portfolio.ownerships where id='15900000-0000-4000-8000-000000000021'),
 '15900000-0000-4000-8000-000000000010'::uuid,'Historical relationship still references original UUID');
select is((select count(*) from portfolio.ownerships where unit_id in
 ('15900000-0000-4000-8000-000000000012','15900000-0000-4000-8000-000000000013')),0::bigint,
 'Lineage does not confer ownership on successors');
select is((select count(*) from portfolio.units where id in
 ('15900000-0000-4000-8000-000000000010','15900000-0000-4000-8000-000000000011')),2::bigint,
 'Both original canonical units remain');
select is((select count(*) from portfolio.unit_lineage_events),1::bigint,'Only explicit split event exists');
select ok(not has_table_privilege('authenticated','portfolio.unit_specification_versions','SELECT'),
 'Customer cannot read private revision records directly');
select ok(not has_table_privilege('authenticated','portfolio.unit_lineage_events','SELECT'),
 'Customer cannot read private lineage directly');
select is((select count(*) from portfolio.unit_specification_versions),3::bigint,
 'Two units and one revision yield exactly three snapshots');
select * from finish();
rollback;
