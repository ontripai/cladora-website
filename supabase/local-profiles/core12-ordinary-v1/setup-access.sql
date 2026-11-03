-- INACTIVE SOURCE. Global DB ACL only for these two fresh synthetic roles.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
REVOKE ALL ON DATABASE core_sqlstate_boundary_proof FROM PUBLIC;
GRANT CONNECT,TEMPORARY ON DATABASE core_sqlstate_boundary_proof TO core12_boundary_executor;
GRANT CONNECT ON DATABASE core_sqlstate_boundary_proof TO core12_boundary_observer;
COMMIT;
