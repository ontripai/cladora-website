-- PROPOSAL ONLY. Only after exact owned poststate/custody check, not blind repair.
-- The effective initial privileges and their owner grantor are restored.
-- The original NULL nspacl becomes an explicit equivalent owner ACL. No claim
-- of raw NULL restoration; no pg_catalog update to conceal the representation.
SET LOCAL ROLE supabase_storage_admin;
REVOKE USAGE ON SCHEMA storage FROM authenticated;
REVOKE USAGE ON SCHEMA storage FROM service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.buckets TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.buckets_analytics TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.iceberg_namespaces TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.iceberg_tables TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.objects TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE storage.s3_multipart_uploads_parts TO service_role;
