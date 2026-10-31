# Contact intake retention

Task: `CORE-CONTACT-INTAKE-RETENTION-01`.
Exact BASE: `d4c6fb13b748549f1b297b302f8ec74b6bac3dcb` (`release/cladora-v14`, PR475).
Assignment: [coordinator](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6534195967).

The contact handler inserted `enrichedMetadata`, then replaced the JSONB metadata
with `initialMetadata` when recording notification status. The latter omitted
`structuredIntake`. The fix moves the existing enriched object into shared scope
and uses it for both writes, overriding only `notification` on the second write.
Validation, field mappings, message, reference allocation, dedupe and guards are unchanged.

## Executed evidence

Before editing the route, the new harness ran the actual BASE handler:

- `node scripts/test-contact-intake-retention.mjs --expect-metadata-loss`: observed
  insert containing the complete intake, update removing it, response200.
- Normal retention regression on BASE: exit1 because final intake was undefined.
- After the fix, `node scripts/test-contact-intake-retention.mjs`: **31 checks PASS**,
  plus the separate fingerprint counterexample below. The baseline-only switch
  intentionally fails on the fixed route; use an isolated BASE snapshot to reproduce it.

The harness transpiles the actual route and loads actual origin/body/schema,
Turnstile/configuration, HMAC/IP, reference and rate-limit helper source. It uses
NextRequest/NextResponse, controlled Turnstile fetch, an in-memory database client
and a notifier stub. Metadata update replaces the stored JSON value rather than
merging it, so the adapter reproduces the loss. No shared notifier/admin client is
imported; all unexpected source/package/transport targets are rejected.
It runs in a child with only synthetic configuration, never inherited service keys.

Coverage includes CE alone and with all five prior service IDs, all eight intake
fields, trimming/optional defaults, sent/skipped_no_config/failed notification,
metadata update error/exception, insert error/exception, reference collision retry
and exhaustion, duplicate mutation/notification suppression, privacy, strict schema,
unit count, origin/referer, content type/declared and streamed body limits, JSON,
Turnstile, rate denial/RPC failure, short HMAC configuration and honeypot.

TypeScript `tsc --noEmit --incremental false`, affected-file ESLint and diff check
also passed. No dependency was installed or changed. The available toolchain was
Node24.19.0, TypeScript5.9.3, Next16.3.8, Zod4.4.3, ESLint9.39.5 and
eslint-config-next16.3.3. BASE declares Next16.4.1/Zod4.6.6; verification with those
exact dependency versions remains an integration gate. No production build is claimed.

This is **actual-handler / controlled-memory evidence**, not hosted persistence,
an HTTP server, browser, database, notification delivery, CI or Preview evidence.
No customer data, real tokens, live notification, SQL or environment configuration was used.

## Separate finding: CONTACT-FP-01 (OPEN; unchanged)

`src/lib/security/fingerprint.ts` uses the first60 normalized message characters.
The real `src/components/contact/ContactForm.tsx` message template places role and
asset information before services. The harness evaluates that existing template
with the same synthetic applicant/bucket but services `community_experience` versus
`operations`. Messages differ, their first60 characters match, their real HMAC
fingerprints match, and the actual handler returns200 then409 while retaining just
the first lead and sending just one controlled notification.

The database's declared uniqueness is `(submission_fingerprint, fingerprint_bucket)`
(`supabase/migrations/20260905144500_marketing_leads_management.sql`). Thus different
service selections can be treated as a duplicate; retaining metadata does not close
that finding. The shared contact/pilot fingerprint algorithm, frontend and dedupe
policy are untouched. Coordinator should assign a separate policy/implementation
decision before changing which validated fields define duplicate intent; pilot
compatibility and existing HMAC/window/unique-index semantics need explicit review.

Integration/acceptance belongs to the coordinator. No release/main push, merge,
deployment, real database/notification or native Operations acceptance is included.
