# Three-work integration checkpoint v1.0
Date: 2026-10-03
Decision family: CLADORA-ARCH-SHARED-WORKSPACE-20261003
Status: Read-only repository comparison and integration contract; not a merge reservation or automatic synchronization.
Baseline main: 7f7ea716a97e9c9ae29e7cbdbcd905c8391246c3.

## Compared open work
Fetched open PR metadata and complete file collections (all below 100 files), and read both SERVICE architecture/execution documents in #217. Snapshot evidence:

| PR | Head branch | Base branch | Observed head SHA | Changed files |
|---|---|---|---|---|
| #213 | cladora-arch-shared-workspace-20261003 | main | cfb6b7bf34ce9b746a84e097e83d2076b0c76101 | 6 |
| #214 | cladora-airprop-scope-ceiling-001 | main | fabd15578441bea5b9c2fedd4fa18522987b3be4 | 5 |
| #215 | fix/building-setup-independent-approval-20261003 | main | acdb6c47c7373b1f5f4e73965221ee974c31e240 | 2 |
| #216 | cladora-shared-context-ceiling-002 | cladora-airprop-scope-ceiling-001 | a5a3e88d6e3975870bfc736ca0feff9e7596027a | 11 |
| #217 | cladora-service-architecture-v1-20261003 | main | 60c1c8a120b79e6a0bf9dd7a69c36a51938c4f0b | 2 |

#213: shared workspace architecture, core mapping and AIRPROP contracts.
#214: AIRPROP whole-subject scope prerequisite.
#215: independent building setup approval in the wizard and its test.
#216: shared authorization adapter and bound AIRPROP scope, reads, persisted identity and legacy review planner.
#217: SERVICE architecture and implementation documents; no runtime schema/code changes.

## Exact file overlap
The only pair with shared paths is #214/#216:
- .github/workflows/airprop-scope-regression.yml
- supabase/tests/086_airprop_core_foundation.test.sql

This is an intentional stacked dependency: #216 targets #214's branch. Preserve #216's subsequent changes when integrating #214; do not replace the shared test/workflow with #214's older version.
#213, #215 and #217 have no exact changed-path overlap with the other PRs in this snapshot. This does not prove semantic compatibility or absence of unpublished work.

## Shared implementation ownership boundary
| Shared area | Current owning change | Operations consumption | SERVICE consumption | Next dependency |
|---|---|---|---|---|
| Bound context ceiling / effective AIRPROP authorization | #216 | Existing behavior must stay compatible | May consume adapter only for supported targets | Explicit workspace/resource contract |
| AIRPROP runtime definition/bindings | #216 | No operational grants modified | Register own module/permissions; no AIRPROP manifest edits | SERVICE catalogue manifest |
| Whole-subject commercial configuration | #214 then #216 | Refer to canonical subject | Refer to commercial rights when authorized | Shared subject/availability |
| Commercial workspace persistence | #216 | No parallel commercial history | Link authorized commercial case | Explicit workspace mutation authority |
| Historical commercial resolution | #216 review planner only | Supply authoritative historic evidence | No reassignment of AIRPROP records | Authorized audited application gateway |
| Building setup approval | #215 | Own wizard transition | Consume canonical provisioned result | Preserve core approval semantics |
| Resources/topology | Shared dependency, no implementation owner selected here | Supply specialized registry/state | Supply resource requirements in #217 | One prerequisite PR, not parallel registries |
| Financial/evidence/event changes | Existing shared engines | Domain source references | Domain source references | One owning change per shared contract |

The current #216 adapter supports workspace/property/building/unit targets only. It does not implement resource grants or explicit workspace mutation contexts. SERVICE must not represent a general resource as a fabricated physical subject or use a broader role to bypass unsupported scope.
Current AIRPROP opportunity writes still require a bound physical subject. The workspace-native -02 contract and SERVICE resource authority must be implemented through one compatible shared core extension.

## Semantic alignment with SERVICE
- Both designs reuse canonical workspace, parties, documents, finance, technical work orders and the existing outbox.
- Both preserve separate requester, commercial counterparty, payer, provider, executor and reviewer identities.
- Both require current authorization before an idempotent result and reject altered payloads.
- Both deny ambiguous bindings and prevent implicit scope expansion after ancestry/binding changes.
- Both distinguish technical completion from acceptance and financial settlement.
- SERVICE requires a limited draining path after module suspension for open obligations. #216 currently denies ordinary AIRPROP reads/writes when the module is inactive. A future draining contract must define narrowly authorized actions centrally; neither domain may bypass module gates ad hoc.
- Commercial arrangements, SERVICE conditions and platform taxonomy remain distinct versioned concepts.
- A business mandate does not automatically create software delegation or payment authority.
- #217's resource references remain design proposals; no shared instance registry is claimed as delivered.

## Integration order and release gates
1. Review architecture contracts #213/#217 together. Their documents can integrate independently, but their shared gaps must remain explicit.
2. Integrate #214 before #216; update the #216 base to main after the prerequisite lands, preserving its incremental changes and rerunning affected checks on the resulting head.
3. #215 has separate changed files, but building provisioning touches workspace semantics. Verify its behavior against the final shared core after integration; exact-path separation is insufficient.
4. Before a workspace/resource core implementation, name one owning PR and record exact APIs, migrations and consumers. Preserve existing resolver callers through a versioned contract or explicitly verified compatible extension.
5. Before customer rollout of persisted opportunity identity, inventory unresolved historical records and implement authorized, evidence-backed resolution. The planner never applies a mapping.
6. Rerun scope, command/RLS, local-role/delegation, provisioning and new resource/workspace tests against the integrated chain. Add real concurrency tests where capacity, ancestry, rights or resolution can conflict.
7. Production migration parity, deployment and customer data changes remain separate authorized integration actions.

## Validation checkpoint
At #216 commit a5a3e88d6e3975870bfc736ca0feff9e7596027a, both Database tests (run 37117672452) and AIRPROP scope regression (run 37117672371) succeeded. The SQL slice has 182 focused pgTAP assertions; legacy review planner has 20 standalone checks. This is branch validation, not an integrated-three-domain or production certification.

## Update rule
Refresh open PR metadata/files and main SHA before every shared-core mutation or integration. A snapshot becomes stale as branches change. Do not edit another work's branch to force alignment; make shared changes in the owning PR and record consumer dependencies.
No merge, deployment, production read/export or data mutation occurred for this checkpoint.
