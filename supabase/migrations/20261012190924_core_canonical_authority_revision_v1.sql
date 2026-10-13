begin;

-- Canonical invalidation epoch, NOT an authority store. All truth remains in
-- the existing Core evaluator. One global epoch conservatively invalidates
-- every Workspace, including changes to shared definitions and grantors.
create table app_private.canonical_authority_revision_v1 (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision between 1 and 9007199254740991)
);
insert into app_private.canonical_authority_revision_v1(singleton,revision) values(true,1);
alter table app_private.canonical_authority_revision_v1 enable row level security;
revoke all on table app_private.canonical_authority_revision_v1
  from public,anon,authenticated,service_role;

create function app_private.guard_authority_revision_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() < 2
    or new.singleton is distinct from old.singleton
    or new.revision <> old.revision + 1 then
    raise exception 'canonical_authority_revision_write_denied' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_authority_revision_v1()
  from public,anon,authenticated,service_role;
create trigger canonical_authority_revision_guard
before insert or update or delete on app_private.canonical_authority_revision_v1
for each row execute function app_private.guard_authority_revision_v1();
create trigger canonical_authority_revision_truncate_guard
before truncate on app_private.canonical_authority_revision_v1
for each statement execute function app_private.guard_authority_revision_v1();
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_guard;
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_truncate_guard;

create function app_private.bump_canonical_authority_revision_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- The row update and source mutation share a commit/rollback boundary.
  -- Overflow or a missing singleton aborts the entire source mutation.
  update app_private.canonical_authority_revision_v1
    set revision=revision+1 where singleton;
  if not found then
    raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
  end if;
  return null;
end;
$$;
revoke all on function app_private.bump_canonical_authority_revision_v1()
  from public,anon,authenticated,service_role;

create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.context_grants
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table identity.context_grants enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.memberships
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table identity.memberships enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table identity.permissions enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table identity.role_permissions enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table identity.roles enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.customer_workspaces
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.customer_workspaces enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_definitions
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.module_definitions enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_operating_model_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.module_operating_model_compatibilities enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_permission_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.module_permission_bindings enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_property_profile_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.module_property_profile_compatibilities enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.operating_models
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.operating_models enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.property_profiles
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.property_profiles enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_delegation_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_delegation_permissions enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_delegations
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_delegations enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_entitlements
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_entitlements enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_role_authority_sources
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_member_role_authority_sources enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_member_roles enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_modules enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_property_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_property_bindings enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_role_modules enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_role_permissions enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_roles enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_taxonomy_assignments
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table platform.workspace_taxonomy_assignments enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.buildings
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table portfolio.buildings enable always trigger canonical_authority_revision_changed;
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.units
for each statement execute function app_private.bump_canonical_authority_revision_v1();
alter table portfolio.units enable always trigger canonical_authority_revision_changed;

comment on table app_private.canonical_authority_revision_v1 is
 'Core global commit-coupled invalidation revision. Provider holds FOR SHARE after TX host locks. No authority rows, actor snapshots, projections or ledgers. No consumer grants or runtime activation.';
commit;
