# CE Guide — Core62 route adoption

Task: CE-GUIDE-NATIVE-01, same R0/R1 card. This is executable consumer source,
not runtime activation or another producer proposal.

Inputs: CE6259b70268a851113c8f981e2d346da5428e343f and official Core
62f3c4ea3280821d3df69cd5d0cfbd10fbf6cb6d. Core was brought in by ordinary merge
on the existing codex/ce-guide-native-01 branch; neither history nor Parent was
rewritten. Integration merge:e625bb2678fb4624860ceb18c2413c28a02cc8ad, parents
CE6259 and Core62. Approved main6cecfa15b00f445be68817e756d766fb0e6fe026 is
an ancestor via Core and has the same whole tree as the original published Base.
Core source/role adapter is unchanged from62; no cherry-pick of a partial factory.

## Exact Platform -> App integration point

`src/lib/app/guide-platform-provider-v1.ts` exports:

- `GuidePlatformOptionsV1 = Omit<CoreGuideRequestBindingOptionsV1,'request'>`;
- provider contract `guide-platform-provider.v1` with
  `resolve(originalRequest): Promise<GuidePlatformOptionsV1|null>`;
- **GUIDE_PLATFORM_PROVIDER_V1 currently NULL**. This is the sole server-only
  deployment slot for App to consume Platform's privately admitted provider.

App/Platform supply the official physical runtime_pool, observed target and
connection_model, with actual custody/role/schema/session/target/capacity evidence.
App connects that accepted server-only provider at the slot above. No public
setter, mutable registry, new env/path discovery, credential file, invented Pool,
SERVICE binding or alternate authenticator is provided by CE. Options never enter
React props or HTTP responses. The only public indication is native entry mode;
it is presentation, not permission. No accepted Platform -> App adapter has yet
been delivered; NULL is unavailable, never evidence of activation.

`experience-guide-route-runtime-v1.ts` consumes the slot per original Request.
`createCoreGuideRequestHandlersV1({...options,request})` is called for each actual
Guide read/mutation request; Request is last so provider data cannot replace it.
Core's official factory/SSR authenticator, target/principal/role safety, SID/exp,
C01/C03 and CE versioned commands remain authoritative. No process-global
request/actor/SID/handler cache is added. Factory or provider failure is bounded503.

## Actual routes and selected-mode behavior

| Actual route | Executable consumption |
| --- | --- |
| GET /api/customer/v1/experience/guides/draft | resolve current App/Platform input -> official Core factory -> handlers.GET(original Request) |
| POST /api/customer/v1/experience/guides/draft | same direct factory -> actual CE create/save/lifecycle handler -> existing Core host |
| GET /api/customer/v1/experience/guides | native mode selected -> same official factory GET;401/403/503 returned unchanged, no error fallback |
| GET /api/customer/v1/experience/guides/discovery | official request-local Core binding -> CE rollback-only disclosure projection under canonical Guide read permission |

Missing/malformed provider is explicitly unavailable for native operations. If
native entry has NOT been selected at all, the previously accepted independent
legacy reader remains intact; this is preselected legacy read, not activation or
error-based fallback. Once a native provider is selected, even when it resolves
NULL, the current read cannot fall back to that legacy reader. Legacy POST body
is unchanged and no native path calls it. Reference resolution/publication beyond
the no-document cut remains independently gated, never inferred from a link.

## Guide discovery and entry without SERVICE permission

The old shared assembly Context/dashboard bootstrap calls SERVICE-only discovery.
The selected native Guide entry no longer mounts that ContextProvider/route guard
or fabricates a dashboard. Actual App layout retains verified Auth and mandatory
AAL2. Its native Guide shell renders the independently guarded Guide entry only
on the exact Guide path; other paths retain their existing shell.

Discovery uses the official Core Guide request binding, issuer-verified SID/exp
and ordinary fixed CE role lease. Its fixed candidate query enumerates only the
current actor's active membership/Context and active Workspace candidates. Every
disclosed tuple passes the existing CE canonical Context/workspace/current-session
and `experience.guide.read` checks, matching tenant/member/revision. The epoch is
held; every tuple is rechecked after all source/authority waits, then current
session and a positive ROLLBACK precede disclosure. A final issuer reauthentication
must still match actor/SID. No label is released after failed recheck.

Output is versioned `ce-guide-discovery.v1`: actual context_id, membership_id,
workspace_id, tenant_name and role_name; `authority:not_evaluated`. No can-edit,
role guess, SERVICE permission or first-Workspace fallback is manufactured. This
bounded first-wave read admits at most50 candidates;51 fails unavailable rather
than disclosing a silently incomplete list. Exact candidate SELECT column rights,
RLS visibility, canonical helper overloads and epoch/session semantics require
Core/Platform review on the admitted target. No grant/policy/helper is installed.
A missing permission/helper/role or unsuccessful rollback is NOT a positive proof.

The client requires EXPLICIT selection from that actual projection. It renders
existing `CustomerExperienceGuideScope` (shared with the accepted Guide page)
using the real Context/membership/Workspace tuple, never a fake dashboard. It
preserves the old per-scope draft/UNKNOWN caches, locale/owner fences and existing
create/editor/lifecycle consumers.401/403 clears selection/read admission;
late response/JSON cannot restore a different Context. Discovery metadata is not
a command allow and GET never resolves UNKNOWN. No new Context authority engine.

Explicit Guide login next is allowlisted exactly; hostile external next remains
rejected. Login -> MFA setup/challenge -> Guide uses official Auth/MFA APIs only,
not SERVICE or Platform-permission RPC. Actual MFA pages preserve that Guide next.
Existing default SERVICE next/routing remains unchanged. This is navigation intent,
not authority; all protected Guide requests recheck the actual current session.

## Source and shared-file impact

Core and canonical SQL/guards/roles/receipts are unchanged. Accepted SID/exp and
create/save/lifecycle wire/key/hash/version source remains unchanged from6259.
The owned CE Page was factored to share its existing scope host, not copied.
Minimal shared App/Auth changes: native Guide page/layout/shell selection; exact
Guide login next and MFA continuation. No generic SERVICE bootstrap, permission
mapping, dependency/config/installer or public website change. App owns the future
private provider implementation; this source is its precise consumption location.

## Affected checks actually run

`node scripts/test-ce-guide-routes-r2.mjs` (optional --case='exact name').
Setup-only fixture prefix is pinned to Core62; actual modules/routes read current
composed source. No accepted Core16/4 groups or previous CE suites execute.
Only the App provider boundary, SDK and physical PG transport are MODELED; actual
Next route exports, Core factory, CE auth/providers/host and React consumers run.

Ten distinct targeted groups pass across scoped invocations:

1. Actual draft POST + current GET invoke factory per original Request; a fake
   request field in provider options cannot replace it; canonical create/read.
2. Absent/missing/invalid provider503 and zero native/legacy/SERVICE fallback.
3. Native401/403 preserved without a second reader/write or permission fallback.
4. Guide-only discovery, write-free rollback, final revoke and over-limit denial.
5. Explicit Guide login/MFA intent, all3locales, no SERVICE/Platform-access RPC.
6. Mounted native entry EN/RO/FA, explicit selection, current read, no shared
   SERVICE ContextProvider or auto-Workspace selection.
7. Actual MFA pages continue to Guide with zero SERVICE/Platform permission calls.
8. Context switch during late create JSON cannot clear the new draft; original
   UNKNOWN and exact-wire retry survive when returning to the original Context.
9. Actual App layout/Guide shell admits its native child without mounting/fetching
   SERVICE Context/dashboard discovery; verified Auth/MFA still required.
10. Read-only Guide actor discovers/reads but has no create/manage admission or
    effect. Read and management remain separate.

Exact existing Next16.4.1/Zod4.6.6/TS5.9.3/Node24.19.0. Full unchanged ES5 typecheck,
scoped lint, syntax/diff and inventory checks are recorded in manifest. Initial
harness loader/setup defects were corrected and only affected groups rerun; these
failed attempts are not hidden native successes. No dependencies installed.

## Native handoff stays OPEN

Platform supplies one admitted run/build with the exact combined source, private
provider, owned target/roles/RLS/limited column+helper access, issued Auth/MFA,
finite capacity and observer/restart recipe. Core reviews discovery mapping and
currentness/disclosure against that real schema. Platform runs the single browser
journey; QA independently reviews its evidence. Run Guide-only actor without
SERVICE permission through explicit login, discovery, Context switch, read,
create/edit/publish/cancel, denial/revoke/version/UNKNOWN and restart readback.

No native Next/Auth/PG/browser, installation or restart was executed by CE. Default
NULL is NOT activated. Actual integration/acceptance remains with App/Platform/
Core/QA/Coordinator; no preparation report or controlled check closes this task.
