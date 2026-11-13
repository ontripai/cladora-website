# FIN-INPUT-02 — owner-approved actor and exact-version policy29

Direct parent: `ab28c87a4eb82f5f462d3faf971149c4fec858f6`.
Policy is source-only; runtime/permit/target stay NULL. Accepted57 and Finance
planner/bridge are unchanged. No old fixture, invoice origin or approval is seeded
or backfilled. Existing reading v1 and financial/monthly authority remain separate.

## Durable original actor and independent approval

Invoice ingest v2 appends `decision=submitted`,
`reason=utilities.invoice.origin.v1` to the **existing canonical**
`utilities.review_decisions`, associated to its actual review task/invoice.
`actor_id=auth.uid()` is read in SQL; input has no actor/creator field. Origin
records contain actual tenant, Context, Workspace, property, document/source IDs,
original revision and actual source image/hash. The insert trigger validates actor,
task/invoice/property and canonical ingest permission; update/delete of this
family's origins or v2 review decisions is forbidden. A unique index binds the
single origin to tenant+invoice across tasks, not just to a task.

Review and preparation lock real origin rows and reject NULL/missing/ambiguous,
foreign-scope or same-actor origin. Changing session, Context, role, task or current
authority revision cannot change creator identity. Both permission keys do not
exempt self-review. Source helper rechecks canonical current authority and actor
separation after effective lock waits, immediately before the invoice update and
after domain/trigger/source waits. Review preparation takes write-intent invoice/task row locks before a C03
review proceeds, avoiding a SHARE-to-UPDATE upgrade cycle; it remains zero-DML
and uses a lock-capable read transaction with rollback, never SQL READ ONLY.
The TS adapter also rejects self-review and
task/hash mismatch on the actual fixed DB preparation query before mutation.

Source-family SQL is new; legacy invoices with no canonical submission origin are
NOT_READY. No actor is guessed from approved_by, current user, email, role or an
unmatched audit event. No manual insertion of a synthetic origin repairs history.
C03 remains the only command/receipt/audit/outbox/settlement engine; submission
provenance is not a second command ledger. Origin/approval records are not new
receipts, and their IDs are not equated with Core receipt IDs.

## Explicit versioned content binding

Invoice input is now `utilities-monthly-input.v2`; reading input stays v1.
Review requires `source_hash_contract=utilities-invoice-content.v2` plus exact
`expected_source_sha256`, source and task IDs. Read result becomes
`utilities-invoice-review-source.v2`; the public adapter returns only source/task/
hash contract/hash. Private creator/origin IDs do not escape that projection.
Old invoice v1 is rejected before query, not silently upgraded. C03 UNKNOWN keeps
its original actor/authority tuple, key/body/fingerprint/IDs/TTL and read-only
recovery; no replacement key or synthesized creator/version is made.

`invoice_content_image_v2` is a pure serializer, **not proof or authority**.
The guarded reader/writer pass actual locked rows. The image binds tenant,
Workspace, property, exact invoice identity/period/currency/amounts, current contract,
canonical document/source/run/reference/hash/path and full lines ordered by row ID.
Only approval/posting bookkeeping and creation/update timestamps are excluded.
Content version is the exact canonical DB image digest, not an invented numeric
revision, client hash or JS money calculation. Existing C03 aggregate_version
remains command metadata; it is not relabelled as an invoice revision or used
in place of the exact content comparison. PostgreSQL JSONB hash equivalence
has NOT been executed/proved in this lane.

Approval stores `utilities-invoice-approval.v2`, `approval_kind=invoice_document_only`,
source image/hash, immutable origin reference, actual ingest/review actors and
review scope. Final source readback re-compares content after trigger waits.
New-family approved invoice content/approval fields are immutable via additive
trigger; only existing status/posting-link/update bookkeeping may change. Existing
approved-line immutability remains unchanged. Invalid/new effective content cannot
inherit that old approval. External contract/document changes require a new current
content comparison: Finance must compare v2 approval to actual current locked
inputs before capture; status=approved alone is insufficient. This is a precise
Finance adoption dependency while its official source/schema is awaited, not an
edit to Finance or the accepted57 planner.

Approval accepts only that invoice version. It is not permission to pay, publish
or close a month. Independent president+censor and accountant-cycle verdict stay
unchanged. Later host audit/outbox/receipt/COMMIT waits and native replay/settlement
remain separate gates; no currentness through ACK or durable COMMIT is claimed.

## One mapping and install handoff for Finance / Platform / QA

| Approved action/class | Real source mapping | Remaining gate / owner |
| --- | --- | --- |
| ingest: property manager | `identity.roles.code=property_manager` is defined in the source; exact target role ID, membership/property/Workspace assignment and explicit `utilities.invoices.ingest` still unobserved | Platform observes real canonical IDs and scoped assignment; Finance/Coordinator qualify the mapping. Name alone grants nothing. |
| ingest: operational manager or appointed accountant | No additional qualified role key has been verified | Finance/Coordinator classify actual existing role; Platform supplies source-bound mapping. UNMAPPED=STOP; no association_admin alias or new role is invented. |
| review: appointed accountant/financial reviewer | No verified matching primary role among the source six; actual workspace-local roles may exist but are not observed here | Exact published `platform.workspace_roles`/canonical role IDs, membership/property assignment, explicit `utilities.invoices.review`, validity and qualified mapping required. Do not alias censor/president or borrow SERVICE permissions. |
| all actions | keys are FINAL contract; both deny-default; existing canonical at-time evaluator still decides live authority/AAL2/session/scope | No key registration, role/grant or activation is performed. Missing mapping remains NOT_READY, not a successful actor fixture. |

The bounded **unexecuted** `role-mapping-read-request.sql` describes a separate
prepared read for Platform: `$1=Workspace`, `$2=property`, `$3=tenant` from its real
admitted binding. Output has actual role IDs/codes/versions/bindings/counts with
full_count/truncation; truncation or missing required mapping is STOP. Counts/names
are diagnostics, not authority. No member PII or secret is needed. Actual session/
membership/revoke/expiry and role qualification are still checked through canonical
C01 and reviewed mapping. No query or old catalog snapshot was executed/repeated.

Installation order after independent approval/observed prestate:
preflight/qualified-role census → `producer.sql` (closed methods) →
`origin-integrity.sql` (unique origin/append-only and v2 content guards) → verify.
The two write units COMMIT independently. Failure/UNKNOWN in unit2 does not roll
back committed unit1; it remains closed/unbound and must be inspected via the
same unit's recovery contract. Existing names require reviewed upgrade; CREATE
payloads do not blindly replace an installed predecessor or replay migrations.

Exact **additional** privileges/closure to review, not grants:

- Installer must be actual owner/authorized DDL principal for canonical tables,
  new index and triggers; role membership/SET/grant option cannot be inferred.
- Invoker executor needs canonical fresh-time C01/session helper rights, exact
  operation/query profile, table/sequence/trigger closure and row-lock privileges.
  Source decisions stay with existing C03, not an alternate transaction/callback.
- In particular, `review_decisions_self_read` in existing source is actor-only.
  A different legitimate reviewer may see **zero** creator rows under that policy.
  Platform must deliver a narrowly scoped, reviewed private origin-reader/RLS or
  delegation recipe for actual qualified role, tenant/property/Workspace/task.
  No broad history SELECT, public/customer_api exposure, owner or service_role
  fallback is introduced here. Missing visibility denies; it is not no-origin proof.
- Origin inserts require actual current actor and ingest authority; no UPDATE/DELETE
  grant is needed for immutable origin/decision history. New guards preserve other
  review families. No Auth ACL/FK, shared owner, grant300 or evaluator change.
- Verify six function identities/owner/invoker/search_path/closed ACL, both enabled
  triggers with exact relation/routine, unique invoice-origin predicate/index, RLS
  and effective inherited/FOR SHARE privileges. Actual source/table metadata,
  index-build capacity and target role closure remain Platform gates, not assumed.

## Affected evidence only

`node scripts/test-utilities-invoice-approval-policy-v2.mjs`: 12 new groups.
Actual Parent adapter demonstrates controlled self-approval counterexample; actual
successor rejects it and retains independent positive, drift/malformed/legacy,
late denial/scope, same40001 and UNKNOWN controls. Source negatives cover removed
separation, per-task origin substitution, origin rewriting and approval/version
checks. These are controlled transport/static source, not SQL execution or RLS proof.
Only `--source` of the adapted older test ran to check the changed SQL family;
its other healthy groups and accepted57/SERVICE/Finance suites did not run.
Full project ES5 typecheck, focused lint/syntax/diff and new artifact identities
are recorded in manifest/delivery. Native SQL/parser/PG/Auth/roles/fixture/COMMIT/
concurrency/restart and all target effects are NOT_RUN.

Automation: **نیازمند بررسی** — binding/hash/origin consistency can be checked
mechanically; role qualification/approval and Platform install/campaign authority
remain human decisions. Exceptions go to the owner in the mapping table; value is
preventing self-approval and stale-version acceptance, not a fabricated estimate.
