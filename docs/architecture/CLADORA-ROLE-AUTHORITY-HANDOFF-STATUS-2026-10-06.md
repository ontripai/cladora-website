# CLADORA role authority and handoff — delivery status

Date: 2026-10-06 UTC. Repository: `ontripai/cladora-website`.

## User-approved requirement

Workspace managers must be able to grant and remove subordinate roles, choose role validity within their effective authority, and transfer a role to a successor while preserving permitted historical continuity. This is shared-core policy for SERVICE and AIRPROP consumers.

## Verified status

| Area | Evidence | State |
| --- | --- | --- |
| Manager membership validity cap on new local-role assignment | PR #287 and migration `20261006080000_workspace_role_assignment_supervisor_validity_v1.sql`; branch CI green | Limited implementation only; PR remains Draft |
| Permission-set and target-scope containment for every granted permission | Not implemented in PR #287 | Pending |
| Dynamic re-evaluation when manager authority, role, context, membership, or scope changes | Current authorization Path B does not check grantor provenance | Pending |
| Bounded authority lineage, hierarchy model, and peer/superior rejection | Current schema has no formal role rank or assignment authority lineage | Pending |
| Explicit/no-expiry validity and renewals bounded by parent and access basis | Not implemented end-to-end | Pending |
| Atomic role handoff with immutable historical actor attribution | Issue #292; coordinate with Core LC-C03 transfer and workspace-scoped history APIs | Pending |
| SERVICE/AIRPROP consumers on a versioned shared contract | Not verified | Pending |

The live Production database was read as having 221 migrations, latest `20261006074812_lifecycle_core_identity_history_read`. None of PR #287's proposed changes has been applied in Production. The latest observed Vercel Production deployment is commit `36207a31d4b915360fd06c163eb4f89407a81b22` (PR #294 documentation update), READY. These production facts do not imply that subordinate role delegation or role handoff is implemented.

## Security and policy requirements

- A grantor must hold each permission being granted at the same or broader effective target scope. Deny precedence, AAL2, workspace/module/entitlement/contract gates, idempotency, lock versions, and audit provenance remain enforced.
- Self-escalation, equivalent/peer grants, superior grants, and unbounded authority chains are rejected.
- Loss, revocation, expiry, or reduction of parent authority blocks child authority on the next authorization decision without relying on scheduled cleanup.
- Child expiry and every renewal are capped by parent authority and all applicable memberships, contexts, role definitions, workspace access bases, and contracts. An open-ended child is permitted only when all applicable parent and access bases are open-ended. Commercial trial duration remains a separate concept.
- Role handoff atomically ends the old member's effective role and starts the successor's at the effective time, preserving the role, scope, and remaining permitted term. Previous actions, approvals, invoices, and document evidence remain attributed to their actual actor; future actions are attributed to the successor. History remains scope-authorized and read-only.
- Core LC-C03 temporal relationship/access-transfer and LC-C02 workspace provenance/history contracts are reused. No domain-specific parallel implementation.

## Required gates before marking complete

Add positive and negative database and application tests for permission/scope overreach, equal/superior grants, self-grants, manager expiry/revocation/reduction, bounded renewal, no-expiry conditions, AAL2, concurrency, stale versions, idempotent replay, audit lineage, atomic handoff, restricted history, and fresh actor attribution. Run clean migration application, pgTAP, application checks, and AIRPROP/SERVICE contract regressions. Update access control, user management, audit/history, UX, and test documentation in RO/EN/FA.

Keep PR #287 in Draft and do not run a Production migration until these gates pass and the work receives review. The linked implementation trackers are [#288](https://github.com/ontripai/cladora-website/issues/288) and [#292](https://github.com/ontripai/cladora-website/issues/292).
