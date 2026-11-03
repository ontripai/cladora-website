-- Insert ONLY at CORE_S01_PROOF_INSERTION_POINT, before capsule final ROLLBACK.
-- Source-only, no SQL executed by Core. Synthetic PG17 store proof, NOT Auth/application proof.
-- Requires admitted actual canonical-parent definition profile (no replacement/stub parents).
DO $proof$
DECLARE
 t1 uuid:='f0010000-0000-4000-8000-000000000001';t2 uuid:='f0010000-0000-4000-8000-000000000002';
 w1 uuid:='f0010000-0000-4000-8000-000000000003';w2 uuid:='f0010000-0000-4000-8000-000000000004';
 p1 uuid:='f0010000-0000-4000-8000-000000000005';p2 uuid:='f0010000-0000-4000-8000-000000000006';
 a uuid:='f0010000-0000-4000-8000-000000000007';result jsonb; n bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'core_s01_lab_fixture_principal_required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM platform.tenants WHERE id IN(t1,t2))
 OR EXISTS(SELECT 1 FROM platform.customer_workspaces WHERE id IN(w1,w2))
 OR EXISTS(SELECT 1 FROM portfolio.parties WHERE id IN(p1,p2))
 THEN RAISE EXCEPTION 'core_s01_fixture_collision' USING ERRCODE='55000'; END IF;
 -- Only FK/internal triggers permitted on the admitted parent definition profile.
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN('platform.tenants'::regclass,
  'platform.customer_workspaces'::regclass,'portfolio.parties'::regclass) AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'core_s01_parent_profile_not_admitted' USING ERRCODE='55000'; END IF;
 INSERT INTO platform.tenants(id,legal_name) VALUES(t1,'Synthetic S01 A'),(t2,'Synthetic S01 B');
 INSERT INTO portfolio.parties(id,tenant_id,type,legal_name) VALUES(p1,t1,'company','Synthetic provider A'),(p2,t2,'company','Synthetic provider B');
 INSERT INTO platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment)
 VALUES(w1,t1,'OWNER_PORTFOLIO','ACTIVE','platform','PILOT'),(w2,t2,'OWNER_PORTFOLIO','ACTIVE','platform','PILOT');
 result:=app_private.write_core_provider_agreement_v1('create',a,t1,w1,p1,0,'2026-01-01',NULL,ARRAY['service.request.create']);
 IF result IS DISTINCT FROM '{"version":1,"revision":1,"status":"effective"}'::jsonb THEN RAISE EXCEPTION 'core_s01_create_failed'; END IF;
 BEGIN
  UPDATE platform.customer_workspaces SET tenant_id=t2 WHERE id=w1;
  RAISE EXCEPTION 'core_s01_workspace_tenant_fk_missing' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '23503' THEN NULL; END;
 BEGIN
  UPDATE portfolio.parties SET tenant_id=t2 WHERE id=p1;
  RAISE EXCEPTION 'core_s01_party_tenant_fk_missing' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '23503' THEN NULL; END;
 BEGIN
  PERFORM app_private.write_core_provider_agreement_v1('create','f0010000-0000-4000-8000-000000000008',t1,w2,p1,0,'2026-01-01',NULL,ARRAY['service.request.create']);
  RAISE EXCEPTION 'core_s01_foreign_workspace_allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN
  PERFORM app_private.write_core_provider_agreement_v1('create','f0010000-0000-4000-8000-000000000008',t1,w1,p2,0,'2026-01-01',NULL,ARRAY['service.request.create']);
  RAISE EXCEPTION 'core_s01_foreign_party_allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 result:=app_private.write_core_provider_agreement_v1('append_version',a,t1,w1,p1,1,'2026-02-01','2027-01-01',ARRAY['service.request.create']);
 IF result IS DISTINCT FROM '{"version":2,"revision":2,"status":"effective"}'::jsonb THEN RAISE EXCEPTION 'core_s01_append_failed'; END IF;
 BEGIN
  PERFORM app_private.write_core_provider_agreement_v1('revoke',a,t1,w1,p1,1,NULL,NULL,NULL);
  RAISE EXCEPTION 'core_s01_stale_revision_allowed';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
 BEGIN
  UPDATE platform.provider_agreement_versions_v1 SET valid_until='2028-01-01' WHERE agreement_id=a AND version=1;
  RAISE EXCEPTION 'core_s01_mutable_version';
 EXCEPTION WHEN SQLSTATE '55000' THEN IF SQLERRM<>'core_s01_version_immutable' THEN RAISE; END IF; END;
 BEGIN
  DELETE FROM platform.provider_agreement_versions_v1 WHERE agreement_id=a;
  RAISE EXCEPTION 'core_s01_history_deleted';
 EXCEPTION WHEN SQLSTATE '55000' THEN IF SQLERRM<>'core_s01_version_immutable' THEN RAISE; END IF; END;
 BEGIN
  TRUNCATE platform.provider_agreement_heads_v1,platform.provider_agreement_versions_v1;
  RAISE EXCEPTION 'core_s01_history_truncated';
 EXCEPTION WHEN SQLSTATE '55000' THEN IF SQLERRM<>'core_s01_history_immutable' AND SQLERRM<>'core_s01_version_immutable' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO platform.provider_agreement_versions_v1 VALUES(a,t1,w1,p1,3,'2026-03-01',NULL,ARRAY['service.request.create']);
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'core_s01_unpublished_version_allowed';
 EXCEPTION WHEN SQLSTATE '55000' THEN IF SQLERRM<>'core_s01_unpublished_version' THEN RAISE; END IF; END;
 SET CONSTRAINTS ALL DEFERRED;
 result:=app_private.write_core_provider_agreement_v1('revoke',a,t1,w1,p1,2,NULL,NULL,NULL);
 IF result IS DISTINCT FROM '{"version":2,"revision":3,"status":"revoked"}'::jsonb THEN RAISE EXCEPTION 'core_s01_revoke_failed'; END IF;
 BEGIN
  PERFORM app_private.write_core_provider_agreement_v1('append_version',a,t1,w1,p1,3,'2026-03-01',NULL,ARRAY['service.request.create']);
  RAISE EXCEPTION 'core_s01_revoked_append_allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 SELECT count(*) INTO n FROM platform.provider_agreement_versions_v1 WHERE agreement_id=a;
 IF n<>2 THEN RAISE EXCEPTION 'core_s01_partial_write_residue'; END IF;
 SET CONSTRAINTS ALL IMMEDIATE;
END
$proof$;
SELECT jsonb_build_object('stage','CORE_S01_STORE_ASSERTIONS_REACHED','backend_pid',pg_backend_pid(),
 'auth_proof',false,'business_action',false,'settlement','ROLLBACK_ACK_STILL_REQUIRED');
