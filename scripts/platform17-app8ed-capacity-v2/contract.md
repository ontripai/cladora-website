# platform17.app8ed-capacity-controller.v2

Scope: source candidate for the existing Task17/08/09. This packet does not authorize native build/start/stop. No domain, SQL, Auth, fixture, relay activation, container or restart operation is implemented here. V1 source/seal/receipts remain immutable.

## Independent identities

| Identity | Exact pin |
|---|---|
| Original tool source base | `8edca9d64b78f1eea0a6f402a6dd0c522bdcd4ea` |
| R2 tool direct parent | `9a946f2b4523337927e45ca86ee4456eba31904b` |
| Active App | `198e8a35dc120b554468074dd689793addb54385` / tree `54e792e02ad7b92137b9699b67d5dc346024f23e` |
| App intermediate | `445fcdcccf72f2038ed7abe7c96336864058cfe2` |
| Replacement App | `8edca9d64b78f1eea0a6f402a6dd0c522bdcd4ea` / tree `ad31eebe4463921df63bda6617aa2fb30f623bde` |
| App launcher | SHA256 `cb887091c9045fba6b9eeb5ad2502ca6206006aa220b123d4594de8526828a5d` |
| Installed Core | `ee883b62cf4a318af3450c506931a969623b8987` |
| Original transport | `b696ff211daabd4be3989522c569f24ccccd0dce` |

The tool commit/tree/seal are separate, externally pinned after review. App source never follows tool HEAD. Native observation requires the exact chain `198 -> 445fcdcc -> 8ed`, including the intermediate; `parent(8ed)==198` is intentionally not required. Neither an arbitrary descendant nor App97 is accepted. The R2 tool HEAD must be a direct child of the exact R1 tool9a946f2b; R1 is a direct child of55bad9ff, itself a direct child of8ed. This preserves the delivered history without making tool HEAD the App pin. App and anchor checkouts must be independently clean and match the exact App tuples. The original consumer-admission ABI and original anchor transport preflight are reused; no guard is broadened to any HEAD/descendant.

## Budget and fixed commands

Start floor: **2147483648 bytes**. Protective reserve: **536870912 bytes**. The planning composition is 1073741824 build estimate + 536870912 margin + 536870912 reserve. These are not peak bounds or completion guarantees. The request must contain exactly this approved tuple, integer types and `peak_bound:false`; a lower or otherwise different/unapproved tuple is rejected before host action.

V1 stop semantics are retained: 0.05s polling; early stop at reserve+134217728; urgent escalation at reserve+67108864; 600s build deadline; TERM then bounded KILL only for the newly created, owned session/group. Samples are persisted at 0.25s cadence (or early-stop threshold) and fsynced at 1s cadence. Other filesystem users may change free space. Sampling and early-stop margin are not a hard quota or a guarantee against bursts.

The only native program argv are:

```text
node scripts/run-core-service-app-assembly-17.mjs build
node scripts/run-core-service-app-assembly-17.mjs start
```

The existing official read-only adoption preflight is also called with a fixed Node expression. Its subprocesses inspect the original transport/backend; this controller itself contains no Docker, database, migration, HTTP mutation or business-operation transport. The only direct HTTP check is the exact local static build-manifest GET for startup ACK.

## Authority, request and custody

A budget record, request boolean, nonempty flag, GUC, arbitrary URL, or this source acceptance grants no execution authority. There is no activation command. Delivery includes an EMPTY registry template; it is not installed or populated by the controller or tests.

Future execution requires an independently accepted exact tool commit/tree/seal, a private exact request and a **Coordinator-installed out-of-band authorization entry** at the fixed private registry path named in `host.py`. The same registry grants one exact request digest/run/tool tuple with a nonextendable window no longer than1200s. The owner-decision digest is a reference to the separately approved decision; it is not a cryptographic verifier of owner identity. The trust boundary is the Coordinator/operator-controlled private registry, not caller-supplied request data. The controller has no API to write it. A privileged operator who can edit the controller/registry is outside the untrusted-request boundary. Source review does not attest that this later authorization exists.

The private files/directories must be owned by the executing Seat, 0600/0700, canonical, single-link regular files without symlink/alias. Unknown runtime bindings in the supplied template are NULL and fail validation; no actual admission, PID, credential, target snapshot or decision is fabricated. Tests use explicit synthetic values in memory and never create this private registry.

Currentness and byte identity are rechecked after waits and immediately before build, old-App signal and new start. Equality at expiry rejects. Revocation/expiry halts normal progress; it does not authorize replacement permits or retries. Cleanup of the already owned new child is a separate bounded duty and may continue after authority expiry, without permitting another unit/start.

R1 reads the source seal and request first, then re-reads authority bytes and
samples the current clock last. Expiry or revocation during a blocking seal
read cannot pass the actual Popen or old-App signal boundary. Currentness is
also checked after the final post-start source/build observation and after
retained-record persistence, before returning retained ACK. This closes the
controlled counterexamples found in55bad9ff without changing App pins, budget,
reserve, signal custody, first-error policy or the one-use authority contract.

R2 closes the internal entrypoint composition defect: main and Controller.run
independently parse the same request bytes, producing equal but distinct dicts.
NativeHost.authorize checks the complete validated values and exact raw digest,
validates the original request's current authority, then binds the Controller's
object exactly once. Subsequent currentness checks retain strict object identity;
changed values, changed raw digest, another equal object after binding and a
second authorization are rejected. Tests run the real main/NativeHost/Controller
composition with synthetic I/O, not just a permissive FakeHost authorization.
This does not renew any consumed execution permit; a new pinned R2 attempt
requires a separate Coordinator decision and fresh private run/request/entry.

A fixed private request location is selected by SHA256; no arbitrary request path, SQL, shell, argv, env override or `--exec` is accepted. Claim directory creation is exclusive and durable. Once a valid request has been claimed, failure/UNKNOWN never resets it. Request schema/pins and the initial observations are checked before claim; rejected input causes no build/start/stop/signal/claim effect. Read-only source/process observations are distinguished from application mutation effects.

## Runtime sequence and first-error policy

1. Validate all input fields, budget, static pins and out-of-band authority. Check tool source seal/tree, exact App/anchor sources, original admission, Core-protected files, old PID/start/cwd/argv/build, relay and protected-file hashes. Confirm capacity and inode availability.
2. Acquire a one-use claim. Run the unchanged official consumer adoption preflight. Recheck currentness, identities and capacity **after** preflight and immediately before the one build.
3. Recheck capacity immediately at the Popen boundary; include spawn/PID-metadata wait in the build deadline. Launch one build in its own session/group. Store the Popen handle/custody slot before persisting PID metadata. Monitor shared filesystem capacity and deadline; any error stops progress. Group membership/start/UID/session and protected App/relay groups are checked before signals. App198 and Backend are retained throughout build.
4. Require exit0, no surviving build descendants and exact new build identity. Recheck original App/build/admission/transport, authority and new build hashes after another preflight. Only then signal the exact App198 listener through pidfd, after another full identity/currentness check. A PID change before the signal rejects; pidfd pins the selected process at the signal boundary. No broad user/session/group stop is used for old App.
5. Require old-process end ACK and a free3008 listener slot. Recheck authority/source/build and dispatch **one** official start with the same five selectors. Source/build/old-stop/port and currentness are checked again after intent/log setup at the actual Popen boundary. No startup retry is implemented.
6. ACK requires a listener inside the new start's owned group, exact PID/start/UID/cwd/argv, a matching HTTP200 static build manifest, and identity/source/build rechecks after the HTTP wait. Probe/readiness alone is not start ACK.
7. Keep the new App only after this ACK. Delivery of its process/build evidence is private. No browser, Request, successful prior scenario or restart acceptance is repeated by this tool.

If PID persistence fails after Popen, a returned handle is absent or ACK is lost, `MAY_EXIST`/UNKNOWN is preserved. The Popen/custody slot is retained independently of receipt creation. There is no second start and no claim of `NO_CHILD` based on missing metadata. Cleanup is restricted to the owned newly dispatched build/start group with proven identity. Unprovable custody causes UNKNOWN, Platform ownership and a follow-up deadline of600s; no arbitrary process/resource is terminated to make cleanup look complete.

Cleanup reports ACK, SKIPPED or UNKNOWN truthfully. First operational error remains primary if cleanup or final persistence also fails. A skipped cleanup is not an ACK. If final persistence fails after a verified retained App, state is UNKNOWN_RECEIPT_PERSISTENCE, the known retained child/custody and follow-up remain explicit; it is not reported as no child. Old-App stop may have completed even when the new start fails; no automatic old restart or chain rollback is claimed.

## Seals, package and proof limits

The fixed controller module is compiled from the sealed source bytes; cached Python bytecode is not a load path.

`source-seal.json` contains the six explicit source/contract/template/test files with bytes/SHA256; it excludes itself. Its own SHA256 and the final tool commit/tree are recorded in the external delivery manifest. The Git tree covers the seal. The delivery manifest/bundle hashes are external, so there is no self-hash cycle.

Offline tests exercise the controller and pure native-host guards with a synthetic host. Real Popen, signals, pidfd-open, network and private-file reads are trapped and must have zero attempted calls. Synthetic PASS is not a native monitor/start proof. Host implementations are supplied for review; actual platform PIDFD, socket, permission, filesystem behavior and process cleanup remain native gates. The real accepted request/registry, entrypoint invocation and eventual owner permission are not bundled.

V1 receipts, the rejected capacity report and all real private admission/target/session/trace data are excluded from the public source bundle. Fixed source path constants identify the reviewed boundary; no runtime values are copied from private evidence.

## Operational process record

قابل خودکارسازی: **نیازمند بررسی**. ورودی، pinهای نسخه‌دار و درخواست پذیرفته‌شده است؛ بررسی schema/hash و ترتیب قابل اجرای خودکار است. تصمیم انسانی با Coordinator برای پذیرش source و مالک برای اختیار اجرای دقیق باقی می‌ماند. شرط اجرا registry بیرونی و claim یک‌بارمصرف است؛ UNKNOWN به Platform ارجاع می‌شود. وابستگی رسمی، App8ed و ABI اصلی transport/admission است. ارزش موردانتظار جلوگیری از تعویض App اشتباه و start تکراری است؛ برآورد عددی یا سامانهٔ اتوماسیون تازه‌ای ادعا نمی‌شود.
