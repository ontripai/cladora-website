# Shared dependency reconciliation 002

AIRPROP, Operations, and SERVICE consume one root dependency tree. Operations main commit 615d420bbabe61a6bd2baec4a1175ee4ef78faf7 introduced the repository-vendored braces 3.0.4-cladora.1 parser guard. This change completes that same derivative as 3.0.4-cladora.2, replacing the earlier proposed postinstall backport approach rather than adding a second implementation.

## Resulting behavior

Both braces and parentheses contribute to a 100-container hard nesting cap. The recursive compile, expand, and stringify walkers also reject deeply nested direct ASTs and cyclic node graphs with a bounded error. Stricter positive finite maxDepth values are floored; options cannot raise the cap. Published stringify parent behavior, including escapeInvalid, is preserved.

The MIT attribution is retained. The internal version is explicitly described as a local derivative, not an upstream patched release. The pinned manifest records exact original and resulting source hashes. Installed sources must match the tracked vendored source; SHA-512 of the checked-in archive must match the lockfile; all root and nested consumer resolutions must reach the reviewed package. No production or customer authorization logic is changed.

## Security gate and exception decision

The user's 2026-10-03 16:17:19 Tehran continuation approved the previously presented seven-day bounded exception. During reconciliation, main was found to have adopted a vendored derivative. That exception is **not activated**: no approved exception policy, suppression script, or postinstall patch is included in this resulting tree. The original `npm audit --audit-level=high` gate stays in place.

The raw audit reports zero findings for the internal derivative. Registry advisory matching does not establish that an unpublished derivative is safe. Required behavioral and source/integrity checks therefore independently verify the local mitigation; zero registry findings must not be described as an official upstream fix. GHSA-vfj7-8cjw-p6xm still lists no patched upstream release as of this review.

## Evidence

- Clean npm ci installs the reviewed local archive.
- 59 executable security, source integrity, and real-consumer checks pass, with 108 comparisons against reconstructed byte-pinned published 3.0.3 code.
- All 764 published 3.0.3 upstream tests pass on this vendored source in the isolated release-suite fixture; test reference commit 74b2db2938fad48a2ea54a9c8bf27a37a62c350d. Verification-only mocha 11.7.5, bash-path 2.0.1, and fill-range 7.1.1 are not application dependencies.
- npm audit reports zero findings. Application Foundation retains its raw audit step and now also triggers on vendor, patch, and security-test changes. Existing unit checks invoke the expanded security test. A separate workflow verifies clean install, security behavior, and raw audit on Node 22.

Full application and database CI results are recorded in the PR on the exact published head; local evidence must not be substituted for a pending or failed remote check.

## Shared work boundaries and retirement

Only this shared root fix owns braces. AIRPROP opportunity input/retry contracts and SERVICE catalogue contracts continue on their own paths. Core workspace authority remains owned by its separate shared-core PR. No additional Context/grant store, module-specific dependency override, remote migration, or deployment is introduced here.

This mitigation bounds nesting; it does not certify arbitrary malformed AST parent graphs or output cardinality. Replace the internal derivative with a reviewed upstream fixed release or dependency replacement after compatibility, source, module, build, and raw audit verification. Retire the local manifest and security derivative together. Delete a work branch only after its confirmed merge.
