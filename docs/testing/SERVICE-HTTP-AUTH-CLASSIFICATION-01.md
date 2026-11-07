# SERVICE bind-time HTTP Auth failures

Owner source `445fcdcccf72f2038ed7abe7c96336864058cfe2` is a direct child of
`198e8a35dc120b554468074dd689793addb54385`.

The real Core producer verifies the request's Auth before returning SERVICE
ports. It raises `AUTHENTICATION_REQUIRED` for absent/failed Auth, or
`ACTOR_BINDING_MISMATCH` for a verified-user/claims subject mismatch. Previously,
the GET/POST HTTP catch replaced those known failures with503
`RUNTIME_BINDING_INACTIVE`, so an anonymous POST did not demonstrate the
expected authentication denial even though it never reached a DB checkout.

The HTTP catch now recognizes only these two own data-property codes from its
server-selected resolver and returns401 `UNAUTHORIZED`. It does not infer a
code from an error message, inherited/getter property, request data or metadata.
Missing/null binding, unknown errors and dependency failures remain503.
Responses retain no-store/private and cookie-varying headers and omit private
error details. Existing parsing/origin/body limits run in the same order.

The change only classifies exceptions from port resolution. It does not add an
Auth principal, authorize data, catch/relabel transaction failures, change
40001/UNKNOWN settlement or reinterpret all later errors as authentication.
Existing Core AAL2/current-session/scope/transaction checks, SERVICE application
flow, UI, original relay binding and SQL remain unchanged. In particular, this
does not broaden the existing handling of malformed/AAL1 claim schemas.

## Verification

- `node scripts/test-service-http-auth-classification-01.mjs`:17 owner cases,
  actual HTTP/Core bind with controlled Auth and business-dispatch probes.
- `node scripts/test-service-http-auth-boundaries-01.mjs`:6 independent cases
  using actual Core authenticate, actual request-local cookie adapter and HTTP;
  only the official SDK's Auth responses are controlled. A Pool trap asserts no
  DB checkout. Four of these cases fail on the previous198 source and pass on
  the correction. An optional source-root argument supports that comparison.
- Existing request-flow and request-local binding suites retain genuine503,
  valid-flow and UNKNOWN behavior. Standard validation/security controls remain.

These are controlled-source tests, not native PostgreSQL/Auth evidence. The
native A01 anonymous POST must be rerun by Platform only after exact successor
adoption. A genuine runtime dependency problem may still correctly produce503;
neither a zero-write observer nor this source correction proves native401.
The previous successful Request/refresh/restart evidence is preserved separately.
