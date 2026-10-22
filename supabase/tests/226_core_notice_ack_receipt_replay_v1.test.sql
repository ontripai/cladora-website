-- SQL-role fixture, NOT issued Auth/JWT proof. Disposable local execution only;
-- authored here, not executed by CORE-NOTICE-ACK-RECEIPT-REPLAY-01.
-- No product grants, resolver/RLS replacement or trigger disable. Everything
-- including fixture identities and temporary helpers is rolled back.
begin;
set local statement_timeout = '10s';
set local lock_timeout = '2s';
select no_plan();

select has_function('communications','acknowledge_notice_internal',array['uuid','uuid','text','text','text']);
select ok((select prosecdef from pg_proc where oid='communications.acknowledge_notice_internal(uuid,uuid,text,text,text)'::regprocedure),'internal security boundary retained');
select is((select proconfig from pg_proc where oid='communications.acknowledge_notice_internal(uuid,uuid,text,text,text)'::regprocedure),array['search_path=pg_catalog, communications, audit, identity, platform'],'internal search_path retained');
select ok(not (select prosecdef from pg_proc where oid='customer_api.acknowledge_notice_v1(uuid,uuid,text,text,text)'::regprocedure),'public wrapper remains invoker');
select is((select proowner from pg_proc where oid='communications.acknowledge_notice_internal(uuid,uuid,text,text,text)'::regprocedure),(select proowner from pg_proc where oid='customer_api.acknowledge_notice_v1(uuid,uuid,text,text,text)'::regprocedure),'existing migration owner shared with unchanged wrapper');
select ok(has_function_privilege('authenticated','customer_api.acknowledge_notice_v1(uuid,uuid,text,text,text)','EXECUTE'),'authenticated wrapper execute retained');
select ok(not has_function_privilege('anon','customer_api.acknowledge_notice_v1(uuid,uuid,text,text,text)','EXECUTE'),'anonymous wrapper execute remains denied');
select ok(not has_table_privilege('authenticated','communications.notice_acknowledgements','INSERT,UPDATE,DELETE'),'no direct authenticated receipt writes');
select ok((select relrowsecurity from pg_class where oid='communications.notice_acknowledgements'::regclass),'receipt RLS retained');
select ok(exists(select 1 from pg_constraint where conrelid='communications.notice_acknowledgements'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (notice_id, membership_id)'),'logical receipt uniqueness retained');
select matches(pg_get_functiondef('communications.acknowledge_notice_internal(uuid,uuid,text,text,text)'::regprocedure),'(?s)notice_recipients.*for update;.*resolve_communications_actor','concurrent callers serialize before authority recheck');
select matches(pg_get_functiondef('communications.acknowledge_notice_internal(uuid,uuid,text,text,text)'::regprocedure),'(?s)if found then.*23505.*else.*insert into communications.notice_acknowledgements.*insert into audit.events','replay/conflict branch cannot emit completion audit');

create function pg_temp.n226_id(n integer) returns uuid language sql immutable
as $$select ('c2260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
do $$begin
 if exists(select 1 from platform.tenants where id in(pg_temp.n226_id(10),pg_temp.n226_id(20)))
 or exists(select 1 from auth.users where id in(pg_temp.n226_id(1),pg_temp.n226_id(2),pg_temp.n226_id(3)))
 then raise exception 'notice226_fixture_collision';end if;
 if (select count(*) from identity.roles r join identity.role_permissions rp on rp.role_id=r.id
 join identity.permissions p on p.id=rp.permission_id where r.code='association_admin' and r.tenant_id is null
 and rp.effect='allow' and p.code='communications.notices.acknowledge')<>1
 then raise exception 'notice226_existing_native_permission_missing';end if;
end$$;
insert into auth.users(id,email) values
 (pg_temp.n226_id(1),'notice226-own@fixture.invalid'),(pg_temp.n226_id(2),'notice226-foreign@fixture.invalid'),(pg_temp.n226_id(3),'notice226-nonrecipient@fixture.invalid');
insert into platform.tenants(id,legal_name,registration_number,status) values
 (pg_temp.n226_id(10),'Synthetic receipt A','N226-A','active'),(pg_temp.n226_id(20),'Synthetic receipt B','N226-B','active');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at,ends_at)
select pg_temp.n226_id(29+n),pg_temp.n226_id(case when n=2 then 20 else 10 end),pg_temp.n226_id(n),r.id,'active',
 statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 hour'
from generate_series(1,3) n cross join identity.roles r where r.code='association_admin' and r.tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at,ends_at)
select pg_temp.n226_id(39+n),pg_temp.n226_id(case when n=2 then 20 else 10 end),pg_temp.n226_id(29+n),'tenant'::identity.scope_type,
 statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 hour' from generate_series(1,3) n;
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status)
values(pg_temp.n226_id(50),pg_temp.n226_id(10),'ASSOCIATION','Synthetic notice','PILOT','ACTIVE'),
 (pg_temp.n226_id(51),pg_temp.n226_id(20),'ASSOCIATION','Synthetic notice foreign','PILOT','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
select pg_temp.n226_id(n),'module.communications','boolean',true,statement_timestamp()-interval '1 day' from generate_series(50,51) n;
insert into communications.official_notices(id,tenant_id,source_module,communication_type,legal_classification,title_ro,body_ro,title_en,body_en,title_fa,body_fa,idempotency_key)
select pg_temp.n226_id(n),pg_temp.n226_id(case when n=70 then 20 else 10 end),'general','general_announcement','operational_mandatory',
 'Synthetic','Synthetic','Synthetic','Synthetic','Synthetic','Synthetic','notice226-'||n from unnest(array[60,61,62,70]) n;
-- Populate while draft, preserving the real freeze trigger; then publish the
-- test snapshot. This is fixture data, not a claim of the publication workflow.
insert into communications.notice_recipients(id,tenant_id,notice_id,membership_id)
select pg_temp.n226_id(n+100),pg_temp.n226_id(case when n=70 then 20 else 10 end),pg_temp.n226_id(n),pg_temp.n226_id(case when n=70 then 31 else 30 end)
from unnest(array[60,61,62,70]) n;
update communications.official_notices set status='published',published_at=statement_timestamp()
where id in(pg_temp.n226_id(60),pg_temp.n226_id(61),pg_temp.n226_id(62),pg_temp.n226_id(70));

-- Only test-state visibility, never an authority or product grant.
create temp table notice226_state(name text primary key,value jsonb not null);
grant select,insert on notice226_state to authenticated;
create function pg_temp.n226_fingerprint() returns jsonb language sql as $$
 select jsonb_build_object('receipts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from communications.notice_acknowledgements a where a.tenant_id in(pg_temp.n226_id(10),pg_temp.n226_id(20))),
 'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from audit.events e where e.tenant_id in(pg_temp.n226_id(10),pg_temp.n226_id(20))))$$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.n226_id(1),'aal','aal1')::text,true);
set local role authenticated;
select is(current_user,'authenticated','wrapper calls use actual authenticated DB role, fixture JWT claims only');
insert into notice226_state values('first',customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60)));
insert into notice226_state values('replay',customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60),null,null,null));
select is((select value from notice226_state where name='replay'),(select value from notice226_state where name='first'),'omitted and explicit null method replay identical receipt');
select is((select value->>'is_statutory_proof' from notice226_state where name='first'),'false','receipt is not statutory proof');
reset role;
select is((select count(*)::integer from communications.notice_acknowledgements where notice_id=pg_temp.n226_id(60)),1,'one receipt after replay');
select is((select count(*)::integer from audit.events where entity_id=(select (value->>'acknowledgement_id')::uuid from notice226_state where name='first') and action='communications.notice.acknowledged'),1,'one completion audit after replay');
select is((select (value->>'acknowledged_at')::timestamptz from notice226_state where name='first'),(select acknowledged_at from communications.notice_acknowledgements where notice_id=pg_temp.n226_id(60)),'response time equals stored time');
select is((select after_snapshot->>'acknowledged_at' from audit.events where entity_id=(select (value->>'acknowledgement_id')::uuid from notice226_state where name='first') and action='communications.notice.acknowledged'),(select value->>'acknowledged_at' from notice226_state where name='first'),'audit and response use same stored timestamp');
-- A later SQL statement must not manufacture statement_timestamp() on replay.
insert into notice226_state values('before-conflicts',pg_temp.n226_fingerprint());
set local role authenticated;
select is(customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60)),(select value from notice226_state where name='first'),'later statement returns stored receipt/time');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60),'offline_form')$$,'23505','notice_acknowledgement_conflict','changed method conflicts');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60),'in_app_click','')$$,'23505','notice_acknowledgement_conflict','empty checksum differs from null');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60),'in_app_click',null,'')$$,'23505','notice_acknowledgement_conflict','empty notes differ from null');
reset role;
select is(pg_temp.n226_fingerprint(),(select value from notice226_state where name='before-conflicts'),'method/null-empty conflicts change neither receipt nor audit bytes');
set local role authenticated;
insert into notice226_state values('explicit',customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(61),'in_app_signature','checksum','notes'));
select is(customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(61),'in_app_signature','checksum','notes'),(select value from notice226_state where name='explicit'),'explicit evidence replay stable');
reset role;
insert into notice226_state values('explicit-protected',pg_temp.n226_fingerprint());
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(61),'in_app_signature',null,'notes')$$,'23505','notice_acknowledgement_conflict','omitted checksum cannot erase existing evidence');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(61),'in_app_signature','checksum','changed')$$,'23505','notice_acknowledgement_conflict','changed notes conflict');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(62),'INVALID')$$,'23514',null,'invalid first-write method fails atomically');
reset role;
select is(pg_temp.n226_fingerprint(),(select value from notice226_state where name='explicit-protected'),'explicit evidence conflicts and invalid first write are zero-write');
select is((select count(*)::integer from communications.notice_acknowledgements where notice_id=pg_temp.n226_id(62)),0,'failed first write leaves no receipt');
select is((select count(*)::integer from audit.events where action='communications.notice.acknowledged' and tenant_id=pg_temp.n226_id(10)),2,'failed first write/replay/conflicts add no completion audit');
-- Owned, rollback-only fault injection: never disable/replace a product trigger.
-- The only affected event is this fixture's previously unacknowledged notice62.
create function pg_temp.n226_fail_completion() returns trigger language plpgsql as $$begin
 if new.tenant_id=pg_temp.n226_id(10) and new.action='communications.notice.acknowledged'
 and exists(select 1 from communications.notice_acknowledgements a where a.id=new.entity_id and a.notice_id=pg_temp.n226_id(62))
 then raise exception 'notice226_injected_audit_failure' using errcode='XX000';end if;
 return new;
end$$;
create trigger notice226_owned_audit_fault before insert on audit.events
for each row execute function pg_temp.n226_fail_completion();
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(62))$$,'XX000','notice226_injected_audit_failure','completion failure propagates without partial receipt');
reset role;
drop trigger notice226_owned_audit_fault on audit.events;
select is(pg_temp.n226_fingerprint(),(select value from notice226_state where name='explicit-protected'),'audit failure rolls back new receipt and all completion effects');
-- Capture after the two legitimate receipts, before all denied/conflicting calls.
insert into notice226_state values('protected',pg_temp.n226_fingerprint());
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60),'offline_form')$$,'23505','notice_acknowledgement_conflict','conflict remains zero-write');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(41),pg_temp.n226_id(60))$$,'42501',null,'foreign Context denied');
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(70))$$,'42501','recipient_record_not_found_for_caller','cross-tenant notice denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.n226_id(3),'aal','aal1')::text,true);
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(42),pg_temp.n226_id(60))$$,'42501','recipient_record_not_found_for_caller','same-tenant nonrecipient denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.n226_id(1),'aal','aal1')::text,true);
update identity.memberships set status='revoked' where id=pg_temp.n226_id(30);
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60))$$,'42501',null,'revoked membership cannot replay');
reset role;
update identity.memberships set status='active',ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.n226_id(30);
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60))$$,'42501',null,'expired membership cannot replay');
reset role;
update identity.memberships set ends_at=statement_timestamp()+interval '1 hour' where id=pg_temp.n226_id(30);
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.n226_id(40);
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60))$$,'42501',null,'expired Context cannot replay');
reset role;
update identity.context_grants set ends_at=statement_timestamp()+interval '1 hour' where id=pg_temp.n226_id(40);
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=pg_temp.n226_id(50) and entitlement_key='module.communications';
set local role authenticated;
select throws_ok($$select customer_api.acknowledge_notice_v1(pg_temp.n226_id(40),pg_temp.n226_id(60))$$,'42501',null,'revoked entitlement cannot replay');
reset role;
select is(pg_temp.n226_fingerprint(),(select value from notice226_state where name='protected'),'all denied/conflicting calls leave receipt/audit bytes unchanged');

-- CONCURRENCY ACCEPTANCE NOT EXECUTED / NOT A pgTAP RACE PASS:
-- Source assertions above prepare lock/uniqueness coverage only. An authorized
-- disposable multi-session run must commit an owned native fixture, hold the
-- recipient lock in A, start B's same wrapper/role/claims call, observe B waiting
-- with bounded deadlines, then commit A. B must return A's exact JSON and the
-- coordinator must assert one receipt + one completion. Repeat with conflicting
-- evidence, and with revoke/expiry committed while B waits: B must deny after
-- wakeup with no write. This file's rollback-only fixture cannot be seen by B;
-- do not fake concurrency via two sequential calls or a privileged resolver stub.
select * from finish();
rollback;
