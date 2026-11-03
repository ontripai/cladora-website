# V14-AIRPROP-01 / LISTING-LIFECYCLE-FLOW-02

Worker: CLADORA-AIRPROP-WORKER-01. Base: 1afe40aedbfc44855ccea676fb92fd4e6ec61e83.
Branch: codex/program-airprop-listing-flow-02. Existing worktrees/history remain intact.
Assignment: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6570801523

Pre-edit finding: AP01 controls and B2 transaction consumer already exist. AP-PF02
Core mapping exists, but no Listing selector/editor consumes it; B2 product composition
has runtime/bind/portfolio null. Do not rebuild those engines or infer command authority
from a read snapshot. Existing control_airprop_listing_v1 EXECUTE is intentionally closed.

Scope reserved: AIRPROP listing-flow contract/read/API and customer listing component;
AIRPROP workspace local draft registration/labels; dedicated offline tests and this note.
Core, Finance, shared Context/shell, existing SQL, B2 runtime/API and public/demo remain read-only.

## Delivered source slice

The new customer Listing section is mounted in the existing AIRPROP Workspace.
It selects an existing, named Listing; edits availability, withdraws or republishes
through unchanged AP01 command shapes inside a strictly versioned AIRPROP transport.
Resource Unit/version, Property, party kind/id and relationship id/version/kind are
carried explicitly. The read projector calls the **existing**
`mapAirpropCoreCompanionV1`; it does not infer ownership or construct a mandate.
Only an explicit Unit is accepted; Property is never substituted for Unit.
Party names are not disclosed by that Core contract; the UI uses localized
person/company/relationship descriptions instead of identifiers or guessed names.

`GET /api/customer/v2/airprop/listings` is read-only. It accepts only Context and
Workspace. `POST` accepts `airprop-listing-flow.v1` with selection and the existing
AP01 command; actor and AAL come from server claims. Existing B2 AAL2, origin,
content-type, body-limit and no-store boundaries are retained. Malformed, foreign,
wrong-key or wrong-version receipt responses become UNKNOWN, not success.

**Production composition remains `read: null, control: null`.** These routes return
NOT_READY for their missing connection. The ListingControlBridge interface is an
AIRPROP internal integration requirement, **not an approved Core ABI, installed
provider, receipt store or activation flag**. The test-only Map and authority
switches are synthetic fixtures. No fake persistence is included in product code.
A read connection can be supplied independently while commands remain closed.
No readiness, installed grant or real Core receipt follows from presence of source.

The UI keeps invalid input, fences stale fetch/body continuations, clears previous
scope display synchronously through keyed lifetime, and blocks old versions.
Unknown requests retain exact original wire/key/selection in a minimal versioned
same-tab journal scoped to membership/Context/Workspace; no auto-POST occurs on
mount, locale change, navigation or refresh. Confirmed conflict stays blocked.
Unsent drafts remain local; the existing Context guard and an AIRPROP-local
multi-form Workspace guard protect both Opportunity and Listing edits. Discarding
local edits does not delete pending command evidence or send a mutation.
Storage failure prevents an initial dispatch. A failure while recording a conflict
cannot be called durable: the UI explicitly warns against retry after reload and
requires help. Real durable reconciliation remains a native C03 dependency.

## Exact dependency/control record

Producer source SHA for the following existing files:
`1afe40aedbfc44855ccea676fb92fd4e6ec61e83`. Consumer SHA is the delivery commit
linked by the same task report in #463; it cannot be embedded into its own commit.
Existing historical acceptance/CI is retained and is not reissued by this package.

| ID / producer -> consumer | Existing contract/source | Minimum missing output / exact action | Status / blocking extent |
| --- | --- | --- | --- |
| DW02 / Core + AIRPROP domain adapter -> AP-PF02/AP01 | `canonical-resource-reference.v1`, `resource-relationship.v1`, `core-resource-authority.v1`, `ap-pf02-core-companion.v1`; `src/lib/core/airprop-companion-mapping-v1.ts` | Native actor-bound Listing reader over existing `airprop.market_listings`, joined to the same Context/Workspace/tenant and current explicit Unit/version and relationship. Return the strict server row plus canonical companion/request/authority to `readListingFlow`. Property/Unit ancestry must be resolved through the existing Core selector, never guessed. | Current schemas/mapping DELIVERED; native read binding REQUESTED / NOT_READY. Blocks this live Listing read, not other AIRPROP flows. Controlled projection test is not native connection acceptance. |
| C01/AUTH01 / Core -> Listing read/command | `workspace-native-effective-authority.v2`; `current-authority-transaction-port-v1.ts`, `current-authority-postgres-provider-v1.ts`, `current-unit-property-selector-v1.ts` | Read permission `airprop.asset.read`; command permission `airprop.opportunity.manage`; module `airprop_commercial`. Server-derived actor/session, current version, revoke/expiry, full Context/Workspace/Property/Unit/party join and exact-purpose disclosure. Recheck at the native transaction checkpoints; a mapped read snapshot is never command authority. | Existing Core sources DELIVERED; native Listing composition REQUESTED. No Core source changed and no new resolver/evaluator/session/lease created. |
| C03 / Core + AIRPROP native adapter -> AP01 | `createAirpropB2Runtime`, `createCorePostgresTransactionHostV1`, `control_airprop_listing_v1`; existing revision/audit/receipt infrastructure | Implement the AIRPROP bridge using these existing facilities. Bind the complete selection in immutable command/evidence fingerprint in the **same physical transaction** as fresh C01/DW02 checks and native control. Join all Unit/property/party/relationship versions; compare expected Listing version. On exact replay validate current authority/reference but recover the recorded result before treating the newer Listing version as a new command. Return recorded native receipt and real Core receipt id; never synthesize either. On unavailable/unknown COMMIT keep UNKNOWN. If the existing accepted ABI cannot carry this binding, Core must review a bounded delta before wiring; this interface does not approve that delta. | Existing host/runtime source DELIVERED; full-selection native bridge REQUESTED / NOT_READY. Blocks live mutations and durable native recovery only. No second transaction/idempotency/audit store or manual SQL/grant is supplied. |
| FIN01 / Finance -> AP03 only | Existing Finance proposal/posting contract | No money, obligation or valuation action in this slice. | Not a dependency of this nonfinancial Listing flow. |

Producer implementation/admission is jointly owned: AIRPROP owns its Listing query
and native adapter; Core owns C01/DW02/native transaction contracts and any needed
bounded producer correction. No generic request to finish all Core or AP-VAL is made.
All connection tests here use synthetic transport/authorization/storage. Their
status is controlled source verification, **not CONNECTED_TESTED against native DB**.
AP02–AP10 and AP-VAL-A..F remain in the canonical backlog; this slice does not
claim completion of those packages, PF01, Finance or a market-price producer.

## Validation / evidence boundaries

- `node scripts/test-airprop-listing-flow-02.mjs`: 33 controlled contract/API groups,
  actual Core mapping and actual Next handlers, fake native bridge/receipt storage.
- `node scripts/test-airprop-listing-ui-02.mjs`: 17 mounted React/JSDOM groups,
  RO/EN/FA/RTL, lifecycle, stale/foreign/revoke, exact retry/lost reply, blocked
  conflict, storage failure, no unintended POST, actual ContextProvider and joint
  Workspace draft guards. No authenticated/native browser or PostgreSQL claim.
- `node scripts/test-airprop-native-ui-004.mjs`: affected existing regression suite;
  the new unrelated Listing panel is isolated in that suite, and exercised for real
  by the dedicated mounted suite. Only its changed warning expectations are updated.
- TypeScript/scoped ESLint/diff checks use existing local cached tools. Available
  TypeScript5.9.3/React19.2.8/Next16.3.8/Zod4.4.3/JSDOM26.1.0; package target
  Next16.4.1/Zod4.6.6 is **not locally installed or claimed tested**. No installation,
  lockfile or dependency/configuration edit was performed.
- G3 real PostgreSQL/RLS/concurrency/atomic rollback/actual C01/C03/issued Auth,
  native browser E2E, staging/Production installation and G4/release: NOT_RUN_NOT_PASS.
- No Core/Finance/shared layout, SQL, public site/demo, existing B2 runtime, pending
  Opportunity recovery codec or AP-VAL engine change. No provider/real data/cost.

Skills: CLADORA-SKILLS-USAGE v1.1.0; AGENTS, Cloud Runtime/networking, Supabase
source security guidance, React Best Practices. Source-only task restrictions
supersede skill examples suggesting queries/install. No separate GitHub skill was
available; official GitHub connector and normal Git were used. Network remained
restricted/enforced; no proxy bypass or credential read was used.


## AFFORDANCE-03 correction (Base 4ef285731c3fb7f02877eb9c2316220990d64d63)

Read transport is now explicitly version **2**. Command transport and local recovery
remain v1, with the original immutable body/key/selection and journal CAS unchanged.
Each Listing carries `actions.edit_listing`, `actions.withdraw_listing` and
`actions.republish_listing`: `allowed`, `denied` or `unavailable`. These describe
current authority only; published/withdrawn/reserved lifecycle eligibility remains
separate. Aggregate `can_edit` is only a compatibility summary of allowed actions,
never a row-level grant. `connection` describes bridge/AAL2 availability, not authority.

The server-only ListingSourceRead proposal accepts optional `action_projections`.
The trusted canonical producer must obtain read and action evidence for the current
session actor and the same current read observation; it must not replay cached
permissions. Each projection names its actor, Context, Workspace, action and full
Listing/resource/party/relationship/version selection. Its separate Core request,
companion and authority evidence are consumed by the **existing Core mapper** using
`airprop.opportunity.manage`, module `airprop_commercial`, purpose `airprop.b2`.
The action evidence evaluation instant must match the authorized read observation.
Core still validates current permission, exact resource/relationship versions and
relationship effectiveness. Identity and actor binding at the canonical producer
are an integration requirement, not a new accepted Core ABI or installed evaluator.
DW02 `action_authorization=not_evaluated` and read permission grant no action.
Missing projection yields unavailable actions while independent read succeeds.
Bridge absence/AAL1 masks actions. Per-action evidence never spills to another row.
No tenant, raw evidence or evaluator receipt is disclosed to the browser.

UI uses the current row/action projection, including when a dirty selection retains
old input. Resource/selection drift disables a new command. For an already uncertain
journal command, explicit exact retry uses current authority for that same Listing,
resource version, party and relationship; only the historical expected Listing
revision can differ to reconcile a previously committed command. It does not issue
a new key, change the original wire, infer a receipt or admit a new command.
POST still independently checks session/AAL2 and the existing bridge contract requires
fresh transactional authority, full binding and native replay/CAS checks. Affordance
is not reusable command authorization. Revocation observed on refresh disables retry
and retains the journal; revocation after the read is enforced by POST/bridge.

The product route retains `read:null` and `control:null`. Canonical producer and C03
bridge adoption remain NOT_READY. No runtime authority, native transaction, real
Auth/DB or Production evidence is claimed by synthetic tests. The dedicated new
suite and affected mounted suite check installed dependency versions against the
unchanged lock and refuse a mismatching cache; no dependency installation is part
of this correction.
