import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateClosure, ScopeError } from './closure.mjs';
import { admit, sha256, verifyFiles, validateRequest, Gate } from './admission.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requestBytes = readFileSync(new URL('./consumer-request.json', import.meta.url));
const inventoryBytes = readFileSync(new URL('./source-inventory.json', import.meta.url));
const closureBytes = readFileSync(new URL('./runtime-closure.json', import.meta.url));
let dispatchAttempted = false;
try {
  const mode = process.argv.slice(2);
  if (mode.length === 1 && mode[0] === '--inspect-request') {
    const request = validateRequest(JSON.parse(requestBytes));
    if (sha256(inventoryBytes) !== request.source_inventory_sha256) throw new Gate('INVENTORY_BYTES_MISMATCH');
    if (sha256(closureBytes) !== request.runtime_closure_sha256) throw new Gate('RUNTIME_CLOSURE_BYTES_MISMATCH');
    validateClosure(JSON.parse(closureBytes), JSON.parse(inventoryBytes));
    verifyFiles(root, request.artifacts);
    verifyFiles(root, JSON.parse(inventoryBytes).files);
    console.log(JSON.stringify({ contract: request.contract, request_sha256: sha256(requestBytes),
      source_inventory_sha256: sha256(inventoryBytes), runtime_closure_sha256: sha256(closureBytes), live: 'CLOSED_PENDING_COORDINATOR_ADMISSION' }));
  } else {
    if (mode.length !== 1 || mode[0] !== '--run') throw new Gate('LIVE_DISABLED_SOURCE_REVIEW_REQUIRED');
    // Platform supplies this trust anchor from its coordinator-owned admission
    // registry/custody. Request-local approved:true and embedded keys cannot work.
    const env = process.env;
    if (!env.DOCS_CE012_REVIEW_ENVELOPE_FILE || !env.DOCS_CE012_FIXTURE_PLAN_FILE
      || !env.DOCS_CE012_COORDINATOR_PUBLIC_KEY_FILE) throw new Gate('COORDINATOR_ADMISSION_MISSING');
    const admitted = admit({ requestBytes, inventoryBytes, closureBytes,
      planBytes: readFileSync(env.DOCS_CE012_FIXTURE_PLAN_FILE),
      envelope: JSON.parse(readFileSync(env.DOCS_CE012_REVIEW_ENVELOPE_FILE)),
      trustedPublicKey: readFileSync(env.DOCS_CE012_COORDINATOR_PUBLIC_KEY_FILE, 'utf8'),
      trustedKeySha256: env.DOCS_CE012_COORDINATOR_KEY_SHA256, root });
    // No pg import, pool, connection or Auth request before complete admission.
    const { executeLive } = await import('./live.mjs');
    dispatchAttempted = true;
    const result = await executeLive(admitted, root, {
      runtime: env.DOCS_CE012_RUNTIME_DATABASE_URL,
      observer: env.DOCS_CE012_OBSERVER_DATABASE_URL,
      conflict: env.DOCS_CE012_CONFLICT_DATABASE_URL,
      token: env.DOCS_CE012_ISSUED_AAL2_ACCESS_TOKEN,
    });
    console.log(JSON.stringify(result));
    if (result.result !== 'PASS_LIVE_READ_PROBES') process.exitCode = 2;
  }
} catch (error) {
  const dependency = { '42501': 'CATALOG_OBSERVER_OR_NATIVE_READ_RIGHT_MISSING',
    '42P01': 'NATIVE_SCHEMA_MISSING', '42883': 'NATIVE_FUNCTION_MISSING',
    '28P01': 'BOUND_DATABASE_IDENTITY_AUTH_FAILED', ECONNREFUSED: 'LOCAL_OWNED_TARGET_UNAVAILABLE' };
  console.log(JSON.stringify({ result: 'BLOCKED', code: error instanceof Gate || error instanceof ScopeError
    ? error.code : dependency[error.code] ?? 'INPUT_OR_DEPENDENCY_UNAVAILABLE_NO_PRIVATE_DETAIL', live_proof: dispatchAttempted ? 'ATTEMPTED_NOT_PASS' : 'NOT_RUN_NOT_PASS' }));
  process.exitCode = 2;
}
