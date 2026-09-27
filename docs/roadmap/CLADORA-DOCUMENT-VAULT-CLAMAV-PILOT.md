# CLADORA document vault: ClamAV pilot procedure

This is an **operator-run, free software scanner** for private Supabase Storage documents. It is not an automated production scanner. Until a trusted host runs it, new uploads remain `deferred`, unavailable for ordinary signed download and private-message attachment. Keep PR #167 as Draft until a pilot verifies real clean and malicious files and account access.

## Prerequisites

- A trusted worker host with Node.js 22+, the official ClamAV binary and FreshClam configured with a writable signature database. The official Windows installer does not set up `freshclam.conf` automatically. The host must have enough memory for ClamAV and safe temporary disk space. Do not run the worker in the Vercel request process.
- Install dependencies with `npm ci` on the trusted host. Configure `SUPABASE_URL` for the CLADORA project and `SUPABASE_SERVICE_ROLE_KEY` as a host-only secret; never place that key in `NEXT_PUBLIC_` variables, screenshots, issue comments or the browser. Optionally set `CLAMSCAN_PATH` and `FRESHCLAM_PATH` to the absolute executables.
- Apply the migration through the normal production migration gate only after PR review. No production migration is part of this draft. The two scanner RPCs are callable by `service_role` only, and the immutable scan record is private.

## Pilot on synthetic data

1. Run `npm run test:document-scanner` and `npm run test:db:static`; CI also executes pgTAP test `123_document_vault_clamav_attestation.test.sql` against a fresh Postgres database.
2. Create a **synthetic** test document using the normal vault upload flow. Obtain its version UUID from the privileged operations database view; ensure it is `deferred` and its Storage object exists.
3. On the trusted host, run `node scripts/document-clamav-worker.mjs <version-uuid>`. It first updates virus definitions with FreshClam and checks the ClamAV engine version. It then downloads no more than 20 MiB from the private bucket, verifies bytes and SHA-256, scans a random temporary file, and deletes it after scanning.
4. Repeat with a standard synthetic antivirus test fixture approved by your security operator. A positive result must be `quarantined`. Missing/stale signatures, scan limits, errors, incomplete output, hash mismatches and missing objects must leave the version `deferred`. Never set `clean` manually.
5. Confirm a clean result writes one immutable attestation and changes only `scanning_status` to `clean`; verify the intended related recipient can attach/download it at AAL2, while an unrelated unit or property cannot. Confirm that `quarantined` cannot be attached or downloaded.
6. Check that an ambiguous network failure during result recording has not already committed the attestation before retrying. The SQL RPC supports replay of the same scan ID and timestamp; the operator script uses a fresh ID per invocation and will refuse to rescan a completed version.

## Release gate

Do not activate real customer document exchange until the worker host, secret handling, definition freshness, scan logs, and alerting have been reviewed; the pilot must pass with actual authenticated company, manager, contractor, owner and tenant accounts. This manual worker does not poll for new uploads. A production operation must schedule and monitor invocation for **every** pending version, or add an audited queue before relying on unattended uploads. Keep exports and other vaults on their separate security gates.
