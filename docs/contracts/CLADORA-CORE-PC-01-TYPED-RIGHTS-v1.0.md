# CLADORA Core PC-01 typed rights and activation contract v1.0

**Baseline:** `feat/core-dw-02-resource-contracts@2c314b4e7a51970a1dda3388446b377db535a56a`

**Delivery boundary:** additive projection schemas, truth table and static evidence. No entitlement mutation, product catalogue table, evaluator replacement, migration, endpoint, central manifest change or Production effect.

## Existing implementation reused

PC-01 reuses `platform.subscription_plans`, `platform.workspace_contracts`, `platform.workspace_entitlements`, `platform.entitlement_usage_ledger`, `platform.module_definitions`, `platform.workspace_modules` and `app_private.check_effective_permission_v2`.

The current effective capability predicate is preserved exactly: the entitlement interval must be current; a current override decides the result and is effective for capability availability only when its JSON value is literal `true`; otherwise `boolean_value is true` or `numeric_value > 0` is effective. The current quota path is separate: it requires a numeric entitlement and computes limit minus usage, with its existing numeric override object. This package does not unify those two override shapes or silently reinterpret stored data.

## Typed-right truth table

| Stored type | Evaluation purpose | Current shared rule | PC-01 disposition |
| --- | --- | --- | --- |
| boolean | capability availability | effective only when current value is `true`; active override literal `true` wins | supported; preserve current evaluator |
| numeric | capability availability | effective only when current value is greater than zero; active capability override must still be literal `true` | supported; do not consume quota here |
| numeric | quota limit | current numeric limit minus append-only usage ledger; existing numeric override object may replace the limit | supported only through existing quota function |
| string | capability availability | no shared comparator | `review_required`; domain contract must define semantics |
| array | capability availability | no shared comparator | `review_required`; domain contract must define semantics |
| json | capability availability | no shared comparator | `review_required`; domain contract must define semantics |

Null, missing, expired or non-positive rights are not effective. A null `contract_id` on an otherwise-effective row is `legacy_unprovenanced`; it is not invalid, not contract-backed and must not be guessed from Workspace ownership, plan name, dates or similar keys.

## `product-right-evaluation.v1`

The projection pins the exact Workspace, entitlement row/key, typed value, temporal interval, override state, provenance, evaluation purpose, result and reason codes. It is a read explanation of existing state, not a new authorization evaluator and not a commercial acceptance decision.

The valid results are `effective`, `ineffective`, `review_required` and `not_applicable`. An unsupported type/purpose combination is `review_required`, never silently truthy. Product or bundle provenance is absent until an accepted canonical source exists.

## `product-capability-decision.v1`

The decision reports three separate layers:

1. product availability from the typed right;
2. current module activation from `platform.workspace_modules`;
3. `action_authorization = not_evaluated`.

An available product right does not activate a module. An active module does not create a contractual right. Neither authorizes a person to perform an action. Every domain command continues to call the current exact permission evaluator and enforce its resource, relationship, assurance and business preconditions.

## Activation mapping

| Current source | Projection field | Invariant |
| --- | --- | --- |
| `platform.workspace_entitlements` | `right` | one current compatibility row per Workspace/key; temporal validity and legacy provenance retained |
| `platform.workspace_modules` | `activation` | exact module definition/version and temporal activation status |
| `platform.module_definitions.entitlement_key` | right-to-module lookup | catalogue mapping only; does not create either side |
| `app_private.check_effective_permission_v2` | action check outside this projection | deny-first, scoped, current and separate from availability |
| `platform.entitlement_usage_ledger` | quota evidence | append-only consumption; never inferred from module activation |

## Legacy and multi-product boundary

The current unique `(customer_workspace_id, entitlement_key)` row cannot represent overlapping product grants or immutable grant provenance. This contract exposes that limitation but does not add a competing ledger. A future append-only grant package requires separate schema authorization, deterministic aggregation rules, migration and compatibility evidence. Until then, the existing row remains authoritative and no current right is bulk-linked, revoked or rewritten.

## Acceptance criteria

1. All five stored entitlement value types are represented, but only current supported comparisons can return effective.
2. Capability, quota and domain-specific purposes remain distinct.
3. Contract and `legacy_unprovenanced` provenance are mutually exclusive and strict.
4. Product availability, module activation and action authorization remain separate.
5. Existing DW-01A availability semantics, current evaluator, quota ledger and historical records are unchanged.
6. Static contract tests, typecheck, database package fingerprint and existing DW-01A/DW-02 tests pass.

Passing tests place this contract in review. They do not authorize an append-only grant migration, merge, remote migration, Production deployment or central manifest update.
