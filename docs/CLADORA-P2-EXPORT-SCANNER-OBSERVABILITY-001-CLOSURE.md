# CLADORA-P2-EXPORT-SCANNER-OBSERVABILITY-001

## Scope

Provider-neutral, AAL2-protected queue health for Migration 96 with redacted audit evidence. This package adds local Migration 98 and Test 085 only; remote apply and merge are excluded.

## Security boundaries

- Tenant and property scope reuse the canonical export actor.
- Direct queue access remains denied to authenticated and anonymous roles.
- Object paths, filenames, content hashes, lease tokens and secrets are excluded from API, UI and audit evidence.
- The UI is read-only and localized in Romanian, English and Persian (RTL inherited from the application shell).
- No provider, credential, Production Cron, service-role web client or customer data is introduced.

## Release gates

- Static database package: PASS (`98 migrations / 85 tests / 2736 assertions`).
- Scanner Mock suite, I18N and application foundation: PASS.
- Typecheck, lint and production build: PASS.
- Test 085 is transaction-wrapped with 26 assertions. Local execution is unavailable in the agent environment because Docker/Podman is absent; CI execution is required before release.
- Migration 98 must not be applied without separate approval.
- Draft PR must not be marked Ready or merged without separate approval.
