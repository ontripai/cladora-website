-- New experiment only: compare the same checker with cold/warm/typed context.
-- No upstream routine, application object, ACL, role or global setting changes.
begin;
do $preflight$
begin
 if current_schema()<>'public' or current_setting('server_version_num')<>'170006'
  or (select extversion from pg_extension where extname='pgtap') is distinct from '1.3.3'
  or exists(select 1 from pg_extension where extname='plpgsql_check')
  or to_regclass('__tcache__') is not null
  or to_regclass('__tresults___numb_seq') is not null then
  raise exception 'BLOCKED_UNKNOWN_VERSION_OR_NONFRESH_SESSION';
 end if;
end;
$preflight$;
create extension if not exists plpgsql_check;
set local search_path=pg_catalog,public,extensions,pg_temp;
do $checker_contract$
begin
 if (select extversion from pg_extension where extname='plpgsql_check') is distinct from '2.7'
  or not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid
   join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass and d.deptype='e'
   where n.nspname='public' and p.proname='plpgsql_check_function_tb'
    and p.proargtypes[0]='regprocedure'::regtype
    and p.proargnames @> array['funcoid','anyelememttype'] and e.extname='plpgsql_check') then
  raise exception 'BLOCKED_UNKNOWN_CHECKER_CONTRACT';
 end if;
end;
$checker_contract$;

create temp table advisor_context_targets(signature text primary key, category text not null, expected_state text not null) on commit drop;
insert into pg_temp.advisor_context_targets values
 ('extensions.plan(integer)','SESSION_STATE','42P01'),
 ('extensions.add_result(boolean,boolean,text,text,text)','SESSION_STATE','42P01'),
 ('extensions.check_test(text,boolean,text,text,text,boolean)','SESSION_STATE','42P01'),
 ('extensions._currtest()','SESSION_STATE','42P01'),
 ('extensions._prokind(oid)','VERSION_BRANCH','42703'),
 ('extensions.has_tablespace(name,text,text)','VERSION_BRANCH','42703'),
 ('extensions._def_is(text,text,anyelement,text)','POLYMORPHIC_STATIC_CALL','42883'),
 ('extensions.row_eq(text,anyelement,text)','POLYMORPHIC_STATIC_CALL','42883');
create temp table advisor_context_results(phase text,signature text,diagnostics jsonb,error_states text[]) on commit drop;
create temp table advisor_context_row(n integer,label text) on commit drop;
create temp table advisor_context_originals on commit drop as
 select signature,md5(pg_get_functiondef(to_regprocedure(signature))) definition_hash
 from pg_temp.advisor_context_targets;

create function pg_temp.advisor_context_check(phase text,signature text,element_type regtype default 'integer'::regtype)
returns void language plpgsql security invoker set search_path=pg_catalog,public,extensions,pg_temp
as $probe$
declare routine regprocedure:=to_regprocedure(signature); report jsonb; states text[];
begin
 if routine is null or not exists(select 1 from pg_temp.advisor_context_targets t where t.signature=advisor_context_check.signature) then
  raise exception 'BLOCKED_UNKNOWN_TARGET';
 end if;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb),
  coalesce(array_agg(d.sqlstate order by d.sqlstate) filter(where d.level='error'),array[]::text[])
 into report,states from public.plpgsql_check_function_tb(routine,anyelememttype=>element_type) d;
 insert into pg_temp.advisor_context_results values(phase,signature,report,states);
end;
$probe$;

-- Reproduce the CLI's default integer polymorphic assumption in a fresh session.
select pg_temp.advisor_context_check('cold-default',signature) from pg_temp.advisor_context_targets order by signature;
select 'ADVISOR_CONTEXT_RAW '||jsonb_build_object('phase',phase,'signature',signature,
 'diagnostics',diagnostics,'error_states',error_states)::text
 from pg_temp.advisor_context_results where phase='cold-default' order by signature;
do $cold_gate$
begin
 if (select count(*) from pg_temp.advisor_context_results where phase='cold-default')<>8
  or exists(select 1 from pg_temp.advisor_context_results r join pg_temp.advisor_context_targets t using(signature)
   where r.phase='cold-default' and r.error_states is distinct from array[t.expected_state])
  or to_regclass('__tcache__') is not null or to_regclass('__tresults___numb_seq') is not null then
  raise exception 'COLD_DIAGNOSTICS_OR_READONLY_CHECKER_BEHAVIOR_CHANGED';
 end if;
end;
$cold_gate$;

-- Initialize only this session's genuine upstream TAP cache and sequence.
do $warm_session$
begin
 perform extensions.plan(1);
 perform extensions.add_result(true,false,'context initialization','','');
end;
$warm_session$;
select pg_temp.advisor_context_check('warm-default',signature) from pg_temp.advisor_context_targets order by signature;
select pg_temp.advisor_context_check('warm-typed','extensions._def_is(text,text,anyelement,text)','text'::regtype);
select pg_temp.advisor_context_check('warm-typed','extensions.row_eq(text,anyelement,text)','pg_temp.advisor_context_row'::regtype);

-- Preserve every raw per-function diagnostic, including warnings and error states.
select 'ADVISOR_CONTEXT_RAW '||jsonb_build_object('phase',phase,'signature',signature,
 'diagnostics',diagnostics,'error_states',error_states)::text
 from pg_temp.advisor_context_results where phase<>'cold-default' order by phase,signature;
do $context_gates$
begin
 if (select count(*) from pg_temp.advisor_context_results)<>18 then
  raise exception 'CONTEXT_EXPERIMENT_INCOMPLETE';
 end if;
 if exists(select 1 from pg_temp.advisor_context_results r join pg_temp.advisor_context_targets t using(signature)
  where r.phase='warm-default' and r.error_states is distinct from
   case when t.category='SESSION_STATE' then array[]::text[] else array[t.expected_state] end) then
  raise exception 'WARM_CONTEXT_HYPOTHESIS_NOT_PROVEN';
 end if;
 if exists(select 1 from pg_temp.advisor_context_results where phase='warm-typed' and cardinality(error_states)<>0) then
  raise exception 'TYPED_CONTEXT_HYPOTHESIS_NOT_PROVEN';
 end if;
 if exists(select 1 from pg_temp.advisor_context_originals where definition_hash is distinct from md5(pg_get_functiondef(to_regprocedure(signature)))) then
  raise exception 'UPSTREAM_DEFINITION_CHANGED';
 end if;
end;
$context_gates$;
select 'ADVISOR_CONTEXT_SUMMARY '||jsonb_build_object('observations',count(*),
 'cold_default_errors',sum(cardinality(error_states)) filter(where phase='cold-default'),
 'warm_default_errors',sum(cardinality(error_states)) filter(where phase='warm-default'),
 'warm_typed_errors',sum(cardinality(error_states)) filter(where phase='warm-typed'),
 'upstream_definitions_changed',0,'application_objects_changed',0,
 'global_raw_findings_resolved',0,'release_accepted',false)::text
 from pg_temp.advisor_context_results;
rollback;
do $rollback_gate$
begin
 if exists(select 1 from pg_extension where extname='plpgsql_check')
  or to_regclass('pg_temp.advisor_context_targets') is not null
  or to_regclass('__tcache__') is not null or to_regclass('__tresults___numb_seq') is not null then
  raise exception 'CONTEXT_PROBE_ROLLBACK_LEAK';
 end if;
end;
$rollback_gate$;
select 'ADVISOR_CONTEXT_ROLLBACK PASS';
