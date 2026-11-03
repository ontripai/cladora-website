# V14-AIRPROP-VAL-SUCCESSOR-02 — computation integrity, lineage and machine-readable basis

Owner: CLADORA AIRPROP / CLADORA-AIRPROP-WORKER-01. Classification: reported, pending independent review.
Assignment: [PM211](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6422101616), continuing PM205D.
Predecessor patch `90928502813e4f5953bceed6dc57fb56959d1c2e` / manifest `b4938e4320ed053bf5982ce1fbc459bc5414b2c9` is CHANGES_REQUESTED by [SERVICE](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6421938337). All predecessor files/artifacts are retained. This successor is author-reported and awaits independent delta review; no finding is self-closed.
BASE `8c8225fb3297035a2349357bd968d60779388063`; Parent `51fdf2e30916e1ff48c5567230dae9b7b6f05029`.
Input: accepted48 patch `60d0b97a4cf231332e9711a126cb859957dce77b`, manifest `453ae7da6fe79332cd2fea1fe083d482b595c589`.
Independent source snapshot; no branch, commit, deployment, SQL or product HTTP. Existing WIP/accepted outputs remain unchanged.

## What now runs

`computeValuationBaselineV1` runs strict versioned prepared-envelope/snapshot/request/policy admission → canonical Core READ evidence binding → existing source-use readiness → existing quality normalization/dedup → scoped comparable selection → exact rational baseline → existing result schema + private explanation trace.

This is arithmetic implementation, not a calibrated market appraisal, runtime authorization producer, persistence receipt or listing/underwriting replacement. It creates no effect, job, history, audit, outbox, journal or publication. A typed request receipt is consumed for immutable identity; no acceptance/COMMIT is asserted by this engine. Same input is safely recomputable because there are no side effects; it is not database idempotency or concurrency proof.

## Six exclusive paths and reuse

- `src/lib/airprop/valuation-baseline-v1.ts`: executable pipeline and rechecked read projection.
- `src/lib/airprop/valuation-baseline-policy-v1.ts`: strict versioned policy and exact rational math actually used by the pipeline.
- `src/lib/airprop/valuation-baseline-explanation-v1.ts`: aggregate explanation and typed internal comparable trace.
- `scripts/test-airprop-valuation-baseline-v1.mjs`: actual source-module execution, no model/provider stub.
- `scripts/fixtures/airprop-valuation-baseline-v1.json`: explicitly synthetic inputs and hand-derived numerical oracles.
- This document.

Read-only reused source: `valuation-contract-v1.ts`, `valuation-quality-v1.ts`, `valuation-source-readiness-v1.ts`, `core/resource-authority-contract-v1.ts` and its canonical Resource/relationship/workspace authority dependencies. Contract/quality/readiness are not copied, replaced or modified. Existing exact-source fingerprint, FX/area conversion and quality rules stay authoritative. This package adds curated cross-site grouping and baseline selection; it does not claim to acquire data or resolve real unit identities.

## Proposed v2 callable ABI and strict trust boundary

`computeValuationBaselineV1({contract:'valuation-baseline-prepared-input.v2',input})` now requires the versioned **complete prepared-input envelope**. Runtime schemas validate every named object strictly, reusing existing contracts for the snapshot, request receipt, canonical Core request/evidence, complete quality policy/FX records, baseline policy, source rights/inventory, observations and unit links. The only open-key maps are existing contract-defined primitive `attributes`; their complete contents are committed, never copied into public trace. Unknown keys elsewhere, wrong versions and explicitly undefined optional values are denied. Missing and null remain distinct.

It returns generic `{stage:'blocked',reason:'valuation_unavailable'}`, global index dependency `{stage:'not_ready',reason:'valuation_unavailable'}`, or strict `valuation-baseline-run.v2`:

- contract and arithmetic stage `insufficient_data | review_required | calculated`;
- `prepared_commitment`, `result_commitment`, `run_version` (lowercase SHA256);
- `valuation`: the proposed local `valuation-baseline-result.v1` wrapper;
- private `internal`: exact source IDs, strictly shaped comparable trace and exclusions.

The local wrapper has `transaction_kind`, exact `rental_period` (`month | year` for rent, explicit null for sale), `currency`, `area_unit='sqm'`, `amount_basis='subject_total'` and the **unchanged** `resource-valuation-result.v1` as `result`. Cross-checks reject a foreign currency or sale/rent range mismatch. Request purposes, policy, actual comparable period and snapshot are bound by computation. No consumer/API/Core ABI registration is claimed. Insufficient results still carry unambiguous basis but no price. Accepted rational/rounding policy source is byte-identical to predecessor.

`projectValuationBaselineV1({trusted_preparation,run,resource,core_request,core_evidence,sources,read_at,detail})` treats the whole argument as unknown and strict-parses it at runtime. The independently prepared reference must come from the same trusted server boundary that curated the computation; it is **never derived from a received run**, accepted from an HTTP caller or authenticated with a bool. Projection calls the **real computation function** again from that reference, then compares the entire validated run/result/basis/trace/private bindings and all commitments exactly. A valid-looking edited price or a coherently rehashed forged run fails. Missing/bad hashes, private keys at any depth, source/version substitution, incomplete envelopes and normalized-on-parse incoming runs fail closed. No digest is an origin signature or a current authorization token.

Only the **reproduced** computation can reach projection. Current Core read evidence and source rights are separately rechecked after reproduction at `read_at`, including exact source inventory version, revoke/expiry/retention and independent result/comparable-use rights. Denial is always the same two public fields with no IDs/counts/validation issues. Optional trusted diagnostic callbacks receive fixed internal reason codes only (`PREPARED_INVALID`, `RUN_INVALID`, `RUN_BINDING_MISMATCH`, `RECOMPUTATION_UNAVAILABLE`, `CURRENT_READ_DENIED`, `SOURCE_USE_DENIED`, etc.), never private values. They are not permission/approval or a new receipt system.

Public projection returns `{valuation}` for result display and `{valuation,comparables}` only for permitted comparable display. Both are finally strict-parsed. Every comparable field is built explicitly by an allowlist from the reproduced trace, **not** a clone of caller/internal trace. Prepared input, Core evidence, raw inventories, internal exclusions and commitments are absent from public output. Licensed source/record fields appear only in the separately permitted comparable projection.

Derived result display can outlive raw retention only under existing explicit current derived-use rights; comparable disclosure still requires raw retention. A different current inventory version cannot silently substitute for the source version of a historical run; require a newly trusted prepared computation or a separately approved future retained-version contract. No such resolver is invented here.

The existing `evaluateCoreResourceAuthorityV1` still validates current resource **READ** evidence. That is not a new valuation-action permission. A live entry must authenticate actual provider/snapshot provenance and obtain action-specific accepted current authority independently. The existing source-readiness trusted flag is supplied only after canonical read binding, never taken from a client, and it grants nothing.

PM212 records delivery (not source acceptance) of CoreA patch `f876946734da9842c9e9609f9e88a440c5236ef5` / manifest `bda20d403b829aa82d26f0d845a85f46fedc75f9`. Its declared `core-v14-execution.v1` `produceV14ValuationInput` still has V1 field/source/version/disclosure gates. This successor does not insert Core files, assume provider readiness, import hypothetical accepted exports or weaken those gates. Existing Core read contracts remain consumed read-only; accepted producer/action integration stays independent.

## Canonical commitments: content, prepared evidence, authenticity are distinct

Canonical preparation parses with existing domain normalizations (including declared UUID/trim transforms), then serializes UTF8 JSON with recursively sorted object keys and no whitespace. No additional implicit NFC, monetary Number conversion or dropped null is applied. Explicit undefined is rejected; schema-required missing fields are rejected. Distinct contract versions/domain separators are included.

Declared sets are sorted deterministically and duplicates rejected: request purposes; Core required/actual relationship scope codes; source evidence kinds/permitted uses. Observation/source/unit-link lists sort by identity, source weights by source ID, index declarations by observation ID and **whole FX records** by canonical record bytes. Duplicate observation/source/link/index/weight identities remain rejected by existing admission. Meaningful arrays, including `match_attributes`, quarantine reasons and snapshot evidence references, retain order. These rules are versioned by `valuation-baseline-prepared-input.v2`.

- `prepared_commitment = SHA256(canonical complete normalized prepared envelope)`. It includes the full receipt (IDs/key/times), Core request/evidence identities/versions/labels/scope/time, entire resource snapshot, all quality-policy fields and every FX record (rate/from/to/effective_at/published_at/source_ref, version context=`quality_policy.policy_version`), full baseline policy, source inventories/rights/versions, full observations/attributes and reviewed unit links. Changing a Core decision ID or FX publication date changes it even when the price does not.
- `result_commitment = SHA256({contract:'valuation-baseline-result-content.v2',valuation,internal})`. This is result/trace content lineage. Equal result content can retain this commitment while prepared evidence changes; it is not complete preparation provenance.
- `run_version = SHA256({contract:'valuation-baseline-computation.v2',computation:{contract:'valuation-baseline-run.v2',stage,prepared_commitment,result_commitment,valuation,internal}})`. This binds both commitments and the exact associated output/trace/basis.

There is **no authenticated persisted/sealed receipt** in this package. An attacker can recompute all three unkeyed digests; tests do exactly that and still fail against the independent prepared reference. Reproduction is a server-boundary consistency check, not proof of origin, provider authenticity, transaction commit, live rights or installed current authority. Neither hash nor a schema creates any of those facts.

## Pilot proposal, not market approval

Propose residential apartment **units** in București, separately sale in EUR and monthly rent in EUR. Core canonical resource type is `unit`; policy-mapped `unit_kind=apartment` restricts the synthetic example. Office/commercial/other models are not inferred from that example or removed from AIRPROP's domain. Each needs its own reviewed policy/data.

The fixture is invented, including its rights, unit links and Core observations. They are test evidence, not actual licenses or runtime authority. The configured minimum3 units, area-ratio0.5–2, outlier ratio4 and equal/example source weights are explicitly **synthetic policy examples**, not approved accuracy, freshness or market coefficients. `curated_unvalidated` is also not a production-validation claim.

PM/data owner must approve: actual retained source dataset and rights/version coverage; curated same-unit grouping across sites; market/type/area/rental basis; sample/freshness/selection policy; spatial and temporal holdout with unit leakage controls; accuracy/bias/interval-coverage targets. No paid API, scraping or connector is attempted. Until those exist, real-market backtest/accuracy/production readiness are NOT_RUN_NOT_PASS.

## Selection and exact mathematics

1. Resource/request/workspace/version and Core read evidence must agree. Snapshot cannot postdate `as_of`; accepted/request/computation times must be ordered. Country/locality/type and quality-policy version/as-of are explicit.
2. Policy maps existing snapshot `attributes` to area/unit, market-location key and comparison attributes. Those are **configuration fields for a prepared snapshot**, not a claim that Core A exports new canonical keys. Synthetic mapping: `area`, `area_unit`, `market_location_key`, `unit_kind`, `floor`, `condition`, `bedrooms`. Missing/null/non-string/zero area is not zero-valued property evidence. Missing location/required attributes produces insufficient data, not geographic guessing.
3. Sources must have current and as-of quality-use rights plus current result-display rights. Foreign Workspace observations fail the entire projection generically before existence/count disclosure. Source inventory versions are bound to the curated input batch; authenticity remains an intake gate.
4. Existing quality code excludes quarantined/stale/future observations/collections and future/unavailable FX, normalizes currency with explicit rates and sqft with exact0.09290304, and handles same-source exact duplicates. Baseline additionally applies source-specific freshness and requires non-missing area/weight.
5. Sale/rent, asking/deal/external estimates, market/type/location and required unit attributes are selected exactly. They are never blended. Monthly/yearly rent are distinct; this baseline does not convert rental periods or multiply sale into rent. Rent period is explicit in policy/observation and result explanation because existing result ABI has no rental-period field.
6. Each selected observation requires an independently curated unit link with Workspace/review/as-of binding. One representative per unit, latest observed then stable observation ID, before outlier filtering. Same building is not same unit. No address/price heuristic silently invents entity resolution. Unresolved links are excluded, possibly making the result insufficient.
7. `time_adjusted` must explicitly be false. There is NO accepted time-index producer/rights/market artifact. Any nonidentity factor makes computation `NOT_READY` before baseline math, and a corresponding run cannot project. Arbitrary multipliers, future/ref/version variations and unaccepted producer/rights/market extensions cannot create calculated data. Identity/no-index paths retain previous interval/publication/pre-adjustment controls. Factor1 never proves an index: trace index reference/version are null, and no producer/rights provenance is asserted. No CPI/property double adjustment, amenity coefficient or service-price capitalization is introduced.
8. Exact rational price/sqm = normalized monetary amount / normalized sqm × eligible time factor. No monetary Number arithmetic. BigInt constructors (not bigint literals) compile with the unchanged ES5 tsconfig; no downlevel/dependency override. Supplied integer source weights are relative, not probabilities. Median outlier-ratio exclusion is explicit, deterministic and reported, never raw-data rewriting.
9. Central = Σ(price/sqm × source weight)/Σ(weights) × subject sqm. Low/high = min/max selected price/sqm × subject sqm. Low rounds down and high up to0.01; central rounds half-up to0.01; price/sqm basis rounds half-up to0.0001. This observed envelope is **not a statistical confidence interval**. Sub-cent/overflow values that cannot meet the existing positive decimal contract produce insufficient data or a generic blocked invalid computation, never fabricated fallback prices.
10. Require minimum distinct comparables and complete subject inputs. Otherwise existing outcome `insufficient_data`, all numeric outputs NULL, named missing inputs, real evidence window/null-zero distinction. Valid arithmetic yields existing `outcome=sufficient`; outer stage is `calculated` only for selected verified-deal evidence without exclusions, otherwise `review_required`. Neither stage is expert acceptance: existing `review_status=not_reviewed` always.

The strict private per-comparable trace retains unit/source/version/record/review provenance, observed time, relative weight/rationale, normalized amount/area, adjusted unit price and FX reference. Current supported time factor is identity only, with index reference/version null. Aggregate result explanations never include source or unit IDs. The quality score is selected-unit count divided by known-observation count (bounded0–1); **selection coverage only**, not error or confidence. Future observations are not counted as as-of-known evidence.

`dataset_version` retains the accepted observation-quality/source/unit lineage. Complete preparation is additionally and explicitly bound by the three v2 commitments above; it is no longer claimed that the old arithmetic-only run hash captured request/Core/full FX provenance. Fact/version changes create new computation lineage even when the price is unchanged. No history/persistence success is asserted.

## Time-index dependency retained, not activated

Owner: AIRPROP index/source producer; Core owns the current-authority seam. Future activation requires an independently accepted producer artifact/ABI and immutable record with source ID/version, market/country/locality/location/type, target currency, transaction/rental period, observed/effective/coverage/publication times, price-index basis, factor/version/evidence identity, verified usage scope/workspace and permitted calculation/derived-display uses, raw/derived retention and revocation/current-authority rechecks. All must be bound to the request/snapshot and current prepared evidence. A free-form reference or factor1 is insufficient. No service, connector, index signature, positive grant, controller or market-data purchase is created. Until this contract/artifact is accepted, nonidentity time adjustment remains NOT_READY; v1.4 capability/backlog is preserved.

## Offline oracle and validation

Run `node scripts/test-airprop-valuation-baseline-v1.mjs --successor`. It executes actual product modules and the actual canonical Core evaluator using existing TypeScript transpilation in memory. No SQL/HTTP/DB/parser/fixture runtime or model mock. Canonical repository TypeScript separately uses the original config.

Independent hand oracle: three synthetic100sqm sale units at100000/200000/300000 produce unit prices1000/2000/3000 and a100sqm subject's100000/200000/300000 envelope. Source weighting1/1/4 yields central250000. Distinct monthly-rent50sqm observations at500/1000/1500 yield1000/2000/3000 per month for100sqm. The predecessor had a1.1 synthetic-index example, but nonidentity adjustment is now deliberately NOT_READY; it is not a success oracle. Explicit existing FX5 still produces central1000000 in RON. Fixtures state these independently; tests do not calculate expected values by calling the implementation.

121 targeted offline cases PASS: seven relevant accepted oracle/insufficient/rent/order/no-effects controls and114 new SR01–04 family regressions. The prior41-case suite is retained/adapted for the versioned ABI, but not blindly replayed. These regressions include coherent rehash attacks in both result/detail branches; private nested fields; strict prepared/run/internal shape; original/reference/source/version drift; full Core/receipt/FX/rights/snapshot lineage; month/year/sale basis mismatch; immutable inputs; current rights/revoke; identity positive and unsupported nonidentity/index-rights branches. Optional diagnostics are asserted reason-specifically; public denial stays generic.

Before/after: reconstruct the six predecessor files from its official patch in an independent folder and run `node scripts/test-airprop-valuation-baseline-v1.mjs --probe-predecessor /path/to/predecessor`. Actual preserved predecessor source is loaded, with unchanged read-only contract dependencies from input48. All five SERVICE counterexamples plus one SR04 witness were reproduced: tampered price/hash accepted, private trace leaked, Core identity not in hash, FX publication not in hash, rent period absent, and unproven1.1 multiplier calculated220000. This is evidence of predecessor failure, not six successor PASS claims. Matching successor negatives reject them against an independently prepared reference, not an oracle derived from a tampered run.

Canonical TypeScript, scoped lint/syntax and real six-file apply/readback/reverse results are in the delivery manifest. Rational policy file and weighted aggregation/rounding source region remain byte-identical. No SQL/runtime/backtest/closed Backend suites run.

| Plan case | This package's source/offline evidence | Still not proved |
| --- | --- | --- |
| VAL01 | distinct unit attributes, floor/area/type/location, no building-average fallback | fitted feature effects on real units |
| VAL02 | asking/deal/external kept separate, no forced approval | real-source verification/authenticity |
| VAL03 | reused exact dedup + curated multi-site unit grouping | actual entity-resolution accuracy |
| VAL04 | explicit FX/sqm/rental-period controls, exact math | production source FX/area reliability |
| VAL05 | real insufficient outcome, stale/quarantine/outlier exclusions | calibrated market thresholds |
| VAL06 | identity/no-adjustment positive; nonidentity NOT_READY; pre-adjustment/duplicate rejection | accepted index producer, complete market/rights/current-authority binding and calibration |
| VAL07 | future observations/collection/FX/index publication excluded | authorized historical point-in-time dataset |
| VAL08 | NOT_RUN_NOT_PASS | temporal/spatial held-out backtest, unit leakage proof |
| VAL09 | NOT_RUN_NOT_PASS; no error/confidence claim | MAE/medianAPE, bias, envelope coverage by market/type |
| VAL10 | repeatability and version-sensitive source/input/result hashes | durable history/job production repeatability |
| VAL11 | existing Core/source revocation checks at read seam only | persisted expert override/version concurrency, live revoked-session proof |
| VAL12 | generic deny, no cross-tenant counts/IDs; separate comparable rights | actual authenticated server/provider/row-level enforcement |
| VAL13 | pure same-input recomputation, no mutations | real DB retry/locking/concurrency/unknown-COMMIT |
| VAL14 | input unchanged, no fetch; result publication/journal effects absent | installed end-to-end effect isolation |

## Delivery, remaining gates and next owner

Only the same six assigned paths are emitted as a complete BASE-relative successor; the rational policy path is unchanged from predecessor. The previous six-file patch is superseded for review, not stacked blindly or deleted. Full BASE-relative patch includes no other accepted48 files; delivery pins exact input48/preimages/output bytes/SHA256/Git identity and readback. Existing product/helper/SQL/receipt/underwriting/draft/UI source is unchanged. No commit/tree/ref/Push/PR/CI/deploy/SQL/install/activation/Production.

PM assigns an independent non-author reviewer; Core may review only the actual accepted producer/consumer seam when its artifact is available. No self-acceptance. Runtime gates are action-specific Core authorization and trusted snapshot provenance, actual current rights/curation/retention, market policy/dataset/accuracy approval and separately authorized persistence/runtime proof. These gates do not halt the independent source arithmetic or create dependencies for ordinary SERVICE/CE flows.

## Finding disposition (author implemented; independent review required)

| Finding | Successor closure evidence | Remaining gate |
| --- | --- | --- |
| AIR-VAL-SR-01 | strict full envelopes; actual recomputation from independent trusted preparation; whole-run equality; explicit trace allowlist/final strict parse; coherent-hash/private-field/source/version/incomplete negatives | trusted server/preparation origin and action authority, no persisted seal fabricated |
| AIR-VAL-SR-02 | versioned complete preparation + separate result/computation commitments; Core/receipt/full FX/rights/version/order/null regressions | real provider provenance and durable receipt remain unproved |
| AIR-VAL-SR-03 | local versioned machine-readable result wrapper; exact month/year/null/currency/area/amount basis bound to policy/purpose and revalidated in projection/hash | proposed local ABI, no installed consumer/API registration |
| AIR-VAL-SR-04 | nonidentity NOT_READY; identity trace has no fabricated index provenance; future/market/source/rights/producer mutation families cannot calculate/project | AIRPROP accepted index/source artifact + Core authority seam, rights/market/retention proof |

All numerical oracle/source-data limitations and VAL08/09/11/13 live gates remain. Current SERVICE/AIRPROP source is not approved by this author report. No CE/PROCEDURE/Core/shared paths were edited; incorrectly routed PM212 task was left with CE per owner clarification.
