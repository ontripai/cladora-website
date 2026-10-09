# CLADORA workstream coordination matrix v1.0

**Observed:** 2026-10-09, from live GitHub PR metadata after fetching all `origin` heads and tags

**Repository:** `ontripai/cladora-website`

**Control PR:** [#313](https://github.com/ontripai/cladora-website/pull/313)
**Status:** Coordination record for the current Draft PR stack; not a merge or release authorization

## Current coordination matrix

All rows below were `OPEN`, `Draft` and reported `CLEAN` by GitHub at observation time. “Green” means every check present in the live PR rollup succeeded; it does not mean that a work package is accepted, merged, migrated or deployed to Production.

| PR | Execution owner | Purpose | Base | Live head | Live CI / Vercel | Expected bounded output |
| --- | --- | --- | --- | --- | --- | --- |
| [#313](https://github.com/ontripai/cladora-website/pull/313) | PM / Documentation | Publish the controlled CLADORA v1.4 baseline, PM-01 lifecycle, UX/UI/CSS registry and four-workstream routing | `main` | `2fb9d7d264666d68d2f0063110c99b8a7a76acb9` | Vercel green; no repository workflow check is present in the rollup | Versioned documentation baseline and coordination record only |
| [#314](https://github.com/ontripai/cladora-website/pull/314) | AIRPROP | Establish the `AP-VAL-01A` valuation contract baseline | `docs/cladora-v1.4-controlled-baseline` (#313) | `53f603a345cca4e1d0494d4533578dc795f7d6c4` | All 9 repository checks green; Vercel green | Versioned valuation contracts, deterministic provenance/fingerprint behavior, tests and execution report; no runtime integration |
| [#315](https://github.com/ontripai/cladora-website/pull/315) | AIRPROP | Deliver `AP01-LC-01` versioned listing controls | `feat/airprop-ap-val-01a` (#314) | `6e6f6fc4996446798df9b4d85518eca762be8657` | All 14 repository checks green; Vercel green | Edit, withdraw and republish commands, revision history, authority/idempotency controls and isolated SQL/route evidence; no Production migration |
| [#316](https://github.com/ontripai/cladora-website/pull/316) | Core / Operations | Prepare the `DW-01A` Workspace capability snapshot reader | `main` | `81fb0744d7ffb1ce682dbb8ae96541da4ffe7b3f` | All 14 repository checks green; Vercel green | Reviewed capability-reader contract, RPC/migration package and pgTAP evidence; endpoint activation remains separate |
| [#317](https://github.com/ontripai/cladora-website/pull/317) | SERVICE | Define the v1.4 `SV01B` offering-eligibility contract | `main` | `dc1816b07622fa52e02fc9aa574265c1f73e3ebb` | All 14 repository checks green; Vercel green | Eligibility/provider/coverage contract, resource selector and focused tests; no operational endpoint or database change |
| [#318](https://github.com/ontripai/cladora-website/pull/318) | Community & Experience | Deliver independently reviewable CE v1.4 capability slices | `docs/cladora-v1.4-controlled-baseline` (#313) | `d12baf5c78eb846e1704646b931f876ea5a41b2e` | All 3 repository checks green; Vercel green | Repository-owned CE-010/011/012 domain, UI and review packages within the PR's stated boundaries; no public connection or Production migration |
| [#319](https://github.com/ontripai/cladora-website/pull/319) | AIRPROP | Add AP02 reservation lifecycle controls | `feat/airprop-ap01-listing-controls` (#315) | `d7155e6b8387b9c207334381abf878856f6279c1` | All 14 repository checks green; Vercel green | Cancel, expire, extend and convert controls with immutable revisions and concurrency/idempotency evidence; no Production migration |
| [#320](https://github.com/ontripai/cladora-website/pull/320) | SERVICE | Define the `SV01E-F` exact-quote acceptance boundary | `feat/service-v14-offering-sv01b` (#317) | `7a1b773b34a09651e61b686e56b798a73f979102` | All 14 repository checks green; Vercel green | Strict customer intent and server-snapshot decision contract; no Order persistence, Finance posting or operational route |
| [#321](https://github.com/ontripai/cladora-website/pull/321) | SERVICE | Define the `SV01K/L` collaboration subject-link contract | `feat/service-v14-order-sv01ef-contract` (#320) | `c08dc8c633272690e45a6d0e8e62e0d1729b5b23` | All 14 repository checks green; Vercel green | Fail-closed Communications/Vault reference-link contract and tests; operational adapter remains an explicit dependency |
| [#322](https://github.com/ontripai/cladora-website/pull/322) | PM / Documentation | Define the `PM01-A` private oversight registry contract | `docs/cladora-v1.4-controlled-baseline` (#313) | `21750ffc81cdcf5cb62da3e0041ef20ffe2894a0` | Documentation validation green; Vercel Preview pending at initial observation | Versioned logical registry, visibility/authority, command/receipt, GitHub synchronization and acceptance contracts; no runtime installation |

GitHub lists `ontripai` as the author of every PR above. The execution-owner column records domain ownership, not GitHub account identity or approval authority.

## Stack invariants

- Preserve `#313 → #314 → #315 → #319`; AP02 remains based on AP01, AP01 remains based on valuation, and valuation remains based on the controlled documentation baseline.
- Preserve `#317 → #320 → #321` as the independent SERVICE stack.
- Preserve `#313 → #322` as the documentation/oversight stack; runtime implementation remains a later Core/Platform package requiring separate authorization.
- PRs #316, #317 and their descendants remain independent of unavailable CE/private references. PR #318 consumes the documentation baseline directly.
- Do not duplicate an existing branch or PR. Update the applicable existing Draft PR and re-read its live head before making a change.
- A green check, Vercel Preview or merged ancestor is evidence only. It does not authorize merge, Supabase migration, Production deployment, Secret changes or Production configuration changes.

## External and unavailable references

The external identifier `CE010`, any private credential or CE/PM binding, and commit `1f010c4` are `external/unavailable` in the verified Repository and Environment contract. No Secret, token, hostname, private file path or private package/bundle source is defined for them, and none is to be requested or invented.

PR #318 independently contains a repository-verifiable slice named `CE-010` (with a hyphen) at its recorded head. That source is governed by GitHub and can continue within its stated boundaries; it does not establish the availability of the separate external `CE010` reference or a private bundle. The absence of the external references is not a blocker for independent Core, AIRPROP, SERVICE or repository-owned CE work.

## Refresh rule

This matrix is a point-in-time coordination record. Before changing a workstream, query the live PR base, head, Draft state and check rollup again. Update this record when a base or delivery head changes materially; retain prior Git history rather than silently rewriting acceptance evidence.
