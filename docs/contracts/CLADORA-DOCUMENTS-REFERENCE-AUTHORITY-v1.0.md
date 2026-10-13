# DOC-REFERENCE-AUTHORITY-02

Status: inactive candidate. Documents/Vault owns the
`documents-reference-authority.v1` provider. No route, consumer, grant,
backfill, scanner or runtime activation is included.

## Core contract and canonical sources

`validateDocumentsReferenceAuthorityV1` is the existing
`CoreTransactionProvidersV2.validateProviders(scope, command, authority)`
callback. It imports the Core v2 provider and evidence types directly and does
not declare a Documents copy. The callback receives the host-owned canonical
Core authority receipt after the host has acquired its Workspace, aggregate and
ordered provider-source locks. It never resolves Core authority itself, opens a
connection or transaction, commits, downloads, writes an access event, or
stages an idempotency, audit or outbox effect.

The exact binding uses `core-transaction-command.v2`:

- Workspace, Context, actor and Core revision use their existing command fields.
- `aggregate_type=documents.document` and `aggregate_id` bind the document.
- `subject_reference.kind=documents.document_version`, `id`, and `version` bind
  the immutable version; `relation=read` and `request_version=1` are fixed.
- `aggregate_version` must equal the subject version, and both document and
  immutable-version IDs must be in the existing provider-source lock set.
- permission, module and purpose are fixed to `documents.vault.read`,
  `documents`, and `documents.reference.read`.

Canonical document truth stays in `documents.documents`,
`documents.document_versions`, `documents.document_permissions`, typed links
and `documents.document_scan_attestations`. The Core receipt comes from the
canonical Core current-authority provider and evaluator in the same serializable
transaction. Documents' row visibility matches the checked Vault download's
classification, scope and explicit-view rules. It never invokes download
authorization, which writes an access event.

## Exact Workspace and upgrade

Migration `20261013063739_document_reference_exact_workspace_v1.sql` adds the
smallest missing binding: one nullable `documents.documents.workspace_id`, a
composite `(workspace_id,tenant_id)` foreign key to Core's existing unique
`(id,tenant_id)`, and the covering index required by the repository FK invariant.
It adds no default, unique constraint, table, authority source, routine, grant,
role, inferred backfill or ledger.

Legacy writes and existing rows remain compatible with NULL. Resolution requires
an exact non-NULL match and never infers Workspace from tenant, property, typed
links or a first/only Workspace. A future separately reviewed writer or backfill
must establish provenance before setting the binding. The migration changes no
ACL or RLS policy. The resolver holds a real shared document-row lock, so a
concurrent rebind or lifecycle change cannot silently reuse an earlier snapshot.

## Validation and concurrency sequence

1. Verify the fixed Core v2 command/subject shape and exact scope, authority,
   transaction, command, attempt, Workspace, actor, Context and aggregate locks.
2. Verify the native transaction ID, serializable isolation, authenticated actor
   and AAL2. Lock the exact Workspace/tenant document and exact immutable version
   `FOR SHARE`, then lock explicit permission rows in stable ID order.
3. Re-evaluate current Documents visibility before exposing version/readiness
   state. Unknown, cross-Workspace and NULL-bound documents share the same denial.
4. Require immutable version ID, parent document ID, tenant, numeric version and
   current pointer to match. Require active, non-deleted, non-archived lifecycle
   and retained, review-due or legal-hold disposition.
5. Require clean scan state, verified checksum and a non-future ClamAV attestation
   for the exact version and canonical content hash.
6. Re-evaluate Documents visibility, read the database clock and return the
   canonical Core typed provider evidence. No domain query occurs after evidence.

Core's serializable host performs a fresh authority evaluation on every attempt
and replay before this callback. Stale or revoked Core authority never reaches
provider acceptance. The real row locks cover legacy document/lifecycle/scanner
writers that do not use Core advisory locks. A conflicting committed change
causes PostgreSQL serialization retry; the fresh attempt observes the new state.
Timeout, deadlock, missing schema/grant and other failures become bounded Core
provider denial. Every denial occurs before the host's first durable write.

## Metadata-safe evidence

Accepted output is exactly `core-transaction-provider-evidence.v1`: provider,
transaction, command, Workspace, actor, Context, authority decision/revision,
attempt, caller-known subject identity/version/relation, evaluation time,
`reference_state=available`, and `current_actor_can_read=true`. Disclosure is
fixed to `status_only` with a NULL source reference.

Document title, bytes, metadata, object path, bucket, hash, MIME type, uploader,
tenant identity, permission lists, role details and entitlement data are absent.
Denials use the same bounded Core evidence schema and expose no source payload.
Evidence is accepted only inside the same host transaction and is persisted in
the existing v2 receipt inside the existing idempotency row; it creates no
Documents authority or evidence store.

## Verification and rollout

`test:doc-reference` checks direct Core type consumption, strict binding,
redaction and failure handling. `test:doc-reference:postgres` exercises the
actual Core v2 host, canonical authority provider, populated upgrade, ACL/RLS,
exact Workspace/document/version binding, stale/revoked/cross-Workspace/NULL,
unsafe scan, inactive lifecycle, concurrency and zero-write denials against a
disposable loopback database. pgTAP test 182 checks the additive schema binding
and closed ACL/RLS. Required Core provider-evidence tests prove the shared host
contract independently.

Connected dry-run/preflight and explicit Remote apply remain separate actions.
This candidate performs neither. Merge, Remote apply, provider-role grants,
writer/backfill wiring and runtime activation each require separate authorization.
