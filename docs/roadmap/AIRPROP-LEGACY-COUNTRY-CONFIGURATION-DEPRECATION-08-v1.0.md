# AIRPROP legacy country configuration deprecation 08

Status: **`deprecation_plan_defined_no_runtime_change`**.

Baseline: live `main@75b7a2e3ba4c548f9a86bf52d9651de1e5e5d9d1`, tree
`e258b99e2ed5d63c2ede86d086e05eec45edc746`.

This package defines a controlled retirement plan for the legacy `AIRPROP-RO`
configuration and `RO` opportunity restriction. It adds documentation and a
static harness only. It does not remove or change a function, caller, route,
contract, database object, grant, Country Pack, registry or runtime behavior.

## Effective definitions

Migration filename order determines the effective SQL body.

| Surface | Definition history | Effective behavior |
| --- | --- | --- |
| `customer_api.configure_airprop_property_v1` | Defined once at `supabase/migrations/20260914144417_airprop_core_foundation.sql:320-322` | Live security-invoker wrapper. Its optional arguments default to `AIRPROP-RO`/`1.0` and dispatch at execution time to the current internal function. |
| `app_private.configure_airprop_property_internal_v1` | Original body at `20260914144417_airprop_core_foundation.sql:286-309`; exact-signature replacement at `20261003151604_20261003083859_workspace_scoped_effective_permission.sql:292-315` | The replacement is effective. It authorizes current Workspace/Property scope, accepts only `AIRPROP-RO`/`1.0`, inserts a Property interest plus operating-model row and records `AIRPROP_PROPERTY_CONFIGURED`. |
| `customer_api.create_airprop_opportunity_v1` | Wrapper defined once at `20260914144417_airprop_core_foundation.sql:314-316`; its internal body is replaced at `20261003151604_20261003083859_workspace_scoped_effective_permission.sql:230-257` | The replacement internal body is effective. It accepts only opportunity country `RO`, persists trusted Workspace identity for new rows and reauthorizes retries. |
| `customer_api.create_airprop_opportunity_v2` | Defined once at `20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql:22-105` | Live Workspace-native writer. It requires literal `RO`, writes the shared opportunity store, uses the `airprop.opportunity.create.v2/` idempotency namespace, and records audit/outbox evidence. |
| `customer_api.list_airprop_opportunities_v2` | Defined in the same migration at `:107-127` | Live read companion for v2; it returns the stored opportunity country and does not resolve Property address country or a Country Pack. |

The old internal v1 bodies remain immutable migration history and are
superseded, not parallel runtime definitions. The public v1 wrappers remain
callable because PostgreSQL resolves their internal function calls to the later
exact-signature replacements.

## Caller inventory

### Property configuration v1

There is no TypeScript product route, server action, UI or import caller for
`configure_airprop_property_v1` on this baseline. The live RPC is still granted
to `authenticated`, so absence of an in-repository product caller is not proof
that the API can be removed.

| Caller class | Exact paths | Treatment |
| --- | --- | --- |
| SQL gateway | `supabase/migrations/20260914144417_airprop_core_foundation.sql` | Live legacy entry point and wrapper only. |
| Runtime pgTAP callers | `supabase/tests/086_airprop_core_foundation.test.sql`, `133_airprop_workspace_module_gate.test.sql`, `134_airprop_read_core_authorization.test.sql` | Synthetic authorization, idempotency/conflict and fail-closed evidence. |
| Static contract readers | `scripts/test-airprop-legacy-country-defaults-audit-07.mjs`, `scripts/test-airprop-multi-country-address-entry-contract-06.mjs` | Read source text; they do not invoke the RPC. |

### Opportunity v1

No TypeScript product route calls `create_airprop_opportunity_v1`. Its direct
callers are the synthetic pgTAP fixtures
`supabase/tests/086_airprop_core_foundation.test.sql` and
`supabase/tests/134_airprop_read_core_authorization.test.sql`. The foundation
migration supplies the live wrapper. These callers exercise exact retry,
authorization revocation and Workspace rebinding denial; they are not evidence
that `RO` is address authority.

### Opportunity v2

The live product chain is:

```text
src/app/[lang]/app/airprop/page.tsx
  -> src/components/customer/CustomerAirpropWorkspace.tsx
  -> src/lib/airprop/opportunity-contract-v2.ts
  -> src/app/api/customer/v2/airprop/opportunities/route.ts
  -> customer_api.create_airprop_opportunity_v2 / list_airprop_opportunities_v2
```

The UI inserts `country_code: 'RO'`; the contract requires `z.literal("RO")`;
the route forwards the validated payload; and the effective SQL independently
requires and stores `RO`. `src/lib/airprop/opportunity-idempotency-v2.ts`
describes the same canonical payload and namespace but currently has no product
caller; it is exercised by `scripts/test-airprop-opportunity-contract-v2.mjs`.

Direct source/fixture references to the v2 writer are frozen by the static
harness:

| Caller class | Exact paths |
| --- | --- |
| Product RPC caller | `src/app/api/customer/v2/airprop/opportunities/route.ts` |
| Runtime Node SQL callers | `scripts/test-airprop-acquisition-runtime-013.mjs`, `test-airprop-diligence-runtime-011.mjs`, `test-airprop-diligence-runtime-012.mjs`, `test-airprop-native-runtime-004.mjs`, `test-airprop-underwriting-runtime-007.mjs`, `test-workspace-role-assignment-runtime.mjs` |
| Route contract caller | `scripts/test-airprop-native-route-004.mjs` |
| pgTAP SQL callers | `supabase/tests/135_workspace_role_assignment_airprop_flow.test.sql`, `146_airprop_diligence_drafts.test.sql`, `149_airprop_diligence_review.test.sql`, `151_airprop_acquisition_decision.test.sql`, `170_workspace_role_handover.test.sql` |
| Static definition reader | `scripts/test-airprop-legacy-country-defaults-audit-07.mjs` |
| SQL definition | `supabase/migrations/20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql` |

UI/contract tests that transitively exercise the product chain are
`scripts/test-airprop-native-ui-004.mjs`,
`scripts/test-airprop-underwriting-ui-008.mjs` and
`scripts/test-airprop-opportunity-contract-v2.mjs`; the multi-country readiness
and entry-contract harnesses inspect the same country boundary. Downstream
underwriting, diligence and acquisition flows consume the persisted
`opportunity_id`; their historical references must survive retirement of the
creator endpoint.

## Historical evidence that must remain immutable

Retirement removes future dependence on legacy constants. It does not translate,
repair or relabel existing evidence.

| Evidence | Immutable meaning | Allowed forward lifecycle |
| --- | --- | --- |
| `airprop.investment_opportunities` created by v1/v2 | Original `tenant_id`, resolved `workspace_id` when present, `property_id`, idempotency key/namespace, normalized request fields, stored `country_code`, `input_hash`, creator and creation time | Existing lifecycle may advance `status` under its own contract. Country, scope, request identity and creation evidence are never rewritten to look canonical. Historical NULL `workspace_id` remains unresolved. |
| v1 `AIRPROP_OPPORTUNITY_CREATED` audit event | Exact actor/role, entity, after-snapshot and the legacy reason recorded at creation | Append later events; never edit or replace the creation event. |
| v2 audit/outbox creation evidence | Original opportunity/workspace identifiers, event type/version and emitted payload | Delivery state may follow the outbox contract; event identity and payload are not rewritten. |
| v2 `platform.idempotency_keys` record | Exact actor, namespaced key, request hash, response and status while retained | It may expire under the existing 30-day policy. The namespace is never reused for a new contract, and the durable opportunity row remains the retry fallback. |
| `airprop.property_interests` produced by configuration v1 | Original Property, party, kind, share, `valid_from`, creator and creation time | A separately authorized temporal successor may close applicability forward; it must not rewrite the historical interest. |
| `airprop.property_operating_models` produced by configuration v1 | Original Property, model, `AIRPROP-RO`, `1.0`, `valid_from`, creator and creation time | A later version may supersede/close the interval. The legacy code/version, model and start identity stay unchanged. |
| `AIRPROP_PROPERTY_CONFIGURED` audit event | The exact legacy interest/model/pack snapshot and Romania-evidence reason | Append successor evidence; never claim the event came from the canonical registry or resolver. |
| Underwriting, diligence and acquisition records keyed to an opportunity | Their original opportunity lineage and receipts | New lifecycle evidence may append; no foreign-key reassignment or country reinterpretation. |

Current schema guards make Workspace/tenant/Property scope immutable once an
opportunity has a Workspace, but they do not make every commercial field or
legacy configuration column physically immutable. The future retirement package
must add any required forward-only enforcement separately. This document does
not overstate current protection and does not authorize that migration.

## Canonical successor dependencies

A successor command must use the canonical Core authority provider and one
database transaction. Its accepted result must bind actor, Context, Workspace,
Property, authority revision and transaction/command identity before any AIRPROP
write or idempotency lookup.

The successor is blocked until all of these dependencies are accepted and
available:

1. **`CORE-CANONICAL-COUNTRY-REGISTRY-01`** recognizes the exact country token.
   Uppercase alpha-2 syntax is insufficient; an absent registry returns
   `DEPENDENCY_UNAVAILABLE`.
2. **Canonical Property address assignment** supplies one current Property,
   address and versioned assignment in the same Workspace and transaction. The
   address country, jurisdiction-assignment country and profile country must
   agree. The future move/rebinding contract governs changes; no old row is
   edited in place.
3. **Canonical jurisdiction profile selector** returns the exact assignment,
   profile/version and domain hashes. The existing inactive Core selector is a
   building block; AIRPROP does not copy it or create a parallel selector.
4. **Official Country Pack/domain artifact resolver** resolves the exact active,
   effective and reviewed artifact and returns immutable receipt evidence. The
   current Core jurisdiction-domain resolver is a building block, not proof that
   every required Country Pack domain is installed or activated.

The future AIRPROP configuration stores references to the accepted address/
assignment versions and resolver receipt. It does not derive a pack from a
country string. A Property-bound successor opportunity obtains country through
that same current binding. The current unbound-opportunity behavior cannot claim
canonical country or pack status; a future unbound draft contract requires its
own review. Until then it fails with `PROPERTY_BINDING_REQUIRED` rather than
falling back to `RO`.

If the registry, address/assignment, current authority, profile or resolver is
missing, stale, inactive, ambiguous, cross-Workspace or unavailable, the result
is a bounded denial and **zero writes**: no AIRPROP row, audit event, outbox event,
receipt or durable idempotency reservation.

## Authority separation proof

- Locale and language select translated labels and layout only. Changing `lang`
  does not change the current hard-coded opportunity `RO` and can never select a
  future country.
- Currency is a commercial amount attribute. Current `RON`/`EUR` acceptance
  neither selects nor proves address country or a Country Pack.
- Workspace identity scopes authority and isolation. No Workspace or tenant
  default is read by the current opportunity/configuration functions to produce
  country.
- `AIRPROP-RO` is a legacy configuration label accepted by one function. That
  function never joins `portfolio.addresses`, Property jurisdiction assignments,
  the Core selector or the domain-artifact resolver.
- Opportunity `RO` is persisted commercial input. It is not a canonical Property
  address, registry decision, resolver receipt, compliance result or activation.

The successor must preserve this separation. It may consume a Core decision but
must not turn locale, currency, Workspace defaults, old opportunity values or an
`AIRPROP-RO` row into Core authority.

## Compatibility window and cutover

The cutover uses one writer per command and never dual-writes legacy and
canonical records.

1. **Dependency gate.** Land and review the Core registry, current Property
   address assignment/move semantics, selector and resolver while AIRPROP remains
   unchanged. Exercise only isolated inactive fixtures.
2. **Successor dark launch.** Add a distinct versioned AIRPROP command and
   idempotency namespace behind pre-activation. Compare read-only decisions in
   test fixtures; write no shadow commercial records.
3. **Caller migration.** Move the product UI/route and approved integrations to
   the successor. Keep legacy reads and exact retry behavior. Do not translate
   old requests into successor requests and do not reuse their keys.
4. **Legacy new-write freeze.** After callers move, v1/v2/configuration legacy
   gateways reauthorize first and may return only an exact existing result. A new
   legacy request fails with a bounded `LEGACY_COUNTRY_CONFIGURATION_RETIRED`
   result and zero writes.
5. **Compatibility window.** Keep the retry/read adapters for at least the full
   30-day v2 idempotency retention horizon after the last accepted legacy create,
   and longer until two consecutive release cycles show no new legacy-call or
   uncertain-retry traffic. Configuration exact-retry support remains until its
   caller and receipt inventory is reconciled.
6. **Endpoint removal.** Revoke/drop legacy mutation gateways only in a separate
   reviewed migration after every removal gate passes. Keep historical tables,
   rows, audit/outbox evidence and read projections for their retention period.

## Rollback contract

- Before the legacy new-write freeze, an application rollback may route callers
  back to the unchanged legacy gateway while its compatibility contract remains
  explicitly open.
- After the freeze, rollback restores successor code or pauses new writes. It
  must not reopen default-driven legacy creation as an emergency fallback.
- Database rollback never deletes successor or legacy receipts, rewrites
  `AIRPROP-RO`/`RO`, changes idempotency namespaces, reassigns opportunity lineage
  or backfills canonical references from legacy values.
- A resolver/registry/provider outage returns dependency unavailable with zero
  writes. Operational pressure is not permission to infer `RO`.

## Removal gates

All gates are mandatory:

1. Core registry, address-assignment/move contract, selector and official
   resolver are accepted for the exact versions consumed by AIRPROP.
2. Successor commands prove same-transaction authority, stale/revoked/cross-
   Workspace denial, provider-failure zero-write and immutable receipt binding.
3. Every product and integration caller has moved; repository and observed
   compatibility telemetry show no new legacy writes for two release cycles.
4. The last accepted v2 legacy create is at least 30 days old and no uncertain
   retry remains; configuration retry inventory is reconciled.
5. Historical opportunity/configuration/audit/outbox evidence remains readable
   without rewriting or treating legacy country values as canonical.
6. Roll-forward and rollback rehearsals preserve distinct idempotency namespaces,
   exact retries and zero-write denial.
7. Static caller inventory, PostgreSQL compatibility tests, Auth/AAL2/HTTP tests,
   migration checks, Preview and Production-readiness review pass on the future
   implementation head.
8. A separately authorized migration removes grants/functions. Removal is never
   bundled with Country Pack activation or Remote installation.

Failure of any gate extends compatibility or pauses new writes. It never permits
a fallback country, pack, authority or history rewrite.

## Current-state validation boundary

This package validates repository structure and contracts only. PostgreSQL,
HTTP/Auth/AAL2, Remote DB, runtime activation and Production are
**`NOT_RUN_NOT_PASS`**. Artifact B2 remains `commands=null`, `can_edit=false`,
`state=pre_activation`; Production `runtime=null` and `portfolio=null` are
unchanged.

Result: **`deprecation_plan_defined_no_runtime_change`**.
