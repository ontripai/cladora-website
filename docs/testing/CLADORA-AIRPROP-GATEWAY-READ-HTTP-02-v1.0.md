# CLADORA AIRPROP loopback read gateway HTTP evidence v1.0

Status: pre-activation candidate. This package does not expose a production route and does not grant product execution.

## Boundary

`handleAirpropB2ReadHttpV1` is an isolated loopback-only HTTP composition of the existing Artifact B2 API and portfolio adapter. It accepts a bearer token only after Supabase Auth verifies the user and the token's current authenticator assurance level. A fresh actor-bound Supabase client carries that same token to Artifact A's portfolio RPC. The production AIRPROP route remains composed with `runtime=null`, `portfolio=null`, and `bind=null`.

The response contract keeps `commands=null`, `can_edit=false`, and `state=pre_activation`. A valid authorized portfolio with no rows is a successful read with `properties=[]`. Authentication, authority, provider, or execution-gate failure is an unavailable or denied response without a `view`; it is never rewritten as an empty portfolio.

Unit-linked action receipts are fail-closed at this gateway because the installed Artifact A RPC does not independently revalidate current unit-to-property membership. Any returned non-null `unit_id` produces provider unavailable. Core resolution is still required before that boundary can open.

## Disposable execution gate

The real-local suite first proves that `authenticated` lacks EXECUTE on `customer_api.read_airprop_management_portfolio_v1(uuid,uuid)`. It grants only that signature inside the disposable local Supabase stack, runs the read evidence, revokes it, and proves the initial privilege state was restored. If schema USAGE was absent, the suite applies and restores that exact local privilege as well. No migration or product grant is created.

The local stack is destroyed with `supabase stop --no-backup`. Auth factors, sessions, synthetic users, Core authority, and the temporary gate also have explicit cleanup and read-back checks.

## Evidence classes

| Claim | Classification | Validation |
| --- | --- | --- |
| Bearer identity | REAL_LOCAL | Supabase Auth `getUser(token)` |
| TOTP and assurance | REAL_LOCAL | enroll, challenge-and-verify, token AAL inspection |
| HTTP boundary | REAL_LOCAL | TCP loopback server and `fetch` |
| Portfolio provider | REAL_LOCAL | PostgREST RPC with the verified actor bearer |
| Context/Workspace/property scope | REAL_LOCAL | two authorized Workspaces, one populated and one empty; mismatched scope unavailable |
| Actor/session switching | REAL_LOCAL | independent AAL2 actors; unauthorized actor cannot consume the first actor's authority |
| Late response | REAL_LOCAL | delayed first actor request remains bound to its request after actor switch |
| Read effect | REAL_LOCAL | audit, outbox, idempotency, mandate, and action-link counts remain fixed across reads |
| Unit move/revoke | REAL_LOCAL fail-closed | non-null unit receipt unavailable before and after move/inactivation; pending Core resolution |
| Error-shape and edge matrix | SYNTHETIC | five-case isolated contract suite |
| Production route and HTTP/AAL2 | NOT_RUN_NOT_PASS | production composition remains closed |

The static contract suite also guards against service-role fallback, grant statements, a production route, or weakening the B2 control state.
