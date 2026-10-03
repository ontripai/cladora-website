# Shared audit exception proposal 001

Status: **PENDING USER APPROVAL; INACTIVE**. Application Foundation still runs the original raw high-severity audit gate. This proposal does not authorize merge or deployment.

## Concrete decision

Temporarily accept only GHSA-vfj7-8cjw-p6xm (npm advisory source 1240992), and its exact seven-package development-tool chain, provided the reviewed braces depth backport is installed and verified. This is acceptance of a known residual advisory after local mitigation, not a claim of a zero-finding raw audit or an official upstream fix.

Validity: 2026-10-03 12:30 UTC through **2026-10-10 12:30 UTC**, exclusive of the expiry instant. In Tehran: 3 October 16:00 through **10 October 16:00**. No automatic extension. Any renewal is a separate decision.

| Reviewed package | Locked versions |
| --- | --- |
| braces | 3.0.3 |
| chokidar | 3.6.0 |
| micromatch | 4.0.8 |
| fast-glob | 3.3.1 and 3.3.3 |
| @next/eslint-plugin-next | 16.3.3 |
| eslint-config-next | 16.3.3 |
| tailwindcss | 3.4.19 |

The JSON policy pins the complete lockfile, mitigation manifest, package locations, versions, and registry integrity values. All listed packages must remain development dependencies. No other high or critical finding is accepted. Unknown advisory identities, changed graphs, missing copies, unapplied patches, malformed audit reports, audit execution errors, and expiry stop the gate. Raw audit output remains visible before the policy verdict.

## Prepared implementation

- `scripts/check-shared-dependency-audit.mjs`: executes fresh npm audit, validates its report and current installation, then evaluates the bounded decision. It accepts no CLI override of time, scope, or policy.
- `patches/braces-audit-exception-proposal.json`: deliberately contains `status: pending-user-approval` and `approval: null`.
- `scripts/test-shared-dependency-audit.mjs`: 25 behavioral checks against a captured real report, plus the installed executable mitigation. Simulated approval exists only inside the test process and is never written to the production policy.
- The existing mitigation CI also tests the inactive proposal. The application security gate is unchanged.

## Activation after the decision

Only after explicit approval of this exact scope and expiry:

1. Record approved status, approving user, and an auditable decision reference in the JSON policy.
2. Replace only the Application Foundation step `npm audit --audit-level=high` with `node scripts/check-shared-dependency-audit.mjs`; run the executable mitigation test immediately before it.
3. Include patch and audit script paths in that workflow's change triggers so future changes cannot avoid evaluation.
4. Run all proposal, mitigation, application, and database CI on the exact published head. Review raw findings and approved-exception verdict separately.
5. Merge the shared root change first; update and verify dependent module branches serially. Delete a branch only after its confirmed merge.

Approval of the exception does not authorize untested runtime authority widening or incomplete module endpoints. Any production deployment remains subject to the task's applicable deployment authorization and verification.

## Residual limitation and retirement

The local patch bounds nesting. It does not certify freedom from every vulnerability, output-cardinality exhaustion, or arbitrary malformed AST parent graphs. No official patched braces release is currently listed. The intended long-term solution is a reviewed fixed release or dependency replacement; remove the exception and backport after compatibility and raw audit checks pass.

Prior evidence: 764 released upstream tests, 55 executable mitigation checks, 108 compatibility comparisons, complete local application lint/type/unit/build checks, successful Node 22 mitigation CI, and successful database CI at shared head d06d4e3902fec950a452b8e8a18b56d25623dc6e. Application Foundation at that head still fails its unchanged raw audit step.
