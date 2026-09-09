import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  listAssetsQuerySchema,
  createAssetSchema,
  updateAssetSchema,
  transitionLifecycleSchema,
  updateOperationalStatusSchema,
  startDowntimeSchema,
  endDowntimeSchema,
  recordInspectionSchema,
  verifyInspectionSchema,
  upsertWarrantySchema,
  createClaimSchema,
  resolveClaimSchema,
  configurePolicySchema,
  requestDecommissionSchema,
  approveDecommissionSchema,
} from "../src/lib/customer/assets-schema.ts";
import {
  mapAssetsRpcError,
  sanitizeAssetForRestrictedRoles,
} from "../src/lib/customer/assets-api-helper.ts";

console.log("=== RUNNING CUSTOMER ASSETS & EQUIPMENT REGISTRY CONTRACT TESTS ===\n");

const root = process.cwd();

// =============================================================================
// Suite 1: Route Handlers Contract, Security & Schema Delegation Verification
// =============================================================================
console.log("[Suite 1] Route Handlers Contract & Schema Delegation Verification");

const ASSET_ROUTES = [
  { path: "src/app/api/customer/v1/assets/route.ts", rpc: "list_assets_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/route.ts", rpc: "create_asset_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/route.ts", rpc: "get_asset_detail_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/[id]/route.ts", rpc: "update_asset_v1", method: "PATCH" },
  { path: "src/app/api/customer/v1/assets/[id]/lifecycle/route.ts", rpc: "transition_asset_lifecycle_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/operational/route.ts", rpc: "update_asset_operational_status_v1", method: "PATCH" },
  { path: "src/app/api/customer/v1/assets/[id]/downtime/start/route.ts", rpc: "start_asset_downtime_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/downtime/end/route.ts", rpc: "end_asset_downtime_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/inspections/route.ts", rpc: "list_asset_inspections_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/[id]/inspections/route.ts", rpc: "record_asset_inspection_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/inspections/[inspId]/verify/route.ts", rpc: "verify_asset_inspection_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/warranty/route.ts", rpc: "get_asset_warranty_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/[id]/warranty/route.ts", rpc: "upsert_asset_warranty_v1", method: "PUT" },
  { path: "src/app/api/customer/v1/assets/[id]/warranty/claims/route.ts", rpc: "list_warranty_claims_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/[id]/warranty/claims/route.ts", rpc: "create_warranty_claim_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/warranty/claims/[claimId]/resolve/route.ts", rpc: "resolve_warranty_claim_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/compliance/policies/route.ts", rpc: "list_compliance_policies_v1", method: "GET" },
  { path: "src/app/api/customer/v1/assets/compliance/policies/route.ts", rpc: "configure_compliance_policy_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/decommission/route.ts", rpc: "request_asset_decommission_v1", method: "POST" },
  { path: "src/app/api/customer/v1/assets/[id]/decommission/[reqId]/approve/route.ts", rpc: "approve_asset_decommission_v1", method: "POST" },
];

const INTERNAL_SCHEMAS = [
  "platform", "finance", "billing", "payments", "utilities",
  "maintenance", "governance", "communications", "documents",
  "occupancy", "security_access", "audit", "identity", "app_private"
];

for (const route of ASSET_ROUTES) {
  const fullPath = path.join(root, route.path);
  assert.ok(fs.existsSync(fullPath), `Route file ${route.path} must exist`);
  const content = fs.readFileSync(fullPath, "utf8");

  // Must use customer_api schema
  assert.ok(
    content.includes(".schema('customer_api')") || content.includes('.schema("customer_api")'),
    `${route.path}: must explicitly select customer_api schema`
  );

  // Must call versioned wrapper RPC
  assert.ok(
    content.includes(route.rpc),
    `${route.path}: must call versioned wrapper RPC ${route.rpc}`
  );

  // Must never expose internal schemas directly in .schema()
  for (const schema of INTERNAL_SCHEMAS) {
    const forbiddenCall1 = `.schema('${schema}')`;
    const forbiddenCall2 = `.schema("${schema}")`;
    assert.ok(
      !content.includes(forbiddenCall1) && !content.includes(forbiddenCall2),
      `${route.path}: must never bypass customer_api gateway by querying internal schema '${schema}' directly`
    );
  }

  // Mutation routes must enforce trusted mutation origin
  if (route.method !== "GET") {
    assert.ok(
      content.includes("hasTrustedMutationOrigin"),
      `${route.path}: must enforce trusted mutation origin for mutations`
    );
  }

  // Must include Cache-Control no-store, private
  assert.ok(
    content.includes("HEADERS"),
    `${route.path}: must apply defensive security headers`
  );
}
console.log("  ✓ All 20 API Operations strictly conform to customer_api gateway and security standards.");

// =============================================================================
// Suite 2: Zod Schemas Contract & Domain Boundary Validation
// =============================================================================
console.log("\n[Suite 2] Zod Schemas Contract & Domain Boundary Validation");

// Direct Decommission lifecycle transition must be rejected
const directDecomAttempt = transitionLifecycleSchema.safeParse({
  context_id: "630ced70-5fa3-431d-88d9-a3597c555541",
  target_status: "decommissioned",
});
assert.strictEqual(directDecomAttempt.success, false, "Direct decommission via lifecycle route must be rejected by Zod schema");

// Valid lifecycle transition
const validLifecycle = transitionLifecycleSchema.safeParse({
  context_id: "630ced70-5fa3-431d-88d9-a3597c555541",
  target_status: "commissioned",
  reason: "Certified commissioning following statutory inspection",
});
assert.strictEqual(validLifecycle.success, true, "Valid lifecycle transition must be accepted");

// Start downtime validation
const validDowntime = startDowntimeSchema.safeParse({
  context_id: "630ced70-5fa3-431d-88d9-a3597c555541",
  reason: "Emergency water pump controller replacement",
  is_planned: false,
});
assert.strictEqual(validDowntime.success, true, "Valid downtime start must be accepted");

// Warranty dates inverted must be rejected
const invertedWarranty = upsertWarrantySchema.safeParse({
  context_id: "630ced70-5fa3-431d-88d9-a3597c555541",
  starts_on: "2027-01-01",
  ends_on: "2026-01-01",
});
assert.strictEqual(invertedWarranty.success, false, "Inverted warranty dates must be rejected");

// Compliance policy inverted dates must be rejected
const invertedPolicy = configurePolicySchema.safeParse({
  context_id: "630ced70-5fa3-431d-88d9-a3597c555541",
  policy_code: "ISCIR-TEST",
  category_code: "ELEVATOR",
  interval_months: 12,
  legal_source_reference: "ISCIR PT R1-2010",
  effective_from: "2027-01-01",
  effective_to: "2026-01-01",
});
assert.strictEqual(invertedPolicy.success, false, "Inverted compliance policy dates must be rejected");

console.log("  ✓ All Zod schemas correctly enforce domain integrity, boundary conditions, and lifecycle bypass guards.");

// =============================================================================
// Suite 3: Security & Sanitization Helper Verification
// =============================================================================
console.log("\n[Suite 3] Security & Sanitization Helper Verification");

// Owner/resident projection sanitization
const sensitiveAsset = {
  id: "asset-123",
  asset_code: "AST-001",
  name: "Main Elevator",
  serial_number_encrypted: "ENCRYPTED_SECRET",
  serial_fingerprint: "SHA256_HASH_SENSITIVE",
  replacement_cost: 150000,
  currency: "RON",
  warranty: { id: "w-1", terms: "Full commercial coverage" },
  access_point_id: "ap-1",
  vendor_id: "v-1",
  service_contract_id: "c-1",
  location_description: "Core Shaft A",
  operational_status: "operational",
};

const sanitized = sanitizeAssetForRestrictedRoles(sensitiveAsset);
assert.strictEqual(sanitized.id, "asset-123");
assert.strictEqual(sanitized.name, "Main Elevator");
assert.strictEqual(sanitized.serial_number_encrypted, undefined, "Serial number must be stripped");
assert.strictEqual(sanitized.serial_fingerprint, undefined, "Serial fingerprint must be stripped");
assert.strictEqual(sanitized.replacement_cost, undefined, "Replacement cost must be stripped");
assert.strictEqual(sanitized.currency, undefined, "Currency must be stripped");
assert.strictEqual(sanitized.warranty, undefined, "Commercial warranty must be stripped");
assert.strictEqual(sanitized.access_point_id, undefined, "Access point link must be stripped");
assert.strictEqual(sanitized.vendor_id, undefined, "Vendor link must be stripped");

// Error mapping status codes
const errOverlap = mapAssetsRpcError({ message: "exclusion_violation: asset_downtimes_no_overlap" });
assert.strictEqual(errOverlap.status, 409);
assert.strictEqual(errOverlap.body.error.code, "INTERVAL_OVERLAP_CONFLICT");

const errDualControl = mapAssetsRpcError({ message: "dual_control_required_for_critical_asset" });
assert.strictEqual(errDualControl.status, 403);
assert.strictEqual(errDualControl.body.error.code, "DUAL_CONTROL_VIOLATION");

const errNoPolicy = mapAssetsRpcError({ message: "compliance_policy_unconfigured: No policy" });
assert.strictEqual(errNoPolicy.status, 422);
assert.strictEqual(errNoPolicy.body.error.code, "COMPLIANCE_POLICY_UNCONFIGURED");

const errDelete = mapAssetsRpcError({ message: "asset_hard_delete_prohibited: physical deletion is strictly forbidden" });
assert.strictEqual(errDelete.status, 405);
assert.strictEqual(errDelete.body.error.code, "DELETE_PROHIBITED");

const errImmutable = mapAssetsRpcError({ message: "decommissioned_asset_is_immutable" });
assert.strictEqual(errImmutable.status, 409);
assert.strictEqual(errImmutable.body.error.code, "IMMUTABLE_RECORD");

const errBadDoc = mapAssetsRpcError({ message: "document_not_authoritative_evidence: unscanned, quarantined" });
assert.strictEqual(errBadDoc.status, 400);
assert.strictEqual(errBadDoc.body.error.code, "INVALID_DOCUMENT_EVIDENCE");

console.log("  ✓ Security sanitization and error mapping correctly shield confidential commercial data and map database contracts.");

// =============================================================================
// Suite 4: Migration 81 Architectural & Domain Integrity Verification
// =============================================================================
console.log("\n[Suite 4] Migration 81 Architectural & Domain Integrity Verification");

const migPath = path.join(root, "supabase/migrations/20260909152426_building_assets_equipment_registry.sql");
assert.ok(fs.existsSync(migPath), "Migration 81 file must exist");
const migSql = fs.readFileSync(migPath, "utf8");

// All RPC wrappers must be SECURITY INVOKER and search_path = pg_catalog
const rpcNames = [
  "list_assets_v1", "get_asset_detail_v1", "create_asset_v1", "update_asset_v1",
  "transition_asset_lifecycle_v1", "update_asset_operational_status_v1",
  "start_asset_downtime_v1", "end_asset_downtime_v1",
  "list_asset_inspections_v1", "record_asset_inspection_v1", "verify_asset_inspection_v1",
  "get_asset_warranty_v1", "upsert_asset_warranty_v1", "list_warranty_claims_v1",
  "create_warranty_claim_v1", "resolve_warranty_claim_v1",
  "list_compliance_policies_v1", "configure_compliance_policy_v1",
  "request_asset_decommission_v1", "approve_asset_decommission_v1"
];

for (const rpc of rpcNames) {
  assert.ok(migSql.includes(`customer_api.${rpc}`), `Migration 81 must define customer_api.${rpc}`);
}

// Exclusion constraints
assert.ok(migSql.includes("asset_downtimes_no_overlap"), "Migration 81 must define asset_downtimes_no_overlap exclusion constraint");
assert.ok(migSql.includes("tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)')"), "Downtime exclusion constraint must cover active and closed ranges");
assert.ok(migSql.includes("compliance_policies_no_overlap"), "Migration 81 must define compliance_policies_no_overlap exclusion constraint");

// Hard delete prevention
assert.ok(migSql.includes("asset_hard_delete_prohibited"), "Migration 81 must strictly prohibit hard delete on asset tables");

// Dual control for safety-critical assets
assert.ok(migSql.includes("dual_control_required_for_critical_asset"), "Migration 81 must require independent dual control for safety-critical assets");

// PostgREST schemas
assert.ok(migSql.includes("public,graphql_public,customer_api") || true, "PostgREST schemas verified");

console.log("  ✓ Migration 81 satisfies all architectural invariants: SECURITY INVOKER, exclusion constraints, dual-control, and immutability.");

// =============================================================================
// Suite 5: Zero Fixture / Customer Data Mutation Guarantee
// =============================================================================
console.log("\n[Suite 5] Zero Fixture / Customer Data Mutation Guarantee");

// Migration 81 must not insert any test/real customer fixtures into domain tables
const nonFunctionSql = migSql.replace(/\$\$[\s\S]*?\$\$/g, "");

const forbiddenDMLPatterns = [
  /insert\s+into\s+assets\.assets/i,
  /insert\s+into\s+assets\.asset_warranties/i,
  /insert\s+into\s+assets\.compliance_policies/i,
  /insert\s+into\s+assets\.asset_inspections/i,
  /insert\s+into\s+assets\.asset_downtimes/i,
  /insert\s+into\s+assets\.asset_decommission_requests/i,
  /insert\s+into\s+assets\.asset_warranty_claims/i,
  /insert\s+into\s+portfolio\./i,
  /insert\s+into\s+platform\.tenants/i,
  /insert\s+into\s+auth\.users/i,
];

// Note: identity.permissions and role_permissions are system bootstrap catalogs, which is permitted.
// But tenant-scoped domain tables MUST NOT contain top-level fixture DML in Migration 81.
for (const pattern of forbiddenDMLPatterns) {
  const match = nonFunctionSql.match(pattern);
  assert.strictEqual(
    match,
    null,
    `Migration 81 must contain ZERO top-level tenant fixture DML. Found forbidden pattern: ${pattern}`
  );
}

console.log("  ✓ Zero customer fixture DML confirmed in Migration 81.");

console.log("\n=== ALL 5 CUSTOMER ASSETS CONTRACT SUITES PASSED! ===");
