# DOC-WORKSPACE-BINDING-DESIGN-01 — canonical Vault writer

Status: design for review; no writer implementation or runtime activation.
Owner: Documents & Vault. Repository baseline:
`df8124807a702f3b6fdcce3903e74aed7c713c67`. Reviewed on 2026-10-14.

## Decision

A new canonical Vault document receives its Workspace from an explicit
`workspace_id` selection in a server-built command, validated against the exact
Context and authenticated actor by the canonical Core current-authority provider
inside `CoreTransactionScopeV1`. Selection alone is untrusted. The accepted
post-lock Core receipt and the existing upload intent establish provenance.
Finalization copies the intent's validated Workspace to `documents.documents`
in the same transaction as the initial immutable version and intent consumption.

Tenant, property, membership, entitlement availability, typed links and the
first/only Workspace are never binding sources. A property can be checked as a
resource constraint after Workspace selection; it cannot choose the Workspace.
Historical NULL bindings remain NULL and unavailable to
`documents-reference-authority.v1`. This design does not change that resolver.

## Observed creation paths

The inventory covers application callers and all canonical document/version
INSERT statements in the migration history at the pinned main. Historical
definitions are distinguished from the latest replacement definitions. These
are repository observations, not an inspection of installed Remote routines.

| Path | Current source and persistence | Binding assessment |
| --- | --- | --- |
| Customer Vault upload | `CustomerDocumentsDashboard.tsx` calls `/api/customer/v1/documents/upload-intent`, then `/upload`; `documents-schema.ts` accepts Context but no Workspace. Wrappers call `create_upload_intent_internal` and `finalize_upload_internal`. | Intent stores Context/user/tenant; new document INSERT omits Workspace and therefore leaves NULL. UI property choices do not supply provenance. |
| Customer private conversation attachment | `PrivateConversationsPanel.tsx` calls the same two Vault endpoints after `private-conversations/{id}/upload-context` supplies a property. | Shares the canonical writer gap. Conversation/property context is a resource check, not exact Workspace binding. Excluded from initial writer wiring. |
| Replacement version | The same intent RPC accepts `document_id`; latest finalizer inserts into `documents.document_versions` and updates `current_version`. | No exact Workspace parameter; reads current version without a document row lock before selecting the next number. Not a safe template for the new writer. |
| Case document | `/api/cases/documents` calls `begin_customer_case_document_v1`; existing `platform.customer_case_documents` / `customer_case_document_versions`, bucket `case-vault`. | Case identity is not canonical Documents Workspace provenance. No migration, alias, copy or promotion is proposed. |
| Platform internal private document | `/api/platform/v1/internal-conversations/{id}/private-documents/upload`; `begin_internal_private_upload_v1` / `finish_internal_private_upload_v1`, existing `platform.internal_private_documents`, bucket `internal-message-vault`. | Thread has an explicit Workspace, but this separate existing path is not a canonical Documents writer. Platform thread access does not grant Vault upload authority. |
| Scanner and links | Scan attestations/jobs and document permission/link writers. | Do not create canonical document identities; neither scan clearance nor a link may establish or change Workspace. |

Canonical writer definitions and boundaries reviewed:

- `supabase/migrations/20260909133706_secure_documents_evidence_vault.sql`:
  existing intent table, original writer and wrappers.
- `supabase/migrations/20260927211340_scoped_company_contractor_document_upload.sql`:
  latest replacements of both internal writers; scoped vendor/company restrictions.
- `supabase/migrations/20260928101133_20260928083600_vault_actor_exact_membership_role.sql`:
  exact membership role, but entitlement test is existential across active
  Workspaces in the tenant; `resolve_vault_actor` returns no Workspace. It
  cannot substitute for the canonical Core exact-Workspace authority check.
- `supabase/migrations/20260927211349_scope_conversation_vault_upload_to_property.sql`:
  version-insert trigger validates consumed intent and scopes property; no
  Workspace source. Preserve these property checks.
- `supabase/migrations/20260928042750_document_vault_storage_intent_rls.sql`:
  Storage INSERT helper checks actor/path/expiry/single-use intent. It currently
  does not perform a fresh exact-Workspace Core check.
- `supabase/migrations/20260927215656_document_vault_upload_gateway_definer.sql`:
  privileged wrappers; direct internal EXECUTE remains closed.
- `supabase/migrations/20261013063739_document_reference_exact_workspace_v1.sql`:
  nullable canonical document binding, same-tenant composite FK and index.

## Provenance and trusted input

The isolated writer requires explicit Context and Workspace UUIDs, filename,
declared MIME/size, an idempotency key and request identity. Finalization also
names the exact intent and server-verified upload measurements. A trusted
server generates prospective document and intent UUIDs once and preserves them
through retries/readback; identities must not change on a blind resubmission.

Derive actor, AAL/session validity and authority revision from verified server
identity/current Core data. Do not accept actor, tenant, revision, permission,
provider code, receipt, SQL settings or content hash as browser authority.
Use fixed `documents.vault.upload` / `documents` with distinct server-owned
purposes for intent issuance and finalization. Require AAL2 in the isolated
candidate; weaker existing upload behavior is not authority for this writer.

The durable provenance chain is:

1. Core's existing transaction receipt binds Workspace, actor, Context,
   canonical authority revision/decision and transaction/command identity.
2. The existing `documents.upload_intents` row binds the validated Workspace,
   Context, uploader, prospective document ID, expected version, opaque path,
   size/MIME, creation/expiry and single-use state.
3. The initial immutable version's existing `metadata_json` records only
   server-owned upload intent, creation/finalization transaction and command
   identifiers, binding contract version and exact Workspace. Existing
   document `created_by` and version `uploaded_by` remain authoritative.
4. Core's existing idempotency response receipt binds the committed mutation
   identity. No extra provenance table, authority store, evidence ledger,
   audit ledger, outbox or idempotency ledger is created.

Record initial provenance before the version INSERT; never patch metadata on a
finalized version. Receipt identifiers are references, not reusable permission.
A retry that reaches the fresh-command path receives a fresh Core authority
check and fresh writer validation of intent/document state. The current host's
exact-replay path is different: after its current-authority recheck and complete
stored-receipt comparison, it returns the prior receipt before calling
`validateProviders`. This design does not describe current exact replay as
performing fresh writer validation. Do not copy full permissions, membership
rows or entitlement details into version metadata or public output.

## Intent and finalization transactions

Use `createCorePostgresTransactionHostV1`, its existing
`CoreTransactionProvidersV1` writer contract and `CoreTransactionScopeV1` directly.
Delegate `resolveAuthority` to
`src/lib/core/current-authority-postgres-provider-v1.ts`. A writer that validates
only upload does not mint fake accepted reference/read evidence to satisfy V2.
The accepted read resolver continues to consume `CoreTransactionProvidersV2`.
No duplicate Core types or transaction/authority adapter contract is introduced.

For new documents the command aggregate is `documents.document`, using the
prospective document ID at both phases; initial aggregate version is 1. Intent
ID and prospective document ID are in the ordered provider-source lock set.
Include every accepted creation/finalization field in a canonical server-computed
input fingerprint, including Context, Workspace, actor, identity, metadata,
property selection and server-verified content measurements. Same key with a
changed Workspace, document, intent or payload is a conflict, never a reroute.

Intent transaction:

1. Core acquires its Workspace, idempotency, aggregate and ordered source locks
   and evaluates canonical authority. Check exact native SQL transaction,
   actor/session/AAL2 and receipt binding; membership/role alone is insufficient.
2. Validate size/MIME/name and resource restrictions for this selected Workspace.
   If exact property/resource authority is unavailable, deny without inference.
   Preserve new-only restrictions for vendor/company roles.
3. Insert one bound upload intent using the supplied scope during mutation;
   Core commits the existing receipt/audit/outbox/idempotency effects atomically.
   Return only the existing upload capability fields through a private writer
   projection; this is not reference-authority evidence.

Finalization transaction:

1. Rebuild the exact command from the persisted intent plus trusted measurements;
   verify the request Context and Workspace equal the intent. Core performs a
   new post-lock authority evaluation. Historical NULL intents cannot use this path.
2. For a fresh finalization command only, lock the exact intent `FOR UPDATE` in
   provider validation. Verify uploader, tenant, Workspace, Context, expiry,
   unconsumed state, prospective document ID, expected initial version and
   server-owned object path. No intent mutation occurs on denial, including
   expiry/attempt failure. Evaluate temporal bounds with the live database clock
   after waiting, not transaction-start time. This pre-mutation predicate is not
   valid for a successful replay because the committed finalization consumed the
   intent.
3. Verify stored object existence and actual bytes/size/hash/MIME. Perform
   Storage/network work before entering Core; provider callbacks make SQL-only
   checks in the supplied scope. A trusted preverified measurement is usable
   only for its exact non-overwritable object/path; production proof of that
   boundary remains a separate Storage dependency. A checksum
   computed from a retry's incoming stream is not proof of an already-existing
   Storage object's bytes. Reject mismatch; never upsert/overwrite or treat
   `already exists` as successful verification.
4. In mutation, insert the canonical document with exact non-NULL Workspace and
   initial current version; insert one immutable version; consume intent;
   preserve existing access-event and scan-queue behavior without duplicating
   Core's shared audit/outbox effects. All roll back if any step fails.
5. Initial scan state stays `deferred`/pending, checksum verified only after
   actual stored bytes are verified. Only the existing scanner/attestation path
   may establish clean status. Successful upload does not make a reference readable.

## Exact replay and Core-owned dependency

Current `createCorePostgresTransactionHostV1.execute` resolves and rechecks Core
authority, locks and reads the existing idempotency row, validates the complete
request/receipt/entitlement/provider binding, and then returns `exact_replay`.
It does so before `validateProviders`. Therefore a consumed intent, changed
canonical document state or provider-side disclosure change is not currently
revalidated by a Documents callback on exact replay.

The writer has a formal dependency on
`CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01`, owned by Core/Platform. The Core
contract must define and implement a read-only hook after current authority and
stored-receipt matching and before returning `exact_replay`. It supplies the
current transaction scope, exact command/current authority and parsed persisted
receipt, preserves host lock/retry/zero-write semantics, and fails closed when
the provider cannot validate current replay disclosure. Documents must consume
that merged Core hook directly; it must not add a parallel host or Core interface.

Documents replay validation is distinct from fresh-command validation. It
requires the exact intent to be **consumed**, the persisted receipt's mutation
and command identities to match that intent, and the bound document/version/
Workspace/provenance to match the committed result. It never requires the intent
to be unconsumed and never invokes the mutation callback. A changed key/payload,
unconsumed or foreign intent, missing committed document/version, rebind, or
receipt/provenance mismatch denies without another effect.

`CORE-RECOVERY-AUTH-01` from PR #392 is a separate unknown-commit recovery
contract. Its proposed `recover` method and optional `validateRecovery` authorize
readback of an existing outcome, including the specified cross-revision case.
They do not insert a hook into `execute`, do not change current exact-replay
ordering, and do not satisfy `CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01`.

Object storage is a separate side effect and cannot be atomically committed
with PostgreSQL. Bytes may have been uploaded before finalization loses
authority; they remain private and confer no canonical document/read authority.
SQL denial guarantees zero durable SQL effects, not absence of a previously
uploaded object. Exact-Workspace storage validation and orphan cleanup require
their own reviewed boundary; the initial isolated package must not claim
production upload/cleanup acceptance or widen Storage policy/grants.

## Workspace invariants, versions and concurrency

| Operation | Required behavior |
| --- | --- |
| New bound document | Writer sets binding exactly once at INSERT from a validated bound intent. Same-tenant FK is necessary but is not an authority check. |
| Historical NULL document/intent | Leave unchanged. New bound writer denies use/replacement; legacy compatibility does not promote them to resolver-readable state. |
| Cross-Workspace access, including same tenant/property | Generic denial before mutation; no title, object path, existence details or permission disclosure. Neither source nor target admin authority changes this rule. |
| Rebind non-NULL to another Workspace or NULL | Prohibited, including direct updates. Future implementation uses a narrowly scoped immutable-binding guard on the canonical document row, without changing resolver. |
| Bind NULL to non-NULL via UPDATE | Prohibited in this package. Historical binding would require a separate provenance review; no administrative shortcut or inferred backfill. |
| Replacement version | Future package only: require existing non-NULL binding exactly equal to command; lock document `FOR UPDATE`, require expected current numeric version and immutable version ID, then append `V+1` and CAS current pointer. Cannot rebind through replacement. |
| Concurrent fresh finalizations | Same Core aggregate and intent row serialize. One fresh command commits one receipt/version and consumes the intent; a changed command cannot create a second document from it. |
| Exact replay after intent consumption | Current host may return the matched stored receipt after authority recheck without Documents validation. After the Core replay hook is delivered, Documents validates the consumed intent and exact committed document/version/provenance; it does not apply the fresh-command `unconsumed` predicate. |
| Two future replacements at V | Document row lock + CAS + existing `(document_id,version)` unique constraint admit one V+1. Loser retries against fresh state or denies stale with zero durable writes. |
| Concurrent resolver | Resolver retains exact Workspace/document/version `FOR SHARE` locks. Writer's document `FOR UPDATE` blocks behind it or forces a serializable retry. Evidence is valid only in its host transaction, not as a later reusable download capability. |
| Scanner/lifecycle/permission changes | Preserve resolver locks and existing immutable scanner rules. Serialize conflicting row writes, retry SQL `40001` using Core; timeout/deadlock fails closed. No claim that advisory locks cover legacy writers. |

Lock order for the new writer follows Core's existing order: idempotency advisory
lock, Workspace row, aggregate advisory lock, sorted provider-source advisory
locks, canonical authority revision barrier, then intent row and (for future
replacement) document row, version/permission rows in stable order. Never acquire
the Workspace after holding document/version rows. Scanner routines may have a
different existing order; concurrency tests must prove bounded failures/retry
and no partial effects rather than claiming deadlocks cannot occur.

Content identity, parent, tenant, numeric version, object path, hash and initial
provenance remain immutable under the existing version trigger. Scan verdict is
the existing attested transition exception, not permission to rewrite content.
The existing tenant-wide `(tenant_id,sha256)` uniqueness can reject identical
bytes already stored in another Workspace. Do not resolve that conflict by
reusing/rebinding the other document or disclosing its identity. Keep the
constraint; return a bounded conflict. Workspace-aware deduplication is outside
this package.

## Review and security boundary

This design proposes nullable additive intent fields and a document binding
immutability guard only in a later implementation migration. It does not add
defaults, infer backfill, rewrite historical rows, tighten the whole document
table to NOT NULL, or grant client access. Preserve RLS and current direct-read,
write, internal EXECUTE and Storage overwrite/download closures. A privileged
writer must still perform exact canonical checks; privilege is not authorization.

Public result is a bounded writer projection: outcome, receipt/document/version
IDs, numeric version and pending scan status. Do not expose the full internal
Core receipt, content, hash, title, object path, permission data or entitlement
data as reference evidence. Intent capability fields are confined to the
authenticated uploader's private upload exchange. The existing reference
provider's metadata-only schema and zero-write denial stay unchanged.

See the [limited execution package](../roadmap/CLADORA-DOC-WORKSPACE-BINDING-WRITER-01-EXECUTION-PACKAGE-v1.0.md)
for implementation bounds, acceptance cases and separate rollout gates.

## Source links

- [Accepted reference-authority contract](CLADORA-DOCUMENTS-REFERENCE-AUTHORITY-v1.0.md)
- [Upload intent route](../../src/app/api/customer/v1/documents/upload-intent/route.ts)
- [Upload/finalize route](../../src/app/api/customer/v1/documents/upload/route.ts)
- [Latest canonical writer definitions](../../supabase/migrations/20260927211340_scoped_company_contractor_document_upload.sql)
- [Exact-role Vault actor definition](../../supabase/migrations/20260928101133_20260928083600_vault_actor_exact_membership_role.sql)
- [Storage intent authorization](../../supabase/migrations/20260928042750_document_vault_storage_intent_rls.sql)
- [Immutable version/scanner rules](../../supabase/migrations/20260927211439_document_vault_clamav_attestation.sql)
- [Core transaction host and scope](../../src/lib/core/postgres-transaction-host-v1.ts)
- [Canonical Core current-authority provider](../../src/lib/core/current-authority-postgres-provider-v1.ts)
