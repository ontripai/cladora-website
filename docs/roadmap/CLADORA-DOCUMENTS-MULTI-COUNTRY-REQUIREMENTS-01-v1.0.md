# DOCUMENTS-MULTI-COUNTRY-REQUIREMENTS-01

Status: discovery complete; proposed inactive contract; documentation only.

Owner: Documents & Vault.

Repository baseline: `main@f6ca01378f1f56f4c4233b69777f04704db053b9`.

The proposed consumer contract is
[CLADORA-DOCUMENTS-COUNTRY-REQUIREMENTS-v1.0.md](../contracts/CLADORA-DOCUMENTS-COUNTRY-REQUIREMENTS-v1.0.md).

## 1. Discovery result

The repository has canonical foundations for exact Property jurisdiction,
versioned Country Pack domain identity, Workspace-bound immutable Documents,
scan/lifecycle validation, retention snapshots and legal holds. It does not
have a Documents country-requirements artifact, canonical artifact-byte
resolver, signature/notarization/legalization model, translation-evidence
model, or storage-residency attestation model.

The safe design is therefore an inactive Documents consumer of the Core
jurisdiction profile selector plus an immutable, Core-identified
`documents.requirements` artifact. Country Pack rules remain requirement
metadata. Actual document facts remain in Vault and actual financial, tax and
storage facts remain with their canonical owners.

No real country requirement, rate, retention period, signature rule, language
rule or storage-region rule is asserted by this package.

## 2. Current path inventory

| Surface | Current repository path | Current behavior and design consequence |
| --- | --- | --- |
| Explicit country source | `portfolio.addresses.country_code`; `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql` | New addresses require explicit ISO alpha-2 country. The old default is removed. Locale, currency, Tenant and Workspace are forbidden inference sources. |
| Property/Workspace jurisdiction | `platform.property_jurisdiction_assignments` in the same Core migration | Binds one exact Property and canonical Workspace to a versioned profile; source rows, country and profile manifest are guarded and historical assignments are immutable. |
| Profile/domain identity | `platform.jurisdiction_profiles` and `platform.jurisdiction_profile_domains` | Profile version, manifest SHA-256, domain contract version, artifact SHA-256 and effective periods exist. Domain rows are immutable after insert. No domain artifact bytes are stored here. |
| Canonical Core selector | `src/lib/core/jurisdiction-profile-selector-v1.ts`; `docs/contracts/CLADORA-CORE-JURISDICTION-PROFILE-SELECTOR-v1.0.md` | `selectCurrentPropertyJurisdictionProfileV1` runs in `CoreTransactionScopeV1`, rechecks authority after locks, requires exact current Workspace/Property/country/profile/domain state and returns status-only metadata. It selects current time, not an arbitrary historical effective date. |
| Documents canonical truth | `documents.documents`, `documents.document_versions`, permissions, links and scan attestations | Exact Workspace, immutable version, scan and lifecycle are canonical. Historical NULL Workspace remains fail-closed. No Country Pack data belongs in these rows. |
| Canonical new-document writer | `src/lib/customer/documents-workspace-binding-writer-v1.ts` | Inactive Core-host provider accepts explicit Workspace, verifies the non-overwritable object before the SQL transaction, inserts one Workspace binding and immutable version, and supports current-state replay. It does not accept Property or Country Pack requirements today. |
| Creation closure | `supabase/migrations/20261014200948_document_null_workspace_creation_closure_v1.sql` | New unbound intent/document INSERT is rejected; historical NULL rows are unchanged; NULL-to-Workspace and Workspace rebind remain forbidden. |
| Legacy upload HTTP/RPC | `src/app/api/customer/v1/documents/upload-intent/route.ts`, `upload/route.ts`; `customer_api.create_upload_intent_v1` and `finalize_upload_v1` | Routes still call legacy RPCs. New-document creation now fails closed at the closure triggers because those RPCs do not supply canonical Workspace binding. No Country Pack consumption may be added by bypassing the canonical writer. |
| Reference authority/selector | `src/lib/customer/documents-reference-authority-v1.ts` and `documents-reference-tx-selector-v1.ts` | Current read authority, exact Workspace/document/version, clean scan and active lifecycle are rechecked with shared locks and metadata-only output. These accepted components remain unchanged. |
| Document types/evidence | `documents.documents.document_type`, `is_evidence`, `evidence_type`, `evidence_status`; typed `documents.document_links` | Generic classifications exist. A link can target `billing.invoice`; Vault stores no canonical tax conclusion or Country Pack requirement evaluation. |
| Retention policy | `documents.retention_policies`, `document_retention_assignments`, `retention_records` in the Vault migrations | Policies are tenant-scoped and effective-dated; assignments snapshot policy fields. Current assignment code chooses the highest version and does not consume Core jurisdiction artifacts; its integrity trigger rejects changes to an existing policy version/snapshot. A Country Pack must not rewrite these snapshots. |
| Deletion hold/disposition | `documents.legal_holds`, `disposition_requests`, Vault integrity triggers and APIs | Active holds block disposition/mutation; hold history and finalized retention records are protected. Country Pack metadata cannot release a hold or execute deletion. |
| Immutable provenance | `documents.document_versions`, ClamAV attestations, writer metadata and accepted resolver | Version rows are immutable; accepted read requires verified checksum, clean exact scan attestation and current version. Artifact receipts must bind this identity without copying content/storage metadata. |
| Signature/notarization/legalization | No canonical Documents model found | Existing signature concepts in unrelated modules are not reusable as Documents legal proof. This requirement category stays metadata-only and inactive pending an owned evidence contract. |
| Language/translation | No canonical Documents translation-evidence model found | UI locale exists elsewhere but cannot select country or prove a translation. A future owned evidence contract is required. |
| Storage region/data residency | `document-vault` object boundary and non-overwritable verification exist; no canonical residency attestation exists | A pack may name an allowed region class, but no compliance decision is possible until an approved storage adapter provides a bound attestation. Bucket/path/provider data must not enter the pack or public receipt. |

## 3. Proposed ownership and dependency order

1. **Core:** preserve the explicit Property address country and exact
   Workspace/Property jurisdiction assignment.
2. **Core selector:** return the exact active profile revision and ordered
   `documents.requirements` domain identity inside the caller's existing
   `CoreTransactionScopeV1`.
3. **Core artifact boundary (open dependency):** resolve immutable canonical
   artifact bytes by exact domain/contract/hash, preserve old bytes by hash,
   verify canonical serialization, and define historical effective-date
   selection. This is Core-owned because every domain consumer must share one
   artifact identity and history boundary.
4. **Documents:** strictly parse the accepted artifact and evaluate bounded
   requirement metadata. It must not create a profile registry, artifact store,
   authority provider, transaction host, replay hook or ledger.
5. **Canonical evidence owner:** prove actual document, invoice/tax, retention,
   signature/translation or storage facts. Missing evidence ownership denies.
6. **Existing Core receipt:** retain the exact profile/domain/rule fingerprint
   for the accepted command. There is no Documents receipt store.

`CORE-JURISDICTION-PROFILE-SELECTOR-02` is present on the reviewed baseline.
The open Core artifact-byte and historical-effective-date contract blocks
runtime implementation. The current selector's metadata result is necessary
but cannot by itself prove that interpreted artifact bytes match the registered
SHA-256.

## 4. Lifecycle and historical rules

- A fresh evaluation states `effective_on` explicitly. It does not default from
  locale or client clock.
- The current Property country, Workspace binding and authority are rechecked
  after transaction locks. NULL, missing, ambiguous or cross-Workspace state
  denies.
- Artifact and rule intervals use `[effective_from, effective_to)`. No rule is
  selected outside that interval; overlapping matches deny.
- A new Country Pack version creates new immutable artifact bytes and hash. It
  does not update existing Documents, versions, retention snapshots, holds,
  typed links or transaction receipts.
- A historical receipt retains exact profile version, profile manifest hash,
  domain contract version, artifact hash, effective date and rule versions.
  Revalidation never substitutes the current pack.
- A missing old artifact, unknown contract, hash mismatch, absent receipt
  binding or expired rule denies. No backfill or auto-upgrade is permitted.
- An active legal hold remains authoritative even when a newer pack changes a
  retention rule. A pack cannot shorten or release the existing hold.

## 5. Privacy boundary

Country Pack artifacts may contain only non-private requirement definitions.
They must not contain Tenant, Workspace, Property, actor, party, document or
version IDs; titles, filenames, content or content hashes; object paths,
buckets, provider accounts or credentials; permission rows; invoice values,
tax identifiers or filing data; hold reasons; signature/certificate bytes; or
translator/reviewer identities.

The private transaction evidence may bind caller-known source identities under
the existing Core receipt. A public projection is redacted to bounded status,
contract/rule version, effective date and artifact fingerprint and omits the
target identity and private source facts. Evidence is never reusable as command
authority.

## 6. Future test matrix

These are acceptance tests for a later implementation. None was run by this
documentation package.

| Area | Future case | Required result |
| --- | --- | --- |
| Country source | Locale, currency, actor IP or Workspace label differs from explicit Property country | Explicit address/assignment country wins; no inference; mismatched expected country denies |
| Exact scope | Correct Property but wrong Context, Workspace, actor, authority revision or missing provider-source lock | Bounded denial before artifact load; zero write |
| NULL/cross-Workspace | NULL jurisdiction assignment, historical NULL document Workspace, or Property/document from another Workspace | Indistinguishable fail-closed denial; zero write |
| Current authority | Authority revoked after command construction and before/after source locks | Post-lock recheck denies; no requirement or private source disclosure |
| Core profile | Missing, inactive, unsigned, ambiguous or manifest-mismatched profile/assignment | `JURISDICTION_UNAVAILABLE`; zero write |
| Artifact identity | Missing bytes, wrong contract/version/profile/country, hash mismatch or unknown fields | `ARTIFACT_UNAVAILABLE` or `ARTIFACT_HASH_MISMATCH`; zero write |
| Effective period | Exact lower bound, instant before exclusive upper bound, upper bound, expired, gap and overlap | One deterministic match only; gap/expired/overlap deny |
| Historical preservation | Pack v2 becomes current after a v1 receipt | Existing document/receipt/snapshot bytes unchanged; historical check uses exact v1 hash/rules or denies if unavailable |
| Document type | Required/optional type, minimum count, unknown type and lifecycle transition | Bounded decision from rule metadata; no document content returned |
| Invoice/receipt/tax evidence | Required typed evidence present, stale version, missing canonical financial/tax result | Exact canonical evidence passes; missing/stale/owner-unavailable denies; no amounts or tax data in receipt |
| Retention | Exact policy/rule binding and later pack version | Existing retention assignment/snapshot remains unchanged; new command uses the newly selected rule only |
| Deletion hold | Active hold, released historical hold, and pack rule change | Active canonical hold always blocks deletion; pack cannot release or mutate hold history |
| Signature/legalization | Required assurance metadata present, missing, ambiguous or unsupported owner | Status-only pass/deny; no signature, certificate, seal or identity disclosure |
| Language/translation | Explicit source-language metadata with required translation, UI locale change, missing translation proof | Locale has no jurisdiction effect; missing canonical proof denies |
| Storage residency | Bound adapter attestation matches allowed region class; missing/stale/wrong target | Status-only pass or fail closed; no provider, bucket, region detail or credential disclosure |
| Immutable version | Exact current version versus stale/replaced version | Existing Documents selector accepts exact safe version and denies stale/unsafe/deleted/quarantined state |
| Privacy | Accepted and every denial reason, public receipt projection, logs and errors | No private document metadata, permission data, source payload or storage data |
| Concurrency | Profile suspension, domain retirement, authority revocation, document lifecycle/scan change during evaluation | Shared locks/serializable retry yield one current result; `40001` propagates and retries in a fresh Core attempt |
| Zero-write denial | Every denial above with table counters/triggers around Core and Documents durable stores | No Documents, Core receipt, audit, outbox or idempotency write before provider acceptance |
| Country neutrality | Artifact fixture contains only synthetic requirement codes | Parser/evaluator behavior proves contract mechanics without asserting any country's law |

## 7. Execution package for a future task

A later implementation task may begin only after Core accepts the artifact-byte
and historical-effective-date boundary. Its review package must:

- extend an existing Core-hosted Documents command/provider rather than add a
  parallel host or selector;
- add no country-specific rule seed without separate qualified review;
- keep the accepted writer, reference resolver/selector and historical NULL
  behavior unchanged unless separately authorized;
- validate artifact parsing with canonical-byte/hash fixtures and strict
  unknown-field rejection;
- use disposable PostgreSQL only for the affected transaction, RLS/ACL,
  concurrency and zero-write cases;
- keep routes, grants and runtime composition absent until separately reviewed;
- require separate connected preflight, migration authorization if any schema
  is later proposed, and explicit activation approval.

## 8. This package's evidence and limits

The discovery inspected the Core jurisdiction profile migration and selector,
canonical Documents writer/reference components, Vault migrations, legacy
upload routes/RPCs, retention/legal-hold paths and typed financial links on the
pinned baseline. It changed documentation only.

No migration, product code, Country Pack artifact, legal claim, test fixture,
writer/selector, backfill, database connection, grant, PM record, runtime
activation or merge is included. Repository presence does not prove Remote
installation or country-law acceptance.
