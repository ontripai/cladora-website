# CLADORA Core Minimum Consumer Contracts — SERVICE and CE v1.0

**Baseline:** CLADORA v1.4

**Status:** Review-ready additive contract; no migration or Production effect

**Owner:** Core owns the shared authority, reference-verification and atomic-write envelopes. SERVICE and Community & Experience (CE) own their domain records and commands.

This contract fixes the minimum Core boundary needed by SERVICE and CE. It reuses the existing Workspace-native authority, module/entitlement evaluation, idempotency, audit and outbox infrastructure. It does not replace an existing consumed contract, create a second authority engine, or make one product depend on the other.

## Shared invariants

1. Workspace type, descriptive taxonomy and physical-building status do not cap capability.
2. Capability availability is not permission to execute an action. Every command checks its exact permission and target server-side.
3. The client may identify a candidate reference, but never proves tenant, Workspace, ownership, provider authority, contract effectiveness, geography or action permission.
4. A missing taxonomy value or null legacy `contract_id` cannot by itself revoke an otherwise-effective existing entitlement.
5. Ownership, management, access and product entitlement remain independent relations.
6. A failed or denied command creates no domain write, receipt, audit event or outbox event. Historical attribution is never rewritten after role, agreement or configuration changes.
7. Disclosure is least-privilege: a caller receives no identifier, count, contract status or source reference unless the exact read permission and target scope allow it.

## Shared authority envelope `workspace-native-authority.v2`

All SERVICE and CE server commands first call:

```text
app_private.resolve_workspace_native_context_v2(context_id, workspace_id)
app_private.check_workspace_native_permission_v2(
  context_id,
  workspace_id,
  permission_code,
  module_code
)
```

The server pins `tenant_id`, `workspace_id`, `membership_id`, `actor_user_id`, represented party when applicable, `module_code`, `permission_code`, target type/id and `evaluated_at`. Explicit deny, expired/revoked assignment and cross-tenant mismatch deny the command. A previously successful request or idempotency record never bypasses a fresh authority check.

## CE minimum contract

CE-011 consumes the existing [C01/C02/C03 contract](./CLADORA-CE-011-CORE-CONTRACTS-C01-C03-v1.0.md) without an additional Core gateway.

| Contract | Minimum delivered boundary | CE-owned remainder |
| --- | --- | --- |
| C01 | `workspace-native-authority.v2`; `ce.event.basic`; module `community_events`; six `events.*` permission codes and the server-derived audience tuple | Register/bind the CE-owned module and permissions; enforce Event/occurrence audience and lifecycle |
| C02 | Independent module + effective-entitlement activation; legacy null `contract_id` compatibility; Workspace state separated from action authorization | CE activation proposal and domain persistence |
| C03 | Existing `platform.idempotency_keys`, `audit.events`, `platform.outbox_events` in one transaction | CE mutation RPC and bounded receipt schema |

Event activation has no dependency on Community, SERVICE, Booking, Finance, AIRPROP, or completion of all PC-01/DW-02 work. Event interest is not a reservation, capacity allocation, confirmed place or admission guarantee. Programme time is not a Booking allocation.

**CE base disposition:** Core contract dependency is delivered for review. CE may continue its additive domain work; only its own registry bindings, persistence, RLS and executable database tests remain open. The CE capability must not be advertised as operational before those are accepted.

## SERVICE minimum contracts

SERVICE continues to use the already registered modules and permissions; this contract does not rename or duplicate them.

| Operation | Module | Exact permission |
| --- | --- | --- |
| Read catalogue/definition | `services_catalog` | `services.catalog.read` |
| Manage catalogue draft | `services_catalog` | `services.catalog.manage` |
| Publish catalogue | `services_catalog` | `services.catalog.publish` |
| Read service request | `services_orders` | `services.orders.read` |
| Submit non-binding request | `services_orders` | `services.orders.request` |
| Manage quote draft | `services_orders` | `services.quotes.manage` |
| Publish non-binding quote | `services_orders` | `services.quotes.publish` |

### S01 — `canonical-resource-reference.v1`

Use when a SERVICE offering or request claims coverage or eligibility for specific resources.

Input from the domain command:

```text
context_id, workspace_id, resource_id, resource_version, resource_type,
permission_code, purpose
```

Server-verified output:

```text
tenant_id, workspace_id, resource_id, resource_version, resource_type,
reference_status = verified | stale | not_found | withheld,
display_name | null, lifecycle_status, evaluated_at
```

Rules:

- Resolve Workspace-native context and exact action/read permission first.
- Validate the resource identity, version, lifecycle and tenant/Workspace relationship from the canonical DW-02 resource source. Resource ownership does not imply management or SERVICE access.
- `verified` is only a reference result; it does not authorize the SERVICE action.
- Return `stale` only to a caller allowed to know the reference exists. Otherwise return `withheld`; a withheld result contains no resource/source identifier, display value or count.
- Persist the pinned id/version/type in the SERVICE record. Later resource changes do not rewrite historical SERVICE records.
- Until the DW-02 resolver is accepted, specific-resource coverage/eligibility is blocked. Workspace-wide offering work remains unblocked.

### S02 — `provider-agreement-verification.v1`

Use before publishing an offering or accepting a provider-side command that relies on a provider agreement.

Input:

```text
context_id, workspace_id, provider_agreement_id,
provider_agreement_version, requested_service_scope, permission_code
```

Server-verified output:

```text
tenant_id, workspace_id, provider_party_id,
provider_agreement_id, provider_agreement_version,
agreement_status = effective | expired | revoked | not_effective | withheld,
valid_from, valid_until | null, allowed_service_scope,
evaluated_at
```

Rules:

- The server derives provider party, agreement parties, Workspace scope, effective interval and allowed service scope from the canonical contract/mandate source. Client-supplied party or status is never proof.
- Cross-tenant, revoked, expired, superseded, not-yet-effective or out-of-scope agreements deny the mutation. An explicit deny wins over an otherwise-effective agreement.
- Contract identifiers, status and dates are disclosed only with the exact authorized purpose. Otherwise the result is `withheld` with all contract/source references null.
- A later revocation blocks new commands and replay authorization but does not alter previously attributed records.
- Until the verifier is accepted, provider-agreement-dependent publication/commands are blocked. Definition drafting that creates no provider claim may continue.

### S03 — `geographic-coverage-resolution.v1`

Use when coverage or eligibility is expressed geographically rather than by Workspace or canonical resource.

Input:

```text
context_id, workspace_id, country_code, region_code | null,
source_version | null, permission_code, purpose
```

Server-verified output:

```text
tenant_id, workspace_id, country_code, region_code | null,
geography_version, source_code, resolution_status = verified | stale | unsupported | withheld,
evaluated_at
```

Rules:

- Validate codes and version against the Core-approved geographic source and the Workspace/resource evidence visible to the caller. A client code is not proof of location or coverage.
- Do not infer geography from descriptive Workspace taxonomy.
- Withheld results expose no location identifier, source, version or count.
- Until the resolver/source is accepted, geographic coverage is blocked. Workspace coverage remains unblocked.

### S04 — shared mutation envelope

SERVICE mutations continue to use the existing `platform.idempotency_keys`, `audit.events` and `platform.outbox_events`. The transaction order is: fresh authority and reference checks; lock aggregate; claim idempotency key; verify expected version; domain write; immutable bounded receipt; audit row; outbox row; finalize idempotency response; commit. Replay rechecks current authority and referenced agreement/resource effectiveness and creates no duplicate effects.

No new table or parallel evaluator is authorized by S01-S04. The resolver/verifier implementation remains a small Core/DW-02 package and must use the existing authority and entitlement evaluators.

## Versioned failure contract

Consumer APIs map internal detail to this bounded vocabulary; they do not expose existence across a disclosure boundary.

| Code | Meaning | HTTP mapping |
| --- | --- | --- |
| `core_authority_denied` | Current exact action permission failed | 403 |
| `core_reference_withheld` | Existence/detail cannot be disclosed | 404 |
| `core_reference_not_found` | Authorized caller: reference absent | 404 |
| `core_reference_stale` | Authorized caller: supplied version is stale | 409 |
| `core_agreement_not_effective` | Authorized caller: agreement not usable now/scope mismatch | 409 |
| `core_geography_unsupported` | Authorized caller: geography not supported | 422 |
| `core_version_conflict` | Aggregate/idempotency version conflict | 409 |

## Consumer readiness and narrow blockers

| Consumer path | Core readiness | Narrow remaining dependency |
| --- | --- | --- |
| CE basic Event contract | Delivered for review through C01/C02/C03 | CE-owned registry/domain migration and executable tests |
| SERVICE Workspace-wide definition/draft | Existing authority and catalogue contracts available | No S01/S03 dependency; provider claim still requires S02 |
| SERVICE specific-resource coverage | Contract fixed, implementation pending | DW-02-backed S01 resolver |
| SERVICE provider-backed publish/command | Contract fixed, implementation pending | S02 verifier over canonical agreement source |
| SERVICE geographic coverage | Contract fixed, implementation pending | S03 resolver and approved geographic source |
| SERVICE request/quote without Booking allocation | Existing `services_orders` flow remains independent | No BK-01 dependency unless capacity/time is actually reserved |

## Acceptance criteria

1. Static contract test pins every existing SERVICE module/permission and CE C01/C02/C03 reference.
2. Resolver/verifier executable tests cover permitted, denied, revoked/expired, stale, withheld, cross-tenant and zero-write denial cases.
3. Withheld fixtures prove no identifier, count, contract status, geography or source reference leaks.
4. Replay after permission/agreement revocation is denied and creates no domain, receipt, audit or outbox duplicate.
5. Typecheck and existing consumer tests pass. A prepared contract is reported separately from an executed database test.
6. No endpoint is advertised operational until its real resolver/RPC and database tests are accepted.
