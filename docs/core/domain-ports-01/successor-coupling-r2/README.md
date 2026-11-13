# CORE-DOMAIN-PORTS-01 — exact successor coupling / R2

Parent: 62f3c4ea3280821d3df69cd5d0cfbd10fbf6cb6d. Main reference:
6cecfa15b00f445be68817e756d766fb0e6fe026. Independent source increment;
no owner source, SQL schema, ACL, target fixture, activation or domain logic changed.

## Consumer identities and transfer

AIRPROP: dc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0, fetched Git object.
SERVICE: cf3d1e3349298c4cc4cf8f6f771c78179cc2bc52, imported bundle objects.
The latter is NOT asserted to be a published commit. Official bundle blob:
953d66532c652a155a27e705137de67e046a2b38, 26321 bytes,
SHA256 8b1dc6a1cd3ecee9f6467dc362b8163ff5cc36c28e9ce69e8c96de2332a1542c.
Its prerequisite is 93025127da3de7f151347cf2377f10907847f1ed, already imported
from its official bundle. Original files and worktree were not overwritten.
`git bundle verify` succeeded. Tests load real modules transitively from these
Git objects. No owner implementation is copied into Core.

## Ports and exact authority profiles

| Consumer seam | Core export/path | Exact profile | Delivered boundary |
| --- | --- | --- | --- |
| Offering authoring identity | createCoreServiceAuthoringIdentityPortV1, src/lib/core/service-authoring-identity-port-v1.ts (accepted unchanged) | services.catalog.manage or services.catalog.publish / services_catalog; publish is separate | Actual SERVICE composer prepares create/publish using canonical server actor/tuple/epoch; no allow or receipt |
| Offering definitions | createCoreServiceOfferingReadBindingV1, src/lib/core/service-offering-read-binding-v1.ts | services.catalog.manage / services_catalog | Only optional readDefinitions; exact canonical RPC fields, rollback/clock/cleanup before return |
| Quote identity + C03 | createCoreServiceQuoteCommandBindingV1, src/lib/core/service-quote-command-binding-v1.ts | services.quotes.manage / services_orders / service.create_quote, AAL2 | bind(original Request), resolveIdentity({context_id,workspace_id}), host.execute(original V2 command, trusted SERVICE V2 providers) |
| Listing read selector | selectCurrentUnitPropertyForReadV1, src/lib/core/current-unit-property-read-selector-v1.ts | airprop.asset.read / airprop_commercial / airprop.portfolio.read | Explicit Unit/Property/spec, genuine same-live-scope opaque checkpoints; no GET command receipt |
| Listing command | createCoreListingCommandBindingV1, src/lib/core/listing-command-binding-v1.ts | airprop.opportunity.manage / airprop_commercial / airprop.b2, AAL2 | Canonical V1 or V2 C03 execute without command rewriting; owner mutator remains owner code |

Quote identity output deliberately adapts the canonical Core identity literal to
SERVICE's `service-quote-command-identity.v1`; server actor/tenant/member/Context/
Workspace/revision/times are untouched. `action_authorization=not_evaluated` and
`reusable_as_authority=false`. It is preparation data; fresh/replay C03 authority
is still evaluated by the existing canonical host, after waits. Abort, concurrent
use and changing Context/Workspace on the same bound instance fail closed.
Quote wire/hash/key/provider evidence and receipt projection belong to SERVICE.
No Quote read/create registration or positive S01 is fabricated.

Listing V1 compatibility is needed because the actual owner mutator accepts
CoreTransactionProvidersV1['mutate']. V2 remains supported with its existing
subject/evidence/replay semantics. Host command schemas and actual runtime remain
the same; no downconversion, generated receipt or boolean command proof.

## Controlled coupling evidence

`node scripts/test-core-domain-successor-coupling-r2.mjs`: 9 new groups.
Actual Core C01 identity -> actual SERVICE Offering composer (create and publish);
actual Quote schema accepts the exact Core identity; actual Quote provider on C03
rejects missing authoring disclosure, rolling back without domain writes. Tests
check cross-profile rejection, AAL/current authority/scope and exact40001 identity.
Actual AIRPROP mutator loads unchanged. A mismatched command fails before SQL;
its genuine V1 path through Core C03 reaches the missing canonical source and
rolls back. The test-only validateProviders entry in that one negative does NOT
represent an approved production provider, disclosure, native mutation or grant.

Separately: 6 definitions groups, 11 selector groups, 8 command-profile groups.
The 47 existing read-host cases are affected by session prerequisite/admission/
opaque-checkpoint lifetime changes and were run for that reason; assertions were
not removed. No unrelated accepted Request/CE/Contact suite is repeated.
Full ES5 typecheck, limited lint, JS syntax and diff checks are reported separately.
All PG/Auth transports here are controlled. SQL parse/compile/execute, native
concurrency/restart/UI/currentness/installation: NOT_RUN_NOT_PASS; target calls=0.

## Concrete remaining closure (no permission substitution)

| Gap | Source evidence | Owner and minimum next closure |
| --- | --- | --- |
| Authoring S01 disclosure | Core functional-producers-v1.ts builds request-only Offering policy; service-s01/offering-disclosure-policy-v1.ts accepts published non-reservation service.request.create/services.orders.request | Core + SERVICE/Coordinator: define and accept distinct current provider-agreement disclosure binding for service.offering.create/transitions and service.quote.create under exact manage/publish/quote profile, without requiring the draft to be published. Then install/verify narrow source access and couple actual readers. Existing Request policy remains unchanged. |
| Quote source installation | SERVICE service-quote-postgres-adapter-v1.ts reads membership_parties.valid_from/valid_until; canonical migration 20260829005200_customer_occupancy_parties_ownership_lease_registry.sql adds them to the earlier table | Platform: attest effective installed definition and owner/ACL/RLS; do not infer absence from first CREATE TABLE or replay all migrations. These columns are canonical, not a new finding. |
| Listing complete Party/relationship/discovery | portfolio.ownerships canonical source has no stored revision. PF01 owner-family projection emits relationship_version=1; DW02 accepts only core.units.identity.read/core.unit_identity.history | Core: version the actual canonical relationship writer/source with invalidation and scope rules (no parallel registry); Coordinator must select allowed ownership/management/representation families and disclosure. Do not treat PF01 literal version or read-only owner family as Listing manage proof. Until then no positive companion, Party discovery or full current_until. |
| Listing selected binding install | AIRPROP owns supabase/proposals/airprop_listing_selected_bindings_v1.sql and its real mutator; exact canonical callback remains open | AIRPROP + Core: wire official same-C03 canonical producer with real spec/relationship identity, current checks after waits and actual same-transaction selected binding. Platform reviews target-specific adoption/ACL/constraints before activation. |
| Guide target reconciliation | Exact two shared helper definitions/owner/ACL and missing-object names not yet delivered to this workspace | Platform observation file, then Core target-specific closure. Local UNIT20 draft does not substitute for a full installer. Adapter a42d978... is reported, not fetched/accepted as available code. |

No Offering permission grants Listing, Guide or Quote. Published Request policy
and accepted historical evidence remain fixed. These independent ports need not
wait for Guide, S01 authoring approval or Storage; only their uncovered binding
stays NOT_READY. Native activation remains NULL.

Automation: نیازمند بررسی — exact source pins/schema/profile checks can be mechanized;
Core/domain owners decide source semantics, Platform admits target/role/installation,
and Coordinator/QA accepts evidence. No automatic execution is authorized.
