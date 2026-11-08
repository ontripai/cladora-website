# Guide unit05 — effective Auth scope decision11

Parent97d7a81ea40db5f158fea10ed9ff9e679ca60949. Same CORE-DOMAIN-PORTS-01 card.
DECISION: EXTRA_INVOKER_GUC_ACCESSOR_DOCUMENTED; NO_AUTH_SQL_OR_ACL_SUCCESSOR.
Separate minimal Guide-port hardening is PROPOSED_NOT_APPLIED. This decision is not
installation/adoption approval, a live leak finding or native/runtime acceptance.

## Evidence actually received

Private Platform file PLATFORM-CORE-UNIT05-AUTH-DEFINITIONS-11.json:
7112 UTF-8 bytes, SHA256bc5b4e4a189c95b0051e21d9ae62d311b00daff747b88647e99e293a46922946.
Whole file and BOTH complete definition lengths/hashes independently matched.
The private file, complete target definitions/catalog, target identity and receipt
are not embedded or republished. Metadata includes preserved earlier JWT body plus
matching new hash and the newly captured email definition; origins are kept separate.
Platform reported read-only metadata rollback/idle/close ACK, no helper calls,
claims/email/Auth rows or ACL change. Core did not repeat that observation/query.

| Installed function | Definition identity | Semantics from complete body |
| --- | --- | --- |
| auth.email():text |280bytes; SHA2566964175d0bad9d5ea355d2e8c4ad9a99147348b817213e85fcb0d4122a72b621 | first nonempty request.jwt.claim.email; otherwise email property of request.jwt.claims JSONB |
| auth.jwt():jsonb |265bytes; SHA2567ce3ad8fb99f7ad5f5cd869fbd5479a6325e9444da472c26394cfa66c83b2d11 | first nonempty request.jwt.claim JSON; otherwise request.jwt.claims JSON |

Both are SQL/STABLE/SECURITY INVOKER, owner supabase_auth_admin, proconfig=NULL.
The metadata shows schema dependency and owner/ACL dependencies; shared ACL-role
references are not data reads. Textual bodies use current_setting(missing_ok=true),
nullif/coalesce, JSONB/text casts and JSON field projection, with no explicit
relation read, write, set_config, dynamic SQL or privileged helper invocation.
This conclusion uses complete bodies, not an assumption from INVOKER or absent
pg_depend rows: textual SQL bodies need not catalog all runtime dependencies.
The function proconfig remains NULL, not claimed pinned. Builtin expression
resolution assumes the admitted search_path; C03 explicitly sets local pg_catalog.
Other phases' inherited resolution is a separate existing binding/native premise,
not proved or changed by this scope decision.

## Actual scope of unit05

Unit05 grants schema USAGE(auth) and five explicit EXECUTEs. That is NOT an
allowlist of the effective callable set. Existing auth.email raw ACL=NULL supplies
default PUBLIC EXECUTE; with USAGE(auth), the Guide executor can call it without
an explicit extra grant. Its effective entry must be recorded in the plan.
Observed auth.jwt PUBLIC EXECUTE is false; its explicit Guide grant remains needed.
Neither email's owner role nor owner privileges are inherited by an INVOKER call.
The inspected email body is a GUC accessor, not access to auth.users, a service-role
fallback, a write, JWT verification, session validity or any business permission.
No grant option/table privilege is created by this accessor. No actual function,
claims value or email value was invoked/read to reach this decision.

Absolute email() = jwt()->>'email' is FALSE. There are two DIFFERENT priority aliases:
- a scalar email alias can override plural JSON while jwt() still uses plural JSON;
- a singular JSON alias can override jwt() while email() still uses plural JSON.
Only under an explicit alias-neutralized premise do both use the same plural carrier.
Empty strings behave as absent; other strings are not silently treated as absent.
Invalid selected JSON is not verified or safely skipped by these SQL expressions.

## Official Guide source, not guessed target GUC values

Core source: src/lib/core/platform-role-bound-pool-v1.ts and
src/lib/core/guide-request-binding-v1.ts at this Parent. Actual accepted consumer:
CE6259b70268a851113c8f981e2d346da5428e343f,
src/lib/community/experience-guide-lifecycle-http-v1.ts, consumed from Git.
Its trusted carrier contains sub/role/aal and verified session_id/exp; NOT email or
user_metadata. It sets request.jwt.claims transaction-locally, with scalar sub/aal/
role and Context/Workspace. It does not set either legacy precedence alias.
With both aliases empty, auth.email() therefore returns NULL for this minimal
carrier; a future deliberately admitted carrier with email would project that
field. Neither result substitutes for canonical C01/session/AAL2/authority checks.

Core's existing clearIdentitySql clears plural claims/sub/aal/role and scope;
cleanForReuse then runs RESET ALL and RESET ROLE. This normally removes per-session
settings, but RESET ALL returns settings to startup/database/role defaults. The
source does not explicitly blank request.jwt.claim or request.jwt.claim.email
AFTER that reset, nor locally at BEGIN. It cannot by itself prove the required
alias-neutralized premise under every admitted physical pool/default configuration.
No nonempty alias was observed on the actual target. Do not report the controlled
counterexample below as a real leaked email, impersonated actor or live exploit.

## Minimal successor proposal — Guide port only

successor-proposal.patch is a one-file proposal against the exact unchanged pool
preimage SHA2563abeca26ee87ad647ed7af74eaababff9d2308ccc52b1543a2569e29d51ab128.
It is NOT applied to src. It does not alter SQL unit05, Auth definitions/ACL/owners,
CE-owned carrier, shared evaluator/host or other consumers.

1. After RESET ALL/RESET ROLE and verified runtime identity in Guide cleanForReuse,
   explicitly blank both aliases at session scope, using pg_catalog.set_config.
   Apply the same existing cleanForReuse path at checkout and successful reuse.
2. Immediately after BEGIN and executor identity check, blank both aliases LOCALLY
   before the Guide safety lease and later CE claims carriage. The plural verified
   carrier is not overwritten, and no email or allow is copied into it.
3. Branch ONLY on the fixed official Guide contract. SERVICE subject-link behavior
   stays unchanged. Preserve first failure/40001 and existing destroy-on-poison/open-
   transaction/commit-attempt/cleanup-failure paths. No retry/session/host engine.

This normalizes precedence; it does NOT make auth.email uncallable. Denying an
individual role a function inherited via PUBLIC cannot be achieved by omitting an
explicit GRANT while retaining schema USAGE. Do not revoke public Auth ACL, change
Auth owner/proconfig or break other consumers to pursue that different policy.
If a no-callability policy is desired, it needs separate owner acceptance and an
explicitly reviewed interface redesign, not an ad-hoc provider ACL workaround.

Platform consumption decision: retain unit05 bytes and its observed accessor scope.
For application/native admission, consume a reviewed Guide-port successor with
these alias guarantees, or keep that premise OPEN with exact privately admitted
configuration proof. A profile name/RESET ALL/source test does not prove defaults.
The proposed successor is independently reviewable and must receive its own exact
accepted App/source pin; do not activate or rebind old evidence from this document.

## Focused checks and limits

```sh
node scripts/prepare-core-guide-auth-alias-proposal-v1.mjs --check
node scripts/test-core-guide-auth-scope-v1.mjs --evidence=<privately-received-Platform-file>
```

10 NEW focused checks: exact two-definition identity; shared fallback; both distinct
precedence counterexamples; actual pinned CE carrier; actual current Core pool
loaded over a CONTROLLED physical-Pool/GUC/default model; proposed Guide cleanup/
local neutralization; unchanged SERVICE sequence; same40001/lease destruction;
exact unchanged product preimage and proposal generation. No installed SQL helper
is called. The model writes synthetic in-memory settings only; no claims values
are retrieved from PostgreSQL or Auth. Candidate TS is transpiled in memory, not
installed/activated. Native PG/Auth/session-pooler behavior remains NOT_RUN_NOT_PASS.

Proposal apply/reverse and bytes/hash are checked in scratch. Node syntax, limited
lint, JSON/seals/diff checked. No product TS changed: full product typecheck and
accepted Guide/Auth/C03/business suites were NOT rerun. If the proposal is later
accepted as product source, typecheck and genuinely affected composition/native
checks belong to that adoption, not silently borrowed from this model.

Automation: نیازمند بررسی — definition/pin/precedence/model checks are candidates;
private target configuration, source adoption and native acceptance retain formal
Platform/Core/Coordinator ownership. No SQL/target/ACL/activation action occurred.
