# CLADORA SERVICE catalogue management 004 v1.0

Decision: `CLADORA-ARCH-SERVICE-CATALOG-MANAGEMENT-20261003-01`.

## Confirmed baseline

Persistence/API (#222) and three-language discovery/definition commands (#225, `3df2846a88738cc1875c105062667ff4c1c7cdca`) are merged. This package continues from `7a572ae5679be00ec7c368c3653345a318dbe54c` and preserves #226 shared audited role assignment and #227 PostgreSQL UUID fixes. Temporary workspace recovery produces a new commit identity; earlier test results must be rerun against the recovered source.

## Behavior

Management is an explicit tab for the selected native workspace. RO/EN/FA forms create definitions and draft offerings, revise commercial terms, submit for review, publish through a separate approver, suspend and archive. Published commercial versions remain immutable while later drafts retain separate current/published pointers. Amounts remain decimal strings. Secure document links remain fail-closed until their canonical access contract is integrated.

The management read RPC independently checks current manage/publish permissions on every call. Only managers receive active tenant provider IDs and legal names. Publisher-only readers receive no provider list. No actor, tenant, tax/contact fields are projected. Cursor pages contain at most 50 offerings with all their revision history.

Definition edits accept localized labels, active status, expected version, reason and idempotency key; code is immutable. Authority is resolved server-side before replay. Updates atomically increment lock version, write audit/outbox and persist retry responses. Deactivation hides consumer publications without deleting history. Offering creation and publication take a shared lock on their definition row, serializing against deactivation and rejecting inactive definitions.

Forms use the canonical context/workspace tuple. Context/workspace changes unmount the management view and abort pending requests; late reads/writes cannot restore stale content. Pending commands disable duplicate submission. Retrying an identical action after a lost response retains its idempotency key. No commercial data is persisted in browser storage. UI capability flags are hints; SQL rechecks authorization.

## Verification and release

Tests exercise actual SQL with a bounded authority fixture, actual Next handlers and mounted React components across all three languages. Disposable PostgreSQL CI also exercises independent-connection idempotency, stale writes and definition deactivation races. Native-core suites remain responsible for the canonical resolver itself.

Shared core migrations have been coordinated by the parallel AIRPROP work under generated remote timestamps. Do not independently reapply core migrations or repair their history. SERVICE migrations require a coordinated database release before production activation. This package changes only SERVICE files and its dedicated workflow; no shared role engine, AIRPROP, building operations, package dependencies or production data are changed.

Production provisioning, activation and module entitlements still need confirmation despite the merged role-assignment flow. Orders, reservations, service reception and benefits are subsequent work, outside this catalogue package. Publication as a Draft PR is not production deployment.
