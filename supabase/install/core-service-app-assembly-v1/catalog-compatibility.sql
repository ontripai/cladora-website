-- Canonical source SHA256 82950fd3bafae37ca215f781b6a9e9fab8dfc319a1f7b6de7d602cc373d0060e; body preserved, historical source unchanged.
BEGIN;
SET LOCAL search_path=pg_catalog;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
DO $pre$ BEGIN
 IF current_user<>'cladora_core_installer' OR session_user<>current_user OR current_database()<>'postgres'
 OR current_setting('server_version_num')::int<>170011 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'core_assembly_registry_profile' USING ERRCODE='55000';END IF;
 CREATE TEMP TABLE assembly_registry_defaults ON COMMIT DROP AS TABLE pg_default_acl;
END $pre$;


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


DO $post$ BEGIN
 IF EXISTS((TABLE pg_default_acl EXCEPT TABLE assembly_registry_defaults) UNION ALL(TABLE assembly_registry_defaults EXCEPT TABLE pg_default_acl))
 THEN RAISE EXCEPTION 'core_assembly_registry_defaults' USING ERRCODE='55000';END IF;
END $post$;
COMMIT;
