# CE012 provider acceptance kit v1

Status: local/test-only acceptance candidate. It creates no provider, authority engine, selector, persistence, API, SQL or migration. Public Guide editing remains disabled.

## Provider contracts

`CORE-CE012-MAP-01` consumes `core-ce012-map-request.v1`. The authenticated actor is implicit and cannot be supplied in the request. The request binds `context_id`, exact `workspace_id`, `guide_id`, `save_draft`, `experience_guides`, `module.experience_guides` and `experience.guide.manage`. Its strict `core-ce012-map-decision.v1` response echoes that binding and adds only server-owned decision identity, actor/membership identity, current authority, current entitlement and `evaluated_at`.

`DOCS-CE012-REF-01A` consumes `docs-ce012-reference-request.v1`. The authenticated actor is implicit. The request binds Context, exact Workspace, Guide, `target.document_id`, immutable `target.document_version_id`, positive JavaScript-safe `target.document_version` and `new_command` or `replay`. Its strict `docs-ce012-reference-decision.v1` response echoes that binding and records `authority_basis=current_server_session`. An authorized decision returns only `safe_label` with `redaction=safe_label_only`. A denial returns `safe_label=null` and `redaction=none`. Object paths, buckets, hashes, MIME type, classification, owner/tenant identity and all other metadata fail schema validation.

Both Provider evaluations are read-only. The adapter's mutation digest must cover provider/domain rows and shared receipts, audit, outbox and idempotency state. The runner compares the digest before and after every scenario; any write fails the kit.

## Required adapter

Provide a local ESM module exporting `adapter` or `default` with exactly these asynchronous methods:

```js
export const adapter = {
  async arrange(scenarioName, fixture) {},
  async evaluateCore(coreRequest) {},
  async evaluateDocuments(documentsRequest) {},
  async mutationDigest() {},
};
```

`arrange` may prepare a disposable test fixture. `evaluateCore` and `evaluateDocuments` call the implementation under review and return its bounded decision object. `mutationDigest` returns a deterministic JSON value representing all state that a Provider evaluation could mutate. Fixture arrangement is outside the before/after zero-write window.

Run:

```sh
CE012_PROVIDER_ADAPTER=./path/to/provider-adapter.mjs \
  node --experimental-strip-types scripts/run-ce-012-provider-acceptance-kit.mjs
```

A passing process returns:

```json
{"contract":"ce012-provider-acceptance-kit.v1","scenarios":9,"compatibility_checks":4,"result":"pass"}
```

## Exact scenario matrix

| Scenario | Arrangement | Required decision |
| --- | --- | --- |
| `core_current_authority` | Active actor membership in fixture Workspace; module, entitlement and manage permission current | `authority=allowed`, `entitlement=active` |
| `core_revoked_authority` | Same membership revoked before evaluation | `authority=revoked`; zero write |
| `core_inactive_entitlement` | Current membership, inactive Guide entitlement | `entitlement=inactive`; zero write |
| `core_cross_workspace` | Actor is authorized only in fixture Workspace; request names the other Workspace and Guide | `authority=denied`; exact requested scope echoed; zero write |
| `docs_current_immutable_version` | Exact immutable version is current and visible in the fixture Workspace | `current_authorized`, bounded safe label only |
| `docs_historical_replay` | Exact immutable version is historical but still visible; evaluation mode is replay | `historical_authorized`, bounded safe label only |
| `docs_stale_or_mutable_reference` | New command asks for a replaced version, or the implementation cannot prove immutable identity | `stale`, no label; zero write |
| `docs_revoked_authority` | Document access is revoked before evaluation | `denied`, no label; zero write |
| `docs_cross_workspace` | Document/version belongs outside the requested authorized Workspace | `denied`, no label or foreign metadata; zero write |

The runner also rejects missing or mutable version selectors, zero/unsafe versions, invalid timestamps, client-supplied actor identity and internal metadata. It then injects accepted and denied decisions into `ce012-guide-command.v1`. Accepted decisions must produce one save plan and a receipt using the Provider's redacted label. Revoked, stale and cross-Workspace decisions must produce no receipt and no mutation plan.

## Consumer boundary

The command contract consumes only the two bounded decisions. Core remains the authority and entitlement owner. Documents remains the document/version and safe-label owner. CE owns the Guide command and receipt. Provider decisions echo `guide_id` only as a request binding; neither Provider acquires Guide ownership or validates Guide persistence.

`commands=null` and `can_edit=false` remain mandatory until both implementations pass this kit and a separately authorized CE runtime package is reviewed.
