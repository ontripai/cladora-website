# Core → AIRPROP review handoff v1.0

Packages: `AP10-AUTH-E2E-FIXTURE`, `CORE-RESOURCE-AUTHORITY-CONTRACT`.
Review status: **changes_requested** at reviewed heads #351
`777563e60a8880ea2853e2cd65f33c494042c811` and #353
`83d5ae14e6c67e93bd8f3a383c89d63f28912152`. Corrected heads require a
new head-bound Documentation & PM decision. CI and receipts are evidence only;
these packages are not accepted or ready_for_consumer.

## AP-PF02 companion mapping

Version: `ap-pf02-core-companion.v1`.
Implementation: `src/lib/core/airprop-companion-mapping-v1.ts`,
`mapAirpropCoreCompanionV1` over the existing
`owner-portfolio-projection.v1` canonical-resource item and
`core-resource-authority.v1` decision. No shared evidence version is replaced.

| Consumer field | Canonical source | Disclosure rule |
| --- | --- | --- |
| Resource identity/version | `canonical_reference` | Exact tenant, Workspace, type, ID and version; only after current authority + Relationship allow. |
| Safe Resource display name | `canonical_reference.display_name` | Bounded official name after allow; null remains unavailable, never an ID/private-record fallback. AIRPROP renders it as escaped text. |
| Person/company identity | `relationship.party_id`, `party_kind` | Explicit canonical person/company kind. A party display name is null until a separate current, authorized canonical Party resolver provides it; property authority alone is insufficient. |
| Representation | `relationship_kind=representation`, Relationship ID/version, party ID and Resource type/ID | Representative party and represented Resource are explicit. This does not infer a represented person's/company's identity, or grant software permission. |
| Context | request `resource.context_id`, `source.source_context_id` | Must be identical. A matching Workspace with another Context is withheld. |
| Workspace | request, canonical reference, Relationship and source Workspace | Must all match; changing Workspace requires fresh evidence. |
| Provenance classification/scope | `source_class`, `source_context_id`, `source_workspace_id` | Only official, same-Context/same-Workspace sources pass this adapter. Private/domain records need their own approved adapter. |
| Provenance reference | `source_reference`, `relationship.evidence_reference` | Never forwarded by this display adapter. It emits null references and only present/absent evidence status; source resolver/audit owner retains original references. |
| Authority | current Workspace-native v2 decision | Status-only; no internal assignment/delegation IDs, bearer grant or reusable command authority. |

Any malformed input, denied authority, tenant/Workspace/Context mismatch, stale
snapshot/version, missing scope, invalid/future/expired/revoked Relationship
withholds Context, Resource, party, representation and provenance together.
The adapter never reuses cached evidence to override a denial.

Party display-name resolution and concrete AIRPROP browser/runtime installation
remain consumer handoff dependencies. This mapping does not claim that those
resolvers, historical mandates, or every AP-PF02 screen are already implemented.
Historical AIRPROP/private entries remain historical evidence; no IDs, ownership,
mandate history or authorization are inferred or rewritten by this adapter.

## Temporal rules and regressions

Relationship intervals and evidence snapshots compare actual instants, including
equivalent valid offsets. Start is inclusive; end is exclusive; a zero-length or
reversed interval and non-finite/invalid timestamp fail closed. Null end is an
open interval. Required source snapshot instants must match request evaluation.

R1 cases are in `scripts/test-core-resource-authority-review-r1.mjs` and are wired
into both the dedicated contract test and unit CI. They cover offset order,
equivalent snapshots, invalid/future/expired intervals, person/company mapping,
representation, Context isolation, authority/tenant/Workspace/revoke denial and
identity/provenance redaction. No database migration is part of this handoff.

## Fixture and review path

AIRPROP follows `docs/testing/CLADORA-AP10-AUTH-E2E-FIXTURE-v1.0.md` for its
synthetic AAL2 inputs and lifecycle. #351 owns target identity preflight and
Auth/Core fixture cleanup. #353 owns the read contract and AP-PF02 mapping.
Each correction stays on its existing PR. AIRPROP supplies its own consumer
scenario and domain cleanup; fixture identity stays in memory and out of logs.

Core submits reviewed SHA → corrected head, diff summary, R1 results, lint,
typecheck and head-bound CI to Documentation & PM. The reviewer decides further
changes or acceptance. There is no automatic acceptance, new PR, merge,
production enablement, Remote migration or environment/secret change.

`DB-MIGRATION-HISTORY-RECONCILIATION-01` remains a separate Read-only Hard Stop.
Its PM01 provenance work and Recovery Plan are not part of either code PR.
