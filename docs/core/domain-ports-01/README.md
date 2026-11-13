# CORE-DOMAIN-PORTS-01 / R0 — first independent command identity port

Status: SOURCE_READY_FOR_REVIEW; controlled transport coupling passed.
Native/current-target integration: NOT_RUN_NOT_PASS. The roadmap remains open.

Source prerequisite: `bfadc5042cb00841dd605862a2a72ddc0dbafb87` (published PR478
head, not yet the Coordinator-announced merged-main baseline). No historical
Request acceptance, UNKNOWN/failure, Core17 receipt, or private packet is rewritten.

## Executable consumer contract

Import `createCoreServiceAuthoringIdentityPortV1` from
`src/lib/core/service-authoring-identity-port-v1.ts` in trusted server composition.
Pass the existing Platform-verified owned-development `pool`, `target`, and the
original server `Request`; there is no credential/environment discovery or default.
No route/global runtime binding or caller grant is added by this delivery.

```ts
const identityPort = createCoreServiceAuthoringIdentityPortV1({pool, target, request});
const identity = await identityPort.resolve({context_id, workspace_id, action: 'create_offering'});
```

Input is strict: only context_id, workspace_id and action. Supported operations
are create_offering/submit/publish/suspend/archive. Publish maps to
services.catalog.publish; the others to services.catalog.manage, all with
services_catalog, matching SERVICE's existing `permissionFor` in provider-binding.ts.
No edit/Quote/Listing/Guide/custody action is silently mapped to these permissions.
An HTTP-selected Context is a request, never evidence of membership or authority.

Output ABI `core-domain-command-identity.v1` is frozen and strict:
contract_version, context_id, workspace_id, tenant_id, membership_id, actor_id,
permission_code, module_code, authority_version, evaluated_at, completed_at,
action_authorization='not_evaluated', reusable_as_authority=false.
All source identities come from verified server Auth and the canonical same-lease
resolver. Date/time strings retain actual database microseconds; no JS clock.

SERVICE can use actor_id/authority_version in the trusted envelope accepted by
its existing prepareCreateVersionedServiceOfferingV1 /
prepareTransitionVersionedServiceOfferingV1. SERVICE still owns domain input,
IDs, exact stable command/key/body/hash, version checks and provider composition.
The existing Core C03 runtime host remains the sole command execution/replay host;
it reauthenticates, binds the same actor and current scope, and rejects stale
revision/denial. This identity read is NOT preflight command authorization,
immutable target evidence, a committed receipt or a reusable allow. Do not resolve
again to generate a new command after UNKNOWN; preserve the original command.

## Actual path and settlement

The new method is additive on the existing functional runtime:
fixed official getUser + getClaims (AAL2), actual pool/principal/target checks,
SERIALIZABLE begin, existing current-session row lock, canonical resolver and
server claims, authority-epoch FOR SHARE, canonical checkpoint, exact tuple
comparison against initial server resolution, real database clock, final
checkpoint after source/clock waits, positive ROLLBACK ACK, same-backend completion
clock, destroy lease, then return. Any failure discards the value. Same 40001
object propagates, with existing failure metadata and no retry engine. Secondary
cleanup failure never replaces the first error. No caller query/provider callback
or transaction scope escapes this method.

There is no C03 reservation, domain/audit/outbox mutation, command receipt,
advisory command lock or COMMIT in this identity read. Its ROLLBACK is not a new
command COMMIT. Completion is not an authority promise through client delivery.

## Independent consumers and exact open work

| Consumer | Existing producer/port reused | This R0 / remaining connection | Owner and closure |
| --- | --- | --- | --- |
| Offering | SERVICE offering-command.ts and provider-binding.ts; Core C01/C03/S01 | Trusted server identity port is executable. S01's present disclosure binding is **service.request.create + published Offering**, not Offering-authoring disclosure. No withhold is overridden. | Core + SERVICE: pin an agreed authoring disclosure source/profile, couple actual SERVICE create/publish providers and canonical S01 in the same C03 transaction, then Platform-run native receipt/readback/revoke/expiry. |
| Quote | SERVICE service-quote-schema.ts and service-quote-publication-schema.ts | No new Quote command is invented; existing SERVICE v14 execution-plan union contains create_offering/transition_offering/create_request. Quote permission/provider identity must be selected by SERVICE before a Core runtime coupling. | SERVICE domain command/provider/ABI, Core port/identity and transaction coupling. Versioned request/parties/current authority and same-key recovery proof required; no payment authorization inferred. |
| Listing | Core airprop-read-host-v1.ts/current-unit-property-selector-v1.ts; AIRPROP listing-runtime-binding-v1.ts | Existing real host is retained. Consumer's bindSelector still requires command-aggregate evidence; a read transaction is not such a command. No fake command/receipt or asset.read-to-manage mapping is supplied. | Core read-compatible selector/evidence and exact SQL admission, AIRPROP canonical Unit/party/relationship producer and lifecycle providers; Platform limited-role binding. Independent of valuation and this Offering port. |
| Guide without document | CE experience-guide-create-writer-v1.ts; Core existing C03 | Existing CE provider owns single-step creation and canonical guides/steps. This port does not grant its distinct experience.guide.manage/experience_guides capability. | Core/CE request-local server identity/provider coupling on shared main; then native same-id persistence/restart and replay. Does not wait for Documents. |
| Document custody | Core ce012-* historical-binding/terminal mechanisms; Documents documents-canonical-upload-ack-adapter-v1.ts | Historical receipt match is not current disclosure/custody. No upload receipt or scanner verdict is fabricated. | Platform immutable storage/scanner binding + Documents versioned source/projection + Core atomic reference/custody coupling. Existing maintenance and blocked historical slots remain. |

These are separate ports, not a global enable flag or a promise to install all
historical migrations. No absent dependency is converted into a successful stub.
No domain-owner file is changed. Shared main rebind is a named integration gate:
Coordinator must announce FullSHA; compare genuinely changed dependencies only.

## Checks and proof limits

```sh
node scripts/test-core-domain-command-identity-v1.mjs
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/eslint src/lib/core/functional-command-runtime-v1.ts \
  src/lib/core/domain-command-identity-v1.ts src/lib/core/service-authoring-identity-port-v1.ts \
  scripts/test-core-domain-command-identity-v1.mjs
node --check scripts/test-core-domain-command-identity-v1.mjs
git diff --check
```

12 new/affected controlled groups: canonical tuple/identity and zero writes,
closed permission mapping, hostile fields, AAL/session denial, foreign Workspace,
tenant/member drift, final denial after waits, exact 40001, rollback/clock failure,
request abort, affected C03 single effect/replay, affected Request read rollback.
The accepted setup code is reused without running its old test cases. No previous
native Request suite or historical closure chain was replayed. Controlled PG/Auth
transport is not native PG/Auth/RLS proof. No target SQL/fixture/activation ran.

Native gate needs Platform-selected owned backend/profile/limited principal and
exact consumer source, fresh fixture/session provenance and approved case budget.
No staging/Production, public privilege, financial action or real message scope.

Automation: نیازمند بررسی — typed binding/hash/negative checks are mechanical;
Coordinator accepts shared source and Platform owns execution/principal/capacity;
UNKNOWN remains an explicitly reconciled exception, never blind resend.
