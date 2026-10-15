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
assert.doesNotMatch(runtime, /validateReplay|replay_policy|replay_provider_code/,
  'AIRPROP remains on Core authority-only replay and must not invoke the replay hook');
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
      sha256: '339b1b88e89072fd95c0e07a8821084877c722c4f121bb6f0a16dfde73f96080',
    },
    '20261013145654_service_request_subject_provider_v2.sql': {
      owner: 'SERVICE / PR #383',
      sha256: 'a4765535e180c39c633afb4a8b4f03c898c25c91ec31a906e73aa780c036ae98',
    },
    '20261013150000_communications_private_message_request_audience_gate_v1.sql': {
      owner: 'CE Communications / PR #386',
      sha256: 'aa90a34c3f2671fe39c20c8b0c131ef85b5d06c433341fa4c6ffba61f59869e7',
    },
    '20261013170242_service_request_subject_link_v1.sql': {
      owner: 'SERVICE / PR #385',
      sha256: '2741a7128096bcc7aa14c0ea28acf1fc8142a76d6103306e347ad225ad0869e8',
    },
    '20261014082947_experience_guide_storage_lifecycle_v1.sql': {
      owner: 'CE / PR #395',
      sha256: '5d951a6938d8737041c6c7272f2dc40d1abe289d005afc85a7c871330116a0e5',
    },
    '20261014083050_document_workspace_binding_writer_v1.sql': {
      owner: 'Documents / PR #396',
      sha256: '1e7b64b5e623b9ca9f3eee43e1b41ac61f9fe9be008d1c59fa90e68d9ed3804d',
    },
    '20261014132000_experience_guide_child_publish_lock_v1.sql': {
      owner: 'CE / PR #404',
      sha256: '3ffa7e694eec72d6cf7e1bb5e813e21cb65ce6e4519ac4025931dbfdfe820ab6',
    },
    '20261014200948_document_null_workspace_creation_closure_v1.sql': {
      owner: 'Documents / PR #406',
      sha256: '5d8b2b6d68868001e7fdc6085c87aabe5568917d271a84192734c9643e8496e8',
    },
    '20261015100000_core_platform_role_bound_pool_v1.sql': {
      owner: 'Core / PR #409',
      sha256: 'ff944f72f3a5396c57afeeaec0406ec480f859d00ef8736b00c64f14d905e641',
    },
  },
  label: 'AIRPROP B2 migration baseline',
});

const coreResult = validateProtectedDirectory({
  directory: 'src/lib/core',
  expectedProtectedCount: 15,
  expectedProtectedDigest: 'b520d6922086c56e88ab83f02867d1664285a63cb55017017ccea1b114efd5a7',
  isProtected: path => ![
    'communications-private-message-subject-provider-v1.ts',
    'communications-private-message-request-audience-provider-v1.ts',
    'current-unit-property-selector-v1.ts',
    'platform-role-bound-pool-v1.ts',
    'postgres-transaction-host-v1.ts',
    'transaction-replay-provider-hook-v1.ts',
  ].includes(path),
  reviewedAdditions: {
    'communications-private-message-subject-provider-v1.ts': {
      owner: 'CE Communications / PR #377',
      sha256: '2633525211cf4b6579290e1820fc099f76f3bc6b2a5f5afda819d7df73096a01',
    },
    'communications-private-message-request-audience-provider-v1.ts': {
      owner: 'CE Communications / PR #386',
      sha256: '778a88a3fd800b725c2f539e68e9cf726ce801d6063d0075d8af4723f167d39a',
    },
    'current-unit-property-selector-v1.ts': {
      owner: 'Core / PR #417',
      sha256: 'cf8649d0196c4d87e6bb17a756ab24194faddd1cec382cde97e17c5466c55dcd',
    },
    'platform-role-bound-pool-v1.ts': {
      owner: 'Core / PR #409',
      sha256: '6a3bf83e82424d0e26dc13e101d0f2e15cf241c17682809e7531cffd3e19511e',
    },
    'transaction-replay-provider-hook-v1.ts': {
      owner: 'Core / PR #399',
      sha256: 'eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4',
    },
  },
  reviewedReplacements: {
    'postgres-transaction-host-v1.ts': {
      owner: 'Core / PR #399',
      historicalSha256: '194c5fb3348281bf201229aab511d51ff38d366a61963e7366690887cbfc451b',
      sha256: 'eb89d03320549a721a54df10fa747f8977d9f42f6dfaa2e85ae89e1265c37d7c',
    },
  },
  historicalProtectedCount: 16,
  historicalProtectedDigest: '9239ad3ef818b3ada7ec0f4cc2171179bd394ca1422fceab090280c95adf9331',
  label: 'AIRPROP B2 Core baseline',
});

console.log('PASS B2 safety: canonical provider/host reuse and inactive production remain closed; protected migration/Core baselines are immutable; reviewed additions present:', {
  migrations: migrationResult.reviewedAdditionsPresent,
  core: coreResult.reviewedAdditionsPresent,
  coreReplacements: coreResult.reviewedReplacementsPresent,
  historicalCoreBaseline: {
    count: coreResult.historicalProtectedCount,
    digest: coreResult.historicalProtectedDigest,
  },
});
