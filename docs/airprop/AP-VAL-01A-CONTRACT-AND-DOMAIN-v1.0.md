# AP-VAL-01A — valuation contract and domain baseline

**Owner:** AIRPROP  
**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`  
**Status:** Implemented locally; acceptance pending PR review and CI  
**Scope:** Slice A only; no database migration, external connector, production model, publication or deployment

## Decision boundary

AP-VAL-01A defines the testable AIRPROP-owned contract for valuation evidence, request receipts, results, expert review and listing-price decisions. It consumes a versioned Core resource snapshot but does not create Resource identity, ownership, representation, Workspace authority or PM-01 records.

The contract keeps `asking`, `verified_transaction` and `external_estimate` evidence distinct. A result with insufficient data cannot contain a numeric range. A listing-price decision is always non-publishing (`publish: false`); a separate authorized listing command remains necessary.

## Contracts

| Contract | Producer | Consumer | Boundary |
| --- | --- | --- | --- |
| `resource-valuation-input.v1` | Core snapshot adapter | AIRPROP | Versioned resource facts only; no permission decision |
| `market-observation.v1` | AIRPROP import/curation | AIRPROP model | Provenance, usage rights, verification and quarantine retained |
| `valuation-request-receipt.v1` | AIRPROP | AIRPROP clients | Immutable request/resource/workspace identity |
| `resource-valuation-result.v1` | AIRPROP model | AIRPROP clients | Range, evidence quality, explanations and version lineage |
| `valuation-review.v1` | Authorized AIRPROP review route | AIRPROP | Human accept/override/reject with reason |
| `listing-price-decision.v1` | Authorized AIRPROP decision route | Listing workflow | Decision support only; never publishes automatically |

## Data and modeling rules

- Resource type is explicit so each type can later select an independent model and comparable policy.
- Observation fingerprints support deterministic source-record deduplication without treating changed descriptive attributes as a new source record.
- Quarantined observations remain explainable but are not silently promoted to evidence.
- Monetary decimals remain strings to avoid binary floating-point loss at contract boundaries.
- Every result carries resource snapshot, model, dataset and policy versions plus `as_of` and compute timestamps.
- `quality_score` is a bounded data/model quality measure, not an unsupported statistical confidence claim.

## Deferred by design

- Core DW-02/PM-01 snapshot adapter and server-side authority checks: blocked until the Core contract is published and accepted.
- Source connectors, licensed datasets and entity resolution: AP-VAL-01B.
- Calibrated baseline sale/rent models and backtesting: AP-VAL-01C.
- API, persistence, multilingual UI and immutable history: AP-VAL-01D after DB/API authority design.
- Listing, PF and condition-evidence integration: AP-VAL-01E.

No completed commercial-lifecycle implementation or test from PR #310 is repeated by this package.

