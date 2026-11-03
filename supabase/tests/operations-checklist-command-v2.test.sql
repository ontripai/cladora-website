-- SOURCE ONLY / NOT_RUN_NOT_PASS. Requires separate authorized PG lane, installed
-- exact C03 v2 source, real provider-validated test session/AAL2/manage authority,
-- and pre-existing approved synthetic in_progress work-order/item. No Auth issuer,
-- role/grant, fixture provisioning, COMMIT or activation is performed by this file.
begin;
set local search_path=pg_catalog;
set local transaction isolation level read committed;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $fixture_gate$
declare ctx uuid;wo uuid;item uuid;
begin
 if current_setting('cladora.chk2.proof.context_id',true) is null
  or current_setting('cladora.chk2.proof.work_order_id',true) is null
  or current_setting('cladora.chk2.proof.item_id',true) is null or auth.uid() is null
  or to_regprocedure('app_private.operations_command_v2(text,uuid,uuid,text,text)') is null
  or not has_table_privilege(current_user,'audit.events','TRIGGER')
  or not has_schema_privilege(current_user,'app_private','CREATE')
  or to_regprocedure('app_private.core282_proof_audit_fault_v1()') is not null then
  raise exception 'checklist_native_proof_bindings_not_supplied' using errcode='55000';end if;
 ctx:=current_setting('cladora.chk2.proof.context_id')::uuid;
 wo:=current_setting('cladora.chk2.proof.work_order_id')::uuid;
 item:=current_setting('cladora.chk2.proof.item_id')::uuid;
 perform app_private.operations_checkpoint_v1(ctx,jsonb_build_object('action','record_checklist','target_id',wo));
 if not exists(select 1 from maintenance.work_orders w join maintenance.work_order_checklist_items i on i.work_order_id=w.id and i.tenant_id=w.tenant_id
  where w.id=wo and w.status='in_progress' and i.id=item and not i.completed and i.completed_at is null and i.result_json->>'notes' is null)
  or app_private.operations_command_v2('open',ctx,null,null,null)->>'state' is distinct from 'clear' then
  raise exception 'checklist_native_proof_fixture_invalid' using errcode='55000';end if;
end $fixture_gate$;
-- Private local snapshots are never printed. Isolated approved fixture scope is
-- required; equality here is a single-session rollback oracle, not concurrency.
select set_config('cladora.chk2.proof.before',jsonb_build_object(
 'item',(select to_jsonb(i) from maintenance.work_order_checklist_items i where i.id=current_setting('cladora.chk2.proof.item_id')::uuid),
 'C03',(select coalesce(jsonb_agg(to_jsonb(k) order by k.tenant_id,k.key),'[]') from platform.idempotency_keys k),
 'audit',(select count(*) from audit.events),'outbox',(select count(*) from platform.outbox_events),
 'proc',(select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid) from pg_proc p),
 'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d))::text,true);
savepoint checklist_success;
do $roundtrip$
declare ctx uuid:=current_setting('cladora.chk2.proof.context_id')::uuid;
 wo uuid:=current_setting('cladora.chk2.proof.work_order_id')::uuid;
 item uuid:=current_setting('cladora.chk2.proof.item_id')::uuid;
 key1 uuid:=gen_random_uuid();key2 uuid:=gen_random_uuid();wire text;hash text;a jsonb;r jsonb;changed text;
 domains bigint;audits bigint;events bigint;conflict boolean:=false;
begin
 wire:=jsonb_build_object('version',2,'action','record_checklist','context_id',ctx,'target_id',wo,
  'expected_status','in_progress','input',jsonb_build_object('context_id',ctx,'item_id',item,'notes','Synthetic checklist test observation'))::text;
 hash:=encode(extensions.digest(convert_to(wire,'UTF8'),'sha256'),'hex');
 select count(*) into domains from audit.events where action='WORK_ORDER_CHECKLIST_COMPLETED' and entity_id=item;
 select count(*) into audits from audit.events where action='OPERATIONS_COMMAND_COMMITTED';
 select count(*) into events from platform.outbox_events;
 a:=app_private.operations_command_v2('reserve',ctx,key1,wire,hash);
 if a->>'state'<>'pending' or (a->'receipt') is distinct from 'null'::jsonb then raise exception 'reserve_invariant';end if;
 a:=app_private.operations_command_v2('execute',ctx,key1,wire,hash);r:=a->'receipt';
 if a->>'state'<>'committed' or r->>'key'<>key1::text or r->>'contract_version'<>'operations-command-receipt.v2'
  or r#>>'{result,work_order_id}'<>wo::text or r#>>'{result,item_id}'<>item::text
  or r#>>'{result,already_recorded}'<>'false' then raise exception 'fresh_receipt_invariant';end if;
 if (select count(*) from audit.events where action='WORK_ORDER_CHECKLIST_COMPLETED' and entity_id=item)<>domains+1
  or (select count(*) from audit.events where action='OPERATIONS_COMMAND_COMMITTED')<>audits+1
  or (select count(*) from platform.outbox_events)<>events+1 then raise exception 'atomic_first_effects';end if;
 -- A modeled lost reply is simply discarded; the next real call is lookup.
 a:=app_private.operations_command_v2('lookup',ctx,key1,wire,hash);
 if a->'receipt' is distinct from r then raise exception 'lookup_receipt_changed';end if;
 a:=app_private.operations_command_v2('execute',ctx,key1,wire,hash);
 if a->'receipt' is distinct from r then raise exception 'replay_receipt_changed';end if;
 changed:=jsonb_set(wire::jsonb,'{input,notes}','"Different synthetic checklist notes"'::jsonb)::text;
 begin
  perform app_private.operations_command_v2('reserve',ctx,key1,changed,encode(extensions.digest(convert_to(changed,'UTF8'),'sha256'),'hex'));
 exception when sqlstate '40001' then conflict:=true;end;
 if not conflict then raise exception 'same_key_changed_body_was_accepted';end if;
 a:=app_private.operations_command_v2('ack',ctx,key1,wire,hash);
 if a->>'state'<>'acknowledged' or a->'receipt' is distinct from r then raise exception 'ack_changed_receipt';end if;
 -- New independently authorized command, not proof of an earlier keyless POST.
 perform app_private.operations_command_v2('reserve',ctx,key2,wire,hash);
 a:=app_private.operations_command_v2('execute',ctx,key2,wire,hash);
 if a#>>'{receipt,key}'<>key2::text or a#>>'{receipt,result,already_recorded}'<>'true' then raise exception 'already_recorded_new_command_only';end if;
 if (select count(*) from audit.events where action='WORK_ORDER_CHECKLIST_COMPLETED' and entity_id=item)<>domains+1
  or (select count(*) from audit.events where action='OPERATIONS_COMMAND_COMMITTED')<>audits+2
  or (select count(*) from platform.outbox_events)<>events+2 then raise exception 'duplicate_or_missing_effects';end if;
end $roundtrip$;
rollback to checklist_success;
release savepoint checklist_success;
savepoint checklist_audit_fault;
create function app_private.core282_proof_audit_fault_v1() returns trigger language plpgsql security invoker set search_path=pg_catalog as $fault$
begin
 if new.action='OPERATIONS_COMMAND_COMMITTED' and new.entity_id::text=current_setting('cladora.chk2.proof.fault_key',true) then
  raise exception 'synthetic command audit fault' using errcode='22023';end if;
 return new;
end $fault$;
revoke all on function app_private.core282_proof_audit_fault_v1() from public,anon,authenticated,service_role;
do $fault_acl$
declare grantee_name text;
begin
 for grantee_name in select distinct r.rolname from pg_proc p
 cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a join pg_roles r on r.oid=a.grantee
 where p.oid='app_private.core282_proof_audit_fault_v1()'::regprocedure and a.grantee<>p.proowner loop
  execute format('revoke all on function app_private.core282_proof_audit_fault_v1() from %I',grantee_name);
 end loop;
end $fault_acl$;
create trigger core282_audit_fault after insert on audit.events for each row execute function app_private.core282_proof_audit_fault_v1();
do $atomic_fault$
declare ctx uuid:=current_setting('cladora.chk2.proof.context_id')::uuid;
 wo uuid:=current_setting('cladora.chk2.proof.work_order_id')::uuid;item uuid:=current_setting('cladora.chk2.proof.item_id')::uuid;
 key1 uuid:=gen_random_uuid();wire text;hash text;a jsonb;
begin
 perform set_config('cladora.chk2.proof.fault_key',key1::text,true);
 wire:=jsonb_build_object('version',2,'action','record_checklist','context_id',ctx,'target_id',wo,
  'expected_status','in_progress','input',jsonb_build_object('context_id',ctx,'item_id',item,'notes','Synthetic rollback oracle note'))::text;
 hash:=encode(extensions.digest(convert_to(wire,'UTF8'),'sha256'),'hex');
 perform app_private.operations_command_v2('reserve',ctx,key1,wire,hash);
 a:=app_private.operations_command_v2('execute',ctx,key1,wire,hash);
 if a->>'state'<>'rejected' or a#>>'{receipt,error_code}'<>'22023'
  or a#>'{receipt,result}' is distinct from 'null'::jsonb
  or a#>'{receipt,audit_event_id}' is distinct from 'null'::jsonb
  or a#>'{receipt,outbox_event_id}' is distinct from 'null'::jsonb then raise exception 'fault_receipt_invariant';end if;
 if (select to_jsonb(i) from maintenance.work_order_checklist_items i where id=item) is distinct from current_setting('cladora.chk2.proof.before')::jsonb->'item'
  or (select count(*) from audit.events)<>(current_setting('cladora.chk2.proof.before')::jsonb->>'audit')::bigint
  or (select count(*) from platform.outbox_events)<>(current_setting('cladora.chk2.proof.before')::jsonb->>'outbox')::bigint then
  raise exception 'native_item_audit_outbox_not_atomic';end if;
end $atomic_fault$;
rollback to checklist_audit_fault;
release savepoint checklist_audit_fault;
do $cleanup$
begin
 if jsonb_build_object(
 'item',(select to_jsonb(i) from maintenance.work_order_checklist_items i where i.id=current_setting('cladora.chk2.proof.item_id')::uuid),
 'C03',(select coalesce(jsonb_agg(to_jsonb(k) order by k.tenant_id,k.key),'[]') from platform.idempotency_keys k),
 'audit',(select count(*) from audit.events),'outbox',(select count(*) from platform.outbox_events),
 'proc',(select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid) from pg_proc p),
 'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) is distinct from current_setting('cladora.chk2.proof.before')::jsonb then
  raise exception 'checklist_proof_rollback_residue';end if;
end $cleanup$;
-- Sequence/WAL effects are not rollback guarantees. Issued Auth/revoke, two-tab/
-- concurrent PG, actual lost COMMIT reply and cross-connection reads need a
-- separately authorized lane; this source alone is NOT a PASS for them.
rollback;
