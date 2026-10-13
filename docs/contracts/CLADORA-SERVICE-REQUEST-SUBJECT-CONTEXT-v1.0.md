# service-request-subject-context.v1

This inactive SERVICE/Communications dependency provides a lockable canonical Request context. It does not link a subject, authorize a document/message, create another store/ledger, expose a route or activate a production consumer.

Migration `20261013062342_service_request_subject_context_v1.sql` adds bigint `service_catalog.requests.version`, default 1, NOT NULL, bounded to 1..9007199254740991. Existing rows receive version 1 without changing their prior fields; current create_service_request_v1 inserts omit version and continue to work. Existing quote writers lock/read Request rows and do not update them; their behavior is retained. Default version enables PostgreSQL's fast-default path; the ALTER still takes a table lock and its check validation scans the table. Apply timing requires independent deployment review.

Every actual row update requires exactly previous version + 1. Updating without an increment, skipping/backtracking versions, changing Request identity/tenant/Workspace, or inserting with a foreign Workspace/tenant is rejected. No-op updates preserve version. Writers must lock the canonical row and use the expected version (for example WHERE id=$1 AND workspace_id=$2 AND version=$3); incrementing from stale literal versions conflicts. There is no alternate revision store, audit/outbox table or trigger-ledger writer.

Internal function `app_private.service_request_subject_context_v1(context_id, workspace_id, request_id, expected_version)` resolves current canonical services.orders.read authority, locks the exact tenant/Workspace/current-requester/membership Request FOR SHARE, rechecks authority after lock acquisition and requires exact version. It locks/rechecks the beneficiary's current membership-party mapping and non-archived party. Unknown/foreign/other-actor Request yields bounded request_context_unavailable; stale version yields request_version_conflict; no source metadata is attached to errors.

The JSON output has exactly six top-level fields, validated by serviceRequestSubjectContextV1Schema:

- request_id: UUID
- request_version: positive safe integer
- workspace_id: UUID
- status: submitted (the canonical table's current status constraint)
- actor_party_snapshot: { party_id: UUID, current_actor_is_party: true }
- audience_party_snapshot: { party_ids: [same party UUID], request_party_only: true }

The conservative audience is the current Request beneficiary party only. It neither expands to the offering provider nor grants Communications audience access. This snapshot identifies the actor's existing membership-party relation for this own Request; it is not verified identity or an ownership grant. Party/authority validity is current and must be rechecked each transaction; a Request version is not an authority revision. No actor user ID, membership ID, description, name, payload, contact data, object path, URL or unrelated party data is returned.

The function is SECURITY DEFINER only to reuse the canonical private table/authority boundary, with explicit actor/request/Workspace checks and fixed pg_catalog search_path. Default PUBLIC EXECUTE and all anon/authenticated/service_role execution privileges are revoked. It has no customer_api wrapper or new grant. Future canonical provider use and runtime wiring require independent authorization. Core TX host owns its transaction; this function locks rows within that same transaction and creates no transaction manager.

Validation applies the actual migration to a dedicated disposable PostgreSQL 17 database containing the exact pre-migration Request table DDL and existing rows. Canonical authorization is a named test fixture; the new version/locking/projection SQL is real. Tests cover data-preserving backfill, unchanged insert default, strict/minimal snapshot, party/authority denial, foreign Workspace, stale versions, versionless updates, concurrent stale writer conflict, rollback, held-share lock and revoked function privileges. This is SQL/package evidence, not deployed provider or SERVICE runtime acceptance. Draft PR only; no Merge or Remote apply.
