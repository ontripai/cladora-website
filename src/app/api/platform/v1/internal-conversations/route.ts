import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();
const create = z.object({ action: z.literal("create"), workspace_id: uuid, recipient_id: uuid, body: z.string().trim().min(1).max(5000), request_id: uuid });
const reply = z.object({ action: z.literal("reply"), thread_id: uuid, body: z.string().trim().min(1).max(5000), request_id: uuid });
const read = z.object({ action: z.literal("read"), thread_id: uuid });
const schema = z.discriminatedUnion("action", [create, reply, read]);

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get("workspace_id");
  const recipient = request.nextUrl.searchParams.get("recipients") === "true";
  const parsed = workspace === null ? null : uuid.safeParse(workspace);
  if (parsed && !parsed.success) return NextResponse.json({ error: { code: "INVALID_WORKSPACE" } }, { status: 400, headers });
  if (recipient && !parsed?.success) return NextResponse.json({ error: { code: "INVALID_WORKSPACE" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = recipient && parsed?.success
    ? await client.schema("customer_api").rpc("list_internal_recipients_v1", { p_workspace_id: parsed.data })
    : parsed?.success
      ? await client.schema("customer_api").rpc("get_internal_conversations_v1", { p_workspace_id: parsed.data })
      : await client.schema("customer_api").rpc("list_internal_workspaces_v1");
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "INTERNAL_QUERY_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const input = parsed.data;
  const result = input.action === "create"
    ? await client.schema("customer_api").rpc("create_internal_conversation_v1", {
        p_workspace_id: input.workspace_id, p_recipient_id: input.recipient_id, p_body: input.body, p_request_id: input.request_id,
      })
    : input.action === "reply"
      ? await client.schema("customer_api").rpc("send_internal_message_v1", {
          p_thread_id: input.thread_id, p_body: input.body, p_request_id: input.request_id,
        })
      : await client.schema("customer_api").rpc("mark_internal_read_v1", { p_thread_id: input.thread_id });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "INTERNAL_MUTATION_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}
