import { NextResponse } from "next/server";
import {
  getPlatformAuthContext,
  hasPlatformAal2,
  hasPlatformRole,
} from "@/lib/platform/auth";
import { createClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = { "Cache-Control": "no-store, private" };
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export async function GET(request: Request) {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED_PLATFORM_ACCESS", message: "Authentication as a platform user is required" } },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: "MFA_REQUIRED", message: "A verified AAL2 session is required" } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformRole(authCtx, ["PLATFORM_SUPER_ADMIN", "PLATFORM_FINANCE", "PLATFORM_AUDITOR"])) {
    return NextResponse.json(
      { error: { code: "INSUFFICIENT_ROLE_PRIVILEGES", message: "Finance, Auditor, or Super Admin role required" } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const supabase = await createClient();
  let query = supabase
    .schema("customer_api")
    .from("workspace_contracts_v1")
    .select("*", { count: "exact" });

  if (!hasPlatformRole(authCtx, "PLATFORM_SUPER_ADMIN")) {
    const allowedScopes = new Set<string>();
    if (hasPlatformRole(authCtx, "PLATFORM_FINANCE")) {
      allowedScopes.add("workspace");
      allowedScopes.add("commercial");
    }
    if (hasPlatformRole(authCtx, "PLATFORM_AUDITOR")) {
      allowedScopes.add("workspace");
      allowedScopes.add("audit");
    }
    const workspaceIds = authCtx.assignments
      .filter((assignment) => allowedScopes.has(assignment.scope_type))
      .map((assignment) => assignment.customer_workspace_id);
    query = query.in("customer_workspace_id", workspaceIds.length ? workspaceIds : [EMPTY_UUID]);
  }

  const { data: contracts, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json(
      { error: { code: "DATABASE_QUERY_FAILED", message: "Failed to retrieve contracts" } },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const workspaceIds = Array.from(new Set((contracts ?? []).map((row) => row.customer_workspace_id)));
  const planIds = Array.from(new Set((contracts ?? []).flatMap((row) => (row.plan_id ? [row.plan_id] : []))));
  const now = new Date().toISOString();
  const [workspaces, plans, entitlements] = await Promise.all([
    workspaceIds.length
      ? supabase.schema("customer_api").from("customer_workspaces_v1").select("id, commercial_owner, workspace_type, environment, lifecycle_status").in("id", workspaceIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? supabase.schema("customer_api").from("subscription_plans_v1").select("id, plan_code, version, display_name, status").in("id", planIds)
      : Promise.resolve({ data: [], error: null }),
    workspaceIds.length
      ? supabase
          .schema("customer_api")
          .from("workspace_entitlements_v1")
          .select("*")
          .in("customer_workspace_id", workspaceIds)
          .lte("valid_from", now)
          .or(`valid_until.is.null,valid_until.gt.${now}`)
          .order("customer_workspace_id")
          .order("entitlement_key")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (workspaces.error || plans.error || entitlements.error) {
    return NextResponse.json(
      { error: { code: "RELATED_DATA_QUERY_FAILED", message: "Failed to retrieve contract details" } },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      contracts: contracts ?? [],
      workspaces: workspaces.data ?? [],
      plans: plans.data ?? [],
      entitlements: entitlements.data ?? [],
      pagination: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
    },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
