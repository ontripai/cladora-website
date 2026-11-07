/**
 * TARGETED TEST SUITE: APP-SERVICE-PROFILE-COMPAT-01
 * Package: CLADORA-FIRST-SERVICE-PRODUCT-E2E-01
 * Owner: Antigravity / App
 *
 * Scope:
 * 1. Counterexample Before Fix:
 *    - In an environment where customer_api is uninstalled, GET /api/customer/v1/profile
 *      previously threw code 42883 on my_profile_v1 and failed with HTTP 500 PROFILE_UNAVAILABLE.
 * 2. Success in Official SERVICE Profile (After Fix):
 *    - Uses real, verified Auth information (client.auth.getUser()).
 *    - Zero dependency on customer_api.my_profile_v1 (verified with strict schema trap).
 *    - Minimal identity display contract (email, display_name, locale, timezone).
 *    - No synthetic names, stored profiles, or commercial authority.
 * 3. Auth Failure Handling:
 *    - Unauthenticated or expired session returns HTTP 401 UNAUTHORIZED.
 *    - Real Auth errors are never converted to success.
 * 4. Standard Profile Preservation:
 *    - When CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE is unset, customer_api.my_profile_v1 is called.
 *    - Database dependency errors properly return HTTP 500 PROFILE_UNAVAILABLE.
 * 5. Server-side Private Marker Exclusivity:
 *    - Setting NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY alone does NOT trigger assembly mode.
 * 6. PUT Route Integrity:
 *    - PUT retains all security controls: origin checks, content-type, payload validation, and auth checks.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");

let totalChecks = 0;
function check(condition, message) {
  totalChecks++;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  totalChecks++;
  assert.strictEqual(actual, expected, message);
}

const moduleCache = new Map();

function loadModule(relPath, mocks = {}) {
  const filename = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
  const cacheKey = `${filename}:${Object.keys(mocks).sort().join(",")}`;
  if (moduleCache.has(cacheKey) && Object.keys(mocks).length === 0) {
    return moduleCache.get(cacheKey);
  }
  const mod = new Module(filename);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) {
      const rel = id.slice(2);
      const candidates = [
        path.join(root, "src", rel),
        path.join(root, "src", rel + ".ts"),
        path.join(root, "src", rel + ".tsx"),
        path.join(root, "src", rel + ".js"),
        path.join(root, "src", rel, "index.ts"),
      ];
      for (const c of candidates) {
        if (existsSync(c)) {
          return loadModule(c, mocks);
        }
      }
    } else if (id.startsWith("./") || id.startsWith("../")) {
      const dir = path.dirname(filename);
      const candidates = [
        path.resolve(dir, id),
        path.resolve(dir, id + ".ts"),
        path.resolve(dir, id + ".tsx"),
        path.resolve(dir, id + ".js"),
        path.resolve(dir, id, "index.ts"),
      ];
      for (const c of candidates) {
        if (existsSync(c)) {
          return loadModule(c, mocks);
        }
      }
    }
    return require(id);
  };
  const rawSource = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(rawSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  mod._compile(compiled, filename);
  moduleCache.set(cacheKey, mod.exports);
  return mod.exports;
}

console.log("=== RUNNING TARGETED VERIFICATION: APP-SERVICE-PROFILE-COMPAT-01 ===\n");

// =========================================================================
// SECTION 1: COUNTEREXAMPLE BEFORE FIX
// =========================================================================
console.log("--- 1. Counterexample Before Fix ---");
{
  // Simulating the legacy un-branched route logic when customer_api is uninstalled
  let customerApiRpcCalled = false;
  const legacyDb = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123", email: "builder@cladora.com", user_metadata: {} } },
        error: null,
      }),
    },
    schema: (s) => {
      if (s === "customer_api") {
        return {
          rpc: async (fn) => {
            customerApiRpcCalled = true;
            const err = new Error(`function customer_api.${fn}() does not exist`);
            err.code = "42883";
            return { data: null, error: err };
          },
        };
      }
      throw new Error(`Unexpected schema ${s}`);
    },
  };

  // With assembly marker UNSET (legacy behavior without profile guard):
  delete process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;
  delete process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY;

  let currentClient = legacyDb;
  const profileRouteLegacy = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => currentClient },
  });

  const legacyResponse = await profileRouteLegacy.GET();
  const legacyJson = await legacyResponse.json();

  check(customerApiRpcCalled, "BEFORE: customer_api.my_profile_v1 was called");
  equal(legacyResponse.status, 500, "BEFORE: missing customer_api caused HTTP 500");
  equal(legacyJson.error?.code, "PROFILE_UNAVAILABLE", "BEFORE: response was PROFILE_UNAVAILABLE");
}

// =========================================================================
// SECTION 2: SUCCESS IN OFFICIAL SERVICE ASSEMBLY PROFILE
// =========================================================================
console.log("\n--- 2. Success in Official SERVICE Profile (No customer_api RPC) ---");
{
  process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE = "core-service-real-app-assembly.v1";
  process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY = "v1";

  let customerApiTrapFired = false;
  const assemblyDb = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-456",
            email: "service.admin@cladora.com",
            user_metadata: {
              display_name: "Elena Vancea",
              locale: "ro",
              timezone: "Europe/Bucharest",
            },
          },
        },
        error: null,
      }),
    },
    schema: (s) => {
      if (s === "customer_api") {
        customerApiTrapFired = true;
        throw new Error("VIOLATION: customer_api must NEVER be queried in official SERVICE assembly profile");
      }
      return {};
    },
  };

  let currentClient = assemblyDb;
  const profileRoute = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => currentClient },
  });

  const response = await profileRoute.GET();
  const json = await response.json();

  check(!customerApiTrapFired, "AFTER: customer_api was NOT queried in official SERVICE profile");
  equal(response.status, 200, "AFTER: HTTP 200 returned successfully");
  equal(json.email, "service.admin@cladora.com", "AFTER: real verified email returned");
  equal(json.display_name, "Elena Vancea", "AFTER: display_name from verified auth metadata returned");
  equal(json.locale, "ro", "AFTER: locale from auth metadata returned");
  equal(json.timezone, "Europe/Bucharest", "AFTER: timezone from auth metadata returned");
  equal(response.headers.get("Cache-Control"), "no-store, private", "AFTER: Cache-Control is no-store, private");
  equal(response.headers.get("Vary"), "Cookie", "AFTER: Vary is Cookie");

  // 2.2 Fallback when user_metadata has no display_name (use email directly, no synthetic profile)
  const noMetaDb = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-789",
            email: "direct.tenant@cladora.com",
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
    schema: () => {
      throw new Error("customer_api must not be called");
    },
  };
  currentClient = noMetaDb;
  const noMetaRes = await profileRoute.GET();
  const noMetaJson = await noMetaRes.json();
  equal(noMetaRes.status, 200, "Fallback: HTTP 200 returned");
  equal(noMetaJson.display_name, "direct.tenant@cladora.com", "Fallback: display_name gracefully falls back to email");
  equal(noMetaJson.locale, null, "Fallback: locale defaults to null");
  equal(noMetaJson.timezone, null, "Fallback: timezone defaults to null");
}

// =========================================================================
// SECTION 3: AUTH FAILURE HANDLING (HTTP 401 UNAUTHORIZED)
// =========================================================================
console.log("\n--- 3. Auth Failure Handling (Real Auth Error Never Converted to Success) ---");
{
  process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE = "core-service-real-app-assembly.v1";

  // Scenario 3.1: No active session (user is null)
  const unauthDb = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  };
  const profileRoute = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => unauthDb },
  });

  const resUnauth = await profileRoute.GET();
  equal(resUnauth.status, 401, "Unauthenticated session returns HTTP 401");
  const jsonUnauth = await resUnauth.json();
  equal(jsonUnauth.error?.code, "UNAUTHORIZED", "Error code is UNAUTHORIZED");

  // Scenario 3.2: Auth service returns error (token expired / invalid)
  const expiredDb = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error("JWT expired") }),
    },
  };
  const profileRouteExpired = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => expiredDb },
  });

  const resExpired = await profileRouteExpired.GET();
  equal(resExpired.status, 401, "Expired token returns HTTP 401");
  const jsonExpired = await resExpired.json();
  equal(jsonExpired.error?.code, "UNAUTHORIZED", "Real Auth error preserved as UNAUTHORIZED");
}

// =========================================================================
// SECTION 4: STANDARD PROFILE REGRESSION PRESERVATION
// =========================================================================
console.log("\n--- 4. Standard Profile Regression Preservation ---");
{
  delete process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;
  delete process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY;

  let rpcCalled = false;
  const standardDb = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u-std", email: "standard.owner@cladora.com", user_metadata: {} } },
        error: null,
      }),
    },
    schema: (s) => {
      equal(s, "customer_api", "Standard profile targets customer_api schema");
      return {
        rpc: async (fn) => {
          equal(fn, "my_profile_v1", "Standard profile calls my_profile_v1");
          rpcCalled = true;
          return {
            data: { display_name: "Stored In Database", locale: "fa", timezone: "Asia/Tehran" },
            error: null,
          };
        },
      };
    },
  };

  const profileRoute = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => standardDb },
  });

  const res = await profileRoute.GET();
  const json = await res.json();

  check(rpcCalled, "Standard profile correctly invokes customer_api.my_profile_v1");
  equal(res.status, 200, "Standard profile returns HTTP 200");
  equal(json.display_name, "Stored In Database", "Standard profile uses stored display_name from customer_api");
  equal(json.locale, "fa", "Standard profile uses stored locale");
  equal(json.timezone, "Asia/Tehran", "Standard profile uses stored timezone");

  // 4.2 Standard profile dependency error preserved
  const standardErrDb = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u-std", email: "standard.owner@cladora.com", user_metadata: {} } },
        error: null,
      }),
    },
    schema: () => ({
      rpc: async () => ({ data: null, error: new Error("connection failure") }),
    }),
  };
  const profileRouteErr = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => standardErrDb },
  });
  const resErr = await profileRouteErr.GET();
  equal(resErr.status, 500, "Standard profile returns HTTP 500 when customer_api RPC fails");
  const jsonErr = await resErr.json();
  equal(jsonErr.error?.code, "PROFILE_UNAVAILABLE", "Error code is PROFILE_UNAVAILABLE");
}

// =========================================================================
// SECTION 5: SERVER-SIDE PRIVATE MARKER EXCLUSIVITY
// =========================================================================
console.log("\n--- 5. Server-side Private Marker Exclusivity ---");
{
  // Set ONLY the public flag; private marker is UNSET
  delete process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;
  process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY = "v1";

  let standardRpcQueried = false;
  const publicOnlyDb = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "u-pub", email: "public.flag@cladora.com", user_metadata: {} } },
        error: null,
      }),
    },
    schema: () => ({
      rpc: async () => {
        standardRpcQueried = true;
        return { data: { display_name: "Standard From DB" }, error: null };
      },
    }),
  };

  const profileRoute = loadModule("src/app/api/customer/v1/profile/route.ts", {
    "@/lib/supabase/server": { createClient: async () => publicOnlyDb },
  });

  const res = await profileRoute.GET();
  check(standardRpcQueried, "Server does NOT enter assembly mode when only NEXT_PUBLIC flag is set");
  equal(res.status, 200, "Standard profile executes");
}

// =========================================================================
// SECTION 6: PUT ROUTE PRESERVATION & SECURITY CONTROLS
// =========================================================================
console.log("\n--- 6. PUT Route Preservation & Security Controls ---");
{
  const profileRoute = loadModule("src/app/api/customer/v1/profile/route.ts");

  // 6.1 Bad Origin rejected
  const badOriginReq = new NextRequest("http://localhost:3000/api/customer/v1/profile", {
    method: "PUT",
    headers: {
      origin: "http://malicious-attacker.com",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({ display_name: "Hacked" }),
  });
  const resBadOrigin = await profileRoute.PUT(badOriginReq);
  equal(resBadOrigin.status, 403, "PUT rejects untrusted mutation origin (403 BAD_ORIGIN)");

  // 6.2 Unsupported media type rejected
  const badTypeReq = new NextRequest("http://localhost:3000/api/customer/v1/profile", {
    method: "PUT",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "text/plain",
    },
    body: "hello",
  });
  const resBadType = await profileRoute.PUT(badTypeReq);
  equal(resBadType.status, 415, "PUT rejects non-JSON content-type (415 UNSUPPORTED_MEDIA_TYPE)");

  // 6.3 Invalid display_name schema rejected
  const badSchemaReq = new NextRequest("http://localhost:3000/api/customer/v1/profile", {
    method: "PUT",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({ display_name: "a" }), // too short, min is 2
  });
  const resBadSchema = await profileRoute.PUT(badSchemaReq);
  equal(resBadSchema.status, 400, "PUT rejects invalid display_name schema (400 INVALID_DISPLAY_NAME)");
}

console.log(`\n=======================================================`);
console.log(`ALL ${totalChecks} APP-SERVICE-PROFILE-COMPAT-01 TARGETED CHECKS PASSED!`);
console.log(`=======================================================\n`);
