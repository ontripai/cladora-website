# CLADORA-WORKSPACE-ONBOARDING-001

## Verdict

`READY-DRAFT-PR`

## Discovery

- The authenticated customer dashboard, customer API gateway, tenant-scoped memberships,
  context grants, canonical roles, active workspace gate and module entitlements already
  exist in the canonical schema.
- The target Auth account existed but had no active membership or context grant.
- No schema repair or forward migration was required. Migrations 1–93 remain unchanged.
- The controlled operation therefore uses explicit DML rather than introducing fixture
  rows into a migration.

## Controlled fixture

- Marker: `CLADORA-WORKSPACE-ONBOARDING-001-FIXTURE`
- Environment: `PILOT`
- Persona: `association_admin`
- Scope: the synthetic tenant only
- Inventory: one synthetic property, building and unit
- Entitlements: ten customer modules, intersected with canonical role permissions
- Identity boundary: the existing Auth user is referenced but never created, updated or deleted
- Execution: idempotent deterministic identifiers and an explicit target-email session parameter
- Cleanup: a dedicated rollback script deletes only the deterministic synthetic tenant graph

## Verification

- Test 080 runs in `BEGIN ... ROLLBACK` with 12 assertions.
- It verifies AAL2 context discovery, authoritative persona, active workspace resolution,
  synthetic KPI counts, module exposure and cross-user denial.
- Static acceptance verifies RO/EN/FA empty-state copy, Persian RTL, parameterized identity,
  idempotency and the presence of controlled cleanup.
- Database package after the addition: 93 migrations, 80 tests, 2591 assertions.

## Release boundary

- No migration was applied.
- No real customer tenant or domain record was changed.
- No password, MFA factor, session or Auth user was modified.
- Merge is excluded until separate approval.
