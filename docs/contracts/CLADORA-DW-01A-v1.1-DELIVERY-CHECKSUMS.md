# CLADORA DW-01A v1.1 delivery reconciliation

Source: current working tree. No database execution, migration, endpoint or deployment was performed.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `CLADORA-DW-01A-DATABASE-READER-PROPOSED-v1.1.sql` | `2df4ecb195ccd9cefdb903e39e22bc7f6ab7c410b925d7d0d9d4333d632fd06b` |
| `CLADORA-DW-01A-DATABASE-READER-PGTAP-PROPOSED-v1.1.sql` | `bfdb66340550f8c1e0ef072d11f728b4c5112a74a750c458d87b20b40f613164` |
| `CLADORA-DW-01A-DATABASE-READER-CHANGE-PACKAGE-v1.1.md` | `832e911df95545fc4b58c04eb99c5dd995705170476df3190d446261407b93b7` |
| `CLADORA-DW-01A-WORKSPACE-CAPABILITY-READ-CONTRACT-v1.1.md` | `67438b165055149e783f16cae6adc1d72e7db38618cbd87b790481b9324a4898` |

## Verified difference from the prior delivered SQL files

| Artifact | Prior delivered SHA-256 | v1.1 diff stat | Material changes |
| --- | --- | --- | --- |
| Reader SQL | `95b1758756898a13d924ae5e4532a64bbe56e1ab4b1e5d2ac9f95d55ebdca042` | 49 insertions, 17 deletions | `withheld` is the default; disclosure is derived from existing `workspace.role.read/manage` permissions with deny precedence; contract status requires manage; resource counts become null when withheld. |
| pgTAP SQL | `937e1d53c58f41010dc690c25505bad8ae62e4a16f42d3469b2c8ac32f1fd871` | 91 insertions, 135 deletions | `plan(23)` with exactly 23 TAP assertions; real RPC calls for authorized and limited identities; missing taxonomy, legacy/null-contract, expiry, override, predicate parity, count disclosure, cross-tenant denial and zero-write checks. |

## Direct content checks

- Reader line 23 initializes `v_reference_visibility` to `withheld`.
- Reader lines 42-58 evaluate existing `workspace.role.read` and `workspace.role.manage`, including explicit deny checks.
- Reader lines 168-170 return null counts when aggregate disclosure is not authorized.
- pgTAP line 5 declares `plan(23)`.
- Counting TAP statements in the file returns exactly 23.
- The limited but Workspace-valid identity calls the real RPC and asserts `reference_visibility = withheld`.
- The whole-response leak predicate rejects non-null visible/total counts, contract status, IDs and restriction source references.

## CE-011 patch reconciliation

The Library contains `CE-011-transfer-manifest.txt` and four of the five listed source artifacts, but not the named patch file and not the listed test script. The current Git clone does not contain commit `af075d67d0d986ff43956fe5f412f546b13f79e6`; the remote branch currently points to base `436e7a634020a846da212aa60501f25455d39850`. Therefore the exact format-patch with manifest SHA-256 `443429998bebdf3b2d3bb41e45651d3ddb44473d9c3137b3b81817bc4f9af6fd` cannot be truthfully regenerated from this workspace. No substitute patch is presented as that commit.
