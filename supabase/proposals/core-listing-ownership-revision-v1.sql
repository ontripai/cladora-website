-- Core-owned inactive canonical SOURCE revision proposal, NOT an installer.
-- No new relationship registry. No historical revision/backfill or authority grant.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $proposal_only$
BEGIN
 RAISE EXCEPTION 'core_listing_revision_adoption_not_admitted' USING ERRCODE='55000';
END
$proposal_only$;
-- An independently reviewed adoption must bind target/owner/ACL/exact source.
-- Do not remove this guard ad hoc or submit the following as an install payload.
DO $prestate$
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR EXISTS(SELECT 1 FROM pg_class WHERE oid IN
   ('portfolio.ownerships'::regclass,'portfolio.parties'::regclass,'identity.membership_parties'::regclass)
   AND relowner<>current_user::regrole)
  OR NOT has_schema_privilege(current_user,'app_private','CREATE')
  OR NOT has_function_privilege(current_user,'app_private.bump_canonical_authority_revision_v1()','EXECUTE')
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='portfolio.ownerships'::regclass
   AND tgname='customer_ownership_integrity' AND NOT tgisinternal AND tgenabled IN ('O','A')
   AND tgfoid='occupancy.enforce_customer_registry_integrity()'::regprocedure)
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='portfolio.ownerships'::regclass
   AND attname='native_revision_v1' AND NOT attisdropped)
  OR to_regprocedure('app_private.core_listing_ownership_revision_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND (
    (tgrelid='portfolio.ownerships'::regclass AND tgname IN ('aa_core_listing_epoch_v1','zz_core_listing_ownership_revision_v1'))
    OR(tgrelid IN ('portfolio.parties'::regclass,'identity.membership_parties'::regclass) AND tgname='aa_core_listing_epoch_v1')))
 THEN RAISE EXCEPTION 'core_listing_revision_prestate_unavailable' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app_private.canonical_authority_revision_v1 WHERE singleton) THEN
  RAISE EXCEPTION 'canonical_authority_revision_unavailable' USING ERRCODE='55000'; END IF;
END
$prestate$;

-- Existing rows remain NULL: no assertion of historical version1 is made.
-- New real INSERT is the first recorded revision, assigned by its writer trigger.
ALTER TABLE portfolio.ownerships ADD COLUMN native_revision_v1 bigint;
ALTER TABLE portfolio.ownerships ADD CONSTRAINT core_listing_ownership_revision_range_v1
 CHECK(native_revision_v1 IS NULL OR native_revision_v1 BETWEEN 1 AND 9007199254740991);

CREATE FUNCTION app_private.core_listing_ownership_revision_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $revision$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.native_revision_v1 IS NOT NULL THEN
   RAISE EXCEPTION 'core_listing_revision_caller_value_denied' USING ERRCODE='42501'; END IF;
  NEW.native_revision_v1:=1;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.native_revision_v1 IS DISTINCT FROM OLD.native_revision_v1 THEN
   RAISE EXCEPTION 'core_listing_revision_caller_value_denied' USING ERRCODE='42501'; END IF;
  IF OLD.native_revision_v1 IS NOT NULL
   AND (to_jsonb(NEW)-'native_revision_v1') IS DISTINCT FROM (to_jsonb(OLD)-'native_revision_v1') THEN
   IF OLD.native_revision_v1>=9007199254740991 THEN
    RAISE EXCEPTION 'core_listing_revision_exhausted' USING ERRCODE='55000'; END IF;
   NEW.native_revision_v1:=OLD.native_revision_v1+1;
  END IF;
  -- Unversioned historical rows remain unversioned even when updated.
  -- There is NO implicit adoption/backfill, even for a privileged writer.
 ELSE
  RAISE EXCEPTION 'core_listing_revision_trigger_misbound' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END
$revision$;
REVOKE ALL ON FUNCTION app_private.core_listing_ownership_revision_v1() FROM PUBLIC,anon,authenticated,service_role;

-- Epoch barrier precedes the statement's row locks. It reuses the CANONICAL
-- bump function, with its existing owner/ACL/security/search_path unchanged.
-- Null/failing singleton or serialization failure aborts source mutation too.
-- No per-row side ledger, parallel epoch or manual after-the-fact invalidation.
CREATE TRIGGER aa_core_listing_epoch_v1
 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.ownerships
 FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.ownerships ENABLE ALWAYS TRIGGER aa_core_listing_epoch_v1;
CREATE TRIGGER aa_core_listing_epoch_v1
 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.parties
 FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.parties ENABLE ALWAYS TRIGGER aa_core_listing_epoch_v1;
CREATE TRIGGER aa_core_listing_epoch_v1
 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON identity.membership_parties
 FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE identity.membership_parties ENABLE ALWAYS TRIGGER aa_core_listing_epoch_v1;
-- Existing customer_ownership_integrity sorts BEFORE zz_; it retains finalization,
-- tenant/period/share checks. A no-op UPDATE changes neither data nor revision.
CREATE TRIGGER zz_core_listing_ownership_revision_v1 BEFORE INSERT OR UPDATE ON portfolio.ownerships
 FOR EACH ROW EXECUTE FUNCTION app_private.core_listing_ownership_revision_v1();
ALTER TABLE portfolio.ownerships ENABLE ALWAYS TRIGGER zz_core_listing_ownership_revision_v1;

-- No roles/grants/policies, source row, automatic adoption, expiry/retention,
-- permission change, current authority result or consumer activation is created.
-- Final adoption needs exact protected definitions/default ACL comparison and
-- two-connection PG proof; this proposal does not claim that evidence.
ROLLBACK;
