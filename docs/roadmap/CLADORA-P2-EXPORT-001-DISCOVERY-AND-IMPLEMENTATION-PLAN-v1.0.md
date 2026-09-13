# CLADORA-P2-EXPORT-001 — Discovery and Implementation Plan v1.0

**Roadmap stage:** 4 — Auditable Outputs & Evidence  
**Baseline:** `main@7fb59237ddcd1133241a54e2289f2bcdaed9bf6b`  
**Status:** Local implementation candidate; no remote apply or merge authorized

## Discovery verdict

The closed-period finance snapshot, Romanian financial-report query, secure
document vault, SHA-256 evidence, retention, legal hold and dual-control
contracts already exist. The missing canonical boundary is a reproducible export
pack that binds one closed period to one immutable source snapshot, a manifest
and format-specific artifact records.

The existing document scanner state is deliberately fail-closed. This task does
not select a malware provider, add credentials, relax download controls or attach
unscanned files as authoritative evidence.

## Migration 91 contract

Migration `20260913132944_romanian_statutory_operational_export_pack.sql` adds:

- a sealed `finance.export_packs` registry;
- a tenant-bound `finance.export_artifacts` registry;
- a deterministic Romanian (`ro`) manifest for seven report families;
- PDF, XLSX and CSV artifact slots (21 per pack);
- SHA-256 source and manifest fingerprints;
- closed-period, AAL2, role, permission, scope and idempotency gates;
- immutable pack protection and append-only audit evidence;
- guarded `customer_api` create/read contracts without raw-table grants.

The database does not render binary files, post journals, change receivables,
move funds or alter the closed accounting snapshot. Rendering and later clean
scanner attestation remain separately controlled server workflows.

## Canonical report families

1. Romanian trial balance;
2. unit charges and allocation register;
3. receivables and collections register;
4. bank reconciliation report;
5. supplier invoices and payments register;
6. meter and allocation evidence;
7. governance approval and audit trail.

## Explicit boundaries

- No SAF-T/D406 claim.
- No accountant certification claim.
- No qualified electronic signature.
- No malware-scanner provider or environment variable.
- No Storage object is made downloadable by this migration.
- No Supabase remote apply and no merge under the current authorization.

## Acceptance

Test 077 is transaction-wrapped and proves the catalog, gateway, isolation,
permission, closed-period, idempotency, hashing, audit and immutability contracts.
Runtime pgTAP and linked transactional rehearsal remain release gates because
the current execution environment has no Docker/Podman runtime.

## Canonical row-set closure

Migration 91 seals seven bounded, deterministically ordered datasets into
`source_snapshot.reports`. Every dataset is restricted to the selected closed
period, tenant and property scope and fails closed above 5,000 rows.

The export excludes actor/user identifiers, bank counterparty and remittance
data, encrypted account references, ballot receipts, raw source snapshots,
object paths, meter notes and contact details. The renderer accepts only these
sealed row sets, caps rows and columns, preserves deterministic PDF/XLSX/CSV
bytes and neutralizes spreadsheet-formula prefixes without changing the source
value.

## Verdict

`READY-FOR-CLADORA-P2-EXPORT-001-LOCAL-VERIFICATION`
