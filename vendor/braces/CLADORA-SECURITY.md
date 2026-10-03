# CLADORA internal braces security derivative

Version 3.0.4-cladora.2 is a local, repository-vendored derivative of the published braces 3.0.3. It is **not** an upstream patched release and must not be represented as one. The original MIT license and attribution are retained.

GHSA-vfj7-8cjw-p6xm describes stack-exhaustion denial of service. This derivative bounds parser nesting, including parentheses and mixed containers, and recursive compile/expand/stringify AST walkers to 100 container levels. A lower finite positive maxDepth is floored; options cannot raise the hard cap. The original stringify parent semantics and escapeInvalid outputs are preserved.

The byte-pinned patch manifest at patches/braces-3.0.3-depth-guard.json in the CLADORA repository records the original and patched source hashes and exact edits. The approach derives from https://github.com/micromatch/braces/pull/72; the upstream PR is not a published security release. This release extends the parser-only CLADORA internal version 3.0.4-cladora.1 with walker and parenthesis guards.

The root dependency override resolves all consumers to one checked-in npm archive. Executable tests compare installed sources with tracked vendored sources, verify archive SHA-512 against the lockfile, reconstruct byte-pinned released reference code for compatibility comparisons, and exercise actual micromatch/fast-glob/Next ESLint resolutions.

Registry npm audit does not report the original upstream version advisory against this internal version. An empty audit report alone is therefore **not proof** of the local fix; the source verification and behavioral security checks are required alongside the unchanged audit gate.

This is a nesting mitigation, not a guarantee against output-cardinality exhaustion or arbitrary malformed AST parent graphs. Replace the derivative with a reviewed upstream fixed release or replacement when available, after security and compatibility verification.
