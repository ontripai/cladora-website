# CLADORA document vault: ClamAV pilot procedure

This is a **queue-backed, free software scanner** for private Supabase Storage documents. It is not running in production until a trusted host is provisioned and its scheduler is enabled. Until then, new uploads remain `deferred`, unavailable for ordinary signed download and private-message attachment. Keep PR #167 as Draft until a pilot verifies real clean and malicious files and account access.

## Prerequisites

- A trusted worker host with Node.js 22+, the official ClamAV binary and FreshClam configured with a writable signature database. The official Windows installer does not set up `freshclam.conf` automatically. The host must have enough memory for ClamAV and safe temporary disk space. Do not run the worker in the Vercel request process.
- Install dependencies with `npm ci` on the trusted host. Configure `SUPABASE_URL` for the CLADORA project and `SUPABASE_SERVICE_ROLE_KEY` as a host-only secret; never place that key in `NEXT_PUBLIC_` variables, screenshots, issue comments or the browser. Optionally set `CLAMSCAN_PATH` and `FRESHCLAM_PATH` to the absolute executables.
- Apply the migration through the normal production migration gate only after PR review. No production migration is part of this draft. The two scanner RPCs are callable by `service_role` only, and the immutable scan record is private.

## Pilot on synthetic data

1. Run `npm run test:document-scanner` and `npm run test:db:static`; CI also executes pgTAP test `123_document_vault_clamav_attestation.test.sql` against a fresh Postgres database.
2. Create a **synthetic** test document using the normal vault upload flow. Obtain its version UUID from the privileged operations database view; ensure it is `deferred` and its Storage object exists.
3. On the trusted host, run `node scripts/document-clamav-worker.mjs --queue`. It leases one pending version for 15 minutes, updates virus definitions with FreshClam and checks the ClamAV engine version. It then downloads no more than 20 MiB from the private bucket, verifies bytes and SHA-256, scans a random temporary file, and deletes it after scanning. A one-off `<version-uuid>` argument remains available for controlled pilot diagnostics, but routine processing must use the queue.
4. Repeat with a standard synthetic antivirus test fixture approved by your security operator. A positive result must be `quarantined`. Missing/stale signatures, scan limits, errors, incomplete output, hash mismatches and missing objects must leave the version `deferred`. Never set `clean` manually.
5. Confirm a clean result writes one immutable attestation and changes only `scanning_status` to `clean`; verify the intended related recipient can attach/download it at AAL2, while an unrelated unit or property cannot. Confirm that `quarantined` cannot be attached or downloaded.
6. Run `node scripts/document-clamav-worker.mjs --status` from the trusted host after each scheduled cycle. It exits nonzero for dead-letter jobs or pending/retry work older than 30 minutes; connect that exit status to the host's alerting. A completed scan atomically closes its job; a scanner error schedules retry with backoff, at most five attempts. A `dead_letter` or old `pending` row needs an operator investigation, not a manual `clean` update. A network failure during completion may already have committed; inspect the immutable attestation and queue state before intervening.

## Release gate

Do not activate real customer document exchange until the worker host, secret handling, definition freshness, scan logs, and alerting have been reviewed; the pilot must pass with actual authenticated company, manager, contractor, owner and tenant accounts. Schedule `--queue` on the trusted host (for example, Windows Task Scheduler once per minute), prevent overlapping invocations on the same host, and alert on `dead_letter` and stale `pending` counts. The worker drains **one** job per invocation; the queue uses short leases and row locks so several trusted workers may coexist when needed. Keep exports and other vaults on their separate security gates.

## Windows Server pilot scheduling

Run the following in an elevated Windows PowerShell session **as the same Windows account that will run the task**. Ensure this checkout contains `scripts/windows-vault-scan-provision.ps1` and `scripts/windows-vault-scan-cycle.ps1` and that `npm ci --omit=dev` has succeeded. Never send the worker key to another person or put it in the task arguments.

```powershell
Set-Location 'C:\AIPROJECTBACKUP\CLADORA-SCANNER'
& .\scripts\windows-vault-scan-provision.ps1
& .\scripts\windows-vault-scan-cycle.ps1
```

The provisioning script saves an account-bound Windows DPAPI encrypted credential in `%ProgramData%\CLADORA\VaultScanner\worker-key.dpapi` with an ACL restricted to that account and SYSTEM. The cycle script processes one queued document, checks queue health, and writes only a bounded event code to `%ProgramData%\CLADORA\VaultScanner\scan-events.jsonl`. Check that the manual cycle returns `idle` or `completed` with exit code zero before adding a schedule.

In Task Scheduler, create a task named `CLADORA Vault Scanner` under the **same account**. On General, select **Run whether user is logged on or not** and enter the Windows account password when prompted; do not use S4U / "Do not store password", because the job requires network access and the user's DPAPI profile. On Triggers, start once in one minute, repeat **every 5 minutes** indefinitely. On Actions, use `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` with arguments `-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\AIPROJECTBACKUP\CLADORA-SCANNER\scripts\windows-vault-scan-cycle.ps1"`; set Start in to `C:\AIPROJECTBACKUP\CLADORA-SCANNER`. On Settings, choose **Do not start a new instance** if the task is already running; set a suitable execution time limit greater than the worker's 120-second ClamAV command timeout. After saving, start the task manually once and confirm Last Run Result `0x0`, then review the JSONL log and the application's queue status. A nonzero result, a `dead_letter` entry, or an old pending entry requires investigation; never mark a document clean manually.

DPAPI ciphertext cannot be decrypted by another Windows user or a different server. Re-provision it under the replacement account if the task account or server changes. Protect the host itself, because its administrators and SYSTEM can access this trusted worker.
