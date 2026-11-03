# شماره تسک: ۲۳۶-۱ — worklog

Exact paths recorded before source edits. Isolated candidate preserves predecessor235, original checkout and prior WIP.

- `src/lib/customer/operations-command.ts`
- `src/lib/customer/operations-command-client.ts`
- `src/lib/customer/operations-command-server.ts`
- `src/components/customer/OperationsCommandGate.tsx`
- `scripts/test-operations-command-context-recovery.mjs`
- `scripts/test-v14-operations-install-packet.mjs`
- `supabase/install/v14-operations/maintenance-procurement.sql`
- `supabase/install/v14-operations/preflight.sql`
- `supabase/install/v14-operations/verify.sql`
- `supabase/install/v14-operations/manifest.json`
- `supabase/install/v14-operations/recovery.md`
- `docs/verification/CORE-OPERATIONS-236-1.md`
- `docs/worklogs/CORE-OPERATIONS-236-1.md`

No dependency/history/demo/unrelated source change. No SQL/DB/Auth/runtime/fresh install/CI/Push.

Implemented the three prelogged source corrections together. Original command Context
is bound through SQL/route/storage; pending cross-Context retry requires the original
Context. Corrected the selected INSERT envelope and retained independent RLS ALTERs.
Added local5s/60s read-lane deadlines before catalog reads and STOP/UNKNOWN recovery.
Existing parser probes found none; syntax-parser check stays NOT_RUN, no install.
Actual affected offline results and final full-patch apply/reverse identities are in
the delivery manifest; source/PG/runtime/owner-policy holds remain distinct.
