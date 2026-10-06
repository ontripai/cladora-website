# Core LC-C01 consumer gate 017 v0.1

Date: 2026-10-06. Baseline: `main` at `4f91b64a8585c80b12246801f501015ac7b60994`. Scope: shared Core contract only. Lifecycle package v1.1 and UX directive v1.0 remain the acceptance sources.

## Source audit

The private temporal relationship and current resolver are deployed by PR #273 and #274. Production held zero `platform.workspace_property_authorities` rows at the post-migration inspection. The resolver takes an explicit context, workspace, canonical property and purpose, checks current native workspace assignment, and returns a relationship ID. It does not establish a module permission, a business right, or visibility into records from another workspace.

| Potential consumer | Current source path | Existing subject/authorization behavior | Migration boundary |
|---|---|---|---|
| AIRPROP opportunity creation and list | `supabase/migrations/20261003142455_airprop_workspace_native_opportunities_v2.sql`, `customer_api.create_airprop_opportunity_v2` and `list_airprop_opportunities_v2` | Native AIRPROP permission; optional `property_id`. Bound subjects use the one-active `platform.workspace_property_bindings` rule; unbound opportunities are allowed. | A mandate can apply only when the canonical property is present. Do not remove the unbound draft path or replace the existing route's authorization wholesale. AIRPROP owns its route and commercial records. |
| SERVICE request and quote publication | `supabase/migrations/20261004181358_service_request_persistence_v1.sql`, `20261005073529_service_quote_publication_v1.sql` | Workspace/module permission plus requester/beneficiary/provider checks; the request is tied to a catalogue revision, not necessarily a canonical property. | A property mandate cannot be inferred from a party, offering or quote. SERVICE owns the explicit subject link and its route. |
| Operations work orders | `supabase/migrations/20261004114654_work_order_context_authority.sql` and later authority slices | Existing property/building/unit target and effective permission; operational state and audit have separate guards. | Any new mandate gate must preserve target ancestry, dual control, record scoping and replay reauthorization. Core must not turn a mandate into a work-order approval. |

## Required first consumer contract

1. The caller pins `context_id`, `workspace_id`, canonical `property_id`, purpose, and a domain action. The server derives tenant and target ancestry from stored records. A missing canonical property follows an explicitly separate unbound path; it never silently acquires a mandate.
2. At command time, the server resolves the current mandate and independently enforces the native module permission, entitlement, target-specific effective permission, domain evidence and state, and visibility of the exact workspace-owned record. The returned mandate ID is never a bearer grant or client-controlled permission.
3. For a write, recheck current relationship and actor authority after any wait on a row or retry lock and before returning a prior idempotent result. Revocation must prevent a waiting command and its replay from committing or returning private data.
4. No existing v1/v2 customer endpoint is silently cut over while Production has no mandate issuance workflow or rows. The first consumer must be an explicitly reviewed domain route with migration/compatibility tests and a bounded authority issuance process. Legacy bindings remain active until each route is migrated.

## Synthetic release gate

| Case | Expected result |
|---|---|
| One property, two workspaces, distinct purposes and private records | Each authorized action sees only its exact workspace and purpose; no cross-workspace history projection. |
| Missing, future, expired or revoked relationship | Denied even if a user has a valid workspace role. |
| Active relationship but absent module, local permission, entitlement or evidence | Denied; mandate cannot substitute for the domain gate. |
| Valid module role but another tenant/property/workspace/record | Denied without disclosing target existence. |
| Revocation during lock wait or replay | No new write, no stale successful response, no unauthorized record return. |
| Unbound AIRPROP draft and property-free SERVICE request | Continue only through their explicitly authorized existing paths; no fabricated property authority. |

The two private Core foundations and this audit do not complete LC-C01 integration or T08. A real pilot authority row must cite an actual source and evidence; synthetic fixtures belong only in rollback tests. No pilot row, customer permission, document sharing or financial effect is authorized by this document.
