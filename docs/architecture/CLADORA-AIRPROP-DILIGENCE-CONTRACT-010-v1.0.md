# AIRPROP diligence contract 010

2026-10-04. Baseline main `14456eb` includes underwriting acceptance #241 and independently merged contractor registration #240. Scope: executable domain contract and synthetic behavioral checks. No deployed diligence API, table, UI, permission catalogue or approval capability is claimed.

## Reuse and integration findings

| Requirement | Authoritative existing record | Integration requirement |
|---|---|---|
| Opportunity scope | airprop.investment_opportunities.workspace_id | Reuse native workspace authority, mandatory AAL2, exact opportunity scope and current permission checks |
| Evaluated baseline | airprop.underwriting_cases / underwriting_versions | Pin case and exact immutable version; lock/recheck current version before every transition |
| Evidence bytes | documents.document_versions | Store immutable version IDs; validate parent, tenant, scope, classification, malware status and checked download access separately |
| Evidence links | documents.document_links; customer_api.link_document_entity_v1 | Latest integrity resolver replacement in 20260909152426_building_assets_equipment_registry.sql has a closed cross-module allowlist; AIRPROP is absent. Add narrowly validated targets in one coordinated evidence PR; never bypass with platform.tenant links |
| Subscription contract | platform.workspace_contracts | Commercial subscription/entitlement record, not a property acquisition agreement; do not repurpose |
| Diligence cases/findings | No AIRPROP diligence aggregate in inspected migrations | AIRPROP-owned extension required after evidence target authorization and explicit action catalogue mapping |
| Effects | audit.events; platform.outbox_events; platform.idempotency_keys | Reuse atomically with versioned transitions; no second event bus or retry store |

## Executable contract

The snapshot binds workspace, opportunity, underwriting case/version, diligence revision and checklist policy version. Evidence contains document-version IDs only. Checklist and findings are bounded, strict and reject duplicate normalized identifiers. Required codes are provided by a server-owned versioned policy. Unknown or missing codes fail closed. A satisfied check or resolved finding requires evidence references and a resolution requires nonempty text. No waiver transition is defined in this slice.

The pure readiness assessment rejects stale evaluation/policy versions, incomplete checks and open blocking findings. Advisory findings remain part of the snapshot for human review. `ready_for_review` is neither approval nor proof that evidence is usable. A future gateway must resolve every evidence reference from freshly authorized database records, reject missing/rejected/pending/quarantined evidence, and compare exact workspace/tenant. This library must not become an authorization check over client-supplied snapshots or policies.

The review-command envelope contains only identities, expected revision/evaluation/policy versions and a retry key. Client-provided checklist, ready/approved flags, actor, scan status, document paths or policy cannot be accepted. A future database transaction must authenticate, require the dedicated action, enforce current native authority/AAL2, lock the opportunity and diligence case, authorize exact evidence, recheck versions and write the transition/audit/outbox/retry record atomically. Replays recheck current authority before returning immutable prior response.

## Next implementation slice

First map explicit diligence draft/review/approval actions and the shared evidence authorization dependency. Then add persistence and authenticated gateways with synthetic complete-chain SQL, cross-workspace, stale-version, malware, replay and two-session contention tests. Follow with RO/EN/FA UI and authorized live acceptance. Independent approval, acquisition, signature, money and right transfer remain separate transitions. This contract changes only AIRPROP paths and its own workflow; SERVICE, Operations, shared document resolver and production data are untouched.

## Previous acceptance retained

#241 production READY at `f7e1b5a234e68e862b129b16b26a8ca5bf817aef`. Actual authenticated Persian UI created synthetic opportunity `fc55e258-a95f-4ada-9370-12b82c8e3258` and case `e2da4030-a886-4364-9762-4ebe78630e02`. Saving version 1 changed Draft to Underwriting without refresh/reload. Read-only SQL verified the authorized actor, annual NOI 7000.0000 EUR, gross yield 0.08000000 and net yield 0.07000000. Completed branch was deleted through normal restorable GitHub deletion. This historical proof is not a diligence production test.
