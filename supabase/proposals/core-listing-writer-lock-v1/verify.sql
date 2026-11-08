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
('customer_api.claim_unit_invitation_v1(uuid,text)','bffb832c8923e42276f12152dc623dc0f6dbcb291ca99199aac92d742bfa58cb'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)','5437a455c8cfa211ac27d51013ac84627b1e74dcd3df711ad606a2822a792235'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)','2548431b9d3c32b824866f94710ae9ec8965403fd4963737a427870ef1826ea4'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)','c44286bde2a7c3a1e2166e7915ddfe1a945fa013e3f2a245451db09cd3b55e48'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)','bd38dc429d45aa7a8f8e63c28c06669433856587bed629aac714fb64fee16d34'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','797ee8c505e91c21f0c56c57eb7e4fa0388e435a8f278c9899538f7480ace0b6'),
('customer_api.register_service_self_person_v1(jsonb)','21714085b2d584d20258131555a9c66a255cfa921691b155bc53c8585e97966a'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)','9a4449033c20761ab5c2db4e115218e5c6754afc9949ab1deaf4ffcc198209c0')
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
