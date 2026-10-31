-- Separate FUTURE cutover proposal, never run as part of source/inactive install.
-- No binding, caller census or execution authorization is supplied by this file.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $cutover_hold$ begin
 raise exception 'checklist_cutover_requires_separate_execution_authorization_and_native_proof' using errcode='55000';
end $cutover_hold$;
-- Only after installed source/catalog pins, actual caller/receiver census,
-- technical-test scope and legacy UNKNOWN inventory are independently sealed:
-- First pause all direct C03/legacy entry points to nonowner callers. This is a
-- staged proposal, not an automatic change in response to a missing RPC.
revoke all privileges on function customer_api.operations_command_v1(text,uuid,uuid,text,text),
 app_private.operations_command_v1(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all privileges on function customer_api.work_order_checklist_v1(uuid,uuid,uuid,text),
 maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
do $legacy_closure$
declare r record;g text;
begin
 for r in select p.oid,p.oid::regprocedure as signature from pg_proc p where p.oid in
 ('customer_api.work_order_checklist_v1(uuid,uuid,uuid,text)'::regprocedure,'maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)'::regprocedure,
 'customer_api.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'app_private.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure) loop
  for g in select distinct role.rolname from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   join pg_roles role on role.oid=a.grantee where p.oid=r.oid and a.grantee<>p.proowner loop
   execute format('revoke all privileges on function %s from %I',r.signature,g);
  end loop;
 end loop;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid in
 ('customer_api.work_order_checklist_v1(uuid,uuid,uuid,text)'::regprocedure,'maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)'::regprocedure,
 'customer_api.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'app_private.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure) and a.grantee<>p.proowner) then
  raise exception 'checklist_legacy_writer_still_callable' using errcode='55000';end if;
end $legacy_closure$;
-- Future v1 compatibility facade uses the same v2 entry port; the private v1
-- transaction implementation is reused unchanged by its explicit v1 branch.
-- Wire/receipt/hash v1 remain identical. Unsupported v2 OPEN is a hold for v1.
create or replace function customer_api.operations_command_v1(p_phase text,p_context_id uuid,p_key uuid,p_wire text,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $compat_v1$
declare answer jsonb;
begin
 if p_phase is distinct from 'open' and (p_wire is null or (p_wire::jsonb)->>'version' is distinct from '1') then
  raise exception 'unsupported_operations_wire_version' using errcode='22023';end if;
 answer:=app_private.operations_command_v2(p_phase,p_context_id,p_key,p_wire,p_fingerprint);
 if answer->>'state'='clear' and answer->'command'='null'::jsonb then return jsonb_set(answer,'{version}','1'::jsonb);end if;
 if answer->>'version' is distinct from '1' then raise exception 'operations_pending_version_requires_supported_client' using errcode='55000';end if;
 return answer;
end $compat_v1$;
revoke all privileges on function customer_api.operations_command_v1(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
-- Owner nesting used by the accepted native C03 adapter survives. The existing
-- PRIVATE C03 v1/checkpoint/guard/native bodies are never replaced or rerun.
-- Future positive grants/build-time cutover are separately reviewed payloads.
rollback;
