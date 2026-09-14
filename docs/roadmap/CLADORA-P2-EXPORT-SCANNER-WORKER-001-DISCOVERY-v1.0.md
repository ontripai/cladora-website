# CLADORA-P2-EXPORT-SCANNER-WORKER-001 — Discovery and Acceptance

## Verdict

`READY-FOR-DRAFT-PR` — the worker reuses Migration 96 without schema or remote changes.

## Discovery

- Migration 96 already owns durable enqueue, atomic `SKIP LOCKED` claim, bounded lease, retry, dead-letter and completion gateways.
- The private `export-artifact-vault` object must exist before claim; customers cannot read or mutate the queue.
- Migration 92 remains the canonical hash-bound attestation and download-release gate.
- A public worker route, live provider, credential and new migration are unnecessary for this mock acceptance.

## Implementation boundary

- `runExportScannerWorkerOnce` is Node-only (`node:crypto`/`Buffer`, under `src/lib/server`) and accepts injected queue, object-store and scanner ports.
- It validates provider, bucket, object path, size, SHA-256 and attestation binding before completion.
- Failures are reduced to deterministic safe codes before the Migration 96 retry gateway is called.
- Ambiguous completion transport errors are never converted into failure writes; they rely on Migration 96's idempotent completion replay.
- The mock scanner and in-memory queue are synthetic test fixtures only; they cannot process customer data or run automatically in Production.

## Acceptance evidence

- idle queue is a deterministic no-op;
- clean, malicious and scanner-error verdicts complete through one attestation path;
- object mismatch produces zero completion writes;
- transient scanner failure retries and reaches dead-letter at the attempt ceiling;
- exhausted work is not reclaimed by the fixture;
- existing RO/EN/FA pending, clean, quarantined and failed status copy remains present;
- no service-role secret, environment variable, public endpoint, provider call or new migration is introduced.

## Deferred production activation

`DEFERRED-EXPORT-SCANNER-PROVIDER-ACTIVATION` remains open. A later, separately authorized package must select the provider, provision credentials, bind a production queue/storage adapter, add scheduling and prove signed clean-download evidence.
