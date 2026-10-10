begin;

-- DW-01B: version the existing workspace taxonomy ledger. Classification is
-- descriptive only; this migration does not create an entitlement or action
-- authorization path.
alter table platform.workspace_taxonomy_assignments
  add column configuration_version integer,
  add column compatibility_rule_id uuid,
  add column compatibility_rule_version integer;

with ranked as (
  select
    a.id,
    row_number() over (
      partition by a.customer_workspace_id
      order by a.valid_from, a.created_at, a.id
    )::integer as configuration_version
  from platform.workspace_taxonomy_assignments a
), pinned as (
  select
    r.id,
    r.configuration_version,
    c.id as compatibility_rule_id,
    c.rule_version as compatibility_rule_version
  from ranked r
  join platform.workspace_taxonomy_assignments a on a.id = r.id
  join lateral (
    select x.id, x.rule_version
    from platform.property_operating_model_compatibilities x
    where x.property_profile_id = a.property_profile_id
      and x.operating_model_id = a.operating_model_id
    order by x.rule_version desc, x.id
    limit 1
  ) c on true
)
update platform.workspace_taxonomy_assignments a
set configuration_version = p.configuration_version,
    compatibility_rule_id = p.compatibility_rule_id,
    compatibility_rule_version = p.compatibility_rule_version
from pinned p
where a.id = p.id;

do $$
begin
  if exists (
    select 1
    from platform.workspace_taxonomy_assignments
    where configuration_version is null
       or compatibility_rule_id is null
       or compatibility_rule_version is null
  ) then
    raise exception 'workspace_configuration_backfill_rule_missing' using errcode = 'P0001';
  end if;
end;
$$;

alter table platform.workspace_taxonomy_assignments
  alter column configuration_version set not null,
  alter column compatibility_rule_id set not null,
  alter column compatibility_rule_version set not null,
  add constraint workspace_taxonomy_configuration_version_positive
    check (configuration_version > 0),
  add constraint workspace_taxonomy_compatibility_rule_version_positive
    check (compatibility_rule_version > 0),
  add constraint workspace_taxonomy_configuration_rule_fk
    foreign key (compatibility_rule_id)
    references platform.property_operating_model_compatibilities(id)
    on delete restrict,
  add constraint workspace_taxonomy_workspace_configuration_version_key
    unique (customer_workspace_id, configuration_version);

create or replace function app_private.assign_workspace_configuration_version_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_next_version integer;
  v_rule record;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('workspace_configuration:' || new.customer_workspace_id::text, 0)
  );

  select c.id, c.rule_version
  into v_rule
  from platform.property_operating_model_compatibilities c
  where c.property_profile_id = new.property_profile_id
    and c.operating_model_id = new.operating_model_id
  order by c.rule_version desc, c.id
  limit 1;

  if not found then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  select coalesce(max(a.configuration_version), 0) + 1
  into v_next_version
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = new.customer_workspace_id;

  new.configuration_version := v_next_version;
  new.compatibility_rule_id := v_rule.id;
  new.compatibility_rule_version := v_rule.rule_version;
  return new;
end;
$$;

revoke all on function app_private.assign_workspace_configuration_version_v1()
  from public, anon, authenticated, service_role;

create trigger a_assign_workspace_configuration_version
before insert on platform.workspace_taxonomy_assignments
for each row execute function app_private.assign_workspace_configuration_version_v1();

-- Preserve the established lifecycle transition fields while making the new
-- version and compatibility provenance immutable history.
create or replace function app_private.guard_workspace_taxonomy_assignment_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
  elsif tg_op = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_profile_id <> new.property_profile_id
       or old.operating_model_id <> new.operating_model_id
       or old.country_code is distinct from new.country_code
       or old.configuration_version is distinct from new.configuration_version
       or old.compatibility_rule_id is distinct from new.compatibility_rule_id
       or old.compatibility_rule_version is distinct from new.compatibility_rule_version
       or old.created_by is distinct from new.created_by
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_workspace_taxonomy_assignment_history_v1()
  from public, anon, authenticated, service_role;

create or replace function customer_api.get_workspace_configuration_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_as_of timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_actor record;
  v_assignment record;
begin
  select * into v_actor
  from app_private.resolve_workspace_native_context_v2(p_context_id, p_workspace_id);

  if p_as_of is null then
    raise exception 'workspace_configuration_as_of_required' using errcode = '22023';
  end if;
  if p_as_of > statement_timestamp() then
    raise exception 'workspace_configuration_future_as_of' using errcode = '22023';
  end if;

  select
    a.*,
    p.code as profile_code,
    p.version as profile_version,
    p.name as profile_name,
    p.labels_json as profile_labels,
    m.code as operating_model_code,
    m.version as operating_model_version,
    m.name as operating_model_name,
    m.labels_json as operating_model_labels,
    c.compatibility_level,
    c.reason as compatibility_reason
  into v_assignment
  from platform.workspace_taxonomy_assignments a
  join platform.property_profiles p on p.id = a.property_profile_id
  join platform.operating_models m on m.id = a.operating_model_id
  join platform.property_operating_model_compatibilities c
    on c.id = a.compatibility_rule_id
  where a.tenant_id = v_actor.tenant_id
    and a.customer_workspace_id = v_actor.workspace_id
    and a.valid_from <= p_as_of
    and (a.valid_to is null or a.valid_to > p_as_of)
  order by a.configuration_version desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'contract', 'workspace-configuration.v1',
      'workspace_id', v_actor.workspace_id,
      'as_of', p_as_of,
      'has_configuration', false,
      'classification_only', true,
      'configuration', null,
      'compatibility', jsonb_build_object(
        'rule_id', null,
        'rule_version', null,
        'level', null,
        'reason', null,
        'product_gate', false
      ),
      'action_authorization', 'not_evaluated'
    );
  end if;

  return jsonb_build_object(
    'contract', 'workspace-configuration.v1',
    'workspace_id', v_actor.workspace_id,
    'as_of', p_as_of,
    'has_configuration', true,
    'classification_only', true,
    'configuration', jsonb_build_object(
      'assignment_id', v_assignment.id,
      'configuration_version', v_assignment.configuration_version,
      'valid_from', v_assignment.valid_from,
      'valid_to', v_assignment.valid_to,
      'country_code', v_assignment.country_code,
      'property_profile', jsonb_build_object(
        'id', v_assignment.property_profile_id,
        'code', v_assignment.profile_code,
        'version', v_assignment.profile_version,
        'name', v_assignment.profile_name,
        'labels', v_assignment.profile_labels
      ),
      'operating_model', jsonb_build_object(
        'id', v_assignment.operating_model_id,
        'code', v_assignment.operating_model_code,
        'version', v_assignment.operating_model_version,
        'name', v_assignment.operating_model_name,
        'labels', v_assignment.operating_model_labels
      )
    ),
    'compatibility', jsonb_build_object(
      'rule_id', v_assignment.compatibility_rule_id,
      'rule_version', v_assignment.compatibility_rule_version,
      'level', v_assignment.compatibility_level,
      'reason', v_assignment.compatibility_reason,
      'product_gate', false
    ),
    'action_authorization', 'not_evaluated'
  );
end;
$$;

revoke all on function customer_api.get_workspace_configuration_v1(uuid, uuid, timestamptz)
  from public, anon, service_role;
grant execute on function customer_api.get_workspace_configuration_v1(uuid, uuid, timestamptz)
  to authenticated;

comment on function customer_api.get_workspace_configuration_v1(uuid, uuid, timestamptz)
  is 'workspace-configuration.v1 descriptive historical projection; not an entitlement or action authorization decision';

commit;
