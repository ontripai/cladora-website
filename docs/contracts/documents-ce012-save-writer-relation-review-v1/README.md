# DOCS-CE012-SAVE-WRITER-RELATION-REVIEW-06

Documents/Vault review boundary; inactive source/control evidence only.

- Base/direct parent: `5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa`.
- Existing branch: `codex/program-docs-ce012-provider-02`.
- CE candidate: `d767e84a6d8489ee731f64eb5c8b38f29d35a7fe`.
- Core reader: `ef69fa82e19ab269701d6df9abd7bdfd67e3e50e`.
- Verdict: **REVIEW_DELIVERED / COMBINED_DISCLOSURE_NOT_READY**.
- No adoption, source-acceptance decision for the other owners, native proof,
  installation, historical-slot unlock, wiring or activation follows this review.

## Scope and exact source

The adjacent manifest binds 24 dependency preimages by owner, exact commit, path,
file bytes, SHA-256 and Git blob identity. The new test loads the actual CE writer,
executor, bridge and contract; actual Core host/authority/receipt reader; and actual
Documents factory/selector. It reuses only the pinned CE harness's **definitions**
for SQL transport fixtures. Its 27 test bodies are not loaded/executed. Every
relative product dependency comes from its fixed owner commit, not an allow stub
or a copied owner implementation. No dependency fetch/install is hidden in tests.

This delivery adds only this review, its manifest and a Documents-owned coupling
counterexample test. It changes no product code or SQL, neither compiler slot,
provider, selector, accepted closure/request/kit, package/lock or registry.
No read adapter is activated or supplied as a positive historical composition:
there is no accepted combined-reader/custody contract capable of authorizing it.
The existing interfaces remain the only interface; this review adds no wire ABI.

## Existing mapping: what is actually bound

| Boundary | Source guarantee / policy | Limit |
| --- | --- | --- |
| Original command | CE `commandMatches`, canonical Core/Guide parsing and existing CE fingerprint: Context, Workspace, Guide, command/key, expected Guide version, aggregate next version, save subject, fixed permission/module/purpose, immutable document/version IDs in provider source IDs | Parsed-command JSON hash for C03 is distinct from replay-command/receipt hashes and compiler sorted input hashes; never substitute one for another |
| Document factory | Documents factory takes private Core scope/command/post-lock authority + Guide command; actor is re-read with `auth.uid()` and compared with scope, command and authority | Trusted capability admission is required; arbitrary caller object/callback is not evidence |
| Current target | Current selector requires exact document/version/numeric version and `current_version` equality; explicit Workspace and tenant; lifecycle, verified checksum, clean ClamAV attestation, current read visibility | No content, path, hash, signed URL or storage authority is returned |
| Historical target | Historical selector allows exact older immutable version, never a substitute current version; same current read, Workspace, scan and lifecycle gates | It checks current disclosure, not the provenance or existence of a historical CE-save relation |
| Label | Actual fresh writer consumes official factory; evaluator replaces untrusted caller label with neutral `Document reference`; CE receipt and Guide reference store that neutral label | Fingerprint remains the original complete Guide command's fingerprint; changing the receipt label is not equivalent to changing the original command |
| Fresh versus replay | Core invokes provider-current-state replay hook, actual CE executor/bridge and official Docs replay-mode factory; no fresh mutation on exact replay | Mode must originate in matched Core replay; caller-controlled `replay` and a current GET are not historical proof |
| Source reference | Core evidence is `status_only`, `source_reference:null`; exact immutable target stays bound through command source IDs, Guide target and stored receipt relation | Null source-reference is intentional privacy, not missing document lineage; no path/title/hash may be inserted there |
| Original writer vs current reader | Both existing relation readers bind the scope actor to the original parsed command/C03 actor. CE row actor also matches | Different currently authorized reader is **unsupported** by these ABIs. Do not replace original actor/Context/key with the reader or treat manage permission as document disclosure permission |
| Core relation | C03 tenant/key/request hash/actor, typed receipt/hash and exact command relation; SHARE row lock, then separate fresh server expiry observation | Always `status:not_ready`, `stored_ce_relation:null`, `action_authorization:not_evaluated`; expected CE-save receipt ID is not yet checked |
| CE relation | Independent CE and C03 reads; complete stored Guide command/fingerprint, target identity (excluding label), Core receipt/hash, mutation identity, CE command/version relation | Private integrity read, `runtime_binding:null`, `action_authorization:not_evaluated`; it does not perform Core's expiry check or current disclosure |

## New coupling findings and owner actions

These are explicit source/control limitations, not claims that native exploit,
lock participation or a production authorization bypass has been proven.

### D06-C01 — combined relation/expected CE receipt binding absent

Owners: **Core + CE**, Documents consumes only after joint review.

A request whose `expected.ce_save_receipt_id` differs from the stored CE receipt
still receives Core `core_status:matched` **and `status:not_ready`**. The separate
CE reader returns its own stored CE receipt; it takes no expected CE receipt ID.
Neither function claims to complete this cross-reader binding. Conjoining the two
results, or testing only Core's `matched`, would therefore invent a missing gate.

Closure: accepted official combined reader must check the exact expected CE
receipt ID, independent CE/Core/mutation identities, full original command/Guide
fingerprint, immutable target and verified persisted relation in one trusted
scope, with genuine custody. Integrity match is never disclosure authority.
Until then both compiler historical slots remain BLOCKED. No fake ready result,
caller JSON, committed flag, GET or replacement historical receipt is generated.

### D06-C02 — expiry and current authority after later waits

Owners: **Core + Documents**, CE owns the final composition order.

Core ef69 correctly performs its fresh server expiry statement **after its own
C03 SHARE lock**. New coupling advances the modeled expiry while the subsequent
CE row read waits: the earlier Core match persists, CE still returns only private
integrity, and a new Core read correctly reports expired. Thus Core-first followed
by a waiting CE/Docs operation cannot be advertised as a terminal expiry proof.
Any later waits invalidate the premise of an earlier observation.

Separately, the actual writer + Docs selector transport model changes module
availability after the document SHARE-query boundary. There is no further
`check_workspace_native_permission_v2` invocation, and the modeled save commits.
This pins an actual call-order limitation, **not actual concurrent revoke or
PostgreSQL time-expiry behavior**. The canonical revision SHARE barrier may block
participating revocation writers; it does not by itself prove time cannot expire.
Final Vault visibility queries recheck membership/Context/permission visibility
using statement timestamps, but do not re-evaluate the full module/entitlement/
server-session expiry vector after all waits. Session/AAL claim presence is not
current server-session continuity proof. No current all-gate bound is invented.

Closure: Core/Documents agree the official final currentness/expiry checkpoint
and wait/settlement boundary, including session/AAL, Context, Workspace, native
permission, entitlement/revision and receipt expiry; document lifecycle/scan/read
visibility must still hold. Native clock, wait, authority invalidator participation
and driver/settlement proof remain required separately. This task does not patch
Core/CE or silently change accepted Documents selectors. A combined adapter must
stay NOT_READY until this dependency is resolved/reviewed.

### D06-C03 — stored relation label is not a disclosure projection

Owners: **CE** for private relation output/lineage; **Documents** for disclosure.

The original actual writer creates `Document reference`. A deliberately corrupted
transport row with another bounded label still passes the private CE relation
reader because target comparison excludes label. The returned private CE receipt
contains that label. This is a counterexample to treating its output as the
Documents safe-label projection, not proof of a reachable database modification:
no INSERT/UPDATE/constraint was executed, and append-only lineage is an independent
native gate. Do not publish the returned receipt or label as current authorization.

Closure: CE/Core decide whether to strengthen the private relation checker or
rely on an admitted immutable writer lineage. Any outward projection must consume
the official current Documents factory and return only its neutral safe label
after authority/disclosure checks; denial/not-ready must not disclose stored label
or raw receipt. Do not rewrite the historical receipt or its original fingerprint.

### D06-C04 — existing reader policy is original-actor only

Owners: **Core + CE** for relation reader policy; Documents does not override it.

Different scope actor with the original command is rejected before SQL by both
readers. Replacing command actor with the new reader still fails the stored C03
actor/request-hash relation. Original actor and current reader must not be equated.
Supporting other authorized readers requires a separately approved contract that
preserves original writer/receipt lineage while independently checking current
reader disclosure; no new actor permission, grant or guessed policy is added here.

## Proposal text review: FK, immutability, retention/cleanup

Only source was read and pattern-matched. No SQL parser, DDL, trigger firing,
query, catalog access or installation was attempted.

- Proposal is unconditionally 55000-guarded before DDL and ends ROLLBACK. It is not
  a migration or install request. Proposed private receipt projection is not a
  replacement C03 idempotency ledger; independent mutation, CE and Core receipt IDs
  are preserved. Deferred constraint observes Core's later response_ref in the
  original transaction; actual ordering/constraint correctness is NOT_RUN.
- Proposal Workspace/tenant composite FK, actor and membership FK exist. Existing
  Guide reference FKs identify document/version separately; the existing child
  guard supplies the exact version-to-document/numeric-version/tenant/Workspace
  relationship. The child-lock migration must also be present unchanged. SQL FK
  existence alone is insufficient; required trigger function byte/catalog/owner/
  effective-ACL lineage and firing need native evidence.
- Existing Guide identity/content/reference immutability is retained. Proposed
  CE save-receipt BEFORE UPDATE OR DELETE denial is retained. The deferred checker
  relates target and stored safe_label to the Guide reference, but does not itself
  invoke the Documents current-authority/scan factory; trusted writer provenance
  and closed direct capabilities remain required.
- Proposed functions are invoker with fixed pg_catalog search_path. RLS ENABLE/
  FORCE and REVOKE are present; positive policy, execution owner, least-privilege
  runtime role/pool and effective inherited ACL capability are not selected.
  Source syntax is not proof those functions can safely execute on a native role.
- No FK to C03 is proposed. Expired/deleted C03 makes relation unavailable even
  if CE projection remains. No perpetual historical availability or TTL extension
  is promised. CE projection has no executable cleanup protocol: immutable DELETE
  denial can preserve orphan projections after C03 cleanup. Existing Guide-reference
  document/version FKs are ON DELETE RESTRICT. This must be reconciled with approved
  retention/hold/disposition/tombstone policies; this package adds no delete,
  expiry extension, repair, backfill, retention rewrite or cleanup exception.

## Actual verification and exclusions

`node scripts/test-documents-ce012-save-writer-relation-review-v1.mjs`:
**7 new coupling groups PASS**, with 24 public source pin checks. Necessary modeled
fresh-save setup occurs only inside these new coupling checks. The old CE27,
Docs9+7, compiler12, scope8+5 and acceptance kit were not executed. No old success
is relabeled as new proof.

Groups: no combined authorization; original writer/current reader separation;
Core-first expiry after later CE wait; missing expected-CE-ID verification;
stored-label integrity-only counterexample; terminal module-checkpoint call-order
model; proposal/FK/immutability/cleanup source limits. Counterexample success means
an unsafe inference was demonstrated and kept blocked, not acceptance of behavior.

Node24.19.0 / TypeScript5.9.3 / cached Zod4.4.3. Exact-lock Zod4.6.6 native execution
is NOT_RUN_NOT_PASS. New code is MJS only; no TS/product changes and no unrelated
full TypeScript/build rerun. Scoped lint, node syntax and diff checks are recorded
in the delivery report. Native SQL/parser/DDL/trigger/PG/Auth, issued session,
C03/CE committed provenance/custody, real waits/revocation/expiry/40001, zero durable
writes and driver settlement remain **NOT_RUN_NOT_PASS**. Fixture write counters
are only transport-model observations; they are not independently measured DB
zero-write evidence. No private fixture plan, receipt or user data is published.

Automation: **نیازمند بررسی**؛ ورودی فرمان/رابطهٔ نسخه‌دار موجود؛ فرصت تطبیق
محدود lineage و ارجاع mismatch؛ تصمیم انسانی با Core/CE/Documents و admission با
Coordinator/Platform؛ شرط اجرا current authority/custody/receipt پذیرفته‌شده؛
استثنا به مالک همان مرز؛ وابستگی combined-reader و proof واقعی؛ ارزش
اندازه‌گیری‌شده نیازمند بررسی؛ مجوز اجرا/پذیرش فعلی تغییر نکرد.
