begin;
select plan(25);

select is((select count(*) from identity.permissions where code like 'experience.guide.%'),0::bigint,
  'Storage migration does not seed Core permissions');
select is((select count(*) from platform.module_definitions where code='experience_guides'),0::bigint,
  'Storage migration does not activate a Guide module');
select has_schema('experience','Existing CE Guide proposal schema is reused');
select has_table('experience','guides','Canonical Guide aggregate table is installed');
select has_table('experience','guide_steps','Canonical Guide step table is installed');
select has_table('experience','guide_references','Canonical immutable reference table is installed');
select ok(to_regclass('experience.guide_command_receipts') is null,
  'No parallel CE receipt or replay ledger is installed');
select ok((select relrowsecurity from pg_class where oid='experience.guides'::regclass),
  'Guide RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='experience.guide_steps'::regclass),
  'Step RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='experience.guide_references'::regclass),
  'Reference RLS is enabled');
select ok(not has_table_privilege('anon','experience.guides','SELECT,INSERT,UPDATE,DELETE'),
  'Anonymous has no Guide table access');
select ok(not has_table_privilege('authenticated','experience.guides','SELECT,INSERT,UPDATE,DELETE'),
  'Authenticated has no Guide table access');
select ok(not has_table_privilege('service_role','experience.guides','SELECT,INSERT,UPDATE,DELETE'),
  'Service role has no Guide table access');
select ok(not has_table_privilege('authenticated','experience.guide_steps','SELECT,INSERT,UPDATE,DELETE'),
  'Authenticated has no step table access');
select ok(not has_table_privilege('authenticated','experience.guide_references','SELECT,INSERT,UPDATE,DELETE'),
  'Authenticated has no reference table access');
select ok(not has_table_privilege('service_role','experience.guide_references','SELECT,INSERT,UPDATE,DELETE'),
  'Service role has no destination reference access');
select has_trigger('experience','guides','ce_guides_guard','Guide version and lifecycle guard is installed');
select has_trigger('experience','guide_steps','ce_guide_steps_guard','Step immutability guard is installed');
select has_trigger('experience','guide_references','ce_guide_references_guard',
  'Reference immutability guard is installed');
select ok(exists(select 1 from information_schema.columns
  where table_schema='experience' and table_name='guides' and column_name='content_version'),
  'Guide carries an explicit content version');
select ok(exists(select 1 from information_schema.columns
  where table_schema='experience' and table_name='guide_references' and column_name='document_version_id'),
  'Reference binds an immutable Documents version identity');
select ok(exists(select 1 from information_schema.columns
  where table_schema='experience' and table_name='guide_references' and column_name='document_version'),
  'Reference binds the positive Documents version number');
select ok(to_regprocedure('customer_api.command_ce_guide_v1(jsonb)') is null,
  'No legacy command RPC is activated');
select ok(to_regprocedure('customer_api.read_ce_guides_v1(uuid,uuid)') is null,
  'No public Guide read RPC is activated');
select ok(to_regprocedure('customer_api.resolve_ce_guide_reference_v1(uuid,uuid,uuid)') is null,
  'No destination resolver is activated');

select * from finish();
rollback;
