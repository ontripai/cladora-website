# AIRPROP-LISTING-NATIVE-01 — R1, OPEN until connected persistence

Official shared main: 6cecfa15b00f445be68817e756d766fb0e6fe026 (PR478 merged).
Assigned temporary branch: codex/airprop-listing-native-01.
Separate worktree; historical branch and checkpoint c8466550e97e07f1e39084b1a66ef9f292507ba5
retained unchanged. The seven-path pending-recovery delta was compared to main;
its affected preimages matched and full patch check/apply was clean. Other owners'
source is not restored/replaced. No reset/rebase/force/history rewrite.

## Executable independent domain work

prepareListingPublicationV1 in src/lib/airprop/listing-publication-v1.ts validates
a strict publication intent and maps it to the EXISTING parameterized native
publish_airprop_listing_v1 call. It retains original wire/key, full selected
resource/party/relationship/version and timestamp precision. Exact routing
Context/Workspace, Property and Unit must match; no first Unit/Party or property
substitution. It rejects nonpublication actions and claimed actor/allow fields.
The existing precise instant parser is reused for date bounds without changing
that module or a codec. No valuation/Finance prerequisite, C03 engine, receipt,
canonical identity or new key is manufactured.

This pure plan is explicitly CURRENT_CORE_SOURCE_VALIDATION_REQUIRED. It does
not execute SQL and is not accepted by the current control-only HTTP endpoint.
Creation API/picker and real consumer remain OPEN until the actual Core Listing
scope/evidence/admission is delivered. A valid client selection is not authority.

The existing pending journal is reused and strengthened in this checkpoint;
its seven-path source and historical evidence remain attributed to recovery07,
not native Listing or Request acceptance. Browser remains BLOCKED_TOOL until an
actual admitted Chromium execution. The six closed sizing cases and historical
Request acceptance/failures/UNKNOWN are not replayed/reclassified.

## Exact missing port — one handoff

See AIRPROP-LISTING-NATIVE-01-core-port-request.json for filenames, symbols,
actual versus requested signatures, input/output, exact SQL admission and owner
split. Proposed names are NOT approved Core ABI. Core4d15a377 Offering identity
is not silently used for Listing. Existing auth/C03 host is reused; Core supplies
read-compatible Unit selector/evidence and Listing identity/currentness scope.
AIRPROP owns canonical producer composition and domain publish/lifecycle providers.
Platform owns role/schema/target/capacity/QA runtime and browser execution path.
Ports can be delivered incrementally; Listing does not wait for valuation or
all Offering/Quote/Guide/custody ports.

Two source facts must not be hidden:
- Existing market_listings lacks the selected Party/relationship/spec snapshot.
  The domain must persist exact selected REFERENCE binding atomically with native
  publication in C03, not invent an ownership registry or guess a legacy Party.
- Existing Opportunity has no revision column. Native publication checks its
  tenant/Workspace/property binding; do not invent a version or monetary fallback.

Selected-tuple persistence successor is now implemented in
`listing-selected-binding-v1.ts` with inactive candidate storage, exact existing
Core mutate-port consumption and targeted controlled tests. See
`AIRPROP-LISTING-SELECTED-BINDING-01.md`. This closes the absent domain storage
SOURCE implementation, not its adoption/runtime gate. The candidate requires a
real spec row, keeps immutable per-Listing-version reference history, and defers
receipt linkage to the actual existing C03 ledger/audit/outbox at settlement.
No historical Party/spec backfill or active route binding is inferred.

## Commands and evidence limits

`node scripts/test-airprop-listing-publication-v1.mjs` — new pure intent/native
parameter preparation cases, not SQL/authority/DB or live picker proof.
`node scripts/test-airprop-listing-pending-recovery-07.mjs` — inherited focused
controlled recovery checks; prior results retained, not rerun merely for rebase.
Typecheck/scoped lint/diff/inventory are source checks, not connected acceptance.

No truthful connected run command exists yet: current runtime is fail-closed and
starting Next alone is not native acceptance. After official port/profile delivery,
verify target and compose existing host/selector/provider, then run the actual
UI->API->DB lifecycle and restart/concurrency/revoke matrix with Platform. Card
stays OPEN through independent Procedure/Coordinator acceptance.

Automation: نیازمند بررسی — bounded validation/custody checks are mechanical;
current authority, execution admission and explicit user actions remain required.
Value is durable same-id recovery with no duplicate effect, not yet measured.

## Continuation from f72f168 — native lifecycle parameter preparation

`src/lib/airprop/listing-control-plan-v1.ts:prepareListingControlV1` consumes the
EXISTING Listing control envelope and returns the exact fixed native invocation
for edit, withdraw or republish. The native signature/argument order comes from
`supabase/migrations/20261008135433_airprop_listing_controls_v1.sql`, not a new
endpoint or persistence API. Withdrawal supplies NULL date arguments as required
by that function; the existing writer retains the stored dates. The original
wire/key/expected version and complete explicit source/Party/relationship selection
remain available for the C03 provider's fingerprint, authorization and replay.
No current GET/version substitutes for the original uncertain command.

This module performs NO SQL and returns no receipt or authorized capability.
Its status remains CURRENT_CORE_SOURCE_VALIDATION_REQUIRED. The native function
checks property permission and its own revision ledger, but that alone does not
prove the full selected canonical Party/relationship/resource tuple or real Core
commit. The production route resolver remains fail-closed. No callback placeholder,
memory Map, new journal or default-null factory is presented as native storage.

Offline test: `node scripts/test-airprop-listing-control-plan-v1.mjs` (9 groups).
Checks cover all three exact native mappings, routing scope/resource mismatch,
missing tuple/version, stable retry, microsecond/calendar validation, native int4
successor bound, malformed/oversized input and attempted authority injection.
These tests execute real domain preparation only, not C03/SQL/DB/Auth/revocation.
The existing accepted lifecycle/affordance/browser suites were not replayed.

Latest observed Core branch62f3c4ea3280821d3df69cd5d0cfbd10fbf6cb6d adds Guide
request binding over Offering4d15; its changed-path inventory contains no Listing
producer. Neither is imported or relabelled as Listing authority. No Guide source
is modified and Listing does not wait for Guide completion.

Platform consumes the published exact AIRPROP branch/commit, integrates the actual
Listing-specific Core delivery when available, and supplies its owned role/target
and browser execution path. Current local Chromium limitation remains
BLOCKED_TOOL (setsockopt EPERM); this continuation does not retry that launch or
claim real browser evidence. Native creation/selection/atomic binding and durable
same-ID readback remain OPEN, with exact requirements in the adjacent port request.
