-- Core15 FIRST native cut: canonical authenticated-session guard ONLY.
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
-- SOURCE function SHA256 e8ce81dd11e55a66c74ccab8a871a81ac165f547e3aa7110a78a22d5e780d50e; body/header unchanged except private namespace.
create function core_runtime.require_request_session_current_at_v1(p_checked_at timestamptz)
returns void
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
 v_actor uuid; v_claims jsonb; v_session uuid; v_expiry numeric;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_session_not_current';
 end if;
 begin
  v_actor:=auth.uid(); v_claims:=auth.jwt();
  if v_actor is null or pg_catalog.jsonb_typeof(v_claims) is distinct from 'object'
   or pg_catalog.jsonb_typeof(v_claims->'exp') is distinct from 'number'
   or v_claims->>'role' is distinct from 'authenticated'
   or (v_claims->>'sub')::uuid is distinct from v_actor
   or v_claims->>'aal' not in ('aal1','aal2') or v_claims->>'aal' is null then
   raise exception using errcode='42501',message='request_session_not_current';
  end if;
  v_session:=(v_claims->>'session_id')::uuid;
  v_expiry:=(v_claims->>'exp')::numeric;
  if v_session is null or v_expiry is null or v_expiry::text in ('NaN','Infinity','-Infinity')
   or v_expiry<=extract(epoch from p_checked_at)
   or not exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=v_actor
    and (s.not_after is null or (pg_catalog.isfinite(s.not_after) and s.not_after>p_checked_at))) then
   raise exception using errcode='42501',message='request_session_not_current';
  end if;
 exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='42501',message='request_session_not_current';
 end;
end;
$function$;
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
