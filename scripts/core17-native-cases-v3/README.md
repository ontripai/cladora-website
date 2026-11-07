# Core17 / Coordinator206 — native case packet v3 (source-ready)

This packet is executable operator/fixture/probe source, not an execution receipt.
Nothing has been installed, activated or run against the target by this delivery.
The uploaded Platform packet and all 84 member identities were checked; its 53
controls, native successes, historical gaps and consumed claims were NOT rerun.

Pinned inputs:

- source predecessor: `618f93786762223e536aff842daad72a52e44d38`
  (original packet prerequisite `58e7fc112c78fe219d85fab364dbf2fcb486b8c6`);
- active App **reported**, not re-observed here:
  `fd7bc8799ce8aba970bb74e2a9035d4ee41e5119`, parent
  `79e2db9c42c61a217069f8e7412cc17179d720b3`, tree
  `6a660dc056e73dc547d9fd6b12fc0d83eca66ea2`, build
  `AupRkr1rvWViv-w3ffC4f`;
- installed Core: `ee883b62cf4a318af3450c506931a969623b8987`;
- profile `core-service-real-app-assembly.v1`, read ABI
  `core-service-app-read.v1`, origin `http://localhost:3008`;
- Platform ZIP 284974 bytes, SHA256
  `9ba4b31fc335e3bd3f050f7d59bf8ec2f5f7d3d5d922436ffda19f86c65d85b4`;
- REPORT.fa.md 18557 bytes, SHA256
  `98fe7efd0dd28eff165731ac920cf1b051ff7f5af19c4aa847c793f8c72fcdba`.

## Delivery and execution boundary

Only this new scripts directory changes. App source/UI, installed SQL, shared
Core engine/evaluator/host, Auth/provider roles, existing transport/controller,
ACL/RLS and all historical receipts remain unchanged. No historical installer,
currentness/settlement script or accepted suite is executed implicitly.

There is no hot injection into the running FD7 process. The current-process
probe is a separately reviewed **Node --import preload** on the *same* FD7
bundle/build in an independently admitted Platform lifecycle. It observes or
faults the real `pg.Pool` lease in that Next process, not an independent HTTP
handler pretending to be the App. No framework or node_modules file is patched.
The one in-memory Pool.connect decorator delegates all unselected pools/scopes
to their original implementation. It is loaded before Next's application code;
if the actual driver is not reached, native journal/barrier checks fail closed.

**Preserve the currently running FD7 App until Platform/Coordinator admits this
instrumented lifecycle with a fresh claim.** Core does not start/stop/restart it.
Appending this exact private preload to preserved NODE_OPTIONS is an execution
input for the existing Platform lifecycle, not authority from this document and
not permission to reuse an old successful continuation. App bytes/tree/build
stay FD7; record the extra probe/wrapper/config hashes as additional provenance.
For B-only and non-probe authority cases, use the existing FD7 listener; no probe
restart is needed. `requires_probe` explicitly identifies the cases that need it.

## Existing producers and minimum prerequisites

- canonical ordinary-installer credential binding **generation v3 only**, via
  `loadInstallerCredentialBindingV1`; original prerequisite/session-bootstrap
  receipt identities, target and private custody are validated before PG;
- current existing synthetic AAL2 session, verified with official Auth, never an
  actor/allow from request metadata. No user creation, MFA enrollment or automatic
  session refresh/renewal is supplied;
- installed C01/C03/S01 + SERVICE registry/store/runtime already present on the
  accepted owned backend. No migration replay, Maintenance, Building or Storage
  prerequisite is introduced;
- ordinary installer observer must really own/select the four effect relations,
  with no FORCE-RLS-hidden observer rows. The code checks metadata and refuses
  unproven visibility; it never grants itself SELECT/BYPASSRLS;
- PG17; `pg_xact_status(xid8)` EXECUTE must actually exist for C05. Missing right
  is a named preflight failure, never a GRANT or inferred postgres privilege;
- retained Platform `platform17.listen-observation.v1` record and static-manifest
  nonce handshake; no fabricated process receipt, PID-only assertion or new
  listener controller. The probe PID/start ticks must be the actual listening
  Next process for probe cases.

Private request fields are validated in `contract.mjs`. Coordinator supplies the
exact operator FullSHA, actual roots, listener-observation path, session-file
identity, actor ID, an explicitly selected existing synthetic publisher ID, and full A/B tuples/beneficiary. The publisher is distinct from the creator/submitter per the real revision CHECK constraint (20261003200211, line61), and must exist in Auth before any fixture write. It is administrative fixture publication metadata, never proof of that user’s publication authority. It is not selection B: A/B stay the same actor. No Auth user is created. No secret value is requested
or published. Installed private runtime binding and exact v3 installer binding
are selected explicitly; v2 paths/generation, fallback or path search are rejected.
The request contains a pinned random-ID plan, case allowlist and exact effect
budget; this allowlist authorizes test operations only, never business authority.

Coordinator review added two pre-dispatch gates. A selected query is never sent
after its journal is known to have failed; rollback may still be attempted but
missing evidence is not promoted to an ACK. Before any business POST on the
instrumented lane, the baseline must include a matched current-App scoped read
with an actual same-PID ROLLBACK/I in the probe journal. HTTP200 and a loaded
preload alone do not prove interception of Next's actual driver. Six new
controlled regressions cover these boundaries; the suite now has54 groups.

## Cases, source oracle, settlement and recovery

All assertions are in real operator code. Failed preconditions stop rather than
SKIP. Scopes are fresh dedicated synthetic data except B, which is the real
same-actor B selection. Fresh UUIDs identify fixtures; they do not prove expiry
or staleness. Genesis uses existing registry/taxonomy and canonical S01 writer;
it is administrative synthetic setup, not G2 onboarding/publication proof.

| Case / matrix | Prestate and operation | Required result / recovery |
| --- | --- | --- |
| stale / A05 | valid published non-reservation Offering + S01 v1; canonical `append_version` produces real v2 | v1 read withheld, real SERVICE POST rejected; zero Request/C03/audit/outbox delta. Keep immutable v2, do not rewrite history |
| revoke / A06+C07 | commit an original real command; revoke exact dedicated membership after valid render/preflight | real read denied; same original wire/key POST denied; canonical original receipt unchanged, only original effect retained. Restore only that active preimage |
| expiry-wait / A07+C07 | commit original; set exact Context end with DB clock +4s, B locks that S01 head, A really waits | observe physical blocker and DB `clock_timestamp()>=ends_at`, release; real denial and exact old-wire retry denied; restore exact ends_at preimage. Source/model covers equality logic; do not claim hitting the exact microsecond natively |
| current-authority-wait / A06+C07 | commit original; B starts exact membership revoke and holds its writer transaction before A's checkpoint | actual A→B wait, B COMMIT/I, A denied/40001, old-wire retry denied. Restore exact field; retain canonical epoch increments |
| same-key / C02 | controller holds actual canonical idempotency advisory key; two actual current-App transactions enter that key wait | all-ready two backend PIDs + wait graph + exact key labels; release controller. One stored effect/receipt, same ID on successful responses. Nonresolved response requires explicit same-wire recovery, never automatic resend |
| different-key / C04 | controller holds both actual key locks in ONE transaction for two current-App Requests on same Offering/version | two main-command leases physically wait; release together. Two independent Requests, one effect/key. No reservation/capacity resource exists: do NOT manufacture a409 winner/loser. Native serialization remains native bounded host behavior |
| precommit-atomicity / C08 | four real effects are staged in current-App transaction; exact final receipt-update hook runs real `select 1/$1::integer` with0 | actual22012, denied result, same-PID ROLLBACK/I, scoped four-family delta0. No ACL/trigger/shared-outbox change |
| precommit-disconnect / C05 | same real staged point; record actual `txid_current` + backend PID and end ONLY that lease before COMMIT | no success; fresh exact XID must be `pg_xact_status='aborted'`, scoped delta0. Socket loss has NO invented ROLLBACK ACK; absent/unknown terminal status remains UNKNOWN |
| core503 / U02 | current-App exact command really COMMITs; probe records COMMIT/I then withholds driver ACK by a controlled error | actual SERVICE POST503/READBACK_REQUIRED, one canonical receipt and four-family effect, no auto resend. This is controlled driver ACK loss on real PG, NOT native network failure or fabricated HTTP/browser response |
| B-populated / A09 | real same-actor A/B from live assembly-bootstrap, B catalog empty and requests200/can_request=true, exact allowed B beneficiary | only new B Offering/provider/S01/revision metadata, canonical schema and non-reservation workspace coverage. No permission copied from A, no Request/command/receipt seed. B remains draft-ready with zero business POSTs |

For every case, actual owner/runtime target and ordinary-role attributes are
checked. Command/receipt/audit/outbox are observed by exact tenant/workspace,
key and referenced IDs. No global table snapshot is used. Same-PID protocol tags
are tied to the current transaction cursor; an earlier COMMIT tag cannot satisfy
a later attempt. TCP close/cancel is never treated as definite rollback. Timeout,
missing wire/PID/XID, capture or cleanup failure => STOP/UNKNOWN, not retry.

The two-session group is at the existing C03 **pre-write idempotency barrier**.
Same-key guards intentionally prevent two commands from both reaching COMMIT
simultaneously. `Promise.all` alone is not evidence; both actual physical
transactions and their pending canonical lock queries must be observed. If group
readiness fails, the scoped probe halt is persisted before releasing the barrier;
rollback is not claimed for a command that already independently committed.

Revoke-after-held-barrier is not invented: a competing writer can itself wait
behind authority/session row locks. The writer-first case above proves the
relevant ordering; clock expiry is independently checked after a real wait.
Global canonical epoch values are never reset to a historical revision.

## A09 exact consumer handoff

B is NOT the second actor or A03's unauthorized tuple. The operator fetches real
`/api/customer/v1/services/assembly-bootstrap`, checks `core-service-app-read.v1`,
and matches **all four** context/workspace/membership/tenant fields for A and B
under the same verified actor. Missing, ambiguous or mixed tuples STOP. B's real
catalog/requests must both200; missing can_request/beneficiary STOP without adding
an allow. Only the published Offering/S01 fixture is added in this existing B.

`B-populated` emits private handoff tuple, Offering/revision/beneficiary,
`resource=null` and a draft sentinel. Platform reuses its actual-response/actual-
parsed-JSON hold implementation for the new populated variant: fill B draft
without dispatch, release actual delayed A result, verify B selection/draft stays
and A content/authority does not return. Keep server business POST count0 and
scoped new effects0. Do NOT clear storage or bypass pending/UNKNOWN to enable a
switch. If an old unresolved command prevents switching, retain its safe hold;
A09 remains blocked until its existing authorized reconciliation succeeds.
The already observed empty-B variant is retained, not relabeled or rerun as proof
of this populated variant. Browser A09 execution is Platform's remaining206 work.

## Local dry-run and new checks (executed, no target)

```sh
node scripts/core17-native-cases-v3/cli.mjs example-request > /tmp/core17.synthetic.request.json
node scripts/core17-native-cases-v3/cli.mjs dry-run /tmp/core17.synthetic.request.json
node scripts/core17-native-cases-v3/test.mjs
node scripts/core17-native-cases-v3/check.mjs
```

The example has synthetic paths/IDs and an intentionally nonmatching operator
SHA; it cannot pass execution source/target guards. Dry-run reads no credential,
constructs no PG/Auth client and performs no SQL. New checks are controlled
protocol/driver/fixture models executing the actual new code, not native proof.
No SQL parser/compile, live preflight, Auth, fixture, fault or activation was run.

## One reviewed execution recipe for Platform (NOT executed)

1. Review this packet, source seal and exact effect budget within206. Retain FD7
   source/tree/build, installed EE and old records. Fill a new private request
   from observed identities (not the synthetic example). Pin its exact bytes/hash.
2. `prepare-hook REQUEST SHA256` validates source and existing v3 private custody,
   then exclusively writes local request/config/preload metadata. It does not
   connect, install, create users or operate App. Keep these files private.
3. If `requires_probe=true`, Platform must admit a fresh **same-FD7-build** process
   start in its existing lifecycle, retaining existing proxy/CA/guard and listen-
   observer preloads and appending the exact generated `--import` file. Do not
   rebuild/rewrite App source, reuse consumed claims or assume an old PID proves
   this process. No Core controller or automatic restart is supplied. If only B
   or non-probe cases are selected, keep the existing App/PID and do not load the
   probe. Hook readiness alone is not listener or Auth readiness.
4. `bind-listener REQUEST SHA256` uses Platform's existing actual listen record,
   current PID/start ticks and static-manifest nonce response; privately records
   that binding. This is observation, not activation or business authority.
5. Only after execution approval: `execute REQUEST SHA256`. One exclusive claim,
   exact v3/PG17/observer visibility, real session, per-case prestate, fixture ACK,
   current App HTTP/canonical scopes, physical barriers/faults and scoped oracles.
   The complete selection proposes **14 business POSTs / at most7 new Requests**;
   these are NEW review budget inputs, not remaining permission inferred from
   Platform's earlier9 POSTs/4 effects. Subsets have exactly calculated caps.
6. On failure/UNKNOWN, no repeated execute or new key. Preserve the request,
   snapshots, original wire hashes, pending outcomes, Node/backend/XID journal,
   first error and cleanup error separately. `recover-readonly REQUEST SHA256`
   uses ordinary-owner exact-target READ ONLY + final ROLLBACK to inspect only
   those run rows/keys, even when the original Auth session has expired. It does
   not clear UNKNOWN, authorize replay, repair or purge. Explicit same-wire replay
   remains the existing C03 current-authority contract, never a new retry engine.
7. Transient membership/end fields restore only against exact known preimages and
   confirmed settlement; unknown COMMIT is not undone by cleanup ROLLBACK. Retain
   synthetic fixture/receipt data for review. No new retention/TTL/purge/cancel
   policy is introduced. Probe retirement/removal is a reviewed Platform lifecycle
   action after settled cases, not a hot patch or automatic restart by this tool.

## Effects, open gates and ownership

Source-only deliverable. Core owns these scripts/probe/fixture recipes; SERVICE
owns unchanged runtime/read-failure/public DTO contracts; Platform owns actual
FD7 process/transport/registry/claims and native execution; Coordinator reviews
and pins the request/budget. New fixture scopes naturally increment the canonical
authority epoch, so native execution needs an isolated scheduled synthetic lane.
It does not reset epoch, change auth.users/sessions/provider roles or alter any
public/caller grant. B's existing role/permission relationships are not modified.

Open native gates: exact approved process/preload/listen binding, observed v3
privileges/RLS visibility and XID-status capability, fresh existing synthetic
session/tuples, real case results, and the populated-B browser race. Unknown
metadata/permissions, driver not reached or unsuccessful source/target binding
remain STOP/NOT_RUN, not assumed PASS. No installer readiness, release acceptance,
all-domain currentness, real outage, Storage or reservation claim is made.

Automation: نیازمند بررسی — source/hash/shape/custody, bounded journal/terminal
comparison and scoped oracles are mechanical; Coordinator/Platform still decide
exact case budget, process activation and recovery from UNKNOWN.
