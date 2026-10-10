# AP-VAL-01A3 — source inventory and baseline preparation

Owner: AIRPROP. Parent: AP-VAL-01A2, PR #350 at `77f927ebe05e9d2aed6a9e80de0fea93f3bcc549`.
Status: implementation candidate, submitted for review; acceptance pending.
Program: CLADORA v1.4, Slice A. No source has been connected or purchased.

## Source inventory

This inventory identifies missing provider inputs. These are candidate categories, not an acquired dataset or a source license. All real sources remain pending.

| Candidate category | Evidence class | Intake proposal | Required evidence before use | Owner / current state |
| --- | --- | --- | --- | --- |
| Owner-supplied historical purchase/rent evidence | Verified transaction only after verification | Controlled manual import | Exact Workspace, disclosure permission, verification reference, correction/version history, retention | AIRPROP intake / pending; Core owns Resource and relationship |
| Developer or advisor price list | Asking | Authorized feed or manual import | Source owner, terms, price validity, tax/fee/furniture separation, usage and republication rights | AIRPROP intake / pending |
| Licensed market observations | Asking, verified transaction or external estimate kept separate | Authorized API/feed | Access and usage contract, permitted training/display uses, freshness, deletion and derivative retention rules | AIRPROP intake / pending; no paid connection authorized |
| Public market/index/FX publication | External estimate or explicitly typed auxiliary evidence | Authorized import | Original publication/version date, geography and period, permission evidence; public availability alone is insufficient | AIRPROP intake / pending |
| Operations/SERVICE condition evidence | Condition or cost evidence, not sale/rent value | Provider-owned reference | Resource/version/date/source and current disclosure contract; no guessed price coefficient | Operations/SERVICE provider / formal dependency, no foreign-domain implementation |

## Executable readiness evidence

`valuation-source-inventory.v1` pins a source/version, owner, acquisition method, evidence classes and proposed freshness. Reviewed usage evidence separately declares its effective interval, exact Workspace or public scope, permitted uses, raw retention and derived retention.

`evaluateValuationSourceReadinessV1` is a pure preparation helper. It consumes trusted curated metadata, never client assertions for runtime authorization. Missing/revoked/pending rights, future review, expiry, wrong Workspace, undeclared training/disclosure use and retention expiry produce explicit blockers. Effective and retention end instants are exclusive. A `result_display` use can outlive raw retention only while explicitly permitted derived retention remains active.

`evidence_ready` means this metadata has no identified preparation blocker. It proves neither a license's authenticity nor Core authority, source accuracy, sufficient observations, connector approval or readiness to publish. Runtime consumers must independently recheck current Core authority and rights at command/read time. This helper is not wired into an API or the quality pipeline. Observation age, FX and deduplication remain AP-VAL-01A2 responsibilities; no completed controls are reimplemented.

## Proposed baseline for review

Propose Bucharest residential apartments as the first market/type, with separate sale and monthly-rent evaluation. This is a proposal, not an accepted market selection. Start with explainable comparable evidence and a simple benchmark; introduce fitted adjustments only after an approved dataset exists. Asking evidence cannot become a verified transaction, and sale-to-rent conversion is not assumed.

Before AP-VAL-01C, PM must lock the market/type, approved retained dataset, holdout dates/geography, canonical unit grouping across sources, minimum sample and freshness criteria, error/bias and interval-coverage thresholds. Train/test must exclude repeated units and future-published evidence. Report MAE or median absolute percentage error, bias and interval coverage separately by market/type, against the simple benchmark. Threshold values remain unset until approved; synthetic tests establish logic, not market accuracy. No price or fitted model is delivered here.

## Dependencies and exit gates

| Dependency | Owner | Required output / current live evidence |
| --- | --- | --- |
| `AP10-AUTH-E2E-FIXTURE` | CLADORA Control/Core test infrastructure | Resettable non-Production synthetic canonical AAL2 fixture, two Workspaces, named properties and multiple units, revoke/AAL1 cases and teardown. Core PR #351 at `777563e60a8880ea2853e2cd65f33c494042c811` is delivered with green CI; PM acceptance and consumer readiness are still pending. AIRPROP does not create or alter Auth. |
| Accepted Core Resource snapshot, relationship and authority contract / `AP-PF02` | Core/Platform delivers; CLADORA Control & PM accepts | Exact accepted `core-resource-authority.v1` revision, canonical identity/version, relationship/representation validity, temporal provenance, safe names, Workspace isolation, deny/redaction, historical compatibility and current command-time authority recheck. Core PR #353 at `83d5ae14e6c67e93bd8f3a383c89d63f28912152` is delivered; acceptance is not inferred from CI/Preview. |
| Source access and usage evidence / AP-VAL-01B | AIRPROP intake; source rights owner approves | Explicit source/version, intake permission, raw and derivative rights/retention, geographic/type/time coverage and controlled synthetic-to-real evaluation boundary. No eligible real source is claimed. |
| Dataset and accuracy criteria / AP-VAL-01C | AIRPROP proposes; CLADORA Control & PM accepts | Approved retained dataset and prelocked market/type, holdout and accuracy criteria. |

Dynamic Resource runtime remains gated by accepted Core revision and passing AP-PF02 consumer tests. AP10 authenticated E2E remains gated by accepted fixture handoff and explicit consumer execution scope. This independent Slice A package proceeds through review without blocking the commercial delivery chain.

## Verification and boundaries

The executable tests use only synthetic source-rights metadata. They cover revocation, temporal limits, exact Workspace scope, separate training/result/comparable rights, raw/derived retention and no connector/publication authority. No migration, persistence, Auth identity, source connection, real data, Core/SERVICE code, Listing command, audit/outbox/ledger, Merge or Production deployment is added.
