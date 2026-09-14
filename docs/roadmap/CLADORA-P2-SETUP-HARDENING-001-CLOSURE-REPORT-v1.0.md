# CLADORA-P2-SETUP-HARDENING-001 — Closure report

## Verdict

`READY-FOR-DRAFT-PR` — Migration 95 is not applied and this package is not merged.

## Findings closed

- `SETUP-001-SEC-01`: five privileged setup implementations are removed from the exposed `customer_api` schema. The stable API signatures are recreated as `SECURITY INVOKER` gateways; guarded privileged implementations reside in non-exposed `app_private`.
- `SETUP-001-DOC-01`: the Setup 001 report now records the actual Migration 94 apply, drift reconciliation, squash SHA and production status.

## Security contract

The application continues to use its authenticated user client. It receives no service-role credential. Public gateways remain callable only by `authenticated` and `service_role`; `anon` and `PUBLIC` are revoked. The private implementations retain the existing checks for authentication, AAL2, active time-bounded membership and context, explicit permission, tenant isolation, state transitions, idempotency and independent approval.

## Evidence

- Migration 95: `20260914075648_building_setup_security_invoker_gateway.sql`
- Test 082: `082_building_setup_security_invoker_gateway.test.sql`
- Test 082 uses only synthetic `@cladora.test` identities inside `BEGIN … ROLLBACK`.
- No customer fixture, journal, allocation, payment or provider mutation is included in Migration 95.
- Migrations 1–94 remain unchanged except the documentary status correction explicitly described above.

## Release boundary

This package is authorized only through Draft PR. Supabase Apply, Ready-for-review, Merge and production release require separate approval after CI, transactional rehearsal and a post-apply Security Advisor check.
