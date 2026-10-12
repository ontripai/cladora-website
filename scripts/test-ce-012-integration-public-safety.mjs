import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const page = read('src/components/customer/CustomerExperienceGuidePage.tsx');
const client = read('src/lib/community/experience-guide-client.ts');
const command = read('src/lib/community/experience-guide-command-contract.ts');
const adapter = read('src/lib/community/experience-guide-editor-adapter.ts');

assert.match(page, /commands=\{null\}/, 'production Guide page must not inject commands');
assert.match(client, /can_edit:\s*false/, 'production Guide projection must remain non-editable');
assert.doesNotMatch(page, /experience-guide-editor-adapter|experience-guide-command-contract/);
assert.doesNotMatch(client, /experience-guide-editor-adapter|experience-guide-command-contract/);

const productionReferences = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)
      && !absolute.endsWith('experience-guide-editor-adapter.ts')
      && !absolute.endsWith('experience-guide-command-contract.ts')) {
      const source = read(absolute);
      if (/experience-guide-editor-adapter|experience-guide-command-contract/.test(source)) productionReferences.push(absolute);
    }
  }
};
walk('src');
assert.deepEqual(productionReferences, [], 'no production module may activate the local contracts or adapter');

for (const source of [command, adapter]) {
  assert.doesNotMatch(source, /@supabase|createClient\s*\(|\.rpc\s*\(|\.from\s*\(/);
  assert.doesNotMatch(source, /CREATE\s+(?:TABLE|FUNCTION|POLICY)|SECURITY\s+DEFINER/i);
}
assert.doesNotMatch(adapter, /defaultProvider|defaultCommand|new\s+Supabase|process\.env/);
assert.match(adapter, /createCe012GuideCommandExecutor/);
assert.match(adapter, /createCe012GuideEditorAdapter/);

const internalMetadata = ['object_path', 'bucket_id', 'sha256', 'mime_type', 'classification', 'owner_id', 'tenant_id'];
for (const field of internalMetadata) {
  assert.doesNotMatch(page, new RegExp(field));
  assert.doesNotMatch(client, new RegExp(field));
}

console.log('CE012 integration public-safety passed: production closed, no runtime wiring or parallel provider/store, and internal document metadata absent');
