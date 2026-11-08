# SERVICE assembly self-profile presentation

Owner source: `c795aeb65d536bab7535b988d7ae6ca0dbfc7d2b`, direct child of
`97e35e533ec06a7ae984ca9c696bd3edadb1a45c`.

`CustomerAppShell` requests `GET /api/customer/v1/profile` for a display label.
In the exact private server profile `core-service-real-app-assembly.v1`, this GET
uses the current user returned by the server's `auth.getUser()`. It does not call
the unavailable REST `customer_api.my_profile_v1` endpoint. A public browser
marker alone never selects this behavior. Missing users or Auth errors remain
401, and thrown dependency failures never become a successful profile.

The no-store/private response contains only `email`, `display_name`, `locale`,
and `timezone`, with `Vary: Cookie`. Email comes from the verified Auth user.
Display name is the first nonblank string in that user's `display_name` or
`full_name` metadata, falling back to their actual email or an empty string if
absent. Locale and timezone are trimmed strings from the same metadata when
present, otherwise null. They are **not always null**, despite the initial
handoff example. These are self-editable presentation preferences, not verified
roles, a persisted customer profile, canonical tenant identity or authorization.
No other metadata, credentials or session values are returned.

The ordinary GET and the entire existing PUT retain their original behavior.
This change does not implement profile editing against the owned stack or
authorize a SERVICE operation. Current session/AAL2, canonical Context/Workspace
and business scope checks still run through their existing Core paths.

## Verification and limits

Run `node scripts/test-app-service-profile-compat-01.mjs` and
`node scripts/test-app-service-profile-boundaries-01.mjs`. These execute the
actual route with controlled Auth/RPC dependencies. The latter also loads the
actual same-origin/body security helpers and checks ordinary GET/PUT, bad
markers, error propagation, metadata types, privacy and caller-actor isolation.
The second script accepts an optional source root for before/after comparisons.

On the previous source, a controlled PGRST106 from the unexposed legacy schema
becomes HTTP500 `PROFILE_UNAVAILABLE`. That reproduces a source incompatibility;
it does not prove the private native500 cause or reproduce `BODY_DEADLINE`.
The original owner counterexample separately models a missing function42883.

These checks are not native browser/Auth/DB acceptance. Platform must adopt the
exact reviewed successor using a new private consumer admission while preserving
the original B696 transport root/binding, relay, installed Core EE and historical
receipts. A successful profile read does not establish current AAL2, SERVICE
permission, a Request, persistence, UNKNOWN settlement or restart acceptance.
