# CLADORA DW-01A Database Reader Change Package v1.1

**Status:** Design-only database package
**Owner:** Core/Platform
**Consumer reviewers:** CE, AIRPROP, SERVICE and Operations
**Authorization:** No migration file is included; no local or Production database execution is authorized

## Exact future change

The exact SQL proposal is attached at `docs/contracts/CLADORA-DW-01A-DATABASE-READER-PROPOSED.sql`. The proposed pgTAP contract is attached at `docs/contracts/CLADORA-DW-01A-DATABASE-READER-PGTAP-PROPOSED.sql`. Both are transaction-wrapped, end in `rollback`, and are outside the migration/test directories.

Add one read-only RPC after coordinated approval:

```sql
customer_api.get_workspace_capability_snapshot_v1(p_context_id uuid, p_workspace_id uuid) returns jsonb
```

The TypeScript consumer must pass exactly:

```ts
{ p_context_id: string /* UUID */, p_workspace_id: string /* UUID */ }
```

No one-parameter overload or implicit Workspace resolution is permitted.

The RPC must use the existing authenticated customer context resolver and return the exact bounded payload accepted by `workspaceCapabilityRpcPayloadV1Schema`. It must not alter or replace `get_workspace_taxonomy_v1`, `get_workspace_composition_v1`, entitlement validity logic, module activation, role resolution or any consumer route.

## Required read behavior

1. Resolve tenant and Workspace through the existing customer context boundary. Cross-tenant, inaccessible and ambiguous contexts fail closed with bounded errors.
2. Return `workspace_type` only as `administrative_origin_type`.
3. Return taxonomy as `configured` or `not_configured`. Absence of taxonomy cannot itself change an otherwise-valid entitlement or active module to unavailable.
4. Reuse the exact entitlement predicate already used by `get_workspace_composition_v1` and `check_effective_permission_v2`: temporal validity first; a current override decides effective truth, otherwise the stored boolean-true or numeric-positive rule applies. There is no standalone read-only evaluator that accepts the explicit two-parameter Workspace context, so this package repeats that predicate without extending it and proves parity in pgTAP. It introduces no aggregation or new boolean/numeric/override semantics. An effective row with null `contract_id` returns `legacy_unprovenanced` and remains effective.
5. Never infer a contract. Contract-backed rows return contract details only at the disclosure level authorized for the requester.
6. Return Workspace-level capability state only. Do not evaluate principal/action/resource authorization and always emit `action_authorization = not_evaluated`.
7. Return action/resource restrictions independently. A restricted action or resource cannot become a product-wide prohibition without an explicit product-scoped policy source.
8. Apply one response-wide `reference_visibility` ceiling to resources, module/activation IDs, entitlement IDs, contract references and every restriction `resource_id`, `source_id` and `source_version`:
   - `count_only`: only after live context/Workspace resolution and an effective allow, with no deny, for existing `workspace.role.read` or `workspace.role.manage`;
   - `withheld`: the real default for a caller who can enter the Workspace but lacks disclosure permission; both counts are null and no resource/module/activation/entitlement/contract/restriction source reference or contract status appears anywhere;
   - contract status is exposed only with existing `workspace.role.manage`; otherwise a contract-backed entitlement uses `contract.visibility = withheld`;
   - `full` remains schema-reserved and is not emitted by this proposal; it requires a separately approved permission mapping and tests.
9. The RPC is `STABLE`, performs no writes, and returns no command token.

## Security ownership

Core/Platform owns the RPC, grants and pgTAP contract. The future migration must revoke execution from `PUBLIC` and `anon`, grant only the intended authenticated/service roles, derive tenant and actor server-side, and avoid a new public table or view. If `SECURITY DEFINER` is required to traverse protected schemas, it must live in `customer_api`, pin `search_path`, recheck the authenticated context, expose bounded fields only and receive explicit execute grants.

## Required pgTAP package

The separately approved database PR must prove:

1. exact two-parameter signature across SQL, TypeScript schema/adapter and the future consumer;
2. real RPC calls as an aggregate-authorized caller and as a caller with valid Workspace access but no disclosure permission;
3. same `workspace_type`, different effective compositions;
4. missing taxonomy does not revoke an effective legacy entitlement;
5. null `contract_id` remains effective and returns no inferred contract;
6. expired entitlement and a current override follow the existing predicate;
7. direct parity between RPC output and that predicate;
8. withheld/count-only disclosure does not leak IDs, contract status or hidden totals;
9. cross-tenant access fails closed;
10. RPC performs zero taxonomy/module/entitlement/audit/outbox writes.

## Proposed pgTAP outline

The attached rollback-only pgTAP proposal now builds authorized and non-authorized identities and calls the real RPC. It covers missing taxonomy, valid legacy/null-contract entitlement, expiry, current override, count disclosure, whole-response withheld leakage, same-type/different-composition, cross-tenant denial and zero writes. Function-text inspection remains complementary only. The SQL attachment is never placed in `supabase/migrations` until separately authorized and regenerated through the repository migration workflow.

## Dependency gate

The HTTP endpoint remains absent until the RPC migration, generated database type, pgTAP package and security review are accepted together. Only then may a separate application PR add the route and route-level tests. Until that gate, the TypeScript adapter is a compile-time/contract artifact and must not be described as operational or ready for consumers.

Typecheck remains open until an actual successful TypeScript compilation. Passing the source-level contract test or future pgTAP suite does not close that gate.
