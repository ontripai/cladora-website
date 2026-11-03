-- TEST SOURCE ONLY. NOT RUN. Requires separately authorized PG17/native fixture,
-- runtime execution profile, AAL2 current sessions and a disposable transaction.
-- Does not install G2, create Auth users/sessions, grant authority or mint coverage.
-- psql inputs are supplied out-of-band; claims are synthetic SQL-session proof,
-- never evidence of an issued Auth/SSR/HTTP session. No production/staging runner.
\if :{?g2_creator_claims}
\else
\echo 'separately prepared G2 creator/reviewer native fixture required'
\quit 3
\endif
\set ON_ERROR_STOP on
begin isolation level read committed;
select no_plan();
select set_config('g2.test.creator', :'g2_creator_claims', true),
 set_config('g2.test.reviewer', :'g2_reviewer_claims', true),
 set_config('g2.test.context', :'g2_creator_context', true),
 set_config('g2.test.reviewer_context', :'g2_reviewer_context', true),
 set_config('g2.test.workspace', :'g2_workspace', true),
 set_config('g2.test.foreign_workspace', :'g2_foreign_workspace', true),
 set_config('g2.test.payload', :'g2_payload', true),
 set_config('g2.test.creation_key', :'g2_creation_key', true);
select set_config('request.jwt.claims',current_setting('g2.test.creator'),true);
set local role authenticated;
select set_config('g2.test.creation',customer_api.create_building_setup_v2(
 current_setting('g2.test.context')::uuid,current_setting('g2.test.workspace')::uuid,
 current_setting('g2.test.creation_key'),current_setting('g2.test.payload')::jsonb)::text,true);
select set_config('g2.test.run',(current_setting('g2.test.creation')::jsonb->>'run_id'),true);
select set_config('g2.test.update_key','setup-'||current_setting('g2.test.run')||'-r1-update-source',true);
select set_config('g2.test.units',(current_setting('g2.test.payload')::jsonb->'units')::text,true);
select set_config('g2.test.update',customer_api.update_building_setup_units_v2(
 current_setting('g2.test.context')::uuid,current_setting('g2.test.workspace')::uuid,
 current_setting('g2.test.run')::uuid,1,current_setting('g2.test.update_key'),current_setting('g2.test.units')::jsonb)::text,true);
select is((current_setting('g2.test.update')::jsonb->>'revision')::integer,2,'one update');
select is((customer_api.rehearse_building_setup_v2(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,2,
 'setup-'||current_setting('g2.test.run')||'-r2-rehearse-source')->>'revision')::integer,3,'rehearse');
select is((customer_api.submit_building_setup_v2(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,3,
 'setup-'||current_setting('g2.test.run')||'-r3-submit-source')->>'revision')::integer,4,'submit');
select throws_ok($$select customer_api.approve_building_setup_v2(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,4,
 'setup-'||current_setting('g2.test.run')||'-r4-self-source',current_setting('g2.test.update')::jsonb->>'payload_hash')$$,
 '42501',null,'self approval remains denied');
select set_config('request.jwt.claims',current_setting('g2.test.reviewer'),true);
select set_config('g2.test.approve_key','setup-'||current_setting('g2.test.run')||'-r4-approve-source',true);
select set_config('g2.test.approve',customer_api.approve_building_setup_v2(current_setting('g2.test.reviewer_context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,4,
 current_setting('g2.test.approve_key'),current_setting('g2.test.update')::jsonb->>'payload_hash')::text,true);
select is((current_setting('g2.test.approve')::jsonb->>'revision')::integer,5,'dual-control approval');
select set_config('request.jwt.claims',current_setting('g2.test.creator'),true);
select set_config('g2.test.provision',customer_api.provision_building_setup_v2(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,5,
 'setup-'||current_setting('g2.test.run')||'-r5-provision-source')::text,true);
select ok((current_setting('g2.test.provision')::jsonb->>'property_id')::uuid is not null,'provision returns bound property');
reset role;
select is((select count(*)::integer from platform.building_setup_command_coverage
 where run_id=current_setting('g2.test.run')::uuid and epoch_id='building-g2-pm169-v1'),1,'creation minted exactly one genuine coverage row');
select is((select count(*)::integer from platform.building_setup_command_receipts
 where run_id=current_setting('g2.test.run')::uuid),5,'five atomic immutable command receipts');
select set_config('g2.test.rows_before', (select jsonb_agg(to_jsonb(t) order by expected_revision)::text
 from platform.building_setup_command_receipts t where run_id=current_setting('g2.test.run')::uuid),true);
set local role authenticated;
select is(customer_api.update_building_setup_units_v2(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,1,
 current_setting('g2.test.update_key'),current_setting('g2.test.units')::jsonb),
 current_setting('g2.test.update')::jsonb,'old exact command survives all later commands');
select is(customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.update_key'),'update',1)#>'{evidence,receipt}',
 current_setting('g2.test.update')::jsonb,'creator own exact proof');
select set_config('request.jwt.claims',current_setting('g2.test.reviewer'),true);
select is(customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.reviewer_context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.approve_key'),'approve',4)#>'{evidence,receipt}',
 current_setting('g2.test.approve')::jsonb,'minimal own reviewer receipt remains recoverable after provision');
select throws_ok($$select customer_api.get_building_setup_v2(current_setting('g2.test.reviewer_context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid)$$,
 '42501',null,'minimal reviewer recovery never authorizes full-run access');
select ok(not (customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.reviewer_context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.approve_key'),'approve',4) ?| array['payload','history','run','sessions']),
 'receipt reader never adds full-run/history/session disclosure');
select set_config('request.jwt.claims',jsonb_set(current_setting('g2.test.creator')::jsonb,'{aal}','"aal1"')::text,true);
select throws_ok($$select customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.update_key'),'update',1)$$,'42501',null,'AAL1 cannot recover durable receipt');
select set_config('request.jwt.claims',current_setting('g2.test.creator'),true);
select throws_ok($$select customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.foreign_workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.update_key'),'update',1)$$,'42501',null,'valid foreign Workspace cannot borrow creator binding');
select set_config('request.jwt.claims',current_setting('g2.test.reviewer'),true);
select throws_ok($$select customer_api.get_building_setup_command_receipt_v1(current_setting('g2.test.context')::uuid,
 current_setting('g2.test.workspace')::uuid,current_setting('g2.test.run')::uuid,
 current_setting('g2.test.update_key'),'update',1)$$,'42501',null,'foreign actor cannot borrow creator Context');
reset role;
select is((select jsonb_agg(to_jsonb(t) order by expected_revision) from platform.building_setup_command_receipts t
 where run_id=current_setting('g2.test.run')::uuid),current_setting('g2.test.rows_before')::jsonb,'replay and lookup never change evidence');
select throws_ok($$update platform.building_setup_command_receipts set command_key=command_key
 where run_id=current_setting('g2.test.run')::uuid$$,'42501',null,'owner cannot update immutable evidence');
select throws_ok($$delete from platform.building_setup_command_coverage where run_id=current_setting('g2.test.run')::uuid$$,
 '42501',null,'coverage cannot be deleted to manufacture legacy absence');
select * from finish();
rollback;
