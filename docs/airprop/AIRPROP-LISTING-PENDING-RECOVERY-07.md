# AIRPROP Listing pending recovery 07

Base: 4b8d1e9e305f44268688197246d34ac65d972b40; existing branch
codex/program-airprop-listing-flow-02. Existing WIP continued without reset.
This bounded recovery work is reused by AIRPROP-LISTING-NATIVE-01, not a separate
ledger, idempotency engine, readiness project or completed native flow.

## Bounded counterexample and change

On exact Base, a mounted actual Listing component with controlled transport:
POST -> lost reply -> original journal removed -> explicit Retry recreates the
missing journal and dispatches a second POST. Observed counts1->2; original wire
unchanged. This establishes a local custody gap, not a server authorization bypass
or a real duplicate database effect. Baseline record has version1 and no embedded
owner/endpoint. No historical accepted sizing case was replayed.

After correction: same counterexample remains at1POST; missing custody is not
recreated. A record cannot be overwritten/removed on a late result unless the full
current stored bytes, owner and original wire still agree with captured custody.
Storage failure blocks sending, never provides synthetic durability/commit proof.

The SAME existing storage key namespace is retained:
cladora.airprop-listing.v1:<membership>:<Context>:<Workspace>.
Only its record schema is extended to recovery_version2: uncertain/blocked state,
owner(actor_id,membership_id,context_id,workspace_id), fixed endpoint, POST and
ORIGINAL wire. Selection/key/body remain inside that unchanged wire. No token,
cookie/session secret/credential/file, auth header or separate draft store is added.

Actor comes only from the x-cladora-listing-actor header on a successful authorized
GET from the existing server API/session. No actor is inferred from persisted data.
The current ContextProvider membership/Context must also match the component.
This header is identity metadata for local custody, NOT command permission or a
receipt. Existing C01/AAL2/full-selection/C03 checks still own server authority.
Missing header leaves independent reading available but sending unavailable.
GET response body contract/version and command endpoint/body/key are unchanged.

Version1 records have no actor witness: retained as unverified, no wire exposed for
retry, no silent upgrade/deletion and no fresh send. Version2 records remain
unverified until current identity is observed; foreign/corrupt/endpoint-tampered
records remain fail-closed in storage. No legacy record is assigned to the current
actor simply because it occupies the current key.

Hydration is independent of GET completion. A hung/denied GET does not clear
UNKNOWN. Higher Listing version does not resolve the command. Exact retry remains
explicit, same wire/key and current-authority dependent. No result producer means
UNKNOWN stays; no new reconciliation endpoint or receipt engine is introduced.
Unmount/identity/context fencing and full-record CAS protect against late receipts.
Original sizing classes remain exactly identical to Base.

## Evidence and reproduction boundaries

`node scripts/test-airprop-listing-pending-recovery-07.mjs`

New targeted actual-component/API/helper tests use JSDOM and existing synthetic
fixture ports, never real Auth/C03/DB. The pre-change counterexample was observed
with this same new script's --counterexample-base mode BEFORE product edits; that
mode is intended for the Base preimage, not a green test on the successor.
Targeted source checks cover custody loss, actor response metadata, missing witness,
exact versioned wire, lost committed reply/remount/higher GET/explicit retry, hung
GET, legacy record, foreign actor/membership/scope/endpoint, quota/corruption, late
receipt and absent producer/revoke. --only selects individual new groups.

TypeScript, scoped ESLint, syntax and diff checks are separate from browser proof.
Existing52/105successes and six closed long-name cases are not rerun. The existing
helper test block is updated only for explicit ownership and unverified legacy.
Available local cache versions are recorded in the report, not relabelled as the
new target toolchain.

`scripts/test-airprop-listing-pending-browser-07.mjs` is a controlled Chromium
follow-up driver. It consumes --assets <compiled local fixture dir> and --out <new
evidence dir>; optional --locales/--only restrict affected cases. It serves only
local in-memory .invalid HTML/bundle/CSS responses and aborts all other requests.
The frozen PROCEDURE Listing host is reused (real Workspace/Listings/ContextProvider
and CSS) with synthetic read/receipt data and the new actor header matching the
actual API response. This is not an authenticated App/Backend or native proof.
Playwright may be selected from an existing installation with
CLADORA_PLAYWRIGHT_MODULE; no downloader/install is built into the driver.
The host/build/fixture and asset hashes are retained in local handoff evidence.

Chromium was attempted after resume under the default tool sandbox. It stopped
BEFORE any case with crashpad setsockopt EPERM/SIGTRAP. Earlier additional-permission
invocations were user-aborted; no success or bypass is inferred. Browser acceptance
is BLOCKED_TOOL/NOT_RUN_NOT_PASS until independently executed by an admitted runner.
The driver is authored and syntax-checked, not declared browser-PASS.

Core15/Platform and native Listing create/edit/withdraw/republish/restart/RLS proof
remain separate. Nothing in this recovery patch activates a producer, changes SQL,
Auth/permissions, creates a picker or touches staging/Production.

Self-automation: نیازمند بررسی. Explicit same-command recovery is a potential
assisted step; human current authority and official producer/receipt remain
required. Exceptions route to AIRPROP/Core; no auto-POST, new key or invented value.
