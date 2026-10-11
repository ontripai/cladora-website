# CLADORA DW-01A Workspace Capability Read Contract v1.1

**Status:** Contract/schema preparation only; endpoint and RPC are not operational
**Baseline:** `main@436e7a6`
**Change class:** Additive read contract only
**Production impact:** None in this package; no migration, backfill, activation, entitlement mutation or deployment

## 1. Purpose and invariants

DW-01A supplies one server-authoritative, versioned read model for Workspace identity, descriptive taxonomy and effective composition without changing any existing writer or treating labels as authority.

1. `workspace_type`, property profile and operating model are descriptive/defaulting inputs, never capability ceilings.
2. Capability decisions depend only on real resource/technical prerequisites, active contractual or compatibility rights, valid policy and scoped user authority.
3. A prohibition is action/resource scoped unless an explicit versioned rule is product-wide.
4. Existing identifiers, `get_workspace_taxonomy_v1`, `get_workspace_composition_v1`, routes, module activation and entitlement behavior remain unchanged.
5. Legacy entitlements without `contract_id` continue under their current validity and override rules and are labelled `legacy_unprovenanced`; no contract is inferred. Missing taxonomy or `contract_id` alone never revokes an otherwise-valid existing right.

## 2. Endpoint gate

The future path is reserved as `GET /api/customer/v1/workspace/capabilities?context_id=<uuid>`, but no route is created by this package and it must not be advertised as operational or ready for consumption.

- Auth: current authenticated user; no service-role client.
- Cache: `private, no-store`; `Vary: Cookie`.
- Database reader dependency: additive `customer_api.get_workspace_capability_snapshot_v1(p_context_id uuid, p_workspace_id uuid)` from the separately reviewed Core/Platform database package.
- Response envelope: `{ "data": WorkspaceCapabilitySnapshotV1 }`.
- Existing `/api/customer/v1/workspace/taxonomy` and `/api/customer/v1/workspace/composition` are not redirected, changed or deprecated.
- Activation of the route is gated on the real RPC, generated types, pgTAP acceptance and security review. Schema/adapter availability is not endpoint readiness.

## 3. Versioned schema

```ts
type WorkspaceCapabilitySnapshotV1 = {
  contract_version: 'workspace-capability-snapshot.v1';
  evaluated_at: string;
  reference_visibility: 'full' | 'count_only' | 'withheld';
  workspace: {
    tenant_id: string;
    workspace_id: string;
    lifecycle_status: string;
    administrative_origin_type: string; // legacy workspace_type, descriptive only
    version: number;
  };
  taxonomy: null | {
    assignment_id: string;
    property_profile: { id: string; code: string; version: number };
    operating_model: { id: string; code: string; version: number };
    country_code: string | null;
    valid_from: string;
  };
  resources:
    | { visibility: 'full'; visible_count: number; total_count: number; resource_ids: string[] }
    | { visibility: 'count_only'; visible_count: number; total_count: number | null; resource_ids: [] }
    | { visibility: 'withheld'; visible_count: null; total_count: null; resource_ids: [] };
  capabilities: CapabilityReadV1[];
};

type CapabilityReadV1 = {
  capability_key: string;
  workspace_state: 'available' | 'inactive' | 'unavailable' | 'review_required';
  state_reason_codes: string[];
  action_authorization: 'not_evaluated';
  module: null | {
    definition_id: string | null;
    code: string;
    version: number;
    activation_id: string | null;
    activation_status: string;
  };
  entitlement: null | {
    entitlement_id: string | null;
    key: string;
    value_kind: 'boolean' | 'numeric' | 'string' | 'array' | 'json';
    provenance: 'contract' | 'legacy_unprovenanced';
    contract: ContractDisclosureV1;
    valid_from: string;
    valid_until: string | null;
    override_active: boolean;
  };
  prerequisites: Array<{
    kind: 'resource' | 'technical' | 'contract' | 'policy';
    key: string;
    result: 'satisfied' | 'unsatisfied' | 'review_required' | 'not_applicable';
    scope: { action: string | null; resource_id: string | null };
    source_id: string | null;
    source_version: number | null;
    reason_code: string;
  }>;
};
```

The read model never returns `allowed_for_user`. `workspace_state` describes availability at Workspace level only. User authorization remains a command-time, principal/action/resource-specific decision. A restricted resource or operation appears in `restrictions`; it cannot convert the entire product to unavailable unless an explicit product-scoped rule says so.

Resource and contract disclosure is decided server-side after the live two-parameter context/Workspace resolution. Workspace access alone is insufficient. In the proposed v1 reader, an effective allow with no deny for the existing `workspace.role.read` or `workspace.role.manage` permits `count_only`; otherwise the real response is `withheld`. Contract status additionally requires `workspace.role.manage`. `full` remains schema-reserved and is not emitted by this proposal. Client-side filtering is not a security boundary.

`reference_visibility` is a ceiling for the complete response. Under `withheld`, resource counts/IDs, module definition/activation IDs, entitlement IDs, contract IDs/references/versions, and restriction `resource_id`/`source_id`/`source_version` must all be null or empty. Under `count_only`, no resource/source identifier may appear anywhere. A lower-level object cannot widen the response ceiling.

## 4. Compatibility adapter rules

- Existing profile/model compatibility rows may be reported as legacy policy evidence, but their descriptive code/name cannot be emitted as the sole reason for denial.
- Until prerequisite rules are normalized, the adapter may report `legacy_policy_rule` with the exact compatibility row ID/version and `review_required`; it must not manufacture a resource or technical fact.
- Existing module `is_entitled` remains unchanged. No standalone existing evaluator accepts both explicit context and Workspace IDs, so the database proposal repeats only the exact predicate already used by `get_workspace_composition_v1` and `check_effective_permission_v2`, with pgTAP parity. It creates no new boolean/numeric/override or aggregation rule. Null `contract_id` maps to provenance `legacy_unprovenanced` and remains effective under those rules.
- Missing taxonomy is reported as `not_configured`. It does not by itself mean a product is forbidden and does not invalidate a currently effective legacy entitlement; current mutation behavior stays unchanged outside this additive reader.
- The snapshot contains no command token and grants no authority.

## 5. First PR: exact boundary

### Included

1. This contract and the revised reconciliation report.
2. Additive TypeScript/Zod schemas for `WorkspaceCapabilitySnapshotV1`, the exact RPC arguments `{ p_context_id, p_workspace_id }`, and the future bounded RPC payload.
3. A pure adapter that validates the future RPC payload and rejects taxonomy/null-contract denial contradictions. It has no HTTP or database dependency.
4. Contract tests proving the schema boundary, CE mappings and deliberate absence of the endpoint.
5. A design-only Core/Platform database change package; no migration file is created.

### Excluded

- HTTP endpoint, database migration, Production write/deployment or entitlement disposition.
- Changes to `get_workspace_composition_v1`, activation/deactivation commands, compatibility tables or role/permission resolvers.
- Product catalogue, bundles, grants, aggregation engine or activation receipts.
- Resource graph/relationship ledger.
- Capacity-hold implementation, Community persistence/UI, SERVICE booking or AIRPROP reservation changes.

### Files in this preparation package

- `src/lib/customer/workspace-capability-snapshot-schema.ts`
- `src/lib/customer/workspace-capability-snapshot-adapter.ts`
- `scripts/test-dw-01a-capability-read-contract.mjs`
- `docs/contracts/CLADORA-DW-01A-DATABASE-READER-CHANGE-PACKAGE-v1.0.md`

The later database PR and later route PR remain separate approval gates.

## 6. Consumers and adoption order

| Consumer | First use | Must continue using independently |
| --- | --- | --- |
| Workspace composition UI | Display identity/taxonomy/provenance and availability explanations | Existing activate/deactivate commands |
| AIRPROP | Read product/module availability and exact Workspace/resource references | AIRPROP authority and commercial-reservation commands |
| SERVICE | Read module/entitlement availability and resource prerequisite explanations | SERVICE request/quote/booking and Operations work-order contracts |
| Community base | Read Workspace identity, module availability and legacy provenance | Current membership/role authorization and shared messaging/documents |
| Event base | Read Event module availability for a free Event that allocates no capacity, time or resource | Event publication, interest/withdrawal and manual attendance lifecycle |
| Experience Guide | Read guide capability and editorial availability | Guide publication lifecycle and external-place labelling |
| Operations | Explain module availability | Existing technical asset, work-order, finance, utility and document authorities |
| Platform/Support | Diagnose provenance and prerequisite reasons | Existing contract/entitlement mutation APIs and dual control |

No consumer may authorize an action from `workspace_state`, `workspace_type`, profile or operating-model labels.

## 7. Tests for this preparation and later implementation

### Type/schema and adapter tests

1. Validate the complete future RPC payload and reject unknown enum/value-shape drift.
2. Keep Workspace availability separate from action authorization with the literal `not_evaluated`.
3. Reject `taxonomy_not_configured` or `contract_id_missing` as the sole reason for Workspace-level unavailability.
4. Reject any inferred contract disclosure for `legacy_unprovenanced`.
5. Prove the adapter has no fetch, Supabase client or RPC dependency and that the route is absent.

### Read-contract acceptance

1. Two Workspaces with the same `workspace_type` return different module/entitlement compositions.
2. A Workspace with zero properties and one with multiple properties both produce valid snapshots.
3. Missing taxonomy or a profile/model label alone cannot yield a capability denial reason or revoke a valid legacy right.
4. An action-scoped prohibition denies that action while another action in the same module remains independently available.
5. A null-`contract_id` entitlement remains effective and returns `legacy_unprovenanced`; no contract/product ID is synthesized.
6. Contract-backed and legacy entitlements are distinguishable without changing stored rows.
7. Historical taxonomy/module/entitlement records are read with exact IDs/versions; no mutation occurs.
8. Actual authorized and non-authorized RPC fixtures prove count-only/withheld resources and status-only/withheld contract information reveal no unauthorized IDs, statuses or totals.
9. Cross-tenant context, inactive Workspace and ambiguous binding fail closed in the future RPC package.

### Regression

- Existing pgTAP 087, 088, 089, 090, 091, 132 and 133 remain green.
- Existing workspace taxonomy/composition route and component tests remain green and unchanged.
- Typecheck remains an explicit open gate until it runs successfully; a source-level contract test does not satisfy it. Existing lint/unit/build expectations remain unchanged.

## 8. Compatibility effect and rollback

- Additive only: no existing JSON shape, function signature, table, entitlement or activation changes.
- No consumer opts in during this package. Rollback removes only the unused schema/adapter and documents.
- The later database reader must be `STABLE`, use the canonical context resolver, expose only bounded fields, revoke `PUBLIC`/`anon`, grant only intended roles and remain read-only.
- Any future replacement of existing readers requires a separate deprecation period, consumer inventory and coordinated approval.

## 9. Community contracts available before full DW-02/PC-01

- **Community base:** `WorkspaceIdentityRefV1`, current account/member identity, current scoped permission resolver, audit/outbox envelope, shared document/message references, and read-only module/entitlement provenance.
- **Event base:** the above plus versioned Event identity, organizer authority, audience/eligibility snapshot, publication receipt, interest/withdrawal and manual attendance. The Event allocates no capacity, time or resource; interest is not a reservation, confirmed place, capacity allocation or admission guarantee.
- **Experience Guide:** Community base plus versioned guide entry, canonical `ResourceRefV1` when available or explicitly external/unresolved place reference, locale/visibility, editorial authority and publication receipt.

These contracts do not grant physical access, create SERVICE orders, post finance, or reuse AIRPROP commercial reservation. Limited capacity/time, paid events, benefits and commerce are deferred to their shared owning contracts.

## 10. CE-011 C01/C02/C03 mapping

| CE contract | Existing capability reused | Real gap for CE-011 | Dependency effect |
| --- | --- | --- | --- |
| C01 — Authority and audience | `resolve_workspace_native_context_v2`, `check_workspace_native_permission_v2`, memberships/parties, role assignment and lineage | CE must map Event organizer, interest owner and attendance staff actions to exact existing permissions/scopes; no new identity or authority engine | Event activation does not depend on Community or SERVICE |
| C02 — Independent activation | module definitions, Workspace modules and current entitlement validity | DW-01A Workspace-level read projection must expose Event independently and must not use taxonomy or null `contract_id` as a denial shortcut | This is the only DW-01A runtime gap; schema is prepared, RPC/route remain gated |
| C03 — Basic audit and recovery | audit events, idempotency keys, expected-version/idempotent command patterns and outbox foundations | CE-011 commands must bind reason/version/receipt and recheck authority on retry; multi-subsystem orchestration is not required | Uses existing Core patterns; no dependency on full PC-01/DW-02 |

The final tuple, official capability/permission codes, idempotency boundary and atomic write/receipt/audit/outbox sequence are normative in `docs/contracts/CLADORA-CE-011-CORE-CONTRACTS-C01-C03-v1.0.md`. The official capability code is `ce.event.basic`; permissions are `events.event.read`, `events.event.publish`, `events.event.cancel`, `events.interest.manage_self`, `events.attendance.record` and `events.attendance.correct`.

CE-011 may therefore proceed as a standalone free Event with one occurrence, explicit audience, interest/withdrawal and manual attendance after its own domain persistence/command package is approved. It must not allocate capacity, time or resources and does not require Community, SERVICE, Booking, payment or complete PC-01/DW-02.

## 11. Remaining dependency gates

1. Core/Platform approval and implementation of the small database reader package.
2. Generated database type and pgTAP/security acceptance for that RPC.
3. A later application PR for the authenticated endpoint and route tests.
4. CE owner mapping of concrete Event permissions/actions to C01 and command receipts to C03.
5. Consumer-by-consumer adoption; no current consumer is switched by DW-01A preparation.
6. Typecheck remains open. The passing source-level contract test is not a substitute for TypeScript compilation.

The package is ready for database-owner review, not runtime consumption. A migration, endpoint activation, Production deployment or consumed-contract replacement needs separate authorization.
