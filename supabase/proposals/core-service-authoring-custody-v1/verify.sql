-- No runtime row/claims/record payload is selected. Read-only metadata plan only.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s';
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,
 pg_get_userbyid(c.relowner) AS owner,c.relacl,
 (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='platform' AND c.relname='service_authoring_custody_v1';
SELECT p.oid::regprocedure::text AS identity,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.proconfig,p.proacl,
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='platform_dev' AND p.proname='prepare_service_offering_authoring_v1';
-- Positive native verify must additionally test concurrent cold preparation,
-- same-key original wire/hash, post-wait revoke/expiry, immutable metadata ACL,
-- rollback/unknown-commit recovery and the real SERVICE/C03 flow. Not performed.
ROLLBACK;
