# CLADORA-P2-SETUP-001 — Discovery and implementation report

## Verdict

`RELEASED` — Migration 94 was applied exactly once, reconciled to canonical version `20260914071532`, and PR #86 was squash-merged as `7fefc66d34a9ac64a4e2a73740d2f67f33139508`. Production deployment reached `READY` with `Local 94 / Remote 94 / Drift 0`.

## Discovery

The earlier Stage 1 closure evidence describes the onboarding journey, but the current `CustomerBuildingSetupWizard` was a static step selector. The canonical residential importer starts from an existing property and open accounting period, so it cannot itself create the minimum building structure safely.

Migration 94 closes that integration gap without duplicating the importer. It introduces a tenant-scoped setup plan with an immutable payload hash, idempotent creation, zero-write opening-balance rehearsal, AAL2 authorization, independent approval, and atomic provisioning of one property, one building, its units, and one open accounting period. Existing import, reconciliation, activation, journal, allocation, payment and provider contracts remain unchanged.

## Application flow

The RO/EN/FA wizard collects association, building, unit and accounting-period data and previews debit/credit difference. Its server routes enforce same-origin, JSON-only requests, bounded bodies, authenticated Supabase RPC execution and `no-store` responses. A draft must rehearse to zero before submission; its submitter cannot approve it; only an independently approved plan can provision.

## Evidence

- Migration 94: `20260914071532_controlled_building_setup_opening_rehearsal.sql`
- Test 081: `081_controlled_building_setup_opening_rehearsal.test.sql` (`BEGIN … ROLLBACK`, 24 assertions)
- Synthetic test identities use only `@cladora.test`; no real customer data is introduced.
- No journal is posted by draft creation, rehearsal or provisioning.
- Migration 1–93 are unchanged by this package.

## Release boundary

The release gates were completed without provisioning real-customer data. Subsequent hardening is tracked by `CLADORA-P2-SETUP-HARDENING-001`; any new Apply or Merge still requires separate authorization.
