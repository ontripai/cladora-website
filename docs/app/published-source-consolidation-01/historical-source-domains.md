# Historical source domains and current published composition

This is offline source verification, not a native admission, activation or a new authority/transaction implementation.

## Post-auth consumer source seal

Actual CI atb2e807eb stopped in `check-core17-post-auth-consumer-adoption.mjs:31`: the old preserved package-lock pin is c0d6201b, while the approved root engine metadata transition produces e490306f. Full inspection found exactly four preserved-source differences: package.json, package-lock.json, functional-command-runtime-v1.ts and postgres-transaction-host-v1.ts. All six original adoption operator bodies and every other protected pin still match.

The original manifest (SHA2564ae178ae), checker and `core17-exact-consumer-admission-v1.mjs` are unchanged. New APP-owned `check-app-core17-adoption-source-v1.mjs` authenticates the original manifest/checker and executes the complete original validate body against exact main6cecfa15b00f445be68817e756d766fb0e6fe026 Git sources. That checkpoint independently matches every manifest source pin.

Current source is then checked separately: all six operator files retain original bytes/hash; all protected files retain original hashes except the four explicit transitions. Both package files must be byte-identical after exactly the approved root engine replacement. Runtime/host must match the exact Core-owned proposal profile (SHA09ad4bdd, reviewed67), including historical before SHA/blob and current after bytes/SHA/blob. No other exception or observed-HEAD pin is accepted. Native eligibility remains false, runtime_binding NULL; the original admission still requires explicit Coordinator identity and original binding.

Local actual-checkout positive and six engine/runtime/operator/protected/native tamper controls PASS. They exercise only new source-composition cases; no Auth/SQL/native or the healthy45 admission cases were replayed locally. Application Foundation now invokes this APP source adapter and its new negatives while retaining all subsequent original admission/security assertions.

### Original admission positive fixtures

Actual3da CI reached the original positive admission test, which copies the working checkout's protected files into its fake consumer. The unchanged real guard correctly rejected current package80947 against installed historical fd82 (`CORE17_INSTALL_OR_AUTHORITY_SOURCE_DRIFT`). That guard remains correct and unchanged; current source compatibility does not authorize adopting the newer App.

APP runner `run-app-core17-historical-admission-check-v1.mjs` preserves the complete original test, manifest and admission code. It verifies the immutable operator files against main6cec, creates a task-owned detached worktree at exactly6cec, and runs the original tests there. Finally it removes that exact temporary worktree. The current candidate is never checked out/reset or granted admission. A separate JSON result explicitly states HISTORICAL_ADMISSION_TESTS_ONLY and current_candidate_admission=NOT_READY_NOT_GRANTED. The current composition check runs independently before this runner.

Local `--check-only` inspection passed source materialization/pin identity and cleanup without replaying the original45 cases. Remote CI's default runner executes those unchanged cases in their historical domain. This changes fixture context, not any native guard or expected success premise.

## AIRPROP B2 protected Core directory

The B2 safety case is affected by the new supplier tree: its old protected file set has13 files; current classification finds45. Running it reproduced that failure. No count, digest, historical hash, original guard function or B2 production assertion was deleted or updated to current observed values.

The complete current Core directory is exactly official Core4b3138f0ff0a27187d23d8a5b058d114ddcad773: tree17e8ba3a78208dfbd2f674158117c8ddd5c7f3ee, all78 file paths and Git blobs match. This is the explicit owner-provided public supplier, not automatically observed HEAD or a directory-wide ours/theirs merge.

APP helper `app-official-core-directory-v1.mjs` first authenticates that complete current source set and rejects additional/missing/symlinked/tampered source. It then calls the unchanged `airprop-b2-safety-guard.mjs` with the unchanged original options and pin literals in a task-owned temporary tree containing exact historical main6cec Core bytes. Original count/digest/reviewed-addition/replacement assertions execute there. The process directory is synchronously restored in finally and only that temporary tree is removed. No repository checkout, index, product source or binding is changed.

B2 migration protection and inactive API/UI assertions continue to inspect the actual candidate unchanged. The result explicitly labels historical Core provenance and separate current official supplier identity; native_execution_eligible=false/runtime=NULL. The affected B2 safety case and current-source positive plus three extra/missing/tamper negatives PASS. No other B2 suite was run locally.

## Immutable inputs

The five Core proposal afterimages remain exact. Both Core17 manifests/checkers, original operator.sourceGate, exact consumer-admission code, AIRPROP B2 guard and all product source bytes remain unchanged. Application Foundation alone gains APP source-check commands and explicit trigger paths for these helpers/tests; existing Node22 CI policy, permissions, budgets and downstream tests remain intact. The approved Core17 workflow retains its original22/24 matrix. Final exact-head CI and independent QA review remain separate from these local source-only receipts.
