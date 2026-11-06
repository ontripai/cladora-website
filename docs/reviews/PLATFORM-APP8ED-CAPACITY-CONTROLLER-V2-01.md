# PLATFORM-APP8ED-CAPACITY-CONTROLLER-V2-01

Source-only delivery for Task17/08/09. Local scoped review and offline tests pass; independent review and native execution remain OPEN. No build/start/stop/activation, backend operation, browser, SQL, Auth, fixture provisioning, CI or deployment was run for this task.

Tool base/direct parent: `8edca9d64b78f1eea0a6f402a6dd0c522bdcd4ea`. Final tool commit/tree are in the external delivery manifest. The tool commit is not the replacement App version.

App198 `198e8a35dc120b554468074dd689793addb54385` transitions through the real source chain `198 -> 445fcdcccf72f2038ed7abe7c96336864058cfe2 -> 8edca9d64b78f1eea0a6f402a6dd0c522bdcd4ea`. The replacement App remains exactly8ed; its tree is `ad31eebe4463921df63bda6617aa2fb30f623bde`. Installed Core remains `ee883b62cf4a318af3450c506931a969623b8987`; transport remains the original B696. An App97 source, wrong tree, wrong launcher or arbitrary descendant is rejected.

V1 source/receipts are preserved. The historical V1 controller SHA256 remains `65e15cf25c774b5562397d31f20f04ffc2e3d53fc7b240a2eb049fafb1c5f024`. It is referenced, not copied into this packet. V2 uses a new source seal; no V1 hash or private budget/receipt was rewritten.

## Implementation and checks

- `controller.py`: strict request/parser/budget/source/lineage checks and fixed transition state machine. Valid budget alone cannot authorize execution.
- `host.py`: fixed native Linux implementation using the existing official launcher/admission preflight; private Coordinator registry, one-use claim, currentness, source/process/build checks, sampled capacity guard, pidfd old-App signal, new-group custody, exact listener/static-build ACK and bounded cleanup.
- `contract.md`: authority trust boundary, source/runtime identity separation, first-error/UNKNOWN behavior, cleanup and the budget's sampling/peak limitations.
- `request.template.json`: inactive template with unknown run/tool/PID/admission/runtime values NULL.
- `registry.template.json`: EMPTY; not installed or activated.
- `test_controller.py`: synthetic host and pure native-host guard tests. Real process/network/signal/private-read calls are trapped.

Commands actually run:

```text
python3 -I -B tests/platform17-app8ed-capacity-v2/test_controller.py
python3 -I -B scripts/platform17-app8ed-capacity-v2/host.py inspect-source
```

Python3.12.14; **49 tests PASS**. AST syntax checks PASS. Per-test native-effect trap attempts: **zero**. Source inspection validates the new seal and reports runtime=NOT_RUN. No previous product/backend/browser suite was repeated.

The tests cover exact/lower/invalid budgets; unknown inputs/CLI; hash, launcher, seal, target and source mismatch; the indirect parent chain; legacy App97; unavailable/changing capacity; recycled PID and post-wait drift; early capacity stop without old-App/Backend mutation; failed build; expiry before later effects; unknown start or PID persistence; one-use claim; cleanup/final-persistence failure preserving the first error; protected group checks; registry expiry/equality boundary and strict binding. An initial offline clock model conflated monotonic deadline and wall-clock expiry; those clocks were separated before the final test result. No native attempt occurred during that test correction.

App198 is not stopped until build PASS and repeated exact checks. Unknown start is never retried or converted to no-child. Known returned/possible child custody survives PID-receipt failure. Cleanup may remain UNKNOWN with Platform follow-up; final persistence failure cannot turn the outcome into PASS. Old-App stop has its own attempted/ACK status and no automatic rollback/restart is claimed.

## Review and later execution gates

Coordinator must independently review and pin the final tool commit/tree/seal, then separately bind/accept a real private request, owner decision and out-of-band registry entry. Runtime target/process/admission values must come from actual evidence. The current NULL template and EMPTY registry are not execution inputs. Native PIDFD/permission/listener/monitor/cleanup behavior is NOT_RUN_NOT_PASS; synthetic tests are not a native proof.

The contract's external registry is a trusted Coordinator/operator boundary, not a cryptographic owner-attestation system. A caller-supplied flag or decision hash alone cannot create its entry. The controller has no registry activation/edit command.

The incremental Git bundle requires the exact accepted source-base commit. Verify/import it in a repository that has that base, then inspect the tool in a separate detached worktree. Do not check the App out at the tool HEAD. The public source packet contains no actual admission, target PID/CID, session, credential, rejected capacity report, private trace or raw backend metadata.
