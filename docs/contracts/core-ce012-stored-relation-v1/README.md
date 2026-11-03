# CORE-CE012-STORED-RELATION-05

Original05 Base: `5437a97e97f422219b064197c06c3f17b244ebf4`.
Current expiry06 direct parent: `ddd96badd5eda0993ec19a609292b3bdbe3b1c02`.
Consumer source: Documents compiler `5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa`.
ABI: `core-ce012-stored-relation.v1`.
Dependency: `DOCS-CE012-CASE-PLAN-01/CE_SAVE_CORE_STORED_RELATION`.

## Delivered bounded Core component

`readCoreCe012StoredRelationV1(scope, value)` reads an existing canonical Core/C03
record through the existing host's private `CoreTransactionScopeV1`. It does not
open a connection/transaction, acquire a second host, retry, mutate, issue a receipt,
call an injected verifier or implement an evaluator. No public route is connected.
Runtime binding is NULL.

The strict request contains the existing Core V2 command, existing CE012 save
command, expected Core receipt ID/hash, expected CE save receipt ID, and explicit
receipt-hash algorithm contract. It reuses the original schemas and CE payload
fingerprint. The exact immutable document/version IDs and number, Guide version,
Context, Workspace, key, transaction, command, subject and action must agree.
The target and its label remain covered by the original complete CE payload hash;
no title, JSON-shape or current-state GET substitutes for it.

The reader uses the host's existing parsed-command identity, without changing it:

- key: `core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
- request hash: SHA256 of JSON.stringify of the existing Core schema-parsed command;
- source: the exact tenant/key row in `platform.idempotency_keys.response_ref`;
- receipt parser: existing `coreTransactionReceiptV2Schema`;
- receipt hash: existing `coreTransactionReplayReceiptHashV1(parsedReceipt)`, whose
  domain prefix is `core-transaction-replay-provider-receipt.v1\0`.

This is NOT the replay-command hash or the Documents compiler's sorted content
hash. A future consumer must explicitly bind this hash algorithm; these hash
names/bytes are not silently interchangeable. Input object key order is normalized
by the same parser used by the host. Array order keeps its existing meaning.

The original05 locking SELECT projected an expiry boolean. CORE-STORED-EXPIRY-01
supersedes that mechanism: PostgreSQL may evaluate that expression before the
FOR SHARE wait. The exact Base reader reproduces stale matched in a controlled
awaited-lock model; no native PostgreSQL reproduction is claimed.

Current order is two **awaited fixed SELECTs** in the SAME existing transaction:

1. `CORE_CE012_STORED_RELATION_SQL` reads the tenant/key row FOR SHARE, returns its
   exact expires_at as UTC microsecond timestamp and transaction/actor/isolation,
   and completes. It computes NO expiry boolean and invokes no clock function.
   Missing/malformed/ambiguous/foreign rows stop before any match. Existing
   command, body, receipt/hash, subject and target binding checks then run purely.
2. `CORE_CE012_STORED_EXPIRY_SQL` binds THAT locked timestamp as $1::timestamptz,
   materializes current transaction/actor/isolation metadata, then evaluates
   `$1::timestamptz > clock_timestamp()` as a fresh scalar observation. It acquires
   no additional application row locks or table reads. The materialized source
   orders metadata evaluation before the outer clock expression. The first query
   has returned before this statement can be submitted; a pre-lock true boolean
   cannot survive into this decision. FOR SHARE remains held until the existing
   owner transaction settles, so the observed expiry cannot be retargeted by a
   concurrent ledger update/cleanup while this read is in progress.
3. Scope identity is revalidated after EACH await; second-statement transaction,
   actor, isolation, cardinality and strict boolean must be valid. Equality is
   expired. No SQL/await follows this final observation on the matched path.

No JS clock/date comparison, TTL extension, additional transaction/connection or
host is used. Parameter formatting preserves the stored PostgreSQL microseconds;
comparison occurs on the server. Query/clock results supplied through an
untrusted transport are not admitted evidence. This reasoning and the controlled
model are source evidence; native PG planning/evaluation/locking/concurrency
remain NOT_RUN, not a compiler/runtime proof. No guarantee through future COMMIT,
ACK, response delivery or client display is introduced.

This observation is protected from concurrent row modification/cleanup by the
existing transaction until it settles. It is neither backend COMMIT proof nor a
new authority decision, and makes no after-settlement/ACK guarantee. The receipt's
authority is historical. The surrounding trusted owner must separately establish
current session, permission/entitlement and disclosure before calling/exposing
historical data. This adapter never upgrades historical authority into current
permission or validates a caller-supplied current allow. It returns no receipt,
private source IDs, target or body. Domain/content/currentness is not inferred
from equality of a hash. Full native custody/profile admission is still open.

## Honest result: no full-relation success variant

Every result has `status=not_ready`, `stored_ce_relation=null`, and
`action_authorization=not_evaluated`. The bounded internal diagnostic
`core_status=matched` means only that the canonical Core ledger observation
matched all available bindings; code remains `CE_SAVE_WRITER_BRIDGE_MISSING`.
Other diagnostics are missing/mismatch/expired/unavailable and expose no private
error details. Original SQLSTATE40001 is rethrown unchanged, once, to the existing
trusted host. No retry engine or write is introduced.

There is deliberately no canVerify/allow callback, committed flag, ready switch
or alternate receipt store. Even equality of Core mutation_id and the proposed
CE save receipt ID does not establish the missing relation. The Documents
compiler and its two historical slots are unchanged and remain BLOCKED.

## Source evidence and exact missing bridge

Pinned source lines/ranges and hashes are in `manifest.json`.

| Producer/source | Actual effect | Why insufficient for CE save relation |
|---|---|---|
| CE command-contract, evaluateCe012GuideSaveCommand | Builds mutation plan and planned receipt from snapshot.issuance | Does not persist either the CE receipt or its relation to Core receipt |
| CE editor-adapter, runtime.commit(plan) | Calls an injected runtime and compares returned receipt to planned receipt | Comparison is not a concrete canonical store/writer/transaction binding |
| Core host, mutation + idempotency response_ref update | Calls provider.mutate; persists strict Core receipt, with provider mutation_id | Receipt ID is independently generated; no CE save receipt or immutable document target relation is written by this generic host |
| Legacy proposal customer_api.command_ce_guide_v1 | create_guide/revise_guide/publish_guide/cancel_guide; legacy guide_command_receipts | Different commands/ABI; not save_draft and not canonical V2 save relation |
| CE lifecycle provider | publish/unpublish conditional Guide mutation returns Guide ID as mutation_id | Not a CE save receipt writer; ID equality is not a contract |
| Documents compiler historical cases | Validates historical references, then always emits BLOCKED | Caller references/GET cannot lift the missing canonical verifier dependency |

The bounded search covers the pinned canonical modules and their CE source
consumers in this Base and the exact Documents compiler successor. It is a source
finding, not a claim that no other private environment or live DB object exists.
No live SQL or catalog was queried.

Owner of remaining bridge: CE producer/runtime writer, with Core host contract
review and Documents immutable-target/custody review. Minimum handoff required:

1. Exact versioned save_draft provider/writer ABI and FullSHA; bind existing Core
   V2 command to CE payload, issuance receipt ID, Guide version transition and
   full immutable document target. Supply admitted provider_code/replay policy.
2. Demonstrate the actual writer persists the CE receipt and this relation
   atomically with mutation and existing Core receipt/audit/outbox in the SAME
   Core host transaction. Choose and review the actual persistence location;
   this task creates no table, receipt field, grant or idempotency ledger.
3. Explicitly define Core mutation_id versus CE receipt_id. Never infer equality.
   Persist sufficient immutable provenance for independent historical verification
   of target, version, command/key/body, tenant/actor/Context/Workspace and both
   receipt hashes/IDs. Do not use the legacy table without an approved writer ABI.
4. Bind that exact canonical store/profile/reader to the admitted same-database
   custody/run evidence. Then prove read-only reconciliation/replay/current
   disclosure, expiry, rollback, collision and same40001. Define expiry/history
   retention behavior without silently inventing an indefinite success policy.
5. Only a separately accepted coupling may extend the result ABI to a verified
   full relation and connect Documents/CE. Recompile the historical slots under
   that explicit assignment; neither this source nor a mock may mark them ready.

These are a precise producer dependency and closure criteria, not implementation
or approval of a new CE store/permission. No general product-policy decision is
requested by this bounded Core delivery.

## Verification and limits

Historical05 evidence:30 targeted controls and coordinator acceptance at the
exact predecessor remain preserved; that suite is NOT_RERUN for expiry06. Its
fixture is adapted to the two-statement read ABI so future owner invocation stays
coherent, without treating its previous PASS as fresh source execution.

New targeted invocation:
`node scripts/test-core-ce012-stored-relation-v1.mjs --expiry-only`
15 controls PASS: source lock/fresh-clock ordering, positive post-lock match,
expiry crossing during an actual awaited synthetic barrier, equality boundary,
last microsecond before expiry, scope drift after either await, fresh actor/
transaction/isolation mismatch, original40001 at either statement, fresh
cardinality0/2 and malformed boolean. All model responses assert NOT_READY/null/
not_evaluated. Scope assertions reject any non-SELECT/DML attempt; runtime=NULL.
The positive is only a controlled Core-row match, never a CE relation/native proof.

`--prove-expiry-predecessor` loads the exact ddd96bad reader Git object and runs
one counterexample: true projected before the simulated lock wait survives an
expiry crossing and incorrectly yields matched. That reproduction was made before
the source correction. Neither this model nor its synthetic server clock is a
PostgreSQL/driver/Auth execution. No S01 or unrelated accepted suite is rerun.

Full ES5 typecheck, limited lint, syntax/diff and immutable accepted-source pins
are checked. NOT_RUN: PostgreSQL/SQL parser/compile/query, real Auth/DB/custody,
CE writer/receipt creation, transaction settlement, native concurrency, install,
grant/activation, staging/Production, merge/deployment. S01, SQL, shared host/
authority and Documents/CE owners' product source remain byte-identical.
