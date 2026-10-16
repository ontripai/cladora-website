# CLADORA Documents retention disposal execution readiness v1.0

Package: `DOCUMENTS-RETENTION-DISPOSAL-EXECUTION-READINESS-04`

Owner: Documents & Vault.

Repository evidence base: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`
with tree `752e5eb031da3ad11143b357f73d80b712a615e5`.

Status: `core_or_storage_extension_required`.

This is an inactive audit and execution package. It contains no executable
disposal provider, worker, migration, route, grant, feature flag, Storage call,
Remote operation or runtime registration. The existing Documents retention
preflight remains non-authorizing.

## Readiness decision

The Repository does not yet expose a sufficient official Core and Storage
boundary for irreversible document deletion. The existing Core transaction
host is suitable for serializable database validation and atomic database
effects, but explicitly forbids network effects in provider callbacks. Its
generic outbox receipt does not define claim, conditional Storage deletion,
acknowledgement-loss readback or an immutable Storage object-version receipt.

The Repository also contains an older Phase 3A retention control plane. It has
private purge jobs, a Storage-delete outbox, worker assertions, absence
evidence, tombstones and retry functions. That path is not the execution
primitive for this package because it:

- is tenant-scoped and does not bind the exact Documents Workspace;
- evaluates `app_private.legal_holds`, while current Documents truth is the
  legacy `documents.documents.legal_hold` flag plus canonical
  `documents.legal_holds` rows;
- uses older retention requirements rather than the current Core-resolved
  country/profile/domain artifact evidence;
- does not bind the current #452 decision, immutable command subject and exact
  Core authority receipt;
- maintains its own audit journal, worker assertion journal and Storage-delete
  outbox outside the canonical Core command receipt/effect boundary; and
- has no Repository worker that performs a provider-version-conditional delete
  and returns an official Storage receipt.

Adopting or extending that path in Documents would create or bless a parallel
execution authority and ledger. No implementation may begin until the owning
Core and Storage workstreams publish the extensions in [Required extensions](#required-extensions).

## Evidence inventory

The SHA-256 values below identify the exact file bytes reviewed. They are
Repository file hashes, not proof of installation in any Remote environment.

| Area | Canonical or existing artifact | SHA-256 | Finding |
| --- | --- | --- | --- |
| Current retention preflight | `src/lib/customer/documents-country-retention-operation-integration-v1.ts` | `fa0d815e149b64f02ff864f2293b89fe2acfffb8b1b6e821fc2b7d85c907ce3c` | Inactive, exact current-state provider; output is non-authorizing and disposal is preflight only. |
| Current preflight contract | `docs/contracts/CLADORA-DOCUMENTS-COUNTRY-RETENTION-OPERATION-INTEGRATION-v1.0.md` | `cb167391603adaca55a96cb0b8c5fd4fd918b5b03892d1d309d8462254ecbcd0` | Defines current/historical separation, current legal-hold recheck and no Storage delete. |
| Canonical initial writer | `src/lib/customer/documents-workspace-binding-writer-v1.ts` | `33946d944b49eea1495bddca1979aa19f227694e533106c91d4ceed234f83c94` | Binds Workspace/document/version/path/hash and accepts a trusted `non_overwritable` measurement, but has no provider object-version or generation token. |
| Core transaction host | `src/lib/core/postgres-transaction-host-v1.ts` | `ce0360f30f1c49ff06e8ec944ba7263e0012c56fb2c27e5094d6604a1cf09a6e` | Canonical SQL transaction, authority recheck, idempotency receipt, audit and outbox. Provider network effects are prohibited. |
| Core replay hook | `src/lib/core/transaction-replay-provider-hook-v1.ts` | `eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4` | Revalidates current provider state for exact Core receipt replay; it is not external-effect recovery. |
| Base document/version store | `supabase/migrations/20260825001900_documents_vault_legal_records.sql` | `c5533819e44344d06619f2887c2a24d16fbfa7b9ccd31e6eb87f21dda5a04375` | Owns document, immutable version, object path/hash, access-event and legacy legal-hold flag state. |
| Canonical hold/lifecycle additions | `supabase/migrations/20260829005100_customer_document_vault_secure_evidence.sql` | `d7f41f90b94336bfaae4fea2c6a35be77eb30dd5640fe9c87fbe01f9d7ecaaf1` | Adds canonical legal holds, retention records and append-only lifecycle events. |
| Legacy disposition approval | `supabase/migrations/20260909133706_secure_documents_evidence_vault.sql` | `2ce2159b0b8cfb6c80323e6260ce28a8e0773ce8be2e143ab22d835b2a087e71` | Adds deferred, non-destructive request/approval RPCs. It does not pin Workspace, immutable version, current artifact evidence or approval expiry. |
| Legacy Phase 3A purge model | `supabase/migrations/20260921172651_retention_archive_legal_hold_discovery_r9.sql` | `f23ad93220d27b3c8a95e6fbbec2f92d904ee5aec1c1e8dbd7923feb9ab72629` | Contains a separate legacy hold/retention/worker/outbox/tombstone model and an internal version-delete escape. It is not accepted as the canonical execution path. |
| Legacy operator dry-run | `supabase/migrations/20260923060219_retention_operations_read_model_dry_run.sql` | `dbe7c3dc7a3eb395b1aab4ec430f947b1f56989683b4f8bae4dac652d69fb67b` | Read-only view of the Phase 3A model; it neither consumes #452 nor proves execution readiness. |
| Storage upload closure | `supabase/migrations/20260928042750_document_vault_storage_intent_rls.sql` | `34aa45f269042ac0d409103040d3e39968320da76cad81f770a77bcac430935f` | Allows exact intent-bound insert. Clients receive no UPDATE or DELETE policy. |
| Existing Storage worker | `scripts/document-clamav-worker.mjs` | `359c09bf7848861f88d2cf2d081f818bc44274b9454488e2ca201c08719a6e9c` | Downloads objects for scanning; it has no delete, conditional-delete, absence-readback or restore operation. |
| Legacy request route | `src/app/api/customer/v1/documents/[id]/disposition/route.ts` | `935b9489fbe425c3a09e1c30e4c193e970d15d21e7aa193990f337d38d9029ea` | Calls the deferred legacy request RPC; it is not a disposal execution route. |
| Legacy approval route | `src/app/api/customer/v1/documents/[id]/disposition/[reqId]/approve/route.ts` | `8d24c69e82d9ae4d1d48f46fe0fb2cfbec338f760f469cf8b6574956cc2b04cf` | Calls the deferred legacy approval RPC; it performs no Storage operation. |

### Document and version lifecycle

`documents.documents` is the canonical document row. Current readable state is
`status='active'` with no `deleted_at`; archived/deleted state fails closed in
the accepted selector. `current_version` identifies the exact immutable current
version. `documents.document_versions` binds numeric version, object path,
content SHA-256 and scan/checksum state. Normal update/delete is denied by the
immutability trigger. The Phase 3A migration later adds a private session-setting
escape that permits version deletion after its legacy absence evidence. That
escape is evidence of an old execution path, not authority for a new one.

`documents.lifecycle_events` is append-only, `documents.retention_records`
becomes immutable after finalization, and `documents.access_events` survives a
legacy version deletion by setting its version reference to NULL. A future
execution must preserve the immutable document/version identity in its
tombstone and evidence even when relational access history cannot retain the
version foreign key.

### Legal holds

The #452 preflight currently reads the union of:

1. the legacy boolean `documents.documents.legal_hold`; and
2. active rows in canonical `documents.legal_holds`.

The #452 integration reads those two sources only after the document/version
lock. The older `app_private.legal_holds` plus
`app_private.legal_hold_targets` model is a third, separate control plane. Its
`is_document_held` function does not read either current Documents source, but
its create, target, activate and release RPCs remain granted to
`authenticated` behind a feature flag and advance
`app_private.legal_hold_scope_epochs`.

Consequently, destructive execution must treat all three legal-hold control
planes as safety inputs until Core formally reconciles or decommissions the
Phase 3A plane. A final gate that observes only the two #452 sources is
insufficient. Direct document targets and indirect property, vendor and
class/date targets must all fail closed when active, ambiguous or unavailable.
The exact Phase 3A scope epoch must be bound and rechecked so a concurrent
target, activation or release cannot pass between validation and Storage
gateway acceptance. That epoch alone is insufficient for indirect targets:
vendor applicability also depends on `documents.document_links` and the linked
quote or purchase-order vendor, while class/date applicability depends on
`app_private.document_retention_requirements` and
`app_private.retention_policy_rules`. For example,
`customer_api.link_document_entity_v1` can make an already active vendor hold
applicable without changing `legal_hold_scope_epochs`. The future Core fence
must therefore cover every hold-applicability input and its writers, rather
than treating the existing epoch as a complete revision.

### Retention and historical evidence

The accepted retention chain is
`resolveDocumentsCountryRetentionV1` over the canonical Core jurisdiction-domain
artifact resolver. Current mode resolves the current Property jurisdiction and
profile. Historical mode accepts only exact committed receipt evidence. Both
bind profile ID/code/version, profile manifest hash, domain
`documents.retention`, domain version `documents-retention.v1`, artifact hash
and effective period. The evaluator decision is metadata-only and
`reusable_as_command_authority=false`.

Legacy `documents.retention_policies`, retention assignments,
`app_private.retention_policy_versions` and document requirements remain
inventory. They do not replace or authorize the current country artifact
decision, and no historical row may be rewritten from a current artifact.

### Access, audit, outbox, idempotency and recovery

The canonical Core host writes its Workspace-scoped idempotency receipt, one
metadata-only audit event and one generic outbox event atomically with a domain
mutation. It returns an exact receipt on replay after current authority and any
required provider replay hook. Lost database commit acknowledgement returns
`READBACK_REQUIRED`; it does not speculate or repeat a mutation.

Those guarantees stop at the database transaction. They do not define an
external Storage effect claim, provider operation ID, conditional delete,
signed provider receipt or post-delete readback. The Phase 3A audit journal,
worker assertion journal and Storage-delete outbox must not be copied into a
new Documents ledger or treated as Core receipts.

### Approval, actor and AAL2 paths

The legacy request RPC resolves `documents.vault.disposition` with
`p_require_aal2=false`, creates one request and changes a mutable disposition
status. Its approval RPC requires AAL2 and one reviewer distinct from the
requester. The shared actor helper is tenant/context based: it proves an active
membership and accepts a matching Documents entitlement from any active
customer Workspace for that tenant. Neither RPC binds the exact Documents
Workspace, immutable version, object version, artifact fingerprint, authority
revision, approval expiry or a current #452 result. The routes merely expose
these deferred RPCs and perform no physical deletion.

The #452 provider uses the fixed `documents.vault.read` profile and current
Core authority inside the transaction, but its result is deliberately
non-authorizing. It cannot be promoted to an execution approval. A future
execution path therefore needs the Core-owned approval and dispatch contract
below rather than adapting either legacy surface.

## Proposed inactive contract

### Dry-run boundary

Dry-run consumes the merged #452 composition directly with operation `dispose`.
It performs the exact current or historical evaluation and returns only its
bounded decision/evidence. It never creates an approval, execution capability,
job, outbox effect, tombstone or reusable command authority. Repeating dry-run
may return a new observation but cannot delete or reserve an object.

### Future execution envelope

The future server-owned execution command must be a strict, versioned envelope
whose fingerprint covers all of the following:

- Context, Workspace, actor, authority revision and command/transaction IDs;
- Property, document ID, document immutable version ID and numeric version;
- stored document type and current lifecycle/scan/checksum state;
- bucket, private object path, content hash and size, plus an immutable Storage
  provider object-version/generation token;
- current/historical resolution mode, requested operation `dispose`, exact
  country/profile/domain/artifact fingerprint, effective instant and rule code;
- all three legal-hold observations: `documents.documents.legal_hold`, active
  `documents.legal_holds`, and every applicable active
  `app_private.legal_holds` target; the exact
  `app_private.legal_hold_scope_epochs` value; a Phase 3A applicability
  fingerprint/revision covering document links, linked vendor identity and
  retention class/date inputs; and a canonical hold revision or fence token;
- approval plan ID/version/hash, expiry, two distinct approver decisions and
  each approver's current authority revision and AAL2 session evidence; and
- one Core idempotency key and one external-effect operation ID.

Callers may supply identifiers needed to select an already issued plan, but may
not override the permission/module/entitlement/purpose/domain profile,
document type, Property, legal-hold state, artifact, object identity or result.

### Approval boundary

Execution requires at least two distinct current human approval decisions.
Each approval must be created under a current AAL2 session, exact Workspace and
an execution-specific permission. Self-duplicate, repeated actor, expired,
revoked, cross-Workspace or plan-hash-mismatched approval is denied. Approval
pins the exact document/version/object and artifact fingerprint; a new document
version, object generation, hold revision, retention result or plan version
invalidates every prior approval and requires a new plan.

The legacy disposition request/reviewer pair and the Phase 3A committee cannot
be projected into this contract automatically. No backfill or inferred approval
is allowed.

### Final database gate and destructive-effect fence

Immediately before a Storage gateway accepts the delete, the official execution
provider must run in one serializable `CoreTransactionScopeV1` read phase and:

1. lock and recheck the exact active Workspace, Property, document and immutable
   version in canonical lock order;
2. recheck current execution permission, entitlement, actor and AAL2;
3. lock and recheck all three legal-hold control planes after the document
   lock, including direct and indirect Phase 3A targets, and bind the exact
   `app_private.legal_hold_scope_epochs` value plus every row that determines
   indirect vendor or class/date applicability;
4. re-resolve the exact current artifact or validate the exact committed
   historical artifact evidence, without substituting current for historical;
5. lock and recheck both distinct approvals, their expiry, authority revisions
   and complete plan fingerprint; and
6. stage one canonical destructive-effect record/outbox item with a single-use
   fence token bound to the exact provider object version.

The Core/Storage extension must make hold/version changes and Storage gateway
acceptance serialize on that fence. This includes every Phase 3A RPC that can
create a hold, add a target, activate a hold or release a hold, plus every
mutation that can change indirect applicability: document-link insert/delete,
linked quote or purchase-order vendor reassignment, Property binding, and
retention requirement/rule class or classification-date changes. The accepted
extension must make every such writer advance one shared applicability revision
or acquire the same exclusive fence used by gateway acceptance. Merely reading
those rows under a database transaction is insufficient unless all writers and
gateway acceptance participate in the same serialization protocol. Core must
own a single reconciliation/decommission decision for the Phase 3A plane;
Documents must not silently ignore it or copy its authority. A hold, target,
scope epoch, applicability input, version, approval or authority change observed
before gateway acceptance cancels the capability and yields zero destructive
effect. Database validation followed by an unfenced network delete is
insufficient.

The Core provider read phase performs no writes. Denial or `40001` rolls back
the entire attempt. The mutation phase may stage only the canonical Core/domain
effect required by the accepted extension; it must not call Storage.

### Storage worker and acknowledgement loss

The worker must consume the official Core/Storage effect contract. It may act
only on an unexpired single-use claim with the exact operation ID, fence token,
bucket, path fingerprint, provider object-version/generation, SHA-256 and size.
Deletion must be conditional on the exact provider version. Path-only delete is
forbidden.

For a lost acknowledgement, the worker never issues an unqualified second
delete:

- exact version absent with a verifiable provider receipt/readback: record the
  original operation as succeeded and continue to tombstone finalization;
- exact version still present and the same execution fence remains current:
  retry the same provider operation ID under the Storage contract;
- another version/object now occupies the path: quarantine the job and delete
  nothing;
- unavailable, inconsistent or unauthenticated readback: mark outcome unknown,
  stop and require manual recovery.

Exact Core replay returns the original receipt and must not enqueue another
effect, repeat Storage deletion or create duplicate deletion evidence.

### Tombstone and evidence preservation

Only verified absence of the exact provider object version may advance the
database to disposed/tombstoned state. Finalization preserves internal,
immutable evidence for document/version/Workspace/Property identity, artifact
fingerprint, approvals, operation ID, Storage receipt/readback, destruction
time, audit and retention rule. It removes neither historical receipt evidence
nor audit/access history. Public output remains status-only and excludes object
path, content, permission rows, approval identities and private Storage data.

## Required extensions

### Core-owned extension

Proposed dependency: `CORE-DESTRUCTIVE-EFFECT-APPROVAL-DISPATCH-01`.

It must provide a canonical, Workspace-scoped two-person approval receipt and a
destructive external-effect state machine integrated with Core command
idempotency, audit, outbox, exact replay and unknown-commit readback. It must
define the final fence ordering shared with hold/version mutations and ensure an
exact replay cannot emit a second effect. The same extension must either
reconcile the Phase 3A legal-hold plane into the canonical decision or formally
decommission it. Until then, it must observe all three planes, bind
`app_private.legal_hold_scope_epochs`, bind a complete indirect-applicability
fingerprint/revision, and serialize gateway acceptance with
`create_legal_hold_v1`, `add_legal_hold_target_v1`,
`activate_legal_hold_v1`, `release_legal_hold_v1`,
`customer_api.link_document_entity_v1` and every other writer of a Phase 3A
scope input. If Core cannot enroll all of those writers under one fence, the
dispatch capability remains unavailable. Documents must consume the interface;
it must not define a parallel approval, audit, outbox or idempotency store.

### Storage-owned extension

Proposed dependency: `STORAGE-CONDITIONAL-OBJECT-VERSION-DELETE-RECEIPT-01`.

It must provide trusted immutable object-version identity, conditional deletion
of exactly that version, single-use operation IDs, signed/attested result and
absence readback, outcome-unknown recovery and explicit provider restore
capability. The existing trusted upload measurement is not sufficient because
it carries no provider object-version/generation token and delegates proof of
the non-overwritable boundary to Storage.

Either missing extension keeps the package at
`core_or_storage_extension_required`.

## Rollback, restore and stop conditions

Before Storage gateway acceptance, rollback means cancelling/expiring the plan,
approvals, claim and staged effect; the document and object remain unchanged.
After the gateway accepts an irreversible conditional delete, database rollback
cannot restore bytes. Tombstone finalization and evidence recovery may be
retried, but they are not content restore.

Restore is allowed only if the Storage owner later supplies an independently
retained, immutable backup/version with provenance and a separate restore
authorization. Restore creates a new document version or explicit recovery
artifact; it never rewrites or resurrects the disposed immutable version. No
such official restore primitive is present in this Repository, so the current
restore boundary is `restore_unavailable`.

Execution must stop before any destructive call when any of these is true:

- either required extension is unavailable, inactive or version/hash-mismatched;
- Workspace, Property, document, immutable version or object version differs;
- any of the three legal-hold planes is active, ambiguous, unavailable or
  changed, including an applicable direct or indirect Phase 3A target, or the
  Phase 3A scope epoch/applicability revision does not match;
- document lifecycle, scan/checksum state or current version changed;
- approval actor, AAL2, authority revision, expiry, plan version or plan hash is
  stale, revoked, duplicated, missing or cross-Workspace;
- current artifact is missing/stale/ambiguous or historical committed evidence
  is absent, malformed or not an exact match;
- conditional delete or non-overwritable object-version identity is unavailable;
- outcome readback is missing, unauthenticated, inconsistent or sees a different
  object at the path; or
- a serialization failure cannot be retried by the canonical Core host.

All these cases require zero destructive effect. They may leave no new durable
row on pre-validation denial; an already staged but not accepted effect may be
durably cancelled according to the future Core contract.

## Future validation matrix

| Case | Required result |
| --- | --- |
| Current dry-run | Exact current artifact and live document/hold state; no write or claim. |
| Historical dry-run | Exact committed evidence only; no substitution and no write. |
| Valid execution preparation | Exact bindings and two distinct AAL2 approvals; one staged effect, no Storage call in Core transaction. |
| Cross-Workspace or Property mismatch | Denied before dispatch; zero destructive effect and no private metadata disclosure. |
| Stale document/version/object generation | Denied before dispatch; no path-only delete. |
| Active direct Phase 3A document target | Denied before dispatch; zero destructive effect. |
| Active indirect Phase 3A property, vendor or class/date target | Denied before dispatch; zero destructive effect. |
| Concurrent Phase 3A hold/target mutation | Scope epoch or fence changes; capability cancelled before gateway acceptance and zero destructive effect. |
| Concurrent document-link or linked-vendor mutation | Applicability revision/fence changes; active vendor hold is re-evaluated and no stale capability reaches Storage. |
| Concurrent retention requirement/rule scope mutation | Applicability revision/fence changes; class/date hold is re-evaluated and no stale capability reaches Storage. |
| Active or newly changed hold in any plane | Serialized before gateway acceptance; capability cancelled and zero destructive effect. |
| Expired/revoked/duplicate approval | Denied; prior approval cannot authorize a changed plan. |
| Missing/stale/malformed rule evidence | Denied; historical evidence never replaced with current evidence. |
| `40001` | Entire database attempt retries with fresh authority, holds, approvals and retention evidence; no external call from the failed attempt. |
| Delete acknowledgement lost, object absent | Read back the exact provider version and record the original operation once. |
| Delete acknowledgement lost, same version present | Retry only the same operation ID after fresh fence validation. |
| Delete acknowledgement lost, different version present | Quarantine; no delete. |
| Exact command replay | Return original receipt; zero new outbox/evidence/delete. |
| Tombstone finalization retry | One immutable tombstone/evidence set; no second Storage operation. |
| Restore request | Fail closed until the official Storage restore primitive exists; never rewrite the disposed version. |

## Activation boundary

This package is ready for owner review of the two extension requests only. It is
not ready for disposal implementation or activation. Migrations, connected
preflight, Remote installation, grants, worker credentials, route wiring,
feature activation, production deletion and merge are outside this package.
