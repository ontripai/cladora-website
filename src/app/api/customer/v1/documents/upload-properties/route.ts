import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HEADERS } from "@/lib/customer/documents-api-helper";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = z.uuid().safeParse(params.get("context_id"));
  if (!parsed.success || params.getAll("context_id").length !== 1 || Array.from(params.keys()).some((key) => key !== "context_id")) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: HEADERS });
  }
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }
  const { data, error } = await supabase.schema("customer_api").rpc(
    "list_document_upload_properties_v1" as never, { p_context_id: parsed.data } as never
  );
  if (error) {
    return NextResponse.json({ error: { code: error.code === "42501" ? "DOCUMENT_ACCESS_DENIED" : "DOCUMENT_PROPERTY_QUERY_FAILED" } },
      { status: error.code === "42501" ? 403 : 500, headers: HEADERS });
  }
  return NextResponse.json({ properties: data ?? [] }, { headers: HEADERS });
}
