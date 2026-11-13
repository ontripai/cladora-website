# QFW-R2-03 — verified AAL1 boundary and actual Quote coupling

Parent:365d47b59d0cd0b5f7bb13604f1497c2104ed6e7; same branch
codex/core-domain-ports-01. This independent child contains only the Auth
correction, new focused test and this versioned evidence/identity manifest.
Uncommitted Guide/S01 R3 changes were read, snapshotted and preserved outside
this commit. R3 is neither completed nor accepted by this result.

## Behavior and order

The same official request-local SDK, configured issuer origin, getUser/getClaims
and server-verified actor are reused. No session, AAL1 port, evaluator, producer,
host, pool fallback or authorization is created. Validation order is:

1. Configured issuer/target binding and SDK verification/user existence.
2. Claims shape, including UUID subject/session, positive safe expiry,
   authenticated role and recognized assurance enum aal1/aal2.
3. Verified-user UUID and exact normalized actor comparison.
4. Insufficient recognized assurance -> stable MFA_REQUIRED.
5. Only verified matching AAL2 returns the private VerifiedAal2Claims type.

Invalid/unverified claims/user fail AUTHENTICATION_REQUIRED. Actor mismatch
remains ACTOR_BINDING_MISMATCH, including when aal1. Unknown/missing assurance is
an Auth failure rather than an MFA suggestion. No Date.now, TTL change, claims
upgrade, user_metadata authority, pool checkout or business dispatch is added.
The database lease still receives only AAL2. Existing malformed target handling
and the canonical DB session/authority checks remain unchanged.

## Exact SERVICE input, imported as bundles

These are bundle-delivered Git objects; published commits are not assumed.
Sequential import identities were verified BEFORE each fetch into the object
store. Checkout and WIP were not changed by those imports:

| Bundle blob | Bytes | SHA256 | Prerequisite / Head |
| --- | --- | --- | --- |
| 7583ff22c7b92df8a29ce7613e3e86640b59dbf0 |7966|ab3fdf64709b3b1fec25e67b08713b8bcb6aeae84c5f134fbf1502776a83d570|cf3d1e3349298c4cc4cf8f6f771c78179cc2bc52 → be29b7cb0ea36c3dbf4f52accaf4c59ab3ad8ef8|
|035145618f7fef47e7e95186ef44e403e5ee7989|10397|26b585aba435da99015d36b73f80b1b8e2677cca361fe9a64cbfe4173a021e51|be29b7cb0ea36c3dbf4f52accaf4c59ab3ad8ef8 → 31b400f911587558abc46a1c0246e443218a1585|
|697c6c6e02602010678e29666902c23eddd8a0c0|3933|9106726878a7800811f4c6c2a4b2cefeb42f4b631b3b2a72f09ea71c2b48b31b|31b400f911587558abc46a1c0246e443218a1585 → fdfe3c6eb5f5f7dd586d21b5d8a8855fa912cb83|

The GitHub connector could not decode the binary bundle as UTF-8. The same
approved GitHub blob endpoints were read as Base64 JSON with gh and decoded
according to that contract; this was read transport, not publication or an
alternative route around an approval rejection. Full bytes/SHA256/Git identity
and git bundle verify all matched. No payload/credential is printed.

## Real-module counterexamples and result

The predecessor Core binder at Parent, with controlled SDK verification returning
valid matching AAL1, throws raw ZodError without stable code. Actual checkouts and
SQL dispatch were zero. It is a reproduced executable counterexample, not a
source-only hypothesis.

After the Core correction, actual SERVICE31b400 factory propagated MFA_REQUIRED,
but its actual HTTP handler returned503/RUNTIME_BINDING_INACTIVE. The required
403 assertion failed with exit1; that historical failure was retained, not
converted into a passing503 expectation. No SERVICE file was edited by Core.

With accepted SERVICEfdfe3, the following REAL modules execute together:

- Core createCoreServiceQuoteCommandBindingV1;
- SERVICE createServiceQuoteRuntimeResolverV1({pool,target,source});
- SERVICE createServiceQuoteHttpHandlersV1, actual GET handler.

Actual matching AAL1 ->403 and {error:{code:'MFA_REQUIRED'}}.
Malformed claims or mismatched actor ->401 and {error:{code:'UNAUTHORIZED'}}.
On each denial: pool checkout=0, source.bind=0, SQL/business dispatch=0.
AAL2 reaches only the missing-source boundary: the test's source binding returns
NULL; no positive S01/preparation port, reservation, request, receipt or COMMIT
is fabricated. The public resolveServiceQuoteRuntimeBindingV1 is still NULL.
Only SDK/PG transport boundaries and that explicitly unavailable source binding
are controlled; the Core binder, SERVICE resolver and HTTP handler are actual
pinned implementations. No router/resolver stand-in or error mapper is substituted.

13 new Core binder/Auth guards and5 actual-successor coupled controls passed.
The13 controls were checked against the isolated staged runtime postimage, not
against the uncommitted R3 extension. Full ES5 typecheck used a scratch snapshot
of Parent with ONLY that same runtime postimage and existing exact dependencies;
R3 was excluded. Limited lint, JS syntax and diff checks passed.
Native Auth/DB/RLS/PG/session/installation/browser proof remains NOT_RUN_NOT_PASS.
Runtime activation and public binding are unchanged. This is source/controlled
coupling closure ready for Coordinator review, not independent native acceptance.

Reproduce after importing official input objects and checking out this child:

```sh
node scripts/test-core-quote-mfa-qfw-r2-03.mjs --predecessor
node scripts/test-core-quote-mfa-qfw-r2-03.mjs
node scripts/test-core-quote-mfa-qfw-r2-03.mjs --coupling
```

The test reuses SETUP ONLY from the accepted controlled Core transport harness;
no accepted historical suite is run. Its existing pinned CE/Documents fixture
objects must be available as required by that baseline harness. To reproduce the
retained SERVICE mapping failure, use CORE_QFW_SERVICE_REF=31b400f911587558abc46a1c0246e443218a1585
with --coupling: it deliberately fails the unchanged403 assertion. There is no
SQL/Auth target execution in these commands.

Automation: نیازمند بررسی — exact source/SDK-boundary checks can be automated;
Coordinator owns source acceptance and Platform/QA owns any separately authorized
native proof. This classification grants no execution or activation.
