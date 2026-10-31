# Core Operations 235-1 worklog

Exact planned paths recorded before editing; predecessor234 and original checkout are preserved. No demo, unrelated source or historical migrations will be changed.

- `src/lib/customer/operations-command.ts`
- `src/lib/customer/operations-command-client.ts`
- `src/lib/customer/operations-command-server.ts`
- `src/components/customer/OperationsCommandGate.tsx`
- `src/components/customer/CustomerMaintenanceDashboard.tsx`
- `src/components/customer/PreventiveMaintenancePanel.tsx`
- `src/components/customer/WorkOrderLifecyclePanel.tsx`
- `src/app/api/customer/v1/operations/commands/route.ts`
- `src/app/api/customer/v1/maintenance-plans/route.ts`
- `src/app/api/customer/v1/work-orders/[id]/issue/route.ts`
- `src/app/api/customer/v1/work-orders/[id]/start/route.ts`
- `src/app/api/customer/v1/work-orders/[id]/complete/route.ts`
- `src/app/api/customer/v1/work-orders/[id]/verify/route.ts`
- `scripts/test-operations-command-recovery.mjs`
- `scripts/test-operations-app-journey.mjs`
- `package.json`
- `package-lock.json`
- `docs/verification/CORE-OPERATIONS-235-1.md`
- `docs/worklogs/CORE-OPERATIONS-235-1.md`
- `supabase/install/v14-operations/foundation.sql`
- `supabase/install/v14-operations/assets.sql`
- `supabase/install/v14-operations/maintenance-procurement.sql`
- `supabase/install/v14-operations/building-provisioning.sql`
- `supabase/install/v14-operations/preflight.sql`
- `supabase/install/v14-operations/verify.sql`
- `supabase/install/v14-operations/manifest.json`
- `supabase/install/v14-operations/recovery.md`
- `scripts/test-v14-operations-install-packet.mjs`

Implementation checkpoint: added the real Operations C03 transport/codec/client/gate;
closed old unreceipted HTTP mutations; selected independent inactive installer source
with exact origin/output inventory and protected proof history. Updated only selected
Next/env/SWC/Zod lock metadata. Existing installed dependencies were borrowed, not
installed/updated. SQL was authored as text only, never parsed/compiled/executed.

Verification evidence is recorded in the final delivery manifest. New-lock install/
audit/build and PG/Auth/runtime are explicit NOT_RUN_NOT_PASS. Independent SERVICE
review and Operations owner-policy/execution gates remain. No application readiness,
installation or activation is inferred from offline source tests.
