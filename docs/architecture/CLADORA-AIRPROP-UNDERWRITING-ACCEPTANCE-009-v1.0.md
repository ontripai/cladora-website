# AIRPROP underwriting rollout and live acceptance 009

2026-10-04. Starts from merged UI #237, retaining independently merged asset registration #239. This slice fixes the live-observed stale opportunity status after a successful evaluation: the scoped evaluation component now requests a parent opportunity refresh only after a validated server success. Mounted integration tests submit a real form and assert the parent status becomes Underwriting. No optimistic status, arbitrary reload, financial calculation or permission change in the browser.

## Applied migration identity

Production Supabase received the exact tested SQL from #234 through apply_migration, named `airprop_native_underwriting_v2`. The service recorded version **20261004090538**. Rename the repository migration from its original CLI draft version 20261004074606 to the recorded version and update the runtime fixture/workflow references. SQL is byte-for-byte unchanged. Both file and remotely recorded statement have SHA-256 `ed3cf701176fab3e22859b0ff6f51eab17a84acd41f8933536552facdb60304a`. No second application, migration-history overwrite or duplicate DDL.

Both customer RPCs exist. Authenticated execution is intentional and guarded by canonical native workspace authorization/AAL2; anon and service_role execution are denied. Private helper grants remain closed. Security advisors report the expected authenticated SECURITY DEFINER gateway warning; no AIRPROP RLS-without-policy finding. Reference: https://supabase.com/docs/guides/database/database-linter . Existing unrelated notices are outside this slice.

## Bounded real-session acceptance

Used the signed-in authorized Mahmoud test account, verified through the visible profile, with its existing tenant context and CLADORA Pilot Association 001. A separate `airprop_pilot_underwriting_20261004` role contains only opportunity.read and underwriting.manage, bound to AIRPROP and this workspace, with role and assignment expiry **2026-10-04T11:07:53.748159Z** (14:37 Tehran). Existing opportunity and SERVICE assignments, entitlement and modules are unchanged. Administrative grant/revoke/restore actions have explicit ADMINISTRATIVE_MCP audit provenance; no forged auth/JWT context was used.

Reused the existing synthetic opportunity `f53f75ad-efa6-4284-b1ff-f7619c1dede9`; no duplicate opportunity. Actual browser submission created evaluation 1 from cost 100000.0001 EUR, rent 6000.0001 and opex 1000.0000. Database and UI agree: NOI 5000.0001, gross yield 0.06000000 (6%), net yield 0.05000000 (5%).

Revoked only the evaluation assignment, then attempted rent 7000.0001. The live UI denied the write, retained the exact pending command, and locked the inputs. Read-only verification found one version, one evaluation audit and one outbox record: no rejected write committed. Restored a new assignment with the original expiry, without extending the permission window. Reloaded the page, explicitly reselected workspace/opportunity, observed restored frozen inputs and the same-request retry button, then retried through the actual browser. Evaluation 2 committed with NOI 6000.0001 and yields 7%/6%, preserving version 1 unchanged. Database evidence: two versions, two evaluation audits, two outbox records and two canonical retry records, all under the authorized test actor.

No payment, ledger posting, acquisition approval or contract was executed. Network-loss replay, concurrent sessions, stale versions and cross-workspace rejection additionally remain covered by executable runtime/API/mounted UI tests; do not mislabel these CI checks as manual live browser tests.
