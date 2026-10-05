# AIRPROP UX-015 — directive adoption and first corrections

Baseline: main `23014127c4d3f4ca5b8eaeaa60c58637eb6d0b40`, 2026-10-05.

[UX-DEC-001 source](UX-DEC-001-source-v1.0.md) supplements lifecycle v1.1 and remains part of every successor AIRPROP handoff. This document records source inspection; it does not certify all existing screens or claim a completed production user journey. Shared changes belong to the core workstream; no automatic notification to other chats is claimed.

| Rule | Page / role / context | Observed behavior and impact | Owner / change | Evidence / status |
| --- | --- | --- | --- | --- |
| UX-03 | Opportunity list, authorized AIRPROP member, pilot workspace | Evaluate and Refresh had no visible button boundary | AIRPROP: bordered padded buttons and explicit keyboard focus outline | Source updated; rendered suite passes; live mobile/keyboard check pending |
| UX-07 | Create opportunity, same scope | General validation message left the user to identify the invalid field | AIRPROP: contract-derived field errors, localized correction, aria-invalid/describedby, focus first invalid field, preserve values | Rendered test rejects invalid submission without network request and verifies error associations and focus; live check pending |
| UX-14 / SEC-02 | Opportunity creation authentication response | Technical multifactor wording | AIRPROP: plain identity verification message in EN/RO/FA | Only wording changed; server enforcement untouched; return-to-action flow depends on core |
| UX-01 / UX-02 | Workspace selector | Raw workspace UUID and environment label; target contract lacks a display name | Core: provide authorized workspace display names; AIRPROP consumes them after contract agreement | Dependent on core; do not infer a name or widen queries |
| UX-02 / UX-06 | Workspace/context or opportunity switching | Keyed remount can discard unsent input; uncertain submitted commands are recovered separately | Core context guard plus AIRPROP unsaved draft policy | Needs correction; retain strict authority isolation and avoid unapproved sensitive browser persistence |
| UX-07 / UX-08 / UX-12 | Evaluation and diligence | Evaluation uses general validation; timestamps rendered raw; report metadata needs review | AIRPROP | Needs correction; not covered by this first patch |
| SEC-03 / SEC-04 | Evidence selection / shared documents | Existing scanner, document permissions and independent verification gates are reused | Shared documents/core; AIRPROP integration | No change to gates; genuine property evidence still needed for final acceptance |
| QA-01 through QA-06 | Complete AIRPROP journey | This patch has component evidence only | AIRPROP and core for dependencies | Mobile, keyboard, offline/session expiry and authenticated production journey remain open |

## Verification and handoff

Run `node scripts/test-airprop-native-ui-004.mjs`, focused ESLint and TypeScript checking. Existing exact retry, pending recovery, explicit workspace selection and RO/FA scenarios remain in the rendered suite. No migration, grant, document upload, financial decision or security gate change is included.

Next: coordinate authorized workspace names and shared unsaved-context guard with core; extend field validation and readable dates to evaluation; verify real-role flow in the pilot with the same documents module. Before any login handoff explicitly name the account (Mahmoud for the established pilot). Include this directive, open matrix and exact environment/commit evidence in the next numbered workstream.
