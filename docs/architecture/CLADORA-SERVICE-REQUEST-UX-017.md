# SERVICE request UX 017

Applies UX-07 and QA-03 of UX-DEC-001 to the existing service-request form. The original directive is preserved at `references/CLADORA-UX-Background-Controls-Directive-v1.0.docx`; lifecycle boundaries remain those of `CLADORA-SERVICE-LIFECYCLE-ALIGNMENT-v1.1.md`.

Observed issue: submission of incomplete fields produced only a general status message. Users could not identify the invalid field or navigate directly to it.

Correction: localized field-specific messages for service, beneficiary and description; aria-invalid and aria-describedby associations; focus on the first invalid field; clearing a field's validation feedback when it is edited. Values are retained after validation failure. Persian panel direction is explicit. Pending commands retain the existing frozen payload and same-key retry behavior; the conflict guard now also protects the submit handler.

Validation: 13 mounted UI scenarios, including RO/EN/FA error association and focus, retained description/service after missing beneficiary, whitespace-only description, denied reads, duplicate submission, unknown-result retry and obsolete replies. Focused ESLint and TypeScript are delivery checks. No database, API authority, grant, migration or shared navigation change.

Remaining gaps: catalogue conflict recovery still reloads the page and needs an explicit preserved-input flow; network/session read errors need distinct recovery; full keyboard/mobile browser acceptance and cross-workspace unsaved-form handling are not claimed complete. Shared context-change protection belongs to Core. Do not extend expired pilot grants implicitly.

Previous package 016: PR #264 merged as `41862d3702e21015b5bf0e6734f4e00d2253ab77`; Production deployment `dpl_JE7SQY4EkAyFwNotXt2gmCokaAuo` READY; completed branch deleted. No live quote publication grant was added.
