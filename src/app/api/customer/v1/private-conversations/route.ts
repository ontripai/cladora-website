import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { communicationsPrivateConversationWorkspaceV1Schema } from "@/lib/customer/communications-private-conversation-workspace-v1";
import { communicationRequestReceiptV1Schema } from "@/lib/core/communication-request-receipt-v1";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const createResultSchema = z.strictObject({
  conversation_id: z.string().uuid(), message_id: z.string().uuid(), replayed: z.boolean(),
  communication_receipt: communicationRequestReceiptV1Schema,
});

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("conversation_id");
  const context = z.string().uuid().safeParse(request.nextUrl.searchParams.get("context_id"));
  const parsed = id === null ? null : z.string().uuid().safeParse(id);
  if (!context.success || (parsed && !parsed.success)) return NextResponse.json({ error: { code: "INVALID_CONVERSATION_QUERY" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("get_private_conversations_v1", {
    p_context_id: context.data,
    p_conversation_id: parsed?.success ? parsed.data : null,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "CONVERSATION_QUERY_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = communicationsPrivateConversationWorkspaceV1Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_CONVERSATION" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("create_private_conversation_v2" as never, { p_request: parsed.data } as never);
  if (result.error) {
    const status = result.error.code === "42501" ? 403 : ["23505", "40001"].includes(result.error.code) ? 409
      : ["22023", "22P02", "23514"].includes(result.error.code) ? 400 : 500;
    return NextResponse.json({ error: { code: status === 403 ? "ACCESS_DENIED" : status === 409 ? "CONVERSATION_CONFLICT" : status === 400 ? "INVALID_CONVERSATION" : "CONVERSATION_CREATE_FAILED" } }, { status, headers });
  }
  const response = createResultSchema.safeParse(result.data);
  if (!response.success) return NextResponse.json({ error: { code: "CONVERSATION_RECEIPT_INVALID" } }, { status: 502, headers });
  return NextResponse.json(response.data, { status: response.data.replayed ? 200 : 201, headers });
}
