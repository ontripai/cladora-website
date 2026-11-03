# OPS-POPULATED-TRANSITION-01A

Status: **INACTIVE_ADDITIVE_PROPOSAL_BLOCKED / TARGET_MATCH_NOT_PROVEN**.
Base `1afe40aedbfc44855ccea676fb92fd4e6ec61e83`; target exclusively
`cladora-staging / ryygcqiunqqtfkpkflzf`. This package contains no SQL executor,
DDL payload, activation, credentials, catalog dump, or previously rejected
private Operations artifact. No runtime acceptance is claimed.

## Reproducible offline interface

```
python3 scripts/review-ops-populated-transition-01a/test.py
python3 scripts/review-ops-populated-transition-01a/map.py \
  scripts/review-ops-populated-transition-01a/proposal.json \
  PRIVATE_CATALOG.json PRIVATE_REVIEWED_REFERENCE.json
```

Python standard library only. Exit 1 means BLOCKED. Missing private input fails
closed. Tests create synthetic inputs in memory; they never claim that those
inputs describe staging. The positive synthetic result cannot authorize execution.
A non-synthetic match is still SOURCE_CONFORMANCE_ONLY_RUNTIME_HOLD.

`proposal.json` pins the accepted300 **native** Maintenance installer, its official
delivery and seven exact byte spans (zero-based offsets, UTF-8 bytes). The accepted
materialization was inspected read-only; 276/286/300 were not reconstructed or
retested. SQL bodies and send-images are not embedded. Source equality is separate
from compiled catalog equivalence. The 13 direct routine families and 12 direct
relation references are a bounded census, **not** transitive closure or compile
proof. No full 1322-effect/47-pin recount was performed.

`PRIVATE_CATALOG.json` has format OPS_TARGET_CATALOG_01A, project_ref,
server_version_num (integer PG17), truncated=false, complete_sections covering
exactly the proposal's nine sections, objects, principal, role_edges,
lineage_sha256, default_acl_sha256 and protected_sha256.
Objects have a qualified id (routine full signature; trigger relation#name), kind,
owner, definition_sha256, acl, effective_acl, dependencies, and all applicable
security/search_path and catalog fields. Reference projection must cover columns,
constraints/FK actions, index expressions, policy predicates, generated/type edges
and relation-scoped triggers where reachable. Each affected catalog object must
carry in_affected_boundary=true; unmarked objects are explicitly outside the
reference boundary, not proof of absence. A private producer must establish this
partition from the complete catalog census; this mapper cannot discover hidden
objects from an incomplete JSON list.

`PRIVATE_REVIEWED_REFERENCE.json` has format OPS_REVIEWED_REFERENCE_01A,
project_ref, proposal_sha256 (sorted compact JSON SHA256), source_native_sha256,
reference_kind=reviewed_pg17_catalog_projection, transitive_closure_reviewed=true,
lineage_sha256, dependencies with the same full object projections,
direct_family_to_signature (exact overload resolution), affected_boundary equal
to dependencies plus seven additions, default_acl_sha256, protected_sha256,
approved_incremental_principal, preserved_role_edges and
nested_invoker_execution_path_reviewed=true. Membership rows must include role,
member, **grantor**, ADMIN/INHERIT/SET; effective ACL rows must include inherited
rights, PUBLIC and grant options. Canonical identity hash includes every field;
ACL/dependency list order is neutral. Full row/field projection and reference
provenance require independent review; self-supplied booleans are **not** an
attestation, and this program authenticates neither the issuer nor the snapshot.
No MD5-to-source-SHA equivalence or self-authored candidate oracle is asserted.

## First incremental proposal (not authorized DDL)

1. Acquire a separately approved bounded installation window and lock; refresh
   private metadata and compare the exact reviewed prestate. Preserve user data,
   pending C03 commands, managed Auth, existing role edges/default ACLs. A mismatch,
   unknown lineage or namespace/signature collision stops before DDL.
2. Require all 13 direct callee families resolved to exact signatures and the 12
   relations matched, with separately reviewed transitive routine/type/constraint/
   policy/trigger/index/sequence dependencies. Never run the fresh installer over
   populated schemas and never mark unexecuted history applied.
3. Proposed order: checkpoint, private command, public facade, unresolved guard,
   then the three relation-scoped triggers, using exactly the pinned definitions.
   Four function additions plus three triggers only; no existing owner transfer,
   new ledger/role, extension or managed Auth mutation. Any pre-existing same-name
   routine overload/trigger is a conflict needing review, not an overwrite.
4. Each new function's PUBLIC/anon/authenticated/service_role EXECUTE must be
   explicitly revoked in its creation transaction before COMMIT; no default ACL
   change or positive caller grant. Assert the entire created set, exact definitions,
   owners, paths, dependencies, effective ACL and unchanged defaults/protected graph.
   Trigger owner/permissions derive from the relation; do not invent a separate
   trigger owner/ACL. Creation privilege and trigger-function execution must be
   verified for the actual installer principal, not inferred from its name.
5. **Installing triggers is not inert just because RPC EXECUTE is closed.** New
   triggers intercept existing writers. Before installation, census all legacy/
   direct writers, in-flight reservations and their transaction behavior; prove
   compatibility with unresolved C03 guards. The final legacy-mutator REVOKE block
   in native source is NOT silently included: changing existing exposure requires
   a separately reviewed activation/cutover decision. Preserve current 88 exposed
   rights until that decision; preservation alone is not proof they are safe.
6. DDL verification failure before COMMIT rolls back this single additive unit.
   Timeout/cancel/lost COMMIT acknowledgement means UNKNOWN, never blind retry.
   Same-attempt backend completion and fresh read-only identity/residue evidence
   must classify committed/not-committed/unknown before another attempt. No claim
   of rollback of previously committed units. No execution request is authorized.

## Concrete blockers and minimum closure

| ID | Evidence / counterexample | Minimum prerequisite and owner |
|---|---|---|
| MAP01 | Platform05 summary proves missing command ABI, not equivalence of all prerequisites. A missing dependency row or changed effective ACL is rejected by test. | Platform supplies private bounded complete catalog/provenance and Core/SERVICE reviews the PG17 projection, exact overloads, lineage and transitive closure. No new query is executed by this task. |
| ACL01 | Accepted300 Maintenance line4030: customer_api.operations_command_v1(text,uuid,uuid,text,text) is **SECURITY INVOKER**, calling private SECURITY DEFINER command. Native source revokes runtime EXECUTE on both. Granting only facade cannot establish private invocation rights when private schema/function rights are absent. | Core/SERVICE must review effective caller-to-private execution and owner/callee rights. Owner chooses a bounded execution contract if existing rights are insufficient; no assumed private grant, provider-role change or definer rewrite in this proposal. Source-preserving inactive additions remain possible only after other gates. |
| OWN01 | Guard300 expects postgres !SUPERUSER/!BYPASSRLS and one ADMIN/no-INHERIT/no-SET edge; Platform05 reports postgres BYPASSRLS=true and effective SET=true through two edges. | Platform supplies exact current graph/definer-RLS profile; SERVICE reviews target trust compatibility. Keep fresh guard300 unchanged. This additive seven-object scope does NOT execute read_scoped_maintenance_v1 OWNER transfer, so guard300 mismatch and additive privilege feasibility are distinct. No role normalization proposed. |
| CUT01 | New unresolved-command triggers affect existing direct writers; only closed new RPC ACLs do not prove behavioral inactivity. | Core inventories writer admission/current pending state; coordinator approves a bounded install/cutover window and separately reviewed legacy exposure plan. No pending row deletion or fabricated receipt. |

Platform05 evidence: [report6560011089](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6560011089).
It reports PG170011, existing populated application objects, btree_gist1.7 and
pgcrypto1.3, missing v1/v2 command roots, postgres non-superuser/BYPASSRLS,
effective Auth SELECT/REFERENCES but REFERENCES grant-option=false, effective
rpc_owner SET=true, and authenticated customer_api USAGE with 88/453 effective
EXECUTEs and PUBLIC EXECUTE0. These are historical reported facts, not a fresh
observation or full catalog file. Auth grantability is distinct from effective
privilege. No Auth ownership/ACL changes are proposed.

The complete private Platform05 snapshots/receipt are not locally available in
this environment. Therefore no target-to-source mapping is declared MATCH and no
current target absence/privilege is asserted from local file absence. Reference
input and provenance are open prerequisites; no fake complete snapshot is shipped.

## Caller / acceptance boundary

Existing OperationsCommandGate -> contact-independent Operations HTTP route ->
operations-command-server -> customer_api.operations_command_v1(text,uuid,uuid,text,text)
-> private C03 command -> existing mutators. v2/checklist cutover is outside scope.
Actor + original Context/Workspace, AAL2, current session/authority/resource revision,
exact wire/key/fingerprint, dedicated C03 receipt, audit/outbox atomicity, UNKNOWN,
lookup and explicit same-body retry remain unchanged. No current GET replaces a
receipt. Existing S3/S4/G2 and caller exposure are OPEN; source availability is not
activation or backend acceptance.

Future separately authorized lanes must prove open/reserve/execute/lookup/ack,
same-key replay, changed-body conflict, lost acknowledgement, atomic rollback,
cross-Workspace, actor/AAL1/revoked/currentness/resource-revision denial and legacy
writer compatibility on PG17, issued Auth and real HTTP. This package does not
run those tests. Independent snapshot/projection review precedes execution.

## Results and NOT_RUN

New checks: five unittest methods including 30 independent negative mutations;
changed proposals are coherently re-sealed so target invariants, not stale hashes,
reject them. Positive synthetic mapping remains non-executable; missing snapshot,
PUBLIC/inherited grant drift, owner/security/path/edge drift, trigger/name collision,
wrong target/source and partial closure reject. Python syntax and git diff checks
are recorded in the delivery. No previous successful suite rerun.

NOT_RUN: PostgreSQL parse/compile/runtime, SQL/catalog refresh, Docker, staging
install/grant/activation, issued Auth/HTTP, S3/S4/G2, target reconciliation and
backend acceptance. This is a reviewable proposal and bounded mapper, not a proven
permitted installation path.
