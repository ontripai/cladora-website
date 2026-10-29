# Release demo and application boundary audit

This review is limited to the release candidate. Main, production deployment,
Vercel variables, database, roles and customer data were not changed.

## Findings and corrections

1. The root marketing/app wrapper mounted DemoProvider on every route. It now
   mounts the demo store only on the exact locale `/demo` subtree. Actual customer
   and control-plane routes retain their existing authentication/context providers.
2. The demo catch-all imported actual app pages directly, outside their app layout.
   It now renders the two isolated demo components and an explicit unavailable/login
   notice for modules without isolated demo implementations. Existing real app pages
   and API guards are unchanged. This source issue did not establish a working Auth
   bypass: real APIs still independently authorize requests.
3. The actual building setup form initialized and reset to synthetic names, dates,
   Unit code and area. It now starts empty and validates explicit input. Restored
   saved requests, current readback, command keys and server authority are unchanged.
4. Server and password-recovery signing helpers accepted a development-fallback flag
   without independently excluding deployed environments. The fixture fallback is
   now limited to local test/development and rejects production or Vercel contexts.
   No evidence was obtained that the fallback flag was enabled in the deployed app.
5. Required CAPTCHA without a server key could bypass in preview/local mode.
   Explicit TURNSTILE_REQUIRED is now fail-closed in every environment. Existing
   unrequired local-development behavior and configured provider calls are preserved.
6. Marketing examples using mock portfolio data are explicitly labelled synthetic;
   the interactive demo badge no longer calls the example a live product experience.

## Deliberately retained examples

The demo dashboard/accounting store, clearly labelled marketing calculation examples
and source fixtures remain. Dashboard Lab has a source-level AAL2/super-admin gate
and an isolated transport. The internal mock scanner is preview-only, requires its
secret/flag and operates on synthetic in-memory objects. None of these mechanisms
is proof of installed app authority, valuation readiness or real scan/persistence.

## Vercel configuration observation

At review time, project environment metadata showed Supabase public URL/key,
APP_ORIGIN and the server secret targeted to production only. No corresponding
preview-target or release-branch override was listed. Values were not decrypted or
copied. A successful preview build therefore does not establish a configured
authenticated app: app/layout redirects missing public configuration to login.
Preview-to-staging configuration and real Auth/backend validation remain separate.

## Verification

- 69 offline boundary checks passed, including local-only signing fallback,
  production/preview negative controls, explicit CAPTCHA requirement, demo-provider
  scope and demo route isolation in EN/RO/FA.
- Mounted actual setup form: blank/default submission makes zero transport calls;
  explicit valid input reaches only the fake transport, and a synthetic lost response
  retains its original request. Remount restores its exact saved input without an automatic resend. Discard restores empty fields without a server write.
- Existing password-recovery security contract and all 14 public-API suites passed.
- Typecheck and targeted lint passed with existing local dependencies.
- Native browser, real Auth, PostgreSQL, Storage and actual provider proof were not run.

The dedicated release-safety CI job does not replace, skip or neutralize other CI
failures. Main merge and production promotion remain gated on their actual results.

## Environment identity confirmation

Management metadata independently confirms CLADORA/jyomlehahwlyqzoacrvp and cladora-staging/ryygcqiunqqtfkpkflzf as separate ACTIVE_HEALTHY projects. The production public URL resolves to the former. No database query, migration or Auth administration was performed.

## Existing CI harness reconciliation

The maintenance identifier harness now resolves the actual canonical command modules and explicitly verifies that legacy mutation routes return 428 without RPCs. Current canonical mutations remain covered by the release Operations/Checklist harnesses. The underwriting harness resolves the real opportunity recovery helper and isolates the unrelated valuation child; its original underwriting assertions pass. These repairs do not reopen legacy endpoints or change runtime business logic. The native AIRPROP UI and public claims tests also passed.
