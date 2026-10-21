-- CE-PGTAP-SESSION-PROBE-01: Coordinator execution ONLY, in a fresh disposable backend.
-- Standalone TAP producer: calling pgTAP here must not change our assertion counter.
-- No extension installation, replacement, ACL change or application fixture.
-- Expected diagnostic observations do NOT clear any Advisor finding.
begin;

-- Capture the real entry environment BEFORE creating fixtures/changing search_path.
select '# CE216_ENV ' || jsonb_build_object(
  'server_version',current_setting('server_version'),
  'server_version_num',current_setting('server_version_num'),
  'session_user',session_user,'current_user',current_user,
  'backend_pid',pg_backend_pid(),'entry_search_path',current_setting('search_path'),
  'entry_schemas',current_schemas(true),'entry_temp_namespace',pg_my_temp_schema(),
  'pgtap',coalesce((select jsonb_build_object('version',e.extversion,'schema',n.nspname,
    'owner',pg_get_userbyid(e.extowner)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgtap'),'"UNKNOWN"'::jsonb),
  'checker',coalesce((select jsonb_build_object('name',e.extname,'version',e.extversion,
    'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace where e.extname='plpgsql_check'),'"UNKNOWN"'::jsonb),
  'checker_settings',(select coalesce(jsonb_object_agg(name,setting),'{}'::jsonb)
    from pg_settings where name like 'plpgsql_check.%'),
  'entry_cache',to_regclass('__tcache__'),
  'entry_cache_sequence',to_regclass('__tcache___id_seq'),
  'entry_result_sequence',to_regclass('__tresults___numb_seq')
)::text;

-- Inventory ALL installed overloads. Hash definitions; never print their bodies.
select '# CE216_CATALOG ' || jsonb_build_object(
  'name',t.name,'oid',p.oid,'identity',case when p.oid is not null then p.oid::regprocedure::text end,
  'identity_arguments',pg_get_function_identity_arguments(p.oid),
  'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),
  'proconfig',p.proconfig,'language',l.lanname,'security_definer',p.prosecdef,
  'extension_membership',(select jsonb_agg(e.extname order by e.extname) from pg_depend d
    join pg_extension e on e.oid=d.refobjid where d.classid='pg_proc'::regclass
    and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'),
  'definition_hash_algorithm','MD5',
  'definition_hash',case when p.prokind in ('f','p') then md5(pg_get_functiondef(p.oid)) end,
  'status',case when p.oid is null then 'UNKNOWN' else 'CATALOG_OBSERVED' end
)::text
from unnest(array['plan','add_result','_def_is','_prokind','has_tablespace',
  'check_test','_currtest','row_eq','pg_version_num','ok','is']) t(name)
left join pg_namespace n on n.nspname='extensions'
left join pg_proc p on p.pronamespace=n.oid and p.proname=t.name
left join pg_language l on l.oid=p.prolang
order by t.name,p.oid;

create temporary table ce216_results (
  n integer generated always as identity, label text not null, good boolean not null,
  status text not null, evidence jsonb not null
) on commit drop;
create temporary table ce216_contract (
  signature text primary key, result_type regtype not null, returns_set boolean not null,
  verified boolean not null default false, oid oid
) on commit drop;
-- Supported contracts are candidates, NEVER assertions about the installed version.
-- Exact pg_proc identity + result shape + pg_depend membership must verify each.
insert into pg_temp.ce216_contract(signature,result_type,returns_set) values
('extensions.plan(integer)','text'::regtype,false),
('extensions.add_result(boolean,boolean,text,text,text)','integer'::regtype,false),
('extensions._def_is(text,text,anyelement,text)','text'::regtype,false),
('extensions._prokind(oid)','"char"'::regtype,false),
('extensions.has_tablespace(name,text,text)','text'::regtype,false),
('extensions.check_test(text,boolean,text,text,text,boolean)','text'::regtype,true),
('extensions._currtest()','integer'::regtype,false),
('extensions.row_eq(text,anyelement,text)','text'::regtype,false),
('extensions.pg_version_num()','integer'::regtype,false),
('extensions.ok(boolean,text)','text'::regtype,false),
('extensions.is(anyelement,anyelement,text)','text'::regtype,false);
update pg_temp.ce216_contract c set oid=to_regprocedure(c.signature);
update pg_temp.ce216_contract c set verified=exists(
  select 1 from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid
  join pg_extension e on e.oid=d.refobjid and d.refclassid='pg_extension'::regclass and d.deptype='e'
  where p.oid=c.oid and p.prokind='f' and p.prorettype=c.result_type
    and p.proretset=c.returns_set and e.extname='pgtap'
    and p.pronargdefaults=0 and p.provariadic=0
    and has_function_privilege(current_user,p.oid,'EXECUTE')
    -- Do not let a competing/defaulted/variadic overload hijack a typed call.
    and not exists(select 1 from pg_proc other where other.pronamespace=p.pronamespace
      and other.proname=p.proname and other.oid<>p.oid
      and other.pronargs-other.pronargdefaults<=p.pronargs
      and (other.pronargs>=p.pronargs or other.provariadic<>0))
);
insert into pg_temp.ce216_results(label,good,status,evidence)
select 'signature '||signature,verified,case when verified then 'CATALOG_VERIFIED' else 'BLOCKED_UNKNOWN_SIGNATURE_OR_MEMBERSHIP' end,
  jsonb_build_object('oid',oid,'signature',signature,'result_type',result_type::text,'returns_set',returns_set)
from pg_temp.ce216_contract order by signature;
insert into pg_temp.ce216_results(label,good,status,evidence)
select 'checker version receipt',exists(select 1 from pg_extension where extname='plpgsql_check'),
  case when exists(select 1 from pg_extension where extname='plpgsql_check') then 'CATALOG_OBSERVED' else 'BLOCKED_UNKNOWN_CHECKER_VERSION' end,
  jsonb_build_object('version',(select extversion from pg_extension where extname='plpgsql_check'));

-- Detect pre-existing state; never erase/restart somebody else's TAP session.
create temporary table ce216_entry_state on commit drop as
select to_regclass('__tcache__') is null and to_regclass('__tcache___id_seq') is null
  and to_regclass('__tresults___numb_seq') is null
  and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (c.relnamespace=pg_my_temp_schema() or n.nspname in ('pg_catalog','extensions'))
    and c.relname in ('__tcache__','__tcache___id_seq','__tresults___numb_seq')) fresh;
insert into pg_temp.ce216_results(label,good,status,evidence)
select 'fresh backend session prerequisite',fresh,
  case when fresh then 'FRESH_STATE_OBSERVED' else 'BLOCKED_EXISTING_SESSION_STATE' end,
  jsonb_build_object('fresh',fresh) from pg_temp.ce216_entry_state;

-- Synthetic composite fixture only; no application tables or types are touched.
create temporary table ce216_row_fixture(n integer,label text) on commit drop;
insert into pg_temp.ce216_row_fixture values(216,'CE216');
set local search_path=pg_catalog,pg_temp,extensions;
select '# CE216_PROBE_PATH ' || jsonb_build_object('search_path',current_setting('search_path'),
  'schemas',current_schemas(true),'note','controlled probe path; original lint path remains UNKNOWN')::text;

create function pg_temp.ce216_probe(
  label text, required text[], warm boolean, query text, expected_state text default '00000'
) returns void language plpgsql as $$
declare
  observed jsonb; code text:='00000'; msg text; complete boolean:=false;
  missing jsonb; clean boolean; verdict boolean;
begin
  select jsonb_agg(r.s order by r.s) into missing from unnest(required) r(s)
  where not exists(select 1 from pg_temp.ce216_contract c where c.signature=r.s and c.verified);
  if missing is not null or not (select fresh from pg_temp.ce216_entry_state) then
    insert into pg_temp.ce216_results values(default,label,false,'BLOCKED',
      jsonb_build_object('missing_contracts',missing,'fresh',(select fresh from pg_temp.ce216_entry_state)));
    return;
  end if;
  -- Every case is a subtransaction. Only newly created state can be touched.
  -- The sentinel rolls back its cache, sequences and all counter increments.
  begin
    if warm then
      execute 'select extensions.plan(20::integer)' into msg;
      if msg is distinct from '1..20' then
        raise exception using errcode='P0217',message='unexpected plan response';
      end if;
    end if;
    execute query into observed;
    complete:=true;
    raise exception using errcode='P0216',message='CE216 owned subtransaction rollback';
  exception
    when sqlstate 'P0216' then
      if not complete then code:='P0216'; msg:='unexpected sentinel from target'; end if;
    when others then
      get stacked diagnostics code=returned_sqlstate,msg=message_text;
  end;
  clean:=to_regclass('__tcache__') is null and to_regclass('__tcache___id_seq') is null
    and to_regclass('__tresults___numb_seq') is null;
  verdict:=clean and code=expected_state
    and (code<>'00000' or coalesce(observed->'ok'='true'::jsonb,false));
  insert into pg_temp.ce216_results values(default,label,verdict,
    case when not clean then 'FAIL_STATE_LEAK' when not verdict then 'FAIL'
      when code<>'00000' then 'EXPECTED_DIAGNOSTIC_OBSERVED_FINDING_RETAINED'
      else 'RUNTIME_PROBE_PASS_FINDING_NOT_CLEARED' end,
    jsonb_build_object('sqlstate',code,'expected_sqlstate',expected_state,
      'message',case when code<>'00000' then left(msg,300) end,
      'observation',observed,'state_rolled_back',clean));
end $$;

-- Calls emit no nested TAP: pgTAP output is captured as JSON inside each case.
do $$
declare
  plan_sig text:='extensions.plan(integer)';
  add_sig text:='extensions.add_result(boolean,boolean,text,text,text)';
  check_sig text:='extensions.check_test(text,boolean,text,text,text,boolean)';
  curr_sig text:='extensions._currtest()';
  def_sig text:='extensions._def_is(text,text,anyelement,text)';
  row_sig text:='extensions.row_eq(text,anyelement,text)';
  ok_sig text:='extensions.ok(boolean,text)';
  is_sig text:='extensions.is(anyelement,anyelement,text)';
begin
  perform pg_temp.ce216_probe('plan fresh initializes only owned temp state',array[plan_sig],true,
    $q$select jsonb_build_object('ok',exists(select 1 from pg_class where oid=to_regclass('__tcache__') and relpersistence='t' and relnamespace=pg_my_temp_schema())
         and exists(select 1 from pg_class where oid=to_regclass('__tresults___numb_seq') and relpersistence='t' and relnamespace=pg_my_temp_schema()))$q$);
  perform pg_temp.ce216_probe('add_result cold absent sequence diagnostic',array[add_sig],false,
    $q$select to_jsonb(extensions.add_result(true,false,'CE216','',''))$q$,'42P01');
  perform pg_temp.ce216_probe('check_test cold absent sequence diagnostic',array[check_sig],false,
    $q$select to_jsonb(t) from extensions.check_test('ok 1 - CE216',true,'CE216','CE216',null::text,false)t$q$,'42P01');
  perform pg_temp.ce216_probe('_currtest cold absent sequence diagnostic',array[curr_sig],false,
    $q$select to_jsonb(extensions._currtest())$q$,'42P01');
  perform pg_temp.ce216_probe('add_result initialized advances own result sequence',array[plan_sig,add_sig],true,
    $q$with r as materialized(select extensions.add_result(true,false,'CE216','','') n)
       select jsonb_build_object('ok',n=1,'n',n) from r$q$);
  perform pg_temp.ce216_probe('_currtest initialized but unprimed',array[plan_sig,curr_sig],true,
    $q$with r as materialized(select extensions._currtest() n)
       select jsonb_build_object('ok',n=0,'n',n) from r$q$);
  perform pg_temp.ce216_probe('_currtest initialized after one actual result',array[plan_sig,add_sig,curr_sig],true,
    $q$with r as materialized(select extensions.add_result(true,false,'CE216','','') n)
       select jsonb_build_object('ok',r.n=1 and extensions._currtest()=1,'n',r.n) from r$q$);
  perform pg_temp.ce216_probe('check_test observes matching primed TAP result',array[plan_sig,ok_sig,is_sig,check_sig],true,
    $q$with subject as materialized(select extensions.ok(true,'CE216 subject') tap),
       checked as materialized(select x.tap from subject s cross join lateral
         extensions.check_test(s.tap,true,'CE216','CE216 subject',null::text,false)x(tap))
       select jsonb_build_object('ok',count(*)=2 and bool_and(tap like 'ok %'),'rows',jsonb_agg(tap)) from checked$q$);
  perform pg_temp.ce216_probe('version helper matches actual server version number',
    array['extensions.pg_version_num()'],false,
    $q$select jsonb_build_object('ok',extensions.pg_version_num()=current_setting('server_version_num')::integer,
      'actual',current_setting('server_version_num'),'helper',extensions.pg_version_num())$q$);
  perform pg_temp.ce216_probe('_prokind current server branch agrees with actual catalog',
    array['extensions._prokind(oid)','extensions.pg_version_num()'],false,
    $q$select jsonb_build_object('ok',extensions._prokind(p.oid)=p.prokind,'catalog',p.prokind,
      'actual',extensions._prokind(p.oid),'server_version_num',current_setting('server_version_num'),
      'legacy_column_present',exists(select 1 from pg_attribute where attrelid='pg_catalog.pg_proc'::regclass and attname='proisagg' and not attisdropped))
      from pg_proc p where p.oid='pg_temp.ce216_probe(text,text[],boolean,text,text)'::regprocedure$q$);
  perform pg_temp.ce216_probe('has_tablespace current server branch existing catalog location',
    array[plan_sig,ok_sig,'extensions.has_tablespace(name,text,text)','extensions.pg_version_num()'],true,
    $q$with t as materialized(select extensions.has_tablespace(s.spcname::name,pg_catalog.pg_tablespace_location(s.oid),'CE216 existing tablespace') tap
      from pg_catalog.pg_tablespace s where s.spcname='pg_default')
      select jsonb_build_object('ok',count(*)=1 and bool_and(tap like 'ok %'),
        'tap',jsonb_agg(tap),'server_version_num',current_setting('server_version_num'),
        'legacy_column_present',exists(select 1 from pg_attribute where attrelid='pg_catalog.pg_tablespace'::regclass and attname='spclocation' and not attisdropped)) from t$q$);
  perform pg_temp.ce216_probe('_def_is literal integer cast path',array[plan_sig,def_sig,is_sig],true,
    $q$with r as materialized(select extensions._def_is('7'::text,'integer'::text,7::integer,'CE216 literal'::text) tap)
      select jsonb_build_object('ok',tap like 'ok %','tap',tap) from r$q$);
  perform pg_temp.ce216_probe('_def_is expression matching text types',array[plan_sig,def_sig,is_sig],true,
    $q$with r as materialized(select extensions._def_is('abs(-7)'::text,'text'::text,'abs(-7)'::text,'CE216 expression text'::text) tap)
      select jsonb_build_object('ok',tap like 'ok %','tap',tap) from r$q$);
  perform pg_temp.ce216_probe('_def_is expression incompatible integer diagnostic',array[plan_sig,def_sig,is_sig],true,
    $q$select to_jsonb(extensions._def_is('abs(-7)'::text,'integer'::text,7::integer,'CE216 expression integer'::text))$q$,'42883');
  perform pg_temp.ce216_probe('row_eq matching named composite',array[plan_sig,row_sig,ok_sig],true,
    $q$with r as materialized(select extensions.row_eq('select n,label from pg_temp.ce216_row_fixture'::text,
      row(216,'CE216')::pg_temp.ce216_row_fixture,'CE216 composite'::text) tap)
      select jsonb_build_object('ok',tap like 'ok %','tap',tap) from r$q$);
  perform pg_temp.ce216_probe('row_eq mismatching same composite returns negative TAP',array[plan_sig,row_sig,ok_sig],true,
    $q$with r as materialized(select extensions.row_eq('select n,label from pg_temp.ce216_row_fixture'::text,
      row(217,'CE216')::pg_temp.ce216_row_fixture,'CE216 composite negative'::text) tap)
      select jsonb_build_object('ok',tap like 'not ok %','tap',tap) from r$q$);
  perform pg_temp.ce216_probe('row_eq scalar misuse diagnostic retained',array[plan_sig,row_sig,ok_sig],true,
    $q$select to_jsonb(extensions.row_eq('select 216::integer'::text,216::integer,'CE216 scalar'::text))$q$,'42883');
end $$;

-- Unknown signatures are failing BLOCKED assertions, never missing/green cases.
select '1..30';
select (case when good then 'ok ' else 'not ok ' end)||n||' - '||label||' ['||status||']'
  ||E'\n# CE216_RECEIPT '||evidence::text
from pg_temp.ce216_results order by n;
select '# CE216_DISPOSITION ALL_EIGHT_FINDINGS_RETAINED; runtime observations only; no lint clearance';
rollback;
