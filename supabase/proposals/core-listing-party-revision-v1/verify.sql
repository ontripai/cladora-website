BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE t text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='portfolio.parties'::regclass AND attname='native_revision_v1' AND atttypid='bigint'::regtype AND NOT attnotnull AND NOT attisdropped)
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='portfolio.parties'::regclass AND tgname='zz_core_listing_party_revision_v1' AND tgenabled='A'
    AND tgfoid='app_private.core_listing_ownership_revision_v1()'::regprocedure AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'listing_companion_revision_unavailable' USING ERRCODE='55000'; END IF;
 FOREACH t IN ARRAY ARRAY['properties','buildings','units','unit_specification_versions','unit_lineage_events'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('portfolio.'||t) AND tgname='aa_core_listing_source_epoch_v1' AND tgenabled='A'
   AND tgfoid='app_private.bump_canonical_authority_revision_v1()'::regprocedure AND NOT tgisinternal AND(tgtype&2)=2 AND(tgtype&1)=0)
  THEN RAISE EXCEPTION 'listing_companion_statement_invalidation_unavailable' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- Names/OIDs/trigger timing are necessary, NOT total writer-order or role proof.
 -- Compare both complete writer prosrc hashes to writer-pins.json after values;
 -- metadata/owner/ACL/defaults remain exact preimages. Missing proof => NOT_READY.
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('customer_api.record_core_unit_specification_v1(uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text)') AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']::text[] AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='6b66d8fe76c7dc6fa81e860de623a43e3fb79eb57a4efebd02f95ddcba1e87d2') THEN RAISE EXCEPTION 'listing_companion_writer_source_mismatch' USING ERRCODE='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('customer_api.record_core_unit_lineage_v1(uuid,uuid,uuid,text,uuid[],uuid[],text)') AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']::text[] AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='603f9f1f6215e8fcebb199c9f1d8ccbf5bf23165473e8649c6b164add6756e2f') THEN RAISE EXCEPTION 'listing_companion_writer_source_mismatch' USING ERRCODE='55000';END IF;
END $verify$;
ROLLBACK;
