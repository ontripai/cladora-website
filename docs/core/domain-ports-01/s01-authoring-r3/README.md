# CORE-DOMAIN-PORTS-01 / R3 — independent S01 authoring/Quote

Parent: fc179df92f26d63de9cfe03c5644719f0428913d. Guide installation is a
separate committed delivery. Accepted QFW-R2-03, Request disclosure policy, SQL,
canonical store/writer, date-only policy and all owner-domain files are preserved.

## Executable Core ABI

`createCoreS01AuthoringAgreementReaderV2` in
`src/lib/core/service-s01/provider-agreement-reader-v1.ts` exports the separate
closed authoring family. `createCoreServiceAuthoringAgreementRuntimeV2` in
`src/lib/core/service-authoring-agreement-runtime-v2.ts` supplies same-runtime
`readers.resolveProviderAgreement(scope,input)` and the existing C03 `host`.
Only trusted server composition supplies the Pool, exact target and actual Request.
Actor/session/AAL2/current scope come from the existing verified server transport.
The result remains `provider-agreement-verification.v1`,
`action_authorization=not_evaluated`; it is disclosure, never command authority.
No public resolver/route/environment binding is activated; runtime binding=NULL.

| Permission / module | Requested service scope | Captured C03 purpose |
| --- | --- | --- |
| services.catalog.manage / services_catalog | service.offering.create | service.create_offering |
| services.catalog.manage / services_catalog | service.offering.submit, .suspend or .archive (exact one) | service.transition_offering |
| services.catalog.publish / services_catalog | service.offering.publish | service.transition_offering |
| services.quotes.manage / services_orders | service.quote.create | service.create_quote |

Each row is a closed exact profile, not a permission alias. Request's existing
`services.orders.request / services_orders / service.request.create` retains its
published workspace-wide non-reservation Offering gate; authoring does not turn
Request policy into a generic allow. Guide/Listing/Finance are not supported here.
An Offering need not already be published to author that Offering or a Quote.

The source is the existing canonical `platform.provider_agreement_heads_v1` and
immutable `platform.provider_agreement_versions_v1`, linked to actual tenant,
Workspace and `portfolio.parties`. Head current_version/revision/status are read,
then party -> Workspace -> head -> version locks and head re-read use the SAME
live C03 scope. Exact agreement/version/provider/scope are checked. Revision is
not a timestamp/hash/default. Only the existing safe int8 codec is applied.
Canonical authority/session are re-evaluated after waits, with a final same-scope
server observation and UTC operational date. Starts inclusive, ends exclusive,
NULL=no end. The temporal precision guard and original40001 propagation remain.
Withheld responses expose no tenant/Workspace/provider/agreement/version IDs.
Permitted disclosure of expired/not-effective status is not command permission.

## Actual SERVICE integration and capture ownership

Consumed owner source: fdfe3c6eb5f5f7dd586d21b5d8a8855fa912cb83, acquired and
verified from its official incremental bundles, not assumed published commits.
No SERVICE implementation is copied into Core or edited. The test loads actual
Git-pinned modules, including `createServiceQuoteRuntimeResolverV1`, the Quote
PostgreSQL adapter/provider and actual Offering authoring composer.

The existing Core Quote command binder now executes through this authoring
composition, after its unchanged verified-session gate and exact Quote profile.
The SERVICE factory calls the binder, then `source.bind(request)`. That source
binding must call the Core factory with the SAME Request/Pool/target to obtain
`readers.resolveProviderAgreement` from the same canonical capture:

```ts
const authoring = createCoreServiceAuthoringAgreementRuntimeV2({pool,target,request});
// In SERVICE-owned source.bind(request), return this function alongside the
// independently implemented durable preparation/history methods:
const resolveProviderAgreement = authoring.readers.resolveProviderAgreement;
```

An exact Request-keyed WeakMap shares composition only, never caches an allow,
session, receipt or scope. Foreign Pool/target for that Request fails closed.
Every execute/replay reauthenticates and creates its own live attempt; closed scopes
cannot be reused. A separate Request gets a different composition. No new host,
ledger, reservation, authority provider or retry engine is introduced.

Counterexample1: actual fdfe Quote with predecessor Request-only Core denies
before insertion. Counterexample2: actual SERVICE factory with predecessor Quote
binder and a separate producer capture fails; a direct adapter test alone would
miss this integration defect. The new request-local sharing closes that coupling.

## Checks and their exact boundary

Commands:

```sh
node scripts/test-core-authoring-agreement-r3.mjs --predecessor
node scripts/test-core-authoring-agreement-r3.mjs --isolated-capture
node scripts/test-core-authoring-agreement-r3.mjs
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint src/lib/core/functional-command-runtime-v1.ts src/lib/core/functional-producers-v1.ts src/lib/core/service-s01/provider-agreement-reader-v1.ts src/lib/core/service-authoring-agreement-runtime-v2.ts src/lib/core/service-quote-command-binding-v1.ts scripts/test-core-authoring-agreement-r3.mjs
node --check scripts/test-core-authoring-agreement-r3.mjs
```

16 new controlled groups exercise actual owner Quote SQL/provider + real Core
reader/C03, same-key replay/zero second effect, wrong scope, expired/revoked/foreign
source, last-wait authority/session/expiry denial, original40001 through the
existing three attempts, UNKNOWN commit and exact-command recovery, changed body,
Context drift, separated Request/authoring gates and Offering composer acceptance.
They also exercise the actual SERVICE resolver factory sharing Core capture and
reject foreign Pool/target, new-Request reuse and AAL1 before new checkout.
The controlled Offering test reaches ACCEPTED provider evidence then intentionally
aborts before the owner mutation; it does not claim Offering persistence.

All PG/Auth responses and the source-preparation reservation in the factory test
are explicitly CONTROLLED fixtures. They prove executable source composition, not
native storage, durable preparation, SQL semantics/locks, HTTP custody activation,
Auth/MFA, hosted RLS, restart, or concurrent revoke behavior. The test never treats
an emitted current state/JSON/hash as a stored receipt. No network/DB calls occur.
Accepted QFW and unrelated successful historical suites are not repeated.

## Install / remaining gates

No new SQL/GRANT is needed or included by this SOURCE family split. It consumes the
already-versioned canonical store and existing service-native-v3 runtime access;
no Request policy, FORCE RLS, writer, installer or guard is rewritten.
Platform must still verify actual installed store/header/version/tenant composite
FKs, roles/SELECT and lock-column UPDATE rights under the exact target's accepted
v3 profile, session/authority epoch participation and Quote table dependencies.
Source paths/identities are pinned in manifest.json, not instructions to replay
all migrations or run an old postgres-owner capsule against an ordinary target.
Mismatch/timeout/unknown settlement means STOP/UNKNOWN and read-only reconciliation;
no automatic grant, fallback, install resend, retention or deletion is authorized.

The full native Quote flow additionally requires SERVICE's durable
`prepareOrRecover`/history binding with unchanged IDs/key/body after UNKNOWN and
current canonical source binding. This packet does NOT implement that producer,
seed a reservation, claim it installed, or activate SERVICE's NULL public resolver.
The test's fixed reservation is not a production replacement. Runtime/SQL/Auth/
positive native S01 and final application acceptance remain NOT_RUN_NOT_PASS.
The Guide disposable-PG installation evidence is not borrowed for S01/Quote.

Automation: نیازمند بررسی — exact pin/coupling checks are candidates; target
admission, durable preparation, native currentness and acceptance need their
formal Platform/SERVICE/Coordinator dependencies and decisions.
