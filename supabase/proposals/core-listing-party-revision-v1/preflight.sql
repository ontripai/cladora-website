BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE b jsonb;
BEGIN
 b:=nullif(current_setting('cladora.listing_companion_adoption_v1',true),'')::jsonb;
 IF b IS NULL OR b->>'database_oid' IS DISTINCT FROM(SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR b->>'backend_marker' IS DISTINCT FROM(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')
  OR nullif(b->>'backend_marker','') IS NULL
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='portfolio.ownerships'::regclass AND attname='native_revision_v1' AND NOT attisdropped)
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='portfolio.parties'::regclass AND attname='native_revision_v1' AND NOT attisdropped)
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='portfolio.parties'::regclass AND relowner=current_user::regrole)
  OR to_regprocedure('app_private.core_listing_ownership_revision_v1()') IS NULL
 THEN RAISE EXCEPTION 'listing_companion_adoption_prestate_required' USING ERRCODE='55000'; END IF;
 -- Exact 97d7 writer/source/owner/default-ACL checks remain separate prerequisites.
 -- No partial adoption while other relevant writers/role paths remain unknown.
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('customer_api.record_core_unit_specification_v1(uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text)') AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']::text[] AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='df462dd04b1d8d26dfc67f51b7688bcb601cd7d6b99ec99da426e00a2f0d66d6') THEN RAISE EXCEPTION 'listing_companion_writer_source_mismatch' USING ERRCODE='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('customer_api.record_core_unit_lineage_v1(uuid,uuid,uuid,text,uuid[],uuid[],text)') AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']::text[] AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='34069f3cdb532bc93a9e959f996fc979d4626ae48f0946ec7ba378b4e9a262c4') THEN RAISE EXCEPTION 'listing_companion_writer_source_mismatch' USING ERRCODE='55000';END IF;
END $preflight$;
ROLLBACK;
