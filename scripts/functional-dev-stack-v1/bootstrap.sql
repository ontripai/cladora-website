-- Fresh, owned local development DB ONLY. No application migration replay.
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer<>170011
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','platform_dev','platform','customer_api','storage'))
 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='functional_dev_fresh_target_required'; END IF;
END $guard$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE supabase_storage_admin LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT anon,authenticated TO authenticator;
GRANT anon,authenticated,service_role TO supabase_storage_admin;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin,supabase_storage_admin,authenticated;
ALTER ROLE supabase_auth_admin SET search_path=auth,extensions,public;
ALTER ROLE supabase_storage_admin SET search_path=storage,extensions,public;
-- Supabase provider compatibility, not Core current-authority implementation.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;
REVOKE ALL ON FUNCTION auth.uid(),auth.role(),auth.jwt() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role,supabase_storage_admin;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),auth.jwt() TO authenticated,service_role,supabase_storage_admin;
CREATE SCHEMA platform_dev;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA platform_dev FROM PUBLIC;
GRANT USAGE ON SCHEMA platform_dev TO authenticated;
CREATE TABLE platform_dev.workspaces(id uuid PRIMARY KEY,owner_id uuid NOT NULL,name text NOT NULL);
CREATE TABLE platform_dev.notes(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES platform_dev.workspaces,body text NOT NULL);
ALTER TABLE platform_dev.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_dev.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_workspace ON platform_dev.workspaces TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY own_note ON platform_dev.notes TO authenticated
USING(EXISTS(SELECT 1 FROM platform_dev.workspaces w WHERE w.id=workspace_id AND w.owner_id=auth.uid()))
WITH CHECK(EXISTS(SELECT 1 FROM platform_dev.workspaces w WHERE w.id=workspace_id AND w.owner_id=auth.uid()));
GRANT SELECT ON platform_dev.workspaces TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON platform_dev.notes TO authenticated;
CREATE TABLE platform_dev.install_receipt(contract text PRIMARY KEY);
INSERT INTO platform_dev.install_receipt VALUES ('platform-development-infrastructure-only.v1');
COMMIT;
