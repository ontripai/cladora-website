# Contact canonical fingerprint v2

Task `CORE-CONTACT-FINGERPRINT-02`; finding `CONTACT-FP-01`.
BASE/Parent: `1f201596e2776883fb25eabd834f5bb5f3f467de`.
[Coordinator decision](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6540563339).
The accepted structuredIntake retention implementation is unchanged.

## Canonical contract

Only the successfully validated contact schema enters
`computeContactSubmissionFingerprint`. Request body is capped at32KiB; message
at5000characters, name/email at255, phone at50 and optional intake strings/service
IDs at their existing schema limits. The helper accepts an explicit typed field
set, not raw JSON. It does not parse a frontend message template.

HMAC-SHA256 covers a fixed JSON tuple in this exact order:

| Index | Field | Normalization |
|---:|---|---|
|0|version|literal `cladora.contact.intent.v2`|
|1|fullName|trim; preserve case/content|
|2|email|trim + lowercase, as before|
|3|phone|remove whitespace, hyphen, parentheses and dot, as before; missing/null→empty string|
|4|message|complete trimmed validated string; preserve case, internal whitespace, Unicode and every tail character|
|5|locale|required ro/en/fa; communication language is part of the request|
|6|role|trim; absent/null/empty→null|
|7|propertyType|same optional normalization|
|8|portfolioScope|same optional normalization|
|9|stage|same optional normalization|
|10|services|trim IDs, remove empty IDs and duplicates, sort by JS code-unit order; absent/null/empty array→[]|
|11|workspaceStatus|same optional normalization|
|12|city|same optional normalization|
|13|unitsCount|same optional normalization; keep the validated string|
|14|bucket|floor(Date.now()/900000), unchanged fixed UTC900-second bucket|

The explicit tuple removes object-key-order and field-delimiter ambiguity. Service
IDs remain case-sensitive unrestricted strings under the existing schema; no enum,
migration or new ID allowlist was added. CE and all previous IDs are accepted.
Stored structuredIntake retains the submitted validated services/order; only the
fingerprint uses selection-set semantics. If reordering services also changes the
submitted message, that changed message is a new intent; no template parsing tries
to erase this real difference. There is no Unicode NFC/case-fold transformation of
the message. The old contact message lowercase/truncated-prefix equivalence is
intentionally replaced; email/phone normalization stays compatible.

SourcePage/UTM attribution, user-agent/IP, honeypot, challenge token and consent
timestamp are not business intent. Privacy consent must still validate true before
any fingerprint. Tracking/token refresh must not bypass duplicate protection.
The helper projects only named fields and returns only fingerprint/bucket. The
existing secret getter, HMAC secrecy, five-request rate rule and unique index
remain unchanged. No raw canonical text or secret is added to logs or output.
New metadata includes `fingerprintVersion`, preserved through notification updates.

## Transition — explicitly not backward dedupe compatible

Legacy contact fingerprint used the shared unversioned first60-character algorithm.
v2 has a domain/version tag, more fields and full message. The same request in the
same bucket produces a different hash across these algorithms. A controlled seeded
legacy-row case proves a new v2 request can insert beside it; its next identical
v2 retry returns409. Historical rows are not rewritten, guessed or canceled.
Absence of a version marker alone is not proof of the writer of an arbitrary row.

Mixed v1/v2 writers in one bucket can therefore create duplicate leads and duplicate
notifications for a retry across the cutover. This implementation does not claim
backward compatibility or add a legacy-hash fallback: such fallback would still
reject different CE/Operations inquiries sharing the weak old prefix. It performs
no extra database query, backfill, dual write or index/schema change.

Release recommendation for the coordinator: drain old contact writers/in-flight
submissions, coordinate a single-version cutover at a900-second UTC boundary, then
resume traffic only with v2 writers. Otherwise explicitly account for the bounded
mixed-version duplicate risk. A boundary alone without draining old writers is
insufficient. This source task does not implement a pause/configuration/deployment
or authorize one. Retries across bucket boundaries have never been guaranteed to
dedupe by the existing fixed-bucket contract.

## Evidence on exact locked tools

An isolated `npm ci --ignore-scripts --no-audit --no-fund` used only this BASE's
package/lock/vendor with a task-specific cache. Package/lock/vendor are unchanged.
Actual versions: Next16.4.1, Zod4.6.6, TypeScript5.9.3, Node24.19.0, ESLint9.39.5.
Installed Next route-handler docs and repository AGENTS were read before editing.

Before changing the route, `--fingerprint-counterexample` on the actual BASE
handler reproduced200→409 for both different services with identical message and
different messages after character60. One lead/notification was retained in each
controlled fixture. This switch is historical baseline evidence, not a mandatory
assertion that the new implementation must keep the bug.

- `node scripts/test-contact-intake-retention.mjs`: **50 PASS**, including all31
  accepted retention/guard cases, two independent collision fixes, identical retry,
  field/services order, all business fields, optional normalization, real body
  validation and the observed legacy/v2 transition. The old frontend-template
  parsing/known-bug assertion was replaced with corrected behavior assertions.
- `node scripts/test-contact-fingerprint.mjs`: **29 PASS**, including four fixed
  pilot vectors recorded from BASE, whole shared-fingerprint source byte identity,
  unchanged pilot truncation/case behavior, independent Python-derived contact tuple
  golden, full-tail/case/Unicode coverage, ordering/optionals,900-second boundaries,
  no raw JSON serialization and production secret fail-closed behavior.
- Typecheck, affected-file lint, syntax and diff checks are part of delivery evidence.

Persistence, notifier and Turnstile transport are controlled; actual contact handler
and security helpers execute locally. These results do not prove hosted unique
index atomicity, PostgreSQL concurrency, browser/HTTP-server behavior, real mail,
Preview or Production. No such test, notification or database action was executed.
Pilot helper/route, frontend, callback, notifier, SQL/index/ACL, dependency sources,
CI, Environment configuration and native Operations are untouched. The prior
retention document records predecessor evidence; this contract supersedes its
historical OPEN fingerprint finding for this delivered source, pending review.
