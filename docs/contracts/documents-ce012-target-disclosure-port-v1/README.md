# DOCS-CE012-TARGET-DISCLOSURE-PORT-07

Inactive Documents-owned selector/projection component, **UNBOUND / NOT_READY**.

- Base/direct parent: `f92d142558b19469e37c0e5b9d6f6f92fc9eb619`.
- Branch: `codex/program-docs-ce012-provider-02` (unchanged).
- Core10 exact source/ABI: `534be1a3d69a3b36d0f04edc555bf01c3d666842`,
  `core-ce012-terminal-authority-port.v1`.
- CE R1 consumed in controlled coupling: `0191e0415297a76f3073cbeef7396f4799d3a25c`.
- Core11 accepted FullSHA/host contract: **UNBOUND — NOT PROVIDED/NOT ASSUMED**.

## Implementation and private ABI

`src/lib/customer/documents-ce012-target-disclosure-port-v1.ts` exports
`createDocumentsCe012TargetDisclosurePortV1(scope, originalStoredRelationRequest)`.
Construct only inside the existing trusted Core read phase. There is no public
request handler, registry, pool, new host, SQL sandbox or production wiring.

It imports the **actual Core10 factory and its types directly**, the canonical
stored-relation schema, canonical authority provider/binder, and the existing
Documents CE012 factory. No Core/CE code/interface is copied into owner paths.
The two original compiler historical slots, accepted selectors/provider/closure/
request/acceptance kit and every existing tracked file remain unchanged.

The input is the existing strict Core stored-relation request. It contains the
original parsed Core command, original Guide command and exact expected Core/CE
receipt identities/hash. It is not a new JSON authority contract. Context,
Workspace, Guide, original actor, key, fingerprint and immutable target/version
are verified by the actual Core relation port; caller `replay`, `committed`, label,
verifier or time fields do not complete it. There is no caller-supplied Core port,
authority callback or receipt generator. The supplied scope is a trusted existing
host capability, never an HTTP/JSON object.

1. Construct an internal actual Core10 port and privately parse/copy the original
   request. Capture original scope IDs/attempt/query identity.
2. Core checkpoint verifies actual source relation and current Core subset. Inspect
   only its actual opaque observation. Check tenant/actor/Context/Workspace,
   command/key/parsed-command hash, revision, CE/Core receipts, exact target/version
   and same transaction/DBtx/attempt. No label/private CE receipt is consumed.
3. Resolve the existing canonical CE authority/binder on the **same tracked scope**;
   construct the official Documents factory. Its replay evaluation is derived from
   the verified stored relation, not a caller mode flag. Its actual historical
   selector checks exact immutable identity with current read visibility, Workspace,
   lifecycle, scan/checksum/ClamAV and AAL2. The original Guide target's caller label
   is excluded from the selector request tuple. No current-version substitution.
4. Require the official neutral `Document reference`/safe-label-only result.
5. Re-run Core10 after selector waits and compare full binding, backend/member/
   mutation identity. Denial/expiry/drift/failure yields no observation. This final
   Core sample **does not renew Documents target expiry or seal later waits**.
6. Store only a frozen private target tuple/neutral label/non-authorizing flag in
   a per-port WeakMap, associated with a frozen opaque Docs observation and the
   final actual Core observation. No DB write, receipt/audit/outbox/idempotency or
   authority store is created. Tokens have no serialized permission value.

### Methods and bounded outputs

- `observe()` takes **no arguments**. All outcomes have `status:not_ready`,
  `projection:null`, `host_binding:UNBOUND`, `action_authorization:not_evaluated`.
  `documents_status` is observed/denied/stale/unavailable/mismatch. Only a valid
  private candidate carries an opaque `documents-ce012-target-observation.v1`.
- `inspectPrivate(token)` is trusted-server-only inspection, not a response API.
  A valid token returns `private_candidate_not_ready` and a frozen private tuple:
  `{target:{document_id,document_version_id,document_version},
  safe_label:'Document reference',reusable_as_command_authority:false}`.
  Public `projection` remains NULL, terminal wait coverage NOT_READY and settlement
  not_observed. Retaining this object never turns it into disclosure authority.
- Copying, JSON roundtrip, foreign-port movement, renewed/old tokens, scope/attempt/
  query drift, pending reads, failure or close returns invalidated/projection NULL.
- Every subsequent query through `port.scope` invalidates before driver dispatch,
  including the pending wait. Concurrent reads during observation reject/poison;
  pending reads prevent observation. Renewal performs the actual reads again.
- `close()` only invalidates locally; it makes no COMMIT/ROLLBACK/ACK claim.
- The first underlying driver failure is retained even if an older selector/provider
  catches or normalizes it. The original40001/cancellation/unknown error is thrown;
  no retry engine is added.42501 yields redacted denial. Existing Core alone owns
  bounded retry/rollback/unknown-settlement behavior.

This is a read of a stored target plus a **tentative private** disclosure candidate.
It does not replace the ordinary fresh-command/current-version-only selector and
cannot authorize a fresh save, download, historical receipt disclosure or release.
Original writer/current reader remain distinct concepts: these existing relation
ABIs require the original actor, and this component does not broaden that policy.

## Core11 and native gates remain open

Core10's optional facade cannot see raw-scope operations or all later host phases.
Its snapshots do not prove all session invalidators/writers, internal PG waits,
managed-session revoke visibility, complete timed-authority frontier or settlement.
A Core sample after the selector can itself wait; it does not atomically renew
current target permission/scan/lifecycle expiry. Even the valid private candidate
therefore remains **UNBOUND/NOT_READY**, never an outward projection.

A future host-owned joint post-wait protocol must bind the official Docs candidate,
all current authority/session/target gates, attempt lifetime, every later relevant
wait and actual backend settlement/response. That integration waits for independently
accepted **FullSHA of Core11** and its published ABI. No contract is inferred from
Core10 or a future branch name. No release method, fabricated settlement token,
allow callback or public-ready variant is provided as a shortcut.

Core10 source modules are intentionally absent from this Documents Base; they are
explicit integration dependencies, not copied into this branch. The new component
is not wired/imported by runtime. Scoped typecheck uses a **virtual read-only Git
source overlay** for those exact owner modules; it does not imply the standalone
Base contains them or that a full application build/native target is accepted.

Historical compiler slots remain BLOCKED. The tests' memory rows/receipts are
produced by actual CE R1/Core code inside a controlled transport model, not an
installer, fixture seed, real receipt/provenance or input to the private compiler.
No private plan, customer document, credential or real receipt is read/published.

## Evidence

Adjacent manifest pins25 exact source preimages with owner/commit/path/bytes/
SHA256/Git identity, including Core10, CE R1, existing Documents sources, the new
Documents module and protected compiler/package pins. New source is labeled LOCAL
in the manifest and externally bound by this delivery commit/tree; no self-hash.

Commands actually run:

- `node scripts/test-documents-ce012-target-disclosure-port-v1.mjs` — **9 NEW groups
  PASS**, loading real pinned owner sources and only modeled SQL-pool data.
- Same script `--typecheck` — scoped ES5/strict/bundler/noEmit with repository
  ESNext+DOM libs, actual pinned Core10/CE R1 virtual module overlay: **PASS**.
- Scoped ESLint new TS/MJS, MJS syntax and diff/staged-diff checks: recorded in
  final report. No unrelated full build, old suite or package install.

Coverage: exact private target/neutral label with no public projection; opaque
forgery/copy/foreign/old/closed token; next query invalidation before pending wait;
exact old version with no substitution; private CE label/caller flag rejection;
NULL/cross-Workspace absence, scan/checksum/quarantine/delete/visibility/AAL denial;
final Core revoke/expiry/backend/revision and stored-target drift; mutable scope/
attempt/query identity; original40001/cancellation through existing host and no
extra modeled writes. The test does not emulate SQL expressions, FK/trigger firing,
locks/snapshots, PG clocks, issued Auth or independently measured durable writes.

Old Core31/23, CE27/R1 ten, Docs9+7, review06 seven, compiler12, scope8+5 and acceptance
kit were **NOT_RERUN**. New groups having nine entries are distinct from the old
nine-case provider suite. No previous success is claimed as fresh native evidence.
Node24.19.0/TypeScript5.9.3/cached Zod4.4.3. Exact-lock Zod4.6.6/native execution,
SQL/parser/PG/Auth/Storage/driver/catalog/ACL/lock/receipt custody/40001/settlement
and live zero-durable-write evidence are **NOT_RUN_NOT_PASS**.

خودکارسازی: نیازمند بررسی؛ ورودی scope/رابطهٔ نسخه‌دار رسمی؛ فرصت کنترل
محدود target و ابطال observation؛ تصمیم انسانی با Core/CE/Documents و admission
با Coordinator/Platform؛ شرط اجرا Core11 پذیرفته‌شده و اختیار/custody/proof واقعی؛
استثنا به مالک همان مرز؛ وابستگی host مشترک و proof بومی؛ ارزش سنجیده نشده؛
مجوز اجرا/پذیرش فعلی تغییر نکرد.
