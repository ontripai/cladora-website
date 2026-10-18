begin;

-- SERVICE-SUBJECT-LINK-ROLE-BOUND-POOL-01 (S3)
-- Inactive installation only. This creates no credential, route, deployment,
-- user assignment or production activation. STEP-SU-02 is intentionally not
-- executed by this migration.
-- The S2 package retains the fixed provider_current_state_required replay rule.
select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

create function app_private.acquire_service_subject_link_role_safety_mutation_lock_v1()
returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('core-platform-service-subject-link-role-bound-pool.v1',0));
  return true;
end;
$$;
revoke all on function app_private.acquire_service_subject_link_role_safety_mutation_lock_v1()
  from public,anon,authenticated,service_role;
-- PostgreSQL requires the target owner to hold CREATE on the containing
-- schema while ownership is transferred. Keep that capability transactional
-- and remove it immediately after the transfer.
grant create on schema app_private to cladora_rpc_owner;
alter function app_private.acquire_service_subject_link_role_safety_mutation_lock_v1()
  owner to cladora_rpc_owner;
revoke create on schema app_private from cladora_rpc_owner;
select app_private.acquire_service_subject_link_role_safety_mutation_lock_v1();

do $$
begin
  if exists(select 1 from pg_roles where rolname in (
    'cladora_service_subject_link_runtime',
    'cladora_service_subject_link_executor',
    'cladora_service_subject_link_owner'
  )) then
    raise exception 'service_subject_link_role_preexisting' using errcode='55000';
  end if;
end;
$$;

create role cladora_service_subject_link_runtime
  login noinherit nosuperuser nobypassrls nocreatedb nocreaterole
  noreplication password null;
create role cladora_service_subject_link_executor
  nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole
  noreplication password null;
create role cladora_service_subject_link_owner
  nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole
  noreplication password null;
-- PostgreSQL 17 gives a non-superuser CREATEROLE creator ADMIN but not SET
-- by default. S3 needs SET only to transfer the fixed package objects. The
-- separately authorized STEP-SU-02 finalizer removes this temporary edge.
do $$
begin
  execute format(
    'grant cladora_service_subject_link_owner to %I with admin false, inherit false, set true',
    current_user
  );
end;
$$;
grant cladora_service_subject_link_executor
  to cladora_service_subject_link_runtime
  with admin false, inherit false, set true;

comment on role cladora_service_subject_link_runtime is
  'External-secret LOGIN for the inactive fixed SERVICE subject-link pool; owns no product object.';
comment on role cladora_service_subject_link_executor is
  'Fixed NOLOGIN least-privilege executor for the inactive SERVICE subject-link Core transaction.';
comment on role cladora_service_subject_link_owner is
  'Fixed NOLOGIN function-only owner for the SERVICE subject-link S1/S2 SQL package.';

-- Durable catalog evidence for the separately authorized STEP-SU-02. The
-- initial S3 role edge is deliberately not sufficient to populate this row.
create table app_private.service_subject_link_step_su_02_receipt_v1 (
  receipt_key text primary key
    check(receipt_key='STEP-SU-02'),
  finalized_by name not null
    check(finalized_by='supabase_admin'),
  finalized_at timestamptz not null,
  role_graph_fingerprint text not null
    check(role_graph_fingerprint=
      'executor>runtime|admin=false|inherit=false|set=true')
);
-- Ownership is transferred to supabase_admin by the separately authorized
-- STEP-SU-02 operation. The migration runner cannot SET ROLE supabase_admin.
revoke all on table app_private.service_subject_link_step_su_02_receipt_v1
  from public,anon,authenticated,service_role,
    cladora_service_subject_link_runtime,
    cladora_service_subject_link_executor,
    cladora_service_subject_link_owner;

-- Transfer only the three S1/S2 package entrypoints. The temporary CREATE
-- privilege is removed in this transaction and the owner receives no table,
-- sequence, schema or database ownership.
grant create on schema communications,app_private
  to cladora_service_subject_link_owner;
alter function communications.resolve_private_message_currentness_v2(
  uuid,uuid,uuid,uuid,bigint) owner to cladora_service_subject_link_owner;
alter function communications.resolve_private_message_request_audience_current_v2(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint) owner to cladora_service_subject_link_owner;
alter function app_private.execute_service_request_message_link_v2(
  text,uuid,uuid,uuid,uuid,bigint,uuid,bigint)
  owner to cladora_service_subject_link_owner;
revoke create on schema communications,app_private
  from cladora_service_subject_link_owner;

-- Package-owner dependencies. V1 functions and auth.jwt() are never exposed
-- to the executor; they remain nested implementation details of the fixed
-- SECURITY DEFINER package.
revoke execute on function auth.jwt() from public,
  cladora_service_subject_link_runtime,cladora_service_subject_link_executor;
grant execute on function auth.jwt() to anon,authenticated,service_role,
  cladora_ce_guide_executor,cladora_service_subject_link_owner;
grant usage on schema auth,app_private,communications,platform,identity,
  service_catalog,portfolio,maintenance to cladora_service_subject_link_owner;
grant execute on function
  auth.uid(),
  auth.jwt(),
  communications.context_membership(uuid),
  communications.resolve_private_message_request_audience_v1(
    uuid,uuid,uuid,uuid,bigint,uuid,bigint),
  app_private.check_workspace_native_permission_v2(uuid,uuid,text,text),
  app_private.lock_service_request_version_v1(uuid,uuid,bigint)
  to cladora_service_subject_link_owner;

grant select on communications.private_conversations,
  communications.private_messages,
  communications.private_participants to cladora_service_subject_link_owner;
grant update(id) on communications.private_conversations,
  communications.private_messages to cladora_service_subject_link_owner;
grant update(conversation_id) on communications.private_participants
  to cladora_service_subject_link_owner;
grant select on identity.membership_parties,
  service_catalog.offerings,
  portfolio.parties,
  portfolio.units,
  portfolio.buildings,
  maintenance.vendor_portal_memberships,
  maintenance.vendors,
  platform.workspace_property_bindings
  to cladora_service_subject_link_owner;
grant update(membership_id) on identity.membership_parties
  to cladora_service_subject_link_owner;
grant update(id) on service_catalog.offerings,
  portfolio.parties,
  portfolio.units,
  portfolio.buildings,
  maintenance.vendor_portal_memberships,
  maintenance.vendors,
  platform.workspace_property_bindings
  to cladora_service_subject_link_owner;
grant select(id,tenant_id,archived_at,lifecycle_status)
  on platform.customer_workspaces to cladora_service_subject_link_owner;
grant select(customer_workspace_id,entitlement_key,valid_from,valid_until,
  override_value_json,override_expires_at,boolean_value)
  on platform.workspace_entitlements to cladora_service_subject_link_owner;
grant select on service_catalog.requests to cladora_service_subject_link_owner;
grant update(version) on service_catalog.requests to cladora_service_subject_link_owner;
grant select on service_catalog.request_subject_links
  to cladora_service_subject_link_owner;
-- PostgreSQL requires an UPDATE privilege for SELECT ... FOR SHARE row locks;
-- the lock-only policy below prevents an actual row update.
grant update(id) on service_catalog.request_subject_links
  to cladora_service_subject_link_owner;
grant insert(id,tenant_id,workspace_id,request_id,request_version,message_id,
    message_version,relation,created_by)
  on service_catalog.request_subject_links to cladora_service_subject_link_owner;

-- S3 relies on RLS as part of the capability boundary; keep it explicitly
-- enabled even if an earlier package was installed with different defaults.
alter table communications.private_conversations enable row level security;
alter table communications.private_messages enable row level security;
alter table communications.private_participants enable row level security;
alter table identity.membership_parties enable row level security;
alter table service_catalog.offerings enable row level security;
alter table portfolio.parties enable row level security;
alter table portfolio.units enable row level security;
alter table portfolio.buildings enable row level security;
alter table maintenance.vendor_portal_memberships enable row level security;
alter table maintenance.vendors enable row level security;
alter table platform.workspace_property_bindings enable row level security;
alter table platform.customer_workspaces enable row level security;
alter table platform.workspace_entitlements enable row level security;
alter table service_catalog.requests enable row level security;
alter table service_catalog.request_subject_links enable row level security;
alter table identity.context_grants enable row level security;
alter table identity.memberships enable row level security;
alter table platform.module_definitions enable row level security;
alter table app_private.canonical_authority_revision_v1 enable row level security;
alter table platform.idempotency_keys enable row level security;
alter table audit.events enable row level security;
alter table platform.outbox_events enable row level security;

create policy service_subject_link_owner_conversations_read_v1
  on communications.private_conversations for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_messages_read_v1
  on communications.private_messages for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_participants_read_v1
  on communications.private_participants for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_conversations_lock_v1
  on communications.private_conversations for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_messages_lock_v1
  on communications.private_messages for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_participants_lock_v1
  on communications.private_participants for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_membership_parties_read_v1
  on identity.membership_parties for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_membership_parties_lock_v1
  on identity.membership_parties for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_offerings_read_v1
  on service_catalog.offerings for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_offerings_lock_v1
  on service_catalog.offerings for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_parties_read_v1
  on portfolio.parties for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_parties_lock_v1
  on portfolio.parties for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_units_read_v1
  on portfolio.units for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_units_lock_v1
  on portfolio.units for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_buildings_read_v1
  on portfolio.buildings for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_buildings_lock_v1
  on portfolio.buildings for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_vendor_memberships_read_v1
  on maintenance.vendor_portal_memberships for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_vendor_memberships_lock_v1
  on maintenance.vendor_portal_memberships for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_vendors_read_v1
  on maintenance.vendors for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_vendors_lock_v1
  on maintenance.vendors for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_workspace_bindings_read_v1
  on platform.workspace_property_bindings for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_workspace_bindings_lock_v1
  on platform.workspace_property_bindings for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_workspaces_read_v1
  on platform.customer_workspaces for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_entitlements_read_v1
  on platform.workspace_entitlements for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_requests_read_v1
  on service_catalog.requests for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_requests_update_v1
  on service_catalog.requests for update
  to cladora_service_subject_link_owner using(true) with check(true);
create policy service_subject_link_owner_links_read_v1
  on service_catalog.request_subject_links for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_links_lock_v1
  on service_catalog.request_subject_links for update
  to cladora_service_subject_link_owner using(true) with check(false);
create policy service_subject_link_owner_links_insert_v1
  on service_catalog.request_subject_links for insert
  to cladora_service_subject_link_owner with check(true);

-- Required only so the migration owner may transfer the following fixed
-- helper routines; revoked again before commit.
grant create on schema app_private to cladora_service_subject_link_owner;

-- Fixed Core ledger/authority scope. The six request GUCs are transaction
-- local and the SQL identities are both pinned before any row is exposed.
create function app_private.core_platform_service_subject_link_binding_allowed_v1(
  p_tenant_id uuid,p_workspace_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_context_id uuid;
  v_workspace_id uuid;
  v_actor_id uuid;
  v_claims jsonb;
begin
  if current_user<>'cladora_service_subject_link_owner'
      or session_user<>'cladora_service_subject_link_runtime' then
    return false;
  end if;
  v_context_id:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  v_claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  if v_context_id is null or v_workspace_id is null or v_actor_id is null
      or v_workspace_id<>p_workspace_id
      or nullif(current_setting('request.jwt.claim.aal',true),'')<>'aal2'
      or nullif(current_setting('request.jwt.claim.role',true),'')<>'authenticated'
      or v_claims->>'sub' is distinct from v_actor_id::text
      or v_claims->>'aal' is distinct from 'aal2'
      or v_claims->>'role' is distinct from 'authenticated' then
    return false;
  end if;
  return exists(select 1 from platform.customer_workspaces w
    where w.id=p_workspace_id and w.tenant_id=p_tenant_id
      and w.archived_at is null and w.lifecycle_status='ACTIVE')
    and exists(select 1 from platform.module_definitions d
      where d.code='services_orders' and d.is_active
        and d.lifecycle_status in ('active','published')
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp()));
exception when others then return false;
end;
$$;

create function app_private.core_platform_service_subject_link_authority_allowed_v1()
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace_id uuid;
begin
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  if v_workspace_id is null then return false; end if;
  return exists(select 1 from platform.customer_workspaces w
    where w.id=v_workspace_id
      and app_private.core_platform_service_subject_link_binding_allowed_v1(w.tenant_id,w.id));
exception when others then return false;
end;
$$;

create function app_private.core_platform_service_subject_link_scope_allowed_v1(
  p_tenant_id uuid,p_workspace_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_context_id uuid;
  v_workspace_id uuid;
  v_actor_id uuid;
  v_claims jsonb;
begin
  if current_user<>'cladora_service_subject_link_owner'
      or session_user<>'cladora_service_subject_link_runtime' then
    return false;
  end if;
  v_context_id:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  v_claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  if v_context_id is null or v_workspace_id is null or v_actor_id is null
      or v_workspace_id<>p_workspace_id
      or nullif(current_setting('request.jwt.claim.aal',true),'')<>'aal2'
      or nullif(current_setting('request.jwt.claim.role',true),'')<>'authenticated'
      or v_claims->>'sub' is distinct from v_actor_id::text
      or v_claims->>'aal' is distinct from 'aal2'
      or v_claims->>'role' is distinct from 'authenticated' then
    return false;
  end if;
  return app_private.core_platform_service_subject_link_binding_allowed_v1(
      p_tenant_id,p_workspace_id)
    and app_private.check_workspace_native_permission_v2(
      v_context_id,p_workspace_id,'services.orders.subject_link','services_orders') is true;
exception when others then return false;
end;
$$;

grant select(id,tenant_id,membership_id,starts_at,ends_at)
  on identity.context_grants to cladora_service_subject_link_owner;
grant select(id,tenant_id,user_id,status,starts_at,ends_at)
  on identity.memberships to cladora_service_subject_link_owner;
grant update(id) on identity.memberships to cladora_service_subject_link_owner;
create policy service_subject_link_owner_memberships_lock_v1
  on identity.memberships for update
  to cladora_service_subject_link_owner using(true) with check(false);
grant select(id,code,entitlement_key,is_active,lifecycle_status,valid_from,valid_to)
  on platform.module_definitions to cladora_service_subject_link_owner;
create policy service_subject_link_owner_contexts_read_v1
  on identity.context_grants for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_memberships_read_v1
  on identity.memberships for select
  to cladora_service_subject_link_owner using(true);
create policy service_subject_link_owner_modules_read_v1
  on platform.module_definitions for select
  to cladora_service_subject_link_owner using(true);

create function app_private.core_platform_service_subject_link_identity_allowed_v1(
  p_kind text,p_id uuid,p_tenant_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_context_id uuid; v_workspace_id uuid; v_actor_id uuid;
begin
  v_context_id:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  if not app_private.core_platform_service_subject_link_scope_allowed_v1(
    p_tenant_id,v_workspace_id) then return false; end if;
  if p_kind='context' then
    return p_id=v_context_id and exists(select 1 from identity.context_grants g
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=p_id and g.tenant_id=p_tenant_id and m.user_id=v_actor_id);
  elsif p_kind='membership' then
    return exists(select 1 from identity.context_grants g
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=v_context_id and m.id=p_id and m.tenant_id=p_tenant_id
        and m.user_id=v_actor_id);
  end if;
  return false;
exception when others then return false;
end;
$$;

create function app_private.core_platform_service_subject_link_ledger_allowed_v1(
  p_tenant_id uuid,p_actor_id uuid,p_key text default null,p_aggregate_id uuid default null
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace_id uuid; v_actor_id uuid;
begin
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  if p_actor_id is distinct from v_actor_id
      or not app_private.core_platform_service_subject_link_scope_allowed_v1(
        p_tenant_id,v_workspace_id) then return false; end if;
  if p_key is not null and p_key not like 'core-tx.v1:'||v_workspace_id::text||':%' then
    return false;
  end if;
  if p_aggregate_id is not null and not exists(
    select 1 from service_catalog.requests r
    where r.id=p_aggregate_id and r.tenant_id=p_tenant_id
      and r.workspace_id=v_workspace_id and r.requester_id=v_actor_id
  ) then return false; end if;
  return true;
exception when others then return false;
end;
$$;

alter function app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid)
  owner to cladora_service_subject_link_owner;
alter function app_private.core_platform_service_subject_link_binding_allowed_v1(uuid,uuid)
  owner to cladora_service_subject_link_owner;
alter function app_private.core_platform_service_subject_link_authority_allowed_v1()
  owner to cladora_service_subject_link_owner;
alter function app_private.core_platform_service_subject_link_identity_allowed_v1(text,uuid,uuid)
  owner to cladora_service_subject_link_owner;
alter function app_private.core_platform_service_subject_link_ledger_allowed_v1(uuid,uuid,text,uuid)
  owner to cladora_service_subject_link_owner;
revoke all on function
  app_private.core_platform_service_subject_link_binding_allowed_v1(uuid,uuid),
  app_private.core_platform_service_subject_link_authority_allowed_v1(),
  app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid),
  app_private.core_platform_service_subject_link_identity_allowed_v1(text,uuid,uuid),
  app_private.core_platform_service_subject_link_ledger_allowed_v1(uuid,uuid,text,uuid)
  from public,anon,authenticated,service_role,
    cladora_service_subject_link_runtime,cladora_service_subject_link_executor;

-- Executor ACL is capability-scoped. It cannot call auth.jwt(), any legacy V1
-- entrypoint, or either S1 resolver directly.
grant usage on schema auth,app_private,identity,platform,audit
  to cladora_service_subject_link_executor;
revoke create on schema auth,app_private,identity,platform,audit
  from cladora_service_subject_link_executor,cladora_service_subject_link_runtime;
grant execute on function
  auth.uid(),
  app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)
  to cladora_service_subject_link_executor;
-- These package functions now belong to the fixed NOLOGIN owner. Use the
-- migration-only SET edge created above to install their executor ACLs.
set role cladora_service_subject_link_owner;
grant execute on function
  app_private.execute_service_request_message_link_v2(
    text,uuid,uuid,uuid,uuid,bigint,uuid,bigint),
  app_private.core_platform_service_subject_link_binding_allowed_v1(uuid,uuid),
  app_private.core_platform_service_subject_link_authority_allowed_v1(),
  app_private.core_platform_service_subject_link_scope_allowed_v1(uuid,uuid),
  app_private.core_platform_service_subject_link_identity_allowed_v1(text,uuid,uuid),
  app_private.core_platform_service_subject_link_ledger_allowed_v1(uuid,uuid,text,uuid)
  to cladora_service_subject_link_executor;
reset role;

grant select(id,tenant_id,archived_at,lifecycle_status),update(id)
  on platform.customer_workspaces to cladora_service_subject_link_executor;
grant select(singleton,revision),update(singleton)
  on app_private.canonical_authority_revision_v1 to cladora_service_subject_link_executor;
grant select(id,tenant_id,membership_id,starts_at,ends_at)
  on identity.context_grants to cladora_service_subject_link_executor;
grant select(id,tenant_id,user_id,status,starts_at,ends_at)
  on identity.memberships to cladora_service_subject_link_executor;
grant select(id,code,entitlement_key,is_active,lifecycle_status,valid_from,valid_to)
  on platform.module_definitions to cladora_service_subject_link_executor;
grant select(tenant_id,actor_id,key,request_hash,response_ref,expires_at),
  insert(tenant_id,actor_id,key,request_hash,expires_at),
  update(response_ref,status_code)
  on platform.idempotency_keys to cladora_service_subject_link_executor;
grant select(id),insert(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot)
  on audit.events to cladora_service_subject_link_executor;
grant usage,select on sequence audit.events_id_seq to cladora_service_subject_link_executor;
grant select(id),insert(tenant_id,aggregate_type,aggregate_id,aggregate_version,
  event_type,payload,trace_id)
  on platform.outbox_events to cladora_service_subject_link_executor;

create policy core_platform_service_subject_link_workspaces_read_v1
  on platform.customer_workspaces for select
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_scope_allowed_v1(tenant_id,id));
create policy core_platform_service_subject_link_workspaces_lock_v1
  on platform.customer_workspaces for update
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_scope_allowed_v1(tenant_id,id))
  with check(false);
create policy core_platform_service_subject_link_revision_read_v1
  on app_private.canonical_authority_revision_v1 for select
  to cladora_service_subject_link_executor using(singleton
    and app_private.core_platform_service_subject_link_authority_allowed_v1());
create policy core_platform_service_subject_link_revision_lock_v1
  on app_private.canonical_authority_revision_v1 for update
  to cladora_service_subject_link_executor using(singleton
    and app_private.core_platform_service_subject_link_authority_allowed_v1())
  with check(false);
create policy core_platform_service_subject_link_context_read_v1
  on identity.context_grants for select
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_identity_allowed_v1('context',id,tenant_id));
create policy core_platform_service_subject_link_membership_read_v1
  on identity.memberships for select
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_identity_allowed_v1('membership',id,tenant_id));
create policy core_platform_service_subject_link_module_read_v1
  on platform.module_definitions for select
  to cladora_service_subject_link_executor using(
    code='services_orders'
      and is_active
      and lifecycle_status in ('active','published')
      and valid_from<=statement_timestamp()
      and (valid_to is null or valid_to>statement_timestamp())
      and exists(select 1 from platform.customer_workspaces w
      where app_private.core_platform_service_subject_link_scope_allowed_v1(w.tenant_id,w.id)));
create policy core_platform_service_subject_link_idempotency_read_v1
  on platform.idempotency_keys for select
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,key,null));
create policy core_platform_service_subject_link_idempotency_insert_v1
  on platform.idempotency_keys for insert
  to cladora_service_subject_link_executor with check(
    app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,key,null));
create policy core_platform_service_subject_link_idempotency_update_v1
  on platform.idempotency_keys for update
  to cladora_service_subject_link_executor using(
    app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,key,null)) with check(
    app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,key,null));
create policy core_platform_service_subject_link_audit_insert_v1
  on audit.events for insert to cladora_service_subject_link_executor with check(
    action='core.service.request.subject_link' and entity_type='service_request'
    and entity_id is not null and request_id is not null
    and app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,null,entity_id));
create policy core_platform_service_subject_link_audit_read_v1
  on audit.events for select to cladora_service_subject_link_executor using(
    action='core.service.request.subject_link' and entity_type='service_request'
    and entity_id is not null
    and app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,actor_id,null,entity_id));
create policy core_platform_service_subject_link_outbox_insert_v1
  on platform.outbox_events for insert to cladora_service_subject_link_executor with check(
    aggregate_type='service_request'
    and event_type='core.service.request.subject_link.v1'
    and app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid,
      null,aggregate_id));
create policy core_platform_service_subject_link_outbox_read_v1
  on platform.outbox_events for select to cladora_service_subject_link_executor using(
    aggregate_type='service_request'
    and event_type='core.service.request.subject_link.v1'
    and app_private.core_platform_service_subject_link_ledger_allowed_v1(
      tenant_id,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid,
      null,aggregate_id));

create function app_private.core_platform_service_subject_link_role_safety_valid_v1()
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
with protected_roles as (
  select oid,rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,
    rolcreaterole,rolreplication from pg_roles where rolname in (
      'cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor',
      'cladora_service_subject_link_owner')
), role_ids as (
  select max(oid) filter(where rolname='cladora_service_subject_link_runtime') runtime_oid,
    max(oid) filter(where rolname='cladora_service_subject_link_executor') executor_oid,
    max(oid) filter(where rolname='cladora_service_subject_link_owner') owner_oid
  from protected_roles
), package_functions(schema_name,function_name,arg_types) as (values
  ('communications'::text,'resolve_private_message_currentness_v2'::text,
    array['uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[]),
  ('communications'::text,'resolve_private_message_request_audience_current_v2'::text,
    array['uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'bigint'::regtype,
      'uuid'::regtype,'bigint'::regtype]::oid[]),
  ('app_private'::text,'execute_service_request_message_link_v2'::text,
    array['text'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,
      'bigint'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[])
), inventory as (
  select p.oid,p.prosecdef,p.proconfig,r.rolname owner_name
  from package_functions f
  left join pg_namespace n on n.nspname=f.schema_name
  left join pg_proc p on p.pronamespace=n.oid and p.proname=f.function_name
    and p.proargtypes::text=array_to_string(f.arg_types,' ')
  left join pg_roles r on r.oid=p.proowner
), expected_owned_functions(schema_name,function_name,arg_types,security_definer,volatility) as (values
  ('communications'::text,'resolve_private_message_currentness_v2'::text,
    array['uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[],true,'s'::"char"),
  ('communications','resolve_private_message_request_audience_current_v2',
    array['uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'bigint'::regtype,
      'uuid'::regtype,'bigint'::regtype]::oid[],true,'v'::"char"),
  ('app_private','execute_service_request_message_link_v2',
    array['text'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,
      'bigint'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[],true,'v'::"char"),
  ('app_private','core_platform_service_subject_link_scope_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype]::oid[],true,'s'::"char"),
  ('app_private','core_platform_service_subject_link_binding_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype]::oid[],true,'s'::"char"),
  ('app_private','core_platform_service_subject_link_authority_allowed_v1',
    array[]::oid[],true,'s'::"char"),
  ('app_private','core_platform_service_subject_link_identity_allowed_v1',
    array['text'::regtype,'uuid'::regtype,'uuid'::regtype]::oid[],true,'s'::"char"),
  ('app_private','core_platform_service_subject_link_ledger_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype,'text'::regtype,'uuid'::regtype]::oid[],true,'s'::"char"),
  ('app_private','core_platform_service_subject_link_role_safety_valid_v1',array[]::oid[],false,'s'::"char"),
  ('app_private','assert_service_subject_link_role_safety_v1',array[]::oid[],false,'s'::"char"),
  ('app_private','acquire_service_subject_link_role_safety_lease_v1',array[]::oid[],false,'v'::"char"),
  ('app_private','finalize_service_subject_link_role_membership_v1',array[]::oid[],false,'v'::"char")
), expected_owned_function_oids(oid,security_definer,volatility) as (
  select p.oid,f.security_definer,f.volatility from expected_owned_functions f
  join pg_namespace n on n.nspname=f.schema_name
  join pg_proc p on p.pronamespace=n.oid and p.proname=f.function_name
    and p.proargtypes::text=array_to_string(f.arg_types,' ')
), expected_executor_functions(schema_name,function_name,arg_types) as (values
  ('auth'::text,'uid'::text,array[]::oid[]),
  ('app_private','check_workspace_native_permission_v2',
    array['uuid'::regtype,'uuid'::regtype,'text'::regtype,'text'::regtype]::oid[]),
  ('app_private','execute_service_request_message_link_v2',
    array['text'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,
      'bigint'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[]),
  ('app_private','core_platform_service_subject_link_binding_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype]::oid[]),
  ('app_private','core_platform_service_subject_link_authority_allowed_v1',array[]::oid[]),
  ('app_private','core_platform_service_subject_link_scope_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype]::oid[]),
  ('app_private','core_platform_service_subject_link_identity_allowed_v1',
    array['text'::regtype,'uuid'::regtype,'uuid'::regtype]::oid[]),
  ('app_private','core_platform_service_subject_link_ledger_allowed_v1',
    array['uuid'::regtype,'uuid'::regtype,'text'::regtype,'uuid'::regtype]::oid[]),
  ('app_private','core_platform_service_subject_link_role_safety_valid_v1',array[]::oid[]),
  ('app_private','assert_service_subject_link_role_safety_v1',array[]::oid[]),
  ('app_private','acquire_service_subject_link_role_safety_lease_v1',array[]::oid[])
), expected_executor_function_oids(oid) as (
  select p.oid from expected_executor_functions f
  join pg_namespace n on n.nspname=f.schema_name
  join pg_proc p on p.pronamespace=n.oid and p.proname=f.function_name
    and p.proargtypes::text=array_to_string(f.arg_types,' ')
), executor_function_acl as (
  select p.oid
  from pg_proc p cross join role_ids i
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
  where privilege.grantee=i.executor_oid and privilege.privilege_type='EXECUTE'
), expected_schema_acl(schema_name) as (values
  ('auth'::text),('app_private'),('identity'),('platform'),('audit')
), executor_schema_acl as (
  select n.nspname schema_name,privilege.privilege_type
  from pg_namespace n cross join role_ids i
  cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) privilege
  where privilege.grantee=i.executor_oid
), expected_relation_acl(schema_name,relation_name,privilege_type) as (values
  ('audit'::text,'events_id_seq'::text,'SELECT'::text),
  ('audit','events_id_seq','USAGE')
), executor_relation_acl as (
  select n.nspname schema_name,c.relname relation_name,privilege.privilege_type
  from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join role_ids i
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) privilege
  where privilege.grantee=i.executor_oid
), expected_column_acl(schema_name,relation_name,column_name,privilege_type) as (values
  ('platform'::text,'customer_workspaces'::text,'id'::text,'SELECT'::text),
  ('platform','customer_workspaces','tenant_id','SELECT'),
  ('platform','customer_workspaces','archived_at','SELECT'),
  ('platform','customer_workspaces','lifecycle_status','SELECT'),
  ('platform','customer_workspaces','id','UPDATE'),
  ('app_private','canonical_authority_revision_v1','singleton','SELECT'),
  ('app_private','canonical_authority_revision_v1','revision','SELECT'),
  ('app_private','canonical_authority_revision_v1','singleton','UPDATE'),
  ('identity','context_grants','id','SELECT'),
  ('identity','context_grants','tenant_id','SELECT'),
  ('identity','context_grants','membership_id','SELECT'),
  ('identity','context_grants','starts_at','SELECT'),
  ('identity','context_grants','ends_at','SELECT'),
  ('identity','memberships','id','SELECT'),
  ('identity','memberships','tenant_id','SELECT'),
  ('identity','memberships','user_id','SELECT'),
  ('identity','memberships','status','SELECT'),
  ('identity','memberships','starts_at','SELECT'),
  ('identity','memberships','ends_at','SELECT'),
  ('platform','module_definitions','id','SELECT'),
  ('platform','module_definitions','code','SELECT'),
  ('platform','module_definitions','entitlement_key','SELECT'),
  ('platform','module_definitions','is_active','SELECT'),
  ('platform','module_definitions','lifecycle_status','SELECT'),
  ('platform','module_definitions','valid_from','SELECT'),
  ('platform','module_definitions','valid_to','SELECT'),
  ('platform','idempotency_keys','tenant_id','SELECT'),
  ('platform','idempotency_keys','actor_id','SELECT'),
  ('platform','idempotency_keys','key','SELECT'),
  ('platform','idempotency_keys','request_hash','SELECT'),
  ('platform','idempotency_keys','response_ref','SELECT'),
  ('platform','idempotency_keys','expires_at','SELECT'),
  ('platform','idempotency_keys','tenant_id','INSERT'),
  ('platform','idempotency_keys','actor_id','INSERT'),
  ('platform','idempotency_keys','key','INSERT'),
  ('platform','idempotency_keys','request_hash','INSERT'),
  ('platform','idempotency_keys','expires_at','INSERT'),
  ('platform','idempotency_keys','response_ref','UPDATE'),
  ('platform','idempotency_keys','status_code','UPDATE'),
  ('audit','events','id','SELECT'),
  ('audit','events','tenant_id','INSERT'),
  ('audit','events','actor_id','INSERT'),
  ('audit','events','action','INSERT'),
  ('audit','events','entity_type','INSERT'),
  ('audit','events','entity_id','INSERT'),
  ('audit','events','request_id','INSERT'),
  ('audit','events','after_snapshot','INSERT'),
  ('platform','outbox_events','id','SELECT'),
  ('platform','outbox_events','tenant_id','INSERT'),
  ('platform','outbox_events','aggregate_type','INSERT'),
  ('platform','outbox_events','aggregate_id','INSERT'),
  ('platform','outbox_events','aggregate_version','INSERT'),
  ('platform','outbox_events','event_type','INSERT'),
  ('platform','outbox_events','payload','INSERT'),
  ('platform','outbox_events','trace_id','INSERT')
), executor_column_acl as (
  select n.nspname schema_name,c.relname relation_name,a.attname column_name,
    privilege.privilege_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace cross join role_ids i
  cross join lateral aclexplode(a.attacl) privilege
  where a.attnum>0 and not a.attisdropped and privilege.grantee=i.executor_oid
), expected_owner_functions(schema_name,function_name,arg_types) as (values
  ('auth'::text,'uid'::text,array[]::oid[]),
  ('auth','jwt',array[]::oid[]),
  ('communications','context_membership',array['uuid'::regtype]::oid[]),
  ('communications','resolve_private_message_request_audience_v1',
    array['uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'uuid'::regtype,'bigint'::regtype,
      'uuid'::regtype,'bigint'::regtype]::oid[]),
  ('app_private','check_workspace_native_permission_v2',
    array['uuid'::regtype,'uuid'::regtype,'text'::regtype,'text'::regtype]::oid[]),
  ('app_private','lock_service_request_version_v1',
    array['uuid'::regtype,'uuid'::regtype,'bigint'::regtype]::oid[])
), expected_owner_function_oids(oid) as (
  select p.oid from expected_owner_functions f
  join pg_namespace n on n.nspname=f.schema_name
  join pg_proc p on p.pronamespace=n.oid and p.proname=f.function_name
    and p.proargtypes::text=array_to_string(f.arg_types,' ')
), owner_function_acl as (
  select p.oid
  from pg_proc p cross join role_ids i
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
  where p.proowner<>i.owner_oid and privilege.grantee=i.owner_oid
    and privilege.privilege_type='EXECUTE'
), expected_owner_schema_acl(schema_name) as (values
  ('auth'::text),('app_private'),('communications'),('platform'),('identity'),
  ('service_catalog'),('portfolio'),('maintenance')
), owner_schema_acl as (
  select n.nspname schema_name,privilege.privilege_type
  from pg_namespace n cross join role_ids i
  cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) privilege
  where privilege.grantee=i.owner_oid
), expected_owner_relation_acl(schema_name,relation_name,privilege_type) as (values
  ('communications'::text,'private_conversations'::text,'SELECT'::text),
  ('communications','private_messages','SELECT'),
  ('communications','private_participants','SELECT'),
  ('identity','membership_parties','SELECT'),
  ('service_catalog','offerings','SELECT'),
  ('portfolio','parties','SELECT'),
  ('portfolio','units','SELECT'),
  ('portfolio','buildings','SELECT'),
  ('maintenance','vendor_portal_memberships','SELECT'),
  ('maintenance','vendors','SELECT'),
  ('platform','workspace_property_bindings','SELECT'),
  ('service_catalog','requests','SELECT'),
  ('service_catalog','request_subject_links','SELECT')
), owner_relation_acl as (
  select n.nspname schema_name,c.relname relation_name,privilege.privilege_type
  from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join role_ids i
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) privilege
  where privilege.grantee=i.owner_oid
), expected_owner_column_acl(schema_name,relation_name,column_name,privilege_type) as (values
  ('platform'::text,'customer_workspaces'::text,'id'::text,'SELECT'::text),
  ('platform','customer_workspaces','tenant_id','SELECT'),
  ('platform','customer_workspaces','archived_at','SELECT'),
  ('platform','customer_workspaces','lifecycle_status','SELECT'),
  ('platform','workspace_entitlements','customer_workspace_id','SELECT'),
  ('platform','workspace_entitlements','entitlement_key','SELECT'),
  ('platform','workspace_entitlements','valid_from','SELECT'),
  ('platform','workspace_entitlements','valid_until','SELECT'),
  ('platform','workspace_entitlements','override_value_json','SELECT'),
  ('platform','workspace_entitlements','override_expires_at','SELECT'),
  ('platform','workspace_entitlements','boolean_value','SELECT'),
  ('communications','private_conversations','id','UPDATE'),
  ('communications','private_messages','id','UPDATE'),
  ('communications','private_participants','conversation_id','UPDATE'),
  ('identity','memberships','id','UPDATE'),
  ('identity','membership_parties','membership_id','UPDATE'),
  ('service_catalog','offerings','id','UPDATE'),
  ('portfolio','parties','id','UPDATE'),
  ('portfolio','units','id','UPDATE'),
  ('portfolio','buildings','id','UPDATE'),
  ('maintenance','vendor_portal_memberships','id','UPDATE'),
  ('maintenance','vendors','id','UPDATE'),
  ('platform','workspace_property_bindings','id','UPDATE'),
  ('service_catalog','requests','version','UPDATE'),
  ('service_catalog','request_subject_links','id','UPDATE'),
  ('service_catalog','request_subject_links','id','INSERT'),
  ('service_catalog','request_subject_links','tenant_id','INSERT'),
  ('service_catalog','request_subject_links','workspace_id','INSERT'),
  ('service_catalog','request_subject_links','request_id','INSERT'),
  ('service_catalog','request_subject_links','request_version','INSERT'),
  ('service_catalog','request_subject_links','message_id','INSERT'),
  ('service_catalog','request_subject_links','message_version','INSERT'),
  ('service_catalog','request_subject_links','relation','INSERT'),
  ('service_catalog','request_subject_links','created_by','INSERT'),
  ('identity','context_grants','id','SELECT'),
  ('identity','context_grants','tenant_id','SELECT'),
  ('identity','context_grants','membership_id','SELECT'),
  ('identity','context_grants','starts_at','SELECT'),
  ('identity','context_grants','ends_at','SELECT'),
  ('identity','memberships','id','SELECT'),
  ('identity','memberships','tenant_id','SELECT'),
  ('identity','memberships','user_id','SELECT'),
  ('identity','memberships','status','SELECT'),
  ('identity','memberships','starts_at','SELECT'),
  ('identity','memberships','ends_at','SELECT'),
  ('platform','module_definitions','id','SELECT'),
  ('platform','module_definitions','code','SELECT'),
  ('platform','module_definitions','entitlement_key','SELECT'),
  ('platform','module_definitions','is_active','SELECT'),
  ('platform','module_definitions','lifecycle_status','SELECT'),
  ('platform','module_definitions','valid_from','SELECT'),
  ('platform','module_definitions','valid_to','SELECT')
), owner_column_acl as (
  select n.nspname schema_name,c.relname relation_name,a.attname column_name,
    privilege.privilege_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace cross join role_ids i
  cross join lateral aclexplode(a.attacl) privilege
  where a.attnum>0 and not a.attisdropped and privilege.grantee=i.owner_oid
), protected_relations(schema_name,relation_name) as (values
  ('communications'::text,'private_conversations'::text),
  ('communications','private_messages'),
  ('communications','private_participants'),
  ('identity','membership_parties'),
  ('service_catalog','offerings'),
  ('portfolio','parties'),
  ('portfolio','units'),
  ('portfolio','buildings'),
  ('maintenance','vendor_portal_memberships'),
  ('maintenance','vendors'),
  ('platform','workspace_property_bindings'),
  ('platform','customer_workspaces'),
  ('platform','workspace_entitlements'),
  ('service_catalog','requests'),
  ('service_catalog','request_subject_links'),
  ('identity','context_grants'),
  ('identity','memberships'),
  ('platform','module_definitions'),
  ('app_private','canonical_authority_revision_v1'),
  ('platform','idempotency_keys'),
  ('audit','events'),
  ('platform','outbox_events')
), service_policies as (
  select n.nspname schema_name,c.relname relation_name,p.polname policy_name,
    p.polcmd,p.polpermissive,array(select r.rolname from unnest(p.polroles) role_oid
      join pg_roles r on r.oid=role_oid order by r.rolname) policy_roles,
    coalesce(pg_get_expr(p.polqual,p.polrelid),'') policy_using,
    coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') policy_check
  from pg_policy p join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where p.polname like 'core_platform_service_subject_link_%'
    or p.polname like 'service_subject_link_owner_%'
), unexpected_applicable_policies as (
  select p.oid from pg_policy p join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  join protected_relations r on r.schema_name=n.nspname and r.relation_name=c.relname
  cross join role_ids i
  where (0=any(p.polroles) or i.runtime_oid=any(p.polroles)
      or i.executor_oid=any(p.polroles) or i.owner_oid=any(p.polroles))
    and p.polname not like 'core_platform_service_subject_link_%'
    and p.polname not like 'service_subject_link_owner_%'
), direct_acl_lines(value) as (
  select concat_ws('|',r.rolname,'schema',n.nspname,privilege.privilege_type)
  from pg_namespace n join protected_roles r on true
  cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) privilege
  where r.rolname in ('cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and privilege.grantee=r.oid
  union all
  select concat_ws('|',r.rolname,'relation',n.nspname||'.'||c.relname,privilege.privilege_type)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join protected_roles r on true
  cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S'
    then 'S'::"char" else 'r'::"char" end,c.relowner))) privilege
  where r.rolname in ('cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and privilege.grantee=r.oid
  union all
  select concat_ws('|',r.rolname,'column',n.nspname||'.'||c.relname||'.'||a.attname,
    privilege.privilege_type) from pg_attribute a join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace join protected_roles r on true
  cross join lateral aclexplode(a.attacl) privilege
  where a.attnum>0 and not a.attisdropped
    and r.rolname in ('cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and privilege.grantee=r.oid
  union all
  select concat_ws('|',r.rolname,'function',n.nspname||'.'||p.proname||'('||
    p.proargtypes::text||')',privilege.privilege_type)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join protected_roles r on true
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
  where r.rolname in ('cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and privilege.grantee=r.oid
)
select current_user='cladora_service_subject_link_executor'
  and session_user='cladora_service_subject_link_runtime'
  and (select count(*)=3 from protected_roles)
  and exists(select 1 from protected_roles where rolname='cladora_service_subject_link_runtime'
    and rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
    and not rolcreatedb and not rolcreaterole and not rolreplication)
  and not exists(select 1 from protected_roles
    where rolname<>'cladora_service_subject_link_runtime' and (rolcanlogin or rolinherit
      or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
  and (select count(*)=1 from pg_auth_members m,role_ids i
    where m.member=any(array[i.runtime_oid,i.executor_oid,i.owner_oid])
      or m.roleid=any(array[i.runtime_oid,i.executor_oid,i.owner_oid]))
  and exists(select 1 from pg_auth_members m,role_ids i
    where m.roleid=i.executor_oid and m.member=i.runtime_oid
      and not m.admin_option and not m.inherit_option and m.set_option)
  and not exists(select 1 from pg_database d,role_ids i
    where d.datdba=any(array[i.runtime_oid,i.executor_oid,i.owner_oid]))
  and not exists(select 1 from pg_namespace n,role_ids i
    where n.nspowner=any(array[i.runtime_oid,i.executor_oid,i.owner_oid]))
  and not exists(select 1 from pg_class c,role_ids i
    where c.relkind in ('r','p','S','v','m','f')
      and c.relowner=any(array[i.runtime_oid,i.executor_oid,i.owner_oid]))
  and (select count(*)=3 from inventory where oid is not null and owner_name=
    'cladora_service_subject_link_owner' and prosecdef
    and proconfig=array['search_path=pg_catalog']::text[])
  and (select count(*)=12 from pg_proc p,role_ids i where p.proowner=i.owner_oid)
  and not exists(select 1 from pg_proc p,role_ids i where p.proowner=i.owner_oid
    and p.oid not in (select oid from expected_owned_function_oids))
  and not exists(select 1 from expected_owned_function_oids f join pg_proc p on p.oid=f.oid
    where p.proconfig is distinct from array['search_path=pg_catalog']::text[]
      or p.prosecdef is distinct from f.security_definer
      or p.provolatile is distinct from f.volatility)
  and (select count(*)=11 from executor_function_acl)
  and not exists(select 1 from executor_function_acl a
    where a.oid not in (select oid from expected_executor_function_oids))
  and not exists((select schema_name,'USAGE'::text from expected_schema_acl)
    except select schema_name,privilege_type from executor_schema_acl)
  and not exists(select 1 from executor_schema_acl a
    where (a.schema_name,a.privilege_type) not in (
      select schema_name,'USAGE'::text from expected_schema_acl))
  and not exists(select * from expected_relation_acl except select * from executor_relation_acl)
  and not exists(select * from executor_relation_acl except select * from expected_relation_acl)
  and not exists(select * from expected_column_acl except select * from executor_column_acl)
  and not exists(select * from executor_column_acl except select * from expected_column_acl)
  and (select count(*)=6 from owner_function_acl)
  and not exists(select 1 from owner_function_acl a
    where a.oid not in (select oid from expected_owner_function_oids))
  and not exists((select schema_name,'USAGE'::text from expected_owner_schema_acl)
    except select schema_name,privilege_type from owner_schema_acl)
  and not exists(select 1 from owner_schema_acl a
    where (a.schema_name,a.privilege_type) not in (
      select schema_name,'USAGE'::text from expected_owner_schema_acl))
  and not exists(select * from expected_owner_relation_acl except select * from owner_relation_acl)
  and not exists(select * from owner_relation_acl except select * from expected_owner_relation_acl)
  and not exists(select * from expected_owner_column_acl except select * from owner_column_acl)
  and not exists(select * from owner_column_acl except select * from expected_owner_column_acl)
  and not exists(select 1 from protected_relations r
    left join pg_namespace n on n.nspname=r.schema_name
    left join pg_class c on c.relnamespace=n.oid and c.relname=r.relation_name
    where c.oid is null or not c.relrowsecurity)
  and not exists(select 1 from unexpected_applicable_policies)
  and (select count(*)=160 from direct_acl_lines)
  and md5((select string_agg(value,E'\n' order by value) from direct_acl_lines))
    = 'f0f91a9eb48b953ee558032b34aa5c42'
  and (select count(*)=47 from service_policies)
  and not exists(select 1 from service_policies where not polpermissive
    or cardinality(policy_roles)<>1)
  and md5((select string_agg(concat_ws('|',schema_name,relation_name,policy_name,
      polcmd,polpermissive::text,policy_roles::text,policy_using,policy_check),E'\n'
      order by schema_name,relation_name,policy_name) from service_policies))
    = 'd213e945cd67e42ac72dc9d4cbdda6e2'
  and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where ((n.nspname='auth' and p.proname='jwt' and p.pronargs=0)
      or (n.nspname='communications' and p.proname in (
        'resolve_private_message_subject_v1','resolve_private_message_request_audience_v1'))
      or (n.nspname='app_private' and p.proname='insert_service_request_message_link_v1'))
      and has_function_privilege('cladora_service_subject_link_executor',p.oid,'EXECUTE'));
$$;

create function app_private.assert_service_subject_link_role_safety_v1()
returns boolean language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
  if app_private.core_platform_service_subject_link_role_safety_valid_v1() is not true then
    raise exception 'service_subject_link_role_safety_invalid' using errcode='42501';
  end if;
  return true;
end;
$$;

create function app_private.acquire_service_subject_link_role_safety_lease_v1()
returns boolean language plpgsql volatile security invoker set search_path=pg_catalog as $$
begin
  -- Canonical order: global shared lock first, then the SERVICE package lock.
  -- This blocks both legacy/global catalog mutations and package-local ones.
  perform pg_advisory_xact_lock_shared(
    hashtextextended('core-platform-role-bound-pool.v1',0));
  perform pg_advisory_xact_lock_shared(
    hashtextextended('core-platform-service-subject-link-role-bound-pool.v1',0));
  return app_private.assert_service_subject_link_role_safety_v1();
end;
$$;

-- Separately authorized STEP-SU-02 only. This function is installed but is
-- not invoked here.
create function app_private.finalize_service_subject_link_role_membership_v1()
returns boolean language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare edge record; v_count integer;
begin
  if current_user<>'supabase_admin' or not exists(
      select 1 from pg_roles where rolname=current_user and rolsuper) then
    raise exception 'service_subject_link_superuser_finalizer_required' using errcode='42501';
  end if;
  perform app_private.acquire_core_platform_role_safety_mutation_lock_v1();
  perform app_private.acquire_service_subject_link_role_safety_mutation_lock_v1();
  for edge in
    select granted.rolname granted_role,member.rolname member_role
    from pg_auth_members m
    join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where (granted.rolname in ('cladora_service_subject_link_runtime',
        'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
      or member.rolname in ('cladora_service_subject_link_runtime',
        'cladora_service_subject_link_executor','cladora_service_subject_link_owner'))
      and not (granted.rolname='cladora_service_subject_link_executor'
        and member.rolname='cladora_service_subject_link_runtime')
  loop
    execute format('revoke %I from %I cascade',edge.granted_role,edge.member_role);
  end loop;
  if exists(select 1 from pg_auth_members m
    join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where granted.rolname='cladora_service_subject_link_executor'
      and member.rolname='cladora_service_subject_link_runtime') then
    revoke cladora_service_subject_link_executor
      from cladora_service_subject_link_runtime cascade;
  end if;
  -- Always rebuild the approved edge during the separately authorized step.
  grant cladora_service_subject_link_executor
    to cladora_service_subject_link_runtime
    with admin false, inherit false, set true;
  select count(*) into v_count from pg_auth_members m
    join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where granted.rolname in ('cladora_service_subject_link_runtime',
        'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
      or member.rolname in ('cladora_service_subject_link_runtime',
        'cladora_service_subject_link_executor','cladora_service_subject_link_owner');
  if v_count<>1 or not exists(select 1 from pg_auth_members m
    join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where granted.rolname='cladora_service_subject_link_executor'
      and member.rolname='cladora_service_subject_link_runtime'
      and not m.admin_option and not m.inherit_option and m.set_option) then
    raise exception 'service_subject_link_role_graph_finalization_failed' using errcode='55000';
  end if;
  execute 'grant usage on schema auth to cladora_service_subject_link_owner,cladora_service_subject_link_executor';
  execute 'grant execute on function auth.uid() to cladora_service_subject_link_owner,cladora_service_subject_link_executor';
  execute 'revoke execute on function auth.jwt() from public,cladora_service_subject_link_runtime,cladora_service_subject_link_executor';
  execute 'grant execute on function auth.jwt() to anon,authenticated,service_role,cladora_ce_guide_executor,cladora_service_subject_link_owner';
  insert into app_private.service_subject_link_step_su_02_receipt_v1(
    receipt_key,finalized_by,finalized_at,role_graph_fingerprint)
  values('STEP-SU-02',current_user,clock_timestamp(),
    'executor>runtime|admin=false|inherit=false|set=true')
  on conflict(receipt_key) do update set
    finalized_by=excluded.finalized_by,
    finalized_at=excluded.finalized_at,
    role_graph_fingerprint=excluded.role_graph_fingerprint;
  return true;
end;
$$;

revoke all on function
  app_private.core_platform_service_subject_link_role_safety_valid_v1(),
  app_private.assert_service_subject_link_role_safety_v1(),
  app_private.acquire_service_subject_link_role_safety_lease_v1(),
  app_private.finalize_service_subject_link_role_membership_v1()
  from public,postgres,anon,authenticated,service_role,
    cladora_service_subject_link_runtime,cladora_service_subject_link_owner;
alter function app_private.core_platform_service_subject_link_role_safety_valid_v1()
  owner to cladora_service_subject_link_owner;
alter function app_private.assert_service_subject_link_role_safety_v1()
  owner to cladora_service_subject_link_owner;
alter function app_private.acquire_service_subject_link_role_safety_lease_v1()
  owner to cladora_service_subject_link_owner;
alter function app_private.finalize_service_subject_link_role_membership_v1()
  owner to cladora_service_subject_link_owner;
set role cladora_service_subject_link_owner;
grant execute on function
  app_private.core_platform_service_subject_link_role_safety_valid_v1(),
  app_private.assert_service_subject_link_role_safety_v1(),
  app_private.acquire_service_subject_link_role_safety_lease_v1()
  to cladora_service_subject_link_executor;
grant execute on function app_private.finalize_service_subject_link_role_membership_v1()
  to supabase_admin;
reset role;

-- Keep the owner incapable of creating additional package objects.
revoke create on schema app_private,communications,service_catalog,platform,identity,
  portfolio,maintenance
  from cladora_service_subject_link_owner;

commit;
