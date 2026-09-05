# ADR-CLD-026 — Supabase Auth Invitation Delivery and Activation

- **Status:** Accepted; SMTP-dependent operational validation deferred
- **Task:** CLADORA-ENG-010B-AUTH
- **Depends on:** ADR-CLD-024, ADR-CLD-025
- **Date:** 2026-08-27

## Decision

Initial customer administrators are created only through a platform-authorized invitation flow. The application does not expose public sign-up.

A platform Super Admin or assigned Operations user calls a protected workspace invitation endpoint. The endpoint creates the hashed database invitation through the authenticated database RPC and then asks Supabase Auth Admin to send the invite. The Supabase secret key is server-only, uses the `sb_secret_` format, is never prefixed with `NEXT_PUBLIC_`, and is never returned or logged.

If Auth delivery fails, the database invitation is revoked through the audited revoke RPC. The API never returns the raw invitation token.

## Callback and token handling

The localized Auth callback supports PKCE code exchange and token-hash verification. Redirect targets are restricted to the same locale and application path.

The opaque workspace token is removed from the browser URL immediately after the Auth callback and placed in a Secure, HttpOnly, SameSite=Lax cookie. It is not available to client JavaScript. The activation page and POST endpoint read it server-side.

## Activation

The activation POST:

1. requires an exact trusted `Origin`;
2. validates the submitted display name, locale, timezone, and password;
3. validates signed Supabase claims;
4. updates the authenticated user's password;
5. invokes the atomic database acceptance RPC;
6. clears the invitation cookie only after successful acceptance.

Authorization remains entirely in database roles, memberships, context grants, assignments, and RLS. Auth `user_metadata` is not used for authorization.

## Operational prerequisites

Production dispatch remains fail-closed until both environment values are configured securely:

- `SUPABASE_SECRET_KEY`
- `APP_ORIGIN=https://cladora.ro` (historical staging deployment: `https://cladora-website.vercel.app`)

The Supabase Auth redirect allowlist must include each localized callback route. Production email delivery requires verified custom SMTP and reviewed localized invitation templates. No real invitation may be sent as part of implementation or CI.

## Deferred

Workspace onboarding completion and unlocking the Production lifecycle transition remain in CLADORA-ENG-010C.
