begin;

-- CORE-PLATFORM-ROLE-BOUND-POOL-01
-- Inactive installation only: no credential, route, user-role assignment or
-- production activation is introduced by this migration.

create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
  return true;
end;
$$;
revoke all on function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
  from public,anon,authenticated,service_role;
alter function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
  owner to cladora_rpc_owner;

-- Every repository-owned mutation of the protected roles or function owners
-- must first take this exclusive transaction lock. Operational roles receive
-- no EXECUTE privilege on this mutation primitive and no catalog powers.
select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

do $$
declare owner_role pg_roles%rowtype;
begin
  select * into owner_role from pg_roles where rolname='cladora_rpc_owner';
  if owner_role.oid is null or owner_role.rolcanlogin or owner_role.rolsuper
    or owner_role.rolbypassrls or owner_role.rolcreatedb or owner_role.rolcreaterole
    or owner_role.rolreplication then
    raise exception 'core_platform_canonical_owner_invalid' using errcode='55000';
  end if;
  if exists(select 1 from pg_roles where rolname in
    ('cladora_ce_guide_runtime','cladora_ce_guide_executor')) then
    raise exception 'core_platform_role_preexisting' using errcode='55000';
  end if;
end;
$$;

create role cladora_ce_guide_runtime
  login noinherit nosuperuser nobypassrls nocreatedb nocreaterole
  noreplication password null;
create role cladora_ce_guide_executor
  nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole
  noreplication password null;
grant cladora_ce_guide_executor to cladora_ce_guide_runtime
  with admin false, inherit false, set true;

comment on role cladora_ce_guide_runtime is
  'External-secret runtime login for core-platform-role-bound-pool.v1; owns no product object and receives no product ACL.';
comment on role cladora_ce_guide_executor is
  'Fixed NOLOGIN least-privilege executor for inactive CE Guide lifecycle only.';

-- Preserve Supabase ownership of auth.uid/auth.jwt. Internal security-definer
-- functions are moved to the existing canonical NOLOGIN owner.
grant create on schema app_private,documents,communications to cladora_rpc_owner;
alter function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)
  owner to cladora_rpc_owner;
alter function documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid)
  owner to cladora_rpc_owner;
alter function documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid)
  set search_path=pg_catalog;
alter function communications.member_covers_unit(uuid,uuid,uuid)
  owner to cladora_rpc_owner;
alter function communications.context_covers_unit(uuid,uuid)
  owner to cladora_rpc_owner;
revoke create on schema app_private,documents,communications from cladora_rpc_owner;

grant usage on schema auth,communications,experience,occupancy to cladora_rpc_owner;
grant execute on function
  auth.uid(),auth.jwt(),
  app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid),
  communications.context_membership(uuid)
  to cladora_rpc_owner;
grant select(id,tenant_id,archived_at,lifecycle_status)
  on platform.customer_workspaces to cladora_rpc_owner;
grant select(id,tenant_id,membership_id,starts_at,ends_at)
  on identity.context_grants to cladora_rpc_owner;
grant select(id,tenant_id,user_id,role_id,status,starts_at,ends_at)
  on identity.memberships to cladora_rpc_owner;
grant select(id,tenant_id,workspace_id) on documents.documents to cladora_rpc_owner;
grant select(id,tenant_id,workspace_id) on experience.guides to cladora_rpc_owner;
grant select on identity.membership_parties,portfolio.buildings,portfolio.units,
  portfolio.ownerships,occupancy.leases to cladora_rpc_owner;

-- These policies are the narrow source-read boundary for the canonical
-- NOLOGIN owner of the security-definer scope helpers below. Without explicit
-- owner policies their fail-closed handlers would deny every executor row.
create policy core_platform_owner_workspaces_read_v1
  on platform.customer_workspaces for select to cladora_rpc_owner using(true);
create policy core_platform_owner_contexts_read_v1
  on identity.context_grants for select to cladora_rpc_owner using(true);
create policy core_platform_owner_memberships_read_v1
  on identity.memberships for select to cladora_rpc_owner using(true);
create policy core_platform_owner_documents_read_v1
  on documents.documents for select to cladora_rpc_owner using(true);
create policy core_platform_owner_guides_read_v1
  on experience.guides for select to cladora_rpc_owner using(true);

create policy core_platform_owner_membership_parties_read_v1
  on identity.membership_parties for select to cladora_rpc_owner using(true);
create policy core_platform_owner_buildings_read_v1
  on portfolio.buildings for select to cladora_rpc_owner using(true);
create policy core_platform_owner_units_read_v1
  on portfolio.units for select to cladora_rpc_owner using(true);
create policy core_platform_owner_ownerships_read_v1
  on portfolio.ownerships for select to cladora_rpc_owner using(true);
create policy core_platform_owner_leases_read_v1
  on occupancy.leases for select to cladora_rpc_owner using(true);

create function app_private.core_platform_ce_guide_scope_allowed_v1(
  p_tenant_id uuid,p_workspace_id uuid,p_permission_code text,p_module_code text
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_context_id uuid; v_workspace_id uuid; v_actor_id uuid;
begin
  if session_user<>'cladora_ce_guide_runtime' then return false; end if;
  v_context_id:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=auth.uid();
  if v_context_id is null or v_workspace_id is null or v_actor_id is null
    or v_workspace_id<>p_workspace_id or auth.jwt()->>'aal'<>'aal2' then return false; end if;
  return exists(select 1 from platform.customer_workspaces w
    join identity.context_grants g on g.id=v_context_id and g.tenant_id=w.tenant_id
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where w.id=p_workspace_id and w.tenant_id=p_tenant_id and w.archived_at is null
      and w.lifecycle_status='ACTIVE' and m.user_id=v_actor_id and m.status='active'
      and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp()))
    and app_private.check_workspace_native_permission_v2(
      v_context_id,p_workspace_id,p_permission_code,p_module_code) is true;
exception when others then return false;
end;
$$;

create function app_private.core_platform_ce_guide_identity_allowed_v1(
  p_kind text,p_id uuid,p_tenant_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_context_id uuid; v_workspace_id uuid; v_actor_id uuid; v_allowed boolean;
begin
  v_context_id:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  v_actor_id:=auth.uid();
  v_allowed:=app_private.core_platform_ce_guide_scope_allowed_v1(
      p_tenant_id,v_workspace_id,'experience.guide.manage','experience_guides')
    or app_private.core_platform_ce_guide_scope_allowed_v1(
      p_tenant_id,v_workspace_id,'documents.vault.read','documents');
  if not v_allowed then return false; end if;
  if p_kind='context' then
    return p_id=v_context_id and exists(select 1 from identity.context_grants g
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=p_id and g.tenant_id=p_tenant_id and m.user_id=v_actor_id);
  elsif p_kind='membership' then
    return exists(select 1 from identity.context_grants g
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=v_context_id and m.id=p_id and m.tenant_id=p_tenant_id
        and m.user_id=v_actor_id);
  elsif p_kind='role' then
    return exists(select 1 from identity.context_grants g
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where g.id=v_context_id and m.role_id=p_id and m.tenant_id=p_tenant_id
        and m.user_id=v_actor_id);
  end if;
  return false;
exception when others then return false;
end;
$$;

create function app_private.core_platform_ce_guide_document_allowed_v1(
  p_document_id uuid,p_tenant_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace_id uuid;
begin
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  return exists(select 1 from documents.documents d
    where d.id=p_document_id and d.tenant_id=p_tenant_id and d.workspace_id=v_workspace_id)
    and app_private.core_platform_ce_guide_scope_allowed_v1(
      p_tenant_id,v_workspace_id,'documents.vault.read','documents');
exception when others then return false;
end;
$$;

create function app_private.core_platform_ce_guide_ledger_allowed_v1(
  p_tenant_id uuid,p_actor_id uuid,p_key text default null,p_aggregate_id uuid default null
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace_id uuid;
begin
  v_workspace_id:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
  if p_actor_id is distinct from auth.uid() then return false; end if;
  if not app_private.core_platform_ce_guide_scope_allowed_v1(
    p_tenant_id,v_workspace_id,'experience.guide.manage','experience_guides') then return false; end if;
  if p_key is not null and p_key not like 'core-tx.v1:'||v_workspace_id::text||':%' then
    return false;
  end if;
  if p_aggregate_id is not null and not exists(select 1 from experience.guides g
    where g.id=p_aggregate_id and g.tenant_id=p_tenant_id and g.workspace_id=v_workspace_id) then
    return false;
  end if;
  return true;
exception when others then return false;
end;
$$;

revoke all on function
  app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
  app_private.core_platform_ce_guide_identity_allowed_v1(text,uuid,uuid),
  app_private.core_platform_ce_guide_document_allowed_v1(uuid,uuid),
  app_private.core_platform_ce_guide_ledger_allowed_v1(uuid,uuid,text,uuid)
  from public,anon,authenticated,service_role;
alter function app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text)
  owner to cladora_rpc_owner;
alter function app_private.core_platform_ce_guide_identity_allowed_v1(text,uuid,uuid)
  owner to cladora_rpc_owner;
alter function app_private.core_platform_ce_guide_document_allowed_v1(uuid,uuid)
  owner to cladora_rpc_owner;
alter function app_private.core_platform_ce_guide_ledger_allowed_v1(uuid,uuid,text,uuid)
  owner to cladora_rpc_owner;

-- Exact schemas, columns and functions used by the inactive CE/Core/Documents
-- call graph. Runtime receives only membership; all product ACLs are executor-only.
grant usage on schema auth,app_private,platform,identity,experience,documents,
  communications,portfolio,audit to cladora_ce_guide_executor;
revoke create on schema auth,app_private,platform,identity,experience,documents,
  communications,portfolio,audit from cladora_ce_guide_executor,cladora_ce_guide_runtime;

grant select(id,tenant_id,workspace_id,status,version,content_version,title,audience)
  on experience.guides to cladora_ce_guide_executor;
grant update(status,version) on experience.guides to cladora_ce_guide_executor;
grant select(id,tenant_id,workspace_id,guide_id,guide_version,position)
  on experience.guide_steps to cladora_ce_guide_executor;
grant update(id) on experience.guide_steps to cladora_ce_guide_executor;
grant select(id,tenant_id,workspace_id,guide_id,guide_version,step_id,position,
  target_type,target_id,document_version_id,document_version)
  on experience.guide_references to cladora_ce_guide_executor;
grant update(id) on experience.guide_references to cladora_ce_guide_executor;
grant select(id,tenant_id,archived_at,lifecycle_status),update(id)
  on platform.customer_workspaces to cladora_ce_guide_executor;
grant select(singleton,revision),update(singleton)
  on app_private.canonical_authority_revision_v1 to cladora_ce_guide_executor;
grant select(id,tenant_id,membership_id,scope_type,property_id,building_id,unit_id,starts_at,ends_at)
  on identity.context_grants to cladora_ce_guide_executor;
grant select(id,tenant_id,user_id,role_id,status,starts_at,ends_at)
  on identity.memberships to cladora_ce_guide_executor;
grant select(id,tenant_id,code) on identity.roles to cladora_ce_guide_executor;
grant select(id,code,entitlement_key,is_active,lifecycle_status,valid_from,valid_to)
  on platform.module_definitions to cladora_ce_guide_executor;

grant select(id,tenant_id,workspace_id,current_version,status,deleted_at,archived_at,
  disposition_status,property_id,classification,document_type),update(id)
  on documents.documents to cladora_ce_guide_executor;
grant select(id,tenant_id,document_id,version,scanning_status,checksum_status,sha256),update(id)
  on documents.document_versions to cladora_ce_guide_executor;
grant select(id,tenant_id,document_id,membership_id,permission,valid_from,valid_until),update(id)
  on documents.document_permissions to cladora_ce_guide_executor;
grant select(id,tenant_id,document_id,entity_type,entity_id)
  on documents.document_links to cladora_ce_guide_executor;
grant select(id,tenant_id,document_id) on documents.document_audit_links
  to cladora_ce_guide_executor;
grant select(tenant_id,version_id,provider,verdict,content_sha256,scanned_at,recorded_at)
  on documents.document_scan_attestations to cladora_ce_guide_executor;
grant select(id,tenant_id,property_id) on portfolio.buildings to cladora_ce_guide_executor;
grant select(id,tenant_id,building_id,status) on portfolio.units to cladora_ce_guide_executor;

grant select(tenant_id,actor_id,key,request_hash,response_ref,expires_at),
  insert(tenant_id,actor_id,key,request_hash,expires_at),update(response_ref,status_code)
  on platform.idempotency_keys to cladora_ce_guide_executor;
grant select(id),insert(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot)
  on audit.events to cladora_ce_guide_executor;
grant usage,select on sequence audit.events_id_seq to cladora_ce_guide_executor;
grant select(id),insert(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
  on platform.outbox_events to cladora_ce_guide_executor;

grant execute on function auth.uid(),auth.jwt(),
  app_private.check_workspace_native_permission_v2(uuid,uuid,text,text),
  documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid),
  communications.member_covers_unit(uuid,uuid,uuid),
  communications.context_covers_unit(uuid,uuid),
  app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
  app_private.core_platform_ce_guide_identity_allowed_v1(text,uuid,uuid),
  app_private.core_platform_ce_guide_document_allowed_v1(uuid,uuid),
  app_private.core_platform_ce_guide_ledger_allowed_v1(uuid,uuid,text,uuid)
  to cladora_ce_guide_executor;

create policy core_platform_ce_guides_read_v1 on experience.guides
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
create policy core_platform_ce_guides_update_v1 on experience.guides
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'))
  with check(app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
create policy core_platform_ce_steps_read_v1 on experience.guide_steps
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
create policy core_platform_ce_steps_lock_v1 on experience.guide_steps
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'))
  with check(false);
create policy core_platform_ce_references_read_v1 on experience.guide_references
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
create policy core_platform_ce_references_lock_v1 on experience.guide_references
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'experience.guide.manage','experience_guides'))
  with check(false);
create policy core_platform_ce_workspaces_read_v1 on platform.customer_workspaces
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,id,'experience.guide.manage','experience_guides')
    or app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,id,'documents.vault.read','documents'));
create policy core_platform_ce_workspaces_lock_v1 on platform.customer_workspaces
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,id,'experience.guide.manage','experience_guides')
    or app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,id,'documents.vault.read','documents'))
  with check(false);
create policy core_platform_ce_revision_read_v1 on app_private.canonical_authority_revision_v1
  for select to cladora_ce_guide_executor using(singleton and exists(
    select 1 from platform.customer_workspaces w where
      app_private.core_platform_ce_guide_scope_allowed_v1(
        w.tenant_id,w.id,'experience.guide.manage','experience_guides')
      or app_private.core_platform_ce_guide_scope_allowed_v1(
        w.tenant_id,w.id,'documents.vault.read','documents')));
create policy core_platform_ce_revision_lock_v1 on app_private.canonical_authority_revision_v1
  for update to cladora_ce_guide_executor using(singleton and exists(
    select 1 from platform.customer_workspaces w where
      app_private.core_platform_ce_guide_scope_allowed_v1(
        w.tenant_id,w.id,'experience.guide.manage','experience_guides')
      or app_private.core_platform_ce_guide_scope_allowed_v1(
        w.tenant_id,w.id,'documents.vault.read','documents')))
  with check(false);
create policy core_platform_ce_context_read_v1 on identity.context_grants
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_identity_allowed_v1('context',id,tenant_id));
create policy core_platform_ce_membership_read_v1 on identity.memberships
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_identity_allowed_v1('membership',id,tenant_id));
create policy core_platform_ce_role_read_v1 on identity.roles
  for select to cladora_ce_guide_executor using(tenant_id is null and exists(
    select 1 from identity.memberships m where
      app_private.core_platform_ce_guide_identity_allowed_v1('membership',m.id,m.tenant_id)
      and m.role_id=identity.roles.id));
create policy core_platform_ce_module_read_v1 on platform.module_definitions
  for select to cladora_ce_guide_executor using(code in ('experience_guides','documents')
    and exists(select 1 from platform.customer_workspaces w where
      app_private.core_platform_ce_guide_scope_allowed_v1(
        w.tenant_id,w.id,case when code='documents' then 'documents.vault.read'
          else 'experience.guide.manage' end,code)));

create policy core_platform_ce_documents_read_v1 on documents.documents
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'documents.vault.read','documents'));
create policy core_platform_ce_documents_lock_v1 on documents.documents
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_scope_allowed_v1(
      tenant_id,workspace_id,'documents.vault.read','documents'))
  with check(false);
create policy core_platform_ce_document_versions_read_v1 on documents.document_versions
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id));
create policy core_platform_ce_document_versions_lock_v1 on documents.document_versions
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id))
  with check(false);
create policy core_platform_ce_document_permissions_read_v1 on documents.document_permissions
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id));
create policy core_platform_ce_document_permissions_lock_v1 on documents.document_permissions
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id))
  with check(false);
create policy core_platform_ce_document_links_read_v1 on documents.document_links
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id));
create policy core_platform_ce_document_audit_links_read_v1 on documents.document_audit_links
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_document_allowed_v1(document_id,tenant_id));
create policy core_platform_ce_document_scans_read_v1 on documents.document_scan_attestations
  for select to cladora_ce_guide_executor using(exists(select 1
    from documents.document_versions v where v.id=version_id and v.tenant_id=tenant_id
      and app_private.core_platform_ce_guide_document_allowed_v1(v.document_id,v.tenant_id)));
create policy core_platform_ce_buildings_read_v1 on portfolio.buildings
  for select to cladora_ce_guide_executor using(exists(
    select 1 from platform.customer_workspaces w where
      app_private.core_platform_ce_guide_scope_allowed_v1(
        tenant_id,w.id,'documents.vault.read','documents')));
create policy core_platform_ce_units_read_v1 on portfolio.units
  for select to cladora_ce_guide_executor using(exists(
    select 1 from platform.customer_workspaces w where
      app_private.core_platform_ce_guide_scope_allowed_v1(
        tenant_id,w.id,'documents.vault.read','documents')));

create policy core_platform_ce_idempotency_read_v1 on platform.idempotency_keys
  for select to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_ledger_allowed_v1(tenant_id,actor_id,key,null));
create policy core_platform_ce_idempotency_insert_v1 on platform.idempotency_keys
  for insert to cladora_ce_guide_executor with check(
    app_private.core_platform_ce_guide_ledger_allowed_v1(tenant_id,actor_id,key,null));
create policy core_platform_ce_idempotency_update_v1 on platform.idempotency_keys
  for update to cladora_ce_guide_executor using(
    app_private.core_platform_ce_guide_ledger_allowed_v1(tenant_id,actor_id,key,null))
  with check(app_private.core_platform_ce_guide_ledger_allowed_v1(tenant_id,actor_id,key,null));
create policy core_platform_ce_audit_insert_v1 on audit.events
  for insert to cladora_ce_guide_executor with check(
    action in ('core.experience.guide.publish','core.experience.guide.unpublish')
    and entity_type='experience_guide' and entity_id is not null
    and app_private.core_platform_ce_guide_ledger_allowed_v1(
      tenant_id,actor_id,null,entity_id));
create policy core_platform_ce_audit_receipt_read_v1 on audit.events
  for select to cladora_ce_guide_executor using(
    action in ('core.experience.guide.publish','core.experience.guide.unpublish')
    and entity_type='experience_guide' and entity_id is not null
    and app_private.core_platform_ce_guide_ledger_allowed_v1(
      tenant_id,actor_id,null,entity_id));
create policy core_platform_ce_outbox_insert_v1 on platform.outbox_events
  for insert to cladora_ce_guide_executor with check(
    aggregate_type='experience_guide'
    and event_type in ('core.experience.guide.publish.v1','core.experience.guide.unpublish.v1')
    and app_private.core_platform_ce_guide_ledger_allowed_v1(
      tenant_id,auth.uid(),null,aggregate_id));
create policy core_platform_ce_outbox_receipt_read_v1 on platform.outbox_events
  for select to cladora_ce_guide_executor using(
    aggregate_type='experience_guide'
    and event_type in ('core.experience.guide.publish.v1','core.experience.guide.unpublish.v1')
    and app_private.core_platform_ce_guide_ledger_allowed_v1(
      tenant_id,auth.uid(),null,aggregate_id));

create function app_private.core_platform_ce_guide_role_safety_valid_v1()
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
with recursive protected_roles as (
  select oid,rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,
    rolcreaterole,rolreplication from pg_roles
  where rolname in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')
), role_ids as (
  select max(oid) filter(where rolname='cladora_ce_guide_runtime') runtime_oid,
    max(oid) filter(where rolname='cladora_ce_guide_executor') executor_oid
  from protected_roles
), protected_functions(signature,internal) as (values
  ('auth.uid()'::text,false),('auth.jwt()'::text,false),
  ('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::text,true),
  ('documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid)'::text,true),
  ('communications.member_covers_unit(uuid,uuid,uuid)'::text,true),
  ('communications.context_covers_unit(uuid,uuid)'::text,true)
), function_inventory as (
  select f.signature,f.internal,p.oid,r.rolname owner_name,r.rolcanlogin owner_login,
    p.prosecdef,p.provolatile,p.proconfig
  from protected_functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
  left join pg_roles r on r.oid=p.proowner
)
select current_user='cladora_ce_guide_executor'
  and session_user='cladora_ce_guide_runtime'
  and (select count(*)=2 from protected_roles)
  and exists(select 1 from protected_roles where rolname='cladora_ce_guide_runtime'
    and rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
    and not rolcreatedb and not rolcreaterole and not rolreplication)
  and exists(select 1 from protected_roles where rolname='cladora_ce_guide_executor'
    and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
    and not rolcreatedb and not rolcreaterole and not rolreplication)
  and (select count(*)=1 from pg_auth_members m,role_ids i
    where m.roleid=any(array[i.runtime_oid,i.executor_oid])
       or m.member=any(array[i.runtime_oid,i.executor_oid]))
  and exists(select 1 from pg_auth_members m,role_ids i
    where m.roleid=i.executor_oid and m.member=i.runtime_oid
      and not m.admin_option and not m.inherit_option and m.set_option)
  and not exists(select 1 from pg_database d,role_ids i
    where d.datdba=any(array[i.runtime_oid,i.executor_oid]))
  and not exists(select 1 from pg_namespace n,role_ids i
    where n.nspowner=any(array[i.runtime_oid,i.executor_oid]))
  and not exists(select 1 from pg_class c,role_ids i
    where c.relkind in ('r','p','S','v','m','f')
      and c.relowner=any(array[i.runtime_oid,i.executor_oid]))
  and not exists(select 1 from pg_proc p,role_ids i
    where p.proowner=any(array[i.runtime_oid,i.executor_oid]))
  and (select count(*)=6 from function_inventory where oid is not null)
  and not exists(select 1 from function_inventory
    where internal and (owner_name<>'cladora_rpc_owner' or owner_login or not prosecdef
      or proconfig is distinct from array['search_path=pg_catalog']::text[]))
  and not exists(select 1 from function_inventory
    where not internal and (owner_name<>'supabase_auth_admin' or prosecdef
      or provolatile<>'s'));
$$;

create function app_private.assert_ce_guide_role_safety_v1()
returns boolean language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
  if app_private.core_platform_ce_guide_role_safety_valid_v1() is not true then
    raise exception 'core_platform_role_safety_invalid' using errcode='42501';
  end if;
  return true;
end;
$$;

create function app_private.acquire_ce_guide_role_safety_lease_v1()
returns boolean language plpgsql volatile security invoker set search_path=pg_catalog as $$
begin
  perform pg_advisory_xact_lock_shared(
    hashtextextended('core-platform-role-bound-pool.v1',0));
  return app_private.assert_ce_guide_role_safety_v1();
end;
$$;

revoke all on function
  app_private.core_platform_ce_guide_role_safety_valid_v1(),
  app_private.assert_ce_guide_role_safety_v1(),
  app_private.acquire_ce_guide_role_safety_lease_v1()
  from public,anon,authenticated,service_role,cladora_ce_guide_runtime;
alter function app_private.core_platform_ce_guide_role_safety_valid_v1()
  owner to cladora_rpc_owner;
alter function app_private.assert_ce_guide_role_safety_v1()
  owner to cladora_rpc_owner;
alter function app_private.acquire_ce_guide_role_safety_lease_v1()
  owner to cladora_rpc_owner;
grant execute on function app_private.core_platform_ce_guide_role_safety_valid_v1(),
  app_private.assert_ce_guide_role_safety_v1(),
  app_private.acquire_ce_guide_role_safety_lease_v1()
  to cladora_ce_guide_executor;

commit;
