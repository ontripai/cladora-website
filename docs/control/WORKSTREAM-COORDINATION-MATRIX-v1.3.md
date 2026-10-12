# CLADORA live coordination matrix v1.3

**Observed:** 2026-10-12 (Asia/Tehran)

**Repository:** `ontripai/cladora-website`

**Pinned main:** `c7da62b13822cdd93706b008b10b45f70765fc3c`

This is a public, commit-pinned coordination snapshot. It records repository state and bounded technical evidence. It does not disclose private PM bindings, operational requests, credentials, customer data, SQL bodies, or object definitions. A passing check or merged contract is not runtime acceptance.

## Repository state

- All Core, AIRPROP, SERVICE, and Community & Experience delivery branches used by the v1.4 contract consolidation are merged and deleted.
- The remote has three branches including `main`.
- Two pull requests remain open:
  - `#324` — private PM runtime implementation; migration/runtime work remains blocked and is not safe to merge as a public control update.
  - `#347` — this documentation-only reconciliation.
- The application build, GitHub Actions, and automatic Vercel deployments were successful for the latest merged workstream heads. Those results prove only their tested scope.

## Workstream status

| Workstream | Merged and independently bounded | Remaining gate |
| --- | --- | --- |
| Core / Platform | Contract stack, Resource/Authority contracts, synthetic AP10 fixture, workspace configuration contract, and `CurrentAuthorityTransactionalPortV1` contract | Real transactional authority provider; authorized Remote history convergence; runtime migrations and provider evidence |
| AIRPROP | Valuation contract, quality and source-readiness checks, AP-PF02 boundary, and commercial contract/test/docs chain | Eight migration package, runtime/API deployment, explicit activation, real HTTP/AAL2 proof, and Release acceptance |
| SERVICE | Nine-slice contract stack, receipt envelopes, provider adapter contracts, and non-executable runtime commit coordinator | Canonical runtime providers, aggregate persistence, transactional idempotency/audit/outbox, unknown-commit recovery, and DB/API/browser concurrency evidence |
| Community & Experience | CE010/011/012 recovery UX, experience coordination receipt, command/editor contracts, and disabled provider bridge | Documents provider, Guide/receipt persistence, command gateway, activation, and real browser/runtime evidence |
| Documentation & PM | Alias normalization, forward-convergence migration in the Repository, head-bound reviews, and branch consolidation | Authorized Remote apply, private PM runtime separation, final runtime acceptance records, and closure of `#324` |

## Database history gate

The latest read-only reconciliation reports:

- Repository product migrations: `238`
- Remote product history: `237`
- Pending product migration: `20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1`
- Pending migration SHA-256: `fdff99135db6cba70ff480552aff1e8e24516d79c31b50ee9394293c977d0602`
- Unexpected pending product migrations: `0`
- Private PM control-plane entries: `4`, tracked independently
- Historical content mismatches: `11`, retained in the exception ledger; no repair or replay is implied

The pending Remote write is **not authorized by this document**. A connected dry-run must again prove the one-item pending set before any separately authorized apply.

## Topological continuation

1. Obtain explicit authorization and apply only the pending forward-convergence migration after a connected one-item dry-run.
2. Deliver canonical runtime providers for Core authority, Documents/Communications, Delivery evidence, Operations, and PF01.
3. Merge migration-first runtime packages with execution privileges disabled.
4. Apply authorized migrations and verify RLS, denial, rollback, and zero-write behavior.
5. Deploy runtime code while commands remain disabled.
6. Activate commands through a separately reviewed grant/feature gate.
7. Run real DB, API, browser, AAL2, replay, and concurrency acceptance before Release.

## Evidence boundary

- Local disposable-database fixtures support contract review but do not prove Supabase Remote behavior.
- Synthetic Auth/Storage fixtures do not prove GoTrue, PostgREST, Kong, Storage, or browser AAL2 behavior.
- `commands=null`, `can_edit=false`, and `executable=false` are intentional until runtime providers and activation gates pass.
- PM write failures caused by unavailable private connectivity do not authorize guessed versions or use of workstream credentials.
- Private PM evidence remains outside the public Repository.
