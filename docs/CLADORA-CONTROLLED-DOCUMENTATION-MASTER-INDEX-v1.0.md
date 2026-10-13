# CLADORA Controlled Documentation Master Index v1.0

**Status:** Authoritative index
**Effective date:** 2026-09-19

## Parent reference

The authoritative parent definition is:

- [`CLADORA-MASTER-SYSTEM-DEFINITION-v1.0.md`](CLADORA-MASTER-SYSTEM-DEFINITION-v1.0.md)

## Universal workspace package

1. [`architecture/ADR-CLD-052-universal-managed-property-workspaces.md`](architecture/ADR-CLD-052-universal-managed-property-workspaces.md)
2. [`architecture/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-v1.0.md`](architecture/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-v1.0.md)
3. [`product/CLADORA-RESIDENTIAL-LIVING-SERVICES-v1.0.md`](product/CLADORA-RESIDENTIAL-LIVING-SERVICES-v1.0.md)
4. [`roadmap/CLADORA-UNIVERSAL-WORKSPACE-RECON-001-v1.0.md`](roadmap/CLADORA-UNIVERSAL-WORKSPACE-RECON-001-v1.0.md)
5. [`closure/CLADORA-WORKSPACE-TAXONOMY-001-CLOSURE-v1.0.md`](closure/CLADORA-WORKSPACE-TAXONOMY-001-CLOSURE-v1.0.md)
6. [`security/CLADORA-WORKSPACE-TAXONOMY-001-ADVISORY-EXCEPTION-v1.0.md`](security/CLADORA-WORKSPACE-TAXONOMY-001-ADVISORY-EXCEPTION-v1.0.md)
7. [`discovery/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-DISCOVERY.md`](discovery/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-DISCOVERY.md)
8. [`contracts/CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md`](contracts/CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md)
9. [`security/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md`](security/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md) — *Accepted Controlled Advisory Exceptions*
10. [`closure/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-CLOSURE-v1.0.md`](closure/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-CLOSURE-v1.0.md) — *Production Closed & Verified*
11. [`discovery/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-DISCOVERY-v1.0.md`](discovery/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-DISCOVERY-v1.0.md)
12. [`security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-SECURITY-ADVISOR-v1.0.md`](security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-SECURITY-ADVISOR-v1.0.md) — *Accepted Controlled Advisory Exceptions*
13. [`closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-CLOSURE-v1.0.md`](closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-CLOSURE-v1.0.md) — *Production Closed & Verified (102 Migrations, Drift 0, Merged to Main)*
14. [`discovery/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-DISCOVERY-v1.0.md`](discovery/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-DISCOVERY-v1.0.md)
15. [`security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-SECURITY-ADVISOR-v1.0.md`](security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-SECURITY-ADVISOR-v1.0.md) — *Accepted Controlled Advisory Exceptions*
16. [`closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-CLOSURE-v1.0.md`](closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-CLOSURE-v1.0.md) — *Production Closed & Verified (103 Migrations, Drift 0, Merged to Main)*
17. [`closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2-CLOSURE-v1.0.md`](closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2-CLOSURE-v1.0.md) — *Production Closed & Verified (104 Migrations, Drift 0, Merged to Main)*
18. [`security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2-SECURITY-ADVISOR-v1.0.md`](security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2-SECURITY-ADVISOR-v1.0.md) — *Accepted Controlled Advisory Exceptions*

## Current execution roadmap

- [`roadmap/CLADORA-MASTER-PRODUCT-ROADMAP-v1.1.md`](roadmap/CLADORA-MASTER-PRODUCT-ROADMAP-v1.1.md)
- [`roadmap/CLADORA-RESIDENTIAL-PILOT-READINESS-v1.1.md`](roadmap/CLADORA-RESIDENTIAL-PILOT-READINESS-v1.1.md)
- [`roadmap/CLADORA-ROADMAP-RECON-001-EVIDENCE-v1.0.md`](roadmap/CLADORA-ROADMAP-RECON-001-EVIDENCE-v1.0.md)

## AIRPROP package

- [`airprop/README.md`](airprop/README.md)
- [`airprop/ADR-AIRPROP-001-platform-boundary.md`](airprop/ADR-AIRPROP-001-platform-boundary.md)
- [`airprop/AIRPROP-DOMAIN-MODEL-v1.0.md`](airprop/AIRPROP-DOMAIN-MODEL-v1.0.md)
- [`airprop/AIRPROP-PERMISSION-MATRIX-v1.0.md`](airprop/AIRPROP-PERMISSION-MATRIX-v1.0.md)
- [`airprop/AIRPROP-AUTOMATION-APPROVAL-MATRIX-v1.0.md`](airprop/AIRPROP-AUTOMATION-APPROVAL-MATRIX-v1.0.md)
- [`airprop/AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md`](airprop/AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md)
- [`airprop/AIRPROP-MIGRATION-TEST-PLAN-v1.0.md`](airprop/AIRPROP-MIGRATION-TEST-PLAN-v1.0.md)

## Interpretation rule

- The Master System Definition governs product scope and architecture.
- Accepted ADRs govern bounded architectural decisions.
- Roadmaps govern execution order and closure gates.
- Migrations and tests prove implemented database behavior.
- Closure reports prove only their stated acceptance scope.
- Marketing and demo content do not prove production capability.

Historical versions remain preserved and must not be silently rewritten.

## Integrated four-work execution baseline v1.4

The user-approved execution scope, including AP-VAL-01 and PM-01, is registered in [the current control index](control/README.md). [The current coordination matrix v1.4](control/WORKSTREAM-COORDINATION-MATRIX-v1.4.md) records the commit-pinned state after inactive provider-package integration and the remaining database, provider, runtime, activation, and acceptance gates. [The historical v1.0 matrix](control/WORKSTREAM-COORDINATION-MATRIX-v1.0.md) remains evidence of its original observation. [The PM01-A private oversight registry contract](control/PM-01-PRIVATE-OVERSIGHT-REGISTRY-v1.0.md), [PM01-B runtime readiness inventory](control/PM-01-RUNTIME-READINESS-INVENTORY-v1.0.md), and [PM01 Runtime Authorization Gate](control/PM-01-RUNTIME-AUTHORIZATION-GATE-v1.0.md) define the private control boundary without installing runtime behavior. [The v1.4 plan](roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md) governs execution order. No Runtime, Remote migration, command activation, or Production acceptance is introduced by documentation alone.

[The historical v1.3 matrix](control/WORKSTREAM-COORDINATION-MATRIX-v1.3.md) remains its original snapshot. [SV-REQUEST-PROVIDER-V2-01](roadmap/CLADORA-SERVICE-REQUEST-PROVIDER-V2-01-EXECUTION-PACKAGE-v1.0.md) scopes the next isolated SERVICE implementation and Core review.
