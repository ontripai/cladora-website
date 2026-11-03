-- core-functional-install.v1 / S01; isolated development admission required.
-- SOURCE_SHA256 42d2c96d7ac7e8a09aa2ecc60725054eb7c058ef471e64ea309add0a1bb72d50; history is independent, not applied original migration.
-- CORE S01 inactive definition capsule v1. NOT an automatic migration/installer.
-- Canonical-parent baseline and exact request admission are prerequisites.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog;
DO $install$
DECLARE defaults_before jsonb; defaults_after jsonb; n text;
BEGIN
 IF current_user <> 'postgres' OR session_user <> current_user
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('portfolio.parties'::regclass,'platform.customer_workspaces'::regclass)
    AND relowner <> current_user::regrole)
  OR NOT has_schema_privilege(current_user,'platform','CREATE')
  OR NOT has_schema_privilege(current_user,'app_private','CREATE')
 THEN RAISE EXCEPTION 'core_s01_definition_prestate_unavailable' USING ERRCODE='55000'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
  WHERE s.nspname='app_private' AND p.proname IN
  ('core_s01_head_guard_v1','core_s01_version_guard_v1','core_s01_version_link_v1','write_core_provider_agreement_v1'))
 OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE (s.nspname='platform' AND c.relname IN ('provider_agreement_heads_v1','provider_agreement_versions_v1','core_s01_workspace_tenant_key_v1','core_s01_heads_pk_v1','core_s01_head_tuple_key_v1','core_s01_versions_pk_v1'))
     OR (s.nspname='portfolio' AND c.relname='core_s01_party_tenant_key_v1'))

 OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace s ON s.oid=t.typnamespace WHERE s.nspname='platform' AND t.typname IN
 ('provider_agreement_heads_v1','_provider_agreement_heads_v1','provider_agreement_versions_v1','_provider_agreement_versions_v1')) THEN RAISE EXCEPTION 'core_s01_definition_collision' USING ERRCODE='55000'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) INTO defaults_before FROM pg_default_acl d;

 -- Additional redundant unique keys on canonical parents enable REAL composite FKs.
 -- Existing id PK implies pair uniqueness but the pair constraint is still needed by PG.
 ALTER TABLE portfolio.parties ADD CONSTRAINT core_s01_party_tenant_key_v1 UNIQUE(id,tenant_id);
 ALTER TABLE platform.customer_workspaces ADD CONSTRAINT core_s01_workspace_tenant_key_v1 UNIQUE(id,tenant_id);
 CREATE TABLE platform.provider_agreement_heads_v1 (
  id uuid CONSTRAINT core_s01_heads_pk_v1 PRIMARY KEY,
  tenant_id uuid NOT NULL CONSTRAINT core_s01_tenant_fk_v1 REFERENCES platform.tenants(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL,
  provider_party_id uuid NOT NULL,
  current_version integer NOT NULL CONSTRAINT core_s01_head_version_positive_v1 CHECK(current_version>0),
  revision bigint NOT NULL CONSTRAINT core_s01_revision_positive_v1 CHECK(revision>0 AND revision<=9007199254740991),
  status text NOT NULL CONSTRAINT core_s01_status_v1 CHECK(status IN ('effective','suspended','revoked')),
  CONSTRAINT core_s01_workspace_tenant_fk_v1 FOREIGN KEY(workspace_id,tenant_id)
   REFERENCES platform.customer_workspaces(id,tenant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT core_s01_party_tenant_fk_v1 FOREIGN KEY(provider_party_id,tenant_id)
   REFERENCES portfolio.parties(id,tenant_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT core_s01_head_tuple_key_v1 UNIQUE(id,tenant_id,workspace_id,provider_party_id)
 );
 REVOKE ALL ON TABLE platform.provider_agreement_heads_v1 FROM PUBLIC,anon,authenticated,service_role;
 ALTER TABLE platform.provider_agreement_heads_v1 ENABLE ROW LEVEL SECURITY;
 ALTER TABLE platform.provider_agreement_heads_v1 FORCE ROW LEVEL SECURITY;
 CREATE TABLE platform.provider_agreement_versions_v1 (
  agreement_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  provider_party_id uuid NOT NULL,
  version integer NOT NULL CONSTRAINT core_s01_version_positive_v1 CHECK(version>0),
  valid_from date NOT NULL,
  valid_until date,
  allowed_service_scope text[] NOT NULL,
  CONSTRAINT core_s01_versions_pk_v1 PRIMARY KEY(agreement_id,version),
  CONSTRAINT core_s01_version_tuple_fk_v1 FOREIGN KEY(agreement_id,tenant_id,workspace_id,provider_party_id)
   REFERENCES platform.provider_agreement_heads_v1(id,tenant_id,workspace_id,provider_party_id)
   ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT core_s01_dates_v1 CHECK(valid_until IS NULL OR valid_until>valid_from),
  CONSTRAINT core_s01_scopes_v1 CHECK(cardinality(allowed_service_scope) BETWEEN 1 AND 64)
 );
 REVOKE ALL ON TABLE platform.provider_agreement_versions_v1 FROM PUBLIC,anon,authenticated,service_role;
 ALTER TABLE platform.provider_agreement_versions_v1 ENABLE ROW LEVEL SECURITY;
 ALTER TABLE platform.provider_agreement_versions_v1 FORCE ROW LEVEL SECURITY;
 ALTER TABLE platform.provider_agreement_heads_v1 ADD CONSTRAINT core_s01_current_version_fk_v1
  FOREIGN KEY(id,current_version) REFERENCES platform.provider_agreement_versions_v1(agreement_id,version)
  DEFERRABLE INITIALLY DEFERRED;

 CREATE FUNCTION app_private.core_s01_head_guard_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $head$
 BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'core_s01_history_immutable' USING ERRCODE='55000'; END IF;
  IF TG_OP='INSERT' THEN
   -- Same parent order as the writer/reader. FKs enforce tenant even for privileged DML.
   PERFORM 1 FROM portfolio.parties WHERE id=NEW.provider_party_id AND tenant_id=NEW.tenant_id AND archived_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'core_s01_party_unavailable' USING ERRCODE='42501'; END IF;
   PERFORM 1 FROM platform.customer_workspaces WHERE id=NEW.workspace_id AND tenant_id=NEW.tenant_id
    AND archived_at IS NULL AND lifecycle_status='ACTIVE' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'core_s01_workspace_unavailable' USING ERRCODE='42501'; END IF;
   IF NEW.current_version<>1 OR NEW.revision<>1 OR NEW.status<>'effective' THEN
    RAISE EXCEPTION 'core_s01_initial_version_invalid' USING ERRCODE='55000'; END IF;
  ELSE
   IF (NEW.id,NEW.tenant_id,NEW.workspace_id,NEW.provider_party_id) IS DISTINCT FROM
      (OLD.id,OLD.tenant_id,OLD.workspace_id,OLD.provider_party_id)
    OR NEW.revision IS DISTINCT FROM OLD.revision+1
    OR NEW.current_version NOT IN (OLD.current_version,OLD.current_version+1)
    OR (OLD.status='revoked' AND (NEW.status<>'revoked' OR NEW.current_version<>OLD.current_version))
    OR (OLD.status='suspended' AND NEW.status='effective')
    OR (NEW.status=OLD.status AND NEW.current_version=OLD.current_version)
   THEN RAISE EXCEPTION 'core_s01_head_transition_invalid' USING ERRCODE='55000'; END IF;
  END IF;
  RETURN NEW;
 END
 $head$;
 REVOKE ALL ON FUNCTION app_private.core_s01_head_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
 CREATE TRIGGER core_s01_head_guard BEFORE INSERT OR UPDATE OR DELETE ON platform.provider_agreement_heads_v1
  FOR EACH ROW EXECUTE FUNCTION app_private.core_s01_head_guard_v1();
 CREATE TRIGGER core_s01_head_truncate_guard BEFORE TRUNCATE ON platform.provider_agreement_heads_v1
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.core_s01_head_guard_v1();

 CREATE FUNCTION app_private.core_s01_version_guard_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $version$
 DECLARE h platform.provider_agreement_heads_v1%ROWTYPE;
 BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'core_s01_version_immutable' USING ERRCODE='55000'; END IF;
  SELECT * INTO STRICT h FROM platform.provider_agreement_heads_v1 WHERE id=NEW.agreement_id FOR UPDATE;
  IF (NEW.tenant_id,NEW.workspace_id,NEW.provider_party_id) IS DISTINCT FROM
     (h.tenant_id,h.workspace_id,h.provider_party_id)
   OR h.status='revoked'
   OR NOT ((NEW.version=1 AND h.current_version=1 AND NOT EXISTS
        (SELECT 1 FROM platform.provider_agreement_versions_v1 WHERE agreement_id=h.id))
      OR NEW.version=h.current_version+1)
   OR array_ndims(NEW.allowed_service_scope) IS DISTINCT FROM 1
   OR EXISTS (SELECT 1 FROM unnest(NEW.allowed_service_scope) code
      WHERE code IS NULL OR code !~ '^[a-z0-9_.:-]{1,128}$')
   OR (SELECT count(*) FROM unnest(NEW.allowed_service_scope) code) <>
      (SELECT count(DISTINCT code) FROM unnest(NEW.allowed_service_scope) code)
  THEN RAISE EXCEPTION 'core_s01_version_tuple_invalid' USING ERRCODE='55000'; END IF;
  RETURN NEW;
 END
 $version$;
 REVOKE ALL ON FUNCTION app_private.core_s01_version_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
 CREATE TRIGGER core_s01_version_guard BEFORE INSERT OR UPDATE OR DELETE ON platform.provider_agreement_versions_v1
  FOR EACH ROW EXECUTE FUNCTION app_private.core_s01_version_guard_v1();
 CREATE TRIGGER core_s01_version_truncate_guard BEFORE TRUNCATE ON platform.provider_agreement_versions_v1
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.core_s01_version_guard_v1();

 CREATE FUNCTION app_private.core_s01_version_link_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $link$
 BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform.provider_agreement_heads_v1 h
   WHERE h.id=NEW.agreement_id AND h.tenant_id=NEW.tenant_id AND h.workspace_id=NEW.workspace_id
    AND h.provider_party_id=NEW.provider_party_id AND h.current_version>=NEW.version) THEN
   RAISE EXCEPTION 'core_s01_unpublished_version' USING ERRCODE='55000'; END IF;
  RETURN NULL;
 END
 $link$;
 REVOKE ALL ON FUNCTION app_private.core_s01_version_link_v1() FROM PUBLIC,anon,authenticated,service_role;
 CREATE CONSTRAINT TRIGGER core_s01_version_link AFTER INSERT ON platform.provider_agreement_versions_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.core_s01_version_link_v1();

 -- Closed administrative source writer, NOT a customer command/RPC or permission grant.
 -- Existing server command authority/admission must be bound separately before use.
 CREATE FUNCTION app_private.write_core_provider_agreement_v1(
  p_action text,p_id uuid,p_tenant uuid,p_workspace uuid,p_party uuid,p_expected_revision bigint,
  p_start date,p_end date,p_scopes text[]
 ) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $writer$
 DECLARE h platform.provider_agreement_heads_v1%ROWTYPE; next_version integer;
 BEGIN
  IF p_action IS NULL OR p_action NOT IN ('create','append_version','suspend','revoke')
   OR p_id IS NULL OR p_tenant IS NULL OR p_workspace IS NULL OR p_party IS NULL
   OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
   RAISE EXCEPTION 'core_s01_writer_input_invalid' USING ERRCODE='22023'; END IF;
  -- No SET ROLE, DEFINER, fallback, auxiliary connection, receipt, audit or outbox.
  PERFORM 1 FROM portfolio.parties WHERE id=p_party AND tenant_id=p_tenant AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core_s01_party_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM platform.customer_workspaces WHERE id=p_workspace AND tenant_id=p_tenant
   AND archived_at IS NULL AND lifecycle_status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'core_s01_workspace_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO h FROM platform.provider_agreement_heads_v1 WHERE id=p_id FOR UPDATE;
  IF p_action='create' THEN
   IF FOUND OR p_expected_revision<>0 THEN RAISE EXCEPTION 'core_s01_revision_conflict' USING ERRCODE='40001'; END IF;
   INSERT INTO platform.provider_agreement_heads_v1 VALUES(p_id,p_tenant,p_workspace,p_party,1,1,'effective');
   INSERT INTO platform.provider_agreement_versions_v1 VALUES(p_id,p_tenant,p_workspace,p_party,1,p_start,p_end,p_scopes);
  ELSE
   IF NOT FOUND OR (h.tenant_id,h.workspace_id,h.provider_party_id) IS DISTINCT FROM (p_tenant,p_workspace,p_party)
     OR h.revision<>p_expected_revision THEN RAISE EXCEPTION 'core_s01_revision_conflict' USING ERRCODE='40001'; END IF;
   IF p_action='append_version' THEN
    IF h.status='revoked' THEN RAISE EXCEPTION 'core_s01_agreement_revoked' USING ERRCODE='42501'; END IF;
    next_version:=h.current_version+1;
    INSERT INTO platform.provider_agreement_versions_v1 VALUES(p_id,p_tenant,p_workspace,p_party,next_version,p_start,p_end,p_scopes);
    UPDATE platform.provider_agreement_heads_v1 SET current_version=next_version,revision=revision+1 WHERE id=p_id;
   ELSIF p_action='revoke' AND h.status<>'revoked' THEN
    UPDATE platform.provider_agreement_heads_v1 SET status='revoked',revision=revision+1 WHERE id=p_id;
   ELSIF p_action='suspend' AND h.status='effective' THEN
    UPDATE platform.provider_agreement_heads_v1 SET status='suspended',revision=revision+1 WHERE id=p_id;
   END IF;
  END IF;
  -- Deferred current-version FK must be satisfied inside this call, not repaired later.
  IF NOT EXISTS (SELECT 1 FROM platform.provider_agreement_heads_v1 x JOIN platform.provider_agreement_versions_v1 v
    ON v.agreement_id=x.id AND v.version=x.current_version AND v.tenant_id=x.tenant_id
      AND v.workspace_id=x.workspace_id AND v.provider_party_id=x.provider_party_id WHERE x.id=p_id) THEN
   RAISE EXCEPTION 'core_s01_current_version_missing' USING ERRCODE='55000'; END IF;
  SELECT * INTO STRICT h FROM platform.provider_agreement_heads_v1 WHERE id=p_id;
  RETURN jsonb_build_object('version',h.current_version,'revision',h.revision,'status',h.status);
 END
 $writer$;
 REVOKE ALL ON FUNCTION app_private.write_core_provider_agreement_v1(text,uuid,uuid,uuid,uuid,bigint,date,date,text[])
  FROM PUBLIC,anon,authenticated,service_role;

 -- No runtime policy: FORCE RLS plus zero policy/positive ACL is deny-default.
 IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('platform.provider_agreement_heads_v1'::regclass,
   'platform.provider_agreement_versions_v1'::regclass) AND
   (NOT relrowsecurity OR NOT relforcerowsecurity OR relowner<>current_user::regrole))
 OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN
   ('platform.provider_agreement_heads_v1'::regclass,'platform.provider_agreement_versions_v1'::regclass))
 THEN RAISE EXCEPTION 'core_s01_closed_rls_invariant' USING ERRCODE='55000'; END IF;
 FOREACH n IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=n) AND (
    has_function_privilege(n,'app_private.write_core_provider_agreement_v1(text,uuid,uuid,uuid,uuid,bigint,date,date,text[])','EXECUTE')
    OR has_table_privilege(n,'platform.provider_agreement_heads_v1','SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER')
    OR has_table_privilege(n,'platform.provider_agreement_versions_v1','SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER'))
  THEN RAISE EXCEPTION 'core_s01_unexpected_effective_acl' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
  WHERE s.nspname='app_private' AND p.proname IN
  ('core_s01_head_guard_v1','core_s01_version_guard_v1','core_s01_version_link_v1','write_core_provider_agreement_v1')
  AND p.proowner=current_user::regrole AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']::text[])<>4
 THEN RAISE EXCEPTION 'core_s01_function_owner_or_path' USING ERRCODE='55000'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
   CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE s.nspname='app_private' AND p.proname IN
   ('core_s01_head_guard_v1','core_s01_version_guard_v1','core_s01_version_link_v1','write_core_provider_agreement_v1')
   AND (a.grantee=0 OR a.grantee<>current_user::regrole)) THEN
  RAISE EXCEPTION 'core_s01_unexpected_function_acl' USING ERRCODE='55000'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE c.oid IN ('platform.provider_agreement_heads_v1'::regclass,'platform.provider_agreement_versions_v1'::regclass)
  AND a.grantee<>current_user::regrole) THEN RAISE EXCEPTION 'core_s01_unexpected_table_acl' USING ERRCODE='55000'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) INTO defaults_after FROM pg_default_acl d;
 IF defaults_after IS DISTINCT FROM defaults_before THEN RAISE EXCEPTION 'core_s01_default_acl_delta' USING ERRCODE='55000'; END IF;
END
$install$;
-- Explicit capsule boundary: a future admitted proof inserts test SQL here.
-- END_CORE15_S01_INSTALL_UNIT
COMMIT;
