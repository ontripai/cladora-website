# CE012 Guide command contract v1 — local candidate

Status: local contract candidate; runtime activation is blocked on `CORE-CE012-MAP-01` and `DOCS-CE012-REF-01A`.

The `ce012-guide-command.v1` save command binds the exact Context, Workspace, Guide and expected Guide version to its payload fingerprint and idempotency key. A named document target binds both the document identity and immutable `document_version_id`. Authority and entitlement outcomes come only from `core-ce012-map-decision.v1`; exact document-version access and its redacted `safe_label` come only from `docs-ce012-reference-decision.v1`. Both decisions echo the Guide binding. The receipt and mutation plan use the Documents-owned safe label rather than trusting browser copy. The command cannot submit either decision, a receipt identity, a resulting version or an evaluation timestamp.

The evaluator is a pure transaction-planning boundary. A new accepted command returns one mutation plan and a server-issued receipt. Any denial returns neither. A replay returns the original receipt and no new mutation. Storage, locking, audit, outbox and idempotency persistence remain provider/runtime responsibilities; this candidate creates none of them.

| Scenario | Required outcome | Mutation plan |
| --- | --- | --- |
| Same key, same fingerprint, current Core decision and current/historical exact document authorization | Original receipt, `replayed=true` | None |
| Same key, changed payload/fingerprint | `REPLAY_CONFLICT` | None |
| Supplied fingerprint differs from server recomputation | `PAYLOAD_FINGERPRINT_MISMATCH` | None |
| Current Guide version differs from expected version | `STALE_GUIDE` | None |
| Exact document identity/version differs or is stale | `DOCUMENT_STALE` | None |
| Context or Workspace differs in any provider result | `WORKSPACE_MISMATCH` | None |
| Authority revoked/denied or entitlement inactive | bounded denial | None |
| Provider is not ready | `PROVIDER_NOT_READY` | None |
| Unknown commit followed by retry | Original receipt after server idempotency lookup | None on retry |
| Completion after Context, Workspace or Guide switch | ignored by exact editor identity guard | None in abandoned editor |

Runtime must re-evaluate current Core authority and the exact document version before returning either a new result or a replay. It must atomically lock the Guide and idempotency binding, compare the server-computed fingerprint, persist the Guide update, receipt, audit and outbox records, and commit once. A transport failure does not authorize a blind resubmission: the retry uses the same key and payload and resolves through the stored receipt. No SQL, migration, API adapter or browser command is part of this candidate.

The public Guide page remains read-only. `commands=null` and `can_edit=false` are required until both providers and a separately reviewed runtime adapter exist.
