# CE-GUIDE-NATIVE-01 — retained UNKNOWN feedback R3

This is a direct UI-only successor of `62ce7bcc5c52acb043b9e35e25803a3c99c71485` on `codex/ce-guide-native-01`. R2 remains the route/Core adoption basis. No Platform adapter bytes have been delivered, and its reported commit identifier is not treated as a blob identifier. No further lookup of that identifier was made for this correction.

## Reproduced issue and correction

After a lost reply, actual existing command holders retain UNKNOWN and the original command. When the create, editor or lifecycle controls remount (for example after Context return), local error text starts empty. The fields/retry remain locked correctly, but the explanation disappears. All three mounted before-tests failed at the missing Persian alert; the subsequent languages were not executed in those failed before-runs.

Render the existing translated UNKNOWN explanation from the retained uncertainty state whenever not sending. The editor's `aria-describedby` references the rendered feedback. No new text contract, command, wire, key, storage, receipt resolver or retry mechanism is introduced. Existing submit/owner/cancellation/permission logic is unchanged. The existing in-memory holder must still be available: this is NOT durable journal or reload/restart proof.

## New checks actually run

Only the three added cases of `scripts/test-ce-guide-routes-r2.mjs` were run, independently via `--case`:

- retained create UNKNOWN explains recovery after remount in FA/EN/RO without auto POST
- retained save UNKNOWN explains recovery after remount in FA/EN/RO without auto POST
- retained publish UNKNOWN explains recovery after remount in FA/EN/RO without auto POST

Each drives the actual Next handlers and existing Core host through controlled SDK/physical transport, drops a modeled successful execution reply, then mounts the actual consumer in all three locales. The alert is present/localized; create/save input stays retained and locked; mounting/changing language causes zero POST or success callback. Explicit retry adds one POST with byte-identical original wire, no second modeled mutation, and one confirmed UI callback; UNKNOWN clears only on accepted replay. The lifecycle case exercises publication; cancellation's shared render path changes identically, but no new independent cancellation result is claimed. Existing successful suites were not rerun.

All three new after-groups PASS. Full unchanged-target TypeScript noEmit ES5, scoped ESLint on the three TSX files and affected MJS, MJS syntax and diff checks PASS. Versions: Next16.4.1 / Zod4.6.6 / TypeScript5.9.3 / Node24.19.0. No installation or package/config change.

## Composition and runtime boundary

`GUIDE_PLATFORM_PROVIDER_V1` remains byte-identical and NULL. Actual R2 routes, factory consumer, auth/discovery, schema/codec, CE010/CE011, Core/Docs/SQL and package/lock remain unchanged. No parallel adapter, SERVICE fallback, native binding or activation was added. The reported adapter package remains157384bytes/SHA256331ac731ebfad10287caa5a30647be1413fdf62ed6415b7cdc9476ec186bc0ea, awaiting actual Platform delivery. After delivery verify bytes and contract before App attaches the official adapter to the existing server-only slot.

Platform owns installation and the real Guide run; QA owns independent acceptance. Native create/edit/publish/cancel, same-ID readback after restart, real Auth/denial/concurrency/recovery remain NOT_RUN_NOT_PASS. Guide without documents acquires no SERVICE/Storage/scanner dependency.

The manifest records before/after source bytes, SHA256 and Git blob identities, excludes itself, and binds actual check results to this direct-parent delta. Local evidence hashes are provenance only, not shared filesystem or native proof. No raw evidence, credentials or private binding is published.

Skills: current AGENTS and installed Next guide, Cloud Runtime, Supabase security, React best practices; CLADORA-SKILLS-USAGEv1.1.0. React review: render-derived feedback, unchanged hook order/cleanup, native form controls, scoped accessible alert; no dependency or shared authority changes.

Automation: نیازمند بررسی؛ mechanical state/wire checks may be automated, but retry remains an explicit authorized user action and native execution requires the official Platform target and independent QA. No new execution authority.
