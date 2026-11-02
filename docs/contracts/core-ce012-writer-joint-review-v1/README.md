# CORE-CE012-WRITER-RELATION-JOINT-REVIEW-09

Fixed task Base: `db8acfc08c4687f2f8e3bc140f380be6b4daab89`.
First published delivery `ae8107ad170139b650e884863f83ccb0db63edf2` and its direct
parent db8acfc0 are preserved. This follow-up appends a normal child of ae8107ad;
full-successor artifact comparison remains against the fixed task Base. Replacing
the published child with another direct child of db8 would require forbidden
history rewriting/force, so no such operation is performed.
CE candidate: `d767e84a6d8489ee731f64eb5c8b38f29d35a7fe`.
Documents provider: `c0caf3e70d97c3d09b16cbff91188367804cba6b`.
Documents compiler: `5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa`.

Verdict: **CHANGES_REQUESTED_SCOPED_SOURCE** for the CE candidate. Core's bounded
integrity composition is delivered for review; runtime=NULL and full relation
NOT_READY. This does not alter the result or parent of read-host08.

## Review findings, together

| ID | Classification/owner | Source witness and fresh counterexample | Minimum closure |
|---|---|---|---|
| CE-WR09-F01 | HIGH; source current-authority/expiry blocker; CE | writer evaluate awaits bridge/Docs at148–150, returns stored plan/evidence at168–187, then mutate consumes that plan at189–206 without a fresh canonical/session checkpoint. Actual Docs authority/visibility/scan waits precede its final clock. In a NEW controlled coupling, canonical membership becomes expired after the final Docs visibility wait; actual CE/Core still commits Guide/CE projection/C03/audit/outbox. Canonical revision locks cannot stop elapsed-time expiry. No membership/authority reread occurs after the modeled boundary. | CE must recheck the real canonical scope/session/authority after the final Docs waits and bind the validated plan/evidence to that checkpoint; recheck at the mutation/effect boundary using existing Core canonical provider/session APIs. Denial must stop/rollback and preserve UNKNOWN/original40001. Any further implicit waits require the existing approved checkpoint/rollback contract; do not claim that every wait has drained or rewrite the command host. Native participation/currentness proof remains separate. |
| CE-WR09-F02 | MEDIUM caller-contract dependency; CE, before caller adoption | writer inserts the caller's step_id at197–200 for every new content version; pinned guide_steps has GLOBAL id PRIMARY KEY. A second schema-valid save at expected Guide version2 with new command/key but the same existing step_id hits23505 in the constraint-aware transport and rolls back to version2, preserving the first receipt/history. | Define and enforce canonical per-content-version storage step-ID ownership/allocation BEFORE hashing/retaining the new command, stable across same-command UNKNOWN/retry. Do not rekey an unresolved command, DROP/rename the PK or silently rewrite the body. If step_id must instead remain a stable logical ID, that is a separate versioned storage/caller contract decision. |

F02's underlying collision restriction is already candidly described in CE's
README. The new finding is the unresolved canonical caller precondition, not a
rediscovery of an undisclosed PK or a claim of data corruption. The tested writer
fails closed and rolls back. F01 blocks joint source acceptance; F02 must be
resolved or explicitly bounded before the writer is adopted by a real caller.
Both counterexamples use the actual Git-pinned CE/Core/Docs code and NEW transport
scenarios, not the owner's27 tests. No native SQL/PK/trigger execution is claimed.
No CE/Docs file is changed or copied into Core; findings are handed to their owner.

## Accepted source structure versus native gates

The canonical key remains `core-tx.v1:Workspace:key`. Core parses the command and
computes SHA256(JSON.stringify(parsedCommand)); CE receives that private command
and uses the SAME hash/key, not sorted receipt content or a new ledger.

Three identifiers are independent in the actual source: CE issuance receipt ID,
provider mutation UUID, and Core's separately generated later receipt ID. The
link is a full command/provider/receipt relation, not equality of those UUIDs.
The new positive coupling checks three distinct issued values. Historical original
DB transaction ID is not the later lookup transaction ID.

Source order in the candidate is plausible and correctly stays within the existing
host: validate → C03 reserve → CE mutation/projection → Core audit/outbox/receipt
→ C03 response_ref → COMMIT/deferred check. The proposal's constraint trigger is
DEFERRABLE INITIALLY DEFERRED, validates original txid/auth actor/serializable
scope, the C03 response and staged Guide/step/immutable target. It is invoker,
append-only for ordinary update/delete, ENABLE+FORCE RLS with no selected policy,
role, owner or positive grant. The file raises unconditional55000 before DDL and
ends ROLLBACK. It is not an installer and was not parsed/compiled/run.

These source properties do NOT prove every SQL invariant, trigger firing, effective
rights or immutable storage under an eventual privileged owner. Joint native
proof must cover real deferred checking in the same transaction, every partial
failure, row/target/FK/constraint behavior, role/ACL/RLS/custody, and cleanup.
TRUNCATE/DDL/owner capabilities must remain outside runtime admission. No role,
owner, grant or profile is selected by this review.

The actual unchanged Core host owns matched-C03 replay, bounded40001 retry,
COMMIT uncertainty and rollback. New coupling confirms recovery after a modeled
lost COMMIT ACK returns the actual prior CE receipt without a second mutation.
A modeled deferred23514 failure yields conservative UNKNOWN and rollback in the
transport; it is not a PostgreSQL constraint test or native settlement proof.

Retention is C03-bounded: expiration or removal makes this proof unavailable even
if an append-only CE projection remains. There is no perpetual receipt claim,
TTL extension, import/repair, purge/cancel policy or deletion grant. The CE proposal
has no adopted cleanup/retention regime for dangling immutable rows; that remains
an explicit joint dependency. No blanket cleanup permission follows from this ABI.

## Minimal Core-owned combined ABI

`src/lib/core/ce012-combined-stored-relation-v1.ts` exports:

```
readCoreCe012CombinedRelationV1(scope, value)
contract: core-ce012-combined-stored-relation.v1
```

Input reuses the accepted strict Core stored-relation request (original Core/CE
commands and expected independent receipt IDs/hash, with explicit Core hash-domain
contract). No caller allow/verifier/disclosure callback, module object, receipt
JSON, GET or committed flag can substitute for actual row reads.

The Core-owned query is a bounded projection of the exact candidate CE store ABI;
it is not a new table, copy of the owner implementation or alternate CE writer.
The actual owner writer, reader and Documents provider are loaded from Git for
coupling. The live candidate table does not exist by assumption: absence remains
unavailable/NOT_READY. No installation is performed or implied.

Order is deliberate:

1. Read/lock canonical C03 row with the existing Core SQL; validate actual parsed
   response_ref/receipt ID/hash, tenant/key/actor/request hash and transaction.
2. Read/lock the actual CE proposal row in the same scope. Compare FULL parsed
   command and Guide payload, including original label/body/step/target/version,
   canonical hash/key, actor/tenant/Workspace, independently expected CE receipt,
   Core mutation and decision links, subject/provider/replay binding and resulting
   Guide version. Receipt target must match exact immutable IDs/version.
3. Documents may have issued a neutral safe label instead of the caller label;
   that distinction is not mistaken for a body mismatch. No label is disclosed.
4. Invoke the OFFICIAL unchanged Core stored reader LAST. It rereads that C03 row
   and performs its separate post-lock fresh SERVER expiry observation after all
   CE waits. No subsequent await or query occurs on matched_candidate return.

This ledger→CE→official-Core→fresh-clock order is explicit; the CE reader alone
is not expiry/currentness proof. Actual CE reader is separately exercised in the
new coupling; it is not injected as a purported proof callback. Same original40001
escapes the composition to the existing host; no retry/host/store is added.

The result is ALWAYS `status:not_ready`, `stored_ce_relation:null`,
`action_authorization:not_evaluated`, `current_disclosure:not_evaluated`,
`custody:not_proven`, `native_deferred_check:not_run`. `integrity:matched_candidate`
means only the bounded controlled/source relation match, not joint acceptance or
actual persistence/COMMIT/custody. Denials expose no stored body, ID or private
error. Scope identity is revalidated after awaits. Legacy Core code still reports
its historical bridge gate; this new non-authorizing composition consumes only
its matched Core component and does not weaken/change that reader.

Integrity is not current disclosure: a NEW test obtains candidate integrity match
but actual Documents replay denial prevents host disclosure/command replay.
Canonical authority denial blocks the hook before historical inspection. A C03
cleanup test leaves the CE row but returns unavailable. Caller payload mutation
cannot rebind schema-parsed private copies. Client verifier/committed flags are
rejected. Native database/run/system custody still needs admitted provenance.

## Docs slots and subsequent work

Compiler5f6b still unconditionally emits BLOCKED for historical_disclosure and
historical_revoked. Neither its source nor provider c0caf was edited. Existing
receipt hashing uses Core's domain-separated replay receipt hash, not the compiler's
sorted contentHash. No automatic compiler rebind/slot promotion is performed.

CE owns F01 and caller-contract closure F02. Documents owns independent target/
label/current-disclosure/custody acceptance. Coordinator assigns that delta/review;
Core's result is not an execution/activation grant. Real same-transaction constraint,
retention/cleanup and native proof remain mandatory before any historical slot
can be ready. Full Release security/regression gates remain open.

## Evidence

`node scripts/test-core-ce012-writer-joint-review-09.mjs`:23 NEW controlled coupling
checks PASS, including the two counterexamples. Actual writer/Docs modules and
actual unchanged Core host run against a synthetic memory transport; no SQL parser,
trigger, PG or Auth runs. The positive fixture is built by actual owner code, not
a caller-authored ready receipt. All combined-reader/replay negative cases preserve
the baseline write census; setup only models the writer's domain mutations.
Native proof is NOT_RUN_NOT_PASS.

Full unchanged ES5 typecheck, limited lint, syntax/JSON/hash/inventory checks PASS.
CE27, read-host47, expiry15 and other successful suites are NOT_RERUN. Source08,
S01/SERVICE, original selector command guards, shared command host/evaluator,
package/lock/schema/proposal files remain byte-identical. runtime=NULL.

Self-automation: نیازمند بررسی؛ input=canonical commands/rows; opportunity=bounded
integrity/exception routing; human=CE/Core/Docs/coordinator joint review; conditions=
accepted checkpoint/writer/custody/authority/expiry; exception=UNKNOWN/mismatch to
owners; dependency=F01/caller contract/native proof; value=unmeasured. No automation
implementation, privilege or execution authority is added by that classification.


## Documents D06 delta consumed, same task

Review FullSHA: `f92d142558b19469e37c0e5b9d6f6f92fc9eb619`.
Its three postimages and24 dependency identities are independently pinned. The
owner's review tests and previous23/27/47/15 suites are not rerun. The new selection
`--docs-delta-only` runs7 affected couplings with actual CE/Docs/Core source.
Earlier counterexample findings F01/F02 and their owners remain unchanged.

| Finding | Core disposition / owner | Evidence and remaining gate |
|---|---|---|
| D06-C01 | CLOSED_CORE_BINDING_SOURCE; Core+CE, native/joint proof still open | Official composition checks expected CE receipt ID; actual C03 and CE rows, full original commands/key/hash/target/version, CE/Core/mutation links. New test demonstrates both old private readers can match separately while a wrong expected CE ID is rejected by the official composition. No conjoined-reader allow is issued. |
| D06-C02 | OPEN_BLOCKER for terminal authority/disclosure; Core+Documents, CE owns final composition order | Receipt expiry is last after all integrity CE reads, but that is not a final canonical/Docs checkpoint. An actual Docs provider wait after an earlier Core observation crosses expiry; a new official Core read expires. The v2 result explicitly records that its checkpoint covers integrity/receipt expiry only and terminal authority is NOT_READY. F01 overlaps the writer side. |
| D06-C03 | CLOSED_CORE_NON_DISCLOSURE_SOURCE; OPEN official terminal projection; CE private lineage, Documents disclosure | Deliberately corrupted private CE label remains a private-reader result. v2 returns NO label/receipt/projection. Actual current Docs factory returns its own neutral label or denial separately; this does not unlock v2 before a terminal joint gate. Historical receipt and fingerprint are byte-preserved. |
| D06-C04 | CLOSED_SOURCE_POLICY_ORIGINAL_ACTOR_ONLY; Core+CE | v2 explicitly declares original_actor_only. Foreign scope actor fails before SQL; rewriting command actor still fails actual stored actor/hash. New-reader authorization and retention/cleanup changes are unsupported/out of scope. |

### Explicit non-disclosing v2 ABI

The original v1 module prefix is byte-identical to ae8107ad. New export:

```
readCoreCe012CombinedDisclosureV2(scope,value)
contract: core-ce012-combined-stored-relation.v2
```

It runs the actual existing v1 composition and then performs only a pure envelope
mapping. No CE/Docs SQL or new await is added after v1's final expiry check. The
result remains NOT_READY with stored_ce_relation=null/current_disclosure and
action_authorization=not_evaluated/custody=not_proven; additionally:

- reader_policy=original_actor_only;
- checkpoint_scope=stored_integrity_and_receipt_expiry_only;
- terminal_authority_checkpoint=not_ready;
- documents_disclosure_projection=null, disclosure_status=not_ready;
- disclosure_dependency=joint_core_documents_terminal_checkpoint.

This is an explicit dependency fence, NOT an implemented authoritative projection
or a stub that grants permission. No caller verifier/terminal allow or callback
can turn it ready. Even a neutral label from a separate successful Docs call is
not attached to this response. Private stored labels are neither validated into
public labels nor rewritten. Only an official admitted current Documents
projection could ever supply future outward content; no fallback is installed.

### Why existing primitives are insufficient and minimum owner delta

The accepted Core stored reader proves its own last C03/expiry observation only.
The CE relation reader returns private integrity and can wait. The current Core
canonical provider is a multi-query command-bound observation; the Docs selector
performs later lifecycle/version/scan/visibility waits and has no joint terminal
session/module/entitlement/receipt-expiry checkpoint token or complete all-gate
validity bound. Neither a timestamp comparison nor serializable snapshot alone
composes them into the requested final authorization/disclosure guarantee.

Proposed owner contract (NOT implemented/approved by this task):

1. **Core** extends the existing canonical transaction port with a terminal,
   opaque, same-live-scope observation bound to original actor/tenant/Context/
   Workspace, command/key/body, CE/Core/mutation IDs, immutable target/version,
   attempt/DB transaction and canonical authority revision. It consumes real
   server-session/AAL and native permission/entitlement checks, fresh trusted
   database time and actual locked C03 expiry. Existing canonical `_at_v1` helpers
   may be inputs only under a separately reviewed source/privilege binding; do
   not create a parallel permission store/evaluator or accept caller time/allow.
2. **Documents** extends its official private provider/selector with the current
   disclosure projection and a same-scope terminal checkpoint over the EXACT
   historical immutable target, current lifecycle/scan/read visibility and its
   own canonical module/entitlement/session gates after relevant waits. Return
   only the official neutral safe-label projection on authorized outcome; denial
   returns none. Keep current-only/historical semantics and private lineage.
3. **Core+Documents**, with **CE** composing: resolve and lock canonical relations
   → validate candidate integrity → obtain tentative private current Docs decision
   → joint terminal post-wait canonical/Docs/C03-expiry checkpoint, using one
   explicitly agreed server observation/barrier protocol → successful existing
   host settlement → release ONLY the official current Docs projection. Any later
   related wait invalidates the premise until the relevant joint check is redone
   or the result is denied. Sequential independent success booleans are not this
   protocol. The expiry-only helper must not be advertised as the joint gate.
4. The exact checkpoint/settlement/writer-session participation guarantee needs
   joint source and native acceptance before an outward response can be ready.
   No CE validity-at-COMMIT or ACK/delivery waiver is inferred from another domain's
   decision. This task fixes neither managed Auth nor the shared evaluator/host.
   Until that contract exists, the only honest outward projection here is null.

This names the missing primitive, inputs, consumer/order and responsible source
owners: Core current-authority transaction provider/port and official combined
reader; Documents documents-ce012-reference-provider-v1.ts and
 documents-reference-tx-selector-v1.ts; CE writer checkpoint/composition. It is not
a request for generic approval, a new runtime service or an authority callback.

New tests also show current Documents denial releases no raw receipt/private label;
original actor and fingerprint cannot be rewritten for another reader; and a
caller-injected terminal check/projection is rejected. These are controlled
transport couplings, not native revoke/expiry/custody/trigger evidence.

All earlier runtime=NULL, BLOCKED historical slots, retention/cleanup, owner files,
SQL/store/schema and full Release security/regression gates remain unchanged.
