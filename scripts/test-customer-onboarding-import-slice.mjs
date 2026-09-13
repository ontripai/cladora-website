import assert from "node:assert/strict";import {readFileSync,existsSync} from "node:fs";
const migration=readFileSync("supabase/migrations/20260912211715_controlled_residential_import_onboarding.sql","utf8");
const test=readFileSync("supabase/tests/068_controlled_residential_import_onboarding.test.sql","utf8");
const ui=readFileSync("src/components/customer/CustomerBuildingSetupWizard.tsx","utf8");
for(const table of ["import_templates","import_runs","import_sources","import_rows","import_reconciliation_results","onboarding_checkpoints"])assert.match(migration,new RegExp(`create table platform\\.${table}`));
for(const rpc of ["create_import_run_v1","add_import_source_v1","validate_import_v1","dry_run_import_v1","approve_import_commit_v1","activate_import_v1"])assert.match(migration,new RegExp(`function customer_api\\.${rpc}`));
assert.match(migration,/DEFERRED_XLSX_IMPORT_UNTIL_MALWARE_SCANNER/);assert.match(migration,/dual_control_violation/);assert.match(migration,/opening_balance_unbalanced/);assert.doesNotMatch(migration,/p1test|Tenant A/i);assert.match(test,/select plan\(71\)/);assert.match(ui,/dir=\{lang==="fa"\?"rtl":"ltr"\}/);assert.match(ui,/ro:/);assert.match(ui,/en:/);assert.match(ui,/fa:/);
for(const path of ["src/app/api/customer/v1/onboarding/templates/route.ts","src/app/api/customer/v1/onboarding/imports/route.ts","src/app/api/customer/v1/onboarding/imports/[id]/sources/route.ts","src/app/api/customer/v1/onboarding/imports/[id]/[action]/route.ts"])assert.ok(existsSync(path),`${path} exists`);
console.log("Controlled residential onboarding import: 5/5 contract suites passed.");
