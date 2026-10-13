import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
// Frozen from main 08282c4117216f9e48161d59a6187cb0a1c69431.
// Includes every file; paths + NUL + bytes + NUL, sorted lexicographically.
for (const [directory, expected] of [
  ['supabase/migrations', '3cd04c33b66896f2dc6b0f5b86e901d8184931b8afb09526f9d7918d74d6a018'],
  ['src/lib/core', '9239ad3ef818b3ada7ec0f4cc2171179bd394ca1422fceab090280c95adf9331'],
]) {
  const digest = createHash('sha256');
  const paths = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => `${entry.parentPath}/${entry.name}`).sort();
  for (const path of paths) digest.update(path).update('\0').update(readFileSync(path)).update('\0');
  assert.equal(digest.digest('hex'), expected, `${directory}: unchanged bytes and file set`);
}
console.log('PASS B2 safety: canonical provider/host reuse, closed production, no new authority/ledger/DDL/grant/Documents/Remote composition; all migrations and Core byte-identical to baseline');
