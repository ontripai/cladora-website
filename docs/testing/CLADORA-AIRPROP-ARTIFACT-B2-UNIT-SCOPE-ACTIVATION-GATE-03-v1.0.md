# AIRPROP Artifact B2 unit-scope activation gate 03

Status: acceptance package prepared; activation blocked on an unpublished Core candidate.

Baseline: `8a240999083d150861b6b45c9c8671768f4783d0`.

Core dependency: `CORE-CURRENT-UNIT-PROPERTY-SELECTOR-01`.

Required Core head, tree, manifest, and hashes: `NOT_PUBLISHED`. AIRPROP will pin and review the exact candidate after Core publishes it. This document is a consumer acceptance contract, not a Core interface, selector implementation, or permission to activate the gateway.

## Current merged behavior

PR #397 head `9b8dc31fd96efc22a319f160403d5a9c972cef8a` was merged as `3261bb899ca63f5b28736e896a3b3bf57ba75eee`. Its handler, synthetic contract, disposable PostgreSQL harness, and evidence document are byte-identical on the baseline above.

The loopback handler verifies a bearer through real Supabase Auth, requires current AAL2, creates an actor-bound client per request, and delegates the strict Context/Workspace read to Artifact B2 and the existing Artifact A portfolio RPC. It then parses the complete portfolio response. If any action link has a non-null `unit_id`, the wrapper returns provider unavailable. It does not expose a partial view or treat that denial as an authorized empty portfolio.

The production composition remains closed with `runtime=null`, `portfolio=null`, and `bind=null`. Its controls remain `commands=null`, `can_edit=false`, and `state=pre_activation`. Production HTTP/Auth/AAL2 remains `NOT_RUN_NOT_PASS`.

Current fail-closed behavior is the activation boundary. It must remain in place until an exact Core candidate satisfies this package and a later AIRPROP integration is separately reviewed.

## Required Core selector boundary

Core owns the selector name, implementation, SQL/type surface, locking rules, and canonical authority source. AIRPROP will not create a parallel selector, infer membership from portfolio output, or perform a separate preflight call.

The selector must consume and bind all values below. These are semantic requirements for the future Core-owned contract; field names are not prescribed here.

| Binding | Trusted source | Required rule |
| --- | --- | --- |
| Context | Strict request selection, resolved against canonical authority | Exact UUID; a client selection is not itself authority |
| Workspace | Strict request selection, resolved against canonical authority | Exact active Workspace; no tenant or first-Workspace fallback |
| Actor | Verified request session and database identity | Must equal the current authenticated actor; never accepted from query, body, metadata, or a cached client |
| Property | Current portfolio/action-link row read by Artifact A | Exact canonical property for the candidate unit; no caller-selected substitution |
| Unit | Current canonical unit row referenced by the action link | Exact active unit; no historical, predecessor, revoked, or inactive binding |
| Authority revision | Core's current authority observation | Must be the revision observed for this actor, Context, and Workspace in the same read transaction; never client supplied |
| Transaction | Artifact A portfolio read | The selector and the rows it authorizes must use the same database transaction and snapshot |

For every non-null unit reference, the future Core-owned result must provide one unambiguous internal outcome:

| Outcome | AIRPROP-required meaning |
| --- | --- |
| Current | The exact Context, Workspace, actor, property, unit, and authority revision are bound; membership and the unit-to-property relation are current and active in the same read transaction |
| Not current | At least one required binding is absent, stale, revoked, inactive, cross-Workspace, or mismatched; no unit-linked portfolio projection may be returned |
| Unavailable | The selector cannot establish a valid current result, its contract is malformed, or a dependency fails; no projection may be returned |

A positive result must be bound to the six values above and to the transaction in which Artifact A reads the portfolio rows. AIRPROP does not require these internal bindings to be exposed over HTTP. Negative results must not reveal whether a Context, Workspace, property, or unit exists, nor disclose membership detail, authority revisions, private denial reasons, or provider errors.

The acceptable integration point is inside the actor-bound Artifact A portfolio RPC, before its JSON aggregation completes. A JavaScript check, a second RPC, an earlier transaction, cached allow evidence, or validation after returning the projection cannot satisfy the same-read-transaction requirement. If multiple unit-linked rows are present, every row must pass. Until filtering semantics receive separate owner review, one non-current or unavailable unit closes the complete response exactly as the current gateway does.

The selector and its integration must be read-only. They must not create audit, outbox, idempotency, receipt, authority, portfolio, or domain effects.

## AIRPROP acceptance matrix

| Case | Required setup/observation | Public AIRPROP outcome | State/effect invariant |
| --- | --- | --- | --- |
| Current membership | The verified actor has current Context/Workspace authority at the observed revision; the active unit is currently bound to the exact projected property in the same read transaction | `200`; strict view may contain that unit-linked action | `commands=null`, `can_edit=false`, `pre_activation`; zero write |
| Unit move | An action link still references property A while the canonical active unit now belongs to property B | Fail closed with unavailable and no `view`; no stale property-A reference | No cached prior allow; zero write |
| Unit revoke/inactivation | The referenced unit is revoked, inactive, archived, or otherwise not current | Fail closed with unavailable and no `view` | No distinction or internal reason disclosed; zero write |
| Wrong property | The unit exists but the supplied/projected property does not equal its current canonical property | Fail closed with unavailable and no `view` | No cross-property row or existence leak; zero write |
| Late response | Request A is delayed, then the UI selects another Context/Workspace or session before A completes | A remains bound to its original request; the UI must discard it after the selection generation changes | No previous view restored; zero write |
| Actor/session switch | Actor B replaces actor A while requests overlap | Each request uses its own freshly verified actor client; B cannot consume A's authority, selector result, or projection | No shared session/client/allow cache; zero write |
| Authorized empty | Current authority succeeds and the same transaction finds no authorized portfolio rows | `200` with `view.properties=[]` | Must remain distinct from selector/provider failure; zero write |
| Unavailable | Selector, authority, execution gate, provider, parsing, timeout, or transaction proof fails | `503`/provider unavailable with no `view`; never rewritten as an empty portfolio | Private details suppressed; zero write |
| Zero-write envelope | Repeat every positive and negative case and compare durable counters | Read result only | Domain, audit, outbox, idempotency, receipt, and authority-write deltas all remain zero |

Authentication failures remain bounded before portfolio access: missing or invalid authentication is `401`, and verified AAL1 is `403`. Those outcomes do not establish unit-scope behavior. Cross-Workspace and scope denials that reach the current adapter remain public unavailable responses unless a separately reviewed error contract changes that behavior.

## Acceptance execution after Core publication

1. Freeze the exact Core head, tree, file manifest, and hashes. Record Core review for that same head. Do not update the AIRPROP guard before the final artifact exists.
2. Verify the Core-owned selector implements all required bindings and is consumed inside the same Artifact A read transaction. Reject any second-call or cached precheck design.
3. Make only the reviewed consumer delta needed to replace `AIRPROP_UNIT_SCOPE_UNRESOLVED`. Preserve the current fail-closed branch until the new path has complete evidence.
4. Extend the synthetic loopback suite with each matrix row, including multi-row all-must-pass behavior, private-error suppression, request switching, and durable zero-write assertions.
5. In a disposable Local stack, run real actor-bound HTTP/Auth/TOTP/AAL2 evidence with current membership, move, inactivation, wrong-property, empty, unavailable, late-response, and actor-switch cases. The selector and portfolio read must use the exact candidate bytes. Teardown failure invalidates acceptance.
6. Recheck the production route and controls. Production remains closed until a later activation package supplies its own authorization, role/grant evidence, deployment evidence, and approval.

## Gate decision

`BLOCKED_PENDING_EXACT_CORE_CANDIDATE`.

This package is ready for Core handoff and later AIRPROP acceptance work. It does not approve selector semantics before an exact candidate exists, and it does not authorize a migration, grant, Remote installation, runtime composition, production HTTP route, or activation.
