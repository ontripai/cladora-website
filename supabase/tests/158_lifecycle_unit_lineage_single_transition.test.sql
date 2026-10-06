begin;
select plan(8);

insert into auth.users(id,email) values ('15800000-0000-4000-8000-000000000001','lineage158@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('15800000-0000-4000-8000-000000000002','Lineage transition tenant','LC158','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('15800000-0000-4000-8000-000000000003','15800000-0000-4000-8000-000000000002','condominium','Transition property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('15800000-0000-4000-8000-000000000004','15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','B','Transition building');
insert into portfolio.units(id,tenant_id,building_id,code)
select ('15800000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000004','U'||n
from generate_series(10,17) n;

select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','split',
 array['15800000-0000-4000-8000-000000000010']::uuid[],
 array['15800000-0000-4000-8000-000000000012','15800000-0000-4000-8000-000000000013']::uuid[],
 'test://split','15800000-0000-4000-8000-000000000001')$$,'First split accepted');
select throws_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','split',
 array['15800000-0000-4000-8000-000000000010']::uuid[],
 array['15800000-0000-4000-8000-000000000014','15800000-0000-4000-8000-000000000015']::uuid[],
 'test://conflicting-split','15800000-0000-4000-8000-000000000001')$$,
 '23505','unit_lineage_transition_conflict','Same predecessor cannot split twice');
select throws_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','split',
 array['15800000-0000-4000-8000-000000000011']::uuid[],
 array['15800000-0000-4000-8000-000000000013','15800000-0000-4000-8000-000000000015']::uuid[],
 'test://conflicting-origin','15800000-0000-4000-8000-000000000001')$$,
 '23505','unit_lineage_transition_conflict','Same successor cannot have two origins');
select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','merge',
 array['15800000-0000-4000-8000-000000000012','15800000-0000-4000-8000-000000000011']::uuid[],
 array['15800000-0000-4000-8000-000000000014']::uuid[],
 'test://merge','15800000-0000-4000-8000-000000000001')$$,
 'Prior successor may later merge with another unit');
select lives_ok($$insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by) values
 ('15800000-0000-4000-8000-000000000002','15800000-0000-4000-8000-000000000003','split',
 array['15800000-0000-4000-8000-000000000014']::uuid[],
 array['15800000-0000-4000-8000-000000000016','15800000-0000-4000-8000-000000000017']::uuid[],
 'test://later-split','15800000-0000-4000-8000-000000000001')$$,
 'Merged successor may later be split');
select is((select count(*) from portfolio.unit_lineage_events where property_id='15800000-0000-4000-8000-000000000003'),
 3::bigint,'Only three valid transitions persisted');
select is((select count(*) from portfolio.units where id in
 ('15800000-0000-4000-8000-000000000010','15800000-0000-4000-8000-000000000011')),
 2::bigint,'Both original planned units retain their UUIDs');
select ok(not has_function_privilege('authenticated','app_private.guard_unit_lineage_single_transition_v1()','EXECUTE'),
 'Guard function is private');
select * from finish();
rollback;
