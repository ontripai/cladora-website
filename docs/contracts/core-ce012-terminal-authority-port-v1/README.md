# CORE-CE012-TERMINAL-AUTHORITY-PORT-10

Base/parent: `acea0d067099dffe8cecacc36b78e2755f51ee13`.
Branch: `codex/program-core-service-s01-producer-01`.

## Worklog / exact edit inventory recorded before implementation

Only these new Core-owned paths are planned:

- `src/lib/core/ce012-terminal-authority-port-v1.ts`: inactive executable canonical recheck and bound observation port; no endpoint/host/evaluator/store.
- `scripts/test-core-ce012-terminal-authority-port-10.mjs`: new controlled-transport checks only.
- `docs/contracts/core-ce012-terminal-authority-port-v1/README.md`: ABI, source evidence, ordering and missing owner primitives.
- `docs/contracts/core-ce012-terminal-authority-port-v1/manifest.json`: exact source pins, inventory/seal and verification.

Previous Core09, CE/Docs, S01, read host, expiry reader, SQL, package/config and other accepted files remain unchanged. Runtime binding NULL; both historical Docs slots BLOCKED. No SQL/parser/PG/Auth/install/grant/activation is run.

## Delivered executable Core portion

`createCoreCe012TerminalAuthorityPortV1(scope, value)` is a private server/provider
composition, contract `core-ce012-terminal-authority-port.v1`. It accepts only the
existing strict stored-relation request and the existing trusted host scope. It
accepts NO allowed flag, caller clock, verifier, injected authority provider or
settlement callback. It opens no connection/transaction, creates no receipt and
executes no business/C03/audit/outbox write. Core09 and other contracts are unchanged.

The port directly invokes the real `resolveAuthority` and
`bindCanonicalCurrentAuthorityObservationV1` twice: original CE permission
`experience.guide.manage` / `experience_guides` and separate Documents permission
`documents.vault.read` / `documents`. Neither grants document-specific disclosure.
The final native source expression uses the existing canonical `_at_v1` resolver,
permission evaluator and request-session checker. All get the SAME server-sampled
instant; the evaluator retains its existing module/AAL/entitlement/deny rules.
Module/entitlement IDs are compared with the real provider's observations.
No local evaluator/role/entitlement registry or claim-derived permission is added.

The existing PostgreSQL provider has millisecond/statement-time normalization.
That provider is preserved and used as an admission/binding gate, not as the final
precision oracle. The new final SELECT samples `clock_timestamp()` AFTER preceding
awaited provider/row-lock statements; emits six-digit UTC ISO, and compares locked
C03 expiry strictly with `>` in PostgreSQL. There is no JS date comparison, TTL,
rounding, client clock or guessed offset. The session helper consumes actual
request-scoped provider-validated claims and `auth.sessions`, not request JSON or
user_metadata. Initial session check precedes private relation reads; final check
is repeated after earlier waits. Native authentication/configuration remains an
external gate; this code never sets JWT claims itself.

### Minimal v1 ABI

The returned frozen port has:

- `scope`: existing private transaction scope facade for subsequent CE/Docs reads;
- `checkpoint()`: executable Core canonical recheck; never a disclosure permit;
- `inspect(observation)`: synchronous private inspection of an opaque object issued
  by this exact port; cloned/serialized/foreign objects are rejected;
- `close()`: monotonic local invalidation only, NOT COMMIT/ROLLBACK acknowledgement.

Checkpoint output always includes `status:not_ready`, `documents_projection:null`,
`action_authorization:not_evaluated`; `core_status` is one of observed, denied,
mismatch, expired, unavailable. Only observed carries an opaque object. Its JSON
contains no receipt/body/label/binding. Denial carries none. Inspection can return
only `invalidated`, or a private `core_observed_not_ready` binding with:

- actor/tenant/Context/Workspace/membership;
- original command ID, canonical Workspace key and SHA256 of parsed original
  command, independent CE/Core/mutation IDs and canonical Core receipt hash;
- immutable document/version IDs and exact version;
- transaction ID, actual DB transaction, backend PID, attempt, canonical revision;
- exact server sample, `terminal_wait_coverage:not_ready`,
  `settlement:not_observed`, projection=null.

All bindings are obtained/reconciled with actual scope SELECTs and the existing
Core09 full composition, not request assertions. The original actor policy is
unchanged. A different reader is not supported. No historical receipt/label/hash
or retention/cleanup policy is rewritten. Both Docs historical slots remain BLOCKED.

### Actual order and invalidation

1. Validate strict request and original scope. Check native current-session helper.
2. Run unchanged official Core09 composition: C03 SHARE → CE SHARE/full relation →
   official Core reader/C03 reread → post-lock expiry. This is integrity only.
3. Reread locked C03 and CE relation, extract/rebind actual mutation/receipt IDs and
   C03 expiry. Lock Context grant/membership/Workspace rows FOR SHARE.
4. Read server transaction/actor/backend/clock. Existing host's command/aggregate
   lock premise is inherited from that trusted private scope, not manufactured by
   a receipt or an extra command lock. This clock is a post-lock-ack lower bound,
   not independent proof that every native host lock was taken.
5. Run actual canonical provider+binder for CE and Documents in that order. The
   provider locks global canonical revision SHARE. Compare required bindings.
6. Final SELECT samples a fresh server instant, invokes existing session/resolver/
   CE and Documents `_at_v1` evaluators, verifies snapshot-visible canonical
   membership/revision/module bindings, transaction/actor/backend and strict C03
   expiry. Store only an opaque Core-subset observation; no await follows issuance.

This is an exact implementation sequence, NOT a freeze of global writer lock
order. Host currently locks Workspace/aggregate/provider sources before this port;
C03 can already be FOR UPDATE from replay. Global revision may already be held by
host authority resolution. Native lock-cycle/participation proof is NOT_RUN.

Every `port.scope.query` invalidates all earlier observations BEFORE starting its
wait. A pending query prevents checkpoint issuance. Checkpoint is single-flight;
concurrent scope operations are rejected. A renewed checkpoint reruns the real
Core reads and checks; it never renews Documents disclosure. After local close,
observations are invalid and scope queries fail. Scope identity is checked before
and after awaited operations. All first driver failures poison the port. The
tracked internal scope unmasks errors swallowed by older nested Core readers or
provider normalization. The identical 40001 escapes to the existing trusted host;
no new retry engine exists. Timeout/cancellation/unknown errors remain errors;
42501 yields only redacted denial and a poisoned scope requiring host rollback.

The facade is a trusted-provider boundary, not a public SQL sandbox. It must not
be handed to arbitrary SQL/callback callers. Its existing host remains responsible
for read-phase/write admission, transaction lifetime and transport failures.

## Honest NOT_READY dependencies / minimum owner deltas

| ID | Missing primitive and evidence | Minimal ABI/owner delta; no implementation is implied |
|---|---|---|
| T10-D01 | Existing `CoreTransactionScopeV1` contains IDs/query only; no attempt-lifecycle registration, sealing of all future waits, or authenticated settlement observation. Command host performs more provider reads, server clock reads and rollback/COMMIT after callbacks. A raw-scope query bypasses this optional facade; local close cannot prove native settlement. | **Core host owner**, with CE composition: existing host must own terminal registration/seal after ALL owner/provider waits and pending queries, invalidate on every later relevant query/phase/attempt/error, and correlate backend settlement with this exact observation and response bytes. Hook is internal/opaque, not a caller-supplied success callback or new host. Until reviewed, no observation here is a host settlement token or outward permit. |
| T10-D02 | `_at_v1` canonical routines evaluate snapshot-visible sources at one server instant. Their internal catalog/ACL waits can follow that sample; no complete validity frontier covers every timed assignment, override/module/entitlement/grant. SERIALIZABLE snapshot alone does not prove session deletion/revoke visibility after BEGIN; all session invalidators/writers are not proven to participate in the revision barrier. | **Core canonical authority/session owners**, provider coordination where managed Auth is involved: existing engine needs a reviewed same-scope post-wait observation/barrier or exhaustive authority-validity frontier + native writer/session participation evidence. Neither raw Boolean nor timestamp is this primitive. Define exact failure/expiry/linearization policy before promotion; no valuation-specific waiver is imported. |
| T10-D03 | Docs provider/selectors may wait after Core checks and own target lifecycle/scan/visibility/label projection. Permission `documents.vault.read` alone is not current document-specific disclosure or custody. | **Documents owner** supplies official opaque target-bound current projection/terminal observation through its existing selector, with its own canonical module/session gate; **CE** composes it with Core's host-owned terminal boundary. No second reader, private label fallback or arbitrary verifier. If Docs waits after Core, the premise is invalid until the joint protocol renews all relevant checks or denies. |
| T10-D04 | Existing canonical evaluator has an internal PL/pgSQL `exception when others then return false` around resolver calls. A SQLSTATE consumed INSIDE PostgreSQL is not visible for a TS wrapper to preserve. This is a source limitation, not an observed native40001 failure. | **Core canonical evaluator owner**, separate reviewed delta/native proof: explicitly preserve serialization/cancellation exceptions within the existing helper, without changing authorization policy or making errors allow. This task changes neither evaluator nor SQL. Driver-visible40001 is preserved and tested; end-to-end internal SQLSTATE propagation remains an unproven native gate. |

No ready variant is offered as a shortcut around these dependencies. Even an
observed Core subset cannot be used to expose Documents content. Future intended
order: candidate integrity → official private Docs projection → host-owned joint
post-wait Core/Docs checkpoint → verified same-attempt backend settlement → only
bound official projection/response. Any later relevant wait renews/invalidates the
premise. Current replay host ends its read transaction with ROLLBACK; a source
observation must never reinterpret that as a new mutation COMMIT. New-write COMMIT
uncertainty remains the existing host's UNKNOWN/recovery of the SAME command/key.
Cancellation or loss of delivery does not prove rollback. No guarantee through
COMMIT/ACK/delivery or all-writer concurrent logout is asserted.

## Verification and boundaries

`node scripts/test-core-ce012-terminal-authority-port-10.mjs`: **31 new groups PASS**.
It reuses only the pinned Core09 fixture DEFINITIONS (not its test invocations),
loads real Git-pinned CE/Docs and current unchanged Core host/provider/reader
modules, and routes source strings to a synthetic memory transport. Baseline
synthetic receipts are produced by actual owner code; no row is called native.
New cases cover valid bindings, actual Docs waits/invalidation/renewal, session and
separate authority denials, 1us expiry/equality, actor/tenant/Workspace/membership/
revision/DBtx/backend/module/entitlement drift, malformed AAL/clock/sentinel,
strict caller extras, command/key/body/target/CE-ID mismatch, opaque identity,
source-scope mutation, close, driver40001 through real host (3 rollback attempts,
zero new write/commit), cancellation/provider error normalization and UNKNOWN
recovery. Session sentinel is the actual void result slot; its text representation
is not assumed to be SQL NULL. The model does not emulate PostgreSQL expression
execution/locks/snapshots or prove the missing dependencies above.

Full ES5 typecheck and limited lint/syntax/diff are checked with existing locked
Next16.4.1/Zod4.6.6 dependencies. No package/config change/install. Prior accepted
23/7/27/47/15 suites and owner review suites are NOT_RERUN. No SQL parser,
PostgreSQL, Auth, trigger, RLS/ACL/native custody/retention, install or activation
proof is claimed. Runtime NULL and complete Release gates remain open.

قابل خودکارسازی: نیازمند بررسی؛ ورودی scope/فرمان/رابطه canonical؛ فرصت تطبیق و ارجاع خطا؛ تصمیم انسانی Core/CE/Documents/coordinator؛ شرط اجرا پذیرش port/host/checkpoint و proof بومی؛ UNKNOWN/مغایرت به همان مالکان؛ وابستگی رسمی T10-D01–D04؛ ارزش سنجیده نشده. این طبقه‌بندی مجوز اجرا نیست.
