> Historical predecessor report below. Current closeout and approved design decisions: [SOURCE-CLOSEOUT-02.md](SOURCE-CLOSEOUT-02.md). Runtime remains NULL; use its affected-only test commands.

# CORE-SERVICE-S01-PRODUCER-01

Status: **MINIMUM_INACTIVE_SOURCE_PROPOSAL_DELIVERED / S01_NATIVE_NOT_READY**.
Base `1afe40aedbfc44855ccea676fb92fd4e6ec61e83`; consumer
`37af00f76390d8973bbc7eb529a76aa27fe1f254`.
Assignment: [6573330782](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573330782).

## Canonical source result and scope

The pinned DW-02 contract explicitly states there is no accepted canonical
provider-agreement persistence/verifier source. Source searches find the existing
strict input/output contract and SERVICE references, but no SQL provider-agreement
store declaration. This establishes a **source gap**, not absence in a hosted DB;
no DB inspection was performed. Exact source/consumer Git blobs, byte/hash pins,
searches and rejected source candidates are in `provenance.json`.

- `platform.workspace_contracts` is a subscription/plan commercial contract. It
  has Workspace and version but no provider-party/service-scope relationship.
- `maintenance.vendor_contracts` binds vendor/property, rate cards and procurement;
  it lacks the required canonical agreement integer version, Workspace and service
  scope. Its inclusive `ends_on` policy is not imported into SERVICE.
- AIRPROP management mandate requests are another domain and are not a provider
  agreement or a new generic authorization source.
- Canonical parties, Workspaces and tenants are reused; no SERVICE-side registry,
  substitute party/Workspace/authority, evaluator or receipt engine is created.

Historical documentation calls this envelope S02; this task follows the **consumer's
S01 producer dependency** for `provider-agreement-verification.v1`. It adds no
S02 resource/geography/Finance/Booking/Operations capability. The request tested is
nonfinancial, workspace-wide and has no resource-specific dependency.

## Executable producer and bindings

`src/lib/core/service-s01/provider-agreement-reader-v1.ts` provides:

- `createCoreS01ProviderAgreementReaderV1(bindings)` returning the exact
  `(CoreTransactionScopeV1, ProviderAgreementVerificationV1Input) => Promise<...>`
  shape of SERVICE's transactional canonical reader;
- `bindCoreS01PreflightReaderV1(reader, scope)` closing over a **server-owned live
  read transaction**, not a scope supplied by the public request;
- `createCoreS01AuthorityCaptureV1()` as an optional composition seam for the
  existing host's `resolveAuthority` slot. It calls the unmodified accepted
  canonical provider and binder, then remembers only request/lock metadata keyed
  by the exact scope object. It never caches a reusable allow. Reader calls still
  recheck canonical authority/session. A different scope object or a denied
  canonical observation has no captured request. No scope, transaction, claim,
  timestamp, authority version or receipt is fabricated to warm this capture.

`CORE_S01_RUNTIME_BINDING` remains NULL; no application imports or activates the
new reader. A null source binding fails SOURCE_NOT_READY before any query. A
non-null **proposal** binding in controlled tests is not source acceptance or a
production switch. Only trusted server composition may supply bindings, scope,
canonical captured request metadata and the disclosure port. These capabilities
must never be accepted from JSON, `user_metadata`, a route parameter or client.

Suggested *future* composition, after the gates below, is to supply the reader
as SERVICE's `transactionalReaders.resolveProviderAgreement`, bind the preflight
reader to an already admitted Core read scope, and use the capture's
`resolveAuthority` as the existing command host provider hook. This is a proposal,
not a change to SERVICE/runtime binding. The current scope interface does not
itself expose Context/command-lock metadata: do not invent those fields or a
`Date.now()` lock receipt when the capture is unwarmed. Preflight without a real
server read transaction/authority binding stays NOT_READY. No new transaction
host, pool, connection, retry, commit or settlement protocol is added here.

The implementation:

1. Uses the unchanged strict v1 schemas; rejects extra actor/user_metadata,
   unsafe version, duplicate scopes, and all but exact `services.orders.request`
   with `service.request.create`. Copies/freezes the request before awaits.
2. Reads a fresh server UTC clock and binds database XID, serializable isolation,
   actor, tenant and Workspace to the supplied accepted scope. Actor is never
   taken from the input. A changed scope/transaction is not successful data.
3. Calls the existing session-currentness helper and
   `resolveAuthority` / `bindCanonicalCurrentAuthorityObservationV1` under that
   same scope. Exact Context, Workspace, actor, permission, module, attempt and
   host transaction metadata must bind. Shared Auth/evaluator code is untouched.
4. Requires an **additional explicit server disclosure policy** before probing
   private agreement rows. Action permission alone is not disclosure permission.
   Withheld returns null for every identifier/version/date and no scope entries;
   unknown/timeout/source/privilege/cardinality errors do not become effective or
   empty data. Private source insufficient privilege is unavailable, not proof
   that the user was denied.
5. Reads the proposed head, immutable current version, canonical provider party
   and Workspace with SHARE row locks, then re-reads head identity/version/
   revision/status. It never initializes, repairs or persists a row. Foreign
   tuple, missing authorized source, archived party/Workspace or head drift cannot
   support an effective result. A malformed/multiple row is unavailable.
6. Rechecks real canonical session/authority and disclosure **after source lock
   waits**, then reads a later server clock because those rechecks can also wait.
   Request-version mismatch returns `not_effective` with the actual current
   version only after disclosure, allowing unchanged SERVICE to report a conflict.
   Revocation, future validity, expiry and insufficient service scope deny an
   effective result. Head revision is not substituted for content version.
7. Returns only the strict v1 envelope; always
   `action_authorization=not_evaluated`. No private source IDs, diagnostics or
   row payloads are placed in errors. No action, audit/outbox or receipt is minted.

The supplied SQL texts are reader constants for a **proposed, absent/not-accepted
store**, not an installed RPC or an installer. Importing/running the controlled
harness does not execute them against PostgreSQL. SERIALIZABLE is lock-capable;
"read-only producer" here means no domain mutation, not SQL READ ONLY. Row locks
and `txid_current()` are not represented as physically side-effect-free execution.

## Minimum inactive store proposal — not DDL/install authorization

`store-proposal.json` specifies two Core-owned candidate tables: versioned head
and immutable agreement versions. Agreement/tenant/Workspace/provider-party tuples,
current-version FK, version uniqueness, date/scope constraints, Core ownership,
closed ACL/defaults and RLS requirements are explicit. Existing parent PKs alone
would not enforce tenant equality; a real reviewed tenant constraint-trigger and
writer are required, not a stub. No executable apply/migration, public endpoint,
policy/grant or writer is supplied or claimed installed by this source slice.

The proposed writer contract locks the same head FOR UPDATE, versions changes
atomically and increments revision for revoke/scope/current-version changes.
Party/Workspace invalidators must participate. The reader's proposed lock order
is documented but **not frozen/proven across all writers**. SERIALIZABLE and a
re-read are not, alone, proof of session/revoke participation or currentness through
COMMIT/delivery. Source proof needs native writer, privilege, isolation/40001,
lock-order and session tests before activation. SQL cancellation/serialization
errors never trigger a reader-created success or blind retry; the existing host
owns rollback/UNKNOWN/recovery.

Two bounded decisions remain:

| ID | Owner | Proposed decision / trade-off | Closure |
|---|---|---|---|
| S01-D01 | coordinator + Core | Accept the minimum canonical head/immutable-version design and its reviewed tenant/ACL/RLS/writer/revoke implementation. Reuse actual parties/Workspaces. This adds only the missing agreement source, not a SERVICE registry. | Accepted canonical schema/source identities, reviewed writer invalidators and targeted native fixture/ACL/locking proof; no DB/installer behavior inferred from this document. |
| S01-D02 | product/coordinator + Core/SERVICE security | Approve an exact bounded disclosure policy for the named provider agreement fields under this nonfinancial request. Separately choose UTC start-inclusive/end-exclusive dates, or specify another timezone/end-day policy. Current date-only ABI defines neither; this proposal does not silently import another domain's policy. | Exact disclosure mapping and date semantics accepted and pinned, then expiry/revoke/withheld tests on the native reader. Until then source/date/disclosure runtime bindings remain unapproved/NULL. |

Other implementation choices (Core ownership, reuse of canonical IDs, strict
binding, stale-version signaling within existing ABI, no action authority,
redaction and fail-closed source errors) are resolved in this source proposal.
There is no generic request for wider permissions or full-Core completion gate.

## New affected tests and exact toolchain

```
node scripts/review-core-service-s01-producer-01/test-producer.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --esModuleInterop --types node src/lib/core/service-s01/provider-agreement-reader-v1.ts
node node_modules/eslint/bin/eslint.js src/lib/core/service-s01/provider-agreement-reader-v1.ts scripts/review-core-service-s01-producer-01/test-producer.mjs --max-warnings=0
```

Only existing dependencies are used, from an installation with the **same** lock
SHA256 `c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc`:
Next16.4.1, Zod4.6.6, TypeScript5.9.3, Node24.19.0. No install/package/lock/env change.
The loader transpiles pinned source, reads the SERVICE commit as a local Git
object and verifies the shared contract/host/authority sources are byte-identical.
It does not download, fetch or modify SERVICE. The new test file runs only its
new cases; no old suites are imported/executed.

30 targeted checks pass on controlled query transport. They invoke the real new
Core producer over actually consumed synthetic source rows and the **actual**
SERVICE preflight and `prepareServiceV14Execution(...).providers.validateProviders`
from the specified commit, not a copied/imitation consumer or ready envelope.
Canonical authority code is real; SQL return rows and currentness changes are
controlled fixtures. Cases cover positive exact binding, expired/revoked/stale/
foreign/scope/party mismatches, post-lock authority/session/disclosure revocation,
head drift, expiry during source/disclosure waits, no private scan when withheld,
strict request input, cardinality/malformed/timeout failure, preflight NOT_READY
without source, stale conflict, transactional denial, and no mutation/receipt
query. This proves controlled source composition only, not DB or concurrency.

A separate scratch TypeScript check against an exact archive of SERVICE37af... plus
this reader also verifies structural assignment to its actual preflight and
transactional interfaces. That scratch is not another product branch or source
prerequisite. The delivered code/test/provenance is reproducible from official
Git refs and the existing exact lock; private local artifacts are not required.

## Bounded Platform proof request and remaining gates

`platform-proof-request.json` pins the test script, producer, proposal, exact
lock, consumer commit and a fixed Node invocation. It is an unadmitted
**controlled-source** consumer request; profile/commit/attempt/review bindings are
NULL. Platform must bind exact reviewed request/source bytes and an egress-denied
profile; there is no arbitrary shell/SQL hook or self-approved request.

A native PG request is explicitly **BLOCKED_NOT_GENERATED**, with no SQL/fixture
payload invented from an unaccepted schema. After D01/D02, its listed admission
criteria require actual consumed canonical rows, shared host/session source and
rights, final-ROLLBACK proof, and a separately admitted two-connection writer/
revoke/wait/expiry/40001 lane. The controlled Node request cannot substitute for
that native proof or lift runtime holds.

NOT_RUN: SQL parse/compile/execute, real PostgreSQL/Auth/session, fixture creation,
native lock/revoke/COMMIT/concurrency, install/grant/activation, staging/Production,
financial action, full build/browser/CI/deploy. No runner, guard300, Foundation,
Operations, SERVICE product/UI or shared authority source was edited. Prior WIP
and the completed ACL-PROJECTION-02 worktree remain separate and preserved.
