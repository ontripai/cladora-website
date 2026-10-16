begin;

-- CORE-READ-AUTHORITY-PROFILE-01 installs only the canonical registry identity.
-- It deliberately creates no role assignment, Workspace module activation,
-- entitlement allocation, execution-role grant, read host, route or Country Pack.
insert into identity.permissions(code,resource,action,description)
values(
  'experience.guide.read',
  'experience.guide',
  'read',
  'Read an authorized Experience Guide projection in the current Workspace'
)
on conflict(code) do nothing;

insert into platform.module_definitions(
  code,version,name,labels_json,description,category,is_active,lifecycle_status,
  sensitivity_level,requires_aal2,entitlement_key,published_at
)
values(
  'experience_guides',
  1,
  'Experience Guides',
  '{"ro":"Ghiduri","en":"Guides","fa":"راهنماها"}'::jsonb,
  'Versioned Experience Guide authority profile',
  'services',
  true,
  'published',
  'sensitive',
  true,
  'module.experience_guides',
  statement_timestamp()
)
on conflict(code,version) do nothing;

insert into platform.module_permission_bindings(
  module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status
)
select m.id,p.id,1,'read',true,false,true,'active'
from platform.module_definitions m
join identity.permissions p on p.code='experience.guide.read'
where m.code='experience_guides' and m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;

-- Conflicting pre-existing registry state must stop installation. The profile
-- tuple is server-owned; callers cannot replace any component at runtime.
do $$
declare
  v_permission_id uuid;
  v_module_id uuid;
begin
  select id into v_permission_id
  from identity.permissions
  where code='experience.guide.read'
    and resource='experience.guide'
    and action='read'
    and description='Read an authorized Experience Guide projection in the current Workspace';
  if v_permission_id is null then
    raise exception 'core_read_authority_permission_registry_mismatch' using errcode='22023';
  end if;

  select id into v_module_id
  from platform.module_definitions
  where code='experience_guides'
    and version=1
    and name='Experience Guides'
    and labels_json='{"ro":"Ghiduri","en":"Guides","fa":"راهنماها"}'::jsonb
    and description='Versioned Experience Guide authority profile'
    and category='services'
    and is_active=true
    and lifecycle_status='published'
    and sensitivity_level='sensitive'
    and requires_aal2=true
    and entitlement_key='module.experience_guides'
    and config_schema='{"type":"object","additionalProperties":false}'::jsonb
    and default_config='{}'::jsonb
    and valid_from<=statement_timestamp()
    and valid_to is null;
  if v_module_id is null then
    raise exception 'core_read_authority_module_registry_mismatch' using errcode='22023';
  end if;

  if (select count(*) from platform.module_permission_bindings
      where module_definition_id=v_module_id
        and permission_id=v_permission_id
        and binding_version=1
        and permission_mode='read'
        and is_assignable_to_local_role=true
        and is_delegable=false
        and requires_aal2=true
        and lifecycle_status='active'
        and valid_from<=statement_timestamp()
        and valid_to is null) <> 1 then
    raise exception 'core_read_authority_permission_binding_mismatch' using errcode='22023';
  end if;

  if exists(select 1 from identity.role_permissions where permission_id=v_permission_id)
     or exists(select 1 from platform.workspace_role_permissions where permission_id=v_permission_id)
     or exists(select 1 from platform.workspace_modules where module_code='experience_guides')
     or exists(select 1 from platform.workspace_entitlements
       where entitlement_key='module.experience_guides') then
    raise exception 'core_read_authority_profile_preexisting_activation_forbidden'
      using errcode='42501';
  end if;
end;
$$;

commit;
