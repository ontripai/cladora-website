# DOC-REFERENCE-AUTHORITY-01

Status: inactive candidate. Documents/Vault owns `documents-reference-authority.v1`.
No route, consumer, grant, backfill, scanner or runtime activation is included.

## Contract and canonical sources

`resolveDocumentsReferenceAuthorityV1(scope, request)` consumes the existing
`CoreTransactionScopeV1`. It never opens a connection or transaction, commits,
downloads, writes an access event, or stages any idempotency/audit/outbox effect.
Call it before protected mutation, including every retry and replay. The caller
derives Context, Workspace and expected Core revision from trusted server state;
the actor comes exclusively from the scope and must match database `auth.uid()`.

The strict request binds Context, Workspace, command ID, expected authority
revision, document ID, immutable version ID, exact positive version number and
`new_command|replay`. Both modes require the exact current version. Historical
versions are denied. This contract does not change CE's contract-only
`docs-ce012-reference-request.v1` or implement its historical replay policy.

Canonical document truth stays in `documents.documents`,
`documents.document_versions`, `documents.document_permissions`, typed links and
`documents.document_scan_attestations`. The sole Core authority provider is
`src/lib/core/current-authority-postgres-provider-v1.ts`, using the canonical
evaluator, same serializable snapshot and commit-coupled revision barrier.
Documents' row visibility matches the checked Vault download's classification,
scope and explicit-view rules, using the existing pure scope/relationship helpers.
It never invokes download authorization, which writes an access event.

## Exact Workspace and upgrade

The old canonical table has no exact Workspace. Migration
`20261013063739_document_reference_exact_workspace_v1.sql` adds one nullable
`workspace_id` and a composite `(workspace_id,tenant_id)` foreign key to Core's
existing unique `(id,tenant_id)`. No new unique index, table, authority source,
routine, grant, role, inferred default, legacy rewrite or ledger is introduced.

Legacy uploads and rows remain compatible with NULL. Reference resolution denies
NULL; tenant, property, typed link and a first/only Workspace are never substituted
for an explicit canonical binding. A future reviewed writer/backfill package must
establish provenance before setting a binding. Without this migration, missing
schema returns bounded provider-unavailable denial. Existing ACL/RLS and all 247
main migration files remain unchanged. An applied binding may be changed only by
existing authorized canonical writers; the resolver holds a real document row
lock, so a concurrent rebind cannot silently reuse an old Workspace observation.

## Read and concurrency sequence

1. Validate strict inputs and same-Workspace scope; verify native transaction ID,
   serializable isolation, authenticated actor and AAL2.
2. Lock the exact Workspace/tenant document and immutable version `FOR SHARE`.
   Lock existing explicit document view rows in ID order before the Core barrier.
   These locks protect legacy document/lifecycle/scanner writers as well as host
   users. No lock depends on advisory-lock participation by legacy writers.
3. Derive the post-lock instant and call the canonical Core provider for the fixed
   `documents.vault.read` permission and `documents` module. Validate the existing
   Core observation/receipt bindings. No client-selected permission/module exists.
4. Check canonical document row visibility before revealing any version/readiness
   status. The Core provider decides which Context/Workspace combinations are
   supported; Documents never widens its scope or substitutes a legacy allow.
5. Require version ID, parent document ID, tenant, version number and current
   pointer to match; require active/non-deleted/non-archived lifecycle and retained,
   review-due or legal-hold disposition. Pending/approved disposal and expiry deny.
6. Require `clean`, verified checksum and a ClamAV attestation for the exact version,
   matching its canonical hash and with non-future scan/record timestamps.
7. Recheck Core authority with a new decision ID and re-evaluate row visibility.
   Return evidence only in the same transaction. Time expiry is not cached.

An overlapping writer may linearize after a reader holding the relevant locks.
Authority changes committed after the reader snapshot force `40001` at the Core
barrier; it escapes to the existing host for bounded fresh-transaction retry.
Document row changes committed while a reader waits also force fresh retry.
Timeout, deadlock, missing schema/grant, invalid binding and other provider failures
return bounded denial; SQL errors and provider source details are not exposed.
The caller must discard all evidence on transaction abort and must not use it in
another transaction. Real SQL row locks require an ordinary serializable
transaction, not PostgreSQL `READ ONLY` mode; all resolver SQL is SELECT-only and
reviewed pure, and the tests verify unchanged durable state even after COMMIT.

## Metadata-safe result

Allow evidence contains only the exact input identities, transaction/attempt,
expected revision, evaluation instant, clean/active statuses and the fixed label
`Document reference`. It is transaction-bound and explicitly non-reusable as
authority. Document title, bytes, raw metadata, paths, bucket, hashes, MIME type,
uploader/tenant identity, permission lists, role and entitlement details are absent.
All denial evidence is NULL. Unknown/cross-Workspace/unbound targets use the same
authority-denied result; version or readiness reasons require current read access.

## Validation and rollout

`test:doc-reference` tests strict contracts and error/redaction boundaries.
`test:doc-reference:postgres` runs the actual provider, real Core evaluator,
canonical revision hooks, populated upgrade, ACL/RLS, denial digests, expiry,
locking races and existing-host integration against a disposable loopback target.
pgTAP `182_document_reference_workspace.test.sql` checks the additive binding and
private ACL/RLS. The existing Database tests workflow runs these on a full local
Supabase stack; no deployed service is wired by CI.

Connected dry-run/preflight and explicit Remote apply are separate requirements.
Read-only Remote catalog/history preflight must confirm the composite key,
existing ACL/RLS, Core migration dependency and absence of the new version. It
does not apply DDL or repair history and is not a substitute for the separate
connected Remote CLI `db push --dry-run` inventory. A failed link or unavailable
dry-run is a blocker, never PASS. Release must inspect the exact pending set
before any separately authorized Remote apply. Existing private PM history
and DB-HIST exception handling are outside this package.

Merge, Remote apply, provider-role grants, writer/backfill wiring and consumer
runtime activation each require their own explicit authorization. Draft review
and passing tests grant none of them. Rollback before apply is withdrawing the
candidate. A future rollback after apply should disable consumers and preserve
canonical binding provenance with a separately reviewed forward change.
