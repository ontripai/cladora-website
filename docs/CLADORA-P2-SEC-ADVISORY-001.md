# CLADORA-P2-SEC-ADVISORY-001 — Security Advisory Closure

## Verdict

READY-FOR-DRAFT-PR — SOURCE ONLY

## Scope

- Forward-only Migration 93: `20260913190055_security_advisory_closure.sql`
- Transaction-wrapped pgTAP Test 079: 39 assertions
- No Supabase apply, Auth configuration mutation, fixture DML, customer DML or merge.

## Discovery classification

### FIX — mutable search paths

Five linter findings are closed by explicit function-level search paths:

- `payments.validate_and_mask_iban(text)`
- `public.set_marketing_leads_updated_at()`
- `documents.check_retention_policy_overlap()`
- `maintenance.enforce_work_order_transition_guards()`
- `maintenance.protect_sla_policy_immutability()`

Direct execution of trigger-only functions is revoked from `PUBLIC`, `anon` and `authenticated`.

### REFACTOR — exposed SECURITY DEFINER gateways

Eight authenticated `customer_api` routines already enforce authentication, context, tenant, permission and (where required) AAL2/dual-control rules. Their privileged implementations are moved unchanged to the non-exposed `app_private` schema. Stable `customer_api` signatures are recreated as `SECURITY INVOKER` SQL gateways.

This preserves the application API while removing privileged implementations from the exposed Data API schema.

### INTENTIONAL-PRIVATE — RLS enabled without policy

All 25 application tables reported by the advisor deny `anon` direct privileges. Their intended access paths are guarded RPCs and/or `service_role`. Migration 93 records explicit deny policies for `anon` and `authenticated`; it does not create a permissive tenant policy or expose raw tables.

Affected domains:

- documents: 8
- finance/export: 3
- governance: 4
- occupancy: 1
- public marketing intake internals: 2
- security_access: 7

### SEPARATE AUTH CONTROL

Supabase Leaked Password Protection is a project Auth setting, not a schema migration. It remains unchanged and requires separate authorization after this PR is reviewed.

### OUT OF SCOPE

Performance advisor items, provider integrations, environment variables and application UX changes.

## Verification

- Linked transactional rehearsal: Migration 93 + Test 079, 39/39 assertions, explicit ROLLBACK.
- Post-rollback production check: Remote migrations 92; original public functions unchanged; zero new deny policies.
- Expected source package after this branch: 93 migrations / 79 tests / 2579 assertions.
