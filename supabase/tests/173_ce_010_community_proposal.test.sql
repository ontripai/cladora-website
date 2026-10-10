\ir fixtures/ce_010_community_operational_v1.inc
begin;
select plan(74);

select is((select count(*) from identity.permissions where code like 'community.%'),0::bigint,'Proposal does not seed Core permissions');
select is((select count(*) from platform.module_definitions where code='community_basic'),0::bigint,'Proposal does not seed a Core module');
select ok((select relrowsecurity from pg_class where oid='community.communities'::regclass),'Community RLS enabled');
select ok((select relrowsecurity from pg_class where oid='community.announcements'::regclass),'Announcement RLS enabled');
select ok((select relrowsecurity from pg_class where oid='community.content_reports'::regclass),'Report RLS enabled');
select ok((select relrowsecurity from pg_class where oid='community.community_command_receipts'::regclass),'Receipt RLS enabled');
select ok(not has_table_privilege('authenticated','community.communities','SELECT,INSERT,UPDATE,DELETE'),'No authenticated direct Community access');
select ok(not has_table_privilege('service_role','community.content_reports','SELECT,INSERT,UPDATE,DELETE'),'No direct service-role report access');
select ok(not has_function_privilege('anon','customer_api.command_ce_community_v1(jsonb)','EXECUTE'),'Anonymous command execution denied');
select ok(not has_function_privilege('anon','customer_api.read_ce_community_v1(uuid,uuid)','EXECUTE'),'Anonymous read execution denied');
select ok(not has_function_privilege('authenticated','app_private.ce_community_authorize_v1(uuid,uuid,text)','EXECUTE'),'Private Core adapter not directly callable');
select ok(has_function_privilege('authenticated','customer_api.command_ce_community_v1(jsonb)','EXECUTE'),'Bounded authenticated command RPC available');
select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.read_ce_community_v1('17300000-0000-0000-0000-000000000040','17300000-0000-0000-0000-000000000020')$$,'55000','ce_community_contract_not_ready','Missing mapping fails closed, not a weaker fallback');

\ir fixtures/ce_010_core_fixture.inc
create function pg_temp.ce010_command(t text,n integer,v bigint,extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
 select jsonb_build_object('type',t,'command_id',pg_temp.ce010_id(n),'idempotency_key','ce010.test.'||n,
 'context_id',pg_temp.ce010_id(40),'workspace_id',pg_temp.ce010_id(20),'community_id',pg_temp.ce010_id(70),
 'expected_version',v,'reason','Synthetic CE010 acceptance')||extra
$$;
create function pg_temp.ce010_counts() returns jsonb language sql as $$
 select jsonb_build_array(
  (select count(*) from community.communities),(select count(*) from community.announcements),(select count(*) from community.content_reports),
  (select count(*) from community.community_command_receipts),(select count(*) from platform.idempotency_keys where tenant_id=pg_temp.ce010_id(1)),
  (select count(*) from audit.events where tenant_id=pg_temp.ce010_id(1)),(select count(*) from platform.outbox_events where tenant_id=pg_temp.ce010_id(1)))
$$;
create temporary table ce010_before as select pg_temp.ce010_counts() counts;
create temporary table ce010_requests as select
 pg_temp.ce010_command('create_community',80,0,'{"name":"Synthetic community","audience":{"kind":"workspace"}}') create_community,
 pg_temp.ce010_command('create_announcement',81,1,jsonb_build_object('announcement_id',pg_temp.ce010_id(71),'body','Synthetic in-app announcement','audience',jsonb_build_object('kind','workspace'))) create_announcement,
 pg_temp.ce010_command('publish_announcement',82,1,jsonb_build_object('announcement_id',pg_temp.ce010_id(71))) publish_announcement,
 pg_temp.ce010_command('report_content',83,0,jsonb_build_object('context_id',pg_temp.ce010_id(41),'report_id',pg_temp.ce010_id(72),'target_id',pg_temp.ce010_id(71),'target_type','announcement','report_reason','Synthetic content review')) report_content,
 pg_temp.ce010_command('decide_content_report',84,1,jsonb_build_object('report_id',pg_temp.ce010_id(72),'decision','dismissed','decision_reason','Synthetic moderator decision')) decide_report;

select is((select membership_id from app_private.resolve_workspace_native_context_v2(pg_temp.ce010_id(40),pg_temp.ce010_id(20))),pg_temp.ce010_id(30),'Actual C01 resolves actor and membership');
select ok(app_private.check_workspace_native_permission_v2(pg_temp.ce010_id(40),pg_temp.ce010_id(20),'community.community.manage','community_basic'),'Actual Core evaluator accepts explicit synthetic mapping');
select is((select count(*) from platform.module_dependencies d join platform.module_definitions m on m.id=d.module_definition_id where m.code='community_basic'),0::bigint,'Independent activation does not require Events, Guide, Booking or SERVICE');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community-'expected_version' from ce010_requests))$$,'22023','invalid_request','Missing expected_version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"expected_version":null}' from ce010_requests))$$,'22023','invalid_request','Null expected_version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"expected_version":1.5}' from ce010_requests))$$,'22023','invalid_request','Fractional expected_version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"expected_version":-1}' from ce010_requests))$$,'22023','invalid_request','Negative expected_version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"expected_version":"0"}' from ce010_requests))$$,'22023','invalid_request','String expected_version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"expected_version":9007199254740992}' from ce010_requests))$$,'22023','invalid_request','Unsafe integer version rejected');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"tenant_id":"17300000-0000-0000-0000-000000000002"}' from ce010_requests))$$,'22023','invalid_request','Client authority injection rejected');
select is(pg_temp.ce010_counts(),(select counts from ce010_before),'Rejected commands write no domain, receipt, shared key, audit or outbox rows');

select is((customer_api.command_ce_community_v1((select create_community from ce010_requests))->>'version')::bigint,1::bigint,'Community created at version one');
select is((customer_api.command_ce_community_v1((select create_community from ce010_requests))->>'replayed')::boolean,true,'Exact Community replay returns the stored receipt');
select is((select count(*) from community.community_command_receipts),1::bigint,'Replay does not duplicate the receipt');
select is((select count(*) from audit.events where tenant_id=pg_temp.ce010_id(1)),1::bigint,'Replay does not duplicate the audit');
select is((select count(*) from platform.outbox_events where tenant_id=pg_temp.ce010_id(1)),1::bigint,'Replay does not duplicate the shared outbox');
select throws_ok($$select customer_api.command_ce_community_v1((select create_community||'{"name":"Different input"}' from ce010_requests))$$,'23505','ce_community_idempotency_conflict','Same key with changed input rejected');
select lives_ok($$select customer_api.command_ce_community_v1((select create_announcement from ce010_requests))$$,'Announcement draft persisted');

select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'),0,'Ordinary member cannot read a draft');
select is(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->>'workspace_id',pg_temp.ce010_id(20)::text,'Projection binds the exact Workspace');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'communities'->0->>'can_create_announcement')::boolean,false,'Server withholds announcement creation action from member');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'communities'->0->>'can_decide_reports')::boolean,false,'Server withholds moderation action from member');
select ok(not(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))?'tenant_id'),'Projection exposes no tenant authority field');
select throws_ok($$select customer_api.command_ce_community_v1((select publish_announcement||jsonb_build_object('context_id',pg_temp.ce010_id(41)) from ce010_requests))$$,'42501','ce_community_access_denied','Member cannot publish content');
select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
update ce010_before set counts=pg_temp.ce010_counts();
select throws_ok($$select customer_api.command_ce_community_v1((select publish_announcement||'{"expected_version":2}' from ce010_requests))$$,'40001','ce_community_version_conflict','Stale announcement version rejected');
select is(pg_temp.ce010_counts(),(select counts from ce010_before),'Version rejection rolls back shared idempotency insert too');
select is((customer_api.command_ce_community_v1((select publish_announcement from ce010_requests))->>'version')::bigint,2::bigint,'Publish advances exact announcement version');
select throws_ok($$select customer_api.command_ce_community_v1(pg_temp.ce010_command('create_announcement',85,1,jsonb_build_object('workspace_id',pg_temp.ce010_id(21),'announcement_id',pg_temp.ce010_id(73),'body','Wrong workspace','audience',jsonb_build_object('kind','workspace'))))$$,'P0002','ce_community_not_found','Same-tenant alternate Workspace cannot mutate this Community');
select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000013","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(43),pg_temp.ce010_id(22))->'communities'),0,'Other tenant receives no Community data');
select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000012","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.command_ce_community_v1((select publish_announcement||jsonb_build_object('context_id',pg_temp.ce010_id(42)) from ce010_requests))$$,'23505','ce_community_idempotency_conflict','Different authorized actor cannot replay another actor receipt');

select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'),1,'Eligible member sees published content');
select is(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'->0->>'title','Synthetic in-app announcement','Projection provides a bounded named announcement choice');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'->0->>'can_report')::boolean,true,'Server exposes report action only while no own open report exists');
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'reports'),0,'Member cannot read moderation reports');
select lives_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'Eligible member reports visible CE content');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'->0->>'can_report')::boolean,false,'Open own report removes duplicate report action');
select is((customer_api.command_ce_community_v1((select report_content from ce010_requests))->>'replayed')::boolean,true,'Report replay is exactly once');
update ce010_before set counts=pg_temp.ce010_counts();
select throws_like($$select customer_api.command_ce_community_v1((select report_content||jsonb_build_object('command_id',pg_temp.ce010_id(86),'report_id',pg_temp.ce010_id(74),'idempotency_key','ce010.duplicate.86') from ce010_requests))$$,'%ce_content_report_active_uq%','Duplicate active report rejected by partial unique constraint');
select is(pg_temp.ce010_counts(),(select counts from ce010_before),'Duplicate report has no side effects');
select throws_ok($$select customer_api.command_ce_community_v1((select decide_report||jsonb_build_object('context_id',pg_temp.ce010_id(41)) from ce010_requests))$$,'42501','ce_community_access_denied','Reporter cannot decide a report');

update community.announcements set audience='{"kind":"roles","role_codes":["association_admin"]}' where id=pg_temp.ce010_id(71);
select throws_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'42501','ce_community_audience_denied','Replay rechecks target announcement audience');
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'),0,'Excluded member cannot read announcement content');
update community.announcements set audience='{"kind":"workspace"}' where id=pg_temp.ce010_id(71);
update community.communities set audience='{"kind":"roles","role_codes":["association_admin"]}' where id=pg_temp.ce010_id(70);
select throws_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'42501','ce_community_audience_denied','Replay rechecks Community audience');
update community.communities set audience='{"kind":"workspace"}' where id=pg_temp.ce010_id(70);
update identity.role_permissions set effect='deny' where role_id=(select id from identity.roles where code='owner' and tenant_id is null) and permission_id=(select id from identity.permissions where code='community.report.create');
select throws_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'42501','ce_community_access_denied','Replay rechecks current permission after revoke');
update identity.role_permissions set effect='allow' where role_id=(select id from identity.roles where code='owner' and tenant_id is null) and permission_id=(select id from identity.permissions where code='community.report.create');
update identity.memberships set status='suspended' where id=pg_temp.ce010_id(31);
select throws_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'42501','ce_community_access_denied','Replay rechecks live membership');
update identity.memberships set status='active' where id=pg_temp.ce010_id(31);
select is(pg_temp.ce010_counts(),(select counts from ce010_before),'All denied replay paths preserve domain and infrastructure counts');

select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.command_ce_community_v1((select decide_report||'{"expected_version":2}' from ce010_requests))$$,'40001','ce_community_version_conflict','Moderator must supply exact report version');
select throws_like($$select customer_api.command_ce_community_v1((select decide_report||'{"decision_reason":"bad"}' from ce010_requests))$$,'%violates check constraint%','Decision requires a meaningful reason');
select is(pg_temp.ce010_counts(),(select counts from ce010_before),'Rejected decisions roll back atomically');
select is((customer_api.command_ce_community_v1((select decide_report from ce010_requests))->>'version')::bigint,2::bigint,'Moderator decision advances report version');
select is((select decision_reason from community.content_reports where id=pg_temp.ce010_id(72)),'Synthetic moderator decision','Decision reason is persisted');
select is((select after_snapshot->>'decision_reason' from audit.events where tenant_id=pg_temp.ce010_id(1) and action='ce.decide_content_report'),'Synthetic moderator decision','Versioned decision reason is recorded in the shared audit');
select is((customer_api.command_ce_community_v1((select decide_report from ce010_requests))->>'replayed')::boolean,true,'Decision replay returns original receipt');
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(40),pg_temp.ce010_id(20))->'reports'),1,'Authorized moderator can read reports');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(40),pg_temp.ce010_id(20))->'communities'->0->>'can_create_announcement')::boolean,true,'Server exposes announcement creation to authorized manager');
select is((customer_api.read_ce_community_v1(pg_temp.ce010_id(40),pg_temp.ce010_id(20))->'communities'->0->>'can_decide_reports')::boolean,true,'Server exposes report decisions to authorized moderator');
select is(customer_api.read_ce_community_v1(pg_temp.ce010_id(40),pg_temp.ce010_id(20))->'reports'->0->>'target_title','Synthetic in-app announcement','Moderator receives a named report target without choosing a UUID');
select throws_ok($$update community.community_command_receipts set response_json='{}'$$,'42501','ce_community_receipt_immutable','Receipt cannot be overwritten');
select is((customer_api.command_ce_community_v1(pg_temp.ce010_command('cancel_announcement',87,2,jsonb_build_object('announcement_id',pg_temp.ce010_id(71))))->>'version')::bigint,3::bigint,'Cancel preserves content and advances version');
select set_config('request.jwt.claims','{"sub":"17300000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.command_ce_community_v1((select report_content from ce010_requests))$$,'42501','ce_community_audience_denied','Cancelled target cannot authorize replay');
select is(jsonb_array_length(customer_api.read_ce_community_v1(pg_temp.ce010_id(41),pg_temp.ce010_id(20))->'announcements'),0,'Cancelled announcement hidden from member');

select * from finish();
rollback;
