-- Read-only exact poststate proposal; no business query or effect.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $verify$ DECLARE p pg_proc; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid='app_private.core_finance_monthly_checkpoint_v1(uuid,uuid,text,text,bigint,text,text,jsonb)'::regprocedure;
 IF encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>'ab0e17eab9bcd5fd5c1b50568f6c3e35923143e05e775466e411126089b62afc' OR p.prosecdef
 OR p.provolatile<>'v' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner)
 THEN RAISE EXCEPTION 'finance_checkpoint_poststate_mismatch' USING ERRCODE='55000'; END IF;
END $verify$;
ROLLBACK;
