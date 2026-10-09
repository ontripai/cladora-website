# CLADORA Core DW-01B — Workspace Configuration v1.0

Status: implementation candidate for review

Contract identifier: `workspace-configuration.v1`

Owner: Core/Platform

## Purpose

`workspace-configuration.v1` is a historical, descriptive projection over the
existing `platform.workspace_taxonomy_assignments` ledger. It versions the
selected property profile, operating model, country classification, and the
compatibility rule that was current when each assignment was inserted.

It does not create another Workspace model, role system, entitlement engine,
product gate, or action-authorization decision.

## Stored provenance

Every taxonomy assignment carries:

- a server-managed positive `configuration_version`, unique within its
  `customer_workspace_id`;
- the immutable `compatibility_rule_id` selected at insertion;
- the immutable positive `compatibility_rule_version`;
- the existing effective interval, profile, operating model, country, actor,
  status, and timestamps.

Existing history is backfilled deterministically by `valid_from`, `created_at`,
and `id`. A missing compatibility rule stops the migration instead of inventing
provenance. New versions are serialized with a workspace-scoped transaction
advisory lock. Caller-supplied version or rule values are overwritten by the
server-managed trigger.

## Read contract

```text
customer_api.get_workspace_configuration_v1(
  context_id uuid,
  workspace_id uuid,
  as_of timestamptz = statement_timestamp()
) -> jsonb
```

The reader delegates workspace access to
`app_private.resolve_workspace_native_context_v2`. It permits current and past
reads and rejects future `as_of` values. Cross-workspace and cross-tenant access
therefore fails through the canonical native-context boundary.

The payload includes:

- `contract = workspace-configuration.v1`;
- `workspace_id`, `as_of`, and `has_configuration`;
- the effective assignment ID, configuration version and interval;
- versioned property-profile and operating-model classifications;
- the pinned compatibility rule identity, version, level, and reason;
- `classification_only = true`;
- `compatibility.product_gate = false`;
- `action_authorization = not_evaluated`.

An authorized workspace without an effective configuration returns
`has_configuration = false` with explicit null configuration/rule fields. It
does not guess a Workspace, infer a right, or fall back to a different tenant.

## Mutation and authority boundary

The existing taxonomy mutation gateway remains the only public mutation path.
DW-01B adds no HTTP endpoint. Compatibility is descriptive prerequisite
evidence; product activation and action authority must still be evaluated by
their existing canonical contracts at action time.

Configuration history is forward-only. Updates may perform the already-defined
lifecycle closure of an assignment, but cannot change its identity,
classification, effective start, version, compatibility provenance, creator,
or creation time. Physical deletion remains prohibited.

## Verification

`supabase/tests/173_dw01b_workspace_configuration.test.sql` contains 22 pgTAP
assertions covering schema, privileges, server-managed sequencing, immutable
history, compatibility pinning, current/historical reads, future-time rejection,
and native workspace isolation.

The migration is local/CI-only until separately authorized. Merge, Supabase
Remote migration, database push, Production rollout, and acceptance remain
independent gates.
