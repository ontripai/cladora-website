# CE-GUIDE-PERSISTENCE-DESIGN-01

Status: design for owner review; no runtime acceptance or activation.
Owner: Community & Experience. Source baseline: `main@df8124807a702f3b6fdcce3903e74aed7c713c67`.

## Verified reuse and missing persistence

This inventory describes repository installation sources, not a claim about a remote database. No remote catalog was queried. PR #386 is merged at `e257d6facee29f78721db5062a9ac8645aa524d4`; its accepted audience provider is outside this package and is unchanged.

| Source | Observed boundary | Reuse / required delta |
| --- | --- | --- |
| `src/lib/community/experience-guide-schema.ts` and `experience-guide-domain.ts` | Guide identity, Workspace, steps, audience, positive version; draft/published/cancelled; publish and cancel commands | Reuse CE aggregate and exact-version semantics. No unpublish command exists. Cancellation is terminal, not reversible unpublication. |
| `supabase/proposals/ce_012_experience_guide_operational_v1.sql` | Proposed `experience.guides`, `guide_steps`, `guide_references`, `guide_command_receipts`; publish/cancel RPC | Review-only proposal, also copied into `supabase/tests/fixtures/ce_012_experience_guide_operational_v1.inc`. None of these Guide objects is installed by `supabase/migrations` at this baseline. Use this single proposed CE storage lineage; do not create another Guide store. |
| `experience-guide-command-contract.ts` | `ce012-guide-command.v1` supports only `save_draft`; immutable Documents version binding and strict success receipt | Preserve v1. Publish/unpublish need an explicitly versioned lifecycle contract; do not pass them through the save-only schema. |
| `experience-guide-provider-bridge.ts`, editor adapter and acceptance kit | Injected Core authority / Documents selector; save-only request mapping | Reuse binding rules and canonical ports. Add lifecycle-specific port mapping after owner review; the save bridge is not a ready publish provider. |
| `service-experience-coordination-receipt.ts` | Four SERVICE coordination actions; pure evaluator, source/Order/subject versions and participant rechecks | No installed coordination source/receipt store found. Its four actions do not include Guide publication. Do not relabel this receipt as a Guide lifecycle receipt or treat its pure evaluator as persistence. |
| `src/lib/core/postgres-transaction-host-v1.ts` | Serializable single-connection host, canonical authority, locks, shared receipt, audit/outbox/idempotency; v2 typed provider evidence | Reuse transaction and all durable ledgers. Host currently returns only `mutation_id` from mutation and validates a strict receipt; arbitrary CE receipt fields cannot be appended. |
| `platform.idempotency_keys`, `audit.events`, `platform.outbox_events` | Existing tenant-scoped canonical ledgers | Only these own replay, audit and outbox. No CE idempotency table, independent outbox, or alternate authority truth. |
| Guide page/client and API route | Page passes `commands={null}`; client maps `can_edit=false`; legacy route references proposed RPC names | Existing route code does not prove those RPCs are installed or operational. Preserve closed editor; no activation follows from this design. |

The proposed `guide_command_receipts` table is a domain response projection, not an independent ledger. The lifecycle path does not need it: the canonical Core receipt in `platform.idempotency_keys.response_ref` already binds Guide aggregate ID and resulting version. Do not install a second receipt table for publication. If separately authorized save persistence later installs that projection, it must remain derived, immutable and subordinate to the shared key, never another collision/replay authority.

The coordination evaluator's in-memory replay snapshot is not a durable store. This package does not invent a coordination source schema: its canonical source/state owner contract and transactional receipt attachment are separate CE/Core dependencies. SERVICE continues to own Order/version/state and only consumes CE references/receipts; neither publication nor unpublication mutates an Order or proves cancellation/compensation.

## Lifecycle command and persistence mapping

Proposed contract identifier for review: `ce-guide-lifecycle-command.v1`; actions `publish_guide` and `unpublish_guide`. Do not expand existing strict save or coordination v1 contracts silently.

| Command / trusted binding | Core / CE persistence |
| --- | --- |
| contract/version, action, command ID, transaction ID | Strict server-assembled command; action binds a distinct purpose (`experience.guide.publish` or `experience.guide.unpublish`, proposed). |
| Context, Workspace, authenticated actor | Core canonical context, tenant and membership; client-supplied actor/authority/entitlement outcomes are rejected. |
| Guide ID, positive safe `expected_guide_version=V` | `aggregate_type=experience_guide`, aggregate ID=Guide ID; locked CE row must belong to exact tenant/Workspace and have version V. |
| Core `aggregate_version` | Result version V+1, positive safe; expected source version is `aggregate_version - 1`. Deny overflow before invoking host. |
| Action, expected state, reason, exact audience/reference bindings | Fingerprint covers normalized full command plus trusted actor/effect binding. No content, target or audience edit is accepted by publication. |
| idempotency key | Core's existing Workspace-scoped `core-tx.v1` key; the server preserves original command/transaction identity for retry. |
| permission/module/entitlement | Existing proposed `experience.guide.manage` / `experience_guides` / `module.experience_guides`, pending canonical registry confirmation by Core. Read permission never substitutes for manage. |
| CE evidence | New CE provider identity/evidence ID using `core-transaction-provider-evidence.v1`, exact Guide source reference and transaction/authority bindings; no reused Documents/message evidence ID. |
| successful receipt | Canonical Core v2 receipt: Guide aggregate ID, V+1, command/action purpose, authority, independent CE evidence, mutation ID and shared audit/outbox IDs. SERVICE receives an authorized bounded Guide reference/version and receipt reference, never internal key/fingerprint/member metadata. |

State transitions: publish `draft@V -> published@(V+1)`; unpublish `published@V -> draft@(V+1)`. `cancelled` remains terminal. Publish while published, unpublish while draft, any cancelled state, missing row, unsafe version or wrong Workspace denies. A fresh duplicate key is an invalid-state denial, not another version increment. The exact original key may replay its historical committed receipt after current checks.

Unpublish removes future Guide reader visibility immediately after commit. It does not delete content, invalidate an immutable historic receipt, cancel a service, revoke a document/message grant, or send a notification. Read-back distinguishes historical command completion from current Guide visibility/state. Publication cannot make previously private content public by changing the audience; audience changes remain a separately authorized versioned edit.

## Transaction boundary and order

1. Validate bounded request and derive actor/context server-side. Fingerprint binds action, Guide, expected/result version, reason, audience snapshot and immutable reference set. Reuse current Core host locks in order: idempotency advisory lock; active Workspace row lock; Guide aggregate advisory lock; sorted unique provider-source advisory locks. Every participant writer must use compatible locking; advisory locks alone do not protect against direct SQL writers.
2. Inside the same serializable connection, recheck current canonical authority revision, membership, module and effective entitlement after locks. Resolve and lock the exact CE Guide row. Recheck scope/authority after any blocking row/provider lock; stale or revoked decisions deny.
3. For a new publish, require draft V and valid CE audience. Evaluate all named immutable Documents references through Documents-owned canonical visibility/selector in the supplied SQL scope; no HTTP/session-independent allow cache. Existing Documents v2 provider requires its own Documents profile, so CE manage evidence cannot be substituted for Documents authority. A scope-bound selector port is a Documents-owned dependency. Unsupported message/service destinations fail closed until their owners expose equally scoped reference decisions. Unpublish validates CE authority and Guide state; it does not require opening targets to remove Guide visibility.
4. Apply replay validation before returning a stored receipt (Core dependency below). For new commands, return bounded typed CE evidence from read-only provider validation; genuine PostgreSQL errors propagate. Expected stale/denial returns a decision, never a fabricated `40001` exception.
5. In mutation phase, perform final canonical recheck and exact conditional Guide transition. A row-count mismatch aborts the entire transaction, including any staged shared key. State/version change is exactly V->V+1. Mutation uses the supplied scope and returns Guide ID as `mutation_id`; it opens no independent connection or transaction and writes no duplicate shared ledgers.
6. Core alone stages shared idempotency completion, redacted audit, outbox and receipt, then commits once. Failure after the Guide update rolls back all effects. SQL-level Guide guard must require every content/audience/reference/lifecycle change to increase version exactly once, retain immutable Guide tenant/Workspace/ID, and prevent physical deletion/reinsert resetting identity. Child writes require the same locked/versioned aggregate protocol.
7. A real serialization `40001` is retried by Core in a fresh transaction with fresh authority/source checks. An uncertain COMMIT returns `unknown_commit / READBACK_REQUIRED`: no blind resubmission with a fresh key and no claim of zero durable writes. Unknown commit may already have committed; it must cause zero *additional* writes until guarded read-back resolves it.

## Replay and revoke dependency on Core

Current host exact replay rechecks canonical authority and entitlement, validates the full stored command hash and receipt, and returns before `validateProviders`. It does not re-read Guide state/version, participant/audience or immutable target visibility on replay. Therefore the existing host alone cannot meet the stronger lifecycle replay policy below. Do not hide these checks inside a fake authority resolver or implement a CE replay ledger.

Required Core-owned extension: a read-only, same-scope replay-validation callback invoked after current authority and stored fingerprint/receipt validation, before returning exact replay. It receives the stored immutable receipt and requested command; expected denial aborts with a bounded result, database exceptions propagate, and no mutation callback runs. It must run in a fresh transaction on retry and bind the same locks/Workspace/actor/attempt. No changes to Core are made by this documentation package.

CE replay policy: same key and byte-identical normalized effect returns the original receipt ID/version/time, with zero additional domain/audit/outbox/idempotency writes, only if authority is current, Guide exists in the exact Workspace, current version equals the stored resulting version and state matches the committed action. A later Guide revision, cancellation/unpublication, revoked actor/module/entitlement, or now-denied publish reference blocks replay/read-back and never claims a new success. Do not compare the original expected V to resulting V+1 on replay. Changed payload/action/Guide/Context/version/actor/effect or expired key returns conflict; it does not generate a new receipt.

For the separate SERVICE coordination contract, retain its stricter Order/subject/source/participant rechecks on replay; the pure evaluator already performs these before reading its replay snapshot. A future coordination runtime must use the same Core replay hook and canonical shared receipt attachment. Guide publication is not one of its four actions.

## Access and privacy

Guide read is governed by current CE read permission/module/entitlement, exact Workspace, published state and CE audience. It confers no access to a message, service/Order or destination document. Each target open and safe label is evaluated independently by its canonical owner against current access; hidden targets are redacted/omitted without revealing body, storage path, classification, participant, membership or unrelated Workspace metadata. Author visibility at publish time is never proof that every Guide reader can open a target.

Persistence remains private with RLS, composite tenant/Workspace foreign keys, no direct client table rights, and owner-reviewed function privileges. Any privileged function must have a fixed `pg_catalog` search path and fully qualified objects plus explicit actor/scope checks. No GRANT, exposed schema change, public RPC activation or module seed is in this design. Evidence/audit/outbox use bounded identifiers and decision codes, not Guide text or target payload. Public denial mapping must not reveal whether an inaccessible Guide/target exists.

## Implementation deltas and owners

| Owner | Minimal future package | Completion gate |
| --- | --- | --- |
| CE | Versioned lifecycle command/evaluator and CE provider; promote the existing Guide storage lineage with immutable IDs, exact-version aggregate/child guards and immutable Documents version references; conditional publish/unpublish writer | Same-scope real PostgreSQL/Core tests below; no second Guide store, authority or ledger. Old proposal RPC cannot run alongside Core host and duplicate audit/outbox/key writes. |
| Core | Confirm canonical Guide permission/module/entitlement profile and implement reviewed same-scope replay-validation hook | No read/manage fallback; replay denial before returning stored success; current revision/entitlement and 40001 behavior proven. |
| Documents | Transaction-scoped immutable reference selector using existing canonical store/access truth | Exact Context/Workspace/document/version binding, safe label redaction and revoke/stale denial, without download/access-event side effects. |
| CE + Core | Separately define transactional attachment for a full coordination receipt if SERVICE later needs operational issuance | Strict Core receipt currently has no arbitrary domain payload; lossless attachment must be owner-reviewed within existing shared response/audit infrastructure. Do not claim it exists or create another coordination receipt ledger. |
| SERVICE | Consume authorized CE Guide reference/receipt only | No CE storage mutation, inherited target access, or publication-to-Order-state projection. |

Sequence: approve lifecycle and storage-lineage design; Core registry/replay contract and Documents scoped selector; CE isolated migration/provider/gateway with editor still disabled; disposable DB validation and owner review; independently authorize runtime exposure/activation. Frozen local CE runtime candidates are historical proposals, not installed schema or permission to publish them. Migration is a separate package; this PR contains no SQL or runtime code.

## Required host-level acceptance package (specified, not executed here)

Future CE-owned runner: `scripts/test-ce-guide-lifecycle-postgres-v1.mjs`, disposable local PostgreSQL only, real canonical Core authority and `createCorePostgresTransactionHostV1`, all installed migrations plus the separately approved Guide migration. No authority stubs or in-memory-only acceptance. Fixtures use synthetic identities and private labels; output only case names, decisions and counts. Record exact code SHA, DB migration manifest, test count and host/profile binding.

| Case | Required assertion |
| --- | --- |
| Publish draft V | One committed transition to published V+1, one canonical key/audit/outbox, one bound Core receipt; content/audience/references unchanged. |
| Unpublish published V | One transition to draft V+1; Guide unavailable to readers; no target or SERVICE mutation. |
| Cancelled / wrong state / missing Guide / overflow | Bounded denial, zero durable writes across Guide/children/shared ledgers. |
| Concurrent keys, same expected V | Exactly one transition; other writer stale/invalid-state, zero additional durable effects. |
| Concurrent identical key | One commit; other exact replay with same immutable receipt ID and zero additional effects. |
| Changed payload/action/version/Context with same key | Replay conflict; no transition or new key/receipt/audit/outbox. |
| Replay after later version / unpublished / cancelled | Current-state validation blocks stale receipt exposure; no mutation. |
| Revoked membership, assignment, permission, module or entitlement | Deny new command and replay; real canonical revision changes are observed. Base role/read permission cannot grant manage. |
| Cross-Workspace/context/tenant | Denial with no existence/private-data disclosure and no writes in either scope. |
| Stale/revoked/ambiguous document version / unsupported target | Publish denied; safe label redacted; no metadata or target access event. |
| Reader can see Guide but cannot read destination | Guide remains permitted and redacted; destination owner denies open; no message/service/document access expansion. |
| SQL exception / real 40001 | Unexpected error rolls back; 40001 reaches Core and retries fresh authority/source scope, without duplicate durable effects. |
| Failure after Guide update, before receipt completion | Entire transaction rolls back Guide/version and all shared effects. |
| Lost COMMIT response | Unknown result; guarded read-back resolves same receipt or bounded failure; zero additional effects. Never assert zero original commit effects. |
| Direct Guide/child mutation / delete-reinsert | Version guards prevent reset, Workspace movement, content change without exact increment and bypass of aggregate protocol. |
| Evidence/privacy | Independent CE evidence ID/code, exact Guide/authority/attempt/version binding; no body, participant/member ID, target storage metadata or internal fingerprint in public receipt projection. |
| Closed editor RO/EN/FA | `commands=null`, `can_edit=false`; publish/unpublish API wiring absent until separate activation authorization; late completion cannot repaint a different Guide/Workspace. |

Snapshot comparisons cover Guide/step/reference rows plus canonical idempotency, audit and outbox counts before/after each denial. Fixture setup writes occur before the measured command boundary. Replay checks assert byte-equivalent stored receipt, not newly fabricated timestamps. Physical-object/privilege tests query real catalogs. These cases are acceptance requirements, not PASS evidence from this design PR.
