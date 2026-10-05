# CLADORA UX-018 — protect unsaved work during context changes

Date: 2026-10-05. This is a shared customer-shell behavior for RO, EN and FA.

## Behavior

Customer forms with unsaved edits register a discard callback with `CustomerContextProvider`. Choosing another active context pauses the switch while any registered form is dirty. The shell explains that work is unsaved and offers two clear actions:

- **Keep editing** closes the warning and preserves the selected context and all registered form values.
- **Discard changes and switch** calls each registered form's local discard handler, then changes context. Persisted server data is not deleted or changed by the discard action.

Selecting the active context does not prompt. With no dirty registrations, context changes remain immediate. This guard is client-side loss prevention only; API and database authorization continue to resolve the active context independently.

## Registered forms

- AIRPROP due diligence registers while its review editor differs from the stored revision. Discard clears the dirty marker; changing the active context remounts the editor on the newly selected context.
- Controlled building setup registers unsaved initial form edits and unit changes within a saved draft. Discard restores the form defaults or the saved unit list, and a context change reloads the selected context's existing setup draft.

New editable workflows must register and supply a callback that restores the editor's last saved state. Do not infer dirty state from unspecific focus or loading state.

## Verification

The mounted provider test verifies immediate clean switches, a paused dirty switch, cancel with values retained, and confirm with the registered discard callback applied. The AIRPROP rendered UI test verifies registration while dirty. TypeScript, ESLint, and the building setup contract checks cover the touched code. Live Production verification uses the existing pilot review without saving or submitting any test content.
