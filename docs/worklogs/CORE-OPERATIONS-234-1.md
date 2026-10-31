# Core Operations234-1 worklog

Source-only integration. Original worktree and published demo are protected.

## Before composition

BASE `8c8225fb3297035a2349357bd968d60779388063`: all 2,228 tracked paths reconstructed and verified. Local HEAD `56c957adbc3dae712827dd5bdd1f760951facfe9` is a separate 2,098-path checkout whose paths are all retained. Historical commit ancestry is UNKNOWN because the `51fdf2` parent object is unavailable. Accepted 48-path outputs were selected only after exact BASE preimage verification; no blind patch stacking. No other domain behavior is edited by this composition.

Planned exact composition paths, logged before source writes:

- docs/architecture/cladora-building-setup-command-receipts-v1.manifest.json
- docs/architecture/cladora-building-setup-command-receipts-v1.md
- scripts/build-building-setup-command-receipts-source-v1.mjs
- scripts/check-building-setup-command-receipts-v1.mjs
- scripts/test-airprop-native-ui-004.mjs
- scripts/test-airprop-opportunity-recovery.mjs
- scripts/test-building-setup-command-receipts-v1.mjs
- scripts/test-building-setup-integration.mjs
- scripts/test-building-setup-progress-ui.mjs
- scripts/test-building-workspace-onboarding-postgres.mjs
- scripts/test-building-workspace-onboarding-ui.mjs
- scripts/test-ce-notice-draft-command-codec.mjs
- scripts/test-ce-notice-draft-command-route.mjs
- scripts/test-ce-notice-draft-command-transport.mjs
- scripts/test-ce-notice-draft-rpc-input.mjs
- scripts/test-ce-notice-draft-submit-safety.mjs
- scripts/test-onboarding-template-consumer-ui.mjs
- scripts/test-preventive-maintenance-panel-recovery.mjs
- scripts/test-service-quote-publication-ui-015.mjs
- scripts/test-work-order-checklist-ui-recovery.mjs
- scripts/test-work-order-lifecycle-ui.mjs
- src/app/api/customer/v1/communications/notice-draft-commands/route.ts
- src/app/api/customer/v1/onboarding/building-setup/[id]/commands/[command_key]/route.ts
- src/components/customer/CustomerAirpropWorkspace.tsx
- src/components/customer/CustomerBuildingSetupProgress.tsx
- src/components/customer/CustomerBuildingSetupWizard.tsx
- src/components/customer/CustomerCommunicationsDashboard.tsx
- src/components/customer/CustomerDocumentsDashboard.tsx
- src/components/customer/CustomerMaintenanceDashboard.tsx
- src/components/customer/CustomerOnboardingTemplates.tsx
- src/components/customer/CustomerServiceQuotePublications.tsx
- src/components/customer/PilotReviewerPanel.tsx
- src/components/customer/PreventiveMaintenancePanel.tsx
- src/components/customer/WorkOrderChecklistPanel.tsx
- src/components/customer/WorkOrderLifecyclePanel.tsx
- src/lib/customer/airprop-opportunity-recovery.ts
- src/lib/customer/building-setup-schema.ts
- src/lib/customer/building-workspace-onboarding-api.ts
- src/lib/customer/building-workspace-onboarding.ts
- src/lib/customer/notice-draft-api.ts
- src/lib/customer/notice-draft-command.ts
- src/lib/customer/notice-draft-rpc-input.ts
- src/lib/customer/notice-draft-transport.ts
- supabase/hosted-building-slice/building-setup-command-receipts-v1.sql
- supabase/hosted-building-slice/tests/command-receipts-concurrency.test.mjs
- supabase/hosted-building-slice/tests/command-receipts.test.sql
- supabase/migrations/20261025214155_building_setup_command_receipts_v1.sql
- supabase/tests/223_building_setup_command_proof_v2.test.sql
- docs/worklogs/CORE-OPERATIONS-234-1.md

Subsequent changes require a pre-edit entry naming exact paths and purpose.

## Before Operations integration edits

Connect actual asset/contractor routes to maintenance plans and selected work-order lifecycle/history; preserve pending plan across view changes, gate by committed Context readiness; add integrated mounted UI->real API handler->mock RPC offline tests and honest install/runtime table. No Backend/evaluator/Auth bypass/demo edits.

- src/app/[lang]/app/maintenance/page.tsx
- src/components/customer/CustomerMaintenanceDashboard.tsx
- src/components/customer/PreventiveMaintenancePanel.tsx
- src/components/customer/WorkOrderLifecyclePanel.tsx
- scripts/test-operations-app-journey.mjs
- docs/verification/CORE-OPERATIONS-234-1.md
- docs/worklogs/CORE-OPERATIONS-234-1.md

## Source result

The seven-path integration delta above is complete. The full deliverable also carries all 48 accepted outputs, with only the three listed Operations components superseded. The maintenance page, new test and two documents are the four additional paths relative to that assembly. No demo, dependency, lockfile, config, historical SQL, Auth or evaluator edit was needed for this wiring.

Final production build with the existing dependencies passed (`next build --webpack`, 48.47 seconds); the build process had backend connection variables removed. TypeScript and scoped ESLint passed. The new mounted UI -> actual Next handler -> explicit fake RPC test passed 64 checks in eight scenarios. It covered both the connected lifecycle and failure/admission/UNKNOWN boundaries. The independent verification table is in `docs/verification/CORE-OPERATIONS-234-1.md`.

Closed predecessor tests/reviews were not repeated. No SQL parser/compile/query/execute, DB/Auth session, actual HTTP/browser journey, installation, commit, Push or deployment was performed. Runtime/installation acceptance stays on hold. The original checkout, detached WIP and earlier artifacts remain untouched. Full patch/manifest identities and actual apply/reverse results are external delivery metadata, avoiding a self-referential source hash.
