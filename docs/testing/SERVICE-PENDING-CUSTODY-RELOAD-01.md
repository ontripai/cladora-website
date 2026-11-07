# SERVICE pending command custody across a tab reload

The actual Platform run reported successful scope denial/logout and one effect
for an exact-wire retry, followed by loss of UI custody on reload. The prior scenario is historical evidence; this change does not infer its lost
key from history, reconstruct it, or send it again. Private
runtime evidence remains outside the source repository.

## Product behavior

Only the explicitly selected owned SERVICE assembly uses this recovery path.
Ordinary profiles retain their existing behavior. A bounded, versioned pair of
sessionStorage records is saved and read back **before** the first POST. It
holds the original endpoint/protocol/wire, opaque owner label, and the selected
context/workspace and an opaque fingerprint of the current membership/tenant.
Raw membership/tenant IDs remain internal discovery inputs, outside rendered
values, child props and recovery storage. WebCrypto SHA256 detects changed content;
it is an integrity check, not an authorization signature. The separate marker
prevents a partial write or deletion of one record from becoming an empty slot.
There is one unresolved command slot per tab, no expiry/purge/cancel or automatic
resend. A different body/key cannot replace it.

After a reload, the current server owner and current canonical selections must
be obtained before local recovery is exposed. The user explicitly resumes the
pending request; this restores the original fields and locks the workspace
selector. No POST occurs during loading, discovery or resume. Explicit retry
sends the exact saved wire with the same key. A409 after UNKNOWN and GET history,
even history showing the same Request, do not clear custody. A valid result of
that exact retry clears only the matching record and marker. The existing
first-dispatch409 behavior remains definitive; its explicit refresh may release
custody using that observed rejection, not the GET as settlement evidence.

Storage denial, quota, readback mismatch, invalid schema/checksum, missing
journal/marker, scope drift and foreign owner fail closed without new dispatch.
The records are retained for investigation, not silently replaced. A new
account or session cannot see the previous saved description through recovery
or replay it. An unavailable original membership is not replaced with another
selection. Late owner responses are fenced by mount generation and abort state.

## Server continuity boundary

The uncached private-profile GET `/api/customer/v1/services/command-custody`
uses the existing official request Auth adapter and Core verification. Its
only data is an opaque SHA256 continuity label derived from the actual verified
actor/session, Auth origin and private binding identity. Raw actor/session IDs,
JWTs, cookies, credentials, role metadata and database access are not supplied
to browser storage. No user_metadata claims are authorization inputs.

The UI rechecks the label before each dispatch and release. Its POST also carries
`x-cladora-service-custody`. When present, a mismatching or malformed hint is
rejected before binding/business dispatch; this fences a cookie/account change
between a browser check and POST. The label is not a bearer credential or an
allow: all original canonical Core/session/current-authority/transaction checks
still run. Clients without the optional hint keep the original request contract.
No Core source, SQL, ACL, install, role, fixture or package change is needed.

## Boundaries and verification

This is same-tab sessionStorage recovery with the same still-valid server
session/target and a current matching membership. It does not claim recovery
after all browser storage is erased, a tab is destroyed, a different session
signs in, or a record from the old nonpersistent implementation has already
been lost. An unresolved foreign-session record is quarantined, not adopted
by a fresh login. The local record is not a commit receipt or durable server
ledger. Canonical database persistence and receipts remain Core-owned.

```sh
node scripts/test-service-pending-custody-reload-01.mjs
node scripts/test-service-custody-owner-boundary-01.mjs
node scripts/test-service-custody-storage-01.mjs
```

The mounted real-component tests cover a full unmount/remount, explicit resume,
exact retry, modeled one-effect,409/GET, malformed reply, quota/partial write,
checksum corruption, account drift, membership change, FA/EN/RO and late owner
responses. Server route/binding tests use controlled Auth/Core dependencies;
storage tests use actual WebCrypto and controlled local storage. None is a
native browser/Auth/PG proof. Existing SERVICE journey and shell tests retain
their assertions; their transport fixtures now provide the new controlled
owner endpoint and wait for actual command/UI settlement rather than a fixed
sleep. The original source fails the pre-dispatch persistence counterexample.

Native acceptance requires the exact new build on the existing owned Platform
backend, a fresh bounded synthetic intent, independently observed commit with
only its real reply withheld, reload, explicit resume and exact-key retry, one
canonical effect, and trace/browser cleanup evidence. Do not fabricate recovery
for the historical Request or repeat the already successful restart scenario.
