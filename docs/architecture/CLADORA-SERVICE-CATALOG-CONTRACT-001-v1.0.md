# SERVICE catalogue contract 001 — implementation boundary

The strict commands, revision transition planner, authorized-row projection and retry descriptor are implemented in this package. They are infrastructure for the catalogue, not a deployed service catalogue or a permission engine.

Commands require explicit context_id and workspace_id. Runtime consumers must use the merged shared-core PR #221 tuple resolver and canonical native permission adapter on every request and retry. Physical grants and tenant membership cannot substitute for explicit Workspace scope. Catalogue mutations must validate module permission, definition/provider/document references, current revision, business approval and temporal eligibility before a write.

The retry descriptor targets the existing platform.idempotency_keys table. The RPC must derive current identity, verify the payload fingerprint under its authoritative canonical serialization, atomically claim the key, compare actor/hash, persist domain data plus audit/outbox and response in one transaction. A read-then-insert-with-on-conflict-do-nothing sequence does not authorize a second execution. Fingerprint tests are not proof of concurrent persistence.

Published revisions are immutable snapshots. Validity is half-open. A future-dated publication stays hidden before its start. Price strings reuse the canonical currency configuration; fixed amounts enforce currency precision, unit rates retain precision for shared-finance rounding. Customer projection is permitted only after authorization and eligibility; it excludes document IDs and private internal fields.

Verification: 90 tests execute the actual TypeScript source. Dedicated CI checks these scenarios, focused lint, whole-application TypeScript and existing unit tests. No route, domain SQL migration, local database concurrency or catalogue UI is delivered by this package. Full delivery requires the five SERVICE packages described in #217 and their shared prerequisites.

PR #221 is merged as 836bd84a1cb933f4b36d62c6d42397bd95b7847d. The production migration history inspected on 2026-10-03 has 184 entries and does not yet contain the three 2026-10-03 shared-core migrations. This record does not certify production database deployment. Branch cleanup follows confirmed merge.
