begin;

-- The SERVICE registry was added after the initial universal module taxonomy
-- seed. Catalogue availability is independent of property/operating-model type,
-- matching the existing standard mapping for non-governance modules. The core
-- still validates the workspace's profile/model pair, entitlement and authority.
-- Existing explicit compatibility decisions must never be overwritten.
insert into platform.module_property_profile_compatibilities
  (module_definition_id, property_profile_id, compatibility_level, reason)
select m.id, p.id, 'compatible', 'SERVICE catalogue standard profile mapping v1'
from platform.module_definitions m cross join platform.property_profiles p
where m.code = 'services_catalog' and m.version = 1 and m.lifecycle_status = 'published'
on conflict (module_definition_id, property_profile_id) do nothing;

insert into platform.module_operating_model_compatibilities
  (module_definition_id, operating_model_id, compatibility_level, reason)
select m.id, o.id, 'compatible', 'SERVICE catalogue standard operating model mapping v1'
from platform.module_definitions m cross join platform.operating_models o
where m.code = 'services_catalog' and m.version = 1 and m.lifecycle_status = 'published'
on conflict (module_definition_id, operating_model_id) do nothing;

commit;
