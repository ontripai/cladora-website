import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261008195811_dw01b_workspace_configuration_v1.sql";
const testPath = "supabase/tests/173_dw01b_workspace_configuration.test.sql";
const docPath = "docs/contracts/CLADORA-CORE-DW-01B-WORKSPACE-CONFIGURATION-v1.0.md";

for (const path of [migrationPath, testPath, docPath]) {
  assert.ok(fs.existsSync(path), `${path} exists`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const test = fs.readFileSync(testPath, "utf8");
const doc = fs.readFileSync(docPath, "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(migration, /add column configuration_version integer/i);
assert.match(migration, /unique \(customer_workspace_id, configuration_version\)/i);
assert.match(migration, /pg_advisory_xact_lock[\s\S]*workspace_configuration:/i);
assert.match(migration, /compatibility_rule_id is distinct from new\.compatibility_rule_id/i);
assert.match(migration, /resolve_workspace_native_context_v2\(p_context_id, p_workspace_id\)/i);
assert.match(migration, /workspace_configuration_future_as_of/i);
assert.match(migration, /'classification_only', true/i);
assert.match(migration, /'product_gate', false/i);
assert.match(migration, /'action_authorization', 'not_evaluated'/i);
assert.doesNotMatch(migration, /create table platform\.customer_workspaces/i);
assert.doesNotMatch(migration, /workspace_entitlements[\s\S]*(insert|update|delete)/i);

assert.match(test, /select plan\(22\);/i);
assert.match(test, /historical read returns the version effective at as_of/i);
assert.match(test, /workspace_native_context_access_denied/i);
assert.match(doc, /classification_only = true/);
assert.match(doc, /product_gate = false/);
assert.match(doc, /action_authorization = not_evaluated/);
assert.ok(pkg.scripts["test:unit"].includes("test-dw-01b-workspace-configuration-contract.mjs"));

console.log("DW-01B workspace-configuration.v1 contract checks passed.");
