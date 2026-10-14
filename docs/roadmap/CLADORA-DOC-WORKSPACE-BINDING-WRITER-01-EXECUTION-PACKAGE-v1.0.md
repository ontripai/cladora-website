# DOC-WORKSPACE-BINDING-WRITER-01 — limited execution package

Status: proposed for review; this Draft PR delivers documentation only.
Owner: Documents & Vault.
Design: [DOC-WORKSPACE-BINDING-DESIGN-01](../contracts/CLADORA-DOC-WORKSPACE-BINDING-DESIGN-v1.0.md).

## Deliverable and limits

The next candidate implements an isolated new-document intent/finalization
writer on the existing Documents/Vault store, using explicit Workspace selection
and canonical Core authority. It does not wire a production route, UI, consumer
or Storage policy. Replacement versions, historical binding, rebind/transfer,
Case/private-platform promotion and conversation attachment wiring are excluded.
Their required semantics are defined in the design and remain denied by the
isolated writer until separately delivered.

The current PR contains no implementation, migration, grant, backfill, resolver
change, Remote operation or activation. Acceptance of this document is not
authorization for those actions or for merge.

## Bounded implementation inventory

| Surface | Proposed change |
| --- | --- |
| Documents writer module and strict input schema | One private server composition using existing `CoreTransactionProvidersV1`, `CoreTransactionScopeV1` and canonical Core `resolveAuthority`; no copied authority/receipt interfaces. Two independently authorized commands: create intent and finalize initial version. |
| Existing upload intent table | Add nullable `workspace_id` and `prospective_document_id`. Workspace uses same-tenant composite FK/index. Prospective ID reserves a not-yet-created document identity and therefore has no premature document FK; lock/check it and insert that exact identity at finalization. Existing `document_id` retains its replacement semantics. Both new fields are absent together on old intents and populated together on new-only bound intents. No backfill/default or new table. |
| Intent provenance | Reuse Context/user/created/expiry/expected-version fields and existing shared Core receipts. Do not store cached allowed authority in the intent. Intent issue receipt's `mutation_id` identifies the intent; final receipt's `mutation_id` identifies the inserted immutable version. |
| Canonical document binding | Add a focused UPDATE guard rejecting every change to `workspace_id`, including NULL transitions. Existing INSERTs may still leave NULL; only the new validated writer supplies non-NULL binding. No blanket NOT NULL or resolver edit. |
| Immutable version metadata | At INSERT, include server-owned intent and transaction/command provenance in existing `metadata_json`; preserve content immutability, scan state, attestation and scan job behavior. |
| Isolated verification harness | Loopback-only database and injected stored-object verifier; no production Supabase endpoint/Remote URL. Label synthetic identity and object evidence. |
| Documentation | Record exact implementation/base/head, affected schema/ACL diff, checks and explicit evidence limits. |

No production API wrapper, UI, `src/lib/core`, CE/SERVICE implementation,
AIRPROP safety guard, generated DB types or shared workflow changes are part of
the initial slice. If an exact authority/privilege capability is unavailable,
report its owner dependency; do not add a bypass, grant or parallel interface.
Any new migration bytes need AIRPROP-owned guard review under its existing
manifest rule. Documents does not rewrite protected hashes or migration history.

## Validation matrix for the implementation candidate

Use the actual Core host and canonical provider in a disposable PostgreSQL
database. Count/digest existing document/version/intent/access-event/scan-job
rows and shared audit/outbox/idempotency rows before and after each denial.
Schema/ACL verification is catalog-based, not inferred from successful RPC use.

| Case | Required result |
| --- | --- |
| Populated upgrade | All pre-existing rows and NULL bindings byte-identical; old signatures and paths retain compatibility; no inferred data changes. |
| Exact new writer | Both commands select the same explicit Workspace/Context/actor. One document, version 1, consumed intent, normal scan queue and existing Core effect set. Full provenance agrees. |
| Missing/NULL Workspace or malformed/injected binding | Reject before effects; no fallback query for first/only Workspace or membership guess. |
| Same tenant/property, different Workspace | Deny against explicit command/intent binding even when actor can access both; no existence/permission disclosure. |
| Replaced Context or uploader | Deny with unchanged intent and all shared effects. |
| Revocation/expiry between issuance and finalization | Fresh post-lock canonical denial; intent remains unconsumed; no document/version/audit/outbox/idempotency write. Pre-existing object may remain private. |
| Revocation while waiting on host locks | Fresh attempt sees revision and denies; prove using real competing transactions. |
| Historical NULL intent/document | Cannot finalize through new bound path or attach a replacement; NULL unchanged and accepted resolver still denies with zero writes. |
| Rebind attempts | Direct UPDATE W1→W2, W1→NULL and NULL→W1 rejected, including when another transaction holds resolver shared row lock. |
| Fresh finalization race | One version and one consume; a changed command/key cannot consume again. Provider validation requires an unconsumed intent only on this fresh-command path. |
| Exact replay after consumption | Current host behavior is recorded accurately: authority and stored receipt are checked, then the receipt is returned before `validateProviders`. Full acceptance is blocked on `CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01`; after that Core hook, Documents validates the consumed intent and exact committed document/version/provenance without applying the fresh `unconsumed` predicate. |
| Unknown-commit recovery | Preserve `READBACK_REQUIRED` unless the separately reviewed `CORE-RECOVERY-AUTH-01` (#392) recovery path is implemented and integrated. Recovery does not satisfy or replace the execute replay hook. |
| Resolver racing finalization/lifecycle/scan | Old or pending/unsafe version never accepted; clean exact current version accepted only under unchanged resolver predicates. Shared/exclusive row locks and genuine serialization retry proved. |
| Scan states | Deferred, pending, quarantined, failed/mismatched checksum or missing/mismatched attestation deny reference acceptance; writer cannot assert clean. |
| Storage measurement | Changed bytes at existing path, mismatched hash/size/MIME, missing object and forged supplied path deny finalization. Synthetic object verifier is not live Storage/RLS acceptance. |
| Duplicate hash across Workspaces | Existing uniqueness produces bounded conflict; never reuses another document or reveals its identity. |
| RLS/ACL and immutability | Anonymous/authenticated direct reads/writes/internal EXECUTE remain closed; no new Storage SELECT/UPDATE/DELETE. Content/version/provenance rewrites rejected; legitimate scanner transition preserved. |
| Metadata-safe response | Writer projection and unchanged reference evidence contain no document content, hashes/paths, unrelated permissions, membership or entitlement payload. |
| Pool identity and retries | SQL actor/AAL belongs to verified request on every checkout/retry; failure/release does not leak claims to another actor. Synthetic claims do not close real Auth/MFA acceptance. |

The implementation runs its writer contract tests, affected PostgreSQL/pgTAP
tests, accepted Documents resolver regression and relevant Core evidence/host
checks only when affected by the change, plus required repository checks.
Preserve exact-head CI links. An isolated writer pass is not end-to-end HTTP,
Storage policy, real Auth/MFA, Remote installation or production acceptance.

## Dependencies and rollout gates

1. Documents review confirms provenance source, immutable binding, no inference,
   first-create scope and use of existing stores/ledgers.
2. Core owns and must separately deliver
   `CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01`: a read-only provider hook after
   current authority/receipt matching and before `execute` returns exact replay.
   Until it is merged and consumed directly, the Documents candidate must not
   claim current writer validation on replay. Core review also confirms command
   fingerprint, lock order and safe server identity binding. The recovery
   contract in #392 remains an independent readback path, not this hook.
3. AIRPROP reviews the exact proposed additive migration bytes; its owner updates
   the permitted-addition manifest. Until available, guard failure is reported as
   a dependency rather than fixed by Documents.
4. Prepare the isolated candidate and complete the matrix with explicit evidence
   limits. Any migration requires a separate connected dry-run/preflight; record
   target identity and upgrade/ACL/rollback evidence. Disposable local testing
   does not stand in for connected dry-run. This design performs neither.
5. Remote apply requires explicit separate authorization. Merge, access grants,
   historical binding, production HTTP/Storage wiring and runtime activation
   remain separate decisions. Do not execute them from this package.

## Evidence for this documentation delivery

Repository paths and effective migration definitions were read at the pinned
main. Canonical resolver and Core host/provider were inspected without edits.
The Draft diff must contain only this package and the design document, with
valid relative source links and `git diff --check` passing. No PostgreSQL or
Remote test is required or claimed for prose-only delivery. Supabase's external
changelog fetch was blocked by the Environment HTTP policy; the design uses
checked-in behavior and introduces no platform API feature assumptions.
