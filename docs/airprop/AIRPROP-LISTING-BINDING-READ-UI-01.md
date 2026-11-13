# Listing binding read → API → UI

Same card AIRPROP-LISTING-NATIVE-01. Parent dc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0.
The tuple mutation module and guarded SQL proposal are byte-unchanged.

## Executable gap closed

The previous read mapper could project allowed management actions without checking
the stored selected tuple. A predecessor-source counterexample reproduces this
affordance. This is NOT a native permission bypass: default runtime remains
inactive and POST authority remains independently enforced.

The actual Listing GET's read mapper now requires exact persisted selection and
spec version before projecting any action. It carries only a bounded public
binding_state to the real CustomerAirpropListings component:

| State | Read/UI | Actions |
| --- | --- | --- |
| bound | Saved tuple matches exact current authorized selection/version/spec | Only independently authorized per-action evidence may allow |
| legacy | Explicit successful storage read found no record | Unavailable, no historical Party/spec inference |
| stale | Same scoped Listing record differs in version/resource/Party/relationship/spec | Unavailable; input kept and review message shown |
| invalid | Corrupt/foreign binding metadata | Unavailable, no private binding values displayed |
| unavailable | Binding storage connection not admitted/configured | Unavailable; existing authorized read preserved |

Missing old-server metadata defaults to unavailable. Read or binding does not
confer manage rights. Denied/missing canonical action projection remains denied/
unavailable even for bound rows. RO/EN/FA explain the difference and display the
CURRENT authorized relationship, not a fabricated historical owner. Invalid
selector values cannot transfer an old selection; no selection/navigation POST.
Sizing, full names, RTL, existing Context/draft guards and command payload/key/
fingerprint/journal format remain unchanged.

Dirty input survives a refresh to stale binding. UNKNOWN is not cleared by GET,
including missing historical binding; unsafe retry stays disabled. After a valid
bound higher-version read, only explicit original-wire retry is allowed under
the existing exact-selection checks. A GET is never a command receipt.

## Concrete route/provider connection

`createListingNativeReadV1(host, canonical, selectedBindingRead)` reads the actual
domain binding through the SAME supplied SQL scope, initially and at final row
collection. The implemented `readListingSelectedBindingV1` is the storage reader;
no Map or replacement persistence is used. Only minimal scoped selection/spec
metadata reaches the mapper; command/actor/audit/private provenance does not
reach the public Listing view.

`createListingRequestRuntimeResolverV1` consumes optional
`ListingFunctionalDependenciesV1.selectedBindingRead`. Actual Listing GET already
calls this resolver and `readListingFlow`; this child changes that executable
chain, not a disconnected helper. Optional canonical per-action projections pass
through the same accepted mapper; they are never inferred from read disclosure.

No table probe occurs when the binding reader is not admitted. PostgreSQL errors
from a configured reader, including40001, propagate and discard the transaction;
catching42P01/42501 and continuing a broken transaction is NOT a read fallback.
Successfully returned corrupt metadata blocks only that row's actions.

## Exact remaining integration, not a universal pause

Core: admit the literal LISTING_SELECTED_BINDING_READ_SQL hash recorded in the
adjacent core-port-request JSON only after actual table/role review. The current
read host's page/clock allowlist is not silently expanded. Deliver the Listing
read-compatible selector/current canonical evidence and request-local command
identity. Optional action evidence must use current per-action manage authority.

Core + AIRPROP: confirm Unit aggregate, exact provider-source ids and original
wire fingerprint mapping already stated in the persistence handoff. Existing
Core provider_current_state_required/validateReplay is the port; the actual
Listing producer's live revalidation/lock/expiry evidence is missing. It cannot
be substituted with an allow boolean or GET-derived receipt. This child makes
no claim that the mapping/ABI or replay hook was independently accepted.

Platform: adopt the reviewed storage separately with exact limited roles/RLS/
ACL and SQL admission; the55000 proposal is NOT installed. After its own actual
admission, provide readListingSelectedBindingV1 to the resolver. Then one real
UI/API/DB lifecycle/reload/restart/replay run on its owned target, reviewed by QA.
This chat's Chromium remains BLOCKED_TOOL/setsockopt EPERM; no bypass/retry here.

Default request-runtime dependency resolution still returns null: there is no
delivered official Listing producer/target to activate. The source chain above
is exercised with controlled dependencies, not described as an active native
deployment. Guide/Offering ports are not relabelled as Listing authority.

## Evidence actually run

`node scripts/test-airprop-listing-binding-read-ui-v1.mjs --only source`
`node scripts/test-airprop-listing-binding-read-ui-v1.mjs --only native`
`node scripts/test-airprop-listing-binding-read-ui-v1.mjs --only mounted`

Evidence was established across targeted runs:6 source/API groups,6 actual
native-reader/provider composition groups with controlled SQL,17 mounted groups
(RO/EN/FA×5 states, dirty-input refresh, UNKNOWN/retry), plus1 actual predecessor
mapper counterexample. The accepted native-read fixture SETUP is reused without
running its prior cases. Initial test setup mistakes were fixed in the new test
only; no product guard/test assertion weakened.

No accepted52/105cases/six sizing cases or unrelated successful suite replay.
Cache versions are Next16.3.8/Zod4.4.3; exact-target and PostgreSQL/Auth/RLS/
browser/restart evidence remain NOT_RUN_NOT_PASS. No SQL, installation, backfill,
Core/shared/Guide/Finance/config/lock changes or activation.

Automation: نیازمند بررسی; tuple/projection consistency is mechanical, while
canonical authority, adoption and explicit retry/QA decisions retain their owners.
