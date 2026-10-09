# AP10-E2E-01 — multi-unit owner integration

**Owner:** AIRPROP integration verification

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP09-UX-01 on `feat/airprop-ap09-management-wizard`

**Status:** Deterministic rendered integration passed; authenticated browser E2E blocked

## Deterministic scenario

The integration fixture contains one owner mandate with two different unit references and a second named property. The rendered user flow verifies:

1. explicit Workspace selection without inferring the first target;
2. named-property selection without rendering any Workspace, property, unit, mandate, Work Order or action-link UUID;
3. management owner, bounded commercial scope and duration;
4. Operations link-time status snapshots and the explicit Finance boundary;
5. removal of all managed-property UI after the report returns no currently authorized property;
6. context remount with no selected property or label leaking from the previous context;
7. EN, RO and FA rendering, including RTL for FA.

This is a real rendered React integration test over the production component and strict response contract. It is not represented as a full browser/network/authentication E2E.

## Named blocker

`AP10-AUTH-E2E-FIXTURE` — owner: CLADORA Control/Core test infrastructure. The repository and authorized environment expose no isolated synthetic AAL2 browser account/session plus multi-workspace, multi-unit test fixture. Creating or changing Auth, secrets or Production configuration is outside this workstream authority. Required unblocker: a non-production synthetic account/session and resettable authorized fixture usable by browser automation without exposing credentials.

Until that input exists, no authenticated browser E2E receipt or AP10 acceptance is claimed. The deterministic integration may proceed through review independently; receipt and green CI are not acceptance or closure.
