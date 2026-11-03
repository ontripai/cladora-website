-- Task282-1: inactive C03 extension; NOT a migration or installer.
-- No activation, positive caller grant, managed Auth change or retention policy.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $hold$ begin raise exception 'operations_checklist_v2_source_only' using errcode='55000';end $hold$;

do $entry$
begin
 if current_user<>session_user or current_user<>'postgres'
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or to_regprocedure('app_private.operations_command_v1(text,uuid,uuid,text,text)') is null
  or to_regprocedure('app_private.operations_checkpoint_v1(uuid,jsonb)') is null
  or to_regprocedure('app_private.guard_operations_unresolved_v1()') is null
  or to_regprocedure('maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)') is null
  or to_regprocedure('app_private.operations_command_v2(text,uuid,uuid,text,text)') is not null
  or to_regprocedure('customer_api.operations_command_v2(text,uuid,uuid,text,text)') is not null
  or to_regprocedure('app_private.get_work_order_checklist_v2(uuid,uuid)') is not null
  or to_regprocedure('customer_api.get_work_order_checklist_v2(uuid,uuid)') is not null then
  raise exception 'operations_checklist_v2_prestate_unavailable' using errcode='55000';end if;
end $entry$;
-- Exact existing helper body/security/owner pins are asserted here. These are
-- source-derived pg_proc.prosrc hashes, not a claimed compiled catalog capture.
do $pins$
declare r record;
begin
 for r in select * from (values
  ('app_private.operations_command_v1(text,uuid,uuid,text,text)','396f758089ec9cea4503b1797bdc2a38dc6b59c2d30bdcaa5ec82550fcd9071d'),
  ('app_private.operations_checkpoint_v1(uuid,jsonb)','4dfcdcae09c7545a3f7fd181fcde131cef9dff220fa6b341e1ba7050e525c706'),
  ('app_private.guard_operations_unresolved_v1()','857e75c373e2a2cf34ef350dcea4bc70c0099153860b0c44c2cdf26615337c82'),
  ('maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)','f95999f78c7173ed54c346e018e9729b1de30f2da35caf1496775b5c181b8ab3')
 ) as t(signature,body_sha256) loop
  if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(r.signature)
   and p.proowner='postgres'::regrole and p.prosecdef and p.proconfig=array['search_path=pg_catalog']
   and encode(extensions.digest(p.prosrc,'sha256'),'hex')=r.body_sha256) then
   raise exception 'operations_checklist_v2_dependency_changed' using errcode='55000';end if;
 end loop;
end $pins$;
select set_config('cladora.chk2.default_before',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]')::text from pg_default_acl d),true);
select set_config('cladora.chk2.proc_before',(select jsonb_agg(oid order by oid)::text from pg_proc),true);
select set_config('cladora.chk2.roles_before',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]')::text from pg_auth_members m),true);
select set_config('cladora.chk2.managed_before',(select coalesce(jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid),'[]')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),true);

create function app_private.operations_command_v2(p_phase text,p_context_id uuid,p_key uuid,p_wire text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $command_v2$
declare c jsonb; before_c jsonb; e jsonb; d jsonb; v_open jsonb;
 v_key text; v_hash text; v_binding jsonb; v_actor uuid; v_workspace uuid; v_tenant uuid;
 existing platform.idempotency_keys%rowtype; pending platform.idempotency_keys%rowtype;
 v_result jsonb; v_native jsonb; v_selected jsonb; v_receipt jsonb; v_state text; v_error text;
 v_audit bigint; v_outbox uuid; v_target uuid; v_item uuid; v_before record; v_status text;
begin
 if current_setting('transaction_isolation',true) is distinct from 'read committed' then
  raise exception 'operations_isolation_unavailable' using errcode='55000';end if;
 if p_phase is null or p_phase not in ('open','lookup','reserve','execute','ack') then
  raise exception 'invalid_operations_phase' using errcode='22023';end if;
 if p_phase='open' then
  if p_key is not null or p_wire is not null or p_fingerprint is not null then
   raise exception 'invalid_operations_command' using errcode='22023';end if;
  -- Reuse the exact accepted all-version actor/Workspace admission and original
  -- authority discovery. No second catalog, namespace or authority engine.
  v_open:=app_private.operations_command_v1('open',p_context_id,null,null,null);
  if v_open->'command' is null or v_open->'command'='null'::jsonb then
   return jsonb_set(v_open,'{version}','2'::jsonb);
  end if;
  e:=(v_open#>>'{command,wire}')::jsonb;
  if e->>'version'='1' then return v_open;
  elsif e->>'version'='2' and e->>'action'='record_checklist' then
   return jsonb_set(v_open,'{version}','2'::jsonb);
  else raise exception 'operations_command_catalog_invariant' using errcode='55000';end if;
 end if;
 if p_key is null or p_wire is null or octet_length(p_wire)>24000 or p_fingerprint is null
  or p_fingerprint!~'^[0-9a-f]{64}$'
  or encode(extensions.digest(convert_to(p_wire,'UTF8'),'sha256'),'hex')<>p_fingerprint then
  raise exception 'invalid_operations_command' using errcode='22023';end if;
 e:=p_wire::jsonb;
 -- Exact v1 wire/hash/result/receipt implementation remains the existing host.
 if e->>'version'='1' then
  return app_private.operations_command_v1(p_phase,p_context_id,p_key,p_wire,p_fingerprint);
 end if;
 d:=e->'input';
 if jsonb_typeof(e) is distinct from 'object' or e->'version' is distinct from '2'::jsonb
  or e->>'action' is distinct from 'record_checklist' or e->>'expected_status' is distinct from 'in_progress'
  or jsonb_typeof(d) is distinct from 'object'
  or (select array_agg(x order by x) from jsonb_object_keys(e) x) is distinct from array['action','context_id','expected_status','input','target_id','version']
  or (select array_agg(x order by x) from jsonb_object_keys(d) x) is distinct from array['context_id','item_id','notes']
  or e->>'context_id' is distinct from p_context_id::text or d->>'context_id' is distinct from p_context_id::text
  or jsonb_typeof(e->'context_id') is distinct from 'string' or jsonb_typeof(e->'target_id') is distinct from 'string'
  or jsonb_typeof(d->'context_id') is distinct from 'string' or jsonb_typeof(d->'item_id') is distinct from 'string'
  or jsonb_typeof(d->'notes') is distinct from 'string'
  or e->>'target_id' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or d->>'item_id' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or length(d->>'notes') not between 10 and 2000
  or btrim(d->>'notes',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') is distinct from d->>'notes' then
  raise exception 'invalid_operations_checklist_input' using errcode='22023';end if;
 v_target:=(e->>'target_id')::uuid;v_item:=(d->>'item_id')::uuid;
 c:=app_private.operations_checkpoint_v1(p_context_id,null);
 v_actor:=(c->>'actor_id')::uuid;v_workspace:=(c->>'workspace_id')::uuid;v_tenant:=(c->>'tenant_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('operations.actor.v1/'||v_workspace||'/'||v_actor,235));
 perform 1 from platform.customer_workspaces where id=v_workspace and tenant_id=v_tenant for update;
 if c is distinct from app_private.operations_checkpoint_v1(p_context_id,null) then
  raise exception 'operations_authority_changed' using errcode='40001';end if;
 if (select count(*) from platform.idempotency_keys k where k.tenant_id=v_tenant and k.actor_id=v_actor
  and starts_with(k.key,'operations.command.v1/'||v_workspace||'/') and k.response_ref->>'acknowledged_at' is null)>1 then
  raise exception 'operations_command_catalog_invariant' using errcode='55000';end if;
 select * into pending from platform.idempotency_keys k where k.tenant_id=v_tenant and k.actor_id=v_actor
  and starts_with(k.key,'operations.command.v1/'||v_workspace||'/') and k.response_ref->>'acknowledged_at' is null
  order by k.key limit 1 for update;
 before_c:=app_private.operations_checkpoint_v1(p_context_id,e);
 v_key:='operations.command.v1/'||v_workspace||'/'||p_key;
 perform pg_advisory_xact_lock(hashtextextended('operations.resource.v1/'||v_workspace||'/'||v_target,235));
 if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
  raise exception 'operations_authority_changed' using errcode='40001';end if;
 if p_phase in ('reserve','execute') and exists(select 1 from platform.idempotency_keys k where k.tenant_id=v_tenant
  and starts_with(k.key,'operations.command.v1/'||v_workspace||'/') and k.key<>v_key and k.response_ref->>'acknowledged_at' is null
  and (((k.response_ref#>>'{command,wire}')::jsonb->>'target_id')=v_target::text or k.response_ref#>>'{receipt,result,id}'=v_target::text)) then
  raise exception 'operations_resource_unresolved_command' using errcode='40001';end if;
 select * into existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 v_binding:=case when found then existing.response_ref->'authority_at_reservation' else before_c end;
 if v_binding is null or v_binding-'authority_revision' is distinct from before_c-'authority_revision' then
  raise exception 'operations_authority_binding_conflict' using errcode='40001';end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('version',2,'authority_at_reservation',v_binding,'wire',p_wire)::text,'UTF8'),'sha256'),'hex');
 if found then
  if existing.actor_id is distinct from v_actor or existing.request_hash is distinct from v_hash
   or existing.expires_at<=clock_timestamp() or existing.response_ref->'command' is distinct from jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint) then
   raise exception 'operations_command_conflict' using errcode='40001';end if;
 elsif p_phase='lookup' then
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
   raise exception 'operations_authority_changed' using errcode='40001';end if;
  return jsonb_build_object('version',2,'actor_id',v_actor,'context_id',p_context_id,'state','absent',
   'command',jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint),'receipt',null);
 elsif p_phase='reserve' then
  if pending.key is not null then raise exception 'operations_unresolved_command' using errcode='40001';end if;
  -- Approved technical-test scope only: no TTL/purge/cancel; real-data policy OPEN.
  insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at)
  values(v_tenant,v_actor,v_key,v_hash,jsonb_build_object('command',jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint),
   'authority_at_reservation',v_binding,'receipt',null,'acknowledged_at',null),102,'infinity');
  select * into strict existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key;
 else raise exception 'operations_reservation_required' using errcode='40001';end if;
 if p_phase in ('reserve','execute') and pending.key is not null and pending.key<>v_key then
  raise exception 'operations_unresolved_command' using errcode='40001';end if;
 if p_phase='ack' then
  if existing.status_code not in (200,409) or existing.response_ref->'receipt' is null or existing.response_ref->'receipt'='null'::jsonb then
   raise exception 'operations_receipt_required' using errcode='40001';end if;
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
   raise exception 'operations_authority_changed' using errcode='40001';end if;
  update platform.idempotency_keys set response_ref=jsonb_set(response_ref,'{acknowledged_at}',to_jsonb(clock_timestamp()))
   where tenant_id=v_tenant and key=v_key and response_ref->>'acknowledged_at' is null;
  v_state:='acknowledged';
 elsif existing.status_code in (200,409) then v_state:=case when existing.status_code=200 then 'committed' else 'rejected' end;
 elsif p_phase<>'execute' then v_state:='pending';
 else
  begin
   -- Existing private C03 execution frame; never a caller-set GUC/claim.
   update platform.idempotency_keys set response_ref=jsonb_set(response_ref,'{running_xid}',to_jsonb(pg_current_xact_id()::text))
    where tenant_id=v_tenant and key=v_key;
   select status::text into strict v_status from maintenance.work_orders where id=v_target and tenant_id=v_tenant for update;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
   if v_status is distinct from 'in_progress' then raise exception 'operations_prestate_conflict' using errcode='40001';end if;
   select completed,completed_at,result_json into v_before from maintenance.work_order_checklist_items
    where id=v_item and work_order_id=v_target and tenant_id=v_tenant for update;
   if not found then raise exception 'checklist_item_not_found' using errcode='P0002';end if;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
   v_native:=maintenance.work_order_checklist_v1(p_context_id,v_target,v_item,d->>'notes');
   if v_native->>'work_order_id' is distinct from v_target::text or v_native->>'status' is distinct from 'in_progress'
    or jsonb_typeof(v_native->'items') is distinct from 'array'
    or (select count(*) from jsonb_array_elements(v_native->'items') i where i->>'id'=v_item::text)<>1 then
    raise exception 'operations_domain_receipt_invariant' using errcode='55000';end if;
   select i into strict v_selected from jsonb_array_elements(v_native->'items') i where i->>'id'=v_item::text;
   if v_selected->'completed' is distinct from 'true'::jsonb or v_selected->>'notes' is distinct from d->>'notes'
    or jsonb_typeof(v_selected->'completed_at') is distinct from 'string' or (v_selected->>'completed_at')::timestamptz>clock_timestamp()
    or (v_before.completed and (v_before.result_json->>'notes' is distinct from d->>'notes'
      or v_before.completed_at is distinct from (v_selected->>'completed_at')::timestamptz)) then
    raise exception 'operations_domain_receipt_invariant' using errcode='55000';end if;
   v_result:=jsonb_build_object('work_order_id',v_target,'item_id',v_item,'completed',true,
    'completed_at',v_selected->'completed_at','notes',d->>'notes','already_recorded',v_before.completed);
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
   insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
   values(v_tenant,v_actor,before_c->>'role_code','OPERATIONS_COMMAND_COMMITTED','operations.command',p_key,'C03 checklist command v2',
    jsonb_build_object('context_id',p_context_id,'workspace_id',v_workspace,'action','record_checklist','target_id',v_target,'fingerprint',p_fingerprint)) returning id into v_audit;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
   insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
   values(v_tenant,'operations.command',p_key,2,'operations.command.committed.v2',
    jsonb_build_object('key',p_key,'action','record_checklist','target_id',v_target,'fingerprint',p_fingerprint)) returning id into v_outbox;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
  exception when sqlstate '22023' or sqlstate '40001' or sqlstate '42501' or sqlstate 'P0002' then
   v_error:=sqlstate;v_result:=null;v_audit:=null;v_outbox:=null;
  end;
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
   raise exception 'operations_authority_changed' using errcode='40001';end if;
  v_receipt:=jsonb_build_object('contract_version','operations-command-receipt.v2','key',p_key,'context_id',p_context_id,
   'workspace_id',v_workspace,'actor_id',v_actor,'membership_id',(v_binding->>'membership_id')::uuid,
   'authority_revision',(v_binding->>'authority_revision')::bigint,'request_hash',v_hash,'action','record_checklist','target_id',v_target,
   'fingerprint',p_fingerprint,'outcome',case when v_error is null then 'committed' else 'rejected' end,
   'result',v_result,'error_code',v_error,'audit_event_id',v_audit::text,'outbox_event_id',v_outbox,'recorded_at',clock_timestamp());
  update platform.idempotency_keys set status_code=case when v_error is null then 200 else 409 end,
   response_ref=jsonb_set(response_ref-'running_xid','{receipt}',v_receipt) where tenant_id=v_tenant and key=v_key;
  select * into strict existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key;
  v_state:=case when v_error is null then 'committed' else 'rejected' end;
 end if;
 -- Receipt/ACK updates, native triggers and audit/outbox waits precede this final
 -- currentness check. No durable effect or response is released on invalidity.
 if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
  raise exception 'operations_authority_changed' using errcode='40001';end if;
 return jsonb_build_object('version',2,'actor_id',v_actor,'context_id',p_context_id,'state',v_state,
  'command',existing.response_ref->'command','receipt',existing.response_ref->'receipt');
end;
$command_v2$;
revoke all privileges on function app_private.operations_command_v2(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function customer_api.operations_command_v2(p_phase text,p_context_id uuid,p_key uuid,p_wire text,p_fingerprint text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $facade$ select app_private.operations_command_v2(p_phase,p_context_id,p_key,p_wire,p_fingerprint) $facade$;
revoke all privileges on function customer_api.operations_command_v2(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;

create function app_private.get_work_order_checklist_v2(p_context_id uuid,p_work_order_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $read_only$
declare before_c jsonb; e jsonb; v_result jsonb;
begin
 if current_setting('transaction_isolation',true) is distinct from 'read committed' then
  raise exception 'operations_isolation_unavailable' using errcode='55000';end if;
 if p_context_id is null or p_work_order_id is null then raise exception 'invalid_checklist_read' using errcode='22023';end if;
 -- Internal scope selector for the existing manage permission; not a command or
 -- receipt and never persisted. This function cannot reserve/execute/ACK.
 e:=jsonb_build_object('action','record_checklist','target_id',p_work_order_id);
 before_c:=app_private.operations_checkpoint_v1(p_context_id,e);
 select jsonb_build_object('work_order_id',w.id,'status',w.status,'items',
  (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'required',i.required,'completed',i.completed,
   'completed_at',i.completed_at,'notes',i.result_json->>'notes') order by i.sequence_no),'[]'::jsonb)
   from maintenance.work_order_checklist_items i where i.work_order_id=w.id and i.tenant_id=w.tenant_id))
 into strict v_result from maintenance.work_orders w where w.id=p_work_order_id and w.tenant_id=(before_c->>'tenant_id')::uuid;
 if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then
  raise exception 'operations_authority_changed' using errcode='40001';end if;
 return v_result;
exception when no_data_found or too_many_rows then
 raise exception 'checklist_source_unavailable' using errcode='55000';
end;
$read_only$;
revoke all privileges on function app_private.get_work_order_checklist_v2(uuid,uuid) from public,anon,authenticated,service_role;
create function customer_api.get_work_order_checklist_v2(p_context_id uuid,p_work_order_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog
as $read_facade$ select app_private.get_work_order_checklist_v2(p_context_id,p_work_order_id) $read_facade$;
revoke all privileges on function customer_api.get_work_order_checklist_v2(uuid,uuid) from public,anon,authenticated,service_role;

do $oc1$
declare r record;g text;
begin
 for r in select p.oid,p.oid::regprocedure as signature,p.proowner from pg_proc p
 where p.oid in ('app_private.operations_command_v2(text,uuid,uuid,text,text)'::regprocedure,
  'customer_api.operations_command_v2(text,uuid,uuid,text,text)'::regprocedure,
  'app_private.get_work_order_checklist_v2(uuid,uuid)'::regprocedure,'customer_api.get_work_order_checklist_v2(uuid,uuid)'::regprocedure) loop
  for g in select distinct role.rolname from pg_proc p
   cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a join pg_roles role on role.oid=a.grantee
   where p.oid=r.oid and a.grantee<>p.proowner loop
   execute format('revoke all privileges on function %s from %I',r.signature,g);
  end loop;
 end loop;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where not current_setting('cladora.chk2.proc_before')::jsonb@>to_jsonb(p.oid) and a.grantee<>p.proowner)
  or (select count(*) from pg_proc p where not current_setting('cladora.chk2.proc_before')::jsonb@>to_jsonb(p.oid))<>4
  or exists(select 1 from pg_proc p where not current_setting('cladora.chk2.proc_before')::jsonb@>to_jsonb(p.oid)
   and (p.proowner<>'postgres'::regrole or p.proconfig is distinct from array['search_path=pg_catalog'])) then
  raise exception 'operations_checklist_v2_created_set_acl_mismatch' using errcode='55000';end if;
 if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d) is distinct from current_setting('cladora.chk2.default_before')::jsonb
  or (select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m) is distinct from current_setting('cladora.chk2.roles_before')::jsonb
  or (select coalesce(jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')) is distinct from current_setting('cladora.chk2.managed_before')::jsonb then
  raise exception 'operations_checklist_v2_protected_catalog_changed' using errcode='55000';end if;
end $oc1$;
rollback;
