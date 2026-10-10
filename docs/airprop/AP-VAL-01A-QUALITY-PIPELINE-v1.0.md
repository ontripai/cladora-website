# AP-VAL-01A2 — deterministic observation quality pipeline

**Owner:** AIRPROP  
**Parent:** AP-VAL-01A / Draft PR #314 at `53f603a345cca4e1d0494d4533578dc795f7d6c4`  
**Status:** Implementation candidate; review acceptance pending  
**Scope:** Remaining Slice A quality controls only

## Purpose

This package turns the Slice A observation contract into a deterministic, synthetic-fixture quality pipeline. It retains evidence classes, source rights and quarantine reasons; detects exact source-record duplicates; normalizes an explicitly supplied currency rate and area basis; rejects future information; flags stale evidence; and emits a reproducible dataset version.

The pipeline estimates no sale or rent value. It creates no connector, market dataset, Core Resource, relationship, authority decision, valuation job, Listing, publication, journal, audit event, outbox event or production configuration.

## Boundary and ownership

- `resource-valuation-input.v1` remains a consumer interface only. Core/Platform owns the accepted Resource/Relationship/Authority snapshot and current permission decision.
- FX inputs are explicit, versioned evidence supplied to the pure pipeline. No rate provider or paid connector is implied.
- Exact duplicates from one source record are suppressed deterministically. Possible cross-source matches remain separate until an authorized entity-resolution policy exists.
- Missing area or exchange evidence remains missing; it is never replaced with zero or a guessed value.
- Asking prices, verified transactions and external estimates remain separately counted.
- The generated dataset hash is reproducibility metadata, not proof of source authorization or model accuracy.

## Covered plan cases

| Case | Evidence |
| --- | --- |
| VAL02 ask versus deal | Evidence classes remain distinct and are counted separately. |
| VAL03 duplicate listings | Exact same-source identity is deterministic; cross-source collapse is intentionally deferred. |
| VAL04 currency and area basis | Explicit as-of-safe FX and sqft-to-sqm normalization; missing area remains null. |
| VAL05 stale, future and quarantined evidence | Observations remain explainable but cannot be eligible silently. |
| VAL07 future information | Observations, collection and FX publication/effective dates are bounded by the declared as-of time. |
| VAL10 reproducibility | Canonical policy/output facts generate a stable dataset version independent of input order. |
| VAL14 no downstream effects | The result has no value range, Listing publication or financial command. |

VAL01, VAL06, VAL08, VAL09, VAL11–VAL13 require later model, persistence, authority or concurrency packages and are not claimed here.

## Next gates

AP-VAL-01B still requires an explicitly authorized source/import and usage contract. AP-VAL-01C still requires an approved retained dataset, selected market/resource type and locked accuracy criteria. This package provides neither and must not be represented as real-market validation.
