import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProtectedDirectory } from './lib/airprop-b2-safety-guard.mjs';

const files = ['src/lib/airprop/artifact-b2-contract.ts', 'src/lib/airprop/artifact-b2-runtime.ts',
  'src/lib/airprop/artifact-b2-api.ts', 'src/lib/airprop/artifact-b2-portfolio.ts',
  'src/app/api/customer/v2/airprop/artifact-b2/route.ts', 'src/components/customer/CustomerAirpropB2.tsx'];
const text = files.map(path => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(text, /service_role|SUPABASE_DB|new Pool\(|grant\s+execute|create\s+table|schema\('documents'\)/i);
assert.doesNotMatch(readFileSync(files[5], 'utf8'), /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
const runtime = readFileSync(files[1], 'utf8');
assert.match(runtime, /import \{ resolveAuthority \} from '\.\.\/core\/current-authority-postgres-provider-v1'/);
assert.match(runtime, /createCorePostgresTransactionHostV1\(pool\)/);
assert.doesNotMatch(runtime, /insert into|update\s+platform|new Map|authorityCache/i);
assert.match(readFileSync(files[4], 'utf8'), /runtime: null/);
assert.match(readFileSync(files[0], 'utf8'), /commands: null, can_edit: false/);

const migrationCutoff = '20261012190924';
const migrationVersion = path => {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(path);
  assert.ok(match, `AIRPROP B2 migration safety: invalid migration path: ${path}`);
  return match[1];
};
const migrationResult = validateProtectedDirectory({
  directory: 'supabase/migrations',
  expectedProtectedCount: 247,
  expectedProtectedDigest: '3cd04c33b66896f2dc6b0f5b86e901d8184931b8afb09526f9d7918d74d6a018',
  isProtected: path => migrationVersion(path) <= migrationCutoff,
  reviewedAdditions: {
    '20261013062342_service_request_subject_context_v1.sql': {
      owner: 'SERVICE / PR #375',
      sha256: 'c8555ccaacd3964c7667d82bcbe904619fdda697a2e37f44870242c8cbc58e04',
    },
    '20261013063739_document_reference_exact_workspace_v1.sql': {
      owner: 'Documents/Vault / PR #379',
      sha256: '988a8ddea361421cf6d75700ac3b0332c59ef0e10862201d2c2da0db48f91c51',
    },
    '20261013120000_communications_private_message_subject_provider_v1.sql': {
      owner: 'CE Communications / PR #377',
      sha256: '2d11a3b225398fbac17aaa59aa5c992aa22de5ba14a3a9468d9db11f19b12ca8',
    },
  },
  label: 'AIRPROP B2 migration baseline',
});

const coreResult = validateProtectedDirectory({
  directory: 'src/lib/core',
  expectedProtectedCount: 16,
  expectedProtectedDigest: '9239ad3ef818b3ada7ec0f4cc2171179bd394ca1422fceab090280c95adf9331',
  isProtected: path => path !== 'communications-private-message-subject-provider-v1.ts',
  reviewedAdditions: {
    'communications-private-message-subject-provider-v1.ts': {
      owner: 'CE Communications / PR #377',
      sha256: 'd342585e18dc6ebbc9f6f89ab057b9e9fdbe0ba094f1776962779e2d2ae6cbfd',
    },
  },
  label: 'AIRPROP B2 Core baseline',
});

console.log('PASS B2 safety: canonical provider/host reuse and inactive production remain closed; protected migration/Core baselines are immutable; reviewed additions present:', {
  migrations: migrationResult.reviewedAdditionsPresent,
  core: coreResult.reviewedAdditionsPresent,
});
