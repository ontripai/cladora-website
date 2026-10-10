# Core consumer dependency conformance v1.0

Package: `CORE-CONSUMER-DEPENDENCY-CONFORMANCE-01`, under `V14-CORE-01`.
Owner: Core/Platform. Acceptance: Documentation & PM and the affected consumer.
Observed: 2026-10-10. This is a consumer verification/handoff slice of the v1.4
minimum shared contracts, not a new runtime resolver or authorization system.

## Recovered checkpoint

The last published Core contract delivery is Draft [#353](https://github.com/ontripai/cladora-website/pull/353),
`83d5ae14e6c67e93bd8f3a383c89d63f28912152`, based on #351 at
`777563e60a8880ea2853e2cd65f33c494042c811`. All 16 checks present on #353
were successful. That establishes a reviewable delivery, not acceptance.
The current main is `c0c82133d4a6ef95800c72b9f155fb9a65ae1822`; its existing
Vercel Production deployment `dpl_3EzmFxn7694Pik99EA8RWG7amViW` is READY.

Existing independent deliveries must not be recreated:

| Output | Draft PR | Published commit |
| --- | --- | --- |
| DW-01A / minimum C01-C03 | #316 | `8388f657d948def379a9cd184b484b17ce224c75` |
| DW-01B configuration | #345 | `479ef7b5e489578079d6bfb3636a1d1035f69a9e` |
| DW-02 resource/relationship/valuation schemas | #326 | `ad23747815b1ba60d0fe8a54ed98ab659f24ce3a` |
| PC-01 typed rights | #327 | `a20a21842772fbf06a90d6277c6b3f602c13b87b` |
| PF-01 projection | #330 | `3f6dece9176993c1c7486fb441ed02578d28c127` |
| AUTH-01 decision contract | #331 | `1ef309011bd75cc0a7ffd3075a0b9f56d277c0b2` |
| COM-01 request/receipt | #335 | `a88a662a35b8069788ded6cb8c4f272940997e15` |
| FIN-01 proposal/posting receipt | #336 | `b25a70fa606afd2ab4e16a41c177c3e1641be3cd` |
| OPS-01 execution receipt | #337 | `1ce4cf197dc9f4e68c88dacff2a1193eff643f69` |
| BK-01 shared capacity contract | #339 | `fbaa9401fd462c277878d252c3723a6815840e31` |

Every check present on these PRs succeeded at observation; the registered check
sets differ by changed paths. A green contract check is not runtime adapter evidence.
The AP10 fixture in #351 already exists. This slice neither changes nor runs Auth.

PM01-A #322 merged as `1f5eae0e317f6b94b44a7ea974920e1a0ec5f60c` and
PM01-B #323 merged as `10109bba4d172a09740d8e41b3e0f47cd935e4f6`.
PM01-RUNTIME-01 #324 remains Draft, head
`24bda62cc77db587c23d068960c3a313f859e874`, with 17 successful checks.
Its proposed hard-disabled runtime is not inferred to be operational from the
existing PM reporting gateway.

Read-only Remote migration inventory returned 241 entries, ending with
`20261008133128 pm01_private_oversight_registry`,
`20261008140108 pm01_work_report_gateway`,
`20261009080629 pm01_oversight_completion` and
`20261009080815 pm01_monitor_schedule`. These names do not establish installation
or acceptance of #324's distinct proposed runtime migration.

## PM reconciliation

The private binding files exist. No previous local request/receipt files were
present in the recovered binding directory. The status gateway exposes package
versions and latest reports, but no previous request ID/receipt ID; those IDs are
unavailable and must not be invented. All package cycles below were 1.

| Package | Version | Official stage | Latest reported stage |
| --- | --- | --- | --- |
| AUTH-01 | 3 | planned | tested |
| BK-01 | 2 | planned | planned |
| C01-C03 | 6 | planned | in_review |
| COM-01 | 2 | planned | planned |
| CORE-AP-VAL-INPUT | 2 | planned | planned |
| DW-01A | 8 | planned | in_review |
| DW-01B | 3 | planned | tested |
| DW-02 | 2 | planned | in_progress |
| FIN-01 | 2 | planned | planned |
| OPS-01 | 2 | planned | ready |
| PC-01 | 2 | planned | planned |
| PF-01 | 2 | planned | ready |
| PM-CONNECT-CORE | 2 | planned | tested |
| V14-CORE-01 | 9 | in_review | in_review |

The report ledger predates several published deliveries. In particular DW-01B's
old local commit and transfer blocker are superseded by #345's reconstructed,
published source. Keep the original report as history. Submit new evidence using
the live expected version and a fresh request ID; a duplicate write or version
change requires a hard stop and a fresh status read.

## Exact consumer handoff

Import the strict request/output schemas and `evaluateCoreResourceAuthorityV1`
from `src/lib/core/resource-authority-contract-v1.ts`. The resource and relationship
schemas live in `src/lib/core/resource-contracts-v1.ts`; authority request/decision
schemas live in `src/lib/core/workspace-authority-decision-v2.ts`.
Consumers can pin #353's full commit until its stack is accepted and merged.

| Consumer | Delivered output | Remaining bounded gate |
| --- | --- | --- |
| AIRPROP AP10 | `core-resource-authority.v1`: canonical property identity/version, exact current management relationship/scope/interval and status-only authority reference; `airprop.asset.read` with `airprop_commercial` | Accepted canonical server evidence adapter and consumer integration. No automatic mandate, user, grant or route enablement. |
| AIRPROP AP-VAL | DW-02 `resource-valuation-input.v1`: versioned source/relationship/features with missing-vs-zero and disclosure | Consumer acceptance/integration; no Core valuation model or market connector. |
| SERVICE S01 | `canonical-resource-reference.v1`; composed authority contract is reusable for a resource-linked path using its existing action permission/module | Canonical DW-02 resolver acceptance; Workspace-wide drafts remain independent. |
| SERVICE S02 | `provider-agreement-verification.v1` strict input/output | Canonical agreement verifier and publication acceptance; generic relationship evidence cannot replace an agreement. |
| SERVICE S03 | `geographic-coverage-resolution.v1` strict input/output | Approved geographic source/resolver; Workspace coverage remains independent. |
| SERVICE S04 | Existing transaction order and shared idempotency/audit/outbox in the minimum consumer contract | Domain-owned atomic write, current replay checks and real database evidence. |
| CE basic Event | C01/C02/C03, `ce.event.basic`, `community_events` and existing `events.*` permissions | CE owns audience/lifecycle/persistence. Basic Event does not require DW-02, BK-01, SERVICE or Finance. |
| CE optional resource-linked extension | Reusable `core-resource-authority.v1` bounded resource/relationship result | Exact accepted resource relationship and domain audience policy; no new prerequisite for basic Event. |

Context, Workspace and permission must match across the request. Evidence is
server-derived at one evaluation timestamp. On denial, clear Resource and
Relationship output; do not carry old Workspace display state into a new context.
Current action authority must be checked again for each command or replay.
A status-only reference is never a command grant. No consumer may create parallel
identity, tenant, Workspace, permission, relationship, audit or outbox stores.

## Executed verification

`npm run test:core-consumer-conformance` exercises 33 synthetic cross-consumer cases:
exact allow, inclusive start/exclusive end, Workspace switch with old evidence,
authority-only refresh, cross-domain permission/module substitution, revocation
after an earlier allow, resource/relationship version change, tenant mismatch,
explicit deny precedence, immutable history and redaction of private references.
Both person and company relationship parties are covered. `consumer_read` is a
synthetic fixture scope, not a registered mandate or production policy.

The suite runs the existing evaluator without database, network or Auth access.
It is part of `test:unit`, so the existing Application Foundation gate runs it.
This proves contract conformance; it does not prove S01/S02/S03 runtime resolvers,
database zero-write behavior, CE audience policy or E2E consumer integration.

No new runtime contract version, migration, endpoint, central manifest, acceptance,
merge or release is introduced. Branch cleanup waits for separately confirmed merge
and applies only to Core-owned branches.
