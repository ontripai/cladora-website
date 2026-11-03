-- PROPOSAL ONLY, NOT AUTHORIZED/EXECUTED. Not a standalone execution request.
-- plan.render prepends exact target, ACL/owner/RLS/function prestate guards and
-- wraps this body in one BEGIN/COMMIT; harness requires exact curated admission.
SET LOCAL ROLE supabase_storage_admin;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.buckets FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.buckets_analytics FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.iceberg_namespaces FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.iceberg_tables FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.objects FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.s3_multipart_uploads FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.s3_multipart_uploads_parts FROM service_role;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
