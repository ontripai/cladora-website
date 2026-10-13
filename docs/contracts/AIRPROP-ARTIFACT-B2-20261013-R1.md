# AIRPROP-ARTIFACT-B2-20261013-R1

New, pre-activation replacement candidate for the API, runtime adapter, UI and
AP10 consumer. Baseline: main `08282c4117216f9e48161d59a6187cb0a1c69431`.
Legacy Artifact B is `payload_unavailable`. Its recorded tree
`d090b26dd0aee9175a9de0ad72f6ec3453954c81` and patch SHA-256
`155bd554c36a621fe32f56ca151c5499abfb07f3267f583b24b69cf8f52dc453`
are historical identifiers only. B2 makes no byte-identity or legacy payload
reconstruction claim. No further payload search was performed.

## Composition and boundaries

The production route explicitly has `runtime: null`, `portfolio: null` and a
null trusted binding. Authenticated metadata remains readable; resource reads
and AAL2 mutation requests fail with `AIRPROP_PRE_ACTIVATION`. There is no
environment switch, pool creation, service-role fallback or deployment wiring.
The controls remain `commands=null`, `can_edit=false` in API and UI.

An internal mutation adapter takes the existing actor-bound PostgreSQL pool and
calls `createCorePostgresTransactionHostV1`, with the unmodified Core
`resolveAuthority` provider. It creates neither authority truth nor a ledger.
Core owns serializable scope, revision locks, independent canonical permission
evaluation, exact replay, existing idempotency/audit/outbox rows and rollback.
The refreshed Core host keeps its documented v1 compatibility path; its new v2
provider-evidence package remains Draft and unwired on this main. B2 does not
activate or claim that separate v2 provider contract.
The server must resolve actor, selected context, Workspace, Resource and current
revision, and preserve stable transaction/command IDs and aggregate version
across exact retries. None of these identities or authority values are accepted
from client JSON. Core verifies the database actor; no adapter sets JWT claims.

Provider validation checks the existing authenticated EXECUTE gate before any
write is staged. No grant is made. The seven mutation RPC families from Artifact A
run in the supplied Core scope, without a second connection or transaction.
Commands map to listing controls, reservation controls, obligation schedule,
commercial execution reference, management request, management acceptance and
management work-order link. Existing obligations and references are reused;
there is no independent financial ledger or Documents store. Unknown COMMIT is
`READBACK_REQUIRED`, never a speculative automatic retry.

The eighth gateway is the existing actor-bound
`customer_api.read_airprop_management_portfolio_v1`. Artifact A owns its canonical
permission/resource checks and read transaction. The read adapter validates only
the existing strict query and portfolio contracts, and fails closed on errors
or malformed responses. It never substitutes a cached allow. The API accepts
exactly context and Workspace query parameters; provider composition is closed.

The UI is mounted only after explicit Workspace selection. It requests only GET,
does not expose editing controls, aborts on identity change, discards late
responses, clears previous identity data immediately and renders unavailable
rather than claiming an empty authorized portfolio on provider failure.
Localized EN/RO/FA read projections show property/owner labels, mandate scope,
validity and bounded action statuses. Raw source IDs are not displayed.
Operations owns execution detail; Finance remains disconnected under the existing
contract. No C/D provider or activation is included.

The AP10 consumer is an exported `execute` callback for the existing
`runAp10AuthE2EFixture` interface: actor client/access token, explicit context,
two Workspaces, two properties and three units. Its injected transports must
use that fixture actor's session. It performs no setup, admin operation, grants
or writes. It counts unavailable portfolio reads separately from successful
reads, checks Workspace/property projection binding and keeps HTTP/AAL2 marked
`NOT_RUN_NOT_PASS`. Existing AP10 authority setup/cleanup ownership is unchanged.

## Requirement traceability

| Requirement | Implementation | Validation |
| --- | --- | --- |
| Distinct replacement identity, no legacy equivalence | `artifact-b2-contract.ts`, this document | ID asserted by API/AP10/UI tests; independent Git tree and patch receipt |
| API layer, authenticated no-store metadata/read controls | `artifact-b2-api.ts`, production `artifact-b2/route.ts` | API/AP10: real route module, auth, AAL1, bad origin, media type, byte limit, forged fields, explicit closed reads |
| Runtime adapter for installed A interfaces | `artifact-b2-runtime.ts`, `artifact-b2-portfolio.ts` | Runtime contract exercises seven mutation families; portfolio test verifies exact eighth RPC and query parameters; existing 35 commercial contract checks |
| Canonical Core authority and shared transaction infrastructure | Imports of existing Core provider/host; no Core changes | Real host/provider run with deterministic contract pool; canonical revision/permission reread on exact replay; frozen Core digest safety check |
| `commands=null`, `can_edit=false` | Contract/API, readonly UI wrapper/component, AP10 consumer | Production route metadata, rendered controls, forged-control rejection, AP10 contract |
| Stale and revoked authority: zero durable writes | Core provider/host, no adapter cache | Runtime stale epoch, revoked membership, revoked exact replay, permission-denial cases check every shared effect |
| Cross-Workspace: zero writes | Trusted binding versus strict command; canonical A read gateway | Runtime/API mismatched Workspace rejected before connection; AP10 mismatched property projection rejected |
| Replay conflict: zero additional writes | Existing Core request/receipt fingerprint and locks | Real host exact replay and changed-input conflict; counters and no insert on conflicting attempt |
| Provider failure: zero durable writes | Provider gate before staging, host rollback, bounded API failures | Canonical provider failure, closed EXECUTE, failed domain mutation rollback all idempotency/domain/audit/outbox effects; API error redaction |
| Uncertain commit does not retry writes | Existing Core unknown-commit result, API 409 | Runtime commit-ack failure uses one connection; public read-back-required boundary |
| UI integration and locales | `CustomerAirpropWorkspace.tsx`, `CustomerAirpropB2.tsx` | Rendered EN/RO/FA fixtures, RTL, labels/statuses, no raw IDs/forms, stale request suppression and immediate clear; existing native and underwriting UI suites |
| AP10 consumer | `scripts/lib/ap10-airprop-b2-consumer.mjs` | Two Workspace/property fixture, three-unit input, explicit unavailable read counts, invalid fixture/controls/cross-property negatives |
| No migrations, grants, C/D, Documents, new ledger or Remote writes | Exact manifest below; closed composition | Safety scans, all 247 baseline migration bytes/file set and all Core files frozen; Git diff scope review |
| Mandatory Repository checks | Existing Application Foundation plus `test:airprop-b2` | Route exports, unit, app foundation, typecheck, lint, build, built-app locale audit, high-severity dependency audit, diff whitespace |

Runtime-contract evidence is a deterministic transaction pool fixture executing
the actual host/provider/adapter code. It is **not** PostgreSQL integration,
remote gateway execution or real authenticated HTTP/AAL2 evidence. No migration,
grant, product Remote write or activation is run to obtain this evidence.

## Exact candidate file manifest

Modified:

- `.github/workflows/application-foundation.yml`
- `package.json`
- `scripts/test-airprop-native-ui-004.mjs`
- `scripts/test-airprop-underwriting-ui-008.mjs`
- `src/components/customer/CustomerAirpropWorkspace.tsx`

Added:

- `docs/contracts/AIRPROP-ARTIFACT-B2-20261013-R1.md`
- `scripts/lib/airprop-b2-contract-pool.mjs`
- `scripts/lib/airprop-b2-test-loader.mjs`
- `scripts/lib/ap10-airprop-b2-consumer.mjs`
- `scripts/test-airprop-b2-api-ap10.mjs`
- `scripts/test-airprop-b2-runtime-contract.mjs`
- `scripts/test-airprop-b2-safety.mjs`
- `scripts/test-airprop-b2-ui.mjs`
- `src/app/api/customer/v2/airprop/artifact-b2/route.ts`
- `src/components/customer/CustomerAirpropB2.tsx`
- `src/lib/airprop/artifact-b2-api.ts`
- `src/lib/airprop/artifact-b2-contract.ts`
- `src/lib/airprop/artifact-b2-portfolio.ts`
- `src/lib/airprop/artifact-b2-runtime.ts`

Tree and SHA-256 of the complete binary Git patch against the pinned baseline
are recorded in the final PM receipt and Draft PR. They are calculated after
the candidate is frozen; embedding its own tree/patch digest here would create
a circular digest. The PM manifest records each file's byte count and SHA-256.

## Remaining release blockers

Review this candidate in Draft. Production binding/composition, installed Core
revision availability, connection identity/grants and activation require their
own independently authorized work. Real PostgreSQL gateway integration and
authenticated HTTP/AAL2 are `NOT_RUN_NOT_PASS`. This candidate does not authorize
merge, activation or any product Remote change. Artifact A remains unchanged.
