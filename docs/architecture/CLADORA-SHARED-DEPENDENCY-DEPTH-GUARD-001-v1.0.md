# CLADORA shared dependency depth guard 001

Status: tested local mitigation, awaiting review. This does not clear the security audit or authorize merging AIRPROP, SERVICE, or Operations changes.

## Shared ownership

The root installation owns this guard once for all three works. Module branches must consume the same root package and lockfile rather than introduce separate fixes. This change has no customer permission, workspace authority, database, migration, API, or production deployment effects.

## Problem and bounded change

GHSA-vfj7-8cjw-p6xm affects braces through 3.0.3. On 2026-10-03 the advisory lists no patched release. The installed Tailwind and Next ESLint toolchains reach the same vulnerable package through chokidar, micromatch, and fast-glob.

The backport bounds parser nesting and recursive compile, expand, and stringify walkers to 100 container levels. A lower finite positive maxDepth is floored; larger values cannot raise the cap. It preserves the 3.0.3 stringify parent behavior, including escapeInvalid. It is a local derivative of the depth-limit approach proposed in upstream PR 72, not an upstream approved or published fix.

References:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/micromatch/braces/pull/72
- Released reference tests: tag 3.0.3, commit 74b2db2938fad48a2ea54a9c8bf27a37a62c350d.

The existing package license and metadata are retained. The manifest pins original and resulting file hashes. The installer verifies every locked braces installation before writing any of them, rejects unknown releases or source bytes, and accepts an already applied exact patch. Package identity stays braces@3.0.3; no override, package rename, fabricated release version, advisory suppression, or audit exemption is introduced.

## Installation and verification

`npm ci` runs the root postinstall guard. Installations using `--ignore-scripts` must explicitly run `node scripts/apply-braces-depth-guard.mjs` before invoking toolchain consumers. A separate CI workflow checks the executable mitigation; Application Foundation retains its original high-severity npm audit gate.

Local evidence:

- Clean npm ci applied five files in the single locked installation.
- 55 executable checks and 108 compatibility comparisons passed, including deep strings, direct deep ASTs, cyclic nodes, exact source drift rejection, version rejection, idempotence, and real consumer resolution and behavior.
- Full repository lint, TypeScript check, existing unit suite, production build with placeholder Supabase configuration, and git diff whitespace check passed.
- All 764 tests from the published 3.0.3 suite passed on the patched source in an isolated fixture, using mocha 11.7.5, bash-path 2.0.1, and fill-range 7.1.1. Those verification-only dependencies are not added to CLADORA.

## Remaining boundary and retirement

This guards excessive nesting, not output cardinality or arbitrary malformed AST parent graphs. It does not prove the dependency free of all vulnerabilities. The raw npm audit still reports seven high-severity findings in the shared chain; the official audit gate remains blocking.

Retire the local patch and postinstall only when a reviewed upstream release or replacement removes this chain and the compatibility, module, lint, type, build, and raw audit checks pass. Any temporary advisory exception would be a separate explicit decision with narrow scope, evidence, and expiry; none is part of this change.
