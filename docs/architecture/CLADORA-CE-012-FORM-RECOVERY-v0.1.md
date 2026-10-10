# CE012-UX-02 — Guide editor feedback and recovery: started

Owner: CLADORA Community & Experience. Independent base: `main@c0c82133d4a6ef95800c72b9f155fb9a65ae1822`. Branch: `feat/ce-012-form-recovery`.
Status: in_progress; baseline reproduction and bounded acceptance contract. No implementation completion or passing acceptance test is claimed.

## Retained starting point and actual boundary

PR #349 already merged the safe, read-only Guide page. `CustomerExperienceGuidePage` passes `commands=null`, and `toExperienceGuideView` forces `can_edit=false` pending the Documents-owned secure named target selector. This package does not activate editing, introduce a mutation adapter or repeat that page delivery. Existing Documents/Core reference gates stay in force.

The independent `CustomerExperienceGuide` component already has a proposed editor, used with synthetic commands in isolated tests. A delayed in-memory JSDOM baseline probe against that unchanged editor reproduced two commands from two synchronous submits, zero pending/success status regions and no locked fieldset. Changing only the same Guide's version from 1 to 2 replaced an edited title with the original server title, because the editor key includes the version. This is a reproduced component UX gap, not a defect observed in an enabled customer editor or live persistence.

CE011-UX-02 is separately in_review in Draft #358. It is not a prerequisite for this Guide preparation.

## Bounded next implementation

- Add a named editor, localized RO/EN/FA pending/success feedback outside busy fields and a synchronous per-Guide UI guard.
- Preserve title, step title, instructions and optional named target after failure; block duplicate submissions without adding confirmations.
- Separate Workspace/Guide reset from same-Guide version refresh. Preserve dirty edits after a conflict; synchronize confirmed successful save with returned server state without stale-field loss.
- Suppress late feedback/refresh callbacks when the originating Workspace/Guide editor has been discarded.
- Retain named targets, null/no-reference semantics and safe reference rendering. Do not infer target authority or enable editing from read access.

## Evidence to produce

Delayed-command mounted tests in all three languages should cover duplicate submit, locked pending fields, failure/retry, dirty edits across same-Guide version change, success reconciliation, optional target payloads, permission-hidden editor and Workspace/Guide reset including late completion. Retain the existing Guide domain/UI/route/page checks, then lint, typecheck, Draft PR CI and exact-head Preview.

## Existing formal dependency retained: DOCS-CE012-REF-01

Owner: Documents/Core secure target selector and reference resolver. Consumer: future CE012-UI-01B editing/reference connection. Required input is the authenticated actor and current Context/Workspace plus a named document selection; required output is a bounded authorized target identity and display label, with explicit stale/denied/not-found behavior and version/revalidation semantics. No client-supplied tenant or new identity/document registry is permitted. Authority must be rechecked at command execution. The accepted owner contract is required before connecting a public editor; CE012-UX-02 synthetic component preparation does not satisfy that gate.

No Core, API, SQL, remote migration, capability activation, Auth, Secret/environment, Merge or Production change is authorized by this slice. No migration inventory is needed for this UI-only preparation.
