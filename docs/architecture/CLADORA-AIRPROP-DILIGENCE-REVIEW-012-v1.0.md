# AIRPROP diligence evidence and review 012

2026-10-04. Baseline main #246 `95ce60d95fc0b2f3784229be05faf104685ba3e6`, preserving independently merged SERVICE #245 and Operations #246. Extends #244 immutable initial drafts; does not repeat their migration or rewrite cases.

## User flow

The existing AIRPROP opportunity/evaluation page now includes diligence. An authorized actor selects an evaluation baseline, creates its draft, chooses an explicit physical document context and edits the legal/financial/technical checklist and findings. Save appends a revision. Submit records the complete exact revision for review and makes that baseline read-only. A newer evaluation starts a separate case. Submission does not approve an acquisition or move funds, signatures, titles or ledger entries; these remain under the existing human/dual-control approval ceiling.

EN, RO and FA/RTL copy, explicit selections, server permission flags, stale baseline warnings, accessible labels/status messages, pending-request recovery and exact retries are included. Unsaved edits cannot be submitted. Network uncertainty retains the original key and payload; confirmed version conflicts clear that request and reload server state. Scope changes remount the editor and ignore late responses. Corrupt/unavailable session storage fails closed.

## Authority and evidence

`airprop.diligence.manage` authorizes edits. A separate nondelegable AAL2 `airprop.diligence.submit` binding authorizes submission. The exact module manifest now has seven actions. No base/local role, assignment, workspace activation or entitlement is granted by the migration. All operations reuse current native authority and opportunity target gates; mutations reauthorize after opportunity/case/document lock waits, including exact replays.

Evidence uses immutable `documents.document_versions` IDs with relational foreign keys per review revision, never generic tenant links or object paths. The explicit document context must belong to the same authenticated actor. The existing `documents.authorize_download_internal` and Vault actor resolver independently enforce exact membership permissions, classification and physical scope. AIRPROP additionally requires an active property binding and Documents module/entitlement on the selected workspace, same tenant, active nondeleted document, verified evidence by an independent verifier at or after the referenced version creation, verified checksum and a matching immutable clean ClamAV attestation. No document resolver, shared entity allowlist, scanner or Storage ACL is widened.

New edits and submissions require current document versions; old authorized clean verified evidence can still be read historically, with readiness false after a newer version. Historical selected references are labelled for replacement. Revoked document access prevents reading the snapshot and replaying mutations. Evidence selection shows only currently authorized verified versions and bounded metadata, without paths/hashes or signing. The existing Vault download gate records access checks. A submitted review is a historical snapshot, not an evergreen claim that its evidence is still accessible/current.

## Persistence and transitions

Initial cases remain unchanged/immutable. `diligence_revisions`, `diligence_revision_evidence` and `diligence_submissions` are RLS enabled with all client table privileges closed. Revisions/evidence/submissions cannot be updated/deleted. Each baseline can be submitted once. Existing finding IDs and severity cannot disappear/change in subsequent revisions. Resolution needs nonempty text and verified evidence; open blocking findings stop submission. Policy v1 requires exactly legal/financial/technical, all satisfied with evidence. Underwriting version, revision and policy are checked freshly at submission. Submitted revisions reject edits and new submission keys. Atomic audit/outbox/idempotency records contain metadata, not finding text or document contents.

`/api/customer/v2/airprop/diligence/review` GET/POST and `/evidence` GET require authenticated claims, strict/duplicate-free inputs and private/no-store headers. Mutations require trusted origin, JSON and a bounded 512 KiB body. Direct RPC inputs are independently validated, including fixed checklist, unique canonical IDs, strict finding structure, bounded text and exact optimistic revision. Retries remain actor-bound, content-bound and resource-bound.

## Validation and release evidence

Dedicated compiled route tests, mounted React state-machine tests in all three locales, actual isolated native/Vault/AIRPROP SQL tests and full-chain pgTAP fixture 149 exercise complete checklist/finding remediation/submission and denial paths. Isolated admin fixture uses the actual Vault resolver/download/scope functions; unused relationship branches fail closed with explicit mocks. Full Supabase pgTAP runs all canonical relationships and scanner/verification gateways. A second real PostgreSQL connection checks a waiting submission replay after concurrent document permission revocation. Hosted exact-head CI and production migration/deployment identity must be reconciled before merge. Independent Operations #247 was incorporated during validation; its pgTAP fixture 148 is preserved and AIRPROP uses distinct 149. These tests are not a live production customer acceptance claim.

## Production migration identity

After actual isolated SQL, two-connection tests and the complete hosted migration/pgTAP/concurrency suite passed, the unchanged SQL was applied once through Supabase apply_migration. The recorded version is `20261004123006`, SHA-256 `6a651708eff4a0fe613e16f3a9ec016efa5d59993aa8403636540d9482e7cf5b`. The CLI draft filename is aligned to the recorded version without SQL changes or history rewrites.

Scoped remote security-advisor review: [RLS without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is informational for intentionally closed client tables. [Authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) is expected for explicitly granted, guarded customer gateways; private helpers are closed. Remote ACL checks confirm authenticated save execution, denied anon submission and denied direct customer/service-role table access. This is not a clean-global-advisor claim; unrelated findings are outside this slice.
