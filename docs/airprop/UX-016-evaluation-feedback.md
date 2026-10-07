# AIRPROP UX-016 — evaluation feedback

Continuation of UX-DEC-001 and UX-015, 2026-10-05. Baseline main: `5aa7ad73cc7b230b1883a4fcad03b5a5fc7c4eda`.

Evaluation forms now identify invalid acquisition cost, rent and operating expenses next to the relevant field. Contract validation drives the errors; a cross-field expense/rent failure focuses operating expenses. Input values remain available for correction. EN, RO and FA copy is included, with accessible error associations and first-error focus.

History uses localized Gregorian dates with explicit UTC, preserving the original timestamp in a time element. This is an explicit timezone display, not a claim that per-user timezone preferences are implemented. Exact decimal money and yield handling is unchanged. Refresh history has a visible button border and keyboard focus outline. Identity verification copy uses plain language.

Evidence: mounted underwriting suite passes field errors/focus, excessive expenses, no POST on invalid input, preserved values, timestamp formatting, exact recovery/retry, MFA/access refusal, conflicts, stale response isolation, duplicate submit prevention, corrupt storage and EN/RO/FA. TypeScript and focused ESLint pass. Production mobile and live evaluation acceptance remain pending.

Previous live opportunity-form acceptance: Mahmoud, Association Administrator, CLADORA Pilot Association 001, production `/fa/app/airprop`, 2026-10-05. Empty fields produced three localized errors and first-field focus; zero price retained name/city and focused price. No opportunity was created. Existing evaluation and diligence sections loaded. This observation is limited to the desktop Persian flow.

Shared workspace names, unsaved context-switch protection, remaining diligence UX and real property evidence remain open under UX-015. This change includes no migration, role grant, security gate modification or financial approval.
