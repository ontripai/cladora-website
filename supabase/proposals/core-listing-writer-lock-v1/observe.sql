-- Proposed bounded catalog observation ONLY; not executed. No function bodies/raw ACL.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
WITH wanted AS(SELECT * FROM(VALUES
('customer_api.claim_unit_invitation_v1(uuid,text)'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)'),
('customer_api.register_service_self_person_v1(jsonb)'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)')
)v(signature)), projected AS(
 SELECT w.signature,p.oid IS NOT NULL AS present,
  CASE WHEN p.oid IS NULL THEN NULL ELSE encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') END AS body_sha256,
  CASE WHEN p.oid IS NULL THEN NULL ELSE encode(sha256(convert_to((to_jsonb(p)-'prosrc')::text,'UTF8')),'hex') END AS metadata_sha256
 FROM wanted w LEFT JOIN pg_proc p ON p.oid=to_regprocedure(w.signature)
)
SELECT current_database() AS database_name,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
 current_setting('server_version_num') AS server_version_num,pg_backend_pid() AS observation_pid,
 jsonb_object_agg(signature,CASE WHEN present THEN 'present' ELSE 'absent' END) AS routine_presence,
 jsonb_object_agg(signature,metadata_sha256) AS routine_metadata,
 jsonb_object_agg(signature,body_sha256) AS routine_body_sha256
FROM projected;
ROLLBACK;
