# CLADORA Core DW-01B — Workspace Configuration v1.0

Status: contract/test candidate for review; runtime deferred

Contract identifier: `workspace-configuration.v1`

Owner: Core/Platform

## Purpose

`workspace-configuration.v1` defines a historical, descriptive projection over
the existing `platform.workspace_taxonomy_assignments` ledger. A separately
authorized runtime may use it to version the selected property profile,
operating model, country classification, and the compatibility rule current
when each assignment is inserted.

The contract does not create another Workspace model, role system, entitlement
engine, product gate, or action-authorization decision.

## Required provenance

A conforming future runtime must associate every taxonomy assignment with:

- a server-managed positive `configuration_version`, unique within its
  `customer_workspace_id`;
- the immutable `compatibility_rule_id` selected at insertion;
- the immutable positive `compatibility_rule_version`;
- the existing effective interval, profile, operating model, country, actor,
  status, and timestamps.

Existing history must be backfilled deterministically by `valid_from`,
`created_at`, and `id`. Missing compatibility provenance must fail closed
instead of inventing a rule. New versions must be serialized per Workspace,
and caller-supplied version or compatibility provenance must not become
authoritative.

## Read contract

A future runtime may implement this interface only after its own authorization:

```text
customer_api.get_workspace_configuration_v1(
  context_id uuid,
  workspace_id uuid,
  as_of timestamptz = statement_timestamp()
) -> jsonb
```

The reader must delegate Workspace access to
`app_private.resolve_workspace_native_context_v2`. It may permit current and
past reads, but a future runtime must fail closed for future `as_of` values,
cross-workspace access, and cross-tenant access.

The response contract includes:

- `contract = workspace-configuration.v1`;
- `workspace_id`, `as_of`, and `has_configuration`;
- the effective assignment ID, configuration version, and interval;
- versioned property-profile and operating-model classifications;
- pinned compatibility-rule identity, version, level, and reason;
- `classification_only = true`;
- `compatibility.product_gate = false`;
- `action_authorization = not_evaluated`.

An authorized Workspace without an effective configuration returns
`has_configuration = false` with explicit null configuration and rule fields.
It must not guess a Workspace, infer a right, or fall back to another tenant.

## Mutation and authority boundary

The existing taxonomy mutation gateway remains the only permitted public
mutation path. Compatibility is descriptive prerequisite evidence; product
activation and action authority remain decisions of their existing canonical
contracts at action time.

Configuration history is forward-only. A future implementation may perform an
already-defined lifecycle closure, but must not change identity,
classification, effective start, version, compatibility provenance, creator,
or creation time. Physical deletion remains prohibited.

## Contract-only boundary

This package contains the versioned documentation and its static contract test.
It installs no SQL migration, database object, HTTP endpoint, or runtime
activation. Database implementation, pgTAP coverage, rollout, and any Remote
operation require separate migration/runtime authorization. The removed runtime
proposal is retained outside the public Repository as a private restore
artifact and is not evidence of deployment or acceptance.

## Verification

`scripts/test-dw-01b-workspace-configuration-contract.mjs` verifies the stable
contract vocabulary, authority boundary, fail-closed requirements, test-runner
registration, and absence of the deferred migration/runtime files.
