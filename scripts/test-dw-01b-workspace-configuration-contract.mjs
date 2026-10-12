import assert from "node:assert/strict";
import fs from "node:fs";

const docPath = "docs/contracts/CLADORA-CORE-DW-01B-WORKSPACE-CONFIGURATION-v1.0.md";
const deferredRuntimePaths = [
  "supabase/migrations/20261008195811_dw01b_workspace_configuration_v1.sql",
  "supabase/tests/173_dw01b_workspace_configuration.test.sql",
];

assert.ok(fs.existsSync(docPath), `${docPath} exists`);
for (const path of deferredRuntimePaths) {
  assert.equal(fs.existsSync(path), false, `${path} remains outside the contract-only package`);
}

const doc = fs.readFileSync(docPath, "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(doc, /Contract identifier: `workspace-configuration\.v1`/);
assert.match(doc, /classification_only = true/);
assert.match(doc, /product_gate = false/);
assert.match(doc, /action_authorization = not_evaluated/);
assert.match(doc, /app_private\.resolve_workspace_native_context_v2/);
assert.match(doc, /future runtime must fail closed/i);
assert.match(doc, /separate migration\/runtime authorization/i);
assert.match(doc, /no SQL migration, database object, HTTP endpoint, or runtime\s+activation/i);
assert.ok(pkg.scripts["test:unit"].includes("test-dw-01b-workspace-configuration-contract.mjs"));

console.log("DW-01B workspace-configuration.v1 static contract checks passed.");
