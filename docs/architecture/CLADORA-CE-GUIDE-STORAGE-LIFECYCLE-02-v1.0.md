# CE Guide storage and lifecycle v1

Status: Draft implementation; storage/provider review only. No runtime activation.
Owner: Community & Experience. Baseline: `main@53e5c74a287d792909fa14c79164abad31e711cd`.

## Reused persistence and transaction boundary

This slice promotes the existing CE012 proposal lineage into the same
`experience.guides`, `experience.guide_steps` and
`experience.guide_references` namespace. It does not install the proposal's
command RPCs or `guide_command_receipts`. Core remains the only owner of the
transaction, current authority decision, idempotency key, audit event, outbox
event and committed receipt.

The Guide aggregate stores a positive `version` and a positive
`content_version`. Every lifecycle or content change advances the aggregate
version exactly once. Publish changes `draft@V` to `published@(V+1)`;
unpublish changes `published@V` to `draft@(V+1)` while retaining the
immutable content snapshot. Cancellation remains a distinct terminal state and
is not implemented by the lifecycle provider.

Steps bind to an immutable Guide content version. References additionally bind
the exact Documents ID, immutable document-version ID, positive document
version, Workspace and bounded safe label. Step/reference rows cannot be
updated or deleted. Guide identity, tenant and Workspace cannot move; physical
Guide deletion is rejected. Future draft save support must append a new content
version under the same aggregate rather than replace these rows.

All three tables have RLS enabled and direct access revoked from `anon`,
`authenticated` and `service_role`. The migration adds no grants, permission
or module seed, API, reader, editor, notification or production wiring.

## Core host mapping

The inactive provider consumes `CoreTransactionProvidersV2` directly:

| Lifecycle binding | Canonical persistence |
| --- | --- |
| `aggregate_type=experience_guide`, Guide ID | Existing CE aggregate row, locked in the Core serializable transaction |
| `aggregate_version=V+1` | Exact conditional transition from subject version V |
| `experience.guide.manage / experience_guides` | Core canonical current authority and entitlement recheck |
| publish/unpublish relation and evaluation purpose | Separate `experience.guide.publish` and `experience.guide.unpublish` effects |
| provider evidence | Independent `ce-guide-lifecycle-provider.v1` status-only evidence |
| exact replay | Core `provider_current_state_required` marker plus CE read-only current-state decision |
| idempotency/audit/outbox/receipt | Existing Core host ledgers only |

The provider verifies the host transaction ID, serializable isolation, AAL2
actor binding, current CE authority, exact Workspace/tenant Guide row, exact
source version and expected lifecycle state. It locks the Guide row before the
mutation. The mutation performs one conditional status/version update through
the supplied Core scope and opens no connection or transaction of its own.
Expected stale, wrong-state, cross-Workspace, revoked or unavailable cases
produce bounded denial before any domain or shared-ledger write. PostgreSQL
`40001` is allowed to reach Core for a fresh transaction and authority check.

The Core receipt and CE evidence expose bounded identity/state only. They do not
contain Guide title/body/audience, safe labels, document IDs, membership IDs,
participants, message/service identifiers or storage metadata. Seeing a Guide
does not grant access to a document, message or SERVICE object.

## Exact replay and remaining dependency blocker

`CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01` is consumed with
`replay_policy=provider_current_state_required`. The CE hook runs through the
same `CoreTransactionScopeV1` read phase after current authority and receipt
identity matching. It binds the current Guide to the exact Workspace, actor,
command, stored receipt, resulting aggregate version and resulting lifecycle
state. The decision also verifies status-only provider evidence and current
target disclosure. A historical receipt without the persisted replay marker is
rejected by Core as unavailable and is never upgraded in place.

The hook uses only `SELECT ... FOR SHARE`; it cannot stage a Guide or shared
ledger mutation. PostgreSQL `40001` propagates to Core so the host retries the
complete authority and replay read in a fresh serializable transaction.

A Documents-owned transaction-scoped immutable selector is also required for a
Guide that contains references. Until it exists, publish of a referenced Guide
fails closed with `PROVIDER_UNAVAILABLE`. The provider does not wrap the
existing Documents reader, invent a selector or use cached visibility. Unpublish
remains target-free and can safely remove Guide visibility. No destination
access event is produced by lifecycle validation.

## Disposable PostgreSQL acceptance

`scripts/test-ce-012-guide-lifecycle-postgres-v1.mjs` executes the real
`createCorePostgresTransactionHostV1`, DB-backed current-authority provider,
canonical permission evaluator, shared ledgers and CE migration against a local
disposable PostgreSQL database. It covers:

- fresh publish and unpublish with exact V to V+1 transitions;
- exact publish/unpublish replay with byte-identical stored receipt and no new effects;
- changed Guide state/version, revoked authority and malformed/historical receipt denial;
- a real PostgreSQL `40001` during replay and a fresh Core read-phase retry;
- explicit separation from cancellation;
- stale version and cross-Workspace zero-write denial;
- two concurrent writers at the same expected version, with exactly one commit;
- current entitlement revocation before mutation;
- rollback after the Guide update and a real Core `40001` retry path;
- fail-closed referenced publish without a Documents selector and no access event;
- immutable reference, aggregate version, identity and physical-delete guards;
- status-only evidence privacy and closed table ACLs;
- unchanged production `commands={null}` and `can_edit=false`.

The historical proposal concurrency runner is no longer used by CE CI after the
canonical tables are installed. The affected pgTAP package now verifies the
private installed storage and absence of the legacy RPC/receipt projection.
Unrelated historical PostgreSQL suites are left to repository CI.
