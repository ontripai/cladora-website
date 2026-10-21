-- Actual SQL regressions. Disposable local/CI only; all fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(46);
create function pg_temp.adv214_id(n integer) returns uuid language sql immutable as $$
  select ('21400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into auth.users(id,email) values
(pg_temp.adv214_id(1),'advisor214-a@cladora.test'),(pg_temp.adv214_id(2),'advisor214-b@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
(pg_temp.adv214_id(10),'Advisor214 A','ADV214-A','active'),
(pg_temp.adv214_id(20),'Advisor214 B','ADV214-B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
(pg_temp.adv214_id(11),pg_temp.adv214_id(10),'condominium','Advisor214 A','active'),
(pg_temp.adv214_id(21),pg_temp.adv214_id(20),'condominium','Advisor214 B','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
(pg_temp.adv214_id(12),pg_temp.adv214_id(10),pg_temp.adv214_id(11),'ADV214','A'),
(pg_temp.adv214_id(22),pg_temp.adv214_id(20),pg_temp.adv214_id(21),'ADV214','B');
insert into portfolio.units(id,tenant_id,building_id,code) values
(pg_temp.adv214_id(13),pg_temp.adv214_id(10),pg_temp.adv214_id(12),'واحد-214/Ș'),
(pg_temp.adv214_id(14),pg_temp.adv214_id(10),pg_temp.adv214_id(12),'ADV214-2'),
(pg_temp.adv214_id(23),pg_temp.adv214_id(20),pg_temp.adv214_id(22),'واحد-214/Ș');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select pg_temp.adv214_id(v.m),pg_temp.adv214_id(v.t),pg_temp.adv214_id(v.u),r.id,'active',statement_timestamp()-interval '2 days'
from (values(30,10,1),(31,10,2),(32,20,1)) v(m,t,u)
join identity.roles r on r.code='association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
(pg_temp.adv214_id(40),pg_temp.adv214_id(10),pg_temp.adv214_id(30),'property',pg_temp.adv214_id(11),statement_timestamp()-interval '1 day'),
(pg_temp.adv214_id(41),pg_temp.adv214_id(10),pg_temp.adv214_id(31),'property',pg_temp.adv214_id(11),statement_timestamp()-interval '1 day'),
(pg_temp.adv214_id(42),pg_temp.adv214_id(20),pg_temp.adv214_id(32),'property',pg_temp.adv214_id(21),statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
(pg_temp.adv214_id(50),pg_temp.adv214_id(10),'ASSOCIATION','ADV214 A','PILOT','ACTIVE'),
(pg_temp.adv214_id(51),pg_temp.adv214_id(20),'ASSOCIATION','ADV214 B','PILOT','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
select pg_temp.adv214_id(w),k,'boolean',true,statement_timestamp()-interval '1 day'
from (values(50),(51)) ws(w) cross join (values('module.accounting'),('module.governance')) keys(k);
insert into portfolio.parties(id,tenant_id,type,legal_name) values
(pg_temp.adv214_id(60),pg_temp.adv214_id(10),'person','Owner A'),
(pg_temp.adv214_id(61),pg_temp.adv214_id(10),'person','Owner B'),
(pg_temp.adv214_id(62),pg_temp.adv214_id(10),'person','Ineligible owner'),
(pg_temp.adv214_id(63),pg_temp.adv214_id(20),'person','Foreign owner');
insert into billing.invoices(id,tenant_id,property_id,unit_id,liable_party_id,invoice_no,period_start,period_end,subtotal)
overriding system value values
(pg_temp.adv214_id(70),pg_temp.adv214_id(10),pg_temp.adv214_id(11),pg_temp.adv214_id(13),pg_temp.adv214_id(60),900214,current_date-30,current_date,12);
insert into finance.charge_categories(id,tenant_id,code,name) values(pg_temp.adv214_id(80),pg_temp.adv214_id(10),'ADV214','Electricity');
insert into finance.allocation_runs(id,tenant_id,property_id,period_start,period_end) values
(pg_temp.adv214_id(81),pg_temp.adv214_id(10),pg_temp.adv214_id(11),current_date-30,current_date);
insert into finance.allocation_inputs(id,tenant_id,run_id,source_type,source_id,category_id,amount,snapshot_json) values
(pg_temp.adv214_id(82),pg_temp.adv214_id(10),pg_temp.adv214_id(81),'invoice',pg_temp.adv214_id(70),pg_temp.adv214_id(80),12,'{}'),
(pg_temp.adv214_id(83),pg_temp.adv214_id(10),pg_temp.adv214_id(81),'manual',null,pg_temp.adv214_id(80),8,'{}');
insert into finance.allocation_items(id,tenant_id,run_id,input_id,unit_id,responsible_party_id,method,allocated_amount,rule_snapshot) values
(pg_temp.adv214_id(84),pg_temp.adv214_id(10),pg_temp.adv214_id(81),pg_temp.adv214_id(82),pg_temp.adv214_id(13),pg_temp.adv214_id(60),'fixed',12,'{}'),
(pg_temp.adv214_id(85),pg_temp.adv214_id(10),pg_temp.adv214_id(81),pg_temp.adv214_id(83),pg_temp.adv214_id(13),pg_temp.adv214_id(60),'fixed',8,'{}');
insert into governance.meetings(id,tenant_id,property_id,title,meeting_type,scheduled_at,status,quorum_rule) values
(pg_temp.adv214_id(90),pg_temp.adv214_id(10),pg_temp.adv214_id(11),'Owners A','annual',statement_timestamp(),'open','{}'),
(pg_temp.adv214_id(91),pg_temp.adv214_id(20),pg_temp.adv214_id(21),'Foreign owners','annual',statement_timestamp(),'open','{}'),
(pg_temp.adv214_id(92),pg_temp.adv214_id(10),pg_temp.adv214_id(11),'Empty electorate','annual',statement_timestamp(),'open','{}');
insert into governance.agenda_items(id,tenant_id,meeting_id,sequence_no,title,decision_required,decision_category) values
(pg_temp.adv214_id(100),pg_temp.adv214_id(10),pg_temp.adv214_id(90),1,'Budget',true,'ordinary_resolution'),
(pg_temp.adv214_id(101),pg_temp.adv214_id(10),pg_temp.adv214_id(90),2,'Denied test',true,'ordinary_resolution'),
(pg_temp.adv214_id(102),pg_temp.adv214_id(10),pg_temp.adv214_id(92),1,'Empty',true,'ordinary_resolution');
insert into governance.eligibility_snapshots(id,tenant_id,meeting_id,unit_id,party_id,ownership_share,voting_weight,eligible,snapshot_json) values
(pg_temp.adv214_id(110),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(13),pg_temp.adv214_id(60),0.6,0.6,true,'{}'),
(pg_temp.adv214_id(111),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(14),pg_temp.adv214_id(60),0.4,0.4,true,'{}'),
(pg_temp.adv214_id(112),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(13),pg_temp.adv214_id(61),0.25,0.25,true,'{}'),
(pg_temp.adv214_id(113),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(14),pg_temp.adv214_id(62),0.6,0.6,false,'{}'),
(pg_temp.adv214_id(114),pg_temp.adv214_id(20),pg_temp.adv214_id(91),pg_temp.adv214_id(23),pg_temp.adv214_id(63),1,1,true,'{}');
insert into governance.meeting_invitations(id,tenant_id,meeting_id,party_id,unit_id) values
(pg_temp.adv214_id(120),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(60),pg_temp.adv214_id(13)),
(pg_temp.adv214_id(123),pg_temp.adv214_id(20),pg_temp.adv214_id(91),pg_temp.adv214_id(63),pg_temp.adv214_id(23));
insert into governance.attendance(id,tenant_id,meeting_id,eligibility_id,attendance_mode) values
(pg_temp.adv214_id(121),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(110),'in_person');
insert into governance.proxies(id,tenant_id,meeting_id,eligibility_id,grantor_party_id,representative_party_id,valid_from,valid_until) values
(pg_temp.adv214_id(122),pg_temp.adv214_id(10),pg_temp.adv214_id(90),pg_temp.adv214_id(110),pg_temp.adv214_id(60),pg_temp.adv214_id(61),statement_timestamp()-interval '1 hour',statement_timestamp()+interval '1 hour');
create function pg_temp.adv214_allocation(context_no integer default 40,q text default null) returns jsonb language sql stable as $$
 select customer_api.get_allocations_v1(pg_temp.adv214_id(context_no),'lines',q)
$$;
create function pg_temp.adv214_governance(view_name text,context_no integer default 40) returns jsonb language sql stable as $$
 select customer_api.get_governance_v1(pg_temp.adv214_id(context_no),view_name)
$$;
-- Invoker wrappers only; no privileged test double substitutes for real functions.
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
grant execute on function pg_temp.adv214_id(integer),pg_temp.adv214_allocation(integer,text),pg_temp.adv214_governance(text,integer) to authenticated;
create temp table adv214_before as select
(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text) from finance.allocation_items t where tenant_id=pg_temp.adv214_id(10)) financial,
(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text) from governance.meetings t where tenant_id=pg_temp.adv214_id(10)) meetings;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.adv214_id(1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select lives_ok($$select pg_temp.adv214_allocation(40,'900214')$$,'actual gateway searches numeric invoice number without bigint coercion error');
select is(pg_temp.adv214_allocation(40,'900214')->>'total','1','numeric invoice query matches the invoice line only');
select is(pg_temp.adv214_allocation(40,'900214')->'rows'->0->'source_document','900214'::jsonb,'existing numeric JSON output is preserved');
select is(pg_temp.adv214_allocation()->>'total','2','null query retains invoice and no-invoice lines');
select is(pg_temp.adv214_allocation(40,'missing')->>'total','0','nonmatching search is empty, not an exception');
select lives_ok($$select pg_temp.adv214_governance('invitations')$$,'invitations use actual canonical Unit.code');
select is(pg_temp.adv214_governance('invitations')->'rows'->0->>'unit_code','واحد-214/Ș','canonical multilingual label retains unit_code output alias');
select is(pg_temp.adv214_governance('attendance')->'rows'->0->>'unit_code','واحد-214/Ș','attendance canonical label executes');
select is(pg_temp.adv214_governance('proxies')->'rows'->0->>'unit_code','واحد-214/Ș','proxy canonical label executes');
select is(pg_temp.adv214_governance('invitations')->>'total','1','same-code foreign tenant invitation is absent');
select is(pg_temp.adv214_governance('invitations',42)->'rows'->0->>'id',pg_temp.adv214_id(123)::text,'separately authorized foreign Context returns only its own invitation');
select throws_ok($$select pg_temp.adv214_allocation(41)$$,'42501','customer_context_access_denied','allocation rejects another actor Context');
select throws_ok($$select pg_temp.adv214_governance('invitations',41)$$,'42501','customer_context_access_denied','governance rejects another actor Context');
reset role;
select is((select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text) from finance.allocation_items t where tenant_id=pg_temp.adv214_id(10)),(select financial from adv214_before),'allocation reads are zero-write');
select is((select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text) from governance.meetings t where tenant_id=pg_temp.adv214_id(10)),(select meetings from adv214_before),'governance reads are zero-write');
set local role authenticated;
select lives_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(100),'Budget?',false)$$,'actual ballot opens through existing authority and option triggers');
reset role;
select is((select property_units_per_owner from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(100)),jsonb_build_object(pg_temp.adv214_id(60)::text,2,pg_temp.adv214_id(61)::text,1),'single snapshot contains all owners and distinct units per owner');
select is((select ownership_shares from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(100)),jsonb_build_object(pg_temp.adv214_id(60)::text,1,pg_temp.adv214_id(61)::text,0.25),'single snapshot sums each eligible owner without nested aggregate');
select is((select total_condominium_units from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(100)),2,'total units remain distinct');
select ok(not (select property_units_per_owner ? pg_temp.adv214_id(62)::text or property_units_per_owner ? pg_temp.adv214_id(63)::text from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(100)),'ineligible and foreign owner excluded from maps');
select is((select status::text from governance.votes where agenda_item_id=pg_temp.adv214_id(100)),'open','returned ballot ends open, not draft');
select is((select count(*)::integer from governance.vote_options o join governance.votes v on v.id=o.vote_id where v.agenda_item_id=pg_temp.adv214_id(100)),3,'all three options exist before opening');
select throws_like($$update governance.vote_options set label='tamper' where vote_id=(select id from governance.votes where agenda_item_id=pg_temp.adv214_id(100))$$,'%vote_options_require_draft_vote%','existing opened-option immutability guard remains enabled');
select ok((select legal_decision_rule_snapshot=to_jsonb(r) from governance.motion_electorate_snapshots s join governance.legal_decision_rules r on r.id=s.legal_decision_rule_id where s.agenda_item_id=pg_temp.adv214_id(100)),'legal rule and threshold snapshot unchanged');
set local role authenticated;
select lives_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(102),'Empty?',false)$$,'empty electorate does not lose aggregate output');
reset role;
select is((select property_units_per_owner from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(102)),'{}'::jsonb,'empty owner map is object');
select is((select ownership_shares from governance.motion_electorate_snapshots where agenda_item_id=pg_temp.adv214_id(102)),'{}'::jsonb,'empty share map is object');
set local role authenticated;
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(42),pg_temp.adv214_id(101),'Foreign?',false)$$,'42704','agenda_item_not_found','foreign tenant cannot open the local agenda');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(41),pg_temp.adv214_id(101),'Other actor?',false)$$,'42501','customer_context_access_denied','ballot rejects another actor Context');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select pg_temp.adv214_allocation()$$,'42501','authentication_required','allocation requires actor');
select throws_ok($$select pg_temp.adv214_governance('invitations')$$,'42501','authentication_required','governance requires actor');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(101),'Anonymous?',false)$$,'42501','authentication_required','opening ballot requires actor');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.adv214_id(1),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok($$select pg_temp.adv214_allocation()$$,'42501','mfa_required','allocation MFA policy preserved');
select throws_ok($$select pg_temp.adv214_governance('invitations')$$,'42501','mfa_required','governance MFA policy preserved');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(101),'AAL1?',false)$$,'42501','mfa_required','ballot AAL2 remains mandatory');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.adv214_id(1),'role','authenticated','aal','aal2')::text,true);
update identity.context_grants set ends_at=statement_timestamp()-interval '1 hour' where id=pg_temp.adv214_id(40);
set local role authenticated;
select throws_ok($$select pg_temp.adv214_allocation()$$,'42501','customer_context_access_denied','expired Context cannot read allocation');
select throws_ok($$select pg_temp.adv214_governance('invitations')$$,'42501','customer_context_access_denied','expired Context cannot read governance');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(101),'Expired?',false)$$,'42501','customer_context_access_denied','expired Context cannot open ballot');
reset role;
update identity.context_grants set ends_at=null where id=pg_temp.adv214_id(40);
update identity.memberships set status='suspended' where id=pg_temp.adv214_id(30);
set local role authenticated;
select throws_ok($$select pg_temp.adv214_allocation()$$,'42501','customer_context_access_denied','suspended membership cannot read allocation');
select throws_ok($$select pg_temp.adv214_governance('invitations')$$,'42501','customer_context_access_denied','suspended membership cannot read governance');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(101),'Suspended?',false)$$,'42501','customer_context_access_denied','suspended membership cannot open ballot');
reset role;
update identity.memberships set status='active' where id=pg_temp.adv214_id(30);
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=pg_temp.adv214_id(50);
set local role authenticated;
select throws_ok($$select pg_temp.adv214_allocation()$$,'42501','allocation_entitlement_required','allocation entitlement preserved');
select throws_ok($$select pg_temp.adv214_governance('invitations')$$,'42501','governance_entitlement_required','governance entitlement preserved');
select throws_ok($$select governance.open_ballot(pg_temp.adv214_id(40),pg_temp.adv214_id(101),'No module?',false)$$,'42501','governance_entitlement_required','ballot entitlement preserved');
reset role;
select is((select count(*)::integer from governance.votes where agenda_item_id=pg_temp.adv214_id(101)),0,'all denied writes leave no ballot');
select ok(not has_function_privilege('anon','finance.get_customer_allocations(uuid,text,text,text,text,date,date,integer,integer,uuid)','EXECUTE') and not has_function_privilege('anon','governance.get_customer_governance(uuid,text,text,text,date,date,integer,integer,uuid)','EXECUTE') and not has_function_privilege('anon','governance.open_ballot(uuid,uuid,text,boolean)','EXECUTE'),'existing anonymous EXECUTE denial preserved');
select * from finish();
rollback;
