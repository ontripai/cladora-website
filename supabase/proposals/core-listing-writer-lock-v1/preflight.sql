-- READ-ONLY source/owner privilege gate; NOT executed by generation.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $check$
DECLARE e jsonb; r record; p pg_proc; owner_role pg_roles; epoch pg_class;
BEGIN
 e:=nullif(current_setting('cladora.listing_writer_target_v1',true),'')::jsonb;
 IF e IS NULL OR e->>'database_name' IS DISTINCT FROM current_database()
  OR e->>'database_oid' IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'listing_writer_target_unbound' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT epoch FROM pg_class WHERE oid='app_private.canonical_authority_revision_v1'::regclass;
 FOR r IN SELECT * FROM(VALUES
('customer_api.claim_unit_invitation_v1(uuid,text)','50ca5c4f3faf03cfac8306179f7eb43c2c7e8ac43872a70633038dd0ccabc437'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)','cd59f8cb0b982055876208c07ba67e2cb8ea3491ef890a3c0dc5921806fef094'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)','b59484b294f4db837f88a9d146e094e2196b39bd8604fe480795f4448bd06393'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)','767a3fc6993a843ab56973247bf8aa3544da57e2e5df53b12df2151c95210f98'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)','bbbe914c9e5a3709e7295392133de92cbaddf582fdee9737550812e0dd1885ac'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','33159166ecb28bb65adbaf292a08973fa5d6d32a7cb70b38c535d98fced3b6c4'),
('customer_api.register_service_self_person_v1(jsonb)','810c77770a9cf8e68d8fe144fd50a505e83a8904462afd3f8c56ac624718d7cf'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)','2e9e73ed771c163d25525508d877a77d25d3da5dba2eccf9d1a24abc17721136')
 )v(signature,body_sha256) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND THEN
   IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'absent' THEN
    RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
   CONTINUE;
  END IF;
  IF e->'routine_presence'->>r.signature IS DISTINCT FROM 'present' THEN
   RAISE EXCEPTION 'listing_writer_presence_unbound' USING ERRCODE='55000'; END IF;
  IF encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.body_sha256
   OR NOT p.prosecdef OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   OR NOT pg_has_role(current_user,p.proowner,'USAGE')
  THEN RAISE EXCEPTION 'listing_writer_source_or_owner_mismatch' USING ERRCODE='55000'; END IF;
  SELECT * INTO STRICT owner_role FROM pg_roles WHERE oid=p.proowner;
  IF NOT has_schema_privilege(owner_role.oid,'app_private','USAGE')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'singleton','SELECT')
   OR NOT has_column_privilege(owner_role.oid,epoch.oid,'revision','UPDATE')
   OR (epoch.relrowsecurity AND NOT(owner_role.rolsuper OR owner_role.rolbypassrls
     OR(epoch.relowner=owner_role.oid AND NOT epoch.relforcerowsecurity)))
  THEN RAISE EXCEPTION 'listing_writer_epoch_privilege_or_rls_not_proven' USING ERRCODE='55000'; END IF;
  -- Private admitted snapshot of ALL non-body catalog attributes, not only ACL.
  IF e->'routine_metadata'->>r.signature IS DISTINCT FROM
   encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'listing_writer_metadata_unbound' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM app_private.canonical_authority_revision_v1 WHERE singleton) THEN
  RAISE EXCEPTION 'canonical_authority_revision_unavailable' USING ERRCODE='55000'; END IF;
END
$check$;
ROLLBACK;
