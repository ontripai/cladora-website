# CLADORA Core read authority profile v1.0

Package: `CORE-READ-AUTHORITY-PROFILE-01`

Status: **inactive registry installed in Repository; Remote installation not authorized**

This package defines the closed authority profile required by
`CLADORA-CORE-CURRENT-CONTENT-POLICY-READ-PORT-v1.0`. It installs only canonical registry
identity. It does not implement a read host, content-policy decision, Country Pack resolver,
consumer adapter or route.

## Fixed profile

| Binding | Canonical value |
| --- | --- |
| permission | `experience.guide.read` |
| module | `experience_guides` |
| entitlement | `module.experience_guides` |
| evaluation purpose | `experience.guide.content_policy.read` |
| domain | `content.policy` |
| domain version | `content-policy.v1` |

The profile has contract version `core-read-authority-profile.v1`, profile version `1`, requires
the entitlement, is server-owned and immutable, and sets
`reusable_as_command_authority=false`. A request cannot carry or override any fixed profile field.
The only future caller-observed input is a positive `expected_authority_revision`; it is a stale
precondition and never establishes authority, permission or entitlement.

## Registry installation boundary

The additive migration registers the read permission, version 1 of the module definition and one
active non-delegable read binding. The module definition points to the mandatory entitlement key
and requires AAL2. The migration fails closed if an existing row conflicts with the canonical
identity or if a role assignment, Workspace module activation or Workspace entitlement allocation
already exists.

The migration creates none of those assignments or allocations. It adds no `GRANT`, policy,
execution role, credential, Country Pack, content-policy payload or runtime entry point. Existing
table owners, ACLs and RLS policies remain unchanged. Remote installation is a separate authorized
operation.

`experience.guide.read` and `experience.guide.manage` remain independent permissions. Neither
implies, bootstraps or falls back to the other. There is also no fallback to `service_role`, an
object owner, a command execution role, locale, historical receipt or cached authority.

## Future authority evaluation

A later sealed Core read host must select this profile internally and recheck the canonical current
authority in one read transaction. Acceptance requires the exact Context, actor and Workspace;
the exact active module and permission binding; a current enabled Workspace entitlement for
`module.experience_guides`; and the current canonical authority revision. Missing, expired,
disabled, revoked, stale or cross-Workspace state is a bounded denial with zero durable writes.

The host must end every path with `ROLLBACK`. This package intentionally has no host, receipt,
audit, outbox, idempotency, unknown-commit or content-policy decision behavior.

## Evidence and exclusions

Static evidence fixes the profile tuple, rejects caller overrides and proves that the migration
contains no role assignment, Workspace activation, entitlement allocation or grant. Disposable
PostgreSQL evidence exercises the canonical permission evaluator for read-only and manage-only
actors, missing/expired/revoked entitlement and cross-Workspace cases, inventories owner/ACL/RLS,
checks authority-revision changes, verifies zero shared/domain writes and rolls the fixture back to
zero residue.

No Guide body, Country Pack artifact, policy payload, reviewer identity or signoff reference is
part of this contract.
