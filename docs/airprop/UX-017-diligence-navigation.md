# AIRPROP UX-017 — diligence navigation and evidence guidance

Continuation of UX-DEC-001, UX-015 and UX-016, 2026-10-05.

The due diligence editor now asks before discarding unsaved edits when refreshing the review, changing its selected draft or changing the document access context. Keeping the edits preserves the current selection and form. Discarding them performs the requested transition. The editor also explains when a document context has not been selected.

If no eligible evidence is available in the chosen context, the editor points to the existing Documents module for property document upload. Uploaded documents only become eligible here after scanning, independent verification and authorization in the selected context. The link is hidden during unsaved edits. This change does not create evidence, change the review's eligibility rules or widen the pilot workspace rollout.

Verification: mounted UI flow checks cancellation and retention, document route and unsaved link suppression, plus existing submission, recovery, authorization and localization scenarios; TypeScript and ESLint pass. The live production check confirmed the warning, retained the test edit on cancellation, and discarded the local test edit without saving it. Shared navigation context protection is tracked in [UX-018](../architecture/CLADORA-UX-018-unsaved-context-guard.md).
