\ir fixtures/ce_012_experience_guide_operational_v1.inc
begin;
select plan(60);

select is((select count(*) from identity.permissions where code like 'experience.guide.%'),0::bigint,'Proposal does not seed Core permissions');
select is((select count(*) from platform.module_definitions where code='experience_guides'),0::bigint,'Proposal does not seed a Core module');
select ok((select relrowsecurity from pg_class where oid='experience.guides'::regclass),'Guide RLS enabled');
select ok((select relrowsecurity from pg_class where oid='experience.guide_steps'::regclass),'Step RLS enabled');
select ok((select relrowsecurity from pg_class where oid='experience.guide_references'::regclass),'Reference RLS enabled');
select ok((select relrowsecurity from pg_class where oid='experience.guide_command_receipts'::regclass),'Receipt RLS enabled');
select ok(not has_table_privilege('authenticated','experience.guides','SELECT,INSERT,UPDATE,DELETE'),'No authenticated direct Guide access');
select ok(not has_table_privilege('service_role','experience.guide_references','SELECT,INSERT,UPDATE,DELETE'),'No direct service-role reference access');
select ok(not has_function_privilege('anon','customer_api.command_ce_guide_v1(jsonb)','EXECUTE'),'Anonymous command execution denied');
select ok(not has_function_privilege('anon','customer_api.read_ce_guides_v1(uuid,uuid)','EXECUTE'),'Anonymous read execution denied');
select ok(not has_function_privilege('anon','customer_api.resolve_ce_guide_reference_v1(uuid,uuid,uuid)','EXECUTE'),'Anonymous reference resolution denied');
select ok(not has_function_privilege('authenticated','app_private.ce_guide_authorize_v1(uuid,uuid,text)','EXECUTE'),'Private Core adapter not directly callable');
select ok(has_function_privilege('authenticated','customer_api.command_ce_guide_v1(jsonb)','EXECUTE'),'Bounded authenticated command RPC available');
select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.read_ce_guides_v1('17400000-0000-0000-0000-000000000040','17400000-0000-0000-0000-000000000020')$$,'55000','ce_guide_contract_not_ready','Missing mapping fails closed, not a weaker fallback');

\ir fixtures/ce_012_core_fixture.inc
create function pg_temp.ce012_command(t text,n integer,v bigint,extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
 select jsonb_build_object('type',t,'command_id',pg_temp.ce012_id(n),'idempotency_key','ce012.test.'||n,
 'context_id',pg_temp.ce012_id(40),'workspace_id',pg_temp.ce012_id(20),'guide_id',pg_temp.ce012_id(70),
 'expected_version',v,'reason','Synthetic CE012 acceptance')||extra
$$;
create function pg_temp.ce012_steps(step_id integer,document_id integer default 90) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('id',pg_temp.ce012_id(step_id),'title','Arrival','body','Follow approved guidance.',
  'references',jsonb_build_array(jsonb_build_object('target_type','document','target_id',pg_temp.ce012_id(document_id),'label','Approved document'))))
$$;
create function pg_temp.ce012_counts() returns jsonb language sql as $$
 select jsonb_build_array((select count(*) from experience.guides),(select count(*) from experience.guide_steps),
  (select count(*) from experience.guide_references),(select count(*) from experience.guide_command_receipts),
  (select count(*) from platform.idempotency_keys where tenant_id=pg_temp.ce012_id(1)),
  (select count(*) from audit.events where tenant_id=pg_temp.ce012_id(1)),
  (select count(*) from platform.outbox_events where tenant_id=pg_temp.ce012_id(1)))
$$;
create temporary table ce012_before as select pg_temp.ce012_counts() counts;
create temporary table ce012_requests as select
 pg_temp.ce012_command('create_guide',80,0,jsonb_build_object('title','Synthetic arrival guide','audience',jsonb_build_object('kind','roles','role_codes',jsonb_build_array('owner')),'steps',pg_temp.ce012_steps(71))) create_guide,
 pg_temp.ce012_command('revise_guide',81,1,jsonb_build_object('title','Revised arrival guide','audience',jsonb_build_object('kind','roles','role_codes',jsonb_build_array('owner')),'steps',pg_temp.ce012_steps(72))) revise_guide,
 pg_temp.ce012_command('publish_guide',82,2) publish_guide;

select is((select membership_id from app_private.resolve_workspace_native_context_v2(pg_temp.ce012_id(40),pg_temp.ce012_id(20))),pg_temp.ce012_id(30),'Actual C01 resolves actor and membership');
select ok(app_private.check_workspace_native_permission_v2(pg_temp.ce012_id(40),pg_temp.ce012_id(20),'experience.guide.manage','experience_guides'),'Actual Core evaluator accepts explicit synthetic mapping');
select is((select count(*) from platform.module_dependencies d join platform.module_definitions m on m.id=d.module_definition_id where m.code='experience_guides'),0::bigint,'Independent activation does not require Community, Events, Booking or SERVICE');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide-'expected_version' from ce012_requests))$$,'22023','invalid_request','Missing expected_version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"expected_version":null}' from ce012_requests))$$,'22023','invalid_request','Null expected_version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"expected_version":1.5}' from ce012_requests))$$,'22023','invalid_request','Fractional expected_version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"expected_version":-1}' from ce012_requests))$$,'22023','invalid_request','Negative expected_version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"expected_version":"0"}' from ce012_requests))$$,'22023','invalid_request','String expected_version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"expected_version":9007199254740992}' from ce012_requests))$$,'22023','invalid_request','Unsafe integer version rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"tenant_id":"17400000-0000-0000-0000-000000000002"}' from ce012_requests))$$,'22023','invalid_request','Client authority injection rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||jsonb_build_object('steps',jsonb_build_array(jsonb_build_object('id',pg_temp.ce012_id(71),'title','Bad','body','Bad reference','references',jsonb_build_array(jsonb_build_object('target_type','service','target_id',pg_temp.ce012_id(90),'label','Service'))))) from ce012_requests))$$,'22023','invalid_request','Unaccepted target-owner contract rejected');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||jsonb_build_object('steps',pg_temp.ce012_steps(71,91)) from ce012_requests))$$,'42501','ce_guide_reference_denied','Missing and unauthorized documents share a closed error');
select is(pg_temp.ce012_counts(),(select counts from ce012_before),'Rejected commands write no domain, receipt, shared key, audit or outbox rows');

select is((customer_api.command_ce_guide_v1((select create_guide from ce012_requests))->>'version')::bigint,1::bigint,'Guide created at version one');
select is((customer_api.command_ce_guide_v1((select create_guide from ce012_requests))->>'replayed')::boolean,true,'Exact Guide replay returns the stored receipt');
select is((select count(*) from experience.guide_command_receipts),1::bigint,'Replay does not duplicate receipt');
select is((select count(*) from audit.events where tenant_id=pg_temp.ce012_id(1)),1::bigint,'Replay does not duplicate audit');
select is((select count(*) from platform.outbox_events where tenant_id=pg_temp.ce012_id(1)),1::bigint,'Replay does not duplicate outbox');
select is((select count(*) from experience.guide_steps),1::bigint,'Create persists one ordered step');
select is((select count(*) from experience.guide_references),1::bigint,'Create persists one opaque reference');
select throws_ok($$select customer_api.command_ce_guide_v1((select create_guide||'{"title":"Changed input"}' from ce012_requests))$$,'23505','ce_guide_idempotency_conflict','Changed input cannot reuse the shared key');

select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_guides_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20))->'guides'),0,'Member cannot read a draft');
select throws_ok($$select customer_api.command_ce_guide_v1((select publish_guide||jsonb_build_object('context_id',pg_temp.ce012_id(41)) from ce012_requests))$$,'42501','ce_guide_access_denied','Read-only member cannot publish');
select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
update ce012_before set counts=pg_temp.ce012_counts();
select throws_ok($$select customer_api.command_ce_guide_v1((select revise_guide||'{"expected_version":2}' from ce012_requests))$$,'40001','ce_guide_version_conflict','Revision requires exact Guide version');
select is(pg_temp.ce012_counts(),(select counts from ce012_before),'Version rejection rolls back shared idempotency insert');
select is((customer_api.command_ce_guide_v1((select revise_guide from ce012_requests))->>'version')::bigint,2::bigint,'Revision advances Guide version');
select is((select title from experience.guides where id=pg_temp.ce012_id(70)),'Revised arrival guide','Revision persists title');
select is((select id from experience.guide_steps),pg_temp.ce012_id(72),'Revision atomically replaces old steps');
select throws_ok($$select customer_api.command_ce_guide_v1(pg_temp.ce012_command('publish_guide',83,2,jsonb_build_object('workspace_id',pg_temp.ce012_id(21))))$$,'P0002','ce_guide_not_found','Same-tenant alternate Workspace cannot mutate Guide');
select throws_ok($$select customer_api.command_ce_guide_v1((select publish_guide||'{"expected_version":1}' from ce012_requests))$$,'40001','ce_guide_version_conflict','Publish requires exact Guide version');
update documents.documents set status='archived' where id=pg_temp.ce012_id(90);
select throws_ok($$select customer_api.command_ce_guide_v1((select publish_guide from ce012_requests))$$,'42501','ce_guide_reference_denied','Publish rechecks current document availability');
update documents.documents set status='active' where id=pg_temp.ce012_id(90);
select is((customer_api.command_ce_guide_v1((select publish_guide from ce012_requests))->>'version')::bigint,3::bigint,'Publish advances exact Guide version');

select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000013","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_guides_v1(pg_temp.ce012_id(43),pg_temp.ce012_id(22))->'guides'),0,'Other tenant receives no Guide data');
select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000012","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.command_ce_guide_v1((select publish_guide||jsonb_build_object('context_id',pg_temp.ce012_id(42)) from ce012_requests))$$,'23505','ce_guide_idempotency_conflict','Different authorized actor cannot replay another actor receipt');

select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_guides_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20))->'guides'),1,'Eligible member sees published Guide');
select ok(not ((customer_api.read_ce_guides_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20))->'guides'->0->'steps'->0->'references'->0) ? 'target_id'),'Guide list does not expose document identifier');
select throws_ok($$select customer_api.resolve_ce_guide_reference_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20),(select id from experience.guide_references limit 1))$$,'42501','ce_guide_reference_denied','Document authority remains independent from Guide audience');
update experience.guides set audience='{"kind":"roles","role_codes":["association_admin"]}' where id=pg_temp.ce012_id(70);
select is(jsonb_array_length(customer_api.read_ce_guides_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20))->'guides'),0,'Changed audience immediately hides Guide');
update experience.guides set audience='{"kind":"roles","role_codes":["owner"]}' where id=pg_temp.ce012_id(70);

select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select is((customer_api.resolve_ce_guide_reference_v1(pg_temp.ce012_id(40),pg_temp.ce012_id(20),(select id from experience.guide_references limit 1))->>'target_id')::uuid,pg_temp.ce012_id(90),'Authorized resolver returns exact document identifier');
update identity.role_permissions set effect='deny' where role_id=(select id from identity.roles where code='association_admin' and tenant_id is null) and permission_id=(select id from identity.permissions where code='documents.vault.read');
select throws_ok($$select customer_api.resolve_ce_guide_reference_v1(pg_temp.ce012_id(40),pg_temp.ce012_id(20),(select id from experience.guide_references limit 1))$$,'42501','ce_guide_reference_denied','Resolver rechecks current Documents permission');
update identity.role_permissions set effect='allow' where role_id=(select id from identity.roles where code='association_admin' and tenant_id is null) and permission_id=(select id from identity.permissions where code='documents.vault.read');
select throws_ok($$update experience.guide_command_receipts set response_json='{}'$$,'42501','ce_guide_receipt_immutable','Receipt cannot be overwritten');
select is((customer_api.command_ce_guide_v1(pg_temp.ce012_command('cancel_guide',84,3))->>'version')::bigint,4::bigint,'Cancel preserves content and advances version');
select is((select status from experience.guides where id=pg_temp.ce012_id(70)),'cancelled','Cancelled status persisted');
select is((select count(*) from audit.events where tenant_id=pg_temp.ce012_id(1)),4::bigint,'Four accepted commands have four shared audits');
select is((select count(*) from platform.outbox_events where tenant_id=pg_temp.ce012_id(1)),4::bigint,'Four accepted commands have four shared outbox events');
select set_config('request.jwt.claims','{"sub":"17400000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.read_ce_guides_v1(pg_temp.ce012_id(41),pg_temp.ce012_id(20))->'guides'),0,'Cancelled Guide hidden from member');

select * from finish();
rollback;
