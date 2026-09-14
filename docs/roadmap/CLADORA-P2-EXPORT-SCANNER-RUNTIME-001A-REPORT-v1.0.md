# CLADORA-P2-EXPORT-SCANNER-RUNTIME-001A — Runtime Boundary Report

## Verdict

`READY-FOR-DRAFT-PR` — source-only runtime boundary; no remote activation.

## Decision

Vercel Cron schedules are Production-only. A Preview-only schedule cannot be represented safely in `vercel.json`, so this package deliberately adds no Cron configuration. It provides a manually invoked Preview-only diagnostic route instead; Production always returns `404`.

## Delivered

- Migration 97 exposes three `public` PostgREST wrappers for Migration 96.
- Wrappers are `SECURITY INVOKER`, fixed to `pg_catalog`, and executable only by `service_role`.
- `app_private` remains absent from the exposed API schema list.
- The internal route requires Preview environment, a minimum 32-character bearer secret, timing-safe comparison and an explicit mock feature flag.
- The route processes only a compiled synthetic in-memory fixture and never constructs a Supabase client.
- Test 084 proves the database privilege/delegation boundary; the Node acceptance test proves Production denial and Preview authentication/configuration gates.

## Deferred

- Migration 97 Supabase Apply
- Production Cron activation
- service-role and Cron credential provisioning
- live provider selection and credentials
- real queue/storage adapter activation
- customer-data scanning and clean-download rehearsal
