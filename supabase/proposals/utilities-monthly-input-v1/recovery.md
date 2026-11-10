# Utilities monthly input v1 — recovery contract

This source package is inactive. There is no run permit, target, installer,
executor or positive permission binding in this packet. Apply no SQL from chat.

1. Platform first pins admitted target/source/App/Tree, exact installer/owner,
   restricted executor role and inherited privileges, RLS/sequence/helper closure,
   current Auth/session/C01/C03, transaction transport and observer. SERVICE role
   or permit does not satisfy this requirement. Unknown observation = STOP.
2. Review/run preflight in its independent read-only transaction. Missing invoice
   permission/qualified existing-role mapping remains a closed **installation**
   dependency despite owner approval of the two keys; do not assign utilities.manage
   or SERVICE permissions as fallback. No caller-chosen role/schema/SQL exists.
3. Only after reviewed prestate, apply producer.sql (closed functions), then
   origin-integrity.sql (append-only origin and approved-content guards).
   Combined source has six invoker functions, one origin index and two triggers,
   closed ACL and COMMIT. No existing helper/owner/trigger/table/policy is replaced.
   Every unexpected pre-existing new signature is a conflict, not replay-as-applied.
4. Failure before confirmed installation COMMIT: bounded ROLLBACK on the same
   backend; require terminal acknowledgement, then independent catalog/residue
   comparison to observed prestate. Installation ACK loss/timeout/cancel = UNKNOWN;
   inspect exact function identities/ACL and retained terminal evidence before any
   retry. Neither retry-all nor DROP of a matching name proves recovery.
5. verify.sql checks only metadata. Invoker privileges and closed ACL intentionally
   mean this is not an activated runtime: a separate reviewed Platform grant/RLS
   recipe must permit precisely this operation. No public/managed Auth ACL change.
6. Business commands use the existing C03 host in SERIALIZABLE with its stable
   original key/body/fingerprint/actor/scope, finite retry40001, receipt, audit and
   outbox. A domain-hook return is INTERNAL and is not COMMIT proof. A failure
   after any insert/review trigger is rolled back by the host; never publish partial
   source/approval. Same-key recovery reads the canonical matched receipt and
   source through current authority. Do not invoke the mutation hook as lookup.
7. Business UNKNOWN: retain original command; no new ID, source, upload, key, TTL
   or authority revision. Receipt/current-source lookup is read-only, and current
   permission must be rechecked. This package has no new retry/abandon/purge policy.
8. Confirmed business rows are not installation residue. Never delete a committed
   invoice/review/reading/journal/capture to undo an install. Corrections and any
   invoice voiding follow reviewed owner lifecycle; monthly publication/closed
   periods and financial receipts remain immutable.

Future authorized campaign only: resolve canonical evidence document/contract and
captured meter reading, approved actor/role/AAL and target-bound two-cost/one-reading
fixtures. Do not seed approved:true or forge approval IDs. Observer checks actual
invoice/line/review-decision/reading IDs and C03 receipt/audit/outbox after commit,
then restart/readback under Platform's separate approval. SQL/PG/native not run here.

Policy29: submission provenance is an append-only event in existing review_decisions,
not a receipt/ledger. Never backfill legacy missing origins, delete committed
origin/approval events, or reassign creator from current reviewer/session/context.
Duplicates or a missing/foreign origin deny; immutable origin is held through the
review transaction. Installation rollback removes uncommitted objects normally;
rollback is not cleanup of confirmed business history. Pre-existing origin names,
index/trigger or unexpected source/RLS are STOP, not IF NOT EXISTS or repair-as-applied.

Invoice input v2/read-source v2/content-hash v2 are explicit. Reading remains v1.
Old invoice v1 UNKNOWN must retain original key/body/actor and use canonical C03
recovery; never synthesize origin or upgrade/resend with v2 data or a new command.
Exact content hash is the actual version identity (not a numeric revision guess).
Approval is invoice-only, never payment/publish/close; monthly president/censor
and accountant acceptance remain independent. Core host terminal/native proof stays open.

These two source units commit independently. If the origin-integrity unit fails,
ROLLBACK covers only that unit; previously committed closed functions remain and
must be verified, not assumed removed. No runtime is activated until both exact
units, role mapping/ACL/RLS and verify are accepted. Any pre-existing entry names
require a separately reviewed upgrade; current CREATE payloads do not overwrite
an installed ab28 version. This is not permission to install either unit.

The single immutable origin is keyed per invoice across all tasks. Same actor
cannot escape by creating/switching tasks, sessions, Contexts or roles. No unknown
creator is inferred for a legacy invoice. Origin/decision history and the new v2
approved invoice content cannot be rewritten through ordinary DML. Existing
approved-line protection remains unchanged. Independent external contract/document
changes invalidate current content comparison; Finance must compare approval v2
hash/image to current canonical inputs before capture, never use status alone.
