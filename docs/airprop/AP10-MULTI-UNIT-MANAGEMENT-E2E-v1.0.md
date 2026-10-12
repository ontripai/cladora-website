# AP10-E2E-01 — multi-unit owner integration

**Owner:** AIRPROP integration verification

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP09-UX-01 on `feat/airprop-ap09-management-wizard`

**Status:** Real Auth / built HTTP gateway consumer implemented; exact-head receipts determine PASS. Browser DOM automation remains separate.

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

## Historical blocker before the authorized #351 handoff

`AP10-AUTH-E2E-FIXTURE` — owner: CLADORA Control/Core test infrastructure. The repository and authorized environment expose no isolated synthetic AAL2 browser account/session plus multi-workspace, multi-unit test fixture. Creating or changing Auth, secrets or Production configuration is outside this workstream authority. Required unblocker: a non-production synthetic account/session and resettable authorized fixture usable by browser automation without exposing credentials.

Until that input exists, no authenticated browser E2E receipt or AP10 acceptance is claimed. The deterministic integration may proceed through review independently; receipt and green CI are not acceptance or closure.

## Authorized provider consumption — AP10-E2E-01 integration update

The consumer now pins Core fixture PR #351 at
`aa527c498467fc3cba0efddf3561424dc27bb726`, as explicitly authorized by the
AIRPROP handoff. `scripts/run-airprop-ap10-consumer.mjs` uses that unchanged fixture
and its trusted disposable-target verifier; credentials/session inputs stay in memory.

The existing AIRPROP consumer PR #352 contains the scenario and exact-head workflow.
A separate provider checkout uses its checked-in Local configuration unchanged. Only
eight unchanged AIRPROP AP01–AP08 migrations are added to this disposable rehearsal
stack; shared migration contents are verified identical. No Core commit is imported
into the AIRPROP branch and no Remote database is contacted.

The scenario builds the existing Next application, installs its real synthetic TOTP
AAL2 session via the actual SSR cookie format, and calls the production management
portfolio HTTP route. It seeds only synthetic historical mandate/owner data, retaining
AP06's independent requester/acceptor constraint through two provider-created Auth
principals. The same AAL2 cookies read two explicitly selected Workspaces and then
fail closed after the unchanged Core driver revokes current authority. Unknown
Workspace/wrong Context deny without private fixture identifiers. Three canonical
units are verified against their two named properties; no SERVICE or Finance fact is
created. Existing rendered EN/RO/FA component checks remain separate evidence.

This is real Auth → built HTTP route → canonical database gateway verification,
not browser DOM automation. The provider's own driver also verifies AAL1 read/manage
denial; it is not described as a separate real-AAL1 browser session.

Logical cleanup proves revoked authority and soft-deleted fixture users. AIRPROP's
immutable mandate history is not physically deleted or trigger-bypassed. Mandatory
`supabase stop --no-backup` destroys the disposable stack; a separate teardown receipt
requires zero remaining project containers. Failure to clean up fails the job.
Safe artifacts: `airprop-ap10-evidence.json`, `airprop-ap10-teardown.json`; each pins
provider and/or consumer SHA. CI and receipts remain evidence, not release acceptance.
AP-PF02 remains gated by #353 revision acceptance; Release remains **DB-HIST-01** blocked.

The CI-only transport adapter forwards the fixed synthetic HTTPS origin to the real disposable loopback Supabase API. Production URL validation stays intact. This changes transport routing only; Auth, TOTP, tokens, Core authorization, database reads and revocation execute against the unchanged provider stack. No hosted bindings or configuration are modified.
