# Utilities monthly input v1 — recovery contract

This source package is inactive. There is no run permit, target, installer,
executor or positive permission binding in this packet. Apply no SQL from chat.

1. Platform first pins admitted target/source/App/Tree, exact installer/owner,
   restricted executor role and inherited privileges, RLS/sequence/helper closure,
   current Auth/session/C01/C03, transaction transport and observer. SERVICE role
   or permit does not satisfy this requirement. Unknown observation = STOP.
2. Review/run preflight in its independent read-only transaction. Missing invoice
   permission is an unresolved **policy** dependency; do not assign utilities.manage
   or SERVICE permissions as fallback. No caller-chosen role/schema/SQL exists.
3. The producer SQL is a single installation transaction, three new invoker functions,
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
