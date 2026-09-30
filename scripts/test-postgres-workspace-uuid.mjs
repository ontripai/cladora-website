import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadSchema(path) {
  const source = fs.readFileSync(path, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
  return module.exports;
}
const valid = ['80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'A8936E74-9582-4517-8C4D-ECED79A7C49B'];
const invalid = ['', '80000000-0000-0000-0000-00000000000', '80000000-0000-0000-0000-00000000000g', ' 80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004/', null, 42];
for (const path of ['src/lib/customer/workspace-taxonomy-schema.ts', 'src/lib/customer/workspace-composition-schema.ts']) {
  const schema = loadSchema(path);
  for (const id of valid) assert.equal(schema.uuidSchema.safeParse(id).success, true, path + ' accepts database UUID ' + id);
  for (const id of invalid) assert.equal(schema.uuidSchema.safeParse(id).success, false, path + ' rejects malformed UUID');
}
const taxonomy = loadSchema('src/lib/customer/workspace-taxonomy-schema.ts');
assert.equal(taxonomy.workspaceTaxonomyResponseSchema.safeParse({
  has_assignment: false, status: 'not_configured', workspace_id: valid[1],
}).success, true, 'Unconfigured synthetic workspace response is valid');
const composition = loadSchema('src/lib/customer/workspace-composition-schema.ts');
assert.equal(composition.workspaceCompositionResponseSchema.safeParse({
  has_assignment: false, status: 'taxonomy_required', workspace_id: valid[1], modules: [],
}).success, true, 'Synthetic workspace composition response is valid');
assert.equal(taxonomy.assignWorkspaceTaxonomyRequestSchema.safeParse({
  context_id: valid[0], property_profile_code: 'residential_condominium',
  operating_model_code: 'owners_association_managed', country_code: 'RO',
  idempotency_key: 'a8936e74-9582-4517-8c4d-eced79a7c49b', unexpected: true,
}).success, false, 'Unknown mutation fields remain rejected');
console.log('PostgreSQL UUID workspace regression passed.');
