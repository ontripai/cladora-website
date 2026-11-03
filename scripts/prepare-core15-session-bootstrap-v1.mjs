/** Exact canonical C01 session guard extraction; no SQL parser or execution. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('supabase/install/v14-operations/building-provisioning.sql',root),'utf8');
const start=source.indexOf('create function app_private.require_request_session_current_at_v1(');
const end=source.indexOf('\n$function$;',start)+'\n$function$;'.length;
assert.ok(start>0&&end>start);
const original=source.slice(start,end),definition=original.replace('create function app_private.','create function core_runtime.');
assert.equal(definition.replace('create function core_runtime.','create function app_private.'),original);
const sql=`-- Core15 FIRST native cut: canonical authenticated-session guard ONLY.
-- Not Context authority, C03, S01, product activation or a replacement ledger.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $admit$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer<>170011
  OR current_setting('cladora.core15.owned_backend',true) IS NULL
  OR current_setting('cladora.core15.owned_backend',true)!~'^core15-dev:[a-f0-9]{32}$'
  OR to_regnamespace('core_runtime') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('cladora_core_runtime','cladora_core_session_owner'))
 THEN RAISE EXCEPTION 'core15_session_bootstrap_prestate_mismatch' USING ERRCODE='55000'; END IF;
 CREATE TEMP TABLE core15_defaults_before ON COMMIT DROP AS SELECT * FROM pg_default_acl;
END $admit$;
CREATE ROLE cladora_core_session_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE cladora_core_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA core_runtime AUTHORIZATION cladora_core_session_owner;
REVOKE ALL ON SCHEMA core_runtime FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA core_runtime TO cladora_core_runtime;
GRANT USAGE ON SCHEMA auth TO cladora_core_session_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO cladora_core_session_owner;
GRANT SELECT(id,user_id,not_after),UPDATE(id) ON auth.sessions TO cladora_core_session_owner;
-- SOURCE function SHA256 ${createHash('sha256').update(original).digest('hex')}; body/header unchanged except private namespace.
${definition}
ALTER FUNCTION core_runtime.require_request_session_current_at_v1(timestamptz) OWNER TO cladora_core_session_owner;
REVOKE ALL ON FUNCTION core_runtime.require_request_session_current_at_v1(timestamptz) FROM PUBLIC,anon,authenticated,service_role,cladora_core_runtime;
CREATE FUNCTION core_runtime.lock_request_session_v1() RETURNS TABLE(actor_id uuid,aal text,checked_at text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $locked$
DECLARE actor uuid; sid uuid; at_time timestamptz;
BEGIN
 PERFORM core_runtime.require_request_session_current_at_v1(clock_timestamp());
 actor:=auth.uid();sid:=(auth.jwt()->>'session_id')::uuid;
 PERFORM 1 FROM auth.sessions s WHERE s.id=sid AND s.user_id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_session_not_current' USING ERRCODE='42501'; END IF;
 at_time:=clock_timestamp();
 PERFORM core_runtime.require_request_session_current_at_v1(at_time);
 RETURN QUERY SELECT actor,auth.jwt()->>'aal',to_char(at_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
END $locked$;
ALTER FUNCTION core_runtime.lock_request_session_v1() OWNER TO cladora_core_session_owner;
REVOKE ALL ON FUNCTION core_runtime.lock_request_session_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION core_runtime.lock_request_session_v1() TO cladora_core_runtime;
-- CORE15_PRIVATE_RUNTIME_PASSWORD_BINDING
DO $close$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('cladora_core_runtime','cladora_core_session_owner')
  AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN ('cladora_core_runtime'::regrole,'cladora_core_session_owner'::regrole))
  OR has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT')
  OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.pronamespace='core_runtime'::regnamespace AND a.grantee<>p.proowner
    AND NOT(p.oid='core_runtime.lock_request_session_v1()'::regprocedure AND a.grantee='cladora_core_runtime'::regrole AND a.privilege_type='EXECUTE'))
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_defaults_before)
    UNION ALL (TABLE core15_defaults_before EXCEPT TABLE pg_default_acl))
 THEN RAISE EXCEPTION 'core15_session_bootstrap_closed_acl_mismatch' USING ERRCODE='55000'; END IF;
END $close$;
COMMIT;
`;
const path=new URL('supabase/install/core-functional-runtime-v1/04-session-bootstrap.sql',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(path,'utf8'),sql);else writeFileSync(path,sql);
console.log(JSON.stringify({source_function_bytes:Buffer.byteLength(original),source_function_sha256:createHash('sha256').update(original).digest('hex'),bytes:Buffer.byteLength(sql),sha256:createHash('sha256').update(sql).digest('hex'),native:'NOT_RUN_BY_GENERATOR'}));
