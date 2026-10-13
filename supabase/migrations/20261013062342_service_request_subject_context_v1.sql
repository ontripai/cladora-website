begin;
-- Metadata-only backfill: existing requests become version 1; no ledger/store.
alter table service_catalog.requests add column version bigint not null default 1;
alter table service_catalog.requests add constraint service_request_version_positive_safe
 check (version between 1 and 9007199254740991);

-- Internal compare-and-set boundary. It locks the row and binds the caller's
-- observed version to exactly one later mutation in this transaction.
create function app_private.lock_service_request_version_v1(
 p_workspace_id uuid,p_request_id uuid,p_expected_version bigint)
returns void language plpgsql volatile security invoker set search_path=pg_catalog
as $$declare v_version bigint;begin
 if p_workspace_id is null or p_request_id is null or p_expected_version is null
  or p_expected_version not between 1 and 9007199254740991 then
  raise exception 'invalid_request_mutation' using errcode='22023';
 end if;
 select r.version into v_version from service_catalog.requests r
  where r.id=p_request_id and r.workspace_id=p_workspace_id for update;
 if not found then raise exception 'request_context_unavailable' using errcode='42501';end if;
 if v_version<>p_expected_version then
  raise exception 'request_version_conflict' using errcode='40001';
 end if;
 perform pg_catalog.set_config('app_private.service_request_mutation_v1',
   p_workspace_id::text||':'||p_request_id::text||':'||p_expected_version::text,true);
end;$$;
revoke all on function app_private.lock_service_request_version_v1(uuid,uuid,bigint)
 from public,anon,authenticated,service_role;

create function app_private.guard_service_request_version_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$declare v_guard text;v_required text;begin
 if tg_op='DELETE' then
  raise exception 'request_identity_immutable' using errcode='42501';
 elsif tg_op='UPDATE' then
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
   or new.workspace_id is distinct from old.workspace_id then
   raise exception 'request_workspace_binding_denied' using errcode='42501';
  end if;
  if new is distinct from old then
   v_guard:=pg_catalog.current_setting('app_private.service_request_mutation_v1',true);
   v_required:=old.workspace_id::text||':'||old.id::text||':'||old.version::text;
   if v_guard is distinct from v_required or new.version is distinct from old.version+1 then
    raise exception 'request_version_conflict' using errcode='40001';
   end if;
   perform pg_catalog.set_config('app_private.service_request_mutation_v1','',true);
  end if;
 elsif new.version is distinct from 1::bigint then
  raise exception 'request_initial_version_required' using errcode='22023';
 end if;
 if not exists(select 1 from platform.customer_workspaces w
   where w.id=new.workspace_id and w.tenant_id=new.tenant_id) then
  raise exception 'request_workspace_binding_denied' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function app_private.guard_service_request_version_v1() from public,anon,authenticated,service_role;
create trigger service_request_version_guard before insert or update or delete on service_catalog.requests
 for each row execute function app_private.guard_service_request_version_v1();

-- Private, unwired canonical reference context. No customer_api wrapper/grant.
create function app_private.service_request_subject_context_v1(
 p_context_id uuid,p_workspace_id uuid,p_request_id uuid,p_expected_version bigint)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$declare v_scope record;v_request service_catalog.requests%rowtype;begin
 if p_context_id is null or p_workspace_id is null or p_request_id is null
  or p_expected_version is null or p_expected_version not between 1 and 9007199254740991 then
  raise exception 'invalid_request_context' using errcode='22023';
 end if;
 select * into strict v_scope from app_private.service_request_authorize_v1(
   p_context_id,p_workspace_id,'services.orders.read');
 select r.* into v_request from service_catalog.requests r
  where r.id=p_request_id and r.workspace_id=p_workspace_id and r.tenant_id=v_scope.tenant_id
    and r.requester_id=auth.uid() and r.membership_id=v_scope.membership_id for share;
 if not found then raise exception 'request_context_unavailable' using errcode='42501';end if;
 -- Repeat current canonical authority after waiting for the row lock.
 perform app_private.service_request_authorize_v1(p_context_id,p_workspace_id,'services.orders.read');
 if v_request.version<>p_expected_version then
  raise exception 'request_version_conflict' using errcode='40001';
 end if;
 perform 1 from identity.membership_parties mp join portfolio.parties p
   on p.id=mp.party_id and p.tenant_id=mp.tenant_id
  where mp.tenant_id=v_request.tenant_id and mp.membership_id=v_request.membership_id
   and mp.party_id=v_request.beneficiary_party_id and mp.valid_from<=clock_timestamp()
   and (mp.valid_until is null or mp.valid_until>clock_timestamp()) and p.archived_at is null
  for share of mp,p;
 if not found then raise exception 'request_context_unavailable' using errcode='42501';end if;
 return jsonb_build_object('request_id',v_request.id,'request_version',v_request.version,
   'workspace_id',v_request.workspace_id,'status',v_request.status,
   'actor_party_snapshot',jsonb_build_object('party_id',v_request.beneficiary_party_id,'current_actor_is_party',true),
   'audience_party_snapshot',jsonb_build_object('party_ids',jsonb_build_array(v_request.beneficiary_party_id),'request_party_only',true));
end;$$;
revoke all on function app_private.service_request_subject_context_v1(uuid,uuid,uuid,bigint)
 from public,anon,authenticated,service_role;
comment on function app_private.service_request_subject_context_v1(uuid,uuid,uuid,bigint)
 is 'service-request-subject-context.v1: locked exact Request/version and current own-party audience only; no private payload, subject lifecycle or runtime activation.';
commit;
