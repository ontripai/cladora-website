# CLADORA Core Resource / Relationship / Authority contract v1.0

**Package:** `CORE-RESOURCE-AUTHORITY-CONTRACT`

**Owner:** Core/Platform

**Acceptance owner:** Documentation & PM

**Consumer:** AIRPROP first; reusable by SERVICE and other approved workstreams

**Executable version:** `core-resource-authority.v1`

## Purpose

This contract combines three already accepted Core facts for one consumer decision:

1. the identity and version of a canonical Resource;
2. a current, purpose-relevant temporal Relationship to that Resource;
3. a current Workspace-native permission decision for the requested action.

It does not create a tenant, Resource registry, Relationship store, ACL, role,
permission, authority evaluator, audit stream, outbox or idempotency mechanism. No
database migration is part of this package.

## Canonical sources

The contract composes, and does not replace:

- `canonical-resource-reference.v1` over the existing `portfolio.parties`,
  `portfolio.properties`, `portfolio.buildings`, `portfolio.entrances`,
  `portfolio.units` and approved domain asset sources;
- `resource-relationship.v1` over accepted sources such as
  `portfolio.ownerships`, occupancy records and
  `platform.workspace_property_authorities`;
- `workspace-native-effective-authority.v2`, evaluated only by
  `app_private.check_workspace_native_permission_v2` after canonical Context and
  Workspace resolution.

The existing `platform.tenants`, `identity.memberships`, `identity.context_grants`,
`platform.workspace_roles` and `platform.workspace_member_roles` remain authoritative.
A consumer must never create a pseudo-tenant or infer tenant identity from a Resource.

## Consumer input

`coreResourceAuthorityRequestV1Schema` accepts a strict object with:

- `evaluation_time`: the single snapshot timestamp shared by every evidence envelope;
- `resource`: the full canonical Resource request, including Context, explicit
  Workspace, Resource type/ID/version, permission and purpose;
- `relationship`: exact Relationship ID/version/kind plus the bounded scope codes the
  action needs;
- `authority`: the existing Workspace-native v2 request, including decision ID,
  Context, Workspace, permission, module and Workspace target.

Context, Workspace and permission must be identical across the Resource and authority
requests. Unknown fields, duplicated relationship scopes and a target other than the
explicit Workspace are rejected.

## Evaluation and deny-by-default rules

`evaluateCoreResourceAuthorityV1` returns `allowed` only when all of the following hold
at the supplied evaluation timestamp:

1. the authority evidence matches the exact decision request and is `allowed`;
2. the Resource is `verified`, has the exact type/ID/version and belongs to the explicit
   Workspace;
3. the Relationship exists and its tenant, Workspace, Resource, ID, version and kind
   match the request;
4. every required scope code is present;
5. Relationship status is `effective`, `valid_from` has passed and `valid_until` has
   not been reached.

The Resource, Relationship and authority evidence must all carry the exact requested
`evaluation_time`; mixed or stale snapshots are denied.

Missing, malformed, stale, cross-tenant, cross-Workspace, future, expired, revoked or
otherwise mismatched evidence is denied. Authority is checked before Resource details
can be disclosed. A denial returns `disclosure: withheld`, `resource_identity: null`
and `relationship_reference: null` with one bounded reason code.

## Consumer output

An allowed decision contains:

- exact tenant/Workspace/Resource identity and version;
- exact Relationship identity, version, kind, party, scope and effective interval;
- an authority reference pinned to the request decision ID, evaluator, policy version
  and evaluation time.

The authority reference is `status_only`: internal assignment/delegation source IDs are
never disclosed. Every result sets `current_authority_recheck_required: true` and
`reusable_as_command_authority: false`. A later command must rerun current authority;
this read-model result is never a bearer grant.

## AIRPROP consumption

For the AP10 management flow, AIRPROP supplies the canonical property reference,
the current `management` Relationship with required mandate scope codes, and an
`airprop.asset.read` / `airprop_commercial` Workspace authority request. AIRPROP may
render the property only after an `allowed` result. It must clear the property on a
withheld denial and re-evaluate after Workspace switch, Relationship revocation,
Resource version change or authority change.

The contract does not create AIRPROP mandates or grant AIRPROP permission. AIRPROP
continues to own its domain state; Core owns Resource identity, temporal Relationship
evidence and current authority evaluation.

## Authorization verification

`scripts/test-core-resource-authority-contract.mjs` executes the TypeScript contract
and covers:

- exact allow;
- authority deny, mismatched decision and stale authority snapshot;
- stale or wrong Resource identity/version;
- missing, cross-tenant or cross-Workspace Relationship;
- stale version, wrong kind, insufficient scope and mixed evaluation snapshots;
- revoked, future and expired Relationship;
- malformed evidence and strict input rejection;
- denial redaction and non-reusable, status-only authority references.

## Acceptance boundary

This package is submitted to Documentation & PM for contract acceptance. CI, a Draft
PR or a reporting receipt is evidence only. Documentation & PM owns any central
manifest update. Acceptance does not authorize Merge, Supabase Remote migration,
`db push`, route enablement or Production deployment.
