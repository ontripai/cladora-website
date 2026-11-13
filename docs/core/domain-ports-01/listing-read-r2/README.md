# Listing independent read selector and C03 port / R2

Official AIRPROP sourcedc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0 was fetched and
its docs/airprop/AIRPROP-LISTING-NATIVE-01-core-port-request.json read. No AIRPROP
file, publication lifecycle or selected-binding storage was copied/edited.
Native activation remains NULL/NOT_RUN_NOT_PASS; full canonical producer is open.

## Additive read ABI (not a command receipt)

- src/lib/core/airprop-read-host-v1.ts:
  checkpointCoreAirpropReadScopeV1(actualScope) -> opaque CoreAirpropReadObservationV1;
  inspectCoreAirpropReadObservationV1(actualScope, exactToken) -> current private
  actor/tenant/member/Context/Workspace/epoch/backend/DBtx/clock/expiry metadata or null.
- src/lib/core/current-unit-property-read-selector-v1.ts:
  selectCurrentUnitPropertyForReadV1(actualScope, {property_id,unit_id,expected_resource_version?}).
- src/lib/core/airprop-read-selector-queries-v1.ts: three exact admitted query
  texts and typed same-tenant/Workspace/Context parameters. No arbitrary SELECT,
  GUC, transaction control, table name, permission or purpose parameter.

Use inside the actual existing createCoreAirpropReadHostV1.withScope callback.
The read host fixes airprop.asset.read/airprop_commercial. Its private checkpoint
records airprop.portfolio.read, verifies canonical session/permission/scope/epoch,
backend and DBtx after source waits, and returns only host-issued token identity.
JSON/copy/fake scope/other attempt is not recognized. Any next scope query,
pending/error/checkpoint, callback end or settlement invalidates prior observation.
C03/command_id/command_aggregate receipt is never created for this GET.

The host now reuses the existing C01 app_private.lock_core_request_session_v1()
after trusted claims and before authority epoch/source locks. Missing helper,
role EXECUTE or actual compatibility fails closed. Platform must inspect that
existing helper and role profile, not reassign its shared owner or assume this
call alone proves all managed-session writers participate. Existing final guard,
positive COMMIT + same-backend DB completion, cleanup, exact40001 and UNKNOWN
rules remain. No output is released by withScope on a failed settlement/clock.

Active binding candidates are locked before temporal filtering, capped at100 with overflow detection. Historical expired rows do not create false current ambiguity; malformed active candidates fail closed.

Selector lock order is host session -> authority epoch -> canonical scope locks,
then explicit workspace-property binding -> Unit/building/property/Context ancestry
-> actual latest unit_specification_versions row -> final host checkpoint.
Predicates follow the accepted command selector's scope and ancestry rules; the
command selector remains byte-identical. Source Unit writer locks property before
revising Unit/spec. Competing lock order/native40001/deadlock and all writer/session
participation still need the Platform native lane; no lock-free-currentness claim.

Selector result:
- selected: actual explicit Unit/Property/building/spec UUID/version and bound
  server scope, evaluated_at and scope_and_binding_until (only those covered inputs);
- withheld: foreign, inactive, missing/ambiguous binding or invalid ancestry;
- stale: expected spec version differs;
- not_ready: no real specification row, no fallback version1.

Source times are DB-rendered UTC with six fractional digits; start inclusive/end
exclusive is checked against the fresh final checkpoint after actual waits, without
Date.parse/Date.now rounding. scope_and_binding_until is NOT full canonical
current_until: Party/relationship/entitlement temporal bounds are not invented.
canonical_companion remains NULL, action_authorization=not_evaluated,
reusable_as_command_authority=false. No safe label/Party/relationship is guessed.
This independently closes the read-compatible selector part; AIRPROP must adapt
its old command-receipt bindSelector callsite. Its full readCanonical mapping stays
NOT_READY until a real permitted versioned Party/relationship source is selected.

## Exact request-local command port

src/lib/core/listing-command-binding-v1.ts exports createCoreListingCommandBindingV1.
Bind(originalRequest) uses the existing Core C01 authenticate/target/ordinary pool.
resolveIdentity({context_id,workspace_id}) resolves server actor/tenant/member and
current revision with reusable_as_authority=false. The exact profile is
`airprop.opportunity.manage / airprop_commercial / airprop.b2`, AAL2.
Read authority, Offering/Guide profile, availability or a JSON allow cannot become
this command authority.

Its `.host.execute(originalCommandV1orV2, matchingTrustedAIRPROPProviders)` forwards the exact
original IDs/key/body/hash/epoch to the existing C03 runtime host; no new store,
reservation engine, domain provider, retry loop or effect is created. The original
Request cannot change Context/Workspace inside that instance. Replaying an old
command on a new request does not require minting a new identity or replacing its
command. C03 reauthenticates/revalidates on each attempt and exact replay.

The controlled host wiring test uses a clearly test-only provider and proves
Core C03/receipt/replay plumbing, NOT an AIRPROP writer/lifecycle. AIRPROP still
owns publication/control adapters and selected Resource/Party/relationship/spec
binding persisted in the SAME C03 transaction. No Opportunity revision is invented.
Do not activate a domain bridge until those actual canonical/provider checks exist.

## Discovery and canonical evidence: exact remaining work

The existing DW02 resolver only accepts core.units.identity.read /
core.unit_identity.history; relabeling it as AIRPROP is forbidden. PF01 is an
owner-link family, not universal management/representation. This delivery does
not create a parallel relationship registry or pick the first Party/Unit.

Core must next select the applicable REAL versioned relationship family, or
propose the minimal missing version source with owner decision, before returning
named Resource/Party options or a mapAirpropCoreCompanionV1 positive. Discovery
requires exact current relation id/version/party/kind/scope/currentness under this
read profile, keyset order/cursor/limit<=100, and final recheck after waits. Denied
or unversioned families stay unavailable; owner/manager/representative cannot be
substituted by raw ownership rows without the corresponding canonical contract.

## Installation / independent proof

Platform must attest target/build/profile, bounded PG17 pool and physical role,
canonical session/epoch/scope/evaluator helpers, and exact limited SELECT and
row-lock rights for workspace_property_bindings, Context/member/Workspace,
portfolio.properties/buildings/units/unit_specification_versions. FOR SHARE needs
narrow UPDATE privilege and safe RLS lock policies where appropriate; no grant is
inferred or added here. Shared helper definition/owner/ACL stays unchanged pending
actual compatibility evidence. No S01/Guide/Storage dependency is introduced.

11 new actual-host/selector controlled groups and8 actual-Core identity/C03-profile
groups passed. The existing47 host controls were rerun because its actual session
prerequisite/query admission/checkpoint lifecycle changed; only its fixture gained
the exact new session-call response, security assertions were not weakened. No old
consumer/source output is relabeled as full canonical readiness. Native PG/Auth/
RLS/concurrency/restart/UI, discovery and Listing lifecycle remain NOT_RUN_NOT_PASS.

Automation: نیازمند بررسی — exact query admission/token identity/negative cases
are mechanical; canonical source-family selection, Platform target/capacity and
Coordinator/QA acceptance remain explicit human/owner decisions.

Concrete source limitation for the next canonical increment: portfolio.ownerships
has no stored relationship version in its canonical table definition; PF01
20261019193000 projects literal relationship_version=1 (line185). That historical
contract is preserved, not repurposed as a live AIRPROP version. A minimum future
Core-owned additive version/writer-invalidation contract on the existing canonical
source must be reviewed before positive discovery; do not invent a version from
created_at/hash, backfill a Listing selection, or create another ownership registry.
Ownership/management/representation families remain separately scoped.

Exact successor coupling and owner mutator boundary: ../successor-coupling-r2/README.md.
Opaque checkpoint queries are tracked through callback end; an unawaited checkpoint
cannot mint a token after callback end or permit settlement/output.
