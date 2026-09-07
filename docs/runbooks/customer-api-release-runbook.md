# Remote Release Runbook: Customer API Gateway (Migration 66)

## 1. Context & Release Scope
- **Task Reference**: CLADORA-P1-CLOSE-009
- **Migration File**: `supabase/migrations/20260907200000_customer_api_gateway.sql`
- **Migration SHA-256**: `27a4d4ad1e6b2d0a3dfe62e38f7f68b4d0c0049a8e19263a1e053171731252d6`
- **Target Project Ref**: `jyomlehahwlyqzoacrvp`
- **Release Status**: `REMOTE-INTEGRATION-PENDING-RELEASE`

> [!IMPORTANT]
> In accordance with Task CLADORA-P1-CLOSE-009 execution gates:
> - **Migration 66 was NOT applied to Remote Supabase** during task execution.
> - **Remote PostgREST exposed schemas were NOT modified**.
> - **P1TEST test accounts remain banned and locked**.
> This runbook defines the exact, audited procedure for separately approved production/remote deployment.

---

## 2. Pre-Release Verification Checklist
Before applying Migration 66 to Remote:
1. Verify PR has been reviewed and merged into `main`.
2. Confirm working tree is clean and HEAD commit matches merged PR.
3. Compute SHA-256 of `supabase/migrations/20260907200000_customer_api_gateway.sql` and verify it equals:
   `27a4d4ad1e6b2d0a3dfe62e38f7f68b4d0c0049a8e19263a1e053171731252d6`
4. Confirm remote database is online and accessible.

---

## 3. Remote Application Procedure

### Step 3.1: Apply Database Migration
Execute Migration 66 in a single transaction on remote Supabase:
```bash
# Option A: Via Supabase CLI (linked project)
supabase db push --include-all

# Option B: Via psql directly using authenticated connection string
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260907200000_customer_api_gateway.sql
```

### Step 3.2: Update Remote PostgREST Exposed Schemas
In remote Supabase dashboard:
1. Navigate to **Project Settings** -> **API**.
2. Locate **Exposed schemas**.
3. Add `customer_api` to the exposed schemas list:
   `public, graphql_public, customer_api`
4. Save changes to reload the PostgREST schema cache.

> [!WARNING]
> Do NOT expose internal domain schemas (`platform`, `finance`, `billing`, etc.) under any circumstances. Only `public`, `graphql_public`, and `customer_api` may be exposed.

---

## 4. Post-Release Verification & Testing

### Step 4.1: Run pgTAP Test 050 on Remote
```bash
# Run pgTAP test 050 against remote database
pg_prove -U postgres -d postgres -h "$DB_HOST" supabase/tests/050_customer_api_gateway.test.sql
```
Expected output: All 103 assertions PASS.

### Step 4.2: Verify Remote PostgREST Endpoint Availability
Make an authenticated request to `customer_api.list_contexts_v1` using a valid customer JWT:
```bash
curl -X POST "https://jyomlehahwlyqzoacrvp.supabase.co/rest/v1/rpc/list_contexts_v1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: customer_api"
```
Verify response returns HTTP 200 with contexts payload and zero PGRST106 errors.

---

## 5. Rollback Plan
If an unexpected regression occurs following remote release:

### Step 5.1: Drop Gateway Schema
Execute the following SQL transaction on the remote database:
```sql
begin;
-- Drop gateway schema and all 20 wrappers
drop schema if exists customer_api cascade;
commit;
```

### Step 5.2: Revert PostgREST Exposed Schemas
Remove `customer_api` from the exposed schemas configuration in the Supabase Dashboard:
`public, graphql_public`

Reload the PostgREST schema cache.

---

## 6. Roll-Forward Plan
If a wrapper signature requires adjustment or a new customer portal route is added:
1. Create a new forward migration: `supabase/migrations/<timestamp>_customer_api_gateway_update.sql`.
2. Follow strict conventions:
   - `SECURITY INVOKER`
   - `SET search_path = pg_catalog`
   - `auth.uid() IS NULL` guard
   - Explicit REVOKE and GRANT (zero wildcards)
3. Update `src/types/database.generated.ts` and route handler consumers.
4. Run `npm test` and `scripts/test-customer-api-gateway.mjs`.
