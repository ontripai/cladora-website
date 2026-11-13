# CORE-PR479-SEAL-COMPAT-01 — source successor proposal v1

Base for APP application: 67f17777f342c103e2588410949c0b32a104a37f
Parent: b46965f929497b78d4b4b63685c9405b1fbef6d8
Tree: 2d30c98c29ceb93be2593721be52f4879e3e631a

This is a narrowly scoped CI/source-harness proposal for APP's PR479. Core does
not create a competing aggregate branch, edit product runtime, change old source
seals, or grant execution. The previously completed AIRPROP conflict decision and
its five controls are not repeated.

## Before / precise counterexample

scripts/core17-native-cases-v3/check.mjs:12 reads the working product bytes against
manifest.json's historical FD7 source seal. The retained manifest names runtime
24353 bytes, while PR479's accepted official Core33 runtime is39845 bytes. Four
historical source files advanced and11 transitive dependencies were added (62 old
versus73 current source paths). The old assertion is correct for its historical
FD7 operator, but does not describe the source-only successor review.

Original App is fd7bc8799ce8aba970bb74e2a9035d4ee41e5119, App Tree
6a660dc056e73dc547d9fd6b12fc0d83eca66ea2, Build AupRkr1rvWViv-w3ffC4f,
installed Core ee883b62cf4a318af3450c506931a969623b8987. Original operator/seal
source at bfadc5042cb00841dd605862a2a72ddc0dbafb87 remains an ancestor. Manifest
SHA256 aaf72324eefc8a6dde5e3d10f6ad4cf51c3c8dcdbd3e1c132e15d29db197acae
is unchanged. Its original62 product/18 operator pins, source_parent, case limits,
source_only/native fields, receipts and prior evidence are not replaced or relabelled.

## After / explicit two source domains

1. Historical verification: the new checker authenticates the original manifest
   by its fixed SHA256, authenticates all18 original operator bodies/helpers and
   preserves their current bytes. It runs the ORIGINAL validate(x) body, without
   deleting assertions, against Git-backed historical sources (FD7 products and
   bfadc operator). The original static source census executes against those same
   original bytes. Exact operator filenames and old case/limit/denial assertions
   remain checked. The existing historical check.mjs is unchanged and is not made
   to accept a newer runtime as FD7 evidence.
2. Current source successor: source-successor.json is a separate, hash-bound
   version record for exactly Head67f17777f342c103e2588410949c0b32a104a37f. All73
   product dependency paths, byte counts, SHA256 and Git blobs must match BOTH
   that reviewed Git source and current source. Unexpected imported dependency,
   tampered source, changed original operator or resealed historical manifest
   fails closed. Profile/head/native relabel cannot silently extend the version.
3. Execution remains separate: operator.sourceGate still requires EXACT_FD7_TREE,
   FD7_APP_MUST_STAY_FIXED, original product pins and FD7_RUNTIME_COMPATIBILITY.
   This proposal does not change operator/hook/contract/check/manifest/fixture or
   any current product file. The source-successor result always says
   native_execution_eligible=false, runtime_activation=null and NOT_RUN_NOT_PASS.
   No current-source validation is a native receipt or permission to execute.

The reviewed closure is Core17's product dependency scope, not all repository UI.
An unrelated UI/doc change is not misrepresented as a change to these73 paths.
The two exact snapshots and every historical/current changed path are recorded.
An update to these73 sources requires a separately reviewed successor profile,
not changing manifest/hash to whatever HEAD happens to contain.

## Paths / delta for APP

- ADD scripts/core17-native-source-successor-v1/check.mjs
- ADD scripts/core17-native-source-successor-v1/test.mjs
- ADD scripts/core17-native-source-successor-v1/source-successor.json
- ADD scripts/core17-native-source-successor-v1/README.md
- MODIFY .github/workflows/core17-native-case-source.yml only: add new harness path
  to its two trigger lists, select the new two-domain source check and its NEW
  negative tests in the source-only step, include the new scripts in existing lint.
  Node22/24 matrix, npm ci, permissions, budgets, controlled tests and dry-run stay.

The old check is retained for historical-exact-context use. No assertion is
commented out, catch-swallowed, filtered, or treated as a current native PASS.
The original54 controlled operator tests were NOT run again for this proposal.

## Applying / checks / recovery

APP reviews the exact patch against Base67f177, then applies it on its existing PR
branch. Core's active branch and HEAD/WIP are unchanged. No reset/rebase/force or
new aggregate branch is required. The supplied patch only has the five paths above.

After source application:

    node scripts/core17-native-source-successor-v1/check.mjs
    node scripts/core17-native-source-successor-v1/test.mjs

The CLI reads the current checkout and Git only. Tests deliberately use the exact
reviewed Git source as their current-file adapter and inject bounded source
corruptions; no credentials, Auth/PG client, SQL, target, build or native process.
A valid Git store must contain the pinned historical and reviewed commits (the
workflow already uses checkout fetch-depth:0). Missing object stops this source
check; no latest-HEAD/fallback source is selected.

Local result on Node v24.19.0: seven focused groups PASS: positive historical+
current identity, historical manifest tamper rejection, same-size runtime tamper
rejection, extra imported source rejection, extra operator rejection, unreviewed
profile/native relabel rejection, and unchanged native execution guard identity.
Limited repository-config lint: zero errors/warnings; syntax PASS. Node22 and
remote GitHub Actions were NOT_RUN here; no statement that all PR479 CI is green.
Full build/typecheck and healthy Core/AIRPROP suites were NOT repeated.

Rollback of this source-only proposal means revert just these five paths in APP's
source review. No business data/receipt/pin is modified or deleted; no DB recovery
is performed. Old operator native execution against the newer App remains
ineligible until separately reviewed/implemented and admitted; this patch does not
supply such a rebind.

Automation: نیازمند بررسی — exact source identity/version/census validation is
mechanical; APP/Coordinator/QA approve the successor and Platform admits execution.
