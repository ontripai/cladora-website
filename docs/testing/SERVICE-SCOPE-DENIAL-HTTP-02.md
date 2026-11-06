# SERVICE scope denial at the request read boundary

An authenticated request can bind successfully and subsequently fail the canonical
workspace read. Previously the SERVICE preflight catch converted that scope
denial to503/RUNTIME_BINDING_INACTIVE, while the read API returned403.

The request-local binding now wraps only its four pre-command readers. A scope
denial is recognized from the actual Core error class, or the exact installed
PL/pgSQL raise signatures, together with Core's private read-failure evidence:
rollback acknowledged, lease destruction requested, and no rollback/cleanup
error. A bare42501, an ACL failure, an arbitrary message or unknown settlement
is insufficient. No client input or user metadata supplies this evidence.

The application returns403 before business dispatch, including a late reader
denial after an earlier authorized resource. Ordinary withheld-resource
filtering is preserved. Actual Core authentication failure at a read boundary
returns401. Serialization failures preserve their original40001 identity.
All unclassified/infrastructure/unknown outcomes retain existing503 behavior.
The command host, SQL, installed Core, authorization and transaction semantics
are unchanged. Request-local wrapper errors do not brand a reusable raw error.

A bounded server diagnostic records operation, decision, error code and read
settlement/cleanup category only. It emits no raw error message, query, request
body, cookie, actor, workspace or credential. A failing diagnostic sink cannot
replace the primary read error.

Verification:

```sh
node scripts/test-service-scope-denial-http-02.mjs
```

The22 checks execute the actual Core runtime, Auth adapter, request binding,
application and HTTP handlers with controlled SDK/PG transports. They cover
the GET403/POST503 counterexample, both canonical SQL signatures, typed Core
scope errors, denied late reads, Auth expiry, unrelated ACL/transport errors,
unknown rollback/cleanup, unattested errors, a getter and40001. No denial
dispatches a business command. These are controlled tests, not native A03
acceptance or a diagnosis of the private Platform exception. The latter remains
unconfirmed until execution on the accepted replacement build.
