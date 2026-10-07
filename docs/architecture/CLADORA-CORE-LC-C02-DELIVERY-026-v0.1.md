# Core LC-C02 delivery 026 v0.1

Date: 2026-10-06 UTC. Repository: `ontripai/cladora-website`. Production database: `jyomlehahwlyqzoacrvp`.

## Verified implementation

| Contract | Evidence | State |
| --- | --- | --- |
| Stable canonical unit UUID and private immutable specification versions | PR #280; migration `20261006060827`; pgTAP `156` | In production |
| Private immutable split/merge graph, subject and cycle guard | PR #281; migration `20261006064156`; pgTAP `157` | In production |
| One predecessor and one successor transition per unit | PR #282; migration `20261006065116`; pgTAP `158` | In production |
| Synthetic two planned unit T01 identity, revision, split and historical ownership reference isolation | PR #284; pgTAP `159` | CI verified; no production fixture |
| Authorized exact property specification revision with version conflict and revocation | PR #285; migration `20261006071524`; pgTAP `160` | In production |
| Authorized exact property split/merge event with revocation and graph guards | PR #286; migration `20261006072700`; pgTAP `161` | In production |
| Originating workspace on new customer-command evidence; old unattributed history stays private | PR #289; migration `20261006073930`; pgTAP `160`, `161` | In production |
| Workspace-scoped private history read, separate permission, live mandate and revocation | PR #290; migration `20261006074812`; pgTAP `162` | In production |
| Customer API for scoped history and the two record commands | PR #293; application CI run `37432682252` | In production |
| Idempotent request-keyed specification and lineage commands, with live authority recheck on replay | PR #295; migration `20261006081535`; pgTAP `163` | In production |

The Database tests and AIRPROP scope regression checks passed on the final PR #290 head `ec85cb3abdb338d8612c31d238ef9bb5cf069367`. Squash merge `e4eb6a176d49a23ff97e7cb4b5ff5fbb670ba93b` deployed READY to Vercel Production (`dpl_Ei76ZsNuyvx4aDbsDgPMgQqndo5D`). The production catalog confirms both write commands and the read command exist, `authenticated` has RPC execution, `service_role` has none for these customer commands, and both private evidence tables contain zero rows. No `core_unit_identity` workspace module is active. The three most recent Core migrations were independently found in remote migration history; test fixtures roll back.

## Limits and next gates

This completes a **Core backend slice** of LC-C02 and synthetic T01 identity behavior. It does not constitute acceptance of T01 across AIRPROP presale screens, SERVICE eligibility, or the complete T01–T10 lifecycle. There is a customer HTTP route for these RPCs, but no customer UI, real pilot property authority evidence, production role assignment or module activation, or real end-to-end four-account rehearsal. Do not infer a customer's right from a canonical unit UUID or the mandate ID alone.

Before a live pilot, bind a concrete canonical property and actual evidence to a property-operations mandate, activate the module only for the intended workspace, assign the three distinct rights to appropriate roles, review a customer gateway and UI, and exercise the flow with authorized accounts. AIRPROP and SERVICE must separately verify their references, stage transitions, and record visibility against this Core contract. LC-C03 temporal relationship/access transfer and T08 multi-workspace effects remain separate work.

The read RPC intentionally returns only snapshots and lineage attributed to the current workspace; private internal records with NULL origin and other workspace records stay hidden. It does not change a unit's current code, status, ownership or historical relationships.

## API follow-up (2026-10-06 UTC)

PR #293 squash merge `857486875e84de8a69e785083a354b94ed356e9a` passed Application Foundation CI, typecheck, lint and Vercel Preview build. The same SHA is READY in Vercel Production (`dpl_4NnLMGyCXCFRYtC4UYeULv85cV3Q`). The API route is `src/app/api/customer/v1/core/unit-identity/route.ts`. It does not bypass the database's mandate, module and permission gates.

A live HTTP request was not completed: the cloud browser was blocked by its client and the Vercel fetch tool was rejected by automatic approval review because it could create a temporary deployment-protection bypass link. No alternative bypass was attempted. A read-only production query confirmed zero active property-operations mandates, zero active Core identity modules and zero snapshot/lineage rows. Therefore this is not a real-account pilot or a customer-visible workflow acceptance. A concrete pilot property, authority evidence and authorized actor/workspace are required before activation and end-to-end verification.

## Idempotency follow-up (2026-10-06 UTC)

PR #295 squash merge `f4ca08782dda3b39b163547958d10b56ea057bf5` passed Database tests, AIRPROP scope regression and Application Foundation CI. Vercel Production reports READY for that SHA (`dpl_qC4AZByjEtsU3UsW7LQVzEvGxXDQ`). Supabase recorded `lifecycle_core_identity_idempotency` as version `20261006081535` (source file `20261006080800_lifecycle_core_identity_idempotency.sql`). The customer POST route now requires a UUID `request_id` and a bounded `idempotency_key`; exact retries replay the prior response, changed payloads conflict, and a revoked property mandate or permission blocks replay. Direct authenticated execution of the previous v1 write RPCs is revoked. The production catalog confirms authenticated execution on both v2 RPCs and no active property-operations mandate or Core identity module. This does not establish a live HTTP or four-account pilot.
