# CE012-UX-02 — Guide editor feedback and recovery

Owner: CLADORA Community & Experience. Current base: `main@09c4475618620d22732ab4d8ed514b98b91e05a5`. Branch: `feat/ce-012-form-recovery`.
Status: component UX locally validated and prepared for `in_review`. Public Guide editing remains blocked and disabled.

## Retained starting point and actual boundary

PR #349 already merged the safe, read-only Guide page. `CustomerExperienceGuidePage` passes `commands=null`, and `toExperienceGuideView` forces `can_edit=false` pending the Documents-owned secure named target selector. This package does not activate editing, introduce a mutation adapter or repeat that page delivery. Existing Documents/Core reference gates stay in force.

The independent `CustomerExperienceGuide` component already has a proposed editor, used with synthetic commands in isolated tests. A delayed in-memory JSDOM baseline probe against that unchanged editor reproduced two commands from two synchronous submits, zero pending/success status regions and no locked fieldset. Changing only the same Guide's version from 1 to 2 replaced an edited title with the original server title, because the editor key includes the version. This is a reproduced component UX gap, not a defect observed in an enabled customer editor or live persistence.

CE011-UX-02 merged through PR #358, completing the CE010/CE011 stack before this Branch was rebased onto the resulting `main`. No CE010 or CE011 change is included in this package.

## Bounded next implementation

- Add a named editor, localized RO/EN/FA pending/success feedback outside busy fields and a synchronous per-Guide UI guard.
- Preserve title, step title, instructions and optional named target after failure; block duplicate submissions without adding confirmations.
- Separate Workspace/Guide reset from same-Guide version refresh. Preserve dirty edits after a conflict; synchronize confirmed successful save with returned server state without stale-field loss.
- Suppress late feedback/refresh callbacks when the originating Workspace/Guide editor has been discarded.
- Retain named targets, null/no-reference semantics and safe reference rendering. Do not infer target authority or enable editing from read access.

## Evidence to produce

Delayed-command mounted tests in all three languages should cover duplicate submit, locked pending fields, failure/retry, dirty edits across same-Guide version change, success reconciliation, optional target payloads, permission-hidden editor and Workspace/Guide reset including late completion. Retain the existing Guide domain/UI/route/page checks, then lint, typecheck, Draft PR CI and exact-head Preview.

## Implemented component boundary

`CustomerExperienceGuide` now keys its synthetic editor by Workspace and Guide identity instead of server version. Dirty title, step title, instructions and named target therefore survive a same-Guide version refresh. A successful save refresh adopts authoritative server fields that have not been edited again, while retaining any newer local edit. A synchronous UI guard prevents duplicate commands, and localized live regions announce pending and confirmed success outside the disabled fieldset. Failed commands retain every input for explicit retry. Completion from an editor discarded by a Workspace or Guide change cannot publish feedback or request another refresh.

The optional target remains a choice from the supplied named list and is sent as `null` when empty. The component does not derive target identity or edit authority from read projections. Existing safe reference labels and bounded links remain presentation-only.

## Local validation

- Mounted CE012-UX-02 regression passed for RO/EN/FA: named form, synchronous duplicate prevention, pending/success live feedback, failure preservation and retry, dirty same-Guide version refresh, successful-save reconciliation without losing a newer edit, Workspace/Guide reset, discarded late completion, permission-hidden editor and named/null targets.
- Existing CE-012 domain, route, mounted read-only page and combined CE-010/CE-012 UI regressions passed.
- ESLint, TypeScript `noEmit`, production build, `git diff --check`, conflict-marker scan and public-safety scan passed. The production build generated 522 static pages.
- The public page still passes `commands={null}`; the package adds no mutation adapter, target resolver, API, SQL, migration or capability activation.

## Existing formal dependency retained: DOCS-CE012-REF-01

Owner: Documents/Core secure target selector and reference resolver. Consumer: future CE012-UI-01B editing/reference connection. Required input is the authenticated actor and current Context/Workspace plus a named document selection; required output is a bounded authorized target identity and display label, with explicit stale/denied/not-found behavior and version/revalidation semantics. No client-supplied tenant or new identity/document registry is permitted. Authority must be rechecked at command execution. The accepted owner contract is required before connecting a public editor; CE012-UX-02 synthetic component preparation does not satisfy that gate.

No Core, API, SQL, remote migration, capability activation, Auth, Secret/environment, Merge or Production change is authorized by this slice. No migration inventory is needed for this UI-only preparation.
