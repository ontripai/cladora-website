# CLADORA-P2-SETUP-HARDENING-001 — Closure report

## Verdict

`RELEASED` — Migration 95 was applied exactly once, its migration-history version was reconciled to the canonical `20260914075648`, PR #87 was squash-merged, and the matching Production deployment reached `READY`.

## Findings closed

- `SETUP-001-SEC-01`: five privileged setup implementations were removed from the exposed `customer_api` schema. The stable API signatures are `SECURITY INVOKER` gateways; guarded privileged implementations reside in non-exposed `app_private`.
- `SETUP-001-DOC-01`: the Setup 001 report records the actual Migration 94 apply, drift reconciliation, squash SHA and production status.
- `CLADORA-SETUP-DRIFT-001`: the generated remote history version `20260914081020` was reconciled to canonical version `20260914075648`; the final inventory is `Local 95 / Remote 95 / Drift 0`.
- `CLADORA-SETUP-DOC-002`: this report now reflects the completed Migration 95 release instead of the pre-release Draft state.

## Security contract

The application continues to use its authenticated user client and receives no service-role credential. Public gateways are callable only by `authenticated` and `service_role`; `anon` and `PUBLIC` remain revoked. The private implementations retain the existing checks for authentication, AAL2, active time-bounded membership and context, explicit permission, tenant isolation, state transitions, idempotency and independent approval.

Post-apply verification confirmed:

- five of five exposed setup gateways are `SECURITY INVOKER`;
- zero of five gateways are executable by `anon`;
- five of five gateways preserve authenticated execution;
- all five privileged implementations remain in `app_private`;
- no real setup run was created; and
- Supabase Security Advisor returned zero findings, clearing all five Setup warnings.

## Evidence

- Migration 95: `20260914075648_building_setup_security_invoker_gateway.sql`
- Migration 95 SHA-256: `049567833c77ae5cfe755292ed4a8f18505c80ff9d0db87e75c9108922ab5a59`
- Test 082: `082_building_setup_security_invoker_gateway.test.sql`
- Test 082: 30 pgTAP assertions inside `BEGIN … ROLLBACK`
- Database package: `95 migrations / 82 tests / 2645 assertions`
- Database CI: PASS
- Application Foundation: PASS
- Vercel Preview: PASS
- Pull request: [#87](https://github.com/ontripai/cladora-website/pull/87)
- Squash SHA: `a1aeb01713a37421b673749c76d80e1858bc50dd`
- Production deployment: `READY`, matching the squash SHA
- Production deployment evidence: [Vercel deployment](https://vercel.com/ontrip/cladora-website/JAyKRQbWFUeTeF5wXyj49xDfR1Jv)

Test 082 used only synthetic `@cladora.test` identities inside its rolled-back transaction. No customer fixture, Auth configuration, journal, allocation, payment or provider data was mutated by this hardening release.

## Closure

`PASS-CLADORA-P2-SETUP-HARDENING-001-RELEASED`

This report correction is isolated in `CLADORA-SETUP-DOC-002`. Its Draft PR does not authorize additional database changes, Supabase Apply, Auth changes, customer-data changes or Merge.
