# CE012 provider bridge v0.1

Status: contract/test-only inactive bridge. Production Guide editing remains disabled.

The bridge consumes the Core-owned `CurrentAuthorityTransactionalPortV1` from `CORE-AUTH-TX-PORT-06` and the Documents-owned immutable selector contract from `DOCS-CE012-REF-01A`. It creates no authority evaluator, observation, store, cache, projection, document resolver, receipt ledger or runtime provider.

## Inputs and ownership

The existing `core-ce012-map-decision.v1` supplies server-owned actor, membership and entitlement context. This preflight decision never authorizes a write. An allowed preflight must be followed by `CurrentAuthorityTransactionalPortV1.recheckAfterLock` in the command transaction. The canonical Core receipt determines the authority outcome used by CE.

The runtime supplies only the expected authority version and canonical transaction/aggregate-lock context. The Bridge derives the Core request from the Guide command and requires:

- exact Context and Workspace;
- exact command ID;
- `aggregate_type=experience_guide` and `aggregate_id` equal to the exact Guide ID;
- positive Core-owned authority version;
- `experience.guide.manage`, `experience_guides` and `experience.guide.command`;
- a transaction-bound Core receipt whose complete request and lock binding matches.

Documents receives the exact Context, Workspace, Guide, document ID, immutable `document_version_id`, positive document version and evaluation mode. Only an authorized selector decision may release `safe_label`. The Guide version remains bound by `ce012-guide-command.v1` and is included in the Bridge binding with the Core authority version and immutable document version.

## Fail-closed sequence

1. Validate the command and exact Guide aggregate lock.
2. Read the bounded Core command/entitlement context.
3. Invoke the canonical Core current-authority transaction port after lock.
4. Stop on any denied or mismatched receipt.
5. Invoke Documents only after canonical Core allow and active entitlement.
6. Return provider decisions and exact binding to the pure CE command evaluator.

| Outcome | Documents called | CE command result | Mutation plan |
| --- | --- | --- | --- |
| Canonical Core allow + current immutable target | Yes | `OK` | Produced only by the pure command evaluator |
| Revoked, cross-Workspace, stale authority or canonical denial | No | `AUTHORITY_DENIED` | None |
| Core provider error or unknown commit state | No | exception / abort | None |
| Stale immutable target | Yes | `DOCUMENT_STALE` | None |
| Missing immutable target | Yes | `DOCUMENT_NOT_FOUND` | None |
| Any command, lock, receipt or selector binding mismatch | Stops in Bridge | binding error | None |

The Bridge exposes no write or commit port. Actual atomic persistence, idempotency, audit, outbox and unknown-commit reconciliation require a separate runtime package and review. Every retry must obtain a new transaction-bound Core receipt as required by the canonical Core contract.

Production remains closed: `CustomerExperienceGuidePage` passes `commands={null}` and the client projection returns `can_edit: false`. This package adds no API, SQL, migration, provider implementation, command activation or runtime write.
