begin;
set local search_path = public, extensions;

select plan(8);

select has_schema('pm_private','PM private schema exists before rollback rehearsal');
select has_table('platform','platform_users','Canonical platform identity exists before rollback');
select has_table('audit','events','Canonical audit ledger exists before rollback');
select is((select sum(row_count) from (
  select count(*)::bigint as row_count from pm_private.programs
  union all select count(*) from pm_private.work_packages
  union all select count(*) from pm_private.execution_cycles
  union all select count(*) from pm_private.command_receipts
  union all select count(*) from pm_private.outbox_events
) counts),0::numeric,'No retained PM runtime records exist before destructive local rehearsal');
select is((select count(*) from audit.events where action like 'PM_%'),0::bigint,
  'No orphan PM audit records exist before rollback rehearsal');

drop schema pm_private cascade;

select ok(not exists(select 1 from pg_namespace where nspname='pm_private'),
  'Private PM schema is removable in the pre-data rollback window');
select has_table('platform','platform_users','Rollback leaves canonical platform identity intact');
select has_table('audit','events','Rollback leaves canonical audit ledger intact');

select * from finish();
rollback;
