-- Candidate DB proof: run only in Coordinator's disposable integrated test DB.
-- All fixtures are owned by this test and rolled back. No shared seed dependency.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.ce212_id(n integer) returns uuid language sql immutable as $$
  select ('21200000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
select has_column('portfolio','units','code','canonical Unit.code exists in actual catalog');
select hasnt_column('portfolio','units','unit_code','no duplicate Unit label column introduced');
insert into auth.users(id,email) values
(pg_temp.ce212_id(1),'ce212-a@cladora.test'),(pg_temp.ce212_id(2),'ce212-b@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
(pg_temp.ce212_id(10),'CE212 tenant A','CE212-A','active'),
(pg_temp.ce212_id(20),'CE212 tenant B','CE212-B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
(pg_temp.ce212_id(11),pg_temp.ce212_id(10),'condominium','CE212 property A','active'),
(pg_temp.ce212_id(21),pg_temp.ce212_id(20),'condominium','CE212 property B','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
(pg_temp.ce212_id(12),pg_temp.ce212_id(10),pg_temp.ce212_id(11),'B212','CE212 building A'),
(pg_temp.ce212_id(22),pg_temp.ce212_id(20),pg_temp.ce212_id(21),'B212','CE212 building B');
insert into portfolio.units(id,tenant_id,building_id,code) values
(pg_temp.ce212_id(13),pg_temp.ce212_id(10),pg_temp.ce212_id(12),'CE-Unit/212-A'),
(pg_temp.ce212_id(14),pg_temp.ce212_id(10),pg_temp.ce212_id(12),'CE-Unit/212-outside'),
(pg_temp.ce212_id(23),pg_temp.ce212_id(20),pg_temp.ce212_id(22),'CE-Unit/212-A');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select pg_temp.ce212_id(v.m),pg_temp.ce212_id(v.t),pg_temp.ce212_id(v.u),r.id,'active',statement_timestamp()-interval '2 days'
from (values(30,10,1),(31,10,2),(32,20,1)) v(m,t,u)
join identity.roles r on r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,unit_id,starts_at)
values(pg_temp.ce212_id(40),pg_temp.ce212_id(10),pg_temp.ce212_id(30),'unit',pg_temp.ce212_id(13),statement_timestamp()-interval '1 day'),
(pg_temp.ce212_id(41),pg_temp.ce212_id(10),pg_temp.ce212_id(31),'unit',pg_temp.ce212_id(13),statement_timestamp()-interval '1 day'),
(pg_temp.ce212_id(42),pg_temp.ce212_id(20),pg_temp.ce212_id(32),'unit',pg_temp.ce212_id(23),statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
(pg_temp.ce212_id(50),pg_temp.ce212_id(10),'ASSOCIATION','CE212 A','PILOT','ACTIVE'),
(pg_temp.ce212_id(51),pg_temp.ce212_id(20),'ASSOCIATION','CE212 B','PILOT','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
(pg_temp.ce212_id(50),'module.communications','boolean',true,statement_timestamp()-interval '1 day'),
(pg_temp.ce212_id(51),'module.communications','boolean',true,statement_timestamp()-interval '1 day');
insert into communications.channels(id,tenant_id,unit_id,scope,name,is_private) values
(pg_temp.ce212_id(60),pg_temp.ce212_id(10),pg_temp.ce212_id(13),'unit','CE212 public',false),
(pg_temp.ce212_id(61),pg_temp.ce212_id(10),pg_temp.ce212_id(13),'unit','CE212 private',true),
(pg_temp.ce212_id(62),pg_temp.ce212_id(10),pg_temp.ce212_id(14),'unit','CE212 outside unit',false),
(pg_temp.ce212_id(63),pg_temp.ce212_id(20),pg_temp.ce212_id(23),'unit','CE212 other tenant',false);
insert into communications.channels(id,tenant_id,scope,name,is_private) values
(pg_temp.ce212_id(64),pg_temp.ce212_id(10),'tenant','CE212 general',false),
(pg_temp.ce212_id(65),pg_temp.ce212_id(10),'direct','CE212 direct hidden',false);
insert into communications.channel_members(tenant_id,channel_id,membership_id) values
(pg_temp.ce212_id(10),pg_temp.ce212_id(61),pg_temp.ce212_id(31));

-- Snapshot every tenant-owned row across application schemas, including audit.
-- Executed as the fixture owner before/after the authenticated GET-equivalent calls.
create function pg_temp.ce212_snapshot() returns jsonb language plpgsql as $$
declare r record; v jsonb; result jsonb := '{}'::jsonb;
begin
  for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('platform','identity','portfolio','occupancy','finance','billing','payments','utilities','assets','maintenance','governance','communications','documents','security_access','migration_hub','audit')
      and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped)
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %I.%I t where tenant_id in ($1,$2)',r.nspname,r.relname)
      into v using pg_temp.ce212_id(10),pg_temp.ce212_id(20);
    result := result || jsonb_build_object(r.nspname||'.'||r.relname,v);
  end loop;
  return result;
end $$;
create temp table ce212_before as select pg_temp.ce212_snapshot() snapshot;
-- Invoker helper delegates to the actual gateway/internal function, never a mock.
create function pg_temp.ce212_read(context_no integer default 40) returns jsonb language sql stable as $$
  select customer_api.get_communications_v1(pg_temp.ce212_id(context_no),'channels')
$$;
-- Only session-local helpers are exposed to the role under test.
do $$ begin
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end $$;
grant execute on function pg_temp.ce212_id(integer),pg_temp.ce212_read(integer) to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.ce212_id(1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select lives_ok($$select pg_temp.ce212_read()$$,'real channels query executes (BASE raises undefined_column)');
select is(pg_temp.ce212_read()->>'total','2','only public unit and unscoped channel visible');
select is((select r->>'unit_code' from jsonb_array_elements(pg_temp.ce212_read()->'rows') r where r->>'id'=pg_temp.ce212_id(60)::text),'CE-Unit/212-A','label is exact canonical code, never UUID or fabricated fallback');
select is((select r->'unit_code' from jsonb_array_elements(pg_temp.ce212_read()->'rows') r where r->>'id'=pg_temp.ce212_id(64)::text),'null'::jsonb,'no-unit channel retains JSON null');
select is((select array_agg(k order by k) from jsonb_array_elements(pg_temp.ce212_read()->'rows') r cross join lateral jsonb_object_keys(r) k where r->>'id'=pg_temp.ce212_id(60)::text),array['building_name','created_at','id','is_private','member','name','property_name','scope','status','unit_code']::text[],'existing channel row shape preserved');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.ce212_read()->'rows') r where r->>'id' in (pg_temp.ce212_id(61)::text,pg_temp.ce212_id(62)::text,pg_temp.ce212_id(63)::text,pg_temp.ce212_id(65)::text)),'private, direct, outside unit and same-code foreign tenant do not leak');
select is(pg_temp.ce212_read()->'read_only','true'::jsonb,'read_only contract retained');
select is(pg_temp.ce212_read()->'context'->>'id',pg_temp.ce212_id(40)::text,'response bound to requested valid context');
select is((select r->>'unit_code' from jsonb_array_elements(pg_temp.ce212_read(42)->'rows') r where r->>'id'=pg_temp.ce212_id(63)::text),'CE-Unit/212-A','separately authorized tenant returns its own same-code Unit');
select is(pg_temp.ce212_read(42)->>'total','1','foreign tenant context excludes original tenant rows');
select throws_ok($$select pg_temp.ce212_read(41)$$,'42501','customer_context_access_denied','another actor context rejected');
reset role;
select is(pg_temp.ce212_snapshot(),(select snapshot from ce212_before),'successful/denied reads change zero tenant-owned rows including audit');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.ce212_id(2),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(pg_temp.ce212_read(41)->>'total','3','private channel visible only for actual member actor');
select is((select r->'member' from jsonb_array_elements(pg_temp.ce212_read(41)->'rows') r where r->>'id'=pg_temp.ce212_id(61)::text),'true'::jsonb,'actual private membership retained');
reset role;
delete from communications.channel_members where channel_id=pg_temp.ce212_id(61) and membership_id=pg_temp.ce212_id(31);
set local role authenticated;
select is(pg_temp.ce212_read(41)->>'total','2','private membership revocation is effective immediately');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.ce212_id(1),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','mfa_required','AAL gate is not weakened');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','authentication_required','missing actor rejected');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.ce212_id(1),'role','authenticated','aal','aal2')::text,true);
update identity.context_grants set ends_at=statement_timestamp()-interval '1 hour' where id=pg_temp.ce212_id(40);
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','customer_context_access_denied','expired context rejected');
reset role;
update identity.context_grants set ends_at=null where id=pg_temp.ce212_id(40);
update identity.memberships set status='revoked' where id=pg_temp.ce212_id(30);
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','customer_context_access_denied','revoked membership/context rejected');
reset role;
update identity.memberships set status='active' where id=pg_temp.ce212_id(30);
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=pg_temp.ce212_id(50) and entitlement_key='module.communications';
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','communications_entitlement_required','disabled communications entitlement rejected');
reset role;
delete from identity.context_grants where id=pg_temp.ce212_id(40);
set local role authenticated;
select throws_ok($$select pg_temp.ce212_read()$$,'42501','customer_context_access_denied','deleted/revoked context cannot be reused');
reset role;
select ok(not has_function_privilege('anon','communications.get_customer_communications(uuid,text,text,text,date,date,integer,integer,uuid)','EXECUTE'),'anon ACL retained');
select ok(has_function_privilege('authenticated','communications.get_customer_communications(uuid,text,text,text,date,date,integer,integer,uuid)','EXECUTE'),'authenticated gated RPC ACL retained');
select * from finish();
rollback;
