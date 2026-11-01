# CORE-NEXT-HTTP-CALLBACK-HEADERS-12

Owner Core/Auth; coordinator integrates. Exact product Base/parent731de1382acbe52e00c30b2925910675c694aef2. Scope only HTTP11-F02/F03. No F01/demo-root edit. Previous readiness source/artifacts are untouched and excluded from this handoff.

## Findings and limited fix

**F02: original finding is an observation/aggregation defect, not missing Cookie on this wire.** Actual Next16.4.1 baseline sends two Vary fields: `Cookie` and `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`. They are one list-valued HTTP field. HTTP11 run.py uses `hd={k.lower():v for k,v in rh}`, retaining only the last Vary. That explains its reported missing Cookie; its flattened evidence cannot establish absence from raw wire. Task12 preserves getheaders() pairs and unions all Vary field values. All32 baseline and32 after final callback responses contain Cookie and all four native RSC variations. We do not claim to have rerun all168 original callbacks. No product Vary/route/framework change is necessary or justified; missing-Cookie and missing-RSC negative oracle checks are retained in the targeted test. Do not patch Next or hard-code its RSC header names in product response generation.

Framework evidence: installed next/dist/server/base-server.js:1375–1387 appends native RSC Vary; base-http/node.js:120 appends separate values, and send-response.js allows multiple Vary values. Correct consumers must combine field lines, not use a last-value dictionary. Installed headers.md and route-handler docs were read before edits.

**F03: reproduced and fixed.** next.config global `/:path*` sets strict-origin-when-cross-origin. Supported-locale sensitive routes override it with no-referrer, but /xx/auth/callback was outside that list. send-response.js only appends non-list route headers if absent, so the route's no-referrer does not override the already-present global header. Supported public headers() API documents last matching header override. Change the single sensitive callback matcher from `/:lang(ro|en|fa)/auth/callback` to `/:lang/auth/callback`. That protects unsupported one-segment locale rejection too. No global privacy policy, other route pattern, parser/allowlist/recovery/cookie behavior or successful Auth path is changed. No custom server/helper/route change needed.

## Actual verification

Production Next16.4.1, React19.2.8, Zod4.6.6, TypeScript5.9.3. Existing exact-lock dependencies reused read-only via symlink from an isolated earlier task (lock SHA256 c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc matches); no install, package/dependency/node_modules patch. Fresh production build --webpack on exact Base and changed source both completed, including TypeScript and597 pages. Build IDs and real wire headers in wire-evidence.json. Local source-build evidence is not hosted or successful Auth evidence.

Official HTTP11 patch37680bytes/SHA256e9acfa5e3bf667a423ac92bc0892920e1c3a77d34f4bec0940baec59296c7eb3; manifest90743bytes/SHA25643c9329872ddba2bb2ca4d6c6824d14ac4b47d2601e186bb1ec50c34b03daab7; ZIP329027bytes/SHA2566fa24523f92fbf35827cee8370be569ae1fc5dc23e2ef210a6ae2f669d0b5921: all identities checked, ZIP Git identity/CRC290members checked. Source callback/config preimages from original0ed7f4c9 and new Base compared; unchanged. Reference https://github.com/ontripai/cladora-website/issues/463#issuecomment-6557241082 .

Reuse original deny-egress.c unchanged, gcc to scratch binary. Build/start with inherited PR_SET_NO_NEW_PRIVS/seccomp guard, strace -f network; clean process env without .env files/secrets. Server binds127.0.0.1:31212; outbound loopback probe is kernel-denied ENETUNREACH. All actual server/build traces checked: successful connect/sendto/sendmmsg0. No provider HTTP, Auth/email/SQL, valid session or fake successful Auth executed. Configured mode only public staging URL plus visibly synthetic invalid key; unconfigured lacks both. All callback inputs reject before SDK exchange. Client runs outside fenced server and performs only localhost requests.

Targeted32 cases per phase: configured/unconfigured × FA/EN/RO/xx × document/RSC × missing/duplicate input. Baseline eight invalid-locale responses fail no-referrer; Cookie/RSC present32/32. Six original baseline RSC-missing assertions also failed because native canonicalization adds `_rsc`, which unchanged query allowlist correctly rejects unsafe. Original result file/hash preserved, not edited or hidden: after-test oracle explicitly expects unsafe only after a same-callback native canonical hop, invalid_locale still takes precedence. There is no auth-result follow or external Location allowance. After32/32 PASS for exact rejection status/internal Location, clear recovery cookie HttpOnly/SameSite=lax/Max-Age0, no auth cookie, private/no-store/CDN/surrogate, no-referrer, Cookie and RSC sets. All failed assertions remain in baseline evidence; no failed security assertion was removed.

Commands (existing dependencies, exact source, NEW output directory):

    gcc HTTP11/deny-egress.c -o SCRATCH/deny-egress
    strace -f -e trace=network -o SCRATCH/build.network SCRATCH/deny-egress node node_modules/next/dist/bin/next build --webpack
    python3 scripts/review-next-http-callback-headers-12/test.py NEW_OUTPUT SCRATCH/deny-egress
    node_modules/.bin/eslint next.config.mjs
    git diff --check

Affected lint and diff checks PASS; Python syntax PASS. No unrelated254 case suite, contact/demo/DB suite replay. No release/main/delivery ref change, environment mutation, migration, RLS/MFA/claims change or deployment performed. Only task branch source publication is authorized; integration remains coordinator decision.
