# AIRPROP legacy workspace resolution review v1.0
Date: 2026-10-03
Parent: Shared workspace decision -02; draft PR #216.
Status: Review-plan tooling implemented. Application gateway and production resolution are not implemented.

## Purpose
Persisted workspace identity is required for customer opportunity reads and underwriting. Existing rows must not be assigned to a default workspace or whichever workspace currently owns their physical subject.
The planner accepts an explicit proposed mapping and authorized source export. It never infers a mapping, approves evidence, updates a record, connects to a database or emits business events.

## Invocation
`node scripts/plan-airprop-legacy-workspace-resolution.mjs authorized-export.json`
Redirect the JSON result to a controlled review location. Input/output may contain private commercial identifiers and reasons; do not commit customer manifests, exports or review results to the repository.
Tests: `node scripts/test-airprop-legacy-workspace-resolution.mjs`.

## Input v1
- version: 1.
- source: repository_commit (40 hexadecimal characters), captured_at (explicit timezone).
- opportunities: id, tenant_id, workspace_id, property_id, created_at, and complete source snapshot fields needed to detect a stale record.
- workspaces: id, tenant_id, lifecycle_status.
- properties: id, tenant_id.
- bindings: id, tenant_id, property_id, customer_workspace_id, valid_from, valid_to.
- proposals: opportunity_id, workspace_id, requester_id, reviewer_id, evidence_document_version_id, reason.

Use complete authorized binding history for the included subjects. A partial export cannot establish absence of conflicting history. The tool cannot verify completeness, source authenticity, document access or actor permissions; live application must verify them.

## Decision matrix
| Condition | Review output |
|---|---|
| Already persisted workspace | already_scoped; never proposes relocation |
| No explicit mapping | blocked |
| Workspace missing, tenant mismatch or inactive | blocked |
| Missing independent requester/reviewer or evidence/reason | blocked |
| Subject absent | blocked; explicit workspace-native resolution contract required |
| Physical subject tenant mismatch | blocked |
| No unique binding at opportunity creation time | blocked |
| Historical binding identifies another workspace/tenant | blocked |
| All structural checks pass | review_candidate, never approved |

Binding validity uses a half-open interval: valid_from <= created_at < valid_to. Current binding alone is insufficient. Superseded historical bindings can provide a structural candidate if their historical interval matches; status and provenance still require live evidence validation.
The result contains deterministic input/plan hashes and a record snapshot hash. Hashes detect content changes; they are not signatures or proof of authorized provenance.

## Required application command
This remains a specification, not an existing endpoint:
1. Authenticate at AAL2; require an explicitly registered resolution permission and independently authorized reviewer. Ordinary opportunity.manage alone is insufficient authority to resolve confidential historical ownership.
2. Load only records within validated tenant authority. Verify opportunity remains unresolved and snapshot matches the reviewed source.
3. Resolve proposed workspace through canonical core authorization. Validate document-version access through the shared evidence gateway and verify historical provenance.
4. Lock opportunity and relevant binding evidence; recheck state and authority inside the transaction. Reject stale source, concurrent resolution and any workspace/tenant mismatch.
5. Persist workspace identity once; write before/after resolution audit, actor/reviewer, reason and evidence-version reference atomically.
6. Return an idempotent confirmed result only if scope/evidence match. Reject conflicting retry and never relocate already scoped records.
7. Emit no agreement, booking, right, access grant, invoice, payment or financial posting merely from historical resolution.

Only the eventual authorized gateway may apply the plan. A review_candidate is not executable approval. Production inventory and historical verification precede release. Unbound rows remain preserved and unavailable until the workspace-native authority contract exists.

## Validation
25 standalone checks cover explicit mapping, tenant/activity/evidence/independence, unbound scope, historical intervals and ambiguity, current-versus-historical bindings, deterministic hashing, stale snapshots, duplicate/unknown proposals and already-scoped preservation. CI executes the planner tests alongside AIRPROP scope regression. Existing SQL regression count remains 182; standalone checks are a separate suite.

Malformed subject-binding history also blocks a review candidate, even when another valid binding matches. Missing tenant/workspace identities, invalid timestamps, zero-length and reversed intervals must be corrected in the authoritative source before review. This prevents silently discarding malformed companion evidence.
