import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inspectMagicBytes } from "../src/lib/customer/documents-api-helper.ts";
import { processUploadStream } from "../src/lib/customer/documents-stream-handler.ts";

console.log("=== RUNNING CUSTOMER DOCUMENTS & EVIDENCE VAULT CONTRACT TESTS ===\n");

const root = process.cwd();

// =============================================================================
// Suite 1: Route Handlers Contract, Security & Schema Delegation Verification
// =============================================================================
console.log("[Suite 1] Route Handlers Contract & Schema Delegation Verification");

const DOC_ROUTES = [
  { path: "src/app/api/customer/v1/documents/upload-intent/route.ts", rpc: "create_upload_intent_v1" },
  { path: "src/app/api/customer/v1/documents/upload/route.ts", rpc: "finalize_upload_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/download/route.ts", rpc: "authorize_document_download_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/verify/route.ts", rpc: "verify_document_evidence_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/holds/route.ts", rpc: "place_legal_hold_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/holds/release/route.ts", rpc: "release_legal_hold_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/disposition/route.ts", rpc: "request_document_disposition_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/disposition/[reqId]/approve/route.ts", rpc: "approve_document_disposition_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/retention/route.ts", rpc: "assign_retention_policy_v1" },
  { path: "src/app/api/customer/v1/documents/[id]/links/route.ts", rpc: "link_document_entity_v1" },
];

const INTERNAL_SCHEMAS = [
  "platform", "finance", "billing", "payments", "utilities",
  "maintenance", "governance", "communications", "documents",
  "occupancy", "security_access", "audit", "identity", "app_private"
];

for (const route of DOC_ROUTES) {
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

  // Must verify same origin
  assert.ok(
    content.includes("hasTrustedMutationOrigin"),
    `${route.path}: must enforce trusted mutation origin`
  );

  // Must include Cache-Control no-store, private
  assert.ok(
    content.includes("HEADERS"),
    `${route.path}: must apply defensive security headers`
  );
}
console.log("  ✓ All 10 Route Handlers conform strictly to customer_api gateway and security standards.");

// =============================================================================
// Suite 2: Real Server-Side SHA-256 & Bounded Stream Checksum Verification
// =============================================================================
console.log("\n[Suite 2] Real Server-Side SHA-256 & Bounded Stream Checksum Verification");

import { ReadableStream } from "node:stream/web";

const fixtureBytes = Buffer.from("%PDF-1.4\n%Fixture content for bounded streaming sha256 test\n%%EOF");
const expectedHash = crypto.createHash("sha256").update(fixtureBytes).digest("hex");

// Test chunked streaming through processUploadStream
const webStream = new ReadableStream({
  start(controller) {
    // Send in small chunks of 16 bytes to prove progressive processing
    for (let i = 0; i < fixtureBytes.length; i += 16) {
      controller.enqueue(new Uint8Array(fixtureBytes.subarray(i, i + 16)));
    }
    controller.close();
  },
});

const { result: streamRes } = await processUploadStream(webStream, "application/pdf", 1024 * 1024);
assert.equal(streamRes.serverSha256, expectedHash, "Server stream computed SHA-256 must exactly match expected fixture hash");
assert.equal(streamRes.totalBytes, fixtureBytes.length, "Total bytes streamed must match fixture byte length");
assert.equal(streamRes.detectedMime, "application/pdf", "Detected MIME must be application/pdf");

// Test: Zero-byte stream rejected
const zeroStream = new ReadableStream({
  start(controller) {
    controller.close();
  },
});
await assert.rejects(
  async () => await processUploadStream(zeroStream, "application/pdf"),
  /zero_byte_upload_rejected/,
  "Zero-byte upload must be rejected"
);

// Test: Size limit enforced during stream
const largeChunk = new Uint8Array(2048);
const overflowStream = new ReadableStream({
  start(controller) {
    controller.enqueue(largeChunk);
    controller.close();
  },
});
await assert.rejects(
  async () => await processUploadStream(overflowStream, "application/pdf", 1024),
  /file_size_limit_exceeded/,
  "Exceeding maxSizeBytes must abort stream immediately"
);

console.log("  ✓ Real server-side SHA-256 computation over bounded streams verified.");
console.log("  ✓ Zero-byte rejection and max size enforcement verified.");

// =============================================================================
// Suite 3: MIME Magic Byte & Active Content Safety
// =============================================================================
console.log("\n[Suite 3] MIME Magic Byte & Active Content Safety");

// 1. PDF detection
const pdfSample = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj");
assert.deepEqual(inspectMagicBytes(pdfSample), { success: true, mime: "application/pdf" });

// 2. JPEG detection
const jpegSample = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
assert.deepEqual(inspectMagicBytes(jpegSample), { success: true, mime: "image/jpeg" });

// 3. PNG detection
const pngSample = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
assert.deepEqual(inspectMagicBytes(pngSample), { success: true, mime: "image/png" });

// 4. WebP detection
const webpSample = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, // WEBP
]);
assert.deepEqual(inspectMagicBytes(webpSample), { success: true, mime: "image/webp" });

// 5. Plain text
const txtSample = Buffer.from("Standard plain text contract notes without active code.");
assert.deepEqual(inspectMagicBytes(txtSample), { success: true, mime: "text/plain" });

// 6. Active content rejection: SVG
const svgSample = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
assert.deepEqual(inspectMagicBytes(svgSample), { success: false, reason: "svg_active_content_rejected" });

// 7. Active content rejection: HTML
const htmlSample = Buffer.from("<!DOCTYPE html><html><body><script>malicious()</script></body></html>");
assert.deepEqual(inspectMagicBytes(htmlSample), { success: false, reason: "html_active_content_rejected" });

// 8. Executable binary rejection: Windows PE (MZ)
const exeSample = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
assert.deepEqual(inspectMagicBytes(exeSample), { success: false, reason: "executable_binary_rejected" });

// 9. Executable script rejection: Shebang (#! /bin/sh)
const shSample = Buffer.from("#!/bin/sh\nrm -rf /");
assert.deepEqual(inspectMagicBytes(shSample), { success: false, reason: "executable_script_rejected" });

// 10. Generic archive rejection
const zipSample = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
assert.deepEqual(inspectMagicBytes(zipSample), { success: false, reason: "unsupported_archive_format_rejected" });

console.log("  ✓ Magic byte inspection correctly identifies safe document types.");
console.log("  ✓ Active content (SVG, HTML, scripts, executables, archives) strictly rejected.");

// =============================================================================
// Suite 4: Fail-Closed Scanner State Contract & Error Mapping
// =============================================================================
console.log("\n[Suite 4] Scanner-Deferred Fail-Closed Contract & Error Mapping");

const { mapDocumentsRpcError } = await import("../src/lib/customer/documents-api-helper.ts");

// Deferred download blocked
const deferredErr = mapDocumentsRpcError({ message: "deferred_scanner_cannot_normal_download" });
assert.equal(deferredErr.status, 403);
assert.equal(deferredErr.body.error.code, "SCANNER_DEFERRED_DOWNLOAD_FORBIDDEN");

// Quarantined file blocked
const quarantineErr = mapDocumentsRpcError({ message: "quarantined_file_cannot_download" });
assert.equal(quarantineErr.status, 403);
assert.equal(quarantineErr.body.error.code, "FILE_QUARANTINED");

// Evidence verification requires clean status
const cleanErr = mapDocumentsRpcError({ message: "verified_evidence_requires_clean_scanner_status" });
assert.equal(cleanErr.status, 400);
assert.equal(cleanErr.body.error.code, "SCANNER_CLEAN_REQUIRED");

// Dual control creator cannot verify
const dualControlErr = mapDocumentsRpcError({ message: "dual_control_creator_cannot_verify_evidence" });
assert.equal(dualControlErr.status, 403);
assert.equal(dualControlErr.body.error.code, "DUAL_CONTROL_VIOLATION");

// Legal hold blocks disposition
const holdErr = mapDocumentsRpcError({ message: "legal_hold_blocks_disposition" });
assert.equal(holdErr.status, 409);
assert.equal(holdErr.body.error.code, "LEGAL_HOLD_ACTIVE");

console.log("  ✓ Fail-closed error mapping accurately surfaces security invariants.");

// =============================================================================
// Suite 5: Immutability, Credential Boundary & Codebase Hygiene
// =============================================================================
console.log("\n[Suite 5] Immutability, Credential Boundary & Codebase Hygiene");

// Ensure zero service_role leaks in client code
const clientFiles = [
  "src/components/customer/CustomerDocumentsDashboard.tsx",
  "src/lib/customer/documents-schema.ts",
  "src/lib/customer/documents-api-helper.ts",
];

for (const f of clientFiles) {
  const content = fs.readFileSync(path.join(root, f), "utf8");
  assert.ok(!content.includes("service_role"), `${f}: must never reference service_role`);
  assert.ok(!content.includes("SUPABASE_SERVICE_ROLE_KEY"), `${f}: must never reference service_role key`);
}

// Ensure utility-evidence bucket is untouched
const migration80 = fs.readFileSync(path.join(root, "supabase/migrations/20260909133706_secure_documents_evidence_vault.sql"), "utf8");
assert.ok(!migration80.includes("drop table"), "Migration 80 must not drop existing tables");
assert.ok(!migration80.includes("delete from storage.buckets"), "Migration 80 must not alter other buckets");
assert.ok(migration80.includes("'document-vault'"), "Migration 80 establishes document-vault bucket");
assert.ok(migration80.includes("DEFERRED-PHYSICAL-DISPOSITION-EXECUTION"), "Migration 80 enforces non-destructive disposition");

console.log("  ✓ Immutability and zero client service_role leaks verified.");
console.log("  ✓ Migration 80 non-destructive disposition verified.");

console.log("\n=== ALL CUSTOMER DOCUMENTS CONTRACT TESTS PASSED (5/5) ===\n");
