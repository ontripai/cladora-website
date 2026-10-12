# CE012 editor adapter v1 — local candidate

Status: local/test-only. The module exports factories and types only. It registers no Provider, command, route or singleton and is not imported by the production Guide page.

## Injected boundary

`createCe012GuideCommandExecutor` requires three explicit ports:

1. Core evaluates the strict `core-ce012-map-request.v1` request and returns `core-ce012-map-decision.v1`.
2. Documents evaluates `docs-ce012-reference-request.v1` only when current Core authority and entitlement allow the command and the payload has a document target. It returns `docs-ce012-reference-decision.v1`.
3. The CE runtime loads the Guide/idempotency snapshot and commits an already evaluated mutation plan atomically.

There is no default implementation. Missing dependencies cannot produce an executor. The adapter creates no authority evaluator, target selector, document store, receipt ledger, SQL or migration.

The executor parses the command, obtains a current Core decision, loads the exact Guide/replay snapshot, obtains an exact immutable document-version decision when allowed, and evaluates `ce012-guide-command.v1`. It calls `runtime.commit` only when the evaluator returns a mutation plan. Denial, stale state and replay therefore make no commit call. A returned commit receipt must match the planned receipt exactly; any mismatch fails closed.

## Save, retry and completion

`createCe012GuideEditorAdapter` implements the existing `saveDraft` shape through an injected command builder and active editor identity reader. The builder is the future integration point for accepted Core/Documents/CE runtime data; this candidate supplies none in production.

- Concurrent identical submissions share one in-flight promise. A different submission while one is pending fails closed.
- A transport or unknown-commit failure retains the exact command, payload fingerprint and idempotency key for retry.
- A retry first resolves the runtime replay record. A replay returns its original receipt and does not call commit.
- A bounded stale/denied result clears the retained command so a later user action can rebuild against refreshed server state.
- Workspace or Guide identity is checked before Provider calls and after completion. A late completion from an abandoned editor is discarded.
- The Documents-owned `safe_label` replaces browser label copy in both the receipt and committed plan.

## Local harness

The harness uses explicit in-memory test ports only. It covers successful save, failure before commit and retry, unknown commit and replay, stale Guide, stale document, revoked authority, pre-call Workspace mismatch, Workspace switch during an in-flight command, late completion and mounted success feedback in RO/EN/FA. It verifies revoked authority skips Documents and all denial paths make zero commit calls.

The real customer path remains read-only: `CustomerExperienceGuidePage` passes `commands=null` and `toExperienceGuideView` returns `can_edit=false`. Runtime activation requires accepted implementations of `CORE-CE012-MAP-01` and `DOCS-CE012-REF-01A`, a separately reviewed atomic CE runtime port and an explicit production wiring task.
