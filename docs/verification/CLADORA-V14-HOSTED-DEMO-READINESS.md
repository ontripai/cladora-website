# Hosted demo readiness

The release Preview and its existing native CI are distinct from an installed,
authenticated hosted application. No hosted database installation or production
promotion is performed by the candidate workflow in this change.

## Confirmed deployment mismatch

Read-only project/catalog inspection found the separate staging project healthy
on PostgreSQL 17.11, with no application migrations, application tables or roles.
Its installer is the managed non-superuser `postgres`. Supabase explicitly does
not provide superuser access to that role:
<https://supabase.com/docs/guides/database/postgres/roles-superuser>.

The current complete disposable baseline uses a real local `supabase_admin`
superuser to finalize SERVICE STEP-SU-02. S3 requires that exact privileged actor;
S4 requires its genuine protected receipt and role graph. A successful local CI
run cannot supply that hosted capability. The original S3/S4 guards, sources and
receipts must not be weakened, fabricated or marked installed on staging.

The independently reconstructed Core300 four-unit fresh installer is also not a
drop-in full application bootstrap. It intentionally withholds runtime caller
permissions and does not declare all first-user workspace/invitation/onboarding
gateways required by the current app.

## Distinct reduced demo candidate

`prepare-demo-migration-candidate.mjs` verifies all 300 original migration hashes
against the existing baseline manifest before allocating a fresh unlinked local
project. It copies exactly 297 unchanged files. The three held originals are:

| Original source | Reason held |
| --- | --- |
| `20261018163000_service_subject_link_role_bound_pool_privileged_v1.sql` | Authentic privileged STEP-SU-02 is unavailable on the inspected hosted actor |
| `20261018170000_communications_service_role_acl_shutdown_v1.sql` | Requires that genuine finalization receipt; a deny-only candidate is not S4 |
| `20261025214155_building_setup_command_receipts_v1.sql` | Inactive sealed G2 installer, not a sequential incremental migration |

`supabase/demo-proposals/communications-deny-only-closure.proposal.sql` is a
separate, unapproved capability proposal, outside automatic migration discovery.
It requires S3 roles/finalization objects absent and S1/S2 private routine
boundaries intact. It takes the existing Core mutation lock, requires the
original four-table RLS and 32-direct-privilege prestate, then revokes the four
legacy direct `service_role` table capabilities. Its full S4-derived
postconditions reject remaining direct table/column grants, inherited/effective
privileges, PUBLIC/service_role policies and disabled RLS. It creates no role,
grant, execution capability, trusted receipt or history entry.

The candidate is intentionally one-shot. A later real S3/STEP-SU-02/S4 adoption
needs a separately reviewed transition because original S4 expects the legacy
32-privilege prestate. Restoring those privileges automatically is prohibited.
Unfinalized SERVICE/CE pools remain unwired; connection-owner, service-role or
RPC-owner fallbacks are not substitutes.

The dedicated CI job verifies only a disposable native candidate: an exact
non-superuser install, real migration-history exclusions, rollback under invalid
prestates, deny-only catalog closure, unchanged roles/private routines and repeat
application denial. Its receipt explicitly leaves hosted acceptance, actual Auth
and application journeys unproved. It has no hosted target, project link,
repository/environment secrets, remote SQL interface or production promotion.
Historical migration sources and the complete original CI baseline are unchanged.

## Application capability boundaries

| Current route/capability | Source assessment, before connected proof |
| --- | --- |
| Login/MFA, profile, Context selection and dashboard | Baseline gateways exist; actual Auth identity, membership and authority are still required |
| Workspace/invitation/primary-admin onboarding | Baseline-backed; Core300 alone does not replace this control plane |
| Separate assets/equipment and contractor pages | Independent of the Operations gate; exact baseline RPC declarations exist |
| Basic building setup | Pre-G2 v2 and exact last-slot receipts exist; successful setup still needs connected proof |
| Historical/overwritten building command recovery | Held G2 lookup is missing; no recovery acceptance is claimed |
| Current maintenance page and Operations lifecycle writes | Blocked: sequential migrations declare neither Operations command v1 nor v2 |
| Advanced valuation/currentness, Checklist v2 and private role-bound providers | Independent adoption/session/authority/runtime gates remain open |

The maintenance blocker includes reads in the current interface:
`CustomerMaintenanceDashboard` waits for `OperationsCommandGate` readiness before
its GET. Opening that gate calls `customer_api.operations_command_v1` by default;
the absent RPC produces `503 COMMAND_UNAVAILABLE`. Legacy mutation routes return
`428 OPERATIONS_COMMAND_REQUIRED`. Direct SQL against underlying read functions
does not demonstrate the current maintenance UI, and bypassing its gate would
weaken the accepted command/recovery contract.

## Remaining release conditions

1. Native candidate installation/denial proof and independent source acceptance.
2. Positive first-user browser → Auth → RPC → data → readback journeys for the
   selected demo scope, with the omitted capabilities explicitly unavailable.
3. Hosted actor/extension/catalog/ACL verification and a concrete pinned target
   plan; local PostgreSQL 17.6 proof is not PostgreSQL 17.11 hosted proof.
4. Preview-only Auth redirects and Data API configuration plus server binding
   where required; never copy production secrets to the demo.
5. Separately accepted Operations backend/caller integration before maintenance
   is represented as working; no fake receipt, permissive fallback or hidden gate.
6. Production readiness, merge and promotion remain distinct from a demo Preview.

An attempted native proof in the current managed Docker environment stopped
during database-image extraction with `no space left on device`; no database
container or application SQL was created there. This is infrastructure failure,
not a successful candidate test. The dedicated disposable CI job records its own
outcome independently.

## First-administrator verification

The dedicated local job additionally exercises real GoTrue user creation,
password login, TOTP enrollment/verification, and issued AAL2 sessions. Its only
owner bootstrap fixture is an atomic pair of application control-plane records,
linked to a verified synthetic Auth UUID in an initially empty local platform.
It never inserts Auth users through SQL or signs replacement JWTs. Canonical
RPCs must reject AAL1 and accept the actual AAL2 platform administrator; pilot
creation must remain in the normal LEAD lifecycle and create its audit event.
The customer extension follows canonical 24-hour PILOT preparation and every
required version-bound lifecycle transition. A distinct real Auth/TOTP customer
must see and activate only their email-bound prepared access, obtain a profile,
membership and Context from application RPCs, and complete primary-admin
onboarding. No owner SQL creates customer authority or bypasses lifecycle;
no contract, payment or email delivery is claimed. The next stage tests canonical
versioned ACTIVE transition and the actual basic dashboard RPC, including
pre-ACTIVE/customer-actor denials, Context/tenant/workspace binding, typed payload,
empty counts, preserved expiry and audit readback. Native workspace/module
authority, commercial entitlements, building/Operations workflows, browser
journeys and hosted provisioning remain separate proof boundaries.
First-administrator and customer-onboarding successes are retained separately if
a later boundary fails; only a passing receipt for that exact source establishes
the additional ACTIVE/dashboard result.

The connection-boundary controls independently reject a production project,
mismatched project/user/API/host tuples, transaction pooling, unverified TLS
options and connection-option injection. They open no connections and do not
grant deployment authority. Every native Docker operation selects the local
Unix socket explicitly rather than inheriting another Docker context.
