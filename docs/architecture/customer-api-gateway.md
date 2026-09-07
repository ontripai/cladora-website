# Dedicated Customer API Gateway Architecture

## 1. Overview & Problem Statement
Prior to Migration 66, Customer Portal Route Handlers attempted to invoke domain functions directly across internal schemas (`platform`, `finance`, `billing`, `payments`, `utilities`, `maintenance`, `governance`, `communications`, `documents`, `occupancy`, `security_access`, `audit`). In hosted/remote Supabase environments, PostgREST only exposes allowlisted API schemas (`public`, `graphql_public`). Attempting to call non-exposed internal schemas resulted in PostgREST `PGRST106` errors ("The schema must be one of the following: public, graphql_public").

Exposing internal schemas directly to PostgREST would violate the principle of least privilege, bypass defense-in-depth boundaries, and expose internal tables/functions to unauthorized exploration.

To resolve `BLOCKED-MISSING-APPLICATION-DATA-PATH`, a dedicated, restricted gateway schema—`customer_api`—was introduced.

---

## 2. Gateway Design Principles

### 2.1 PostgREST Schema Exposure Isolation
- **Exposed Schemas**: Only `public`, `graphql_public`, and `customer_api` are exposed via PostgREST.
- **Protected Internal Schemas**: All internal domain schemas (`platform`, `finance`, `audit`, `identity`, `portfolio`, `occupancy`, `billing`, `payments`, `utilities`, `maintenance`, `governance`, `documents`, `security_access`, `app_private`) remain strictly unexposed.

### 2.2 Strict SECURITY INVOKER Delegation
All gateway wrapper functions are created with `SECURITY INVOKER`.
- The caller executes with their active database role (`authenticated`).
- The `authenticated` role already possesses `USAGE` privileges on internal domain schemas and `EXECUTE` privileges on underlying domain RPCs (which are themselves protected with internal tenant isolation, RLS, and membership time bounds).
- Gateway wrappers **never** introduce privilege elevation or bypass domain security policies.

### 2.3 Search Path Hardening & Injection Defense
- Every wrapper sets an immutable search path: `SET search_path = pg_catalog`.
- All database objects are referenced with fully qualified schema identifiers (e.g., `platform.get_customer_dashboard`, `finance.get_customer_ledger`).
- `auth.uid()` is explicitly qualified as `auth.uid()`.
- Dynamic SQL is strictly prohibited.
- User identity (`user_id`, `tenant_id`, `role`) is never accepted from client payloads; it is derived strictly from the verified session claims via `auth.uid()`.

### 2.4 Explicit Per-Function Access Control Lists (No Wildcards)
- Default privileges and wildcard grants (`GRANT ... ON ALL FUNCTIONS`) are strictly prohibited.
- For each function signature, permissions are explicitly managed:
  ```sql
  REVOKE ALL ON FUNCTION customer_api.function_name(...) FROM public;
  REVOKE ALL ON FUNCTION customer_api.function_name(...) FROM anon;
  GRANT EXECUTE ON FUNCTION customer_api.function_name(...) TO authenticated;
  -- service_role is granted ONLY if a documented server-side consumer requires it.
  ```

---

## 3. Consumer & RPC Mapping Matrix

Total Customer Portal Consumers: **20** (19 Route Handlers + 1 Protected Layout Consumer).

| # | Consumer Route / Component | Gateway Wrapper Function | Underlying Domain RPC | Return Type | HTTP Verb |
|---|----------------------------|--------------------------|-----------------------|-------------|-----------|
| 1 | `src/app/api/customer/v1/dashboard` | `customer_api.get_dashboard_v1(p_context_id uuid)` | `platform.get_customer_dashboard` | `jsonb` | `GET` |
| 2 | `src/app/api/customer/v1/contexts` | `customer_api.list_contexts_v1()` | `platform.list_my_customer_contexts` | `TABLE(...)` | `GET` |
| 3 | `src/app/[lang]/app/layout.tsx` | `customer_api.my_mfa_requirement_v1()` | `platform.my_customer_mfa_requirement` | `boolean` | SSR Layout |
| 4 | `src/app/api/customer/v1/accounting` | `customer_api.get_ledger_v1(...)` | `finance.get_customer_ledger` | `jsonb` | `GET` |
| 5 | `src/app/api/customer/v1/accounting/periods` | `customer_api.list_accounting_periods_v1(p_context_id uuid)` | `finance.list_customer_accounting_periods` | `jsonb` | `GET` |
| 6 | `src/app/api/customer/v1/accounting/periods/[id]/close-readiness` | `customer_api.get_close_readiness_v1(p_context_id uuid, p_period_id uuid)` | `finance.get_close_readiness` | `jsonb` | `GET` |
| 7 | `src/app/api/customer/v1/accounting/periods/[id]/close` | `customer_api.close_accounting_period_v1(p_context_id uuid, p_period_id uuid, p_reason text DEFAULT NULL)` | `finance.close_accounting_period` | `jsonb` | `POST` |
| 8 | `src/app/api/customer/v1/financial-reports` | `customer_api.get_financial_report_v1(...)` | `finance.get_customer_financial_report` | `jsonb` | `GET` |
| 9 | `src/app/api/customer/v1/allocations` | `customer_api.get_allocations_v1(...)` | `finance.get_customer_allocations` | `jsonb` | `GET` |
| 10 | `src/app/api/customer/v1/audit` | `customer_api.get_audit_events_v1(...)` | `audit.get_customer_events` | `jsonb` | `GET` |
| 11 | `src/app/api/customer/v1/billing` | `customer_api.get_billing_v1(...)` | `billing.get_customer_billing` | `jsonb` | `GET` |
| 12 | `src/app/api/customer/v1/payments` | `customer_api.get_payments_v1(...)` | `payments.get_customer_payments` | `jsonb` | `GET` |
| 13 | `src/app/api/customer/v1/utilities` | `customer_api.get_utilities_v1(...)` | `utilities.get_customer_utilities` | `jsonb` | `GET` |
| 14 | `src/app/api/customer/v1/maintenance` | `customer_api.get_maintenance_v1(...)` | `maintenance.get_customer_maintenance` | `jsonb` | `GET` |
| 15 | `src/app/api/customer/v1/procurement` | `customer_api.get_procurement_v1(...)` | `maintenance.get_customer_procurement` | `jsonb` | `GET` |
| 16 | `src/app/api/customer/v1/governance` | `customer_api.get_governance_v1(...)` | `governance.get_customer_governance` | `jsonb` | `GET` |
| 17 | `src/app/api/customer/v1/communications` | `customer_api.get_communications_v1(...)` | `communications.get_customer_communications` | `jsonb` | `GET` |
| 18 | `src/app/api/customer/v1/documents` | `customer_api.get_documents_v1(...)` | `documents.get_customer_documents` | `jsonb` | `GET` |
| 19 | `src/app/api/customer/v1/occupancy` | `customer_api.get_occupancy_registry_v1(...)` | `occupancy.get_customer_registry` | `jsonb` | `GET` |
| 20 | `src/app/api/customer/v1/security-access` | `customer_api.get_security_access_v1(...)` | `security_access.get_customer_security_access` | `jsonb` | `GET` |

---

## 4. Disambiguation of Overloaded Functions
The internal accounting period close function has two signatures:
- `finance.close_accounting_period(p_context_id uuid, p_period_id uuid)`
- `finance.close_accounting_period(p_context_id uuid, p_period_id uuid, p_reason text)`

To avoid ambiguity in PostgREST endpoint routing, the gateway provides a single unified wrapper:
```sql
create or replace function customer_api.close_accounting_period_v1(
  p_context_id uuid,
  p_period_id uuid,
  p_reason text default null::text
)
returns jsonb
...
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_reason is null then
    return finance.close_accounting_period(p_context_id, p_period_id);
  else
    return finance.close_accounting_period(p_context_id, p_period_id, p_reason);
  end if;
end;
$$;
```

---

## 5. Unified Sanitized Error Contract & Zero Internal Disclosure

All route responses adhere to a consistent error schema:
```json
{
  "error": {
    "code": "CONTEXT_ACCESS_DENIED",
    "message": "Access to the requested resource or context is denied.",
    "correlation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

### HTTP Status Mapping:
- **400 Bad Request**: Invalid parameters or schema validation failure.
- **401 Unauthorized**: Missing or expired session claims.
- **403 Forbidden**: Permission denied (`42501`), authentication required, or MFA required.
- **404 Not Found**: Entity not found (`P0002`) with zero-disclosure (does not leak whether the context exists).
- **409 Conflict**: Concurrency conflict or already closed state (`25000`, `23P01`, `40001`).
- **500 Internal Server Error**: Sanitized general message.

### Information Leakage Prevention:
The client response **never** exposes:
- PostgreSQL error codes (e.g., `42501`, `P0002`, `XX000`)
- PostgREST error codes (e.g., `PGRST106`)
- Internal schema names (`platform`, `finance`, etc.)
- Table names, column names, function names
- Stack traces or raw Supabase error messages

Sanitized diagnostic records are logged server-side with correlation IDs, strictly excluding cookies, JWT tokens, passwords, and PII.
