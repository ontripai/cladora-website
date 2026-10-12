# DOCS-CE012-REF-01A — immutable reference contract candidate

Status: local contract/test candidate for Documents owner review. Community & Experience defines the consumer requirement; Documents retains canonical ownership of document identity, immutable versions, visibility and `safe_label`. Core retains canonical ownership of authenticated Context, Workspace and current authority. This package provides no selector implementation, resolver, document store, authority engine or persistence.

## Request

`docs-ce012-reference-request.v1` is a strict server-to-server request. It contains:

- exact `context_id`, `workspace_id` and consuming `guide_id`;
- `target.document_id`, immutable `target.document_version_id` and a positive JavaScript-safe `target.document_version`;
- `evaluation_mode=new_command|replay`.

The authenticated actor and authority cannot be supplied in the request. Documents evaluates access through the current server session and canonical Core/Documents paths.

## Decision

`docs-ce012-reference-decision.v1` echoes the exact Context, Workspace, Guide, target and evaluation mode. It adds a server-owned `decision_id`, `authority_basis=current_server_session`, `decision` and `evaluated_at`.

- `current_authorized` is valid for a new command and returns only `safe_label` with `redaction=safe_label_only`.
- `historical_authorized` is valid for exact-version replay and returns the same bounded projection.
- `stale`, `denied`, `not_found` and `not_ready` require `safe_label=null` and `redaction=none`.

The strict schema rejects object paths, bucket names, hashes, MIME type, classification, owner/tenant identity, storage keys and every undeclared field. All versions are positive integers no greater than `Number.MAX_SAFE_INTEGER`; timestamps require an offset-aware ISO datetime.

## Ownership and execution

The contract is read-only. Provider acceptance compares a mutation digest before and after every evaluation, including allowed and denied results. A Documents implementation must deny cross-Workspace, stale/mutable target and revoked access without writing a Guide, receipt, audit, outbox, idempotency row or Documents state.

CE consumes the decision through `ce012-guide-command.v1`; it does not derive edit authority from document visibility. Documents does not acquire Guide ownership by echoing `guide_id`. The public Guide remains `commands=null` and `can_edit=false` until an owner-approved Provider implementation and separately authorized CE runtime wiring exist.
