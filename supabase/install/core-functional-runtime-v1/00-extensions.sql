-- Owned development prerequisite only. No managed Auth ACL/default changes.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $extensions$
DECLARE e text; v text;
BEGIN
 IF current_database()!~'^cladora_dev_[a-z0-9_]+$' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR NOT has_database_privilege(current_user,current_database(),'CREATE')
 THEN RAISE EXCEPTION 'core15_extension_admission_required' USING ERRCODE='55000'; END IF;
 IF to_regnamespace('extensions') IS NULL THEN CREATE SCHEMA extensions AUTHORIZATION postgres;
 ELSIF (SELECT nspowner FROM pg_namespace WHERE nspname='extensions')<>current_user::regrole
  THEN RAISE EXCEPTION 'core15_extension_namespace_owner_mismatch' USING ERRCODE='55000'; END IF;
 FOR e,v IN VALUES ('pgcrypto','1.3'),('btree_gist','1.7') LOOP
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname=e) THEN
   IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname=e AND extversion=v AND extnamespace='extensions'::regnamespace)
    THEN RAISE EXCEPTION 'core15_extension_preimage_mismatch' USING ERRCODE='55000'; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM pg_available_extension_versions WHERE name=e AND version=v)
    THEN RAISE EXCEPTION 'core15_extension_version_unavailable' USING ERRCODE='55000'; END IF;
   EXECUTE format('CREATE EXTENSION %I WITH SCHEMA extensions VERSION %L',e,v);
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto' AND extversion='1.3' AND extnamespace='extensions'::regnamespace)
  OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist' AND extversion='1.7' AND extnamespace='extensions'::regnamespace)
 THEN RAISE EXCEPTION 'core15_extension_poststate_mismatch' USING ERRCODE='55000'; END IF;
END
$extensions$;
COMMIT;
